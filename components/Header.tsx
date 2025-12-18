import Link from "next/link";
import Image from "next/image";
import { getUser, isAdmin as checkIsAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";
import { NotificationCenter } from "@/components/NotificationCenter";

export async function Header() {
  const user = await getUser();
  const userIsAdmin = user ? checkIsAdmin(user) : false;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Image
            src="/images/psykeus-logo-blk.png"
            alt="Psykeus"
            height={28}
            width={50}
            className="dark:hidden"
            priority
          />
          <Image
            src="/images/psykeus-logo-white.png"
            alt="Psykeus"
            height={28}
            width={50}
            className="hidden dark:block"
            priority
          />
          <span className="hidden sm:block text-[10px] text-muted-foreground font-medium tracking-widest uppercase">
            CNC Design Library
          </span>
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
              <Separator orientation="vertical" className="mx-2 h-6" />
              <NotificationCenter userId={user.id} />
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
          {user && <NotificationCenter userId={user.id} />}
          <ThemeToggle />
          <MobileNav isAuthenticated={!!user} isAdmin={userIsAdmin} />
        </div>
      </div>
    </header>
  );
}
