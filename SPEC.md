# איפיון מערכת — ultranet-platform

> מסמך חי. יש לעדכן אותו בכל שינוי פיצ'ר, מודול, מודל נתונים או אינטגרציה
> (ראה כלל תחזוקת התיעוד ב-[`CLAUDE.md`](CLAUDE.md)).
>
> עודכן לאחרונה: 2026-07-21

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
| `n_branch_income` | `BranchIncome` | הכנסות סניף; שורות הכנסה ידניות owner-only בדף `/dashboard/rentals/expenses/[id]` - מתחשבנות כמו השכרה רגילה בחישוב ההשכרות (`computeBranchFinancials`), וגם שורות ידניות נפרדות בדשבורד "השקעה מול רווח" של חדרי מחשבים (שם לא מחושבות בשום מקום) - בשני המקרים לעולם לא נכתב ל-`n_ah_income`, לא משפיע על הנה"ח הראשית |
| `n_tasks` | `Task` | משימות (דחיפות, חזרתיות, בוצע) |
| `n_sub_locations` | `SubLocation` | תתי-מיקומים בסניף |
| `n_devices` | `Device` | מכשירים/מחשבים בחדרי מחשבים |
| `n_laptops` | `Laptop` | מחשבים ניידים להשכרה + תמחור (יום/שבוע/חודש, וריאנטים) |
| `n_sticks` | `Stick` | סטיקים סלולריים + תמחור מדורג |
| `n_rental_clients` | `RentalClient` | לקוחות השכרה; פרטי כרטיס לא-רגישים, `gatewayToken` |
| `n_rentals` | `Rental` | השכרות; פריט, תאריכים, מחיר מחושב/סופי, סטטוס, תשלום |
| `n_inventory` | `InventoryItem` | מלאי (כמות, מינימום) |
| `n_tickets` | `Ticket` | קריאות שירות למכשירים |
| `n_printers` | `Printer` | מדפסות (טונר, נייר, IP) |
| `n_cw_stations` | `CoworkingStation` | עמדות במשרד שיתופי |
| `n_cw_clients` | `CoworkingClient` | לקוחות משרד שיתופי + היסטוריית תשלומים |
| `n_ah_income` | `AccountingIncome` | הכנסות בהנה"ח מרכזית (בעלים); 3 סוגים בלבד - `laptops`/`credit`/`cash`, ראו סעיף 8 |
| `n_ah_expenses` | `AccountingExpense` | הוצאות בהנה"ח מרכזית |
| `n_collection_routes` | `CollectionRoute` | מסלולי גבייה (ספק תשלום, קבלות, יעד הפקדה, עמלות) |
| `n_branch_transfers` | `BranchTransfer` | התחשבנות חודשית שותף↔בעלים |
| `n_approved_emails` | — | מיילים מאושרים לכניסת קוד |
| `n_login_codes` | — | קודי כניסה חד-פעמיים עם תפוגה |

> הערה: `RentalClient` שומר `cardLast4` (תצוגה בלבד), `cardExpiry` (MM/YY,
> לא רגיש) ו-`gatewayToken` — לעולם לא PAN מלא. שדה נוסף: `referralSource`
> (רשות, טקסט חופשי) — מאיפה הלקוח הגיע אלינו, למעקב שיווקי.

---

## 8. מודולים ופיצ'רים

הבסיס תחת `apps/web/app/dashboard/`. פריטי הניווט הראשיים
(`lib/nav-items.ts`): בית · חדרי מחשבים · השכרות · משרד שיתופי · הנה"ח · הדרכות.

### חדרי מחשבים (`/dashboard/computer-rooms`) — perm: branches/computers/tasks
מכשירים (`n_devices`), מדפסות, קריאות שירות (`/tickets`), משימות (`/tasks`),
מלאי (`/inventory`), חדשות/עדכונים (`/news`), ניהול סניפים (`/branches`).

