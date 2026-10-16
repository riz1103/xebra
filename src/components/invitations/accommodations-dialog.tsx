"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TimeMultiplierSelect } from "@/components/invitations/time-multiplier-select";
import type { ExamInvitation } from "@/types";

interface AccommodationsDialogProps {
  invitation: ExamInvitation | null;
  onOpenChange: (open: boolean) => void;
}

/** Set extra time and a note on one invitation; applies to sessions started afterwards. */
export function AccommodationsDialog({ invitation, onOpenChange }: AccommodationsDialogProps) {
  const queryClient = useQueryClient();
  const [multiplier, setMultiplier] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!invitation) return;
    setMultiplier(invitation.accommodations?.timeMultiplier ?? 1);
    setNote(invitation.accommodations?.note ?? "");
  }, [invitation]);

  const save = useMutation({
    mutationFn: () =>
      api.updateExamInvitation(invitation!.id, {
        accommodations: multiplier === 1 && !note.trim() ? null : { timeMultiplier: multiplier, note: note.trim() || null },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      toast.success("Accommodations saved");
      onOpenChange(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't save accommodations")),
  });

  return (
    <Dialog open={invitation != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Accommodations</DialogTitle>
          <DialogDescription>
            For {invitation?.examineeEmail || "this examinee"}. Changes apply to exam sessions started after saving.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Extra time</Label>
            <TimeMultiplierSelect value={multiplier} onChange={setMultiplier} />
            <p className="text-xs text-muted-foreground">
              Multiplies the exam&apos;s time limit, each part&apos;s limit, and pushes a scheduled end time back.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="accommodation-note">Note (optional)</Label>
            <Textarea
              id="accommodation-note"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Extended time per learning support plan"
            />
            <p className="text-xs text-muted-foreground">The examinee can see this note.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
