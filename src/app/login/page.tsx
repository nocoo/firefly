import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginCard } from "@/components/auth/login-card";

export const metadata: Metadata = {
  title: "Sign In",
};

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[400px] w-[400px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-[420px]">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-card)] bg-primary">
            <svg
              className="h-5 w-5 text-primary-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome Back
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to access the admin panel
          </p>
        </div>

        {/* Login card */}
        <LoginCard />

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Powered by{" "}
          <a
            href="https://lizheng.me"
            className="text-primary hover:text-primary/80 transition-colors"
          >
            lizheng.me
          </a>
        </p>
      </div>
    </div>
  );
}
