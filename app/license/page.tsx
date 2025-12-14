import { Metadata } from "next";
import Link from "next/link";
import { StaticPageLayout, Section } from "@/components/StaticPageLayout";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Scale,
} from "lucide-react";

export const metadata: Metadata = {
  title: "License & Usage",
  description:
    "Understanding design licenses and usage rights on CNC Design Library.",
};

export default function LicensePage() {
  return (
    <StaticPageLayout
      title="License & Usage Rights"
      subtitle="Understanding what you can and can't do with downloaded designs"
      lastUpdated="December 2024"
    >
      <Section>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 not-prose">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
                Important Notice
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Our library contains designs from various sources. Not all
                licenses have been verified. Each design displays its license
                status - please check before using, especially for commercial
                purposes.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="License Types">
        <p className="mb-4">
          Each design displays a license badge indicating its usage rights:
        </p>

        <div className="space-y-4 not-prose">
          {/* Unknown */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <HelpCircle className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <h3 className="font-semibold">Unknown / Verify Before Use</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  License status has not been verified. Use at your own risk.
                  Not recommended for commercial use without independent
                  verification.
                </p>
              </div>
            </div>
          </div>

          {/* Public Domain */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">Public Domain</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  No copyright restrictions. Free to use for any purpose,
                  including commercial. No attribution required.
                </p>
              </div>
            </div>
          </div>

          {/* CC0 */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <Scale className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">CC0 (Creative Commons Zero)</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Creator has waived all rights. Use freely for any purpose. No
                  attribution required.
                </p>
              </div>
            </div>
          </div>

          {/* CC BY */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Scale className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">CC BY (Attribution)</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Free to use, modify, and commercialize. You must give credit
                  to the original creator.
                </p>
              </div>
            </div>
          </div>

          {/* CC BY-NC */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-semibold">CC BY-NC (Non-Commercial)</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Free for personal use only. Commercial use is{" "}
                  <strong>not</strong> permitted. Attribution required.
                </p>
              </div>
            </div>
          </div>

          {/* Personal Only */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold">Personal Use Only</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  For personal, non-commercial use only. You may not sell
                  products made from this design.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="What You Can Do">
        <div className="grid sm:grid-cols-2 gap-4 not-prose">
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Generally Allowed
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Download for personal use</li>
              <li>Modify and adapt designs for your needs</li>
              <li>Create physical products from designs</li>
              <li>Sell physical products (check license)</li>
              <li>Use in educational settings</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Not Allowed
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Redistribute or resell the digital files</li>
              <li>Share downloads with others</li>
              <li>Upload to other design repositories</li>
              <li>Claim ownership of original designs</li>
              <li>Remove attribution when required</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Commercial Use">
        <p>
          If you want to sell products made from our designs, please note:
        </p>
        <ul>
          <li>
            <strong>Check the license</strong> on each specific design you plan
            to use
          </li>
          <li>
            <strong>&quot;Unknown&quot; license</strong> designs are not
            recommended for commercial use
          </li>
          <li>
            <strong>CC BY-NC and Personal Only</strong> designs cannot be used
            commercially
          </li>
          <li>
            <strong>Public Domain, CC0, and CC BY</strong> designs may be used
            commercially
          </li>
          <li>
            When in doubt, do not use for commercial purposes
          </li>
        </ul>
      </Section>

      <Section title="Attribution">
        <p>
          Some licenses require attribution (giving credit to the creator). When
          attribution is required:
        </p>
        <ul>
          <li>Include credit on your product listing or packaging</li>
          <li>
            Example: &quot;Design by [Creator Name] via CNC Design Library&quot;
          </li>
          <li>Check the design&apos;s license notes for specific requirements</li>
        </ul>
      </Section>

      <Section title="Disclaimer">
        <div className="bg-muted rounded-lg p-4 not-prose text-sm">
          <p className="mb-2">
            <strong>Designs are provided &quot;as-is&quot;</strong> without
            warranty of any kind.
          </p>
          <ul className="space-y-1 text-muted-foreground">
            <li>
              We do not guarantee that license information is accurate or
              complete
            </li>
            <li>
              You are responsible for verifying rights before commercial use
            </li>
            <li>
              Designs are not guaranteed to be safe, structurally sound, or
              suitable for any specific purpose
            </li>
            <li>
              Test all designs before use in safety-critical applications
            </li>
          </ul>
        </div>
      </Section>

      <Section title="Copyright Claims">
        <p>
          If you believe a design infringes your copyright, please{" "}
          <Link href="/contact" className="text-primary hover:underline">
            contact us
          </Link>{" "}
          with:
        </p>
        <ul>
          <li>The specific design URL</li>
          <li>Proof of your ownership or authorization</li>
          <li>Your contact information</li>
        </ul>
        <p className="mt-4">
          We take copyright claims seriously and will review and respond
          promptly.
        </p>
      </Section>

      <Section title="Questions?">
        <p>
          If you have questions about licensing or usage rights,{" "}
          <Link href="/contact" className="text-primary hover:underline">
            contact us
          </Link>{" "}
          or check our{" "}
          <Link href="/faq" className="text-primary hover:underline">
            FAQ
          </Link>
          .
        </p>
      </Section>
    </StaticPageLayout>
  );
}
