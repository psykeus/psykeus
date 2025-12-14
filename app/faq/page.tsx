import { Metadata } from "next";
import Link from "next/link";
import { StaticPageLayout, Section, FAQItem } from "@/components/StaticPageLayout";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about CNC Design Library - accounts, downloads, file formats, and more.",
};

export default function FAQPage() {
  return (
    <StaticPageLayout
      title="Frequently Asked Questions"
      subtitle="Find answers to common questions about using CNC Design Library"
    >
      <Section title="Account & Getting Started">
        <div className="not-prose">
          <FAQItem
            question="Do I need an account to browse designs?"
            answer={
              <p>
                No, you can browse and preview all designs without an account.
                However, you&apos;ll need a free account to download files.
              </p>
            }
          />
          <FAQItem
            question="Is creating an account free?"
            answer={
              <p>
                Yes! Creating an account is completely free. Some premium
                features or exclusive designs may require an upgraded account in
                the future.
              </p>
            }
          />
          <FAQItem
            question="What information do I need to create an account?"
            answer={
              <p>
                Just an email address and password. You can optionally add a
                display name, profile photo, and bio.
              </p>
            }
          />
          <FAQItem
            question="Can I delete my account?"
            answer={
              <p>
                Yes, you can delete your account at any time. Contact us and
                we&apos;ll remove your account and associated data within 30
                days.
              </p>
            }
          />
        </div>
      </Section>

      <Section title="Downloading & File Formats">
        <div className="not-prose">
          <FAQItem
            question="What file formats are available?"
            answer={
              <div>
                <p className="mb-2">We support a variety of formats:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>
                    <strong>2D:</strong> SVG, DXF, AI, EPS, PDF
                  </li>
                  <li>
                    <strong>3D:</strong> STL, OBJ, GLTF/GLB, 3MF
                  </li>
                </ul>
                <p className="mt-2">
                  Each design indicates its available format(s) on the download
                  page.
                </p>
              </div>
            }
          />
          <FAQItem
            question="Are there download limits?"
            answer={
              <p>
                Free accounts may have daily or monthly download limits to
                prevent abuse. If you need more downloads, check if an upgraded
                account tier is available.
              </p>
            }
          />
          <FAQItem
            question="Where can I find my downloaded files?"
            answer={
              <p>
                Downloads go to your browser&apos;s default download folder. You
                can also view your download history in your{" "}
                <Link href="/account" className="text-primary hover:underline">
                  account dashboard
                </Link>
                .
              </p>
            }
          />
          <FAQItem
            question="Why can't I download a design?"
            answer={
              <div>
                <p className="mb-2">Common reasons:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>You need to log in first</li>
                  <li>You&apos;ve reached your daily/monthly download limit</li>
                  <li>The design is premium and requires an upgraded account</li>
                  <li>Technical issue - try refreshing or contact us</li>
                </ul>
              </div>
            }
          />
        </div>
      </Section>

      <Section title="Using Designs">
        <div className="not-prose">
          <FAQItem
            question="What software can I use with these files?"
            answer={
              <div>
                <p className="mb-2">
                  Our files work with most CNC and laser cutting software:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Vectric VCarve, Aspire</li>
                  <li>Carbide Create, Carbide Motion</li>
                  <li>Easel (Inventables)</li>
                  <li>LightBurn</li>
                  <li>Fusion 360</li>
                  <li>Inkscape (free)</li>
                </ul>
              </div>
            }
          />
          <FAQItem
            question="Do I need to scale the designs?"
            answer={
              <p>
                Designs include their approximate dimensions in the listing.
                However, you may need to scale them in your CAM software to fit
                your material size. Always verify dimensions before cutting.
              </p>
            }
          />
          <FAQItem
            question="Can I modify the designs?"
            answer={
              <p>
                Most licenses allow modification. Check the specific
                design&apos;s license - if it says &quot;Unknown&quot;, proceed
                with caution. You&apos;re free to adapt designs for your needs.
              </p>
            }
          />
        </div>
      </Section>

      <Section title="Licensing & Commercial Use">
        <div className="not-prose">
          <FAQItem
            question="Can I sell products made from these designs?"
            answer={
              <div>
                <p className="mb-2">It depends on the license:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>
                    <strong>Public Domain / CC0:</strong> Yes, sell freely
                  </li>
                  <li>
                    <strong>CC BY:</strong> Yes, with attribution
                  </li>
                  <li>
                    <strong>CC BY-NC / Personal Only:</strong> No commercial use
                  </li>
                  <li>
                    <strong>Unknown:</strong> Not recommended - verify first
                  </li>
                </ul>
                <p className="mt-2">
                  See our{" "}
                  <Link
                    href="/license"
                    className="text-primary hover:underline"
                  >
                    License & Usage
                  </Link>{" "}
                  page for details.
                </p>
              </div>
            }
          />
          <FAQItem
            question="What does 'Unknown' license mean?"
            answer={
              <p>
                &quot;Unknown&quot; means we haven&apos;t verified the copyright
                status of that design. It may be public domain or it may have
                restrictions. Use at your own risk, and avoid commercial use
                without independent verification.
              </p>
            }
          />
          <FAQItem
            question="Can I share downloaded files with others?"
            answer={
              <p>
                No. Please don&apos;t redistribute the digital files. If someone
                wants a design, direct them to our website to download it
                themselves. This helps us track usage and maintain the service.
              </p>
            }
          />
        </div>
      </Section>

      <Section title="Technical Issues">
        <div className="not-prose">
          <FAQItem
            question="The preview isn't loading. What should I do?"
            answer={
              <div>
                <p className="mb-2">Try these steps:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Refresh the page</li>
                  <li>Try a different browser</li>
                  <li>Disable ad blockers temporarily</li>
                  <li>Check your internet connection</li>
                </ol>
                <p className="mt-2">
                  If issues persist,{" "}
                  <Link
                    href="/contact"
                    className="text-primary hover:underline"
                  >
                    contact us
                  </Link>
                  .
                </p>
              </div>
            }
          />
          <FAQItem
            question="The downloaded file won't open in my software."
            answer={
              <div>
                <p className="mb-2">Common solutions:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Make sure your software supports the file format</li>
                  <li>Try opening with a different program</li>
                  <li>Check if the file downloaded completely</li>
                  <li>For DXF files, try importing rather than opening</li>
                </ul>
              </div>
            }
          />
          <FAQItem
            question="I found a bug. How do I report it?"
            answer={
              <p>
                Please{" "}
                <Link href="/contact" className="text-primary hover:underline">
                  contact us
                </Link>{" "}
                with details about the issue, including what you were doing when
                it occurred and any error messages you saw. Screenshots help!
              </p>
            }
          />
        </div>
      </Section>

      <Section title="Still Have Questions?">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center not-prose">
          <p className="mb-4">
            Can&apos;t find what you&apos;re looking for?
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            Contact Us
          </Link>
        </div>
      </Section>
    </StaticPageLayout>
  );
}
