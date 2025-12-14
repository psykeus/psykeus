"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const lastScrollCheck = useRef(0);

  // Throttled scroll handler - checks at most every 150ms
  const handleScroll = useCallback(() => {
    const now = Date.now();
    if (now - lastScrollCheck.current < 150) return;
    lastScrollCheck.current = now;
    setIsVisible(window.scrollY > 500);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!isVisible) return null;

  return (
    <Button
      onClick={scrollToTop}
      size="icon"
      className="fixed bottom-6 right-6 z-50 rounded-full shadow-warm-lg animate-fade-in"
      aria-label="Back to top"
    >
      <ChevronUp className="h-5 w-5" />
    </Button>
  );
}
