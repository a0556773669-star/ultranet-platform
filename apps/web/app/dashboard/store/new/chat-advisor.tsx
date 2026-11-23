"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdvisorTurn, ChatOption } from "@/lib/store-advisor";
import { advisorChatAction, createChatRequestAction } from "../actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const money = (n: number) => n.toLocaleString("he-IL");

type Branch = { id: string; name: string };
type Msg = AdvisorTurn & { options?: ChatOption[]; source?: "model" | "faq" };

const STARTERS = ["מחשב נייד לחידושי תורה", "מחשב נייח למשרד", "הלקוח לא יודע מה הוא צריך"];

export function ChatAdvisor({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [branchId, setBranchId] = useState(branches.length === 1 ? branches[0]!.id : "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState<string[]>([]);
  const [budget, setBudget] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  const lastOptions = [...msgs].reverse().find((m) => m.role === "assistant" && m.options?.length)?.options ?? [];
  const userTurns = msgs.filter((m) => m.role === "user").length;

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const r = await advisorChatAction(next.map(({ role, content: c }) => ({ role, content: c })));
      setMsgs([...next, { role: "assistant", content: r.reply, options: r.options, source: r.source }]);
      if (r.options.length) {
        setLocked(r.lockedFields);
        if (r.budgetILS) setBudget(r.budgetILS);
        if (r.notes) setNotes(r.notes);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה ביועץ");
    } finally {
      setBusy(false);
    }
  }

  function submit(chosenIndex: number | null) {
    setError("");
    startTransition(async () => {
      try {
        const res = await createChatRequestAction({
          branchId,
          customerName,
          customerPhone,
          transcript: msgs.map(({ role, content }) => ({ role, content })),
          options: lastOptions.map((o) => ({ label: o.label, kind: o.kind, spec: o.spec, whyBetter: o.whyBetter })),
          chosenIndex,
          lockedFields: locked,
          budgetILS: budget,
          notes,
        });
        router.push(`/dashboard/store/requests/${res.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה בשליחה");
      }
    });
  }

  const ready = Boolean(branchId && customerName.trim());

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <div className="card grid gap-2 md:grid-cols-3">
        {branches.length !== 1 ? (
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

      <div className="card flex flex-col gap-3">
        <div className="flex max-h-[28rem] min-h-[10rem] flex-col gap-2 overflow-y-auto text-sm">
          {!msgs.length ? (
            <div className="flex flex-col gap-2">
              <p className="text-muted">כתבו מה הלקוח מספר, בחופשיות. אפשר גם לשאול שאלה כללית (אחריות, אנטיווירוס, זמני אספקה).</p>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border border-card-border bg-[#f4f6f9] px-3 py-1 text-xs font-bold text-muted hover:border-teal">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "self-start" : "self-end"} style={{ maxWidth: "92%" }}>
              <div className={m.role === "user" ? "rounded-lg bg-[#f4f6f9] px-3 py-1.5" : "rounded-lg bg-teal-bg px-3 py-1.5 text-teal-dark"}>
                {m.content}
                {m.source === "faq" ? <span className="mr-1 text-[10px] text-muted">(מהשאלות הנפוצות)</span> : null}
              </div>
              {m.options?.length && m === [...msgs].reverse().find((x) => x.options?.length) ? (
                <div className="mt-2 flex flex-col gap-2">
                  {m.options.map((o, idx) => (
                    <div key={idx} className="rounded-lg border border-card-border bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-ink">{o.label}</span>
                        <span className="text-[11px] font-bold text-muted">
                          {o.kind === "upgrade" ? "טיפה יותר טוב" : o.kind === "alternative" ? "חלופה חסכונית" : "לפי הבקשה"}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted">{o.specText}</div>
                      {o.estimate ? (
                        <div className="mt-1 font-bold text-teal-dark">
                          בערך {money(o.estimate.fromILS)} - {money(o.estimate.toILS)} ₪
                          <span className="mr-1 text-[11px] font-normal text-muted">(הערכה, לא מחיר סופי)</span>
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-muted">המחיר יימסר אחרי בדיקה</div>
                      )}
                      {o.estimate?.accessories.length ? (
                        <div className="mt-0.5 text-xs text-ink">
                          {o.estimate.accessories.map((a) => `${a.name} ${money(a.fromILS)}-${money(a.toILS)} ₪`).join(" · ")}
                        </div>
                      ) : null}
                      {o.whyBetter ? <div className="mt-1 text-xs text-ink">{o.whyBetter}</div> : null}
                      <button type="button" disabled={!ready || pending} onClick={() => submit(idx)} className="btn-primary mt-2 text-xs disabled:opacity-40">
                        הלקוח מאשר - בדיקת מלאי
                      </button>
                    </div>
                  ))}
                  <button type="button" disabled={!ready || pending} onClick={() => submit(null)} className="w-fit text-xs font-semibold text-teal hover:underline disabled:opacity-40">
                    שמירת ההצעות בלי אישור (הלקוח עדיין חושב)
                  </button>
                  {!ready ? <div className="text-[11px] text-muted">כדי לשמור או לאשר - בחרו סניף והזינו שם לקוח למעלה.</div> : null}
                </div>
              ) : null}
            </div>
          ))}
          {busy ? <div className="self-end text-xs text-muted">היועץ מקליד...</div> : null}
          <div ref={endRef} />
        </div>

        {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="מה הלקוח אומר?"
            className={FIELD}
          />
          <button type="button" disabled={busy || !input.trim()} onClick={() => void send(input)} className="btn-primary disabled:opacity-40">
            שליחה
          </button>
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>{userTurns ? `${userTurns} הודעות בשיחה` : ""}</span>
          <a href="/dashboard/store/new?form=1" className="font-semibold text-teal hover:underline">מעבר לטופס הרגיל</a>
        </div>
      </div>
    </div>
  );
}
