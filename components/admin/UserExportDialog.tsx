"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Download, Loader2, Users } from "lucide-react";

interface ExportField {
  key: string;
  label: string;
  description: string;
  category: string;
}

interface ExportDialogProps {
  trigger?: React.ReactNode;
}

const DEFAULT_FIELDS = [
  "email",
  "full_name",
  "display_name",
  "role",
  "status",
  "subscription_tier",
  "subscription_status",
  "created_at",
  "email_unsubscribed",
];

export function UserExportDialog({ trigger }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<Record<string, ExportField[]>>({});
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(DEFAULT_FIELDS));
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [filters, setFilters] = useState({
    subscribedOnly: false,
    hasActiveSubscription: false,
  });
  const [userCount, setUserCount] = useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Load available fields
  useEffect(() => {
    if (open) {
      loadFields();
      loadUserCount();
    }
  }, [open]);

  // Reload count when filters change
  useEffect(() => {
    if (open) {
      loadUserCount();
    }
  }, [filters, open]);

  const loadFields = async () => {
    try {
      const res = await fetch("/api/admin/users/export?action=fields");
      const data = await res.json();
      if (data.success) {
        setFields(data.fields);
      }
    } catch (error) {
      console.error("Failed to load export fields:", error);
    }
  };

  const loadUserCount = async () => {
    setIsLoadingCount(true);
    try {
      const params = new URLSearchParams({ action: "count" });
      if (filters.subscribedOnly) params.set("subscribedOnly", "true");
      if (filters.hasActiveSubscription) params.set("hasActiveSubscription", "true");

      const res = await fetch(`/api/admin/users/export?${params}`);
      const data = await res.json();
      if (data.success) {
        setUserCount(data.count);
      }
    } catch (error) {
      console.error("Failed to load user count:", error);
    } finally {
      setIsLoadingCount(false);
    }
  };

  const toggleField = (key: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedFields(newSelected);
  };

  const selectAllInCategory = (category: string) => {
    const categoryFields = fields[category] || [];
    const newSelected = new Set(selectedFields);
    categoryFields.forEach((f) => newSelected.add(f.key));
    setSelectedFields(newSelected);
  };

  const deselectAllInCategory = (category: string) => {
    const categoryFields = fields[category] || [];
    const newSelected = new Set(selectedFields);
    categoryFields.forEach((f) => newSelected.delete(f.key));
    setSelectedFields(newSelected);
  };

  const handleExport = async () => {
    if (selectedFields.size === 0) {
      toast({ title: "Error", description: "Please select at least one field to export", variant: "destructive" });
      return;
    }

    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("format", format);
      params.set("fields", Array.from(selectedFields).join(","));
      if (filters.subscribedOnly) params.set("subscribedOnly", "true");
      if (filters.hasActiveSubscription) params.set("hasActiveSubscription", "true");

      const res = await fetch(`/api/admin/users/export?${params}`);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Export failed");
      }

      // Get filename from header or generate one
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `users-export.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      // Download the file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      const count = res.headers.get("X-Export-Count");
      toast({
        title: "Export complete",
        description: `Exported ${count || userCount} users to ${format.toUpperCase()}`,
      });

      setOpen(false);
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export users",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const categoryLabels: Record<string, string> = {
    basic: "Basic Information",
    subscription: "Subscription Details",
    activity: "Activity Data",
    preferences: "Email Preferences",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Users
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Users</DialogTitle>
          <DialogDescription>
            Export user data to CSV or JSON for use in marketing systems or data analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* User Count */}
          <div className="flex items-center gap-2 rounded-lg border p-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">
              {isLoadingCount ? (
                <Loader2 className="h-4 w-4 animate-spin inline" />
              ) : (
                userCount?.toLocaleString()
              )}
            </span>
            <span className="text-muted-foreground">users will be exported</span>
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Filters</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="subscribedOnly"
                  checked={filters.subscribedOnly}
                  onCheckedChange={(checked) =>
                    setFilters({ ...filters, subscribedOnly: checked === true })
                  }
                />
                <Label htmlFor="subscribedOnly" className="font-normal">
                  Only users who haven&apos;t unsubscribed from emails
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="hasActiveSubscription"
                  checked={filters.hasActiveSubscription}
                  onCheckedChange={(checked) =>
                    setFilters({ ...filters, hasActiveSubscription: checked === true })
                  }
                />
                <Label htmlFor="hasActiveSubscription" className="font-normal">
                  Only users with active subscriptions
                </Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Field Selection */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Select Fields to Export</Label>

            {Object.entries(fields).map(([category, categoryFields]) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{categoryLabels[category] || category}</Label>
                  <div className="space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => selectAllInCategory(category)}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => deselectAllInCategory(category)}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {categoryFields.map((field) => (
                    <div key={field.key} className="flex items-start gap-2">
                      <Checkbox
                        id={field.key}
                        checked={selectedFields.has(field.key)}
                        onCheckedChange={() => toggleField(field.key)}
                      />
                      <div className="grid gap-0.5">
                        <Label htmlFor={field.key} className="font-normal text-sm">
                          {field.label}
                        </Label>
                        <span className="text-xs text-muted-foreground">{field.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as "csv" | "json")}>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv" className="font-normal">
                    CSV
                    <Badge variant="secondary" className="ml-2">
                      Best for Excel/Sheets
                    </Badge>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="json" id="json" />
                  <Label htmlFor="json" className="font-normal">
                    JSON
                    <Badge variant="secondary" className="ml-2">
                      Best for APIs
                    </Badge>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting || selectedFields.size === 0}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export {userCount?.toLocaleString()} Users
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
