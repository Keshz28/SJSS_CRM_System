import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password-login";
import { administratorEmailRequired, consumeEmailChallenge } from "@/lib/email-verification";
import { clearLoginAttempts } from "@/lib/login-throttle";


export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  jwt: { maxAge: 8 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        challengeId: { label: "Challenge", type: "text" },
        code: { label: "Email code", type: "text" },
      },
      async authorize(credentials) {
        const user = await verifyPassword(credentials);
        if (!user) return null;
        const adminEmailVerified = user.role === "ADMIN" && administratorEmailRequired()
          ? await consumeEmailChallenge(user, credentials?.challengeId || "", credentials?.code || "")
          : false;
        if (user.role === "ADMIN" && administratorEmailRequired() && !adminEmailVerified) return null;
        await clearLoginAttempts(user.email);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sessionVersion: user.sessionVersion,
          adminEmailVerified,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.adminEmailVerified = Boolean((user as unknown as { adminEmailVerified?: boolean }).adminEmailVerified);
        token.sessionVersion = (
          user as unknown as { sessionVersion: number }
        ).sessionVersion;
      }
      // Recheck on every authenticated server request so deactivation, password
      // resets and role changes also apply to sessions that are already open.
      if (typeof token.id !== "string") throw new Error("Session is no longer active");
      const current = await prisma.user.findUnique({
        where: { id: token.id },
        select: { isActive: true, sessionVersion: true, role: true, name: true },
      });
      if (
        !current?.isActive ||
        current.sessionVersion !== (token.sessionVersion ?? 0)
      )
        throw new Error("Session is no longer active");
      if (current.role === "ADMIN" && administratorEmailRequired() && !token.adminEmailVerified)
        throw new Error("Administrator email verification is required");
      if (current.role !== "ADMIN") token.adminEmailVerified = false;
      token.role = current.role;
      token.name = current.name;
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.adminEmailVerified = Boolean(token.adminEmailVerified);
        session.user.role = token.role as string;
        session.user.name = token.name || session.user.name;
      }
      return session;
    },
  },
};
