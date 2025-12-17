"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, MailX, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface EmailPreferences {
  email_unsubscribed: boolean;
  email_welcome: boolean;
  email_subscription_confirmation: boolean;
  email_subscription_expiring: boolean;
  email_download_limit_warning: boolean;
  email_account_status_change: boolean;
  email_import_completion: boolean;
  email_admin_broadcast: boolean;
}

const emailTypes = [
  { key: "email_welcome", label: "Welcome emails", description: "Sent when you create an account" },
  { key: "email_subscription_confirmation", label: "Subscription confirmations", description: "Payment receipts and tier changes" },
  { key: "email_subscription_expiring", label: "Subscription expiring", description: "Reminder before your subscription expires" },
  { key: "email_download_limit_warning", label: "Download limit warnings", description: "Alert when you're near your download limit" },
  { key: "email_account_status_change", label: "Account status changes", description: "Important account notifications" },
  { key: "email_import_completion", label: "Import completion", description: "When bulk import jobs finish (admin)" },
  { key: "email_admin_broadcast", label: "Announcements", description: "Important platform announcements" },
];

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [preferences, setPreferences] = useState<EmailPreferences | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      setError("Missing unsubscribe token");
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (res.ok && data.valid) {
          setIsVerified(true);
          setEmail(data.email);
          setPreferences(data.preferences);
        } else {
          setError(data.error || "Invalid or expired unsubscribe link");
        }
      } catch {
        setError("Failed to verify unsubscribe link");
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleUnsubscribeAll = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, unsubscribeAll: true }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        toast({
          title: "Unsubscribed",
          description: "You have been unsubscribed from all emails",
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to unsubscribe",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to unsubscribe",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!preferences) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          preferences: {
            email_welcome: preferences.email_welcome,
            email_subscription_confirmation: preferences.email_subscription_confirmation,
            email_subscription_expiring: preferences.email_subscription_expiring,
            email_download_limit_warning: preferences.email_download_limit_warning,
            email_account_status_change: preferences.email_account_status_change,
            email_import_completion: preferences.email_import_completion,
            email_admin_broadcast: preferences.email_admin_broadcast,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Preferences saved",
          description: "Your email preferences have been updated",
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to save preferences",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const togglePreference = (key: keyof EmailPreferences) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      [key]: !preferences[key],
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-lg py-16">
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-lg py-16">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Link</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href="/">Return Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="container mx-auto max-w-lg py-16">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Unsubscribed</CardTitle>
            <CardDescription>
              You have been unsubscribed from all emails. We&apos;re sorry to see you go!
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href="/">Return Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-lg py-16">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Email Preferences</CardTitle>
          <CardDescription>
            Manage email preferences for <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Individual preferences */}
          <div className="space-y-4">
            {emailTypes.map((type) => (
              <div
                key={type.key}
                className="flex items-center justify-between gap-4 rounded-lg border p-4"
              >
                <div className="space-y-0.5">
                  <Label htmlFor={type.key} className="font-medium">
                    {type.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{type.description}</p>
                </div>
                <Switch
                  id={type.key}
                  checked={preferences?.[type.key as keyof EmailPreferences] ?? true}
                  onCheckedChange={() => togglePreference(type.key as keyof EmailPreferences)}
                />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-4 border-t">
            <Button onClick={handleSavePreferences} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Preferences"}
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={handleUnsubscribeAll}
              disabled={isSaving}
            >
              <MailX className="mr-2 h-4 w-4" />
              Unsubscribe from All Emails
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="container mx-auto max-w-lg py-16">
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <UnsubscribeContent />
    </Suspense>
  );
}
