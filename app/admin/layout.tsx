import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { LayoutDashboard, Layers, Upload, Copy, Users, Bot, PackagePlus, ToggleRight, CreditCard, Webhook } from "lucide-react";

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/designs", icon: Layers, label: "Designs" },
  { href: "/admin/upload", icon: Upload, label: "Upload" },
  { href: "/admin/import", icon: PackagePlus, label: "Bulk Import" },
  { href: "/admin/duplicates", icon: Copy, label: "Duplicates" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/features", icon: ToggleRight, label: "Features" },
  { href: "/admin/ai-settings", icon: Bot, label: "AI Settings" },
  { href: "/admin/stripe", icon: CreditCard, label: "Stripe" },
  { href: "/admin/webhooks", icon: Webhook, label: "Webhooks" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r hidden md:block">
        <div className="sticky top-16 p-4">
          <div className="mb-6">
            <h2 className="font-heading font-semibold text-lg px-4">Admin Panel</h2>
            <p className="text-xs text-muted-foreground px-4 mt-1">
              Manage your designs
            </p>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-2.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t p-2 z-40">
        <nav className="flex justify-around">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <main className="flex-1 p-6 pb-24 md:pb-6">{children}</main>
    </div>
  );
}
