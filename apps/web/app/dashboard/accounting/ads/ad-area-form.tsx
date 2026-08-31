"use client";

/**
 * Create/edit one advertising area, with the split computed live while typing - the whole point
 * of the screen is that the owner types "1200" and "3 סניפים" and immediately sees
 * "יוני 600 ₪ · כל סניף 200 ₪" instead of doing the arithmetic in their head.
 */
import { useState } from "react";
import type { Branch, AdArea } from "@ultranet/shared-types";
import { DEFAULT_AD_OWNER_PCT, splitAdArea } from "@/lib/ad-areas";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

const LABEL = "mb-1 block text-[11px] font-extrabold tracking-wide text-muted";
const FIELD =
  "w-full min-w-0 rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-2 text-[13px] font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none";

export function AdAreaForm({
  branches,
  ownerName,
  action,
  submitLabel,
  area,
  onCancelHref,
}: {
  branches: Branch[];
  ownerName: string;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  area?: AdArea;
  onCancelHref?: string;
}) {
  const [monthlyCost, setMonthlyCost] = useState(area ? String(area.monthlyCost) : "");
  const [ownerPct, setOwnerPct] = useState(String(area?.ownerPct ?? DEFAULT_AD_OWNER_PCT));
  const [selected, setSelected] = useState<string[]>(area?.branchIds ?? []);
  const [countText, setCountText] = useState(area?.branchCount != null ? String(area.branchCount) : "");
  const [countTouched, setCountTouched] = useState(area?.branchCount != null);

  const effectiveCount = countTouched && countText ? Number(countText) : selected.length;
  const split = splitAdArea({
    monthlyCost: Number(monthlyCost) || 0,
    ownerPct: Number(ownerPct) || 0,
    branchIds: selected,
    branchCount: effectiveCount || undefined,
  });
  const countTooSmall = countTouched && countText !== "" && Number(countText) < selected.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (!countTouched) setCountText(String(next.length));
      return next;
    });
  }

  return (
    <form action={action} className="rounded-card border border-card-border bg-white p-3.5 shadow-card">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={LABEL} htmlFor="name">
            אזור / עיר
          </label>
          <input id="name" name="name" defaultValue={area?.name ?? ""} placeholder="קרית ספר" required className={FIELD} />
        </div>
        <div>
          <label className={LABEL} htmlFor="monthlyCost">
            עלות הפרסום לחודש (סה&quot;כ)
          </label>
          <input
            id="monthlyCost"
            name="monthlyCost"
            type="number"
            min={1}
            step="1"
            required
            value={monthlyCost}
            onChange={(e) => setMonthlyCost(e.target.value)}
            placeholder="1200"
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="ownerPct">
            החלק של {ownerName} (%)
          </label>
          <input
            id="ownerPct"
            name="ownerPct"
            type="number"
            min={0}
            max={100}
            step="1"
            value={ownerPct}
            onChange={(e) => setOwnerPct(e.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="branchCount">
            כמה סניפים באזור
          </label>
          <input
            id="branchCount"
            name="branchCount"
            type="number"
            min={1}
            step="1"
            value={countText}
            onChange={(e) => {
              setCountTouched(true);
              setCountText(e.target.value);
            }}
            placeholder={String(selected.length || 1)}
            className={FIELD}
          />
          <p className="mt-1 text-[10.5px] text-muted">
            ברירת מחדל: מספר הסניפים שסימנת. אפשר להגדיל אם יש באזור סניף שעדיין לא במערכת.
          </p>
        </div>
      </div>

      <div className="mt-3">
        <span className={LABEL}>הסניפים שמשלמים על הפרסום הזה</span>
        <div className="flex flex-wrap gap-1.5">
          {branches.length === 0 && <p className="text-xs text-muted">אין סניפים פעילים</p>}
          {branches.map((b) => {
            const on = selected.includes(b.id);
            return (
              <label
                key={b.id}
                className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-[12px] font-bold transition ${
                  on ? "border-teal bg-teal-bg text-teal-dark" : "border-card-border bg-white text-muted hover:border-teal"
                }`}
              >
                <input
                  type="checkbox"
                  name="branchIds"
                  value={b.id}
                  checked={on}
                  onChange={() => toggle(b.id)}
                  className="ml-1.5 align-middle accent-teal"
                />
                {b.location ? `${b.location} — ` : ""}
                {b.name}
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
        <div>
          <label className={LABEL} htmlFor="startMonth">
            מחודש (לא חובה)
          </label>
          <input id="startMonth" name="startMonth" type="month" defaultValue={area?.startMonth ?? ""} className={FIELD} />
        </div>
        <div>
          <label className={LABEL} htmlFor="endMonth">
            עד חודש (לא חובה)
          </label>
          <input id="endMonth" name="endMonth" type="month" defaultValue={area?.endMonth ?? ""} className={FIELD} />
        </div>
        <div>
          <label className={LABEL} htmlFor="paidBy">
            מי משלם בפועל לספק
          </label>
          <select id="paidBy" name="paidBy" defaultValue={area?.paidBy ?? "owner"} className={FIELD}>
            <option value="owner">{ownerName}</option>
            <option value="partner">השותף בסניף</option>
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="note">
            הערה (לא חובה)
          </label>
          <input id="note" name="note" defaultValue={area?.note ?? ""} placeholder="שלט חוצות / עלון" className={FIELD} />
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-teal/30 bg-teal-bg px-3 py-2.5">
        <p className="text-[10.5px] font-extrabold tracking-wide text-teal-dark">החישוב האוטומטי</p>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
          <span className="text-[12.5px] font-bold text-teal-dark">
            סה&quot;כ הקמפיין <b className="text-[15px] tabular-nums">{money(split.monthlyCost)}</b>
          </span>
          <span className="text-[12.5px] font-bold text-teal-dark">
            {ownerName} משלם ({split.ownerPct}%){" "}
            <b className="text-[15px] tabular-nums">{money(split.ownerTotal)}</b>
          </span>
          <span className="text-[12.5px] font-bold text-teal-dark">
            {split.branchCount} סניפים מתחלקים ב-{money(split.branchesTotal)} →{" "}
            <b className="text-[15px] tabular-nums">{money(split.perBranch)}</b> לכל סניף
          </span>
        </div>
        <p className="mt-1 text-[11px] text-teal-dark/80">
          בספר של כל סניף זה נרשם כשורת פרסום של {money(split.perBranchLineTotal)} — החלק של {ownerName}{" "}
          {money(split.perBranchOwnerShare)} והחלק של הסניף {money(split.perBranch)}.
        </p>
        {countTooSmall && (
          <p className="mt-1 text-[11px] font-extrabold text-red-600">
            סימנת {selected.length} סניפים אבל הזנת {countText} — מספר הסניפים באזור לא יכול להיות קטן מזה.
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          className="rounded-lg bg-teal px-3.5 py-2 text-[13px] font-extrabold text-white transition hover:bg-teal-dark"
        >
          {submitLabel}
        </button>
        {onCancelHref && (
          <a href={onCancelHref} className="text-[12.5px] font-bold text-muted hover:underline">
            ביטול
          </a>
        )}
      </div>
    </form>
  );
}
