"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { calcRentalDays, calcRentalPrice, calcStickPrice } from "@/lib/rental-pricing";
import { markRentalPaidAction, closeRentalAction, closeRentalWithChargeAction, deleteRentalAction } from "../actions";
import { NedarimChargeCapture } from "../clients/nedarim-charge-capture";
import { TokenChargeButton } from "./token-charge-button";

type LaptopRates = {
  dayPrice: number;
  weekPrice: number;
  monthPrice: number;
  altPricing?: boolean;
  noInternetDayPrice?: number;
  noInternetWeekPrice?: number;
  noInternetMonthPrice?: number;
};
type StickRates = { day1: number; day2: number; day3plus: number };

type Props = {
  rentalId: string;
  startDate: string;
  kind: "laptop" | "stick";
  pricingVariant?: "normal" | "noInternet" | "stickOnly";
  clientId: string;
  clientName: string;
  clientPhone?: string;
  clientIdNum?: string;
  cardLast4?: string;
  hasCardToken: boolean;
  itemName: string;
  branchName: string;
  showBranch: boolean;
  isOwner?: boolean;
  calcPrice: number;
  notes?: string;
  laptopRates?: LaptopRates;
  stickRates?: StickRates;
  hasRoute: boolean;
  nedarimCreds: { mosadId: string; apiValid: string } | null;
  canCharge: boolean;
};

const BTN =
  "rounded-[8px] px-3 py-1.5 text-xs font-bold transition disabled:opacity-50";

