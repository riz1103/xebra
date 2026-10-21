import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  Schema,
  type GenerativeModel,
  type ObjectSchema,
  type Part,
  type UsageMetadata,
} from "firebase/ai";
import { api } from "./api";
import { app } from "./firebase";
import type { AiTier, AiUsageStatus } from "./types";

const AI_MODELS: Record<AiTier, string> = {
  primary: process.env.EXPO_PUBLIC_GEMINI_MODEL || "gemini-flash-latest",
  fallback: process.env.EXPO_PUBLIC_GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest",
};

type JsonModelOptions = { temperature?: number; maxOutputTokens?: number };

const USAGE_STATUS_TTL_MS = 30_000;
const QUOTA_FALLBACK_MS = 10 * 60_000;

let status: AiUsageStatus | null = null;
let usageLoadedAt = 0;
let usageRequest: Promise<AiUsageStatus | null> | null = null;
let primaryQuotaHitAt = 0;

function refreshAiUsage(force = false): Promise<AiUsageStatus | null> {
  if (!force && status && Date.now() - usageLoadedAt < USAGE_STATUS_TTL_MS) return Promise.resolve(status);
  usageRequest ??= api
    .getAiUsage()
    .then((res) => {
      usageLoadedAt = Date.now();
      status = res.data ?? null;
      return status;
    })
    .catch(() => null)
    .finally(() => {
      usageRequest = null;
    });
  return usageRequest;
}

async function currentTier(): Promise<AiTier> {
  if (Date.now() - primaryQuotaHitAt < QUOTA_FALLBACK_MS) return "fallback";
  const next = await refreshAiUsage();
  return next?.tier ?? "primary";
}

function reportUsage(tier: AiTier, usage: UsageMetadata | undefined) {
  if (!usage) return;
  const inputTokens = usage.promptTokenCount ?? 0;
  const outputTokens = Math.max(usage.candidatesTokenCount ?? 0, (usage.totalTokenCount ?? 0) - inputTokens);
  api
    .recordAiUsage({ tier, inputTokens, outputTokens })
    .then((res) => {
      if (!res.data) return;
      usageLoadedAt = Date.now();
      status = res.data;
    })
    .catch(() => undefined);
}

function isQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /RESOURCE_EXHAUSTED|quota|\b429\b/i.test(message);
}

function model(schema: ObjectSchema, options: JsonModelOptions | undefined, tier: AiTier): GenerativeModel {
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  return getGenerativeModel(
    ai,
    {
      model: AI_MODELS[tier],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: options?.temperature ?? 0.3,
        maxOutputTokens: options?.maxOutputTokens ?? 16384,
      },
    },
    { timeout: 300_000 }
  );
}

async function generateOn(tier: AiTier, schema: ObjectSchema, request: string | Part[], options?: JsonModelOptions) {
  const res = await model(schema, options, tier).generateContent(request);
  reportUsage(tier, res.response.usageMetadata);
  return res.response.text();
}

/** Same budget and fallback rules the website uses before it asks Gemini for JSON. */
export async function generateJson(schema: ObjectSchema, request: string | Part[], options?: JsonModelOptions): Promise<string> {
  const usage = await refreshAiUsage();
  if (usage?.allowed === false) throw new Error(aiLimitMessage(usage));
  const tier = await currentTier();
  try {
    return await generateOn(tier, schema, request, options);
  } catch (err) {
    if (tier !== "primary" || !isQuotaError(err)) throw err;
    primaryQuotaHitAt = Date.now();
    return generateOn("fallback", schema, request, options);
  }
}

export function aiLimitMessage(usage: AiUsageStatus): string {
  if (usage.reason === "daily_practice_limit") {
    const limit = usage.user?.dailyRequestLimit;
    return `You've used all ${limit ? `${limit} ` : ""}of today's AI requests. They reset tomorrow.`;
  }
  if (usage.reason === "plan_quota") {
    const plan = usage.plan;
    return `You've used all ${plan ? `${plan.monthlyRequests} AI requests in your ${plan.name} plan` : "of your plan's AI requests"} this month. They reset next month, or ask an admin about upgrading your plan.`;
  }
  return "AI features are paused for the rest of the month because the monthly AI budget is used up.";
}

export function describeAiError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/PERMISSION_DENIED|api-not-enabled|has not been used|is disabled/i.test(message)) {
    return "Firebase AI Logic isn't enabled for this project. Enable it in the Firebase console (AI Logic → Get started) and try again.";
  }
  if (/app check token|appcheck.*(invalid|missing|required)|(invalid|missing).*app check/i.test(message)) {
    return "The AI request was rejected by App Check.";
  }
  if (isQuotaError(err)) {
    return "The AI quota was reached, even on the fallback model. They reset tomorrow, or the monthly limit is used up.";
  }
  if (/413|too large|payload/i.test(message)) {
    return "The notes are too large for one request. Remove some pages or photos and try again.";
  }
  if (/SAFETY|blocked/i.test(message)) {
    return "The AI declined to process part of these notes. Try removing the affected pages.";
  }
  return message || "The AI request failed.";
}

export { Schema };
