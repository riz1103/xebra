import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { auth } from "./firebase";
import { API_BASE_URL } from "./config";
import type {
  AnswerValue,
  ApiResponse,
  ExamDetail,
  ExamForExaminee,
  ExamResult,
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
}

export const api = new ApiClient();
