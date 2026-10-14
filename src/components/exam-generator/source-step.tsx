"use client";

import { useRef, useState } from "react";
import { Camera, FileText, ImageIcon, Loader2, Presentation, Trash2, Type, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SOURCE_ACCEPT, type ExtractedSource, type SourceKind } from "@/lib/source-extract";

const DESCRIPTION_EXAMPLES = [
  "Grade 6 English exam about phrases and clauses",
  "Grade 9 Science quiz on the periodic table, 20 items",
  "College Accounting long test on adjusting entries with 2 essay questions",
];

const KIND_ICONS: Record<SourceKind, typeof FileText> = {
  image: ImageIcon,
  pdf: FileText,
  pptx: Presentation,
  docx: FileText,
  text: Type,
};

function describeSource(source: ExtractedSource): string {
  const unit = source.kind === "pptx" ? "slide" : source.kind === "image" ? "photo" : "page";
  const count = source.pages.length;
  const toRead = source.pages.filter((p) => p.images?.length).length;
  const base = `${count} ${unit}${count === 1 ? "" : "s"}`;
  if (toRead === 0) return base;
  return source.kind === "image" ? `${base} · AI will read it` : `${base} · ${toRead} to be read by AI`;
}

export function SourceStep({
  description,
  onDescriptionChange,
  sources,
  extracting,
  onAddFiles,
  onAddText,
  onRemove,
}: {
  description: string;
  onDescriptionChange: (description: string) => void;
  sources: ExtractedSource[];
  extracting: boolean;
  onAddFiles: (files: File[]) => void;
  onAddText: (text: string) => void;
  onRemove: (id: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onAddFiles(files);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="exam-description">Describe the exam</Label>
        <Textarea
          id="exam-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="e.g. Grade 6 English exam about phrases and clauses, 30 items"
          rows={3}
          maxLength={2000}
        />
        <p className="text-xs text-muted-foreground">
          {sources.length > 0
            ? "The AI writes questions from your material and uses this description to pick the level, focus, and size."
            : "Mention the grade or level, subject, and topics. Add material below to base the questions on your own lessons, or leave it empty to generate from the topics alone."}
        </p>
        {!description.trim() && (
          <div className="flex flex-wrap gap-1.5">
            {DESCRIPTION_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => onDescriptionChange(example)}
                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        Material (optional)
        <span className="h-px flex-1 bg-border" />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length > 0) onAddFiles(files);
        }}
        className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Drop lecture material here</p>
        <p className="text-xs text-muted-foreground">
          Photos of book pages or whiteboards, PDFs (including scanned), PowerPoint (.pptx), Word (.docx), or text files
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()} disabled={extracting}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Choose files
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => cameraInputRef.current?.click()} disabled={extracting}>
            <Camera className="mr-1.5 h-3.5 w-3.5" /> Take photo
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowPaste((v) => !v)} disabled={extracting}>
            <Type className="mr-1.5 h-3.5 w-3.5" /> Paste text
          </Button>
        </div>
        <input ref={fileInputRef} type="file" multiple accept={SOURCE_ACCEPT} onChange={handleInput} className="hidden" />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handleInput}
          className="hidden"
        />
      </div>

      {showPaste && (
        <div className="space-y-2">
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste lecture notes, a book excerpt, or a transcript…"
            rows={6}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={!pasteText.trim()}
              onClick={() => {
                onAddText(pasteText);
                setPasteText("");
                setShowPaste(false);
              }}
            >
              Add text
            </Button>
          </div>
        </div>
      )}

      {(sources.length > 0 || extracting) && (
        <ul className="space-y-2">
          {sources.map((source) => {
            const Icon = KIND_ICONS[source.kind];
            const thumbnail = source.kind === "image" ? source.pages[0]?.images?.[0] : undefined;
            return (
              <li key={source.id} className="flex items-start gap-3 rounded-lg border p-3">
                {thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:${thumbnail.mimeType};base64,${thumbnail.data}`}
                    alt={source.name}
                    className="h-12 w-12 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{source.name}</p>
                  <p className="text-xs text-muted-foreground">{describeSource(source)}</p>
                  {source.warnings.map((w) => (
                    <p key={w} className="mt-1 text-xs text-amber-600 dark:text-amber-400">{w}</p>
                  ))}
                </div>
                <Badge variant="secondary" className="shrink-0 uppercase">{source.kind}</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => onRemove(source.id)}
                  aria-label={`Remove ${source.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </li>
            );
          })}
          {extracting && (
            <li className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading files…
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
