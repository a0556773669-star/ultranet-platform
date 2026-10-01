"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, PlayCircle, Search, Send, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { searchFaqs } from "@/lib/help/search";
import type { HelpFaq } from "@/lib/help/types";
import type { ChatTurn } from "@/lib/help/types";
import { askHelpAction, markHelpfulAction, type HelpAnswer } from "./actions";

type Faq = Pick<HelpFaq, "id" | "question" | "answer" | "tags">;
type Group = { module: string; label: string; faqs: Faq[] };

type Turn =
  | { kind: "question"; text: string }
  | { kind: "answer"; data: HelpAnswer; helpful?: boolean }
  | { kind: "error"; text: string };

type Props = {
  groups: Group[];
  aiEnabled: boolean;
  video: { src: string; title: string };
};

const EXAMPLES_FALLBACK = ["איך מתחילים השכרה חדשה?", "איך מחזירים מחשב?", "איך מוסיפים לקוח?"];

/** הדגשה בסיסית: **טקסט** ושורות — מספיק לתשובות העוזר ולשאלות הנפוצות. */
function RichText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1 text-sm leading-relaxed text-ink">
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const parts = line.replace(/^#+\s*/, "").split(/(\*\*[^*]+\*\*)/g);
        const content: ReactNode[] = parts.map((p, j) =>
          p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : <Fragment key={j}>{p}</Fragment>,
        );
        return <p key={i}>{content}</p>;
      })}
    </div>
  );
}

