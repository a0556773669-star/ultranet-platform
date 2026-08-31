"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getInventorySnapshotAction } from "../inventory/actions";
import { getWeekKey, type LegacyTask } from "@/lib/legacy-tasks";
import type { LegacyTicket } from "@/lib/legacy-tickets";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("יש להתחבר למערכת");
  }
  return session;
}

export type ReorderItem = { branchKey: string; branchLabel: string; product: string; qty: number; min: number };

export type ReportsStats = {
  openTickets: number;
  progressTickets: number;
  lowStockCount: number;
  tasksDoneThisWeek: number;
  tasksTotal: number;
};

export type OrdersSnapshot = { reorder: ReorderItem[]; stats: ReportsStats };

export async function getOrdersSnapshotAction(): Promise<OrdersSnapshot> {
  await requireSession();
  const db = getAdminFirestore();

  const [inv, ticketsSnap, tasksSnap] = await Promise.all([
    getInventorySnapshotAction(),
    db.collection("tickets").get(),
    db.collection("tasks").get(),
  ]);

  const reorder: ReorderItem[] = [];
  for (const { key, label } of inv.branches) {
    const branchInv = inv.inventory[key] ?? {};
    for (const product of inv.products) {
      const item = branchInv[product];
      if (!item) continue;
      if (item.qty <= item.min) {
        reorder.push({ branchKey: key, branchLabel: label, product, qty: item.qty, min: item.min });
      }
    }
  }

  const week = getWeekKey();
  let tasksDoneThisWeek = 0;
  tasksSnap.docs.forEach((doc) => {
    const t = doc.data() as LegacyTask;
    if (t.done?.[week]) tasksDoneThisWeek++;
  });

  let openTickets = 0;
  let progressTickets = 0;
  ticketsSnap.docs.forEach((doc) => {
    const t = doc.data() as LegacyTicket;
    if (t.status === "open") openTickets++;
    if (t.status === "progress") progressTickets++;
  });

  return {
    reorder,
    stats: {
      openTickets,
      progressTickets,
      lowStockCount: reorder.length,
      tasksDoneThisWeek,
      tasksTotal: tasksSnap.docs.length,
    },
  };
}
