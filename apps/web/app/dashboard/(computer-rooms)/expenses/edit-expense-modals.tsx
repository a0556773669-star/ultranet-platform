"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import type { FixedExpense, VariableExpense } from "@ultranet/shared-types";
import { updateFixedExpenseAction, updateVariableExpenseAction } from "./actions";
import { useToast } from "@/lib/toast";

const CATEGORIES = ["שכירות", "חשמל ומים", "משכורות", "ציוד ותחזוקה", "שיווק ופרסום", "ביטוח", "אחר"];

const FIELD = "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

function PayerFields({
  paidBy,
  owedBy,
  ownerName,
  partnerName,
}: {
  paidBy?: string;
  owedBy?: string;
  ownerName: string;
  partnerName: string;
}) {
  return (
    <>
      <div>
        <label className={LABEL}>מי שילם בפועל</label>
        <select name="paidBy" defaultValue={paidBy === "partner" ? "partner" : "owner"} className={FIELD}>
          <option value="owner">{ownerName}</option>
          <option value="partner">{partnerName}</option>
        </select>
      </div>
      <div>
        <label className={LABEL}>על מי החוב</label>
        <select name="owedBy" defaultValue={owedBy === "partner" ? "partner" : owedBy === "shared" ? "shared" : "owner"} className={FIELD}>
          <option value="owner">על {ownerName} בלבד</option>
          <option value="partner">על {partnerName} בלבד</option>
          <option value="shared">משותף (חצי-חצי)</option>
        </select>
      </div>
    </>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-card bg-white p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-base font-extrabold text-ink">
            <Pencil className="h-4 w-4" />
            {title}
          </h2>
          <button type="button" onClick={onClose} className="text-lg text-muted transition hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EditFixedExpenseModal({
  expense,
  branchId,
  isPartner,
  ownerName,
  partnerName,
}: {
  expense: FixedExpense;
  branchId: string;
  isPartner: boolean;
  ownerName: string;
  partnerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();
  const update = updateFixedExpenseAction.bind(null, expense.id, branchId);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await update(formData);
        router.refresh();
        setOpen(false);
        showSuccess("ההוצאה עודכנה בהצלחה");
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה בעדכון ההוצאה");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-card-border bg-white px-2 py-1 text-xs font-bold text-ink hover:bg-[#f4f6f9]">
        עריכה
      </button>
      {open && (
        <Modal title="עריכת הוצאה קבועה" onClose={() => setOpen(false)}>
          <form action={handleSubmit} className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className={LABEL}>שם ההוצאה</label>
              <input name="name" defaultValue={expense.name} className={FIELD} required />
            </div>
            <div>
              <label className={LABEL}>סכום חודשי</label>
              <input name="amount" type="number" step="0.01" defaultValue={expense.amount ?? 0} className={FIELD} required />
            </div>
            <div>
              <label className={LABEL}>תאריך התחלה</label>
              <input name="startDate" type="date" defaultValue={expense.startDate} className={FIELD} required />
            </div>
            <div className="col-span-2">
              <label className={LABEL}>קטגוריה</label>
              <select name="category" defaultValue={expense.category ?? ""} className={FIELD}>
                <option value="">ללא קטגוריה</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {isPartner && (
              <PayerFields paidBy={expense.paidBy} owedBy={expense.owedBy} ownerName={ownerName} partnerName={partnerName} />
            )}
            <div className="col-span-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? "שומר..." : "שמירה"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {toastNode}
    </>
  );
}

export function EditVariableExpenseModal({
  expense,
  branchId,
  isPartner,
  ownerName,
  partnerName,
}: {
  expense: VariableExpense;
  branchId: string;
  isPartner: boolean;
  ownerName: string;
  partnerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();
  const update = updateVariableExpenseAction.bind(null, expense.id, branchId);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await update(formData);
        router.refresh();
        setOpen(false);
        showSuccess("ההוצאה עודכנה בהצלחה");
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה בעדכון ההוצאה");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-card-border bg-white px-2 py-1 text-xs font-bold text-ink hover:bg-[#f4f6f9]">
        עריכה
      </button>
      {open && (
        <Modal title="עריכת הוצאה חד פעמית" onClose={() => setOpen(false)}>
          <form action={handleSubmit} className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className={LABEL}>תיאור</label>
              <input name="desc" defaultValue={expense.desc} className={FIELD} required />
            </div>
            <div>
              <label className={LABEL}>סכום</label>
              <input name="amount" type="number" step="0.01" defaultValue={expense.amount ?? 0} className={FIELD} required />
            </div>
            <div>
              <label className={LABEL}>תאריך</label>
              <input name="date" type="date" defaultValue={expense.date} className={FIELD} required />
            </div>
            <div className="col-span-2">
              <label className={LABEL}>קטגוריה</label>
              <select name="category" defaultValue={expense.category ?? ""} className={FIELD}>
                <option value="">ללא קטגוריה</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {isPartner && (
              <PayerFields paidBy={expense.paidBy} owedBy={expense.owedBy} ownerName={ownerName} partnerName={partnerName} />
            )}
            <div className="col-span-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? "שומר..." : "שמירה"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {toastNode}
    </>
  );
}
