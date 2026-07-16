"use client";

import { useState } from "react";

export function TokenChargeButton({
  clientId,
  initialAmount,
  cardLast4,
  onDone,
}: {
  clientId: string;
  initialAmount: number;
  cardLast4?: string;
  onDone: (result: { ok: boolean; message?: string; receiptPdfLink?: string; receiptError?: string }) => void;
}) {
  const [amount, setAmount] = useState(String(initialAmount));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ambiguous, setAmbiguous] = useState(false);

  async function handleCharge() {
    setError(null);
    setAmbiguous(false);
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("יש להזין סכום תקין");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/rentals/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, amount: amt }),
      });
      const data = await res.json();
      if (data.success) {
        onDone({ ok: true, receiptPdfLink: data.receiptPdfLink, receiptError: data.receiptError });
      } else if (data.ambiguous) {
        setAmbiguous(true);
        setError(data.message ?? "לא ברור אם החיוב בוצע - יש לבדוק ידנית");
      } else {
        setError(data.message ?? "החיוב נכשל");
        onDone({ ok: false, message: data.message });
      }
    } catch {
      setError("שגיאת תקשורת מול נדרים פלוס - החיוב כנראה לא בוצע");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-card border border-card-border bg-white p-4">
      <p className="mb-2 text-xs text-muted" dir="ltr">
        חיוב הכרטיס השמור {cardLast4 ? `(•••• ${cardLast4})` : ""} דרך הטוקן במערכת - ללא הזנת פרטי כרטיס מחדש.
      </p>
      <label className="mb-1 block text-xs font-bold text-muted">סכום לחיוב (₪)</label>
      <input
        type="number"
        min="1"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        dir="ltr"
        className="mb-2 w-40 rounded-[10px] border border-card-border px-3 py-2 text-sm"
      />
      {error && (
        <p className={`mb-2 text-xs font-bold ${ambiguous ? "text-amber-600" : "text-red-600"}`}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleCharge}
        disabled={pending}
        className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "מחייב..." : "חייב עכשיו"}
      </button>
    </div>
  );
}
