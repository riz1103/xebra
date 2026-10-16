import { getServiceWorkerScript } from "@/lib/service-worker";
import { BUILD_ID } from "@/lib/version";

export const dynamic = "force-static";

export function GET() {
  return new Response(getServiceWorkerScript(BUILD_ID), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
