/**
 * Pricing Page
 *
 * Displays subscription tiers and pricing options.
 */

import { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { getAccessTiersWithPricing } from "@/lib/services/stripe-service";
import { getUserWithTier } from "@/lib/services/user-service";
import { PricingCards } from "@/components/PricingCards";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Zap, Heart, MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing - CNC Design Library",
  description:
    "Choose the plan that works for you. Access premium CNC and laser cutting designs with our flexible subscription options.",
};

export default async function PricingPage() {
  const [user, tiers] = await Promise.all([
    getUser(),
    getAccessTiersWithPricing(),
  ]);

  let currentTierId: string | null = null;

  if (user) {
    const userWithTier = await getUserWithTier(user.id);
    currentTierId = userWithTier?.tier_id || null;
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="font-heading text-4xl font-bold mb-4">
          Choose Your Plan
        </h1>
        <p className="text-lg text-muted-foreground">
          Unlock unlimited downloads and exclusive designs. Choose yearly for
          flexibility or lifetime for the best value.
        </p>
      </div>

      {/* Pricing Cards */}
      <PricingCards
        tiers={tiers}
        currentTierId={currentTierId}
        isLoggedIn={!!user}
      />

      {/* Features Section */}
      <section className="mt-20 max-w-4xl mx-auto">
        <h2 className="font-heading text-2xl font-semibold text-center mb-10">
          All Plans Include
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Secure Payments</h3>
                <p className="text-sm text-muted-foreground">
                  All payments are processed securely through Stripe. Your payment
                  information is never stored on our servers.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Instant Access</h3>
                <p className="text-sm text-muted-foreground">
                  Get immediate access to all included designs as soon as your
                  payment is confirmed.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Heart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">30-Day Guarantee</h3>
                <p className="text-sm text-muted-foreground">
                  Not satisfied? Get a full refund within 30 days of purchase,
                  no questions asked.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Priority Support</h3>
                <p className="text-sm text-muted-foreground">
                  Premium and Pro members get priority access to our support team
                  for any questions.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="mt-20 max-w-2xl mx-auto">
        <h2 className="font-heading text-2xl font-semibold text-center mb-10">
          Frequently Asked Questions
        </h2>
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">
              What&apos;s the difference between yearly and lifetime?
            </h3>
            <p className="text-muted-foreground text-sm">
              Yearly subscriptions renew automatically each year and can be
              canceled anytime. Lifetime purchases are a one-time payment that
              gives you permanent access to your tier level.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Can I upgrade my plan later?</h3>
            <p className="text-muted-foreground text-sm">
              Yes! You can upgrade from Free to Premium or Pro at any time.
              If you have an active yearly subscription, you&apos;ll receive
              prorated credit toward your upgrade.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">How do I cancel my subscription?</h3>
            <p className="text-muted-foreground text-sm">
              You can manage your subscription from your account page. Click
              &quot;Manage Billing&quot; to access the Stripe customer portal where
              you can cancel or update your subscription.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">
              What happens to my downloads if I cancel?
            </h3>
            <p className="text-muted-foreground text-sm">
              Any files you&apos;ve already downloaded are yours to keep. After
              cancellation, you&apos;ll retain access until the end of your
              billing period, then revert to the Free tier.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">
              Do you offer refunds?
            </h3>
            <p className="text-muted-foreground text-sm">
              Yes, we offer a 30-day money-back guarantee on all plans. If
              you&apos;re not satisfied, contact our support team for a full
              refund.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
