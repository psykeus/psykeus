"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// =============================================================================
// Shared utility for page number calculation
// =============================================================================

function getPageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
  const pages: (number | "...")[] = [];
  const delta = 2;

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - delta && i <= currentPage + delta)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return pages;
}

// =============================================================================
// URL-based Pagination (for server components / pages with URL state)
// =============================================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const searchParams = useSearchParams();

  const createPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    return `?${params.toString()}`;
  };

  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-1">
      <Button
        variant="outline"
        size="sm"
        asChild
        disabled={currentPage <= 1}
        className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
      >
        <Link href={createPageUrl(currentPage - 1)}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Link>
      </Button>

      <div className="flex items-center gap-1 mx-2">
        {getPageNumbers(currentPage, totalPages).map((page, index) =>
          page === "..." ? (
            <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
              ...
            </span>
          ) : (
            <Button
              key={page}
              variant={page === currentPage ? "default" : "ghost"}
              size="sm"
              asChild
              className="w-9"
            >
              <Link href={createPageUrl(page)}>{page}</Link>
            </Button>
          )
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        asChild
        disabled={currentPage >= totalPages}
        className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
      >
        <Link href={createPageUrl(currentPage + 1)}>
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Link>
      </Button>
    </nav>
  );
}

// =============================================================================
// Callback-based Pagination (for client components with state)
// =============================================================================

interface ClientPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showSummary?: {
    from: number;
    to: number;
    total: number;
    itemName?: string;
  };
}

export function ClientPagination({
  currentPage,
  totalPages,
  onPageChange,
  showSummary,
}: ClientPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      {showSummary && (
        <p className="text-sm text-muted-foreground">
          Showing {showSummary.from} to {showSummary.to} of {showSummary.total}{" "}
          {showSummary.itemName || "items"}
        </p>
      )}

      <nav className={`flex items-center gap-1 ${showSummary ? "" : "mx-auto"}`}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        <div className="flex items-center gap-1 mx-2">
          {getPageNumbers(currentPage, totalPages).map((page, index) =>
            page === "..." ? (
              <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                ...
              </span>
            ) : (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "ghost"}
                size="sm"
                onClick={() => onPageChange(page)}
                className="w-9"
              >
                {page}
              </Button>
            )
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </nav>
    </div>
  );
}