- **`/expenses`** (perm: `computers`) — הוצאות קבועות/חד-פעמיות פר סניף חדר מחשבים
  (`n_fixed_expenses` / `n_var_expenses`, אותו מודל בדיוק כמו ב-`/dashboard/rentals/expenses`).
  לכל הוצאה (קבועה או חד-פעמית) יש כפתור **עריכה** הפותח מודל לעריכת כל השדות - שם/תיאור,
  סכום, תאריך, קטגוריה, ו"מי שילם בפועל"/"על מי החוב" עבור סניפי שותף
  (`updateFixedExpenseAction` / `updateVariableExpenseAction` ב-`actions.ts`). `canManage`
  (עריכה/מחיקה/סיום) פתוח ל-owner **וגם** לשותף בסניף שלו עצמו (`isOwner || isPartner` ב-
  `[id]/page.tsx`) - לא רק ל-owner כמו קודם; ה-Server Actions עצמם אוכפים זאת דרך
  `requireBranchAccess(branchId)` וגם מוודאים ש-`id` שהתקבל שייך בפועל לאותו `branchId`
  (`loadOwnedFixedExpense`/`loadOwnedVariableExpense`) כדי שרשות פעולה על הסניף שלך לא תאפשר
  למחוק/לערוך הוצאה של סניף אחר.
  עריכת הוצאה חד-פעמית מוחקת ויוצרת מחדש את רשומת ה-`n_ah_expenses` המקושרת (אם יש) לפי
  הנתונים החדשים, באותו אופן שבו `createLinkedOwnerLedgerExpense`/`deleteLinkedOwnerLedgerExpense`
  עובדים ביצירה/מחיקה. פעולות עריכה/מחיקה/סיום (`expense-action-buttons.tsx`,
  `edit-expense-modals.tsx`) קוראות ל-Server Action ישירות מהלקוח (לא דרך `<form action>` פשוט),
  ומריצות `router.refresh()` + הודעת "בוצע בהצלחה" (`lib/toast.tsx`) בסיום - כדי למנוע את
  התופעה שבה `redirect()` לאותו נתיב לא רענן בפועל את הרשימה בלי רענון ידני. בנוסף קיים
  "סניף" מדומה **`shared-computers`** (`SHARED_COMPUTERS_BRANCH_ID`, מיוצא גם בתור
  `SHARED_EXPENSE_BRANCH_ID` מ-`apps/web/lib/computer-room-accounting.ts` לתאימות; המקבילה
  בניידים היא `SHARED_RENTALS_BRANCH_ID`, שתיהן מוגדרות ב-`apps/web/lib/expense-shared-scope.ts`)
  עבור הוצאות המשותפות לכל סניפי חדרי המחשבים יחד (למשל פרסום/רישיונות משותפים) - עלותן
  מתחלקת שווה בשווה בין הסניפים בחישוב "הוצאות עד היום" בדשבורד ההשקעה-מול-רווח
  (`/computer-rooms-accounting`, ראו להלן), אך **לא** מתחלקת כשהיא מתחשבנת בהנה"ח הראשית (שם
  היא נספרת פעם אחת במלואה, ראו סעיף 10). מסך הבחירה (`/dashboard/expenses`) מציג גם קישור
  ייעודי להוצאות המשותפות. שדות "מי שילם בפועל"/"על מי החוב" (`paidBy`/`owedBy`) מוצגים עם
  שמות אמיתיים - לא "אני"/"השותף" - דרך `apps/web/lib/owner-name.ts`; זה כולל גם את הסניף
  המדומה המשותף, שקודם לא איפשר לבחור כלל מי שילם.
