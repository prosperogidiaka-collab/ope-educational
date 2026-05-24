import { rankStudentSummaries } from "@/lib/calculations";
import type {
  AcademicConfig,
  ApprovalRecord,
  AuditEntry,
  ClassOffering,
  ClearanceFlag,
  CommentTemplate,
  Coupon,
  GradeBand,
  NotificationItem,
  PortalAccessLog,
  PromotionCandidate,
  ResultVersion,
  ResultTemplateSchema,
  RoleGovernancePolicy,
  ReviewCase,
  SchoolPortfolioItem,
  StaffAccount,
  SchoolProfile,
  SubjectTeacherAssignment,
  Student,
  StudentPortalCredential,
  StudentResultBundle,
  Subject,
  ResultLockRecord,
  TemplatePreset,
  UserRole,
  VerificationRecord,
} from "@/lib/types";

let idCounter = 0;

function makeId(prefix: string) {
  idCounter += 1;
  return `${prefix}_${idCounter.toString().padStart(3, "0")}`;
}

export const school: SchoolProfile = {
  id: "school_ope_001",
  schoolCode: "OPE-SEC-001",
  name: "OPE EDUCATIONAL",
  shortName: "OPE EDUCATIONAL",
  motto: "Discipline, Excellence, Distinction",
  address: "12 Victory Avenue, Ikeja, Lagos",
  principalName: "Mrs. Opeyemi Adewale",
  schoolAdminName: "Mrs. Damilola Arinze",
  schoolAdminEmail: "admin@ope.edu.ng",
  session: "2025/2026",
  term: "Second Term",
  examType: "Terminal Examination",
  portalSlug: "ope-educational",
  nextResumptionDate: "2026-05-18T08:00:00.000Z",
  logoUrl: "/assets/ope-school-logo.svg",
  watermarkLogoUrl: "/assets/ope-watermark.svg",
  governmentStampUrl: "/assets/ope-government-stamp.svg",
};

export const gradeScale: GradeBand[] = [
  { id: "a", label: "A", min: 75, max: 100, points: 5, remark: "Excellent", color: "#1d8348", section: "senior" },
  { id: "b", label: "B", min: 65, max: 74, points: 4, remark: "Very Good", color: "#2176ae", section: "senior" },
  { id: "c", label: "C", min: 55, max: 64, points: 3, remark: "Good", color: "#d97706", section: "senior" },
  { id: "d", label: "D", min: 45, max: 54, points: 2, remark: "Fair", color: "#b45309", section: "senior" },
  { id: "e", label: "E", min: 40, max: 44, points: 1, remark: "Pass", color: "#92400e", section: "senior" },
  { id: "f", label: "F", min: 0, max: 39, points: 0, remark: "Needs Support", color: "#a61e4d", section: "senior" },
];

export const juniorGradeScale: GradeBand[] = [
  { id: "jd", label: "Distinction", min: 75, max: 100, points: 4, remark: "Excellent command", color: "#1d8348", section: "junior" },
  { id: "jc", label: "Credit", min: 60, max: 74, points: 3, remark: "Strong performance", color: "#2176ae", section: "junior" },
  { id: "jp", label: "Pass", min: 40, max: 59, points: 2, remark: "Meets minimum standard", color: "#d97706", section: "junior" },
  { id: "jf", label: "Fail", min: 0, max: 39, points: 0, remark: "Needs intensive support", color: "#a61e4d", section: "junior" },
];

export const currentAcademicConfig: AcademicConfig = {
  session: school.session,
  term: school.term,
  examType: school.examType,
  section: "senior",
  gradeScaleName: "Senior A-F scale",
  publishScope: "Publish by class, arm, and term",
  scoreComponents: [
    { key: "test1", label: "Test 1", maxScore: 20, weight: 20, frozen: true, closesAt: "2026-02-28T23:59:00.000Z" },
    { key: "test2", label: "Assignment / Test 2", maxScore: 20, weight: 20, frozen: true, closesAt: "2026-03-25T23:59:00.000Z" },
    { key: "exam", label: "Exam", maxScore: 60, weight: 60, frozen: false, closesAt: "2026-04-18T23:59:00.000Z" },
  ],
  rankingPolicy: {
    tieBreakers: ["weightedAverage", "mathematics", "english", "attendance"],
    excludeIncompleteStudents: true,
    minimumSubjectCount: 7,
    roundingMode: "Round to 2 decimal places",
    missingScoresCountAsZero: false,
  },
};

export const subjects: Subject[] = [
  { id: "math", code: "MTH", name: "Mathematics", weight: 5, className: "SS2 Gold", teacherName: "Mr. Kalejaiye", section: "senior", track: "Science" },
  { id: "eng", code: "ENG", name: "English Language", weight: 5, className: "SS2 Gold", teacherName: "Mrs. Hassan", section: "senior", track: "Science" },
  { id: "bio", code: "BIO", name: "Biology", weight: 4, className: "SS2 Gold", teacherName: "Mrs. Mordi", section: "senior", track: "Science" },
  { id: "chem", code: "CHM", name: "Chemistry", weight: 4, className: "SS2 Gold", teacherName: "Mr. Ugwu", section: "senior", track: "Science" },
  { id: "phy", code: "PHY", name: "Physics", weight: 4, className: "SS2 Gold", teacherName: "Mr. Alabi", section: "senior", track: "Science" },
  { id: "econ", code: "ECO", name: "Economics", weight: 3, className: "SS2 Gold", teacherName: "Mrs. Benson", section: "senior", track: "Science", isElective: true },
  { id: "crs", code: "CRS", name: "Christian Religious Studies", weight: 2, className: "SS2 Gold", teacherName: "Mrs. Odili", section: "senior", track: "Science", isElective: true },
  { id: "civ", code: "CIV", name: "Civic Education", weight: 2, className: "SS2 Gold", teacherName: "Mr. Ajayi", section: "senior", track: "Science" },
  { id: "lit", code: "LIT", name: "Literature", weight: 4, className: "SS2 Silver", teacherName: "Mrs. Nnamani", section: "senior", track: "Arts", isElective: true },
  { id: "gov", code: "GOV", name: "Government", weight: 4, className: "SS2 Silver", teacherName: "Mr. Danjuma", section: "senior", track: "Arts" },
];

export const classOfferings: ClassOffering[] = [
  {
    className: "SS2 Gold",
    arm: "Gold",
    track: "Science",
    section: "senior",
    classTeacher: "Mrs. Folake Aina",
    hod: "Dr. Tunde Balogun",
    subjectIds: ["math", "eng", "bio", "chem", "phy", "econ", "crs", "civ"],
    electiveSubjectIds: ["econ", "crs"],
    publicationProgress: 82,
    pendingTeachers: ["Physics", "Economics"],
  },
  {
    className: "SS2 Silver",
    arm: "Silver",
    track: "Arts",
    section: "senior",
    classTeacher: "Mr. Joseph Olatunji",
    hod: "Mrs. Chizoba Okeke",
    subjectIds: ["math", "eng", "lit", "gov", "econ", "crs", "civ"],
    electiveSubjectIds: ["lit", "econ", "crs"],
    publicationProgress: 64,
    pendingTeachers: ["Literature"],
  },
];

