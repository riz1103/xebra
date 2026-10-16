"use client";

import { useCallback, useEffect, useState } from "react";

export interface ExamDisplayPrefs {
  /** Root font size in percent; every rem-based size scales with it */
  textScale: number;
  highContrast: boolean;
}

export const TEXT_SCALES = [
  { value: 100, label: "Default" },
  { value: 115, label: "Large" },
  { value: 130, label: "Larger" },
  { value: 150, label: "Largest" },
];

const STORAGE_KEY = "xebra:exam-display";
const DEFAULT_PREFS: ExamDisplayPrefs = { textScale: 100, highContrast: false };

function readPrefs(): ExamDisplayPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ExamDisplayPrefs>;
    return {
      textScale: TEXT_SCALES.some((s) => s.value === parsed.textScale) ? parsed.textScale! : 100,
      highContrast: parsed.highContrast === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Text size and contrast for the exam screen, remembered on this device and removed when the screen unmounts. */
export function useExamDisplayPrefs() {
  const [prefs, setPrefsState] = useState<ExamDisplayPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefsState(readPrefs());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = prefs.textScale === 100 ? "" : `${prefs.textScale}%`;
    root.classList.toggle("high-contrast", prefs.highContrast);
    return () => {
      root.style.fontSize = "";
      root.classList.remove("high-contrast");
    };
  }, [prefs]);

  const setPrefs = useCallback((update: Partial<ExamDisplayPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...update };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Private mode or full storage: the setting still applies for this visit
      }
      return next;
    });
  }, []);

  return { prefs, setPrefs };
}
