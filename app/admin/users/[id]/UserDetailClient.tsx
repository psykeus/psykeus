"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { UserWithTier, AccessTier, UserStatus } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Mail,
  Calendar,
  Clock,
  Download,
  Heart,
  FolderHeart,
  Activity,
  Monitor,
  CreditCard,
  Shield,
  Crown,
  Ban,
  CheckCircle,
  XCircle,
  LogOut,
  Loader2,
  AlertCircle,
  Globe,
  User,
  ExternalLink,
} from "lucide-react";

interface UserDetailResponse {
  user: UserWithTier;
  stats: {
    totalDownloads: number;
    totalFavorites: number;
    totalCollections: number;
  };
  sessions: Array<{
    id: string;
    created_at: string;
    last_active_at: string;
    user_agent: string;
    ip_address: string;
  }>;
}

interface UserActivity {
  id: string;
  activity_type: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface UserDownload {
  id: string;
  design_id: string;
  downloaded_at: string;
  design?: {
    title: string;
    slug: string;
  };
}

interface Props {
  userId: string;
}

export function UserDetailClient({ userId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tiers, setTiers] = useState<AccessTier[]>([]);

  // Activity and downloads
  const [activity, setActivity] = useState<UserActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [downloads, setDownloads] = useState<UserDownload[]>([]);
  const [downloadsLoading, setDownloadsLoading] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionData, setActionData] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch user");
      }
      const json = await res.json();
      setData(json);

      // Fetch tiers for the modal
      const tiersRes = await fetch("/api/admin/users?pageSize=1");
      if (tiersRes.ok) {
        const tiersData = await tiersRes.json();
        setTiers(tiersData.tiers || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchActivity = async () => {
    setActivityLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/activity`);
      if (res.ok) {
        const json = await res.json();
        setActivity(json.activity || []);
      }
    } catch (err) {
      console.error("Failed to fetch activity:", err);
    } finally {
      setActivityLoading(false);
    }
  };

  const fetchDownloads = async () => {
    setDownloadsLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/downloads`);
      if (res.ok) {
        const json = await res.json();
        setDownloads(json.downloads || []);
      }
    } catch (err) {
      console.error("Failed to fetch downloads:", err);
    } finally {
      setDownloadsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleAction = async () => {
    if (!data?.user || !modalAction) return;

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

      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Action failed");
      }

      fetchUser();
      setShowModal(false);
      setModalAction(null);
      setActionReason("");
      setActionData({});
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const openModal = (action: string) => {
    setModalAction(action);
    setShowModal(true);
    setActionReason("");
    setActionData({});
  };

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "suspended":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            <XCircle className="h-3 w-3 mr-1" />
            Suspended
          </Badge>
        );
      case "banned":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <Ban className="h-3 w-3 mr-1" />
            Banned
          </Badge>
        );
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
            <Crown className="h-3 w-3 mr-1" />
            Super Admin
          </Badge>
        );
      case "admin":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            <Shield className="h-3 w-3 mr-1" />
            Admin
          </Badge>
        );
      default:
        return <Badge variant="secondary">User</Badge>;
    }
  };

  const getTierBadge = (tier: AccessTier | null | undefined) => {
    if (!tier) {
      return <Badge variant="secondary">Free</Badge>;
    }

    switch (tier.slug) {
      case "pro":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <Crown className="h-3 w-3 mr-1" />
            Pro
          </Badge>
        );
      case "premium":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            <Shield className="h-3 w-3 mr-1" />
            Premium
          </Badge>
        );
      default:
        return <Badge variant="secondary">{tier.name}</Badge>;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "login":
        return <User className="h-4 w-4" />;
      case "download":
        return <Download className="h-4 w-4" />;
      case "favorite":
        return <Heart className="h-4 w-4" />;
      case "view":
        return <Globe className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <p className="text-destructive mb-4">{error || "User not found"}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const { user, stats, sessions } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">User Details</h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
      </div>

      {/* User Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {user.name || user.email}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4" />
                  {user.email}
                </CardDescription>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusBadge(user.status)}
                  {getRoleBadge(user.role)}
                  {getTierBadge(user.access_tier)}
                </div>
              </div>
            </div>

            {user.role !== "super_admin" && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => openModal("update_tier")}>
                  <Crown className="h-4 w-4 mr-2" />
                  Change Tier
                </Button>
                {user.status === "active" ? (
                  <Button variant="outline" className="text-amber-600" onClick={() => openModal("suspend")}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Suspend
                  </Button>
                ) : (
                  <Button variant="outline" className="text-green-600" onClick={() => openModal("unsuspend")}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Activate
                  </Button>
                )}
                <Button variant="outline" onClick={() => openModal("force_logout")}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Force Logout
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Joined</p>
              <p className="font-medium flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(user.created_at)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Login</p>
              <p className="font-medium flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {user.last_login_at ? formatDate(user.last_login_at) : "Never"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Login Count</p>
              <p className="font-medium">{user.login_count || 0}</p>
            </div>
            {user.tier_expires_at && (
              <div>
                <p className="text-muted-foreground">Tier Expires</p>
                <p className="font-medium">{formatDate(user.tier_expires_at)}</p>
              </div>
            )}
          </div>

          {user.suspended_reason && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                {user.status === "banned" ? "Ban" : "Suspension"} Reason:
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">{user.suspended_reason}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Download className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalDownloads}</p>
                <p className="text-sm text-muted-foreground">Total Downloads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                <Heart className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalFavorites}</p>
                <p className="text-sm text-muted-foreground">Favorites</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <FolderHeart className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalCollections}</p>
                <p className="text-sm text-muted-foreground">Collections</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="activity" className="space-y-4" onValueChange={(value) => {
        if (value === "activity" && activity.length === 0) fetchActivity();
        if (value === "downloads" && downloads.length === 0) fetchDownloads();
      }}>
        <TabsList>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="downloads" className="gap-2">
            <Download className="h-4 w-4" />
            Downloads
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <Monitor className="h-4 w-4" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Subscription
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>User activity log</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : activity.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No activity recorded</p>
              ) : (
                <div className="space-y-4">
                  {activity.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50">
                      <div className="p-2 rounded-full bg-secondary">
                        {getActivityIcon(item.activity_type)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium capitalize">{item.activity_type.replace(/_/g, " ")}</p>
                        {item.entity_type && (
                          <p className="text-sm text-muted-foreground">
                            {item.entity_type}: {item.entity_id}
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{formatDate(item.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="downloads">
          <Card>
            <CardHeader>
              <CardTitle>Download History</CardTitle>
              <CardDescription>Files downloaded by this user</CardDescription>
            </CardHeader>
            <CardContent>
              {downloadsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : downloads.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No downloads yet</p>
              ) : (
                <div className="space-y-2">
                  {downloads.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Download className="h-4 w-4 text-muted-foreground" />
                        <div>
                          {item.design ? (
                            <Link
                              href={`/designs/${item.design.slug}`}
                              className="font-medium hover:underline flex items-center gap-1"
                            >
                              {item.design.title}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <p className="font-medium text-muted-foreground">Design deleted</p>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{formatDate(item.downloaded_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Devices where user is logged in</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No active sessions</p>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div key={session.id} className="flex items-center gap-4 p-3 rounded-lg border">
                      <div className="p-2 rounded-full bg-secondary">
                        <Monitor className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{session.user_agent || "Unknown device"}</p>
                        <p className="text-xs text-muted-foreground">
                          IP: {session.ip_address || "Unknown"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">Last active</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(session.last_active_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Details</CardTitle>
              <CardDescription>Payment and subscription information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Tier</p>
                    <div className="mt-1">{getTierBadge(user.access_tier)}</div>
                  </div>
                  {user.tier_expires_at && (
                    <div>
                      <p className="text-sm text-muted-foreground">Expires</p>
                      <p className="font-medium">{formatDate(user.tier_expires_at)}</p>
                    </div>
                  )}
                </div>

                {(user as UserWithTier & { stripe_customer_id?: string }).stripe_customer_id && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Stripe Customer</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {(user as UserWithTier & { stripe_customer_id?: string }).stripe_customer_id}
                    </code>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Modal */}
      {showModal && (
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
              User: <strong>{user.email}</strong>
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
                  <label className="block text-sm font-medium mb-1">New Tier</label>
                  <select
                    value={actionData.tier_id || ""}
                    onChange={(e) => setActionData({ ...actionData, tier_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="">Select tier...</option>
                    {tiers.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name} - {tier.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Expires At (optional)</label>
                  <input
                    type="datetime-local"
                    value={actionData.expires_at || ""}
                    onChange={(e) => setActionData({ ...actionData, expires_at: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Reason (optional)</label>
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
                  value={actionData.role || user.role}
                  onChange={(e) => setActionData({ ...actionData, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}

            {modalAction === "unsuspend" && (
              <p className="mb-4 text-sm">This will restore the user's access to their account.</p>
            )}

            {modalAction === "force_logout" && (
              <p className="mb-4 text-sm">This will log the user out from all devices immediately.</p>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={
                  actionLoading ||
                  ((modalAction === "suspend" || modalAction === "ban") && !actionReason) ||
                  (modalAction === "update_tier" && !actionData.tier_id)
                }
                variant={modalAction === "ban" ? "destructive" : "default"}
              >
                {actionLoading ? "Processing..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
