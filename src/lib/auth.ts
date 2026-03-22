import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Email whitelist — only these emails can sign in.
 * Comma-separated in AUTH_ALLOWED_EMAILS env var.
 */
function getAllowedEmails(): string[] {
  const raw = process.env.AUTH_ALLOWED_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string): boolean {
  const allowed = getAllowedEmails();
  if (allowed.length === 0) return false;
  return allowed.includes(email.toLowerCase());
}

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
        token.name = profile.name;
        token.email = profile.email;
        token.picture = profile.picture as string | undefined;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.name = token.name ?? null;
        session.user.email = token.email ?? null;
        session.user.image = token.picture as string | undefined;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});
