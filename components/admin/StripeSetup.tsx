"use client";

/**
 * StripeSetup Component
 *
 * Main tabbed interface for Stripe configuration and management.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StripeConnectionForm } from "./StripeConnectionForm";
import { StripeProductsList } from "./StripeProductsList";
import { StripeTierMapping } from "./StripeTierMapping";
import { Settings, Package, Link } from "lucide-react";

export function StripeSetup() {
  return (
    <Tabs defaultValue="connection" className="space-y-6">
      <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
        <TabsTrigger value="connection" className="gap-2">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Connection</span>
        </TabsTrigger>
        <TabsTrigger value="products" className="gap-2">
          <Package className="h-4 w-4" />
          <span className="hidden sm:inline">Products</span>
        </TabsTrigger>
        <TabsTrigger value="mapping" className="gap-2">
          <Link className="h-4 w-4" />
          <span className="hidden sm:inline">Tier Mapping</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="connection">
        <StripeConnectionForm />
      </TabsContent>

      <TabsContent value="products">
        <StripeProductsList />
      </TabsContent>

      <TabsContent value="mapping">
        <StripeTierMapping />
      </TabsContent>
    </Tabs>
  );
}
