"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, Download, Upload } from "lucide-react";
import { isPendingAttribution, type MovementEntry } from "@/lib/accounting-entries";
import { deleteEntryAction, type SaveResult } from "./entry-actions";
import { EditEntryModal, type BranchGroups } from "./edit-entry-modal";

const money = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;
const rowKey = (e: MovementEntry) => `${e.kind}:${e.book}:${e.id}`;

/**
 * The movement list of one side of the books - income or expenses - split by what still needs a
 * decision from the owner.
 *
 * Rows waiting to be filed to a branch are shown open, because those are the ones with work left
 * on them. Rows already sitting in a branch's book are folded away behind a summary line: they
 * are done, and leaving them in the main list is exactly the endless column the owner was
 * scrolling past. Nothing is hidden outright - a row that vanished from the screen the moment it
 * was saved reads as a save that failed.
 */
export function EntryList({
  kind,
  entries,
  branches,
  heading,
  /** false = one flat list, for a screen where every row is already filed (a branch's own page) */
  splitPending = true,
}: {
  kind: "income" | "expense";
  entries: MovementEntry[];
  branches: BranchGroups;
  heading?: string;
  splitPending?: boolean;
}) {
  const router = useRouter();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<SaveResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showFiled, setShowFiled] = useState(false);
  const [, startTransition] = useTransition();

  const { pending, filed } = useMemo(() => {
    const live = entries.filter((e) => !removed.has(rowKey(e)));
    if (!splitPending) return { pending: live, filed: [] as MovementEntry[] };
    return {
      pending: live.filter(isPendingAttribution),
      filed: live.filter((e) => !isPendingAttribution(e)),
    };
  }, [entries, removed, splitPending]);

  function remove(entry: MovementEntry) {
    const label = `${entry.desc || (kind === "income" ? "הכנסה" : "הוצאה")} — ${money(entry.amount)}`;
    if (!window.confirm(`למחוק את "${label}"?\nהפעולה בלתי הפיכה.`)) return;
    setBusy(rowKey(entry));
    setResult(null);
    startTransition(async () => {
      const res = await deleteEntryAction(entry.kind, entry.book, entry.id);
      setBusy(null);
      setResult(res.ok ? { ok: true, message: `נמחק: ${label}` } : res);
      if (res.ok) {
        setRemoved((prev) => new Set(prev).add(rowKey(entry)));
        router.refresh();
      }
    });
  }

  function saved(res: SaveResult) {
    setResult(res);
    router.refresh();
  }

  const isIncome = kind === "income";
  const Icon = isIncome ? Download : Upload;
  const amountClass = isIncome ? "text-emerald-600" : "text-red-600";
  const pendingTotal = pending.reduce((s, e) => s + e.amount, 0);
  const filedTotal = filed.reduce((s, e) => s + e.amount, 0);

  const row = (e: MovementEntry) => (
    <div
      key={rowKey(e)}
      className="flex items-center gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold text-ink">{e.desc || (isIncome ? "הכנסה" : "הוצאה")}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          <span>{e.date}</span>
          {e.category && <span>· {e.category}</span>}
          {e.typeLabel && (
            <span className="rounded-full bg-[#f4f6f9] px-2 py-0.5 font-bold text-ink">{e.typeLabel}</span>
          )}
          {e.natureLabel && (
            <span className="rounded-full bg-[#eef7f4] px-2 py-0.5 font-bold text-teal-dark">{e.natureLabel}</span>
          )}
          {e.book === "tx" ? (
            <span className="rounded-full bg-[#e8effc] px-2 py-0.5 font-bold text-[#1d4fb8]">
              {e.branchName ?? "משותף"}
            </span>
          ) : e.book === "branch" ? (
            <span className="rounded-full bg-[#e8effc] px-2 py-0.5 font-bold text-[#1d4fb8]">
              {e.branchName}
            </span>
          ) : e.mirror ? (
            <span className="rounded-full bg-[#f3eefc] px-2 py-0.5 font-bold text-[#6b46c1]">
              חלק הבעלים בהוצאת סניף
            </span>
          ) : (
            <span className="rounded-full bg-teal-bg px-2 py-0.5 font-bold text-teal-dark">
              {e.branchName ? `${e.branchName} · ממתין לשיוך` : "לא משויך לסניף"}
            </span>
          )}
        </div>
      </div>
      <div className={`min-w-[80px] text-left font-extrabold tabular-nums ${amountClass}`}>
        {money(e.amount)}
      </div>
      <EditEntryModal entry={e} branches={branches} onSaved={saved} />
      <button
        type="button"
        onClick={() => remove(e)}
        disabled={busy === rowKey(e)}
        className="whitespace-nowrap rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11.5px] font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
      >
        {busy === rowKey(e) ? "מוחק..." : "מחיקה"}
      </button>
    </div>
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-muted">
        <span className="flex items-center gap-1.5">
          <Icon className="h-4 w-4" />
          {heading ?? `${isIncome ? "הכנסות" : "הוצאות"} — ממתין לשיוך`}
        </span>
        <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 normal-case text-ink">
          {pending.length} · {money(pendingTotal)}
        </span>
      </div>

      {result && (
        <p
          className={`mb-2 text-[13px] font-bold ${result.ok ? "text-emerald-600" : "text-red-600"}`}
          role="status"
        >
          {result.ok ? "✓ " : "✕ "}
          {result.message}
        </p>
      )}

      <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
        {pending.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {splitPending
              ? `אין ${isIncome ? "הכנסות" : "הוצאות"} שממתינות לשיוך — הכל משויך לסניפים`
              : `אין ${isIncome ? "הכנסות" : "הוצאות"} להצגה`}
          </p>
        ) : (
          pending.map(row)
        )}
      </div>

      {filed.length > 0 && (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setShowFiled((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-card border border-card-border bg-white px-4 py-2.5 text-[12.5px] font-bold text-ink shadow-card transition hover:bg-[#f9fafc]"
          >
            <span className="flex items-center gap-1.5">
              {showFiled ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              כבר משויך לסניפים ({filed.length})
            </span>
            <span className="tabular-nums text-muted">{money(filedTotal)}</span>
          </button>
          {showFiled && (
            <div className="mt-1.5 rounded-card border border-card-border bg-white px-4 shadow-card">
              {filed.map(row)}
            </div>
          )}
        </div>
      )}

      <p className="mt-2 text-[11.5px] text-muted">
        כל שורה ניתנת לעריכה ולמחיקה. עריכה מאפשרת גם להעביר את השורה לסניף אחר או להחזיר אותה
        להנה&quot;ח האישית — היא תמיד נשמרת במקום אחד בלבד{splitPending ? "" : ", ולכן העברה לסניף אחר מוציאה אותה מהסניף הזה"}.
      </p>
    </div>
  );
}
