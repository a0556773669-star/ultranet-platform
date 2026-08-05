"use client";

import { useMemo, useReducer, useState } from "react";
import { Bot, User, Sparkles, Loader2, RotateCcw, CheckCircle2, Cpu, Send } from "lucide-react";
import type { ShopAddon, ShopComputerConfig, ShopRecommendedOption, ShopTier, ShopUseCase } from "@ultranet/shared-types";
import {
  USE_CASE_LABELS,
  USE_CASE_ORDER,
  detectUseCase,
  getFollowUpQuestions,
  computeLoadLevel,
  buildRecommendedOptions,
  type ShopFollowUpOption,
  type ShopFollowUpQuestion,
} from "@/lib/shop-recommender";
import { buildQuoteHtmlDocument } from "@/lib/shop-quote";
import { createShopLeadAction } from "./actions";

const TIER_BADGE: Record<ShopTier, string> = { minimal: "מינימלי", recommended: "מומלץ", extreme: "מוגזם" };
const TIER_BADGE_CLASS: Record<ShopTier, string> = {
  minimal: "border-card-border bg-[#f4f6f9] text-muted",
  recommended: "border-teal bg-teal-bg text-teal-dark",
  extreme: "border-purple bg-[#f4ecf8] text-purple",
};

const FALLBACK_ADDONS: { name: string; priceILS?: number }[] = [
  { name: "תיק למחשב" },
  { name: "עכבר אלחוטי" },
  { name: "מקלדת" },
  { name: "דיסק און קי" },
];

type Phase = "intro" | "clarify" | "followup" | "result" | "addons" | "contact" | "done";

type ChatMsg = { id: string; role: "assistant" | "user"; text: string };

interface State {
  phase: Phase;
  messages: ChatMsg[];
  description: string;
  useCase: ShopUseCase | null;
  followUps: ShopFollowUpQuestion[];
  followUpIndex: number;
  answers: { question: string; answer: string }[];
  deltas: number[];
  loadLevel: number | null;
  options: ShopRecommendedOption[] | null;
  selectedTier: ShopTier | null;
  selectedAddonNames: string[];
  submitting: boolean;
  error: string | null;
  leadId: string | null;
}

const initialState: State = {
  phase: "intro",
  messages: [],
  description: "",
  useCase: null,
  followUps: [],
  followUpIndex: 0,
  answers: [],
  deltas: [],
  loadLevel: null,
  options: null,
  selectedTier: null,
  selectedAddonNames: [],
  submitting: false,
  error: null,
  leadId: null,
};

let msgCounter = 0;
function nextId() {
  msgCounter += 1;
  return `m${msgCounter}`;
}
function assistantMsg(text: string): ChatMsg {
  return { id: nextId(), role: "assistant", text };
}
function userMsg(text: string): ChatMsg {
  return { id: nextId(), role: "user", text };
}

