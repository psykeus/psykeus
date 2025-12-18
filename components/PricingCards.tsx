"use client";

/**
 * PricingCards Component
 *
 * Displays pricing tiers with yearly/lifetime toggle and checkout buttons.
 * Uses live Stripe pricing as the source of truth.
 * Supports promo codes during checkout.
 */

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Sparkles, Star, Tag } from "lucide-react";
import { Spinner } from "@/components/ui/loading-states";
import type { AccessTierForPricing, TierFeature } from "@/lib/types";

interface PricingCardsProps {
  tiers: AccessTierForPricing[];
  currentTierId?: string | null;
  isLoggedIn: boolean;
}

export function PricingCards({ tiers, currentTierId, isLoggedIn }: PricingCardsProps) {
  const [isLifetime, setIsLifetime] = useState(false);
  const [loadingTierId, setLoadingTierId] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);

  // Get free tier (for feature comparison)
  const freeTier = tiers.find((t) => t.slug === "free");
  const paidTiers = tiers.filter((t) => t.slug !== "free");

  // Determine available pricing options across all tiers
  const pricingOptions = useMemo(() => {
    const hasYearly = paidTiers.some((t) => t.stripe_yearly_price);
    const hasLifetime = paidTiers.some((t) => t.stripe_lifetime_price);
    return { hasYearly, hasLifetime };
  }, [paidTiers]);

  // If we're showing lifetime but no tiers have it, switch to yearly
  // Or if showing yearly but no tiers have it, switch to lifetime
  const effectiveIsLifetime = useMemo(() => {
    if (isLifetime && !pricingOptions.hasLifetime) return false;
    if (!isLifetime && !pricingOptions.hasYearly) return true;
    return isLifetime;
  }, [isLifetime, pricingOptions]);

  const handleCheckout = async (tierId: string) => {
    if (!isLoggedIn) {
      window.location.href = `/login?returnTo=/pricing`;
      return;
    }

    setLoadingTierId(tierId);
    setPromoError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier_id: tierId,
          price_type: effectiveIsLifetime ? "lifetime" : "yearly",
          promo_code: promoCode.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL received:", data);
        if (data.error?.includes("promo") || data.error?.includes("coupon")) {
          setPromoError(data.error);
        } else {
          alert(data.error || "Failed to start checkout");
        }
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setLoadingTierId(null);
    }
  };

  // Get price from Stripe data
  const getPrice = (tier: AccessTierForPricing): string => {
    if (tier.slug === "free") return "$0";

    if (effectiveIsLifetime) {
      return tier.stripe_lifetime_price?.formatted || "N/A";
    } else {
      return tier.stripe_yearly_price?.formatted || "N/A";
    }
  };

  // Get price label
  const getPriceLabel = (tier: AccessTierForPricing): string => {
    if (tier.slug === "free") return "forever";
    if (effectiveIsLifetime) {
      return tier.stripe_lifetime_price ? "one-time" : "";
    }
    return tier.stripe_yearly_price ? "/year" : "";
  };

  // Check if tier has valid price for current mode
  const hasPriceForMode = (tier: AccessTierForPricing): boolean => {
    if (tier.slug === "free") return true;
    if (effectiveIsLifetime) return !!tier.stripe_lifetime_price;
    return !!tier.stripe_yearly_price;
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

  // Get features from tier
  const getFeatures = (tier: AccessTierForPricing): { text: string; highlighted: boolean }[] => {
    if (tier.features && tier.features.length > 0) {
      return tier.features.map((f: TierFeature) => ({
        text: f.feature_text,
        highlighted: f.is_highlighted,
      }));
    }

    // Fallback: Generate features from tier limits
    const features: { text: string; highlighted: boolean }[] = [];

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

    if (tier.can_access_premium) {
      features.push({ text: "Access to Premium designs", highlighted: true });
    }
    if (tier.can_access_exclusive) {
      features.push({ text: "Access to Exclusive designs", highlighted: true });
    }

    if (tier.can_create_collections) {
      if (tier.max_collections) {
        features.push({ text: `Up to ${tier.max_collections} collections`, highlighted: false });
      } else {
        features.push({ text: "Unlimited collections", highlighted: false });
      }
    }

    if (tier.max_favorites) {
      features.push({ text: `Up to ${tier.max_favorites} favorites`, highlighted: false });
    } else if (tier.slug !== "free") {
      features.push({ text: "Unlimited favorites", highlighted: false });
    }

    return features;
  };

  const getHighlightLabel = (tier: AccessTierForPricing): string | null => {
    return tier.highlight_label || (tier.slug === "premium" ? "Most Popular" : null);
  };

  const getCtaText = (tier: AccessTierForPricing): string => {
    return tier.cta_text || `Get ${tier.name}`;
  };

  // Only show toggle if both options are available
  const showPricingToggle = pricingOptions.hasYearly && pricingOptions.hasLifetime;

  return (
    <div className="space-y-8">
      {/* Pricing Toggle - only show if both options exist */}
      {showPricingToggle && (
        <div className="flex items-center justify-center gap-4">
          <Label htmlFor="pricing-toggle" className={!effectiveIsLifetime ? "font-semibold" : ""}>
            Yearly
          </Label>
          <Switch
            id="pricing-toggle"
            checked={effectiveIsLifetime}
            onCheckedChange={setIsLifetime}
          />
          <Label htmlFor="pricing-toggle" className={effectiveIsLifetime ? "font-semibold" : ""}>
            Lifetime
            <Badge variant="secondary" className="ml-2">Best Value</Badge>
          </Label>
        </div>
      )}

      {/* Single option label if only one type available */}
      {!showPricingToggle && (pricingOptions.hasYearly || pricingOptions.hasLifetime) && (
        <div className="flex items-center justify-center">
          <Badge variant="outline" className="text-base px-4 py-1">
            {pricingOptions.hasLifetime ? "Lifetime Access" : "Annual Subscription"}
          </Badge>
        </div>
      )}

      {/* Promo Code Input */}
      <div className="max-w-md mx-auto">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Promo code (optional)"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value.toUpperCase());
                setPromoError(null);
              }}
              className="pl-10"
            />
          </div>
        </div>
        {promoError && (
          <p className="text-sm text-destructive mt-1">{promoError}</p>
        )}
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
          const hasPrice = hasPriceForMode(tier);

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
                  <span className="text-4xl font-bold">{getPrice(tier)}</span>
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
                  disabled={isCurrentTier || isLoading || !hasPrice}
                  onClick={() => handleCheckout(tier.id)}
                >
                  {isLoading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Loading...
                    </>
                  ) : isCurrentTier ? (
                    "Current Plan"
                  ) : !hasPrice ? (
                    "Not Available"
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
