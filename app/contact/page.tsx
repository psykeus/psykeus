import { Metadata } from "next";
import Link from "next/link";
import { StaticPageLayout, Section } from "@/components/StaticPageLayout";
import { Mail, MessageSquare, Clock, FileWarning } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with CNC Design Library for support or inquiries.",
};

// TODO: Replace with your actual email address
const CONTACT_EMAIL = "support@brandgears.com";

export default function ContactPage() {
  return (
    <StaticPageLayout
      title="Contact Us"
      subtitle="We're here to help with questions, feedback, or issues"
    >
      <Section>
        <div className="grid sm:grid-cols-2 gap-6 not-prose">
          {/* Email Contact */}
          <div className="bg-card border rounded-xl p-6">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-semibold text-lg mb-2">Email Us</h2>
            <p className="text-sm text-muted-foreground mb-4">
              For general inquiries, feedback, or support requests.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              {CONTACT_EMAIL}
            </a>
          </div>

          {/* Response Time */}
          <div className="bg-card border rounded-xl p-6">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-semibold text-lg mb-2">Response Time</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This is a personal project, so responses may take a few days.
              We&apos;ll get back to you as soon as possible.
            </p>
            <p className="text-sm text-muted-foreground">
              Typical response: <strong>1-3 business days</strong>
            </p>
          </div>
        </div>
      </Section>

      <Section title="Before You Contact Us">
        <div className="space-y-4 not-prose">
          <div className="flex items-start gap-3 bg-card border rounded-lg p-4">
            <MessageSquare className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium mb-1">Check the FAQ</h3>
              <p className="text-sm text-muted-foreground">
                Many common questions are answered in our{" "}
                <Link href="/faq" className="text-primary hover:underline">
                  FAQ section
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-card border rounded-lg p-4">
            <FileWarning className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium mb-1">Reporting Issues</h3>
              <p className="text-sm text-muted-foreground">
                When reporting a bug or issue, please include:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 list-disc list-inside">
                <li>What you were trying to do</li>
                <li>What happened instead</li>
                <li>The URL of the page (if applicable)</li>
                <li>Your browser and device</li>
                <li>Screenshots if possible</li>
              </ul>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Common Topics">
        <div className="grid sm:grid-cols-2 gap-4 not-prose">
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-medium mb-2">Account Issues</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Password reset problems</li>
              <li>Account deletion requests</li>
              <li>Download limit questions</li>
            </ul>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-medium mb-2">Design Files</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Files not downloading</li>
              <li>Corrupted or broken files</li>
              <li>Missing file formats</li>
            </ul>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-medium mb-2">Licensing</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Commercial use questions</li>
              <li>License verification requests</li>
              <li>Attribution guidance</li>
            </ul>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-medium mb-2">Copyright Claims</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>DMCA takedown requests</li>
              <li>Copyright infringement reports</li>
              <li>Ownership disputes</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Copyright / DMCA Claims">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 not-prose">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            If you believe a design infringes your copyright, please email us
            with:
          </p>
          <ul className="text-sm text-amber-700 dark:text-amber-400 mt-2 list-disc list-inside">
            <li>The specific design URL(s)</li>
            <li>Proof of your ownership</li>
            <li>Your contact information</li>
            <li>A statement of good faith belief</li>
          </ul>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-2">
            We take copyright seriously and will respond promptly to valid
            claims.
          </p>
        </div>
      </Section>
    </StaticPageLayout>
  );
}
