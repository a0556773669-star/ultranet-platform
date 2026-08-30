/**
 * מסך בדיקת שלמות — the checks that make the numbers trustworthy (פרק י׳).
 *
 * Rules 3, 4 and 5 of the model are not advice, they are arithmetic, which means a machine can
 * verify them. This module runs every one of them and returns the exceptions. Nothing here
 * repairs anything on its own: an integrity screen that silently "fixes" the books is just
 * another way for a number to change without a reason you can point at.
 *
 * The checks replace, between them, the entire mirror/suppression machinery of the old model.
 * That machinery existed to stop a shekel being counted twice; these checks simply notice when
 * it has been, which is both simpler and stronger - it catches causes nobody predicted.
 */
import type { Branch, Item, Laptop, Purchase, Stick } from "@ultranet/shared-types";
import { getAdminFirestore } from "./firebase-admin";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import {
  ITEMS_COLLECTION,
  WAREHOUSE_LOCATION,
  itemCountsAsHeld,
  itemLabel,
  purchaseLinesTotal,
} from "./assets";
import { loadAssets } from "./assets-data";
import { allocationsValid } from "./tx";
import { loadTransactionModel } from "./tx-data";

export type IntegritySeverity = "error" | "warning";

export interface IntegrityFinding {
  /** the rule or question this finding belongs to */
  check: string;
  severity: IntegritySeverity;
  title: string;
  detail: string;
  /** where to go to fix it */
  href?: string;
}

export interface IntegrityCheck {
  key: string;
  title: string;
  /** what the check proves when it passes */
  rule: string;
  findings: IntegrityFinding[];
}

export interface IntegrityReport {
  checks: IntegrityCheck[];
  errorCount: number;
  warningCount: number;
  ranAt: string;
  /** the balance the whole asset layer rests on */
  balance: {
    purchased: number;
    inBranches: number;
    inWarehouse: number;
    /** purchased - (branches + warehouse); 0 when the books close */
    difference: number;
  };
}

const doc = <T>(d: QueryDocumentSnapshot) => ({ ...(d.data() as Omit<T, "id">), id: d.id }) as T;
const money = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;

/** How many days a transaction may sit unattributed before it is worth chasing. */
const PENDING_ATTRIBUTION_DAYS = 30;

export async function runIntegrityChecks(): Promise<IntegrityReport> {
  const db = getAdminFirestore();
  const [assets, model, laptopsSnap, sticksSnap] = await Promise.all([
    loadAssets(),
    loadTransactionModel(),
    db.collection("n_laptops").get(),
    db.collection("n_sticks").get(),
  ]);

  const laptops = laptopsSnap.docs.map((d) => doc<Laptop>(d));
  const sticks = sticksSnap.docs.map((d) => doc<Stick>(d));
  const branchById = model.branchById;
  const validLocations = new Set<string>([WAREHOUSE_LOCATION, ...branchById.keys()]);
  const branchName = (id: string) => branchById.get(id)?.name ?? id;

  const checks: IntegrityCheck[] = [
    checkAllocations(model),
    checkPurchaseTotals(assets.purchases, assets.itemsByPurchase),
    checkItemLocations(assets.items, validLocations, branchName),
    checkAssetBalance(assets),
    checkOrphanCatalogue(laptops, sticks, assets.items),
    checkPendingAttribution(model),
    checkMirrors(model),
    checkDeletedBranches(assets.items, branchById),
  ];

  const all = checks.flatMap((c) => c.findings);
  const inBranches = [...assets.investmentByLocation.entries()]
    .filter(([location]) => location !== WAREHOUSE_LOCATION)
    .reduce((sum, [, inv]) => sum + inv.total, 0);
  const inWarehouse = assets.investmentByLocation.get(WAREHOUSE_LOCATION)?.total ?? 0;

  return {
    checks,
    errorCount: all.filter((f) => f.severity === "error").length,
    warningCount: all.filter((f) => f.severity === "warning").length,
    ranAt: new Date().toISOString(),
    balance: {
      purchased: assets.totalPurchased,
      inBranches,
      inWarehouse,
      difference: assets.totalPurchased - (inBranches + inWarehouse),
    },
  };
}

/* --- כלל 3 -------------------------------------------------------------- */

