"use client";

import { AdminPageHeader } from "./page-header";
import { BackupPushCard } from "./backup-push-card";
import { BackupPullCard } from "./backup-pull-card";

interface BackupPageProps {
  initialConfig: {
    webhookUrl: string;
    maskedApiKey: string;
  } | null;
  initialPullKey: string | null;
}

export function BackupPage({ initialConfig, initialPullKey }: BackupPageProps) {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="备份"
        description="配置站点数据备份推送与恢复所需的连接信息。"
        backHref="/admin"
        backLabel="返回管理"
      />
      <BackupPushCard initialConfig={initialConfig} />
      <BackupPullCard initialPullKey={initialPullKey} />
    </div>
  );
}
