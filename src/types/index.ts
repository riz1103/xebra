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
  timeLimit?: number | null; // Only when exam timeType is 'per_part'
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
  status?: "draft" | "active" | "archived";
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
  status: "in_progress" | "completed" | "abandoned" | "timed_out";
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
export interface ExamResult {
  id: string;
  examId: string;
  examineeId: string;
  examineeName?: string;
  sessionId?: string;
  examTitle?: string;
  score: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  correctAnswers: number;
  totalQuestions: number;
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
  currentAttempts: number;
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