function ratings(...items: [string, number][]) {
  return items.map(([label, score]) => ({ label, score }));
}

const students: Student[] = [
  {
    id: "student_1",
    regNumber: "OPE/SS2/001",
    fullName: "Adewale Maria",
    className: "SS2 Gold",
    house: "Blue House",
    gender: "Female",
    dateOfBirth: "2009-02-14",
    age: 17,
    guardianName: "Mr. Adewale",
    photoInitials: "AM",
    registeredSubjectIds: ["math", "eng", "bio", "chem", "phy", "econ", "crs", "civ"],
    attendance: { present: 72, absent: 2, late: 1, possible: 74 },
    affectiveRatings: ratings(["Punctuality", 5], ["Leadership", 4], ["Neatness", 5], ["Honesty", 5], ["Cooperation", 5]),
    psychomotorRatings: ratings(["Handwriting", 4], ["Sports", 4], ["Practical Skills", 5], ["Creativity", 4], ["ICT Fluency", 5]),
    teacherRemark: "A brilliant student with excellent task completion habits.",
    classTeacherComment: "Focused, dependable, and highly responsive in class.",
    principalComment: "Maintain this strong academic rhythm.",
    improvementComment: "Stretch into more visible peer leadership next term.",
    feeStatus: "cleared",
    trend: [
      { label: "1st Term", average: 79.4 },
      { label: "2nd Term Mid", average: 80.1 },
      { label: "Current", average: 82.25 },
    ],
  },
  {
    id: "student_2",
    regNumber: "OPE/SS2/002",
    fullName: "Okonkwo Daniel",
    className: "SS2 Gold",
    house: "Red House",
    gender: "Male",
    dateOfBirth: "2008-11-07",
    age: 17,
    guardianName: "Mrs. Okonkwo",
    photoInitials: "OD",
    registeredSubjectIds: ["math", "eng", "bio", "chem", "phy", "econ", "crs", "civ"],
    attendance: { present: 69, absent: 5, late: 2, possible: 74 },
    affectiveRatings: ratings(["Punctuality", 4], ["Leadership", 4], ["Neatness", 4], ["Honesty", 5], ["Cooperation", 4]),
    psychomotorRatings: ratings(["Handwriting", 4], ["Sports", 3], ["Practical Skills", 4], ["Creativity", 4], ["ICT Fluency", 4]),
    teacherRemark: "Works steadily and responds well to feedback.",
    classTeacherComment: "Improving steadily and asks thoughtful questions.",
    principalComment: "A strong term. Keep pushing in English.",
    improvementComment: "Daily reading practice will lift language subjects further.",
    feeStatus: "cleared",
    trend: [
      { label: "1st Term", average: 73.8 },
      { label: "2nd Term Mid", average: 74.1 },
      { label: "Current", average: 77.12 },
    ],
  },
  {
    id: "student_3",
    regNumber: "OPE/SS2/003",
    fullName: "Yusuf Zainab",
    className: "SS2 Gold",
    house: "Green House",
    gender: "Female",
    dateOfBirth: "2009-05-24",
    age: 16,
    guardianName: "Alhaji Yusuf",
    photoInitials: "YZ",
    registeredSubjectIds: ["math", "eng", "bio", "chem", "phy", "econ", "civ"],
    attendance: { present: 67, absent: 7, late: 4, possible: 74 },
    affectiveRatings: ratings(["Punctuality", 3], ["Leadership", 4], ["Neatness", 4], ["Honesty", 5], ["Cooperation", 4]),
    psychomotorRatings: ratings(["Handwriting", 4], ["Sports", 3], ["Practical Skills", 3], ["Creativity", 4], ["ICT Fluency", 3]),
    teacherRemark: "Excellent in verbal work, but practical accuracy needs review.",
    classTeacherComment: "Attendance and completion rate need closer monitoring.",
    principalComment: "Address flagged corrections before publication.",
    improvementComment: "Focus on completing all science scripts fully and on time.",
    feeStatus: "outstanding",
    trend: [
      { label: "1st Term", average: 69.2 },
      { label: "2nd Term Mid", average: 66.5 },
      { label: "Current", average: 61.43 },
    ],
  },
  {
    id: "student_4",
    regNumber: "OPE/SS2/004",
    fullName: "Nwosu Chidera",
    className: "SS2 Gold",
    house: "Yellow House",
    gender: "Male",
    dateOfBirth: "2008-08-18",
    age: 17,
    guardianName: "Mr. Nwosu",
    photoInitials: "NC",
    registeredSubjectIds: ["math", "eng", "bio", "chem", "phy", "econ", "crs", "civ"],
    attendance: { present: 71, absent: 3, late: 1, possible: 74 },
    affectiveRatings: ratings(["Punctuality", 5], ["Leadership", 4], ["Neatness", 5], ["Honesty", 5], ["Cooperation", 5]),
    psychomotorRatings: ratings(["Handwriting", 4], ["Sports", 5], ["Practical Skills", 5], ["Creativity", 4], ["ICT Fluency", 4]),
    teacherRemark: "Disciplined and consistent across the sciences.",
    classTeacherComment: "Reliable, respectful, and academically mature.",
    principalComment: "Very strong performance. Aim for more leadership.",
    improvementComment: "Take more initiative in collaborative projects.",
    feeStatus: "cleared",
    trend: [
      { label: "1st Term", average: 77.6 },
      { label: "2nd Term Mid", average: 78.8 },
      { label: "Current", average: 79.25 },
    ],
  },
  {
    id: "student_5",
    regNumber: "OPE/SS2/005",
    fullName: "Bello Idris",
    className: "SS2 Gold",
    house: "Blue House",
    gender: "Male",
    dateOfBirth: "2009-01-03",
    age: 17,
    guardianName: "Mrs. Bello",
    photoInitials: "BI",
    registeredSubjectIds: ["math", "eng", "bio", "chem", "phy", "civ", "crs"],
    attendance: { present: 64, absent: 10, late: 5, possible: 74 },
    affectiveRatings: ratings(["Punctuality", 3], ["Leadership", 3], ["Neatness", 4], ["Honesty", 4], ["Cooperation", 4]),
    psychomotorRatings: ratings(["Handwriting", 3], ["Sports", 4], ["Practical Skills", 4], ["Creativity", 3], ["ICT Fluency", 3]),
    teacherRemark: "Shows grit and is improving with guided revision.",
    classTeacherComment: "Attendance improvement is already helping performance.",
    principalComment: "Build on this upward trend with daily revision.",
    improvementComment: "Sustain punctuality and reduce missed learning time.",
    feeStatus: "cleared",
    trend: [
      { label: "1st Term", average: 56.4 },
      { label: "2nd Term Mid", average: 58.1 },
      { label: "Current", average: 60.18 },
    ],
  },
];

