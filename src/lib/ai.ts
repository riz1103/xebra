import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  type GenerativeModel,
  type ObjectSchema,
  type Part,
  type UsageMetadata,
} from "firebase/ai";
import { CustomProvider, initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { app } from "@/lib/firebase";
import { api } from "@/lib/api";
import type { AiTier, AiUsageStatus } from "@/types";

export const AI_MODELS: Record<AiTier, string> = {
  primary: process.env.NEXT_PUBLIC_GEMINI_MODEL || "gemini-flash-latest",
  fallback: process.env.NEXT_PUBLIC_GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest",
};
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;
/** Explicit debug token (UUID) or "true" to mint one. Production builds ignore this. */
const APPCHECK_DEBUG_TOKEN_ENV =
  process.env.NODE_ENV !== "production" ? process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN : undefined;

let appCheckInitialized = false;

/**
 * App Check must run before the first AI request. Firebase AI Logic enforces it, so localhost
 * needs the debug provider (register the printed token in Firebase Console → App Check → Manage
 * debug tokens). Production uses reCAPTCHA Enterprise.
 */
function ensureAppCheck() {
  if (appCheckInitialized || typeof window === "undefined") return;

  const isLocalhost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  // On localhost with nothing configured, mint a debug token so the console shows what to register.
  const debugToken =
    APPCHECK_DEBUG_TOKEN_ENV ||
    (isLocalhost && !RECAPTCHA_SITE_KEY ? "true" : undefined);

  if (!RECAPTCHA_SITE_KEY && !debugToken) return;

  if (debugToken) {
    // "true" → SDK generates a token and logs: AppCheck debug token: "<uuid>"
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      debugToken === "true" ? true : debugToken;
  }

  initializeAppCheck(app, {
    // With a debug token set, the SDK uses it and does not call the provider.
    provider: RECAPTCHA_SITE_KEY
      ? new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY)
      : new CustomProvider({
          getToken: () =>
            Promise.reject(new Error("App Check debug token missing — check the browser console for the UUID to register.")),
        }),
    isTokenAutoRefreshEnabled: true,
  });
  appCheckInitialized = true;
}

type JsonModelOptions = { temperature?: number; maxOutputTokens?: number };

function getJsonModel(schema: ObjectSchema, options: JsonModelOptions | undefined, tier: AiTier): GenerativeModel {
  ensureAppCheck();
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

// ============ Usage budget ============
// The backend tracks estimated spend and tells us whether to use the primary or fallback model.

const USAGE_STATUS_TTL_MS = 30_000;
/** After the primary model hits a quota error, stay on the fallback for this long. */
const QUOTA_FALLBACK_MS = 10 * 60_000;

export interface AiUsageSnapshot {
  status: AiUsageStatus | null;
  /** Primary model recently returned a quota error, so requests use the fallback regardless of budget. */
  quotaFallback: boolean;
  /** At least one request since the last clearAiFallbackUsage() was answered by the fallback model. */
  usedFallback: boolean;
}

let usageSnapshot: AiUsageSnapshot = { status: null, quotaFallback: false, usedFallback: false };
let usageLoadedAt = 0;
let usageRequest: Promise<AiUsageStatus | null> | null = null;
let primaryQuotaHitAt = 0;
const usageListeners = new Set<() => void>();

function setUsageSnapshot(next: Partial<AiUsageSnapshot>) {
  usageSnapshot = { ...usageSnapshot, ...next };
  usageListeners.forEach((listener) => listener());
}

export function subscribeAiUsage(listener: () => void): () => void {
  usageListeners.add(listener);
  return () => usageListeners.delete(listener);
}

export function getAiUsageSnapshot(): AiUsageSnapshot {
  return usageSnapshot;
}

/** Call when starting a new generation so the fallback notice reflects only that run. */
export function clearAiFallbackUsage() {
  if (usageSnapshot.usedFallback) setUsageSnapshot({ usedFallback: false });
}

/** Loads usage from the backend (cached briefly). Resolves to null if the backend can't be reached. */
export function refreshAiUsage(force = false): Promise<AiUsageStatus | null> {
  if (!force && usageSnapshot.status && Date.now() - usageLoadedAt < USAGE_STATUS_TTL_MS) {
    return Promise.resolve(usageSnapshot.status);
  }
  usageRequest ??= api
    .getAiUsage()
    .then((res) => {
      usageLoadedAt = Date.now();
      setUsageSnapshot({ status: res.data ?? null });
      return res.data ?? null;
    })
    .catch(() => null)
    .finally(() => {
      usageRequest = null;
    });
  return usageRequest;
}

async function currentTier(): Promise<AiTier> {
  if (Date.now() - primaryQuotaHitAt < QUOTA_FALLBACK_MS) return "fallback";
  if (usageSnapshot.quotaFallback) setUsageSnapshot({ quotaFallback: false });
  // Without usage info (backend unreachable) keep using the primary model rather than blocking AI
  const status = await refreshAiUsage();
  return status?.tier ?? "primary";
}

function reportUsage(tier: AiTier, usage: UsageMetadata | undefined) {
  if (!usage) return;
  const inputTokens = usage.promptTokenCount ?? 0;
  // totalTokenCount includes thinking tokens, which are billed as output
  const outputTokens = Math.max(usage.candidatesTokenCount ?? 0, (usage.totalTokenCount ?? 0) - inputTokens);
  api
    .recordAiUsage({ tier, inputTokens, outputTokens })
    .then((res) => {
      if (!res.data) return;
      usageLoadedAt = Date.now();
      setUsageSnapshot({ status: res.data });
    })
    .catch(() => {});
}

function isQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /RESOURCE_EXHAUSTED|quota|\b429\b/i.test(message);
}

