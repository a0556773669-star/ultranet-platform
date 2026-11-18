"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StoreCpuTier, StoreDeviceKind, StoreRequestMode, StoreSpec } from "@ultranet/shared-types";
import { USAGE_OPTIONS, applyUsageDefaults, fillMissingFromUsage, specToText, storageLabel, suggestUpgrade, type UsageKey } from "@/lib/store-wizard";
import { advisorTurnAction, createStoreRequestAction } from "../actions";
import type { AdvisorResult, AdvisorTurn } from "@/lib/store-advisor";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";
const CHIP_ON = "rounded-full border border-teal bg-teal-bg px-4 py-1.5 text-sm font-bold text-teal-dark";
const CHIP_OFF = "rounded-full border border-card-border bg-[#f4f6f9] px-4 py-1.5 text-sm font-bold text-muted hover:border-teal";

type Branch = { id: string; name: string };
type Pick<T> = T | "unknown";

const CPU_CHOICES: StoreCpuTier[] = ["i3", "i5", "i7"];
const RAM_CHOICES = [8, 16, 32];
const STORAGE_CHOICES = [256, 512, 1000, 2000];
const SCREEN_CHOICES = [14, 15.6, 17];
const DESKTOP_EXTRAS = ["מסך", "מקלדת", "עכבר", "רמקולים"];