- **`/computer-rooms-accounting`** (perm: `computers`) — דשבורד "השקעה מול רווח" פר סניף חדר
  מחשבים: **עלות הקמה** (`Branch.setupCost`), **הוצאות עד היום כולל הקמה** (הקמה + הוצאות
  הסניף + חלקו בהוצאות המשותפות), **הכנסות עד היום**, ו**רווח מוחזק** (הכנסות פחות הוצאות).
  עלות ההקמה נספרת גם ב**סה"כ הוצאות בהנה"ח הראשית** (`loadComputerRoomSetupCostTotal`,
  `apps/web/lib/computer-room-accounting.ts`) - במלואה, כהוצאת בעלים, ללא תלות בחודש/יום (זה
  סכום חד-פעמי, לא עסקה מתוארכת).
  ההכנסות כאן הן שורה ידנית אחת לחודש שמוסיפים לכל סניף (`n_branch_income`,
  `addBranchIncomeAction`) - **מעקב סטטוס בלבד**, לא נכתב ל-`n_ah_income` ולכן לא מתחשבן
  בהנה"ח הראשית ולא בדף הבית. owner רואה סקירת כל הסניפים ונכנס לכל סניף בנפרד; partner/עובד
  עם הרשאת `computers` רואה ישירות את הסניף שלו. הוספת שורת הכנסה מותרת ל-owner ול-partner של
  אותו סניף בלבד.

### השכרות (`/dashboard/rentals`) — perm: rentals
- **`/`** — סקירת השכרות (טאבים: `rentals-tabs.tsx`).
- **`/new`** — יצירת השכרה חדשה (`new-rental-form.tsx`). בחירת הלקוח מתבצעת דרך
  `CustomerCombobox` (`customer-combobox.tsx`) — תיבת חיפוש-והשלמה שמסננת בזמן
  הקלדה לפי שם/טלפון מתוך לקוחות הסניף שנבחר (סינון בצד הלקוח על רשימה שכבר
  נטענה), ולא רשימה נפתחת מלאה; בחירת סניף מאפסת את הלקוח שנבחר. מכיוון
  שהשכרה נשארת `status: "active"` ללא תאריך סיום קבוע עד להחזרה מפורשת
  (`markReturnedAction`/`closeRentalAction`), לא ניתן לפתוח השכרה נוספת על אותו
  פריט (מחשב/סטיק) כל עוד יש לו כבר השכרה פעילה: הדף טוען את רשימת ה-`itemId`
  המושכרים כרגע (`n_rentals` עם `status == "active"`) ומעביר אותה ל-`NewRentalForm`,
  שמנטרלת ומסמנת "מושכר כרגע" את האפשרויות המתאימות בתיבת הבחירה ומציגה הודעת
  אזהרה; `createRentalAction` (`../actions.ts`) חוסם את היצירה גם בצד השרת
  (`error=already-rented`) למקרה מרוץ שבו שני משתמשים מנסים להשכיר את אותו
  פריט בו-זמנית.
- **`/laptops`** — ניהול מחשבים ניידים + תמחור (CRUD).
- **`/clients`** — לקוחות: מסך הרשימה נפתח ללא טופס הוספה גלוי — כפתור
  "הוספת לקוח" בפינה השמאלית העליונה (`clients-header.tsx`, קומפוננטת
  `use client` שמכילה גם את כותרת העמוד) פותח/סוגר את `client-form.tsx`
  בתצוגה מקומית; לאחר שמירה מוצלחת ה-Server Action מבצע `redirect` חזרה
  ל-`/dashboard/rentals/clients` והטופס חוזר סגור כברירת מחדל. בכשל ולידציה
  (`?error=missing`) הטופס נפתח אוטומטית כדי להציג את השגיאה בהקשר. הטופס
  כולל שדה רשות "מאיפה הגיע אלינו" (`referralSource`, טקסט חופשי) למעקב
  שיווקי. כרטיס לקוח, לכידת כרטיס אשראי וטוקניזציה
  (`nedarim-card-capture.tsx`), חיוב (`client-charge-section.tsx`,
  `nedarim-charge-capture.tsx`), ייצוא/ייבוא אקסל. טבלת הלקוחות
  (`clients-table.tsx`) כוללת כפתורי סינון "הצג את שלי" (הסניף של המשתמש +
  סניפים עם `parentBranchId` שווה לסניף שלו) מול "הצג את של כולם" (כל הלקוחות
  שהמשתמש מורשה לראות לפי ההרשאות הקיימות), וכן שדה חיפוש חופשי לפי שם/טלפון
  (סינון בזמן הקלדה על הרשימה שכבר נטענה בצד הלקוח, ללא שאילתה נוספת ל-Firestore)
  לאיתור מהיר של לקוח קיים מתוך רשימה גדולה — למשל כדי לבדוק אם לקוח כבר קיים
  לפני יצירת אחד חדש, או כדי לגשת מהר לכפתור "חייב" שלו. לכל לקוח עם טוקן כרטיס שמור
  (`gatewayToken` + `cardExpiry`) מוצג בשורה כפתור "חייב" (מוצג רק ל-`owner`
  או למי שיש לו `perms.charging`), שפותח את `TokenChargeButton` הקיים
  (`../manage/token-charge-button.tsx`) וקורא ל-`/api/rentals/charge` לחיוב
  ישיר דרך הטוקן השמור, ללא הזנת פרטי כרטיס מחדש.
