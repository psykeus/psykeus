import { requireAdmin } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import * as jobService from "@/lib/services/import-job-service";
import { JobDetailsClient } from "./JobDetailsClient";

interface Props {
  params: Promise<{ jobId: string }>;
}

export default async function ImportJobDetailsPage({ params }: Props) {
  const user = await requireAdmin();
  if (!user) {
    redirect("/login?redirect=/admin/import/jobs");
  }

  const { jobId } = await params;
  const job = await jobService.getImportJob(jobId);

  if (!job) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/import/jobs">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Link>
        </Button>
        <div>
          <h1 className="font-heading text-2xl font-bold">Import Job Details</h1>
          <p className="text-muted-foreground text-sm truncate max-w-xl">{job.source_path}</p>
        </div>
      </div>

      <JobDetailsClient initialJob={job} />
    </div>
  );
}
