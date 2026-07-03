import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { getAdminFirestore } from "@/lib/firebase-admin";

// Mirrors the login logic already used in app.html:
// - email+password checked against n_users (same collection, same fields)
// - Google sign-in only succeeds if the Google account's email already exists in n_users
export const authOptions: NextAuthOptions = {
    providers: [
          CredentialsProvider({
                  name: "מייל וסיסמה",
                  credentials: {
                            email: { label: "מייל", type: "email" },
                            password: { label: "סיסמה", type: "password" },
                  },
                  async authorize(credentials) {
                            if (!credentials?.email || !credentials.password) return null;
                            const db = getAdminFirestore();
                            const snap = await db
                              .collection("n_users")
                              .where("email", "==", credentials.email.toLowerCase())
                              .get();
                            const match = snap.docs.find((d) => d.data().pass === credentials.password);
                            if (!match) return null;
                            const user = match.data();
                            return {
                                        id: match.id,
                                        name: user.name,
                                        email: user.email,
                                        role: user.role,
                                        branchId: user.branchId,
                            } as unknown as { id: string; name: string; email: string };
                  },
          }),
          ...(process.env.GOOGLE_CLIENT_ID
                    ? [
                                GoogleProvider({
                                              clientId: process.env.GOOGLE_CLIENT_ID,
                                              clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
                                }),
                              ]
                    : []),
        ],
    callbacks: {
          async signIn({ user, account }) {
                  if (account?.provider !== "google") return true;
                  const db = getAdminFirestore();
                  const snap = await db
                    .collection("n_users")
                    .where("email", "==", (user.email ?? "").toLowerCase())
                    .get();
                  return !snap.empty;
          },
          async jwt({ token, user }) {
                  if (user) {
                            token.role = (user as { role?: string }).role;
                            token.branchId = (user as { branchId?: string }).branchId;
                  }
                  return token;
          },
          async session({ session, token }) {
                  if (session.user) {
                            (session.user as { role?: unknown }).role = token.role;
                            (session.user as { branchId?: unknown }).branchId = token.branchId;
                  }
                  return session;
          },
    },
    session: { strategy: "jwt" },
    pages: {
          signIn: "/login",
    },
};
