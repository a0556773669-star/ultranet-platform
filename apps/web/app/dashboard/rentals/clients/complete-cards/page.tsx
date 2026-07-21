import { Lock } from "lucide-react";
import Link from "next/link";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { RentalClient, Branch } from "@ultranet/shared-types";
import { resolveNedarimCreds } from "@/lib/nedarim";
import { CompleteCardsQueue } from "./complete-cards-queue";

export default async function CompleteCardsPage() {
  const session = await requireModuleAccess("rentals");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;
  const isOwner = role === "owner";
  const viewClientBranchIds = (session.user as { viewClientBranchIds?: string[] } | undefined)?.viewClientBranchIds ?? [];

  const db = getAdminFirestore();
  const [clientsSnap, branchesSnap] = await Promise.all([
    db.collection("n_rental_clients").get(),
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
  ]);
  const branches = branchesSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch
  );
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  const allClients = clientsSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<RentalClient, "id">) }) as RentalClient
  );
  const scopedClients = isOwner
    ? allClients
    : allClients.filter((c) => c.branchId === myBranchId || viewClientBranchIds.includes(c.branchId));
  const missingCardClients = scopedClients.filter((c) => !c.cardLast4);

  const distinctBranchIds = Array.from(new Set(missingCardClients.map((c) => c.branchId)));
  const credsEntries = await Promise.all(
    distinctBranchIds.map(async (branchId) => [branchId, await resolveNedarimCreds(branchId)] as const)
  );
  const credsByBranchId = Object.fromEntries(
    credsEntries.filter((entry): entry is [string, { mosadId: string; apiValid: string; routeId: string }] => entry[1] !== null)
  );

  const queueItems = missingCardClients
    .filter((c) => credsByBranchId[c.branchId])
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      branchName: branchNameById.get(c.branchId) ?? "-",
      mosadId: credsByBranchId[c.branchId]!.mosadId,
      apiValid: credsByBranchId[c.branchId]!.apiValid,
    }));
  const skippedNoRoute = missingCardClients.length - queueItems.length;

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        השלמת כרטיסי אשראי
        <Lock className="h-5 w-5" />
      </h1>
      <p className="mb-4 text-sm text-muted">
        עוברים לקוח-לקוח על כל מי שאין לו כרטיס שמור. הקלד את מספר הכרטיס ישירות בחלון המאובטח של נדרים
        פלוס - הוא לא נשמר ולא עובר דרך שרת המערכת, רק הטוקן והתוקף נשמרים. אחרי שכל הלקוחות הושלמו אפשר
        למחוק לצמיתות כל קובץ שבו שמורים מספרי כרטיסים גולמיים.
      </p>
      {skippedNoRoute > 0 && (
        <div className="mb-4 rounded-card border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-700">
          {skippedNoRoute} לקוחות דולגו מהרשימה כי לסניף שלהם אין מסלול סליקה מוגדר של נדרים פלוס.
        </div>
      )}
      <CompleteCardsQueue items={queueItems} />
      <div className="mt-4">
        <Link href="/dashboard/rentals/clients" className="text-xs font-bold text-teal hover:underline">
          חזרה לרשימת הלקוחות
        </Link>
      </div>
    </div>
  );
}
