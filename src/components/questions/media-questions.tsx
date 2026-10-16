"use client";

import { useRef, useState } from "react";
import { Loader2, Trash2, Upload, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { api, apiErrorMessage } from "@/lib/api";
import type { HotspotRegion, QuestionMetadata } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const newRegionId = () => `r_${Math.random().toString(36).slice(2, 9)}`;

/** Upload an audio clip for a listening question. */
export function AudioQuestionEditor({
  metadata = {},
  onChange,
}: {
  metadata?: QuestionMetadata;
  onChange: (metadata: QuestionMetadata) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadQuestionMedia(file, "audio");
      onChange({
        ...metadata,
        audioUrl: res.data?.url,
        audioStoragePath: res.data?.path,
      });
      toast.success("Audio uploaded");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not upload audio"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Volume2 className="h-4 w-4" /> Listening clip
      </div>
      {metadata.audioUrl ? (
        <div className="space-y-2">
          <audio controls src={metadata.audioUrl} className="w-full" preload="metadata" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => {
              const path = metadata.audioStoragePath;
              onChange({ ...metadata, audioUrl: undefined, audioStoragePath: undefined });
              if (path) api.deleteQuestionMedia(path).catch(() => {});
            }}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove audio
          </Button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm,audio/mp4,audio/m4a,.mp3,.wav,.ogg,.m4a,.webm"
            className="hidden"
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload audio
          </Button>
          <p className="text-xs text-muted-foreground">MP3, WAV, OGG, M4A or WebM · max 15MB</p>
        </>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="max-plays">Play limit (0 = unlimited)</Label>
        <Input
          id="max-plays"
          type="number"
          min={0}
          max={20}
          value={metadata.maxPlays ?? 0}
          onChange={(e) => onChange({ ...metadata, maxPlays: Math.max(0, Number(e.target.value) || 0) })}
          className="w-28"
        />
      </div>
    </div>
  );
}

/** Player shown to examinees; optionally caps how many times they can play. */
export function AudioPlayer({
  url,
  maxPlays = 0,
}: {
  url: string;
  maxPlays?: number;
}) {
  const [plays, setPlays] = useState(0);
  const limited = maxPlays > 0;
  const remaining = limited ? Math.max(0, maxPlays - plays) : null;
  const blocked = limited && remaining === 0;

  return (
    <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
      <audio
        controls
        controlsList="nodownload"
        src={url}
        className="w-full"
        preload="metadata"
        onPlay={(e) => {
          if (blocked) {
            e.currentTarget.pause();
            return;
          }
          setPlays((n) => n + 1);
        }}
      />
      {limited && (
        <p className="text-xs text-muted-foreground">
          {blocked ? "No plays left." : `${remaining} play${remaining === 1 ? "" : "s"} left`}
        </p>
      )}
    </div>
  );
}

/** Authoring: upload an image and click to place answer regions. */
export function HotspotQuestionEditor({
  metadata = {},
  correctAnswer,
  onChange,
}: {
  metadata?: QuestionMetadata;
  correctAnswer: string | string[];
  onChange: (next: { metadata: QuestionMetadata; correctAnswer: string[] }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const regions = metadata.hotspotRegions ?? [];
  const correctIds = new Set(Array.isArray(correctAnswer) ? correctAnswer : correctAnswer ? [correctAnswer] : []);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadQuestionMedia(file, "image");
      onChange({
        metadata: {
          ...metadata,
          answerFormat: "hotspot",
          hotspotImageUrl: res.data?.url,
          hotspotImageStoragePath: res.data?.path,
          hotspotRegions: [],
        },
        correctAnswer: [],
      });
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not upload image"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const placeRegion = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!metadata.hotspotImageUrl) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const region: HotspotRegion = { id: newRegionId(), x, y, radius: 8 };
    onChange({
      metadata: { ...metadata, answerFormat: "hotspot", hotspotRegions: [...regions, region] },
      correctAnswer: [...correctIds, region.id],
    });
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Hotspot image</p>
      {!metadata.hotspotImageUrl ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload image
          </Button>
          <p className="text-xs text-muted-foreground">Click the image to mark correct spots. Max 15MB.</p>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Click the image to add a correct region. Drag is not needed — each click adds a circle.</p>
          <div
            className="relative w-full max-w-xl cursor-crosshair overflow-hidden rounded-md border"
            onClick={placeRegion}
            role="presentation"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={metadata.hotspotImageUrl} alt="Hotspot" className="block w-full select-none" draggable={false} />
            {regions.map((r) => (
              <button
                key={r.id}
                type="button"
                title="Remove region"
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
                  correctIds.has(r.id) ? "border-emerald-500 bg-emerald-500/30" : "border-amber-500 bg-amber-500/20"
                )}
                style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.radius * 2}%`, height: "auto", aspectRatio: "1" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange({
                    metadata: {
                      ...metadata,
                      hotspotRegions: regions.filter((x) => x.id !== r.id),
                    },
                    correctAnswer: [...correctIds].filter((id) => id !== r.id),
                  });
                }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => {
                const path = metadata.hotspotImageStoragePath;
                onChange({
                  metadata: {
                    ...metadata,
                    answerFormat: "hotspot",
                    hotspotImageUrl: undefined,
                    hotspotImageStoragePath: undefined,
                    hotspotRegions: [],
                  },
                  correctAnswer: [],
                });
                if (path) api.deleteQuestionMedia(path).catch(() => {});
              }}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove image
            </Button>
            {regions.length > 0 && (
              <p className="self-center text-xs text-muted-foreground">
                {regions.length} region{regions.length === 1 ? "" : "s"} · click a circle to remove it
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Examinee clicks once on the image; answer stored as ["x,y"] percentages. */
export function HotspotInput({
  imageUrl,
  value,
  onChange,
  disabled,
  showRegions,
  regions,
  correctIds,
}: {
  imageUrl: string;
  value: string | null;
  onChange?: (value: string | null) => void;
  disabled?: boolean;
  showRegions?: boolean;
  regions?: HotspotRegion[];
  correctIds?: string[];
}) {
  const click = value
    ? (() => {
        const [x, y] = value.split(",").map(Number);
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
      })()
    : null;
  const correct = new Set(correctIds ?? []);

  return (
    <div
      className={cn("relative w-full max-w-xl overflow-hidden rounded-md border", !disabled && "cursor-crosshair")}
      onClick={(e) => {
        if (disabled || !onChange) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        onChange(`${x.toFixed(2)},${y.toFixed(2)}`);
      }}
      role="presentation"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="Click the correct spot" className="block w-full select-none" draggable={false} />
      {showRegions &&
        (regions ?? []).map((r) => (
          <span
            key={r.id}
            className={cn(
              "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
              correct.has(r.id) ? "border-emerald-500 bg-emerald-500/25" : "border-muted-foreground/40 bg-muted/20"
            )}
            style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.radius * 2}%`, aspectRatio: "1" }}
          />
        ))}
      {click && (
        <span
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary/40"
          style={{ left: `${click.x}%`, top: `${click.y}%` }}
        />
      )}
    </div>
  );
}
