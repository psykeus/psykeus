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
  Globe,
  User,
  ExternalLink,
  PauseCircle,
  MinusCircle,
  Play,
  Key,
} from "lucide-react";
import { PageLoading, Spinner } from "@/components/ui/loading-states";
import { PageError } from "@/components/ui/error-states";

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

      if (["suspend", "ban", "pause", "disable"].includes(modalAction)) {
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
      case "paused":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            <PauseCircle className="h-3 w-3 mr-1" />
            Paused
          </Badge>
        );
      case "disabled":
        return (
          <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
            <MinusCircle className="h-3 w-3 mr-1" />
            Disabled
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
    return <PageLoading message="Loading user details..." />;
  }

  if (error || !data) {
    return (
      <PageError
        title="Failed to load user"
        message={error || "User not found"}
        onRetry={fetchUser}
      />
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
                <Button variant="outline" onClick={() => openModal("update_role")}>
                  <Shield className="h-4 w-4 mr-2" />
                  Change Role
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

          {user.status !== "active" && (
            <div className={`mt-4 p-3 rounded-lg ${
              user.status === "banned" || user.status === "suspended"
                ? "bg-amber-50 dark:bg-amber-900/20"
                : user.status === "paused"
                ? "bg-blue-50 dark:bg-blue-900/20"
                : "bg-gray-50 dark:bg-gray-900/20"
            }`}>
              <p className={`text-sm font-medium ${
                user.status === "banned" || user.status === "suspended"
                  ? "text-amber-800 dark:text-amber-400"
                  : user.status === "paused"
                  ? "text-blue-800 dark:text-blue-400"
                  : "text-gray-800 dark:text-gray-400"
              }`}>
                {user.status === "banned" && "Ban Reason:"}
                {user.status === "suspended" && "Suspension Reason:"}
                {user.status === "paused" && "Pause Reason:"}
                {user.status === "disabled" && "Disable Reason:"}
              </p>
              <p className={`text-sm ${
                user.status === "banned" || user.status === "suspended"
                  ? "text-amber-700 dark:text-amber-300"
                  : user.status === "paused"
                  ? "text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300"
              }`}>
                {user.status === "banned" || user.status === "suspended"
                  ? user.suspended_reason || "No reason provided"
                  : user.status === "paused"
                  ? user.paused_reason || "No reason provided"
                  : user.disabled_reason || "No reason provided"
                }
              </p>
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

      {/* Actions Card */}
      {user.role !== "super_admin" && (
        <Card>
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
            <CardDescription>Manage user account status and security</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Actions */}
            <div>
              <h4 className="text-sm font-medium mb-3">Status Actions</h4>
              <div className="flex flex-wrap gap-2">
                {user.status === "active" ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950"
                      onClick={() => openModal("pause")}
                    >
                      <PauseCircle className="h-4 w-4 mr-2" />
                      Pause Account
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-gray-600 border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-950"
                      onClick={() => openModal("disable")}
                    >
                      <MinusCircle className="h-4 w-4 mr-2" />
                      Disable Account
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950"
                      onClick={() => openModal("suspend")}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Suspend Account
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={() => openModal("ban")}
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Ban Account
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950"
                    onClick={() => openModal("activate")}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Activate Account
                  </Button>
                )}
              </div>
            </div>

            {/* Security Actions */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Security Actions</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openModal("send_password_reset")}
                >
                  <Key className="h-4 w-4 mr-2" />
                  Send Password Reset
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openModal("force_logout")}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Force Logout All Sessions
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <Spinner size="md" />
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
                  <Spinner size="md" />
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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Subscription Details</CardTitle>
                <CardDescription>Payment and subscription information</CardDescription>
              </div>
              {user.role !== "super_admin" && (
                <Button onClick={() => openModal("update_tier")}>
                  <Crown className="h-4 w-4 mr-2" />
                  Change Subscription
                </Button>
              )}
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
              User: <strong>{user.email}</strong>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for no expiration
                  </p>
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
                This will send a password reset email to <strong>{user.email}</strong>.
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
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={
                  actionLoading ||
                  (["suspend", "ban"].includes(modalAction || "") && !actionReason) ||
                  (modalAction === "update_tier" && !actionData.tier_id)
                }
                variant={modalAction === "ban" ? "destructive" : "default"}
                className={
                  modalAction === "suspend"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : modalAction === "disable"
                    ? "bg-gray-600 hover:bg-gray-700 text-white"
                    : modalAction === "pause"
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : ["activate", "enable", "unpause"].includes(modalAction || "")
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : ""
                }
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
