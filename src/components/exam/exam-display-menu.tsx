"use client";

import { useEffect, useState } from "react";
import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TEXT_SCALES, type ExamDisplayPrefs } from "@/lib/exam-display";

export const EXAM_SHORTCUTS = [
  { keys: "N / →", action: "Next question" },
  { keys: "P / ←", action: "Previous question" },
  { keys: "1–9", action: "Choose option 1–9" },
  { keys: "F", action: "Flag or unflag" },
];

interface ExamDisplayMenuProps {
  prefs: ExamDisplayPrefs;
  onChange: (update: Partial<ExamDisplayPrefs>) => void;
}

/** Text size, high contrast, full screen, and the keyboard shortcut list for the exam screen. */
export function ExamDisplayMenu({ prefs, onChange }: ExamDisplayMenuProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);

  useEffect(() => {
    setCanFullscreen(typeof document.documentElement.requestFullscreen === "function");
    const sync = () => setIsFullscreen(!!document.fullscreenElement);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFullscreen = () => {
    const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    request.catch(() => {
      // Some browsers refuse (e.g. iOS Safari); the menu item simply does nothing
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Display and accessibility options">
          <Type className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Text size</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={String(prefs.textScale)} onValueChange={(v) => onChange({ textScale: Number(v) })}>
          {TEXT_SCALES.map((s) => (
            <DropdownMenuRadioItem key={s.value} value={String(s.value)} onSelect={(e) => e.preventDefault()}>
              {s.label} ({s.value}%)
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={prefs.highContrast}
          onCheckedChange={(checked) => onChange({ highContrast: checked === true })}
          onSelect={(e) => e.preventDefault()}
        >
          High contrast
        </DropdownMenuCheckboxItem>
        {canFullscreen && (
          <DropdownMenuCheckboxItem checked={isFullscreen} onCheckedChange={toggleFullscreen}>
            Full screen
          </DropdownMenuCheckboxItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Keyboard shortcuts</DropdownMenuLabel>
        <dl className="space-y-1 px-2 pb-2 text-xs">
          {EXAM_SHORTCUTS.map((s) => (
            <div key={s.action} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{s.action}</dt>
              <dd>
                <kbd className="rounded border px-1 font-mono">{s.keys}</kbd>
              </dd>
            </div>
          ))}
          <p className="pt-1 text-muted-foreground">Shortcuts pause while you type in an answer box.</p>
        </dl>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
