import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginCard } from "@/components/auth/login-card";
import { getDb } from "@/lib/db";
import { getSiteSettings } from "@/data/settings";
import { getLogoUrl } from "@/lib/logo";

export const metadata: Metadata = {
  title: "Sign In",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/admin");

  const db = getDb();
  const settings = await getSiteSettings(db);
  const logoUrl = settings.siteLogoVersion
    ? getLogoUrl(settings.siteLogoVersion, 80)
    : null;

  return <LoginCard logoUrl={logoUrl} />;
}
