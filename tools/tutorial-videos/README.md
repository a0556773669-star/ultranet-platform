# סרטוני הדרכה — הפקה אוטומטית

כאן נמצא כל מה שצריך כדי לייצר מחדש את שני סרטוני ההדרכה שמוצגים ב"עזרה ושאלות"
(`apps/web/public/help-videos/owner.mp4` ו-`renter.mp4`). הסרטונים מצולמים **מהמערכת האמיתית**,
על **נתוני הדגמה** ב-Firestore Emulator — אף פעם לא על הדאטה של העסק.

| קובץ | מה הוא עושה |
|---|---|
| `seed.cjs` | מוחק את ה-Emulator וממלא אותו בנתוני הדגמה: סניפים, משתמש בעלים (`owner@ultranet.demo`) ומשכיר (`moshe@ultranet.demo`), מחשבים, לקוחות, השכרות, הוצאות. סיסמה לשניהם: `demo1234`. מסרב לרוץ מול כל דבר שאינו Emulator מקומי |
| `engine.cjs` | מנוע ההקלטה: Chromium ב-1920×1080 עם סמן עכבר מונפש, הדגשות, והקלטת פריימים (CDP screencast) |
| `renter.cjs` / `owner.cjs` | התסריטים — הקריינות של כל קטע + הפעולות על המסך |
| `tts.cjs` | קריינות בעברית (קול גברי) דרך Google Cloud Text-to-Speech |
| `assemble.cjs` | מרכיב את הסרטון: כרטיסי פתיחה/פרקים, כתוביות בעברית צרובות, קריינות, H.264 1080p |

## הרצה

```bash
# 1. Emulator (דורש Java)
npx firebase-tools emulators:start --only firestore --project ultranet-e94aa

# 2. האפליקציה מול ה-Emulator — ב-apps/web/.env.local:
#    FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
#    NEXTAUTH_SECRET=demo-secret-for-local-recording   (או לייצא את אותו ערך גם להקלטה)
#    + FIREBASE_* כלשהם (מפתח פיקטיבי מספיק מול Emulator)
cd apps/web && npx next build && npx next start -p 3001

# 3. הקלטה, קריינות והרכבה
cd tools/tutorial-videos && npm install
npm run record:renter && GOOGLE_TTS_API_KEY=... npm run tts:renter && npm run build:renter
npm run record:owner  && GOOGLE_TTS_API_KEY=... npm run tts:owner  && npm run build:owner
cp out/renter.mp4 out/owner.mp4 ../../apps/web/public/help-videos/
```

- בלי `GOOGLE_TTS_API_KEY` — הסרטון נבנה עם כתוביות בלבד, באורך שמתאים לקצב קריאה.
- עם קריינות — כל קטע מתארך לפי אורך הקול (התמונה האחרונה "מוקפאת" עד שהקריין מסיים), כך שהקול
  והכתוביות תמיד מסונכרנים.
- שינוי במסך? מעדכנים את הקטע הרלוונטי בתסריט (טקסט + פעולות) ומריצים שוב.
