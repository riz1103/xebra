import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { auth } from "./firebase";
import { API_BASE_URL } from "./config";
import type {
  AnswerValue,
  ApiResponse,
  AiPack,
  AiPlan,
  BankQuestion,
  Exam,
  ExamBundle,
  ExamDetail,
  ExamForExaminee,
  ExamInvitation,
  ExamQuestion,
  ExamResult,
  ExamResultStats,
  ExamineeGroup,
  IntegrationStatus,
  LiveExamMonitor,
  NotificationPrefs,
  Organization,
  OrganizationMember,
  PaymongoCheckout,
  Phrase,
  Webhook,
  IntegrityEventInput,
  ExamSession,
  AiUsageStatus,
  Certificate,
  GroupJoinPreview,
  GroupJoinResult,
  ListResponse,
  ProctorRequest,
  QuestionType,
  RecordAiUsagePayload,
  StudyTopicsSummary,
  SubmitPayload,
  User,
} from "./types";

function unwrap<T>(responseData: ApiResponse<T>): ApiResponse<T> {
  const d = responseData?.data as unknown;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    const keys = Object.keys(d as object);
    if (keys.length === 1) {
      const inner = (d as Record<string, unknown>)[keys[0]];
      if (typeof inner === "object" && inner !== null) {
        return { ...responseData, data: inner as T };
      }
    }
  }
  return responseData;
}

