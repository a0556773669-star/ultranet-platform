import { Scale, Calendar, Receipt } from "lucide-react";
import type { FixedExpense, VariableExpense } from "@ultranet/shared-types";
import {
  createFixedExpenseAction,
  endFixedExpenseAction,
  deleteFixedExpenseAction,
  createVariableExpenseAction,
  deleteVariableExpenseAction,
} from "./actions";
import { EditFixedExpenseModal, EditVariableExpenseModal } from "./edit-expense-modals";

const CATEGORIES = ["שכירות", "חשמל ומים", "משכורות", "ציוד ותחזוקה", "שיווק ופרסום", "ביטוח", "אחר"];

const FIELD = "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";
const BTN = "rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90";

function netToOwner(amount: number, paidBy?: string, owedBy?: string): number {
  const p = paidBy === "partner" ? "partner" : "owner";
  const o = owedBy === "partner" ? "partner" : owedBy === "shared" ? "shared" : "owner";
  if (o === "shared") return p === "owner" ? amount / 2 : -amount / 2;
  if (o === p) return 0;
  return p === "owner" ? amount : -amount;
}

function paymentNote(paidBy: string | undefined, owedBy: string | undefined, ownerName: string, partnerName: string) {
  const paidLabels: Record<string, string> = { owner: ownerName, partner: partnerName };
  const owedLabels: Record<string, string> = {
    owner: `על ${ownerName} (הכל)`,
    partner: `על ${partnerName} (הכל)`,
    shared: "משותף (חצי-חצי)",
  };
  const p = paidBy === "partner" ? "partner" : "owner";
  const o = owedBy === "partner" ? "partner" : owedBy === "shared" ? "shared" : "owner";
  return `שילם: ${paidLabels[p]} · חוב: ${owedLabels[o]}`;
}

function PayerFields({ ownerName, partnerName }: { ownerName: string; partnerName: string }) {
  return (
    <>
      <div>
        <label className={LABEL}>מי שילם בפועל</label>
        <select name="paidBy" defaultValue="owner" className={FIELD}>
          <option value="owner">{ownerName}</option>
          <option value="partner">{partnerName}</option>
        </select>
      </div>
      <div>
        <label className={LABEL}>על מי החוב</label>
        <select name="owedBy" defaultValue="owner" className={FIELD}>
          <option value="owner">על {ownerName} בלבד</option>
          <option value="partner">על {partnerName} בלבד</option>
          <option value="shared">משותף (חצי-חצי)</option>
        </select>
      </div>
    </>
  );
}

type Props = {
  branchId: string;
  isShared?: boolean;
  isPartner: boolean;
  ownerName: string;
  partnerName: string;
  canManage: boolean;
  canAdd: boolean;
  fixedExpenses: FixedExpense[];
  variableExpenses: VariableExpense[];
};