export function ActiveRentalRow({
  rentalId,
  startDate,
  kind,
  pricingVariant,
  clientId,
  clientName,
  clientPhone,
  clientIdNum,
  cardLast4,
  hasCardToken,
  itemName,
  branchName,
  showBranch,
  isOwner,
  calcPrice,
  notes: initialNotes,
  laptopRates,
  stickRates,
  hasRoute,
  nedarimCreds,
  canCharge,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [override, setOverride] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [paid, setPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [showNedarim, setShowNedarim] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const autoPrice = useMemo(() => {
    const days = calcRentalDays(startDate, returnDate);
    if (kind === "laptop" && laptopRates) {
      const useNoInternet = pricingVariant === "noInternet" && laptopRates.altPricing;
      const day = useNoInternet ? (laptopRates.noInternetDayPrice ?? laptopRates.dayPrice) : laptopRates.dayPrice;
      const week = useNoInternet ? laptopRates.noInternetWeekPrice : laptopRates.weekPrice;
      const month = useNoInternet ? laptopRates.noInternetMonthPrice : laptopRates.monthPrice;
      return calcRentalPrice(days, day, week, month);
    }
    if (kind === "stick" && stickRates) {
      return calcStickPrice(days, stickRates.day1, stickRates.day2, stickRates.day3plus);
    }
    return calcPrice;
  }, [startDate, returnDate, kind, pricingVariant, laptopRates, stickRates, calcPrice]);

  const finalPrice = override ? Number(manualPrice) || 0 : autoPrice;

  function handleMarkPaid(method: "cash" | "route" | "nedarim") {
    setActionError(null);
    startTransition(async () => {
      try {
        await markRentalPaidAction(rentalId, method);
        setPaid(true);
        setPaymentMethod(method);
        setShowNedarim(false);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "שגיאה בגבייה");
      }
    });
  }

  function buildCloseData() {
    return {
      returnDate,
      finalPrice,
      priceOverrideReason: override ? overrideReason.trim() : undefined,
      notes: notes.trim() || undefined,
    };
  }

  function handleClose() {
    if (override && !overrideReason.trim()) {
      setActionError("יש לפרט את הסיבה לשינוי המחיר הידני");
      return;
    }
    setActionError(null);
    startTransition(async () => {
      try {
        await closeRentalAction(rentalId, buildCloseData());
        router.refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "שגיאה בסגירת ההשכרה");
      }
    });
  }

  function handleChargeSuccess() {
    // הכסף כבר חויב בפועל אצל נדרים פלוס בשלב הזה - אסור לעצור כאן גם אם חסר
    // נימוק למחיר ידני; ממשיכים לסמן שולם ולסגור, ורק מציגים שגיאה אם הסגירה עצמה נכשלת.
    setActionError(null);
    setPaid(true);
    setPaymentMethod("nedarim");
    setShowNedarim(false);
    startTransition(async () => {
      try {
        await closeRentalWithChargeAction(rentalId, buildCloseData());
        router.refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "הגבייה בוצעה אך סגירת ההשכרה נכשלה - יש לסגור ידנית");
      }
    });
  }

  function handleDelete() {
    if (!confirm("למחוק את השכרה לצמיתוצ")) return;
    setDeleting(true);
    setActionError(null);
    startTransition(async () => {
      try {
        await deleteRentalAction(rentalId);
        router.refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "שגיאה במחיקת השכרה");
      } finally {
        setDeleting(false);
      }
    });
  }

  return (
    <>
      <tr className="cursor-pointer border-t border-card-border transition hover:bg-[#f8fafc]" onClick={() => setExpanded((v) => !v)}>
        <td className="px-[11px] py-2 font-semibold text-ink">{clientName}</td>
        <td className="px-[11px] py-2 text-muted">{itemName}</td>
        {showBranch && <td className="px-[11px] py-2 text-muted">{branchName}</td>}
        <td className="px-[11px] py-2 text-muted">{startDate}</td>
        <td className="px-[11px] py-2 font-semibold text-ink">{calcPrice} ₪</td>
        <td className="px-[11px] py-2">
          <span className="text-xs font-bold text-teal-dark">{expanded ? "סגירה ▲" : "החזרה ▼"}</span>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-card-border bg-[#f8fafc]">
          <td colSpan={showBranch ? 6 : 5} className="px-[11px] py-4">
            <div className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">תאריך החזרה</label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full rounded-lg border border-card-border bg-white px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">מחיר מחושב</label>
                  <div className="rounded-lg border border-teal bg-teal-bg px-3 py-1.5 text-sm font-bold text-teal-dark">
                    {autoPrice.toLocaleString()} ₪
                  </div>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                    <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                    מחיר ידני אחר
                  </label>
                </div>
              </div>

              {override && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted">מחיר ידני (₪)</label>
                    <input
                      type="number"
                      value={manualPrice}
                      onChange={(e) => setManualPrice(e.target.value)}
                      className="w-full rounded-lg border border-card-border bg-white px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted">סיבה לשינוי המחיר</label>
                    <input
                      type="text"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      className="w-full rounded-lg border border-card-border bg-white px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">הערות</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-card-border bg-white px-3 py-1.5 text-sm"
                />
              </div>

              <div className="rounded-lg border border-card-border bg-white p-3">
                <div className="mb-2 text-xs font-bold text-muted">תשלום</div>
                {paid ? (
                  <div className="flex items-center gap-1.5 text-sm font-bold text-teal-dark">
                    {"שולם"}
                    <Check className="h-4 w-4" />
                    {`(${paymentMethod === "nedarim" ? "נדרים פלאס" : paymentMethod === "route" ? "מסלול גבייה" : "מזומן"})`}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleMarkPaid("cash")}
                      className={`${BTN} bg-[#f4f6f9] text-ink hover:bg-[#e9edf3]`}
                    >
                      סמן כשולם (מזומן)
                    </button>
                    {hasRoute && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleMarkPaid("route")}
                        className={`${BTN} bg-[#f4f6f9] text-ink hover:bg-[#e9edf3]`}
                      >
                        גבייה + קבלה דרך מסלול
                      </button>
                    )}
                    {canCharge && nedarimCreds && (
                      <button
                        type="button"
                        onClick={() => {
                          if (override && !overrideReason.trim()) {
                            setActionError("יש לפרט את הסיבה לשינוי המחיר הידני לפני גבייה");
                            return;
                          }
                          setActionError(null);
                          setShowNedarim((v) => !v);
                        }}
                        className={`${BTN} bg-gradient-to-br from-teal to-teal-light text-white`}
                      >
                        {hasCardToken ? "גבייה מידית (כרטיס אשראי)" : "גבייה מידית (הזנת כרטיס)"}
                      </button>
                    )}
                  </div>
                )}
                {showNedarim && nedarimCreds && !paid && canCharge && (
                  <div className="mt-3">
                    {hasCardToken ? (
                      <TokenChargeButton
                        clientId={clientId}
                        initialAmount={finalPrice}
                        cardLast4={cardLast4}
                        onDone={(result) => {
                          if (result.ok) {
                            handleChargeSuccess();
                          } else {
                            setActionError(result.message ?? "הגבייה נכשלה");
                          }
                        }}
                      />
                    ) : (
                      <NedarimChargeCapture
                        mosadId={nedarimCreds.mosadId}
                        apiValid={nedarimCreds.apiValid}
                        clientName={clientName}
                        clientPhone={clientPhone}
                        clientIdNum={clientIdNum}
                        initialAmount={finalPrice}
                        onDone={(result) => {
                          if (result.ok) {
                            handleChargeSuccess();
                          } else {
                            setActionError(result.message ?? "הגבייה נכשלה");
                          }
                        }}
                      />
                    )}
                  </div>
                )}
              </div>

              {actionError && <p className="text-xs font-bold text-red-600">{actionError}</p>}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleClose}
                  className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "מעבד..." : "סגירה"}
                </button>
                {isOwner && (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleDelete}
                    className="rounded-[10px] border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting ? "מוחק..." : "מחיקת השכרה"}
                  </button>
                )}
                {!paid && <span className="text-xs text-muted">אפשר לסגור גם ללא תשלום – ההשכרה תסומן כחובה</span>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
