"use client";

/**
 * PricingCards Component
 *
 * Displays pricing tiers with yearly/lifetime toggle and checkout buttons.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Crown, Sparkles } from "lucide-react";
import type { AccessTierWithStripe } from "@/lib/types";

interface PricingCardsProps {
  tiers: AccessTierWithStripe[];
  currentTierId?: string | null;
  isLoggedIn: boolean;
}

export function PricingCards({ tiers, currentTierId, isLoggedIn }: PricingCardsProps) {
  const [isLifetime, setIsLifetime] = useState(false);
  const [loadingTierId, setLoadingTierId] = useState<string | null>(null);

  // Get free tier (for feature comparison)
  const freeTier = tiers.find((t) => t.slug === "free");
  const paidTiers = tiers.filter((t) => t.slug !== "free");

  const handleCheckout = async (tierId: string) => {
    if (!isLoggedIn) {
      // Redirect to login with return URL
      window.location.href = `/login?returnTo=/pricing`;
      return;
    }

    setLoadingTierId(tierId);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier_id: tierId,
          price_type: isLifetime ? "lifetime" : "yearly",
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL received:", data);
        alert(data.error || "Failed to start checkout");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setLoadingTierId(null);
    }
  };

  const formatPrice = (tier: AccessTierWithStripe): string => {
    if (tier.slug === "free") return "$0";

    if (isLifetime) {
      // Lifetime prices: Premium $299.99, Pro $599.99
      if (tier.slug === "premium") return "$299.99";
      if (tier.slug === "pro") return "$599.99";
    } else {
      // Yearly prices from tier data
      if (tier.price_yearly) return `$${tier.price_yearly}`;
    }
    return "Contact us";
  };

  const getPriceLabel = (tier: AccessTierWithStripe): string => {
    if (tier.slug === "free") return "forever";
    return isLifetime ? "one-time" : "/year";
  };

  const getTierIcon = (slug: string) => {
    switch (slug) {
      case "pro":
        return <Crown className="h-6 w-6" />;
      case "premium":
        return <Sparkles className="h-6 w-6" />;
      default:
        return null;
    }
  };

  const getFeatures = (tier: AccessTierWithStripe): string[] => {
    const features: string[] = [];

    // Download limits
    if (tier.daily_download_limit) {
      features.push(`${tier.daily_download_limit} downloads per day`);
    } else if (tier.slug !== "free") {
      features.push("Unlimited daily downloads");
    } else {
      features.push("3 downloads per day");
    }

    if (tier.monthly_download_limit) {
      features.push(`${tier.monthly_download_limit} downloads per month`);
    } else if (tier.slug !== "free") {
      features.push("Unlimited monthly downloads");
    } else {
      features.push("10 downloads per month");
    }

    // Access levels
    if (tier.can_access_premium) {
      features.push("Access to Premium designs");
    }
    if (tier.can_access_exclusive) {
      features.push("Access to Exclusive designs");
    }

    // Collections
    if (tier.can_create_collections) {
      if (tier.max_collections) {
        features.push(`Up to ${tier.max_collections} collections`);
      } else {
        features.push("Unlimited collections");
      }
    }

    // Favorites
    if (tier.max_favorites) {
      features.push(`Up to ${tier.max_favorites} favorites`);
    } else if (tier.slug !== "free") {
      features.push("Unlimited favorites");
    }

    return features;
  };

  return (
    <div className="space-y-8">
      {/* Pricing Toggle */}
      <div className="flex items-center justify-center gap-4">
        <Label htmlFor="pricing-toggle" className={!isLifetime ? "font-semibold" : ""}>
          Yearly
        </Label>
        <Switch
          id="pricing-toggle"
          checked={isLifetime}
          onCheckedChange={setIsLifetime}
        />
        <Label htmlFor="pricing-toggle" className={isLifetime ? "font-semibold" : ""}>
          Lifetime
          <Badge variant="secondary" className="ml-2">Best Value</Badge>
        </Label>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {/* Free Tier */}
        {freeTier && (
          <Card className="relative">
            <CardHeader>
              <CardTitle className="text-xl">Free</CardTitle>
              <CardDescription>{freeTier.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground ml-1">forever</span>
              </div>

              <ul className="space-y-3">
                {getFeatures(freeTier).map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant="outline"
                className="w-full"
                disabled={currentTierId === freeTier.id || !isLoggedIn}
              >
                {currentTierId === freeTier.id ? "Current Plan" : "Get Started Free"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Paid Tiers */}
        {paidTiers.map((tier, index) => {
          const isCurrentTier = currentTierId === tier.id;
          const isPopular = tier.slug === "premium";
          const isLoading = loadingTierId === tier.id;

          return (
            <Card
              key={tier.id}
              className={`relative ${isPopular ? "border-primary shadow-lg" : ""}`}
            >
              {isPopular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}

              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  {getTierIcon(tier.slug)}
                  {tier.name}
                </CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="text-center">
                  <span className="text-4xl font-bold">{formatPrice(tier)}</span>
                  <span className="text-muted-foreground ml-1">{getPriceLabel(tier)}</span>
                </div>

                <ul className="space-y-3">
                  {getFeatures(tier).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={isPopular ? "default" : "outline"}
                  disabled={isCurrentTier || isLoading}
                  onClick={() => handleCheckout(tier.id)}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : isCurrentTier ? (
                    "Current Plan"
                  ) : (
                    `Get ${tier.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Money-back guarantee note */}
      <p className="text-center text-sm text-muted-foreground">
        All plans include a 30-day money-back guarantee. Cancel anytime from your account.
      </p>
    </div>
  );
}
