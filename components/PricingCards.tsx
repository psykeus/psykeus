"use client";

/**
 * PricingCards Component
 *
 * Displays pricing tiers with yearly/lifetime toggle and checkout buttons.
 * Uses database-driven features when available, falls back to generated features.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Sparkles, Star } from "lucide-react";
import { Spinner } from "@/components/ui/loading-states";
import type { AccessTierFull, AccessTierWithStripe } from "@/lib/types";

interface PricingCardsProps {
  tiers: (AccessTierFull | AccessTierWithStripe)[];
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

  // Type guard to check for display fields
  const hasDisplayFields = (tier: AccessTierFull | AccessTierWithStripe): tier is AccessTierFull => {
    return "price_yearly_display" in tier || "price_lifetime_display" in tier;
  };

  const formatPrice = (tier: AccessTierFull | AccessTierWithStripe): string => {
    if (tier.slug === "free") return "$0";

    // Use custom display text if available
    if (hasDisplayFields(tier)) {
      if (isLifetime && tier.price_lifetime_display) {
        return tier.price_lifetime_display;
      }
      if (!isLifetime && tier.price_yearly_display) {
        return tier.price_yearly_display;
      }
    }

    // Fallback to numeric prices
    if (isLifetime) {
      const fullTier = tier as AccessTierFull;
      if (fullTier.price_lifetime) return `$${fullTier.price_lifetime}`;
      // Legacy fallback
      if (tier.slug === "premium") return "$299.99";
      if (tier.slug === "pro") return "$599.99";
    } else {
      if (tier.price_yearly) return `$${tier.price_yearly}`;
    }
    return "Contact us";
  };

  const getPriceLabel = (tier: AccessTierFull | AccessTierWithStripe): string => {
    if (tier.slug === "free") return "forever";

    // If using custom display text, don't add a label (it's already included)
    if (hasDisplayFields(tier)) {
      if (isLifetime && tier.price_lifetime_display) return "";
      if (!isLifetime && tier.price_yearly_display) return "";
    }

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

  // Type guard to check if tier has features
  const hasFeatures = (tier: AccessTierFull | AccessTierWithStripe): tier is AccessTierFull => {
    return "features" in tier && Array.isArray((tier as AccessTierFull).features);
  };

  // Get features - use database features if available, otherwise generate from limits
  const getFeatures = (tier: AccessTierFull | AccessTierWithStripe): { text: string; highlighted: boolean }[] => {
    // If tier has database features, use them
    if (hasFeatures(tier) && tier.features && tier.features.length > 0) {
      return tier.features.map((f) => ({
        text: f.feature_text,
        highlighted: f.is_highlighted,
      }));
    }

    // Fallback: Generate features from tier limits
    const features: { text: string; highlighted: boolean }[] = [];

    // Download limits
    if (tier.daily_download_limit) {
      features.push({ text: `${tier.daily_download_limit} downloads per day`, highlighted: false });
    } else if (tier.slug !== "free") {
      features.push({ text: "Unlimited daily downloads", highlighted: true });
    } else {
      features.push({ text: "3 downloads per day", highlighted: false });
    }

    if (tier.monthly_download_limit) {
      features.push({ text: `${tier.monthly_download_limit} downloads per month`, highlighted: false });
    } else if (tier.slug !== "free") {
      features.push({ text: "Unlimited monthly downloads", highlighted: true });
    } else {
      features.push({ text: "10 downloads per month", highlighted: false });
    }

    // Access levels
    if (tier.can_access_premium) {
      features.push({ text: "Access to Premium designs", highlighted: true });
    }
    if (tier.can_access_exclusive) {
      features.push({ text: "Access to Exclusive designs", highlighted: true });
    }

    // Collections
    if (tier.can_create_collections) {
      if (tier.max_collections) {
        features.push({ text: `Up to ${tier.max_collections} collections`, highlighted: false });
      } else {
        features.push({ text: "Unlimited collections", highlighted: false });
      }
    }

    // Favorites
    if (tier.max_favorites) {
      features.push({ text: `Up to ${tier.max_favorites} favorites`, highlighted: false });
    } else if (tier.slug !== "free") {
      features.push({ text: "Unlimited favorites", highlighted: false });
    }

    return features;
  };

  // Get highlight label from database or use default
  const getHighlightLabel = (tier: AccessTierFull | AccessTierWithStripe): string | null => {
    if (hasFeatures(tier) && tier.highlight_label) {
      return tier.highlight_label;
    }
    // Default: Premium tier gets "Most Popular"
    return tier.slug === "premium" ? "Most Popular" : null;
  };

  // Get CTA text from database or use default
  const getCtaText = (tier: AccessTierFull | AccessTierWithStripe): string => {
    if (hasFeatures(tier) && tier.cta_text) {
      return tier.cta_text;
    }
    return `Get ${tier.name}`;
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
                    {feature.highlighted ? (
                      <Star className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="currentColor" />
                    ) : (
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    )}
                    <span className={`text-sm ${feature.highlighted ? "font-medium" : ""}`}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                variant="outline"
                className="w-full"
                disabled={currentTierId === freeTier.id || !isLoggedIn}
              >
                {currentTierId === freeTier.id ? "Current Plan" : getCtaText(freeTier)}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Paid Tiers */}
        {paidTiers.map((tier) => {
          const isCurrentTier = currentTierId === tier.id;
          const highlightLabel = getHighlightLabel(tier);
          const isHighlighted = !!highlightLabel;
          const isLoading = loadingTierId === tier.id;

          return (
            <Card
              key={tier.id}
              className={`relative ${isHighlighted ? "border-primary shadow-lg" : ""}`}
            >
              {highlightLabel && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  {highlightLabel}
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
                      {feature.highlighted ? (
                        <Star className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="currentColor" />
                      ) : (
                        <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      )}
                      <span className={`text-sm ${feature.highlighted ? "font-medium" : ""}`}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={isHighlighted ? "default" : "outline"}
                  disabled={isCurrentTier || isLoading}
                  onClick={() => handleCheckout(tier.id)}
                >
                  {isLoading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Loading...
                    </>
                  ) : isCurrentTier ? (
                    "Current Plan"
                  ) : (
                    getCtaText(tier)
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
