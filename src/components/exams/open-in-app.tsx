"use client";

import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Custom-scheme link the Android app already handles. https links stay in the browser so the person can choose. */
export function examAppUrl(target: { examId: string; invitationId?: string } | { sessionId: string }): string {
  if ("sessionId" in target) return `xevra://sessions/${encodeURIComponent(target.sessionId)}`;
  const invitation = target.invitationId ? `?invitation=${encodeURIComponent(target.invitationId)}` : "";
  return `xevra://exams/${encodeURIComponent(target.examId)}${invitation}`;
}

export function OpenInAppButton({ href, className }: { href: string; className?: string }) {
  return (
    <Button variant="outline" className={className} asChild>
      <a href={href}>
        <Smartphone />
        Open in the app
      </a>
    </Button>
  );
}
