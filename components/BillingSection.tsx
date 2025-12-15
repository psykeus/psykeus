"use client";

/**
 * BillingSection Component
 *
 * Displays subscription status and billing management options.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CreditCard,
  ExternalLink,
  Loader2,
  Calendar,
  AlertCircle,
  CheckCircle,
  Crown,
  Sparkles,
} from "lucide-react";
import type { SubscriptionDetails, PaymentHistory } from "@/lib/types";

interface BillingSectionProps {
  tierName?: string | null;
  tierSlug?: string | null;
}

export function BillingSection({ tierName, tierSlug }: BillingSectionProps) {
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBillingData() {
      try {
        const response = await fetch("/api/stripe/subscription");
        if (!response.ok) throw new Error("Failed to fetch billing data");
        const data = await response.json();
        setSubscription(data.subscription);
        setPayments(data.payments || []);
      } catch (err) {
        console.error("Error fetching billing:", err);
        setError("Failed to load billing information");
      } finally {
        setLoading(false);
      }
    }

    fetchBillingData();
  }, []);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to open billing portal");
      }
    } catch (err) {
      console.error("Error opening portal:", err);
      alert("Unable to open billing portal. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatAmount = (cents: number, currency: string = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "past_due":
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Past Due
          </Badge>
        );
      case "canceled":
        return (
          <Badge variant="secondary">
            Canceled
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            Free
          </Badge>
        );
    }
  };

  const getTierIcon = () => {
    switch (tierSlug) {
      case "pro":
        return <Crown className="h-5 w-5 text-amber-500" />;
      case "premium":
        return <Sparkles className="h-5 w-5 text-purple-500" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isFreeTier = !subscription?.status || subscription.status === null;
  const isLifetime = subscription?.type === "lifetime";

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getTierIcon()}
            Subscription & Billing
          </CardTitle>
          <CardDescription>
            Manage your subscription and view billing history
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Plan */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-semibold">
                  {tierName || "Free"}
                </span>
                {getStatusBadge(subscription?.status ?? null)}
              </div>
              {!isFreeTier && subscription?.type && (
                <p className="text-sm text-muted-foreground mt-1">
                  {isLifetime ? "Lifetime access" : "Yearly subscription"}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:items-end gap-2">
              {!isFreeTier && !isLifetime && subscription?.period_end && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {subscription.cancel_at_period_end
                      ? "Ends on "
                      : "Renews on "}
                    {formatDate(subscription.period_end)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {isFreeTier ? (
              <Button asChild>
                <Link href="/pricing">
                  Upgrade Plan
                </Link>
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                >
                  {portalLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Manage Billing
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </>
                  )}
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/pricing">
                    View Plans
                  </Link>
                </Button>
              </>
            )}
          </div>

          {/* Cancellation notice */}
          {subscription?.cancel_at_period_end && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Your subscription is set to cancel on{" "}
                {formatDate(subscription.period_end)}. You can reactivate
                anytime before then through the billing portal.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History Card */}
      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payments.slice(0, 5).map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {payment.payment_type === "subscription"
                        ? "Subscription Payment"
                        : "Lifetime Purchase"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(payment.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatAmount(payment.amount_cents, payment.currency)}
                    </p>
                    <Badge
                      variant={payment.status === "succeeded" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {payment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {payments.length > 5 && (
              <Button
                variant="ghost"
                className="w-full mt-4"
                onClick={handleManageBilling}
                disabled={portalLoading}
              >
                View All Invoices
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
