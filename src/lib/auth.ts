import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isEmailAllowed } from "./auth-utils";

export { isEmailAllowed } from "./auth-utils";

export const { handlers, signIn, signOut, auth } = NextAuth({
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
 * Server-side helper: returns true when the current request has an
 * authenticated admin session.  Reusable across any server component
 * that needs a simple "is this user an admin?" check.
 */
export async function isAdminSession(): Promise<boolean> {
  const session = await auth();
  return !!session?.user;
}