export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof message === "string" && message) return message;
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: { "Content-Type": "application/json" },
    });
    this.client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
      const token = await auth.currentUser?.getIdToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  async getMe() {
    const { data } = await this.client.get<ApiResponse<User>>("/api/auth/me");
    return unwrap(data);
  }

  async getQuestionTypes() {
    const { data } = await this.client.get<ListResponse<QuestionType>>("/api/question-types", {
      params: { size: 100 },
    });
    return data;
  }

  async getExamsForExaminee() {
    const { data } = await this.client.get<ListResponse<ExamForExaminee>>("/api/exams/for-examinee", {
      params: { page: 1, size: 500 },
    });
    return data;
  }

  async getExamSessions() {
    const { data } = await this.client.get<ListResponse<ExamSession>>("/api/exam-sessions", {
      params: { page: 1, size: 500 },
    });
    return data;
  }

  async getExamSession(id: string, includeQuestions = false) {
    const { data } = await this.client.get<ApiResponse<ExamSession>>(`/api/exam-sessions/${id}`, {
      params: includeQuestions ? { includeQuestions: true } : undefined,
    });
    return data;
  }

  async createExamSession(payload: string | { invitationId?: string; examId?: string }) {
    const body = typeof payload === "string" ? { invitationId: payload } : payload;
    const { data } = await this.client.post<ApiResponse<ExamSession>>("/api/exam-sessions", body);
    return data;
  }

  async updateExamSession(id: string, payload: { currentQuestionIndex?: number; answers?: Record<string, AnswerValue> }) {
    const { data } = await this.client.put<ApiResponse<ExamSession>>(`/api/exam-sessions/${id}`, payload);
    return data;
  }

  async answerQuestion(sessionId: string, questionId: string, answer: AnswerValue) {
    const { data } = await this.client.post(`/api/exam-sessions/${sessionId}/questions/${questionId}/answer`, {
      answer,
    });
    return data;
  }

  async submitExamSession(id: string) {
    const { data } = await this.client.post<ApiResponse<SubmitPayload>>(`/api/exam-sessions/${id}/submit`);
    return data;
  }

  async getExamResults() {
    const { data } = await this.client.get<ListResponse<ExamResult>>("/api/exam-results", {
      params: { scope: "mine", page: 1, size: 500 },
    });
    return data;
  }

  async getExamResult(id: string) {
    const { data } = await this.client.get<ApiResponse<ExamResult>>(`/api/exam-results/${id}`);
    return data;
  }

  async getExam(id: string, includeQuestions = true) {
    const { data } = await this.client.get<ApiResponse<ExamDetail>>(`/api/exams/${id}`, {
      params: includeQuestions ? { includeQuestions: true } : undefined,
    });
    return data;
  }

  async getExamInvitation(id: string) {
    const { data } = await this.client.get<ApiResponse<{ examTitle?: string; examId: string }>>(
      `/api/exam-invitations/${id}`
    );
    return data;
  }

  async recordIntegrityEvents(sessionId: string, events: IntegrityEventInput[]) {
    const { data } = await this.client.post<ApiResponse<{ recorded: number }>>(
      `/api/exam-sessions/${sessionId}/integrity-events`,
      { events }
    );
    return data;
  }

  async previewGroupJoinCode(code: string) {
    const { data } = await this.client.get<ApiResponse<GroupJoinPreview>>(
      `/api/examinee-groups/join/${encodeURIComponent(code)}`
    );
    return data;
  }

  async joinGroupByCode(code: string) {
    const { data } = await this.client.post<ApiResponse<GroupJoinResult>>("/api/examinee-groups/join", { code });
    return data;
  }

  async getStudyTopics() {
    const { data } = await this.client.get<ApiResponse<StudyTopicsSummary>>("/api/exam-results/study-topics");
    return data;
  }

  async issueCertificate(resultId: string) {
    const { data } = await this.client.post<ApiResponse<Certificate>>(`/api/exam-results/${resultId}/certificate`);
    return data;
  }

  async verifyCertificate(code: string) {
    const { data } = await this.client.get<ApiResponse<Certificate>>(`/api/certificates/${encodeURIComponent(code)}`);
    return data;
  }

  async getProctorRequests() {
    const { data } = await this.client.get<ListResponse<ProctorRequest>>("/api/proctor-requests", {
      params: { page: 1, size: 100 },
    });
    return data;
  }

  async createProctorRequest(payload: { reason: string; additionalInfo?: string }) {
    const { data } = await this.client.post<ApiResponse<ProctorRequest>>("/api/proctor-requests", payload);
    return data;
  }

  async getAiUsage() {
    const { data } = await this.client.get<ApiResponse<AiUsageStatus>>("/api/ai-usage");
    return data;
  }

  async recordAiUsage(payload: RecordAiUsagePayload) {
    const { data } = await this.client.post<ApiResponse<AiUsageStatus>>("/api/ai-usage", payload);
    return data;
  }

  async updatePreferences(notificationPrefs: Partial<NotificationPrefs>) {
    const { data } = await this.client.put<ApiResponse<{ notificationPrefs: NotificationPrefs }>>(
      "/api/auth/me/preferences",
      { notificationPrefs }
    );
    return data;
  }

  async getPlans() {
    const { data } = await this.client.get<ApiResponse<AiPlan[]> & { packs?: AiPack[] }>("/api/ai-usage/plans");
    return data;
  }

  async setUserPlan(email: string, plan: AiPlan["id"]) {
    const { data } = await this.client.put<ApiResponse<{ email: string; plan: AiPlan }>>("/api/ai-usage/plan", { email, plan });
    return data;
  }

  async getExams(params?: { page?: number; size?: number; status?: string }) {
    const { data } = await this.client.get<ListResponse<Exam>>("/api/exams", { params });
    return data;
  }

  async getSharedExams() {
    const { data } = await this.client.get<ApiResponse<Exam[]>>("/api/exams/shared");
    return data;
  }

  async createExam(payload: Record<string, unknown>) {
    const { data } = await this.client.post<ApiResponse<Exam>>("/api/exams", payload);
    return data;
  }

  async updateExam(id: string, payload: Record<string, unknown>) {
    const { data } = await this.client.put<ApiResponse<Exam>>(`/api/exams/${id}`, payload);
    return data;
  }

  async deleteExam(id: string) {
    const { data } = await this.client.delete<ApiResponse<null>>(`/api/exams/${id}`);
    return data;
  }

  async duplicateExam(id: string) {
    const { data } = await this.client.post<ApiResponse<Exam>>(`/api/exams/${id}/duplicate`, {});
    return data;
  }

  async createSampleExam() {
    const { data } = await this.client.post<ApiResponse<Exam>>("/api/exams/sample");
    return data;
  }

  async createExamQuestion(payload: Record<string, unknown>) {
    const { data } = await this.client.post<ApiResponse<ExamQuestion>>("/api/exam-questions", payload);
    return data;
  }

  async updateExamQuestion(id: string, payload: Record<string, unknown>) {
    const { data } = await this.client.put<ApiResponse<ExamQuestion>>(`/api/exam-questions/${id}`, payload);
    return data;
  }

  async deleteExamQuestion(id: string) {
    const { data } = await this.client.delete<ApiResponse<null>>(`/api/exam-questions/${id}`);
    return data;
  }

  async getPhrases(examId: string) {
    const { data } = await this.client.get<ListResponse<Phrase>>("/api/phrases", { params: { examId, page: 1, size: 100 } });
    return data;
  }

  async createPhrase(payload: { body: string; title?: string | null; examId: string }) {
    const { data } = await this.client.post<ApiResponse<Phrase>>("/api/phrases", payload);
    return data;
  }

  async updatePhrase(id: string, payload: { body?: string; title?: string | null }) {
    const { data } = await this.client.put<ApiResponse<Phrase>>(`/api/phrases/${id}`, payload);
    return data;
  }

  async deletePhrase(id: string) {
    const { data } = await this.client.delete<ApiResponse<null>>(`/api/phrases/${id}`);
    return data;
  }

  async uploadQuestionMedia(uri: string, name: string, mimeType: string, kind: "audio" | "image") {
    const form = new FormData();
    form.append("file", { uri, name, type: mimeType } as unknown as Blob);
    const { data } = await this.client.post<ApiResponse<{ url: string; path: string }>>(
      `/api/question-media?kind=${kind}`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data;
  }

  async getLiveSessions(examId: string) {
    const { data } = await this.client.get<ApiResponse<LiveExamMonitor>>(`/api/exams/${examId}/live`);
    return data;
  }

  async extendSessionTime(sessionId: string, minutes: number) {
    const { data } = await this.client.post<ApiResponse<{ timeRemainingSeconds: number | null }>>(
      `/api/exam-sessions/${sessionId}/extend`,
      { minutes }
    );
    return data;
  }

  async forceSubmitSession(sessionId: string, reason?: string) {
    const { data } = await this.client.post<ApiResponse<{ resultId: string | null }>>(
      `/api/exam-sessions/${sessionId}/force-submit`,
      reason ? { reason } : {}
    );
    return data;
  }

  async getBankQuestions() {
    const { data } = await this.client.get<ListResponse<BankQuestion>>("/api/question-bank", { params: { page: 1, size: 100 } });
    return data;
  }

  async createBankQuestion(payload: Record<string, unknown>) {
    const { data } = await this.client.post<ApiResponse<BankQuestion>>("/api/question-bank", payload);
    return data;
  }

  async updateBankQuestion(id: string, payload: Record<string, unknown>) {
    const { data } = await this.client.put<ApiResponse<BankQuestion>>(`/api/question-bank/${id}`, payload);
    return data;
  }

  async deleteBankQuestion(id: string) {
    const { data } = await this.client.delete<ApiResponse<null>>(`/api/question-bank/${id}`);
    return data;
  }

  async importExamToBank(examId: string) {
    const { data } = await this.client.post<ApiResponse<{ imported: number }>>("/api/question-bank/import", { examId });
    return data;
  }

  async getExamBundles() {
    const { data } = await this.client.get<ListResponse<ExamBundle>>("/api/exam-bundles", { params: { page: 1, size: 100 } });
    return data;
  }

  async createExamBundle(payload: { name: string; description: string; examIds?: string[] }) {
    const { data } = await this.client.post<ApiResponse<ExamBundle>>("/api/exam-bundles", payload);
    return data;
  }

  async updateExamBundle(id: string, payload: { name?: string; description?: string; examIds?: string[] }) {
    const { data } = await this.client.put<ApiResponse<ExamBundle>>(`/api/exam-bundles/${id}`, payload);
    return data;
  }

  async deleteExamBundle(id: string) {
    const { data } = await this.client.delete<ApiResponse<null>>(`/api/exam-bundles/${id}`);
    return data;
  }

  async getExamInvitations() {
    const { data } = await this.client.get<ListResponse<ExamInvitation>>("/api/exam-invitations", { params: { page: 1, size: 100 } });
    return data;
  }

  async createExamInvitation(payload: Record<string, unknown>) {
    const { data } = await this.client.post<ApiResponse<ExamInvitation>>("/api/exam-invitations", payload);
    return data;
  }

  async createGroupInvitation(payload: Record<string, unknown>) {
    const { data } = await this.client.post<ApiResponse<ExamInvitation[]>>("/api/exam-invitations/groups", payload);
    return data;
  }

  async createBundleInvitation(payload: Record<string, unknown>) {
    const { data } = await this.client.post<ApiResponse<ExamInvitation[]>>("/api/exam-invitations/bundles", payload);
    return data;
  }

  async createBundleGroupInvitation(payload: Record<string, unknown>) {
    const { data } = await this.client.post<ApiResponse<ExamInvitation[]>>("/api/exam-invitations/bundles/groups", payload);
    return data;
  }

  async updateExamInvitation(
    id: string,
    payload: {
      accommodations?: { timeMultiplier: number; note?: string | null } | null;
      scheduledStartTime?: string | null;
      scheduledEndTime?: string | null;
    }
  ) {
    const { data } = await this.client.put<ApiResponse<ExamInvitation>>(`/api/exam-invitations/${id}`, payload);
    return data;
  }

  async deleteExamInvitation(id: string) {
    const { data } = await this.client.delete<ApiResponse<null>>(`/api/exam-invitations/${id}`);
    return data;
  }

  async getExamineeGroups() {
    const { data } = await this.client.get<ListResponse<ExamineeGroup>>("/api/examinee-groups", { params: { page: 1, size: 100 } });
    return data;
  }

  async getExamineeGroup(id: string) {
    const { data } = await this.client.get<ApiResponse<ExamineeGroup>>(`/api/examinee-groups/${id}`, { params: { includeMembers: true } });
    return data;
  }

  async createExamineeGroup(payload: { name: string; description: string }) {
    const { data } = await this.client.post<ApiResponse<ExamineeGroup>>("/api/examinee-groups", payload);
    return data;
  }

  async deleteExamineeGroup(id: string) {
    const { data } = await this.client.delete<ApiResponse<null>>(`/api/examinee-groups/${id}`);
    return data;
  }

  async addGroupMembers(id: string, memberEmails: string[]) {
    const { data } = await this.client.post<ApiResponse<ExamineeGroup>>(`/api/examinee-groups/${id}/members`, { memberEmails });
    return data;
  }

  async removeGroupMembers(id: string, memberIds: string[]) {
    const { data } = await this.client.delete<ApiResponse<null>>(`/api/examinee-groups/${id}/members`, { data: { memberIds } });
    return data;
  }

  async regenerateGroupJoinCode(id: string) {
    const { data } = await this.client.post<ApiResponse<{ joinCode: string; joinEnabled: boolean }>>(`/api/examinee-groups/${id}/join-code`);
    return data;
  }

  async disableGroupJoinCode(id: string) {
    const { data } = await this.client.delete<ApiResponse<null>>(`/api/examinee-groups/${id}/join-code`);
    return data;
  }

  async getManagedResults() {
    const { data } = await this.client.get<ListResponse<ExamResult>>("/api/exam-results", {
      params: { page: 1, size: 100, scope: "managed" },
    });
    return data;
  }

  async getExamResultStats(scope: "mine" | "managed") {
    const { data } = await this.client.get<ApiResponse<ExamResultStats>>("/api/exam-results/stats", { params: { scope, weeks: 8 } });
    return data;
  }

  async gradeExamResult(id: string, grades: { questionId: string; score: number | null; feedback?: string }[]) {
    const { data } = await this.client.put<ApiResponse<ExamResult>>(`/api/exam-results/${id}/grades`, { grades });
    return data;
  }

  async getOrganizations() {
    const { data } = await this.client.get<ApiResponse<Organization[]>>("/api/organizations");
    return data;
  }

  async createOrganization(payload: { name: string; description?: string }) {
    const { data } = await this.client.post<ApiResponse<Organization>>("/api/organizations", payload);
    return data;
  }

  async getOrganization(id: string) {
    const { data } = await this.client.get<ApiResponse<Organization>>(`/api/organizations/${id}`);
    return data;
  }

  async updateOrganization(id: string, payload: { name?: string; description?: string | null }) {
    const { data } = await this.client.put<ApiResponse<Organization>>(`/api/organizations/${id}`, payload);
    return data;
  }

  async addOrganizationMember(id: string, payload: { email: string; role?: string; department?: string }) {
    const { data } = await this.client.post<ApiResponse<OrganizationMember>>(`/api/organizations/${id}/members`, payload);
    return data;
  }

  async updateOrganizationMember(id: string, uid: string, payload: { role?: string; department?: string }) {
    const { data } = await this.client.put<ApiResponse<OrganizationMember>>(`/api/organizations/${id}/members/${uid}`, payload);
    return data;
  }

  async removeOrganizationMember(id: string, uid: string) {
    const { data } = await this.client.delete<ApiResponse<null>>(`/api/organizations/${id}/members/${uid}`);
    return data;
  }

  async shareExamWithOrganization(orgId: string, examId: string) {
    const { data } = await this.client.post<ApiResponse<{ examId: string }>>(`/api/organizations/${orgId}/exams`, { examId });
    return data;
  }

  async getWebhooks() {
    const { data } = await this.client.get<ApiResponse<Webhook[]>>("/api/webhooks");
    return data;
  }

  async createWebhook(payload: { url: string; events?: Webhook["events"] }) {
    const { data } = await this.client.post<ApiResponse<Webhook>>("/api/webhooks", payload);
    return data;
  }

  async updateWebhook(id: string, payload: { active?: boolean }) {
    const { data } = await this.client.put<ApiResponse<Webhook>>(`/api/webhooks/${id}`, payload);
    return data;
  }

  async deleteWebhook(id: string) {
    const { data } = await this.client.delete<ApiResponse<null>>(`/api/webhooks/${id}`);
    return data;
  }

  async subscribeMobilePush(token: string) {
    const { data } = await this.client.post<ApiResponse<null>>("/api/integrations/push/mobile", { token, platform: "android" });
    return data;
  }

  async getIntegrationStatus() {
    const { data } = await this.client.get<ApiResponse<IntegrationStatus>>("/api/integrations/status");
    return data;
  }

  async startPaymongoCheckout(body: { plan: "pro" | "school" } | { pack: "10" | "25" | "50" }) {
    const { data } = await this.client.post<ApiResponse<PaymongoCheckout>>("/api/integrations/paymongo/checkout", body);
    return data;
  }

  async getPaymongoCheckout(paymentIntentId: string) {
    const { data } = await this.client.get<ApiResponse<PaymongoCheckout>>(`/api/integrations/paymongo/checkout/${paymentIntentId}`);
    return data;
  }

  async approveProctorRequest(id: string, reviewNotes?: string) {
    const { data } = await this.client.put<ApiResponse<ProctorRequest>>(`/api/proctor-requests/${id}/approve`, { reviewNotes });
    return data;
  }

  async rejectProctorRequest(id: string, reviewNotes?: string) {
    const { data } = await this.client.put<ApiResponse<ProctorRequest>>(`/api/proctor-requests/${id}/reject`, { reviewNotes });
    return data;
  }

  async createQuestionType(payload: { layout: string; name?: string; description?: string }) {
    const { data } = await this.client.post<ApiResponse<QuestionType>>("/api/question-types", payload);
    return data;
  }

  async updateQuestionType(id: string, payload: { name?: string; description?: string }) {
    const { data } = await this.client.put<ApiResponse<QuestionType>>(`/api/question-types/${id}`, payload);
    return data;
  }

  async deleteQuestionType(id: string) {
    const { data } = await this.client.delete<ApiResponse<null>>(`/api/question-types/${id}`);
    return data;
  }
}

export const api = new ApiClient();