export function HelpClient({ groups, aiEnabled, video }: Props) {
  const allFaqs = useMemo(
    () => groups.flatMap((g) => g.faqs.map((f) => ({ ...f, audience: "owner" as const, module: g.module }))),
    [groups],
  );
  const examples = useMemo(() => {
    const picks = allFaqs.slice(0, 40).filter((_, i) => i % 9 === 0).slice(0, 4).map((f) => f.question);
    return picks.length ? picks : EXAMPLES_FALLBACK;
  }, [allFaqs]);

  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [filter, setFilter] = useState("");
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoMissing, setVideoMissing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // הצעות מיידיות בזמן ההקלדה — מהשאלות הנפוצות, בלי לחכות לשרת.
  const suggestions = useMemo(
    () => (question.trim().length >= 3 ? searchFaqs(allFaqs, question, 3).map((m) => m.faq) : []),
    [allFaqs, question],
  );

  const filteredGroups = useMemo(() => {
    if (!filter.trim()) return groups;
    const hits = new Set(searchFaqs(allFaqs, filter, 30).map((m) => m.faq.id));
    const plain = filter.trim();
    return groups
      .map((g) => ({
        ...g,
        faqs: g.faqs.filter((f) => hits.has(f.id) || f.question.includes(plain) || f.tags.some((t) => t.includes(plain))),
      }))
      .filter((g) => g.faqs.length > 0);
  }, [allFaqs, filter, groups]);

  useEffect(() => {
    if (turns.length) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    const history = turns.flatMap((t): ChatTurn[] =>
      t.kind === "question"
        ? [{ role: "user", content: t.text }]
        : t.kind === "answer"
          ? [{ role: "assistant", content: t.data.answer }]
          : [],
    );
    setTurns((prev) => [...prev, { kind: "question", text: q }]);
    setQuestion("");
    setPending(true);
    try {
      const data = await askHelpAction(q, history);
      setTurns((prev) => [...prev, { kind: "answer", data }]);
    } catch (err) {
      setTurns((prev) => [
        ...prev,
        { kind: "error", text: err instanceof Error && err.message ? err.message : "אירעה שגיאה. נסו שוב." },
      ]);
    } finally {
      setPending(false);
    }
  }

  function showFaq(faq: Faq) {
    setTurns((prev) => [
      ...prev,
      { kind: "question", text: faq.question },
      { kind: "answer", data: { id: null, answer: faq.answer, source: "faq", related: [] } },
    ]);
    setQuestion("");
  }

  async function rate(index: number, helpful: boolean) {
    const turn = turns[index];
    if (!turn || turn.kind !== "answer" || turn.helpful !== undefined) return;
    setTurns((prev) => prev.map((t, i) => (i === index && t.kind === "answer" ? { ...t, helpful } : t)));
    if (turn.data.id) await markHelpfulAction(turn.data.id, helpful).catch(() => undefined);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
      {/* ---- שאלה ותשובה ---- */}
      <section className="card flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 text-base font-bold text-ink">
          <Sparkles className="h-4 w-4 text-teal" />
          {"שאלו שאלה"}
        </h2>
        <p className="text-xs text-muted">
          {aiEnabled
            ? "העוזר החכם מכיר את כל מסכי המערכת שאתם רואים, ועונה צעד אחרי צעד."
            : "כתבו את השאלה במילים שלכם — נמצא לכם את התשובה המתאימה מהמדריך."}
        </p>

        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => ask(ex)}
                className="rounded-full border border-card-border bg-[#f4f6f9] px-3 py-1 text-xs text-ink transition hover:border-teal hover:text-teal-dark"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {turns.length > 0 && (
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto rounded-lg bg-[#f7f9fb] p-3">
            {turns.map((turn, i) =>
              turn.kind === "question" ? (
                <div key={i} className="max-w-[85%] self-start rounded-2xl rounded-tr-sm bg-teal px-4 py-2 text-sm text-white">
                  {turn.text}
                </div>
              ) : turn.kind === "error" ? (
                <div key={i} className="self-end rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {turn.text}
                </div>
              ) : (
                <div key={i} className="flex max-w-[92%] flex-col gap-2 self-end rounded-2xl rounded-tl-sm border border-card-border bg-white px-4 py-3">
                  <RichText text={turn.data.answer} />
                  {turn.data.related.length > 0 && (
                    <div className="flex flex-col gap-1 border-t border-card-border pt-2">
                      <span className="text-[11px] font-semibold text-muted">{"שאלות קשורות:"}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {turn.data.related.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => showFaq({ ...r, tags: [] })}
                            className="rounded-full bg-teal-bg px-2.5 py-0.5 text-[11px] text-teal-dark hover:underline"
                          >
                            {r.question}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {turn.data.id && (
                    <div className="flex items-center gap-2 text-[11px] text-muted">
                      {turn.helpful === undefined ? (
                        <>
                          <span>{"התשובה עזרה?"}</span>
                          <button type="button" onClick={() => rate(i, true)} className="rounded p-1 hover:bg-teal-bg" aria-label="עזר">
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => rate(i, false)} className="rounded p-1 hover:bg-red-50" aria-label="לא עזר">
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <span>{turn.helpful ? "תודה! שמחנו לעזור." : "תודה — הבעלים יראה את השאלה וישפר את ההסבר."}</span>
                      )}
                    </div>
                  )}
                </div>
              ),
            )}
            {pending && (
              <div className="self-end rounded-2xl border border-card-border bg-white px-4 py-2 text-sm text-muted">
                {"מחפש תשובה…"}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-end gap-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask(question);
                }
              }}
              rows={2}
              placeholder="למשל: הלקוח החזיר את המחשב, מה עושים?"
              className="min-h-[52px] flex-1 resize-y rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={pending || !question.trim()}
              className="flex h-[52px] items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {"שאל"}
            </button>
          </div>
          {suggestions.length > 0 && !pending && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted">{"אולי התכוונתם:"}</span>
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => showFaq(s)}
                  className="self-start text-right text-xs text-teal-dark hover:underline"
                >
                  {s.question}
                </button>
              ))}
            </div>
          )}
        </form>
      </section>

      <div className="flex flex-col gap-4">
        {/* ---- סרטון הדרכה ---- */}
        {!videoMissing && (
          <section className="card flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setVideoOpen((v) => !v)}
              className="flex items-center justify-between text-right"
            >
              <span className="flex items-center gap-1.5 text-base font-bold text-ink">
                <PlayCircle className="h-4 w-4 text-teal" />
                {video.title}
              </span>
              <ChevronDown className={`h-4 w-4 text-muted transition ${videoOpen ? "rotate-180" : ""}`} />
            </button>
            {videoOpen ? (
              <video
                src={video.src}
                controls
                preload="metadata"
                className="w-full rounded-lg border border-card-border bg-black"
                onError={() => setVideoMissing(true)}
              />
            ) : (
              <p className="text-xs text-muted">{"סרטון עם הסבר קולי וכתוביות על כל מה שאתם רואים במערכת. לחצו לצפייה."}</p>
            )}
          </section>
        )}

        {/* ---- שאלות נפוצות ---- */}
        <section className="card flex flex-col gap-3">
          <h2 className="text-base font-bold text-ink">{"שאלות נפוצות"}</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="חיפוש בשאלות…"
              className="w-full rounded-lg border border-card-border bg-[#f4f6f9] py-2 pl-3 pr-9 text-sm"
            />
          </div>
          <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
            {filteredGroups.length === 0 && <p className="text-sm text-muted">{"לא נמצאו שאלות מתאימות."}</p>}
            {filteredGroups.map((g) => (
              <div key={g.module} className="flex flex-col gap-1">
                <h3 className="text-xs font-bold text-teal-dark">{g.label}</h3>
                {g.faqs.map((f) => (
                  <div key={f.id} className="rounded-lg border border-card-border">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(openFaq === f.id ? null : f.id)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-right text-sm text-ink hover:bg-[#f7f9fb]"
                    >
                      <span>{f.question}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${openFaq === f.id ? "rotate-180" : ""}`} />
                    </button>
                    {openFaq === f.id && (
                      <div className="border-t border-card-border bg-[#fbfcfd] px-3 py-2">
                        <RichText text={f.answer} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
