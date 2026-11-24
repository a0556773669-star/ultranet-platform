"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Send, Bot, Copy, Check } from "lucide-react";
import type { AdvisorTurn, ChatOption } from "@/lib/store-advisor";
import { advisorChatAction, createChatRequestAction } from "../actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const money = (n: number) => n.toLocaleString("he-IL");

type Branch = { id: string; name: string };
type Msg = AdvisorTurn & {
  id: number;
  time: string;
  options?: ChatOption[];
  /** רמז לבעלים בלבד כשאין מחירים */
  ownerHint?: string;
  quickReplies?: string[];
  source?: "model" | "faq";
  /** הודעת פתיחה מקומית - לא נשלחת למודל */
  local?: boolean;
};

const WELCOME =
  "שלום! ספרו לי מה הלקוח מחפש, בחופשיות. למשל: למה הוא צריך את המחשב, ואם יש לו תקציב או העדפה. אפשר גם לשאול אותי שאלה כללית (אחריות, אנטיווירוס, זמני אספקה).";
const STARTERS = ["נייד לחידושי תורה", "נייח למשרד", "הלקוח לא יודע מה הוא צריך"];

const nowTime = () => new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

/** המשפט שמנהל הסניף אומר ללקוח לפני בדיקת מלאי. */
function customerSentence(o: ChatOption): string | null {
  if (!o.estimate) return null;
  const acc = o.estimate.accessories.length
    ? ` ${o.estimate.accessories.map((a) => `${a.name} ${money(a.fromILS)}-${money(a.toILS)} ₪`).join(", ")}.`
    : "";
  return `אני יכול לבדוק מלאי. המחיר נע בערך בין ${money(o.estimate.fromILS)} ל-${money(o.estimate.toILS)} ₪.${acc} זה מעניין אותך?`;
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1.5" aria-label="היועץ מקליד">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-teal/60" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* ללא הרשאת לוח - מתעלמים */
        }
      }}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal hover:underline"
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {done ? "הועתק" : "העתקה"}
    </button>
  );
}

