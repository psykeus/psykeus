import { requireAdmin } from "@/lib/auth";
import EmailSettingsClient from "./EmailSettingsClient";

export default async function EmailSettingsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Email Settings</h1>
        <p className="text-muted-foreground">
          Manage SMTP configuration, email templates, and view delivery logs
        </p>
      </div>

      <EmailSettingsClient />
    </div>
  );
}
