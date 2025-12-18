// =============================================================================
// Hello World Edge Function
// =============================================================================
// Example edge function - call via: /functions/v1/hello
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

console.log("Hello function started");

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  // Parse request body if present
  let name = "World";
  if (req.method === "POST") {
    try {
      const body = await req.json();
      name = body.name || name;
    } catch {
      // Ignore JSON parse errors
    }
  }

  // Return greeting
  return new Response(
    JSON.stringify({
      message: `Hello, ${name}!`,
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
