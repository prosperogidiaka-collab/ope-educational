import "server-only";

import { mkdir as nativeMkdir, readFile as nativeReadFile, writeFile as nativeWriteFile } from "fs/promises";
import path from "path";

import { getCloudflareContext } from "@opennextjs/cloudflare";

type FileEncoding = BufferEncoding | null | undefined;

interface KvNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface CloudflareContextLike {
  env?: {
    APP_DATA?: KvNamespaceLike;
  };
}

type DataBackend =
  | { kind: "filesystem" }
  | { kind: "kv"; namespace: KvNamespaceLike }
  | { kind: "memory"; store: Map<string, string> };

const DATA_ROOT = path.join(process.cwd(), "data");

declare global {
  var __opeEducationalDataStore__: Map<string, string> | undefined;
  var __opeEducationalMemoryStoreWarned__: boolean | undefined;
}

function getMemoryStore() {
  globalThis.__opeEducationalDataStore__ ??= new Map<string, string>();
  return globalThis.__opeEducationalDataStore__;
}

function warnAboutMemoryStore() {
  if (globalThis.__opeEducationalMemoryStoreWarned__) {
    return;
  }

  globalThis.__opeEducationalMemoryStoreWarned__ = true;
  console.warn(
    "APP_DATA Cloudflare binding is not configured. Falling back to in-memory app storage, which is not durable across Worker restarts.",
  );
}

async function resolveCloudflareContext() {
  try {
    return (await getCloudflareContext({ async: true })) as CloudflareContextLike;
  } catch {
    try {
      return getCloudflareContext() as CloudflareContextLike;
    } catch {
      return null;
    }
  }
}

function dataKeyFor(targetPath: string) {
  const resolvedPath = path.resolve(targetPath);
  const relativePath = path.relative(DATA_ROOT, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return relativePath.split(path.sep).join("/");
}

function buildMissingFileError(targetPath: string) {
  const error = new Error(`ENOENT: no such file or directory, open '${targetPath}'`) as NodeJS.ErrnoException;
  error.code = "ENOENT";
  error.path = targetPath;
  return error;
}

function toUtf8String(contents: string | NodeJS.ArrayBufferView) {
  if (typeof contents === "string") {
    return contents;
  }

  return Buffer.from(contents.buffer, contents.byteOffset, contents.byteLength).toString("utf8");
}

function formatFileContents(contents: string, encoding: FileEncoding) {
  if (!encoding || encoding === "utf8" || encoding === "utf-8") {
    return contents;
  }

  return Buffer.from(contents, "utf8");
}

async function resolveDataBackend(): Promise<DataBackend> {
  const cloudflareContext = await resolveCloudflareContext();

  if (!cloudflareContext) {
    return { kind: "filesystem" };
  }

  const namespace = cloudflareContext.env?.APP_DATA;

  if (namespace) {
    return { kind: "kv", namespace };
  }

  warnAboutMemoryStore();
  return { kind: "memory", store: getMemoryStore() };
}

export async function mkdir(targetPath: string, options?: { recursive?: boolean }) {
  const dataKey = dataKeyFor(targetPath);

  if (!dataKey) {
    return nativeMkdir(targetPath, options);
  }

  const backend = await resolveDataBackend();

  if (backend.kind === "filesystem") {
    return nativeMkdir(targetPath, options);
  }

  return undefined;
}

export function readFile(targetPath: string, encoding: BufferEncoding): Promise<string>;
export function readFile(targetPath: string, encoding?: null): Promise<Buffer>;
export async function readFile(targetPath: string, encoding: FileEncoding = null): Promise<string | Buffer> {
  const dataKey = dataKeyFor(targetPath);

  if (!dataKey) {
    return nativeReadFile(targetPath, encoding as BufferEncoding);
  }

  const backend = await resolveDataBackend();

  if (backend.kind === "filesystem") {
    return nativeReadFile(targetPath, encoding as BufferEncoding);
  }

  const contents =
    backend.kind === "kv" ? await backend.namespace.get(dataKey) : backend.store.get(dataKey) ?? null;

  if (contents === null) {
    throw buildMissingFileError(targetPath);
  }

  return formatFileContents(contents, encoding);
}

export async function writeFile(
  targetPath: string,
  contents: string | NodeJS.ArrayBufferView,
  encoding?: FileEncoding,
) {
  const dataKey = dataKeyFor(targetPath);

  if (!dataKey) {
    return nativeWriteFile(targetPath, contents, encoding as BufferEncoding);
  }

  const backend = await resolveDataBackend();

  if (backend.kind === "filesystem") {
    return nativeWriteFile(targetPath, contents, encoding as BufferEncoding);
  }

  const serializedContents = toUtf8String(contents);

  if (backend.kind === "kv") {
    await backend.namespace.put(dataKey, serializedContents);
    return;
  }

  backend.store.set(dataKey, serializedContents);
}