export function ChatAdvisor({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [branchId, setBranchId] = useState(branches.length === 1 ? branches[0]!.id : "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showDetails, setShowDetails] = useState(true);
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, role: "assistant", content: WELCOME, time: nowTime(), local: true, quickReplies: STARTERS }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState<string[]>([]);
  const [budget, setBudget] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const idRef = useRef(1);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  const latestOptionsMsg = [...msgs].reverse().find((m) => m.role === "assistant" && m.options?.length);
  const lastMsg = msgs[msgs.length - 1];
  const userTurns = msgs.filter((m) => m.role === "user").length;
  const ready = Boolean(branchId && customerName.trim());

  function patch(id: number, fn: (m: Msg) => Msg) {
    setMsgs((cur) => cur.map((m) => (m.id === id ? fn(m) : m)));
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const userMsg: Msg = { id: idRef.current++, role: "user", content, time: nowTime() };
    const history = [...msgs.filter((m) => !m.local), userMsg];
    setMsgs((cur) => [...cur.map((m) => ({ ...m, quickReplies: undefined })), userMsg]);
    if (ready) setShowDetails(false); // אחרי שהוזנו פרטי הלקוח - יותר מקום לשיחה
    setInput("");
    setBusy(true);
    setError("");
    try {
      const res = await advisorChatAction(history.map(({ role, content: c }) => ({ role, content: c })));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const r = res.data;
      const id = idRef.current++;
      setMsgs((cur) => [
        ...cur,
        { id, role: "assistant", content: r.reply, time: nowTime(), options: r.options, ownerHint: r.ownerHint, quickReplies: r.quickReplies, source: r.source },
      ]);
      if (r.options.length) {
        setLocked(r.lockedFields);
        if (r.budgetILS) setBudget(r.budgetILS);
        if (r.notes) setNotes(r.notes);
      }
    } catch {
      setError("אירעה שגיאה בחיבור לשרת (ייתכן שהתשובה ארכה מדי). נסו לשלוח שוב.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault(); // אין רענון דף - רק הצ'אט מתעדכן
    void send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter שולח, Shift+Enter שורה חדשה (כמו בוואטסאפ). לא שולחים באמצע הקלדת IME.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  }

  function submit(chosenIndex: number | null) {
    if (!ready || !latestOptionsMsg?.options) {
      setShowDetails(true);
      setError("כדי לשמור או לאשר - בחרו סניף והזינו שם לקוח בפרטי הלקוח.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const res = await createChatRequestAction({
          branchId,
          customerName,
          customerPhone,
          transcript: msgs.filter((m) => !m.local).map(({ role, content }) => ({ role, content })),
          options: latestOptionsMsg.options!.map((o) => ({ label: o.label, kind: o.kind, spec: o.spec, whyBetter: o.whyBetter, pros: o.pros, cons: o.cons })),
          chosenIndex,
          lockedFields: locked,
          budgetILS: budget,
          notes,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.push(`/dashboard/store/requests/${res.data.id}`);
      } catch {
        setError("אירעה שגיאה בחיבור לשרת. נסו שוב.");
      }
    });
  }

  return (
    <div className="flex max-w-2xl flex-col overflow-hidden rounded-card border border-card-border bg-white shadow-card" style={{ height: "min(78vh, 46rem)" }}>
      {/* כותרת */}
      <div className="flex items-center justify-between gap-2 border-b border-card-border bg-teal-bg px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal text-white">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-bold text-teal-dark">יועץ התאמת מחשבים</div>
            <div className="text-[11px] text-muted">{busy ? "מקליד..." : "מחובר"}</div>
          </div>
        </div>
        <button type="button" onClick={() => setShowDetails((v) => !v)} className="text-xs font-semibold text-teal hover:underline">
          {showDetails ? "הסתרת פרטי לקוח" : customerName ? `לקוח: ${customerName}` : "פרטי לקוח"}
        </button>
      </div>

      {showDetails ? (
        <div className="grid gap-2 border-b border-card-border bg-[#fafbfc] px-4 py-2.5 md:grid-cols-3">
          {branches.length === 0 ? (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 md:col-span-3">
              אין סניפים לבחירה: המשתמש הזה לא משויך לאף סניף. אפשר לשוחח עם היועץ, אבל לשמירה ולשליחת בקשה צריך לשייך סניף בטופס המשתמשים
              (`/dashboard/users`, ליד ההרשאה ״חנות סניפים״).
            </div>
          ) : null}
          {branches.length > 1 ? (
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={FIELD} aria-label="סניף">
              <option value="">בחירת סניף</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          ) : null}
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="שם הלקוח" className={FIELD} />
          <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="טלפון (רשות)" dir="ltr" className={FIELD} />
        </div>
      ) : null}

      {/* הודעות */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-[#f4f6f9] px-3 py-4 text-sm">
        {msgs.map((m) => {
          const mine = m.role === "user";
          const showCards = m.options?.length && latestOptionsMsg?.id === m.id;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-start" : "items-end"}`}>
              <div
                className={`max-w-[92%] rounded-2xl px-3 py-2 shadow-sm ${
                  mine ? "rounded-tr-sm bg-teal text-white" : "rounded-tl-sm border border-card-border bg-white text-ink"
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                <div className={`mt-0.5 flex items-center gap-2 text-[10px] ${mine ? "text-white/70" : "text-muted"}`}>
                  <span>{m.time}</span>
                  {m.source === "faq" ? <span>· מהשאלות הנפוצות</span> : null}
                </div>
              </div>

              {showCards ? (
                <div className="mt-2 flex w-full max-w-[96%] flex-col gap-2">
                  {m.options!.map((o, idx) => {
                    const sentence = customerSentence(o);
                    return (
                      <div key={idx} className="rounded-xl border border-card-border bg-white p-3 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-ink">{o.label}</span>
                          <span className="rounded-full bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">
                            {o.kind === "upgrade" ? "טיפה יותר טוב" : o.kind === "alternative" ? "חלופה חסכונית" : "לפי הבקשה"}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted">{o.specText}</div>

                        {o.estimate ? (
                          <div className="mt-1.5 font-bold text-teal-dark">
                            בערך {money(o.estimate.fromILS)} - {money(o.estimate.toILS)} ₪
                            <span className="mr-1 text-[11px] font-normal text-muted">(הערכה, לא מחיר סופי)</span>
                          </div>
                        ) : (
                          <div className="mt-1.5 text-xs text-muted">
                            המחיר יימסר אחרי בדיקה
                            {m.ownerHint ? <span className="block text-[11px] text-red-600">אבחון (לבעלים): {m.ownerHint}</span> : null}
                          </div>
                        )}
                        {o.estimate?.accessories.length ? (
                          <div className="mt-0.5 text-xs text-ink">
                            {o.estimate.accessories.map((a) => `${a.name} ${money(a.fromILS)}-${money(a.toILS)} ₪`).join(" · ")}
                          </div>
                        ) : null}

                        {o.whyBetter ? <div className="mt-1.5 text-xs text-ink">{o.whyBetter}</div> : null}
                        {o.pros.length || o.cons.length ? (
                          <ul className="mt-1.5 space-y-0.5 text-xs">
                            {o.pros.map((p, i) => (
                              <li key={`p${i}`} className="text-emerald-700">＋ {p}</li>
                            ))}
                            {o.cons.map((c, i) => (
                              <li key={`c${i}`} className="text-amber-700">－ {c}</li>
                            ))}
                          </ul>
                        ) : null}

                        {sentence ? (
                          <div className="mt-2 rounded-lg bg-[#f4f6f9] px-2.5 py-1.5 text-xs text-ink">
                            <div className="mb-0.5 flex items-center justify-between">
                              <span className="font-semibold text-muted">מה להגיד ללקוח</span>
                              <CopyButton text={sentence} />
                            </div>
                            {sentence}
                          </div>
                        ) : null}

                        <button type="button" disabled={pending} onClick={() => submit(idx)} className="btn-primary mt-2 text-xs disabled:opacity-40">
                          הלקוח מעוניין - בדיקת מלאי
                        </button>
                      </div>
                    );
                  })}
                  <button type="button" disabled={pending} onClick={() => submit(null)} className="w-fit text-xs font-semibold text-teal hover:underline disabled:opacity-40">
                    שמירת ההצעות בלי אישור (הלקוח עדיין חושב)
                  </button>
                </div>
              ) : null}

              {m.quickReplies?.length && lastMsg?.id === m.id && !busy ? (
                <div className="mt-2 flex max-w-[96%] flex-wrap justify-end gap-2">
                  {m.quickReplies.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void send(q)}
                      className="rounded-full border border-teal bg-white px-3.5 py-1.5 text-xs font-bold text-teal-dark transition hover:bg-teal-bg"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        {busy ? (
          <div className="flex justify-end">
            <div className="rounded-2xl rounded-tl-sm border border-card-border bg-white px-3 py-1.5 shadow-sm">
              <TypingDots />
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {error ? <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">{error}</div> : null}

      {/* שורת כתיבה */}
      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-card-border bg-white px-3 py-2.5">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="מה הלקוח אומר?"
          className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-2xl border border-card-border bg-[#f4f6f9] px-4 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none"
          aria-label="הודעה"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal text-white transition hover:opacity-90 disabled:opacity-40"
          aria-label="שליחה"
        >
          <Send className="h-4 w-4 -scale-x-100" />
        </button>
      </form>
      <div className="flex items-center justify-between bg-white px-4 pb-2 text-[11px] text-muted">
        <span>{userTurns ? `${userTurns} הודעות` : "Enter לשליחה, Shift+Enter לשורה חדשה"}</span>
        <a href="/dashboard/store/new?form=1" className="font-semibold text-teal hover:underline">מעבר לטופס הרגיל</a>
      </div>
    </div>
  );
}
