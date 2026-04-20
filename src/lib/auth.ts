import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isEmailAllowed, isE2EMode } from "./auth-utils";
import type { Session } from "next-auth";

export { isEmailAllowed } from "./auth-utils";

export const { handlers, signIn, signOut, auth: nextAuth } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    signIn({ profile }) {
      if (!profile?.email) return false;
      return isEmailAllowed(profile.email);
    },
    jwt({ token, profile }) {
      if (profile) {
        token.name = profile.name ?? null;
        token.email = profile.email ?? null;
        token.picture = (profile.picture as string) ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.name = (token.name as string) ?? null;
        session.user.email = (token.email as string) ?? null;
        session.user.image = (token.picture as string) ?? null;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});

/**
 * Mock session for E2E testing.
 * Returned by auth() when E2E_SKIP_AUTH=true and CI=true (or NODE_ENV != production).
 */
const E2E_MOCK_SESSION: Session = {
  user: {
    name: "E2E Test User",
    email: "e2e@test.local",
    image: null,
  },
  expires: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
};

/**
 * Wrapper around NextAuth's auth() that returns a mock session in E2E mode.
 * This allows admin API routes to work correctly during E2E tests.
 */
export async function auth(): Promise<Session | null> {
  if (isE2EMode()) {
    return E2E_MOCK_SESSION;
  }
  return nextAuth();
}

/**
 * Server-side helper: returns true when the current request has an
 * authenticated admin session.  Reusable across any server component
 * that needs a simple "is this user an admin?" check.
 */
export async function isAdminSession(): Promise<boolean> {
  const session = await auth();
  return !!session?.user;
}