const coupons: Coupon[] = [
  { id: "coupon_1", code: "A93K2L7Q8P", regNumber: "OPE/SS2/001", session: school.session, term: school.term, maxViews: 3, usedViews: 1, expiresAt: "2026-07-30T23:59:00.000Z", active: true, failedAttempts: 0 },
  { id: "coupon_2", code: "B7M4N8X2Q5", regNumber: "OPE/SS2/002", session: school.session, term: school.term, maxViews: 3, usedViews: 0, expiresAt: "2026-07-30T23:59:00.000Z", active: true, failedAttempts: 1 },
  { id: "coupon_3", code: "C1R5T9U3V7", regNumber: "OPE/SS2/003", session: school.session, term: school.term, maxViews: 2, usedViews: 2, expiresAt: "2026-05-10T23:59:00.000Z", active: false, oneTimeAccess: true, revokedReason: "Revoked after repeated failed portal access attempts.", failedAttempts: 6 },
  { id: "coupon_4", code: "D2W6Y0Z4H8", regNumber: "OPE/SS2/004", session: school.session, term: school.term, maxViews: 3, usedViews: 1, expiresAt: "2026-07-30T23:59:00.000Z", active: true, failedAttempts: 0 },
  { id: "coupon_5", code: "E3J7K1L5M9", regNumber: "OPE/SS2/005", session: school.session, term: school.term, maxViews: 3, usedViews: 0, expiresAt: "2026-07-30T23:59:00.000Z", active: true, failedAttempts: 0 },
];

function clearances(status: "cleared" | "blocked" = "cleared"): ClearanceFlag[] {
  return [
    { label: "Bursary clearance", status, actor: "Bursar", note: status === "blocked" ? "Outstanding fees must be resolved before portal release." : "Fee obligations cleared for this term." },
    { label: "Admin release", status: "cleared", actor: "Result Office", note: "Result format and identifiers verified." },
  ];
}

function approvals(mode: "published" | "corrected"): ApprovalRecord[] {
  if (mode === "corrected") {
    return [
      { id: makeId("appr"), stage: "teacher_submission", actor: "Mr. Kalejaiye", role: "teacher", status: "approved", timestamp: "2026-04-08T09:10:00.000Z", note: "Scores submitted after moderation." },
      { id: makeId("appr"), stage: "hod_review", actor: "Dr. Tunde Balogun", role: "hod", status: "rejected", timestamp: "2026-04-08T12:40:00.000Z", note: "Chemistry script total does not match uploaded script summary.", reason: "Chemistry exam script mismatch and incomplete Physics exam score." },
      { id: makeId("appr"), stage: "class_teacher_review", actor: "Mrs. Folake Aina", role: "class_teacher", status: "pending", timestamp: "2026-04-08T14:05:00.000Z", note: "Awaiting corrected science entries and attendance confirmation." },
      { id: makeId("appr"), stage: "bursary_clearance", actor: "Bursary Desk", role: "bursar", status: "rejected", timestamp: "2026-04-09T08:05:00.000Z", note: "Portal release blocked until school fee balance is settled.", reason: "Outstanding levy for laboratory materials." },
      { id: makeId("appr"), stage: "management_audit", actor: "Vice Principal Academics", role: "manager", status: "pending", timestamp: "2026-04-09T09:30:00.000Z", note: "Waiting for teacher correction pack." },
      { id: makeId("appr"), stage: "principal_approval", actor: school.principalName, role: "principal", status: "pending", timestamp: "2026-04-10T15:40:00.000Z", note: "Principal sign-off suspended until all blockers clear." },
    ];
  }

  return [
    { id: makeId("appr"), stage: "teacher_submission", actor: "Assigned subject teachers", role: "teacher", status: "approved", timestamp: "2026-04-08T09:10:00.000Z", note: "Subject sheets submitted with moderated scores." },
    { id: makeId("appr"), stage: "hod_review", actor: "Dr. Tunde Balogun", role: "hod", status: "approved", timestamp: "2026-04-08T12:30:00.000Z", note: "HOD verified scripts and anomalies." },
    { id: makeId("appr"), stage: "class_teacher_review", actor: "Mrs. Folake Aina", role: "class_teacher", status: "approved", timestamp: "2026-04-08T16:20:00.000Z", note: "Attendance, affective, and psychomotor checks completed." },
    { id: makeId("appr"), stage: "bursary_clearance", actor: "Bursary Desk", role: "bursar", status: "approved", timestamp: "2026-04-09T08:05:00.000Z", note: "Student cleared for release." },
    { id: makeId("appr"), stage: "management_audit", actor: "Vice Principal Academics", role: "manager", status: "approved", timestamp: "2026-04-09T10:10:00.000Z", note: "Audit trail confirmed and locked for principal review." },
    { id: makeId("appr"), stage: "principal_approval", actor: school.principalName, role: "principal", status: "approved", timestamp: "2026-04-10T15:40:00.000Z", note: "Cleared for publication and locked release." },
  ];
}

function portalLogs(regNumber: string): PortalAccessLog[] {
  return [
    { id: makeId("access"), actor: regNumber, timestamp: "2026-04-10T18:20:00.000Z", action: "Viewed result", device: "Android Chrome", ipAddress: "102.89.24.10" },
    { id: makeId("access"), actor: regNumber, timestamp: "2026-04-11T07:52:00.000Z", action: "Downloaded PDF", device: "Windows Edge", ipAddress: "105.112.44.91" },
  ];
}

function auditTrail(name: string, published: boolean): AuditEntry[] {
  const trail: AuditEntry[] = [
    {
      id: makeId("audit"),
      actor: "Mr. Kalejaiye",
      action: "Updated score",
      target: `${name} / Mathematics`,
      timestamp: "2026-04-08T08:42:00.000Z",
      previousValue: "Exam: 51",
      nextValue: "Exam: 54",
      note: "Corrected script total after recheck.",
      device: "Faculty Laptop",
      ipAddress: "10.8.0.18",
    },
    {
      id: makeId("audit"),
      actor: "Dr. Tunde Balogun",
      action: "Reviewed result sheet",
      target: `${name} / HOD Desk`,
      timestamp: "2026-04-08T12:30:00.000Z",
      note: published ? "Moderation completed and cross-checked." : "Score anomaly found during moderation.",
      device: "Admin Tablet",
      ipAddress: "10.8.0.21",
    },
  ];

  if (published) {
    trail.push({
      id: makeId("audit"),
      actor: school.principalName,
      action: "Signed and locked result",
      target: `${name} / Result sheet`,
      timestamp: "2026-04-10T15:40:00.000Z",
      note: "Ready for secure student access.",
      device: "Principal Console",
      ipAddress: "10.8.0.2",
    });
  }

  return trail;
}

