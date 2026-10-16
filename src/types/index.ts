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
  notificationPrefs?: NotificationPrefs;
}

export interface NotificationPrefs {
  /** Email when a result is final (after any essay grading) */
  resultEmails: boolean;
  /** Email before a scheduled exam opens or an unused invitation expires */
  reminderEmails: boolean;
  /** Proctors: daily digest of new results and essays to grade */
  dailySummary: boolean;
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
  /** Coded layout this type enables; legacy rows may omit it */
  layout?: string | null;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuestionTypePayload {
  /** Required: which coded layout to enable */
  layout: string;
  name?: string;
  description?: string;
  config?: Record<string, unknown>;
}

/** Layout is immutable after create */
export interface UpdateQuestionTypePayload {
  name?: string;
  description?: string;
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
  /** Text of the cited material page as the AI read it */
  sourceExcerpt?: string;
  /** Uploaded original material file; PDF links include a #page= fragment */
  sourceUrl?: string;
  /** Essay grading guide */
  rubric?: string;
}

export interface QuestionMetadata {
  /** Multiple blanks are graded in order (blank 1, blank 2, ...) */
  orderedBlanks?: boolean;
  /** Essay grading guide for manually written questions (AI questions use ai.rubric); never returned to examinees */
  rubric?: string;
  /** Ordering: correctAnswer is the items in order. Matching: correctAnswer[i] answers matchPrompts[i]. Hotspot: correctAnswer is region id(s). */
  answerFormat?: "ordering" | "matching" | "hotspot";
  /** Left-hand prompts of a matching question (visible to examinees) */
  matchPrompts?: string[];
  /** Listening clip URL (audio question types) */
  audioUrl?: string;
  audioStoragePath?: string;
  /** How many times an examinee may play the clip; omit or 0 = unlimited */
  maxPlays?: number;
  /** Clickable image for hotspot questions */
  hotspotImageUrl?: string;
  hotspotImageStoragePath?: string;
  /** Target circles on the hotspot image; x/y/radius are % of image width (0–100) */
  hotspotRegions?: HotspotRegion[];
  /** Topic used by study reports when there is no AI topic (e.g. from the question bank) */
  topic?: string;
  ai?: AiQuestionMetadata;
  [key: string]: unknown;
}

export interface HotspotRegion {
  id: string;
  /** Center X as % of image width */
  x: number;
  /** Center Y as % of image height */
  y: number;
  /** Hit radius as % of image width */
  radius: number;
  label?: string;
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
  /** Why the answer is correct; shown to proctors, and to examinees when the exam is reviewable */
  explanation?: string;
  metadata?: QuestionMetadata;
  /** 'active' (default) = included in question pool; 'disabled' = excluded from new sessions */
  status?: "active" | "disabled";
  /** Sent to examinees instead of correctAnswer when more than one choice is correct */
  multipleAnswers?: boolean;
  /** Set when the question was drawn from the question bank */
  bankQuestionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============ Question Bank ============
export type QuestionDifficulty = "easy" | "medium" | "hard";

export interface BankQuestion {
  id: string;
  questionTypeId: string;
  questionText: string;
  options: string[];
  correctAnswer: string | string[];
  points: number;
  explanation?: string;
  metadata?: QuestionMetadata;
  topic: string | null;
  difficulty: QuestionDifficulty | null;
  cognitiveLevel: string | null;
  tags: string[];
  ownerId: string;
  ownerEmail?: string | null;
  usageCount: number;
  lastUsedAt?: string;
  sourceExamId: string | null;
  sourceQuestionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BankQuestionPayload {
  questionTypeId: string;
  questionText: string;
  options?: string[];
  correctAnswer: string | string[];
  points?: number;
  explanation?: string;
  metadata?: QuestionMetadata;
  topic?: string | null;
  difficulty?: QuestionDifficulty | null;
  cognitiveLevel?: string | null;
  tags?: string[];
  organizationId?: string | null;
}

export interface BankFacetValue {
  value: string;
  count: number;
}

export interface BankFacets {
  total: number;
  topics: BankFacetValue[];
  difficulties: BankFacetValue[];
  tags: BankFacetValue[];
  cognitiveLevels: BankFacetValue[];
}

export interface BankListParams {
  search?: string;
  topic?: string;
  difficulty?: QuestionDifficulty;
  tag?: string;
  cognitiveLevel?: string;
  /** Shared bank for an organization the caller belongs to */
  organizationId?: string;
  questionTypeId?: string;
  scope?: "all";
  page?: number;
  size?: number;
}

export interface BankDrawRule {
  count: number;
  topic?: string | null;
  difficulty?: QuestionDifficulty | null;
  cognitiveLevel?: string | null;
  tags?: string[];
  questionTypeId?: string | null;
}

export interface BankAssembleRuleResult extends Required<BankDrawRule> {
  available: number;
  drawn: number;
  shortBy: number;
}

export interface BankAssembleResult {
  dryRun: boolean;
  rules: BankAssembleRuleResult[];
  totalDrawn: number;
  questionIds?: string[];
  bankSize: number;
}

export interface BankImportResult {
  imported: number;
  skippedExisting: number;
  skippedPhraseBound: number;
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

/** "always" = after any submitted attempt; "after_last_attempt" = once the examinee passed or has no retakes left */
export type AnswerRevealTiming = "always" | "after_last_attempt";

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
  /** If true, examinees reviewing their answers can also view each AI question's source material. */
  sourceViewableByExaminee?: boolean;
  /** When reviewing examinees see correct answers, explanations, and sources; defaults to "always". */
  answerRevealTiming?: AnswerRevealTiming;
  /** Each examinee sees answer choices in a different order */
  shuffleOptions?: boolean;
  /** Examinees who pass can get a verifiable certificate (default true) */
  certificatesEnabled?: boolean;
  /** Proctors the creator shared the exam with (co-owners) */
  collaboratorIds?: string[];
  /** Created by the onboarding "Try a sample exam" action */
  isSample?: boolean;
  /** Source exam ID when this exam was created with Duplicate */
  duplicatedFrom?: string;
  status: "draft" | "active" | "archived";
  createdBy: string;
  createdByName?: string;
  createdByEmail?: string | null;
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
  sourceViewableByExaminee?: boolean;
  answerRevealTiming?: AnswerRevealTiming;
  shuffleOptions?: boolean;
  certificatesEnabled?: boolean;
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
  sourceViewableByExaminee?: boolean;
  answerRevealTiming?: AnswerRevealTiming;
  shuffleOptions?: boolean;
  certificatesEnabled?: boolean;
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
  /** Extra time granted by a proctor during the session */
  extraTimeSeconds?: number;
  /** Extra-time accommodation already applied to the time limits (1 when none) */
  timeMultiplier?: number;
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
  /** Answered essay that still needs a proctor grade (scored 0 until graded) */
  pendingReview?: boolean;
  /** Score was set by a proctor; correct when at least half the points were earned */
  manual?: boolean;
  /** Proctor feedback for this question */
  feedback?: string;
}

export interface ManualGrade {
  score: number;
  feedback: string | null;
  aiSuggested: boolean;
  gradedBy: string;
  gradedAt: string | FirestoreTimestamp;
}

/** "pending_review" while answered essays await a proctor grade */
export type GradingStatus = "pending_review" | "complete";

export interface GradeQuestionPayload {
  questionId: string;
  /** null removes the manual grade so the question is auto-graded again */
  score: number | null;
  feedback?: string;
  aiSuggested?: boolean;
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
  /** null for examinees while gradingStatus is "pending_review" */
  passed: boolean | null;
  gradingStatus?: GradingStatus;
  pendingReviewCount?: number;
  manualGrades?: Record<string, ManualGrade>;
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
  /** When true, examinee can view AI questions' source material while reviewing (from exam setting). */
  sourceViewableByExaminee?: boolean;
  /** From the exam setting; passed results can get a certificate */
  certificatesEnabled?: boolean;
  /** Set once a certificate was issued */
  certificateCode?: string;
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
  accommodations?: InvitationAccommodations | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvitationAccommodations {
  /** 1–3; every time limit of sessions started from this invitation is multiplied by it */
  timeMultiplier: number;
  /** Visible to the examinee on their invitation */
  note?: string | null;
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
  accommodations?: InvitationAccommodations | null;
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
  accommodations?: InvitationAccommodations | null;
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
  accommodations?: InvitationAccommodations | null;
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
  accommodations?: InvitationAccommodations | null;
}

// ============ Examinee Groups ============
export interface ExamineeGroup {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  members?: User[];
  memberCount?: number;
  /** 8-character code examinees use to join; null when joining by code is off */
  joinCode?: string | null;
  joinEnabled?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupJoinPreview {
  id: string;
  name: string;
  description: string;
  createdByEmail: string | null;
  memberCount: number;
  alreadyMember: boolean;
}

export interface GroupJoinResult {
  id: string;
  name: string;
  alreadyMember: boolean;
  /** Group invitations copied to the new member */
  invitationsCreated: number;
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
  reason: "monthly_budget" | "daily_user_limit" | "daily_practice_limit" | "monthly_cap" | "plan_quota" | null;
  /** False when an examinee used up their daily AI requests or the monthly cap is reached */
  allowed?: boolean;
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
    /** Examinees' daily AI request cap; null for staff */
    dailyRequestLimit?: number | null;
  };
  plan?: AiPlan & { requestsThisMonth: number };
}

export type AiPlanId = "free" | "pro" | "school";

export interface AiPlan {
  id: AiPlanId;
  name: string;
  monthlyRequests: number;
}

// ============ Sharing, activity log & webhooks ============
export interface ExamCollaborator {
  uid: string;
  email: string | null;
  name: string | null;
  addedAt: string | null;
  addedBy: string | null;
}

export interface ExamCollaborators {
  owner: { uid: string | null; email: string | null };
  collaborators: ExamCollaborator[];
  canManageSharing: boolean;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  summary: string;
  details: Record<string, unknown> | null;
  actorId: string | null;
  actorEmail: string | null;
  createdAt: string | null;
}

// ============ Organizations ============
export type OrgRole = "owner" | "admin" | "member";
export type OrgDepartment = "general" | "math" | "science" | "english" | "ict" | "other";

export interface OrganizationMember {
  uid: string;
  email: string | null;
  name: string | null;
  role: OrgRole;
  department: OrgDepartment;
  joinedAt: string | null;
}

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
  memberCount: number;
  myRole: OrgRole | null;
  myDepartment: OrgDepartment | null;
  members?: OrganizationMember[];
  canManage?: boolean;
}

export type WebhookEvent = "result.submitted" | "result.graded";

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  /** Only present right after creation */
  secret: string | null;
  secretPreview: string | null;
  createdAt: string | null;
  lastDeliveryAt: string | null;
  lastEvent: string | null;
  lastStatus: number | null;
  lastError: string | null;
}

// ============ Study feedback & certificates ============
export interface StudyTopic {
  topic: string;
  questions: number;
  graded: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  pendingReview: number;
  score: number;
  points: number;
  /** null until something in the topic is graded */
  percentage: number | null;
  weak: boolean;
  missedQuestionIds?: string[];
  lastSeenAt?: string | null;
}

export interface StudyReport {
  resultId: string;
  examId: string;
  examTitle: string | null;
  threshold: number;
  topics: StudyTopic[];
  weakTopics: string[];
}

export interface StudyTopicsSummary {
  threshold: number;
  resultsConsidered: number;
  topics: StudyTopic[];
}

export interface Certificate {
  code: string;
  valid: boolean;
  reason: string | null;
  examineeName: string | null;
  examTitle: string | null;
  percentage: number | null;
  completedAt: string | null;
  issuedAt: string | null;
  issuerName: string | null;
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
  status?: "passed" | "failed" | "pending_review";
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
  /** Results awaiting essay grading, counted before the status filter */
  pendingReview?: number;
  averagePercentage: number;
}

export interface TimeExtension {
  minutes: number;
  by: string;
  byEmail: string | null;
  at: string;
}

export interface LiveSession {
  id: string;
  examineeId: string;
  examineeName: string | null;
  examineeEmail: string | null;
  invitationId: string | null;
  startedAt: string | null;
  expiresAt: string | null;
  scheduledEndTime: string | null;
  lastActivityAt: string | null;
  timeRemainingSeconds: number | null;
  answeredCount: number;
  totalQuestions: number;
  currentQuestionIndex: number;
  extraTimeSeconds: number;
  /** Extra-time accommodation from the invitation (1 when none) */
  timeMultiplier: number;
  timeExtensions: TimeExtension[];
  integrityEventCount: number;
}

export interface LiveRecentResult {
  id: string;
  sessionId: string | null;
  examineeName: string | null;
  examineeEmail: string | null;
  percentage: number;
  passed: boolean;
  gradingStatus: GradingStatus;
  submittedAt: string;
  autoSubmitted: boolean;
  forceSubmittedBy: string | null;
}

export interface LiveExamMonitor {
  examId: string;
  examTitle: string | null;
  examStatus: string | null;
  serverTime: string;
  inProgress: number;
  /** Sessions whose time ran out and were submitted while loading this view */
  autoSubmitted: number;
  sessions: LiveSession[];
  recentResults: LiveRecentResult[];
}

export type IntegrityEventType = "tab_hidden" | "window_blur" | "fullscreen_exit" | "paste" | "copy";

/** Sent from the exam screen; text is never included, only its length */
export interface IntegrityEventInput {
  type: IntegrityEventType;
  at: string;
  durationMs?: number;
  questionId?: string;
  length?: number;
}

export interface IntegrityEvent {
  type: IntegrityEventType;
  at: string | null;
  offsetSeconds: number | null;
  durationMs: number | null;
  questionId: string | null;
  length: number | null;
}

export interface ResultIntegrity {
  resultId: string;
  sessionId: string | null;
  /** False for sessions started before integrity logging existed */
  tracked: boolean;
  total: number;
  summary: Record<IntegrityEventType, number>;
  awayMs: number;
  events: IntegrityEvent[];
  truncated: boolean;
}

export type ItemAnalysisFlag =
  | "too_hard"
  | "too_easy"
  | "negative_discrimination"
  | "low_discrimination"
  | "distractor_beats_key"
  | "key_not_in_options"
  | "few_attempts";

export interface ItemAnalysisItem {
  questionId: string;
  questionText: string;
  questionTypeId: string | null;
  partId: string | null;
  partName: string | null;
  status: string;
  points: number;
  options: string[];
  correctAnswer: string | string[] | null;
  reconciliation: Pick<ExamReconciliation, "type" | "newCorrectAnswer" | "noAnswerCountsCorrect"> | null;
  attempts: number;
  answered: number;
  correct: number;
  pendingReview: number;
  unansweredRate: number | null;
  /** Share of graded attempts answered correctly (0–1) */
  difficulty: number | null;
  /** Upper-group minus lower-group correct rate (-1 to 1); null with fewer than 5 results */
  discrimination: number | null;
  averageScoreRate: number | null;
  optionDistribution: { option: string; count: number; isCorrect: boolean }[];
  otherAnswers: number;
  topTextAnswers: { answer: string; count: number; correct: boolean }[];
  flags: ItemAnalysisFlag[];
}

export interface ItemAnalysis {
  examId: string;
  totalResults: number;
  averagePercentage: number | null;
  standardDeviation: number | null;
  groupSize: number;
  flaggedCount: number;
  items: ItemAnalysisItem[];
}

export interface ScoreBucket {
  range: string;
  min: number;
  max: number;
  count: number;
  passed: number;
}

export interface WeeklyResultTrend {
  /** Monday of the week (UTC), YYYY-MM-DD */
  weekStart: string;
  count: number;
  passed: number;
  passRate: number | null;
  averagePercentage: number | null;
}

export interface ScoreHistoryPoint {
  id: string;
  examId: string;
  examTitle: string | null;
  percentage: number;
  passed: boolean;
  submittedAt: string;
}

export interface ExamResultStats {
  scope: "mine" | "managed";
  total: number;
  graded: number;
  passed: number;
  failed: number;
  pendingReview: number;
  averagePercentage: number;
  passRate: number;
  distribution: ScoreBucket[];
  trend: WeeklyResultTrend[];
  /** Only for scope "mine": up to 50 most recent graded results, oldest first */
  history?: ScoreHistoryPoint[];
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
