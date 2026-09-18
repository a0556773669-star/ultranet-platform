"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronRight, Layers, ListChecks, Plus, X } from "lucide-react";
import type { RecurringPurchaseType } from "@ultranet/shared-types";
import { SHARED_COMPUTERS_BRANCH_ID } from "@/lib/expense-shared-scope";
import { useToast } from "@/lib/toast";
import { CountsToMainField } from "@/components/counts-to-main-field";
import { ExpenseTypeField } from "@/components/recurring-purchases/expense-type-field";
import { createFixedExpenseAction, createVariableExpenseAction } from "./actions";

const CATEGORIES = ["שכירות", "חשמל ומים", "משכורות", "ציוד ותחזוקה", "שיווק ופרסום", "הדפסות ותקנונים", "ביטוח", "אחר"];

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

export interface AddExpenseBranch {
  id: string;
  name: string;
  /** סניף שותפות דורש את שאלת "מי שילם / על מי החוב" — סניף שכולו שלי לא */
  isMine: boolean;
  partnerName: string;
}

type Target = { kind: "branch"; branchId: string } | { kind: "all" } | { kind: "selected" };

/**
 * הוספת הוצאה ממסך אחד, בשני צעדים.
 *
 * עד היום כדי לרשום הוצאה היה צריך קודם לבחור סניף, להיכנס למסך שלו, ורק שם למצוא את
 * הטופס — ולהוצאה שחלה על כמה סניפים היה כפתור נפרד לגמרי ("הוצאות על כל הסניפים יחד"),
 * כלומר אותה פעולה בדיוק בשני מקומות שונים. כאן השאלה הראשונה היא *על מי ההוצאה* — סניף
 * מסוים, כל הסניפים, או רשימה — ואחריה אותו טופס הוצאות רגיל בשני הסוגים.
 *
 * "כל הסניפים" ו"סניפים נבחרים" נשמרים שניהם בספר המשותף (`shared-computers`) ונבדלים
 * ב-`branchIds` בלבד, בדיוק כפי ש-`SharedBranchScopeField` שמר אותם קודם — כך שהוצאה
 * שנרשמה כאן זהה לחלוטין להוצאה משותפת ותיקה.
 */
