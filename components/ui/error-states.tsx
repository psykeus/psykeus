"use client";

import { AlertCircle, RefreshCw, AlertTriangle, XCircle, WifiOff, ServerCrash } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

// =============================================================================
// Error Card
// =============================================================================

interface ErrorCardProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorCard({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  className,
}: ErrorCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-destructive/50 bg-destructive/10 p-6",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <h3 className="font-medium text-destructive">{title}</h3>
          <p className="text-sm text-muted-foreground">{message}</p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-3"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {retryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Inline Error
// =============================================================================

interface InlineErrorProps {
  message: string;
  className?: string;
}

export function InlineError({ message, className }: InlineErrorProps) {
  return (
    <div className={cn("flex items-center gap-2 text-destructive text-sm", className)}>
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// =============================================================================
// Page Error
// =============================================================================

interface PageErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function PageError({
  title = "Something went wrong",
  message = "We encountered an error while loading this page. Please try again.",
  onRetry,
  retryLabel = "Try again",
}: PageErrorProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center px-4">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-muted-foreground max-w-md mb-6">{message}</p>
      {onRetry && (
        <Button onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// Network Error
// =============================================================================

interface NetworkErrorProps {
  onRetry?: () => void;
}

export function NetworkError({ onRetry }: NetworkErrorProps) {
  return (
    <PageError
      title="Connection Error"
      message="Unable to connect to the server. Please check your internet connection and try again."
      onRetry={onRetry}
    />
  );
}

// =============================================================================
// Server Error
// =============================================================================

interface ServerErrorProps {
  onRetry?: () => void;
}

export function ServerError({ onRetry }: ServerErrorProps) {
  return (
    <PageError
      title="Server Error"
      message="The server encountered an error. Our team has been notified. Please try again later."
      onRetry={onRetry}
    />
  );
}

// =============================================================================
// Warning Card
// =============================================================================

interface WarningCardProps {
  title?: string;
  message: string;
  className?: string;
}

export function WarningCard({
  title = "Warning",
  message,
  className,
}: WarningCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-amber-500/50 bg-amber-500/10 p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-medium text-amber-800 dark:text-amber-200">{title}</h3>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{message}</p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Info Card
// =============================================================================

interface InfoCardProps {
  title?: string;
  message: string;
  className?: string;
}

export function InfoCard({
  title,
  message,
  className,
}: InfoCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-blue-500/50 bg-blue-500/10 p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          {title && <h3 className="font-medium text-blue-800 dark:text-blue-200">{title}</h3>}
          <p className={cn("text-sm text-blue-700 dark:text-blue-300", title && "mt-1")}>{message}</p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Fetch Error (for SWR/React Query)
// =============================================================================

interface FetchErrorProps {
  error: Error | unknown;
  onRetry?: () => void;
  className?: string;
}

export function FetchError({ error, onRetry, className }: FetchErrorProps) {
  const message = error instanceof Error ? error.message : "An unexpected error occurred";

  // Check for common error types
  const isNetworkError = message.toLowerCase().includes("network") ||
                         message.toLowerCase().includes("fetch");
  const isServerError = message.includes("500") ||
                        message.includes("502") ||
                        message.includes("503");

  if (isNetworkError) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
        <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-medium mb-2">Connection Error</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Unable to connect. Check your internet connection.
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (isServerError) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
        <ServerCrash className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-medium mb-2">Server Error</h3>
        <p className="text-sm text-muted-foreground mb-4">
          The server is having issues. Please try again later.
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
      <XCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="font-medium mb-2">Error Loading Data</h3>
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      )}
    </div>
  );
}
