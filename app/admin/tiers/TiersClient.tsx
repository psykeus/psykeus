"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  List,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
  Users,
  Crown,
  GripVertical,
  Check,
  X,
  Star,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageLoading } from "@/components/ui/loading-states";
import { PageError } from "@/components/ui/error-states";
import type {
  TierWithFeatures,
  TierFeature,
  CreateTierRequest,
  UpdateTierRequest,
} from "@/lib/types";

// =============================================================================
// TIER FORM MODAL
// =============================================================================

interface TierFormProps {
  tier?: TierWithFeatures | null;
  onClose: () => void;
  onSave: (data: CreateTierRequest | UpdateTierRequest) => Promise<void>;
  saving: boolean;
}

function TierForm({ tier, onClose, onSave, saving }: TierFormProps) {
  const isEdit = !!tier;
  const [formData, setFormData] = useState<CreateTierRequest>({
    name: tier?.name || "",
    slug: tier?.slug || "",
    description: tier?.description || "",
    daily_download_limit: tier?.daily_download_limit ?? null,
    monthly_download_limit: tier?.monthly_download_limit ?? null,
    can_access_premium: tier?.can_access_premium ?? false,
    can_access_exclusive: tier?.can_access_exclusive ?? false,
    can_create_collections: tier?.can_create_collections ?? true,
    max_collections: tier?.max_collections ?? null,
    max_favorites: tier?.max_favorites ?? null,
    price_monthly: tier?.price_monthly ?? null,
    price_yearly: tier?.price_yearly ?? null,
    price_lifetime: tier?.price_lifetime ?? null,
    price_yearly_display: tier?.price_yearly_display || "",
    price_lifetime_display: tier?.price_lifetime_display || "",
    sort_order: tier?.sort_order ?? 0,
    is_active: tier?.is_active ?? true,
    show_on_pricing: tier?.show_on_pricing ?? true,
    highlight_label: tier?.highlight_label || "",
    cta_text: tier?.cta_text || "Get Started",
  });

  // Auto-generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: !isEdit ? generateSlug(name) : prev.slug,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-card z-10">
          <h2 className="text-xl font-semibold">
            {isEdit ? "Edit Tier" : "Create Tier"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  required
                  pattern="[a-z0-9-]+"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md bg-background"
                rows={2}
              />
            </div>
          </div>

          {/* Limits */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
              Download Limits
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Daily Download Limit
                </label>
                <input
                  type="number"
                  value={formData.daily_download_limit ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      daily_download_limit: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="Unlimited"
                  min={0}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty for unlimited
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Monthly Download Limit
                </label>
                <input
                  type="number"
                  value={formData.monthly_download_limit ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      monthly_download_limit: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="Unlimited"
                  min={0}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty for unlimited
                </p>
              </div>
            </div>
          </div>

          {/* Access & Collections */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
              Access & Limits
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_access_premium}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      can_access_premium: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                <span className="text-sm">Access Premium Designs</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_access_exclusive}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      can_access_exclusive: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                <span className="text-sm">Access Exclusive Designs</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_create_collections}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      can_create_collections: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                <span className="text-sm">Can Create Collections</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Max Collections
                </label>
                <input
                  type="number"
                  value={formData.max_collections ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_collections: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="Unlimited"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Max Favorites
                </label>
                <input
                  type="number"
                  value={formData.max_favorites ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_favorites: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="Unlimited"
                  min={0}
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
              Pricing
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Yearly Price ($)
                </label>
                <input
                  type="number"
                  value={formData.price_yearly ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_yearly: e.target.value
                        ? parseFloat(e.target.value)
                        : null,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="0.00"
                  min={0}
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Lifetime Price ($)
                </label>
                <input
                  type="number"
                  value={formData.price_lifetime ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_lifetime: e.target.value
                        ? parseFloat(e.target.value)
                        : null,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="0.00"
                  min={0}
                  step="0.01"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Yearly Display Text
                </label>
                <input
                  type="text"
                  value={formData.price_yearly_display || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_yearly_display: e.target.value || null,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="e.g., $99/year or Included in Lifetime"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Custom text shown on pricing page for yearly option
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Lifetime Display Text
                </label>
                <input
                  type="text"
                  value={formData.price_lifetime_display || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_lifetime_display: e.target.value || null,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="e.g., $299 or One-time payment"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Custom text shown on pricing page for lifetime option
                </p>
              </div>
            </div>
          </div>

          {/* Display Settings */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
              Display Settings
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="text-sm">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.show_on_pricing}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      show_on_pricing: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                <span className="text-sm">Show on Pricing Page</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Highlight Label
                </label>
                <input
                  type="text"
                  value={formData.highlight_label || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, highlight_label: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="e.g., Most Popular"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  CTA Button Text
                </label>
                <input
                  type="text"
                  value={formData.cta_text}
                  onChange={(e) =>
                    setFormData({ ...formData, cta_text: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="Get Started"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Sort Order
              </label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sort_order: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border rounded-md bg-background"
                min={0}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-md hover:bg-secondary"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Tier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// FEATURES MANAGER MODAL
// =============================================================================

interface FeaturesManagerProps {
  tier: TierWithFeatures;
  onClose: () => void;
  onUpdate: () => void;
}

function FeaturesManager({ tier, onClose, onUpdate }: FeaturesManagerProps) {
  const [features, setFeatures] = useState<TierFeature[]>(tier.features);
  const [newFeature, setNewFeature] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  const addFeature = async () => {
    if (!newFeature.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tiers/${tier.id}/features`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature_text: newFeature.trim() }),
      });

      if (res.ok) {
        const { feature } = await res.json();
        setFeatures([...features, feature]);
        setNewFeature("");
        onUpdate();
      }
    } finally {
      setSaving(false);
    }
  };

  const updateFeature = async (id: string, data: Partial<TierFeature>) => {
    const res = await fetch(`/api/admin/tiers/features/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const { feature } = await res.json();
      setFeatures(features.map((f) => (f.id === id ? feature : f)));
      setEditingId(null);
      onUpdate();
    }
  };

  const deleteFeature = async (id: string) => {
    if (!confirm("Delete this feature?")) return;

    const res = await fetch(`/api/admin/tiers/features/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setFeatures(features.filter((f) => f.id !== id));
      onUpdate();
    }
  };

  const startEdit = (feature: TierFeature) => {
    setEditingId(feature.id);
    setEditText(feature.feature_text);
  };

  const saveEdit = async (id: string) => {
    await updateFeature(id, { feature_text: editText });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border rounded-lg w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">
            Manage Features - {tier.name}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Add and edit display features for this tier
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Add new feature */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newFeature}
              onChange={(e) => setNewFeature(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFeature()}
              className="flex-1 px-3 py-2 border rounded-md bg-background"
              placeholder="Add a new feature..."
            />
            <button
              onClick={addFeature}
              disabled={saving || !newFeature.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Feature list */}
          <div className="space-y-2">
            {features.map((feature) => (
              <div
                key={feature.id}
                className="flex items-center gap-2 p-3 border rounded-md bg-background"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />

                {editingId === feature.id ? (
                  <>
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="flex-1 px-2 py-1 border rounded bg-background"
                      autoFocus
                    />
                    <button
                      onClick={() => saveEdit(feature.id)}
                      className="p-1 hover:bg-secondary rounded text-green-600"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 hover:bg-secondary rounded text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{feature.feature_text}</span>
                    <button
                      onClick={() =>
                        updateFeature(feature.id, {
                          is_highlighted: !feature.is_highlighted,
                        })
                      }
                      className={`p-1 hover:bg-secondary rounded ${
                        feature.is_highlighted
                          ? "text-yellow-500"
                          : "text-muted-foreground"
                      }`}
                      title={
                        feature.is_highlighted
                          ? "Remove highlight"
                          : "Highlight feature"
                      }
                    >
                      <Star
                        className="h-4 w-4"
                        fill={feature.is_highlighted ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      onClick={() => startEdit(feature)}
                      className="p-1 hover:bg-secondary rounded"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteFeature(feature.id)}
                      className="p-1 hover:bg-secondary rounded text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ))}

            {features.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No features yet. Add some above!
              </p>
            )}
          </div>
        </div>

        <div className="p-6 border-t">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border rounded-md hover:bg-secondary"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN TIERS CLIENT COMPONENT
// =============================================================================

export function TiersClient() {
  const [tiers, setTiers] = useState<TierWithFeatures[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTier, setEditTier] = useState<TierWithFeatures | null>(null);
  const [featuresTier, setFeaturesTier] = useState<TierWithFeatures | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTier, setDeleteTier] = useState<TierWithFeatures | null>(null);

  const fetchTiers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tiers");
      if (!res.ok) throw new Error("Failed to fetch tiers");
      const { tiers } = await res.json();
      setTiers(tiers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  const handleSaveTier = async (data: CreateTierRequest | UpdateTierRequest) => {
    setSaving(true);
    try {
      const isEdit = !!editTier;
      const url = isEdit
        ? `/api/admin/tiers/${editTier.id}`
        : "/api/admin/tiers";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to save tier");
      }

      await fetchTiers();
      setShowCreateModal(false);
      setEditTier(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save tier");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (tier: TierWithFeatures) => {
    const res = await fetch(`/api/admin/tiers/${tier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_active", is_active: !tier.is_active }),
    });

    if (res.ok) {
      fetchTiers();
    }
  };

  const handleTogglePricing = async (tier: TierWithFeatures) => {
    const res = await fetch(`/api/admin/tiers/${tier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show_on_pricing: !tier.show_on_pricing }),
    });

    if (res.ok) {
      fetchTiers();
    }
  };

  const handleDeleteTier = async () => {
    if (!deleteTier) return;

    const res = await fetch(`/api/admin/tiers/${deleteTier.id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      fetchTiers();
      setDeleteTier(null);
    } else {
      const { error } = await res.json();
      alert(error || "Failed to delete tier");
    }
  };

  if (loading) {
    return <PageLoading message="Loading tiers..." />;
  }

  if (error) {
    return (
      <PageError title="Failed to load tiers" message={error} onRetry={fetchTiers} />
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Tiers</p>
              <p className="text-2xl font-bold">{tiers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <ToggleRight className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Tiers</p>
              <p className="text-2xl font-bold">
                {tiers.filter((t) => t.is_active).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold">
                {tiers.reduce((sum, t) => sum + (t.user_count || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create Tier
        </button>
      </div>

      {/* Tiers Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium w-10"></th>
                <th className="text-left p-4 font-medium">Tier</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Pricing</th>
                <th className="text-left p-4 font-medium">Features</th>
                <th className="text-left p-4 font-medium">Users</th>
                <th className="text-left p-4 font-medium">Pricing Page</th>
                <th className="text-right p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tiers.map((tier) => (
                <tr key={tier.id} className="hover:bg-muted/30">
                  <td className="p-4">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  </td>
                  <td className="p-4">
                    <div>
                      <p className="font-medium">{tier.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {tier.slug}
                      </p>
                      {tier.highlight_label && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                          {tier.highlight_label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        tier.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {tier.is_active ? (
                        <ToggleRight className="h-3 w-3" />
                      ) : (
                        <ToggleLeft className="h-3 w-3" />
                      )}
                      {tier.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      {tier.price_yearly !== null || tier.price_lifetime !== null ? (
                        <>
                          {tier.price_yearly !== null && (
                            <p>{tier.price_yearly_display || `$${tier.price_yearly}/yr`}</p>
                          )}
                          {tier.price_lifetime !== null && (
                            <p className="text-muted-foreground">
                              {tier.price_lifetime_display || `$${tier.price_lifetime} lifetime`}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Free</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm">{tier.features.length} features</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-medium">
                      {tier.user_count || 0}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleTogglePricing(tier)}
                      className={`p-1 rounded hover:bg-secondary ${
                        tier.show_on_pricing
                          ? "text-green-600"
                          : "text-muted-foreground"
                      }`}
                      title={
                        tier.show_on_pricing
                          ? "Visible on pricing page"
                          : "Hidden from pricing page"
                      }
                    >
                      {tier.show_on_pricing ? (
                        <Eye className="h-5 w-5" />
                      ) : (
                        <EyeOff className="h-5 w-5" />
                      )}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 hover:bg-secondary rounded-md">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setEditTier(tier)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Tier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setFeaturesTier(tier)}
                          >
                            <List className="h-4 w-4 mr-2" />
                            Manage Features
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(tier)}
                          >
                            {tier.is_active ? (
                              <>
                                <ToggleLeft className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <ToggleRight className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTier(tier)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tiers.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No tiers found. Create your first tier to get started.
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editTier) && (
        <TierForm
          tier={editTier}
          onClose={() => {
            setShowCreateModal(false);
            setEditTier(null);
          }}
          onSave={handleSaveTier}
          saving={saving}
        />
      )}

      {/* Features Manager Modal */}
      {featuresTier && (
        <FeaturesManager
          tier={featuresTier}
          onClose={() => setFeaturesTier(null)}
          onUpdate={fetchTiers}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Delete Tier</h2>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete <strong>{deleteTier.name}</strong>?
              This action cannot be undone.
            </p>
            {(deleteTier.user_count || 0) > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mb-4">
                <p className="text-sm text-red-700 dark:text-red-400">
                  <strong>Warning:</strong> This tier has{" "}
                  {deleteTier.user_count} user(s) assigned. You cannot delete
                  it until all users are moved to a different tier.
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTier(null)}
                className="px-4 py-2 border rounded-md hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTier}
                disabled={(deleteTier.user_count || 0) > 0}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
