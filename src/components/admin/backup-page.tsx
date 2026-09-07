"use client";

import { PageHeader } from "@nocoo/basalt/components/page-header";
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
      <PageHeader title="备份" />
      <BackupPushCard initialConfig={initialConfig} />
      <BackupPullCard initialPullKey={initialPullKey} />
    </div>
  );
}
