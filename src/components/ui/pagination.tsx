"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PaginationMeta } from "@/types";

export const DEFAULT_PAGE_SIZE = 10;

export interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  className?: string;
  /** Show compact "Prev / Next" only when true */
  compact?: boolean;
}

export function Pagination({ pagination, onPageChange, className, compact }: PaginationProps) {
  const page = Number(pagination.page) || 1;
  const size = Number(pagination.size) || DEFAULT_PAGE_SIZE;
  const total = Number(pagination.total) || 0;
  const totalPages = Math.max(1, Number(pagination.totalPages) || 1);
  const hasPrev = pagination.hasPrev ?? page > 1;
  const hasNext = pagination.hasNext ?? page < totalPages;
  const start = total === 0 ? 0 : (page - 1) * size + 1;
  const end = Math.min(page * size, total);

  if (totalPages <= 1 && total <= size) return null;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:gap-4",
        className
      )}
    >
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium">{start}</span>–<span className="font-medium">{end}</span> of{" "}
        <span className="font-medium">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 sm:h-8"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          {!compact && <span className="ml-1">Previous</span>}
        </Button>
        {!compact && totalPages > 1 && (
          <span className="px-2 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-9 sm:h-8"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          aria-label="Next page"
        >
          {!compact && <span className="mr-1">Next</span>}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
