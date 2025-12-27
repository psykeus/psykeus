import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { DesignsTable } from "@/components/admin/DesignsTable";
import { Pagination } from "@/components/Pagination";

interface SearchParams {
  q?: string;
  page?: string;
  status?: string;
  perPage?: string;
  sort?: string;
  order?: "asc" | "desc";
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

  // Sorting parameters
  const validSortFields = ["title", "updated_at", "created_at", "difficulty", "is_public", "primary_file_type"];
  const sortField = validSortFields.includes(params.sort ?? "") ? params.sort! : "updated_at";
  const sortOrder = params.order === "asc" ? "asc" : "desc";

  // Query designs with primary file type via join
  let query = supabase
    .from("designs")
    .select(`
      id, title, slug, preview_path, is_public, difficulty, updated_at, created_at,
      primary_file:design_files!designs_primary_file_id_fkey(file_type)
    `, { count: "exact" });

  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }

  if (status === "public") {
    query = query.eq("is_public", true);
  } else if (status === "hidden") {
    query = query.eq("is_public", false);
  }

  // Apply sorting - handle file_type specially since it's from a join
  if (sortField === "primary_file_type") {
    // For file type, we need to sort after fetching since it's a joined field
    query = query.order("updated_at", { ascending: sortOrder === "asc" });
  } else {
    query = query.order(sortField, { ascending: sortOrder === "asc" });
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: rawDesigns, count } = await query.range(from, to);

  // Transform the data to flatten the primary_file join
  // The join returns an object (not array) when using !inner or foreign key reference
  const designs = (rawDesigns ?? []).map((d) => {
    const primaryFile = d.primary_file as { file_type: string } | { file_type: string }[] | null;
    const fileType = Array.isArray(primaryFile)
      ? primaryFile[0]?.file_type
      : primaryFile?.file_type;
    return {
      ...d,
      primary_file_type: fileType || null,
      primary_file: undefined, // Remove the nested object
    };
  });

  // If sorting by file type, sort the results
  if (sortField === "primary_file_type") {
    designs.sort((a, b) => {
      const aType = a.primary_file_type || "";
      const bType = b.primary_file_type || "";
      return sortOrder === "asc"
        ? aType.localeCompare(bType)
        : bType.localeCompare(aType);
    });
  }

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
        currentSort={{ field: sortField, order: sortOrder }}
        baseUrl={`/admin/designs?${q ? `q=${q}&` : ""}${status ? `status=${status}&` : ""}perPage=${pageSize}`}
      />

      {/* Pagination */}
      <Pagination currentPage={page} totalPages={totalPages} />
    </div>
  );
}
