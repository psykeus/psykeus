"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  isAuthenticated: boolean;
  isAdmin: boolean;
}

export function MobileNav({ isAuthenticated, isAdmin }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile menu overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="fixed top-16 left-0 right-0 bg-background border-b z-50 animate-fade-in-up">
            <nav className="container mx-auto px-4 py-4">
              <div className="flex flex-col gap-2">
                <Link
                  href="/designs"
                  className="px-4 py-3 rounded-md hover:bg-secondary transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  Browse Designs
                </Link>
                <Link
                  href="/pricing"
                  className="px-4 py-3 rounded-md hover:bg-secondary transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  Pricing
                </Link>

                {isAuthenticated ? (
                  <>
                    <Link
                      href="/account"
                      className="px-4 py-3 rounded-md hover:bg-secondary transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      Account
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        className="px-4 py-3 rounded-md hover:bg-secondary transition-colors"
                        onClick={() => setIsOpen(false)}
                      >
                        Admin
                      </Link>
                    )}
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="px-4 py-3 rounded-md bg-primary text-primary-foreground text-center"
                    onClick={() => setIsOpen(false)}
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
