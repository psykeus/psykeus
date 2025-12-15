"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { UserWithTier, AccessTier, UserStatus } from "@/lib/types";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Shield,
  Crown,
  Ban,
  CheckCircle,
  XCircle,
  LogOut,
  Eye,
} from "lucide-react";

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

      if (modalAction === "suspend" || modalAction === "ban") {
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

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs">
            <CheckCircle className="h-3 w-3" />
            Active
          </span>
        );
      case "suspended":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full text-xs">
            <XCircle className="h-3 w-3" />
            Suspended
          </span>
        );
      case "banned":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs">
            <Ban className="h-3 w-3" />
            Banned
          </span>
        );
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded-full text-xs">
            <Crown className="h-3 w-3" />
            Super Admin
          </span>
        );
      case "admin":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs">
            <Shield className="h-3 w-3" />
            Admin
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-secondary rounded-full text-xs">
            User
          </span>
        );
    }
  };

  const getTierBadge = (tier: AccessTier | null | undefined) => {
    if (!tier) {
      return (
        <span className="px-2 py-1 bg-secondary rounded-full text-xs">Free</span>
      );
    }

    switch (tier.slug) {
      case "pro":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full text-xs">
            <Crown className="h-3 w-3" />
            Pro
          </span>
        );
      case "premium":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs">
            <Shield className="h-3 w-3" />
            Premium
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-secondary rounded-full text-xs">
            {tier.name}
          </span>
        );
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>Error: {error}</p>
        <button
          onClick={fetchUsers}
          className="mt-4 text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-end">
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
                  <td className="p-4">{getRoleBadge(user.role)}</td>
                  <td className="p-4">{getTierBadge(user.access_tier)}</td>
                  <td className="p-4">{getStatusBadge(user.status)}</td>
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
                      <div className="relative group">
                        <button className="p-2 hover:bg-secondary rounded-md">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        <div className="absolute right-0 top-full mt-1 w-48 bg-card border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          <div className="py-1">
                            {user.role !== "super_admin" && (
                              <>
                                <button
                                  onClick={() => openModal(user, "update_tier")}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2"
                                >
                                  <Crown className="h-4 w-4" />
                                  Change Tier
                                </button>
                                <button
                                  onClick={() => openModal(user, "update_role")}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2"
                                >
                                  <Shield className="h-4 w-4" />
                                  Change Role
                                </button>
                                <hr className="my-1" />
                                <button
                                  onClick={() => openModal(user, "force_logout")}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2"
                                >
                                  <LogOut className="h-4 w-4" />
                                  Force Logout
                                </button>
                                {user.status === "active" ? (
                                  <>
                                    <button
                                      onClick={() => openModal(user, "suspend")}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-secondary text-amber-600 flex items-center gap-2"
                                    >
                                      <XCircle className="h-4 w-4" />
                                      Suspend
                                    </button>
                                    <button
                                      onClick={() => openModal(user, "ban")}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-secondary text-red-600 flex items-center gap-2"
                                    >
                                      <Ban className="h-4 w-4" />
                                      Ban
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => openModal(user, "unsuspend")}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-secondary text-green-600 flex items-center gap-2"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                    Activate
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(!data?.users || data.users.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            No users found.
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * data.pageSize + 1} to{" "}
            {Math.min(page * data.pageSize, data.total)} of {data.total} users
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2 border rounded-md hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-4 py-2 border rounded-md bg-secondary">
              {page} / {data.totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(data.totalPages, page + 1))}
              disabled={page === data.totalPages}
              className="p-2 border rounded-md hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">
              {modalAction === "suspend" && "Suspend User"}
              {modalAction === "unsuspend" && "Activate User"}
              {modalAction === "ban" && "Ban User"}
              {modalAction === "update_tier" && "Change Subscription Tier"}
              {modalAction === "update_role" && "Change Role"}
              {modalAction === "force_logout" && "Force Logout"}
            </h2>

            <p className="text-muted-foreground mb-4">
              User: <strong>{selectedUser.email}</strong>
            </p>

            {(modalAction === "suspend" || modalAction === "ban") && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  rows={3}
                  placeholder="Enter reason for this action..."
                  required
                />
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

            {modalAction === "unsuspend" && (
              <p className="mb-4 text-sm">
                This will restore the user's access to their account.
              </p>
            )}

            {modalAction === "force_logout" && (
              <p className="mb-4 text-sm">
                This will log the user out from all devices immediately.
              </p>
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
                  ((modalAction === "suspend" || modalAction === "ban") &&
                    !actionReason) ||
                  (modalAction === "update_tier" && !actionData.tier_id)
                }
                className={`px-4 py-2 rounded-md text-white disabled:opacity-50 ${
                  modalAction === "ban"
                    ? "bg-red-600 hover:bg-red-700"
                    : modalAction === "suspend"
                    ? "bg-amber-600 hover:bg-amber-700"
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
