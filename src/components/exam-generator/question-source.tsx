"use client";

import { useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AiQuestionMetadata } from "@/types";

/** "Source: …" line for an AI-generated question; opens the cited material when it was saved. */
export function QuestionSource({
  source,
  className = "",
}: {
  source: Pick<AiQuestionMetadata, "sourceRef" | "sourceExcerpt" | "sourceUrl">;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { sourceRef, sourceExcerpt, sourceUrl } = source;
  if (!sourceRef) return null;
  const viewable = !!(sourceExcerpt || sourceUrl);

  return (
    <>
      <p className={`text-[11px] text-muted-foreground ${className}`}>
        Source:{" "}
        {viewable ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
          >
            <FileText className="h-3 w-3" /> {sourceRef}
          </button>
        ) : (
          sourceRef
        )}
      </p>
      {viewable && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Source material
              </DialogTitle>
              <DialogDescription className="break-all">{sourceRef}</DialogDescription>
            </DialogHeader>
            {sourceExcerpt ? (
              <div className="min-h-0 flex-1 space-y-1.5">
                <p className="text-xs text-muted-foreground">Text the AI read from this page:</p>
                <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">
                  {sourceExcerpt}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No text was saved for this page. Open the original file instead.</p>
            )}
            {sourceUrl && (
              <DialogFooter>
                <Button variant="outline" asChild>
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 h-4 w-4" /> Open original file
                  </a>
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
