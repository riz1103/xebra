export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Profile: undefined;
  ExamEntry: { examId: string; invitationId?: string };
  Exam: { sessionId: string };
  Result: { resultId: string };
  Practice: undefined;
  Certificate: { resultId: string };
  Verify: { code: string };
  ProctorRequest: undefined;
};
