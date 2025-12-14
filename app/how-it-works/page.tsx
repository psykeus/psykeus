import { Metadata } from "next";
import Link from "next/link";
import { StaticPageLayout, Section } from "@/components/StaticPageLayout";
import {
  Search,
  Download,
  Scissors,
  UserPlus,
  Eye,
  FileCode,
  CheckCircle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Learn how to find, download, and use CNC and laser cutting designs from the CNC Design Library.",
};

export default function HowItWorksPage() {
  return (
    <StaticPageLayout
      title="How It Works"
      subtitle="From browsing to cutting in three simple steps"
    >
      {/* Main Steps */}
      <Section>
        <div className="space-y-8 not-prose">
          {/* Step 1 */}
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
                1
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2">Browse & Find</h3>
              <p className="text-muted-foreground mb-4">
                Explore our library of designs using search, filters, and
                categories. Preview each design before downloading to make sure
                it&apos;s what you need.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-secondary rounded-full text-sm">
                  <Search className="h-4 w-4" /> Search by keyword
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-secondary rounded-full text-sm">
                  <Eye className="h-4 w-4" /> Preview designs
                </span>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
                2
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2">Create Account & Download</h3>
              <p className="text-muted-foreground mb-4">
                Create a free account to download designs. Your downloads are
                saved to your account history so you can easily find them later.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-secondary rounded-full text-sm">
                  <UserPlus className="h-4 w-4" /> Free account
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-secondary rounded-full text-sm">
                  <Download className="h-4 w-4" /> Instant downloads
                </span>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
                3
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2">Import & Cut</h3>
              <p className="text-muted-foreground mb-4">
                Open the downloaded file in your favorite CAM software, set up
                your toolpaths, and start cutting! Most designs are ready to use
                as-is.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-secondary rounded-full text-sm">
                  <FileCode className="h-4 w-4" /> Import to CAM
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-secondary rounded-full text-sm">
                  <Scissors className="h-4 w-4" /> Start cutting
                </span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* File Formats */}
      <Section title="Supported File Formats">
        <div className="space-y-4">
          <p>
            We support a variety of file formats commonly used in CNC and laser
            cutting:
          </p>
          <div className="grid sm:grid-cols-2 gap-4 not-prose">
            <div className="bg-card border rounded-lg p-4">
              <h4 className="font-semibold mb-2">2D Formats</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span><strong>SVG</strong> - Scalable Vector Graphics</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span><strong>DXF</strong> - AutoCAD Drawing Exchange</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span><strong>AI</strong> - Adobe Illustrator</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span><strong>EPS</strong> - Encapsulated PostScript</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span><strong>PDF</strong> - Portable Document Format</span>
                </li>
              </ul>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <h4 className="font-semibold mb-2">3D Formats</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span><strong>STL</strong> - Stereolithography</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span><strong>OBJ</strong> - Wavefront Object</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span><strong>GLTF/GLB</strong> - GL Transmission Format</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span><strong>3MF</strong> - 3D Manufacturing Format</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* Software Compatibility */}
      <Section title="Compatible Software">
        <p className="mb-4">
          Our design files work with most popular CNC and laser cutting software:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 not-prose">
          {[
            "Vectric VCarve",
            "Carbide Create",
            "Easel",
            "LightBurn",
            "Fusion 360",
            "Inkscape",
            "LaserGRBL",
            "Aspire",
          ].map((software) => (
            <div
              key={software}
              className="bg-card border rounded-lg p-3 text-center text-sm"
            >
              {software}
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section>
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center not-prose">
          <h3 className="text-xl font-semibold mb-2">Ready to Get Started?</h3>
          <p className="text-muted-foreground mb-4">
            Browse our collection and find your next project.
          </p>
          <Link
            href="/designs"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Search className="h-5 w-5" />
            Browse Designs
          </Link>
        </div>
      </Section>
    </StaticPageLayout>
  );
}
