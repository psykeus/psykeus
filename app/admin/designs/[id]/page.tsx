"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import { formatDate, formatBytes } from "@/lib/utils";
import { AdminFileManager } from "@/components/AdminFileManager";
import type { Design, DesignFile } from "@/lib/types";

// Dynamically import ModelViewer to avoid SSR issues with Three.js
const ModelViewer = dynamic(() => import("@/components/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Loading 3D viewer...</span>
      </div>
    </div>
  ),
});

interface Tag {
  id: string;
  name: string;
}

interface DesignWithFiles extends Design {
  design_files: DesignFile[];
  design_tags: Array<{ tags: Tag }>;
}

export default function AdminDesignEditPage() {
  const params = useParams();
  const router = useRouter();
  const designId = params.id as string;

  const [design, setDesign] = useState<DesignWithFiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    difficulty: "",
    project_type: "",
    style: "",
    approx_dimensions: "",
    is_public: true,
    access_level: "free" as "free" | "premium" | "exclusive",
    // License fields
    license_type: "unknown" as string,
    license_notes: "",
    license_url: "",
    attribution_required: false,
    commercial_use_allowed: null as boolean | null,
    modification_allowed: true,
  });

  // AI regeneration state
  const [regeneratingAI, setRegeneratingAI] = useState(false);

  // Tag state
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  // 3D viewer state
  const [viewMode, setViewMode] = useState<"image" | "3d">("image");
  const [stlUrl, setStlUrl] = useState<string | null>(null);
  const [loadingStl, setLoadingStl] = useState(false);

  // Multi-file support state
  const [allFiles, setAllFiles] = useState<DesignFile[]>([]);
  const [primaryFileId, setPrimaryFileId] = useState<string | null>(null);

  // High-quality preview state (original file instead of thumbnail)
  const [primaryPreviewUrl, setPrimaryPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [primaryFileType, setPrimaryFileType] = useState<string | null>(null);

  // Load all existing tags for suggestions
  useEffect(() => {
    async function loadAllTags() {
      try {
        const response = await fetch("/api/admin/tags");
        if (response.ok) {
          const { tags: tagList } = await response.json();
          setAllTags(tagList || []);
        }
      } catch {
        console.error("Failed to load tags");
      }
    }
    loadAllTags();
  }, []);

  // Function to load all files for the design
  const loadFiles = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/designs/${designId}/files`);
      if (response.ok) {
        const data = await response.json();
        setAllFiles(data.files || []);
        setPrimaryFileId(data.primaryFileId);
      }
    } catch (err) {
      console.error("Failed to load files:", err);
    }
  }, [designId]);

  useEffect(() => {
    async function loadDesign() {
      try {
        const response = await fetch(`/api/admin/designs/${designId}`);

        if (!response.ok) {
          const errorData = await response.json();
          setMessage({ type: "error", text: errorData.error || "Design not found" });
          setLoading(false);
          return;
        }

        const { design: data } = await response.json();

        setDesign(data as DesignWithFiles);
        setFormData({
          title: data.title,
          description: data.description || "",
          difficulty: data.difficulty || "",
          project_type: data.project_type || "",
          style: data.style || "",
          approx_dimensions: data.approx_dimensions || "",
          is_public: data.is_public,
          access_level: data.access_level || "free",
          // License fields
          license_type: data.license_type || "unknown",
          license_notes: data.license_notes || "",
          license_url: data.license_url || "",
          attribution_required: data.attribution_required || false,
          commercial_use_allowed: data.commercial_use_allowed ?? null,
          modification_allowed: data.modification_allowed ?? true,
        });

        // Set tags from design_tags
        const designTags = data.design_tags?.map((dt: { tags: Tag }) => dt.tags.name) || [];
        setTags(designTags);

        // Set primary file ID
        setPrimaryFileId(data.primary_file_id);
      } catch {
        setMessage({ type: "error", text: "Failed to load design" });
      } finally {
        setLoading(false);
      }
    }

    loadDesign();
    loadFiles();
  }, [designId, loadFiles]);

  // Get active file type
  const activeFile = design?.design_files.find((f) => f.is_active);
  const isStl = activeFile?.file_type?.toLowerCase() === "stl";

  // Get primary file info from allFiles
  const primaryFile = allFiles.find((f) => f.id === primaryFileId);
  const primaryFileIs3D = ["stl", "obj", "gltf", "glb", "3mf"].includes(
    primaryFile?.file_type?.toLowerCase() || ""
  );

  // Fetch high-quality preview URL from original file when primary file is known
  // Skip for 3D files (STL, OBJ, etc.) - they use the 3D viewer or pre-generated thumbnail
  useEffect(() => {
    if (!primaryFileId || !designId) return;

    // Wait until allFiles is loaded before making decisions about file type
    // This prevents a race condition where primaryFile is undefined
    if (allFiles.length === 0) return;

    // Skip fetching high-quality preview for 3D files - they can't be displayed in <Image>
    // and should use the pre-generated thumbnail in "Preview" mode
    if (primaryFileIs3D) {
      setPrimaryPreviewUrl(null);
      setPrimaryFileType(primaryFile?.file_type?.toLowerCase() || null);
      return;
    }

    setLoadingPreview(true);
    fetch(`/api/admin/designs/${designId}/files/${primaryFileId}/preview`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch preview");
        return res.json();
      })
      .then((data) => {
        if (data.url) {
          // For SVG files, fetch and create blob URL with correct MIME type
          const fileType = data.fileType?.toLowerCase() || "";
          setPrimaryFileType(fileType);

          if (fileType === "svg") {
            fetch(data.url)
              .then((res) => res.blob())
              .then((blob) => {
                const correctedBlob = new Blob([blob], { type: "image/svg+xml" });
                setPrimaryPreviewUrl(URL.createObjectURL(correctedBlob));
              })
              .catch(() => setPrimaryPreviewUrl(data.url));
          } else {
            setPrimaryPreviewUrl(data.url);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load high-quality preview:", err);
        // Fall back to design.preview_path handled in render
      })
      .finally(() => {
        setLoadingPreview(false);
      });

    // Cleanup blob URL on unmount or change
    return () => {
      if (primaryPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(primaryPreviewUrl);
      }
    };
  }, [primaryFileId, designId, primaryFileIs3D, primaryFile?.file_type, allFiles.length]);

  // Fetch STL URL when switching to 3D mode
  useEffect(() => {
    if (viewMode === "3d" && isStl && !stlUrl && designId) {
      setLoadingStl(true);
      fetch(`/api/admin/designs/${designId}/stl`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json();
        })
        .then((data) => {
          if (data.url) {
            setStlUrl(data.url);
          } else if (data.error) {
            console.error("STL API error:", data.error);
          }
        })
        .catch((err) => {
          console.error("Failed to get STL URL:", err);
        })
        .finally(() => {
          setLoadingStl(false);
        });
    }
  }, [viewMode, isStl, stlUrl, designId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/designs/${designId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      setMessage({ type: "success", text: "Design saved successfully" });
    } catch {
      setMessage({ type: "error", text: "Failed to save design" });
    } finally {
      setSaving(false);
    }
  };

  const handleActivateVersion = async (versionId: string) => {
    try {
      const response = await fetch(`/api/admin/designs/${designId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_id: versionId }),
      });

      if (!response.ok) {
        throw new Error("Failed to activate version");
      }

      // Reload the design
      window.location.reload();
    } catch {
      setMessage({ type: "error", text: "Failed to activate version" });
    }
  };

  const handleArchive = async () => {
    if (!confirm("Are you sure you want to archive this design? It will be hidden from public view.")) return;

    try {
      const response = await fetch(`/api/admin/designs/${designId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to archive");
      }

      router.push("/admin/designs");
    } catch {
      setMessage({ type: "error", text: "Failed to archive design" });
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirm("Are you sure you want to PERMANENTLY DELETE this design? This action cannot be undone!")) return;
    if (!confirm("This will delete ALL files and data associated with this design. Are you absolutely sure?")) return;

    try {
      const response = await fetch(`/api/admin/designs/${designId}?hard=true`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      router.push("/admin/designs");
    } catch {
      setMessage({ type: "error", text: "Failed to permanently delete design" });
    }
  };

  const handleRegenerateAI = async () => {
    if (!confirm("This will replace the current title, description, and tags with AI-generated content. Continue?")) return;

    setRegeneratingAI(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/designs/${designId}/regenerate-ai`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to regenerate AI metadata");
      }

      // Update form with new data
      if (data.design) {
        setFormData({
          title: data.design.title || "",
          description: data.design.description || "",
          difficulty: data.design.difficulty || "",
          project_type: data.design.project_type || "",
          style: data.design.style || "",
          approx_dimensions: data.design.approx_dimensions || "",
          is_public: data.design.is_public,
          access_level: data.design.access_level || "free",
          // Preserve existing license fields (AI regeneration doesn't change these)
          license_type: data.design.license_type || formData.license_type,
          license_notes: data.design.license_notes || formData.license_notes,
          license_url: data.design.license_url || formData.license_url,
          attribution_required: data.design.attribution_required ?? formData.attribution_required,
          commercial_use_allowed: data.design.commercial_use_allowed ?? formData.commercial_use_allowed,
          modification_allowed: data.design.modification_allowed ?? formData.modification_allowed,
        });

        // Update tags
        const newTags = data.design.design_tags?.map((dt: { tags: Tag }) => dt.tags.name) || [];
        setTags(newTags);
      }

      setMessage({ type: "success", text: "AI metadata regenerated successfully!" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to regenerate AI metadata" });
    } finally {
      setRegeneratingAI(false);
    }
  };

  // Tag handling functions
  const addTag = useCallback((tagName: string) => {
    const normalized = tagName.toLowerCase().trim();
    if (normalized && !tags.includes(normalized)) {
      setTags([...tags, normalized]);
    }
    setTagInput("");
    setShowTagSuggestions(false);
  }, [tags]);

  const removeTag = useCallback((tagName: string) => {
    setTags(tags.filter((t) => t !== tagName));
  }, [tags]);

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (tagInput.trim()) {
        addTag(tagInput);
      }
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const saveTags = async () => {
    setSavingTags(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/designs/${designId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });

      if (!response.ok) {
        throw new Error("Failed to save tags");
      }

      setMessage({ type: "success", text: "Tags saved successfully" });
    } catch {
      setMessage({ type: "error", text: "Failed to save tags" });
    } finally {
      setSavingTags(false);
    }
  };

  // Filter suggestions based on input
  const filteredSuggestions = allTags
    .filter((tag) =>
      tag.name.toLowerCase().includes(tagInput.toLowerCase()) &&
      !tags.includes(tag.name.toLowerCase())
    )
    .slice(0, 8);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!design) {
    return <div className="p-8">Design not found</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Edit Design</h1>
        <div className="flex gap-2">
          <button
            onClick={handleRegenerateAI}
            disabled={regeneratingAI}
            className="px-4 py-2 text-purple-600 border border-purple-600 rounded-md hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {regeneratingAI ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.912 5.813a2 2 0 001.286 1.287L21 12l-5.802 1.9a2 2 0 00-1.286 1.287L12 21l-1.912-5.813a2 2 0 00-1.286-1.287L3 12l5.802-1.9a2 2 0 001.286-1.287L12 3z"/>
                </svg>
                Regenerate AI
              </>
            )}
          </button>
          <button
            onClick={handleArchive}
            className="px-4 py-2 text-yellow-600 border border-yellow-600 rounded-md hover:bg-yellow-50 dark:hover:bg-yellow-950"
          >
            Archive
          </button>
          <button
            onClick={handlePermanentDelete}
            className="px-4 py-2 text-destructive border border-destructive rounded-md hover:bg-destructive/10"
          >
            Delete Forever
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-md mb-6 ${
            message.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-green-100 text-green-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Preview */}
        <div>
          <div className="relative aspect-square bg-muted rounded-lg overflow-hidden mb-4">
            {/* View mode toggle for STL files */}
            {isStl && (
              <div className="absolute top-3 right-3 z-10 flex rounded-lg overflow-hidden border bg-background shadow-sm">
                <button
                  onClick={() => setViewMode("image")}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    viewMode === "image"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setViewMode("3d")}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    viewMode === "3d"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  3D View
                </button>
              </div>
            )}

            {/* Image preview - use high-quality original file when available */}
            {viewMode === "image" && (
              <>
                {loadingPreview && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading preview...</span>
                    </div>
                  </div>
                )}
                {primaryPreviewUrl && primaryFileType === "svg" ? (
                  // SVG files: use img tag for proper vector rendering
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={primaryPreviewUrl}
                    alt={design.title}
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                ) : primaryPreviewUrl ? (
                  // Other image types: use Next.js Image with unoptimized for signed URLs
                  <Image
                    src={primaryPreviewUrl}
                    alt={design.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-contain"
                    unoptimized
                  />
                ) : (
                  // Fallback to pre-generated thumbnail
                  <Image
                    src={design.preview_path}
                    alt={design.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-contain"
                  />
                )}
              </>
            )}

            {/* 3D viewer */}
            {viewMode === "3d" && isStl && (
              <div className="w-full h-full">
                {loadingStl ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading model...</span>
                    </div>
                  </div>
                ) : stlUrl ? (
                  <ModelViewer stlUrl={stlUrl} className="w-full h-full" autoRotate={false} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">Failed to load 3D model</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Project Files Manager */}
          <AdminFileManager
            designId={designId}
            files={allFiles}
            primaryFileId={primaryFileId}
            onFilesChange={() => {
              loadFiles();
              // Reset high-quality preview to trigger reload
              setPrimaryPreviewUrl(null);
            }}
            onPreviewChange={(newPreviewPath) => {
              // Update the design preview path in state
              if (design) {
                setDesign({ ...design, preview_path: newPreviewPath });
              }
              // Reset high-quality preview to trigger reload with new primary
              setPrimaryPreviewUrl(null);
            }}
          />
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Difficulty</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="">Select...</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Project Type</label>
              <input
                type="text"
                value={formData.project_type}
                onChange={(e) => setFormData({ ...formData, project_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
                placeholder="e.g., coaster, sign, ornament"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Style</label>
              <input
                type="text"
                value={formData.style}
                onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
                placeholder="e.g., mandala, minimal, floral"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Dimensions</label>
              <input
                type="text"
                value={formData.approx_dimensions}
                onChange={(e) => setFormData({ ...formData, approx_dimensions: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
                placeholder='e.g., 4" x 4"'
              />
            </div>
          </div>

          {/* Tags Section */}
          <div className="border rounded-lg p-4 bg-card">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium">Tags</label>
              <button
                type="button"
                onClick={saveTags}
                disabled={savingTags}
                className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {savingTags ? "Saving..." : "Save Tags"}
              </button>
            </div>

            {/* Current Tags */}
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-destructive ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
              {tags.length === 0 && (
                <span className="text-sm text-muted-foreground">No tags yet</span>
              )}
            </div>

            {/* Tag Input */}
            <div className="relative">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => {
                  setTagInput(e.target.value);
                  setShowTagSuggestions(e.target.value.length > 0);
                }}
                onKeyDown={handleTagInputKeyDown}
                onFocus={() => setShowTagSuggestions(tagInput.length > 0)}
                onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                placeholder="Type to add tags..."
                className="w-full px-3 py-2 border rounded-md bg-background"
              />

              {/* Suggestions Dropdown */}
              {showTagSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-auto">
                  {filteredSuggestions.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => addTag(tag.name)}
                      className="w-full px-3 py-2 text-left hover:bg-muted text-sm"
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to add a tag. Backspace removes the last tag.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_public"
              checked={formData.is_public}
              onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="is_public">Public (visible to all users)</label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Access Level</label>
            <select
              value={formData.access_level}
              onChange={(e) => setFormData({ ...formData, access_level: e.target.value as "free" | "premium" | "exclusive" })}
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              <option value="free">Free - Available to all users</option>
              <option value="premium">Premium - Requires Premium or Pro tier</option>
              <option value="exclusive">Exclusive - Requires Pro tier only</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Controls which subscription tiers can access this design.
            </p>
          </div>

          {/* License Section */}
          <div className="border rounded-lg p-4 bg-card mt-4">
            <h3 className="text-sm font-medium mb-4">License & Usage Rights</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">License Type</label>
                <select
                  value={formData.license_type}
                  onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="unknown">Unknown - Verify Before Use</option>
                  <option value="public_domain">Public Domain - No Copyright</option>
                  <option value="cc0">CC0 - No Rights Reserved</option>
                  <option value="cc_by">CC BY - Attribution Required</option>
                  <option value="cc_by_sa">CC BY-SA - Attribution + ShareAlike</option>
                  <option value="cc_by_nc">CC BY-NC - Non-Commercial Only</option>
                  <option value="cc_by_nc_sa">CC BY-NC-SA - Non-Commercial + ShareAlike</option>
                  <option value="personal_only">Personal Use Only</option>
                  <option value="custom">Custom License</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="attribution_required"
                    checked={formData.attribution_required}
                    onChange={(e) => setFormData({ ...formData, attribution_required: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="attribution_required" className="text-sm">Attribution Required</label>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={formData.commercial_use_allowed === null ? "unknown" : formData.commercial_use_allowed ? "yes" : "no"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({
                        ...formData,
                        commercial_use_allowed: val === "unknown" ? null : val === "yes",
                      });
                    }}
                    className="px-2 py-1 border rounded-md bg-background text-sm"
                  >
                    <option value="unknown">Commercial: Unknown</option>
                    <option value="yes">Commercial: Allowed</option>
                    <option value="no">Commercial: Not Allowed</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="modification_allowed"
                    checked={formData.modification_allowed}
                    onChange={(e) => setFormData({ ...formData, modification_allowed: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="modification_allowed" className="text-sm">Modifications OK</label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">License URL (optional)</label>
                <input
                  type="url"
                  value={formData.license_url}
                  onChange={(e) => setFormData({ ...formData, license_url: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="https://creativecommons.org/licenses/..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">License Notes (optional)</label>
                <textarea
                  value={formData.license_notes}
                  onChange={(e) => setFormData({ ...formData, license_notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="Additional details about the license or attribution requirements..."
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
