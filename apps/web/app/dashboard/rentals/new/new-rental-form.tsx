"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { Branch, RentalClient, Laptop, Stick, CollectionRoute } from "@ultranet/shared-types";
import { createRentalAction } from "../actions";
import { CustomerCombobox } from "../customer-combobox";

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
}: Props) {
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [clientId, setClientId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [kind, setKind] = useState<"laptop" | "stick">("laptop");
  const [itemId, setItemId] = useState("");
  const [pricingVariant, setPricingVariant] = useState<"normal" | "noInternet">("normal");

  const rentedLaptopSet = useMemo(() => new Set(rentedLaptopIds), [rentedLaptopIds]);
  const rentedStickSet = useMemo(() => new Set(rentedStickIds), [rentedStickIds]);

  const branchClients = clients.filter((c) => c.branchId === branchId);
  const branchLaptops = laptops.filter((l) => l.branchId === branchId);
  const branchSticks = sticks.filter((s) => s.branchId === branchId);

  const selectedLaptop = branchLaptops.find((l) => l.id === itemId);
  const selectedStick = branchSticks.find((s) => s.id === itemId);
  const selectedItemAlreadyRented =
    (kind === "laptop" && itemId ? rentedLaptopSet.has(itemId) : false) ||
    (kind === "stick" && itemId ? rentedStickSet.has(itemId) : false);

  const dayPriceRef = useMemo(() => {
    if (kind === "laptop" && selectedLaptop) {
      if (pricingVariant === "noInternet" && selectedLaptop.altPricing) {
        return selectedLaptop.noInternetDayPrice ?? selectedLaptop.dayPrice;
      }
      return selectedLaptop.dayPrice;
    }
    if (kind === "stick" && selectedStick) {
      return selectedStick.day1;
    }
    return null;
  }, [kind, selectedLaptop, selectedStick, pricingVariant]);

  function handleKindChange(next: "laptop" | "stick") {
    setKind(next);
    setItemId("");
    setPricingVariant("normal");
  }

  return (
    <form
      action={createRentalAction}
      className="flex flex-col gap-4 rounded-card border border-card-border bg-white p-5 shadow-card"
    >
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
            required
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
            required
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

      {kind === "laptop" && selectedLaptop?.altPricing && (
        <div>
          <label className={LABEL}>אינטרנט</label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="pricingVariant"
                value="normal"
                checked={pricingVariant === "normal"}
                onChange={() => setPricingVariant("normal")}
              />
              עם אינטרנט
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="pricingVariant"
                value="noInternet"
                checked={pricingVariant === "noInternet"}
                onChange={() => setPricingVariant("noInternet")}
              />
              בלי אינטרנט
            </label>
          </div>
        </div>
      )}

      <div>
        <label className={LABEL}>תאריך התחלה</label>
        <input
          type="date"
          name="startDate"
          required
          value={startDate}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
          className={FIELD}
        />
      </div>

      {dayPriceRef !== null && (
        <div className="rounded-xl border border-teal bg-gradient-to-br from-teal-bg to-emerald-50 px-4 py-3 text-sm">
          <span className="text-muted">מחיר ליום: </span>
          <span className="text-lg font-black text-teal-dark">{dayPriceRef.toLocaleString()} ₪</span>
        </div>
      )}

      <div>
        <label className={LABEL}>הערות</label>
        <textarea name="notes" rows={2} className={FIELD} />
      </div>


      <button
        type="submit"
        disabled={!clientId || selectedItemAlreadyRented}
        className="mt-1 self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        התחל השכרה
      </button>
    </form>
  );
}
