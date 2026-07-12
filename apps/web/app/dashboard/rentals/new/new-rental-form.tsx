"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { calcRentalPrice, calcRentalDays } from "@/lib/rental-pricing";
import type { Branch, RentalClient, Laptop, CollectionRoute } from "@ultranet/shared-types";
import { createRentalAction } from "../actions";

type Props = {
  branches: Branch[];
  clients: RentalClient[];
  laptops: Laptop[];
  routes: CollectionRoute[];
  defaultBranchId: string;
  lockBranch: boolean;
};

const FIELD = "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none disabled:opacity-60";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

export function NewRentalForm({ branches, clients, laptops, routes, defaultBranchId, lockBranch }: Props) {
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [itemId, setItemId] = useState("");

  const branchClients = clients.filter((c) => c.branchId === branchId);
  const branchLaptops = laptops.filter((l) => l.branchId === branchId);

  const calcPrice = useMemo(() => {
    if (!startDate || !endDate || !itemId) return 0;
    const laptop = branchLaptops.find((l) => l.id === itemId);
    if (!laptop) return 0;
    const days = calcRentalDays(startDate, endDate);
    return calcRentalPrice(days, laptop.dayPrice, laptop.weekPrice, laptop.monthPrice);
  }, [startDate, endDate, itemId, branchLaptops]);

  return (
    <form action={createRentalAction} className="flex flex-col gap-4 rounded-card border border-card-border bg-white p-5 shadow-card">
      <div>
        <label className={LABEL}>סניף</label>
        <select
          name="branchId"
          value={branchId}
          disabled={lockBranch}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setBranchId(e.target.value)}
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
        <select name="clientId" required className={FIELD}>
          <option value="">בחירת לקוח</option>
          {branchClients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={LABEL}>מחשב</label>
        <select
          name="itemId"
          required
          value={itemId}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setItemId(e.target.value)}
          className={FIELD}
        >
          <option value="">בחירת מחשב</option>
          {branchLaptops.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.dayPrice} ₪/יום)
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
        <div>
          <label className={LABEL}>תאריך סיום</label>
          <input
            type="date"
            name="endDate"
            required
            value={endDate}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
            className={FIELD}
          />
        </div>
      </div>

      <div className="rounded-xl border border-teal bg-gradient-to-br from-teal-bg to-emerald-50 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">מחיר מחושב</span>
          <span className="text-lg font-black text-teal-dark">{calcPrice.toLocaleString()} ₪</span>
        </div>
        <input type="hidden" name="calcPrice" value={calcPrice} />
      </div>

      <div>
        <label className={LABEL}>מסלול גביה (לא חובה)</label>
        <select name="collectionRouteId" className={FIELD}>
          <option value="">ללא (תשלום ידני)</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="mt-1 self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
      >
        יצירת השכרה
      </button>
    </form>
  );
}
