"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { capitalize } from "@/lib/utils";
import {
  PREVIEW_SIZES,
  PREVIEW_CONTAINER_CLASSES,
  IMAGE_FIT,
} from "@/lib/preview-config";

interface RelatedDesign {
  id: string;
  slug: string;
  title: string;
  preview_path: string | null;
  category: string | null;
  difficulty: string | null;
  style: string | null;
  similarity: number;
}

interface RelatedDesignsProps {
  designSlug: string;
  className?: string;
}

export function RelatedDesigns({ designSlug, className }: RelatedDesignsProps) {
  const [designs, setDesigns] = useState<RelatedDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRelated() {
      try {
        const response = await fetch(`/api/designs/${designSlug}/related`);

        if (response.status === 403) {
          // Feature disabled - don't show anything
          setLoading(false);
          return;
        }

        if (response.status === 404) {
          // Design not found - treat as no related designs
          setLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load related designs");
        }

        const data = await response.json();
        setDesigns(data.related || []);
      } catch (err) {
        console.error("Error fetching related designs:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }

    fetchRelated();
  }, [designSlug]);

  // Don't render if feature is disabled or no related designs
  if (!loading && designs.length === 0) {
    return null;
  }

  if (error) {
    return null; // Silently fail
  }

  return (
    <div className={className}>
      <h2 className="text-xl font-semibold mb-4">Similar Designs</h2>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-square" />
              <CardContent className="p-3">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {designs.map((design) => (
            <Link
              key={design.id}
              href={`/designs/${design.slug}`}
              className="group block"
            >
              <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border-border/50">
                <div className={`${PREVIEW_CONTAINER_CLASSES.base} aspect-square`}>
                  {/* Letterbox background */}
                  <div className={`absolute inset-0 ${PREVIEW_CONTAINER_CLASSES.letterbox}`} />
                  {design.preview_path ? (
                    <Image
                      src={design.preview_path}
                      alt={design.title}
                      fill
                      sizes={PREVIEW_SIZES.thumbnail.sizes}
                      quality={PREVIEW_SIZES.thumbnail.quality}
                      loading="lazy"
                      className={`${IMAGE_FIT.contain} transition-transform duration-500 group-hover:scale-105 p-1`}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      No preview
                    </div>
                  )}
                  {/* Similarity badge */}
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-xs">
                      {design.similarity}% match
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-3">
                  <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                    {design.title}
                  </h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {design.difficulty && (
                      <Badge variant="outline" className="text-xs py-0">
                        {capitalize(design.difficulty)}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
