"use client";

/**
 * StripeCouponManager Component
 *
 * Manages Stripe coupons and promo codes with CRUD operations.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  RefreshCw,
  Ticket,
  Tag,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { PageLoading, Spinner } from "@/components/ui/loading-states";
import type { StripeCoupon, StripePromoCode, CouponDuration } from "@/lib/types";

export function StripeCouponManager() {
  const [coupons, setCoupons] = useState<StripeCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedCoupon, setExpandedCoupon] = useState<string | null>(null);
  const [includeInvalid, setIncludeInvalid] = useState(false);

  // Create coupon dialog
  const [showCreateCoupon, setShowCreateCoupon] = useState(false);
  const [couponName, setCouponName] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [duration, setDuration] = useState<CouponDuration>("once");
  const [durationInMonths, setDurationInMonths] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [redeemBy, setRedeemBy] = useState("");
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  // Create promo code dialog
  const [showCreatePromo, setShowCreatePromo] = useState(false);
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoMaxRedemptions, setPromoMaxRedemptions] = useState("");
  const [promoExpiresAt, setPromoExpiresAt] = useState("");
  const [promoFirstTimeOnly, setPromoFirstTimeOnly] = useState(false);
  const [creatingPromo, setCreatingPromo] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "coupon" | "promo";
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCoupons = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        if (includeInvalid) params.set("includeInvalid", "true");

        const res = await fetch(`/api/admin/stripe/coupons?${params}`);
        if (res.ok) {
          const data = await res.json();
          setCoupons(data.coupons || []);
        }
      } catch (error) {
        console.error("Failed to fetch coupons:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [includeInvalid]
  );

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const handleCreateCoupon = async () => {
    if (!couponName.trim() || !discountValue) return;

    setCreatingCoupon(true);
    try {
      const body: Record<string, unknown> = {
        name: couponName.trim(),
        duration,
      };

      if (discountType === "percent") {
        body.percentOff = parseFloat(discountValue);
      } else {
        body.amountOff = Math.round(parseFloat(discountValue) * 100);
        body.currency = "usd";
      }

      if (duration === "repeating" && durationInMonths) {
        body.durationInMonths = parseInt(durationInMonths, 10);
      }

      if (maxRedemptions) {
        body.maxRedemptions = parseInt(maxRedemptions, 10);
      }

      if (redeemBy) {
        body.redeemBy = new Date(redeemBy).toISOString();
      }

      const res = await fetch("/api/admin/stripe/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowCreateCoupon(false);
        resetCouponForm();
        await fetchCoupons(true);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create coupon");
      }
    } catch (error) {
      console.error("Error creating coupon:", error);
      alert("Failed to create coupon");
    } finally {
      setCreatingCoupon(false);
    }
  };

  const handleCreatePromoCode = async () => {
    if (!selectedCouponId || !promoCode.trim()) return;

    setCreatingPromo(true);
    try {
      const body: Record<string, unknown> = {
        couponId: selectedCouponId,
        code: promoCode.trim().toUpperCase(),
      };

      if (promoMaxRedemptions) {
        body.maxRedemptions = parseInt(promoMaxRedemptions, 10);
      }

      if (promoExpiresAt) {
        body.expiresAt = new Date(promoExpiresAt).toISOString();
      }

      if (promoFirstTimeOnly) {
        body.firstTimeTransaction = true;
      }

      const res = await fetch("/api/admin/stripe/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowCreatePromo(false);
        resetPromoForm();
        await fetchCoupons(true);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create promo code");
      }
    } catch (error) {
      console.error("Error creating promo code:", error);
      alert("Failed to create promo code");
    } finally {
      setCreatingPromo(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const endpoint =
        deleteTarget.type === "coupon"
          ? `/api/admin/stripe/coupons/${deleteTarget.id}`
          : `/api/admin/stripe/promo-codes/${deleteTarget.id}`;

      const res = await fetch(endpoint, { method: "DELETE" });

      if (res.ok) {
        setDeleteTarget(null);
        await fetchCoupons(true);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete");
      }
    } catch (error) {
      console.error("Error deleting:", error);
      alert("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const resetCouponForm = () => {
    setCouponName("");
    setDiscountType("percent");
    setDiscountValue("");
    setDuration("once");
    setDurationInMonths("");
    setMaxRedemptions("");
    setRedeemBy("");
  };

  const resetPromoForm = () => {
    setSelectedCouponId(null);
    setPromoCode("");
    setPromoMaxRedemptions("");
    setPromoExpiresAt("");
    setPromoFirstTimeOnly(false);
  };

  const formatDiscount = (coupon: StripeCoupon): string => {
    if (coupon.percentOff) {
      return `${coupon.percentOff}% off`;
    }
    if (coupon.amountOff && coupon.currency) {
      return `$${(coupon.amountOff / 100).toFixed(2)} off`;
    }
    return "Unknown discount";
  };

  const openCreatePromoDialog = (couponId: string) => {
    setSelectedCouponId(couponId);
    setShowCreatePromo(true);
  };

  if (loading) {
    return <PageLoading message="Loading coupons..." />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Coupons & Promo Codes</CardTitle>
            <CardDescription>
              Create and manage discount coupons and promotional codes
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="include-invalid"
                checked={includeInvalid}
                onCheckedChange={setIncludeInvalid}
              />
              <Label htmlFor="include-invalid" className="text-sm">
                Show expired
              </Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCoupons(true)}
              disabled={refreshing}
            >
              {refreshing ? <Spinner size="sm" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Dialog open={showCreateCoupon} onOpenChange={setShowCreateCoupon}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Create Coupon
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Coupon</DialogTitle>
                  <DialogDescription>
                    Create a new discount coupon in Stripe
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="couponName">Coupon Name</Label>
                    <Input
                      id="couponName"
                      value={couponName}
                      onChange={(e) => setCouponName(e.target.value)}
                      placeholder="e.g., Launch Special"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Discount Type</Label>
                      <Select
                        value={discountType}
                        onValueChange={(v) => setDiscountType(v as "percent" | "amount")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">Percentage</SelectItem>
                          <SelectItem value="amount">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="discountValue">
                        {discountType === "percent" ? "Percent Off" : "Amount (USD)"}
                      </Label>
                      <Input
                        id="discountValue"
                        type="number"
                        min="0"
                        max={discountType === "percent" ? "100" : undefined}
                        step={discountType === "percent" ? "1" : "0.01"}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        placeholder={discountType === "percent" ? "20" : "10.00"}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Select
                      value={duration}
                      onValueChange={(v) => setDuration(v as CouponDuration)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">Once</SelectItem>
                        <SelectItem value="forever">Forever</SelectItem>
                        <SelectItem value="repeating">Repeating</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {duration === "repeating" && (
                    <div className="space-y-2">
                      <Label htmlFor="durationMonths">Duration (months)</Label>
                      <Input
                        id="durationMonths"
                        type="number"
                        min="1"
                        value={durationInMonths}
                        onChange={(e) => setDurationInMonths(e.target.value)}
                        placeholder="3"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxRedemptions">Max Redemptions (optional)</Label>
                      <Input
                        id="maxRedemptions"
                        type="number"
                        min="1"
                        value={maxRedemptions}
                        onChange={(e) => setMaxRedemptions(e.target.value)}
                        placeholder="100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="redeemBy">Expires On (optional)</Label>
                      <Input
                        id="redeemBy"
                        type="date"
                        value={redeemBy}
                        onChange={(e) => setRedeemBy(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateCoupon(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateCoupon}
                    disabled={!couponName.trim() || !discountValue || creatingCoupon}
                  >
                    {creatingCoupon ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Creating...
                      </>
                    ) : (
                      "Create Coupon"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {coupons.length === 0 ? (
          <div className="text-center py-12">
            <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground mb-2">No coupons found</p>
            <p className="text-sm text-muted-foreground">
              Create your first coupon to get started
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className={`border rounded-lg p-4 ${!coupon.valid ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{coupon.name || coupon.id}</h3>
                      <Badge variant={coupon.valid ? "default" : "secondary"}>
                        {formatDiscount(coupon)}
                      </Badge>
                      {!coupon.valid && (
                        <Badge variant="destructive">Expired</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {coupon.duration === "repeating"
                          ? `${coupon.durationInMonths} months`
                          : coupon.duration}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>Used {coupon.timesRedeemed} times</span>
                      {coupon.maxRedemptions && (
                        <span>Max: {coupon.maxRedemptions}</span>
                      )}
                      {coupon.redeemBy && (
                        <span>
                          Expires: {new Date(coupon.redeemBy).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ID: {coupon.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openCreatePromoDialog(coupon.id)}
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      Add Code
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedCoupon(
                          expandedCoupon === coupon.id ? null : coupon.id
                        )
                      }
                    >
                      {expandedCoupon === coupon.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() =>
                        setDeleteTarget({
                          type: "coupon",
                          id: coupon.id,
                          name: coupon.name || coupon.id,
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Promo codes section */}
                {expandedCoupon === coupon.id && (
                  <div className="mt-4 pl-4 border-l-2 space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Promo Codes ({coupon.promoCodes?.length || 0})
                    </h4>
                    {coupon.promoCodes && coupon.promoCodes.length > 0 ? (
                      coupon.promoCodes.map((pc) => (
                        <div
                          key={pc.id}
                          className={`flex items-center justify-between text-sm p-2 rounded bg-muted/50 ${
                            !pc.active ? "opacity-60" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <code className="font-mono font-medium">{pc.code}</code>
                            {!pc.active && (
                              <Badge variant="secondary" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                            {pc.firstTimeTransaction && (
                              <Badge variant="outline" className="text-xs">
                                First-time only
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">
                              Used {pc.timesRedeemed}
                              {pc.maxRedemptions && `/${pc.maxRedemptions}`}
                            </span>
                            {pc.expiresAt && (
                              <span className="text-muted-foreground">
                                Expires:{" "}
                                {new Date(pc.expiresAt).toLocaleDateString()}
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive"
                              onClick={() =>
                                setDeleteTarget({
                                  type: "promo",
                                  id: pc.id,
                                  name: pc.code,
                                })
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No promo codes yet. Add one to share this coupon.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create Promo Code Dialog */}
        <Dialog open={showCreatePromo} onOpenChange={setShowCreatePromo}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Promo Code</DialogTitle>
              <DialogDescription>
                Create a shareable code that applies this coupon
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="promoCode">Promo Code</Label>
                <Input
                  id="promoCode"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="e.g., SAVE20"
                  className="font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  Alphanumeric with dashes and underscores only
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="promoMaxRedemptions">Max Uses (optional)</Label>
                  <Input
                    id="promoMaxRedemptions"
                    type="number"
                    min="1"
                    value={promoMaxRedemptions}
                    onChange={(e) => setPromoMaxRedemptions(e.target.value)}
                    placeholder="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promoExpiresAt">Expires On (optional)</Label>
                  <Input
                    id="promoExpiresAt"
                    type="date"
                    value={promoExpiresAt}
                    onChange={(e) => setPromoExpiresAt(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="firstTimeOnly"
                  checked={promoFirstTimeOnly}
                  onCheckedChange={setPromoFirstTimeOnly}
                />
                <Label htmlFor="firstTimeOnly">First-time customers only</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreatePromo(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreatePromoCode}
                disabled={!promoCode.trim() || creatingPromo}
              >
                {creatingPromo ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Creating...
                  </>
                ) : (
                  "Create Code"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteTarget?.type === "coupon"
                  ? "Delete Coupon?"
                  : "Deactivate Promo Code?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget?.type === "coupon" ? (
                  <>
                    This will permanently delete the coupon &quot;{deleteTarget?.name}&quot; and
                    all associated promo codes. This action cannot be undone.
                  </>
                ) : (
                  <>
                    This will deactivate the promo code &quot;{deleteTarget?.name}&quot;.
                    It will no longer be usable by customers.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Deleting...
                  </>
                ) : deleteTarget?.type === "coupon" ? (
                  "Delete Coupon"
                ) : (
                  "Deactivate Code"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
