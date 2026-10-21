export type Role = "admin" | "proctor" | "examinee" | "user";

export interface User {
  id: string;
  uid: string;
  email: string;
  name: string;
  displayName?: string;
  picture?: string;
  photoURL?: string;
  role: Role;
  createdAt?: string | { _seconds: number };
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface ListResponse<T> {
  success: boolean;
  message?: string;
  data: T[];
}

export interface QuestionType {
  id: string;
  name?: string | null;
  layout?: string | null;
}

export interface PhraseBlock {
  id: string;
  title?: string | null;
  body: string;
  imageUrls?: string[];
}

export interface HotspotRegion {
  id: string;
  x: number;
  y: number;
  radius: number;
  label?: string;
}

export interface QuestionMetadata {
  answerFormat?: "ordering" | "matching" | "hotspot";
  matchPrompts?: string[];
  audioUrl?: string;
  maxPlays?: number;
  hotspotImageUrl?: string;
  hotspotRegions?: HotspotRegion[];
}

export type AnswerValue = string | string[] | null;

export interface SessionQuestion {
  id: string;
  questionTypeId: string;
  questionTypeName?: string;
  questionText: string;
  options: string[];
  points: number;
  multipleAnswers?: boolean;
  correctAnswer?: string | string[];
  phraseId?: string | null;
  phrase?: PhraseBlock | null;
  metadata?: QuestionMetadata;
}

export interface ExamPartGroup {
  part: { id: string; name: string; description?: string; timeLimit?: number | null };
  questions?: SessionQuestion[];
  questionIds?: string[];
}

export interface ExamSession {
  id: string;
  examId: string;
  status: string;
  examTitle?: string;
  currentQuestionIndex: number;
  answers: Record<string, AnswerValue>;
  timeRemainingSeconds: number;
  extraTimeSeconds?: number;
  selectedQuestionIds?: string[];
  questions?: SessionQuestion[];
  phrases?: Record<string, PhraseBlock>;
  questionsByPart?: Record<string, ExamPartGroup> | null;
  partTimeLimits?: Record<string, { timeLimitSeconds: number }> | null;
  exam?: {
    title?: string;
    instruction?: string | null;
  };
  timeMultiplier?: number;
}

export interface ExamForExaminee {
  id: string;
  title?: string;
  status?: string;
  invitationStatus: "pending" | "in_progress" | "completed" | string;
  invitationId: string;
  maxAttempts: number;
  attemptsUsed: number;
  expiresAt?: string | { _seconds: number };
  scheduledStartTime?: string | { _seconds: number } | null;
  scheduledEndTime?: string | { _seconds: number } | null;
}

export interface QuestionResult {
  questionId: string;
  isCorrect: boolean;
  score: number;
  points: number;
  pendingReview?: boolean;
  feedback?: string;
}

export interface ReviewQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer?: string | string[];
  points: number;
  explanation?: string;
  partId?: string | null;
  metadata?: QuestionMetadata;
}

export interface ExamDetail {
  id: string;
  title?: string;
  questions?: ReviewQuestion[];
  parts?: { id: string; name: string; description?: string }[] | null;
}

export interface ExamResult {
  id: string;
  examId: string;
  examTitle?: string;
  score: number;
  totalPoints: number;
  percentage: number;
  passed: boolean | null;
  gradingStatus?: "pending_review" | "complete";
  pendingReviewCount?: number;
  correctCount?: number;
  incorrectCount?: number;
  totalQuestions: number;
  feedback?: string;
  timeSpentMinutes?: number;
  submittedAt: string;
  startedAt?: string;
  createdAt?: string;
  reviewableByExaminee?: boolean;
  /** False when this exam does not issue certificates. Missing means certificates are on. */
  certificatesEnabled?: boolean;
  certificateCode?: string | null;
  questionResults?: QuestionResult[];
  answers?: Record<string, AnswerValue>;
}

export interface StudyTopic {
  topic: string;
  percentage: number | null;
  weak: boolean;
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

export interface ProctorRequest {
  id: string;
  reason: string;
  additionalInfo?: string;
  status: "pending" | "approved" | "rejected";
  reviewNotes?: string;
  createdAt: string;
}

export type AiTier = "primary" | "fallback";

export interface AiUsageStatus {
  tier: AiTier;
  reason: "monthly_budget" | "daily_user_limit" | "daily_practice_limit" | "monthly_cap" | "plan_quota" | null;
  allowed?: boolean;
  user?: {
    dailyRequestLimit?: number | null;
  };
  plan?: {
    name: string;
    monthlyRequests: number;
  };
}

export interface RecordAiUsagePayload {
  tier: AiTier;
  inputTokens: number;
  outputTokens: number;
}

export type IntegrityEventType = "tab_hidden" | "window_blur" | "fullscreen_exit" | "paste" | "copy";

export interface IntegrityEventInput {
  type: IntegrityEventType;
  at: string;
  durationMs?: number;
  questionId?: string;
  length?: number;
}

export interface GroupJoinPreview {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  alreadyMember: boolean;
}

export interface GroupJoinResult {
  id: string;
  name: string;
  alreadyMember: boolean;
  invitationsCreated: number;
}

export interface SubmitPayload {
  session: ExamSession;
  result: ExamResult;
}