- **`/clients/complete-cards`** — מסך עזר להשלמת טוקניזציה בכמות: מציג בתור
  את כל הלקוחות בהיקף המשתמש שאין להם `cardLast4` שמור, עם `NedarimCardCapture`
  פתוח לכל לקוח בתורו (מתקדם אוטומטית ללקוח הבא אחרי שמירה מוצלחת, ניתן גם
  לדלג). מטרתו לאפשר מעבר מהיר בין הרבה לקוחות בלי לנווט לדף עריכה נפרד לכל
  אחד — הכרטיס עדיין מוקלד תמיד ישירות באייפרם המאובטח של נדרים פלוס, אף פעם
  לא דרך שרת האפליקציה.
- **`/manage`** — ניהול השכרות פעילות והיסטוריה, חובות (`unpaid-row-actions.tsx`).
  כפתור "גבייה מידית" בשורת השכרה פעילה (`active-rental-row.tsx`) גלוי רק
  ל-owner או למי שיש לו `perms.charging`; אם ללקוח יש `gatewayToken`+`cardExpiry`
  שמורים הוא מחייב ישירות דרך הטוקן (`token-charge-button.tsx` → `/api/rentals/charge`),
  אחרת נופל חזרה להזנת כרטיס ידנית באייפרם (`nedarim-charge-capture.tsx`).
  לצד זה כפתור "קבלה (מזומן/העברה)" (`issueCashReceiptAction`, גם הוא מוגבל
  ל-`perms.charging`) מפיק ושולח קבלת EZcount ידנית עבור תשלום מזומן/העברה.
  חיוב אשראי מצליח (דרך `/api/rentals/charge`) מפיק קבלת EZcount אוטומטית
  ושולח אותה במייל ללקוח, כל עוד מוגדר לסניף מסלול עם `receiptsProvider: "ezcount"`.
- **`/mine`** — ההשכרות שלי.
- **`/expenses`** — הוצאות סניף השכרות (`n_fixed_expenses`/`n_var_expenses`), כולל "סניף" מדומה
  **`shared-rentals`** (`SHARED_RENTALS_BRANCH_ID`, `apps/web/lib/expense-shared-scope.ts`)
  להוצאות משותפות לכל סניפי ההשכרות יחד. ראו סעיף 8 (חדרי מחשבים → `/expenses`) ו-10 להסבר
  המלא על איך הוצאות אלה מתחשבנות בהנה"ח הראשית. באותו דף, לכל סניף אמיתי (לא `shared-rentals`)
  יש גם קטע **"הכנסות" - owner בלבד** (`addBranchIncomeAction`/`deleteBranchIncomeAction`,
  `apps/web/app/dashboard/rentals/expenses/actions.ts`): הזנה ידנית של הבעלים (למשל הכנסות
  ישנות שלא נרשמו כהשכרות במערכת), נכתבת ל-`n_branch_income` עם שדה `collectedByOwner` (מוצג
  רק כשלסניף יש שותף - "מי מחזיק כרגע בכסף", אני/השותף). היא **מתנהגת כמו הכנסת השכרה רגילה**:
  `buildManualIncomeLines` (`apps/web/lib/branch-accounting-data.ts`) ממזגת אותה לתוך אותן
  income lines ש-`computeBranchFinancials` בונה מהשכרות אמיתיות, כך שהיא נכנסת ל"הכנסות
  החודש"/"הכנסות עד היום" ולמאזן ההעברה החודשית ב-`/dashboard/rentals/accounting` בדיוק כמו כל
  הכנסת השכרה אחרת. מה שכן נשאר זהה לכל הכנסת השכרה: היא **לעולם לא** נכתבת ל-`n_ah_income` -
  מגיעה להנה"ח הראשית רק אם הבעלים מקליד אותה שם ידנית (סוג הכנסה `laptops`).
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
לכל הוצאה ברשימת "הוצאות אחרונות" יש כפתור **עריכה** (`edit-expense-modal.tsx`, owner בלבד)
לעריכת תאריך/תיאור/סכום/עסק (`updateExpenseAction`), בנוסף לכפתור המחיקה הקיים.

