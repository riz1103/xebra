import { z } from "zod";

// ============ Auth ============
export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// ============ Question Types ============
export const questionTypeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().min(1, "Description is required").max(500, "Description too long"),
});

// ============ Exam Questions ============
export const examQuestionSchema = z.object({
  questionTypeId: z.string().min(1, "Question type is required"),
  questionText: z.string().min(1, "Question text is required").max(2000, "Question text too long"),
  options: z.array(z.string().min(1, "Option cannot be empty")).min(2, "At least 2 options required"),
  correctAnswer: z.union([z.string(), z.array(z.string())]),
  points: z.coerce.number().min(1, "Points must be at least 1"),
  numberOfChoices: z.coerce.number().min(2).optional(),
  partId: z.string().nullable().optional(), // New: Part ID
  timeLimit: z.coerce.number().min(0).optional(),
  examId: z.string().min(1, "Exam ID is required"),
});

// ============ Exams ============
const examPartSchema = z.object({
  id: z.string().min(1, "Part ID is required"), // Auto-generated GUID, no regex validation needed
  name: z.string().min(1, "Part name is required").max(200, "Part name too long"),
  description: z.string().max(500, "Description too long").default(""),
  numberOfItems: z.coerce.number().min(1).nullish().transform(val => val ?? null),
  timeLimit: z.coerce.number().min(1).nullish().transform(val => val ?? null),
  passingCondition: z.object({
    type: z.enum(["percentage", "points", "items"]),
    value: z.coerce.number().min(0, "Value must be positive"),
  }).nullish().transform(val => val ?? null),
});

export const examSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().max(1000, "Description too long").optional(),
  instruction: z.string().max(5000, "Instructions too long").nullable().optional(),
  parts: z.array(examPartSchema).nullable().optional(),
  questionOrder: z.preprocess(
    (val) => (val === "random" || val === "fixed" ? val : "fixed"),
    z.enum(["random", "fixed"])
  ),
  timeType: z.enum(["per_exam", "per_question", "per_part"]),
  timeLimit: z.coerce.number().min(1, "Time limit must be at least 1 minute"),
  numberOfItems: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.number().min(1).optional()
  ),
  passingCondition: z.object({
    type: z.enum(["percentage", "points", "items"]),
    value: z.coerce.number().min(0, "Value must be positive"),
  }),
  isPublic: z.boolean(),
  reviewableByExaminee: z.boolean().optional(),
}).refine((data) => {
  // If timeType is 'per_part', parts must exist and each part must have a timeLimit
  if (data.timeType === "per_part") {
    if (!data.parts || data.parts.length === 0) {
      return false;
    }
    // All parts must have timeLimit when timeType is 'per_part'
    return data.parts.every(part => part.timeLimit !== null && part.timeLimit !== undefined && part.timeLimit > 0);
  }
  return true;
}, {
  message: "When time type is 'per_part', all parts must have a time limit",
  path: ["parts"],
}).refine((data) => {
  // Validate part IDs are unique
  if (data.parts && data.parts.length > 0) {
    const ids = data.parts.map(p => p.id);
    return ids.length === new Set(ids).size;
  }
  return true;
}, {
  message: "Part IDs must be unique",
  path: ["parts"],
});

// ============ Exam Bundles ============
export const examBundleSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  description: z.string().min(1, "Description is required").max(500, "Description too long"),
  examIds: z.array(z.string()).optional(),
});

