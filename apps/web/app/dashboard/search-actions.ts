"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { isOwnerSession, resolveModuleScope } from "@/lib/perms";
import { loadPersonalBoard } from "./duxus/personal/actions";
import type { Branch, Laptop, RentalClient, Rental } from "@ultranet/shared-types";

/**
 * חיפוש כללי בראש האתר (אפיון שדרוג v2, סעיף 2). **קריאה בלבד.**
 *
 * כל סוג תוצאה מסונן בדיוק לפי אותו כלל של המסך שהקישור פותח, כדי שהחיפוש לא יחשוף מה
 * שהקישור הישיר היה חוסם:
 * - לקוחות ומחשבים: הרשאת `rentals`; מי שאינו בעלים — רק הסניף של הכובע בהשכרות (כמו
 *   `clients/[id]` ו-`laptops/[id]`, שמחזירים 404 לסניף אחר).
 * - סניפים: בעלים בלבד (מסך הסניפים נעול ב-`requireOwner`).
 * - משימות ליוני: רק למי שיש לו גישה לטאב (`loadPersonalBoard` בודק בעצמו).
 */
export type SearchHit = { kind: "client" | "laptop" | "branch" | "task"; id: string; title: string; sub: string; href: string };

const LIMIT_PER_KIND = 6;

export async function globalSearchAction(rawQuery: string): Promise<SearchHit[]> {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return [];
  const session = await getServerSession(authOptions);
  if (!session) return [];

  const db = getAdminFirestore();
  const isOwner = isOwnerSession(session);
  const rentals = resolveModuleScope(session, "rentals");
  const duxus = resolveModuleScope(session, "duxus");
  const hits: SearchHit[] = [];

  if (rentals.granted) {
    const myBranchId = rentals.branchId ?? "";
    const allowed = (branchId: string) => isOwner || branchId === myBranchId;
    const [clientsSnap, laptopsSnap, branchesSnap, activeSnap] = await Promise.all([
      db.collection("n_rental_clients").select("name", "phone", "branchId").get(),
      db.collection("n_laptops").select("name", "number", "simNumber", "branchId", "status").get(),
      db.collection("n_branches").select("name", "branchType", "deleted").get(),
      db.collection("n_rentals").where("status", "==", "active").select("clientId", "itemId").get(),
    ]);
    const branchName = new Map(branchesSnap.docs.map((d) => [d.id, (d.data() as Branch).name]));
    const activeClients = new Set(activeSnap.docs.map((d) => (d.data() as Rental).clientId));
    const rentedItems = new Set(activeSnap.docs.map((d) => (d.data() as Rental).itemId));

    const clients = clientsSnap.docs
      .map((d) => ({ ...(d.data() as RentalClient), id: d.id }))
      .filter((c) => allowed(c.branchId))
      .filter((c) => (c.name ?? "").toLowerCase().includes(q) || (c.phone ?? "").includes(q))
      .slice(0, LIMIT_PER_KIND);
    for (const c of clients) {
      hits.push({
        kind: "client",
        id: c.id,
        title: c.name,
        sub: [c.phone, branchName.get(c.branchId), activeClients.has(c.id) ? "השכרה פעילה" : ""].filter(Boolean).join(" · "),
        href: `/dashboard/rentals/clients/${c.id}`,
      });
    }

    const laptops = laptopsSnap.docs
      .map((d) => ({ ...(d.data() as Laptop), id: d.id }))
      .filter((l) => allowed(l.branchId))
      .filter(
        (l) =>
          (l.name ?? "").toLowerCase().includes(q) ||
          String(l.number ?? "").includes(q) ||
          (l.simNumber ?? "").includes(q),
      )
      .slice(0, LIMIT_PER_KIND);
    for (const l of laptops) {
      const state = l.status === "sold" ? "נמכר" : l.status === "removed" ? "הוצא מהסניף" : rentedItems.has(l.id) ? "מושכר" : "פנוי";
      hits.push({
        kind: "laptop",
        id: l.id,
        title: l.name,
        sub: [branchName.get(l.branchId), state].filter(Boolean).join(" · "),
        href: `/dashboard/rentals/laptops/${l.id}`,
      });
    }

    if (isOwner) {
      const branches = branchesSnap.docs
        .map((d) => ({ ...(d.data() as Branch), id: d.id }))
        .filter((b) => b.branchType === "rentals" && !b.deleted && (b.name ?? "").toLowerCase().includes(q))
        .slice(0, LIMIT_PER_KIND);
      for (const b of branches) {
        hits.push({ kind: "branch", id: b.id, title: b.name, sub: "סניף השכרות", href: `/dashboard/rentals/branches/${b.id}` });
      }
    }
  }

  if (duxus.granted) {
    const board = await loadPersonalBoard().catch(() => null);
    if (board && board.access !== "none") {
      const tasks = board.active
        .filter((t) => t.title.toLowerCase().includes(q) || (t.contactName ?? "").toLowerCase().includes(q) || (t.contactPhone ?? "").includes(q))
        .slice(0, LIMIT_PER_KIND);
      for (const t of tasks) {
        hits.push({
          kind: "task",
          id: t.id,
          title: t.title,
          sub: ["משימות ליוני", t.contactName].filter(Boolean).join(" · "),
          href: "/dashboard/duxus/personal",
        });
      }
    }
  }

  return hits;
}
