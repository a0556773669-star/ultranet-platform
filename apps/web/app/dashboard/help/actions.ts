"use server";

import { getServerSession } from "next-auth";
import type { HelpQuestion } from "@ultranet/shared-types";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { helpScopeFor, searchFaqs } from "@/lib/help/knowledge";
import { askAssistant, assistantConfigured, type ChatTurn } from "@/lib/help/assistant";

const COLLECTION = "n_help_questions";
const MAX_QUESTION = 1000;

export type HelpAnswer = {
  id: string | null;
  answer: string;
  source: HelpQuestion["source"];
  related: { id: string; question: string; answer: string }[];
};

export async function askHelpAction(question: string, history: ChatTurn[]): Promise<HelpAnswer> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("יש להתחבר מחדש");

  const q = question.trim().slice(0, MAX_QUESTION);
  if (!q) throw new Error("נא לכתוב שאלה");

  const scope = helpScopeFor(session);
  const matches = searchFaqs(scope.faqs, q, 4);
  const related = matches.map((m) => ({ id: m.faq.id, question: m.faq.question, answer: m.faq.answer }));

  let answer: string;
  let source: HelpQuestion["source"];
  let shownRelated = related;

  const cleanHistory = (Array.isArray(history) ? history : [])
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));

  if (assistantConfigured()) {
    try {
      answer = await askAssistant(scope, cleanHistory, q);
      source = "ai";
    } catch (err) {
      console.error("[help] assistant failed:", err instanceof Error ? err.message : err);
      answer = "";
      source = "none";
    }
  } else {
    answer = "";
    source = "none";
  }

  if (!answer) {
    const best = matches[0];
    if (best) {
      answer = best.faq.answer;
      source = "faq";
      shownRelated = related.slice(1);
    } else {
      answer =
        "לא מצאתי תשובה לשאלה הזו במדריך. נסו לנסח במילים אחרות (למשל: \"איך מחזירים מחשב\"), עיינו ברשימת השאלות הנפוצות למטה, או פנו לבעלים.";
      source = "none";
    }
  }

  let id: string | null = null;
  try {
    const ref = getAdminFirestore().collection(COLLECTION).doc();
    const doc: HelpQuestion = {
      id: ref.id,
      question: q,
      answer,
      source,
      matchedIds: related.map((r) => r.id),
      audience: scope.audience,
      userEmail: session.user.email.toLowerCase(),
      userName: session.user.name ?? undefined,
      createdAt: new Date().toISOString(),
    };
    await ref.set(JSON.parse(JSON.stringify(doc)));
    id = ref.id;
  } catch (err) {
    // רישום השאלה הוא לשיפור ההדרכה בלבד — כשל בו לא מונע מהמשתמש לקבל תשובה.
    console.error("[help] failed to log question:", err instanceof Error ? err.message : err);
  }

  return { id, answer, source, related: shownRelated };
}

export async function markHelpfulAction(id: string, helpful: boolean): Promise<void> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email || !id) return;
  const ref = getAdminFirestore().collection(COLLECTION).doc(id);
  const snap = await ref.get();
  // כל משתמש מסמן רק את השאלות של עצמו.
  if (!snap.exists || (snap.data() as HelpQuestion).userEmail !== email) return;
  await ref.update({ helpful });
}