function checkAllocations(model: Awaited<ReturnType<typeof loadTransactionModel>>): IntegrityCheck {
  const findings: IntegrityFinding[] = [];
  for (const tx of model.transactions) {
    if (allocationsValid(tx)) continue;
    const sum = (tx.allocations ?? []).reduce((s, a) => s + (a.amount || 0), 0);
    findings.push({
      check: "allocations",
      severity: "error",
      title: `${tx.desc} — הפיצול לא מסתדר`,
      detail: `סכום התנועה ${money(tx.amount)}, אבל הפיצול בין הסניפים מסתכם ב-${money(sum)} (הפרש ${money(
        Math.abs(tx.amount - sum),
      )}).`,
    });
  }
  return {
    key: "allocations",
    title: "כלל 3 — סכום הפיצולים שווה לסכום התנועה",
    rule: "Σ allocations = amount, לשקל. תנועה שהפיצול שלה לא מסתדר מוסיפה או מוחקת כסף בין הסניפים.",
    findings,
  };
}

/* --- כלל 4, חלק א׳: החשבונית מול הפריטים שלה ---------------------------- */

function checkPurchaseTotals(purchases: Purchase[], itemsByPurchase: Map<string, Item[]>): IntegrityCheck {
  const findings: IntegrityFinding[] = [];
  for (const p of purchases) {
    const linesTotal = purchaseLinesTotal(p.lines ?? []);
    if (Math.abs(linesTotal - (p.total || 0)) > 0.5) {
      findings.push({
        check: "purchase_total",
        severity: "error",
        title: `חשבונית ${p.invoiceNo || p.id} — השורות לא שוות לסכום`,
        detail: `סכום החשבונית ${money(p.total)}, סכום השורות ${money(linesTotal)}.`,
        href: `/dashboard/accounting/purchases/${p.id}`,
      });
    }
    const items = itemsByPurchase.get(p.id) ?? [];
    const itemsTotal = items.reduce((s, i) => s + (i.unitCost || 0), 0);
    if (items.length > 0 && Math.abs(itemsTotal - (p.total || 0)) > 0.5) {
      findings.push({
        check: "purchase_total",
        severity: "error",
        title: `חשבונית ${p.invoiceNo || p.id} — הפריטים לא שווים לסכום`,
        detail: `סכום החשבונית ${money(p.total)}, סכום עלויות ${items.length} הפריטים ${money(itemsTotal)}.`,
        href: `/dashboard/accounting/purchases/${p.id}`,
      });
    }
    if (items.length === 0) {
      findings.push({
        check: "purchase_total",
        severity: "warning",
        title: `חשבונית ${p.invoiceNo || p.id} — אין לה פריטים`,
        detail: `${money(p.total)} מ${p.supplier} נרשמו, אבל לא נוצר אף פריט. ההשקעה לא תופיע באף סניף.`,
        href: `/dashboard/accounting/purchases/${p.id}`,
      });
    }
  }
  return {
    key: "purchase_total",
    title: "רכישות שסכום הפריטים שלהן לא שווה לחשבונית",
    rule: "Σ(qty × unitCost) = total. זו הבדיקה שמחליפה את כל מנגנוני הבבואה: אם היא עוברת, המאזן בהכרח סוגר.",
    findings,
  };
}

/* --- כלל 5 -------------------------------------------------------------- */

function checkItemLocations(
  items: Item[],
  validLocations: Set<string>,
  branchName: (id: string) => string,
): IntegrityCheck {
  const findings: IntegrityFinding[] = [];
  for (const item of items) {
    if (!item.location) {
      findings.push({
        check: "item_location",
        severity: "error",
        title: `${itemLabel(item)} — בלי מיקום`,
        detail: `הפריט ${item.serial || item.id} לא נמצא בשום מקום. עלותו (${money(
          item.unitCost,
        )}) נופלת מהמאזן.`,
        href: "/dashboard/accounting/inventory",
      });
      continue;
    }
    if (!validLocations.has(item.location)) {
      findings.push({
        check: "item_location",
        severity: "error",
        title: `${itemLabel(item)} — במיקום שלא קיים`,
        detail: `הפריט ${item.serial || item.id} רשום ב-"${branchName(
          item.location,
        )}", אבל אין סניף כזה. ${money(item.unitCost)} תלויים באוויר.`,
        href: "/dashboard/accounting/inventory",
      });
    }
  }
  return {
    key: "item_location",
    title: "פריטים בלי מיקום, או במיקום שנמחק",
    rule: "פריט נמצא בדיוק במקום אחד — לא בשניים ולא באפס. גם 'מחסן' הוא מיקום.",
    findings,
  };
}

/* --- כלל 4, חלק ב׳: המאזן עצמו ------------------------------------------ */

