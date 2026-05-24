export type UserRole =
  | "super_admin"
  | "school_admin"
  | "principal"
  | "registrar"
  | "teacher"
  | "manager"
  | "hod"
  | "class_teacher"
  | "bursar"
  | "parent";

export type ResultStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "corrections_requested"
  | "hod_approved"
  | "principal_approved"
  | "published"
  | "locked"
  | "archived";

export type ApprovalDecision = "pending" | "approved" | "rejected";
export type PdfTemplate = "modern" | "classic" | "detailed";
export type LegacyScoreField = "test1" | "test2" | "exam";
export type ScoreField = string;
export type GradeSection = "junior" | "senior";
export type ClassOfferingStatus = "active" | "retired";
export type SubjectRegistrationType = "core" | "elective";
export type StudentLifecycleStatus = "active" | "left" | "withdrawn" | "graduated" | "suspended";
export type StudentPortalAccountState = "active" | "disabled";
export type StudentAbsenceRequestStatus = "pending" | "approved" | "rejected";
export type SessionRolloverActionType = "duplicate_structure" | "promote_students" | "archive_arm";
export type SessionRolloverStatus = "planned" | "completed";
export type TimetablePublishState = "draft" | "published";
export type TimetableDay = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
export type AssignmentSource = "seed" | "manual" | "timetable";
export type SchoolClassStatus = "active" | "retired";
export type SchoolLogCategory =
  | "visitor"
  | "daily_report"
  | "weekly_report"
  | "challenge"
  | "progress"
  | "incident"
  | "general";
export type TeacherPortalReportCategory =
  | "general"
  | "commendation"
  | "warning"
  | "observation"
  | "development";

export type ApprovalStage =
  | "teacher_submission"
  | "hod_review"
  | "class_teacher_review"
  | "bursary_clearance"
  | "management_audit"
  | "principal_approval";

export interface SchoolProfile {
  id: string;
  schoolCode: string;
  name: string;
  shortName: string;
  motto: string;
  address: string;
  principalName: string;
  schoolAdminName?: string;
  schoolAdminEmail?: string;
  session: string;
  term: string;
  examType: string;
  portalSlug: string;
  nextResumptionDate: string;
  logoUrl: string;
  watermarkLogoUrl: string;
  governmentStampUrl: string;
}

export interface GradeBand {
  id: string;
  label: string;
  min: number;
  max: number;
  points: number;
  remark: string;
  color: string;
  section?: GradeSection;
}

export interface ScoreComponentRule {
  key: string;
  label: string;
  maxScore: number;
  weight: number;
  frozen: boolean;
  closesAt: string;
}

export interface RankingPolicy {
  tieBreakers: string[];
  excludeIncompleteStudents: boolean;
  minimumSubjectCount: number;
  roundingMode: string;
  missingScoresCountAsZero: boolean;
}

export interface AcademicConfig {
  session: string;
  term: string;
  examType: string;
  section: GradeSection;
  scoreComponents: ScoreComponentRule[];
  gradeScaleName: string;
  publishScope: string;
  rankingPolicy: RankingPolicy;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  weight: number;
  className: string;
  teacherName: string;
  section?: GradeSection;
  track?: string;
  isElective?: boolean;
}

export interface RatingItem {
  label: string;
  score: number;
}

export interface Student {
  id: string;
  regNumber: string;
  fullName: string;
  className: string;
  house: string;
  gender: string;
  dateOfBirth?: string;
  age?: number;
  guardianName: string;
  photoInitials: string;
  passportUrl?: string;
  registeredSubjectIds: string[];
  attendance: {
    present: number;
    absent: number;
    late: number;
    excused?: number;
    possible: number;
  };
  affectiveRatings: RatingItem[];
  psychomotorRatings: RatingItem[];
  teacherRemark: string;
  classTeacherComment: string;
  principalComment: string;
  improvementComment: string;
  feeStatus: "cleared" | "outstanding";
  trend: {
    label: string;
    average: number;
  }[];
}

export interface CommentSet {
  cognitive: string;
  behavioural: string;
  improvement: string;
}

export interface SubjectScore {
  subjectId: string;
  componentScores: Record<string, number | null>;
  test1: number | null;
  test2: number | null;
  exam: number | null;
  teacherComment: string;
  comments?: CommentSet;
  status: ResultStatus;
  updatedAt: string;
  updatedBy: string;
}

export interface Coupon {
  id: string;
  code: string;
  regNumber: string;
  session: string;
  term: string;
  maxViews: number;
  usedViews: number;
  expiresAt: string;
  active: boolean;
  oneTimeAccess?: boolean;
  revokedReason?: string;
  failedAttempts: number;
}