function Chips<T extends string | number | boolean>({
  value,
  options,
  onChange,
}: {
  value: Pick<T>;
  options: { value: Pick<T>; label: string }[];
  onChange: (v: Pick<T>) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button type="button" key={String(o.value)} onClick={() => onChange(o.value)} className={value === o.value ? CHIP_ON : CHIP_OFF}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RequestWizard({ branches, aiEnabled }: { branches: Branch[]; aiEnabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [mode, setMode] = useState<StoreRequestMode | null>(null);
  const [step, setStep] = useState(0);

  const [branchId, setBranchId] = useState(branches.length === 1 ? branches[0]!.id : "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [budget, setBudget] = useState("");

  const [kind, setKind] = useState<StoreDeviceKind>("laptop");
  const [usage, setUsage] = useState<UsageKey>("basic");
  const [cpu, setCpu] = useState<Pick<StoreCpuTier>>("unknown");
  const [ram, setRam] = useState<Pick<number>>("unknown");
  const [storage, setStorage] = useState<Pick<number>>("unknown");
  const [screen, setScreen] = useState<Pick<number>>("unknown");
  const [touch, setTouch] = useState<Pick<boolean>>("unknown");
  const [generation, setGeneration] = useState("");
  const [extras, setExtras] = useState<string[]>([]);

  // יועץ ה-AI (שיחה): כשמופעל, "לפי שאלות" מתחיל בשיחה; אפשר לעבור לשאלון הרגיל.
  const [useAi, setUseAi] = useState(aiEnabled);
  const [chat, setChat] = useState<AdvisorTurn[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [aiResult, setAiResult] = useState<AdvisorResult | null>(null);
  const aiMode = mode === "guided" && useAi;

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    const next: AdvisorTurn[] = [...chat, { role: "user", content: text }];
    setChat(next);
    setChatInput("");
    setChatBusy(true);
    setError("");
    try {
      const r = await advisorTurnAction(next);
      setChat([...next, { role: "assistant", content: r.reply }]);
      setAiResult(r);
      if (r.budgetILS && !budget) setBudget(String(r.budgetILS));
      if (r.kind) setKind(r.kind);
      if (r.usage) setUsage(r.usage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה ביועץ");
    } finally {
      setChatBusy(false);
    }
  }

  // מה שהלקוח קבע בוודאות (כל שדה שנבחר) = נעול.
  const { spec, locked } = useMemo(() => {
    if (aiMode && aiResult) {
      const k = aiResult.kind ?? kind;
      const base: StoreSpec = { kind: k };
      if (aiResult.cpu) base.cpu = aiResult.cpu;
      if (aiResult.ramGb) base.ramGb = aiResult.ramGb;
      if (aiResult.storageGb) base.storageGb = aiResult.storageGb;
      if (k === "laptop" && aiResult.screenInches) base.screenInches = aiResult.screenInches;
      if (k === "laptop" && aiResult.touch !== null) base.touch = aiResult.touch;
      if (k === "desktop" && aiResult.extras.length) base.extras = aiResult.extras;
      const lockedAi = aiResult.lockedFields.filter((f): f is keyof StoreSpec => f in base) as (keyof StoreSpec)[];
      return { spec: fillMissingFromUsage(base, aiResult.usage ?? usage), locked: lockedAi };
    }
    const base: StoreSpec = { kind };
    const lockedFields: (keyof StoreSpec)[] = [];
    if (cpu !== "unknown") { base.cpu = cpu; lockedFields.push("cpu"); }
    if (ram !== "unknown") { base.ramGb = ram; lockedFields.push("ramGb"); }
    if (storage !== "unknown") { base.storageGb = storage; lockedFields.push("storageGb"); }
    if (kind === "laptop" && screen !== "unknown") { base.screenInches = screen; lockedFields.push("screenInches"); }
    if (kind === "laptop" && touch !== "unknown") { base.touch = touch; lockedFields.push("touch"); }
    const gen = Number(generation);
    if (gen >= 1) { base.minGeneration = gen; lockedFields.push("minGeneration"); }
    if (kind === "desktop" && extras.length) { base.extras = extras; lockedFields.push("extras"); }
    // באשף השאלות משלימים לפי שימוש את מה שלא נקבע; ב"לפי רצון הלקוח" משאירים כפי שהוזן.
    const completed = mode === "guided" ? applyUsageDefaults(base, usage, lockedFields) : base;
    return { spec: completed, locked: lockedFields };
  }, [kind, cpu, ram, storage, screen, touch, generation, extras, usage, mode, aiMode, aiResult]);

  const upgrade = useMemo(() => suggestUpgrade(spec, locked), [spec, locked]);

  const answers = useMemo(() => {
    if (aiMode) {
      return chat
        .map((t, i) => (t.role === "user" ? { question: chat[i - 1]?.content ?? "פתיחה", answer: t.content } : null))
        .filter((a): a is { question: string; answer: string } => a !== null);
    }
    if (mode !== "guided") return [];
    const out = [
      { question: "נייד או נייח", answer: kind === "laptop" ? "נייד" : "נייח" },
      { question: "סוג שימוש", answer: USAGE_OPTIONS.find((u) => u.key === usage)?.label ?? "" },
    ];
    if (kind === "laptop") {
      out.push({ question: "גודל מסך", answer: screen === "unknown" ? "לא יודע" : `${screen} אינץ'` });
      out.push({ question: "מסך מגע", answer: touch === "unknown" ? "לא יודע" : touch ? "כן" : "לא" });
    }
    out.push({ question: "אחסון", answer: storage === "unknown" ? "לא יודע" : storageLabel(storage) });
    out.push({ question: "זיכרון", answer: ram === "unknown" ? "לא יודע" : `${ram}GB` });
    if (kind === "desktop") out.push({ question: "ציוד נלווה", answer: extras.join(", ") || "ללא" });
    return out;
  }, [mode, aiMode, chat, kind, usage, screen, touch, storage, ram, extras]);

  const guidedSteps = kind === "laptop" ? ["kind", "usage", "screen", "touch", "storage", "ram", "budget", "details"] : ["kind", "usage", "storage", "ram", "extras", "budget", "details"];
  const specSteps = ["spec", "details"];
  const steps = aiMode ? ["chat", "details"] : mode === "guided" ? guidedSteps : specSteps;
  const current = steps[step];
  const isLast = step === steps.length - 1;

  function submit() {
    setError("");
    startTransition(async () => {
      try {
        const res = await createStoreRequestAction({
          branchId,
          mode: mode!,
          customerName,
          customerPhone,
          budgetILS: budget ? Number(budget) : undefined,
          spec,
          lockedFields: locked,
          usage: mode === "guided" && !aiMode ? usage : undefined,
          answers,
          notes,
        });
        router.push(`/dashboard/store/requests/${res.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה בשליחה");
      }
    });
  }

  if (!mode) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <button type="button" onClick={() => { setMode("spec"); setStep(0); }} className="card text-right transition hover:border-teal">
          <div className="text-base font-bold text-ink">לפי רצון הלקוח</div>
          <p className="mt-1 text-sm text-muted">הלקוח יודע מה הוא רוצה (״i3, 8 ג׳יגה, 15.6 אינץ׳״). מה שנבחר - לא משתנה.</p>
        </button>
        <button type="button" onClick={() => { setMode("guided"); setUseAi(aiEnabled); setStep(0); }} className="card text-right transition hover:border-teal">
          <div className="text-base font-bold text-ink">לפי שאלות</div>
          <p className="mt-1 text-sm text-muted">הלקוח לא יודע. {aiEnabled ? "יועץ חכם מנהל איתכם שיחה קצרה" : "שואלים אותו כמה שאלות פשוטות"} והמערכת מתאימה מפרט.</p>
        </button>
      </div>
    );
  }

  return (
    <div className="card flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{mode === "guided" ? "התאמה לפי שאלות" : "לפי רצון הלקוח"} · שלב {step + 1} מתוך {steps.length}</span>
        <button type="button" onClick={() => { setMode(null); setStep(0); }} className="font-semibold text-teal hover:underline">
          החלפת שיטה
        </button>
      </div>

      {current === "chat" && (
        <div className="flex flex-col gap-3">
          <div className="text-sm font-bold text-ink">שיחה עם היועץ - כתבו מה הלקוח מספר</div>
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-lg border border-card-border bg-[#f4f6f9] p-3 text-sm">
            {!chat.length ? <div className="text-muted">למשל: ״הלקוח רוצה מחשב נייד לחידושי תורה״ או ״הוא עושה גרפיקה ולא יודע מה לקנות״.</div> : null}
            {chat.map((t, i) => (
              <div key={i} className={t.role === "user" ? "self-start rounded-lg bg-white px-3 py-1.5" : "self-end rounded-lg bg-teal-bg px-3 py-1.5 text-teal-dark"}>
                {t.content}
              </div>
            ))}
            {chatBusy ? <div className="text-xs text-muted">היועץ חושב...</div> : null}
          </div>
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void sendChat(); } }}
              placeholder="מה הלקוח אומר?"
              className={FIELD}
            />
            <button type="button" disabled={chatBusy || !chatInput.trim()} onClick={() => void sendChat()} className="btn-primary disabled:opacity-40">שליחה</button>
          </div>
          {aiResult?.done ? <div className="rounded-lg bg-teal-bg px-3 py-2 text-xs font-semibold text-teal-dark">היועץ סיים. אפשר להמשיך לסיכום.</div> : null}
          <button type="button" onClick={() => { setUseAi(false); setStep(0); }} className="w-fit text-xs font-semibold text-teal hover:underline">
            מעבר לשאלון הרגיל (בלי AI)
          </button>
        </div>
      )}

      {current === "kind" && (
        <div>
          <div className="mb-2 text-sm font-bold text-ink">נייד או נייח?</div>
          <Chips<StoreDeviceKind> value={kind} options={[{ value: "laptop", label: "נייד" }, { value: "desktop", label: "נייח" }]} onChange={(v) => setKind(v as StoreDeviceKind)} />
        </div>
      )}

      {current === "usage" && (
        <div>
          <div className="mb-2 text-sm font-bold text-ink">מה הלקוח הולך לעשות עם המחשב?</div>
          <div className="flex flex-col gap-2">
            {USAGE_OPTIONS.map((u) => (
              <button type="button" key={u.key} onClick={() => setUsage(u.key)} className={`rounded-lg border px-3 py-2 text-right text-sm ${usage === u.key ? "border-teal bg-teal-bg" : "border-card-border bg-[#f4f6f9]"}`}>
                <span className="font-bold text-ink">{u.label}</span>
                <span className="block text-xs text-muted">{u.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {current === "spec" && (
        <div className="flex flex-col gap-3">
          <div>
            <div className={LABEL}>סוג</div>
            <Chips<StoreDeviceKind> value={kind} options={[{ value: "laptop", label: "נייד" }, { value: "desktop", label: "נייח" }]} onChange={(v) => setKind(v as StoreDeviceKind)} />
          </div>
          <div>
            <div className={LABEL}>מעבד (אם לא נבחר - לא נעול)</div>
            <Chips<StoreCpuTier> value={cpu} options={[{ value: "unknown", label: "לא קבע" }, ...CPU_CHOICES.map((c) => ({ value: c, label: c }))]} onChange={setCpu} />
          </div>
          <div>
            <div className={LABEL}>זיכרון</div>
            <Chips<number> value={ram} options={[{ value: "unknown", label: "לא קבע" }, ...RAM_CHOICES.map((r) => ({ value: r, label: `${r}GB` }))]} onChange={setRam} />
          </div>
          <div>
            <div className={LABEL}>אחסון</div>
            <Chips<number> value={storage} options={[{ value: "unknown", label: "לא קבע" }, ...STORAGE_CHOICES.map((s) => ({ value: s, label: storageLabel(s) }))]} onChange={setStorage} />
          </div>
          {kind === "laptop" && (
            <>
              <div>
                <div className={LABEL}>גודל מסך</div>
                <Chips<number> value={screen} options={[{ value: "unknown", label: "לא קבע" }, ...SCREEN_CHOICES.map((s) => ({ value: s, label: `${s}"` }))]} onChange={setScreen} />
              </div>
              <div>
                <div className={LABEL}>מסך מגע</div>
                <Chips<boolean> value={touch} options={[{ value: "unknown", label: "לא קבע" }, { value: false, label: "בלי מגע" }, { value: true, label: "עם מגע" }]} onChange={setTouch} />
              </div>
            </>
          )}
          {kind === "desktop" && <ExtrasPicker extras={extras} setExtras={setExtras} />}
          <div>
            <label className={LABEL}>דור מעבד מינימלי (רשות - למשל 12; ריק = דור 12 ומעלה)</label>
            <input value={generation} onChange={(e) => setGeneration(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={FIELD} placeholder="12" />
          </div>
          <div>
            <label className={LABEL}>תקציב שהלקוח אמר (₪, רשות)</label>
            <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={FIELD} />
          </div>
        </div>
      )}

      {current === "screen" && (
        <div>
          <div className="mb-2 text-sm font-bold text-ink">גודל מסך?</div>
          <Chips<number> value={screen} options={[{ value: "unknown", label: "לא יודע" }, ...SCREEN_CHOICES.map((s) => ({ value: s, label: `${s}"` }))]} onChange={setScreen} />
        </div>
      )}
      {current === "touch" && (
        <div>
          <div className="mb-2 text-sm font-bold text-ink">צריך מסך מגע?</div>
          <Chips<boolean> value={touch} options={[{ value: "unknown", label: "לא יודע" }, { value: false, label: "לא" }, { value: true, label: "כן" }]} onChange={setTouch} />
        </div>
      )}
      {current === "storage" && (
        <div>
          <div className="mb-2 text-sm font-bold text-ink">כמה אחסון? (ספרים, קבצים, תמונות)</div>
          <Chips<number> value={storage} options={[{ value: "unknown", label: "לא יודע - לפי השימוש" }, ...STORAGE_CHOICES.map((s) => ({ value: s, label: storageLabel(s) }))]} onChange={setStorage} />
        </div>
      )}
      {current === "ram" && (
        <div>
          <div className="mb-2 text-sm font-bold text-ink">כמה זיכרון (RAM)?</div>
          <Chips<number> value={ram} options={[{ value: "unknown", label: "לא יודע - לפי השימוש" }, ...RAM_CHOICES.map((r) => ({ value: r, label: `${r}GB` }))]} onChange={setRam} />
        </div>
      )}
      {current === "extras" && <ExtrasPicker extras={extras} setExtras={setExtras} />}
      {current === "budget" && (
        <div>
          <label className="mb-2 block text-sm font-bold text-ink">מה התקציב שהלקוח רוצה לשלם? (₪, רשות)</label>
          <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={FIELD} />
        </div>
      )}

      {current === "details" && (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-teal bg-teal-bg p-3 text-sm">
            <div className="font-bold text-teal-dark">המפרט שהתקבל</div>
            <div className="mt-1 text-ink">{specToText(spec)}</div>
            {upgrade ? (
              <div className="mt-2 border-t border-teal/30 pt-2 text-xs text-ink">
                <div className="font-bold text-teal-dark">אפשרות ״טיפה יותר טוב״ (תוצע ללקוח לצד המפרט)</div>
                <div className="mt-0.5">{specToText(upgrade.spec)}</div>
                <ul className="mt-1 list-disc pr-4">
                  {upgrade.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-2 text-xs text-muted">כל השדות נקבעו ע״י הלקוח - ללא הצעת שדרוג.</div>
            )}
          </div>
          {branches.length !== 1 && (
            <div>
              <label className={LABEL}>סניף</label>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={FIELD}>
                <option value="">בחירת סניף</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={LABEL}>שם הלקוח</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>טלפון הלקוח (רשות)</label>
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} dir="ltr" className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>הערות (רשות)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={FIELD} />
          </div>
          <p className="text-xs text-muted">המחיר שיוחזר הוא טווח הערכה לפי מחירי שוק, לא מחיר סופי.</p>
        </div>
      )}

      {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}

      <div className="flex items-center justify-between">
        <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="btn-outline disabled:opacity-40">
          הקודם
        </button>
        {isLast ? (
          <button type="button" disabled={pending || !branchId || !customerName.trim()} onClick={submit} className="btn-primary disabled:opacity-40">
            {pending ? "שולח..." : "שליחת הבקשה אלינו"}
          </button>
        ) : (
          <button type="button" disabled={current === "chat" && !aiResult?.kind} onClick={() => setStep((s) => s + 1)} className="btn-primary disabled:opacity-40">
            {current === "chat" ? "המשך לסיכום" : "הבא"}
          </button>
        )}
      </div>
    </div>
  );
}

function ExtrasPicker({ extras, setExtras }: { extras: string[]; setExtras: (v: string[]) => void }) {
  return (
    <div>
      <div className="mb-2 text-sm font-bold text-ink">ציוד נלווה לנייח</div>
      <div className="flex flex-wrap gap-2">
        {DESKTOP_EXTRAS.map((e) => {
          const on = extras.includes(e);
          return (
            <button type="button" key={e} onClick={() => setExtras(on ? extras.filter((x) => x !== e) : [...extras, e])} className={on ? CHIP_ON : CHIP_OFF}>
              {e}
            </button>
          );
        })}
      </div>
    </div>
  );
}
