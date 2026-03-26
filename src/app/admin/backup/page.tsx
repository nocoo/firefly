import { getDb } from "@/lib/db";
import { getBackyConfig, getBackyPullKey } from "@/data/backup";
import { maskApiKey } from "@/models/backup";
import { BackupPage } from "@/components/admin/backup-page";

export default async function AdminBackupPage() {
  const db = getDb();
  const [config, pullKey] = await Promise.all([
    getBackyConfig(db),
    getBackyPullKey(db),
  ]);

  return (
    <BackupPage
      initialConfig={
        config
          ? {
              webhookUrl: config.webhookUrl,
              maskedApiKey: maskApiKey(config.apiKey),
            }
          : null
      }
      initialPullKey={pullKey}
    />
  );
}