export interface PortalAccessLog {
  id: string;
  actor: string;
  timestamp: string;
  action: string;
  device: string;
  ipAddress: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  previousValue?: string;
  nextValue?: string;
  note: string;
  device?: string;
  ipAddress?: string;
}

export interface ApprovalRecord {
  id: string;
  stage: ApprovalStage;
  actor: string;
  role: UserRole;
  status: ApprovalDecision;
  timestamp: string;
  note: string;
  reason?: string;
}

export interface ResultVersion {
  id: string;
  version: string;
  actor: string;
  timestamp: string;
  summary: string;
  changes: {
    field: string;
    from: string;
    to: string;
  }[];
}

export interface ClearanceFlag {
  label: string;
  status: "pending" | "cleared" | "blocked";
  actor: string;
  note: string;
}

export interface UnlockRequest {
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  reason: string;
  status: "pending" | "approved" | "declined";
}

export interface StudentResultBundle {
  student: Student;
  status: ResultStatus;
  scores: SubjectScore[];
  approvals: ApprovalRecord[];
  auditLog: AuditEntry[];
  coupon: Coupon;
  portalAccessLogs: PortalAccessLog[];
  template: PdfTemplate;
  verificationId: string;
  versionHistory: ResultVersion[];
  clearances: ClearanceFlag[];
  publishedAt?: string;
  lockedAt?: string;
  unlockRequest?: UnlockRequest;
}

export interface ComputedSubjectScore extends SubjectScore {
  subjectName: string;
  subjectCode: string;
  weight: number;
  total: number;
  grade: GradeBand;
  classAverage: number;
  classHighest: number;
  classLowest: number;
  /** 1-based rank within the class for this subject; 0 when incomplete / not ranked. */
  subjectPosition: number;
  isIncomplete: boolean;
}

export interface StudentSummary {
  bundle: StudentResultBundle;
  computedSubjects: ComputedSubjectScore[];
  total: number;
  average: number;
  weightedAverage: number;
  gradePoints: number;
  overallGrade: GradeBand;
  position: number;
  bestSubject?: ComputedSubjectScore;
  weakestSubject?: ComputedSubjectScore;
  overallRemarkSuggestion: string;
  trendDirection: "up" | "steady" | "down";
  incompleteSubjects: number;
  eligibleForPosition: boolean;
  anomalies: string[];
}

export interface TeacherGridRow {
  regNumber: string;
  fullName: string;
  componentScores: Record<string, number | null>;
  test1: number | null;
  test2: number | null;
  exam: number | null;
  teacherComment: string;
  status: ResultStatus;
}

