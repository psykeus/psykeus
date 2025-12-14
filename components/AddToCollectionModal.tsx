"use client";

import { useState, useEffect } from "react";
import { FolderPlus, Plus, Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Collection {
  id: string;
  name: string;
  item_count: number;
}

interface AddToCollectionModalProps {
  designId: string;
  trigger?: React.ReactNode;
  onAdded?: (collectionId: string, collectionName: string) => void;
}

export function AddToCollectionModal({
  designId,
  trigger,
  onAdded,
}: AddToCollectionModalProps) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Fetch collections when modal opens
  useEffect(() => {
    if (open) {
      fetchCollections();
    }
  }, [open]);

  async function fetchCollections() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/collections");
      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (response.status === 403) {
        setError("Collections feature is disabled");
        return;
      }
      if (!response.ok) throw new Error("Failed to load collections");
      const data = await response.json();
      setCollections(data.collections || []);
    } catch (err) {
      setError("Failed to load collections");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function addToCollection(collectionId: string) {
    setAdding(collectionId);
    setError(null);
    try {
      const response = await fetch(`/api/collections/${collectionId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design_id: designId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add to collection");
      }

      setAddedTo((prev) => new Set([...prev, collectionId]));
      const collection = collections.find((c) => c.id === collectionId);
      if (collection) {
        onAdded?.(collectionId, collection.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(null);
    }
  }

  async function createCollection() {
    if (!newName.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create collection");
      }

      const data = await response.json();
      setCollections((prev) => [
        { ...data.collection, item_count: 0 },
        ...prev,
      ]);
      setNewName("");
      setShowCreate(false);

      // Automatically add the design to the new collection
      await addToCollection(data.collection.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <FolderPlus className="h-4 w-4 mr-2" />
            Add to Collection
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Collection</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Create new collection */}
              {showCreate ? (
                <div className="space-y-2">
                  <Label htmlFor="new-collection">New Collection Name</Label>
                  <div className="flex gap-2">
                    <Input
                      id="new-collection"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="My Collection"
                      disabled={creating}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          createCollection();
                        }
                      }}
                    />
                    <Button
                      onClick={createCollection}
                      disabled={!newName.trim() || creating}
                    >
                      {creating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Create"
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowCreate(false);
                      setNewName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Collection
                </Button>
              )}

              {/* Existing collections */}
              {collections.length > 0 && (
                <div className="space-y-2">
                  <Label>Your Collections</Label>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {collections.map((collection) => {
                      const isAdded = addedTo.has(collection.id);
                      const isAdding = adding === collection.id;

                      return (
                        <button
                          key={collection.id}
                          onClick={() => !isAdded && addToCollection(collection.id)}
                          disabled={isAdded || isAdding}
                          className={cn(
                            "w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors",
                            isAdded
                              ? "bg-green-500/10 text-green-600"
                              : "hover:bg-secondary"
                          )}
                        >
                          <div>
                            <p className="font-medium">{collection.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {collection.item_count} item
                              {collection.item_count !== 1 ? "s" : ""}
                            </p>
                          </div>
                          {isAdding ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isAdded ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {collections.length === 0 && !showCreate && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  You don't have any collections yet. Create one to start organizing your designs!
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
