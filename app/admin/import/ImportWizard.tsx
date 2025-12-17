"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/loading-states";
import {
  FolderOpen,
  Search,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Play,
  FileType,
  Layers,
  Copy,
  Sparkles,
  Eye,
  Settings2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  HelpCircle,
  Zap,
  Shield,
  FolderTree,
  RefreshCw,
  ImageIcon,
  GripVertical,
  Clock,
  Calendar,
} from "lucide-react";
import type { ScanResult, DetectedProjectPreview, ProcessingOptions, ScheduleImportOptions } from "@/lib/types/import";
import { DEFAULT_PROCESSING_OPTIONS } from "@/lib/types/import";

type WizardStep = "source" | "scan" | "review" | "options" | "processing";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "scan", label: "Scan" },
  { key: "review", label: "Review" },
  { key: "options", label: "Options" },
  { key: "processing", label: "Import" },
];

export function ImportWizard() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<WizardStep>("source");
  const [sourcePath, setSourcePath] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [options, setOptions] = useState<ProcessingOptions>(DEFAULT_PROCESSING_OPTIONS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCreatingJob, setIsCreatingJob] = useState(false);

  // Scheduling state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleType, setScheduleType] = useState<"delay" | "datetime">("delay");
  const [scheduleDelayMinutes, setScheduleDelayMinutes] = useState(60);
  const [scheduleDatetime, setScheduleDatetime] = useState(() => {
    const date = new Date(Date.now() + 60 * 60 * 1000);
    return date.toISOString().slice(0, 16);
  });

  const handleScan = useCallback(async () => {
    if (!sourcePath.trim()) return;

    setIsScanning(true);
    setScanError(null);

    try {
      const response = await fetch("/api/admin/import/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_path: sourcePath.trim(),
          compute_hashes: false, // Skip hashes for fast scan; computed during import
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Scan failed");
      }

      const result: ScanResult = await response.json();
      setScanResult(result);

      // Select all projects by default
      const allProjectNames = new Set(result.detected_projects.map((p) => p.inferred_name));
      setSelectedProjects(allProjectNames);

      setStep("review");
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Unknown error");
      setStep("source"); // Go back to source step to show error
    } finally {
      setIsScanning(false);
    }
  }, [sourcePath]);

  const handleCreateJob = useCallback(async (startImmediately: boolean = true) => {
    if (!scanResult) return;

    setIsCreatingJob(true);

    // Get the full project info for selected projects (not just flattened files)
    const selectedProjectsData = scanResult.detected_projects
      .filter((p) => selectedProjects.has(p.inferred_name));

    try {
      // Create the import job
      const response = await fetch("/api/admin/import/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_type: "folder",
          source_path: sourcePath.trim(),
          generate_previews: options.generate_previews,
          generate_ai_metadata: options.generate_ai_metadata,
          detect_duplicates: options.detect_duplicates,
          auto_publish: options.auto_publish,
          // Pass full project info to preserve grouping
          detected_projects: selectedProjectsData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create job");
      }

      const job = await response.json();

      // If scheduling, schedule the job instead of starting immediately
      if (scheduleEnabled && !startImmediately) {
        const scheduleBody: ScheduleImportOptions = scheduleType === "datetime"
          ? { type: "datetime", datetime: new Date(scheduleDatetime).toISOString() }
          : { type: "delay", delayMinutes: scheduleDelayMinutes };

        const scheduleResponse = await fetch(`/api/admin/import/jobs/${job.id}/schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scheduleBody),
        });

        if (!scheduleResponse.ok) {
          const data = await scheduleResponse.json();
          throw new Error(data.error || "Failed to schedule job");
        }

        const scheduleData = await scheduleResponse.json();

        toast({
          title: "Import Scheduled",
          description: `Import scheduled for ${new Date(scheduleData.scheduled_at).toLocaleString()}`,
        });

        router.push(`/admin/import/jobs/${job.id}`);
        return;
      }

      toast({
        title: "Job Created",
        description: `Starting import of ${selectedProjects.size} project(s)...`,
      });

      // Start the job with all processing options
      const startResponse = await fetch(`/api/admin/import/jobs/${job.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Advanced duplicate detection options
          near_duplicate_threshold: options.near_duplicate_threshold,
          exact_duplicates_only: options.exact_duplicates_only,
          // Project detection options
          enable_project_detection: options.enable_project_detection,
          cross_folder_detection: options.cross_folder_detection,
          project_confidence_threshold: options.project_confidence_threshold,
          // Performance options
          concurrency: options.concurrency,
          checkpoint_interval: options.checkpoint_interval,
          // Error handling options
          max_retries: options.max_retries,
          skip_failed_files: options.skip_failed_files,
          // Preview settings
          preview_type_priority: options.preview_type_priority,
        }),
      });

      if (!startResponse.ok) {
        const data = await startResponse.json();
        throw new Error(data.error || "Failed to start job");
      }

      toast({
        title: "Import Started",
        description: `Processing ${selectedProjects.size} project(s). Redirecting to progress page...`,
      });

      // Navigate to job details
      router.push(`/admin/import/jobs/${job.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setScanError(errorMessage);
      setIsCreatingJob(false);
      toast({
        title: "Import Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [scanResult, sourcePath, options, router, selectedProjects, toast, scheduleEnabled, scheduleType, scheduleDatetime, scheduleDelayMinutes]);

  const toggleProject = (name: string) => {
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const selectAllProjects = () => {
    if (scanResult) {
      setSelectedProjects(new Set(scanResult.detected_projects.map((p) => p.inferred_name)));
    }
  };

  const deselectAllProjects = () => {
    setSelectedProjects(new Set());
  };

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Import Wizard</CardTitle>
        <CardDescription>
          Follow the steps to import designs from a local folder
        </CardDescription>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 mt-4">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  i < currentStepIndex
                    ? "bg-green-500 text-white"
                    : i === currentStepIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < currentStepIndex ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`ml-2 text-sm ${
                  i === currentStepIndex ? "font-medium" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <Separator className="w-8 mx-4" orientation="horizontal" />
              )}
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step 1: Source Selection */}
        {step === "source" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-medium">
              <FolderOpen className="h-5 w-5" />
              Select Source Directory
            </div>
            <p className="text-sm text-muted-foreground">
              Enter the full path to the folder containing your design files. The folder will be
              scanned recursively.
            </p>
            <div className="space-y-2">
              <Label htmlFor="source-path">Folder Path</Label>
              <Input
                id="source-path"
                placeholder="/path/to/designs"
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
              />
            </div>
            {scanError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {scanError}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Scanning */}
        {step === "scan" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-medium">
              <Search className="h-5 w-5" />
              Scanning Directory
            </div>
            <div className="flex flex-col items-center justify-center py-12">
              <Spinner size="lg" />
              <p className="mt-4 text-muted-foreground">Scanning files and detecting projects...</p>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === "review" && scanResult && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-lg font-medium">
              <Layers className="h-5 w-5" />
              Review Scan Results
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{scanResult.total_files.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Total Files</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{scanResult.detected_projects.length}</div>
                <div className="text-xs text-muted-foreground">Detected Projects</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{scanResult.duplicate_count}</div>
                <div className="text-xs text-muted-foreground">Duplicates Found</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">
                  {(scanResult.total_size_bytes / 1024 / 1024).toFixed(1)} MB
                </div>
                <div className="text-xs text-muted-foreground">Total Size</div>
              </div>
            </div>

            {/* File Types Breakdown */}
            <div className="space-y-2">
              <div className="text-sm font-medium">File Types</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(scanResult.file_types).map(([ext, count]) => (
                  <Badge key={ext} variant="secondary">
                    <FileType className="h-3 w-3 mr-1" />
                    {ext}: {count}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Detected Projects */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Detected Projects</div>
                <div className="space-x-2">
                  <Button variant="ghost" size="sm" onClick={selectAllProjects}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={deselectAllProjects}>
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
                {scanResult.detected_projects.map((project) => (
                  <ProjectRow
                    key={project.inferred_name}
                    project={project}
                    selected={selectedProjects.has(project.inferred_name)}
                    onToggle={() => toggleProject(project.inferred_name)}
                  />
                ))}
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedProjects.size} of {scanResult.detected_projects.length} projects selected
              </div>
            </div>

            {scanResult.errors.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-destructive">
                  {scanResult.errors.length} Errors
                </div>
                <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground bg-muted rounded p-2">
                  {scanResult.errors.slice(0, 10).map((err, i) => (
                    <div key={i}>
                      {err.path}: {err.error}
                    </div>
                  ))}
                  {scanResult.errors.length > 10 && (
                    <div className="mt-1">...and {scanResult.errors.length - 10} more</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Options */}
        {step === "options" && (
          <TooltipProvider>
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-lg font-medium">
                <Settings2 className="h-5 w-5" />
                Configure Import Options
              </div>

              {/* Core Options */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Core Features
                </h3>

                <OptionRow
                  id="generate-previews"
                  icon={<Eye className="h-4 w-4" />}
                  label="Generate Previews"
                  description="Create thumbnail images for all design files. Required for visual browsing and near-duplicate detection. Supports SVG, DXF, STL, OBJ, GLTF, 3MF, and image files."
                  checked={options.generate_previews}
                  onChange={(checked) =>
                    setOptions((prev) => ({ ...prev, generate_previews: checked }))
                  }
                />

                <OptionRow
                  id="detect-duplicates"
                  icon={<Copy className="h-4 w-4" />}
                  label="Detect Duplicates"
                  description="Skip files that already exist in the library. Uses SHA-256 hash for exact matches and perceptual hash (pHash) for visually similar files. Prevents importing the same design multiple times."
                  checked={options.detect_duplicates}
                  onChange={(checked) =>
                    setOptions((prev) => ({ ...prev, detect_duplicates: checked }))
                  }
                />

                <OptionRow
                  id="generate-ai"
                  icon={<Sparkles className="h-4 w-4" />}
                  label="Generate AI Metadata"
                  description="Use OpenAI Vision to analyze designs and generate titles, descriptions, tags, and categorization. Provides better searchability but slower processing and uses API credits."
                  checked={options.generate_ai_metadata}
                  onChange={(checked) =>
                    setOptions((prev) => ({ ...prev, generate_ai_metadata: checked }))
                  }
                  badge="Uses API Credits"
                />

                <OptionRow
                  id="auto-publish"
                  icon={<CheckCircle className="h-4 w-4" />}
                  label="Auto-Publish Designs"
                  description="Automatically make imported designs visible to all users. If disabled, designs are imported as drafts requiring manual review and publishing."
                  checked={options.auto_publish}
                  onChange={(checked) =>
                    setOptions((prev) => ({ ...prev, auto_publish: checked }))
                  }
                />
              </div>

              <Separator />

              {/* Scheduling Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Scheduling
                </h3>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="schedule-enabled"
                    checked={scheduleEnabled}
                    onCheckedChange={(checked) => setScheduleEnabled(!!checked)}
                    className="mt-1"
                  />
                  <div className="grid gap-1 flex-1">
                    <Label
                      htmlFor="schedule-enabled"
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Clock className="h-4 w-4" />
                      Schedule Import
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Schedule this import to run at a later time instead of starting immediately
                    </p>
                  </div>
                </div>

                {scheduleEnabled && (
                  <div className="ml-6 space-y-4 pt-2">
                    <Tabs value={scheduleType} onValueChange={(v) => setScheduleType(v as "delay" | "datetime")}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="delay">
                          <Clock className="mr-2 h-4 w-4" />
                          Delay
                        </TabsTrigger>
                        <TabsTrigger value="datetime">
                          <Calendar className="mr-2 h-4 w-4" />
                          Date & Time
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="delay" className="space-y-4 pt-4">
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "15 min", minutes: 15 },
                            { label: "30 min", minutes: 30 },
                            { label: "1 hour", minutes: 60 },
                            { label: "2 hours", minutes: 120 },
                            { label: "4 hours", minutes: 240 },
                            { label: "Tomorrow", minutes: 1440 },
                          ].map((preset) => (
                            <Button
                              key={preset.minutes}
                              type="button"
                              variant={scheduleDelayMinutes === preset.minutes ? "default" : "outline"}
                              size="sm"
                              onClick={() => setScheduleDelayMinutes(preset.minutes)}
                            >
                              {preset.label}
                            </Button>
                          ))}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="customDelay">Custom delay (minutes)</Label>
                          <Input
                            id="customDelay"
                            type="number"
                            min="1"
                            max="10080"
                            placeholder="Enter minutes..."
                            value={scheduleDelayMinutes}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val > 0) {
                                setScheduleDelayMinutes(val);
                              }
                            }}
                          />
                        </div>

                        <div className="rounded-lg bg-muted p-3">
                          <p className="text-sm">
                            <span className="text-muted-foreground">Start in:</span>{" "}
                            <span className="font-medium">
                              {scheduleDelayMinutes < 60
                                ? `${scheduleDelayMinutes} minute${scheduleDelayMinutes === 1 ? "" : "s"}`
                                : scheduleDelayMinutes % 60 === 0
                                ? `${Math.floor(scheduleDelayMinutes / 60)} hour${Math.floor(scheduleDelayMinutes / 60) === 1 ? "" : "s"}`
                                : `${Math.floor(scheduleDelayMinutes / 60)}h ${scheduleDelayMinutes % 60}m`}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Approximately {new Date(Date.now() + scheduleDelayMinutes * 60 * 1000).toLocaleString()}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="datetime" className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label htmlFor="datetime">Start date and time</Label>
                          <Input
                            id="datetime"
                            type="datetime-local"
                            value={scheduleDatetime}
                            onChange={(e) => setScheduleDatetime(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                          />
                        </div>

                        <div className="rounded-lg bg-muted p-3">
                          <p className="text-sm">
                            <span className="text-muted-foreground">Scheduled for:</span>{" "}
                            <span className="font-medium">
                              {new Date(scheduleDatetime).toLocaleString()}
                            </span>
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </div>

              <Separator />

              {/* Advanced Settings Collapsible */}
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                    <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      <Settings2 className="h-4 w-4" />
                      Advanced Settings
                    </span>
                    {showAdvanced ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-6 pt-4">
                  {/* Duplicate Detection Settings */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-500" />
                      Duplicate Detection
                    </h4>

                    <div className="ml-6 space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label className="flex items-center gap-2">
                              Near-Duplicate Threshold
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>
                                    Files with visual similarity above this threshold are considered duplicates.
                                    Lower values catch more duplicates but may flag similar-but-distinct designs.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Similarity percentage required to flag as duplicate
                            </p>
                          </div>
                          <Badge variant="outline" className="font-mono">
                            {options.near_duplicate_threshold}%
                          </Badge>
                        </div>
                        <Slider
                          value={[options.near_duplicate_threshold]}
                          onValueChange={([value]) =>
                            setOptions((prev) => ({ ...prev, near_duplicate_threshold: value }))
                          }
                          min={70}
                          max={100}
                          step={1}
                          disabled={!options.detect_duplicates}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Aggressive (70%)</span>
                          <span>Default (85%)</span>
                          <span>Strict (100%)</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="exact-only" className="flex items-center gap-2">
                            Exact Duplicates Only
                            <Tooltip>
                              <TooltipTrigger>
                                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>
                                  Only detect files with identical content (same SHA-256 hash).
                                  Disables visual similarity detection. Faster but may miss
                                  visually identical files with minor differences.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Skip near-duplicate detection (faster processing)
                          </p>
                        </div>
                        <Switch
                          id="exact-only"
                          checked={options.exact_duplicates_only}
                          onCheckedChange={(checked) =>
                            setOptions((prev) => ({ ...prev, exact_duplicates_only: checked }))
                          }
                          disabled={!options.detect_duplicates}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Project Detection Settings */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <FolderTree className="h-4 w-4 text-green-500" />
                      Project Detection
                    </h4>

                    <div className="ml-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="project-detection" className="flex items-center gap-2">
                            Enable Project Detection
                            <Tooltip>
                              <TooltipTrigger>
                                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>
                                  Automatically groups related files into single designs.
                                  Detects variants (same design in different formats),
                                  components (parts of a multi-file design), and
                                  projects (files organized in folders).
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Group related files (SVG+DXF+PNG) into single designs
                          </p>
                        </div>
                        <Switch
                          id="project-detection"
                          checked={options.enable_project_detection}
                          onCheckedChange={(checked) =>
                            setOptions((prev) => ({ ...prev, enable_project_detection: checked }))
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="cross-folder" className="flex items-center gap-2">
                            Cross-Folder Detection
                            <Tooltip>
                              <TooltipTrigger>
                                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>
                                  Detects when files are organized by type in separate folders.
                                  For example: SVG/Design.svg, DXF/Design.dxf, PNG/Design.png
                                  would be grouped as one &quot;Design&quot; project.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Match files across type-organized folders
                          </p>
                        </div>
                        <Switch
                          id="cross-folder"
                          checked={options.cross_folder_detection}
                          onCheckedChange={(checked) =>
                            setOptions((prev) => ({ ...prev, cross_folder_detection: checked }))
                          }
                          disabled={!options.enable_project_detection}
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label className="flex items-center gap-2">
                              Grouping Confidence Threshold
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>
                                    Minimum confidence required to group files as a project.
                                    Higher values reduce false groupings but may miss some
                                    legitimate projects. Lower values group more aggressively.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Minimum confidence to group files together
                            </p>
                          </div>
                          <Badge variant="outline" className="font-mono">
                            {Math.round(options.project_confidence_threshold * 100)}%
                          </Badge>
                        </div>
                        <Slider
                          value={[options.project_confidence_threshold * 100]}
                          onValueChange={([value]) =>
                            setOptions((prev) => ({
                              ...prev,
                              project_confidence_threshold: value / 100,
                            }))
                          }
                          min={50}
                          max={100}
                          step={5}
                          disabled={!options.enable_project_detection}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Aggressive (50%)</span>
                          <span>Default (70%)</span>
                          <span>Strict (100%)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Performance Settings */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      Performance
                    </h4>

                    <div className="ml-6 space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label className="flex items-center gap-2">
                              Concurrency
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>
                                    Number of files to process simultaneously.
                                    Higher values = faster imports but more CPU/memory usage.
                                    Reduce if you experience system slowdown.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Files processed simultaneously
                            </p>
                          </div>
                          <Badge variant="outline" className="font-mono">
                            {options.concurrency} workers
                          </Badge>
                        </div>
                        <Slider
                          value={[options.concurrency]}
                          onValueChange={([value]) =>
                            setOptions((prev) => ({ ...prev, concurrency: value }))
                          }
                          min={1}
                          max={20}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Slow (1)</span>
                          <span>Default (5)</span>
                          <span>Fast (20)</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label className="flex items-center gap-2">
                              Checkpoint Interval
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>
                                    Progress is saved every N files. Lower values allow
                                    resuming from a more recent point if interrupted,
                                    but slightly reduce performance.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Save progress every N files
                            </p>
                          </div>
                          <Badge variant="outline" className="font-mono">
                            Every {options.checkpoint_interval} files
                          </Badge>
                        </div>
                        <Slider
                          value={[options.checkpoint_interval]}
                          onValueChange={([value]) =>
                            setOptions((prev) => ({ ...prev, checkpoint_interval: value }))
                          }
                          min={5}
                          max={100}
                          step={5}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Frequent (5)</span>
                          <span>Default (10)</span>
                          <span>Rare (100)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Error Handling Settings */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-orange-500" />
                      Error Handling
                    </h4>

                    <div className="ml-6 space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label className="flex items-center gap-2">
                              Maximum Retries
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>
                                    Number of times to retry processing a file if it fails.
                                    Helps with transient errors like network issues.
                                    Set to 0 to disable retries entirely.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Retry failed files up to N times
                            </p>
                          </div>
                          <Badge variant="outline" className="font-mono">
                            {options.max_retries} {options.max_retries === 1 ? "retry" : "retries"}
                          </Badge>
                        </div>
                        <Slider
                          value={[options.max_retries]}
                          onValueChange={([value]) =>
                            setOptions((prev) => ({ ...prev, max_retries: value }))
                          }
                          min={0}
                          max={10}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>None (0)</span>
                          <span>Default (3)</span>
                          <span>Aggressive (10)</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="skip-failed" className="flex items-center gap-2">
                            Continue on Failure
                            <Tooltip>
                              <TooltipTrigger>
                                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>
                                  When enabled, the import continues even if some files fail.
                                  Failed files are logged for review. When disabled, the entire
                                  job stops when a file fails after all retries.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Skip failed files instead of stopping the job
                          </p>
                        </div>
                        <Switch
                          id="skip-failed"
                          checked={options.skip_failed_files}
                          onCheckedChange={(checked) =>
                            setOptions((prev) => ({ ...prev, skip_failed_files: checked }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Preview Priority Settings */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-purple-500" />
                      Preview Priority
                    </h4>

                    <div className="ml-6 space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label className="flex items-center gap-2">
                              File Type Priority
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>
                                    When a project contains multiple file types (e.g., SVG + DXF + PNG),
                                    this determines which file type is used as the primary preview source.
                                    Drag to reorder, or click the arrows to move items.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Determines which file type is used for the preview image
                            </p>
                          </div>
                        </div>
                        <PreviewPriorityList
                          priority={options.preview_type_priority}
                          onChange={(newPriority) =>
                            setOptions((prev) => ({ ...prev, preview_type_priority: newPriority }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Reset to Defaults */}
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOptions(DEFAULT_PROCESSING_OPTIONS)}
                      className="w-full"
                    >
                      Reset to Default Settings
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {scanError && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {scanError}
                </div>
              )}
            </div>
          </TooltipProvider>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        {/* Back Button */}
        {step !== "source" && step !== "processing" && (
          <Button
            variant="outline"
            onClick={() => {
              const prevIndex = currentStepIndex - 1;
              if (prevIndex >= 0) {
                setStep(STEPS[prevIndex].key);
              }
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        )}
        {step === "source" && <div />}

        {/* Next/Action Button */}
        {step === "source" && (
          <Button
            onClick={() => {
              setStep("scan");
              handleScan();
            }}
            disabled={!sourcePath.trim() || isScanning}
          >
            {isScanning ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Scan Directory
          </Button>
        )}

        {step === "review" && (
          <Button onClick={() => setStep("options")} disabled={selectedProjects.size === 0}>
            Configure Options
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}

        {step === "options" && (
          <div className="flex gap-2">
            {scheduleEnabled ? (
              <>
                <Button variant="outline" onClick={() => handleCreateJob(true)} disabled={isCreatingJob}>
                  {isCreatingJob ? (
                    <Spinner size="sm" className="mr-2" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Start Now
                </Button>
                <Button onClick={() => handleCreateJob(false)} disabled={isCreatingJob}>
                  {isCreatingJob ? (
                    <Spinner size="sm" className="mr-2" />
                  ) : (
                    <Clock className="mr-2 h-4 w-4" />
                  )}
                  Schedule Import
                </Button>
              </>
            ) : (
              <Button onClick={() => handleCreateJob(true)} disabled={isCreatingJob}>
                {isCreatingJob ? (
                  <Spinner size="sm" className="mr-2" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Start Import
              </Button>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

function ProjectRow({
  project,
  selected,
  onToggle,
}: {
  project: DetectedProjectPreview;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted/50 ${
        selected ? "bg-primary/5" : ""
      }`}
      onClick={onToggle}
    >
      <Checkbox checked={selected} />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{project.inferred_name}</div>
        <div className="text-xs text-muted-foreground">
          {project.files.length} file{project.files.length !== 1 ? "s" : ""} &middot;{" "}
          {project.detection_reason} &middot; {Math.round(project.confidence * 100)}% confidence
        </div>
      </div>
      {project.primary_file && (
        <Badge variant="outline" className="text-xs">
          {project.primary_file.file_type.toUpperCase()}
        </Badge>
      )}
    </div>
  );
}

/**
 * Reusable option row component for the core settings
 */
function OptionRow({
  id,
  icon,
  label,
  description,
  checked,
  onChange,
  badge,
  disabled,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  badge?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start space-x-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(checked) => onChange(!!checked)}
        disabled={disabled}
        className="mt-1"
      />
      <div className="grid gap-1 flex-1">
        <Label
          htmlFor={id}
          className={`flex items-center gap-2 cursor-pointer ${disabled ? "opacity-50" : ""}`}
        >
          {icon}
          {label}
          {badge && (
            <Badge variant="secondary" className="text-xs font-normal">
              {badge}
            </Badge>
          )}
        </Label>
        <p className={`text-xs text-muted-foreground ${disabled ? "opacity-50" : ""}`}>
          {description}
        </p>
      </div>
    </div>
  );
}

/**
 * Preview priority list with drag-like reordering
 */
function PreviewPriorityList({
  priority,
  onChange,
}: {
  priority: string[];
  onChange: (newPriority: string[]) => void;
}) {
  const moveUp = (index: number) => {
    if (index === 0) return;
    const newPriority = [...priority];
    [newPriority[index - 1], newPriority[index]] = [newPriority[index], newPriority[index - 1]];
    onChange(newPriority);
  };

  const moveDown = (index: number) => {
    if (index === priority.length - 1) return;
    const newPriority = [...priority];
    [newPriority[index], newPriority[index + 1]] = [newPriority[index + 1], newPriority[index]];
    onChange(newPriority);
  };

  return (
    <div className="border rounded-lg divide-y bg-card">
      {priority.map((type, index) => (
        <div
          key={type}
          className="flex items-center gap-2 px-3 py-2 text-sm"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 font-mono uppercase">{type}</span>
          <Badge variant="outline" className="text-xs">
            #{index + 1}
          </Badge>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => moveUp(index)}
              disabled={index === 0}
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => moveDown(index)}
              disabled={index === priority.length - 1}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
