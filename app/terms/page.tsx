import { Metadata } from "next";
import Link from "next/link";
import { StaticPageLayout, Section } from "@/components/StaticPageLayout";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for CNC Design Library.",
};

export default function TermsPage() {
  return (
    <StaticPageLayout
      title="Terms of Service"
      subtitle="Please read these terms carefully before using our service"
      lastUpdated="December 2024"
    >
      <Section title="1. Acceptance of Terms">
        <p>
          By accessing and using CNC Design Library (&quot;the Service&quot;),
          you accept and agree to be bound by these Terms of Service. If you do
          not agree to these terms, please do not use the Service.
        </p>
      </Section>

      <Section title="2. Description of Service">
        <p>
          CNC Design Library is a personal project that provides downloadable
          design files for CNC routers, laser cutters, and similar digital
          fabrication tools. The Service allows users to browse, preview, and
          download design files after creating an account.
        </p>
      </Section>

      <Section title="3. User Accounts">
        <ul>
          <li>You must create an account to download designs</li>
          <li>You are responsible for maintaining the security of your account</li>
          <li>You must provide accurate information when creating an account</li>
          <li>One account per person - account sharing is not permitted</li>
          <li>You must be at least 13 years old to use this Service</li>
        </ul>
      </Section>

      <Section title="4. Design Files & Licenses">
        <p className="mb-4">
          Design files available on this Service come from various sources and
          may have different licensing terms:
        </p>
        <ul>
          <li>
            Each design displays its license status (e.g., Public Domain, CC BY,
            Unknown)
          </li>
          <li>
            <strong>&quot;Unknown&quot; license</strong> means the copyright
            status has not been verified - use at your own risk
          </li>
          <li>
            You are responsible for verifying the license before using a design,
            especially for commercial purposes
          </li>
          <li>
            We do not guarantee the accuracy of license information displayed
          </li>
        </ul>
        <p className="mt-4">
          For more details, see our{" "}
          <Link href="/license" className="text-primary hover:underline">
            License & Usage
          </Link>{" "}
          page.
        </p>
      </Section>

      <Section title="5. Prohibited Uses">
        <p>You agree not to:</p>
        <ul>
          <li>
            Redistribute, resell, or share downloaded design files as digital
            files
          </li>
          <li>
            Use automated tools to mass-download or scrape design files
          </li>
          <li>Circumvent any access restrictions or download limits</li>
          <li>Upload malicious content or attempt to harm the Service</li>
          <li>Create multiple accounts to bypass restrictions</li>
          <li>Misrepresent your identity or affiliation</li>
        </ul>
      </Section>

      <Section title="6. Intellectual Property">
        <ul>
          <li>
            Downloaded design files may be subject to copyright protection
          </li>
          <li>
            Physical products you create from designs are yours to sell (subject
            to the design&apos;s license)
          </li>
          <li>
            You may not claim ownership of the original design files
          </li>
          <li>
            The Service&apos;s website design, code, and branding remain our
            property
          </li>
        </ul>
      </Section>

      <Section title="7. DMCA / Copyright Claims">
        <p>
          We respect intellectual property rights. If you believe a design
          infringes your copyright:
        </p>
        <ul>
          <li>
            Contact us with details of the claimed infringement
          </li>
          <li>Identify the specific design(s) in question</li>
          <li>Provide proof of your ownership or authorization</li>
          <li>
            We will review and remove infringing content in a timely manner
          </li>
        </ul>
        <p className="mt-4">
          Contact:{" "}
          <Link href="/contact" className="text-primary hover:underline">
            Contact Page
          </Link>
        </p>
      </Section>

      <Section title="8. Disclaimers">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 not-prose text-sm">
          <p className="font-semibold mb-2">THE SERVICE IS PROVIDED &quot;AS IS&quot;</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>
              We make no warranties about the accuracy, quality, or fitness of
              designs for any purpose
            </li>
            <li>
              Designs are not guaranteed to be safe, structurally sound, or
              suitable for any specific application
            </li>
            <li>
              You are responsible for testing designs before use, especially for
              safety-critical applications
            </li>
            <li>
              We do not guarantee uninterrupted access to the Service
            </li>
          </ul>
        </div>
      </Section>

      <Section title="9. Limitation of Liability">
        <p>
          To the maximum extent permitted by law, we shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages
          resulting from your use of the Service, including but not limited to:
        </p>
        <ul>
          <li>Injuries or property damage from using designs</li>
          <li>Business losses from designs that don&apos;t work as expected</li>
          <li>Copyright claims from third parties</li>
          <li>Loss of data or service interruptions</li>
        </ul>
      </Section>

      <Section title="10. Account Termination">
        <p>
          We reserve the right to suspend or terminate accounts that violate
          these terms, abuse the Service, or for any other reason at our
          discretion. You may delete your account at any time.
        </p>
      </Section>

      <Section title="11. Changes to Terms">
        <p>
          We may update these Terms of Service from time to time. Continued use
          of the Service after changes constitutes acceptance of the new terms.
          We recommend checking this page periodically.
        </p>
      </Section>

      <Section title="12. Governing Law">
        <p>
          These terms shall be governed by and construed in accordance with
          applicable laws. Any disputes shall be resolved through good-faith
          negotiation.
        </p>
      </Section>

      <Section title="13. Contact">
        <p>
          If you have questions about these Terms of Service, please{" "}
          <Link href="/contact" className="text-primary hover:underline">
            contact us
          </Link>
          .
        </p>
      </Section>
    </StaticPageLayout>
  );
}