**הכנסות (`n_ah_income`) - 3 סוגים בלבד, אלה היחידים שמתחשבנים בהנה"ח הראשית ובדף הבית:**
טופס ההוספה ב-`/dashboard/accounting` (וגם הטופס המקוצר ב-`/dashboard/rentals/accounting`)
בנוי סביב שדה `type`:
1. **`laptops`** (ניידים) - תאריך + בחירת סניף מתוך סניפי `rentals` (`branchId`) + סכום.
   `business` נקבע אוטומטית ל-`rentals`.
2. **`credit`** (אשראי מהעסק) - תאריך (ברירת מחדל ל-10 בחודש הנוכחי) + סכום, ללא סניף.
   `business` = `general`.
3. **`cash`** (מזומן) - תאריך + בחירת קופה מתוך סניפי `computers` (`branchId` = איזו קופה
   נלקח ממנה המזומן) + סכום. `business` נקבע אוטומטית ל-`computers`.

**חשוב:** סימון השכרה כ"שולם" (`markRentalPaidAction`, `apps/web/app/dashboard/rentals/actions.ts`)
וסימון השכרה כ"הוחזר" (`markReturnedAction`, אותו קובץ) **לא** כותבים ל-`n_ah_income` -
זו בכוונה בדיקת-ספרים פנימית של מודול ההשכרות בלבד (`n_rentals`), עצמאית לגמרי מההנה"ח
הראשית. פעם היה שם קוד ישן שכתב אוטומטית ל-`n_ah_income` (וב-`markReturnedAction` אפילו חייב
אוטומטית דרך `chargeViaRoute` בכל החזרה עם מסלול גבייה, בלי שום פעולה מפורשת של הבעלים) - זה
הוסר, כי זה סתר את הכלל של 3 הסוגים למעלה: הכנסת ניידים מגיעה להנה"ח הראשית *רק* כשהבעלים
מקליד אותה ידנית שם (סוג `laptops`), לעולם לא אוטומטית מתוך מודול ההשכרות.

