import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface StaticPageLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showBackLink?: boolean;
  backHref?: string;
  backLabel?: string;
  lastUpdated?: string;
}

export function StaticPageLayout({
  title,
  subtitle,
  children,
  showBackLink = false,
  backHref = "/",
  backLabel = "Back",
  lastUpdated,
}: StaticPageLayoutProps) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back Link */}
      {showBackLink && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      )}

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        {subtitle && (
          <p className="text-lg text-muted-foreground">{subtitle}</p>
        )}
        {lastUpdated && (
          <p className="text-sm text-muted-foreground mt-2">
            Last updated: {lastUpdated}
          </p>
        )}
      </header>

      {/* Content */}
      <div className="prose prose-neutral dark:prose-invert max-w-none">
        {children}
      </div>
    </div>
  );
}

// Reusable section component for static pages
interface SectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Section({ title, children, className = "" }: SectionProps) {
  return (
    <section className={`mb-8 ${className}`}>
      {title && <h2 className="text-xl font-semibold mb-4">{title}</h2>}
      {children}
    </section>
  );
}

// Card component for feature highlights
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="bg-card border rounded-xl p-6">
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

// Accordion item for FAQ
interface AccordionItemProps {
  question: string;
  answer: React.ReactNode;
}

export function FAQItem({ question, answer }: AccordionItemProps) {
  return (
    <details className="group border-b py-4">
      <summary className="flex items-center justify-between cursor-pointer list-none font-medium hover:text-primary transition-colors">
        {question}
        <span className="ml-4 transition-transform group-open:rotate-180">
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </span>
      </summary>
      <div className="pt-4 text-muted-foreground">{answer}</div>
    </details>
  );
}