// ============ Exam Invitations ============
export const examInvitationSchema = z
  .object({
  examId: z.string().min(1, "Exam is required"),
  examineeEmail: z.string().email("Please enter a valid email"),
  expiresAt: z.string().min(1, "Expiry date is required"),
  maxAttempts: z.coerce.number().min(1, "Must allow at least 1 attempt"),
    scheduledStartTime: z.string().optional(),
    scheduledEndTime: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.scheduledStartTime) {
        const startTime = new Date(data.scheduledStartTime);
        return startTime > new Date();
      }
      return true;
    },
    { message: "Scheduled start time must be in the future", path: ["scheduledStartTime"] }
  )
  .refine(
    (data) => {
      if (data.scheduledEndTime) {
        const endTime = new Date(data.scheduledEndTime);
        return endTime > new Date();
      }
      return true;
    },
    { message: "Scheduled end time must be in the future", path: ["scheduledEndTime"] }
  )
  .refine(
    (data) => {
      if (data.scheduledStartTime && data.scheduledEndTime) {
        const startTime = new Date(data.scheduledStartTime);
        const endTime = new Date(data.scheduledEndTime);
        return endTime > startTime;
      }
      return true;
    },
    { message: "Scheduled end time must be after scheduled start time", path: ["scheduledEndTime"] }
  )
  .refine(
    (data) => {
      if (data.expiresAt && data.scheduledStartTime) {
        const expiresAt = new Date(data.expiresAt);
        const startTime = new Date(data.scheduledStartTime);
        return startTime < expiresAt;
      }
      return true;
    },
    { message: "Scheduled start time must be before expiration date", path: ["scheduledStartTime"] }
  )
  .refine(
    (data) => {
      if (data.expiresAt && data.scheduledEndTime) {
        const expiresAt = new Date(data.expiresAt);
        const endTime = new Date(data.scheduledEndTime);
        return endTime <= expiresAt;
      }
      return true;
    },
    { message: "Scheduled end time must be before or equal to expiration date", path: ["scheduledEndTime"] }
  );

export const groupInvitationSchema = z
  .object({
  examId: z.string().min(1, "Exam is required"),
  groupId: z.string().min(1, "Group is required"),
  expiresAt: z.string().min(1, "Expiry date is required"),
  maxAttempts: z.coerce.number().min(1, "Must allow at least 1 attempt"),
    scheduledStartTime: z.string().optional(),
    scheduledEndTime: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.scheduledStartTime) {
        const startTime = new Date(data.scheduledStartTime);
        return startTime > new Date();
      }
      return true;
    },
    { message: "Scheduled start time must be in the future", path: ["scheduledStartTime"] }
  )
  .refine(
    (data) => {
      if (data.scheduledEndTime) {
        const endTime = new Date(data.scheduledEndTime);
        return endTime > new Date();
      }
      return true;
    },
    { message: "Scheduled end time must be in the future", path: ["scheduledEndTime"] }
  )
  .refine(
    (data) => {
      if (data.scheduledStartTime && data.scheduledEndTime) {
        const startTime = new Date(data.scheduledStartTime);
        const endTime = new Date(data.scheduledEndTime);
        return endTime > startTime;
      }
      return true;
    },
    { message: "Scheduled end time must be after scheduled start time", path: ["scheduledEndTime"] }
  )
  .refine(
    (data) => {
      if (data.expiresAt && data.scheduledStartTime) {
        const expiresAt = new Date(data.expiresAt);
        const startTime = new Date(data.scheduledStartTime);
        return startTime < expiresAt;
      }
      return true;
    },
    { message: "Scheduled start time must be before expiration date", path: ["scheduledStartTime"] }
  )
  .refine(
    (data) => {
      if (data.expiresAt && data.scheduledEndTime) {
        const expiresAt = new Date(data.expiresAt);
        const endTime = new Date(data.scheduledEndTime);
        return endTime <= expiresAt;
      }
      return true;
    },
    { message: "Scheduled end time must be before or equal to expiration date", path: ["scheduledEndTime"] }
  );

export const bundleInvitationSchema = z
  .object({
  bundleId: z.string().min(1, "Bundle is required"),
  examineeEmail: z.string().email("Please enter a valid email"),
  expiresAt: z.string().min(1, "Expiry date is required"),
  maxAttempts: z.coerce.number().min(1, "Must allow at least 1 attempt"),
    scheduledStartTime: z.string().optional(),
    scheduledEndTime: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.scheduledStartTime) {
        const startTime = new Date(data.scheduledStartTime);
        return startTime > new Date();
      }
      return true;
    },
    { message: "Scheduled start time must be in the future", path: ["scheduledStartTime"] }
  )
  .refine(
    (data) => {
      if (data.scheduledEndTime) {
        const endTime = new Date(data.scheduledEndTime);
        return endTime > new Date();
      }
      return true;
    },
    { message: "Scheduled end time must be in the future", path: ["scheduledEndTime"] }
  )
  .refine(
    (data) => {
      if (data.scheduledStartTime && data.scheduledEndTime) {
        const startTime = new Date(data.scheduledStartTime);
        const endTime = new Date(data.scheduledEndTime);
        return endTime > startTime;
      }
      return true;
    },
    { message: "Scheduled end time must be after scheduled start time", path: ["scheduledEndTime"] }
  )
  .refine(
    (data) => {
      if (data.expiresAt && data.scheduledStartTime) {
        const expiresAt = new Date(data.expiresAt);
        const startTime = new Date(data.scheduledStartTime);
        return startTime < expiresAt;
      }
      return true;
    },
    { message: "Scheduled start time must be before expiration date", path: ["scheduledStartTime"] }
  )
  .refine(
    (data) => {
      if (data.expiresAt && data.scheduledEndTime) {
        const expiresAt = new Date(data.expiresAt);
        const endTime = new Date(data.scheduledEndTime);
        return endTime <= expiresAt;
      }
      return true;
    },
    { message: "Scheduled end time must be before or equal to expiration date", path: ["scheduledEndTime"] }
  );

