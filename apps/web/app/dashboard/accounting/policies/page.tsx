import { Handshake } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getOwnerName } from "@/lib/owner-name";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { EXPENSE_POLICY_KEYS, EXPENSE_POLICY_LABEL, resolvedPolicy } from "@/lib/expense-policy";
import type { Branch } from "@ultranet/shared-types";
import { AccountingTabs } from "../accounting-tabs";
import { saveBranchPolicyAction } from "./actions";

const CARD = "rounded-card border border-card-border bg-white shadow-card";
const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted border-b border-card-border";
const TD = "px-2 py-1.5 border-b border-[#eef1f6] text-[12.5px]";

export default async function ExpensePoliciesPage() {
  const session = await requireOwner();
  const [ownerName, branchesSnap] = await Promise.all([
    getOwnerName(session.user?.name),
    getAdminFirestore().collection("n_branches").get(),
  ]);

  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted && !b.closedAt && b.branchType !== "coworking")
    .sort((a, b) => `${a.location ?? ""}${a.name}`.localeCompare(`${b.location ?? ""}${b.name}`, "he"));

  // How many branches put each category on the owner - the "same agreement everywhere?" answer.
  const onOwner = Object.fromEntries(
    EXPENSE_POLICY_KEYS.map((key) => [
      key,
      branches.filter((b) => resolvedPolicy(b)[key] === "owner").length,
    ]),
  ) as Record<(typeof EXPENSE_POLICY_KEYS)[number], number>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Handshake className="h-5 w-5" />
            מי משלם מה
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            ההסכמים של כל הסניפים בטבלה אחת — מדיניות התשלום שממנה נגזר כל פיצול
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/policies" />
      </div>

      <div className={`${CARD} mb-3.5 px-4 py-3 text-[12.5px] leading-relaxed text-muted`}>
        <b className="text-ink">מנהל הסניף מזין עובדות, לעולם לא תנאים.</b> כמה, על מה, מתי והקבלה —
        אלה עובדות, והוא היחיד שיודע אותן. מי נושא בעלות הוא תנאי, והוא נגזר מהטבלה הזו. עד עכשיו
        ההחלטה הזו נעשתה מחדש בכל שורת הוצאה, ולכן יצאה לא־עקבית ואי אפשר היה להשוות בין סניפים.
        <br />
        שינוי הסכם הוא <b className="text-ink">שדה אחד</b> כאן — לא תיקון של עשרות שורות אחורה. שורות
        שכבר נרשמו שומרות על החלוקה שנרשמו בה; המדיניות החדשה חלה על מה שיבוא.
      </div>

      <div className="mb-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {EXPENSE_POLICY_KEYS.map((key) => (
          <article key={key} className={`${CARD} px-3 py-2.5`}>
            <p className="text-[11px] font-extrabold text-muted">{EXPENSE_POLICY_LABEL[key]}</p>
            <p className="mt-px text-[13px] font-black text-ink">
              {onOwner[key]} <span className="text-[11px] font-bold text-muted">על {ownerName}</span>
            </p>
            <p className="text-[11px] font-bold text-[#1d4fb8]">
              {branches.length - onOwner[key]} על הסניף
            </p>
          </article>
        ))}
      </div>

      {branches.length === 0 ? (
        <p className={`${CARD} px-4 py-6 text-center text-sm text-muted`}>אין סניפים פעילים להצגה.</p>
      ) : (
        <section className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={`${TH} min-w-[150px]`}>סניף</th>
                  {EXPENSE_POLICY_KEYS.map((key) => (
                    <th key={key} className={TH}>
                      {EXPENSE_POLICY_LABEL[key]}
                    </th>
                  ))}
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => {
                  const policy = resolvedPolicy(branch);
                  const partnerLabel = branch.partnerName?.trim() || "הסניף";
                  return (
                    <tr key={branch.id} className="transition hover:bg-[#fafbfc]">
                      <td className={`${TD} font-bold text-ink`}>
                        {branch.name}
                        {branch.location && <span className="mr-1.5 text-[11px] text-muted">{branch.location}</span>}
                      </td>
                      {EXPENSE_POLICY_KEYS.map((key) => (
                        <td key={key} className={TD}>
                          <select
                            name={`policy_${key}`}
                            form={`policy-${branch.id}`}
                            defaultValue={policy[key]}
                            className="w-full rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1 text-[12px] font-bold text-ink focus:border-teal focus:bg-white focus:outline-none"
                          >
                            <option value="partner">{partnerLabel}</option>
                            <option value="owner">{ownerName}</option>
                          </select>
                        </td>
                      ))}
                      <td className={TD}>
                        <form id={`policy-${branch.id}`} action={saveBranchPolicyAction.bind(null, branch.id)}>
                          <button type="submit" className="whitespace-nowrap text-xs font-bold text-teal hover:underline">
                            שמירה
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
