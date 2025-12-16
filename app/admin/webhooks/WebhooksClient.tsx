"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Webhook,
  Plus,
  Trash2,
  Play,
  Pencil,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";
import { PageLoading, Spinner } from "@/components/ui/loading-states";
import { InlineError } from "@/components/ui/error-states";
import { EmptyState } from "@/components/ui/empty-states";
import type { Webhook as WebhookType, WebhookDelivery } from "@/lib/webhooks";

interface WebhookStats {
  totalWebhooks: number;
  activeWebhooks: number;
  recentDeliveries: number;
  successRate: number;
}

interface WebhooksResponse {
  enabled: boolean;
  webhooks: WebhookType[];
  stats: WebhookStats | null;
  availableEvents: string[];
  message?: string;
}

interface WebhookDetailResponse {
  webhook: WebhookType;
  deliveries: WebhookDelivery[];
}

export function WebhooksClient() {
  const [data, setData] = useState<WebhooksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [editWebhook, setEditWebhook] = useState<WebhookType | null>(null);
  const [deleteWebhook, setDeleteWebhook] = useState<WebhookType | null>(null);
  const [detailWebhook, setDetailWebhook] = useState<WebhookType | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);

  // Form states
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formSecret, setFormSecret] = useState("");
  const [formHeaders, setFormHeaders] = useState("");
  const [formRetryCount, setFormRetryCount] = useState("3");
  const [formTimeout, setFormTimeout] = useState("5000");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/webhooks");
      if (!res.ok) throw new Error("Failed to fetch webhooks");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const resetForm = () => {
    setFormName("");
    setFormUrl("");
    setFormEvents([]);
    setFormSecret("");
    setFormHeaders("");
    setFormRetryCount("3");
    setFormTimeout("5000");
    setShowSecret(false);
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (webhook: WebhookType) => {
    setFormName(webhook.name);
    setFormUrl(webhook.url);
    setFormEvents(webhook.events);
    setFormSecret("");
    setFormHeaders(
      webhook.headers ? Object.entries(webhook.headers).map(([k, v]) => `${k}: ${v}`).join("\n") : ""
    );
    setFormRetryCount(webhook.retry_count.toString());
    setFormTimeout(webhook.timeout_ms.toString());
    setEditWebhook(webhook);
    setShowSecret(false);
  };

  const openDetail = async (webhook: WebhookType) => {
    setDetailWebhook(webhook);
    try {
      const res = await fetch(`/api/admin/webhooks/${webhook.id}`);
      if (res.ok) {
        const json: WebhookDetailResponse = await res.json();
        setDeliveries(json.deliveries);
      }
    } catch {
      // Ignore errors
    }
  };

  const handleCreate = async () => {
    if (!formName || !formUrl || formEvents.length === 0) {
      setError("Name, URL, and at least one event are required");
      return;
    }

    setSaving(true);
    try {
      const headers: Record<string, string> = {};
      if (formHeaders.trim()) {
        formHeaders.split("\n").forEach((line) => {
          const [key, ...rest] = line.split(":");
          if (key && rest.length > 0) {
            headers[key.trim()] = rest.join(":").trim();
          }
        });
      }

      const res = await fetch("/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          url: formUrl,
          events: formEvents,
          secret: formSecret || undefined,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
          retry_count: parseInt(formRetryCount, 10),
          timeout_ms: parseInt(formTimeout, 10),
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to create webhook");
      }

      setCreateOpen(false);
      resetForm();
      await fetchWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create webhook");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editWebhook) return;

    setSaving(true);
    try {
      const headers: Record<string, string> = {};
      if (formHeaders.trim()) {
        formHeaders.split("\n").forEach((line) => {
          const [key, ...rest] = line.split(":");
          if (key && rest.length > 0) {
            headers[key.trim()] = rest.join(":").trim();
          }
        });
      }

      const body: Record<string, unknown> = {
        name: formName,
        url: formUrl,
        events: formEvents,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        retry_count: parseInt(formRetryCount, 10),
        timeout_ms: parseInt(formTimeout, 10),
      };

      if (formSecret) {
        body.secret = formSecret;
      }

      const res = await fetch(`/api/admin/webhooks/${editWebhook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to update webhook");
      }

      setEditWebhook(null);
      resetForm();
      await fetchWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update webhook");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteWebhook) return;

    try {
      const res = await fetch(`/api/admin/webhooks/${deleteWebhook.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to delete webhook");
      }

      setDeleteWebhook(null);
      await fetchWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete webhook");
    }
  };

  const handleToggleActive = async (webhook: WebhookType) => {
    try {
      const res = await fetch(`/api/admin/webhooks/${webhook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !webhook.is_active }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to update webhook");
      }

      await fetchWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle webhook");
    }
  };

  const handleTest = async (webhook: WebhookType) => {
    setTesting(webhook.id);
    try {
      const res = await fetch(`/api/admin/webhooks/${webhook.id}`, {
        method: "POST",
      });
      const json = await res.json();

      if (json.success) {
        await fetchWebhooks();
      } else {
        setError(`Test failed: ${json.error || "Unknown error"}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(null);
    }
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
  };

  const toggleEvent = (event: string) => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  if (loading) {
    return <PageLoading message="Loading webhooks..." />;
  }

  if (!data?.enabled) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Webhooks Disabled</h3>
          <p className="text-muted-foreground mb-4">
            Enable webhooks in Feature Flags to configure webhook endpoints.
          </p>
          <Button variant="outline" asChild>
            <a href="/admin/features">Go to Feature Flags</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <InlineError message={error} onDismiss={() => setError(null)} />
      )}

      {/* Stats */}
      {data.stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Webhooks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.totalWebhooks}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Webhooks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {data.stats.activeWebhooks}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Deliveries (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.recentDeliveries}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <span className={data.stats.successRate >= 90 ? "text-green-600" : data.stats.successRate >= 70 ? "text-yellow-600" : "text-red-600"}>
                  {data.stats.successRate}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Webhooks List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhooks
            </CardTitle>
            <CardDescription>
              Configure endpoints to receive event notifications
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchWebhooks}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.webhooks.length === 0 ? (
            <EmptyState
              icon={Webhook}
              title="No webhooks configured"
              description="Click 'Add Webhook' to create your first webhook endpoint."
            />
          ) : (
            <div className="space-y-4">
              {data.webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{webhook.name}</span>
                      <Badge variant={webhook.is_active ? "default" : "secondary"}>
                        {webhook.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {webhook.last_status !== null && (
                        <Badge
                          variant={
                            webhook.last_status >= 200 && webhook.last_status < 300
                              ? "outline"
                              : "destructive"
                          }
                          className="text-xs"
                        >
                          {webhook.last_status >= 200 && webhook.last_status < 300 ? (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {webhook.last_status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {webhook.url}
                    </p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {webhook.events.map((event) => (
                        <Badge key={event} variant="secondary" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                    </div>
                    {webhook.last_triggered_at && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Last triggered: {new Date(webhook.last_triggered_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Switch
                      checked={webhook.is_active}
                      onCheckedChange={() => handleToggleActive(webhook)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(webhook)}
                      disabled={testing === webhook.id || !webhook.is_active}
                    >
                      {testing === webhook.id ? (
                        <Spinner size="sm" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDetail(webhook)}
                    >
                      <Activity className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(webhook)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteWebhook(webhook)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Webhook</DialogTitle>
            <DialogDescription>
              Configure a new webhook endpoint to receive event notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="My Webhook"
              />
            </div>
            <div>
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://example.com/webhook"
              />
            </div>
            <div>
              <Label>Events</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {data.availableEvents.map((event) => (
                  <label
                    key={event}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formEvents.includes(event)}
                      onChange={() => toggleEvent(event)}
                      className="rounded"
                    />
                    <span className="text-sm">{event}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="secret">Secret (optional)</Label>
              <Input
                id="secret"
                type={showSecret ? "text" : "password"}
                value={formSecret}
                onChange={(e) => setFormSecret(e.target.value)}
                placeholder="Leave empty to auto-generate"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Used to sign webhook payloads. Min 16 characters if provided.
              </p>
            </div>
            <div>
              <Label htmlFor="headers">Custom Headers (optional)</Label>
              <textarea
                id="headers"
                value={formHeaders}
                onChange={(e) => setFormHeaders(e.target.value)}
                placeholder="Authorization: Bearer token&#10;X-Custom-Header: value"
                className="w-full h-20 px-3 py-2 text-sm border rounded-md bg-background"
              />
              <p className="text-xs text-muted-foreground mt-1">
                One header per line in &quot;Key: Value&quot; format.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="retry">Retry Count</Label>
                <Input
                  id="retry"
                  type="number"
                  min="0"
                  max="10"
                  value={formRetryCount}
                  onChange={(e) => setFormRetryCount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="timeout">Timeout (ms)</Label>
                <Input
                  id="timeout"
                  type="number"
                  min="1000"
                  max="30000"
                  value={formTimeout}
                  onChange={(e) => setFormTimeout(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editWebhook} onOpenChange={(open) => !open && setEditWebhook(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Webhook</DialogTitle>
            <DialogDescription>
              Update the webhook configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-url">URL</Label>
              <Input
                id="edit-url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
              />
            </div>
            <div>
              <Label>Events</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {data.availableEvents.map((event) => (
                  <label
                    key={event}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formEvents.includes(event)}
                      onChange={() => toggleEvent(event)}
                      className="rounded"
                    />
                    <span className="text-sm">{event}</span>
                  </label>
                ))}
              </div>
            </div>
            {editWebhook?.secret && (
              <div>
                <Label>Current Secret</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 px-3 py-2 text-sm bg-muted rounded-md truncate">
                    {showSecret ? editWebhook.secret : "••••••••••••••••"}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copySecret(editWebhook.secret!)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="edit-secret">New Secret (optional)</Label>
              <Input
                id="edit-secret"
                type="password"
                value={formSecret}
                onChange={(e) => setFormSecret(e.target.value)}
                placeholder="Leave empty to keep current"
              />
            </div>
            <div>
              <Label htmlFor="edit-headers">Custom Headers (optional)</Label>
              <textarea
                id="edit-headers"
                value={formHeaders}
                onChange={(e) => setFormHeaders(e.target.value)}
                placeholder="Authorization: Bearer token&#10;X-Custom-Header: value"
                className="w-full h-20 px-3 py-2 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-retry">Retry Count</Label>
                <Input
                  id="edit-retry"
                  type="number"
                  min="0"
                  max="10"
                  value={formRetryCount}
                  onChange={(e) => setFormRetryCount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-timeout">Timeout (ms)</Label>
                <Input
                  id="edit-timeout"
                  type="number"
                  min="1000"
                  max="30000"
                  value={formTimeout}
                  onChange={(e) => setFormTimeout(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditWebhook(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteWebhook} onOpenChange={(open) => !open && setDeleteWebhook(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteWebhook?.name}&quot;? This action cannot
              be undone and all delivery history will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail/Deliveries Dialog */}
      <Dialog open={!!detailWebhook} onOpenChange={(open) => !open && setDetailWebhook(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {detailWebhook?.name}
            </DialogTitle>
            <DialogDescription>{detailWebhook?.url}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="deliveries">
            <TabsList>
              <TabsTrigger value="deliveries">Recent Deliveries</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
            </TabsList>
            <TabsContent value="deliveries" className="mt-4">
              {deliveries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No deliveries yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {deliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      className="flex items-center justify-between p-3 border rounded-md text-sm"
                    >
                      <div className="flex items-center gap-3">
                        {delivery.response_status && delivery.response_status >= 200 && delivery.response_status < 300 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <div>
                          <div className="font-medium">{delivery.event_type}</div>
                          <div className="text-muted-foreground text-xs">
                            {new Date(delivery.delivered_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <Badge variant={delivery.response_status && delivery.response_status >= 200 && delivery.response_status < 300 ? "outline" : "destructive"}>
                          {delivery.response_status || "Error"}
                        </Badge>
                        {delivery.duration_ms && (
                          <span className="text-xs">{delivery.duration_ms}ms</span>
                        )}
                        {delivery.error && (
                          <span className="text-xs text-destructive truncate max-w-32" title={delivery.error}>
                            {delivery.error}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="config" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p>{detailWebhook?.is_active ? "Active" : "Inactive"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Retry Count</Label>
                  <p>{detailWebhook?.retry_count}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Timeout</Label>
                  <p>{detailWebhook?.timeout_ms}ms</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p>{detailWebhook?.created_at && new Date(detailWebhook.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Subscribed Events</Label>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {detailWebhook?.events.map((event) => (
                    <Badge key={event} variant="secondary">
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>
              {detailWebhook?.secret && (
                <div>
                  <Label className="text-muted-foreground">Signing Secret</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 px-3 py-2 text-sm bg-muted rounded-md truncate">
                      {showSecret ? detailWebhook.secret : "••••••••••••••••"}
                    </code>
                    <Button variant="outline" size="sm" onClick={() => setShowSecret(!showSecret)}>
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => copySecret(detailWebhook.secret!)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              {detailWebhook?.headers && Object.keys(detailWebhook.headers).length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Custom Headers</Label>
                  <div className="mt-1 space-y-1">
                    {Object.entries(detailWebhook.headers).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="font-medium">{key}:</span> {value}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailWebhook(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
