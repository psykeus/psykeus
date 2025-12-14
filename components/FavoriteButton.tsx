"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  designId: string;
  initialFavorited?: boolean;
  initialCount?: number;
  showCount?: boolean;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost";
  className?: string;
  onToggle?: (isFavorited: boolean, count: number) => void;
}

export function FavoriteButton({
  designId,
  initialFavorited = false,
  initialCount = 0,
  showCount = false,
  size = "icon",
  variant = "ghost",
  className,
  onToggle,
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [count, setCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Sync state when initial values change (e.g., from parent's batch fetch)
  useEffect(() => {
    setIsFavorited(initialFavorited);
    setCount(initialCount);
  }, [initialFavorited, initialCount]);

  // Only fetch if parent didn't provide initial values
  // This eliminates redundant API calls when parent already has the data
  useEffect(() => {
    // Skip if parent provided meaningful initial values
    if (initialFavorited || initialCount > 0) {
      setIsAuthenticated(true);
      return;
    }

    async function checkStatus() {
      try {
        const response = await fetch(`/api/favorites/${designId}`);
        if (response.ok) {
          const data = await response.json();
          setIsFavorited(data.isFavorited);
          setCount(data.favoriteCount);
          setIsAuthenticated(true);
        } else if (response.status === 403) {
          // Feature disabled
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error("Error checking favorite status:", error);
      }
    }

    checkStatus();
  }, [designId, initialFavorited, initialCount]);

  async function toggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) return;

    // Optimistic update - update UI immediately
    const previousFavorited = isFavorited;
    const previousCount = count;
    const newFavorited = !isFavorited;
    const newCount = newFavorited ? count + 1 : Math.max(0, count - 1);

    setIsFavorited(newFavorited);
    setCount(newCount);
    setIsLoading(true);

    try {
      const method = previousFavorited ? "DELETE" : "POST";
      const response = await fetch(`/api/favorites/${designId}`, { method });

      if (response.status === 401) {
        // Revert and redirect to login
        setIsFavorited(previousFavorited);
        setCount(previousCount);
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      if (!response.ok) {
        // Revert on error
        setIsFavorited(previousFavorited);
        setCount(previousCount);
        const data = await response.json();
        throw new Error(data.error || "Failed to update favorite");
      }

      const data = await response.json();
      // Update with server's actual count
      if (data.favoriteCount !== undefined) {
        setCount(data.favoriteCount);
      }
      onToggle?.(newFavorited, data.favoriteCount ?? newCount);
    } catch (error) {
      console.error("Error toggling favorite:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // Don't render if feature is disabled
  if (isAuthenticated === false) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        "group/fav transition-all",
        isFavorited
          ? "text-red-500 hover:text-red-600 border-red-200 bg-red-50/80 hover:bg-red-100/80"
          : "text-muted-foreground hover:text-red-500",
        className
      )}
      onClick={toggleFavorite}
      disabled={isLoading}
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
      title={isFavorited ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart
        className={cn(
          "h-4 w-4 transition-all",
          isFavorited ? "fill-red-500" : "fill-none group-hover/fav:fill-red-200",
          isLoading && "animate-pulse"
        )}
      />
      {showCount && count > 0 && (
        <span className="ml-1 text-xs">{count}</span>
      )}
    </Button>
  );
}

/**
 * Lightweight favorite indicator for use in lists
 * Only shows if the design is favorited
 * Pass isFavorited prop to avoid API calls when parent has data
 */
export function FavoriteIndicator({
  designId,
  isFavorited: initialFavorited,
  className,
}: {
  designId: string;
  isFavorited?: boolean;
  className?: string;
}) {
  const [isFavorited, setIsFavorited] = useState(initialFavorited ?? false);

  useEffect(() => {
    // Skip fetch if parent provided the value
    if (initialFavorited !== undefined) {
      setIsFavorited(initialFavorited);
      return;
    }

    async function checkStatus() {
      try {
        const response = await fetch(`/api/favorites/${designId}`);
        if (response.ok) {
          const data = await response.json();
          setIsFavorited(data.isFavorited);
        }
      } catch {
        // Silently fail
      }
    }
    checkStatus();
  }, [designId, initialFavorited]);

  if (!isFavorited) return null;

  return (
    <Heart
      className={cn("h-4 w-4 fill-red-500 text-red-500", className)}
      aria-label="Favorited"
    />
  );
}
