import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DesignCard } from "@/components/DesignCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Eye,
  Download,
  Search,
  FileCode,
  Box,
  Layers,
  Scissors,
  UserPlus,
} from "lucide-react";
import { getUser } from "@/lib/auth";
import { isFavoritesEnabled } from "@/lib/feature-flags";

export default async function HomePage() {
  const supabase = await createClient();

  // Fetch recent designs
  const { data: designs, error } = await supabase
    .from("designs")
    .select("id, slug, title, preview_path, difficulty, categories, style")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.error("Error fetching designs:", error);
  }

  // Fetch stats for homepage
  const [designCountResult, downloadCountResult, userCountResult] =
    await Promise.all([
      supabase
        .from("designs")
        .select("*", { count: "exact", head: true })
        .eq("is_public", true),
      supabase.from("downloads").select("*", { count: "exact", head: true }),
      supabase.from("users").select("*", { count: "exact", head: true }),
    ]);

  const totalDesigns = designCountResult.count || 0;
  const totalDownloads = downloadCountResult.count || 0;
  const totalUsers = userCountResult.count || 0;

  // Fetch user favorites in a single query (avoids N API calls from FavoriteButton)
  const user = await getUser();
  const favoritesEnabled = await isFavoritesEnabled();
  let userFavorites = new Set<string>();

  if (user && favoritesEnabled && designs?.length) {
    const designIds = designs.map((d) => d.id);
    const { data: favorites } = await supabase
      .from("user_favorites")
      .select("design_id")
      .eq("user_id", user.id)
      .in("design_id", designIds);

    userFavorites = new Set(favorites?.map((f) => f.design_id) || []);
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 py-20 md:py-28">
          {/* Decorative blurs */}
          <div className="absolute top-10 left-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />

          <div className="relative text-center max-w-4xl mx-auto">
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
              CNC & Laser
              <span className="block text-primary">Design Library</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Browse and download ready-to-use design files for your CNC router
              or laser cutter. Start your next project today.
            </p>

            {/* Stats */}
            <div className="flex justify-center gap-8 md:gap-12 mb-10">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary">
                  {totalDesigns.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Designs</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary">
                  {totalDownloads.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Downloads</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary">
                  {totalUsers.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Users</div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild className="text-lg px-8 py-6 h-auto">
                <Link href="/designs">
                  <Search className="mr-2 h-5 w-5" />
                  Browse Designs
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="text-lg px-8 py-6 h-auto"
              >
                <Link href="/how-it-works">
                  Learn How It Works
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4">
        {/* How It Works */}
        <section className="py-16">
          <h2 className="font-heading text-2xl font-semibold text-center mb-12">
            Get Started in 3 Easy Steps
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                1
              </div>
              <h3 className="font-semibold mb-2">Browse & Preview</h3>
              <p className="text-sm text-muted-foreground">
                Explore our library and preview designs before downloading
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                2
              </div>
              <h3 className="font-semibold mb-2">Download Files</h3>
              <p className="text-sm text-muted-foreground">
                Create a free account and download your chosen designs
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                3
              </div>
              <h3 className="font-semibold mb-2">Start Cutting</h3>
              <p className="text-sm text-muted-foreground">
                Import into your CAM software and bring your project to life
              </p>
            </div>
          </div>
        </section>

        {/* File Formats */}
        <section className="py-12 border-t">
          <h2 className="font-heading text-xl font-semibold text-center mb-8">
            Supported File Formats
          </h2>
          <div className="flex flex-wrap justify-center gap-4 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 px-4 py-2 bg-card border rounded-lg">
              <Layers className="h-5 w-5 text-primary" />
              <span className="font-mono font-medium">SVG</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-card border rounded-lg">
              <Scissors className="h-5 w-5 text-primary" />
              <span className="font-mono font-medium">DXF</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-card border rounded-lg">
              <Box className="h-5 w-5 text-primary" />
              <span className="font-mono font-medium">STL</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-card border rounded-lg">
              <FileCode className="h-5 w-5 text-primary" />
              <span className="font-mono font-medium">AI</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-card border rounded-lg">
              <FileCode className="h-5 w-5 text-primary" />
              <span className="font-mono font-medium">EPS</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-card border rounded-lg">
              <FileCode className="h-5 w-5 text-primary" />
              <span className="font-mono font-medium">PDF</span>
            </div>
          </div>
        </section>

        {/* Recent Designs */}
        <section className="py-12 border-t">
          <div className="flex justify-between items-center mb-8">
            <h2 className="font-heading text-2xl font-semibold">
              Recent Designs
            </h2>
            <Button variant="ghost" asChild>
              <Link href="/designs">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {designs && designs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {designs.map((design, index) => (
                <DesignCard
                  key={design.id}
                  design={design}
                  isFavorited={userFavorites.has(design.id)}
                  priority={index < 4}
                />
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-muted-foreground">
                  No designs available yet.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Check back soon!
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Features Section */}
        <section className="py-16 border-t">
          <h2 className="font-heading text-2xl font-semibold text-center mb-12">
            Why Choose Our Library?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center p-6 bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Eye className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-heading font-semibold mb-2">
                  Preview First
                </h3>
                <p className="text-muted-foreground text-sm">
                  See detailed previews of every design, including 3D models,
                  before downloading
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6 bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Download className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-heading font-semibold mb-2">
                  Instant Downloads
                </h3>
                <p className="text-muted-foreground text-sm">
                  Download files immediately with your free account. No waiting,
                  no hassle
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6 bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-heading font-semibold mb-2">
                  Free to Join
                </h3>
                <p className="text-muted-foreground text-sm">
                  Create a free account to start downloading. Upgrade for
                  premium designs
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 border-t">
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 md:p-12 text-center max-w-3xl mx-auto">
            <h2 className="font-heading text-2xl md:text-3xl font-semibold mb-4">
              Ready to Start Your Next Project?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join our community of makers and get access to hundreds of
              ready-to-cut designs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link href="/designs">
                  Browse Designs
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Create Free Account</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
