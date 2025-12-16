"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Spinner } from "@/components/ui/loading-states";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const difficulties = ["beginner", "intermediate", "advanced", "easy", "medium", "hard"];
const categories = [
  // CNC/Laser
  "coaster",
  "sign",
  "ornament",
  "box",
  "puzzle",
  "art",
  "jewelry",
  "furniture",
  "home-decor",
  "garden",
  // 3D Printing
  "figurine",
  "holder",
  "mount",
  "bracket",
  "clip",
  "container",
  "tool",
  "enclosure",
  "replacement-part",
  "miniature",
];
const styles = [
  "geometric",
  "organic",
  "minimal",
  "decorative",
  "industrial",
  "vintage",
  "modern",
  "celtic",
  "mandala",
  "floral",
  "abstract",
];
const fileTypes = [
  { value: "svg", label: "SVG" },
  { value: "dxf", label: "DXF" },
  { value: "dwg", label: "DWG" },
  { value: "ai", label: "AI" },
  { value: "eps", label: "EPS" },
  { value: "pdf", label: "PDF" },
  { value: "cdr", label: "CDR" },
  { value: "stl", label: "STL" },
  { value: "obj", label: "OBJ" },
  { value: "gltf", label: "GLTF" },
  { value: "glb", label: "GLB" },
  { value: "3mf", label: "3MF" },
];

export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // useTransition keeps UI responsive during navigation
  const [isPending, startTransition] = useTransition();

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      params.delete("page"); // Reset to page 1 when filtering
      return params.toString();
    },
    [searchParams]
  );

  const handleFilterChange = (name: string, value: string) => {
    startTransition(() => {
      router.push(`/designs?${createQueryString(name, value)}`);
    });
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get("q") as string;
    startTransition(() => {
      router.push(`/designs?${createQueryString("q", q)}`);
    });
  };

  const hasFilters =
    searchParams.get("q") ||
    searchParams.get("difficulty") ||
    searchParams.get("category") ||
    searchParams.get("style") ||
    searchParams.get("fileType");

  return (
    <div className="mb-8 space-y-4">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            defaultValue={searchParams.get("q") ?? ""}
            placeholder="Search designs..."
            className="pl-10"
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner size="sm" /> : "Search"}
        </Button>
      </form>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={searchParams.get("difficulty") ?? "all"}
          onValueChange={(value) => handleFilterChange("difficulty", value)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Difficulties</SelectItem>
            {difficulties.map((d) => (
              <SelectItem key={d} value={d}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("category") ?? "all"}
          onValueChange={(value) => handleFilterChange("category", value)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("style") ?? "all"}
          onValueChange={(value) => handleFilterChange("style", value)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Style" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Styles</SelectItem>
            {styles.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("fileType") ?? "all"}
          onValueChange={(value) => handleFilterChange("fileType", value)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="File Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {fileTypes.map((ft) => (
              <SelectItem key={ft.value} value={ft.value}>
                {ft.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/designs")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
