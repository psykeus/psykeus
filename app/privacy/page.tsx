import { Metadata } from "next";
import Link from "next/link";
import { StaticPageLayout, Section } from "@/components/StaticPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for CNC Design Library - how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <StaticPageLayout
      title="Privacy Policy"
      subtitle="How we collect, use, and protect your information"
      lastUpdated="December 2024"
    >
      <Section title="Introduction">
        <p>
          CNC Design Library (&quot;we&quot;, &quot;our&quot;, or &quot;the
          Service&quot;) is a personal project committed to protecting your
          privacy. This policy explains what data we collect, why we collect it,
          and how we use it.
        </p>
      </Section>

      <Section title="Information We Collect">
        <h3 className="text-lg font-semibold mt-4 mb-2">Account Information</h3>
        <p>When you create an account, we collect:</p>
        <ul>
          <li>Email address (required for login)</li>
          <li>Display name (optional)</li>
          <li>Profile photo (optional)</li>
          <li>Bio and website (optional)</li>
        </ul>

        <h3 className="text-lg font-semibold mt-4 mb-2">Usage Data</h3>
        <p>We automatically collect:</p>
        <ul>
          <li>Download history (which designs you downloaded)</li>
          <li>Favorites and collections you create</li>
          <li>Login timestamps and approximate session information</li>
          <li>Basic browser and device information for security</li>
        </ul>

        <h3 className="text-lg font-semibold mt-4 mb-2">
          What We Don&apos;t Collect
        </h3>
        <ul>
          <li>Payment information (we don&apos;t process payments)</li>
          <li>Precise location data</li>
          <li>Data from third-party social accounts</li>
        </ul>
      </Section>

      <Section title="How We Use Your Data">
        <p>We use collected information to:</p>
        <ul>
          <li>Provide and improve the Service</li>
          <li>Enable account features (favorites, collections, downloads)</li>
          <li>Send important service-related notifications</li>
          <li>Monitor for abuse and maintain security</li>
          <li>Understand how the Service is used to improve it</li>
        </ul>
        <p className="mt-4">
          We do <strong>not</strong> sell your personal data to third parties.
        </p>
      </Section>

      <Section title="Data Storage & Security">
        <ul>
          <li>
            Data is stored using{" "}
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Supabase
            </a>
            , a secure database platform
          </li>
          <li>Passwords are hashed and never stored in plain text</li>
          <li>We use HTTPS for all data transmission</li>
          <li>Access to user data is restricted to authorized personnel only</li>
        </ul>
      </Section>

      <Section title="Cookies & Local Storage">
        <p>We use cookies and local storage for:</p>
        <ul>
          <li>
            <strong>Authentication:</strong> Keeping you logged in securely
          </li>
          <li>
            <strong>Preferences:</strong> Remembering your theme (dark/light
            mode)
          </li>
          <li>
            <strong>Session management:</strong> Maintaining your browsing
            session
          </li>
        </ul>
        <p className="mt-4">
          We do not use third-party tracking cookies or advertising cookies.
        </p>
      </Section>

      <Section title="Third-Party Services">
        <p>We use the following third-party services:</p>
        <ul>
          <li>
            <strong>Supabase:</strong> Database and authentication (
            <a
              href="https://supabase.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Privacy Policy
            </a>
            )
          </li>
        </ul>
        <p className="mt-4">
          These services have their own privacy policies governing their use of
          your data.
        </p>
      </Section>

      <Section title="Your Rights">
        <p>You have the right to:</p>
        <ul>
          <li>
            <strong>Access:</strong> View the personal data we have about you
          </li>
          <li>
            <strong>Correction:</strong> Update inaccurate information in your
            profile
          </li>
          <li>
            <strong>Deletion:</strong> Request deletion of your account and
            associated data
          </li>
          <li>
            <strong>Export:</strong> Request a copy of your data
          </li>
        </ul>
        <p className="mt-4">
          To exercise these rights,{" "}
          <Link href="/contact" className="text-primary hover:underline">
            contact us
          </Link>
          .
        </p>
      </Section>

      <Section title="Data Retention">
        <ul>
          <li>Account data is retained while your account is active</li>
          <li>
            Download history is retained for your convenience and to enforce
            limits
          </li>
          <li>
            If you delete your account, your personal data will be removed
            within 30 days
          </li>
          <li>
            Some anonymized usage data may be retained for analytics purposes
          </li>
        </ul>
      </Section>

      <Section title="Children's Privacy">
        <p>
          The Service is not intended for children under 13 years of age. We do
          not knowingly collect personal information from children under 13. If
          you believe we have collected such information, please contact us
          immediately.
        </p>
      </Section>

      <Section title="Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. We will notify
          users of significant changes by posting a notice on the Service. Your
          continued use after changes constitutes acceptance of the updated
          policy.
        </p>
      </Section>

      <Section title="Contact Us">
        <p>
          If you have questions about this Privacy Policy or our data practices,
          please{" "}
          <Link href="/contact" className="text-primary hover:underline">
            contact us
          </Link>
          .
        </p>
      </Section>
    </StaticPageLayout>
  );
}
