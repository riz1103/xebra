"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Link2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Exam } from "@/types";

/** Public exams can be taken by any signed-in user who opens /exams/:id, no invitation needed. */
export function ShareExamCard({ exam }: { exam: Pick<Exam, "id" | "isPublic" | "status"> }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  const link = `${origin}/exams/${exam.id}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Exam link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy; select the link and copy it manually.");
    }
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {exam.isPublic ? <Link2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />} Share
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {exam.isPublic ? (
          <>
            <div className="flex gap-2">
              <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={copy} disabled={!origin}>
                {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this link can sign in (or create an account) and take the exam without an invitation.
              People can retake it until they pass; send invitations if you need a fixed attempt limit or a scheduled time window.
            </p>
            {exam.status !== "active" && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {exam.status === "draft"
                  ? "This exam is still a draft. Publish it before sharing, or people will see that it isn't open yet."
                  : "This exam isn't active, so people with the link can't start it. Reactivate it to accept new attempts."}
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">
            Only invited examinees can take this exam. To share a link with anyone,{" "}
            <Link href={`/dashboard/exams/${exam.id}/edit`} className="text-primary underline-offset-4 hover:underline">
              turn on &quot;Public Exam&quot;
            </Link>{" "}
            in the exam settings, or{" "}
            <Link href="/dashboard/invitations" className="text-primary underline-offset-4 hover:underline">
              send invitations
            </Link>
            .
          </p>
        )}
      </CardContent>
    </Card>
  );
}
