import Link from "next/link";
import { getUser, isAdmin as checkIsAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";

export async function Header() {
  const user = await getUser();
  const userIsAdmin = user ? checkIsAdmin(user) : false;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-heading text-xl font-semibold tracking-tight hover:opacity-80 transition-opacity"
        >
          <svg
            className="h-7 w-7 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="hidden sm:inline">CNC Library</span>
          <span className="sm:hidden">CNC</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          <Button variant="ghost" asChild>
            <Link href="/designs">Browse</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/pricing">Pricing</Link>
          </Button>

          {user ? (
            <>
              <Button variant="ghost" asChild>
                <Link href="/account">Account</Link>
              </Button>
              {userIsAdmin && (
                <Button variant="ghost" asChild>
                  <Link href="/admin">Admin</Link>
                </Button>
              )}
            </>
          ) : (
            <Button asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          )}

          <Separator orientation="vertical" className="mx-2 h-6" />
          <ThemeToggle />
        </nav>

        {/* Mobile Navigation */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <MobileNav isAuthenticated={!!user} isAdmin={userIsAdmin} />
        </div>
      </div>
    </header>
  );
}
