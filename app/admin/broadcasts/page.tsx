/**
 * Broadcasts Admin Page
 *
 * Allows admins to create and send broadcast notifications to users.
 */

import { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { BroadcastsClient } from "./BroadcastsClient";

export const metadata: Metadata = {
  title: "Broadcasts - Admin",
  description: "Send notifications to all users or specific groups",
};

export default async function BroadcastsAdminPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Broadcasts</h1>
        <p className="text-muted-foreground">
          Send notifications and emails to all users or targeted groups.
        </p>
      </div>

      <BroadcastsClient />
    </div>
  );
}
