"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, LogIn } from "lucide-react";
import { Spinner } from "@/components/ui/loading-states";
import { InlineError } from "@/components/ui/error-states";
import { Button } from "@/components/ui/button";

interface Props {
  designId: string;
  isAuthenticated: boolean;
}

export function DownloadButton({ designId, isAuthenticated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDownload = async () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/designs`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/download/${designId}`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Download failed");
      }

      const data = await response.json();
      window.open(data.url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button
        onClick={handleDownload}
        disabled={loading}
        size="lg"
        className="w-full sm:w-auto min-w-[200px] gap-2"
      >
        {loading ? (
          <>
            <Spinner size="md" />
            Preparing...
          </>
        ) : isAuthenticated ? (
          <>
            <Download className="h-5 w-5" />
            Download
          </>
        ) : (
          <>
            <LogIn className="h-5 w-5" />
            Sign in to Download
          </>
        )}
      </Button>

      {error && <InlineError message={error} className="mt-2" />}
    </div>
  );
}
