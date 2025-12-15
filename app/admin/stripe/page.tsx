/**
 * Stripe Admin Page
 *
 * Allows admins to configure Stripe, manage products, and link prices to tiers.
 */

import { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { StripeSetup } from "@/components/admin/StripeSetup";

export const metadata: Metadata = {
  title: "Stripe Settings - Admin",
  description: "Configure Stripe payments and manage products",
};

export default async function StripeAdminPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stripe Settings</h1>
        <p className="text-muted-foreground">
          Configure your Stripe integration, manage products, and link prices to access tiers.
        </p>
      </div>

      <StripeSetup />
    </div>
  );
}