function checkAssetBalance(assets: Awaited<ReturnType<typeof loadAssets>>): IntegrityCheck {
  const findings: IntegrityFinding[] = [];
  const held = assets.items.filter(itemCountsAsHeld).reduce((s, i) => s + (i.unitCost || 0), 0);
  const gone = assets.items.filter((i) => !itemCountsAsHeld(i)).reduce((s, i) => s + (i.unitCost || 0), 0);
  const difference = assets.totalPurchased - (held + gone);

  if (Math.abs(difference) > 0.5) {
    findings.push({
      check: "asset_balance",
      severity: "error",
      title: "המאזן ההוני לא סוגר",
      detail: `נרכש ${money(assets.totalPurchased)}, אבל סכום עלויות כל הפריטים הוא ${money(
        held + gone,
      )} — הפרש של ${money(Math.abs(difference))}. סימן שיש פריט יתום או חשבונית בלי פריטים.`,
      href: "/dashboard/accounting/inventory",
    });
  }

  const orphans = assets.items.filter((i) => !i.purchaseId);
  if (orphans.length > 0) {
    findings.push({
      check: "asset_balance",
      severity: "warning",
      title: `${orphans.length} פריטים בלי חשבונית משויכת`,
      detail: `סה"כ ${money(
        orphans.reduce((s, i) => s + (i.unitCost || 0), 0),
      )}. הם נספרים בהשקעה של הסניף, אבל אין להם מקור רכש — כדאי להזין את החשבונית.`,
      href: "/dashboard/accounting/purchases",
    });
  }

  return {
    key: "asset_balance",
    title: "המאזן ההוני — סניפים + מחסן מול הרכש",
    rule: "Σ עלות פריטים בסניפים + מחסן = Σ הרכש ההוני. אם לא — יש פריט יתום, והמערכת אומרת איזה.",
    findings,
  };
}

/* --- קטלוג ההשכרות מול שכבת הנכסים -------------------------------------- */

function checkOrphanCatalogue(laptops: Laptop[], sticks: Stick[], items: Item[]): IntegrityCheck {
  const linkedLaptops = new Set(items.map((i) => i.linkedLaptopId).filter(Boolean) as string[]);
  const linkedSticks = new Set(items.map((i) => i.linkedStickId).filter(Boolean) as string[]);
  const findings: IntegrityFinding[] = [];

  const unlinkedLaptops = laptops.filter((l) => !l.itemId && !linkedLaptops.has(l.id));
  const unlinkedSticks = sticks.filter((s) => !s.itemId && !linkedSticks.has(s.id));

  if (unlinkedLaptops.length > 0) {
    findings.push({
      check: "catalogue",
      severity: "warning",
      title: `${unlinkedLaptops.length} מחשבים בלי רכישה משויכת`,
      detail:
        "מחשבים שרשומים בקטלוג ההשכרות אבל אין להם פריט בשכבת הנכסים, ולכן העלות האמיתית שלהם לא נספרת " +
        "בהשקעה של הסניף. הזנת החשבונית שלהם — או שיוך לפריט קיים — תשלים את התמונה.",
      href: "/dashboard/accounting/inventory",
    });
  }
  if (unlinkedSticks.length > 0) {
    findings.push({
      check: "catalogue",
      severity: "warning",
      title: `${unlinkedSticks.length} סטיקים בלי רכישה משויכת`,
      detail: "אותו דבר לסטיקים — הם קיימים בקטלוג, אבל העלות שלהם לא מיוצגת בשכבת הנכסים.",
      href: "/dashboard/accounting/inventory",
    });
  }

  return {
    key: "catalogue",
    title: "סניפים שההשקעה שלהם לא מגובה בתנועת מלאי",
    rule: "לכל מחשב/סטיק בקטלוג צריך להיות פריט בשכבת הנכסים שנושא את עלותו האמיתית.",
    findings,
  };
}

/* --- תנועות שממתינות לשיוך ---------------------------------------------- */

function checkPendingAttribution(model: Awaited<ReturnType<typeof loadTransactionModel>>): IntegrityCheck {
  const cutoff = new Date(Date.now() - PENDING_ATTRIBUTION_DAYS * 86_400_000).toISOString().slice(0, 10);
  const findings: IntegrityFinding[] = [];
  for (const tx of model.transactions) {
    // A row still sitting on the headquarters node with a business-unit cost is usually one the
    // owner meant to file to a branch and forgot - not an overhead.
    if (tx.node.branchId !== "hq" || tx.node.business !== "hq") continue;
    if (tx.nature !== "operating" || tx.direction !== "out") continue;
    if (!tx.date || tx.date > cutoff) continue;
    findings.push({
      check: "pending",
      severity: "warning",
      title: `${tx.desc} — ממתינה לשיוך מעל ${PENDING_ATTRIBUTION_DAYS} יום`,
      detail: `${money(tx.amount)} מ-${tx.date} עדיין תלויים על צומת המטה. אם זו הוצאת מטה אמיתית אין מה לעשות; אם היא של סניף — שווה לשייך.`,
      href: "/dashboard/accounting/attribute",
    });
  }
  return {
    key: "pending",
    title: `תנועות שממתינות לשיוך יותר מ-${PENDING_ATTRIBUTION_DAYS} יום`,
    rule: "תייג בצומת הנמוכה ביותר שאתה באמת יודע. צומת המטה תקינה — אבל לא כברירת מחדל שנשכחה.",
    findings,
  };
}

