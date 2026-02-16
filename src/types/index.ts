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

// ============ Exam Questions ============
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
  createdAt: string;
  updatedAt: string;
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
  timeLimit?: number;
}

export interface UpdateExamQuestionPayload {
  questionText?: string;
  options?: string[];
  correctAnswer?: string | string[];
  points?: number;
  numberOfChoices?: number;
  partId?: string | null; // New: ID of the exam part this question belongs to
  timeLimit?: number;
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

export interface Exam {
  id: string;
  title: string;
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
  parts?: ExamPart[] | null; // New: Array of exam parts
  questionOrder: "random" | "fixed";
  timeType: "per_exam" | "per_question" | "per_part"; // Updated: Added 'per_part'
  timeLimit: number;
  numberOfItems?: number;
  passingCondition: PassingCondition;
  isPublic: boolean;
  reviewableByExaminee?: boolean;
  questions?: CreateExamQuestionPayload[];
}

export interface UpdateExamPayload {
  title?: string;
  description?: string;
  instruction?: string | null; // New: Exam instructions
  parts?: ExamPart[] | null; // New: Array of exam parts
  questionOrder?: "random" | "fixed";
  timeType?: "per_exam" | "per_question" | "per_part"; // Updated: Added 'per_part'
  timeLimit?: number;
  numberOfItems?: number;
  passingCondition?: PassingCondition;
  isPublic?: boolean;
  reviewableByExaminee?: boolean;
  status?: "draft" | "active" | "archived";
}

// Pending exam with invitation details
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
  questions?: ExamQuestion[];
  questionsByPart?: {
    // New: Grouped by part (null if no parts)
    [partId: string]: {
      part: {
        id: string;
        name: string;
        description: string;
        timeLimit?: number | null; // Only when exam timeType is 'per_part'
      };
      questions: ExamQuestion[];
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
  timeRemainingSeconds?: number;
}

export interface AnswerQuestionPayload {
  answer: string | string[] | null;
  timeRemainingSeconds?: number;
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
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExamInvitationPayload {
  examId: string;
  examineeEmail: string;
  expiresAt: string;
  maxAttempts: number;
}

export interface CreateGroupInvitationPayload {
  examId: string;
  groupId: string;
  expiresAt: string;
  maxAttempts: number;
}

export interface CreateBundleInvitationPayload {
  bundleId: string;
  examineeEmail: string;
  expiresAt: string;
  maxAttempts: number;
}

export interface CreateBundleGroupInvitationPayload {
  bundleId: string;
  groupId: string;
  expiresAt: string;
  maxAttempts: number;
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
