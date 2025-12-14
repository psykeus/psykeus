import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Download, Calendar, FileType } from "lucide-react";

export default async function DownloadsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  // Fetch all downloads with design info
  const { data: downloads, error } = await supabase
    .from("downloads")
    .select(
      `
      id,
      downloaded_at,
      designs (
        id,
        slug,
        title,
        preview_path,
        difficulty,
        categories
      ),
      design_files (
        id,
        file_type,
        original_filename
      )
    `
    )
    .eq("user_id", user.id)
    .order("downloaded_at", { ascending: false });

  // Group downloads by date
  const groupedDownloads: Record<string, typeof downloads> = {};
  downloads?.forEach((download) => {
    const date = new Date(download.downloaded_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!groupedDownloads[date]) {
      groupedDownloads[date] = [];
    }
    groupedDownloads[date]!.push(download);
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/account"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Download History</h1>
          <p className="text-sm text-muted-foreground">
            {downloads?.length || 0} total downloads
          </p>
        </div>
      </div>

      {/* Downloads List */}
      {downloads && downloads.length > 0 ? (
        <div className="space-y-8">
          {Object.entries(groupedDownloads).map(([date, dateDownloads]) => (
            <div key={date}>
              <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {date}
              </h2>
              <div className="space-y-2">
                {dateDownloads?.map((download) => {
                  const design = download.designs as unknown as {
                    id: string;
                    slug: string;
                    title: string;
                    preview_path: string;
                    difficulty: string | null;
                    categories: string[] | null;
                  } | null;

                  const file = download.design_files as unknown as {
                    id: string;
                    file_type: string | null;
                    original_filename: string | null;
                  } | null;

                  if (!design) return null;

                  return (
                    <Link
                      key={download.id}
                      href={`/designs/${design.slug}`}
                      className="flex items-center gap-4 p-3 bg-card border rounded-lg hover:border-primary/30 transition-colors group"
                    >
                      {/* Preview */}
                      <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        <Image
                          src={design.preview_path}
                          alt={design.title}
                          fill
                          sizes="64px"
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                          {design.title}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          {file?.file_type && (
                            <span className="inline-flex items-center gap-1">
                              <FileType className="h-3 w-3" />
                              {file.file_type.toUpperCase()}
                            </span>
                          )}
                          {design.difficulty && (
                            <span className="capitalize">{design.difficulty}</span>
                          )}
                          <span>
                            {new Date(download.downloaded_at).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Download Again */}
                      <Download className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-card border rounded-xl">
          <Download className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="font-semibold mb-2">No downloads yet</h2>
          <p className="text-muted-foreground mb-4">
            Start exploring our design library to find your first download
          </p>
          <Link
            href="/designs"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            Browse Designs
          </Link>
        </div>
      )}
    </div>
  );
}
