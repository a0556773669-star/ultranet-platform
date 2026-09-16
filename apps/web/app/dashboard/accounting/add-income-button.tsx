"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, CreditCard, Banknote, Laptop, PackageOpen, TrendingUp } from "lucide-react";
import { useToast } from "@/lib/toast";
import { Modal } from "./modal";
import { createIncomeAction } from "./actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

export type BranchOption = { id: string; name: string };

type IncomeType = "credit" | "cash" | "laptops" | "sale";

const TYPES: { key: IncomeType; label: string; icon: typeof CreditCard; hint: string }[] = [
  { key: "credit", label: "אשראי", icon: CreditCard, hint: "סליקת האשראי של העסק — תאריך וסכום, זה הכל." },
  { key: "cash", label: "מזומן", icon: Banknote, hint: "מזומן שנמשך מקופה של חדר מחשבים — בחר מאיזו קופה." },
  { key: "laptops", label: "ניידים", icon: Laptop, hint: "כסף שהתקבל מסניף ניידים — בחר סניף וסמן אם כבר יצא מסמך." },
  { key: "sale", label: "מכירת מחשבים", icon: PackageOpen, hint: "מכירת ציוד — אפשר לרשום למי נמכר." },
];

/**
 * הוספת הכנסה לספר הראשי — כפתור אחד, וחלון שנפתח ממנו.
 *
 * סוג ההכנסה נבחר ראשון ולא אחרון, כי הוא זה שקובע מה עוד הטופס שואל: מזומן פותח את
 * רשימת הקופות של חדרי המחשבים, ניידים פותח את רשימת סניפי הניידים ואת שאלת הקבלה,
 * מכירה פותחת "למי מכרתי", ואשראי לא פותח כלום. טופס אחד עם כל השדות תמיד גלויים היה
 * מבקש מהמשתמש להתעלם מרובם בכל פעם - וזו בדיוק הדרך שבה נרשמות שורות עם סניף שגוי.
 */
export function AddIncomeButton({
  computerBranches,
  rentalsBranches,
  defaultDate,
}: {
  computerBranches: BranchOption[];
  rentalsBranches: BranchOption[];
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<IncomeType>("credit");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  const active = TYPES.find((t) => t.key === type)!;
  const branches = type === "cash" ? computerBranches : rentalsBranches;

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await createIncomeAction(formData);
        router.refresh();
        setOpen(false);
        showSuccess("ההכנסה נוספה לספר הראשי");
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה בשמירה");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12.5px] font-bold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100"
      >
        <Plus className="h-3.5 w-3.5" />
        הוספת הכנסה
      </button>

      {open && (
        <Modal title="הוספת הכנסה" icon={TrendingUp} onClose={() => setOpen(false)}>
          <form action={handleSubmit} className="flex flex-col gap-3">
            <input type="hidden" name="type" value={type} />
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map((t) => {
                const on = t.key === type;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setType(t.key)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      on ? "border-teal bg-teal text-white" : "border-card-border bg-white text-ink hover:bg-[#f1f5f9]"
                    }`}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11.5px] leading-relaxed text-muted">{active.hint}</p>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className={LABEL}>תאריך</label>
                <input type="date" name="date" defaultValue={defaultDate} required className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>סכום</label>
                <input type="number" name="amount" min={0} step="0.01" required className={FIELD} autoFocus />
              </div>

              {(type === "cash" || type === "laptops") && (
                <div className="sm:col-span-2">
                  <label className={LABEL}>
                    {type === "cash" ? "מאיזו קופה (סניף חדר מחשבים)" : "מאיזה סניף ניידים"}
                  </label>
                  <select name="branchId" required defaultValue="" className={FIELD}>
                    <option value="" disabled>
                      {branches.length === 0 ? "אין סניפים זמינים" : "בחר סניף"}
                    </option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {type === "sale" && (
                <div className="sm:col-span-2">
                  <label className={LABEL}>למי מכרתי</label>
                  <input name="soldTo" placeholder="שם הקונה" className={FIELD} />
                </div>
              )}

              <div className="sm:col-span-2">
                <label className={LABEL}>תיאור (לא חובה)</label>
                <input name="desc" className={FIELD} />
              </div>

              {type === "laptops" && (
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-card-border bg-[#f8fafc] px-3 py-2 sm:col-span-2">
                  <input type="checkbox" name="receiptIssued" className="mt-0.5 h-4 w-4 shrink-0 accent-teal" />
                  <span>
                    <span className="block text-xs font-bold text-ink">כבר יצא מסמך</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                      סימון בלבד — לא מפיק כלום. זו האפשרות הנכונה לתשלום שנסלק דרך נדרים פלוס, שכבר
                      הפיק עליו חשבונית מס קבלה. לתשלום שלא עבר דרכו אפשר להפיק מסמך מטבלת ההכנסות,
                      בלחיצה מפורשת.
                    </span>
                  </span>
                </label>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? "שומר..." : "הוספת הכנסה"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-muted transition hover:bg-[#f4f6f9]"
              >
                ביטול
              </button>
            </div>
          </form>
        </Modal>
      )}
      {toastNode}
    </>
  );
}
