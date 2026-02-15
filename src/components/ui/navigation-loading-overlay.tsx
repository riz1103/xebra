"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationLoadingOverlayProps {
  isLoading: boolean;
}

export function NavigationLoadingOverlay({ isLoading }: NavigationLoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-background/80 backdrop-blur-sm",
        "transition-opacity duration-200",
        isLoading ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      aria-label="Loading"
      role="status"
    >
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
