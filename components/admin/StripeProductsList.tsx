"use client";

/**
 * StripeProductsList Component
 *
 * Lists Stripe products with their prices and allows creating new ones.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, RefreshCw, Package, DollarSign } from "lucide-react";

interface StripePrice {
  id: string;
  productId: string;
  nickname: string | null;
  unitAmount: number | null;
  currency: string;
  type: "recurring" | "one_time";
  interval?: "year" | "month" | "week" | "day";
  active: boolean;
}

interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  prices: StripePrice[];
}

export function StripeProductsList() {
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create product dialog
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductDescription, setNewProductDescription] = useState("");
  const [creatingProduct, setCreatingProduct] = useState(false);

  // Create price dialog
  const [showCreatePrice, setShowCreatePrice] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [newPriceAmount, setNewPriceAmount] = useState("");
  const [newPriceType, setNewPriceType] = useState<"recurring" | "one_time">("recurring");
  const [newPriceInterval, setNewPriceInterval] = useState<"year" | "month">("year");
  const [newPriceNickname, setNewPriceNickname] = useState("");
  const [creatingPrice, setCreatingPrice] = useState(false);

  const fetchProducts = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/admin/stripe/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleCreateProduct = async () => {
    if (!newProductName.trim()) return;

    setCreatingProduct(true);
    try {
      const res = await fetch("/api/admin/stripe/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProductName.trim(),
          description: newProductDescription.trim() || undefined,
        }),
      });

      if (res.ok) {
        setShowCreateProduct(false);
        setNewProductName("");
        setNewProductDescription("");
        await fetchProducts(true);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create product");
      }
    } catch (error) {
      console.error("Error creating product:", error);
      alert("Failed to create product");
    } finally {
      setCreatingProduct(false);
    }
  };

  const handleCreatePrice = async () => {
    if (!selectedProductId || !newPriceAmount) return;

    const unitAmount = Math.round(parseFloat(newPriceAmount) * 100);
    if (isNaN(unitAmount) || unitAmount <= 0) {
      alert("Please enter a valid price");
      return;
    }

    setCreatingPrice(true);
    try {
      const res = await fetch("/api/admin/stripe/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          unitAmount,
          type: newPriceType,
          interval: newPriceType === "recurring" ? newPriceInterval : undefined,
          nickname: newPriceNickname.trim() || undefined,
        }),
      });

      if (res.ok) {
        setShowCreatePrice(false);
        setSelectedProductId(null);
        setNewPriceAmount("");
        setNewPriceNickname("");
        await fetchProducts(true);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create price");
      }
    } catch (error) {
      console.error("Error creating price:", error);
      alert("Failed to create price");
    } finally {
      setCreatingPrice(false);
    }
  };

  const formatPrice = (amount: number | null, currency: string): string => {
    if (amount === null) return "Custom";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const openCreatePriceDialog = (productId: string) => {
    setSelectedProductId(productId);
    setNewPriceAmount("");
    setNewPriceType("recurring");
    setNewPriceInterval("year");
    setNewPriceNickname("");
    setShowCreatePrice(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Stripe Products</CardTitle>
            <CardDescription>
              Manage your Stripe products and prices
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchProducts(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Dialog open={showCreateProduct} onOpenChange={setShowCreateProduct}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Create Product
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Product</DialogTitle>
                  <DialogDescription>
                    Create a new product in Stripe
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="productName">Product Name</Label>
                    <Input
                      id="productName"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      placeholder="e.g., Premium Membership"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productDescription">Description (Optional)</Label>
                    <Textarea
                      id="productDescription"
                      value={newProductDescription}
                      onChange={(e) => setNewProductDescription(e.target.value)}
                      placeholder="Describe what this product includes..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateProduct(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateProduct}
                    disabled={!newProductName.trim() || creatingProduct}
                  >
                    {creatingProduct ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Product"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground mb-2">No products found</p>
            <p className="text-sm text-muted-foreground">
              Create your first product to get started
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{product.name}</h3>
                    {product.description && (
                      <p className="text-sm text-muted-foreground">
                        {product.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      ID: {product.id}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openCreatePriceDialog(product.id)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Price
                  </Button>
                </div>

                {product.prices.length > 0 ? (
                  <div className="pl-4 border-l-2 space-y-2">
                    {product.prices.map((price) => (
                      <div
                        key={price.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {formatPrice(price.unitAmount, price.currency)}
                          </span>
                          {price.type === "recurring" && price.interval && (
                            <span className="text-muted-foreground">
                              / {price.interval}
                            </span>
                          )}
                          {price.type === "one_time" && (
                            <Badge variant="secondary" className="text-xs">
                              One-time
                            </Badge>
                          )}
                          {price.nickname && (
                            <span className="text-muted-foreground">
                              ({price.nickname})
                            </span>
                          )}
                        </div>
                        <code className="text-xs text-muted-foreground">
                          {price.id}
                        </code>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground pl-4 border-l-2">
                    No prices configured
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create Price Dialog */}
        <Dialog open={showCreatePrice} onOpenChange={setShowCreatePrice}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Price</DialogTitle>
              <DialogDescription>
                Create a new price for this product
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="priceAmount">Amount (USD)</Label>
                <Input
                  id="priceAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newPriceAmount}
                  onChange={(e) => setNewPriceAmount(e.target.value)}
                  placeholder="99.99"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceType">Price Type</Label>
                <Select
                  value={newPriceType}
                  onValueChange={(v) => setNewPriceType(v as "recurring" | "one_time")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recurring">Recurring (Subscription)</SelectItem>
                    <SelectItem value="one_time">One-time (Lifetime)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newPriceType === "recurring" && (
                <div className="space-y-2">
                  <Label htmlFor="priceInterval">Billing Interval</Label>
                  <Select
                    value={newPriceInterval}
                    onValueChange={(v) => setNewPriceInterval(v as "year" | "month")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="year">Yearly</SelectItem>
                      <SelectItem value="month">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="priceNickname">Nickname (Optional)</Label>
                <Input
                  id="priceNickname"
                  value={newPriceNickname}
                  onChange={(e) => setNewPriceNickname(e.target.value)}
                  placeholder="e.g., Yearly Plan"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreatePrice(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreatePrice}
                disabled={!newPriceAmount || creatingPrice}
              >
                {creatingPrice ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Price"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
