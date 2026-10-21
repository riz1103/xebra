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
  notificationPrefs?: NotificationPrefs;
}

export interface NotificationPrefs {
  resultEmails: boolean;
  reminderEmails: boolean;
  dailySummary: boolean;
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
  examineeName?: string;
  examineeEmail?: string;
  passingCondition?: PassingCondition | null;
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
  userName?: string;
  userEmail?: string;
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

export interface PassingCondition {
  type: "percentage" | "points" | "items";
  value: number;
}

export interface Exam {
  id: string;
  title: string;
  description?: string;
  instruction?: string | null;
  questionOrder?: "random" | "fixed";
  timeLimit?: number;
  passingCondition?: PassingCondition;
  passingScore?: number;
  isPublic?: boolean;
  reviewableByExaminee?: boolean;
  certificatesEnabled?: boolean;
  shuffleOptions?: boolean;
  status: "draft" | "active" | "archived";
  questionCount?: number;
  questions?: ExamQuestion[];
  parts?: { id: string; name: string; description?: string; timeLimit?: number | null }[] | null;
  origin?: string;
  isSample?: boolean;
  createdAt?: string;
}

export interface ExamQuestion {
  id: string;
  questionTypeId: string;
  questionTypeName?: string;
  questionText: string;
  options: string[];
  correctAnswer: string | string[];
  points: number;
  explanation?: string;
  status?: string;
  partId?: string | null;
  phraseId?: string | null;
  metadata?: {
    answerFormat?: "ordering" | "matching" | "hotspot";
    matchPrompts?: string[];
    audioUrl?: string;
    audioStoragePath?: string;
    maxPlays?: number;
    hotspotImageUrl?: string;
    hotspotImageStoragePath?: string;
    hotspotRegions?: { id: string; x: number; y: number; radius: number; label?: string }[];
  };
}

export interface BankQuestion {
  id: string;
  questionTypeId: string;
  questionText: string;
  options: string[];
  correctAnswer: string | string[];
  points: number;
  explanation?: string;
  topic: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  tags: string[];
}

export interface ExamBundle {
  id: string;
  name: string;
  description: string;
  examIds: string[];
  createdAt?: string;
}

export interface ExamInvitation {
  id: string;
  examId?: string;
  examTitle?: string;
  bundleId?: string;
  bundleName?: string;
  examineeEmail?: string;
  examineeName?: string;
  groupId?: string;
  groupName?: string;
  status: string;
  maxAttempts: number;
  attemptsUsed?: number;
  expiresAt: string;
}

export interface ExamineeGroup {
  id: string;
  name: string;
  description: string;
  memberIds?: string[];
  members?: { id?: string; uid?: string; email?: string; name?: string }[];
  memberCount?: number;
  joinCode?: string | null;
  joinEnabled?: boolean;
}

export interface OrganizationMember {
  uid: string;
  email: string | null;
  name: string | null;
  role: "owner" | "admin" | "member";
  department: string;
}

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  myRole: "owner" | "admin" | "member" | null;
  canManage?: boolean;
  members?: OrganizationMember[];
}

export interface Webhook {
  id: string;
  url: string;
  events: ("result.submitted" | "result.graded")[];
  active: boolean;
  secret: string | null;
  secretPreview: string | null;
  lastStatus: number | null;
}

export interface LiveSession {
  id: string;
  examineeName: string | null;
  examineeEmail: string | null;
  startedAt: string | null;
  timeRemainingSeconds: number | null;
  answeredCount: number;
  totalQuestions: number;
  extraTimeSeconds: number;
  integrityEventCount: number;
}

export interface LiveExamMonitor {
  examTitle: string | null;
  inProgress: number;
  autoSubmitted: number;
  sessions: LiveSession[];
}

export interface AiPlan {
  id: "free" | "pro" | "school";
  name: string;
  monthlyRequests: number;
  priceCentavos?: number | null;
}

export interface AiPack {
  id: "10" | "25" | "50";
  requests: number;
  priceCentavos: number;
}

export interface PaymongoCheckout {
  paymentIntentId: string;
  plan: string;
  kind?: "subscription" | "pack";
  requests?: number | null;
  amount: number;
  currency: "PHP";
  status: "pending" | "paid" | "expired" | "failed";
  qrImageUrl: string | null;
  testUrl?: string | null;
  expiresAt: string;
}

export interface ScoreBucket {
  range: string;
  count: number;
  passed: number;
}

export interface WeeklyResultTrend {
  weekStart: string;
  count: number;
  passed: number;
  passRate: number | null;
  averagePercentage: number | null;
}

export interface ExamResultStats {
  total: number;
  graded: number;
  passed: number;
  failed: number;
  pendingReview: number;
  averagePercentage: number;
  passRate: number;
  distribution?: ScoreBucket[];
  trend?: WeeklyResultTrend[];
}

export interface Phrase {
  id: string;
  title?: string | null;
  body: string;
  examId?: string | null;
}

export interface IntegrationStatus {
  paymongo: boolean;
  push: boolean;
  googleClassroom: boolean;
  lti: boolean;
  googleSheets: boolean;
  webhooks: boolean;
}
