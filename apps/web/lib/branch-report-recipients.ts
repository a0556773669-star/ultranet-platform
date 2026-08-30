/**
 * Who a branch's monthly statement goes to.
 *
 * Two sources, in order: the partner's address recorded on the branch itself
 * (Branch.partnerEmail), and otherwise the address of the user account assigned to that branch
 * in n_users - "המייל שלו שמוגדר במערכת". A branch with neither can't be emailed, and is
 * reported as such rather than silently skipped.
 */
import { getAdminFirestore } from "./firebase-admin";
import type { AppUser, Branch } from "@ultranet/shared-types";

export interface ReportRecipient {
  branchId: string;
  branchName: string;
  /** null when the branch has no address on file at all. */
  email: string | null;
  /** where the address came from, so the UI can show it. */
  source: "branch" | "user" | "none";
}

export async function loadReportRecipients(branches: Branch[]): Promise<ReportRecipient[]> {
  const db = getAdminFirestore();
  const usersSnap = await db.collection("n_users").get();

  const emailByBranchId = new Map<string, string>();
  for (const d of usersSnap.docs) {
    const u = { ...(d.data() as Omit<AppUser, "id">), id: d.id } as AppUser;
    const email = u.email?.trim();
    // "all" is the owner's sentinel branchId, not a real branch - skip it here.
    if (!email || !u.branchId || u.branchId === "all") continue;
    if (!emailByBranchId.has(u.branchId)) emailByBranchId.set(u.branchId, email);
  }

  return branches.map((b) => {
    const fromBranch = b.partnerEmail?.trim();
    if (fromBranch) return { branchId: b.id, branchName: b.name, email: fromBranch, source: "branch" as const };
    const fromUser = emailByBranchId.get(b.id);
    if (fromUser) return { branchId: b.id, branchName: b.name, email: fromUser, source: "user" as const };
    return { branchId: b.id, branchName: b.name, email: null, source: "none" as const };
  });
}

/** The owner's own address, so they can send themselves any branch's report as a test. */
export async function loadOwnerEmail(sessionEmail?: string | null): Promise<string | null> {
  const trimmed = sessionEmail?.trim();
  if (trimmed) return trimmed;
  const snap = await getAdminFirestore().collection("n_users").where("role", "==", "owner").limit(1).get();
  const email = (snap.docs[0]?.data() as { email?: string } | undefined)?.email?.trim();
  return email || null;
}
