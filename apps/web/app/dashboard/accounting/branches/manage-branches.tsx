"use client";

import { useState, useTransition } from "react";
import {
  createBranchAction,
  deleteBranchAction,
  restoreBranchAction,
  type BranchActionResult,
} from "./actions";

const FIELD =
  "w-full min-w-0 rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-2 text-[12.5px] font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-[11px] font-bold text-muted";
const CARD = "rounded-card border border-card-border bg-white shadow-card";
const money = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;

export interface ManagedBranch {
  id: string;
  name: string;
  branchType: string;
  partnerName: string | null;
  partnerPct: number;
  openedAt: string | null;
  deleted: boolean;
  income: number;
  expense: number;
}

const TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  rentals: { label: "השכרות ניידים", cls: "bg-[#e8effc] text-[#1d4fb8]" },
  computers: { label: "חדר מחשבים", cls: "bg-[#f1ecfa] text-[#6b3fa0]" },
  coworking: { label: "משרד שיתופי", cls: "bg-[#fdf1e7] text-[#a15c1b]" },
};

/**
 * Adding, deleting and restoring branches of every type in one place.
 *
 * Deleting is a soft delete on purpose: the branch leaves every active screen but its recorded
 * income and expenses stay, so a past month's report does not change retroactively because a
 * partner left today. Confirming requires typing the branch name, so no branch is lost to a
 * single misplaced click.
 */