type Action =
  | { type: "SUBMIT_DESCRIPTION"; description: string; catalog: ShopComputerConfig[] }
  | { type: "PICK_CATEGORY"; useCase: ShopUseCase }
  | { type: "ANSWER_FOLLOWUP"; option: ShopFollowUpOption; catalog: ShopComputerConfig[] }
  | { type: "SELECT_TIER"; tier: ShopTier }
  | { type: "TOGGLE_ADDON"; name: string }
  | { type: "GO_TO_CONTACT" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS"; leadId: string }
  | { type: "SUBMIT_ERROR"; error: string }
  | { type: "RESTART" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SUBMIT_DESCRIPTION": {
      const desc = action.description.trim();
      const detected = detectUseCase(desc);
      const messages = [...state.messages];
      if (desc) messages.push(userMsg(desc));
      if (detected) {
        messages.push(assistantMsg(`הבנתי - מדובר בעיקר ב${USE_CASE_LABELS[detected]}. בוא נדייק עוד קצת כדי להתאים לך את המחשב הנכון.`));
        const followUps = getFollowUpQuestions(detected);
        messages.push(assistantMsg(followUps[0]!.text));
        return { ...state, description: desc, useCase: detected, followUps, followUpIndex: 0, messages, phase: "followup" };
      }
      messages.push(assistantMsg("לא הצלחתי לזהות בבירור את התחום העיקרי מהתיאור - באיזה מהבאים מדובר בעיקר?"));
      return { ...state, description: desc, messages, phase: "clarify" };
    }
    case "PICK_CATEGORY": {
      const followUps = getFollowUpQuestions(action.useCase);
      const messages = [...state.messages, userMsg(USE_CASE_LABELS[action.useCase]), assistantMsg(followUps[0]!.text)];
      return { ...state, useCase: action.useCase, followUps, followUpIndex: 0, messages, phase: "followup" };
    }
    case "ANSWER_FOLLOWUP": {
      const q = state.followUps[state.followUpIndex]!;
      const answers = [...state.answers, { question: q.text, answer: action.option.label }];
      const deltas = [...state.deltas, action.option.loadDelta];
      const messages = [...state.messages, userMsg(action.option.label)];
      const nextIndex = state.followUpIndex + 1;
      if (nextIndex < state.followUps.length) {
        messages.push(assistantMsg(state.followUps[nextIndex]!.text));
        return { ...state, answers, deltas, messages, followUpIndex: nextIndex };
      }
      const loadLevel = computeLoadLevel(state.useCase as ShopUseCase, deltas);
      const options = buildRecommendedOptions(state.useCase as ShopUseCase, loadLevel, action.catalog);
      messages.push(assistantMsg("על סמך מה ששיתפת, הכנתי לך שלוש אפשרויות - מהתצורה המינימלית הנדרשת ועד תצורה מוגברת לטווח ארוך:"));
      return { ...state, answers, deltas, loadLevel, options, messages, phase: "result" };
    }
    case "SELECT_TIER": {
      const opt = state.options?.find((o) => o.tier === action.tier);
      const messages = [
        ...state.messages,
        userMsg(`בחרתי: ${opt?.title ?? TIER_BADGE[action.tier]}`),
        assistantMsg("מעולה. רוצה להוסיף ציוד נלווה להזמנה?"),
      ];
      return { ...state, selectedTier: action.tier, messages, phase: "addons" };
    }
    case "TOGGLE_ADDON": {
      const has = state.selectedAddonNames.includes(action.name);
      return {
        ...state,
        selectedAddonNames: has
          ? state.selectedAddonNames.filter((n) => n !== action.name)
          : [...state.selectedAddonNames, action.name],
      };
    }
    case "GO_TO_CONTACT": {
      const messages = [...state.messages, assistantMsg("כדי שנוכל להכין הצעת מחיר מסודרת ולחזור אליך, נא להשאיר פרטי קשר:")];
      return { ...state, messages, phase: "contact" };
    }
    case "SUBMIT_START":
      return { ...state, submitting: true, error: null };
    case "SUBMIT_SUCCESS": {
      const messages = [
        ...state.messages,
        assistantMsg("תודה רבה! הצעת המחיר ירדה כקובץ למחשב שלך, ואנחנו נחזור אליך בהקדם להשלמת ההזמנה."),
      ];
      return { ...state, submitting: false, leadId: action.leadId, messages, phase: "done" };
    }
    case "SUBMIT_ERROR":
      return { ...state, submitting: false, error: action.error };
    case "RESTART":
      msgCounter = 0;
      return initialState;
    default:
      return state;
  }
}

