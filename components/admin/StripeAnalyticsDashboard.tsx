"use client";

/**
 * StripeAnalyticsDashboard Component
 *
 * Displays Stripe analytics including coupon usage, revenue, and expiration alerts.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  TrendingUp,
  Ticket,
  DollarSign,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { PageLoading, Spinner } from "@/components/ui/loading-states";
import type {
  CouponAnalytics,
  RevenueAnalytics,
  ExpiringItem,
} from "@/lib/types";

type DateRange = "7d" | "30d" | "90d" | "365d" | "all";

export function StripeAnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  const [couponAnalytics, setCouponAnalytics] = useState<CouponAnalytics | null>(
    null
  );
  const [revenueAnalytics, setRevenueAnalytics] =
    useState<RevenueAnalytics | null>(null);
  const [expiringItems, setExpiringItems] = useState<ExpiringItem[]>([]);

  const getDateParams = (range: DateRange): { startDate?: string } => {
    if (range === "all") return {};

    const days = parseInt(range.replace("d", ""), 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return { startDate: startDate.toISOString() };
  };

  const fetchAnalytics = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const dateParams = getDateParams(dateRange);

      try {
        const [couponRes, revenueRes, expiringRes] = await Promise.all([
          fetch(
            `/api/admin/stripe/analytics/coupons${
              dateParams.startDate ? `?startDate=${dateParams.startDate}` : ""
            }`
          ),
          fetch(
            `/api/admin/stripe/analytics/revenue${
              dateParams.startDate ? `?startDate=${dateParams.startDate}` : ""
            }`
          ),
          fetch("/api/admin/stripe/analytics/expiring?days=30"),
        ]);

        if (couponRes.ok) {
          const data = await couponRes.json();
          setCouponAnalytics(data.analytics);
        }

        if (revenueRes.ok) {
          const data = await revenueRes.json();
          setRevenueAnalytics(data.analytics);
        }

        if (expiringRes.ok) {
          const data = await expiringRes.json();
          setExpiringItems(data.expiringItems || []);
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dateRange]
  );

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatCurrency = (cents: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  if (loading) {
    return <PageLoading message="Loading analytics..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Payment Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Track revenue, discounts, and coupon usage
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select
            value={dateRange}
            onValueChange={(v) => setDateRange(v as DateRange)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="365d">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
          >
            {refreshing ? <Spinner size="sm" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(revenueAnalytics?.totalRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              After discounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Discounts Given</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(revenueAnalytics?.totalDiscounts || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {couponAnalytics?.totalRedemptions || 0} redemptions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {revenueAnalytics?.byTier.reduce(
                (acc, t) => acc + t.subscriptionCount,
                0
              ) || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              +
              {revenueAnalytics?.byTier.reduce(
                (acc, t) => acc + t.lifetimeCount,
                0
              ) || 0}{" "}
              lifetime
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiringItems.length}</div>
            <p className="text-xs text-muted-foreground">
              Coupons/codes in 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Tier */}
      {revenueAnalytics && revenueAnalytics.byTier.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Tier</CardTitle>
            <CardDescription>
              Breakdown of payments by subscription tier
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {revenueAnalytics.byTier.map((tier) => (
                <div
                  key={tier.tierId}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{tier.tierName}</p>
                    <p className="text-sm text-muted-foreground">
                      {tier.subscriptionCount} yearly, {tier.lifetimeCount} lifetime
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(tier.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Coupons */}
        <Card>
          <CardHeader>
            <CardTitle>Top Coupons</CardTitle>
            <CardDescription>Most used discount coupons</CardDescription>
          </CardHeader>
          <CardContent>
            {couponAnalytics?.topCoupons &&
            couponAnalytics.topCoupons.length > 0 ? (
              <div className="space-y-3">
                {couponAnalytics.topCoupons.slice(0, 5).map((coupon, idx) => (
                  <div
                    key={coupon.couponId}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm w-4">
                        {idx + 1}.
                      </span>
                      <span className="font-medium">
                        {coupon.couponName || coupon.couponId}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{coupon.redemptions} uses</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(coupon.totalDiscount)} saved
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No coupon usage data yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top Promo Codes */}
        <Card>
          <CardHeader>
            <CardTitle>Top Promo Codes</CardTitle>
            <CardDescription>Most used promotional codes</CardDescription>
          </CardHeader>
          <CardContent>
            {couponAnalytics?.topPromoCodes &&
            couponAnalytics.topPromoCodes.length > 0 ? (
              <div className="space-y-3">
                {couponAnalytics.topPromoCodes.slice(0, 5).map((code, idx) => (
                  <div
                    key={code.code}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm w-4">
                        {idx + 1}.
                      </span>
                      <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">
                        {code.code}
                      </code>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{code.redemptions} uses</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(code.totalDiscount)} saved
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No promo code usage data yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expiring Items Alert */}
      {expiringItems.length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <CardTitle>Expiring Soon</CardTitle>
            </div>
            <CardDescription>
              Coupons and promo codes expiring in the next 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringItems.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex items-center justify-between p-2 rounded bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={item.type === "coupon" ? "default" : "secondary"}
                    >
                      {item.type === "coupon" ? "Coupon" : "Code"}
                    </Badge>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span
                      className={
                        item.daysUntilExpiry <= 7
                          ? "text-red-500 font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {item.daysUntilExpiry === 0
                        ? "Today"
                        : item.daysUntilExpiry === 1
                        ? "Tomorrow"
                        : `${item.daysUntilExpiry} days`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
