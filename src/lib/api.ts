import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { getIdToken } from "./firebase";
import type {
  ApiResponse,
  PaginationMeta,
  User,
  QuestionType,
  CreateQuestionTypePayload,
  ExamQuestion,
  CreateExamQuestionPayload,
  UpdateExamQuestionPayload,
  Exam,
  CreateExamPayload,
  UpdateExamPayload,
  PendingExam,
  ExamReconciliation,
  ReconcileQuestionPayload,
  ExamBundle,
  CreateExamBundlePayload,
  ExamSession,
  CreateExamSessionPayload,
  UpdateExamSessionPayload,
  AnswerQuestionPayload,
  ExamResult,
  ExamInvitation,
  CreateExamInvitationPayload,
  CreateGroupInvitationPayload,
  CreateBundleInvitationPayload,
  CreateBundleGroupInvitationPayload,
  ExamineeGroup,
  CreateExamineeGroupPayload,
  AddGroupMembersPayload,
  ProctorRequest,
  CreateProctorRequestPayload,
} from "@/types";

/** List response with optional pagination metadata from API */
export interface ListResponse<T> extends ApiResponse<T[]> {
  pagination?: PaginationMeta;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://xebra-api.netlify.app";

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: { "Content-Type": "application/json" },
    });

    this.client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
      const token = await getIdToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // Extracts the actual payload from nested API responses.
  // The API often returns { data: { user: {...} } } or { data: { exam: {...} } }
  // This helper unwraps single-key wrappers so consumers get the inner object directly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private unwrap(responseData: any): any {
    if (!responseData) return responseData;
    const d = responseData.data;
    if (d && typeof d === "object" && !Array.isArray(d)) {
      const keys = Object.keys(d);
      // If data contains a single key that holds an object/array, unwrap it
      // e.g. { data: { user: {...} } } → user object
      // But NOT { data: { id: "...", name: "..." } } → keep as-is
      if (keys.length === 1) {
        const innerVal = d[keys[0]];
        if (typeof innerVal === "object" && innerVal !== null) {
          return { ...responseData, data: innerVal };
        }
      }
    }
    return responseData;
  }

  // ============ Auth ============
  async login(idToken: string) {
    const { data } = await this.client.post<ApiResponse<{ token: string; user: User }>>(
      "/api/auth/login",
      { idToken }
    );
    return this.unwrap(data);
  }

  async getMe() {
    const { data } = await this.client.get<ApiResponse<User>>("/api/auth/me");
    return this.unwrap(data);
  }

  // ============ Question Types ============
  async getQuestionTypes(params?: { page?: number; size?: number }) {
    const { data } = await this.client.get<ListResponse<QuestionType>>("/api/question-types", { params });
    return data;
  }

  async getQuestionType(id: string) {
    const { data } = await this.client.get<ApiResponse<QuestionType>>(`/api/question-types/${id}`);
    return data;
  }

  async createQuestionType(payload: CreateQuestionTypePayload) {
    const { data } = await this.client.post<ApiResponse<QuestionType>>("/api/question-types", payload);
    return data;
  }

  async updateQuestionType(id: string, payload: Partial<CreateQuestionTypePayload>) {
    const { data } = await this.client.put<ApiResponse<QuestionType>>(`/api/question-types/${id}`, payload);
    return data;
  }

  async deleteQuestionType(id: string) {
    const { data } = await this.client.delete<ApiResponse>(`/api/question-types/${id}`);
    return data;
  }

  // ============ Exam Questions ============
  async getExamQuestions(params?: {
    questionTypeId?: string;
    examId?: string;
    page?: number;
    size?: number;
  }) {
    const { data } = await this.client.get<ListResponse<ExamQuestion>>("/api/exam-questions", { params });
    return data;
  }

  async getExamQuestion(id: string) {
    const { data } = await this.client.get<ApiResponse<ExamQuestion>>(`/api/exam-questions/${id}`);
    return data;
  }

  async createExamQuestion(payload: CreateExamQuestionPayload) {
    const { data } = await this.client.post<ApiResponse<ExamQuestion>>("/api/exam-questions", payload);
    return data;
  }

  async updateExamQuestion(id: string, payload: UpdateExamQuestionPayload) {
    const { data } = await this.client.put<ApiResponse<ExamQuestion>>(`/api/exam-questions/${id}`, payload);
    return data;
  }

  async deleteExamQuestion(id: string) {
    const { data } = await this.client.delete<ApiResponse>(`/api/exam-questions/${id}`);
    return data;
  }

  // ============ Exams ============
  async getExams(params?: {
    status?: string;
    isPublic?: boolean;
    createdBy?: string;
    page?: number;
    size?: number;
  }) {
    const { data } = await this.client.get<ListResponse<Exam>>("/api/exams", { params });
    return data;
  }

  async getPendingExams(params?: { page?: number; size?: number }) {
    const { data } = await this.client.get<ListResponse<PendingExam>>("/api/exams/pending", { params });
    return data;
  }

  async getExam(id: string, params?: { includeBundle?: boolean; includeQuestions?: boolean }) {
    const { data } = await this.client.get<ApiResponse<Exam>>(`/api/exams/${id}`, { params });
    return data;
  }

  async createExam(payload: CreateExamPayload) {
    const { data } = await this.client.post<ApiResponse<Exam>>("/api/exams", payload);
    return data;
  }

  async updateExam(id: string, payload: UpdateExamPayload) {
    const { data } = await this.client.put<ApiResponse<Exam>>(`/api/exams/${id}`, payload);
    return data;
  }

  async deleteExam(id: string) {
    const { data } = await this.client.delete<ApiResponse>(`/api/exams/${id}`);
    return data;
  }

  async getExamReconciliations(examId: string) {
    const { data } = await this.client.get<ApiResponse<ExamReconciliation[]>>(
      `/api/exams/${examId}/reconciliations`
    );
    return data;
  }

  async reconcileQuestion(examId: string, payload: ReconcileQuestionPayload) {
    const { data } = await this.client.post<ApiResponse<{ resultsUpdated?: number }>>(
      `/api/exams/${examId}/reconcile`,
      payload
    );
    return data;
  }

  async removeReconciliation(examId: string, questionId: string) {
    const { data } = await this.client.delete<ApiResponse<{ resultsUpdated?: number }>>(
      `/api/exams/${examId}/reconciliations/${questionId}`
    );
    return data;
  }

  // ============ Exam Bundles ============
  async getExamBundles(params?: { page?: number; size?: number }) {
    const { data } = await this.client.get<ListResponse<ExamBundle>>("/api/exam-bundles", { params });
    return data;
  }

  async getExamBundle(id: string, params?: { includeExams?: boolean; includeQuestionCount?: boolean }) {
    const { data } = await this.client.get<ApiResponse<ExamBundle>>(`/api/exam-bundles/${id}`, { params });
    return data;
  }

  async createExamBundle(payload: CreateExamBundlePayload) {
    const { data } = await this.client.post<ApiResponse<ExamBundle>>("/api/exam-bundles", payload);
    return data;
  }

  async updateExamBundle(id: string, payload: Partial<CreateExamBundlePayload>) {
    const { data } = await this.client.put<ApiResponse<ExamBundle>>(`/api/exam-bundles/${id}`, payload);
    return data;
  }

  async addExamsToBundle(id: string, examIds: string[]) {
    const { data } = await this.client.post<ApiResponse<ExamBundle>>(`/api/exam-bundles/${id}/exams`, { examIds });
    return data;
  }

  async removeExamsFromBundle(id: string, examIds: string[]) {
    const { data } = await this.client.delete<ApiResponse>(`/api/exam-bundles/${id}/exams`, { data: { examIds } });
    return data;
  }

  async deleteExamBundle(id: string) {
    const { data } = await this.client.delete<ApiResponse>(`/api/exam-bundles/${id}`);
    return data;
  }

  // ============ Exam Sessions ============
  async getExamSessions(params?: {
    examId?: string;
    examineeId?: string;
    invitationId?: string;
    status?: string;
    page?: number;
    size?: number;
  }) {
    const { data } = await this.client.get<ListResponse<ExamSession>>("/api/exam-sessions", { params });
    return data;
  }

  async getExamSession(id: string, params?: { includeQuestions?: boolean }) {
    const { data } = await this.client.get<ApiResponse<ExamSession>>(`/api/exam-sessions/${id}`, { params });
    return data;
  }

  async createExamSession(payload: CreateExamSessionPayload) {
    const { data } = await this.client.post<ApiResponse<ExamSession>>("/api/exam-sessions", payload);
    return data;
  }

  async updateExamSession(id: string, payload: UpdateExamSessionPayload) {
    const { data } = await this.client.put<ApiResponse<ExamSession>>(`/api/exam-sessions/${id}`, payload);
    return data;
  }

  async answerQuestion(sessionId: string, questionId: string, payload: AnswerQuestionPayload) {
    const { data } = await this.client.post<ApiResponse>(
      `/api/exam-sessions/${sessionId}/questions/${questionId}/answer`,
      payload
    );
    return data;
  }

  async submitExamSession(id: string) {
    const { data } = await this.client.post<ApiResponse<ExamResult>>(`/api/exam-sessions/${id}/submit`);
    return data;
  }

  async deleteExamSession(id: string) {
    const { data } = await this.client.delete<ApiResponse>(`/api/exam-sessions/${id}`);
    return data;
  }

  // ============ Exam Results ============
  async getExamResults(params?: { examId?: string; examineeId?: string; page?: number; size?: number }) {
    const { data } = await this.client.get<ListResponse<ExamResult>>("/api/exam-results", { params });
    return data;
  }

  async getExamResult(id: string) {
    const { data } = await this.client.get<ApiResponse<ExamResult>>(`/api/exam-results/${id}`);
    return data;
  }

  async updateExamResult(id: string, payload: Partial<ExamResult>) {
    const { data } = await this.client.put<ApiResponse<ExamResult>>(`/api/exam-results/${id}`, payload);
    return data;
  }

  async deleteExamResult(id: string) {
    const { data } = await this.client.delete<ApiResponse>(`/api/exam-results/${id}`);
    return data;
  }

  // ============ Exam Invitations ============
  async getExamInvitations(params?: {
    examId?: string;
    bundleId?: string;
    examineeId?: string;
    groupId?: string;
    status?: string;
    groupByBundle?: boolean;
    page?: number;
    size?: number;
  }) {
    const { data } = await this.client.get<ListResponse<ExamInvitation>>("/api/exam-invitations", { params });
    return data;
  }

  async getExamInvitation(id: string) {
    const { data } = await this.client.get<ApiResponse<ExamInvitation>>(`/api/exam-invitations/${id}`);
    return data;
  }

  async createExamInvitation(payload: CreateExamInvitationPayload) {
    const { data } = await this.client.post<ApiResponse<ExamInvitation>>("/api/exam-invitations", payload);
    return data;
  }

  async createGroupInvitation(payload: CreateGroupInvitationPayload) {
    const { data } = await this.client.post<ApiResponse<ExamInvitation[]>>("/api/exam-invitations/groups", payload);
    return data;
  }

  async createBundleInvitation(payload: CreateBundleInvitationPayload) {
    const { data } = await this.client.post<ApiResponse<ExamInvitation[]>>("/api/exam-invitations/bundles", payload);
    return data;
  }

  async createBundleGroupInvitation(payload: CreateBundleGroupInvitationPayload) {
    const { data } = await this.client.post<ApiResponse<ExamInvitation[]>>(
      "/api/exam-invitations/bundles/groups",
      payload
    );
    return data;
  }

  async updateExamInvitation(id: string, payload: Partial<ExamInvitation>) {
    const { data } = await this.client.put<ApiResponse<ExamInvitation>>(`/api/exam-invitations/${id}`, payload);
    return data;
  }

  async cancelExamInvitation(id: string) {
    const { data } = await this.client.put<ApiResponse>(`/api/exam-invitations/${id}/cancel`);
    return data;
  }

  async useExamInvitation(id: string) {
    const { data } = await this.client.post<ApiResponse>(`/api/exam-invitations/${id}/use`);
    return data;
  }

  async deleteExamInvitation(id: string) {
    const { data } = await this.client.delete<ApiResponse>(`/api/exam-invitations/${id}`);
    return data;
  }

  // ============ Examinee Groups ============
  async getExamineeGroups(params?: { memberId?: string; page?: number; size?: number }) {
    const { data } = await this.client.get<ListResponse<ExamineeGroup>>("/api/examinee-groups", { params });
    return data;
  }

  async getExamineeGroup(id: string, params?: { includeMembers?: boolean }) {
    const { data } = await this.client.get<ApiResponse<ExamineeGroup>>(`/api/examinee-groups/${id}`, { params });
    return data;
  }

  async createExamineeGroup(payload: CreateExamineeGroupPayload) {
    const { data } = await this.client.post<ApiResponse<ExamineeGroup>>("/api/examinee-groups", payload);
    return data;
  }

  async updateExamineeGroup(id: string, payload: Partial<CreateExamineeGroupPayload>) {
    const { data } = await this.client.put<ApiResponse<ExamineeGroup>>(`/api/examinee-groups/${id}`, payload);
    return data;
  }

  async addGroupMembers(id: string, payload: AddGroupMembersPayload) {
    const { data } = await this.client.post<ApiResponse<ExamineeGroup>>(`/api/examinee-groups/${id}/members`, payload);
    return data;
  }

  async removeGroupMembers(id: string, memberIds: string[]) {
    const { data } = await this.client.delete<ApiResponse>(`/api/examinee-groups/${id}/members`, {
      data: { memberIds },
    });
    return data;
  }

  async deleteExamineeGroup(id: string) {
    const { data } = await this.client.delete<ApiResponse>(`/api/examinee-groups/${id}`);
    return data;
  }

  // ============ Proctor Requests ============
  async getProctorRequests(params?: { status?: string; userId?: string; page?: number; size?: number }) {
    const { data } = await this.client.get<ListResponse<ProctorRequest>>("/api/proctor-requests", { params });
    return data;
  }

  async getProctorRequest(id: string) {
    const { data } = await this.client.get<ApiResponse<ProctorRequest>>(`/api/proctor-requests/${id}`);
    return data;
  }

  async createProctorRequest(payload: CreateProctorRequestPayload) {
    const { data } = await this.client.post<ApiResponse<ProctorRequest>>("/api/proctor-requests", payload);
    return data;
  }

  async approveProctorRequest(id: string, reviewNotes?: string) {
    const { data } = await this.client.put<ApiResponse<ProctorRequest>>(`/api/proctor-requests/${id}/approve`, {
      reviewNotes,
    });
    return data;
  }

  async rejectProctorRequest(id: string, reviewNotes?: string) {
    const { data } = await this.client.put<ApiResponse<ProctorRequest>>(`/api/proctor-requests/${id}/reject`, {
      reviewNotes,
    });
    return data;
  }

  async deleteProctorRequest(id: string) {
    const { data } = await this.client.delete<ApiResponse>(`/api/proctor-requests/${id}`);
    return data;
  }
}

export const api = new ApiClient();