function versionHistory(published: boolean): ResultVersion[] {
  const versions: ResultVersion[] = [
    {
      id: makeId("ver"),
      version: "v1",
      actor: "Assigned subject teachers",
      timestamp: "2026-04-08T09:10:00.000Z",
      summary: "Initial score sheet submission.",
      changes: [{ field: "Result status", from: "Draft", to: "Submitted" }],
    },
    {
      id: makeId("ver"),
      version: "v2",
      actor: "Science HOD",
      timestamp: "2026-04-08T12:30:00.000Z",
      summary: published ? "Moderation complete and ready for class teacher review." : "Corrections requested after moderation.",
      changes: published ? [{ field: "Workflow", from: "Submitted", to: "Under review" }] : [{ field: "Chemistry Exam", from: "42", to: "38" }],
    },
  ];

  if (published) {
    versions.push({
      id: makeId("ver"),
      version: "v3",
      actor: school.principalName,
      timestamp: "2026-04-10T15:40:00.000Z",
      summary: "Published, verification token issued, and sheet locked.",
      changes: [{ field: "Result status", from: "Principal approved", to: "Locked" }],
    });
  }

  return versions;
}

function scoreSet(entries: Record<string, [number | null, number | null, number | null]>, status: StudentResultBundle["status"]) {
  const commentBank = {
    high: {
      cognitive: "Shows deep mastery of key concepts.",
      behavioural: "Highly engaged and attentive.",
      improvement: "Keep stretching into advanced practice.",
    },
    mid: {
      cognitive: "Understands core concepts but needs more fluency.",
      behavioural: "Participates well when prompted.",
      improvement: "Regular practice will improve consistency.",
    },
    low: {
      cognitive: "Needs more guided reinforcement of core skills.",
      behavioural: "Should improve focus during lessons.",
      improvement: "Work closely with assigned revision support.",
    },
  };

  return Object.entries(entries).map(([subjectId, values]) => {
    const total = (values[0] ?? 0) + (values[1] ?? 0) + (values[2] ?? 0);
    const set = total >= 75 ? commentBank.high : total >= 55 ? commentBank.mid : commentBank.low;

    return {
      subjectId,
      componentScores: {
        test1: values[0],
        test2: values[1],
        exam: values[2],
      },
      test1: values[0],
      test2: values[1],
      exam: values[2],
      teacherComment: set.cognitive,
      comments: set,
      status,
      updatedAt: "2026-04-08T08:42:00.000Z",
      updatedBy: "Assigned teacher",
    };
  });
}

export const resultBundles: StudentResultBundle[] = [
  {
    student: students[0],
    status: "locked",
    scores: scoreSet({ math: [18, 19, 54], eng: [16, 18, 52], bio: [17, 19, 50], chem: [18, 18, 53], phy: [17, 18, 52], econ: [16, 17, 50], crs: [18, 17, 49], civ: [18, 18, 50] }, "locked"),
    approvals: approvals("published"),
    auditLog: auditTrail(students[0].fullName, true),
    coupon: coupons[0],
    portalAccessLogs: portalLogs(students[0].regNumber),
    template: "modern",
    verificationId: "OPE-2026-2T-001",
    versionHistory: versionHistory(true),
    clearances: clearances("cleared"),
    publishedAt: "2026-04-10T15:40:00.000Z",
    lockedAt: "2026-04-10T15:42:00.000Z",
  },
  {
    student: students[1],
    status: "locked",
    scores: scoreSet({ math: [16, 17, 49], eng: [15, 16, 46], bio: [17, 17, 48], chem: [15, 16, 47], phy: [16, 17, 49], econ: [16, 16, 46], crs: [18, 18, 47], civ: [17, 18, 46] }, "locked"),
    approvals: approvals("published"),
    auditLog: auditTrail(students[1].fullName, true),
    coupon: coupons[1],
    portalAccessLogs: portalLogs(students[1].regNumber),
    template: "classic",
    verificationId: "OPE-2026-2T-002",
    versionHistory: versionHistory(true),
    clearances: clearances("cleared"),
    publishedAt: "2026-04-10T15:40:00.000Z",
    lockedAt: "2026-04-10T15:42:00.000Z",
    unlockRequest: {
      requestedBy: "Vice Principal Academics",
      requestedAt: "2026-04-11T09:35:00.000Z",
      reason: "Parent reported mismatch between script and Physics exam entry.",
      status: "pending",
    },
  },
  {
    student: students[2],
    status: "corrections_requested",
    scores: scoreSet({ math: [14, 15, 43], eng: [17, 17, 49], bio: [15, 16, 45], chem: [13, 14, 38], phy: [14, 15, null], econ: [16, 16, 44], civ: [17, 17, 45] }, "corrections_requested"),
    approvals: approvals("corrected"),
    auditLog: auditTrail(students[2].fullName, false),
    coupon: coupons[2],
    portalAccessLogs: [],
    template: "detailed",
    verificationId: "OPE-2026-2T-003",
    versionHistory: versionHistory(false),
    clearances: clearances("blocked"),
  },
  {
    student: students[3],
    status: "locked",
    scores: scoreSet({ math: [17, 18, 52], eng: [16, 16, 49], bio: [18, 18, 49], chem: [17, 18, 50], phy: [18, 18, 51], econ: [15, 16, 46], crs: [17, 18, 48], civ: [18, 18, 47] }, "locked"),
    approvals: approvals("published"),
    auditLog: auditTrail(students[3].fullName, true),
    coupon: coupons[3],
    portalAccessLogs: portalLogs(students[3].regNumber),
    template: "modern",
    verificationId: "OPE-2026-2T-004",
    versionHistory: versionHistory(true),
    clearances: clearances("cleared"),
    publishedAt: "2026-04-10T15:40:00.000Z",
    lockedAt: "2026-04-10T15:42:00.000Z",
  },
  {
    student: students[4],
    status: "locked",
    scores: scoreSet({ math: [15, 15, 44], eng: [14, 15, 43], bio: [15, 15, 44], chem: [14, 15, 42], phy: [15, 15, 43], econ: [15, 15, 42], crs: [17, 17, 44], civ: [16, 16, 44] }, "locked"),
    approvals: approvals("published"),
    auditLog: auditTrail(students[4].fullName, true),
    coupon: coupons[4],
    portalAccessLogs: portalLogs(students[4].regNumber),
    template: "classic",
    verificationId: "OPE-2026-2T-005",
    versionHistory: versionHistory(true),
    clearances: clearances("cleared"),
    publishedAt: "2026-04-10T15:40:00.000Z",
    lockedAt: "2026-04-10T15:42:00.000Z",
  },
];

