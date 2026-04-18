import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isE2EMode } from "@/lib/auth-utils";
import { AdminShell } from "@/components/admin/shell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user && !isE2EMode()) {
    redirect("/login");
  }

  return (
    <AdminShell
      user={{
        name: session?.user?.name,
        email: session?.user?.email,
        image: session?.user?.image,
      }}
    >
      {children}
    </AdminShell>
  );
}