async function generateOn(tier: AiTier, schema: ObjectSchema, request: string | Part[], options?: JsonModelOptions) {
  const res = await getJsonModel(schema, options, tier).generateContent(request);
  reportUsage(tier, res.response.usageMetadata);
  if (tier === "fallback" && !usageSnapshot.usedFallback) setUsageSnapshot({ usedFallback: true });
  return res.response.text();
}

/**
 * Runs a JSON-schema request on the model tier allowed by the usage budget and returns the response text.
 * Falls back to the cheaper model when the primary one is over quota.
 */
export async function generateJson(
  schema: ObjectSchema,
  request: string | Part[],
  options?: JsonModelOptions
): Promise<string> {
  const status = await refreshAiUsage();
  if (status?.allowed === false) throw new Error(aiLimitMessage(status));
  const tier = await currentTier();
  try {
    return await generateOn(tier, schema, request, options);
  } catch (err) {
    if (tier !== "primary" || !isQuotaError(err)) throw err;
    primaryQuotaHitAt = Date.now();
    setUsageSnapshot({ quotaFallback: true });
    return generateOn("fallback", schema, request, options);
  }
}

export function aiLimitMessage(status: AiUsageStatus): string {
  if (status.reason === "daily_practice_limit") {
    const limit = status.user.dailyRequestLimit;
    return `You've used all ${limit ? `${limit} ` : ""}of today's AI requests. They reset tomorrow.`;
  }
  if (status.reason === "plan_quota") {
    const plan = status.plan;
    return `You've used all ${plan ? `${plan.monthlyRequests} AI requests in your ${plan.name} plan` : "of your plan's AI requests"} this month. They reset next month, or ask an admin about upgrading your plan.`;
  }
  return "AI features are paused for the rest of the month because the monthly AI budget is used up.";
}

/** Raw error text including the HTTP status, for troubleshooting alongside the friendly message. */
export function aiErrorDetail(err: unknown): string {
  const status = (err as { customErrorData?: { status?: number; statusText?: string } })?.customErrorData;
  const message = err instanceof Error ? err.message : String(err);
  return status?.status ? `[${status.status} ${status.statusText ?? ""}] ${message}` : message;
}

/** Maps Firebase AI errors to messages a proctor can act on. */
export function describeAiError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/PERMISSION_DENIED|api-not-enabled|has not been used|is disabled/i.test(message)) {
    return "Firebase AI Logic isn't enabled for this project. Enable it in the Firebase console (AI Logic → Get started) and try again.";
  }
  if (/app check token|appcheck.*(invalid|missing|required)|(invalid|missing).*app check/i.test(message)) {
    if (typeof window !== "undefined" && /localhost|127\.0\.0\.1/.test(window.location.hostname)) {
      return "App Check blocked this AI request. In the browser console, copy the “AppCheck debug token”, register it in Firebase Console → App Check → your web app → Manage debug tokens, then refresh and try again.";
    }
    return "The AI request was rejected by App Check. Check the reCAPTCHA Enterprise site key configuration.";
  }
  if (isQuotaError(err)) {
    return "The AI quota was reached, even on the fallback model. If waiting a minute doesn't help, the daily limit or the monthly spend cap is used up. Check Google AI Studio → Dashboard → Rate limits and Spend.";
  }
  if (/413|too large|payload/i.test(message)) {
    return "The material is too large for one request. Remove some pages or photos and try again.";
  }
  if (/SAFETY|blocked/i.test(message)) {
    return "The AI declined to process part of this material. Try removing the affected pages.";
  }
  return message || "The AI request failed.";
}