export const studentSummaries = rankStudentSummaries(resultBundles, subjects, gradeScale, currentAcademicConfig);
export const topStudents = studentSummaries.filter((item) => item.position > 0).slice(0, 3);
export const pendingAuditStudents = studentSummaries.filter((summary) => summary.bundle.status === "corrections_requested");
export const publishedCount = resultBundles.filter((bundle) => bundle.publishedAt).length;

export const overviewStats = [
  { label: "Students in SS2 Gold", value: `${studentSummaries.length}`, helper: "Active result sheets in the current class workflow" },
  { label: "Locked Results", value: `${resultBundles.filter((bundle) => bundle.status === "locked").length}`, helper: "Published sheets protected by controlled unlock" },
  { label: "Review Issues", value: `${pendingAuditStudents.length}`, helper: "Sheets with rejected checks or missing data" },
  { label: "Unused Coupons", value: `${coupons.filter((coupon) => coupon.usedViews === 0 && coupon.active).length}`, helper: "Ready for secure student and parent access" },
];

export const principalHighlights = [
  { label: "Result publication progress", value: "82%", helper: "SS2 Gold ready for school-admin release" },
  { label: "Teachers yet to submit", value: "2", helper: "Physics and Economics still open" },
  { label: "Unlock requests", value: "1", helper: "Controlled post-publish correction queue" },
  { label: "Suspicious portal activity", value: "1", helper: "Coupon revoked after repeated failed attempts" },
];

export const recentAuditFeed = resultBundles
  .flatMap((bundle) => bundle.auditLog)
  .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
  .slice(0, 8);

export const couponInventory = coupons;
export const teacherAssignment = subjects[0];

export const reviewCases: ReviewCase[] = [
  {
    id: makeId("review"),
    regNumber: "OPE/SS2/003",
    studentName: "Yusuf Zainab",
    teacher: "Mr. Ugwu",
    subject: "Chemistry",
    status: "corrections_requested",
    anomaly: "Exam total mismatch against uploaded script summary.",
    submittedValue: "Exam 42 / Total 69",
    correctedValue: "Exam 38 / Total 65",
    note: "Returned to teacher with mandatory correction note.",
  },
  {
    id: makeId("review"),
    regNumber: "OPE/SS2/003",
    studentName: "Yusuf Zainab",
    teacher: "Mr. Alabi",
    subject: "Physics",
    status: "under_review",
    anomaly: "Missing exam component. Student cannot rank until completed.",
    submittedValue: "Exam missing",
    correctedValue: "Awaiting teacher entry",
    note: "Incomplete-result logic excludes this sheet from position ranking.",
  },
];

export const commentTemplates: CommentTemplate[] = [
  { id: "comment_1", tone: "Warm", category: "cognitive", text: "Shows strong understanding and handles new concepts confidently." },
  { id: "comment_2", tone: "Balanced", category: "behavioural", text: "Participates well and responds positively to classroom guidance." },
  { id: "comment_3", tone: "Firm", category: "improvement", text: "Needs more regular revision and better completion of independent tasks." },
  { id: "comment_4", tone: "Warm", category: "improvement", text: "Can improve further by sustaining punctuality and daily practice." },
];

export const promotionQueue: PromotionCandidate[] = [
  { regNumber: "OPE/SS2/001", studentName: "Adewale Maria", currentClass: "SS2 Gold", nextClass: "SS3 Gold", status: "ready", reason: "Academic and clearance conditions satisfied." },
  { regNumber: "OPE/SS2/002", studentName: "Okonkwo Daniel", currentClass: "SS2 Gold", nextClass: "SS3 Gold", status: "ready", reason: "Eligible for promotion at session rollover." },
  { regNumber: "OPE/SS2/003", studentName: "Yusuf Zainab", currentClass: "SS2 Gold", nextClass: "SS3 Gold", status: "hold", reason: "Incomplete result sheet and bursary block." },
  { regNumber: "OPE/SS2/004", studentName: "Nwosu Chidera", currentClass: "SS2 Gold", nextClass: "SS3 Gold", status: "ready", reason: "All approvals and required subjects completed." },
  { regNumber: "OPE/SS2/005", studentName: "Bello Idris", currentClass: "SS2 Gold", nextClass: "SS3 Gold", status: "ready", reason: "Promotion-ready with monitored attendance support." },
];

export const notifications: NotificationItem[] = [
  { id: makeId("note"), audience: "Teachers", title: "Chemistry sheet returned", message: "HOD rejected one Chemistry entry pack and requested corrected values with script evidence.", timestamp: "2026-04-09T08:15:00.000Z" },
  { id: makeId("note"), audience: "Principal", title: "Unlock request pending", message: "One locked result sheet is waiting for controlled unlock approval.", timestamp: "2026-04-11T09:35:00.000Z" },
  { id: makeId("note"), audience: "Parents", title: "Results published for SS2 Gold", message: "Use registration number and coupon code to view the official term report.", timestamp: "2026-04-10T16:05:00.000Z" },
];

export const schoolPortfolio: SchoolPortfolioItem[] = [
  {
    id: "sch_1",
    schoolCode: school.schoolCode,
    name: school.name,
    status: "active",
    plan: "Growth",
    students: 1280,
    storageUsedGb: 8.6,
    storageQuotaGb: 20,
    renewalDate: "2026-08-31",
    portalSlug: school.portalSlug,
    lastFollowUpAt: "2026-05-11T09:30:00.000Z",
    notes: "Current flagship tenant. Result publishing and staff account governance are active.",
  },
  {
    id: "sch_2",
    schoolCode: "BHC-SEC-002",
    name: "Beacon Heights College",
    status: "trial",
    plan: "Trial",
    students: 420,
    storageUsedGb: 1.9,
    storageQuotaGb: 5,
    renewalDate: "2026-05-25",
    portalSlug: "beacon-heights",
    lastFollowUpAt: "2026-05-12T12:10:00.000Z",
    notes: "Trial school awaiting decision on paid onboarding after demo review.",
  },
  {
    id: "sch_3",
    schoolCode: "NPA-SEC-003",
    name: "New Promise Academy",
    status: "expired",
    plan: "Starter",
    students: 690,
    storageUsedGb: 3.2,
    storageQuotaGb: 10,
    renewalDate: "2026-03-28",
    portalSlug: "new-promise",
    lastFollowUpAt: "2026-04-28T16:00:00.000Z",
    notes: "Subscription expired. Waiting for renewal confirmation before full reopen.",
  },
  {
    id: "sch_4",
    schoolCode: "MCC-SEC-004",
    name: "Maranatha College",
    status: "suspended",
    plan: "Growth",
    students: 970,
    storageUsedGb: 5.8,
    storageQuotaGb: 20,
    renewalDate: "2026-02-11",
    portalSlug: "maranatha-college",
    lastFollowUpAt: "2026-05-10T08:45:00.000Z",
    notes: "Suspended pending billing reconciliation and data access review.",
  },
];

