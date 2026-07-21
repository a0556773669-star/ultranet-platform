/**
 * Resolves real display names for the owner/partner "who paid" / "who owes" expense fields,
 * so the UI can show actual people's names instead of the relative "אני" / "השותף" labels
 * (which are misleading once a partner - not the owner - is the one looking at the screen).
 */
import { getAdminFirestore } from "./firebase-admin";
import type { Branch, BranchType } from "@ultranet/shared-types";

const FALLBACK_OWNER_NAME = "הבעלים";
const FALLBACK_PARTNER_NAME = "השותף";

/**
 * `preferredName` should be the current session's `user.name` when the viewer IS the owner
 * (the freshest, correct source - no read needed). Only when a partner is viewing do we not
 * have the owner's name in session, so we fall back to looking it up in `n_users`.
 */
export async function getOwnerName(preferredName?: string | null): Promise<string> {
  const trimmed = preferredName?.trim();
  if (trimmed) return trimmed;
  const snap = await getAdminFirestore().collection("n_users").where("role", "==", "owner").limit(1).get();
  const name = (snap.docs[0]?.data() as { name?: string } | undefined)?.name?.trim();
  return name || FALLBACK_OWNER_NAME;
}

/**
 * For the cross-branch "shared expenses" scope there's no single `Branch` doc to read
 * `partnerName` from, so we look across all partnership branches of this module: if they all
 * agree on one partner, use their real name; otherwise (no partner branches, or more than one
 * distinct partner) fall back to the generic label rather than showing a name that may be wrong.
 */
export async function resolveSharedPartnerName(
  branchType: BranchType
): Promise<{ partnerName: string; hasPartner: boolean }> {
  const snap = await getAdminFirestore()
    .collection("n_branches")
    .where("branchType", "==", branchType)
    .where("isMine", "==", false)
    .get();
  if (snap.empty) return { partnerName: FALLBACK_PARTNER_NAME, hasPartner: false };
  const names = Array.from(
    new Set(snap.docs.map((d) => (d.data() as Omit<Branch, "id">).partnerName?.trim()).filter((n): n is string => !!n))
  );
  const partnerName = names.length === 1 ? names[0]! : FALLBACK_PARTNER_NAME;
  return { partnerName, hasPartner: true };
}

export function branchPartnerName(branch: Branch | null): string {
  return branch?.partnerName?.trim() || FALLBACK_PARTNER_NAME;
}
