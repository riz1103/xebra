"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { examAppUrl, OpenInAppButton } from "@/components/exams/open-in-app";

export function RetakeExamButton({
  examId,
  examTitle,
  invitationId,
  className,
}: {
  examId: string;
  examTitle?: string;
  invitationId?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const title = examTitle || "this exam";

  const start = async () => {
    setPending(true);
    try {
      const res = await api.createExamSession(invitationId ? { invitationId } : { examId });
      const sessionId = res.data?.id;
      if (!sessionId) throw new Error("Couldn't start the retake");
      router.push(`/exam/${sessionId}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't start the retake"));
      setPending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        className={className}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <RotateCcw className="mr-2 h-4 w-4" /> Retake
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Where do you want to take this?</DialogTitle>
            <DialogDescription>
              Retake {title} in the Xevra app, or continue in this browser. The timer starts when the exam starts. If the app does not open, continue in the browser.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button onClick={start} disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Continue in the browser
            </Button>
            <OpenInAppButton href={examAppUrl({ examId, invitationId: invitationId || undefined })} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
