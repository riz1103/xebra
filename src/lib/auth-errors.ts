/**
 * Maps Firebase Auth error codes to user-friendly messages.
 * Firebase errors have a `code` property (e.g. "auth/invalid-credential").
 */
const FIREBASE_AUTH_MESSAGES: Record<string, string> = {
  "auth/invalid-credential":
    "Invalid email or password. Please check your credentials and try again.",
  "auth/user-not-found": "No account found with this email. Try signing up instead.",
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/email-already-in-use":
    "This email is already registered. Try signing in instead.",
  "auth/weak-password": "Password is too weak. Use at least 6 characters.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/too-many-requests":
    "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed":
    "Network error. Please check your connection and try again.",
  "auth/popup-closed-by-user": "Sign-in was cancelled. Please try again.",
  "auth/cancelled-popup-request": "Sign-in was cancelled. Please try again.",
  "auth/account-exists-with-different-credential":
    "This email is already used with another sign-in method. Try signing in with that method.",
  "auth/operation-not-allowed":
    "This sign-in method is not enabled. Please try another way.",
  "auth/requires-recent-login":
    "Please sign in again to continue.",
  "auth/credential-already-in-use":
    "This credential is already linked to another account.",
  "auth/invalid-verification-code": "Invalid or expired code. Please try again.",
  "auth/invalid-verification-id": "Verification expired. Please try again.",
};

/**
 * Returns a user-friendly message for an authentication error.
 * Handles Firebase Auth errors (with code) and generic errors.
 */
export function getAuthErrorMessage(
  error: unknown,
  fallback: string = "Something went wrong. Please try again."
): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (typeof code === "string" && code in FIREBASE_AUTH_MESSAGES) {
      return FIREBASE_AUTH_MESSAGES[code];
    }
  }
  if (error instanceof Error && error.message) {
    // If it's a generic Error but message looks like "Firebase: Error (auth/...)", extract and map
    const match = error.message.match(/auth\/[a-z-]+/);
    if (match && match[0] in FIREBASE_AUTH_MESSAGES) {
      return FIREBASE_AUTH_MESSAGES[match[0]];
    }
    // Avoid showing raw Firebase messages; use fallback for unknown Firebase errors
    if (error.message.includes("Firebase:")) {
      return fallback;
    }
    return error.message;
  }
  return fallback;
}
