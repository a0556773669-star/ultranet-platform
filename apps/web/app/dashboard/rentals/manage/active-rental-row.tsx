"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { calcRentalDays, calcRentalQuote, calcStickQuote, roundPrice, type RentalQuote } from "@/lib/rental-pricing";
import {
  markRentalPaidAction,
  closeRentalAction,
  closeRentalWithChargeAction,
  deleteRentalAction,
  issueCashReceiptAction,
  updateRentalItemAction,
} from "../actions";
import { NedarimChargeCapture } from "../clients/nedarim-charge-capture";
import { TokenChargeButton } from "./token-charge-button";
import type { ItemOption } from "./rentals-lists";

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
  pricingVariant?: "normal" | "noInternet";
  clientId: string;
  clientName: string;
  clientPhone?: string;
  clientIdNum?: string;
  cardLast4?: string;
  hasCardToken: boolean;
  itemId: string;
  itemName: string;
  itemOptions: ItemOption[];
  branchName: string;
  showBranch: boolean;
  canDelete?: boolean;
  calcPrice: number;
  notes?: string;
  laptopRates?: LaptopRates;
  stickRates?: StickRates;
  hasRoute: boolean;
  tokenRouteName: string | null;
  chargeRoutes: { id: string; name: string; mosadId: string; apiValid: string; defaultForNewCards: boolean }[];
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
  itemId,
  itemName,
  itemOptions,
  branchName,
  showBranch,
  canDelete,
  calcPrice,
  notes: initialNotes,
  laptopRates,
  stickRates,
  hasRoute,
  tokenRouteName,
  chargeRoutes,
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
  const [issuingReceipt, setIssuingReceipt] = useState(false);
  const [itemPending, setItemPending] = useState(false);
  const defaultChargeRoute = chargeRoutes.find((r) => r.defaultForNewCards) ?? chargeRoutes[0];
  const [selectedRouteId, setSelectedRouteId] = useState(defaultChargeRoute?.id ?? "");
  const selectedRoute = chargeRoutes.find((r) => r.id === selectedRouteId) ?? defaultChargeRoute;
  const canChargeNow = hasCardToken ? !!tokenRouteName : !!selectedRoute;

  const quote: RentalQuote = useMemo(() => {
    if (kind === "laptop" && laptopRates) {
      const useNoInternet = pricingVariant === "noInternet" && laptopRates.altPricing;
      return calcRentalQuote({
        startDate,
        endDate: returnDate,
        dayPrice: useNoInternet ? (laptopRates.noInternetDayPrice ?? laptopRates.dayPrice) : laptopRates.dayPrice,
        weekPrice: useNoInternet ? laptopRates.noInternetWeekPrice : laptopRates.weekPrice,
        monthPrice: useNoInternet ? laptopRates.noInternetMonthPrice : laptopRates.monthPrice,
      });
    }
    if (kind === "stick" && stickRates) {
      const days = calcRentalDays(startDate, returnDate);
      return calcStickQuote(days, stickRates.day1, stickRates.day2, stickRates.day3plus);
    }
    return {
      totalDays: calcRentalDays(startDate, returnDate),
      periodLabel: "",
      months: 0,
      weeks: 0,
      days: 0,
      lines: [],
      total: roundPrice(calcPrice),
      breakdown: "",
    };
  }, [startDate, returnDate, kind, pricingVariant, laptopRates, stickRates, calcPrice]);

  const autoPrice = quote.total;
  const finalPrice = override ? roundPrice(Number(manualPrice) || 0) : autoPrice;

  function handleMarkPaid(method: "cash" | "route" | "nedarim", receiptPdfLink?: string) {
    setActionError(null);
    startTransition(async () => {
      try {
        await markRentalPaidAction(rentalId, method, undefined, receiptPdfLink);
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
      priceOverrideReason: override && finalPrice !== autoPrice ? overrideReason.trim() : undefined,
      notes: notes.trim() || undefined,
    };
  }

  function handleIssueCashReceipt() {
    setActionError(null);
    setIssuingReceipt(true);
    startTransition(async () => {
      try {
        const result = await issueCashReceiptAction(rentalId);
        if (result.ok) {
          setPaid(true);
          setPaymentMethod("cash");
        } else {
          setActionError(result.message ?? "הפקת הקבלה נכשלה");
        }
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "הפקת הקבלה נכשלה");
      } finally {
        setIssuingReceipt(false);
      }
    });
  }

  function handleClose() {
    if (override && finalPrice !== autoPrice && !overrideReason.trim()) {
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

  function handleChargeSuccess(receiptPdfLink?: string, receiptError?: string) {
    // הכסף כבר חויב בפועל אצל נדרים פלוס בשלב הזה - אסור לעצור כאן גם אם חסר
    // נימוק למחיר ידני; ממשיכים לסמן שולם ולסגור, ורק מציגים שגיאה אם הסגירה עצמה נכשלת.
    setActionError(
      receiptError ? `החיוב בוצע בהצלחה, אך הפקת הקבלה נכשלה: ${receiptError}` : null
    );
    setPaid(true);
    setPaymentMethod("nedarim");
    setShowNedarim(false);
    startTransition(async () => {
      try {
        await closeRentalWithChargeAction(rentalId, buildCloseData(), receiptPdfLink);
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

  function handleItemChange(newItemId: string) {
    if (!newItemId || newItemId === itemId) return;
    setItemPending(true);
    setActionError(null);
    startTransition(async () => {
      try {
        await updateRentalItemAction(rentalId, newItemId);
        router.refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "שגיאה בשינוי הפריט");
      } finally {
        setItemPending(false);
      }
    });
  }

  return (
    <>
      <tr className="cursor-pointer border-t border-card-border transition hover:bg-[#f8fafc]" onClick={() => setExpanded((v) => !v)}>
        <td className="px-[11px] py-2 font-semibold text-ink">
          <Link
            href={`/dashboard/rentals/clients/${clientId}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:underline"
          >
            {clientName}
          </Link>
        </td>
        <td className="px-[11px] py-2 text-muted">{itemName}</td>
        {showBranch && <td className="px-[11px] py-2 text-muted">{branchName}</td>}
        <td className="px-[11px] py-2 text-muted">{startDate}</td>
        <td className="px-[11px] py-2 font-semibold text-ink">{finalPrice.toLocaleString()} ₪</td>
        <td className="px-[11px] py-2">
          <span className="text-xs font-bold text-teal-dark">{expanded ? "סגירה ▲" : "החזרה ▼"}</span>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-card-border bg-[#f8fafc]">
          <td colSpan={showBranch ? 6 : 5} className="px-[11px] py-4">
            <div className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">פריט (מחשב/סטיק)</label>
                <select
                  value={itemId}
                  disabled={itemPending}
                  onChange={(e) => handleItemChange(e.target.value)}
                  className="w-full max-w-xs rounded-lg border border-card-border bg-white px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {itemOptions.map((it) => (
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">תאריך התחלה</label>
                  <div className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-1.5 text-sm text-muted">
                    {startDate}
                  </div>
                </div>
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
                  <label className="mb-1 block text-xs font-semibold text-muted">
                    {override ? "מחיר לתשלום (ידני, ₪)" : "מחיר לתשלום"}
                  </label>
                  {override ? (
                    <input
                      type="number"
                      step={1}
                      min={0}
                      value={manualPrice}
                      onChange={(e) => setManualPrice(e.target.value)}
                      className="w-full rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm font-bold"
                    />
                  ) : (
                    <div className="rounded-lg border border-teal bg-teal-bg px-3 py-1.5 text-sm font-bold text-teal-dark">
                      {autoPrice.toLocaleString()} ₪
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-card-border bg-white px-3 py-2 text-xs text-muted">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {quote.periodLabel && (
                    <span>
                      משך ההשכרה: <strong className="text-ink">{quote.periodLabel}</strong> ({quote.totalDays} ימים
                      קלנדריים)
                    </span>
                  )}
                  {quote.breakdown && (
                    <span>
                      חישוב: <strong className="text-ink">{quote.breakdown}</strong> ={" "}
                      <strong className="text-ink">{autoPrice.toLocaleString()} ₪</strong>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (override) {
                        setOverride(false);
                        setOverrideReason("");
                      } else {
                        setManualPrice(String(autoPrice));
                        setOverride(true);
                      }
                    }}
                    className="rounded-[8px] border border-card-border px-2 py-1 text-[11px] font-bold text-ink transition hover:bg-[#f4f6f9]"
                  >
                    {override ? "חזרה לחישוב האוטומטי" : "תיקון המחיר ידנית"}
                  </button>
                </div>
                <div className="mt-1 text-[11px]">שישי ושבת נספרים כיום חיוב אחד. המחיר תמיד בשקלים שלמים.</div>
              </div>

              {override && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">סיבה לשינוי המחיר</label>
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="למשל: הנחה ללקוח קבוע / תקלה במחשב"
                    className="w-full rounded-lg border border-card-border bg-white px-3 py-1.5 text-sm"
                  />
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
                    {canCharge && (
                      <button
                        type="button"
                        disabled={pending || issuingReceipt}
                        onClick={handleIssueCashReceipt}
                        className={`${BTN} bg-[#f4f6f9] text-ink hover:bg-[#e9edf3]`}
                      >
                        {issuingReceipt ? "מפיק קבלה..." : "קבלה (מזומן/העברה)"}
                      </button>
                    )}
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
                    {canCharge && canChargeNow && (
                      <button
                        type="button"
                        onClick={() => {
                          if (override && finalPrice !== autoPrice && !overrideReason.trim()) {
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
                {showNedarim && canChargeNow && !paid && canCharge && (
                  <div className="mt-3">
                    {hasCardToken ? (
                      <TokenChargeButton
                        clientId={clientId}
                        initialAmount={finalPrice}
                        cardLast4={cardLast4}
                        routeName={tokenRouteName!}
                        onDone={(result) => {
                          if (result.ok) {
                            handleChargeSuccess(result.receiptPdfLink, result.receiptError);
                          } else {
                            setActionError(result.message ?? "הגבייה נכשלה");
                          }
                        }}
                      />
                    ) : (
                      <>
                        {chargeRoutes.length > 1 && (
                          <div className="mb-2 max-w-xs">
                            <label className="mb-1 block text-xs font-semibold text-muted">
                              החיוב יתבצע לעסק
                            </label>
                            <select
                              value={selectedRouteId}
                              onChange={(e) => setSelectedRouteId(e.target.value)}
                              className="w-full rounded-lg border border-card-border bg-white px-3 py-1.5 text-sm"
                            >
                              {chargeRoutes.map((rt) => (
                                <option key={rt.id} value={rt.id}>
                                  {rt.name}
                                  {rt.defaultForNewCards ? " (ברירת מחדל)" : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <p className="mb-2 text-xs font-bold text-ink">
                          שים לב: זה גובה לעסק &quot;{selectedRoute!.name}&quot;
                        </p>
                        <NedarimChargeCapture
                          key={selectedRoute!.id}
                          mosadId={selectedRoute!.mosadId}
                          apiValid={selectedRoute!.apiValid}
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
                      </>
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
                {canDelete && (
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
