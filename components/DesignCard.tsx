import { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { capitalize } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/FavoriteButton";
import {
  PREVIEW_SIZES,
  PREVIEW_CONTAINER_CLASSES,
  IMAGE_FIT,
} from "@/lib/preview-config";
import type { DesignListItem } from "@/lib/types";
import { Crown, Shield } from "lucide-react";

interface Props {
  design: DesignListItem;
  showFavorite?: boolean;
  /** Initial favorite state - pass to avoid API call on mount */
  isFavorited?: boolean;
  /** Initial favorite count - pass to avoid API call on mount */
  favoriteCount?: number;
  /** Whether this is above the fold (for image priority) */
  priority?: boolean;
}

/**
 * Memoized DesignCard component to prevent unnecessary re-renders
 * when parent state changes (e.g., filter updates, pagination)
 */
export const DesignCard = memo(function DesignCard({ design, showFavorite = true, isFavorited, favoriteCount, priority = false }: Props) {
  return (
    <div className="group block">
      <Card className="overflow-hidden transition-all duration-300 hover:shadow-warm-lg hover:-translate-y-1 border-border/50">
        {/* Image container */}
        <Link href={`/designs/${design.slug}`}>
          <div className={`${PREVIEW_CONTAINER_CLASSES.base} aspect-square`}>
            {/* Subtle pattern background for letterboxing */}
            <div className={`absolute inset-0 ${PREVIEW_CONTAINER_CLASSES.letterbox}`} />
            <Image
              src={design.preview_path}
              alt={design.title}
              fill
              sizes={PREVIEW_SIZES.thumbnail.sizes}
              quality={PREVIEW_SIZES.thumbnail.quality}
              priority={priority}
              className={`${IMAGE_FIT.contain} transition-transform duration-500 group-hover:scale-105 p-1`}
            />
            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            {/* Access level badge */}
            {design.access_level && design.access_level !== "free" && (
              <div className="absolute top-2 left-2 z-10">
                {design.access_level === "premium" ? (
                  <Badge className="bg-blue-500/90 backdrop-blur-sm text-white gap-1 shadow-sm">
                    <Shield className="h-3 w-3" />
                    Premium
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-500/90 backdrop-blur-sm text-white gap-1 shadow-sm">
                    <Crown className="h-3 w-3" />
                    Exclusive
                  </Badge>
                )}
              </div>
            )}

            {/* Favorite button overlay */}
            {showFavorite && (
              <div className="absolute top-2 right-2 z-10">
                <FavoriteButton
                  designId={design.id}
                  initialFavorited={isFavorited}
                  initialCount={favoriteCount}
                  variant="outline"
                  className="bg-background/80 backdrop-blur-sm hover:bg-background/90 shadow-sm"
                />
              </div>
            )}
          </div>
        </Link>

        <CardContent className="p-4">
          <Link href={`/designs/${design.slug}`}>
            <h3 className="font-heading font-medium truncate group-hover:text-primary transition-colors duration-200">
              {design.title}
            </h3>
          </Link>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {design.difficulty && (
              <Badge variant="secondary" className="text-xs">
                {capitalize(design.difficulty)}
              </Badge>
            )}
            {design.style && (
              <Badge variant="outline" className="text-xs">
                {capitalize(design.style)}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
