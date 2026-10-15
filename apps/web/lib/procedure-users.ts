import { getAdminFirestore } from "@/lib/firebase-admin";

/** משתמשי האתר לבחירת "משתמשים נבחרים" בנוהל — שם ומייל בלבד. קריאה בלבד. */
export async function loadUsersForAudience(): Promise<{ email: string; name: string }[]> {
  const snap = await getAdminFirestore().collection("n_users").select("email", "name").get();
  return snap.docs
    .map((d) => d.data() as { email?: string; name?: string })
    .filter((u) => u.email)
    .map((u) => ({ email: String(u.email).toLowerCase(), name: u.name ?? "" }))
    .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "he"));
}
