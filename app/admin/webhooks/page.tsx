/**
 * Webhooks Admin Page
 *
 * Allows admins to configure webhooks for event notifications.
 */

import { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { WebhooksClient } from "./WebhooksClient";

export const metadata: Metadata = {
  title: "Webhooks - Admin",
  description: "Configure webhook endpoints for event notifications",
};

export default async function WebhooksAdminPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <p className="text-muted-foreground">
          Configure webhook endpoints to receive notifications when events occur.
        </p>
      </div>

      <WebhooksClient />
    </div>
  );
}
