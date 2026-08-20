"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { Branch, RentalClient, Laptop, Stick, CollectionRoute } from "@ultranet/shared-types";
import { createRentalAction } from "../actions";
import { CustomerCombobox } from "../customer-combobox";
import { laptopRatesFor } from "@/lib/rental-pricing";

type Props = {
  branches: Branch[];
  clients: RentalClient[];
  laptops: Laptop[];
  sticks: Stick[];
  routes: CollectionRoute[];
  defaultBranchId: string;
  lockBranch: boolean;
  rentedLaptopIds: string[];
  rentedStickIds: string[];
  onlyMine?: boolean;
};

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none disabled:opacity-60";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

export function NewRentalForm({
  branches,
  clients,
  laptops,
  sticks,
  routes,
  defaultBranchId,
  lockBranch,
  rentedLaptopIds,
  rentedStickIds,
  onlyMine,
}: Props) {
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [clientId, setClientId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [kind, setKind] = useState<"laptop" | "stick">("laptop");
  const [itemId, setItemId] = useState("");
  const [pricingVariant, setPricingVariant] = useState<"normal" | "noInternet">("normal");
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rentedLaptopSet = useMemo(() => new Set(rentedLaptopIds), [rentedLaptopIds]);
  const rentedStickSet = useMemo(() => new Set(rentedStickIds), [rentedStickIds]);

  const branchClients = clients.filter((c) => c.branchId === branchId);
  const branchLaptops = laptops
    .filter((l) => l.branchId === branchId)
    .sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true }));
  const branchSticks = sticks
    .filter((s) => s.branchId === branchId)
    .sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true }));

  const selectedLaptop = branchLaptops.find((l) => l.id === itemId);
  const selectedStick = branchSticks.find((s) => s.id === itemId);
  const selectedItemAlreadyRented =
    (kind === "laptop" && itemId ? rentedLaptopSet.has(itemId) : false) ||
    (kind === "stick" && itemId ? rentedStickSet.has(itemId) : false);

  /** שורות המחירון של הפריט שנבחר, להצגה לפני פתיחת ההשכרה. */
  const priceRows = useMemo<{ label: string; value: number }[] | null>(() => {
    if (kind === "laptop" && selectedLaptop) {
      const r = laptopRatesFor(selectedLaptop, pricingVariant);
      return [
        { label: "ליום", value: r.dayPrice },
        { label: "לשבוע", value: r.weekPrice },
        { label: "לחודש", value: r.monthPrice },
      ].filter((row) => row.value > 0);
    }
    if (kind === "stick" && selectedStick) {
      const ongoing = selectedStick.day3plus || selectedStick.day2 || selectedStick.day1;
      return [
        { label: "יום ראשון", value: selectedStick.day1 },
        { label: "לכל יום נוסף", value: ongoing },
        { label: "לשבוע", value: selectedStick.weekPrice ?? 0 },
        { label: "לחודש", value: selectedStick.monthPrice ?? 0 },
      ].filter((row) => row.value > 0);
    }
    return null;
  }, [kind, selectedLaptop, selectedStick, pricingVariant]);

  function handleKindChange(next: "laptop" | "stick") {
    setKind(next);
    setItemId("");
    setPricingVariant("normal");
  }

  /**
   * Builds the FormData from the component's own state instead of letting the browser collect it
   * from the DOM on a native <form action={...}> submit. That native path was the source of the
   * long-standing "חובה לבחור לקוח..." on the very first click even after picking a customer:
   * whatever the exact cause (the hidden clientId input, focus/blur ordering in the combobox,
   * etc.), reading straight from React state can never go stale relative to what the user sees on
   * screen. Missing fields are now reported inline immediately, without a full-page redirect that
   * used to wipe every field the user had already filled in and forced them to start over.
   */
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || selectedItemAlreadyRented) return;

    const missing = [!clientId && "לקוח", !itemId && "מחשב/סטיק", !startDate && "תאריך התחלה"]
      .filter(Boolean)
      .join(", ");
    if (missing) {
      setFormError(`חובה למלא: ${missing} לפני השמירה.`);
      return;
    }
    setFormError(null);

    const fd = new FormData();
    fd.set("branchId", branchId);
    fd.set("clientId", clientId);
    fd.set("kind", kind);
    fd.set("itemId", itemId);
    fd.set("pricingVariant", pricingVariant);
    fd.set("startDate", startDate);
    fd.set("notes", notesRef.current?.value ?? "");
    if (onlyMine) fd.set("mine", "1");
    startTransition(() => {
      createRentalAction(fd);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-card-border bg-white p-5 shadow-card">
      <div>
        <label className={LABEL}>סניף</label>
        <select
          name="branchId"
          value={branchId}
          disabled={lockBranch}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            setBranchId(e.target.value);
            setClientId("");
          }}
          className={FIELD}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={LABEL}>לקוח</label>
        <CustomerCombobox clients={branchClients} value={clientId} onChange={setClientId} />
      </div>

      <div>
        <label className={LABEL}>סוג השכרה</label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="kind"
              value="laptop"
              checked={kind === "laptop"}
              onChange={() => handleKindChange("laptop")}
            />
            מחשב נייד
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="kind"
              value="stick"
              checked={kind === "stick"}
              onChange={() => handleKindChange("stick")}
            />
            סטיק
          </label>
        </div>
      </div>

      {kind === "laptop" ? (
        <div>
          <label className={LABEL}>מחשב</label>
          <select
            name="itemId"
            value={itemId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setItemId(e.target.value)}
            className={FIELD}
          >
            <option value="">בחר מחשב</option>
            {branchLaptops.map((l) => {
              const rented = rentedLaptopSet.has(l.id);
              return (
                <option key={l.id} value={l.id} disabled={rented}>
                  {l.name} ({l.dayPrice} ₪/יום){rented ? " — מושכר כרגע" : ""}
                </option>
              );
            })}
          </select>
        </div>
      ) : (
        <div>
          <label className={LABEL}>סטיק</label>
          <select
            name="itemId"
            value={itemId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setItemId(e.target.value)}
            className={FIELD}
          >
            <option value="">בחר סטיק</option>
            {branchSticks.map((s) => {
              const rented = rentedStickSet.has(s.id);
              return (
                <option key={s.id} value={s.id} disabled={rented}>
                  {s.name} ({s.day1} ₪/יום ראשון){rented ? " — מושכר כרגע" : ""}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {selectedItemAlreadyRented && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          מחשב/סטיק זה כבר מושכר כרגע ולא ניתן לפתוח עבורו השכרה נוספת עד להחזרתו.
        </div>
      )}

      {kind === "laptop" && (selectedLaptop?.hasStick || selectedLaptop?.altPricing) && (
        <div>
          <label className={LABEL}>סטיק (אינטרנט)</label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="pricingVariant"
                value="normal"
                checked={pricingVariant === "normal"}
                onChange={() => setPricingVariant("normal")}
              />
              עם סטיק
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="pricingVariant"
                value="noInternet"
                checked={pricingVariant === "noInternet"}
                onChange={() => setPricingVariant("noInternet")}
              />
              בלי סטיק
            </label>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            &quot;בלי סטיק&quot; מתמחר לפי עמודת &quot;בלי סטיק&quot; של המחשב, ומשאיר את הסטיק פנוי
            להשכרה נפרדת.
          </p>
        </div>
      )}

      <div>
        <label className={LABEL}>תאריך התחלה</label>
        <input
          type="date"
          name="startDate"
          value={startDate}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
          className={FIELD}
        />
      </div>

      {priceRows && priceRows.length > 0 && (
        <div className="rounded-xl border border-teal bg-gradient-to-br from-teal-bg to-emerald-50 px-4 py-3 text-sm">
          <div className="mb-1 text-xs font-bold text-muted">מחירון הפריט</div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {priceRows.map((row) => (
              <span key={row.label}>
                <span className="text-muted">{row.label}: </span>
                <span className="text-base font-black text-teal-dark">{row.value.toLocaleString()} ₪</span>
              </span>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted">
            המחיר הסופי יחושב בסגירת ההשכרה לפי התאריכים בפועל (חודש קלנדרי, שישי+שבת = יום אחד),
            ותמיד ייבחר החישוב הזול ביותר ללקוח.
          </p>
        </div>
      )}

      <div>
        <label className={LABEL}>הערות</label>
        <textarea name="notes" ref={notesRef} rows={2} className={FIELD} />
      </div>

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {formError}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || selectedItemAlreadyRented}
        className="mt-1 self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "שומר..." : "התחל השכרה"}
      </button>
    </form>
  );
}