export function AddExpenseModal({
  branches,
  ownerName,
  sharedHasPartner,
  sharedPartnerName,
  expenseTypes = [],
}: {
  branches: AddExpenseBranch[];
  ownerName: string;
  sharedHasPartner: boolean;
  sharedPartnerName: string;
  expenseTypes?: RecurringPurchaseType[];
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [kind, setKind] = useState<"fixed" | "variable">("variable");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function close() {
    setOpen(false);
    setTarget(null);
    setSelected([]);
    setKind("variable");
  }

  function toggleBranch(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const chosenBranch = target?.kind === "branch" ? branches.find((b) => b.id === target.branchId) : undefined;
  const isPartner = chosenBranch ? !chosenBranch.isMine : target ? sharedHasPartner : false;
  const partnerName = chosenBranch ? chosenBranch.partnerName : sharedPartnerName;
  const targetLabel =
    target?.kind === "branch"
      ? (chosenBranch?.name ?? "סניף")
      : target?.kind === "all"
        ? "כל הסניפים"
        : `${selected.length} סניפים נבחרים`;

  /** צעד הטופס נפתח רק אחרי שיש יעד תקף — "סניפים נבחרים" בלי אף סניף אינו יעד. */
  const targetReady = Boolean(target) && (target?.kind !== "selected" || selected.length > 0);

  function handleSubmit(formData: FormData) {
    if (!target || !targetReady) return;
    const branchId = target.kind === "branch" ? target.branchId : SHARED_COMPUTERS_BRANCH_ID;
    if (target.kind !== "branch") {
      formData.set("branchScope", target.kind === "selected" ? "selected" : "all");
      if (target.kind === "selected") for (const id of selected) formData.append("branchIds", id);
    }
    startTransition(async () => {
      try {
        if (kind === "fixed") await createFixedExpenseAction(branchId, formData);
        else await createVariableExpenseAction(branchId, formData);
        router.refresh();
        close();
        showSuccess("ההוצאה נוספה בהצלחה");
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה בהוספת ההוצאה");
      }
    });
  }

  const optionCls = (on: boolean) =>
    `flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-right text-[13px] font-bold transition ${
      on ? "border-teal bg-teal-bg text-teal-dark" : "border-card-border bg-white text-ink hover:border-teal"
    }`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        הוספת הוצאה
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={close}>
          <div
            className="my-6 w-full max-w-lg rounded-card bg-white p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-base font-extrabold text-ink">
                <Plus className="h-4 w-4" />
                הוספת הוצאה
              </h2>
              <button type="button" onClick={close} className="text-muted transition hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* צעד 1: על מי ההוצאה */}
            <div className="rounded-card border border-card-border bg-[#f8fafc] p-3">
              <p className="mb-2 text-xs font-bold text-ink">על מי ההוצאה?</p>
              <div className="grid grid-cols-2 gap-1.5">
                {branches.map((b) => {
                  const on = target?.kind === "branch" && target.branchId === b.id;
                  return (
                    <button key={b.id} type="button" onClick={() => setTarget({ kind: "branch", branchId: b.id })} className={optionCls(on)}>
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      {b.name}
                    </button>
                  );
                })}
                <button type="button" onClick={() => setTarget({ kind: "all" })} className={optionCls(target?.kind === "all")}>
                  <Layers className="h-3.5 w-3.5 shrink-0" />
                  כל הסניפים
                </button>
                <button type="button" onClick={() => setTarget({ kind: "selected" })} className={optionCls(target?.kind === "selected")}>
                  <ListChecks className="h-3.5 w-3.5 shrink-0" />
                  סניפים נבחרים
                </button>
              </div>

              {target?.kind === "selected" && (
                <div className="mt-2.5 border-t border-card-border pt-2.5">
                  <p className="mb-1.5 text-[11.5px] font-semibold text-muted">באילו סניפים ההוצאה מתחלקת?</p>
                  <div className="flex flex-wrap gap-1.5">
                    {branches.length === 0 && <span className="text-[11px] text-muted">אין סניפים פעילים</span>}
                    {branches.map((b) => {
                      const on = selected.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => toggleBranch(b.id)}
                          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition ${
                            on ? "border-teal bg-teal text-white" : "border-card-border bg-white text-ink hover:border-teal"
                          }`}
                        >
                          {on && <Check className="h-3 w-3" />}
                          {b.name}
                        </button>
                      );
                    })}
                  </div>
                  {selected.length === 0 && (
                    <p className="mt-1.5 text-[11px] text-muted">בחרו לפחות סניף אחד כדי להמשיך.</p>
                  )}
                </div>
              )}

              {target?.kind === "all" && (
                <p className="mt-2 text-[11px] text-muted">
                  ההוצאה תתחלק בין כל סניפי חדרי המחשבים, כולל סניף שייפתח בעתיד.
                </p>
              )}
            </div>

            {/* צעד 2: פרטי ההוצאה */}
            {targetReady && (
              <div className="mt-3">
                <p className="mb-2 flex items-center gap-1 text-[11.5px] font-semibold text-muted">
                  <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                  ההוצאה תירשם על: <b className="text-ink">{targetLabel}</b>
                </p>

                <div className="mb-3 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setKind("fixed")}
                    className={kind === "fixed" ? "pill-active" : "pill-inactive"}
                  >
                    הוצאה קבועה / חודשית
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind("variable")}
                    className={kind === "variable" ? "pill-active" : "pill-inactive"}
                  >
                    הוצאה חד פעמית
                  </button>
                </div>

                <form key={kind} action={handleSubmit} className="grid grid-cols-2 gap-2">
                  {kind === "fixed" ? (
                    <>
                      <div className="col-span-2">
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
                    </>
                  ) : (
                    <>
                      <div className="col-span-2">
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
                    </>
                  )}

                  <div className={kind === "fixed" ? "col-span-2" : ""}>
                    <label className={LABEL}>קטגוריה</label>
                    <select name="category" defaultValue="" className={FIELD}>
                      <option value="">ללא קטגוריה</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {kind === "variable" && (
                    <div>
                      <ExpenseTypeField types={expenseTypes} idPrefix="add-expense-type" />
                    </div>
                  )}

                  {isPartner && (
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
                  )}

                  <div className="col-span-2">
                    <CountsToMainField />
                  </div>
                  <div className="col-span-2">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
                    >
                      {isPending ? "שומר..." : "שמירת ההוצאה"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
      {toastNode}
    </>
  );
}