export const portfolioSchoolAdminSeeds = [
  {
    schoolCode: school.schoolCode,
    schoolName: school.name,
    fullName: school.schoolAdminName ?? "School Admin",
    email: school.schoolAdminEmail ?? "admin@ope.edu.ng",
    password: "Admin@123",
  },
  {
    schoolCode: "BHC-SEC-002",
    schoolName: "Beacon Heights College",
    fullName: "Mr. Seun Afolabi",
    email: "admin@beaconheights.edu.ng",
    password: "Admin@123",
  },
  {
    schoolCode: "NPA-SEC-003",
    schoolName: "New Promise Academy",
    fullName: "Mrs. Ruth Danjuma",
    email: "admin@newpromise.edu.ng",
    password: "Admin@123",
  },
  {
    schoolCode: "MCC-SEC-004",
    schoolName: "Maranatha College",
    fullName: "Mr. Peter Okoro",
    email: "admin@maranatha.edu.ng",
    password: "Admin@123",
  },
] as const;

export const templatePresets: TemplatePreset[] = [
  {
    id: "template_modern",
    name: "Modern",
    summary: "Compact summary cards with a bold verification block.",
    primaryColor: "#1d4ed8",
    watermarkStyle: "Diagonal seal",
    sections: { attendance: true, affective: true, psychomotor: true, trend: true, feeStatus: true, verification: true },
  },
  {
    id: "template_classic",
    name: "Classic",
    summary: "Traditional report-card rhythm for schools that prefer familiar layouts.",
    primaryColor: "#1e40af",
    watermarkStyle: "Footer stamp",
    sections: { attendance: true, affective: false, psychomotor: true, trend: false, feeStatus: true, verification: true },
  },
  {
    id: "template_detailed",
    name: "Detailed",
    summary: "Expanded comments, workflow trail, and school governance details.",
    primaryColor: "#2563eb",
    watermarkStyle: "Side ribbon",
    sections: { attendance: true, affective: true, psychomotor: true, trend: true, feeStatus: true, verification: true },
  },
];

export const roleGovernancePolicy: RoleGovernancePolicy = {
  principalCanRegisterTeachers: true,
  hodCanRegisterTeachersIfPermitted: true,
  hodTeacherRegistrationEnabled: true,
  principalCanDisableTeachers: true,
  superAdminCanDisablePrincipal: true,
  registrarCanRegisterStudents: true,
  studentsUseDedicatedPortalLogin: true,
};

const baseStaffAccounts: StaffAccount[] = [
  {
    id: "acct_principal_001",
    schoolCode: school.schoolCode,
    fullName: school.schoolAdminName ?? "School Admin",
    email: school.schoolAdminEmail ?? "admin@ope.edu.ng",
    role: "school_admin",
    status: "active",
    registeredBy: "Super Admin",
    canRegisterTeachers: true,
    canDisableTeachers: true,
    canRegisterStudents: true,
    grantedSchoolCodes: [],
    assignedArms: ["SS2 Gold", "SS2 Silver"],
    assignedSubjects: [],
    classTeacherArms: [],
    lastAction: "Updated staff permissions and publication controls for SS2 Gold.",
  },
  {
    id: "acct_hod_001",
    schoolCode: school.schoolCode,
    fullName: "Dr. Tunde Balogun",
    email: "tbalogun@ope.edu.ng",
    role: "hod",
    status: "active",
    registeredBy: school.schoolAdminName ?? "School Admin",
    canRegisterTeachers: true,
    grantedSchoolCodes: [],
    assignedArms: ["SS2 Gold"],
    assignedSubjects: [],
    classTeacherArms: [],
    lastAction: "Returned one Chemistry sheet for correction.",
  },
  {
    id: "acct_registrar_001",
    schoolCode: school.schoolCode,
    fullName: "Mrs. Folasade Adekunle",
    email: "registrar@ope.edu.ng",
    role: "registrar",
    status: "active",
    registeredBy: school.schoolAdminName ?? "School Admin",
    canRegisterTeachers: true,
    canRegisterStudents: true,
    grantedSchoolCodes: [],
    assignedArms: ["SS2 Gold", "SS2 Silver"],
    assignedSubjects: [],
    classTeacherArms: [],
    lastAction: "Generated 5 student portal credentials for the term.",
  },
  {
    id: "acct_teacher_001",
    schoolCode: school.schoolCode,
    fullName: "Mr. Kalejaiye",
    email: "mkalejaiye@ope.edu.ng",
    role: "teacher",
    status: "active",
    registeredBy: school.schoolAdminName ?? "School Admin",
    grantedSchoolCodes: [],
    assignedArms: ["SS2 Gold"],
    assignedSubjects: ["Mathematics"],
    classTeacherArms: [],
    lastAction: "Updated Mathematics exam totals for SS2 Gold.",
  },
  {
    id: "acct_teacher_002",
    schoolCode: school.schoolCode,
    fullName: "Mrs. Folake Aina",
    email: "faina@ope.edu.ng",
    role: "teacher",
    status: "active",
    registeredBy: "Dr. Tunde Balogun",
    grantedSchoolCodes: [],
    assignedArms: ["SS2 Gold"],
    assignedSubjects: [],
    classTeacherArms: ["SS2 Gold"],
    lastAction: "Confirmed attendance and class teacher remarks for SS2 Gold.",
  },
  {
    id: "acct_teacher_003",
    schoolCode: school.schoolCode,
    fullName: "Mr. Joseph Olatunji",
    email: "jolaatunji@ope.edu.ng",
    role: "teacher",
    status: "disabled",
    registeredBy: school.schoolAdminName ?? "School Admin",
    grantedSchoolCodes: [],
    assignedArms: ["SS2 Silver"],
    assignedSubjects: [],
    classTeacherArms: ["SS2 Silver"],
    lastAction: "Account disabled pending reassignment by the school admin.",
  },
];

const STAFF_TITLE_PARTS = new Set(["mr", "mrs", "miss", "ms", "dr", "alhaji", "mallam", "prof"]);
const ASSIGNMENT_SEED_TIMESTAMP = "2026-04-05T08:30:00.000Z";
const classOfferingByName = new Map(classOfferings.map((offering) => [offering.className, offering]));

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeStaffNameParts(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((part) => part && !STAFF_TITLE_PARTS.has(part));
}

