// סרטון הדרכה — בעלים ומזכירות (חשבון הבעלים, רואה הכל)
const { Recorder, sleep, BASE } = require("./engine.cjs");

(async () => {
  const r = new Recorder(__dirname + "/out/owner");
  await r.start("owner@ultranet.demo", { login: false });
  const p = r.page;
  await p.goto(BASE + "/login", { waitUntil: "networkidle" });
  await sleep(800);
  await r.capture(true);
  const nav = (href) => r.click(`header a[href='${href}']`, { nav: true });
  const tab = (href) => r.click(`main a[href='${href}']`, { nav: true });

  // ───────────── פתיחה
  r.card("intro", "המערכת המלאה של אולטרנט", "מדריך לבעלים ולמזכירות",
    "שלום, וברוכים הבאים למדריך המלא של מערכת אולטרנט, לבעלים ולמי שעובד במשרד על חשבון הבעלים. נעבור על כל המודולים: דף הבית, משתמשים והרשאות, חדרי מחשבים, השכרות, משרד שיתופי, הנהלת חשבונות, משימות ונהלים, חנות, הדרכות, ומרכז העזרה.");

  // ───────────── התחברות
  await r.seg("login", "נכנסים עם האימייל והסיסמה, ולוחצים התחברות. אפשר גם להתחבר עם קוד חד-פעמי שנשלח לאימייל. במחשב חדש המערכת תבקש אימות חד-פעמי בקוד, וכדאי להשאיר מסומן: זכור מחשב זה.", async () => {
    await r.type("input[type=email]", "owner@ultranet.demo", 50);
    await r.type("input[type=password]", "demo1234", 60);
    await r.highlight("text=שלח קוד לאימייל", 1400);
    await r.click("button[type=submit]");
    await p.waitForURL(/dashboard/);
    await p.waitForLoadState("networkidle");
  });

  // ───────────── דף הבית
  r.card("ch-home", "דף הבית", "כל מה שדורש טיפול — במסך אחד", "נתחיל בדף הבית, שמרכז את כל מה שצריך לטפל בו היום.");
  await r.seg("home1", "בראש הדף רואים את כל המחשבים הניידים שמושכרים כרגע, בכל הסניפים. מתחתם ארבע קוביות כסף מהנהלת החשבונות הראשית: הכנסות והוצאות של היום ושל החודש.", async () => {
    await r.hlCard("ניידים מושכרים כעת", 2200);
    await r.hlCard("הכנסות החודש", 2200, { minWidth: 150 });
  });
  await r.seg("home2", "בקטגוריות שלי יש קיצור דרך לכל מודול. לבעלים יש גם משתמשים והרשאות, ובדיקת נתונים.", async () => {
    await r.hlCard("הקטגוריות שלי", 2600, { minWidth: 100 });
  });
  await r.seg("home3", "למטה מופיעים הדברים שדורשים טיפול: תשלומי המשרד השיתופי לחודש, חובות השכרות, פריטים שחסרים במלאי של חדרי המחשבים, והוצאות קבועות שצריך לעדכן להן סכום. מכל כרטיס יש קישור ישר למסך הטיפול.", async () => {
    await r.scrollTo("text=תשלומי משרד שיתופי");
    await r.hlCard("תשלומי משרד שיתופי", 2000);
    await r.hlCard("חובות השכרות", 1800);
    await r.hlCard("פריטים בחוסר", 1800);
  });

  // ───────────── משתמשים
  r.card("ch-users", "משתמשים והרשאות", "מי נכנס למערכת ומה כל אחד רואה", "עכשיו נראה איך מוסיפים משתמש ומגדירים מה הוא רואה.");
  await r.seg("users1", "במסך משתמשים רואים את כל מי שיש לו גישה, עם התפקיד, הסניף וההרשאות. הצ׳יפים הצבועים הם ההרשאות שיש למשתמש.", async () => {
    await r.scroll(0, 500);
    await nav("/dashboard/users");
    await r.hlCard("משה כהן", 2600);
  });
  await r.seg("users2", "לוחצים משתמש חדש, ממלאים שם מלא, אימייל וסיסמה.", async () => {
    await r.click("text=+ משתמש חדש", { nav: true });
    await r.type("input[name=name]", "אהרון לוי", 70);
    await r.type("input[name=email]", "aharon@ultranet.demo", 45);
    await r.type("input[name=pass]", "Aa123456", 60);
  });
  await r.seg("users3", "בוחרים תפקיד: עובד, שותף או בעלים. בוחרים סניף, ומסמנים את ההרשאות. למשל, שותף בסניף השכרות מקבל את ההרשאה השכרות, ואם מותר לו לחייב כרטיסים, גם סליקה וקבלות.", async () => {
    const roleSel = p.locator("label:has-text('תפקיד') + select, select").nth(0);
    await r.select(roleSel, "partner");
    const branchSel = p.locator("select").nth(1);
    await r.select(branchSel, "r-bb");
    await r.click("button:has-text('השכרות')");
    await r.click("button:has-text('סליקה וקבלות')");
  });
  await r.seg("users4", "לאותו אדם אפשר לתת כמה תפקידים, למשל שותף בסניף השכרות וגם עובד בחדר מחשבים, בכפתור הוספת תפקיד נוסף. בסוף לוחצים יצירת משתמש, והוא יכול להתחבר מיד.", async () => {
    await r.highlight("button:has-text('הוספת תפקיד נוסף')", 2000);
    await r.click("button:has-text('יצירת משתמש')", { wait: 1500 });
    await p.waitForLoadState("networkidle");
  });

  // ───────────── חדרי מחשבים
  r.card("ch-rooms", "חדרי מחשבים", "סניפים, מלאי ומשימות, הוצאות והשקעה מול רווח", "נעבור לחדרי המחשבים.");
  await r.seg("rooms1", "בלשונית סניפים יש קוביה לכל חדר מחשבים, עם המיקום, השותף והאחוזים. לחיצה על קוביה פותחת את כרטיס הסניף, ומשם אפשר לערוך. סניף חדש מוסיפים בכפתור סניף חדש, כולל עלות ההקמה ופירוט שלה.", async () => {
    await r.scroll(0, 400);
    await nav("/dashboard/computer-rooms");
    await sleep(500);
    await r.hlCard("חדר מחשבים ירושלים", 1800, { minWidth: 150 });
    await r.highlight("text=סניף חדש", 1500);
  });
  await r.seg("rooms2", "בלשונית תפעול מעדכנים מלאי. לכל פריט מסמנים וי אם יש, או איקס אם חסר, ואפשר לכתוב מה בדיוק חסר. הרשימה מתאפסת בכל ראשון לחודש, ובתחתית רואים את מצב כל הסניפים.", async () => {
    await tab("/dashboard/operations");
    await sleep(600);
    await r.hlCard("נייר A4", 2000, { minWidth: 400 });
    await r.tryClick("tr:has-text('נייר A4') button >> nth=0", { wait: 900 });
    await r.tryClick("tr:has-text('טונר שחור') button >> nth=1", { wait: 900 });
  });
  await r.seg("rooms3", "במשימות מסמנים ביצוע של המשימות השבועיות והחודשיות. בהגדרות תפעול הבעלים קובע אילו פריטי מלאי ואילו משימות יש בכל סניף.", async () => {
    await r.click("a[href='/dashboard/operations/tasks']", { nav: true });
    await sleep(600);
    await r.tryClick("label:has-text('ניקוי מקלדות ומסכים') >> nth=0", { wait: 900 });
    await r.click("a[href='/dashboard/operations/settings']", { nav: true });
    await sleep(800);
  });
  await r.seg("rooms4", "בלשונית הוצאות מוסיפים הוצאה: בוחרים על איזה סניף היא, או על כל הסניפים יחד, ואם היא קבועה או חד-פעמית. כדי שההוצאה תיספר בהנהלת החשבונות הראשית, מסמנים: לחשבן בהנה״ח הראשית.", async () => {
    await tab("/dashboard/expenses");
    await sleep(500);
    await r.tryClick("button:has-text('הוספת הוצאה')", { wait: 1200 });
    await sleep(1500);
  });
  await r.seg("rooms5", "ובלשונית הנהלת חשבונות רואים השקעה מול רווח: עלות ההקמה, ההוצאות וההכנסות של כל חדר. בכפתור הזנת הכנסות מזינים פעם בחודש כמה נכנס בכל סניף.", async () => {
    await p.keyboard.press("Escape").catch(() => {});
    await r.goto("/dashboard/computer-rooms-accounting");
    await r.hlCard("סה\"כ עלות הקמה", 1600, { minWidth: 150 });
    await r.highlight("text=הזנת הכנסות", 1600);
    await r.hlCard("חדר מחשבים בני ברק", 1600, { minWidth: 600 });
  });

  // ───────────── השכרות
  r.card("ch-rentals", "השכרות — מה שייחודי לבעלים", "סניפים, עלות מחשב, הנה״ח והוצאות של כל הסניפים", "עכשיו להשכרות. העבודה היומיומית מוסברת בסרטון של המשכירים, וכאן נתמקד במה שרק הבעלים רואה.");
  await r.seg("rent1", "במסך ההשכרות הבעלים רואה את כל הסניפים יחד. הלשונית השכרות יוני מציגה רק את הסניפים שבבעלות מלאה.", async () => {
    await nav("/dashboard/rentals");
    await sleep(600);
    await r.highlight("main a[href='/dashboard/rentals/mine']", 1800);
  });
  await r.seg("rent2", "בלשונית סניפים מנהלים את סניפי ההשכרות. בהוספת סניף בוחרים את סוג הסניף: קלאסי, כלומר סניף שלי, שותפות עם אחוזים ומייל השותף, או תת-שותפות תחת סניף אב.", async () => {
    await tab("/dashboard/rentals/branches");
    await sleep(500);
    await r.click("text=הוספת סניף", { nav: true });
    await r.hlCard("סוג הסניף", 2400);
  });
  await r.seg("rent3", "כדי לסגור סניף, נכנסים לעריכה ולוחצים סגירת סניף, ובוחרים תאריך. ההוצאות הקבועות נעצרות, ושום דבר לא נמחק. הכפתור בדוק הרשאות השכרות יוצר או מתקן משתמש לכל שותף לפי המייל שלו.", async () => {
    await p.goBack(); await p.waitForLoadState("networkidle");
    await r.highlight("text=בדוק הרשאות השכרות לכל הסניפים", 1800);
    await r.highlight("main table >> nth=0", 1600, { move: false });
  });
  await r.seg("rent4", "בלשונית עלות להוספה קובעים כמה עולה כל מחשב חדש, רגיל או גרפיקה. העלות נרשמת אוטומטית כהשקעה שלך בסניף, בחודש שבו המחשב נוסף.", async () => {
    await tab("/dashboard/rentals/laptop-costs");
    await r.hlCard("עלות מחשב רגיל", 2400);
  });
  await r.seg("rent5", "בהנהלת החשבונות של ההשכרות רואים את החלק שלך בכל סניף: הוצאות, הכנסות, רווח, ומה נכנס החודש. ירוק מגיע אליך, ואדום אתה מעביר. לחיצה על שורה פותחת גרף חודשי.", async () => {
    await tab("/dashboard/rentals/accounting");
    await r.highlight("main table >> nth=0", 2600, { move: false });
  });
  await r.seg("rent6", "ובלשונית הוצאות רואים את כל הסניפים, כולל ספר משותף להוצאות על כל הסניפים יחד, שמתחלקות ביניהם באחוזים שקובעים.", async () => {
    await tab("/dashboard/rentals/expenses");
    await r.highlight("main table >> nth=0", 2600, { move: false });
  });

  // ───────────── משרד שיתופי
  r.card("ch-cw", "משרד שיתופי", "עמדות, שוכרים ותשלומים חודשיים", "נעבור למשרד השיתופי.");
  await r.seg("cw1", "בראש המסך רואים את העמדות, ואם כל אחת מושכרת ושולמה החודש. לכל עמדה יש שורה עם השוכר, המחיר ויום התשלום.", async () => {
    await nav("/dashboard/coworking");
    await sleep(600);
    await r.hlCard("מושכרת", 2200, { minWidth: 60 });
  });
  await r.seg("cw2", "כשהשוכר משלם, בודקים את הסכום ולוחצים סמן כשולם. התשלום נרשם אוטומטית גם בהנהלת החשבונות הראשית. עמדה פנויה משכירים בכפתור השכרת העמדה.", async () => {
    await r.scrollTo("button:has-text('סמן כשולם') >> nth=0");
    await r.click("button:has-text('סמן כשולם') >> nth=0", { wait: 1600 });
  });
  await r.seg("cw3", "בלשונית הנהלת חשבונות של המשרד השיתופי רואים כמה שילמת, כמה קיבלת, את המאזן וגרף חודשי, ומוסיפים הוצאות.", async () => {
    await r.scroll(0, 500);
    await tab("/dashboard/coworking/accounting");
    await sleep(1600);
  });

  // ───────────── הנה"ח ראשית
  r.card("ch-acc", "הנהלת חשבונות ראשית", "הכנסות, הוצאות, העברות חודשיות ומסלולי גבייה", "עכשיו להנהלת החשבונות הראשית.");
  await r.seg("acc1", "הכלל החשוב: הספר הראשי סופר רק שורות שסומנו לחשבן בהנה״ח הראשית. בראש המסך שלוש קוביות: כמה הוצאנו, כמה הכנסנו, והמאזן.", async () => {
    await nav("/dashboard/accounting");
    await sleep(600);
    await r.hlCard("הכנסנו עד היום", 2200, { minWidth: 150 });
  });
  await r.seg("acc2", "בכפתורי הוספת הכנסה והוספת הוצאה רושמים כל תנועה: הכנסה באשראי, במזומן מהקופה, מסניף ניידים או ממכירת מחשב. ובסרגל הטבלאות פותחים את רשימות ההכנסות, ההוצאות והרכישות, עם חיפוש וסינון.", async () => {
    await r.highlight("text=הוספת הכנסה", 1500);
    await r.highlight("text=הוספת הוצאה", 1500);
    await r.tryClick("main button:has-text('הכנסות') >> nth=0", { wait: 1500 });
  });
  await r.seg("acc3", "בלשונית ניידים רואים כמה מרוויח כל סניף השכרות למחשב, וטבלת העברות חודשיות: מי צריך להעביר למי. מסמנים הועבר כשהכסף עבר, ושולחים לסניפים את הדו״ח החודשי במייל.", async () => {
    await r.goto("/dashboard/accounting/mobile");
    await r.hlCard("מעקב סניפים ניידים", 2000, { minWidth: 400 });
    await r.hlCard("העברות חודשיות", 2000, { minWidth: 300 });
  });

  // ───────────── משימות ונהלים
  r.card("ch-duxus", "משימות ונהלים", "יעדים לרבעון, משימות שוטפות ונהלי עבודה", "המודול הבא: משימות ונהלים.");
  await r.seg("dux1", "כאן בונים יעדים לרבעון, ומפרקים אותם לחודש ולשבוע. בלשונית המשימות האישיות מוסיפים משימה: כותרת, פירוט, שם הפונה, טלפון, דחיפות ותאריך יעד.", async () => {
    await nav("/dashboard/duxus");
    await sleep(800);
    await r.click("main a[href='/dashboard/duxus/personal']", { nav: true });
    await r.click("button:has-text('הוספת משימה')", { wait: 800 });
    await r.type("[role=dialog] input[placeholder='מה צריך לעשות']", "להזמין 5 מחשבים חדשים לסניף בני ברק", 45);
    await r.type("[role=dialog] textarea", "לבקש הצעת מחיר משני ספקים", 40);
    await r.type(p.locator("[role=dialog] input").nth(1), "יעקב מהספק", 55);
    await r.type(p.locator("[role=dialog] input").nth(2), "050-1234567", 50);
  });
  await r.seg("dux2", "לוחצים שמירה, והמשימה נכנסת לרשימה. מסמנים אותה כשהיא הושלמה. בלשונית נהלים שומרים את נהלי העבודה, עם גרסאות וקבצים מצורפים.", async () => {
    await r.tryClick("[role=dialog] button:has-text('שמירה')", { wait: 1500 });
    await p.keyboard.press("Escape").catch(() => {});
    await r.tryClick("main a:has-text('נהלים') >> nth=0", { nav: true });
    await sleep(800);
  });

  // ───────────── חנות + הדרכות
  await r.seg("shop", "בחנות AI מנהלים את הפניות של לקוחות מהעוזר החכם לבחירת מחשב: רואים כל ליד, מעדכנים סטטוס, ומנהלים את קטלוג המחשבים והציוד הנלווה.", async () => {
    await nav("/dashboard/shop");
    await sleep(1000);
    await r.highlight("text=פתיחת הצ'אטבוט הציבורי", 1600);
  });
  await r.seg("tut", "בהדרכות הבעלים מוסיף הדרכה חדשה: כותרת, הוראות, קישור לסרטון וקובץ מצורף. כל המשתמשים רואים את ההדרכות.", async () => {
    await nav("/dashboard/tutorials");
    await r.tryClick("text=+ הדרכה חדשה", { nav: true });
    await sleep(1200);
  });

  // ───────────── עזרה
  r.card("ch-help", "עזרה ושאלות", "שואלים בשפה חופשית — ומקבלים תשובה מיד", "ולסיום, מרכז העזרה.");
  await r.seg("help1", "לא בטוחים איך עושים משהו? נכנסים לעזרה ושאלות, כותבים את השאלה במילים שלכם ולוחצים שאל. למשל: איך מוסיפים משתמש חדש?", async () => {
    await nav("/dashboard/help");
    await sleep(500);
    await r.type("textarea", "איך מוסיפים משתמש חדש?", 75);
    await r.click("button:has-text('שאל')", { wait: 400 });
    await p.waitForSelector("text=התשובה עזרה?", { timeout: 60000 }).catch(() => {});
  });
  await r.seg("help2", "התשובה מגיעה מיד, צעד אחרי צעד. בצד יש את כל השאלות הנפוצות לפי מודולים, ואת סרטון ההדרכה הזה.", async () => {
    await r.hlCard("התשובה עזרה?", 2200);
    await r.hlCard("שאלות נפוצות", 2000);
  });
  await r.seg("help3", "ובכפתור שאלות שנשאלו, הבעלים רואה כל שאלה שנשאלה במערכת, על ידי המזכירות או המשכירים, ואיזו תשובה לא עזרה. כך יודעים מה כדאי להסביר טוב יותר.", async () => {
    await r.click("text=שאלות שנשאלו", { nav: true });
    await r.highlight("main table >> nth=0", 2400, { move: false });
  });

  r.card("outro", "בהצלחה!", "שאלות? היכנסו לעזרה ושאלות במערכת",
    "זהו, עברנו על כל המערכת. בכל שאלה, היכנסו לעזרה ושאלות ותקבלו תשובה מיד. בהצלחה!");

  await r.finish();
})().catch((e) => { console.error(e); process.exit(1); });