export function ManageBranches({ branches, ownerName }: { branches: ManagedBranch[]; ownerName: string }) {
  const [result, setResult] = useState<BranchActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<ManagedBranch | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const live = branches.filter((b) => !b.deleted);
  const gone = branches.filter((b) => b.deleted);

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    setResult(null);
    startTransition(async () => {
      const res = await createBranchAction(fd);
      setResult(res);
      if (res.ok) form.reset();
    });
  }

  function confirmDelete() {
    if (!confirming) return;
    const branch = confirming;
    setBusy(branch.id);
    startTransition(async () => {
      const res = await deleteBranchAction(branch.id, typed);
      setBusy(null);
      setResult(res);
      if (res.ok) {
        setConfirming(null);
        setTyped("");
      }
    });
  }

  function restore(b: ManagedBranch) {
    setBusy(b.id);
    startTransition(async () => {
      const res = await restoreBranchAction(b.id);
      setBusy(null);
      setResult(res);
    });
  }

  const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted whitespace-nowrap border-b border-card-border";
  const TD = "px-2.5 py-2 border-b border-[#eef1f6] align-middle";

  const row = (b: ManagedBranch, i: number) => {
    const t = TYPE_LABEL[b.branchType] ?? { label: b.branchType, cls: "bg-[#f4f6f9] text-muted" };
    return (
      <tr key={b.id} className={`${i % 2 ? "bg-[#fafbfd]" : ""} ${b.deleted ? "text-[#9aa6b5]" : ""}`}>
        <td className={TD}>
          <b className={b.deleted ? "font-bold text-[#9aa6b5]" : "text-ink"}>{b.name}</b>
          {b.deleted && (
            <span className="mr-1.5 rounded-full bg-[#eef1f6] px-2 py-0.5 text-[10.5px] font-extrabold text-[#7b8794]">
              נמחק
            </span>
          )}
        </td>
        <td className={TD}>
          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${t.cls}`}>{t.label}</span>
        </td>
        <td className={TD}>
          {b.partnerName ? (
            <>
              {b.partnerName}{" "}
              <span className="rounded-full bg-[#fdf3e3] px-2 py-0.5 text-[10.5px] font-extrabold text-[#b45309]">
                {b.partnerPct}%
              </span>
            </>
          ) : (
            <span className="rounded-full bg-teal-bg px-2 py-0.5 text-[10.5px] font-extrabold text-teal-dark">
              100% {ownerName}
            </span>
          )}
        </td>
        <td className={TD}>
          {b.openedAt || (
            <span className="rounded-full bg-[#fdf3e3] px-2 py-0.5 text-[10.5px] font-extrabold text-[#b45309]">
              אין תאריך
            </span>
          )}
        </td>
        <td className={`${TD} text-left tabular-nums`}>{b.deleted ? "—" : money(b.income)}</td>
        <td className={`${TD} text-left tabular-nums`}>{b.deleted ? "—" : money(b.expense)}</td>
        <td className={`${TD} whitespace-nowrap`}>
          {b.deleted ? (
            <button
              type="button"
              onClick={() => restore(b)}
              disabled={busy === b.id}
              className="rounded-lg border border-card-border bg-white px-2.5 py-1 text-[11.5px] font-bold text-ink transition hover:border-teal hover:text-teal disabled:opacity-50"
            >
              {busy === b.id ? "משחזר..." : "שחזור"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConfirming(b);
                setTyped("");
                setResult(null);
              }}
              className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11.5px] font-bold text-red-600 transition hover:bg-red-50"
            >
              מחיקה
            </button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col gap-3.5">
      {result && (
        <p className={`text-[13px] font-bold ${result.ok ? "text-emerald-600" : "text-red-600"}`} role="status">
          {result.ok ? "✓ " : "✕ "}
          {result.message}
        </p>
      )}

      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-card-border px-4 py-3">
          <div>
            <h2 className="text-[15px] font-extrabold text-ink">הוספת סניף חדש</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">הסניף נוצר מיד ומופיע ברשימה למטה</p>
          </div>
        </div>
        <form onSubmit={add} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={LABEL}>שם הסניף</label>
            <input name="name" placeholder="למשל: ביתר עילית" className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>סוג</label>
            <select name="branchType" defaultValue="rentals" className={FIELD}>
              <option value="rentals">השכרות ניידים</option>
              <option value="computers">חדר מחשבים</option>
              <option value="coworking">משרד שיתופי</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>תאריך פתיחה</label>
            <input type="date" name="openedAt" className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>שם השותף (ריק = 100% שלי)</label>
            <input name="partnerName" placeholder="שם השותף" className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>אחוז השותף</label>
            <input type="number" name="partnerPct" min={0} max={100} defaultValue={50} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>מייל השותף (לא חובה)</label>
            <input name="partnerEmail" type="email" placeholder="לכניסה למערכת" className={FIELD} />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={pending}
              className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2.5 text-[14px] font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "מוסיף..." : "הוספת סניף"}
            </button>
            <span className="text-[11.5px] text-muted">
              אפשר לשנות כל פרט אחר כך. תאריך הפתיחה קובע מאיזה חודש הסניף נכנס לחישוב.
            </span>
          </div>
        </form>
      </section>

      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-card-border px-4 py-3">
          <div>
            <h2 className="text-[15px] font-extrabold text-ink">הסניפים הפעילים ({live.length})</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">הכנסות והוצאות של החודש הנוכחי</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className={TH}>סניף</th>
                <th className={TH}>סוג</th>
                <th className={TH}>שותף</th>
                <th className={TH}>תאריך פתיחה</th>
                <th className={`${TH} text-left`}>הכנסות החודש</th>
                <th className={`${TH} text-left`}>הוצאות החודש</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {live.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted">
                    אין סניפים פעילים
                  </td>
                </tr>
              ) : (
                live.map(row)
              )}
            </tbody>
          </table>
        </div>
      </section>

      {gone.length > 0 && (
        <section className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-card-border px-4 py-3">
            <div>
              <h2 className="text-[15px] font-extrabold text-ink">סניפים שנמחקו ({gone.length})</h2>
              <p className="mt-0.5 text-[12.5px] text-muted">ההיסטוריה שלהם נשמרה — אפשר לשחזר בכל רגע</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <th className={TH}>סניף</th>
                  <th className={TH}>סוג</th>
                  <th className={TH}>שותף</th>
                  <th className={TH}>תאריך פתיחה</th>
                  <th className={`${TH} text-left`}>הכנסות</th>
                  <th className={`${TH} text-left`}>הוצאות</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>{gone.map(row)}</tbody>
            </table>
          </div>
        </section>
      )}

      <div className={`${CARD} px-4 py-3.5 text-[12.5px] leading-relaxed text-muted`}>
        <p className="mb-2 rounded-[10px] border border-[#f0dcb8] bg-[#fdf3e3] px-3 py-2.5 text-[#7a4a12]">
          <b className="text-[#5c3608]">מחיקה לא מוחקת את ההיסטוריה.</b> הסניף יורד מכל המסכים
          הפעילים ולא ייכלל בחישוב ההעברות, אבל ההכנסות וההוצאות שכבר נרשמו לו נשארים במערכת — כך
          שדוח של חודש שעבר לא משתנה למפרע רק בגלל ששותף עזב היום.
        </p>
        <p>
          <b className="text-ink">כדי למחוק צריך להקליד את שם הסניף</b>, וסניף שנמחק ניתן לשחזור מלא
          מהטבלה למעלה.
        </p>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(26,35,50,0.45)] p-5">
          <div className="w-full max-w-[520px] rounded-card bg-white shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
            <div className="border-b border-card-border px-4 py-3.5 text-[15px] font-black text-ink">
              מחיקת הסניף &quot;{confirming.name}&quot;
            </div>
            <div className="px-4 py-3.5 text-[13px] leading-relaxed text-muted">
              <p className="mb-2">הסניף ירד מכל המסכים הפעילים ולא ייכלל יותר בשום חישוב.</p>
              <p className="mb-2">
                <b className="text-ink">מה שנשאר במערכת:</b> {money(confirming.income)} הכנסות ו-
                {money(confirming.expense)} הוצאות שכבר נרשמו לו
                {confirming.partnerName ? `, וההתחשבנות מול ${confirming.partnerName}` : ""}. דוחות של
                חודשים קודמים לא ישתנו.
              </p>
              {confirming.partnerName && (
                <p className="mb-2">
                  <b className="text-ink">שים לב:</b> ל{confirming.partnerName} תיחסם הגישה לסניף.
                </p>
              )}
              <label className={LABEL}>
                כדי לאשר, הקלידי את שם הסניף: <b className="text-ink">{confirming.name}</b>
              </label>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={confirming.name}
                className={FIELD}
                autoFocus
              />
            </div>
            <div className="flex flex-wrap gap-2 border-t border-card-border bg-[#f4f6f9] px-4 py-3">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={typed.trim() !== confirming.name || busy === confirming.id}
                className="rounded-lg border border-red-200 bg-white px-3.5 py-2 text-[12.5px] font-extrabold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy === confirming.id ? "מוחק..." : "מחיקת הסניף"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(null);
                  setTyped("");
                }}
                className="rounded-lg border border-card-border bg-white px-3.5 py-2 text-[12.5px] font-extrabold text-ink transition hover:border-teal hover:text-teal"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
