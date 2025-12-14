import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isCollectionsEnabled } from "@/lib/feature-flags";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderHeart, ArrowLeft, Plus, ChevronRight, Image as ImageIcon } from "lucide-react";
import { CreateCollectionButton } from "./CreateCollectionButton";

export default async function CollectionsPage() {
  // Check if feature is enabled
  const collectionsEnabled = await isCollectionsEnabled();
  if (!collectionsEnabled) {
    redirect("/account");
  }

  const user = await requireUser();
  const supabase = await createClient();

  // Fetch user's collections with item counts
  const { data: collections, error } = await supabase
    .from("collections")
    .select(
      `
      id,
      name,
      description,
      is_public,
      cover_image_url,
      created_at,
      updated_at,
      collection_items (count)
    `
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching collections:", error);
  }

  type CollectionData = {
    id: string;
    name: string;
    description: string | null;
    is_public: boolean;
    cover_image_url: string | null;
    created_at: string;
    updated_at: string;
    collection_items: { count: number }[];
  };

  const transformedCollections = (collections as unknown as CollectionData[])?.map((c) => ({
    ...c,
    item_count: c.collection_items?.[0]?.count || 0,
  })) || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/account">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FolderHeart className="h-8 w-8 text-primary" />
              My Collections
            </h1>
            <p className="text-muted-foreground mt-1">
              {transformedCollections.length} collection{transformedCollections.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <CreateCollectionButton />
      </div>

      {transformedCollections.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {transformedCollections.map((collection) => (
            <Link key={collection.id} href={`/account/collections/${collection.id}`}>
              <Card className="overflow-hidden transition-all duration-300 hover:shadow-warm-lg hover:-translate-y-1 border-border/50 group h-full">
                {/* Cover Image */}
                <div className="relative aspect-video bg-muted overflow-hidden">
                  {collection.cover_image_url ? (
                    <img
                      src={collection.cover_image_url}
                      alt={collection.name}
                      className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <FolderHeart className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading font-medium truncate group-hover:text-primary transition-colors">
                        {collection.name}
                      </h3>
                      {collection.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {collection.description}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                  </div>

                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>
                      {collection.item_count} design{collection.item_count !== 1 ? "s" : ""}
                    </span>
                    <span>Updated {formatDate(collection.updated_at)}</span>
                  </div>

                  {collection.is_public && (
                    <div className="mt-2">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        Public
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <FolderHeart className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No collections yet</h2>
          <p className="text-muted-foreground mb-6">
            Create collections to organize your favorite designs into groups.
          </p>
          <CreateCollectionButton />
        </div>
      )}
    </div>
  );
}
