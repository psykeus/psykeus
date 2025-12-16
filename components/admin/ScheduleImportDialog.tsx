"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock } from "lucide-react";
import { Spinner } from "@/components/ui/loading-states";

interface ScheduleImportDialogProps {
  jobId: string;
  disabled?: boolean;
}

const DELAY_PRESETS = [
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "4 hours", minutes: 240 },
  { label: "Tomorrow", minutes: 1440 },
];

export function ScheduleImportDialog({ jobId, disabled }: ScheduleImportDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"datetime" | "delay">("delay");

  // Datetime state
  const [datetime, setDatetime] = useState(() => {
    // Default to 1 hour from now
    const date = new Date(Date.now() + 60 * 60 * 1000);
    return date.toISOString().slice(0, 16); // Format for datetime-local input
  });

  // Delay state
  const [delayMinutes, setDelayMinutes] = useState(60);
  const [customDelay, setCustomDelay] = useState("");

  const handleSchedule = async () => {
    setIsScheduling(true);
    setError(null);

    try {
      const body =
        activeTab === "datetime"
          ? { type: "datetime", datetime: new Date(datetime).toISOString() }
          : { type: "delay", delayMinutes };

      const response = await fetch(`/api/admin/import/jobs/${jobId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to schedule job");
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule job");
    } finally {
      setIsScheduling(false);
    }
  };

  const handlePresetClick = (minutes: number) => {
    setDelayMinutes(minutes);
    setCustomDelay("");
  };

  const handleCustomDelayChange = (value: string) => {
    setCustomDelay(value);
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setDelayMinutes(parsed);
    }
  };

  const formatDelayDisplay = () => {
    if (delayMinutes < 60) {
      return `${delayMinutes} minute${delayMinutes === 1 ? "" : "s"}`;
    }
    const hours = Math.floor(delayMinutes / 60);
    const mins = delayMinutes % 60;
    if (mins === 0) {
      return `${hours} hour${hours === 1 ? "" : "s"}`;
    }
    return `${hours}h ${mins}m`;
  };

  const getScheduledTime = () => {
    if (activeTab === "datetime") {
      return new Date(datetime);
    }
    return new Date(Date.now() + delayMinutes * 60 * 1000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Clock className="mr-2 h-4 w-4" />
          Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule Import</DialogTitle>
          <DialogDescription>
            Choose when to start processing this import job.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "datetime" | "delay")}>
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
              {DELAY_PRESETS.map((preset) => (
                <Button
                  key={preset.minutes}
                  variant={delayMinutes === preset.minutes && !customDelay ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetClick(preset.minutes)}
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
                value={customDelay}
                onChange={(e) => handleCustomDelayChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Max: 10080 minutes (7 days)
              </p>
            </div>

            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm">
                <span className="text-muted-foreground">Start in:</span>{" "}
                <span className="font-medium">{formatDelayDisplay()}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Approximately {getScheduledTime().toLocaleString()}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="datetime" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="datetime">Start date and time</Label>
              <Input
                id="datetime"
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm">
                <span className="text-muted-foreground">Scheduled for:</span>{" "}
                <span className="font-medium">
                  {new Date(datetime).toLocaleString()}
                </span>
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={isScheduling}>
            {isScheduling ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Scheduling...
              </>
            ) : (
              "Schedule Import"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
