import { getAdminFirestore } from "./firebase-admin";
import { roundPrice } from "./rental-pricing";
import type { Laptop, Stick, Rental } from "@ultranet/shared-types";

export interface PartnerSettlementLine {
  partnerName: string;
  pct: number;
  branchId: string;
  computerNames: string[];
  rentalCount: number;
  totalRevenue: number;
  amountOwed: number;
}

/**
 * Per-computer partner revenue share for a given month (e.g. "2026-07"): for every laptop
 * flagged `hasPartner`, sums the (final/calc) price of every rental of that laptop - and of its
 * linked stick, if any - that was returned in that month, and applies the laptop's `partnerPct`
 * (default 15). Mirrors the "returned in month" convention `computeBranchFinancials` uses for
 * branch-level settlement, so the two reports agree on which rentals count as "this month".
 * Grouped by (branchId, partnerName, pct) - a branch can have more than one partner across
 * different computers.
 */
export async function computePartnerSettlement(month: string): Promise<PartnerSettlementLine[]> {
  const db = getAdminFirestore();
  const [laptopsSnap, sticksSnap, rentalsSnap] = await Promise.all([
    db.collection("n_laptops").get(),
    db.collection("n_sticks").get(),
    db.collection("n_rentals").where("status", "==", "returned").get(),
  ]);

  const laptops = laptopsSnap.docs.map((d) => ({ ...(d.data() as Omit<Laptop, "id">), id: d.id }) as Laptop);
  const partneredLaptops = laptops.filter((l) => l.hasPartner);
  if (partneredLaptops.length === 0) return [];
  const laptopById = new Map(partneredLaptops.map((l) => [l.id, l]));

  const sticks = sticksSnap.docs.map((d) => ({ ...(d.data() as Omit<Stick, "id">), id: d.id }) as Stick);
  const stickToLaptop = new Map<string, Laptop>();
  for (const s of sticks) {
    if (s.linkedLaptopId && laptopById.has(s.linkedLaptopId)) {
      stickToLaptop.set(s.id, laptopById.get(s.linkedLaptopId)!);
    }
  }

  const rentals = rentalsSnap.docs.map((d) => ({ ...(d.data() as Omit<Rental, "id">), id: d.id }) as Rental);

  const lines = new Map<string, PartnerSettlementLine>();
  for (const r of rentals) {
    // Skip rentals that were returned but never actually paid (client still owes) - counting
    // those would tell the owner to pay the partner a share of money nobody collected yet.
    if (!r.paid) continue;
    if (!r.returnDate || r.returnDate.slice(0, 7) !== month) continue;
    const laptop = r.kind === "laptop" ? laptopById.get(r.itemId) : stickToLaptop.get(r.itemId);
    if (!laptop) continue;

    const pct = laptop.partnerPct ?? 15;
    const partnerName = laptop.partnerName?.trim() || "שותף ללא שם";
    const key = `${laptop.branchId}|${partnerName}|${pct}`;
    let line = lines.get(key);
    if (!line) {
      line = { partnerName, pct, branchId: laptop.branchId, computerNames: [], rentalCount: 0, totalRevenue: 0, amountOwed: 0 };
      lines.set(key, line);
    }
    if (!line.computerNames.includes(laptop.name)) line.computerNames.push(laptop.name);
    line.rentalCount += 1;
    line.totalRevenue += roundPrice(r.finalPrice ?? r.calcPrice ?? 0);
  }

  for (const line of lines.values()) {
    // שקלים שלמים בלבד - אין אגורות בשום סכום במודול ההשכרות.
    line.amountOwed = roundPrice((line.totalRevenue * line.pct) / 100);
  }

  return [...lines.values()].sort((a, b) => b.amountOwed - a.amountOwed);
}
