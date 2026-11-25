"use client";

import { useEffect, useState, useTransition } from "react";
import type { StorePriceGuide } from "@ultranet/shared-types";
import { useRouter } from "next/navigation";
import { refreshPriceGuideNowAction, savePriceGuideAction } from "../actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none";

type Vals = Record<string, string>;

function fromGuide(g: StorePriceGuide): Vals {
  const v: Vals = {};
  const put = (prefix: string, o: Partial<Record<string, number>>) => {
    for (const [k, n] of Object.entries(o))
      if (typeof n === "number") v[`${prefix}_${k}`] = String(n);
  };
  put("lb", g.laptopBase);
  put("db", g.desktopBase);
  put("ram", g.ramAdd);
  put("st", g.storageAdd);
  put("acc", g.accessoriesLow);
  if (g.touchAdd) v.touch = String(g.touchAdd);
  if (g.screen17Add) v.s17 = String(g.screen17Add);
  return v;
}

const Row = ({
  name,
  label,
  vals,
  set,
}: {
  name: string;
  label: string;
  vals: Vals;
  set: (k: string, v: string) => void;
}) => (
  <div>
    <label className="mb-1 block text-xs font-semibold text-muted">
      {label}
    </label>
    <input
      name={name}
      value={vals[name] ?? ""}
      onChange={(e) => set(name, e.target.value.replace(/\D/g, ""))}
      inputMode="numeric"
      className={FIELD}
    />
  </div>
);

export function PricesForm({
  guide,
  aiEnabled,
}: {
  guide: StorePriceGuide;
  aiEnabled: boolean;
}) {
  const [vals, setVals] = useState<Vals>(fromGuide(guide));
  const [note, setNote] = useState(guide.note ?? "");
  // אחרי עדכון אוטומטי הדף נטען מחדש עם מחירים חדשים - מרעננים את השדות בלי לאבד את הודעת התוצאה
  useEffect(() => {
    setVals(fromGuide(guide));
    setNote(guide.note ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.updatedAt]);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aiBusy, setAiBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));

  async function refresh() {
    setAiBusy(true);
    setMsg("");
    try {
      const res = await refreshPriceGuideNowAction();
      if (!res.ok) {
        setMsg(`העדכון נכשל: ${res.error}`);
        return;
      }
      const r = res.data;
      setMsg(
        `המחירון עודכן ונשמר (נסרקו ${r.scanned} תצורות).${r.rejected.length ? ` נדחו ${r.rejected.length} ערכים לא סבירים: ${r.rejected.slice(0, 3).join("; ")}` : ""}`,
      );
      router.refresh();
    } catch {
      setMsg(
        "העדכון לא הסתיים - ייתכן שהסריקה ארכה מדי (מעל דקה) ונחתכה. רעננו את הדף: אם המחירים התעדכנו, הכול תקין; אחרת נסו שוב.",
      );
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <form
      className="card flex flex-col gap-4"
      action={(fd) =>
        startTransition(async () => {
          try {
            await savePriceGuideAction(fd);
            setMsg("נשמר");
          } catch (e) {
            setMsg(e instanceof Error ? e.message : "שגיאה בשמירה");
          }
        })
      }
    >
      <p className="text-xs text-muted">
        מחיר שוק <b>נמוך</b> בשקלים (בלי מרווח). הצ׳אט מוסיף לבד 300-500 ₪ למחשב
        ומרווח קטן לאביזר, ומציג לסניף טווח הערכה. מחשב ייחוס: 8GB זיכרון, 256GB
        אחסון, נייד 15.6 בלי מגע; בנייח - המחשב בלבד בלי מסך.
      </p>

      <div>
        <div className="mb-1 text-sm font-bold text-ink">
          מחשב נייד - מחיר בסיס
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Row name="lb_i3" label="i3" vals={vals} set={set} />
          <Row name="lb_i5" label="i5" vals={vals} set={set} />
          <Row name="lb_i7" label="i7" vals={vals} set={set} />
        </div>
      </div>
      <div>
        <div className="mb-1 text-sm font-bold text-ink">
          מחשב נייח (בלי מסך) - מחיר בסיס
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Row name="db_i3" label="i3" vals={vals} set={set} />
          <Row name="db_i5" label="i5" vals={vals} set={set} />
          <Row name="db_i7" label="i7" vals={vals} set={set} />
        </div>
      </div>
      <div>
        <div className="mb-1 text-sm font-bold text-ink">תוספות למחיר</div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Row
            name="ram_16"
            label="זיכרון 16GB (מעל 8)"
            vals={vals}
            set={set}
          />
          <Row name="ram_32" label="זיכרון 32GB" vals={vals} set={set} />
          <Row
            name="st_512"
            label="אחסון 512GB (מעל 256)"
            vals={vals}
            set={set}
          />
          <Row name="st_1000" label="אחסון טרה" vals={vals} set={set} />
          <Row name="st_2000" label="אחסון 2 טרה" vals={vals} set={set} />
          <Row name="touch" label="מסך מגע" vals={vals} set={set} />
          <Row name="s17" label="מסך 17 אינץ'" vals={vals} set={set} />
        </div>
      </div>
      <div>
        <div className="mb-1 text-sm font-bold text-ink">
          אביזרים - מחיר שוק נמוך
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <Row
            name="acc_monitor"
            label="מסך עד 24 אינץ'"
            vals={vals}
            set={set}
          />
          <Row
            name="acc_monitor27"
            label="מסך 27 אינץ'"
            vals={vals}
            set={set}
          />
          <Row
            name="acc_monitor32"
            label="מסך 32 אינץ'"
            vals={vals}
            set={set}
          />
          <Row
            name="acc_keyboardMouse"
            label="מקלדת ועכבר אלחוטיים (סט)"
            vals={vals}
            set={set}
          />
          <Row name="acc_keyboard" label="מקלדת" vals={vals} set={set} />
          <Row name="acc_mouse" label="עכבר" vals={vals} set={set} />
          <Row name="acc_stick" label="סטיק" vals={vals} set={set} />
          <Row name="acc_speakers" label="רמקולים" vals={vals} set={set} />
        </div>
      </div>
      <input
        name="note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="הערה (רשות)"
        className={FIELD}
      />

      {msg ? (
        <div className="rounded-lg bg-[#f4f6f9] px-3 py-2 text-sm font-semibold text-ink">
          {msg}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary disabled:opacity-40"
        >
          שמירה
        </button>
        {aiEnabled ? (
          <button
            type="button"
            disabled={aiBusy}
            onClick={refresh}
            className="btn-primary disabled:opacity-40"
          >
            {aiBusy
              ? "סורק את השוק... (עד דקה, אל תסגרו את הדף)"
              : "עדכון המחירון עכשיו מהשוק (אוטומטי, שומר מיד)"}
          </button>
        ) : null}
      </div>
      {guide.updatedAt ? (
        <div className="text-[11px] text-muted">
          עודכן לאחרונה: {new Date(guide.updatedAt).toLocaleString("he-IL")}
        </div>
      ) : null}
    </form>
  );
}
