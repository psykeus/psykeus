"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  Mail,
  Send,
  Plug,
  Check,
  X,
  RefreshCw,
  Eye,
  Edit,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
} from "lucide-react";

interface EmailSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password_masked: string;
  smtp_from_email: string;
  smtp_from_name: string;
  smtp_secure: boolean;
  last_tested_at: string | null;
  last_test_success: boolean | null;
  last_test_error: string | null;
}

interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  description: string | null;
  subject: string;
  html_content: string;
  text_content: string;
  variables: string[];
  variableDefinitions: { name: string; description: string }[];
  is_active: boolean;
  updated_at: string;
}

interface EmailLog {
  id: string;
  recipient_email: string;
  email_type: string;
  subject: string;
  status: "pending" | "sent" | "failed";
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export default function EmailSettingsClient() {
  const [activeTab, setActiveTab] = useState("smtp");
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [isUsingEnv, setIsUsingEnv] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // SMTP form state
  const [smtpForm, setSmtpForm] = useState({
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    smtp_from_email: "",
    smtp_from_name: "CNC Design Library",
    smtp_secure: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Template editor state
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    subject: "",
    html_content: "",
    text_content: "",
  });
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadSettings();
    loadTemplates();
    loadLogs();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/admin/email/settings");
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        setIsUsingEnv(data.isUsingEnvSettings);
        setSmtpForm({
          smtp_host: data.settings.smtp_host || "",
          smtp_port: data.settings.smtp_port || 587,
          smtp_user: data.settings.smtp_user || "",
          smtp_password: "",
          smtp_from_email: data.settings.smtp_from_email || "",
          smtp_from_name: data.settings.smtp_from_name || "CNC Design Library",
          smtp_secure: data.settings.smtp_secure || false,
        });
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await fetch("/api/admin/email/templates");
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await fetch("/api/admin/email-logs?limit=50");
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (error) {
      console.error("Failed to load logs:", error);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/email/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smtpForm),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast({ title: "Settings saved", description: "Email settings updated successfully" });
        loadSettings();
      } else {
        toast({ title: "Error", description: data.error || "Failed to save settings", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await fetch("/api/admin/email/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smtpForm),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: "Connection successful", description: "SMTP connection verified" });
        loadSettings();
      } else {
        toast({ title: "Connection failed", description: data.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to test connection", variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailTo) return;
    setIsSendingTest(true);
    try {
      const res = await fetch("/api/admin/email/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmailTo, ...smtpForm }),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: "Test email sent", description: `Sent to ${testEmailTo}` });
        setShowTestDialog(false);
        setTestEmailTo("");
        loadLogs();
      } else {
        toast({ title: "Failed to send", description: data.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to send test email", variant: "destructive" });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      subject: template.subject,
      html_content: template.html_content,
      text_content: template.text_content,
    });
    setPreviewHtml(null);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    setIsSavingTemplate(true);
    try {
      const res = await fetch(`/api/admin/email/templates/${editingTemplate.template_key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateForm),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast({ title: "Template saved", description: "Email template updated successfully" });
        setEditingTemplate(null);
        loadTemplates();
      } else {
        toast({ title: "Error", description: data.error || "Failed to save template", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save template", variant: "destructive" });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleResetTemplate = async () => {
    if (!editingTemplate) return;
    if (!confirm("Are you sure you want to reset this template to its default content?")) return;

    try {
      const res = await fetch(`/api/admin/email/templates/${editingTemplate.template_key}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast({ title: "Template reset", description: "Template restored to default" });
        setEditingTemplate(null);
        loadTemplates();
      } else {
        toast({ title: "Error", description: data.error || "Failed to reset template", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to reset template", variant: "destructive" });
    }
  };

  const handlePreviewTemplate = async () => {
    if (!editingTemplate) return;
    try {
      const res = await fetch(`/api/admin/email/templates/${editingTemplate.template_key}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (data.success && data.preview) {
        setPreviewHtml(data.preview.html);
        setShowPreview(true);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to preview template", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="smtp">
          <Plug className="mr-2 h-4 w-4" />
          SMTP Settings
        </TabsTrigger>
        <TabsTrigger value="templates">
          <Mail className="mr-2 h-4 w-4" />
          Templates
        </TabsTrigger>
        <TabsTrigger value="logs">
          <Clock className="mr-2 h-4 w-4" />
          Logs
        </TabsTrigger>
      </TabsList>

      {/* SMTP Settings Tab */}
      <TabsContent value="smtp" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>SMTP Configuration</CardTitle>
            <CardDescription>
              Configure your SMTP server for sending emails.
              {isUsingEnv && (
                <Badge variant="secondary" className="ml-2">
                  Using Environment Variables
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp_host">SMTP Host</Label>
                <Input
                  id="smtp_host"
                  value={smtpForm.smtp_host}
                  onChange={(e) => setSmtpForm({ ...smtpForm, smtp_host: e.target.value })}
                  placeholder="smtp.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_port">Port</Label>
                <Input
                  id="smtp_port"
                  type="number"
                  value={smtpForm.smtp_port}
                  onChange={(e) => setSmtpForm({ ...smtpForm, smtp_port: parseInt(e.target.value) || 587 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp_user">Username</Label>
                <Input
                  id="smtp_user"
                  value={smtpForm.smtp_user}
                  onChange={(e) => setSmtpForm({ ...smtpForm, smtp_user: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_password">Password</Label>
                <Input
                  id="smtp_password"
                  type="password"
                  value={smtpForm.smtp_password}
                  onChange={(e) => setSmtpForm({ ...smtpForm, smtp_password: e.target.value })}
                  placeholder={settings?.smtp_password_masked || "Enter password"}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp_from_email">From Email</Label>
                <Input
                  id="smtp_from_email"
                  type="email"
                  value={smtpForm.smtp_from_email}
                  onChange={(e) => setSmtpForm({ ...smtpForm, smtp_from_email: e.target.value })}
                  placeholder="noreply@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_from_name">From Name</Label>
                <Input
                  id="smtp_from_name"
                  value={smtpForm.smtp_from_name}
                  onChange={(e) => setSmtpForm({ ...smtpForm, smtp_from_name: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="smtp_secure"
                checked={smtpForm.smtp_secure}
                onCheckedChange={(checked) => setSmtpForm({ ...smtpForm, smtp_secure: checked })}
              />
              <Label htmlFor="smtp_secure">Use SSL/TLS</Label>
            </div>

            {settings?.last_tested_at && (
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  {settings.last_test_success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                  <span className="font-medium">
                    Last Test: {settings.last_test_success ? "Successful" : "Failed"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(settings.last_tested_at).toLocaleString()}
                  </span>
                </div>
                {settings.last_test_error && (
                  <p className="mt-2 text-sm text-destructive">{settings.last_test_error}</p>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={handleTestConnection} disabled={isTesting} variant="outline">
                {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
                Test Connection
              </Button>
              <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Send className="mr-2 h-4 w-4" />
                    Send Test Email
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send Test Email</DialogTitle>
                    <DialogDescription>
                      Send a test email to verify your SMTP configuration works correctly.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="test_email">Recipient Email</Label>
                      <Input
                        id="test_email"
                        type="email"
                        value={testEmailTo}
                        onChange={(e) => setTestEmailTo(e.target.value)}
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowTestDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSendTestEmail} disabled={!testEmailTo || isSendingTest}>
                      {isSendingTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button onClick={handleSaveSettings} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Templates Tab */}
      <TabsContent value="templates" className="space-y-4">
        {editingTemplate ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Edit: {editingTemplate.name}</CardTitle>
                <CardDescription>{editingTemplate.description}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditingTemplate(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template_subject">Subject Line</Label>
                <Input
                  id="template_subject"
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template_html">HTML Content</Label>
                <Textarea
                  id="template_html"
                  value={templateForm.html_content}
                  onChange={(e) => setTemplateForm({ ...templateForm, html_content: e.target.value })}
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template_text">Plain Text Content</Label>
                <Textarea
                  id="template_text"
                  value={templateForm.text_content}
                  onChange={(e) => setTemplateForm({ ...templateForm, text_content: e.target.value })}
                  className="min-h-[150px] font-mono text-sm"
                />
              </div>

              {editingTemplate.variableDefinitions.length > 0 && (
                <div className="rounded-lg border p-4">
                  <Label className="text-sm font-medium">Available Variables</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {editingTemplate.variableDefinitions.map((v) => (
                      <Badge key={v.name} variant="secondary" className="font-mono">
                        {`{{${v.name}}}`}
                        <span className="ml-1 font-sans text-xs opacity-70">- {v.description}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={handlePreviewTemplate}>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button variant="outline" onClick={handleResetTemplate}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset to Default
                </Button>
                <Button onClick={handleSaveTemplate} disabled={isSavingTemplate}>
                  {isSavingTemplate ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Save Template
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Email Templates</CardTitle>
              <CardDescription>Customize the content of system emails</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell className="text-muted-foreground">{template.description}</TableCell>
                      <TableCell>{new Date(template.updated_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => handleEditTemplate(template)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Email Preview</DialogTitle>
              <DialogDescription>This is how the email will appear to recipients</DialogDescription>
            </DialogHeader>
            {previewHtml && (
              <div
                className="rounded border p-4 bg-white"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}
          </DialogContent>
        </Dialog>
      </TabsContent>

      {/* Logs Tab */}
      <TabsContent value="logs" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Email Delivery Logs</CardTitle>
              <CardDescription>Recent email delivery attempts</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadLogs}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No email logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">{log.recipient_email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.email_type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                      <TableCell>
                        {log.status === "sent" && (
                          <Badge variant="default" className="bg-green-500">
                            <Check className="mr-1 h-3 w-3" />
                            Sent
                          </Badge>
                        )}
                        {log.status === "failed" && (
                          <Badge variant="destructive">
                            <X className="mr-1 h-3 w-3" />
                            Failed
                          </Badge>
                        )}
                        {log.status === "pending" && (
                          <Badge variant="secondary">
                            <Clock className="mr-1 h-3 w-3" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.sent_at ? new Date(log.sent_at).toLocaleString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
