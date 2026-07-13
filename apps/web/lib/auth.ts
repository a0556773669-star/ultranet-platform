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
                                        perms: user.perms ?? null,
                            } as unknown as { id: string; name: string; email: string };
                  },
          }),
          CredentialsProvider({
            id: "email-code",
            name: "קוד באימייל",
            credentials: {
              email: { label: "אימייל", type: "email" },
              code: { label: "קוד", type: "text" },
            },
            async authorize(credentials) {
              if (!credentials?.email || !credentials?.code) return null;
              const email = credentials.email.trim().toLowerCase();
              const db = getAdminFirestore();

              const approvedSnap = await db.collection("n_approved_emails").doc(email).get();
              if (!approvedSnap.exists) return null;
              const approved = approvedSnap.data() as {
                role?: string;
                branchId?: string;
                name?: string;
              };

              const codeSnap = await db.collection("n_login_codes").doc(email).get();
              if (!codeSnap.exists) return null;
              const codeData = codeSnap.data() as { code: string; expiresAt: { toMillis(): number } };
              if (codeData.code !== credentials.code.trim()) return null;
              if (codeData.expiresAt.toMillis() < Date.now()) return null;

              await db.collection("n_login_codes").doc(email).delete();

              const usersSnap = await db.collection("n_users").where("email", "==", email).get();
              const perms = (usersSnap.docs[0]?.data() as { perms?: unknown } | undefined)?.perms ?? null;

              return {
                id: email,
                name: approved.name ?? email,
                email,
                role: approved.role,
                branchId: approved.branchId,
                perms,
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
            try {
                  const db = getAdminFirestore();
                  const snap = await db
                    .collection("n_users")
                    .where("email", "==", (user.email ?? "").toLowerCase())
                    .get();
                  if (snap.empty) return false;
                  const doc = snap.docs[0];
                  if (!doc) return false;
                  const data = doc.data() as { role?: string; branchId?: string; name?: string; perms?: unknown };
                  (user as { role?: string; branchId?: string; name?: string | null; perms?: unknown }).role = data.role;
                  (user as { role?: string; branchId?: string; name?: string | null; perms?: unknown }).branchId = data.branchId;
                  (user as { role?: string; branchId?: string; name?: string | null; perms?: unknown }).perms = data.perms ?? null;
                  if (data.name) (user as { name?: string | null }).name = data.name;
                  return true;
            } catch (err) {
                console.error("[google signIn] failed:", err instanceof Error ? err.stack : err);
                return false;
            }
          },
          async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.branchId = (user as { branchId?: string }).branchId;
        token.perms = (user as { perms?: unknown }).perms ?? null;
        (token as { branchSyncedAt?: number }).branchSyncedAt = Date.now();
        return token;
      }
      // Re-sync role/branchId/perms from Firestore periodically so changes made
      // after the user's last full sign-in (e.g. linking a partner to a branch)
      // take effect without forcing them to log out and back in.
      const lastSync = (token as { branchSyncedAt?: number }).branchSyncedAt ?? 0;
      const staleMs = 2 * 60 * 1000;
      if (token.email && Date.now() - lastSync > staleMs) {
        try {
          const db = getAdminFirestore();
          const snap = await db
            .collection("n_users")
            .where("email", "==", String(token.email).toLowerCase())
            .get();
          if (!snap.empty) {
            const data = snap.docs[0]!.data() as {
              role?: string;
              branchId?: string;
              perms?: unknown;
            };
            token.role = data.role;
            token.branchId = data.branchId;
            token.perms = data.perms ?? null;
          }
        } catch {
          // ignore transient Firestore errors; keep existing cached token values
        }
        (token as { branchSyncedAt?: number }).branchSyncedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
                  if (session.user) {
                            (session.user as { role?: unknown }).role = token.role;
                            (session.user as { branchId?: unknown }).branchId = token.branchId;
                            (session.user as { perms?: unknown }).perms = token.perms ?? null;
                  }
                  return session;
          },
    },
    session: { strategy: "jwt" },
    pages: {
          signIn: "/login",
    },
};
