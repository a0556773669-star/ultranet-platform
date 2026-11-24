"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StoreRequestStatus } from "@ultranet/shared-types";
import { accessoryRange, quotedRange } from "@/lib/store-pricing";
import { aiMarketDraftAction, respondStoreRequestAction, setStoreRequestStatusAction } from "../../actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

type Props = {
  id: string;
  requestedSpecText: string;
  upgradeSpecText: string;
  upgradeWhy: string;
  marketPrompt: string;
  status: StoreRequestStatus;
  aiEnabled: boolean;
  isDesktop: boolean;
  extras: string[];
};

function OptionBlock({ prefix, title, defaultLabel, defaultSpec, defaultWhy, presetLow }: { prefix: string; title: string; defaultLabel: string; defaultSpec: string; defaultWhy?: string; presetLow?: string }) {
  const [low, setLow] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  function onLow(v: string) {
    const clean = v.replace(/\D/g, "");
    setLow(clean);
    if (clean) {
      const q = quotedRange(Number(clean));
      setFrom(String(q.from));
      setTo(String(q.to));
    }
  }
  useEffect(() => {
    if (presetLow) onLow(presetLow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetLow]);
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-card-border p-3">
      <legend className="px-1 text-xs font-bold text-ink">{title}</legend>
      <input name={`${prefix}_label`} defaultValue={defaultLabel} placeholder="שם האפשרות" className={FIELD} />
      <input name={`${prefix}_spec`} defaultValue={defaultSpec} placeholder="מפרט" className={FIELD} />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={LABEL}>ממוצע שוק נמוך ₪</label>
          <input name={`${prefix}_low`} value={low} onChange={(e) => onLow(e.target.value)} inputMode="numeric" className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>טווח מ-₪</label>
          <input name={`${prefix}_from`} value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>עד ₪</label>
          <input name={`${prefix}_to`} value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={FIELD} />
        </div>
      </div>
      {prefix !== "opt0" ? (
        <textarea name={`${prefix}_why`} defaultValue={defaultWhy} rows={3} placeholder="במה זה טוב יותר (למנהל הסניף)" className={FIELD} />
      ) : null}
    </fieldset>
  );
}

/** מקלדת ועכבר שנבחרו שניהם מתומחרים כסט אחד; אחד מהם בלבד נשאר כפריט בודד (ולא נספר כשניים בעמלה). */
function accessoryNames(extras: string[]): string[] {
  const both = extras.includes("מקלדת") && extras.includes("עכבר");
  const rest = extras.filter((e) => !(both && (e === "מקלדת" || e === "עכבר")));
  return (both ? ["מקלדת ועכבר", ...rest] : rest).slice(0, 4);
}

function AccessoryBlock({ index, name }: { index: number; name: string }) {
  const [low, setLow] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  function onLow(v: string) {
    const clean = v.replace(/\D/g, "");
    setLow(clean);
    if (clean) {
      const q = accessoryRange(name, Number(clean));
      setFrom(String(q.from));
      setTo(String(q.to));
    }
  }
  const p = `acc${index}`;
  return (
    <div className="grid grid-cols-4 items-end gap-2">
      <div>
        <label className={LABEL}>פריט</label>
        <input name={`${p}_name`} defaultValue={name} className={FIELD} />
      </div>
      <div>
        <label className={LABEL}>שוק נמוך ₪</label>
        <input name={`${p}_low`} value={low} onChange={(e) => onLow(e.target.value)} inputMode="numeric" className={FIELD} />
      </div>
      <div>
        <label className={LABEL}>מ-₪</label>
        <input name={`${p}_from`} value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={FIELD} />
      </div>
      <div>
        <label className={LABEL}>עד ₪</label>
        <input name={`${p}_to`} value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={FIELD} />
      </div>
    </div>
  );
}

