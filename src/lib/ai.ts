import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  type GenerativeModel,
  type ObjectSchema,
} from "firebase/ai";
import { CustomProvider, initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { app } from "@/lib/firebase";

const MODEL_NAME = process.env.NEXT_PUBLIC_GEMINI_MODEL || "gemini-flash-latest";
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;
const APPCHECK_DEBUG_TOKEN =
  process.env.NODE_ENV !== "production" ? process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN : undefined;

let appCheckInitialized = false;

/** App Check must be initialized before the first AI request so Firebase can attest the client. */
function ensureAppCheck() {
  if (appCheckInitialized || typeof window === "undefined") return;
  if (!RECAPTCHA_SITE_KEY && !APPCHECK_DEBUG_TOKEN) return;

  if (APPCHECK_DEBUG_TOKEN) {
    // "true" makes the SDK generate a token and print it to the console for registration.
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      APPCHECK_DEBUG_TOKEN === "true" ? true : APPCHECK_DEBUG_TOKEN;
  }

  initializeAppCheck(app, {
    // In debug mode the SDK exchanges the debug token and never asks the provider for a token.
    provider: RECAPTCHA_SITE_KEY
      ? new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY)
      : new CustomProvider({ getToken: () => Promise.reject(new Error("No App Check provider configured")) }),
    isTokenAutoRefreshEnabled: true,
  });
  appCheckInitialized = true;
}

export function getJsonModel(schema: ObjectSchema, options?: { temperature?: number; maxOutputTokens?: number }): GenerativeModel {
  ensureAppCheck();
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  return getGenerativeModel(
    ai,
    {
      model: MODEL_NAME,
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
    return "The AI request was rejected by App Check. Check the reCAPTCHA Enterprise site key configuration.";
  }
  if (/RESOURCE_EXHAUSTED|quota|429/i.test(message)) {
    return "The AI quota was reached. Wait a minute and try again, or reduce the number of questions.";
  }
  if (/413|too large|payload/i.test(message)) {
    return "The material is too large for one request. Remove some pages or photos and try again.";
  }
  if (/SAFETY|blocked/i.test(message)) {
    return "The AI declined to process part of this material. Try removing the affected pages.";
  }
  return message || "The AI request failed.";
}
