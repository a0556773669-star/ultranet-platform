import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { RentalClient, Branch } from "@ultranet/shared-types";
import { buildClientsExportWorkbook } from "@/lib/client-excel";

export async function GET() {
  try {
    return await handler();
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err), stack: (err as Error)?.stack }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handler() {
  const session = await requireModuleAccess("rentals");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;
  const isOwner = role === "owner";

  const db = getAdminFirestore();
  const [clientsSnap, branchesSnap] = await Promise.all([
    db.collection("n_rental_clients").get(),
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
  ]);
  const branches = branchesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }));
  const branchNameById = Object.fromEntries(branches.map((b) => [b.id, b.name]));
  const allClients = clientsSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<RentalClient, "id">) })
  ) as RentalClient[];
  const clients = isOwner ? allClients : allClients.filter((c) => c.branchId === myBranchId);

  const buffer = buildClientsExportWorkbook(clients, branchNameById, isOwner);
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="clients-export.xlsx"',
    },
  });
}
