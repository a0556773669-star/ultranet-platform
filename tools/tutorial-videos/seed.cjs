// נתוני הדגמה בלבד — רץ אך ורק מול Firestore Emulator, לעולם לא מול הפרויקט האמיתי.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
if (!/^(127\.0\.0\.1|localhost)/.test(process.env.FIRESTORE_EMULATOR_HOST)) throw new Error("seed runs against the local emulator only");
const WEB = require("path").resolve(__dirname, "../../apps/web");
const { initializeApp } = require(require.resolve("firebase-admin/app", { paths: [WEB] }));
const { getFirestore } = require(require.resolve("firebase-admin/firestore", { paths: [WEB] }));
initializeApp({ projectId: "ultranet-e94aa" });
const db = getFirestore();

const today = new Date("2026-10-01");
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => iso(new Date(today.getTime() - n * 864e5));
const month = (d) => d.slice(0, 7);

async function put(col, id, data) { await db.collection(col).doc(id).set(JSON.parse(JSON.stringify({ id, ...data }))); }

const pricing = {
  laptop: { dayPrice: 40, weekPrice: 180, monthPrice: 550, noInternetDayPrice: 30, noInternetWeekPrice: 140, noInternetMonthPrice: 450 },
  stick: { day1: 20, day2: 15, day3plus: 10, weekPrice: 60, monthPrice: 180 },
};

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/ultranet-e94aa/databases/(default)/documents', { method: 'DELETE' });
  // ---- branches
  await put("n_branches", "r-bb", { name: "השכרות בני ברק", location: "רחוב רבי עקיבא 80, בני ברק", phone: "03-5701234", branchType: "rentals", isMine: true, myPct: 100, partnerPct: 0, openedAt: "2025-01-01", founded: "2025-01-01", rentalPricing: pricing });
  await put("n_branches", "r-bs", { name: "השכרות בית שמש", location: "נחל דולב 12, בית שמש", phone: "02-9912345", branchType: "rentals", isMine: false, partnerName: "משה כהן", partnerEmail: "moshe@ultranet.demo", myPct: 50, partnerPct: 50, openedAt: "2025-06-01", founded: "2025-06-01", rentalPricing: pricing, expensePolicy: { ads: "owner", internet: "partner", rent: "partner", electricity: "partner" } });
  await put("n_branches", "c-jlm", { name: "חדר מחשבים ירושלים", location: "רחוב מלכי ישראל 20, ירושלים", phone: "02-5001122", branchType: "computers", isMine: false, partnerName: "יעקב לוי", myPct: 60, partnerPct: 40, openedAt: "2025-03-01", founded: "2025-03-01", setupCost: 48000, setupItems: [{ label: "12 מחשבים", amount: 36000 }, { label: "ריהוט", amount: 8000 }, { label: "מדפסת ורשת", amount: 4000 }] });
  await put("n_branches", "c-bb", { name: "חדר מחשבים בני ברק", location: "רחוב ז'בוטינסקי 150, בני ברק", phone: "03-6189900", branchType: "computers", isMine: true, myPct: 100, partnerPct: 0, openedAt: "2025-02-01", founded: "2025-02-01", setupCost: 39000 });
  await put("n_branches", "w-bb", { name: "משרד שיתופי בני ברק", location: "רחוב ז'בוטינסקי 150, קומה 3", branchType: "coworking", isMine: true, myPct: 100, partnerPct: 0, openedAt: "2025-04-01", founded: "2025-04-01" });

  // ---- users
  const allPerms = { branches: true, computers: true, rentals: true, coworking: true, accounting: true, tasks: true, charging: true, shop: true, duxus: true };
  await put("n_users", "u-owner", { name: "יוני", email: "owner@ultranet.demo", pass: "demo1234", role: "owner", branchId: "all", perms: allPerms });
  await put("n_users", "u-renter", { name: "משה כהן", email: "moshe@ultranet.demo", pass: "demo1234", role: "partner", branchId: "r-bs", perms: { rentals: true, charging: true },
    assignments: [{ role: "partner", branchId: "r-bs", branchType: "rentals", perms: { rentals: true, charging: true } }] });

  // ---- laptops + sticks
  const lt = [];
  for (const [bid, first, n] of [["r-bb", 1, 8], ["r-bs", 21, 8]]) {
    for (let k = 1; k <= n; k++) {
      const num = first + k - 1;
      const id = `lap-${bid}-${k}`;
      lt.push({ id, bid });
      const withStick = k % 2 === 0;
      await put("n_laptops", id, { branchId: bid, name: k === n ? `מחשב ${num} גרפיקה` : `מחשב ${num}`, number: num, dayPrice: 0, weekPrice: 0, monthPrice: 0, hasStick: withStick, ...(withStick ? { simNumber: `053-71${num}00` } : {}), addedDate: daysAgo(300 - k * 10), status: "active", isGraphics: k === n });
      if (withStick) await put("n_sticks", `stk-${bid}-${k}`, { branchId: bid, name: `סטיק ${num}`, sim: `053-71${num}00`, day1: 0, day2: 0, day3plus: 0, linkedLaptopId: id, status: "active" });
    }
  }

  // ---- clients
  const names = ["אברהם גולדשטיין", "יצחק פרידמן", "שמואל רוזנברג", "דוד ויס", "אהרון קליין", "מנחם שטרן", "יוסף בלום", "חיים הורוביץ", "בנימין זילבר", "אליהו גרין"];
  const clients = [];
  let k = 0;
  for (const bid of ["r-bb", "r-bs"]) {
    for (let i = 0; i < 5; i++) {
      const id = `cl-${bid}-${i}`;
      const name = names[k++];
      clients.push({ id, bid, name });
      await put("n_rental_clients", id, { branchId: bid, name, phone: `05${(k % 8) + 2}-${4100000 + k * 13171}`, idNum: String(300000000 + k * 7919), address: bid === "r-bb" ? "בני ברק" : "בית שמש", email: `client${k}@example.com`, signedTerms: true, depositType: i % 3 === 0 ? "credit" : i % 3 === 1 ? "check" : "none", ...(i % 3 === 0 ? { cardLast4: String(1000 + k * 37).slice(-4), cardExpiry: "08/28" } : {}), referralSource: ["חבר", "מודעה", "גוגל"][i % 3] });
    }
  }

  // ---- rentals (active + returned)
  let r = 0;
  for (const bid of ["r-bb", "r-bs"]) {
    const cs = clients.filter((c) => c.bid === bid);
    const ls = lt.filter((l) => l.bid === bid);
    for (let i = 0; i < 4; i++) {
      await put("n_rentals", `rt-${++r}`, { branchId: bid, clientId: cs[i].id, itemId: ls[i].id, kind: "laptop", pricingVariant: "normal", startDate: daysAgo(3 + i * 4), calcPrice: 180, status: "active", paid: false, pickupLoc: "סניף" });
    }
    for (let i = 0; i < 6; i++) {
      const start = daysAgo(40 + i * 9), end = daysAgo(33 + i * 9);
      await put("n_rentals", `rt-${++r}`, { branchId: bid, clientId: cs[i % 5].id, itemId: ls[(i + 4) % ls.length].id, kind: "laptop", pricingVariant: "normal", startDate: start, endDate: end, returnDate: end, calcPrice: 180, finalPrice: 180, status: "returned", paid: i !== 2, paymentMethod: "מזומן" });
    }
    await put("n_rentals", `rt-${++r}`, { branchId: bid, clientId: cs[4].id, itemId: `stk-${bid}-6`, kind: "stick", startDate: daysAgo(2), calcPrice: 35, status: "active", paid: false });
  }
  // clean undefined
  // ---- expenses
  for (const bid of ["r-bb", "r-bs", "c-jlm", "c-bb"]) {
    await put("n_fixed_expenses", `fx-${bid}-rent`, { branchId: bid, name: "שכירות", amount: bid.startsWith("c") ? 4500 : 2500, startDate: "2025-06-01", category: "rent" });
    await put("n_fixed_expenses", `fx-${bid}-net`, { branchId: bid, name: "אינטרנט + סינון", amount: 220, startDate: "2025-06-01", category: "internet" });
    for (let m = 0; m < 3; m++) {
      const d = daysAgo(5 + m * 30);
      await put("n_var_expenses", `vx-${bid}-${m}`, { branchId: bid, amount: [350, 180, 620][m], desc: ["מטענים חלופיים", "נייר ודיו", "תיקון מסך"][m], date: d, month: month(d), category: "other" });
    }
  }
  // ---- coworking
  for (let i = 1; i <= 8; i++) await put("n_cw_stations", `st-${i}`, { branchId: "w-bb", name: `עמדה ${i}`, price: i <= 4 ? 650 : 850 });
  const cwNames = ["נתן ברגר", "שלמה פישר", "צבי קרויז", "אפרים לנדאו", "גדליה שפירא"];
  for (let i = 0; i < 5; i++) {
    const payments = [];
    for (let m = 3; m >= (i === 2 ? 1 : 0); m--) { const d = daysAgo(m * 30 + 2); payments.push({ month: month(d), amount: i < 4 ? 650 : 850, date: d, paymentMethod: "העברה" }); }
    await put("n_cw_clients", `cw-${i}`, { branchId: "w-bb", name: cwNames[i], phone: `052-77${i}1234`, stationId: `st-${i + 1}`, stationNumber: String(i + 1), startDate: daysAgo(120), payDay: 1, payments });
  }
  // ---- computer rooms ops
  const tasks = ["ניקוי מקלדות ומסכים", "בדיקת עדכוני ווינדוס", "גיבוי שרת", "בדיקת מדפסות"];
  for (let i = 0; i < tasks.length; i++) await put("n_ops_tasks", `opt-${i}`, { name: tasks[i], freq: i < 2 ? "weekly" : "monthly", scope: "all", branchIds: [], order: i, active: true });
  const stock = [["נייר A4", 20, "חבילות"], ["טונר שחור", 4, "יח'"], ["אוזניות", 10, "יח'"], ["עכברים", 6, "יח'"]];
  for (let i = 0; i < stock.length; i++) await put("n_ops_stock_items", `ops-${i}`, { name: stock[i][0], targetQty: stock[i][1], unit: stock[i][2], scope: "all", branchIds: [], order: i, active: true });
  // income for computer rooms
  for (const bid of ["c-jlm", "c-bb"]) for (let m = 0; m < 4; m++) { const d = daysAgo(m * 30 + 1); await put("n_branch_income", `bi-${bid}-${m}`, { branchId: bid, amount: 9000 + m * 700, desc: "הכנסות חודשיות", date: d, month: month(d), paymentMethod: "אשראי", source: "manual" }); }
  // ---- main ledger (n_ah_income / n_ah_expenses)
  for (let m = 0; m < 12; m++) {
    const d = daysAgo(m * 30 + 3);
    await put("n_ah_income", `ahi-c-${m}`, { amount: 14500 + (m % 3) * 900, desc: "הכנסות חדרי מחשבים — אשראי", business: "computers", type: "credit", date: d, month: month(d) });
    await put("n_ah_income", `ahi-r-${m}`, { amount: 7200 + (m % 4) * 450, desc: "העברה מסניף ניידים", business: "rentals", type: "laptops", date: d, month: month(d), branchId: "r-bs" });
    await put("n_ah_expenses", `ahe-${m}`, { amount: 3100 + (m % 2) * 400, desc: "ציוד משרדי ותחזוקה", business: "general", date: d, month: month(d), category: "ציוד ותחזוקה", countsToMain: true });
  }
  await put("n_ah_income", "ahi-today", { amount: 1250, desc: "קופה — חדר מחשבים בני ברק", business: "computers", type: "cash", date: daysAgo(0), month: month(daysAgo(0)), branchId: "c-bb" });
  await put("n_ah_expenses", "ahe-today", { amount: 320, desc: "נייר וטונר", business: "computers", date: daysAgo(0), month: month(daysAgo(0)), category: "ציוד ותחזוקה", countsToMain: true });
  console.log("seeded");
})().catch((e) => { console.error(e); process.exit(1); });