**הוצאות (`n_ah_expenses`) - מתחשבנות אוטומטית מהוצאות הסניפים, אבל רק כשהבעלים באמת שילם:**
בניגוד להכנסות, הוצאות סניף (ניידים וחדרי מחשבים, כולל ה"סניפים" המשותפים) *כן* מתחשבנות
בהנה"ח הראשית ובדף הבית - אבל לא תמיד, ולא הסכום המלא. הכלל הוא `ownerLedgerExpenseAmount(amount,
paidBy, owedBy)` (`apps/web/lib/branch-accounting.ts`), שדורש **שני** תנאים לפני שמשהו נכנס
להנה"ח הראשית בכלל:
1. **`paidBy: "owner"`** - הבעלים הוא זה ששילם בפועל. אם השותף שילם (`paidBy: "partner"`), שום
   דבר לא נכנס להנה"ח הראשית, **גם אם חלק/כל החוב על הבעלים** (`owedBy`) - כי לא היתה יציאת
   מזומן אמיתית מהבעלים; במקום זאת זה מתקזז מול ההעברה החודשית שהשותף מעביר לבעלים בסוף
   החודש (`expenseNetToOwner`/`computeMonthlySettlement`, אותו קובץ) - לא נגבה בנפרד.
2. רק כש-(1) מתקיים, נבדק `owedBy`: `"partner"` → 0 (לא באמת עלות של הבעלים), `"shared"` →
   חצי, `"owner"`/ברירת מחדל → הסכום המלא.
- **הוצאות חד-פעמיות (`n_var_expenses`)** - כתובת מייד ל-`n_ah_expenses` בזמן היצירה
  (`createLinkedOwnerLedgerExpense`, `apps/web/lib/branch-expense-ledger.ts`), עם `business`
  מתאים (`rentals`/`computers`) ו-`amount` = `ownerLedgerExpenseAmount`. ה-id של הרשומה נשמר
  בשדה `VariableExpense.linkedAhExpenseId` ונמחק יחד עם ההוצאה (`deleteLinkedOwnerLedgerExpense`).
  אם הסכום הוא 0 (השותף שילם, או שהחוב כולו עליו) - לא נוצרת רשומה כלל.
- **הוצאות קבועות/חוזרות (`n_fixed_expenses`)** - **לא** נכתבות כרשומות מתוארכות ל-`n_ah_expenses`
  (הוצאה חוזרת מדי חודש, לא אירוע חד-פעמי). במקום זאת, `loadOwnerFixedExpenseBurden`
  (`apps/web/lib/owner-expense-burden.ts`) מחשבת בזמן אמת את סך `ownerLedgerExpenseAmount` בכל
  ההוצאות הקבועות הפעילות (ניידים + חדרי מחשבים, כולל שני ה"סניפים" המשותפים - כל אחד נספר
  במלואו, בלי חלוקה פר-סניף) - החודש ועד היום - ומתווספת מעל סכום `n_ah_expenses` בדף
  `/dashboard/accounting` (סה"כ הוצאות) ובדף הבית (הוצאות החודש). אין ל"היום" (יומי) משמעות
  עבור הוצאה חודשית קבועה, ולכן היא לא נכללת בחישובי "הוצאות היום".
- **עלות הקמת סניפי חדרי מחשבים (`Branch.setupCost`)** - נספרת גם היא, בנפרד מהכלל של
  `ownerLedgerExpenseAmount` למעלה (אין `paidBy`/`owedBy` על שדה ההקמה - זו תמיד הוצאת בעלים
  במלואה). `loadComputerRoomSetupCostTotal` (`apps/web/lib/computer-room-accounting.ts`) מסכמת
  בזמן אמת את `setupCost` של כל סניפי `computers` ומתווספת מעל `n_ah_expenses` ב-
  `/dashboard/accounting` (סה"כ הוצאות) - בדיוק כמו הוצאות קבועות, גם זו לא רשומה מתוארכת ולא
  משפיעה על "הוצאות היום"/"הוצאות החודש" (אין לה תאריך משמעותי, זה סכום חד-פעמי מצטבר). ראו גם
  `/computer-rooms-accounting` בסעיף 8.
- **חשוב:** `ownerExpenseBurden(amount, owedBy)` (בלי תלות ב-`paidBy`) עדיין קיימת בנפרד
  ומשמשת את דשבורדי "השקעה מול רווח" (`computeBranchFinancials` בהשכרות,
  `computer-room-accounting.ts` בחדרי מחשבים) - שם רוצים את העלות הכלכלית האמיתית של הסניף
  בלי קשר למי פיזית שילם. `ownerLedgerExpenseAmount` (עם `paidBy`) משמש *רק* להזנה להנה"ח
  הראשית (`n_ah_expenses`), ששם חשובה יציאת המזומן בפועל.

ערכי `type` הישנים (`fixed`/`variable`) נשארים בטיפוס לתאימות לאחור בלבד (רשומות ישנות) -
לא נוצרות יותר על ידי ה-UI. שדה `branchId` (אופציונלי) נוסף ל-`AccountingIncome` עבור
`laptops`/`cash`. **חשוב:** ההכנסות הפנימיות של מודול הניידים ומודול חדרי המחשבים (מעקב
השקעה מול רווח פר סניף, ראו `/dashboard/rentals/accounting` ו-`/dashboard/computer-rooms-accounting`)
הן נפרדות לגמרי מ-`n_ah_income` ואינן מתחשבנות כאן.
יצירה/עריכה/מחיקה של מסלול - owner בלבד (`createCollectionRouteAction` /
`updateCollectionRouteAction` / `deleteCollectionRouteAction`, `/routes/[id]`
לעריכה). שדות הסוד (apiKey/apiSecret/receiptsApiKey/receiptsApiSecret) לא
מוצגים מחדש בטופס העריכה - משאירים ריק כדי לא לשנות אותם.
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
- **Resend** — מותקן כתלות (`apps/web/package.json`) אך **לא בשימוש כרגע בשום
  מקום בקוד** - זמין לשימוש עתידי.
- **EmailJS** (`@emailjs/browser`) — שליחת קודי התחברות/אימות מכשיר מהלקוח
  (`login/email-code-form.tsx`, `verify-device/verify-device-form.tsx`). זו
  שיטת שליחת המיילים היחידה הפעילה כרגע במערכת.
- **EZcount** (`lib/ezcount.ts`) — הפקת קבלות (מסמך מסוג 400, ללא מע"מ) ושליחתן
  אוטומטית במייל ללקוח. `resolveEzcountCreds(branchId)` פותר creds (מפתח API +
  developer_email) מ-`n_collection_routes` לפי אותו דפוס resolve-per-branch
  של `resolveNedarimCreds` (מסלול ספציפי לסניף → מסלול גלובלי `branchScope
  === null`). `createEzcountReceipt(...)` שולח ל-`api.ezcount.co.il/api/createDoc`.
  מופעל אוטומטית אחרי חיוב אשראי מוצלח (`/api/rentals/charge`), וגם ידנית עבור
  תשלומי מזומן/העברה דרך `issueCashReceiptAction`.
- **מסלולי גבייה** (`n_collection_routes`) — הפשטה מעל ספקי סליקה
  (`nedarim_plus` / `tranzila` / `cardcom` / `payplus` / `meshulam` / manual)
  וספקי קבלות (`ezcount` / `icount` / `green_invoice`), כולל יעד הפקדה ועמלות.
  **חשוב:** מלבד `nedarim_plus` (סליקה בפועל) ו-`ezcount` (הפקת קבלות בפועל),
  שאר הספקים (גם לסליקה וגם לקבלות) עדיין placeholder בלבד - `chargeViaRoute`
  לא מבצע קריאת API אמיתית עבורם, רק רישום הנה"ח מדומה.

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
| `apps/web/lib/branch-accounting*.ts` | חישובי הנה"ח והתחשבנות סניפי השכרות |
| `apps/web/lib/computer-room-accounting.ts` | חישובי "השקעה מול רווח" פר סניף חדר מחשבים (הקמה/הוצאות/הכנסות/רווח) |
| `apps/web/lib/expense-shared-scope.ts` | סנטינלים `SHARED_RENTALS_BRANCH_ID`/`SHARED_COMPUTERS_BRANCH_ID` להוצאות משותפות לכל הסניפים |
| `apps/web/lib/branch-expense-ledger.ts` | יצירה/מחיקה של רשומת `n_ah_expenses` מקושרת מהוצאה חד-פעמית (חלק הבעלים בלבד) |
| `apps/web/lib/owner-expense-burden.ts` | חלק הבעלים בהוצאות קבועות/חוזרות (ניידים+חדרי מחשבים), מחושב בזמן אמת עבור הנה"ח הראשית ודף הבית |
| `apps/web/lib/owner-name.ts` | שמות אמיתיים (לא "אני"/"השותף") לשדות "מי שילם"/"על מי החוב" במסכי הוצאות - `getOwnerName` (שם המשתמש עם `role: "owner"`) ו-`resolveSharedPartnerName` (שם השותף ל"סניף" המדומה המשותף, כשכל סניפי השותפות במודול מסכימים על אותו שותף) |
| `apps/web/lib/device-trust.ts` | אימות/אמון מכשיר |
| `apps/web/middleware.ts` | middleware של Next (הגנת נתיבים) |
| `apps/api/src/branches/*` | מודול NestJS לדוגמה (branches) |
| `apps/api/src/firebase/*` | מודול Firebase ב-NestJS |
