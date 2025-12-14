"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[60vh]">
      {/* Illustration */}
      <div className="relative mb-8">
        <svg
          viewBox="0 0 200 200"
          className="w-48 h-48 text-muted-foreground/20"
          fill="currentColor"
        >
          <rect x="20" y="20" width="160" height="160" rx="8" />
          <path
            d="M70 70 L130 130 M130 70 L70 130"
            stroke="currentColor"
            strokeWidth="12"
            fill="none"
            className="text-destructive"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-heading text-5xl font-bold text-destructive">500</span>
        </div>
      </div>

      <h1 className="font-heading text-3xl font-bold mb-4 text-center">
        Something Went Wrong
      </h1>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        Our CNC machine hit a snag. Don&apos;t worry, our team has been notified
        and we&apos;re working to fix it.
      </p>

      <div className="flex flex-wrap gap-4 justify-center">
        <Button onClick={reset}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </Link>
        </Button>
      </div>

      {error.digest && (
        <p className="mt-8 text-xs text-muted-foreground">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
