# איפיון מערכת — ultranet-platform

> מסמך חי. יש לעדכן אותו בכל שינוי פיצ'ר, מודול, מודל נתונים או אינטגרציה
> (ראה כלל תחזוקת התיעוד ב-[`CLAUDE.md`](CLAUDE.md)).
>
> עודכן לאחרונה: 2026-07-15

## תוכן עניינים
1. [סקירה כללית](#1-סקירה-כללית)
2. [ארכיטקטורה](#2-ארכיטקטורה)
3. [סטאק טכנולוגי](#3-סטאק-טכנולוגי)
4. [הרצה והגדרת סביבה](#4-הרצה-והגדרת-סביבה)
5. [תפקידים והרשאות](#5-תפקידים-והרשאות)
6. [אימות (Authentication)](#6-אימות-authentication)
7. [מודל הנתונים (Firestore)](#7-מודל-הנתונים-firestore)
8. [מודולים ופיצ'רים](#8-מודולים-ופיצרים)
9. [אינטגרציות חיצוניות](#9-אינטגרציות-חיצוניות)
10. [עקרונות מפתח והחלטות ארכיטקטורה](#10-עקרונות-מפתח-והחלטות-ארכיטקטורה)
11. [מפת קבצים מרכזיים](#11-מפת-קבצים-מרכזיים)

---

## 1. סקירה כללית

**אולטרנט (ultranet)** היא מערכת ניהול מאוחדת לעסק המנהל מספר קווי פעילות בכמה
סניפים:

- **חדרי מחשבים** — ניהול מכשירים, מדפסות, קריאות שירות (tickets), משימות ומלאי.
- **השכרות** — השכרת מחשבים ניידים וסטיקים סלולריים ללקוחות, כולל תמחור, גבייה
  והנהלת חשבונות ברמת סניף.
- **משרד שיתופי (coworking)** — ניהול עמדות ולקוחות עם תשלום חודשי.
- **הנהלת חשבונות** — הכנסות/הוצאות, מסלולי גבייה, והתחשבנות שותפים.

המערכת מרובת-סניפים ומרובת-משתמשים, עם הרשאות לפי תפקיד (owner / partner /
employee) ולפי מודול. זהו **הדור הבא של `app.html`** — אפליקציית עמוד יחיד ישנה
שעדיין רצה במקביל על אותו מסד נתונים.

---

## 2. ארכיטקטורה

מונורפו מנוהל ב-**pnpm workspaces + Turborepo**:

```
ultranet-platform/
├── apps/
│   ├── web/            Next.js 14 (App Router) — האפליקציה הראשית
│   └── api/            NestJS — שירות API (על אותו Firestore)
├── packages/
│   └── shared-types/   טיפוסי TS משותפים = סכימת ה-Firestore
├── turbo.json          פייפליין build/dev/lint/typecheck
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

- **`apps/web`** — הלקוח והשרת של המשתמש. משתמש ב-App Router: `page.tsx` הן
  Server Components, מוטציות דרך Server Actions (`actions.ts`), חלקים
  אינטראקטיביים בקומפוננטות `*-client.tsx`. גישה ל-Firestore דרך
  `firebase-admin` (צד שרת בלבד).
- **`apps/api`** — שירות NestJS נפרד שקורא מאותו פרויקט Firestore
  (`ultranet-e94aa`). כרגע כולל מודול `branches` לדוגמה + מודול Firebase.
- **`packages/shared-types`** — מקור אמת יחיד לטיפוסי הדומיין; משקף שם-לשם את
  קולקשני ושדות ה-Firestore.

---

## 3. סטאק טכנולוגי

| שכבה | טכנולוגיה |
|------|-----------|
| שפה | TypeScript (strict), Node ≥ 20 |
| Frontend/SSR | Next.js 14 (App Router), React 18 |
| עיצוב | Tailwind CSS (RTL, ממשק בעברית) |
| אימות | NextAuth 4 (Credentials + Email-code + Google) |
| API נוסף | NestJS |
| DB | Firebase / Firestore (`firebase-admin`) |
| מייל | Resend, EmailJS (`@emailjs/browser`) |
| תשלומים | Nedarim Plus (טוקניזציה + חיוב) |
| קבצים/אקסל | `xlsx` (ייצוא/ייבוא לקוחות) |
| Build | Turborepo, pnpm 9 |

---

## 4. הרצה והגדרת סביבה

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev        # turbo run dev — מריץ web + api
```

משתני סביבה (`apps/web/.env.example`):

| משתנה | תיאור |
|-------|-------|
| `FIREBASE_PROJECT_ID` | `ultranet-e94aa` |
| `FIREBASE_CLIENT_EMAIL` | חשבון שירות Firebase Admin |
| `FIREBASE_PRIVATE_KEY` | מפתח פרטי של חשבון השירות |
| `NEXTAUTH_SECRET` | סוד NextAuth |
| `NEXTAUTH_URL` | כתובת הבסיס (localhost:3000 בפיתוח) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | אופציונלי — כניסת Google |

ל-`apps/api` קובץ `.env.example` נפרד עם פרטי Firebase.

---

## 5. תפקידים והרשאות

מוגדר ב-`apps/web/lib/perms.ts` ו-`packages/shared-types` (`AppUser`).

**תפקידים (`UserRole`):** `owner` · `partner` · `employee`.

**מפתחות הרשאה (`PermKey`):**
`branches` · `computers` · `rentals` · `coworking` · `accounting` · `tasks` · `charging`.

**כללי גישה:**
- `owner` — עובר תמיד את כל הבדיקות (branchId = `"all"`).
- `partner` / `employee` — עוברים רק אם `n_users.perms[key] === true`.
- `requireModuleAccess(key)` — שער כניסה למודול; מפנה ל-`/dashboard` בהיעדר
  הרשאה, ול-`/login` בהיעדר session.
- `requireOwner()` — למסכים ברמת בעלים בלבד (למשל הנהלת חשבונות מרכזית).
- `viewClientBranchIds` — שיתוף ראייה של לקוחות בין סניפים (cross-branch).
- `charging` — הרשאה נפרדת המתירה חיוב כרטיסים (gate ל-UI וגם בצד שרת).

הניווט (`lib/nav-items.ts`) מסנן פריטים לפי הרשאה עם `visibleFor(role, perms, item)`.

---

## 6. אימות (Authentication)

מוגדר ב-`apps/web/lib/auth.ts` (NextAuth, אסטרטגיית JWT). שלושה providers:

1. **מייל + סיסמה** — נבדק מול `n_users` (השדה `pass`, plaintext legacy — תואם
   ל-`app.html`; יש להחליף לאימות תקין לפני חשיפה חיצונית).
2. **קוד באימייל** (`email-code`) — מייל חייב להופיע ב-`n_approved_emails`; קוד
   חד-פעמי נשמר ב-`n_login_codes` עם תפוגה, ונמחק אחרי שימוש.
3. **Google** — מצליח רק אם כתובת ה-Gmail כבר קיימת ב-`n_users`.

ה-JWT מסנכרן מחדש `role` / `branchId` / `perms` / `viewClientBranchIds`
מ-Firestore כל ~2 דקות, כך ששינויי הרשאה נכנסים לתוקף בלי צורך בכניסה מחדש.
בנוסף קיים אימות מכשיר (`/verify-device`, `lib/device-trust.ts`).

---

## 7. מודל הנתונים (Firestore)

כל השמות בתחילית `n_`. הטיפוסים ב-`packages/shared-types/src/index.ts`.
**אין לשנות שמות שדות/קולקשנים ללא התאמה ל-`app.html` ולדאטה הקיים.**

| קולקשן | טיפוס | תיאור |
|--------|-------|-------|
| `n_branches` | `Branch` | סניפים; סוג (`computers`/`rentals`/`coworking`), אחוזי בעלים/שותף, סניף-אב, מסלול גבייה, דגלי גבייה/קבלות |
| `n_users` | `AppUser` | משתמשים; תפקיד, סניף, `perms`, `viewClientBranchIds` |
| `n_fixed_expenses` | `FixedExpense` | הוצאות קבועות לסניף |
| `n_var_expenses` | `VariableExpense` | הוצאות משתנות (לפי חודש) |
| `n_branch_income` | `BranchIncome` | הכנסות סניף (שותפים) |
| `n_tasks` | `Task` | משימות (דחיפות, חזרתיות, בוצע) |
| `n_sub_locations` | `SubLocation` | תתי-מיקומים בסניף |
| `n_devices` | `Device` | מכשירים/מחשבים בחדרי מחשבים |
| `n_laptops` | `Laptop` | מחשבים ניידים להשכרה + תמחור (יום/שבוע/חודש, וריאנטים) |
| `n_sticks` | `Stick` | סטיקים סלולריים + תמחור מדורג |
| `n_rental_clients` | `RentalClient` | לקוחות השכרה; פרטי כרטיס לא-רגישים, `gatewayToken` |
| `n_client_private_flags` | `ClientPrivateFlag` | סימון פרטי לחלוטין לפי משתמש (`uid`) על לקוח, למשל "חייב" — נשלף ונכתב תמיד עם סינון לפי `uid` של המשתמש המחובר בלבד, לא נחשף למשתמשים אחרים |
| `n_rentals` | `Rental` | השכרות; פריט, תאריכים, מחיר מחושב/סופי, סטטוס, תשלום |
| `n_inventory` | `InventoryItem` | מלאי (כמות, מינימום) |
| `n_tickets` | `Ticket` | קריאות שירות למכשירים |
| `n_printers` | `Printer` | מדפסות (טונר, נייר, IP) |
| `n_cw_stations` | `CoworkingStation` | עמדות במשרד שיתופי |
| `n_cw_clients` | `CoworkingClient` | לקוחות משרד שיתופי + היסטוריית תשלומים |
| `n_ah_income` | `AccountingIncome` | הכנסות בהנה"ח מרכזית (בעלים) |
| `n_ah_expenses` | `AccountingExpense` | הוצאות בהנה"ח מרכזית |
| `n_collection_routes` | `CollectionRoute` | מסלולי גבייה (ספק תשלום, קבלות, יעד הפקדה, עמלות) |
| `n_branch_transfers` | `BranchTransfer` | התחשבנות חודשית שותף↔בעלים |
| `n_approved_emails` | — | מיילים מאושרים לכניסת קוד |
| `n_login_codes` | — | קודי כניסה חד-פעמיים עם תפוגה |

> הערה: `RentalClient` שומר `cardLast4` (תצוגה בלבד), `cardExpiry` (MM/YY,
> לא רגיש) ו-`gatewayToken` — לעולם לא PAN מלא.

---

## 8. מודולים ופיצ'רים

הבסיס תחת `apps/web/app/dashboard/`. פריטי הניווט הראשיים
(`lib/nav-items.ts`): בית · חדרי מחשבים · השכרות · משרד שיתופי · הנה"ח · הדרכות.

### חדרי מחשבים (`/dashboard/computer-rooms`) — perm: branches/computers/tasks
מכשירים (`n_devices`), מדפסות, קריאות שירות (`/tickets`), משימות (`/tasks`),
מלאי (`/inventory`), חדשות/עדכונים (`/news`), ניהול סניפים (`/branches`).

### השכרות (`/dashboard/rentals`) — perm: rentals
- **`/`** — סקירת השכרות (טאבים: `rentals-tabs.tsx`).
- **`/new`** — יצירת השכרה חדשה (`new-rental-form.tsx`).
- **`/laptops`** — ניהול מחשבים ניידים + תמחור (CRUD).
- **`/clients`** — לקוחות: כרטיס לקוח, לכידת כרטיס אשראי וטוקניזציה
  (`nedarim-card-capture.tsx`), חיוב (`client-charge-section.tsx`,
  `nedarim-charge-capture.tsx`), ייצוא/ייבוא אקסל. טבלת הלקוחות
  (`clients-table.tsx`) כוללת כפתורי סינון "הצג את שלי" (הסניף של המשתמש +
  סניפים עם `parentBranchId` שווה לסניף שלו) מול "הצג את של כולם" (כל הלקוחות
  שהמשתמש מורשה לראות לפי ההרשאות הקיימות), וכן תיבת סימון "חייב" פרטית
  לחלוטין לכל שורה — נשמרת ב-`n_client_private_flags` וממופה תמיד רק לפי
  `uid` המשתמש המחובר, כך שאף משתמש אחר לא רואה או משנה אותה.
- **`/manage`** — ניהול השכרות פעילות והיסטוריה, חובות (`unpaid-row-actions.tsx`).
  כפתור "גבייה מידית" בשורת השכרה פעילה (`active-rental-row.tsx`) גלוי רק
  ל-owner או למי שיש לו `perms.charging`; אם ללקוח יש `gatewayToken`+`cardExpiry`
  שמורים הוא מחייב ישירות דרך הטוקן (`token-charge-button.tsx` → `/api/rentals/charge`),
  אחרת נופל חזרה להזנת כרטיס ידנית באייפרם (`nedarim-charge-capture.tsx`).
- **`/mine`** — ההשכרות שלי.
- **`/expenses`** — הוצאות סניף השכרות.
- **`/accounting`** — הנה"ח ברמת סניף השכרות: תצוגת סניף/בעלים, סימון העברות
  (`mark-transferred-button.tsx`, `n_branch_transfers`).
- **`/branches`** — ניהול סניפי השכרה + audit הרשאות.
- **`/labels`** — הדפסת מדבקות ללקוחות/פריטים + הגדרות לוגו.
- **API `/api/rentals/charge`** — חיוב כרטיס דרך Nedarim Plus (`DebitCard.aspx`)
  לפי `gatewayToken`/`cardExpiry` שמורים על הלקוח; מוגן בהרשאת `charging` בצד
  שרת, ומזהה המוסד (`Mosad`) נפתר דינמית דרך `resolveNedarimCreds` לפי סניף
  הלקוח (לא hardcoded).
- **API `/api/rentals/clients/export|template`** — ייצוא/תבנית אקסל של לקוחות.

תמחור השכרה: `lib/rental-pricing.ts` (יום/שבוע/חודש + וריאנטים
`noInternet` / `stickOnly`).

### משרד שיתופי (`/dashboard/coworking`) — perm: coworking
עמדות (`/stations`, `n_cw_stations`) ולקוחות (`/new`, `n_cw_clients`) עם
מחיר חודשי והיסטוריית תשלומים.

### הנהלת חשבונות (`/dashboard/accounting`) — perm: accounting
הכנסות/הוצאות מרכזיות (`n_ah_income` / `n_ah_expenses`), גבייה (`collect-modal.tsx`,
`lib/collection-charge.ts`), ומסלולי גבייה (`/routes`, `n_collection_routes`).
חישובי התחשבנות ב-`lib/branch-accounting.ts` / `branch-accounting-data.ts`.

### הדרכות (`/dashboard/tutorials`)
מאגר הדרכות עם עורך עשיר (`rich-editor.tsx`), קבצים מצורפים, תמונות והדפסה.

### מודולים רוחביים
- **משתמשים** (`/users`) — ניהול משתמשים והרשאות (owner).
- **סניפים** (`/branches`) — ניהול סניפים כללי.
- **משימות / הזמנות / מלאי / חדשות / קריאות שירות** — ניהול תפעולי.

---

## 9. אינטגרציות חיצוניות

- **Firebase / Firestore** — מסד הנתונים. גישת אדמין דרך `lib/firebase-admin.ts`
  (web) ו-`firebase.service.ts` (api). פרויקט: `ultranet-e94aa`.
- **Nedarim Plus** (`lib/nedarim.ts`) — סליקה ישראלית. פתרון creds לפי סניף:
  קודם מסלול משויך לסניף (`branch.collectionRouteId`), אחרת מסלול גלובלי
  (`branchScope === null`) כברירת מחדל של הבעלים. חיוב דרך `/api/rentals/charge`
  ו-`lib/collection-charge.ts`. שמירת טוקן בלבד, לא כרטיס.
- **Resend** — שליחת מיילים מצד שרת (קודי כניסה וכו').
- **EmailJS** (`@emailjs/browser`) — שליחת מיילים מהלקוח.
- **מסלולי גבייה** (`n_collection_routes`) — הפשטה מעל ספקי סליקה
  (`nedarim_plus` / `tranzila` / `cardcom` / `payplus` / `meshulam` / manual)
  וספקי קבלות (`icount` / `green_invoice`), כולל יעד הפקדה ועמלות.

---

## 10. עקרונות מפתח והחלטות ארכיטקטורה

- **אין מיגרציית דאטה.** ה-DB נשאר Firestore בדיוק כמו ב-`app.html`. אין שינוי
  סכימה, אין העברת נתונים. `app.html` הישן ממשיך לרוץ במקביל עד שהמערכת החדשה
  תבשיל.
- **מקור אמת אחד לטיפוסים** — `packages/shared-types`. כל שינוי שדה/קולקשן
  מחייב סנכרון עם ה-DB ועם `app.html`.
- **הרשאות בצד שרת** — כל מודול נשען על `requireModuleAccess` / `requireOwner`;
  אין להסתמך על הסתרת UI בלבד.
- **בטיחות תשלומים** — אין לשמור נתוני כרטיס מלאים; רק ארבע ספרות אחרונות,
  תוקף וטוקן שער.
- **קוד-סניף `"all"`** — לבעלים; מסמן ראייה חוצת-סניפים.

---

## 11. מפת קבצים מרכזיים

| נתיב | תפקיד |
|------|-------|
| `packages/shared-types/src/index.ts` | כל טיפוסי הדומיין / סכימת Firestore |
| `apps/web/lib/perms.ts` | שערי הרשאה (`requireModuleAccess`, `requireOwner`) |
| `apps/web/lib/nav-items.ts` | הגדרת ניווט + סינון לפי הרשאה |
| `apps/web/lib/auth.ts` | NextAuth (3 providers, סנכרון JWT) |
| `apps/web/lib/firebase-admin.ts` | אתחול Firebase Admin (web) |
| `apps/web/lib/nedarim.ts` | פתרון creds ל-Nedarim Plus לפי סניף |
| `apps/web/lib/rental-pricing.ts` | לוגיקת תמחור השכרות |
| `apps/web/lib/collection-charge.ts` | לוגיקת חיוב/גבייה |
| `apps/web/lib/branch-accounting*.ts` | חישובי הנה"ח והתחשבנות סניפים |
| `apps/web/lib/device-trust.ts` | אימות/אמון מכשיר |
| `apps/web/middleware.ts` | middleware של Next (הגנת נתיבים) |
| `apps/api/src/branches/*` | מודול NestJS לדוגמה (branches) |
| `apps/api/src/firebase/*` | מודול Firebase ב-NestJS |
