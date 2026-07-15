# CLAUDE.md — הנחיות עבודה לפרויקט ultranet-platform

קובץ זה נקרא אוטומטית בתחילת כל שיחה. הוא מכיל את המוסכמות והכללים לעבודה על
הפרויקט. **האיפיון המלא של המערכת נמצא ב-[`docs/SPEC.md`](docs/SPEC.md)** — שם
מתועדים המודולים, מודל הנתונים, ההרשאות והאינטגרציות.

## מה זו המערכת (בקצרה)

מערכת ניהול מאוחדת לעסק "אולטרנט": חדרי מחשבים, השכרות (מחשבים ניידים + סטיקים),
משרד שיתופי (coworking) והנהלת חשבונות — מרובת סניפים עם הרשאות לפי תפקיד.
הדור הבא של `app.html` הישן. **ה-DB הוא Firestore הקיים — אין מיגרציה, אין
שינוי סכימה.** ראה `docs/SPEC.md` לפרטים.

## סטאק

- **מונורפו**: pnpm workspaces + Turborepo
- **`apps/web`**: Next.js 14 (App Router) + NextAuth + Tailwind — האפליקציה הראשית
- **`apps/api`**: NestJS — שירות API על אותו פרויקט Firestore (`ultranet-e94aa`)
- **`packages/shared-types`**: טיפוסי TS משותפים שמשקפים את סכימת ה-Firestore
- **DB**: Firebase / Firestore (דרך `firebase-admin`)

## פקודות

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # למלא פרטי Firebase Admin
pnpm dev          # מריץ את כל האפליקציות (turbo)
pnpm build
pnpm lint
pnpm typecheck    # tsc --noEmit
```

## מוסכמות קוד

- **TypeScript בלבד**, `strict`. אין להשתמש ב-`any` חדש ללא סיבה.
- **טיפוסי דומיין** חיים ב-`packages/shared-types` ומשקפים 1:1 את שדות ה-Firestore.
  אין לשנות שם שדה/קולקשן בלי לוודא התאמה ל-`app.html` ולדאטה הקיים.
- **שמות קולקשנים** תמיד בתחילית `n_` (למשל `n_branches`, `n_rentals`).
- **Server Actions** (`actions.ts`) לכל מוטציה; קומפוננטות `page.tsx` הן Server
  Components כברירת מחדל, אינטראקטיביות ב-`*-client.tsx` / `use client`.
- **הרשאות**: כל route/מודול מוגן דרך `requireModuleAccess(key)` או `requireOwner()`
  מ-`apps/web/lib/perms.ts`. אין לחשוף מודול בלי בדיקת הרשאה בצד השרת.
- **תשלומים**: לעולם לא לשמור PAN מלא. רק `cardLast4` / `cardExpiry` (לא רגיש) או
  `gatewayToken` מטוקניזציה של Nedarim Plus.
- **טקסטים ב-UI בעברית** (RTL). שמות קבצים ומזהי קוד באנגלית.

## כלל תחזוקת תיעוד (חשוב)

בכל שינוי משמעותי — פיצ'ר חדש, מודול חדש, שינוי במודל הנתונים
(`packages/shared-types`), אינטגרציה חדשה, או שינוי בהרשאות — **עדכן את
`docs/SPEC.md`** באותו commit של השינוי. התיעוד הוא חלק מההגדרה של "גמור",
לא משימה נפרדת. אם הוספת קולקשן/שדה חדש ל-Firestore — הוסף אותו לטבלת מודל
הנתונים ב-SPEC. שמור את ה-SPEC מסונכרן עם הקוד.

## תהליך עבודה (git)

- כל שיחה מפתחת ב-branch ייעודי משלה; לא דוחפים ל-`main` ישירות.
- מבצעים merge רק אחרי בדיקה ואישור מפורש של בעל הפרויקט.
- הודעות commit ברורות ותיאוריות.
