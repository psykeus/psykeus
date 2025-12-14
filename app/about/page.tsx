import { Metadata } from "next";
import Link from "next/link";
import {
  StaticPageLayout,
  Section,
  FeatureCard,
} from "@/components/StaticPageLayout";
import {
  FileCode,
  Download,
  Eye,
  Layers,
  Box,
  Scissors,
  Search,
} from "lucide-react";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about CNC Design Library - a free resource for CNC and laser cutting design files.",
};

export default function AboutPage() {
  return (
    <StaticPageLayout
      title="About CNC Design Library"
      subtitle="A free resource for makers, hobbyists, and small businesses"
    >
      <Section>
        <p className="text-lg leading-relaxed">
          CNC Design Library is a personal project dedicated to providing
          high-quality design files for CNC routers, laser cutters, and other
          digital fabrication tools. Whether you&apos;re a hobbyist working on
          weekend projects or a small business creating custom products, our
          library offers a growing collection of ready-to-use designs.
        </p>
      </Section>

      <Section title="Who Is This For?">
        <div className="grid sm:grid-cols-2 gap-4 not-prose">
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Hobbyists & Makers</h3>
            <p className="text-sm text-muted-foreground">
              Weekend warriors looking for project inspiration and ready-to-cut
              designs for personal use.
            </p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Small Businesses</h3>
            <p className="text-sm text-muted-foreground">
              Craftspeople and small shops creating custom products for sale
              (check license terms per design).
            </p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Beginners</h3>
            <p className="text-sm text-muted-foreground">
              New to CNC or laser cutting? Start with our beginner-friendly
              designs to learn the basics.
            </p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Educators</h3>
            <p className="text-sm text-muted-foreground">
              Teachers and makerspaces looking for project files for classes and
              workshops.
            </p>
          </div>
        </div>
      </Section>

      <Section title="What We Offer">
        <div className="grid sm:grid-cols-3 gap-4 not-prose">
          <FeatureCard
            icon={<FileCode className="h-6 w-6 text-primary" />}
            title="Multiple Formats"
            description="SVG, DXF, STL, and more - compatible with most CNC and laser software."
          />
          <FeatureCard
            icon={<Eye className="h-6 w-6 text-primary" />}
            title="Preview First"
            description="See detailed previews before downloading. No surprises."
          />
          <FeatureCard
            icon={<Download className="h-6 w-6 text-primary" />}
            title="Easy Downloads"
            description="Create a free account and start downloading immediately."
          />
        </div>
      </Section>

      <Section title="Supported File Formats">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 not-prose">
          <div className="bg-card border rounded-lg p-3 text-center">
            <Layers className="h-6 w-6 mx-auto mb-2 text-primary" />
            <span className="font-mono text-sm font-medium">SVG</span>
            <p className="text-xs text-muted-foreground mt-1">2D Vector</p>
          </div>
          <div className="bg-card border rounded-lg p-3 text-center">
            <Scissors className="h-6 w-6 mx-auto mb-2 text-primary" />
            <span className="font-mono text-sm font-medium">DXF</span>
            <p className="text-xs text-muted-foreground mt-1">CAD Format</p>
          </div>
          <div className="bg-card border rounded-lg p-3 text-center">
            <Box className="h-6 w-6 mx-auto mb-2 text-primary" />
            <span className="font-mono text-sm font-medium">STL</span>
            <p className="text-xs text-muted-foreground mt-1">3D Model</p>
          </div>
          <div className="bg-card border rounded-lg p-3 text-center">
            <FileCode className="h-6 w-6 mx-auto mb-2 text-primary" />
            <span className="font-mono text-sm font-medium">More</span>
            <p className="text-xs text-muted-foreground mt-1">AI, EPS, PDF</p>
          </div>
        </div>
      </Section>

      <Section title="A Note on Licenses">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 not-prose">
          <p className="text-sm">
            Our library contains designs from various sources, and not all
            licenses have been verified. Each design displays its license status
            - please check before using, especially for commercial purposes.
            Learn more on our{" "}
            <Link href="/license" className="text-primary hover:underline">
              License & Usage
            </Link>{" "}
            page.
          </p>
        </div>
      </Section>

      <Section>
        <div className="flex flex-col sm:flex-row gap-4 not-prose">
          <Link
            href="/designs"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Search className="h-5 w-5" />
            Browse Designs
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border rounded-lg hover:bg-muted transition-colors font-medium"
          >
            Learn How It Works
          </Link>
        </div>
      </Section>
    </StaticPageLayout>
  );
}
