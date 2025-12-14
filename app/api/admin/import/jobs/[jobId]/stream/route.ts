import { NextRequest } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import { subscribeToJob } from "@/lib/import/job-processor";
import * as jobService from "@/lib/services/import-job-service";
import type { ImportEvent } from "@/lib/types/import";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/admin/import/jobs/[jobId]/stream
 * Server-Sent Events stream for real-time progress updates
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return new Response("Unauthorized", { status: 403 });
  }

  const { jobId } = await params;

  // Check job exists
  const job = await jobService.getImportJob(jobId);
  if (!job) {
    return new Response("Job not found", { status: 404 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const initialEvent = {
        type: "connected",
        job_id: jobId,
        timestamp: new Date().toISOString(),
        data: { status: job.status },
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialEvent)}\n\n`));

      // Subscribe to job events
      const unsubscribe = subscribeToJob(jobId, (event: ImportEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

          // Close stream when job completes
          if (
            ["job:completed", "job:failed", "job:cancelled"].includes(event.type)
          ) {
            setTimeout(() => {
              try {
                controller.close();
              } catch {
                // Already closed
              }
            }, 1000);
          }
        } catch (err) {
          console.error("SSE write error:", err);
        }
      });

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = {
            type: "heartbeat",
            job_id: jobId,
            timestamp: new Date().toISOString(),
            data: {},
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(heartbeat)}\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Clean up on close
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
