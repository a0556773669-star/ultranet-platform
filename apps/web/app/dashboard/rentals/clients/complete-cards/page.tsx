import { Lock } from "lucide-react";
import Link from "next/link";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { RentalClient, Branch } from "@ultranet/shared-types";
import { listNedarimRoutes } from "@/lib/nedarim";
import { CompleteCardsQueue } from "./complete-cards-queue";

export default async function CompleteCardsPage() {
  const session = await requireModuleAccess("rentals");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;
  const isOwner = role === "owner";
  const viewClientBranchIds = (session.user as { viewClientBranchIds?: string[] } | undefined)?.viewClientBranchIds ?? [];

  const db = getAdminFirestore();
  // The route list joins the same wave - awaiting it separately made the page wait out two
  // round-trips back to back for queries that have nothing to do with each other.
  const [clientsSnap, branchesSnap, routes] = await Promise.all([
    db.collection("n_rental_clients").get(),
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
    listNedarimRoutes(),
  ]);
  const branches = branchesSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch
  );
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  const allClients = clientsSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<RentalClient, "id">), id: d.id }) as RentalClient
  );
  const scopedClients = isOwner
    ? allClients
    : allClients.filter((c) => c.branchId === myBranchId || viewClientBranchIds.includes(c.branchId));
  const missingCardClients = scopedClients.filter((c) => !c.cardLast4);

  // new cards always go to the route flagged as default (falls back to the first connected
  // route if none is flagged) - same rule the individual client page uses.
  const defaultRoute = routes.find((r) => r.defaultForNewCards) ?? routes[0] ?? null;

  const queueItems = defaultRoute
    ? missingCardClients.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        branchName: branchNameById.get(c.branchId) ?? "-",
        mosadId: defaultRoute.mosadId,
        apiValid: defaultRoute.apiValid,
        routeId: defaultRoute.id,
        routeName: defaultRoute.name,
      }))
    : [];
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
          {skippedNoRoute} לקוחות דולגו מהרשימה כי אין מסלול סליקה מחובר של נדרים פלוס במערכת - יש להגדיר
          אחד תחת הנהלת חשבונות ← מסלולי גביה.
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
