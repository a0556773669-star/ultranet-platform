"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
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
    const days = Math.max(
      1,
      Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000),
    );
    return days * laptop.dayPrice;
  }, [startDate, endDate, itemId, branchLaptops]);

  return (
    <form action={createRentalAction} className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">סניף</label>
        <select
          name="branchId"
          value={branchId}
          disabled={lockBranch}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setBranchId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none disabled:bg-gray-100"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">לקוח</label>
        <select
          name="clientId"
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
        >
          <option value="">בחירת לקוח</option>
          {branchClients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">מחשב</label>
        <select
          name="itemId"
          required
          value={itemId}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setItemId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
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
          <label className="mb-1 block text-sm font-medium text-gray-700">תאריך התחלה</label>
          <input
            type="date"
            name="startDate"
            required
            value={startDate}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">תאריך סיום</label>
          <input
            type="date"
            name="endDate"
            required
            value={endDate}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">מחיר מחושב</label>
        <input
          type="number"
          name="calcPrice"
          min={0}
          value={calcPrice}
          readOnly
          className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">מסלול גביה (לא חובה)</label>
        <select name="collectionRouteId" className="w-full rounded-lg border border-gray-300 px-3 py-2">
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
        className="mt-2 self-start rounded-lg bg-teal px-6 py-2 font-medium text-white transition hover:bg-teal-dark"
      >
        יצירת השכרה
      </button>
    </form>
  );
}
