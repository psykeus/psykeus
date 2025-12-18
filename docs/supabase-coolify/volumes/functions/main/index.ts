// =============================================================================
// Edge Functions Main Entry Point
// =============================================================================
// This is the main router for Supabase Edge Functions.
// It handles routing to individual function handlers.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

console.log("Main function started");

serve(async (req: Request) => {
  const url = new URL(req.url);
  const { pathname } = url;

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  // Route to functions based on path
  // Add your function routes here

  return new Response(
    JSON.stringify({
      message: "Supabase Edge Functions",
      path: pathname,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
});
