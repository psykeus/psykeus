import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { DesignsTable } from "@/components/admin/DesignsTable";

interface SearchParams {
  q?: string;
  page?: string;
  status?: string;
  perPage?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function AdminDesignsPage({ searchParams }: Props) {
  await requireAdmin();

  const params = await searchParams;
  const supabase = createServiceClient();

  const page = Number(params.page ?? "1");
  const perPageParam = Number(params.perPage ?? "20");
  const pageSize = [20, 50, 100].includes(perPageParam) ? perPageParam : 20;
  const q = params.q ?? "";
  const status = params.status;

  let query = supabase
    .from("designs")
    .select("id, title, slug, preview_path, is_public, difficulty, updated_at", { count: "exact" })
    .order("updated_at", { ascending: false });

  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }

  if (status === "public") {
    query = query.eq("is_public", true);
  } else if (status === "hidden") {
    query = query.eq("is_public", false);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: designs, count } = await query.range(from, to);

  const totalPages = Math.ceil((count ?? 0) / pageSize);

  // Count public and hidden
  const { count: publicCount } = await supabase
    .from("designs")
    .select("*", { count: "exact", head: true })
    .eq("is_public", true);

  const { count: hiddenCount } = await supabase
    .from("designs")
    .select("*", { count: "exact", head: true })
    .eq("is_public", false);

  // Fetch recent import jobs for the selection dropdown
  const { data: recentImports } = await supabase
    .from("import_jobs")
    .select("id, source_path, files_succeeded, completed_at")
    .eq("status", "completed")
    .gt("files_succeeded", 0)
    .order("completed_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Manage Designs</h1>
          <p className="text-muted-foreground mt-1">
            {count ?? 0} total designs ({publicCount ?? 0} public, {hiddenCount ?? 0} hidden)
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/upload">Upload New</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <form className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search designs..."
              className="pl-10"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        <div className="flex gap-2">
          <Button
            asChild
            variant={!status ? "default" : "outline"}
            size="sm"
          >
            <Link href={`/admin/designs${q ? `?q=${q}` : ""}${pageSize !== 20 ? `${q ? "&" : "?"}perPage=${pageSize}` : ""}`}>
              All
            </Link>
          </Button>
          <Button
            asChild
            variant={status === "public" ? "default" : "outline"}
            size="sm"
          >
            <Link href={`/admin/designs?status=public${q ? `&q=${q}` : ""}${pageSize !== 20 ? `&perPage=${pageSize}` : ""}`}>
              Public
            </Link>
          </Button>
          <Button
            asChild
            variant={status === "hidden" ? "default" : "outline"}
            size="sm"
          >
            <Link href={`/admin/designs?status=hidden${q ? `&q=${q}` : ""}${pageSize !== 20 ? `&perPage=${pageSize}` : ""}`}>
              Hidden
            </Link>
          </Button>
        </div>

        {/* Per Page Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Per page:</span>
          <div className="flex gap-1">
            {[20, 50, 100].map((size) => (
              <Button
                key={size}
                asChild
                variant={pageSize === size ? "default" : "outline"}
                size="sm"
              >
                <Link href={`/admin/designs?perPage=${size}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}`}>
                  {size}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Designs Table with Bulk Actions */}
      <DesignsTable
        designs={designs ?? []}
        totalCount={(publicCount ?? 0) + (hiddenCount ?? 0)}
        filteredCount={count ?? 0}
        currentFilters={{ q, status }}
        recentImports={recentImports ?? []}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 flex-wrap">
          {page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/designs?page=${page - 1}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}${pageSize !== 20 ? `&perPage=${pageSize}` : ""}`}>
                Previous
              </Link>
            </Button>
          )}
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            // Show pages around current page for large page counts
            let pageNum: number;
            if (totalPages <= 10) {
              pageNum = i + 1;
            } else if (page <= 5) {
              pageNum = i + 1;
            } else if (page >= totalPages - 4) {
              pageNum = totalPages - 9 + i;
            } else {
              pageNum = page - 4 + i;
            }
            return pageNum;
          }).map((p) => (
            <Button
              key={p}
              asChild
              variant={p === page ? "default" : "outline"}
              size="sm"
            >
              <Link href={`/admin/designs?page=${p}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}${pageSize !== 20 ? `&perPage=${pageSize}` : ""}`}>
                {p}
              </Link>
            </Button>
          ))}
          {totalPages > 10 && page < totalPages - 4 && (
            <span className="text-muted-foreground px-2">
              ... {totalPages}
            </span>
          )}
          {page < totalPages && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/designs?page=${page + 1}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}${pageSize !== 20 ? `&perPage=${pageSize}` : ""}`}>
                Next
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
