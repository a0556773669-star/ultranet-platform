# ultranet-platform

מונורפו (pnpm + turborepo) למערכת הניהול המאוחדת של אולטרנט - הדור הבא של
[app.html](https://a0556773669-star.github.io/ultranet/app.html).

## מבנה
- `apps/web` - Next.js (App Router) + NextAuth + Tailwind
- `apps/api` - NestJS, מדבר עם אותו פרויקט Firebase/Firestore (`ultranet-e94aa`)
- `packages/shared-types` - טיפוסי TS משותפים שמשקפים את סכימת ה-Firestore הקיימת

- ## עקרון מפתח
- **אין מיגרציית דאטה.** ה-DB נשאר Firestore בדיוק כמו ב-app.html הקיים -
- אין שינוי בסכימה, אין העברת נתונים. app.html הישן ממשיך לרוץ ולקבל
- פיצ'רים במקביל עד שהמערכת החדשה תבשיל.

- ## הרצה מקומית
```bash
  pnpm install
  cp apps/web/.env.example apps/web/.env.local   # למלא פרטי Firebase Admin
  pnpm dev
  ```

## סטטוס
שלד ראשוני - package.json + tsconfig + Next.js skeleton + NestJS skeleton +
טיפוסים משותפים + מודול branches לדוגמה שקורא נתונים אמיתיים מ-Firestore.
עוד לא נבנו: auth מלא, שאר המודולים (rentals, coworking, accounting וכו').
