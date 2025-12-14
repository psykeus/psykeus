import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ListChecks, Lightbulb, CheckCircle } from "lucide-react";
import { ImportWizard } from "./ImportWizard";

export default async function AdminImportPage() {
  const user = await requireAdmin();
  if (!user) {
    redirect("/login?redirect=/admin/import");
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Bulk Import</h1>
          <p className="text-muted-foreground mt-1">
            Import thousands of design files from a local folder
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/import/jobs">
            <ListChecks className="mr-2 h-4 w-4" />
            View Job Queue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Import Wizard */}
      <ImportWizard />

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Bulk Import Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span><strong>Project detection</strong> automatically groups related files (e.g., base.svg + cover.svg)</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span><strong>Duplicate detection</strong> uses content hashing to skip already-imported files</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span><strong>Background processing</strong> lets you continue working while files import</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span><strong>Pause/Resume</strong> support for long-running imports (crash recovery included)</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span><strong>AI metadata</strong> is optional and can be enabled for select projects</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
