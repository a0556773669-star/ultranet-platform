import { getAdminFirestore } from "./firebase-admin";
import { DEFAULT_STORE_PROCEDURES, SUPERSEDED_PROCEDURE_IDS } from "./store-default-procedures";

/**
 * טעינה אוטומטית של נהלי החנות לפעם הראשונה (לא דורסת נוהל קיים - מזהים קבועים, אז עריכה של הבעלים נשמרת). כשנטענת הגרסה
 * הנוכחית, הנהלים של הגרסה הראשונה מועברים לארכיון. שאילתה זולה (3 מסמכים), ורצה רק כשמישהו נכנס למסך החנות.
 */
export async function ensureStoreProcedures(): Promise<void> {
  const db = getAdminFirestore();
  const refs = DEFAULT_STORE_PROCEDURES.map((p) => db.collection("n_procedures").doc(p.id));
  const snaps = await db.getAll(...refs);
  const missing = snaps.map((s, i) => (s.exists ? null : DEFAULT_STORE_PROCEDURES[i]!)).filter((p): p is NonNullable<typeof p> => p !== null);
  if (!missing.length) return;
  const now = Date.now();
  for (const p of missing) {
    await db.collection("n_procedures").doc(p.id).set({
      title: p.title,
      content: p.content,
      category: p.category,
      summary: p.summary,
      version: "1",
      status: "active",
      ownerName: "אולטרנט",
      supersedesId: null,
      attachmentName: "",
      attachmentDataUrl: "",
      order: p.order,
      createdAt: now,
      updatedAt: now,
      createdBy: "system",
      updatedBy: "system",
      audience: { mode: "store" },
    });
  }
  // הגרסה הראשונה של הנהלים (אם נטענה בעבר) - לארכיון
  const old = await db.getAll(...SUPERSEDED_PROCEDURE_IDS.map((id) => db.collection("n_procedures").doc(id)));
  for (const s of old) if (s.exists && (s.data() as { status?: string }).status !== "archived") await s.ref.update({ status: "archived", updatedAt: now });
}
