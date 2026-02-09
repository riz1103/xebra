import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Handles ISO strings, Date objects, and Firestore Timestamps ({_seconds, _nanoseconds})
export function formatDate(date: string | Date | { _seconds: number; _nanoseconds?: number } | undefined | null) {
  if (!date) return "N/A";
  try {
    let d: Date;
    if (typeof date === "object" && "_seconds" in date) {
      // Firestore Timestamp format
      d = new Date(date._seconds * 1000);
    } else {
      d = new Date(date as string | Date);
    }
    if (isNaN(d.getTime())) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return "N/A";
  }
}

export function formatDuration(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(str: string, length: number) {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}
