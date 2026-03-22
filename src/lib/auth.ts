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
