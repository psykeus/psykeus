import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UploadTabs } from "./UploadTabs";
import { FILE_TYPE_INFO } from "@/lib/file-types";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Lightbulb, CheckCircle } from "lucide-react";

export default async function AdminUploadPage() {
  const user = await requireAdmin();
  if (!user) {
    redirect("/login?redirect=/admin/upload");
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Upload Designs</h1>
          <p className="text-muted-foreground mt-1">
            Add new designs to the library individually or in bulk
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/designs">
            View all designs
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Supported File Types */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Supported File Types</CardTitle>
          <CardDescription>We support a wide range of design formats</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {FILE_TYPE_INFO.map((type) => (
              <div
                key={type.ext}
                className="bg-muted/50 rounded-lg p-4 text-center hover:bg-muted transition-colors"
              >
                <div className="text-xl font-bold text-primary">
                  {type.name}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {type.ext}
                </div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {type.description}
                </div>
                {type.previewSupport && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Auto-preview
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upload Forms with Tabs */}
      <UploadTabs />

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Upload Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span><strong>SVG, DXF, STL, OBJ</strong> files will have previews generated automatically</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span><strong>AI metadata</strong> extracts title, description, difficulty, and style</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span><strong>Duplicate detection</strong> prevents uploading the same file twice</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Designs start as <strong>drafts</strong> - publish them from the design list</span>
            </li>
          </ul>
          <div className="mt-4 p-3 bg-muted rounded-md">
            <p className="text-xs text-muted-foreground">
              <strong>Bulk upload:</strong> Use the Python ingestion script for large batches
            </p>
            <code className="block mt-1 text-xs font-mono text-primary">
              ./scripts/ingest.sh /path/to/designs
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