export interface ClassOffering {
  id?: string;
  schoolCode?: string;
  session?: string;
  baseClassName?: string;
  className: string;
  arm: string;
  track: string;
  section: GradeSection;
  classTeacher: string;
  hod: string;
  subjectIds: string[];
  electiveSubjectIds: string[];
  publicationProgress: number;
  pendingTeachers: string[];
  status?: ClassOfferingStatus;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PromotionCandidate {
  regNumber: string;
  studentName: string;
  currentClass: string;
  nextClass: string;
  status: "ready" | "hold";
  reason: string;
}

export interface CommentTemplate {
  id: string;
  tone: string;
  category: "cognitive" | "behavioural" | "improvement";
  text: string;
}

export interface ReviewCase {
  id: string;
  regNumber: string;
  studentName: string;
  teacher: string;
  subject: string;
  status: ResultStatus;
  anomaly: string;
  submittedValue: string;
  correctedValue: string;
  note: string;
}

export interface NotificationItem {
  id: string;
  audience: string;
  title: string;
  message: string;
  timestamp: string;
}

export interface SchoolPortfolioItem {
  id: string;
  schoolCode: string;
  name: string;
  status: "trial" | "active" | "expired" | "suspended";
  plan: string;
  students: number;
  storageUsedGb: number;
  storageQuotaGb: number;
  renewalDate: string;
  portalSlug: string;
  lastFollowUpAt: string;
  notes: string;
}

export interface PlatformSettings {
  maintenanceMode: boolean;
  allowSchoolOnboarding: boolean;
  allowPortalAccess: boolean;
  supportEmail: string;
  ownerBroadcast: string;
  updatedAt: string;
}

export interface VerificationRecord {
  verificationId: string;
  regNumber: string;
  studentName: string;
  className: string;
  session: string;
  term: string;
  status: ResultStatus;
  publishedAt?: string;
}

export interface TemplatePreset {
  id: string;
  name: string;
  summary: string;
  primaryColor: string;
  watermarkStyle: string;
  sections: {
    attendance: boolean;
    affective: boolean;
    psychomotor: boolean;
    trend: boolean;
    feeStatus: boolean;
    verification: boolean;
  };
}

export type AccountStatus = "active" | "disabled" | "invited";
export type TemplateZoneId =
  | "header"
  | "student_bio"
  | "academic_table"
  | "qualitative"
  | "remarks"
  | "signatures"
  | "verification";
export type TemplateAcademicColumn =
  | "test1"
  | "test2"
  | "exam"
  | "total"
  | "grade"
  | "subjectPosition"
  | "classAverage"
  | "classHighest"
  | "classLowest"
  | "teacherRemark";
export type TemplateFontFamily = "Inter" | "Montserrat" | "Georgia" | "Playfair Display";
export type TemplateBorderStyle = "minimalist" | "executive" | "traditional";
export type TemplateEditorStatus = "draft" | "live" | "locked";

export interface StaffAccount {
  id: string;
  schoolCode: string;
  fullName: string;
  email: string;
  photoUrl?: string;
  role: UserRole;
  status: AccountStatus;
  mustChangePassword?: boolean;
  registeredBy: string;
  canRegisterTeachers?: boolean;
  canDisableTeachers?: boolean;
  canRegisterStudents?: boolean;
  grantedSchoolCodes?: string[];
  assignedArms: string[];
  assignedSubjects: string[];
  classTeacherArms: string[];
  lastAction: string;
}

export interface SubjectTeacherAssignment {
  id: string;
  schoolCode: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  className: string;
  arm: string;
  section?: GradeSection;
  track?: string;
  subjectType?: SubjectRegistrationType;
  active?: boolean;
  assignmentSource?: AssignmentSource;
  manualOverride?: boolean;
  teacherAccountId?: string;
  teacherName?: string;
  assignedBy: string;
  assignedAt?: string;
  updatedAt: string;
}

export interface ResultLockRecord {
  id: string;
  className: string;
  session: string;
  term: string;
  locked: boolean;
  note?: string;
  lockedAt?: string;
  lockedBy?: string;
  unlockedAt?: string;
  unlockedBy?: string;
}

export interface StudentPortalCredential {
  id: string;
  studentName: string;
  regNumber: string;
  schoolCode: string;
  username: string;
  temporaryPassword: string;
  generatedBy: string;
  generatedAt: string;
  status: "ready" | "sent" | "reset_required";
  accountState: StudentPortalAccountState;
  couponCode: string;
  lastLoginAt?: string;
  disabledReason?: string;
}

export interface StudentProfileRecord {
  studentId: string;
  regNumber: string;
  schoolCode: string;
  fullName: string;
  className: string;
  arm: string;
  section?: GradeSection;
  track?: string;
  house: string;
  gender: string;
  dateOfBirth?: string;
  age?: number;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  fatherName: string;
  fatherPhone: string;
  motherName: string;
  motherPhone: string;
  homeAddress: string;
  admissionDate: string;
  boardingStatus: "day" | "boarding";
  bloodGroup: string;
  genotype: string;
  religion: string;
  stateOfOrigin: string;
  localGovernment: string;
  medicalNotes: string;
  clubs: string[];
  photoInitials: string;
  passportUrl?: string;
  feeStatus: "cleared" | "outstanding";
  studentStatus: StudentLifecycleStatus;
  updatedAt: string;
}

export type StudentReportCategory =
  | "praise"
  | "guidance"
  | "discipline"
  | "health"
  | "result_comment"
  | "general";

export interface StudentReportEntry {
  id: string;
  schoolCode: string;
  regNumber: string;
  studentName: string;
  className: string;
  title: string;
  body: string;
  category: StudentReportCategory;
  authorAccountId?: string;
  authorName: string;
  authorRole: UserRole;
  subjectName?: string;
  showOnPortal: boolean;
  showOnResultSheet: boolean;
  praise: boolean;
  attachmentLabel?: string;
  attachmentUrl?: string;
  attachmentMimeType?: string;
  attachmentSizeBytes?: number;
  createdAt: string;
  updatedAt: string;
}

export type StudentAttendanceStatus = "present" | "absent" | "late" | "excused";

export interface StudentAttendanceEntry {
  regNumber: string;
  studentName: string;
  status: StudentAttendanceStatus;
  note?: string;
}

export interface StudentAttendanceRegister {
  id: string;
  schoolCode: string;
  className: string;
  arm: string;
  session: string;
  term: string;
  date: string;
  recordedByAccountId?: string;
  recordedByName: string;
  updatedAt: string;
  entries: StudentAttendanceEntry[];
}

export interface StudentAttendancePolicy {
  schoolCode: string;
  session: string;
  term: string;
  attendanceEnabled: boolean;
  classTeacherCommentEnabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface StudentAttendanceAggregate {
  regNumber: string;
  studentName?: string;
  className?: string;
  arm?: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  possible: number;
  percentage: number;
  lastMarkedAt?: string;
}

export interface StudentAbsenceRequest {
  id: string;
  schoolCode: string;
  regNumber: string;
  studentName: string;
  className: string;
  requestedFrom: string;
  requestedTo: string;
  reason: string;
  note?: string;
  attachmentLabel?: string;
  attachmentUrl?: string;
  attachmentMimeType?: string;
  attachmentSizeBytes?: number;
  status: StudentAbsenceRequestStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
}

export interface SessionRolloverRecord {
  id: string;
  schoolCode: string;
  currentSession: string;
  nextSession: string;
  sourceClassName: string;
  sourceArm: string;
  targetClassName?: string;
  targetArm?: string;
  actionType: SessionRolloverActionType;
  status: SessionRolloverStatus;
  note: string;
  actedBy: string;
  actedAt: string;
}

export interface TimetablePeriod {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
}

export interface TimetableEntry {
  id: string;
  schoolCode: string;
  day: TimetableDay;
  periodId: string;
  periodLabel: string;
  startTime: string;
  endTime: string;
  teacherName: string;
  teacherAccountId?: string;
  subjectName: string;
  baseClassName?: string;
  className: string;
  arm: string;
  track?: string;
  room?: string;
}

export interface SchoolTimetable {
  schoolCode: string;
  session: string;
  term: string;
  publishState: TimetablePublishState;
  publishedAt?: string;
  publishedBy?: string;
  updatedAt: string;
  updatedBy: string;
  periods: TimetablePeriod[];
  entries: TimetableEntry[];
}

export interface SchoolClassRecord {
  id: string;
  schoolCode: string;
  session: string;
  className: string;
  section: GradeSection;
  status: SchoolClassStatus;
  updatedAt: string;
  updatedBy: string;
}

export interface SchoolLogEntry {
  id: string;
  schoolCode: string;
  category: SchoolLogCategory;
  title: string;
  body: string;
  logDate: string;
  reportingWindow?: string;
  visitorName?: string;
  visitorPurpose?: string;
  attachmentLabel?: string;
  attachmentUrl?: string;
  attachmentMimeType?: string;
  attachmentSizeBytes?: number;
  authorAccountId?: string;
  authorName: string;
  authorRole: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherPortalReportEntry {
  id: string;
  schoolCode: string;
  teacherAccountId: string;
  teacherName: string;
  category: TeacherPortalReportCategory;
  title: string;
  body: string;
  showOnTeacherPortal: boolean;
  attachmentLabel?: string;
  attachmentUrl?: string;
  attachmentMimeType?: string;
  attachmentSizeBytes?: number;
  authorAccountId?: string;
  authorName: string;
  authorRole: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface RoleGovernancePolicy {
  principalCanRegisterTeachers: boolean;
  hodCanRegisterTeachersIfPermitted: boolean;
  hodTeacherRegistrationEnabled: boolean;
  principalCanDisableTeachers: boolean;
  superAdminCanDisablePrincipal: boolean;
  registrarCanRegisterStudents: boolean;
  studentsUseDedicatedPortalLogin: boolean;
}

export interface ResultTemplateSchema {
  id: string;
  name: string;
  summary: string;
  primaryColor: string;
  fontFamily: TemplateFontFamily;
  borderStyle: TemplateBorderStyle;
  terminology: {
    termLabel: string;
    teacherRemarkLabel: string;
    classTeacherRemarkLabel: string;
    principalRemarkLabel: string;
  };
  zones: TemplateZoneId[];
  header: {
    logoPosition: "left" | "center" | "right";
    showSchoolName: boolean;
    showAddress: boolean;
    showSchoolCode: boolean;
    showGovernmentStamp: boolean;
    logoUrl?: string;
    governmentStampUrl?: string;
  };
  studentBio: {
    showPassport: boolean;
    showDob: boolean;
    showAge: boolean;
    showGender: boolean;
    showRegNumber: boolean;
    showHouse: boolean;
    showHostel: boolean;
  };
  academicTable: {
    columns: TemplateAcademicColumn[];
  };
  qualitative: {
    showAffective: boolean;
    showPsychomotor: boolean;
  };
  signatures: {
    showClassTeacherSignature: boolean;
    showPrincipalSignature: boolean;
    classTeacherSignatureUrl?: string;
    principalSignatureUrl?: string;
  };
  watermark: {
    enabled: boolean;
    imageUrl?: string;
    opacity: number;
  };
  controls: {
    showGradingLegend: boolean;
    showTrendAnalysis: boolean;
    showVerificationQr: boolean;
    previewWithSampleData: boolean;
  };
}

export interface ResultTemplateWorkspace {
  schoolCode: string;
  starterTemplates: ResultTemplateSchema[];
  draftSchema: ResultTemplateSchema;
  liveSchema: ResultTemplateSchema;
  status: TemplateEditorStatus;
  lockedReason?: string;
  updatedAt: string;
}