function buildStaffEmail(name: string) {
  const parts = normalizeStaffNameParts(name);
  const surname = parts.at(-1) ?? "teacher";
  const initials = parts.slice(0, -1).map((part) => part[0]).join("");
  return `${initials}${surname}@ope.edu.ng`;
}

const generatedSubjectTeacherAccounts: StaffAccount[] = Array.from(
  new Set(
    subjects
      .map((subject) => subject.teacherName)
      .filter((teacherName) => !baseStaffAccounts.some((account) => account.fullName === teacherName)),
  ),
).map((teacherName, index) => {
  const handledSubjects = subjects.filter((subject) => subject.teacherName === teacherName);

  return {
    id: `acct_teacher_${(index + 10).toString().padStart(3, "0")}`,
    schoolCode: school.schoolCode,
    fullName: teacherName,
    email: buildStaffEmail(teacherName),
    role: "teacher",
    status: "active",
    registeredBy: school.schoolAdminName ?? "School Admin",
    grantedSchoolCodes: [],
    assignedArms: uniqueStrings(handledSubjects.map((subject) => subject.className)),
    assignedSubjects: uniqueStrings(handledSubjects.map((subject) => subject.name)),
    classTeacherArms: [],
    lastAction: `Assigned to ${handledSubjects
      .map((subject) => `${subject.name} (${subject.className})`)
      .join(", ")}.`,
  };
});

export const staffAccounts: StaffAccount[] = [...baseStaffAccounts, ...generatedSubjectTeacherAccounts];

export const studentPortalCredentials: StudentPortalCredential[] = students.map((student, index) => ({
  id: `portal_cred_${index + 1}`,
  studentName: student.fullName,
  regNumber: student.regNumber,
  schoolCode: school.schoolCode,
  username: `${school.shortName.toLowerCase().replace(/\s+/g, "")}.${student.regNumber.split("/").pop()?.toLowerCase()}`,
  temporaryPassword: `Ope@${(index + 1).toString().padStart(3, "0")}`,
  generatedBy: "Mrs. Folasade Adekunle",
  generatedAt: "2026-04-09T09:15:00.000Z",
  status: index === 2 ? "reset_required" : index === 0 ? "sent" : "ready",
  accountState: "active",
  couponCode: coupons[index]?.code ?? "",
}));

export interface StaffLoginCredential {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  scope: string;
}

const legacyStaffLoginCredentials: StaffLoginCredential[] = [
  { name: "Prosper Ogidiaka", email: "prosperogidiaka@gmail.com", password: "7767737Prosper", role: "super_admin", scope: "Full platform oversight across all schools" },
  { name: school.schoolAdminName ?? "School Admin", email: school.schoolAdminEmail ?? "admin@ope.edu.ng", password: "Admin@123", role: "school_admin", scope: "School-admin control center, academic setup, score review, broadsheet, audit desk, report editor, and templates" },
  { name: "Dr. Tunde Balogun", email: "hod@ope.edu.ng", password: "Hod@123", role: "hod", scope: "Teacher desk, score review, broadsheet, and audit desk" },
  { name: "Mrs. Folake Aina", email: "faina@ope.edu.ng", password: "Teacher@123", role: "teacher", scope: "Teacher desk, class attendance, class comments, and broadsheet for the assigned arm" },
  { name: "Mr. Kalejaiye", email: "teacher@ope.edu.ng", password: "Teacher@123", role: "teacher", scope: "Score entry for assigned subjects only" },
  { name: "Mrs. Folasade Adekunle", email: "registrar@ope.edu.ng", password: "Registrar@123", role: "registrar", scope: "Dashboard and account / student-credential management" },
  { name: "Bursary Office", email: "bursar@ope.edu.ng", password: "Bursar@123", role: "bursar", scope: "Dashboard and score review (fee clearance)" },
  { name: "Management Audit", email: "manager@ope.edu.ng", password: "Manager@123", role: "manager", scope: "Dashboard, score review, broadsheet, and audit desk" },
];
void legacyStaffLoginCredentials;

function passwordForRole(role: UserRole) {
  const defaults: Record<UserRole, string> = {
    super_admin: "7767737Prosper",
    school_admin: "Admin@123",
    principal: "Principal@123",
    registrar: "Registrar@123",
    teacher: "Teacher@123",
    manager: "Manager@123",
    hod: "Hod@123",
    class_teacher: "Teacher@123",
    bursar: "Bursar@123",
    parent: "Parent@123",
  };

  return defaults[role];
}

function loginScopeForAccount(account: StaffAccount) {
  if (account.role === "school_admin" || account.role === "principal") {
    return `School-level administration for ${account.schoolCode} only, including academic setup, teacher assignments, result locks, score review, report editor, audit desk, and templates`;
  }

  if (account.role === "teacher" && account.classTeacherArms.length === 0) {
    const scopedAssignments = account.assignedSubjects.map(
      (subject, index) => `${subject} / ${account.assignedArms[index] ?? account.assignedArms[0] ?? "assigned class"}`,
    );

    return scopedAssignments.length > 0
      ? `Score entry for ${scopedAssignments.join(", ")} only`
      : "Subject-teacher score entry for assigned subject-class arms only";
  }

  if (account.classTeacherArms.length > 0) {
    return `Teacher desk, subject score entry, class attendance, class comments, and broadsheet access for ${account.classTeacherArms.join(", ") || "assigned class arms"}`;
  }

  if (account.role === "hod") {
    return "Teacher desk, score review, broadsheet, and audit desk";
  }

  if (account.role === "registrar") {
    return "Dashboard and account / student-credential management";
  }

  return "Role-specific dashboards and controls";
}

export const staffLoginCredentials: StaffLoginCredential[] = [
  {
    name: "Prosper Ogidiaka",
    email: "prosperogidiaka@gmail.com",
    password: "7767737Prosper",
    role: "super_admin",
    scope: "Platform-wide monitoring, school follow-up, subscription control, and super admin operations",
  },
  ...staffAccounts
    .filter((account) => account.status === "active")
    .map((account) => ({
      name: account.fullName,
      email: account.email,
      password: passwordForRole(account.role),
      role: account.role,
      scope: loginScopeForAccount(account),
    })),
];

const staffAccountByName = new Map(staffAccounts.map((account) => [account.fullName, account]));

export const subjectTeacherAssignments: SubjectTeacherAssignment[] = subjects.map((subject) => {
  const classOffering = classOfferingByName.get(subject.className);
  const assignedTeacher = staffAccountByName.get(subject.teacherName);

  return {
    id: subject.id,
    schoolCode: school.schoolCode,
    subjectId: subject.id,
    subjectCode: subject.code,
    subjectName: subject.name,
    className: subject.className,
    arm: classOffering?.arm ?? (subject.className.split(" ").slice(1).join(" ") || subject.className),
    section: subject.section,
    track: subject.track,
    subjectType: subject.isElective ? "elective" : "core",
    active: true,
    teacherAccountId: assignedTeacher?.id,
    teacherName: assignedTeacher?.fullName ?? subject.teacherName,
    assignedBy: school.schoolAdminName ?? "School Admin",
    assignedAt: ASSIGNMENT_SEED_TIMESTAMP,
    updatedAt: ASSIGNMENT_SEED_TIMESTAMP,
  };
});

