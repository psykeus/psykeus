import { requireAdmin } from "@/lib/auth";
import { TiersClient } from "./TiersClient";

export const metadata = {
  title: "Pricing Tiers - Admin",
};

export default async function TiersPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold">Pricing Tiers</h1>
        <p className="text-muted-foreground mt-1">
          Manage subscription tiers, pricing, and features
        </p>
      </div>
      <TiersClient />
    </div>
  );
}
