import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[60vh]">
      {/* Illustration */}
      <div className="relative mb-8">
        <svg
          viewBox="0 0 200 200"
          className="w-48 h-48 text-muted-foreground/20"
          fill="currentColor"
        >
          <rect x="20" y="20" width="160" height="160" rx="8" />
          <path
            d="M60 80 L80 100 L60 120 M100 80 L120 100 L100 120"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-primary"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="100" cy="150" r="6" className="text-primary" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-heading text-6xl font-bold text-primary">404</span>
        </div>
      </div>

      <h1 className="font-heading text-3xl font-bold mb-4 text-center">
        Design Not Found
      </h1>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        Looks like this design has been cut out of our library.
        It may have been moved, deleted, or the URL might be incorrect.
      </p>

      <div className="flex flex-wrap gap-4 justify-center">
        <Button asChild>
          <Link href="/">
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/designs">
            <Search className="mr-2 h-4 w-4" />
            Browse Designs
          </Link>
        </Button>
      </div>
    </div>
  );
}
