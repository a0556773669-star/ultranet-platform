import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { CollectionRoute, Branch } from "@ultranet/shared-types";
import { createCollectionRouteAction, deleteCollectionRouteAction } from "../actions";
import { AccountingTabs } from "../accounting-tabs";
import { DeleteRouteButton } from "./delete-route-button";
import { RouteForm } from "./route-form";

const PROVIDER_LABELS: Record<string, string> = {
  manual: "ידני",
  nedarim_plus: "Nedarim Plus",
  tranzila: "Tranzila",
  cardcom: "Cardcom",
};

const TH = "px-2.5 py-1.5 text-right text-[11px] font-bold uppercase tracking-wide";
const TD = "px-2.5 py-1.5 whitespace-nowrap";

/**
 * האם המסלול הזה באמת יכול להפיק קבלה.
 *
 * "ספק קבלות = ezcount" לבדו לא מספיק - בלי המפתח וה-developer email הקריאה ל-EZcount
 * תיכשל רק ברגע שינסו להפיק קבלה אמיתית. לכן הסטטוס נבדק כאן ומוצג בטבלה: תקלת הגדרה
 * צריכה להיראות במסך ההגדרות, לא בפעם הראשונה שמישהו לוחץ "הפק ושלח".
 */
function receiptStatus(r: CollectionRoute): { label: string; ok: boolean } {
  if (r.receiptsProvider !== "ezcount") return { label: "—", ok: false };
  if (!r.receiptsApiKey || !r.receiptsCompanyId) return { label: "חסרים פרטים", ok: false };
  return { label: "EZcount", ok: true };
}

export default async function CollectionRoutesPage() {
  const session = await requireModuleAccess("accounting");
  const isOwner = session.user?.role === "owner";

  const db = getAdminFirestore();
  const [routesSnap, branchesSnap] = await Promise.all([
    db.collection("n_collection_routes").get(),
    db.collection("n_branches").get(),
  ]);
  const routes = routesSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<CollectionRoute, "id">), id: d.id }) as CollectionRoute,
  );
  const branches = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);
  const branchName = (id: string | null) =>
    id ? (branches.find((b) => b.id === id)?.name ?? "-") : "כל הסניפים";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <CreditCard className="h-5 w-5" />
          מסלולי גביה
        </h1>
        <AccountingTabs active="/dashboard/accounting/routes" />
      </div>

      {/* הטופס מקופל כברירת מחדל: מוסיפים מסלול גבייה פעם בשנה, ומסתכלים על הרשימה כל פעם
          שמשהו לא עובד. טופס פתוח תמיד דחף את הרשימה - הדבר היחיד שבאמת קוראים כאן - אל
          מתחת לקפל. */}
      {isOwner && (
        <details className="mb-3 rounded-card border border-card-border bg-white shadow-card">
          <summary className="cursor-pointer px-4 py-2.5 text-[13px] font-bold text-ink">
            + הוספת מסלול גבייה
          </summary>
          <div className="border-t border-card-border p-4">
            <RouteForm action={createCollectionRouteAction} submitLabel="הוספת מסלול" />
          </div>
        </details>
      )}

      <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="bg-[#f4f6f9] text-muted">
              <tr>
                <th className={TH}>שם</th>
                <th className={TH}>ספק</th>
                <th className={TH}>היקף</th>
                <th className={TH}>הפקדה</th>
                <th className={TH}>קבלות</th>
                <th className={TH}>כרטיסים חדשים</th>
                <th className="px-2.5 py-1.5"></th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {routes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2.5 py-6 text-center text-sm text-muted">
                    אין מסלולי גבייה מוגדרים
                  </td>
                </tr>
              )}
              {routes.map((r, idx) => {
                const bound = deleteCollectionRouteAction.bind(null, r.id);
                const receipts = receiptStatus(r);
                return (
                  <tr
                    key={r.id}
                    className={`border-t border-card-border transition hover:bg-[#f8fafc] ${
                      idx % 2 === 1 ? "bg-[#fafbfc]" : ""
                    }`}
                  >
                    <td className={`${TD} font-semibold text-ink`}>{r.name}</td>
                    <td className={`${TD} text-muted`}>{PROVIDER_LABELS[r.provider] ?? r.provider}</td>
                    <td className={`${TD} text-muted`}>{branchName(r.branchScope)}</td>
                    <td className={`${TD} text-muted`}>{r.depositsTo === "owner" ? "בעלים" : "סניף"}</td>
                    <td className={TD}>
                      {receipts.label === "—" ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span
                          className={
                            receipts.ok
                              ? "rounded-full bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark"
                              : "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800"
                          }
                        >
                          {receipts.label}
                        </span>
                      )}
                    </td>
                    <td className={TD}>
                      {r.defaultForNewCards && (
                        <span className="rounded-full bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">
                          ברירת מחדל
                        </span>
                      )}
                    </td>
                    <td className={TD}>
                      {isOwner && (
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/dashboard/accounting/routes/${r.id}`}
                            className="text-xs font-bold text-teal hover:underline"
                          >
                            עריכה
                          </Link>
                          <form action={bound}>
                            <DeleteRouteButton />
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-2 px-1 text-[11.5px] leading-relaxed text-muted">
        עמודת <b>קבלות</b> אומרת אם אפשר להפיק קבלה דרך המסלול הזה. כדי שתדלק: ספק קבלות
        <b> ezcount</b>, שדה <b>מפתח API לקבלות</b> = ה-API key מ-EZcount, ושדה{" "}
        <b>מזהה חברה לקבלות</b> = כתובת ה-<span dir="ltr">developer email</span> של החשבון שם
        (EZcount שולח אותה בשם <span dir="ltr">developer_email</span>). מסלול המשוייך לסניף גובר
        על מסלול כלל-עסקי.
      </p>
    </div>
  );
}
