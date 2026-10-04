// סרטון הדרכה — משכירים (שותף בסניף השכרות)
const { Recorder, sleep, BASE } = require("./engine.cjs");

(async () => {
  const r = new Recorder(__dirname + "/out/renter");
  await r.start("moshe@ultranet.demo", { login: false });
  const p = r.page;
  await p.goto(BASE + "/login", { waitUntil: "networkidle" });
  await sleep(800);
  await r.capture(true);

  // ───────────── פתיחה
  r.card("intro", "ניהול סניף השכרות", "מדריך מלא למשכירי מחשבים במערכת אולטרנט",
    "שלום, וברוכים הבאים למדריך למשכירי המחשבים של אולטרנט. בסרטון הזה נעבור יחד, צעד אחרי צעד, על כל מה שאתם צריכים כדי לנהל את הסניף: השכרה חדשה, החזרת מחשב, לקוחות, הוצאות, מחשבים, מדבקות והנהלת החשבונות.");

  // ───────────── התחברות
  await r.seg("login", "כדי להיכנס למערכת, מקלידים את כתובת האימייל ואת הסיסמה שקיבלתם, ולוחצים על התחברות. אם שכחתם את הסיסמה, אפשר לבקש קוד חד-פעמי לאימייל, בתחתית המסך.", async () => {
    await r.type("input[type=email]", "moshe@ultranet.demo", 55);
    await r.type("input[type=password]", "demo1234", 60);
    await r.highlight("text=שלח קוד לאימייל", 1500).catch(() => {});
    await r.click("button[type=submit]");
    await p.waitForURL(/dashboard/);
    await p.waitForLoadState("networkidle");
  });

  // ───────────── דף הבית
  await r.seg("home1", "זהו דף הבית שלכם. בחלק העליון מופיעים כל המחשבים הניידים שמושכרים כרגע בסניף, ומתי כל אחד מהם יצא.", async () => {
    await sleep(600);
    await r.hlCard("ניידים מושכרים כעת", 2600);
  });
  await r.seg("home2", "הכרטיס האדום מציג חובות: השכרות שהמחשב כבר הוחזר, אבל עדיין לא סומן שהלקוח שילם. כדאי להציץ בו כל יום.", async () => {
    await r.scrollTo("text=חובות השכרות");
    await r.hlCard("חובות השכרות", 2600);
  });
  await r.seg("home3", "בתפריט העליון יש שלושה דברים: השכרות, שם מתבצעת כל העבודה. הדרכות. ועזרה ושאלות, שם אפשר לשאול כל שאלה ולקבל תשובה מיידית.", async () => {
    await r.scroll(0, 700);
    await r.highlight("header a[href='/dashboard/rentals']", 1500);
    await r.highlight("header a[href='/dashboard/tutorials']", 1200);
    await r.highlight("header a[href='/dashboard/help']", 1500);
  });

  // ───────────── מסך ההשכרות
  r.card("ch-rentals", "השכרות", "מצב המחשבים, השכרה חדשה, החזרה ותשלום",
    "נתחיל במסך החשוב ביותר: מסך ההשכרות.");
  await r.seg("manage1", "נכנסים להשכרות. בראש המסך יש לשוניות: השכרות, לקוחות, הוצאות, מחשבים, מדבקות והנהלת חשבונות. נעבור על כולן.", async () => {
    await r.click("header a[href='/dashboard/rentals']", { nav: true });
    await sleep(500);
    await r.highlight("nav:has(a[href='/dashboard/rentals/manage'])", 2400);
  });
  await r.seg("manage2", "כאן רואים במבט אחד את מצב כל המחשבים בסניף. ריבוע ירוק פירושו מחשב פנוי, וריבוע אדום פירושו מחשב מושכר, ומתחתיו שם הלקוח.", async () => {
    await r.highlight("text=מצב מחשבים וסטיקים >> xpath=..", 3200);
  });
  await r.seg("manage3", "שימו לב: כשהסטיק של מחשב מושכר בנפרד, יופיע על המחשב הכיתוב: ללא אינטרנט. המחשב עצמו עדיין פנוי, אבל בלי סטיק.", async () => {
    await r.highlight("text=ללא אינטרנט", 2600).catch(() => sleep(1500));
  });
  await r.seg("manage4", "מתחת לריבועים נמצאת טבלת ההשכרות הפעילות. לכל השכרה רואים את הלקוח, המחשב, תאריך ההתחלה, ואת המחיר המשוער עד היום.", async () => {
    await r.scrollTo("text=השכרות פעילות", "start");
    await r.highlight("table >> nth=0", 3000, { move: false });
  });
  await r.seg("manage5", "למטה יש את ההשכרות שהוחזרו ולא שולמו, ואחריהן את ההיסטוריה של כל ההשכרות שהסתיימו. בשורת החיפוש אפשר למצוא לקוח לפי שם או טלפון.", async () => {
    await r.scrollTo("text=השכרות שלא שולמו", "center");
    await sleep(800);
    await r.scrollTo("text=היסטוריה אחרונה", "start");
    await sleep(600);
    await r.scroll(0, 900);
    await r.highlight("input[placeholder='חיפוש לקוח לפי שם או טלפון...']", 1500);
  });

  // ───────────── לקוח חדש
  await r.seg("client1", "לפני שמשכירים ללקוח חדש, צריך להוסיף אותו. עוברים ללשונית לקוחות, ולוחצים על הוספת לקוח.", async () => {
    await r.click("a[href='/dashboard/rentals/clients']", { nav: true });
    await sleep(400);
    await r.click("text=הוספת לקוח");
  });
  await r.seg("client2", "ממלאים את שם הלקוח, הטלפון, תעודת הזהות והכתובת. אפשר גם לרשום מאיפה הלקוח הגיע אלינו.", async () => {
    await r.type("input[name=name]", "שלמה ברגמן", 60);
    await r.type("input[name=phone]", "052-7654321", 50);
    await r.type("input[name=idNum]", "312456789", 45);
    await r.type("input[name=address]", "רחוב הנביאים 5, בית שמש", 40);
    await r.type("input[name=referralSource]", "המלצה של חבר", 45);
  }, { minExtra: 0.3 });
  await r.seg("client3", "מסמנים שהלקוח חתם על טופס התקנון, ובוחרים את סוג הפיקדון: ללא פיקדון, צ׳ק, או כרטיס אשראי. בסוף לוחצים הוסף לקוח.", async () => {
    await r.click("input[name=signedTerms]");
    await r.select("select[name=depositType]", "check");
    await r.click("button:has-text('הוסף לקוח')", { wait: 1800 });
  });
  await r.seg("client4", "אם בוחרים פיקדון בכרטיס אשראי, המערכת פותחת אחר כך חלון מאובטח של נדרים פלוס להזנת הכרטיס. אצלנו נשמרות רק ארבע הספרות האחרונות והתוקף, אף פעם לא מספר הכרטיס המלא.", async () => {
    await r.highlight("input[placeholder='חיפוש לקוח לפי שם או טלפון...']", 600, { move: false }).catch(() => {});
    await r.highlight("text=שלמה ברגמן", 2400).catch(() => sleep(2000));
  });
  await r.seg("client5", "כאן גם אפשר לייצא את כל הלקוחות לאקסל, או לייבא רשימת לקוחות מקובץ. מורידים את התבנית, ממלאים אותה, בוחרים את הקובץ ולוחצים ייבוא מאקסל.", async () => {
    await r.highlight("text=יצוא לאקסל", 1400);
    await r.highlight("text=הורדת תבנית לייבוא", 1400);
    await r.highlight("button:has-text('ייבוא מאקסל')", 1400);
  });

  // ───────────── השכרה חדשה
  await r.seg("new1", "עכשיו נפתח השכרה. חוזרים ללשונית השכרות ולוחצים על השכרה חדשה.", async () => {
    await r.click("a[href='/dashboard/rentals/manage']", { nav: true });
    await r.click("text=+ השכרה חדשה", { nav: true });
  });
  await r.seg("new2", "בשדה הלקוח מקלידים חלק מהשם או מהטלפון, ובוחרים את הלקוח מהרשימה.", async () => {
    await r.type("input[placeholder='הקלד שם או טלפון לחיפוש לקוח...']", "ברגמן", 110);
    await sleep(600);
    await r.click("button:has-text('שלמה ברגמן')");
  });
  await r.seg("new3", "בוחרים את סוג ההשכרה, מחשב נייד או סטיק, ואז את המחשב עצמו. מחשב שכבר מושכר מסומן ברשימה ואי אפשר לבחור בו.", async () => {
    await r.highlight("text=סוג השכרה >> xpath=..", 1500);
    const opts = await p.locator("select[name=itemId] option").allTextContents();
    await r.select("select[name=itemId]", { label: opts.find((o) => o.includes("מחשב 28")) });
  });
  await r.seg("new4", "למחשב שיש לו סטיק משויך בוחרים אם הלקוח לוקח אותו עם סטיק, כלומר עם אינטרנט, או בלי סטיק. בלי סטיק המחיר נמוך יותר, והסטיק נשאר פנוי להשכרה נפרדת.", async () => {
    await r.hlCard("סטיק (אינטרנט)", 3000);
  });
  await r.seg("new5", "בוחרים תאריך התחלה. מתחת מופיע מחירון הפריט: מחיר ליום, לשבוע ולחודש. אפשר להוסיף הערה, ולוחצים התחל השכרה.", async () => {
    await r.click("input[name=startDate]", { wait: 200 });
    await p.locator("input[name=startDate]").fill("2026-10-01");
    await sleep(600);
    await r.hlCard("מחירון הפריט", 2000);
    await r.type("textarea[name=notes]", "לקוח חדש, הגיע בהמלצה", 45);
    await r.click("button:has-text('התחל השכרה')", { wait: 400 });
    await p.waitForURL(/manage/);
    await p.waitForLoadState("networkidle");
  });
  await r.seg("new6", "ההשכרה נפתחה. המחשב הפך לאדום, וההשכרה מופיעה ברשימת ההשכרות הפעילות. שימו לב: המחיר הסופי מחושב רק כשהלקוח מחזיר את המחשב.", async () => {
    await r.hlCard("מחשב 28", 2400, { minWidth: 60 });
  });

  // ───────────── החזרה וסגירה
  r.card("ch-return", "החזרת מחשב ותשלום", "סגירת השכרה, חישוב המחיר וסימון תשלום",
    "הלקוח החזיר את המחשב? כך סוגרים את ההשכרה.");
  await r.seg("ret1", "בטבלת ההשכרות הפעילות לוחצים על השורה של הלקוח, או על הכפתור החזרה. השורה נפתחת עם כל פרטי הסגירה.", async () => {
    await r.scrollTo("text=השכרות פעילות", "start");
    await r.click("tr:has-text('בנימין זילבר') >> text=החזרה ▼");
  });
  await r.seg("ret2", "תאריך ההחזרה הוא היום כברירת מחדל, ואפשר לשנות אותו. המחיר לתשלום מחושב אוטומטית לפי מספר הימים, השבועות והחודשים, ומתחתיו רואים בדיוק איך הוא חושב.", async () => {
    await r.highlight("label:has-text('תאריך החזרה') >> xpath=..", 1800);
    await r.highlight("label:has-text('מחיר לתשלום') >> xpath=..", 1800);
    await r.highlight("text=משך ההשכרה >> xpath=ancestor::div[1]", 2200).catch(() => {});
  });
  await r.seg("ret3", "חשוב לדעת: שישי ושבת נחשבים יחד ליום חיוב אחד, והמערכת תמיד בוחרת את השילוב הזול ביותר ללקוח. אם צריך לתת הנחה, לוחצים תיקון המחיר ידנית וחובה לכתוב את הסיבה.", async () => {
    await r.highlight("button:has-text('תיקון המחיר ידנית')", 2200);
  });
  await r.seg("ret4", "אם הלקוח שילם במזומן, לוחצים סמן כשולם, מזומן. מי שיש לו הרשאת גבייה יראה כאן גם כפתורים לחיוב בכרטיס אשראי ולהפקת חשבונית.", async () => {
    await r.scrollTo("button:has-text('סמן כשולם (מזומן)')");
    await r.click("button:has-text('סמן כשולם (מזומן)')", { wait: 1200 });
  });
  await r.seg("ret5", "ושימו לב לנקודה הכי חשובה: סימון התשלום לא סוגר את ההשכרה. אחרי הסימון, תמיד לוחצים גם על סגירה. ההשכרה עוברת להיסטוריה, והמחשב חוזר להיות פנוי.", async () => {
    await r.click("button:has-text('סגירה') >> nth=0", { wait: 1500 });
    await p.waitForLoadState("networkidle");
  });
  await r.seg("ret6", "אם סוגרים השכרה בלי תשלום, היא עוברת לרשימת ההשכרות שלא שולמו. כשהלקוח משלם, לוחצים שם על סמן כשולם, והחוב נעלם.", async () => {
    await r.scrollTo("text=השכרות שלא שולמו", "start");
    await r.click("tr:has-text('חיים הורוביץ') >> button:has-text('סמן כשולם (מזומן)') >> nth=0", { wait: 1600 }).catch(() => sleep(1500));
  });
  await r.seg("ret7", "בהיסטוריה אפשר לערוך השכרה שהסתיימה, למשל לתקן תאריך או מחיר, וגם לבטל סימון תשלום שסומן בטעות.", async () => {
    await r.scrollTo("text=היסטוריה אחרונה", "start");
    await r.highlight("text=היסטוריה אחרונה >> xpath=following::table[1]//button[normalize-space()='עריכה'][1]", 1600).catch(() => {});
    await r.highlight("text=היסטוריה אחרונה >> xpath=following::table[1]//button[normalize-space()='ביטול סימון'][1]", 1600).catch(() => {});
  });

  // ───────────── הוצאות
  r.card("ch-exp", "הוצאות הסניף", "הוצאות קבועות וחד-פעמיות",
    "עכשיו נראה איך רושמים הוצאות של הסניף.");
  await r.seg("exp1", "בלשונית הוצאות מופיע ספר ההוצאות של הסניף שלכם. בראש העמוד רואים מאזן חובות: מי חייב למי לפי ההוצאות שנרשמו.", async () => {
    await r.scroll(0, 400);
    await r.click("a[href='/dashboard/rentals/expenses']", { nav: true });
    await sleep(1200);
    await r.hlCard("מאזן חובות", 2200);
  });
  await r.seg("exp2", "הוצאה קבועה, כמו שכירות או אינטרנט, נרשמת פעם אחת: שם, סכום חודשי ותאריך התחלה. בוחרים מי שילם בפועל ועל מי החוב, ולוחצים הוסף הוצאה קבועה.", async () => {
    await r.scrollTo("input[name=name]");
    await r.highlight("form:has(input[name=startDate])", 3500);
  });
  await r.seg("exp3", "הוצאה חד-פעמית, כמו מטען חלופי, נרשמת בטופס השני: תיאור, סכום ותאריך. נמלא דוגמה ונלחץ הוסף הוצאה חד פעמית.", async () => {
    await r.scrollTo("input[name=desc]");
    await r.type("input[name=desc]", "מטען חלופי למחשב 22", 45);
    const amt = p.locator("input[name=desc] >> xpath=ancestor::form[1]//input[@name='amount']");
    await r.type(amt, "120", 90);
    await p.locator("input[name=date]").first().fill("2026-10-01");
    await sleep(400);
    await r.click("button:has-text('+ הוסף הוצאה חד פעמית')", { wait: 1800 });
  });
  await r.seg("exp4", "לכל הוצאה יש כפתורי עריכה ומחיקה. להוצאה קבועה יש גם עדכון מחיר, כשהסכום משתנה מחודש מסוים, וסיום, כשההוצאה מפסיקה.", async () => {
    await r.highlight("button:has-text('עדכון מחיר') >> nth=0", 1600).catch(() => {});
    await r.highlight("button:has-text('סיום') >> nth=0", 1600).catch(() => {});
  });

  // ───────────── מחשבים
  r.card("ch-laptops", "המחשבים בסניף", "הוספת מחשב, מחירים, מכירה",
    "בלשונית מחשבים מנהלים את המלאי של הסניף.");
  await r.seg("lap1", "כאן מופיעים כל המחשבים הפעילים בסניף, עם המחיר ליום, לשבוע ולחודש. הכיתוב סניף ליד מחיר אומר שהמחיר מגיע מהמחירון הכללי של הסניף.", async () => {
    await r.scroll(0, 400);
    await r.click("a[href='/dashboard/rentals/laptops']", { nav: true });
    await sleep(800);
    await r.highlight("table >> nth=0", 2600, { move: false });
  });
  await r.seg("lap2", "כדי להוסיף מחשב לוחצים הוסף מחשב, ומקלידים את מספר המחשב. השם נקבע אוטומטית. אפשר לקבוע לו מחיר מיוחד, ואם צריך, לסמן שיש לו סטיק משויך עם מספר סים.", async () => {
    await r.click("text=הוסף מחשב", { nav: true });
    await r.type("input[name=number]", "29", 120);
    await r.highlight("input[name=dayPrice] >> xpath=ancestor::div[3]", 1800).catch(() => {});
    await r.click("input[name=hasStick]");
    await sleep(600);
    const sim = p.locator("input[name=simNumber]");
    if (await sim.count()) await r.type(sim, "053-7129000", 45);
  });
  await r.seg("lap3", "לוחצים שמירה, והמחשב נכנס לרשימה וזמין להשכרה. אם המחשב נמכר, לוחצים בשורה שלו על מכירה, ורושמים מחיר ומה נמכר. אי אפשר למכור מחשב שמושכר כרגע.", async () => {
    await r.click("button:has-text('שמירה')", { wait: 400 });
    await p.waitForLoadState("networkidle");
    await sleep(800);
    await r.highlight("button:has-text('מכירה') >> nth=0", 2000).catch(() => {});
  });

  // ───────────── מדבקות
  await r.seg("labels", "בלשונית מדבקות מדפיסים מדבקות למחשבים ולסטיקים. בוחרים את המחשבים מהרשימה, או מקלידים מספרים או טווח, למשל אחת עד עשרים, ובודקים בתצוגה המקדימה. ואז לוחצים הדפסה.", async () => {
    await r.click("a[href='/dashboard/rentals/labels']", { nav: true });
    await sleep(800);
    await r.click("text=נקה בחירה").catch(() => {});
    const nums = p.locator("main input:not([type=checkbox]):not([type=hidden])").first();
    if (await nums.count()) await r.type(nums, "21-24", 110);
    await sleep(800);
    await r.highlight("button:has-text('הדפסה')", 1800).catch(() => {});
  });

  // ───────────── הנה"ח
  await r.seg("acc1", "בלשונית הנהלת חשבונות רואים את החלק שלכם בסניף לחודש הנוכחי ומתחילת הדרך: הכנסות, הוצאות ומאזן.", async () => {
    await r.click("a[href='/dashboard/rentals/accounting']", { nav: true });
    await sleep(1000);
    await r.hlCard("הכנסות החודש", 2800, { minWidth: 600 });
  });
  await r.seg("acc2", "חשוב: הכנסה נכנסת לחשבון רק כשההשכרה הוחזרה וסומנה כשולמה, והיא נרשמת בחודש של ההחזרה. בחשבון הפתוח רואים כמה צריך להעביר לבעלים, או כמה הבעלים צריך להעביר אליכם.", async () => {
    await r.hlCard("חשבון פתוח", 3000);
  });

  // ───────────── עזרה
  r.card("ch-help", "עזרה ושאלות", "לא בטוחים איך עושים משהו? פשוט שואלים",
    "ולסיום, הכלי שיעזור לכם בכל שאלה.");
  await r.seg("help1", "בתפריט העליון לוחצים על עזרה ושאלות. כותבים את השאלה במילים שלכם, למשל: הלקוח החזיר את המחשב, מה עושים? ולוחצים שאל.", async () => {
    await r.click("header a[href='/dashboard/help']", { nav: true });
    await sleep(600);
    await r.type("textarea", "הלקוח החזיר את המחשב, מה עושים?", 75);
    await r.click("button:has-text('שאל')", { wait: 400 });
    await p.waitForSelector("text=התשובה עזרה?", { timeout: 60000 }).catch(() => {});
  });
  await r.seg("help2", "התשובה מגיעה מיד, עם הצעדים המדויקים ושאלות קשורות. בצד יש רשימה של כל השאלות הנפוצות, עם חיפוש, וגם את סרטון ההדרכה הזה, כדי שתוכלו לחזור אליו מתי שתרצו.", async () => {
    await r.hlCard("התשובה עזרה?", 2400);
    await r.hlCard("שאלות נפוצות", 2000);
  });

  r.card("outro", "בהצלחה!", "שאלות? היכנסו לעזרה ושאלות במערכת",
    "זהו, סיימנו. עכשיו אתם יודעים לנהל את הסניף מקצה לקצה. אם משהו לא ברור, היכנסו לעזרה ושאלות ושאלו. בהצלחה!");

  await r.finish();
})().catch((e) => { console.error(e); process.exit(1); });
