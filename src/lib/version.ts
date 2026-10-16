/** Build-time app identity. Set in next.config.ts from package.json + git (or host CI SHA). */

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
export const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || "";

/** e.g. `0.1.0+8152960` — unique per deploy when BUILD_ID is the commit SHA. */
export const APP_VERSION_LABEL = `${APP_VERSION}+${BUILD_ID}`;
