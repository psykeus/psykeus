"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";

interface LogoutButtonProps {
  variant?: "default" | "icon";
}

export function LogoutButton({ variant = "icon" }: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      // Even if API fails, try to redirect
      router.push("/login");
      router.refresh();
    }
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleLogout}
        disabled={loading}
        className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
        title="Sign out"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
        ) : (
          <LogOut className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="px-4 py-2 border rounded-md hover:bg-secondary disabled:opacity-50 text-sm"
    >
      {loading ? "Signing out..." : "Sign Out"}
    </button>
  );
}
