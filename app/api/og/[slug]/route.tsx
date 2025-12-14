/**
 * Dynamic OG Image Generation
 *
 * Generates social card images for designs using @vercel/og (Satori)
 * Creates visually appealing preview cards for social media sharing.
 */

import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Image dimensions for OG cards
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { slug } = await params;

  try {
    // Dynamically import feature flags to avoid edge runtime issues
    const { isSocialCardsEnabled } = await import("@/lib/feature-flags");
    const enabled = await isSocialCardsEnabled();
    if (!enabled) {
      return new Response("Social cards feature is disabled", { status: 404 });
    }
    const supabase = createServiceClient();

    // Fetch design data
    const { data: design, error } = await supabase
      .from("designs")
      .select("title, description, preview_path, categories, project_type, difficulty")
      .eq("slug", slug)
      .eq("is_public", true)
      .single();

    if (error || !design) {
      return new Response("Design not found", { status: 404 });
    }

    // Generate OG image using Satori
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            backgroundColor: "#0f172a",
            padding: 48,
          }}
        >
          {/* Top section with logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 48,
                height: 48,
                backgroundColor: "#3b82f6",
                borderRadius: 8,
                marginRight: 12,
              }}
            >
              <span style={{ color: "white", fontSize: 24, fontWeight: 700 }}>
                CNC
              </span>
            </div>
            <span style={{ color: "#94a3b8", fontSize: 20 }}>
              CNC Design Library
            </span>
          </div>

          {/* Main content */}
          <div
            style={{
              display: "flex",
              flex: 1,
              gap: 32,
            }}
          >
            {/* Preview image */}
            {design.preview_path && (
              <div
                style={{
                  display: "flex",
                  width: 420,
                  height: 420,
                  backgroundColor: "#1e293b",
                  borderRadius: 16,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={design.preview_path}
                  alt=""
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                  }}
                />
              </div>
            )}

            {/* Text content */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                justifyContent: "center",
              }}
            >
              <h1
                style={{
                  color: "white",
                  fontSize: 48,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  marginBottom: 16,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {design.title}
              </h1>

              {design.description && (
                <p
                  style={{
                    color: "#94a3b8",
                    fontSize: 24,
                    lineHeight: 1.5,
                    marginBottom: 24,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {design.description}
                </p>
              )}

              {/* Badges */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {design.project_type && (
                  <div
                    style={{
                      display: "flex",
                      backgroundColor: "#3b82f6",
                      color: "white",
                      padding: "8px 16px",
                      borderRadius: 20,
                      fontSize: 18,
                    }}
                  >
                    {design.project_type}
                  </div>
                )}
                {design.difficulty && (
                  <div
                    style={{
                      display: "flex",
                      backgroundColor: getDifficultyColor(design.difficulty),
                      color: "white",
                      padding: "8px 16px",
                      borderRadius: 20,
                      fontSize: 18,
                    }}
                  >
                    {design.difficulty}
                  </div>
                )}
                {design.categories?.slice(0, 2).map((cat: string, i: number) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      backgroundColor: "#334155",
                      color: "#e2e8f0",
                      padding: "8px 16px",
                      borderRadius: 20,
                      fontSize: 18,
                    }}
                  >
                    {cat}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 24,
              paddingTop: 24,
              borderTop: "1px solid #334155",
            }}
          >
            <span style={{ color: "#64748b", fontSize: 18 }}>
              Free download at cnc-library.com
            </span>
            <div
              style={{
                display: "flex",
                backgroundColor: "#22c55e",
                color: "white",
                padding: "12px 24px",
                borderRadius: 8,
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              Download Now
            </div>
          </div>
        </div>
      ),
      {
        width: OG_WIDTH,
        height: OG_HEIGHT,
      }
    );
  } catch (error) {
    console.error("[OG Image] Error generating image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}

function getDifficultyColor(difficulty: string): string {
  switch (difficulty?.toLowerCase()) {
    case "beginner":
      return "#22c55e";
    case "intermediate":
      return "#f59e0b";
    case "advanced":
      return "#ef4444";
    default:
      return "#64748b";
  }
}
