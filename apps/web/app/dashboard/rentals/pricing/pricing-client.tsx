"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { BranchRentalPricing } from "@ultranet/shared-types";
import { calcQuote, calcStickQuote, laptopRatesFor } from "@/lib/rental-pricing";
import { saveBranchPricingAction } from "./actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

export type BranchOption = { id: string; name: string; pricing?: BranchRentalPricing };

const EMPTY: BranchRentalPricing = {
  laptop: {
    dayPrice: 0,
    weekPrice: 0,
    monthPrice: 0,
    noInternetDayPrice: 0,
    noInternetWeekPrice: 0,
    noInternetMonthPrice: 0,
  },
  stick: { day1: 0, day2: 0, day3plus: 0, weekPrice: 0, monthPrice: 0 },
};

/** ערך ריק במקום 0, כדי שהשדות לא ייראו "מלאים" כשלא הוגדר כלום. */
function v(n: number | undefined): string {
  return n && n > 0 ? String(n) : "";
}

function num(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function BranchPricingClient({ branches }: { branches: BranchOption[] }) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const branch = branches.find((b) => b.id === branchId);
  const initial = branch?.pricing ?? EMPTY;

  // כשמחליפים סניף טוענים מחדש את השדות מהמחירון של הסניף החדש.
  const [form, setForm] = useState(() => toState(initial));
  const [loadedFor, setLoadedFor] = useState(branchId);
  if (loadedFor !== branchId) {
    setLoadedFor(branchId);
    setForm(toState(initial));
    setSaved(false);
  }

  function set(key: keyof ReturnType<typeof toState>, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  const preview = useMemo(() => {
    const laptopRates = {
      dayPrice: num(form.dayPrice),
      weekPrice: num(form.weekPrice),
      monthPrice: num(form.monthPrice),
      noInternetDayPrice: num(form.noInternetDayPrice),
      noInternetWeekPrice: num(form.noInternetWeekPrice),
      noInternetMonthPrice: num(form.noInternetMonthPrice),
    };
    // דוגמה חיה: השכרה מ-12/07 עד 15/08 (חודש ועוד 3 ימים קלנדריים).
    const withStick = calcQuote("2026-07-12", "2026-08-15", laptopRatesFor(laptopRates, "normal"));
    const withoutStick = calcQuote("2026-07-12", "2026-08-15", laptopRatesFor(laptopRates, "noInternet"));
    const stick = calcStickQuote("2026-07-12", "2026-08-15", {
      day1: num(form.stickDay1),
      day2: num(form.stickDay2),
      day3plus: num(form.stickDay3plus),
      weekPrice: num(form.stickWeekPrice),
      monthPrice: num(form.stickMonthPrice),
    });
    return { withStick, withoutStick, stick };
  }, [form]);

  function handleSave() {
    setError(null);
    const fd = new FormData();
    for (const [key, value] of Object.entries(form)) fd.set(key, value === "" ? "0" : value);
    startTransition(async () => {
      try {
        await saveBranchPricingAction(branchId, fd);
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה בשמירת המחירון");
      }
    });
  }

  if (!branch) {
    return (
      <div className="rounded-card border border-card-border bg-white p-5 text-sm text-muted shadow-card">
        אין סניף השכרות משוייך לחשבון שלך.
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {branches.length > 1 && (
        <div>
          <label className={LABEL}>סניף</label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={FIELD}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded-card border border-card-border bg-white p-5 shadow-card">
        <p className="mb-3 text-sm font-bold text-ink">מחירון השכרת מחשב נייד (₪)</p>
        <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-2">
          <span />
          <span className="text-center text-xs font-bold text-teal-dark">עם סטיק (אינטרנט)</span>
          <span className="text-center text-xs font-bold text-muted">בלי סטיק</span>

          <span className="text-xs font-semibold text-muted">ליום</span>
          <input type="number" min={0} step={1} value={form.dayPrice} onChange={(e) => set("dayPrice", e.target.value)} className={FIELD} />
          <input
            type="number"
            min={0}
            step={1}
            value={form.noInternetDayPrice}
            onChange={(e) => set("noInternetDayPrice", e.target.value)}
            placeholder="כמו עם סטיק"
            className={FIELD}
          />

          <span className="text-xs font-semibold text-muted">לשבוע</span>
          <input type="number" min={0} step={1} value={form.weekPrice} onChange={(e) => set("weekPrice", e.target.value)} className={FIELD} />
          <input
            type="number"
            min={0}
            step={1}
            value={form.noInternetWeekPrice}
            onChange={(e) => set("noInternetWeekPrice", e.target.value)}
            placeholder="כמו עם סטיק"
            className={FIELD}
          />

          <span className="text-xs font-semibold text-muted">לחודש</span>
          <input type="number" min={0} step={1} value={form.monthPrice} onChange={(e) => set("monthPrice", e.target.value)} className={FIELD} />
          <input
            type="number"
            min={0}
            step={1}
            value={form.noInternetMonthPrice}
            onChange={(e) => set("noInternetMonthPrice", e.target.value)}
            placeholder="כמו עם סטיק"
            className={FIELD}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted">
          לדוגמה: ליום עם סטיק 50 ₪, בלי סטיק 40 ₪; לחודש 550 ₪. שדה שנשאר ריק בעמודת &quot;בלי
          סטיק&quot; מחייב באותו מחיר כמו &quot;עם סטיק&quot;.
        </p>
      </div>

      <div className="rounded-card border border-card-border bg-white p-5 shadow-card">
        <p className="mb-3 text-sm font-bold text-ink">מחירון השכרת סטיק בלבד (₪)</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL}>יום ראשון</label>
            <input type="number" min={0} step={1} value={form.stickDay1} onChange={(e) => set("stickDay1", e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>יום שני</label>
            <input
              type="number"
              min={0}
              step={1}
              value={form.stickDay2}
              onChange={(e) => set("stickDay2", e.target.value)}
              placeholder="כמו יום שוטף"
              className={FIELD}
            />
          </div>
          <div>
            <label className={LABEL}>לכל יום נוסף</label>
            <input type="number" min={0} step={1} value={form.stickDay3plus} onChange={(e) => set("stickDay3plus", e.target.value)} className={FIELD} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>לשבוע (רשות)</label>
            <input type="number" min={0} step={1} value={form.stickWeekPrice} onChange={(e) => set("stickWeekPrice", e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>לחודש (רשות)</label>
            <input type="number" min={0} step={1} value={form.stickMonthPrice} onChange={(e) => set("stickMonthPrice", e.target.value)} className={FIELD} />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          לדוגמה: יום ראשון 20 ₪, לכל יום נוסף 10 ₪ (משאירים את &quot;יום שני&quot; ריק).
        </p>
      </div>

      <div className="rounded-card border border-teal bg-teal-bg p-4 text-sm">
        <p className="mb-2 text-xs font-bold text-teal-dark">
          בדיקה חיה — השכרה לדוגמה מ-12/07 עד 15/08 (חודש ועוד 3 ימים, מהם שבת אחת):
        </p>
        <ul className="flex flex-col gap-1 text-[13px] text-ink">
          <li>
            מחשב עם סטיק: <strong>{preview.withStick.breakdown || "—"}</strong> ={" "}
            <strong>{preview.withStick.total.toLocaleString()} ₪</strong>
          </li>
          <li>
            מחשב בלי סטיק: <strong>{preview.withoutStick.breakdown || "—"}</strong> ={" "}
            <strong>{preview.withoutStick.total.toLocaleString()} ₪</strong>
          </li>
          <li>
            סטיק בלבד: <strong>{preview.stick.breakdown || "—"}</strong> ={" "}
            <strong>{preview.stick.total.toLocaleString()} ₪</strong>
          </li>
        </ul>
      </div>

      {error && <p className="text-sm font-bold text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "שומר..." : "שמירת המחירון"}
        </button>
        {saved && !pending && (
          <span className="flex items-center gap-1 text-sm font-bold text-teal-dark">
            <Check className="h-4 w-4" />
            נשמר
          </span>
        )}
      </div>
    </div>
  );
}

function toState(p: BranchRentalPricing) {
  return {
    dayPrice: v(p.laptop?.dayPrice),
    weekPrice: v(p.laptop?.weekPrice),
    monthPrice: v(p.laptop?.monthPrice),
    noInternetDayPrice: v(p.laptop?.noInternetDayPrice),
    noInternetWeekPrice: v(p.laptop?.noInternetWeekPrice),
    noInternetMonthPrice: v(p.laptop?.noInternetMonthPrice),
    stickDay1: v(p.stick?.day1),
    stickDay2: v(p.stick?.day2),
    stickDay3plus: v(p.stick?.day3plus),
    stickWeekPrice: v(p.stick?.weekPrice),
    stickMonthPrice: v(p.stick?.monthPrice),
  };
}
