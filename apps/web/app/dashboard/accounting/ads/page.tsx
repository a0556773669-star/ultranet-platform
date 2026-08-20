import { Megaphone } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getOwnerName } from "@/lib/owner-name";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { loadAdAreas } from "@/lib/ad-areas-data";
import { splitAdArea } from "@/lib/ad-areas";
import { branchPartnerLabel, branchHasPartner } from "@/lib/accounting-overview";
import type { Branch } from "@ultranet/shared-types";
import { AccountingTabs } from "../accounting-tabs";
import { AdAreaForm } from "./ad-area-form";
import { createAdAreaAction, updateAdAreaAction, deleteAdAreaAction } from "./actions";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

const CARD = "rounded-card border border-card-border bg-white shadow-card";
const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6]";

export default async function AdAreasPage({ searchParams }: { searchParams?: { edit?: string } }) {
  const session = await requireOwner();

  const [ownerName, areas, branchesSnap] = await Promise.all([
    getOwnerName(session.user?.name),
    loadAdAreas(),
    getAdminFirestore().collection("n_branches").get(),
  ]);

  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted && (b.branchType === "rentals" || b.branchType === "computers"))
    .sort((a, b) => `${a.location ?? ""}${a.name}`.localeCompare(`${b.location ?? ""}${b.name}`, "he"));
  const branchById = new Map(branches.map((b) => [b.id, b]));

  const editing = searchParams?.edit ? areas.find((a) => a.id === searchParams.edit) : undefined;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Megaphone className="h-5 w-5" />
            פרסום משותף
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            קמפיין פרסום אחד לעיר, מתחלק אוטומטית בין הסניפים שבה
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/ads" />
      </div>

      <div className="mb-3 rounded-card border border-card-border bg-white px-4 py-3 text-[12.5px] leading-relaxed text-muted shadow-card">
        <b className="text-ink">איך זה עובד:</b> מזינים את עלות הפרסום החודשית של האזור ואת מספר הסניפים שבו.{" "}
        {ownerName} נושא באחוז שנקבע (ברירת מחדל 50%), והיתרה מתחלקת שווה בשווה בין הסניפים. לדוגמה — קרית ספר,
        1,200 ₪ לחודש, 3 סניפים: {ownerName} משלם 600 ₪ וכל סניף משלם 200 ₪. השורה נכנסת אוטומטית לפירוט
        ההוצאות של כל סניף במקום שורת &quot;פרסום&quot; הקבועה של התעריפון.
      </div>

      <section className={`${CARD} mb-3.5 overflow-hidden`}>
        <div className="border-b border-card-border px-4 py-3">
          <h2 className="text-[15px] font-extrabold text-ink">
            {editing ? `עריכת אזור — ${editing.name}` : "הוספת אזור פרסום"}
          </h2>
        </div>
        <div className="p-3">
          {editing ? (
            <AdAreaForm
              key={editing.id}
              area={editing}
              branches={branches}
              ownerName={ownerName}
              action={updateAdAreaAction.bind(null, editing.id)}
              submitLabel="שמירת השינויים"
              onCancelHref="/dashboard/accounting/ads"
            />
          ) : (
            <AdAreaForm
              branches={branches}
              ownerName={ownerName}
              action={createAdAreaAction}
              submitLabel="הוספת אזור"
            />
          )}
        </div>
      </section>

      {areas.length === 0 ? (
        <p className={`${CARD} px-4 py-6 text-center text-sm text-muted`}>
          עדיין לא הוגדרו אזורי פרסום. כל עוד אין אזור, הפרסום נלקח משורת התעריפון הרגילה לכל סניף בנפרד.
        </p>
      ) : (
        <div className="flex flex-col gap-3.5">
          {areas.map((area) => {
            const split = splitAdArea(area);
            const unlisted = split.branchCount - area.branchIds.length;
            return (
              <section key={area.id} className={CARD}>
                <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-card-border px-4 py-3">
                  <div>
                    <h2 className="text-[15px] font-extrabold text-ink">{area.name}</h2>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {money(split.monthlyCost)} לחודש · {split.branchCount} סניפים · {split.ownerPct}% על{" "}
                      {ownerName}
                      {area.startMonth || area.endMonth
                        ? ` · ${area.startMonth ?? "מההתחלה"} — ${area.endMonth ?? "ללא סיום"}`
                        : ""}
                      {area.note ? ` · ${area.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={`/dashboard/accounting/ads?edit=${area.id}`}
                      className="text-xs font-bold text-teal hover:underline"
                    >
                      עריכה
                    </a>
                    <form action={deleteAdAreaAction.bind(null, area.id)}>
                      <button type="submit" className="text-xs font-bold text-red-600 hover:underline">
                        מחיקה
                      </button>
                    </form>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 border-b border-card-border bg-[#f4f6f9] px-4 py-3 sm:grid-cols-3">
                  <div className="flex flex-col">
                    <span className="text-[10.5px] font-extrabold text-muted">סה&quot;כ הקמפיין לחודש</span>
                    <span className="text-[19px] font-black tabular-nums text-ink">{money(split.monthlyCost)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10.5px] font-extrabold text-muted">
                      {ownerName} משלם ({split.ownerPct}%)
                    </span>
                    <span className="text-[19px] font-black tabular-nums text-teal-dark">
                      {money(split.ownerTotal)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10.5px] font-extrabold text-muted">
                      כל סניף משלם ({money(split.branchesTotal)} ÷ {split.branchCount})
                    </span>
                    <span className="text-[19px] font-black tabular-nums text-[#2563eb]">
                      {money(split.perBranch)}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[12.5px]">
                    <thead>
                      <tr>
                        <th className={`${TH} min-w-[160px]`}>סניף</th>
                        <th className={TH}>שותף</th>
                        <th className={`${TH} text-left`}>שורת הפרסום בספר הסניף</th>
                        <th className={`${TH} text-left`}>מתוכה על {ownerName}</th>
                        <th className={`${TH} text-left`}>מתוכה על הסניף</th>
                      </tr>
                    </thead>
                    <tbody>
                      {area.branchIds.map((id, i) => {
                        const b = branchById.get(id);
                        return (
                          <tr key={id} className={i % 2 ? "bg-[#fafbfd]" : ""}>
                            <td className={TD}>
                              <b className="text-ink">
                                {b ? `${b.location ? `${b.location} — ` : ""}${b.name}` : "סניף שנמחק"}
                              </b>
                            </td>
                            <td className={`${TD} text-muted`}>
                              {b && branchHasPartner(b) ? branchPartnerLabel(b) : "100% שלי"}
                            </td>
                            <td className={`${TD} text-left font-extrabold tabular-nums`}>
                              {money(split.perBranchLineTotal)}
                            </td>
                            <td className={`${TD} text-left tabular-nums text-teal-dark`}>
                              {b && !branchHasPartner(b)
                                ? money(split.perBranchLineTotal)
                                : money(split.perBranchOwnerShare)}
                            </td>
                            <td className={`${TD} text-left tabular-nums text-[#2563eb]`}>
                              {b && !branchHasPartner(b) ? money(0) : money(split.perBranch)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="px-4 py-2.5 text-[11.5px] leading-relaxed text-muted">
                  שורת הפרסום בספר הסניף היא חלקו של הסניף בקמפיין ({money(split.monthlyCost)} ÷{" "}
                  {split.branchCount} = {money(split.perBranchLineTotal)}), ומתוכה {ownerName} נושא ב-
                  {money(split.perBranchOwnerShare)} והסניף ב-{money(split.perBranch)}. בסניף שכולו שלי אין שותף
                  להתחלק איתו, ולכן כל השורה נופלת על {ownerName}.
                  {unlisted > 0 && (
                    <>
                      {" "}
                      <b className="text-[#a15c1b]">
                        {unlisted} מתוך {split.branchCount} הסניפים באזור לא מסומנים כאן
                      </b>{" "}
                      — חלקם ({money(split.perBranch * unlisted)} לחודש) לא נרשם לאף סניף במערכת.
                    </>
                  )}
                </p>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
