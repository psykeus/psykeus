"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Save, RotateCcw, AlertCircle, CheckCircle,
  Heart, FolderHeart, Sparkles, Calendar, Pencil, ScrollText,
  BarChart3, Download, Server, Globe, Webhook,
  Map, Share2, Search, Tags, FileCode
} from "lucide-react";
import type { AIConfig, FeatureFlags } from "@/lib/ai-config";

export function FeatureFlagsForm() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/admin/ai-settings");
      if (!response.ok) throw new Error("Failed to load configuration");
      const data = await response.json();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/admin/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      setSuccess("Feature flags saved successfully");
      setHasChanges(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const updateFeatureFlag = <K extends keyof FeatureFlags>(
    feature: K,
    updates: Partial<FeatureFlags[K]>
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      featureFlags: {
        ...config.featureFlags,
        [feature]: {
          ...config.featureFlags[feature],
          ...updates,
        },
      },
    });
    setHasChanges(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
          <p className="text-destructive">{error || "Failed to load configuration"}</p>
          <Button variant="outline" onClick={loadConfig} className="mt-4">
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 rounded-lg">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* User Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            User Features
          </CardTitle>
          <CardDescription>
            Features available to logged-in users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FeatureToggleItem
            icon={Heart}
            label="Favorites"
            description="Allow users to save designs to their favorites list"
            enabled={config.featureFlags.favorites.enabled}
            onEnabledChange={(enabled) => updateFeatureFlag("favorites", { enabled })}
          >
            <div className="ml-8 mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground w-32">Max per user:</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={config.featureFlags.favorites.maxPerUser}
                  onChange={(e) => updateFeatureFlag("favorites", { maxPerUser: parseInt(e.target.value) || 100 })}
                  min={1}
                  max={1000}
                />
              </div>
            </div>
          </FeatureToggleItem>

          <Separator />

          <FeatureToggleItem
            icon={FolderHeart}
            label="Collections"
            description="Allow users to organize designs into custom collections"
            enabled={config.featureFlags.collections.enabled}
            onEnabledChange={(enabled) => updateFeatureFlag("collections", { enabled })}
          >
            <div className="ml-8 mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground w-32">Max collections:</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={config.featureFlags.collections.maxPerUser}
                  onChange={(e) => updateFeatureFlag("collections", { maxPerUser: parseInt(e.target.value) || 20 })}
                  min={1}
                  max={100}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground w-32">Max items each:</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={config.featureFlags.collections.maxItemsPerCollection}
                  onChange={(e) => updateFeatureFlag("collections", { maxItemsPerCollection: parseInt(e.target.value) || 100 })}
                  min={1}
                  max={500}
                />
              </div>
            </div>
          </FeatureToggleItem>

          <Separator />

          <FeatureToggleItem
            icon={Sparkles}
            label="Related Designs"
            description="Show similar designs based on visual similarity"
            enabled={config.featureFlags.relatedDesigns.enabled}
            onEnabledChange={(enabled) => updateFeatureFlag("relatedDesigns", { enabled })}
          >
            <div className="ml-8 mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground w-32">Max suggestions:</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={config.featureFlags.relatedDesigns.maxSuggestions}
                  onChange={(e) => updateFeatureFlag("relatedDesigns", { maxSuggestions: parseInt(e.target.value) || 6 })}
                  min={1}
                  max={20}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground w-32">Min similarity %:</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={config.featureFlags.relatedDesigns.similarityThreshold}
                  onChange={(e) => updateFeatureFlag("relatedDesigns", { similarityThreshold: parseInt(e.target.value) || 70 })}
                  min={50}
                  max={99}
                />
              </div>
            </div>
          </FeatureToggleItem>
        </CardContent>
      </Card>

      {/* Admin Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Admin Features
          </CardTitle>
          <CardDescription>
            Features for content management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FeatureToggleItem
            icon={Calendar}
            label="Scheduled Publishing"
            description="Schedule designs to be published at a future date/time"
            enabled={config.featureFlags.scheduledPublishing.enabled}
            onEnabledChange={(enabled) => updateFeatureFlag("scheduledPublishing", { enabled })}
          />

          <Separator />

          <FeatureToggleItem
            icon={Pencil}
            label="Bulk Edit"
            description="Edit multiple designs at once (tags, categories, publish status)"
            enabled={config.featureFlags.bulkEdit.enabled}
            onEnabledChange={(enabled) => updateFeatureFlag("bulkEdit", { enabled })}
          />

          <Separator />

          <FeatureToggleItem
            icon={ScrollText}
            label="Audit Log"
            description="Track all admin actions for accountability"
            enabled={config.featureFlags.auditLog.enabled}
            onEnabledChange={(enabled) => updateFeatureFlag("auditLog", { enabled })}
          >
            <div className="ml-8 mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground w-32">Retention days:</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={config.featureFlags.auditLog.retentionDays}
                  onChange={(e) => updateFeatureFlag("auditLog", { retentionDays: parseInt(e.target.value) || 90 })}
                  min={7}
                  max={365}
                />
              </div>
            </div>
          </FeatureToggleItem>
        </CardContent>
      </Card>

      {/* Analytics Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Analytics & Reports
          </CardTitle>
          <CardDescription>
            Data visualization and reporting features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FeatureToggleItem
            icon={BarChart3}
            label="Analytics Charts"
            description="Show visual charts on the admin dashboard"
            enabled={config.featureFlags.analyticsCharts.enabled}
            onEnabledChange={(enabled) => updateFeatureFlag("analyticsCharts", { enabled })}
          />

          <Separator />

          <FeatureToggleItem
            icon={Tags}
            label="Popular Tags Report"
            description="View tag usage statistics and trends"
            enabled={config.featureFlags.popularTagsReport.enabled}
            onEnabledChange={(enabled) => updateFeatureFlag("popularTagsReport", { enabled })}
          />

          <Separator />

          <FeatureToggleItem
            icon={Download}
            label="Export Reports"
            description="Export statistics and data as CSV/PDF"
            enabled={config.featureFlags.exportReports.enabled}
            onEnabledChange={(enabled) => updateFeatureFlag("exportReports", { enabled })}
          />
        </CardContent>
      </Card>

      {/* Technical Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Technical Features
          </CardTitle>
          <CardDescription>
            Infrastructure and integration features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FeatureToggleItem
            icon={Server}
            label="Background Jobs"
            description="Process heavy tasks (previews, AI) in background queue"
            enabled={config.featureFlags.backgroundJobs.enabled}
            onEnabledChange={(enabled) => updateFeatureFlag("backgroundJobs", { enabled })}
          />

          <Separator />

          <FeatureToggleItem
            icon={Globe}
            label="CDN Integration"
            description="Serve preview images through CDN for faster loading"
            enabled={config.featureFlags.cdnIntegration.enabled}
            onEnabledChange={(enabled) => updateFeatureFlag("cdnIntegration", { enabled })}
          >
            <div className="ml-8 mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground w-32">Provider:</Label>
                <Select
                  value={config.featureFlags.cdnIntegration.provider}
                  onValueChange={(v) => updateFeatureFlag("cdnIntegration", { provider: v as "cloudflare" | "cloudfront" | "generic" })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cloudflare">Cloudflare</SelectItem>
                    <SelectItem value="cloudfront">CloudFront</SelectItem>
                    <SelectItem value="generic">Generic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground w-32">CDN URL:</Label>
                <Input
                  className="flex-1"
                  placeholder="https://cdn.example.com"
                  value={config.featureFlags.cdnIntegration.cdnUrl}
                  onChange={(e) => updateFeatureFlag("cdnIntegration", { cdnUrl: e.target.value })}
                />
              </div>
            </div>
          </FeatureToggleItem>

          <Separator />

          <FeatureToggleItem
            icon={Webhook}
            label="Webhooks"
            description="Send notifications to external services on events"
            enabled={config.featureFlags.webhooks.enabled}
            onEnabledChange={(enabled) => updateFeatureFlag("webhooks", { enabled })}
          />

          <Separator />

          <FeatureToggleItem
            icon={Map}
            label="Sitemap Generation"
            description="Auto-generate sitemap.xml for SEO"
            enabled={config.featureFlags.sitemapGeneration.enabled}
            onEnabledChange={(enabled) => updateFeatureFlag("sitemapGeneration", { enabled })}
          />

          <Separator />

          <FeatureToggleItem
            icon={Share2}
            label="Social Cards"
            description="Generate OpenGraph images for social media sharing"
            enabled={config.featureFlags.socialCards.enabled}
            onEnabledChange={(enabled) => updateFeatureFlag("socialCards", { enabled })}
          />
        </CardContent>
      </Card>

      {/* Search Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Search Features
          </CardTitle>
          <CardDescription>
            Enhanced search and discovery
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FeatureToggleItem
            icon={Search}
            label="Advanced Search"
            description="Boolean operators, dimension ranges, file type filters"
            enabled={config.featureFlags.advancedSearch.enabled}
            onEnabledChange={(enabled) => updateFeatureFlag("advancedSearch", { enabled })}
          />

          <Separator />

          <FeatureToggleItem
            icon={Tags}
            label="Tag Autocomplete"
            description="Suggest tags as users type in search"
            enabled={config.featureFlags.tagAutocomplete.enabled}
            onEnabledChange={(enabled) => updateFeatureFlag("tagAutocomplete", { enabled })}
          />
        </CardContent>
      </Card>

      {/* File Processing Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-primary" />
            File Processing
          </CardTitle>
          <CardDescription>
            Additional file format support
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FeatureToggleItem
            icon={FileCode}
            label="G-code Preview"
            description="Parse and visualize CNC toolpaths from G-code files"
            enabled={config.featureFlags.gcodePreview.enabled}
            onEnabledChange={(enabled) => updateFeatureFlag("gcodePreview", { enabled })}
          />
        </CardContent>
      </Card>

      <Separator />

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Changes are saved to the configuration file
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={loadConfig} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={saveConfig} disabled={saving || !hasChanges}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

// Feature Toggle Item Component
function FeatureToggleItem({
  icon: Icon,
  label,
  description,
  enabled,
  onEnabledChange,
  children,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
        <Checkbox
          id={`feature-${label.toLowerCase().replace(/\s+/g, "-")}`}
          checked={enabled}
          onCheckedChange={onEnabledChange}
          className="mt-0.5"
        />
        <Icon className={`h-4 w-4 mt-0.5 ${enabled ? "text-primary" : "text-muted-foreground"}`} />
        <div className="flex-1">
          <Label
            htmlFor={`feature-${label.toLowerCase().replace(/\s+/g, "-")}`}
            className="text-sm font-medium cursor-pointer"
          >
            {label}
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {description}
          </p>
        </div>
        <Badge variant={enabled ? "default" : "secondary"} className="ml-auto">
          {enabled ? "Enabled" : "Disabled"}
        </Badge>
      </div>
      {enabled && children}
    </div>
  );
}
