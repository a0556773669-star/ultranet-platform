import { Tag } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import { BranchPricingClient, type BranchOption } from "./pricing-client";

export default async function BranchPricingPage() {
  const session = await requireModuleAccess("rentals");
  const isOwner = session.user?.role === "owner";
  const myBranchId = session.user?.branchId;

  const db = getAdminFirestore();
  const branchesSnap = await db.collection("n_branches").where("branchType", "==", "rentals").get();
  const all = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true }));
  const visible = isOwner ? all : all.filter((b) => b.id === myBranchId);

  const branches: BranchOption[] = visible.map((b) => ({
    id: b.id,
    name: b.name,
    pricing: b.rentalPricing,
  }));

  return (
    <div>
      <div className="mb-4">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <Tag className="h-4 w-4" />
          מחירון הסניף
        </h1>
        <p className="text-sm text-muted">
          מגדירים כאן פעם אחת את המחירים של הסניף, וכל מחשב וסטיק בסניף מתומחר לפיהם אוטומטית.
          אפשר לחרוג מהמחירון למחשב מסוים דרך עמוד המחשב — כל שדה שנשאר ריק שם יורש את המחיר מכאן.
        </p>
      </div>

      <div className="mb-4 rounded-card border border-card-border bg-white p-4 text-[13px] text-muted shadow-card">
        <p className="mb-1 font-bold text-ink">איך המערכת מחשבת מהמחירון הזה</p>
        <ul className="list-inside list-disc space-y-0.5">
          <li>חודש = חודש קלנדרי (12/07 עד 12/08 = חודש אחד), ואחריו נספרים הימים הנוספים.</li>
          <li>שישי ושבת נספרים יחד כיום חיוב אחד; שבוע = 6 ימי חיוב.</li>
          <li>תמיד נבחר החישוב הזול ביותר ללקוח — אף פעם לא יותר ממחיר המדרגה הבאה.</li>
          <li>כל סכום מעוגל לשקל שלם, בלי אגורות.</li>
        </ul>
      </div>

      <BranchPricingClient branches={branches} />
    </div>
  );
}
