"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Edit,
  ChevronDown,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  CheckSquare,
  FolderInput,
  ListChecks,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { AdminDesignListItem } from "@/lib/types";

// Using AdminDesignListItem from @/lib/types

interface ImportJob {
  id: string;
  source_path: string | null;
  files_succeeded: number;
  completed_at: string;
}

interface Props {
  designs: AdminDesignListItem[];
  totalCount?: number;
  filteredCount?: number;
  currentFilters?: {
    q?: string;
    status?: string;
  };
  recentImports?: ImportJob[];
}

export function DesignsTable({
  designs,
  totalCount = 0,
  filteredCount,
  currentFilters = {},
  recentImports = [],
}: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [selectLoading, setSelectLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showImportsDialog, setShowImportsDialog] = useState(false);

  const allPageSelected = designs.length > 0 && designs.every((d) => selectedIds.has(d.id));
  const somePageSelected = designs.some((d) => selectedIds.has(d.id)) && !allPageSelected;
  const hasFilters = Boolean(currentFilters.q || currentFilters.status);
  const displayedFilteredCount = filteredCount ?? totalCount;

  // Toggle all designs on current page
  const toggleAllOnPage = () => {
    if (allPageSelected) {
      // Deselect all on this page
      const newSet = new Set(selectedIds);
      designs.forEach((d) => newSet.delete(d.id));
      setSelectedIds(newSet);
    } else {
      // Select all on this page
      const newSet = new Set(selectedIds);
      designs.forEach((d) => newSet.add(d.id));
      setSelectedIds(newSet);
    }
  };

  const toggleOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Select all designs (optionally with filters)
  const selectAllDesigns = async (filters?: { q?: string; status?: string; import_job_id?: string }) => {
    setSelectLoading(true);
    setMessage(null);

    try {
      const params = new URLSearchParams();
      if (filters?.q) params.set("q", filters.q);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.import_job_id) params.set("import_job_id", filters.import_job_id);

      const response = await fetch(`/api/admin/designs/ids?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch design IDs");
      }

      const data = await response.json();
      setSelectedIds(new Set(data.ids));
      setShowImportsDialog(false);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to select designs",
      });
    } finally {
      setSelectLoading(false);
    }
  };

  // Select all designs globally (no filters)
  const selectAllGlobal = () => selectAllDesigns({});

  // Select all matching current filters
  const selectAllFiltered = () => selectAllDesigns(currentFilters);

  // Select all from a specific import
  const selectFromImport = (importJobId: string) => selectAllDesigns({ import_job_id: importJobId });

  const performBulkAction = async (action: "publish" | "unpublish" | "delete") => {
    if (selectedIds.size === 0) return;

    if (action === "delete") {
      const confirmed = confirm(
        `Are you sure you want to permanently delete ${selectedIds.size} design(s)? This cannot be undone.`
      );
      if (!confirmed) return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/designs/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designIds: Array.from(selectedIds),
          action,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to perform action");
      }

      setMessage({ type: "success", text: data.message });
      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Selection Tools & Bulk Actions Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Selection Dropdown */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={selectLoading}>
                {selectLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ListChecks className="h-4 w-4 mr-2" />
                )}
                Select
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem onClick={toggleAllOnPage}>
                <CheckSquare className="h-4 w-4 mr-2" />
                {allPageSelected ? "Deselect" : "Select"} all on page ({designs.length})
              </DropdownMenuItem>

              {hasFilters && displayedFilteredCount > designs.length && (
                <DropdownMenuItem onClick={selectAllFiltered}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Select all matching filter ({displayedFilteredCount.toLocaleString()})
                </DropdownMenuItem>
              )}

              {totalCount > 0 && (
                <DropdownMenuItem onClick={selectAllGlobal}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Select all designs ({totalCount.toLocaleString()})
                </DropdownMenuItem>
              )}

              {recentImports.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowImportsDialog(true)}>
                    <FolderInput className="h-4 w-4 mr-2" />
                    Select from import...
                  </DropdownMenuItem>
                </>
              )}

              {selectedIds.size > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSelectedIds(new Set())}>
                    Clear selection ({selectedIds.size})
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {selectedIds.size > 0 && (
            <span className="text-sm text-muted-foreground">
              {selectedIds.size.toLocaleString()} selected
            </span>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => performBulkAction("publish")}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => performBulkAction("unpublish")}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
              Unpublish
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => performBulkAction("delete")}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`p-3 rounded-md text-sm ${
            message.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="p-4 w-12">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={toggleAllOnPage}
                    aria-label="Select all on page"
                    className={somePageSelected ? "data-[state=checked]:bg-primary/50" : ""}
                  />
                </th>
                <th className="text-left p-4 font-medium">Design</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium hidden sm:table-cell">Difficulty</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Updated</th>
                <th className="text-left p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {designs.map((design) => (
                <tr
                  key={design.id}
                  className={`hover:bg-muted/30 transition-colors ${
                    selectedIds.has(design.id) ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="p-4">
                    <Checkbox
                      checked={selectedIds.has(design.id)}
                      onCheckedChange={() => toggleOne(design.id)}
                      aria-label={`Select ${design.title}`}
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-12 h-12 bg-muted rounded-md overflow-hidden flex-shrink-0">
                        <Image
                          src={design.preview_path}
                          alt={design.title}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{design.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{design.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant={design.is_public ? "default" : "secondary"}>
                      {design.is_public ? "Public" : "Hidden"}
                    </Badge>
                  </td>
                  <td className="p-4 capitalize hidden sm:table-cell">
                    {design.difficulty || "-"}
                  </td>
                  <td className="p-4 text-muted-foreground hidden md:table-cell">
                    {formatDate(design.updated_at)}
                  </td>
                  <td className="p-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Actions
                          <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/designs/${design.id}`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/designs/${design.slug}`} target="_blank">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {designs.length === 0 && (
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No designs found.</p>
          </CardContent>
        )}
      </Card>

      {/* Import Selection Dialog */}
      <Dialog open={showImportsDialog} onOpenChange={setShowImportsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderInput className="h-5 w-5" />
              Select from Import
            </DialogTitle>
            <DialogDescription>
              Select all designs from a specific import job
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {recentImports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No completed imports found
              </p>
            ) : (
              recentImports.map((importJob) => (
                <button
                  key={importJob.id}
                  onClick={() => selectFromImport(importJob.id)}
                  disabled={selectLoading}
                  className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-sm">
                        {importJob.source_path
                          ? importJob.source_path.split("/").pop() || importJob.source_path
                          : "Upload"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {importJob.source_path || "File upload"}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <Badge variant="secondary">{importJob.files_succeeded} files</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(importJob.completed_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
