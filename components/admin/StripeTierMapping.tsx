"use client";

/**
 * StripeTierMapping Component
 *
 * Maps Stripe prices to access tiers.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Save, CheckCircle, AlertCircle } from "lucide-react";
import { PageLoading, Spinner } from "@/components/ui/loading-states";

interface TierMapping {
  tierId: string;
  tierName: string;
  tierSlug: string;
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  stripePriceIdLifetime: string | null;
}

interface StripePrice {
  id: string;
  productId: string;
  nickname: string | null;
  unitAmount: number | null;
  currency: string;
  type: "recurring" | "one_time";
  interval?: "year" | "month" | "week" | "day";
  active: boolean;
}

interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  prices: StripePrice[];
}

export function StripeTierMapping() {
  const [mappings, setMappings] = useState<TierMapping[]>([]);
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Local state for edits
  const [localMappings, setLocalMappings] = useState<Record<string, {
    monthly: string | null;
    yearly: string | null;
    lifetime: string | null;
  }>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tiersRes, productsRes] = await Promise.all([
        fetch("/api/admin/stripe/tiers"),
        fetch("/api/admin/stripe/products"),
      ]);

      if (tiersRes.ok && productsRes.ok) {
        const tiersData = await tiersRes.json();
        const productsData = await productsRes.json();

        setMappings(tiersData.mappings || []);
        setProducts(productsData.products || []);

        // Initialize local state
        const local: Record<string, { monthly: string | null; yearly: string | null; lifetime: string | null }> = {};
        tiersData.mappings?.forEach((m: TierMapping) => {
          local[m.tierId] = {
            monthly: m.stripePriceIdMonthly,
            yearly: m.stripePriceIdYearly,
            lifetime: m.stripePriceIdLifetime,
          };
        });
        setLocalMappings(local);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get all prices organized by type
  const monthlyPrices = products.flatMap((p) =>
    p.prices
      .filter((pr) => pr.type === "recurring" && pr.interval === "month")
      .map((pr) => ({ ...pr, productName: p.name }))
  );

  const yearlyPrices = products.flatMap((p) =>
    p.prices
      .filter((pr) => pr.type === "recurring" && pr.interval === "year")
      .map((pr) => ({ ...pr, productName: p.name }))
  );

  const lifetimePrices = products.flatMap((p) =>
    p.prices
      .filter((pr) => pr.type === "one_time")
      .map((pr) => ({ ...pr, productName: p.name }))
  );

  const formatPrice = (amount: number | null, currency: string): string => {
    if (amount === null) return "Custom";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const handleMappingChange = (
    tierId: string,
    type: "monthly" | "yearly" | "lifetime",
    priceId: string | null
  ) => {
    setLocalMappings((prev) => ({
      ...prev,
      [tierId]: {
        ...prev[tierId],
        [type]: priceId,
      },
    }));
    setHasChanges(true);
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const updates = Object.entries(localMappings).map(([tierId, prices]) => ({
        tierId,
        stripePriceIdMonthly: prices.monthly,
        stripePriceIdYearly: prices.yearly,
        stripePriceIdLifetime: prices.lifetime,
      }));

      const res = await fetch("/api/admin/stripe/tiers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: updates }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Mappings saved successfully" });
        setHasChanges(false);
        await fetchData();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to save mappings" });
      }
    } catch (error) {
      console.error("Error saving mappings:", error);
      setMessage({ type: "error", text: "Failed to save mappings" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoading message="Loading tier mappings..." />;
  }

  const paidTiers = mappings.filter((m) => m.tierSlug !== "free");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Tier Mapping</CardTitle>
            <CardDescription>
              Link Stripe prices to your access tiers
            </CardDescription>
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Mappings
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status message */}
        {message && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {message.text}
          </div>
        )}

        {products.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-amber-500" />
            <p className="text-muted-foreground">
              No Stripe products found. Create products and prices first.
            </p>
          </div>
        ) : paidTiers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              No paid tiers configured in the database.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Access Tier</TableHead>
                <TableHead>Monthly Price</TableHead>
                <TableHead>Yearly Price</TableHead>
                <TableHead>Lifetime Price</TableHead>
                <TableHead className="w-24">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paidTiers.map((tier) => {
                const local = localMappings[tier.tierId] || { monthly: null, yearly: null, lifetime: null };
                const isConfigured = local.monthly || local.yearly || local.lifetime;

                return (
                  <TableRow key={tier.tierId}>
                    <TableCell className="font-medium">{tier.tierName}</TableCell>
                    <TableCell>
                      <Select
                        value={local.monthly || "none"}
                        onValueChange={(v) =>
                          handleMappingChange(tier.tierId, "monthly", v === "none" ? null : v)
                        }
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Select monthly price" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- None --</SelectItem>
                          {monthlyPrices.map((price) => (
                            <SelectItem key={price.id} value={price.id}>
                              {price.productName} - {formatPrice(price.unitAmount, price.currency)}/mo
                              {price.nickname && ` (${price.nickname})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={local.yearly || "none"}
                        onValueChange={(v) =>
                          handleMappingChange(tier.tierId, "yearly", v === "none" ? null : v)
                        }
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Select yearly price" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- None --</SelectItem>
                          {yearlyPrices.map((price) => (
                            <SelectItem key={price.id} value={price.id}>
                              {price.productName} - {formatPrice(price.unitAmount, price.currency)}/yr
                              {price.nickname && ` (${price.nickname})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={local.lifetime || "none"}
                        onValueChange={(v) =>
                          handleMappingChange(tier.tierId, "lifetime", v === "none" ? null : v)
                        }
                      >
                        <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="Select lifetime price" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- None --</SelectItem>
                          {lifetimePrices.map((price) => (
                            <SelectItem key={price.id} value={price.id}>
                              {price.productName} - {formatPrice(price.unitAmount, price.currency)}
                              {price.nickname && ` (${price.nickname})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {isConfigured ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Linked
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Not linked
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {hasChanges && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            You have unsaved changes
          </p>
        )}
      </CardContent>
    </Card>
  );
}
