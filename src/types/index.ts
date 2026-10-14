// ============ User & Auth ============
export interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

export interface User {
  id: string;
  uid: string;
  email: string;
  name: string;
  displayName?: string;
  picture?: string;
  photoURL?: string;
  emailVerified?: boolean;
  role: "admin" | "proctor" | "examinee" | "user";
  lastLogin?: string | FirestoreTimestamp;
  createdAt: string | FirestoreTimestamp;
  updatedAt: string | FirestoreTimestamp;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// ============ Question Types ============
export interface QuestionType {
  id: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuestionTypePayload {
  name: string;
  description: string;
  config?: Record<string, unknown>;
}

// ============ Phrases (passage/story blocks above questions) ============
/** Phrase block as embedded in session questions (id, title, body, imageUrls, usageType) */
export interface PhraseBlock {
  id: string;
  title?: string | null;
  body: string;
  imageUrls?: string[];
  usageType?: string | null;
}

export interface Phrase {
  id: string;
  title?: string | null;
  body: string;
  examId?: string | null;
  bundleId?: string | null;
  partId?: string | null;
  usageType?: string | null;
  imageUrls?: string[];
  imagePaths?: string[];
  imageSizes?: number[];
  metadata?: Record<string, unknown>;
  status?: "active" | "disabled";
  createdBy?: string;
  createdByEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePhrasePayload {
  body: string;
  title?: string | null;
  examId?: string | null;
  bundleId?: string | null;
  partId?: string | null;
  usageType?: string | null;
  imageUrls?: string[];
  imageSizes?: number[];
  metadata?: Record<string, unknown>;
}

export interface UpdatePhrasePayload {
  title?: string | null;
  body?: string;
  examId?: string | null;
  bundleId?: string | null;
  partId?: string | null;
  usageType?: string | null;
  metadata?: Record<string, unknown>;
  status?: "active" | "disabled";
  imageUrls?: string[];
  imageSizes?: number[];
}

// ============ Exam Questions ============
/** AI-generation details stored in question.metadata.ai; never returned to examinees */
export interface AiQuestionMetadata {
  generated: true;
  difficulty?: "easy" | "medium" | "hard";
  cognitiveLevel?: string;
  topic?: string;
  sourceRef?: string;
  /** Essay grading guide */
  rubric?: string;
}

export interface QuestionMetadata {
  /** Multiple blanks are graded in order (blank 1, blank 2, ...) */
  orderedBlanks?: boolean;
  ai?: AiQuestionMetadata;
  [key: string]: unknown;
}

export interface ExamQuestion {
  id: string;
  questionTypeId: string;
  questionTypeName?: string;
  questionText: string;
  options: string[];
  correctAnswer: string | string[];
  points: number;
  numberOfChoices?: number;
  examId: string;
  partId?: string | null; // New: ID of the exam part this question belongs to
  timeLimit?: number;
  /** Proctor-only: why the answer is correct */
  explanation?: string;
  metadata?: QuestionMetadata;
  /** 'active' (default) = included in question pool; 'disabled' = excluded from new sessions */
  status?: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
}

/** Question in exam session response: same as ExamQuestion with optional embedded phrase */
export interface SessionQuestion extends ExamQuestion {
  phraseId?: string | null;
  phrase?: PhraseBlock | null;
}

export interface CreateExamQuestionPayload {
  questionTypeId: string;
  questionText: string;
  options: string[];
  correctAnswer: string | string[];
  points: number;
  numberOfChoices?: number;
  examId: string;
  partId?: string | null; // New: ID of the exam part this question belongs to
  phraseId?: string | null;
  timeLimit?: number;
  explanation?: string;
  metadata?: QuestionMetadata;
}

export interface UpdateExamQuestionPayload {
  questionText?: string;
  options?: string[];
  correctAnswer?: string | string[];
  points?: number;
  numberOfChoices?: number;
  partId?: string | null; // New: ID of the exam part this question belongs to
  phraseId?: string | null;
  timeLimit?: number;
  explanation?: string;
  metadata?: QuestionMetadata;
  /** When question has been used in a session, only status can be updated. */
  status?: "active" | "disabled";
}

// ============ Exams ============
export interface PassingCondition {
  type: "percentage" | "points" | "items";
  value: number;
}

export interface ExamPart {
  id: string;
  name: string;
  description: string;
  numberOfItems: number | null;
  timeLimit: number | null; // Only when exam timeType is 'per_part'
  passingCondition: {
    type: "percentage" | "points" | "items";
    value: number;
  } | null;
}

/** Part as sent to the API: unset numberOfItems means all questions, timeLimit only with timeType 'per_part'. */
export type ExamPartPayload = Omit<ExamPart, "numberOfItems" | "timeLimit"> & {
  numberOfItems?: number;
  timeLimit?: number | null;
};

/** How an exam's questions were written. Missing on exams created before tagging existed. */
export type ExamOrigin = "manual" | "ai" | "mixed";

export interface Exam {
  id: string;
  title: string;
  origin?: ExamOrigin;
  description?: string;
  instruction?: string | null; // New: Exam instructions displayed to examinees
  parts?: ExamPart[] | null; // New: Array of exam parts for multi-part exams
  questionOrder: "random" | "fixed";
  timeType: "per_exam" | "per_question" | "per_part"; // Updated: Added 'per_part'
  timeLimit: number;
  numberOfItems?: number;
  passingCondition: PassingCondition;
  passingScore?: number;
  isPublic: boolean;
  /** If true, examinee can view their answers and correct answers after submission. */
  reviewableByExaminee?: boolean;
  status: "draft" | "active" | "archived";
  createdBy: string;
  createdByName?: string;
  questionCount?: number;
  questions?: ExamQuestion[];
  bundleId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExamPayload {
  title: string;
  description?: string;
  instruction?: string | null; // New: Exam instructions
  parts?: ExamPartPayload[] | null; // New: Array of exam parts
  questionOrder: "random" | "fixed";
  timeType: "per_exam" | "per_question" | "per_part"; // Updated: Added 'per_part'
  timeLimit: number;
  numberOfItems?: number;
  passingCondition: PassingCondition;
  isPublic: boolean;
  reviewableByExaminee?: boolean;
  origin?: ExamOrigin;
  questions?: CreateExamQuestionPayload[];
}

export interface UpdateExamPayload {
  title?: string;
  description?: string;
  instruction?: string | null; // New: Exam instructions
  parts?: ExamPartPayload[] | null; // New: Array of exam parts
  questionOrder?: "random" | "fixed";
  timeType?: "per_exam" | "per_question" | "per_part"; // Updated: Added 'per_part'
  timeLimit?: number;
  /** null = every question is used */
  numberOfItems?: number | null;
  passingCondition?: PassingCondition;
  isPublic?: boolean;
  reviewableByExaminee?: boolean;
  status?: "draft" | "active" | "archived";
}

// Pending exam with invitation details (legacy /api/exams/pending)
export interface PendingExamInvitation {
  id: string;
  expiresAt: string | FirestoreTimestamp;
  maxAttempts: number;
  attemptsUsed: number;
  createdAt: string | FirestoreTimestamp;
}

export interface PendingExam extends Exam {
  invitations?: PendingExamInvitation[];
}

/** Status of an exam invitation for the current examinee (GET /api/exams/for-examinee) */
export type ExamInvitationStatus = "pending" | "in_progress" | "completed";

/** Invitation info on each exam from for-examinee */
export interface ExamForExamineeInvitation {
  id: string;
  status: ExamInvitationStatus;
  maxAttempts: number;
  attemptsUsed: number;
  expiresAt: string | FirestoreTimestamp;
  /** Optional. Sets when the exam can be started. Exam cannot be started before this time. */
  scheduledStartTime?: string | null;
  /** Optional. Sets when the exam must end. If set, this overrides the exam duration. */
  scheduledEndTime?: string | null;
  invitationStatus?: ExamInvitationStatus;
  createdAt?: string;
}

/** Exam returned by GET /api/exams/for-examinee with invitation status and attempt info */
export interface ExamForExaminee extends Exam {
  invitationStatus: ExamInvitationStatus;
  invitationId: string;
  maxAttempts: number;
  attemptsUsed: number;
  expiresAt?: string | FirestoreTimestamp;
  /** Optional. Sets when the exam can be started. Exam cannot be started before this time. */
  scheduledStartTime?: string | null;
  /** Optional. Sets when the exam must end. If set, this overrides the exam duration. */
  scheduledEndTime?: string | null;
  invitations?: ExamForExamineeInvitation[];
}

// ============ Exam Reconciliations ============
/** Reconciliation overrides correct answer or marks question as bonus for scoring. */
export interface ExamReconciliation {
  id: string;
  examId: string;
  questionId: string;
  type: "new_answer" | "bonus";
  newCorrectAnswer: string | string[] | null;
  noAnswerCountsCorrect: boolean | null;
  reconciledBy: string;
  reconciledByEmail?: string;
  reconciledAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReconcileQuestionPayload {
  questionId: string;
  type: "new_answer" | "bonus";
  newCorrectAnswer?: string | string[];
  noAnswerCountsCorrect?: boolean;
}

// ============ Exam Bundles ============
export interface ExamBundle {
  id: string;
  name: string;
  description: string;
  examIds: string[];
  exams?: Exam[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExamBundlePayload {
  name: string;
  description: string;
  examIds?: string[];
}

// ============ Exam Sessions ============
export interface ExamSession {
  id: string;
  examId: string;
  examineeId: string;
  invitationId?: string;
  status: "in_progress" | "in-progress" | "completed" | "abandoned" | "timed_out" | "timed-out";
  selectedQuestionIds?: string[]; // IDs of questions selected for this session
  examTitle?: string; // Title of the exam
  examineeName?: string; // Name of the examinee
  examineeEmail?: string; // Email of the examinee
  currentQuestionIndex: number;
  answers: Record<string, string | string[] | null>;
  timeRemainingSeconds: number;
  /** Session questions (ordered); may include phraseId and embedded phrase for display */
  questions?: SessionQuestion[];
  /** Map of phrase id -> phrase data (also available on each question.phrase) */
  phrases?: Record<string, PhraseBlock>;
  questionsByPart?: {
    // New: Grouped by part (null if no parts)
    [partId: string]: {
      part: {
        id: string;
        name: string;
        description: string;
        timeLimit?: number | null; // Only when exam timeType is 'per_part'
      };
      /** Missing when the backend returns the stored session shape (questionIds only) */
      questions?: SessionQuestion[];
      questionIds?: string[];
    };
  } | null;
  partTimeLimits?: {
    // New: Per-part time limits (null if exam timeType is not 'per_part')
    [partId: string]: {
      timeType: "per_exam"; // Always 'per_exam' for per-part time limits
      timeLimitMinutes: number;
      timeLimitSeconds: number;
    };
  } | null;
  exam?: Exam;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExamSessionPayload {
  invitationId?: string;
  examId?: string;
}

export interface UpdateExamSessionPayload {
  currentQuestionIndex?: number;
  answers?: Record<string, string | string[] | null>;
}

export interface AnswerQuestionPayload {
  answer: string | string[] | null;
}

// ============ Exam Results ============
export interface QuestionResult {
  questionId: string;
  isCorrect: boolean;
  score: number;
  points: number;
}

export interface ExamResult {
  id: string;
  examId: string;
  examineeId: string;
  examineeName?: string;
  examineeEmail?: string;
  sessionId?: string;
  examTitle?: string;
  score: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  correctAnswers?: number; // Legacy field
  correctCount?: number; // New field from API
  incorrectCount?: number;
  totalQuestions: number;
  /** Per-question results; used for proctor review and override */
  questionResults?: QuestionResult[];
  partResults?: {
    // New: Per-part results
    [partId: string]: {
      partId: string;
      partName: string;
      score: number;
      totalPoints: number;
      percentage: number;
      passed: boolean;
      correctCount: number;
      incorrectCount: number;
      unansweredCount: number;
      totalQuestions: number;
      passingCondition: {
        type: "percentage" | "points" | "items";
        value: number;
      } | null;
    };
  } | null;
  answers?: Record<string, unknown>;
  feedback?: string;
  /** When true, examinee can view questions and answers for this result (from exam setting). */
  reviewableByExaminee?: boolean;
  /** Passing threshold (e.g. percentage value). Used when recalculating after proctor review. */
  passingScore?: number;
  passingCondition?: PassingCondition;
  /** Time allocated to finish the exam (minutes). May come from exam/session. */
  timeLimitMinutes?: number;
  /** Minutes the examinee spent on the exam. */
  timeSpentMinutes?: number;
  startedAt?: string; // When the exam session was started
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ============ Exam Invitations ============
export interface ExamInvitation {
  id: string;
  examId: string;
  examTitle?: string;
  bundleId?: string;
  bundleName?: string;
  examineeId?: string;
  examineeEmail: string;
  examineeName?: string;
  groupId?: string;
  groupName?: string;
  status: "pending" | "accepted" | "used" | "expired" | "revoked";
  maxAttempts: number;
  currentAttempts?: number;
  /** API may return attemptsUsed instead of currentAttempts */
  attemptsUsed?: number;
  expiresAt: string;
  /** Optional. Sets when the exam can be started. Exam cannot be started before this time. */
  scheduledStartTime?: string;
  /** Optional. Sets when the exam must end. If set, this overrides the exam duration. */
  scheduledEndTime?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExamInvitationPayload {
  examId: string;
  examineeEmail: string;
  expiresAt: string;
  maxAttempts: number;
  /** Optional. Sets when the exam can be started. Exam cannot be started before this time. */
  scheduledStartTime?: string;
  /** Optional. Sets when the exam must end. If set, this overrides the exam duration. */
  scheduledEndTime?: string;
}

export interface CreateGroupInvitationPayload {
  examId: string;
  groupId: string;
  expiresAt: string;
  maxAttempts: number;
  /** Optional. Sets when the exam can be started. Exam cannot be started before this time. */
  scheduledStartTime?: string;
  /** Optional. Sets when the exam must end. If set, this overrides the exam duration. */
  scheduledEndTime?: string;
}

export interface CreateBundleInvitationPayload {
  bundleId: string;
  examineeEmail: string;
  expiresAt: string;
  maxAttempts: number;
  /** Optional. Sets when the exam can be started. Exam cannot be started before this time. */
  scheduledStartTime?: string;
  /** Optional. Sets when the exam must end. If set, this overrides the exam duration. */
  scheduledEndTime?: string;
}

export interface CreateBundleGroupInvitationPayload {
  bundleId: string;
  groupId: string;
  expiresAt: string;
  maxAttempts: number;
  /** Optional. Sets when the exam can be started. Exam cannot be started before this time. */
  scheduledStartTime?: string;
  /** Optional. Sets when the exam must end. If set, this overrides the exam duration. */
  scheduledEndTime?: string;
}

// ============ Examinee Groups ============
export interface ExamineeGroup {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  members?: User[];
  memberCount?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExamineeGroupPayload {
  name: string;
  description: string;
  memberIds?: string[];
}

export interface AddGroupMembersPayload {
  memberIds?: string[];
  memberEmails?: string[];
}

// ============ Proctor Requests ============
export interface ProctorRequest {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  reason: string;
  additionalInfo?: string;
  status: "pending" | "approved" | "rejected";
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProctorRequestPayload {
  reason: string;
  additionalInfo?: string;
}

// ============ API Response ============
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ============ Pagination ============
export type AiTier = "primary" | "fallback";

export interface AiUsageStatus {
  tier: AiTier;
  reason: "monthly_budget" | "daily_user_limit" | null;
  month: {
    period: string;
    primaryCostUsd: number;
    fallbackCostUsd: number;
    totalCostUsd: number;
    primaryRequests: number;
    fallbackRequests: number;
    primaryBudgetUsd: number;
    monthlyCapUsd: number;
  };
  user: {
    day: string;
    primaryRequestsToday: number;
    fallbackRequestsToday: number;
    primaryDailyLimit: number;
  };
}

export interface RecordAiUsagePayload {
  tier: AiTier;
  inputTokens: number;
  outputTokens: number;
}

export type ExamResultScope = "mine" | "managed";
export type ExamResultSortBy = "date" | "score" | "examTitle" | "examineeName";
export type SortOrder = "asc" | "desc";

export interface ExamResultListParams {
  /** "mine" = caller's own results; "managed" = all (admin) or results for the proctor's exams */
  scope?: ExamResultScope;
  examId?: string;
  examineeId?: string;
  search?: string;
  status?: "passed" | "failed";
  /** ISO date-time, inclusive */
  from?: string;
  /** ISO date-time, inclusive */
  to?: string;
  sortBy?: ExamResultSortBy;
  sortOrder?: SortOrder;
  page?: number;
  size?: number;
}

export interface ExamResultSummary {
  total: number;
  passed: number;
  failed: number;
  averagePercentage: number;
}

export interface PaginationMeta {
  page: number;
  size: number;
  total: number;
  totalPages: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  data: T[];
  pagination: PaginationMeta;
}
