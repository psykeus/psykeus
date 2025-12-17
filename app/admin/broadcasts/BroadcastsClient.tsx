"use client";

import { useState, useEffect } from "react";
import { Send, Plus, Trash2, Eye, Users, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface Broadcast {
  id: string;
  title: string;
  message: string;
  targetAudience: string;
  priority: string;
  scheduledAt?: string;
  sentAt?: string;
  recipientsCount: number;
  readCount: number;
  createdAt: string;
}

export function BroadcastsClient() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    targetAudience: "all",
    priority: "normal",
    actionUrl: "",
    actionLabel: "",
    sendImmediately: true,
    sendEmail: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch broadcasts
  const fetchBroadcasts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/broadcasts");
      if (res.ok) {
        const data = await res.json();
        setBroadcasts(data.broadcasts);
      }
    } catch (error) {
      console.error("Failed to fetch broadcasts:", error);
      toast({
        title: "Error",
        description: "Failed to load broadcasts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  // Create broadcast
  const handleCreate = async () => {
    if (!formData.title || !formData.message) {
      toast({
        title: "Validation Error",
        description: "Title and message are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Success",
          description: data.sent
            ? `Broadcast sent to ${data.recipientsCount} users${data.emailsSent ? `, ${data.emailsSent} emails sent` : ""}`
            : "Broadcast created successfully",
        });
        setIsCreateOpen(false);
        resetForm();
        fetchBroadcasts();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to create broadcast",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to create broadcast:", error);
      toast({
        title: "Error",
        description: "Failed to create broadcast",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Send existing broadcast
  const handleSend = async (broadcastId: string) => {
    try {
      const res = await fetch(`/api/admin/broadcasts/${broadcastId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendEmail: false }),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Success",
          description: `Broadcast sent to ${data.recipientsCount} users`,
        });
        fetchBroadcasts();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to send broadcast",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to send broadcast:", error);
      toast({
        title: "Error",
        description: "Failed to send broadcast",
        variant: "destructive",
      });
    }
  };

  // Delete broadcast
  const handleDelete = async (broadcastId: string) => {
    if (!confirm("Are you sure you want to delete this broadcast?")) return;

    try {
      const res = await fetch(`/api/admin/broadcasts/${broadcastId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Broadcast deleted",
        });
        fetchBroadcasts();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to delete broadcast",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to delete broadcast:", error);
      toast({
        title: "Error",
        description: "Failed to delete broadcast",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      message: "",
      targetAudience: "all",
      priority: "normal",
      actionUrl: "",
      actionLabel: "",
      sendImmediately: true,
      sendEmail: false,
    });
  };

  const viewBroadcast = (broadcast: Broadcast) => {
    setSelectedBroadcast(broadcast);
    setIsViewOpen(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Broadcast
        </Button>
      </div>

      {/* Broadcasts table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Recipients</TableHead>
              <TableHead className="text-right">Read</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                </TableCell>
              </TableRow>
            ) : broadcasts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No broadcasts yet
                </TableCell>
              </TableRow>
            ) : (
              broadcasts.map((broadcast) => (
                <TableRow key={broadcast.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {broadcast.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {broadcast.targetAudience}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        broadcast.priority === "urgent"
                          ? "destructive"
                          : broadcast.priority === "high"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {broadcast.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {broadcast.sentAt ? (
                      <Badge variant="outline" className="text-green-600">
                        Sent
                      </Badge>
                    ) : broadcast.scheduledAt ? (
                      <Badge variant="outline" className="text-yellow-600">
                        Scheduled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Draft
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{broadcast.recipientsCount}</TableCell>
                  <TableCell className="text-right">{broadcast.readCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => viewBroadcast(broadcast)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {!broadcast.sentAt && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSend(broadcast.id)}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(broadcast.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Broadcast</DialogTitle>
            <DialogDescription>
              Send a notification to users. This will appear in their notification center.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Important announcement..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Your message to users..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="target">Target Audience</Label>
                <Select
                  value={formData.targetAudience}
                  onValueChange={(value) => setFormData({ ...formData, targetAudience: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="admins">Admins Only</SelectItem>
                    <SelectItem value="subscribers">Subscribers</SelectItem>
                    <SelectItem value="free">Free Users</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="actionUrl">Action URL (optional)</Label>
              <Input
                id="actionUrl"
                value={formData.actionUrl}
                onChange={(e) => setFormData({ ...formData, actionUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="actionLabel">Action Button Label (optional)</Label>
              <Input
                id="actionLabel"
                value={formData.actionLabel}
                onChange={(e) => setFormData({ ...formData, actionLabel: e.target.value })}
                placeholder="Learn More"
              />
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Send Immediately</span>
              </div>
              <Switch
                checked={formData.sendImmediately}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, sendImmediately: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Also Send Email</span>
              </div>
              <Switch
                checked={formData.sendEmail}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, sendEmail: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Creating...
                </>
              ) : formData.sendImmediately ? (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Now
                </>
              ) : (
                "Save Draft"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedBroadcast?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Message</Label>
              <p className="mt-1 whitespace-pre-wrap">{selectedBroadcast?.message}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Target</Label>
                <p className="mt-1 capitalize">{selectedBroadcast?.targetAudience}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Priority</Label>
                <p className="mt-1 capitalize">{selectedBroadcast?.priority}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Sent At</Label>
                <p className="mt-1">{formatDate(selectedBroadcast?.sentAt)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Created At</Label>
                <p className="mt-1">{formatDate(selectedBroadcast?.createdAt)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Recipients</Label>
                <p className="mt-1">{selectedBroadcast?.recipientsCount || 0}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Read</Label>
                <p className="mt-1">{selectedBroadcast?.readCount || 0}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