/* --- בבואות שנשארו מהמודל הישן ------------------------------------------ */

function checkMirrors(model: Awaited<ReturnType<typeof loadTransactionModel>>): IntegrityCheck {
  const findings: IntegrityFinding[] = [];
  if (model.mirrors.length > 0) {
    const total = model.mirrors.reduce((s, m) => s + m.amount, 0);
    findings.push({
      check: "mirrors",
      severity: "warning",
      title: `${model.mirrors.length} שורות בבואה נותרו ב-n_ah_expenses`,
      detail: `סה"כ ${money(
        total,
      )}. הן כבר לא נספרות בשום מקום — ספר התזרים נגזר מהתנועות עצמן — אבל הן עדיין תופסות מקום ב-Firestore. אפשר למחוק אותן ממסך הניקיון.`,
      href: "/dashboard/accounting/integrity",
    });
  }
  return {
    key: "mirrors",
    title: "שורות בבואה שנותרו מהמודל הישן",
    rule: "שקל נרשם פעם אחת. בבואה היא עותק שני שנוצר רק כדי לראות אותו מזווית שנייה — ושאילתה עושה את זה בלי עותק.",
    findings,
  };
}

/* --- ציוד בסניף שנמחק ---------------------------------------------------- */

function checkDeletedBranches(items: Item[], branchById: Map<string, Branch>): IntegrityCheck {
  const findings: IntegrityFinding[] = [];
  const byBranch = new Map<string, Item[]>();
  for (const item of items) {
    if (item.location === WAREHOUSE_LOCATION) continue;
    const branch = branchById.get(item.location);
    if (!branch?.deleted) continue;
    const arr = byBranch.get(item.location) ?? [];
    arr.push(item);
    byBranch.set(item.location, arr);
  }
  for (const [branchId, list] of byBranch) {
    findings.push({
      check: "deleted_branch",
      severity: "warning",
      title: `${list.length} פריטים בסניף שנסגר — ${branchById.get(branchId)?.name ?? branchId}`,
      detail: `${money(
        list.reduce((s, i) => s + (i.unitCost || 0), 0),
      )} של ציוד עדיין רשומים שם. כדאי להחזיר אותם למחסן או לסמן אותם כנמכרו.`,
      href: "/dashboard/accounting/inventory",
    });
  }
  return {
    key: "deleted_branch",
    title: "ציוד שנשאר בסניף שנסגר",
    rule: "סניף סגור הוא לא מיקום פעיל. הציוד שבו צריך לחזור למחסן, להימכר, או לעבור לסניף אחר.",
    findings,
  };
}

/* ------------------------------------------------------------------ *
 * Cleanup
 * ------------------------------------------------------------------ */

/**
 * Deletes the leftover mirror rows. Safe by construction: the flow book is derived from the
 * transactions themselves, so a mirror contributes nothing to any total before or after.
 */
export async function deleteLeftoverMirrors(): Promise<number> {
  const db = getAdminFirestore();
  const model = await loadTransactionModel();
  if (model.mirrors.length === 0) return 0;

  const batch = db.batch();
  for (const mirror of model.mirrors) {
    batch.delete(db.collection("n_ah_expenses").doc(mirror.id));
  }
  // Clear the now-dangling back-references so nothing points at a deleted document.
  const [varSnap, multiSnap] = await Promise.all([
    db.collection("n_var_expenses").get(),
    db.collection("n_multi_branch_expenses").get(),
  ]);
  const mirrorIds = new Set(model.mirrors.map((m) => m.id));
  for (const d of [...varSnap.docs, ...multiSnap.docs]) {
    const linked = (d.data() as { linkedAhExpenseId?: string }).linkedAhExpenseId;
    if (linked && mirrorIds.has(linked)) batch.update(d.ref, { linkedAhExpenseId: null });
  }

  await batch.commit();
  return model.mirrors.length;
}

export { ITEMS_COLLECTION };
