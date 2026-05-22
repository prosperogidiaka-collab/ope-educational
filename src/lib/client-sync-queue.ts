import type { TeacherScoreSheetDraft } from "@/lib/teacher-scores";
import type { StudentAttendanceRegister } from "@/lib/types";

const DB_NAME = "ope-educational-offline-sync";
const STORE_NAME = "pending-sync-records";
const LOCAL_STORAGE_PREFIX = "ope-offline-sync:";
const RETRY_DELAYS_MS = [0, 1200, 2600, 5200] as const;

export type SyncRecordKind = "teacher_score_sheet" | "student_attendance_register";

export interface PendingSyncRecord<TPayload> {
  id: string;
  kind: SyncRecordKind;
  payload: TPayload;
  updatedAt: string;
  lastError?: string;
  attemptCount: number;
}

export interface SyncExecutionResult<TValue> {
  ok: boolean;
  value?: TValue;
  error?: Error;
  attempts: number;
  retryable: boolean;
}

type OpenDatabaseResult = IDBDatabase | null;

let databasePromise: Promise<OpenDatabaseResult> | null = null;

function canUseWindowStorage() {
  return typeof window !== "undefined";
}

function canUseIndexedDb() {
  return canUseWindowStorage() && "indexedDB" in window;
}

function localStorageKey(id: string) {
  return `${LOCAL_STORAGE_PREFIX}${id}`;
}

function isRetryableError(error: unknown) {
  return (error as { retryable?: boolean })?.retryable !== false;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function openDatabase(): Promise<OpenDatabaseResult> {
  if (!canUseIndexedDb()) {
    return null;
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve) => {
      const request = window.indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }

  return databasePromise;
}

async function readRecord<TPayload>(id: string): Promise<PendingSyncRecord<TPayload> | null> {
  if (!canUseWindowStorage()) {
    return null;
  }

  const database = await openDatabase();

  if (!database) {
    try {
      const raw = window.localStorage.getItem(localStorageKey(id));
      return raw ? (JSON.parse(raw) as PendingSyncRecord<TPayload>) : null;
    } catch {
      return null;
    }
  }

  return new Promise((resolve) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve((request.result as PendingSyncRecord<TPayload> | undefined) ?? null);
    request.onerror = () => resolve(null);
  });
}

async function writeRecord<TPayload>(record: PendingSyncRecord<TPayload>) {
  if (!canUseWindowStorage()) {
    return record;
  }

  const database = await openDatabase();

  if (!database) {
    window.localStorage.setItem(localStorageKey(record.id), JSON.stringify(record));
    return record;
  }

  return new Promise<PendingSyncRecord<TPayload>>((resolve) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put(record);
    transaction.oncomplete = () => resolve(record);
    transaction.onerror = () => resolve(record);
  });
}

async function deleteRecord(id: string) {
  if (!canUseWindowStorage()) {
    return;
  }

  const database = await openDatabase();

  if (!database) {
    window.localStorage.removeItem(localStorageKey(id));
    return;
  }

  return new Promise<void>((resolve) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

function toPermanentError(message: string) {
  const error = new Error(message) as Error & { retryable?: boolean };
  error.retryable = false;
  return error;
}

export function isRetryableResponseStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function runSyncWithRetries<TValue>(
  task: () => Promise<TValue>,
): Promise<SyncExecutionResult<TValue>> {
  let attempts = 0;
  let lastError: Error | undefined;
  let retryable = true;

  for (const delayMs of RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await wait(delayMs);
    }

    attempts += 1;

    try {
      const value = await task();
      return {
        ok: true,
        value,
        attempts,
        retryable: true,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Could not sync this change right now.");
      retryable = isRetryableError(error);

      if (!retryable) {
        break;
      }
    }
  }

  return {
    ok: false,
    error: lastError ?? toPermanentError("Could not sync this change right now."),
    attempts,
    retryable,
  };
}

export function teacherScoreSyncRecordId(assignmentId: string) {
  return `teacher-score:${assignmentId}`;
}

export function attendanceSyncRecordId(className: string, date: string) {
  return `attendance:${className}:${date}`;
}

export async function readTeacherScoreSyncRecord(assignmentId: string) {
  return readRecord<TeacherScoreSheetDraft>(teacherScoreSyncRecordId(assignmentId));
}

export async function writeTeacherScoreSyncRecord(
  draft: TeacherScoreSheetDraft,
  meta?: Partial<Pick<PendingSyncRecord<TeacherScoreSheetDraft>, "attemptCount" | "lastError">>,
) {
  return writeRecord<TeacherScoreSheetDraft>({
    id: teacherScoreSyncRecordId(draft.assignmentId),
    kind: "teacher_score_sheet",
    payload: draft,
    updatedAt: draft.updatedAt,
    attemptCount: meta?.attemptCount ?? 0,
    lastError: meta?.lastError,
  });
}

export async function clearTeacherScoreSyncRecord(assignmentId: string) {
  return deleteRecord(teacherScoreSyncRecordId(assignmentId));
}

export async function readAttendanceSyncRecord(className: string, date: string) {
  return readRecord<StudentAttendanceRegister>(attendanceSyncRecordId(className, date));
}

export async function writeAttendanceSyncRecord(
  register: StudentAttendanceRegister,
  meta?: Partial<Pick<PendingSyncRecord<StudentAttendanceRegister>, "attemptCount" | "lastError">>,
) {
  return writeRecord<StudentAttendanceRegister>({
    id: attendanceSyncRecordId(register.className, register.date),
    kind: "student_attendance_register",
    payload: register,
    updatedAt: register.updatedAt,
    attemptCount: meta?.attemptCount ?? 0,
    lastError: meta?.lastError,
  });
}

export async function clearAttendanceSyncRecord(className: string, date: string) {
  return deleteRecord(attendanceSyncRecordId(className, date));
}
