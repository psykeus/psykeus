import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AISettingsForm } from "./AISettingsForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, Tags, Settings2 } from "lucide-react";
import { loadAIConfig } from "@/lib/ai-config";

export default async function AISettingsPage() {
  const user = await requireAdmin();
  if (!user) {
    redirect("/login?redirect=/admin/ai-settings");
  }

  const config = await loadAIConfig();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          AI Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure AI models, prompts, and metadata extraction settings
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Models
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">3D Analysis</span>
                <Badge variant="outline">{config.models.model3D.model}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">2D Analysis</span>
                <Badge variant="outline">{config.models.legacy2D.model}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Tags className="h-4 w-4 text-primary" />
              Tag Vocabulary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              6 categories of controlled tags for consistent metadata
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              Prompts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Custom system and user prompts for AI extraction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Settings Form */}
      <AISettingsForm />
    </div>
  );
}
