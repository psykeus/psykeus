"use client";

import { Loader2 } from "lucide-react";
import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

// =============================================================================
// Spinner
// =============================================================================

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const spinnerSizes = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin text-muted-foreground", spinnerSizes[size], className)}
    />
  );
}

// =============================================================================
// Loading Overlay
// =============================================================================

interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export function LoadingOverlay({ message, className }: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-50",
        className
      )}
    >
      <Spinner size="lg" />
      {message && (
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}

// =============================================================================
// Inline Loading
// =============================================================================

interface InlineLoadingProps {
  message?: string;
  className?: string;
}

export function InlineLoading({ message = "Loading...", className }: InlineLoadingProps) {
  return (
    <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
      <Spinner size="sm" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

// =============================================================================
// Page Loading
// =============================================================================

interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message = "Loading..." }: PageLoadingProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center">
      <Spinner size="lg" />
      <p className="mt-4 text-muted-foreground">{message}</p>
    </div>
  );
}

// =============================================================================
// Card Skeleton
// =============================================================================

interface CardSkeletonProps {
  className?: string;
}

export function CardSkeleton({ className }: CardSkeletonProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 space-y-3", className)}>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-20" />
    </div>
  );
}

// =============================================================================
// Design Card Skeleton
// =============================================================================

export function DesignCardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-square rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

// =============================================================================
// Design Grid Skeleton
// =============================================================================

interface DesignGridSkeletonProps {
  count?: number;
  className?: string;
}

export function DesignGridSkeleton({ count = 8, className }: DesignGridSkeletonProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <DesignCardSkeleton key={i} />
      ))}
    </div>
  );
}

// =============================================================================
// Table Row Skeleton
// =============================================================================

interface TableRowSkeletonProps {
  columns?: number;
}

export function TableRowSkeleton({ columns = 5 }: TableRowSkeletonProps) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

// =============================================================================
// Table Skeleton
// =============================================================================

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, columns = 5, className }: TableSkeletonProps) {
  return (
    <div className={cn("rounded-lg border", className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// List Skeleton
// =============================================================================

interface ListSkeletonProps {
  items?: number;
  className?: string;
}

export function ListSkeleton({ items = 5, className }: ListSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Stats Card Skeleton
// =============================================================================

export function StatsCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

// =============================================================================
// Stats Grid Skeleton
// =============================================================================

interface StatsGridSkeletonProps {
  count?: number;
  className?: string;
}

export function StatsGridSkeleton({ count = 4, className }: StatsGridSkeletonProps) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <StatsCardSkeleton key={i} />
      ))}
    </div>
  );
}

// =============================================================================
// Form Skeleton
// =============================================================================

interface FormSkeletonProps {
  fields?: number;
  className?: string;
}

export function FormSkeleton({ fields = 4, className }: FormSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-24" />
    </div>
  );
}
