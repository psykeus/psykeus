import { requireAdmin } from "@/lib/auth";
import { FeatureFlagsForm } from "./FeatureFlagsForm";

export default async function FeaturesPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Feature Flags</h1>
        <p className="text-muted-foreground mt-1">
          Enable or disable features across your site
        </p>
      </div>

      <FeatureFlagsForm />
    </div>
  );
}
