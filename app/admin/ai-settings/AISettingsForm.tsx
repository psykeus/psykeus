"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Save, RotateCcw, Plus, X, AlertCircle, CheckCircle, Eye
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { AIConfig, DisplaySettings } from "@/lib/ai-config";

export function AISettingsForm() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load config on mount
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

      setSuccess("Configuration saved successfully");
      setHasChanges(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (updates: Partial<AIConfig>) => {
    if (!config) return;
    setConfig({ ...config, ...updates });
    setHasChanges(true);
  };

  const updateModel = (key: "legacy2D" | "model3D", updates: Record<string, unknown>) => {
    if (!config) return;
    setConfig({
      ...config,
      models: {
        ...config.models,
        [key]: { ...config.models[key], ...updates },
      },
    });
    setHasChanges(true);
  };

  const updatePrompt = (
    key: "model3DSystem" | "model3DUser" | "legacy2DSystem" | "legacy2DUser",
    updates: Record<string, unknown>
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      prompts: {
        ...config.prompts,
        [key]: { ...config.prompts[key], ...updates },
      },
    });
    setHasChanges(true);
  };

  const updateVocabulary = (
    key: keyof AIConfig["tagVocabulary"],
    value: string[]
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      tagVocabulary: {
        ...config.tagVocabulary,
        [key]: value,
      },
    });
    setHasChanges(true);
  };

  const updateValidValues = (
    key: keyof AIConfig["validValues"],
    value: string[]
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      validValues: {
        ...config.validValues,
        [key]: value,
      },
    });
    setHasChanges(true);
  };

  const updateDisplaySetting = (
    key: keyof DisplaySettings,
    value: boolean
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      displaySettings: {
        ...config.displaySettings,
        [key]: value,
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

      <Tabs defaultValue="models" className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full max-w-4xl">
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="vocabulary">Vocabulary</TabsTrigger>
          <TabsTrigger value="values">Valid Values</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
        </TabsList>

        {/* Models Tab */}
        <TabsContent value="models" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* 3D Model Settings */}
            <Card>
              <CardHeader>
                <CardTitle>3D Model Analysis</CardTitle>
                <CardDescription>Settings for STL, OBJ, GLTF, 3MF files</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select
                    value={config.models.model3D.model}
                    onValueChange={(v) => updateModel("model3D", { model: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-5.1">GPT-5.1 (Best for complex 3D)</SelectItem>
                      <SelectItem value="gpt-5-mini">GPT-5 Mini (Budget-friendly)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    value={config.models.model3D.maxTokens}
                    onChange={(e) => updateModel("model3D", { maxTokens: parseInt(e.target.value) || 500 })}
                    min={100}
                    max={4000}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Temperature ({config.models.model3D.temperature})</Label>
                  <Input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.models.model3D.temperature}
                    onChange={(e) => updateModel("model3D", { temperature: parseFloat(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower = more consistent, Higher = more creative
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Image Detail</Label>
                  <Select
                    value={config.models.model3D.detail}
                    onValueChange={(v) => updateModel("model3D", { detail: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High (Best quality)</SelectItem>
                      <SelectItem value="low">Low (Faster)</SelectItem>
                      <SelectItem value="auto">Auto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* 2D Design Settings */}
            <Card>
              <CardHeader>
                <CardTitle>2D Design Analysis</CardTitle>
                <CardDescription>Settings for SVG, DXF, PDF files</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select
                    value={config.models.legacy2D.model}
                    onValueChange={(v) => updateModel("legacy2D", { model: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-5-mini">GPT-5 Mini (Recommended for 2D)</SelectItem>
                      <SelectItem value="gpt-5.1">GPT-5.1 (Best quality)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    value={config.models.legacy2D.maxTokens}
                    onChange={(e) => updateModel("legacy2D", { maxTokens: parseInt(e.target.value) || 500 })}
                    min={100}
                    max={4000}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Temperature ({config.models.legacy2D.temperature})</Label>
                  <Input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.models.legacy2D.temperature}
                    onChange={(e) => updateModel("legacy2D", { temperature: parseFloat(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Image Detail</Label>
                  <Select
                    value={config.models.legacy2D.detail}
                    onValueChange={(v) => updateModel("legacy2D", { detail: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Prompts Tab */}
        <TabsContent value="prompts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>3D Model System Prompt</CardTitle>
              <CardDescription>
                Instructions sent to the AI for 3D model analysis. Use {"{{placeholders}}"} for vocabularies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={config.prompts.model3DSystem.systemPrompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updatePrompt("model3DSystem", { systemPrompt: e.target.value })}
                className="font-mono text-sm min-h-[400px]"
                placeholder="System prompt..."
              />
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground">Available placeholders:</span>
                {["objectTypes", "functionalFeatures", "aestheticStyles", "useCases", "projectTypes", "difficulties", "materials3D"].map((p) => (
                  <Badge key={p} variant="secondary" className="text-xs font-mono">
                    {`{{${p}}}`}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3D Model User Prompt Template</CardTitle>
              <CardDescription>
                Template for user message. Use {"{{filename}}"}, {"{{dimensions}}"}, etc. for geometry data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={config.prompts.model3DSystem.userPromptTemplate}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updatePrompt("model3DSystem", { userPromptTemplate: e.target.value })}
                className="font-mono text-sm min-h-[250px]"
                placeholder="User prompt template..."
              />
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground">Available variables:</span>
                {["filename", "dimensions", "volumeEstimate", "surfaceArea", "complexity", "detectedUnit", "aspectRatio", "materialEstimate"].map((p) => (
                  <Badge key={p} variant="secondary" className="text-xs font-mono">
                    {`{{${p}}}`}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2D Design System Prompt</CardTitle>
              <CardDescription>
                Instructions for analyzing 2D designs (SVG, DXF, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={config.prompts.legacy2DSystem.systemPrompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updatePrompt("legacy2DSystem", { systemPrompt: e.target.value })}
                className="font-mono text-sm min-h-[300px]"
                placeholder="System prompt..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vocabulary Tab */}
        <TabsContent value="vocabulary" className="space-y-6">
          <VocabularyEditor
            title="Object Types"
            description="Types of objects/items"
            items={config.tagVocabulary.objectTypes}
            onChange={(items) => updateVocabulary("objectTypes", items)}
          />
          <VocabularyEditor
            title="Functional Features"
            description="Technical/functional characteristics"
            items={config.tagVocabulary.functionalFeatures}
            onChange={(items) => updateVocabulary("functionalFeatures", items)}
          />
          <VocabularyEditor
            title="Aesthetic Styles"
            description="Visual/design styles"
            items={config.tagVocabulary.aestheticStyles}
            onChange={(items) => updateVocabulary("aestheticStyles", items)}
          />
          <VocabularyEditor
            title="Use Cases"
            description="Intended uses/applications"
            items={config.tagVocabulary.useCases}
            onChange={(items) => updateVocabulary("useCases", items)}
          />
          <VocabularyEditor
            title="Size Categories"
            description="Size classifications"
            items={config.tagVocabulary.sizeCategories}
            onChange={(items) => updateVocabulary("sizeCategories", items)}
          />
          <VocabularyEditor
            title="Print Considerations"
            description="3D printing-related tags"
            items={config.tagVocabulary.printConsiderations}
            onChange={(items) => updateVocabulary("printConsiderations", items)}
          />
        </TabsContent>

        {/* Valid Values Tab */}
        <TabsContent value="values" className="space-y-6">
          <VocabularyEditor
            title="Project Types"
            description="Valid project type values for classification"
            items={config.validValues.projectTypes}
            onChange={(items) => updateValidValues("projectTypes", items)}
          />
          <VocabularyEditor
            title="Difficulty Levels"
            description="Valid difficulty values"
            items={config.validValues.difficulties}
            onChange={(items) => updateValidValues("difficulties", items)}
          />
        </TabsContent>

        {/* Display Settings Tab */}
        <TabsContent value="display" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                <CardTitle>Public Display Settings</CardTitle>
              </div>
              <CardDescription>
                Control which metadata fields are shown on the public design pages.
                Unchecked fields will be hidden from visitors.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <DisplaySettingItem
                  id="showDifficulty"
                  label="Difficulty Level"
                  description="Show difficulty rating (Easy, Medium, Hard)"
                  checked={config.displaySettings.showDifficulty}
                  onCheckedChange={(checked) => updateDisplaySetting("showDifficulty", checked)}
                />
                <DisplaySettingItem
                  id="showDimensions"
                  label="Dimensions"
                  description="Show approximate dimensions of the design"
                  checked={config.displaySettings.showDimensions}
                  onCheckedChange={(checked) => updateDisplaySetting("showDimensions", checked)}
                />
                <DisplaySettingItem
                  id="showPrintTime"
                  label="Print Time Estimate"
                  description="Show estimated print time for 3D models"
                  checked={config.displaySettings.showPrintTime}
                  onCheckedChange={(checked) => updateDisplaySetting("showPrintTime", checked)}
                />
                <DisplaySettingItem
                  id="showSupportsRequired"
                  label="Supports Required"
                  description="Show whether supports are needed for printing"
                  checked={config.displaySettings.showSupportsRequired}
                  onCheckedChange={(checked) => updateDisplaySetting("showSupportsRequired", checked)}
                />
                <DisplaySettingItem
                  id="showLayerHeight"
                  label="Recommended Layer Height"
                  description="Show recommended layer height for printing"
                  checked={config.displaySettings.showLayerHeight}
                  onCheckedChange={(checked) => updateDisplaySetting("showLayerHeight", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator />

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Last updated: {new Date(config.lastUpdated).toLocaleString()}
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

// Vocabulary Editor Component
function VocabularyEditor({
  title,
  description,
  items,
  onChange,
}: {
  title: string;
  description: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [newItem, setNewItem] = useState("");

  const addItem = () => {
    const trimmed = newItem.trim().toLowerCase().replace(/\s+/g, "-");
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
      setNewItem("");
    }
  };

  const removeItem = (item: string) => {
    onChange(items.filter((i) => i !== item));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {items.map((item) => (
            <Badge key={item} variant="secondary" className="pr-1">
              {item}
              <button
                onClick={() => removeItem(item)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add new item..."
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
          />
          <Button variant="outline" onClick={addItem} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Display Setting Item Component
function DisplaySettingItem({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="mt-0.5"
      />
      <div className="flex-1">
        <Label
          htmlFor={id}
          className="text-sm font-medium cursor-pointer"
        >
          {label}
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          {description}
        </p>
      </div>
    </div>
  );
}
