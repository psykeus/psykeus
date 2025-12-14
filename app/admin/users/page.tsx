import { requireSuperAdmin } from "@/lib/auth";
import { UsersClient } from "./UsersClient";

export default async function AdminUsersPage() {
  await requireSuperAdmin();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage users, subscriptions, and access control
          </p>
        </div>
      </div>

      <UsersClient />
    </div>
  );
}
