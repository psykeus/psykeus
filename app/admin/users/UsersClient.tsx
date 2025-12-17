"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { UserWithTier, AccessTier } from "@/lib/types";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { UserExportDialog } from "@/components/admin/UserExportDialog";
import { StatusBadge, RoleBadge, TierBadge } from "@/components/ui/status-badges";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  MoreVertical,
  Shield,
  Crown,
  Ban,
  XCircle,
  LogOut,
  Eye,
  PauseCircle,
  MinusCircle,
  Mail,
  Play,
} from "lucide-react";
import { ClientPagination } from "@/components/Pagination";
import { PageLoading } from "@/components/ui/loading-states";
import { PageError } from "@/components/ui/error-states";
import { NoUsers } from "@/components/ui/empty-states";

interface UsersResponse {
  users: UserWithTier[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  tiers: AccessTier[];
}

export function UsersClient() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // Modal state
  const [selectedUser, setSelectedUser] = useState<UserWithTier | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionData, setActionData] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState(false);


  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (tierFilter) params.set("tierId", tierFilter);
      if (roleFilter) params.set("role", roleFilter);

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("Failed to fetch users");

      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, tierFilter, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleAction = async () => {
    if (!selectedUser || !modalAction) return;

    setActionLoading(true);
    try {
      const body: Record<string, unknown> = { action: modalAction };

      if (["suspend", "ban", "pause", "disable"].includes(modalAction)) {
        body.reason = actionReason;
      } else if (modalAction === "update_tier") {
        body.tier_id = actionData.tier_id;
        body.expires_at = actionData.expires_at || null;
        body.reason = actionReason;
      } else if (modalAction === "update_role") {
        body.role = actionData.role;
      }

      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Action failed");
      }

      // Refresh users list
      fetchUsers();
      setShowModal(false);
      setSelectedUser(null);
      setModalAction(null);
      setActionReason("");
      setActionData({});
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const openModal = (user: UserWithTier, action: string) => {
    setSelectedUser(user);
    setModalAction(action);
    setShowModal(true);
    setActionReason("");
    setActionData({});
  };


  if (loading && !data) {
    return <PageLoading message="Loading users..." />;
  }

  if (error) {
    return (
      <PageError
        title="Failed to load users"
        message={error}
        onRetry={fetchUsers}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Create and Export Buttons */}
      <div className="flex justify-end gap-2">
        <UserExportDialog />
        <CreateUserDialog tiers={data?.tiers || []} onUserCreated={fetchUsers} />
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by email or name..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
              />
            </div>
          </form>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="disabled">Disabled</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>

            <select
              value={tierFilter}
              onChange={(e) => {
                setTierFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All Tiers</option>
              {data?.tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>

            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>

        {(search || statusFilter || tierFilter || roleFilter) && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Filters:</span>
            {search && (
              <span className="px-2 py-1 bg-secondary rounded-full">
                Search: {search}
                <button
                  onClick={() => {
                    setSearch("");
                    setSearchInput("");
                  }}
                  className="ml-1 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </span>
            )}
            {statusFilter && (
              <span className="px-2 py-1 bg-secondary rounded-full">
                Status: {statusFilter}
                <button
                  onClick={() => setStatusFilter("")}
                  className="ml-1 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </span>
            )}
            <button
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setStatusFilter("");
                setTierFilter("");
                setRoleFilter("");
              }}
              className="text-primary hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium">User</th>
                <th className="text-left p-4 font-medium">Role</th>
                <th className="text-left p-4 font-medium">Tier</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Last Login</th>
                <th className="text-left p-4 font-medium">Joined</th>
                <th className="text-right p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/30">
                  <td className="p-4">
                    <div>
                      <p className="font-medium">{user.email}</p>
                      {user.name && (
                        <p className="text-sm text-muted-foreground">{user.name}</p>
                      )}
                    </div>
                  </td>
                  <td className="p-4"><RoleBadge role={user.role} /></td>
                  <td className="p-4"><TierBadge tier={user.access_tier} /></td>
                  <td className="p-4"><StatusBadge status={user.status} /></td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {user.last_login_at ? formatDate(user.last_login_at) : "Never"}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="p-2 hover:bg-secondary rounded-md"
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      {user.role !== "super_admin" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 hover:bg-secondary rounded-md">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {/* Account Management */}
                            <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                              Account
                            </DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openModal(user, "update_tier")}>
                              <Crown className="h-4 w-4 mr-2" />
                              Change Tier
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openModal(user, "update_role")}>
                              <Shield className="h-4 w-4 mr-2" />
                              Change Role
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* Security Actions */}
                            <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                              Security
                            </DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openModal(user, "send_password_reset")}>
                              <Mail className="h-4 w-4 mr-2" />
                              Send Password Reset
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openModal(user, "force_logout")}>
                              <LogOut className="h-4 w-4 mr-2" />
                              Force Logout
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* Status Actions */}
                            <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                              Status
                            </DropdownMenuLabel>
                            {user.status === "active" ? (
                              <>
                                <DropdownMenuItem
                                  onClick={() => openModal(user, "pause")}
                                  className="text-blue-600"
                                >
                                  <PauseCircle className="h-4 w-4 mr-2" />
                                  Pause Account
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openModal(user, "disable")}
                                  className="text-gray-600"
                                >
                                  <MinusCircle className="h-4 w-4 mr-2" />
                                  Disable Account
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openModal(user, "suspend")}
                                  className="text-amber-600"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Suspend Account
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openModal(user, "ban")}
                                  className="text-red-600"
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Ban Account
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => openModal(user, "activate")}
                                className="text-green-600"
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Activate Account
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(!data?.users || data.users.length === 0) && <NoUsers />}
      </div>

      {/* Pagination */}
      {data && (
        <ClientPagination
          currentPage={page}
          totalPages={data.totalPages}
          onPageChange={setPage}
          showSummary={{
            from: (page - 1) * data.pageSize + 1,
            to: Math.min(page * data.pageSize, data.total),
            total: data.total,
            itemName: "users",
          }}
        />
      )}

      {/* Action Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">
              {modalAction === "pause" && "Pause User Account"}
              {modalAction === "unpause" && "Unpause User Account"}
              {modalAction === "disable" && "Disable User Account"}
              {modalAction === "enable" && "Enable User Account"}
              {modalAction === "suspend" && "Suspend User Account"}
              {modalAction === "activate" && "Activate User Account"}
              {modalAction === "ban" && "Ban User Account"}
              {modalAction === "update_tier" && "Change Subscription Tier"}
              {modalAction === "update_role" && "Change Role"}
              {modalAction === "force_logout" && "Force Logout"}
              {modalAction === "send_password_reset" && "Send Password Reset"}
            </h2>

            <p className="text-muted-foreground mb-4">
              User: <strong>{selectedUser.email}</strong>
            </p>

            {/* Status change reasons */}
            {["suspend", "ban", "pause", "disable"].includes(modalAction || "") && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Reason {["suspend", "ban"].includes(modalAction || "") && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  rows={3}
                  placeholder={
                    modalAction === "pause"
                      ? "e.g., User requested vacation hold"
                      : modalAction === "disable"
                      ? "e.g., Account inactive or duplicate"
                      : "Enter reason for this action..."
                  }
                  required={["suspend", "ban"].includes(modalAction || "")}
                />
                {modalAction === "pause" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Pause is for user-requested temporary holds (e.g., vacation)
                  </p>
                )}
                {modalAction === "disable" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Disable is admin-initiated and permanent until re-enabled
                  </p>
                )}
                {modalAction === "suspend" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Suspend is for policy violations - user will be logged out
                  </p>
                )}
              </div>
            )}

            {modalAction === "update_tier" && (
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    New Tier
                  </label>
                  <select
                    value={actionData.tier_id || ""}
                    onChange={(e) =>
                      setActionData({ ...actionData, tier_id: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="">Select tier...</option>
                    {data?.tiers.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name} - {tier.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Expires At (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={actionData.expires_at || ""}
                    onChange={(e) =>
                      setActionData({ ...actionData, expires_at: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for no expiration
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Reason (optional)
                  </label>
                  <input
                    type="text"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    placeholder="e.g., Promotional upgrade"
                  />
                </div>
              </div>
            )}

            {modalAction === "update_role" && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">New Role</label>
                <select
                  value={actionData.role || selectedUser.role}
                  onChange={(e) =>
                    setActionData({ ...actionData, role: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}

            {modalAction === "activate" && (
              <p className="mb-4 text-sm">
                This will restore the user's account to active status and clear any suspension/pause/disable flags.
              </p>
            )}

            {modalAction === "unpause" && (
              <p className="mb-4 text-sm">
                This will restore the user's account from paused status.
              </p>
            )}

            {modalAction === "enable" && (
              <p className="mb-4 text-sm">
                This will re-enable the disabled user account.
              </p>
            )}

            {modalAction === "force_logout" && (
              <p className="mb-4 text-sm">
                This will log the user out from all devices immediately.
              </p>
            )}

            {modalAction === "send_password_reset" && (
              <p className="mb-4 text-sm">
                This will send a password reset email to <strong>{selectedUser.email}</strong>.
                The user will receive a link to set a new password.
              </p>
            )}

            {modalAction === "ban" && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-700 dark:text-red-400">
                  <strong>Warning:</strong> Banning is permanent and can only be reversed by a super admin.
                  The user will be immediately logged out.
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedUser(null);
                  setModalAction(null);
                }}
                className="px-4 py-2 border rounded-md hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={
                  actionLoading ||
                  (["suspend", "ban"].includes(modalAction || "") && !actionReason) ||
                  (modalAction === "update_tier" && !actionData.tier_id)
                }
                className={`px-4 py-2 rounded-md text-white disabled:opacity-50 ${
                  modalAction === "ban"
                    ? "bg-red-600 hover:bg-red-700"
                    : modalAction === "suspend"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : modalAction === "disable"
                    ? "bg-gray-600 hover:bg-gray-700"
                    : modalAction === "pause"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : ["activate", "enable", "unpause"].includes(modalAction || "")
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-primary hover:bg-primary/90"
                }`}
              >
                {actionLoading ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