export const bundleGroupInvitationSchema = z
  .object({
  bundleId: z.string().min(1, "Bundle is required"),
  groupId: z.string().min(1, "Group is required"),
  expiresAt: z.string().min(1, "Expiry date is required"),
  maxAttempts: z.coerce.number().min(1, "Must allow at least 1 attempt"),
    scheduledStartTime: z.string().optional(),
    scheduledEndTime: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.scheduledStartTime) {
        const startTime = new Date(data.scheduledStartTime);
        return startTime > new Date();
      }
      return true;
    },
    { message: "Scheduled start time must be in the future", path: ["scheduledStartTime"] }
  )
  .refine(
    (data) => {
      if (data.scheduledEndTime) {
        const endTime = new Date(data.scheduledEndTime);
        return endTime > new Date();
      }
      return true;
    },
    { message: "Scheduled end time must be in the future", path: ["scheduledEndTime"] }
  )
  .refine(
    (data) => {
      if (data.scheduledStartTime && data.scheduledEndTime) {
        const startTime = new Date(data.scheduledStartTime);
        const endTime = new Date(data.scheduledEndTime);
        return endTime > startTime;
      }
      return true;
    },
    { message: "Scheduled end time must be after scheduled start time", path: ["scheduledEndTime"] }
  )
  .refine(
    (data) => {
      if (data.expiresAt && data.scheduledStartTime) {
        const expiresAt = new Date(data.expiresAt);
        const startTime = new Date(data.scheduledStartTime);
        return startTime < expiresAt;
      }
      return true;
    },
    { message: "Scheduled start time must be before expiration date", path: ["scheduledStartTime"] }
  )
  .refine(
    (data) => {
      if (data.expiresAt && data.scheduledEndTime) {
        const expiresAt = new Date(data.expiresAt);
        const endTime = new Date(data.scheduledEndTime);
        return endTime <= expiresAt;
      }
      return true;
    },
    { message: "Scheduled end time must be before or equal to expiration date", path: ["scheduledEndTime"] }
  );

// ============ Examinee Groups ============
export const examineeGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional().default(""),
  memberEmails: z.string().optional(),
});

export const addGroupMembersSchema = z.object({
  memberEmails: z.string().min(1, "At least one email is required"),
});

// ============ Proctor Requests ============
export const proctorRequestSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters").max(500, "Reason too long"),
  additionalInfo: z.string().max(1000, "Additional info too long").optional(),
});

export const reviewProctorRequestSchema = z.object({
  reviewNotes: z.string().max(500, "Notes too long").optional(),
});

// ============ Type Inference ============
export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type QuestionTypeFormValues = z.infer<typeof questionTypeSchema>;
export type ExamQuestionFormValues = z.infer<typeof examQuestionSchema>;
export type ExamFormValues = z.infer<typeof examSchema>;
export type ExamBundleFormValues = z.infer<typeof examBundleSchema>;
export type ExamInvitationFormValues = z.infer<typeof examInvitationSchema>;
export type GroupInvitationFormValues = z.infer<typeof groupInvitationSchema>;
export type BundleInvitationFormValues = z.infer<typeof bundleInvitationSchema>;
export type ExamineeGroupFormValues = z.infer<typeof examineeGroupSchema>;
export type ProctorRequestFormValues = z.infer<typeof proctorRequestSchema>;
