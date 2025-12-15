"use client";

/**
 * StripeConnectionForm Component
 *
 * Allows admins to configure Stripe API keys and test connection.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";

interface StripeSettings {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  isConfigured: boolean;
}

export function StripeConnectionForm() {
  const [settings, setSettings] = useState<StripeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    accountName?: string;
  } | null>(null);

  // Form state
  const [secretKey, setSecretKey] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  // Visibility toggles
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/stripe/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const updates: Record<string, string> = {};
      if (secretKey) updates.secretKey = secretKey;
      if (publishableKey) updates.publishableKey = publishableKey;
      if (webhookSecret) updates.webhookSecret = webhookSecret;

      if (Object.keys(updates).length === 0) {
        setMessage({ type: "error", text: "No changes to save" });
        return;
      }

      const res = await fetch("/api/admin/stripe/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Settings saved successfully" });
        // Clear form and refresh
        setSecretKey("");
        setPublishableKey("");
        setWebhookSecret("");
        await fetchSettings();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save settings" });
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/admin/stripe/test", {
        method: "POST",
      });
      const data = await res.json();
      setTestResult(data);
    } catch (error) {
      console.error("Error testing connection:", error);
      setTestResult({ success: false, message: "Failed to test connection" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Stripe Connection</CardTitle>
            <CardDescription>
              Configure your Stripe API keys to enable payments
            </CardDescription>
          </div>
          <Badge variant={settings?.isConfigured ? "default" : "secondary"}>
            {settings?.isConfigured ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Configured
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Not Configured
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Settings Display */}
        {settings?.isConfigured && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm font-medium">Current Settings</p>
            <div className="grid gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Secret Key:</span>
                <code className="text-xs">{settings.secretKey}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Publishable Key:</span>
                <code className="text-xs">{settings.publishableKey}</code>
              </div>
              {settings.webhookSecret && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Webhook Secret:</span>
                  <code className="text-xs">{settings.webhookSecret}</code>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Test Connection */}
        {settings?.isConfigured && (
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>
            {testResult && (
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-sm ${testResult.success ? "text-green-600" : "text-red-600"}`}>
                  {testResult.message}
                  {testResult.accountName && ` (${testResult.accountName})`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Update Settings Form */}
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {settings?.isConfigured
              ? "Enter new values below to update your keys (leave blank to keep current):"
              : "Enter your Stripe API keys below:"}
          </p>

          <div className="space-y-2">
            <Label htmlFor="secretKey">Secret Key</Label>
            <div className="relative">
              <Input
                id="secretKey"
                type={showSecretKey ? "text" : "password"}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="sk_live_..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowSecretKey(!showSecretKey)}
              >
                {showSecretKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Find this in your Stripe Dashboard → Developers → API keys
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="publishableKey">Publishable Key</Label>
            <Input
              id="publishableKey"
              type="text"
              value={publishableKey}
              onChange={(e) => setPublishableKey(e.target.value)}
              placeholder="pk_live_..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhookSecret">Webhook Secret (Optional)</Label>
            <div className="relative">
              <Input
                id="webhookSecret"
                type={showWebhookSecret ? "text" : "password"}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="whsec_..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowWebhookSecret(!showWebhookSecret)}
              >
                {showWebhookSecret ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Required for receiving payment webhooks. Create in Stripe Dashboard → Webhooks
            </p>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Settings"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