export function BranchExpenses({ branchId, isShared, isPartner, ownerName, partnerName, canManage, canAdd, fixedExpenses, variableExpenses }: Props) {
  const activeFixed = fixedExpenses.filter((e) => !e.endDate);
  const endedFixed = fixedExpenses.filter((e) => e.endDate);

  let net = 0;
  if (isPartner) {
    for (const e of activeFixed) net += netToOwner(e.amount || 0, e.paidBy, e.owedBy);
    for (const e of variableExpenses) net += netToOwner(e.amount || 0, e.paidBy, e.owedBy);
  }

  const createFixed = createFixedExpenseAction.bind(null, branchId);
  const createVariable = createVariableExpenseAction.bind(null, branchId);

  return (
    <div className="flex flex-col gap-4">
      {isShared && (
        <div className="rounded-card border border-card-border bg-[#f4f6f9] p-4 text-sm text-muted">
          הוצאות משותפות לכל סניפי ההשכרות - חלקו של הבעלים בהן מתחשבן בהנה&quot;ח הראשית כמו כל הוצאה אחרת.
        </div>
      )}

      {isPartner && (
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
            <Scale className="h-4 w-4" />
            מאזן חובות בין {ownerName} ל{partnerName} (סטטוס בלבד, לא קשור להנה&quot;ח המרכזית)
          </h3>
          <p className="mb-2 text-xs text-muted">
            זה רק מי-חייב-למי ביניכם. הוצאה ש{ownerName} שילם בפועל - חלקו בה (לפי &quot;על מי החוב&quot;)
            כן מתחשבן בהנה&quot;ח המרכזית כרגיל. הוצאה ש{partnerName} שילם בפועל לא מתחשבנת שם כלל, גם אם
            חלק/כל החוב על {ownerName} - היא רק מקטינה את מה ש{partnerName} יעביר בסוף החודש.
          </p>
          {net === 0 && <p className="text-sm text-muted">מאוזן — אין חובות הדדיים</p>}
          {net > 0 && <p className="text-sm font-bold text-teal">{partnerName} חייב ל{ownerName} ₪{net.toLocaleString()}</p>}
          {net < 0 && <p className="text-sm font-bold text-red-600">{ownerName} חייב ל{partnerName} ₪{Math.abs(net).toLocaleString()}</p>}
        </div>
      )}

      <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink">
          <Calendar className="h-4 w-4" />
          הוצאות קבועות / חודשיות
        </h3>
        {canAdd && (
<form action={createFixed} className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
          <div>
            <label className={LABEL}>שם ההוצאה</label>
            <input name="name" className={FIELD} required />
          </div>
          <div>
            <label className={LABEL}>סכום חודשי</label>
            <input name="amount" type="number" step="0.01" className={FIELD} required />
          </div>
          <div>
            <label className={LABEL}>תאריך התחלה</label>
            <input name="startDate" type="date" className={FIELD} required />
          </div>
          <div>
            <label className={LABEL}>קטגוריה</label>
            <select name="category" defaultValue="" className={FIELD}>
              <option value="">ללא קטגוריה</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {isPartner && <PayerFields ownerName={ownerName} partnerName={partnerName} />}
          <div className="col-span-2 md:col-span-3">
            <button type="submit" className={BTN}>+ הוסף הוצאה קבועה</button>
          </div>
        </form>
)}

        <div className="flex flex-col gap-2">
          {activeFixed.length === 0 && <p className="text-sm text-muted">אין הוצאות קבועות פעילות</p>}
          {activeFixed.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-card-border bg-[#f9fafb] p-3">
              <div>
                <p className="text-sm font-bold text-ink">{e.name} — ₪{(e.amount || 0).toLocaleString()}/חודש</p>
                <p className="text-xs text-muted">{e.category || "ללא קטגוריה"} · מתחיל {e.startDate}{isPartner ? ` · ${paymentNote(e.paidBy, e.owedBy, ownerName, partnerName)}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                {canManage && <EditFixedExpenseModal expense={e} branchId={branchId} isPartner={isPartner} ownerName={ownerName} partnerName={partnerName} />}
                {canManage && (
<form action={endFixedExpenseAction.bind(null, e.id, branchId)} className="flex items-center gap-1">
                  <input name="endDate" type="date" className="rounded-lg border border-card-border bg-white px-2 py-1 text-xs" />
                  <button type="submit" className="rounded-lg border border-card-border bg-white px-2 py-1 text-xs font-bold text-ink hover:bg-[#f4f6f9]">סיום</button>
                </form>
)}
                {canManage && (
<form action={deleteFixedExpenseAction.bind(null, e.id, branchId)}>
                  <button type="submit" className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50">מחיקה</button>
                </form>
)}
              </div>
            </div>
          ))}
        </div>

        {endedFixed.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-bold text-muted">הוצאות קבועות שהסתיימו ({endedFixed.length})</summary>
            <div className="mt-2 flex flex-col gap-2">
              {endedFixed.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-card-border bg-[#f4f6f9] p-3 opacity-70">
                  <div>
                    <p className="text-sm font-bold text-ink">{e.name} — ₪{(e.amount || 0).toLocaleString()}/חודש</p>
                    <p className="text-xs text-muted">{e.startDate} – {e.endDate}{isPartner ? ` · ${paymentNote(e.paidBy, e.owedBy, ownerName, partnerName)}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManage && <EditFixedExpenseModal expense={e} branchId={branchId} isPartner={isPartner} ownerName={ownerName} partnerName={partnerName} />}
                    {canManage && (
<form action={deleteFixedExpenseAction.bind(null, e.id, branchId)}>
                      <button type="submit" className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50">מחיקה</button>
                    </form>
)}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink">
          <Receipt className="h-4 w-4" />
          הוצאות חד פעמיות
        </h3>
        {canAdd && (
<form action={createVariable} className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
          <div>
            <label className={LABEL}>תיאור</label>
            <input name="desc" className={FIELD} required />
          </div>
          <div>
            <label className={LABEL}>סכום</label>
            <input name="amount" type="number" step="0.01" className={FIELD} required />
          </div>
          <div>
            <label className={LABEL}>תאריך</label>
            <input name="date" type="date" className={FIELD} required />
          </div>
          <div>
            <label className={LABEL}>קטגוריה</label>
            <select name="category" defaultValue="" className={FIELD}>
              <option value="">ללא קטגוריה</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {isPartner && <PayerFields ownerName={ownerName} partnerName={partnerName} />}
          <div className="col-span-2 md:col-span-3">
            <button type="submit" className={BTN}>+ הוסף הוצאה חד פעמית</button>
          </div>
        </form>
)}

        <div className="flex flex-col gap-2">
          {variableExpenses.length === 0 && <p className="text-sm text-muted">אין הוצאות חד פעמיות</p>}
          {variableExpenses.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-card-border bg-[#f9fafb] p-3">
              <div>
                <p className="text-sm font-bold text-ink">{e.desc} — ₪{(e.amount || 0).toLocaleString()}</p>
                <p className="text-xs text-muted">{e.category || "ללא קטגוריה"} · {e.date}{isPartner ? ` · ${paymentNote(e.paidBy, e.owedBy, ownerName, partnerName)}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                {canManage && <EditVariableExpenseModal expense={e} branchId={branchId} isPartner={isPartner} ownerName={ownerName} partnerName={partnerName} />}
                {canManage && (
<form action={deleteVariableExpenseAction.bind(null, e.id, branchId)}>
                  <button type="submit" className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50">מחיקה</button>
                </form>
)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
