import Link from "next/link";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="border-t bg-card/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image
                src="/images/psykeus-logo-blk.png"
                alt="Psykeus"
                height={24}
                width={43}
                className="dark:hidden"
              />
              <Image
                src="/images/psykeus-logo-white.png"
                alt="Psykeus"
                height={24}
                width={43}
                className="hidden dark:block"
              />
              <span className="text-[10px] text-muted-foreground font-medium tracking-widest uppercase">
                CNC Design Library
              </span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-sm">
              Browse and download CNC and laser cutting designs. Free design
              files for woodworking, metalworking, and crafting projects.
            </p>
          </div>

          {/* Browse */}
          <div>
            <h3 className="font-heading font-semibold mb-4">Browse</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/designs"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  All Designs
                </Link>
              </li>
              <li>
                <Link
                  href="/designs?difficulty=easy"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Beginner Friendly
                </Link>
              </li>
              <li>
                <Link
                  href="/designs?sort=newest"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  New Arrivals
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-heading font-semibold mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/about"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/how-it-works"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  How It Works
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-heading font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/license"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  License & Usage
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Psykeus. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-primary transition-colors">
              Sign In
            </Link>
            <Link href="/account" className="hover:text-primary transition-colors">
              My Account
            </Link>
            <span className="text-xs">Made for makers</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
