"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  currentPage: number;
  totalPages: number;
}

export function Pagination({ currentPage, totalPages }: Props) {
  const searchParams = useSearchParams();

  const createPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    return `?${params.toString()}`;
  };

  const getPageNumbers = () => {
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
  };

  return (
    <nav className="flex items-center justify-center gap-1">
      {/* Previous */}
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

      {/* Page numbers */}
      <div className="flex items-center gap-1 mx-2">
        {getPageNumbers().map((page, index) =>
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

      {/* Next */}
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
