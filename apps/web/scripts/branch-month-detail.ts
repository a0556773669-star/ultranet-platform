/**
 * READ-ONLY detailed monthly settlement report, one HTML file per rentals branch.
 * Never writes to Firestore: only .get() calls (via loadBranchAccountingRawData()) and pure code.
 *
 * Run from apps/web:
 *   npx tsx --tsconfig tsconfig.json scripts/branch-month-detail.ts YYYY-MM <outDir>
 *
 * For every non-owned rentals branch it itemises, row by row, how the month's settlement was
 * derived: every rental / manual income / laptop sale that counted (and who was holding the cash),
 * every expense line (who paid, who owes, the effect on the settlement), the carried-in balance,
 * the transfers recorded, and the bottom line. The itemised total is then re-added
 * independently and compared with the number the app itself shows (computeBranchFinancials /
 * buildBranchLedger) - any mismatch is printed in red at the top of that branch's report.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Branch, MultiBranchExpense } from "@ultranet/shared-types";
import { getAdminFirestore } from "../lib/firebase-admin";
import { loadBranchAccountingRawData, computeBranchFinancials, type BranchAccountingRawData } from "../lib/branch-accounting-data";
import { buildBranchLedger } from "../lib/branch-ledger";
import { isCollectedByOwner, expenseNetToOwnerFromShares, ownerExpenseBurden, monthsBetween } from "../lib/branch-accounting";
import { splitOf } from "../lib/multi-branch-expense";
import { monthLabel } from "../lib/branch-month-report";

const MONTH = process.argv[2] ?? "2026-10";
const OUT = process.argv[3] ?? "./out";
const TODAY = new Date().toISOString().slice(0, 10);

const num = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const nis = (n: number) => `${num(Math.round(n * 100) / 100)} ₪`;
const sgn = (n: number) => (Math.abs(n) < 0.005 ? "0 ₪" : `${n > 0 ? "+" : "−"}${nis(Math.abs(n))}`);
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const days = (a?: string, b?: string) =>
  a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1 : undefined;

function ownerPctOf(b: Branch): number {
  if (b.isMine) return 100;
  return b.myPct ?? 100 - (b.partnerPct ?? 0);
}

interface IncomeRow {
  kind: "השכרה" | "הכנסה ידנית";
  date: string;
  what: string;
  client: string;
  method: string;
  holder: "partner" | "owner";
  holderWhy: string;
  amount: number;
  priceNote: string;
  effect: number; // on settlement, + = partner owes owner
  formula: string;
  id: string;
}
interface ExpenseRow {
  desc: string;
  type: string;
  category: string;
  date: string;
  amount: number;
  paidBy: "owner" | "partner";
  split: string;
  ownerShare: number;
  effect: number;
  inSettlement: boolean;
  formula: string;
  id: string;
}

(async () => {
  const raw: BranchAccountingRawData = await loadBranchAccountingRawData();
  const db = getAdminFirestore();
  const clients = new Map<string, string>();
  for (const d of (await db.collection("n_rental_clients").select("name", "phone").get()).docs)
    clients.set(d.id, String(d.get("name") ?? ""));
  const sticks = new Map<string, string>();
  for (const d of (await db.collection("n_sticks").get()).docs)
    sticks.set(d.id, String(d.get("name") ?? d.get("number") ?? d.get("simNumber") ?? d.id));
  const laptopName = new Map<string, string>();
  for (const list of raw.laptopsByBranch.values()) for (const l of list) laptopName.set(l.id, l.name);

  mkdirSync(OUT, { recursive: true });
  const prev = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return mo === 1 ? `${y! - 1}-12` : `${y}-${String(mo! - 1).padStart(2, "0")}`;
  };

  const branches = raw.branches
    .filter((b) => b.branchType === "rentals" && !b.deleted && !b.isMine)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const summary: Record<string, unknown>[] = [];

  for (const b of branches) {
    const ownerPct = ownerPctOf(b);
    const partnerPct = 100 - ownerPct;
    const partner = b.partnerName?.trim() || "השותף";

    // ---------- income ----------
    const income: IncomeRow[] = [];
    const rentals = raw.rentalsByBranch.get(b.id) ?? [];
    for (const r of rentals) {
      if (!(r.status === "returned" && r.returnDate && r.paid)) continue;
      if (r.returnDate.slice(0, 7) !== MONTH) continue;
      const amount = r.finalPrice ?? r.calcPrice ?? 0;
      const route = r.collectionRouteId ? raw.routesById.get(r.collectionRouteId) ?? null : null;
      const ownerHolds = isCollectedByOwner(r.paymentMethod, route);
      const why = r.paymentMethod === "nedarim" ? "סליקת נדרים ישירה לבעלים" : route?.depositsTo === "owner" ? `מסלול גבייה "${route.name ?? ""}" מפקיד לבעלים` : "הכסף אצל השותף";
      const effect = ownerHolds ? -(amount * partnerPct) / 100 : (amount * ownerPct) / 100;
      income.push({
        kind: "השכרה",
        date: r.returnDate,
        what: `${r.kind === "stick" ? "סטיק" : "מחשב"} ${r.kind === "stick" ? sticks.get(r.itemId) ?? r.itemId : laptopName.get(r.itemId) ?? r.itemId} · ${r.startDate}→${r.returnDate} (${days(r.startDate, r.returnDate)} ימים)`,
        client: clients.get(r.clientId) ?? r.clientId,
        method: `${r.paymentMethod ?? "—"}${route ? ` / ${route.name ?? route.id}` : ""}`,
        holder: ownerHolds ? "owner" : "partner",
        holderWhy: why,
        amount,
        priceNote:
          r.finalPrice != null && r.finalPrice !== r.calcPrice
            ? `מחיר סופי ${num(r.finalPrice)} (חושב ${num(r.calcPrice)})${r.priceOverrideReason ? ` — ${r.priceOverrideReason}` : ""}`
            : "מחיר מחושב",
        effect,
        formula: ownerHolds ? `−${num(amount)} × ${partnerPct}% (חלק ${partner} שהבעלים גבה)` : `+${num(amount)} × ${ownerPct}% (חלק הבעלים מכסף שאצל ${partner})`,
        id: r.id,
      });
    }
    for (const i of raw.branchIncomeByBranch.get(b.id) ?? []) {
      if (i.date.slice(0, 7) !== MONTH) continue;
      const ownerHolds = i.collectedByOwner ?? false;
      const amount = i.amount || 0;
      income.push({
        kind: "הכנסה ידנית",
        date: i.date,
        what: i.desc,
        client: "—",
        method: i.paymentMethod ?? "—",
        holder: ownerHolds ? "owner" : "partner",
        holderWhy: ownerHolds ? "סומן שהבעלים גבה" : "הכסף אצל השותף",
        amount,
        priceNote: i.source === "import" ? "יובאה" : "הוזנה ידנית",
        effect: ownerHolds ? -(amount * partnerPct) / 100 : (amount * ownerPct) / 100,
        formula: ownerHolds ? `−${num(amount)} × ${partnerPct}%` : `+${num(amount)} × ${ownerPct}%`,
        id: i.id,
      });
    }
    income.sort((a, c) => a.date.localeCompare(c.date));

    const sales = (raw.salesByBranch.get(b.id) ?? []).filter((s) => s.month === MONTH).sort((a, c) => a.date.localeCompare(c.date));

    // ---------- expenses (own expansion, then cross-checked) ----------
    const exp: ExpenseRow[] = [];
    const push = (p: {
      desc: string; type: string; category?: string; date: string; amount: number; paidBy?: string;
      owedBy?: string; ownerPct?: number; ownerShareOverride?: number; id: string;
    }) => {
      const paid: "owner" | "partner" = p.paidBy === "partner" ? "partner" : "owner";
      const ownerShare =
        p.ownerShareOverride ??
        (typeof p.ownerPct === "number" ? (p.amount * Math.min(100, Math.max(0, p.ownerPct))) / 100 : ownerExpenseBurden(p.amount, p.owedBy));
      const effect = expenseNetToOwnerFromShares(p.amount, ownerShare, paid);
      const pctOwner = p.amount ? Math.round((ownerShare / p.amount) * 1000) / 10 : 0;
      const split =
        typeof p.ownerPct === "number" || p.ownerShareOverride != null
          ? `${pctOwner}% בעלים · ${Math.round((100 - pctOwner) * 10) / 10}% ${partner}`
          : p.owedBy === "partner" ? `100% ${partner}` : p.owedBy === "shared" ? "50/50" : "100% בעלים";
      exp.push({
        desc: p.desc, type: p.type, category: p.category ?? "—", date: p.date, amount: p.amount, paidBy: paid, split,
        ownerShare, effect, inSettlement: Math.abs(effect) > 0.005,
        formula:
          paid === "partner"
            ? `${partner} שילם ${num(p.amount)} → הבעלים חייב לו את חלקו: −${num(ownerShare)}`
            : `הבעלים שילם ${num(p.amount)} → ${partner} חייב לו את חלקו: ${num(p.amount)} − ${num(ownerShare)} = ${num(p.amount - ownerShare)}`,
        id: p.id,
      });
    };
    for (const e of raw.fixedByBranch.get(b.id) ?? []) {
      if (!e.startDate) continue;
      const endMonth = e.endDate && e.endDate.slice(0, 7) < MONTH ? e.endDate.slice(0, 7) : MONTH;
      if (!monthsBetween(e.startDate, endMonth).includes(MONTH)) continue;
      const amount = e.variableAmount && e.lastAmount != null ? e.lastAmount : e.amount || 0;
      push({ desc: e.name || "הוצאה קבועה", type: "קבועה", category: e.category, date: `${MONTH} (חודשי)`, amount, paidBy: e.paidBy, owedBy: e.owedBy, ownerPct: e.ownerPct, id: e.id });
    }
    for (const e of raw.variableByBranch.get(b.id) ?? []) {
      if (e.month !== MONTH) continue;
      push({ desc: e.desc || "הוצאה חד פעמית", type: "חד פעמית", category: e.category, date: e.date, amount: e.amount || 0, paidBy: e.paidBy, owedBy: e.owedBy, ownerPct: e.ownerPct, id: e.id });
    }
    for (const e of raw.multiBranchByBranch.get(b.id) ?? ([] as MultiBranchExpense[])) {
      if (e.month !== MONTH) continue;
      const s = splitOf(e);
      push({ desc: `${e.desc || "הוצאה משותפת"} (פרוסה מתוך ${num(e.amount)} ₪ ל-${s.branchCount} סניפים)`, type: "רב-סניפית", category: e.category, date: e.date, amount: s.perBranchLineTotal, paidBy: e.paidBy, ownerShareOverride: s.perBranchOwnerShare, id: e.id });
    }
    exp.sort((a, c) => Number(c.inSettlement) - Number(a.inSettlement) || a.desc.localeCompare(c.desc, "he"));

    // ---------- the independent total ----------
    const incomeSum = income.reduce((s, r) => s + r.effect, 0);
    const salesSum = sales.reduce((s, r) => s + (r.price || 0), 0);
    const expSum = exp.reduce((s, r) => s + r.effect, 0);
    const myNet = incomeSum + expSum + salesSum;

    const fin = computeBranchFinancials(b, raw, MONTH);
    const ledger = buildBranchLedger(b, raw);
    const row = ledger.rows.find((r) => r.month === MONTH);
    const prevRow = ledger.rows.find((r) => r.month === prev(MONTH));
    const nextRow = ledger.rows.find((r) => r.month === nextM(MONTH));
    function nextM(m: string) { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y! + 1}-01` : `${y}-${String(mo! + 1).padStart(2, "0")}`; }

    const mismatch = Math.abs(myNet - fin.settlementNetToOwner) > 0.5;
    const grossIncome = income.reduce((s, r) => s + r.amount, 0);
    const mismatchGross = Math.abs(grossIncome - fin.grossIncomeThisMonth) > 0.5;

    // ---------- context: money NOT counted ----------
    const notPaid = rentals.filter((r) => r.status === "returned" && !r.paid && (r.returnDate ?? "").slice(0, 7) === MONTH);
    const stillActive = rentals.filter((r) => r.status === "active" && r.startDate <= `${MONTH}-31`);
    const returnedNoDate = rentals.filter((r) => r.status === "returned" && !r.returnDate);

    const transfers = [...raw.transfersByBranchMonth.values()]
      .filter((t) => t.branchId === b.id && t.month >= prev(prev(MONTH)))
      .sort((a, c) => a.month.localeCompare(c.month));

    const bottomDue = (row?.totalDue ?? myNet);
    const paid = row?.transferredAmount ?? 0;
    const outstanding = bottomDue - paid;

    summary.push({
      branch: b.name, partner: b.partnerName ?? "", ownerPct, partnerPct,
      rentals: income.filter((r) => r.kind === "השכרה").length, manualIncome: income.filter((r) => r.kind !== "השכרה").length,
      grossIncome, expensesInSettlement: exp.filter((e) => e.inSettlement).reduce((s, e) => s + e.amount, 0),
      sales: salesSum, netThisMonth: myNet, opening: row?.openingBalance ?? 0, totalDue: bottomDue, transferred: paid, outstanding,
      appNet: fin.settlementNetToOwner, mismatch, closedAt: b.closedAt ?? "", id: b.id,
      reportSentAt: raw.transfersByBranchMonth.get(`${b.id}|${MONTH}`)?.reportSentAt ?? "",
    });

    // ---------- HTML ----------
    const th = (s: string) => `<th>${s}</th>`;
    const incomeHtml = income.length
      ? `<table><tr>${["#", "תאריך החזרה", "סוג", "פריט / תיאור", "לקוח", "אמצעי תשלום", "אצל מי הכסף", "מחיר", "השפעה על ההתחשבנות", "איך חושב"].map(th).join("")}</tr>` +
        income.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.date)}</td><td>${r.kind}</td><td>${esc(r.what)}<div class="s">${esc(r.priceNote)}</div></td><td>${esc(r.client)}</td><td>${esc(r.method)}</td><td class="${r.holder === "owner" ? "o" : ""}">${r.holder === "owner" ? "בעלים" : esc(partner)}<div class="s">${esc(r.holderWhy)}</div></td><td class="n">${nis(r.amount)}</td><td class="n ${r.effect >= 0 ? "g" : "r"}">${sgn(r.effect)}</td><td class="s">${esc(r.formula)}</td></tr>`).join("") +
        `<tr class="tot"><td colspan="7">סה"כ ${income.length} שורות הכנסה</td><td class="n">${nis(grossIncome)}</td><td class="n ${incomeSum >= 0 ? "g" : "r"}">${sgn(incomeSum)}</td><td></td></tr></table>`
      : `<p class="muted">לא נספרה אף הכנסה בחודש הזה.</p>`;

    const expHtml = (rows: ExpenseRow[], total: boolean) =>
      rows.length
        ? `<table><tr>${["#", "הוצאה", "סוג", "קטגוריה", "תאריך", "סכום מלא", "מי שילם", "על חשבון מי", "השפעה על ההתחשבנות", "איך חושב"].map(th).join("")}</tr>` +
          rows.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.desc)}</td><td>${e.type}</td><td>${esc(e.category)}</td><td>${esc(e.date)}</td><td class="n">${nis(e.amount)}</td><td class="${e.paidBy === "partner" ? "p" : "o"}">${e.paidBy === "partner" ? esc(partner) : "הבעלים"}</td><td>${esc(e.split)}</td><td class="n ${e.effect >= 0 ? "g" : "r"}">${sgn(e.effect)}</td><td class="s">${e.inSettlement ? esc(e.formula) : "אין התחשבנות — מי ששילם גם נושא בעלות"}</td></tr>`).join("") +
          (total ? `<tr class="tot"><td colspan="5">סה"כ ${rows.length} הוצאות</td><td class="n">${nis(rows.reduce((s, e) => s + e.amount, 0))}</td><td colspan="2"></td><td class="n ${expSum >= 0 ? "g" : "r"}">${sgn(rows.reduce((s, e) => s + e.effect, 0))}</td><td></td></tr>` : "") +
          `</table>`
        : `<p class="muted">אין.</p>`;

    const ledgerHtml = `<table><tr>${["חודש", "יתרה פתוחה", "התחשבנות החודש", "סה\"כ לתשלום", "הועבר בפועל", "יתרה לחודש הבא", "תאריך רישום העברה", "הערה"].map(th).join("")}</tr>` +
      ledger.rows.filter((r) => r.month >= prev(prev(MONTH))).map((r) => `<tr class="${r.month === MONTH ? "hl" : ""}"><td>${monthLabel(r.month)}</td><td class="n">${sgn(r.openingBalance)}</td><td class="n">${sgn(r.netToOwner)}</td><td class="n">${sgn(r.totalDue)}</td><td class="n">${nis(r.transferredAmount)}</td><td class="n">${sgn(r.closingBalance)}</td><td>${esc(r.transferredAt ?? "—")}</td><td>${esc(r.transferNote ?? "")}</td></tr>`).join("") + `</table>`;

    const warn: string[] = [];
    if (mismatch) warn.push(`אי-התאמה: סכום השורות כאן (${sgn(myNet)}) שונה ממה שהאפליקציה מחשבת (${sgn(fin.settlementNetToOwner)}).`);
    if (mismatchGross) warn.push(`אי-התאמה בהכנסה ברוטו: כאן ${nis(grossIncome)} מול אפליקציה ${nis(fin.grossIncomeThisMonth)}.`);
    if (b.myPct != null && b.partnerPct != null && b.myPct + b.partnerPct !== 100) warn.push(`האחוזים בהגדרות הסניף לא מסתכמים ל-100 (${b.myPct}+${b.partnerPct}) — החישוב משתמש ב-${ownerPct}% לבעלים.`);
    if (b.closedAt) warn.push(`הסניף נסגר ב-${b.closedAt}.`);

    const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${esc(b.name)} — ${monthLabel(MONTH)}</title><style>
body{font-family:Arial,sans-serif;margin:0;padding:24px;background:#f4f6f9;color:#1f2933;line-height:1.5}
.w{max-width:1250px;margin:auto;background:#fff;border:1px solid #e3e8ef;border-radius:12px;padding:24px}
h1{margin:0 0 4px}h2{margin:28px 0 8px;font-size:17px;border-bottom:2px solid #e3e8ef;padding-bottom:4px}
table{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}th{background:#eef2f6;text-align:right;padding:6px 8px;font-size:12px}
td{padding:6px 8px;border-top:1px solid #e3e8ef;vertical-align:top}.n{white-space:nowrap;font-weight:700}.s{font-size:11px;color:#6b7785}
.g{color:#047857}.r{color:#b91c1c}.o{background:#fff7e6}.p{background:#e6f4ff}.tot td{background:#f4f6f9;font-weight:800}.hl td{background:#fffbe6}
.muted{color:#6b7785}.box{border:3px solid #0f766e;border-radius:10px;padding:14px 18px;margin:14px 0;background:#f8fafb}
.warn{background:#fee2e2;border:1px solid #b91c1c;color:#7f1d1d;padding:8px 12px;border-radius:8px;margin:6px 0;font-weight:700}
.kv td{border:none;padding:3px 8px}.kv td:last-child{font-weight:800}</style></head><body><div class="w">
<h1>${esc(b.name)} — דוח התחשבנות מפורט ל${monthLabel(MONTH)}</h1>
<div class="muted">שותף: ${esc(partner)} · חלוקה: ${ownerPct}% בעלים / ${partnerPct}% שותף · הופק ${TODAY} · נתונים נקראו מ-Firestore (קריאה בלבד)${raw.transfersByBranchMonth.get(`${b.id}|${MONTH}`)?.reportSentAt ? ` · הדוח נשלח לשותף ב-${esc(raw.transfersByBranchMonth.get(`${b.id}|${MONTH}`)!.reportSentAt)}` : " · הדוח טרם נשלח"}</div>
${warn.map((w) => `<div class="warn">${esc(w)}</div>`).join("")}
<div class="box"><b>שורה תחתונה:</b> ${Math.abs(outstanding) < 1 ? "מאוזן — אין מה להעביר" : outstanding > 0 ? `<span class="g">${esc(partner)} צריך להעביר לבעלים ${nis(outstanding)}</span>` : `<span class="r">הבעלים צריך להעביר ל${esc(partner)} ${nis(-outstanding)}</span>`}
<table class="kv"><tr><td>יתרה שנגררה מחודשים קודמים</td><td>${sgn(row?.openingBalance ?? 0)}</td></tr>
${prevRow && Math.abs(prevRow.transferredAmount) > 0.5 ? `<tr><td colspan="2" class="s">(חוב ${monthLabel(prevRow.month)} לפני העברה: ${sgn(prevRow.totalDue)}, הועבר ${nis(prevRow.transferredAmount)})</td></tr>` : ""}
<tr><td>התחשבנות ${monthLabel(MONTH)} (הפירוט למטה)</td><td>${sgn(myNet)}</td></tr>
<tr><td>סה"כ לתשלום</td><td>${sgn(bottomDue)}</td></tr><tr><td>הועבר בפועל ונרשם על החודש</td><td>${nis(paid)}</td></tr>
<tr><td>נותר להעביר</td><td>${sgn(outstanding)}</td></tr></table>
<div class="s">+ = השותף חייב לבעלים · − = הבעלים חייב לשותף.</div></div>

<h2>1. מאיפה נכנס כסף — הכנסות ${monthLabel(MONTH)}</h2>
<p class="s">כלל הספירה (כך האפליקציה עובדת): השכרה נספרת רק אם הסטטוס "הוחזר", יש תאריך החזרה, היא <b>סומנה כשולמה</b>, ותאריך ההחזרה (לא תאריך ההתחלה) בחודש הזה. כסף שאצל השותף → הבעלים זכאי ל-${ownerPct}% ממנו. כסף שהבעלים גבה ישירות (נדרים / מסלול גבייה לבעלים) → הבעלים חייב לשותף ${partnerPct}% ממנו.</p>
${incomeHtml}
${sales.length ? `<h3>מכירות מחשבים (100% לבעלים, השותף מחזיק בכסף)</h3><table><tr>${["תאריך", "מחשב", "קונה", "מחיר"].map(th).join("")}</tr>${sales.map((s) => `<tr><td>${esc(s.date)}</td><td>${esc(s.laptopName)}</td><td>${esc(s.buyerName ?? "")}</td><td class="n g">+${nis(s.price)}</td></tr>`).join("")}<tr class="tot"><td colspan="3">סה"כ מכירות</td><td class="n g">+${nis(salesSum)}</td></tr></table>` : ""}

<h2>2. לאן הלך כסף — הוצאות שנכנסו להתחשבנות</h2>
<p class="s">הוצאה נכנסת להתחשבנות רק כשצד אחד שילם ובפועל הצד השני חייב לו. מי ששילם 100% על חשבון עצמו — לא נכנס. הנוסחה: אם הבעלים שילם → השותף חייב לו (סכום − חלק הבעלים). אם השותף שילם → הבעלים חייב לו את חלקו.</p>
${expHtml(exp.filter((e) => e.inSettlement), true)}
<h3>הוצאות החודש שלא נכנסות להתחשבנות (לידיעה בלבד)</h3>
${expHtml(exp.filter((e) => !e.inSettlement), false)}

<h2>3. חישוב סופי של ${monthLabel(MONTH)}</h2>
<table class="kv"><tr><td>הכנסות (נטו לבעלים אחרי חלוקה וגבייה ישירה)</td><td class="${incomeSum >= 0 ? "g" : "r"}">${sgn(incomeSum)}</td></tr>
<tr><td>הוצאות</td><td class="${expSum >= 0 ? "g" : "r"}">${sgn(expSum)}</td></tr>
<tr><td>מכירות מחשבים</td><td class="g">${sgn(salesSum)}</td></tr>
<tr><td><b>התחשבנות החודש</b></td><td>${sgn(myNet)}</td></tr>
<tr><td class="s">בדיקה מול החישוב של האפליקציה (computeBranchFinancials)</td><td class="${mismatch ? "r" : "g"}">${mismatch ? "אי-התאמה: " : "תואם: "}${sgn(fin.settlementNetToOwner)}</td></tr></table>

<h2>4. יתרות והעברות (ספר חודשי)</h2>${ledgerHtml}
<p class="s">העברות שנרשמו (n_branch_transfers): ${transfers.length ? transfers.map((t) => `${t.month}: ${nis(t.transferredAmount ?? (t.transferred ? t.netToOwner : 0))}${t.transferredAt ? ` (נרשם ${t.transferredAt})` : ""}`).join(" · ") : "אין."}${nextRow ? ` · חודש ${monthLabel(nextRow.month)} מציג כרגע פתיחה ${sgn(nextRow.openingBalance)} ועד כה ${sgn(nextRow.netToOwner)}.` : ""}</p>

<h2>5. מה לא נספר (מקורות לוויכוח)</h2>
<ul>
<li>החזרות שסומנו <b>לא שולם</b> ב${monthLabel(MONTH)}: ${notPaid.length ? notPaid.map((r) => `${esc(clients.get(r.clientId) ?? r.clientId)} ${r.returnDate} — ${nis(r.finalPrice ?? r.calcPrice)}`).join("; ") : "אין"}</li>
<li>השכרות שעדיין פעילות (לא הוחזרו) ונפתחו עד סוף החודש — ייספרו בחודש בו יוחזרו: ${stillActive.length ? stillActive.map((r) => `${esc(clients.get(r.clientId) ?? r.clientId)} (מ-${r.startDate})`).join("; ") : "אין"}</li>
<li>השכרות שסומנו "הוחזר" בלי תאריך החזרה (לא נספרות בשום חודש): ${returnedNoDate.length ? returnedNoDate.map((r) => `${esc(clients.get(r.clientId) ?? r.clientId)} ${nis(r.finalPrice ?? r.calcPrice)}`).join("; ") : "אין"}</li>
</ul>
<p class="s">מזהי מסמכים (לבירור ב-Firestore) מופיעים בקובץ ה-JSON הנלווה.</p>
</div></body></html>`;
    const safe = b.name.replace(/[^\p{L}\p{N}]+/gu, "_");
    writeFileSync(join(OUT, `${safe}.html`), html);
    writeFileSync(join(OUT, `${safe}.json`), JSON.stringify({ branch: b.id, month: MONTH, income, sales, expenses: exp, myNet, appNet: fin.settlementNetToOwner }, null, 1));
    console.log(`${b.name.padEnd(28)} net=${Math.round(myNet)} app=${Math.round(fin.settlementNetToOwner)} open=${Math.round(row?.openingBalance ?? 0)} paid=${Math.round(paid)} outstanding=${Math.round(outstanding)}${mismatch ? "  <<< MISMATCH" : ""}`);
  }

  // ---------- index ----------
  const S = summary as Array<Record<string, any>>;
  const tot = (k: string) => S.reduce((s, r) => s + (r[k] as number), 0);
  const index = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>סיכום סניפים ${monthLabel(MONTH)}</title><style>
body{font-family:Arial,sans-serif;padding:24px;background:#f4f6f9;color:#1f2933}.w{max-width:1250px;margin:auto;background:#fff;border:1px solid #e3e8ef;border-radius:12px;padding:24px}
table{border-collapse:collapse;width:100%;font-size:13px}th{background:#eef2f6;padding:6px 8px;text-align:right;font-size:12px}td{padding:6px 8px;border-top:1px solid #e3e8ef}
.n{white-space:nowrap;font-weight:700}.g{color:#047857}.r{color:#b91c1c}.tot td{background:#f4f6f9;font-weight:800}a{color:#0f766e}</style></head><body><div class="w">
<h1>סיכום כל הסניפים — ${monthLabel(MONTH)}</h1><p>לכל סניף דוח מפורט בקובץ נפרד (קישור בשם הסניף). + = השותף חייב לבעלים.</p>
<table><tr>${["סניף", "שותף", "חלוקה (בעלים/שותף)", "שורות הכנסה", "הכנסה ברוטו", "הוצאות בהתחשבנות", "מכירות", "התחשבנות החודש", "יתרה קודמת", "סה\"כ לתשלום", "הועבר", "נותר", "בדיקה מול האפליקציה"].map((h) => `<th>${h}</th>`).join("")}</tr>
${S.sort((a, c) => c.outstanding - a.outstanding).map((r) => `<tr><td><a href="${String(r.branch).replace(/[^\p{L}\p{N}]+/gu, "_")}.html">${esc(r.branch)}</a>${r.closedAt ? " (נסגר)" : ""}</td><td>${esc(r.partner)}</td><td>${r.ownerPct}/${r.partnerPct}</td><td>${r.rentals + r.manualIncome}</td><td class="n">${nis(r.grossIncome)}</td><td class="n">${nis(r.expensesInSettlement)}</td><td class="n">${nis(r.sales)}</td><td class="n ${r.netThisMonth >= 0 ? "g" : "r"}">${sgn(r.netThisMonth)}</td><td class="n">${sgn(r.opening)}</td><td class="n">${sgn(r.totalDue)}</td><td class="n">${nis(r.transferred)}</td><td class="n ${r.outstanding >= 0 ? "g" : "r"}">${sgn(r.outstanding)}</td><td class="${r.mismatch ? "r" : "g"}">${r.mismatch ? "אי-התאמה " + sgn(r.appNet) : "תואם"}</td></tr>`).join("")}
<tr class="tot"><td colspan="4">סה"כ</td><td class="n">${nis(tot("grossIncome"))}</td><td class="n">${nis(tot("expensesInSettlement"))}</td><td class="n">${nis(tot("sales"))}</td><td class="n">${sgn(tot("netThisMonth"))}</td><td class="n">${sgn(tot("opening"))}</td><td class="n">${sgn(tot("totalDue"))}</td><td class="n">${nis(tot("transferred"))}</td><td class="n">${sgn(tot("outstanding"))}</td><td></td></tr></table></div></body></html>`;
  writeFileSync(join(OUT, "index.html"), index);
  writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 1));
  console.log(`\nwritten ${summary.length} branch reports + index.html to ${OUT}`);
})().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
