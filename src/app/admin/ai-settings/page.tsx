import { getDb } from "@/lib/db";
import { getAiSettings } from "@/data/ai-settings";
import { AiSettingsForm } from "@/components/admin/ai-settings-form";
import { AI_PROVIDERS, CUSTOM_PROVIDER_INFO } from "@/services/ai";
import { maskApiKey } from "@/data/ai-settings";

export default async function AiSettingsPage() {
  const db = getDb();
  const settings = await getAiSettings(db);

  // Build provider list for the form
  const providers = [
    ...Object.values(AI_PROVIDERS),
    { ...CUSTOM_PROVIDER_INFO, baseURL: "", sdkType: "" as const },
  ];

  return (
    <AiSettingsForm
      settings={{
        ...settings,
        apiKey: maskApiKey(settings.apiKey),
        hasApiKey: !!settings.apiKey,
      }}
      providers={providers}
    />
  );
}