export const seedResultLocks: ResultLockRecord[] = classOfferings.map((offering) => {
  const lockedBundle = resultBundles.find(
    (bundle) => bundle.student.className === offering.className && bundle.status === "locked",
  );

  return {
    id: `${offering.className}-${school.session}-${school.term}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase(),
    className: offering.className,
    session: school.session,
    term: school.term,
    locked: Boolean(lockedBundle),
    note: lockedBundle
      ? `Locked after school-admin release for ${offering.className}.`
      : `Open for assigned subject teachers in ${offering.className}.`,
    lockedAt: lockedBundle?.lockedAt ?? lockedBundle?.publishedAt,
    lockedBy: lockedBundle ? school.principalName : undefined,
  };
});

export const starterTemplateSchemas: ResultTemplateSchema[] = [
  {
    id: "exec_template",
    name: "The Executive",
    summary: "Prestige-style result with strong header hierarchy, signatures, and verified branding.",
    primaryColor: "#1d4ed8",
    fontFamily: "Playfair Display",
    borderStyle: "executive",
    terminology: {
      termLabel: "Term",
      teacherRemarkLabel: "Teacher's Remark",
      classTeacherRemarkLabel: "Class Teacher's Remark",
      principalRemarkLabel: "Principal's Remark",
    },
    zones: ["header", "student_bio", "academic_table", "qualitative", "remarks", "signatures"],
    header: {
      logoPosition: "left",
      showSchoolName: true,
      showAddress: true,
      showSchoolCode: true,
      showGovernmentStamp: true,
      logoUrl: school.logoUrl,
      governmentStampUrl: school.governmentStampUrl,
    },
    studentBio: {
      showPassport: true,
      showDob: true,
      showAge: true,
      showGender: true,
      showRegNumber: true,
      showHouse: true,
      showHostel: false,
    },
    academicTable: {
      columns: ["test1", "test2", "exam", "total", "grade", "subjectPosition", "classAverage"],
    },
    qualitative: {
      showAffective: true,
      showPsychomotor: true,
    },
    signatures: {
      showClassTeacherSignature: true,
      showPrincipalSignature: true,
      classTeacherSignatureUrl: "/assets/class-teacher-signature.svg",
      principalSignatureUrl: "/assets/principal-signature.svg",
    },
    watermark: {
      enabled: true,
      imageUrl: school.watermarkLogoUrl,
      opacity: 0.08,
    },
    controls: {
      showGradingLegend: false,
      showTrendAnalysis: true,
      showVerificationQr: true,
      previewWithSampleData: true,
    },
  },
  {
    id: "traditional_template",
    name: "The Traditional",
    summary: "Heavy borders, full academic columns, and government-stamp first presentation.",
    primaryColor: "#1e40af",
    fontFamily: "Georgia",
    borderStyle: "traditional",
    terminology: {
      termLabel: "Term",
      teacherRemarkLabel: "Teacher's Remark",
      classTeacherRemarkLabel: "Form Teacher's Remark",
      principalRemarkLabel: "Principal's Remark",
    },
    zones: ["header", "student_bio", "academic_table", "qualitative", "remarks", "signatures", "verification"],
    header: {
      logoPosition: "center",
      showSchoolName: true,
      showAddress: true,
      showSchoolCode: true,
      showGovernmentStamp: true,
      logoUrl: school.logoUrl,
      governmentStampUrl: school.governmentStampUrl,
    },
    studentBio: {
      showPassport: true,
      showDob: true,
      showAge: true,
      showGender: true,
      showRegNumber: true,
      showHouse: true,
      showHostel: false,
    },
    academicTable: {
      columns: ["test1", "test2", "exam", "total", "grade", "subjectPosition", "classAverage"],
    },
    qualitative: {
      showAffective: true,
      showPsychomotor: true,
    },
    signatures: {
      showClassTeacherSignature: true,
      showPrincipalSignature: true,
      classTeacherSignatureUrl: "/assets/class-teacher-signature.svg",
      principalSignatureUrl: "/assets/principal-signature.svg",
    },
    watermark: {
      enabled: true,
      imageUrl: school.watermarkLogoUrl,
      opacity: 0.06,
    },
    controls: {
      showGradingLegend: true,
      showTrendAnalysis: true,
      showVerificationQr: true,
      previewWithSampleData: true,
    },
  },
  {
    id: "minimalist_template",
    name: "The Minimalist",
    summary: "Clean spacing, fewer borders, and only the most essential publication blocks.",
    primaryColor: "#2563eb",
    fontFamily: "Inter",
    borderStyle: "minimalist",
    terminology: {
      termLabel: "Semester",
      teacherRemarkLabel: "Instructor's Comment",
      classTeacherRemarkLabel: "Guardian Teacher Comment",
      principalRemarkLabel: "Head of School Note",
    },
    zones: ["header", "student_bio", "academic_table", "remarks", "verification"],
    header: {
      logoPosition: "right",
      showSchoolName: true,
      showAddress: false,
      showSchoolCode: true,
      showGovernmentStamp: false,
      logoUrl: school.logoUrl,
      governmentStampUrl: school.governmentStampUrl,
    },
    studentBio: {
      showPassport: false,
      showDob: false,
      showAge: false,
      showGender: false,
      showRegNumber: true,
      showHouse: false,
      showHostel: false,
    },
    academicTable: {
      columns: ["exam", "total", "grade"],
    },
    qualitative: {
      showAffective: false,
      showPsychomotor: false,
    },
    signatures: {
      showClassTeacherSignature: false,
      showPrincipalSignature: true,
      principalSignatureUrl: "/assets/principal-signature.svg",
    },
    watermark: {
      enabled: true,
      imageUrl: school.watermarkLogoUrl,
      opacity: 0.04,
    },
    controls: {
      showGradingLegend: false,
      showTrendAnalysis: false,
      showVerificationQr: true,
      previewWithSampleData: true,
    },
  },
];

export const verificationRecords: VerificationRecord[] = resultBundles.map((bundle) => ({
  verificationId: bundle.verificationId,
  regNumber: bundle.student.regNumber,
  studentName: bundle.student.fullName,
  className: bundle.student.className,
  session: school.session,
  term: school.term,
  status: bundle.status,
  publishedAt: bundle.publishedAt,
}));

export const portalNotice =
  "Students sign in with registrar-generated portal credentials. Their portal now opens the student account dashboard, including biodata, attendance, teacher reports, and any released result tied to that student.";
