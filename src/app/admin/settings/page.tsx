import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { getSiteSettings } from "@/data/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata: Metadata = {
  title: "设置",
};

export default async function SettingsPage() {
  const db = getDb();
  const settings = await getSiteSettings(db);

  return <SettingsForm settings={settings} />;
}
