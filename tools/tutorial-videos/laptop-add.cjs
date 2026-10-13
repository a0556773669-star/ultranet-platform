// סרטון קצר למשכירים: הוספת מחשב, מספר סים ומחירים (~דקה וחצי)
const { Recorder, sleep } = require("./engine.cjs");

/** איור של כרטיס סים כפי שהוא מגיע מהחברה, עם מספר הטלפון מודגש — מוצג מעל המסך לכמה שניות. */
async function showSimCard(page, number) {
  await page.evaluate((number) => {
    const d = document.createElement("div");
    d.id = "__simcard";
    d.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(10,20,30,.45);z-index:2147483600;display:flex;align-items:center;justify-content:center;animation:__simIn .35s ease-out">
        <div style="direction:rtl;width:560px;height:340px;border-radius:26px;background:linear-gradient(135deg,#ffffff,#eef3f6);box-shadow:0 20px 60px rgba(0,0,0,.35);position:relative;font-family:'HeeboRec',sans-serif;overflow:hidden">
          <div style="position:absolute;top:0;right:0;left:0;height:70px;background:linear-gradient(90deg,#1a8a76,#22b09a);color:#fff;font-size:30px;font-weight:800;display:flex;align-items:center;padding:0 30px">כרטיס סים</div>
          <div style="position:absolute;left:44px;top:110px;width:150px;height:190px;border:3px dashed #9aa7b1;border-radius:16px;display:flex;align-items:center;justify-content:center">
            <div style="width:84px;height:66px;border-radius:10px;background:linear-gradient(135deg,#e9c46a,#c9a227);box-shadow:inset 0 0 0 2px rgba(0,0,0,.15)"></div>
          </div>
          <div style="position:absolute;right:34px;top:118px;font-size:24px;color:#5b6b78;font-weight:500">מספר הטלפון של הסים:</div>
          <div style="position:absolute;right:30px;top:160px;font-size:46px;font-weight:800;color:#0f2a3a;direction:ltr;padding:6px 16px;border:4px solid #f39c12;border-radius:14px;box-shadow:0 0 0 8px rgba(243,156,18,.22)">${number}</div>
          <div style="position:absolute;right:34px;top:256px;font-size:20px;color:#8a98a4;direction:ltr">ICCID 8997201 0000 0000 0000</div>
        </div>
      </div>`;
    const st = document.createElement("style");
    st.textContent = "@keyframes __simIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}";
    d.appendChild(st);
    document.documentElement.appendChild(d);
  }, number);
}
const hideSimCard = (page) => page.evaluate(() => document.getElementById("__simcard")?.remove());

(async () => {
  const r = new Recorder(__dirname + "/out/laptop-add");
  await r.start("moshe@ultranet.demo", { zoom: 1.35 });
  const p = r.page;
  await r.goto("/dashboard/rentals/manage");
  await r.capture(true);

  // ───────────── פתיח
  r.card("intro", "", "", "שלום וברכה! בסרטון הזה נראה לכם, בקצרה, איך מוסיפים מחשב נייד למערכת, איפה מוצאים את מספר הסים ואיך רושמים אותו, ואיך קובעים את המחירים.", { logo: true, title: "הוספת מחשב, סים ומחירים", subtitle: "מדריך קצר למשכירי ניידים" });

  // ───────────── רשימת המחשבים
  await r.seg("list", "נכנסים ללשונית מחשבים. כאן רואים את כל המחשבים בסניף, עם המחירים, ובעמודת הסטיק — את מספר הסים של כל מחשב.", async () => {
    await r.click("a[href='/dashboard/rentals/laptops']", { nav: true });
    await sleep(500);
    await r.highlight("table >> nth=0", 2200, { move: false });
    await r.highlight("th:has-text('סטיק')", 1400);
  });

  // ───────────── מחשב חדש
  await r.seg("add", "לוחצים על הוסף מחשב, ומקלידים את מספר המחשב. השם נקבע אוטומטית.", async () => {
    await r.click("text=הוסף מחשב", { nav: true });
    await r.type("input[name=number]", "160", 140);
    await r.highlight("text=השם נקבע אוטומטית", 1300, { move: false });
  });

  // ───────────── מחירים
  await r.seg("prices1", "עכשיו המחירים. בשדות רואים את מחירון הסניף: ליום, לשבוע ולחודש, עם סטיק ובלי סטיק. אם המחשב במחיר הרגיל — פשוט משאירים ריק.", async () => {
    await r.hlCard("מחיר מיוחד למחשב הזה", 3200);
  });
  await r.seg("prices2", "רוצים מחיר מיוחד למחשב הזה? ממלאים רק את מה שמשתנה, למשל ארבעים וחמישה שקל ליום, ומאתיים לשבוע.", async () => {
    await r.type("input[name=dayPrice]", "45", 140);
    await r.type("input[name=weekPrice]", "200", 120);
  });

  // ───────────── סים
  await r.seg("stick", "למחשב יש סטיק אינטרנט? מסמנים: יש סטיק משויך, ונפתח השדה של מספר הסים.", async () => {
    await r.click("input[name=hasStick]");
    await sleep(500);
    await r.highlight("input[name=simNumber]", 1400);
  });
  await r.seg("simwhere", "איפה המספר? הוא מודפס על כרטיס הפלסטיק שהסים הגיע בו — מספר הטלפון, שמתחיל באפס חמש.", async () => {
    await showSimCard(p, "053-716-0000");
    await sleep(3200);
  }, { minExtra: 0.3 });
  await r.seg("simtype", "מקלידים אותו כאן. אפשר גם לתת לסטיק מחיר מיוחד, כשמשכירים אותו לבד. שדה ריק — מחירון הסניף.", async () => {
    await hideSimCard(p);
    await r.type("input[name=simNumber]", "053-7160000", 70);
    await r.hlCard("מחיר מיוחד לסטיק הזה", 1800, { minWidth: 400 });
  });

  // ───────────── שמירה
  await r.seg("save", "לוחצים שמירה. המחשב מופיע ברשימה עם המחירים ומספר הסים, ומוכן להשכרה.", async () => {
    await r.click("button:has-text('שמירה')", { wait: 300 });
    await p.waitForLoadState("networkidle");
    await sleep(600);
    await r.highlight("tr:has-text('מחשב 160')", 2600);
  });
  await r.seg("edit", "צריך לשנות מחיר או סים? לוחצים על שם המחשב, מתקנים ושומרים.", async () => {
    await r.click("a:has-text('מחשב 160')", { nav: true });
    await sleep(500);
    await r.highlight("input[name=dayPrice]", 1200);
  });

  // ───────────── סיום
  r.card("outro", "", "", "זהו! בהצלחה. לכל שאלה, היכנסו לעזרה ושאלות במערכת.", { logo: true, title: "בהצלחה!", subtitle: "לשאלות: עזרה ושאלות במערכת" });

  await r.finish();
})().catch((e) => { console.error(e); process.exit(1); });