export function RespondForm({ id, requestedSpecText, upgradeSpecText, upgradeWhy, marketPrompt, status, aiEnabled, isDesktop, extras }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [aiLow, setAiLow] = useState("");
  const [aiInfo, setAiInfo] = useState("");

  async function runAi() {
    setError("");
    setAiPending(true);
    try {
      const res = await aiMarketDraftAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const d = res.data;
      if (d.lowAverageILS) setAiLow(String(d.lowAverageILS));
      setAiInfo(
        [d.stores.map((x) => `${x.store}: ${x.priceILS.toLocaleString("he-IL")} ₪`).join(" · "), d.upgradeNote].filter(Boolean).join("\n") ||
          "לא נמצאו מחירים אמינים - מלאו ידנית",
      );
    } catch {
      setError("ההכנה האוטומטית לא הסתיימה (ייתכן שארכה מדי). נסו שוב.");
    } finally {
      setAiPending(false);
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(marketPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("ההעתקה נכשלה - סמנו והעתיקו ידנית מהתיבה למטה");
    }
  }

  return (
    <form
      className="card flex flex-col gap-3"
      action={(formData) =>
        startTransition(async () => {
          setError("");
          try {
            const res = await respondStoreRequestAction(id, formData);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            router.refresh();
          } catch {
            setError("אירעה שגיאה בחיבור לשרת. נסו שוב.");
          }
        })
      }
    >
      <h2 className="text-base font-bold text-ink">מענה לסניף (הנהלה)</h2>
      <div className="rounded-lg border border-card-border bg-[#f4f6f9] p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-bold text-ink">סקירת מחירי שוק ב-Claude שלך (בלי עלות API)</span>
          <button type="button" onClick={copyPrompt} className="btn-outline text-xs">
            {copied ? "הועתק" : "העתקת הנחיה"}
          </button>
        </div>
        <textarea readOnly value={marketPrompt} rows={6} className={`${FIELD} text-xs`} />
        <p className="mt-1 text-[11px] text-muted">מדביקים ב-claude.ai, ומזינים למטה את ממוצע השוק הנמוך. הטווח ללקוח = ממוצע + 300 עד 500 ₪ (ניתן לעריכה).</p>
      </div>

      {aiEnabled ? (
        <div className="rounded-lg border border-card-border p-3">
          <button type="button" disabled={aiPending} onClick={runAi} className="btn-outline text-xs disabled:opacity-40">
            {aiPending ? "בודק מחירי שוק..." : "הכנה אוטומטית של מחיר שוק (טיוטה)"}
          </button>
          {aiInfo ? <p className="mt-2 whitespace-pre-line text-xs text-ink">{aiInfo}</p> : null}
          <p className="mt-1 text-[11px] text-muted">טיוטה בלבד - בדקו את המספר לפני שליחה לסניף.</p>
        </div>
      ) : null}

      <OptionBlock prefix="opt0" title="אפשרות 1 - בדיוק מה שהלקוח ביקש" defaultLabel="לפי הבקשה" defaultSpec={requestedSpecText} presetLow={aiLow} />
      <OptionBlock prefix="opt1" title="אפשרות 2 - טיפה יותר טוב (רשות)" defaultLabel={upgradeSpecText ? "שדרוג מומלץ" : ""} defaultSpec={upgradeSpecText} defaultWhy={upgradeWhy} />
      <OptionBlock prefix="opt2" title="אפשרות 3 (רשות)" defaultLabel="" defaultSpec="" />

      {isDesktop || extras.length > 0 ? (
        <fieldset className="flex flex-col gap-2 rounded-lg border border-card-border p-3">
          <legend className="px-1 text-xs font-bold text-ink">ציוד נלווה (מרווח: מסך 100-200, מקלדת ועכבר 30-80, סטיק 30-80)</legend>
          {accessoryNames(extras).map((name, i) => (
            <AccessoryBlock key={name} index={i} name={name} />
          ))}
        </fieldset>
      ) : null}

      <div>
        <label className={LABEL}>הערה לסניף (רשות)</label>
        <textarea name="responseNote" rows={2} className={FIELD} />
      </div>

      {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
      <div className="flex items-center justify-between">
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-40">
          {pending ? "שומר..." : "שליחת התשובה לסניף"}
        </button>
        <div className="flex gap-2">
          {status === "new" ? (
            <button type="button" className="btn-outline text-xs" onClick={() => startTransition(async () => { await setStoreRequestStatusAction(id, "in_review"); router.refresh(); })}>
              סימון ״בבדיקה״
            </button>
          ) : null}
          {status !== "closed" ? (
            <button type="button" className="btn-outline text-xs" onClick={() => startTransition(async () => { await setStoreRequestStatusAction(id, "closed"); router.refresh(); })}>
              סגירה
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