function downloadHtmlFile(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function ChatBubble({ msg }: { msg: ChatMsg }) {
  const isAssistant = msg.role === "assistant";
  return (
    <div className={`flex items-start gap-2 ${isAssistant ? "justify-start" : "justify-end"}`}>
      {isAssistant && (
        <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-teal-bg text-teal-dark">
          <Bot className="h-4 w-4" />
        </span>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isAssistant ? "rounded-tr-sm bg-white text-ink shadow-card" : "rounded-tl-sm bg-gradient-to-br from-teal to-teal-light text-white"
        }`}
      >
        {msg.text}
      </div>
      {!isAssistant && (
        <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-ink text-white">
          <User className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}

export function ShopChatClient({
  logoUrl,
  catalog,
  addons,
}: {
  logoUrl: string;
  catalog: ShopComputerConfig[];
  addons: ShopAddon[];
}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [draft, setDraft] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const addonList = useMemo(
    () => (addons.length ? addons.map((a) => ({ name: a.name, priceILS: a.priceILS })) : FALLBACK_ADDONS),
    [addons]
  );

  async function handleSubmitContact() {
    if (!state.useCase || !state.options || !state.selectedTier) return;
    if (!contactEmail.trim() || !contactPhone.trim()) {
      dispatch({ type: "SUBMIT_ERROR", error: "נא למלא אימייל וטלפון" });
      return;
    }
    dispatch({ type: "SUBMIT_START" });
    try {
      const selectedOption = state.options.find((o) => o.tier === state.selectedTier);
      if (!selectedOption) throw new Error("שגיאה בטעינת ההמלצה");
      const result = await createShopLeadAction({
        useCase: state.useCase,
        description: state.description,
        answers: state.answers,
        loadLevel: state.loadLevel ?? 0,
        recommendedOptions: state.options,
        selectedTier: state.selectedTier,
        selectedAddonNames: state.selectedAddonNames,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
      });
      const selectedAddonLines = addonList.filter((a) => state.selectedAddonNames.includes(a.name));
      const html = buildQuoteHtmlDocument({
        logoUrl: logoUrl || undefined,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        useCaseLabel: USE_CASE_LABELS[state.useCase],
        description: state.description,
        selectedOption,
        otherOptions: state.options.filter((o) => o.tier !== state.selectedTier),
        selectedAddons: selectedAddonLines,
        createdAtLabel: new Date().toLocaleDateString("he-IL"),
        leadId: result.id,
      });
      downloadHtmlFile(html, `הצעת-מחיר-אולטרנט-${result.id}.html`);
      dispatch({ type: "SUBMIT_SUCCESS", leadId: result.id });
    } catch (e) {
      dispatch({ type: "SUBMIT_ERROR", error: e instanceof Error ? e.message : "משהו השתבש, נסו שוב" });
    }
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-card-border bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="אולטרנט" className="h-10 w-auto object-contain" />
            ) : (
              <span className="text-xl font-extrabold tracking-tight text-teal">אולטרנט</span>
            )}
            <span className="hidden text-sm text-muted sm:inline">| בניית מחשב מותאם אישית</span>
          </div>
          {state.phase !== "intro" && (
            <button
              onClick={() => {
                dispatch({ type: "RESTART" });
                setDraft("");
                setContactName("");
                setContactEmail("");
                setContactPhone("");
              }}
              className="flex items-center gap-1 rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-muted transition hover:border-teal hover:text-teal"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              התחלה מחדש
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
        {state.phase === "intro" ? (
          <div className="flex flex-col items-center gap-6 py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-bg text-teal-dark">
              <Sparkles className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">בואו נבנה יחד את המחשב המושלם בשבילכם</h1>
              <p className="mt-2 text-sm text-muted sm:text-base">
                ספרו לנו בקצרה למה אתם צריכים את המחשב - העוזר החכם שלנו ישאל כמה שאלות ממוקדות ויציע לכם תצורות מתאימות, כולל הסבר מלא.
              </p>
            </div>
            <div className="w-full max-w-xl rounded-card border border-card-border bg-white p-4 text-right shadow-card">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder='לדוגמה: "אני צריך מחשב לחידושי תורה בלבד" או "מחשב לעריכת וידאו ביוטיוב"'
                rows={3}
                className="w-full resize-none rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none"
              />
              <button
                onClick={() => dispatch({ type: "SUBMIT_DESCRIPTION", description: draft, catalog })}
                disabled={!draft.trim()}
                className="btn-primary mt-3 flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                המשך
              </button>
            </div>
            <div className="w-full max-w-xl">
              <p className="mb-2 text-xs font-semibold text-muted">או בחרו תחום ישירות:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {USE_CASE_ORDER.map((uc) => (
                  <button
                    key={uc}
                    onClick={() => dispatch({ type: "PICK_CATEGORY", useCase: uc })}
                    className="pill-inactive border border-card-border"
                  >
                    {USE_CASE_LABELS[uc]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {state.messages.map((m) => (
              <ChatBubble key={m.id} msg={m} />
            ))}

            {state.phase === "clarify" && (
              <div className="flex flex-wrap gap-2 rounded-card border border-card-border bg-white p-4 shadow-card">
                {USE_CASE_ORDER.map((uc) => (
                  <button
                    key={uc}
                    onClick={() => dispatch({ type: "PICK_CATEGORY", useCase: uc })}
                    className="pill-inactive border border-card-border"
                  >
                    {USE_CASE_LABELS[uc]}
                  </button>
                ))}
              </div>
            )}

            {state.phase === "followup" && (
              <div className="flex flex-col gap-2 rounded-card border border-card-border bg-white p-4 shadow-card">
                {state.followUps[state.followUpIndex]?.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => dispatch({ type: "ANSWER_FOLLOWUP", option: opt, catalog })}
                    className="btn-outline text-right"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {state.phase === "result" && state.options && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {state.options.map((opt) => (
                  <div
                    key={opt.tier}
                    className={`flex flex-col rounded-card border bg-white p-4 shadow-card ${
                      opt.tier === "recommended" ? "border-2 border-teal" : "border-card-border"
                    }`}
                  >
                    <span className={`mb-2 w-fit rounded-full border px-2.5 py-1 text-[11px] font-bold ${TIER_BADGE_CLASS[opt.tier]}`}>
                      {TIER_BADGE[opt.tier]}
                    </span>
                    <div className="mb-1 flex items-center gap-1.5 font-bold text-ink">
                      <Cpu className="h-4 w-4 text-muted" />
                      {opt.title}
                    </div>
                    <p className="text-xs leading-relaxed text-muted">{opt.specsSummary}</p>
                    <p className="mt-2 flex-1 text-xs leading-relaxed text-muted">{opt.reason}</p>
                    <div className="mt-3 text-base font-extrabold text-teal">
                      {typeof opt.priceILS === "number" ? `${opt.priceILS.toLocaleString("he-IL")} ₪` : "יימסר בהצעת מחיר"}
                    </div>
                    <button onClick={() => dispatch({ type: "SELECT_TIER", tier: opt.tier })} className="btn-primary mt-3">
                      בחר אפשרות זו
                    </button>
                  </div>
                ))}
              </div>
            )}

            {state.phase === "addons" && (
              <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
                <div className="mb-3 flex flex-wrap gap-2">
                  {addonList.map((a) => {
                    const active = state.selectedAddonNames.includes(a.name);
                    return (
                      <button
                        key={a.name}
                        onClick={() => dispatch({ type: "TOGGLE_ADDON", name: a.name })}
                        className={active ? "pill-active" : "pill-inactive border border-card-border"}
                      >
                        {a.name} · {typeof a.priceILS === "number" ? `${a.priceILS.toLocaleString("he-IL")} ₪` : "יתומחר בהצעה"}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => dispatch({ type: "GO_TO_CONTACT" })} className="btn-primary w-full">
                  המשך לקבלת הצעת מחיר
                </button>
              </div>
            )}

            {state.phase === "contact" && (
              <div className="flex flex-col gap-3 rounded-card border border-card-border bg-white p-4 shadow-card">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">שם (רשות)</label>
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">אימייל</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    required
                    className="w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">טלפון</label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    required
                    className="w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none"
                  />
                </div>
                {state.error && <p className="text-xs font-semibold text-red-600">{state.error}</p>}
                <button
                  onClick={handleSubmitContact}
                  disabled={state.submitting}
                  className="btn-primary flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {state.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  קבלת הצעת מחיר
                </button>
              </div>
            )}

            {state.phase === "done" && (
              <div className="flex flex-col items-center gap-3 rounded-card border border-card-border bg-white p-6 text-center shadow-card">
                <CheckCircle2 className="h-10 w-10 text-teal" />
                <p className="text-sm text-muted">
                  קובץ הצעת המחיר ירד למחשב שלכם - אפשר לפתוח אותו ואף לשמור כ-PDF ישירות מהדפדפן (הדפסה → שמירה כ-PDF).
                </p>
                <button
                  onClick={() => dispatch({ type: "RESTART" })}
                  className="btn-outline flex items-center gap-1.5"
                >
                  <RotateCcw className="h-4 w-4" />
                  שיחה חדשה
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
