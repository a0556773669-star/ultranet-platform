// Screen-recording engine: drives the real app with a visible cursor, captures frames via CDP
// screencast, and records a timeline of narrated segments for later assembly.
const { chromium } = require("playwright");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE || "http://localhost:3001";
// חייב להיות זהה ל-NEXTAUTH_SECRET של השרת שמוקלט, כדי שעוגיית "מכשיר מוכר" תתקבל.
const SECRET = process.env.NEXTAUTH_SECRET || "demo-secret-for-local-recording";
const FONT_DIR = path.join(__dirname, "node_modules/@fontsource/heebo/files");

function fontCss() {
  let css = "";
  for (const w of [300, 400, 500, 600, 700, 800]) {
    for (const sub of ["hebrew", "latin"]) {
      const f = path.join(FONT_DIR, `heebo-${sub}-${w}-normal.woff2`);
      if (!fs.existsSync(f)) continue;
      const b64 = fs.readFileSync(f).toString("base64");
      css += `@font-face{font-family:'HeeboRec';font-weight:${w};src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
    }
  }
  return css + `html,body,button,input,select,textarea{font-family:'HeeboRec',sans-serif!important;}`;
}

const INIT = (css) => `
(() => {
  const install = () => {
    if (document.getElementById('__rec_style')) return;
    const st = document.createElement('style'); st.id='__rec_style';
    st.textContent = ${JSON.stringify(css)} + \`
      #__cursor{position:fixed;left:0;top:0;width:30px;height:30px;z-index:2147483647;pointer-events:none;transform:translate(-4px,-2px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));transition:opacity .2s}
      .__ripple{position:fixed;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:3px solid #22b09a;z-index:2147483646;pointer-events:none;animation:__rip .6s ease-out forwards}
      @keyframes __rip{from{transform:scale(.4);opacity:1}to{transform:scale(3.2);opacity:0}}
      .__hl{position:fixed;z-index:2147483645;pointer-events:none;border:3px solid #f39c12;border-radius:12px;box-shadow:0 0 0 6px rgba(243,156,18,.25);animation:__pulse 1.1s ease-in-out infinite}
      @keyframes __pulse{0%,100%{box-shadow:0 0 0 4px rgba(243,156,18,.25)}50%{box-shadow:0 0 0 12px rgba(243,156,18,.12)}}
      nextjs-portal{display:none!important}
    \`;
    document.documentElement.appendChild(st);
    const c = document.createElement('div'); c.id='__cursor';
    c.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.5 14.8 L11.6 21.5 L14.3 20.3 L11.3 13.7 L17.5 13.7 Z" fill="white" stroke="black" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    const p = window.__curPos || JSON.parse(sessionStorage.getItem('__curPos') || 'null') || {x: 800, y: 450};
    c.style.left = p.x + 'px'; c.style.top = p.y + 'px';
    document.documentElement.appendChild(c);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  window.__moveCursor = (x, y, ms) => new Promise((res) => {
    const c = document.getElementById('__cursor'); if (!c) return res();
    const sx = parseFloat(c.style.left) || 0, sy = parseFloat(c.style.top) || 0;
    const t0 = performance.now();
    const ease = (t) => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms), e = ease(t);
      c.style.left = (sx + (x - sx) * e) + 'px'; c.style.top = (sy + (y - sy) * e) + 'px';
      if (t < 1) requestAnimationFrame(step); else { sessionStorage.setItem('__curPos', JSON.stringify({x, y})); res(); }
    };
    requestAnimationFrame(step);
  });
  window.__ripple = (x, y) => { const r = document.createElement('div'); r.className='__ripple'; r.style.left=x+'px'; r.style.top=y+'px'; document.documentElement.appendChild(r); setTimeout(() => r.remove(), 700); };
  window.__highlight = (x, y, w, h) => { window.__clearHl(); const d = document.createElement('div'); d.className='__hl'; d.style.left=(x-6)+'px'; d.style.top=(y-6)+'px'; d.style.width=(w+12)+'px'; d.style.height=(h+12)+'px'; document.documentElement.appendChild(d); };
  window.__clearHl = () => document.querySelectorAll('.__hl').forEach((n) => n.remove());
})();
`;

function deviceToken(email) {
  const payload = email + "|" + (Date.now() + 1e10);
  return payload + "|" + crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ≈ reading/speaking pace for Hebrew narration: used as minimum segment length until real audio exists.
const estSeconds = (text) => Math.max(2.5, text.replace(/\s+/g, " ").length / 13.5);

class Recorder {
  constructor(outDir) {
    this.outDir = outDir;
    this.framesDir = path.join(outDir, "frames");
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(this.framesDir, { recursive: true });
    this.frames = []; // {file, t}
    this.segments = [];
    this.n = 0;
  }

  async start(email, { login = true } = {}) {
    this.browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    this.context = await this.browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2, locale: "he-IL", timezoneId: "Asia/Jerusalem" });
    await this.context.addInitScript(INIT(fontCss()));
    await this.context.addCookies([{ name: "ultranet_trusted_device", value: deviceToken(email), url: BASE }]);
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(60000);
    this.email = email;
    if (login) await this.login(email, false);
    this.cdp = await this.context.newCDPSession(this.page);
    this.cdp.on("Page.screencastFrame", async (f) => {
      const file = path.join(this.framesDir, `f${String(this.n++).padStart(6, "0")}.jpg`);
      fs.writeFileSync(file, Buffer.from(f.data, "base64"));
      this.frames.push({ file, t: f.metadata.timestamp });
      try { await this.cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch {}
    });
  }

  async capture(on) {
    if (on) await this.cdp.send("Page.startScreencast", { format: "jpeg", quality: 94, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    else await this.cdp.send("Page.stopScreencast");
  }

  /** wall-clock seconds in the same clock as screencast timestamps */
  now() { return Date.now() / 1000; }

  async login(email, visible) {
    const p = this.page;
    await p.goto(BASE + "/login", { waitUntil: "networkidle" });
    await sleep(800);
    if (visible) {
      await this.type('input[type=email]', email);
      await this.type('input[type=password]', "demo1234", 40);
      await this.click('button[type=submit]');
    } else {
      await p.fill('input[type=email]', email);
      await p.fill('input[type=password]', "demo1234");
      await p.click('button[type=submit]');
    }
    await p.waitForURL(/dashboard/, { timeout: 60000 });
    await p.waitForLoadState("networkidle");
  }

  /** A narrated segment. `fn` performs the on-screen actions; the segment lasts at least the
   *  estimated narration time so the picture never runs ahead of the voice. */
  async seg(id, text, fn, { minExtra = 0.6 } = {}) {
    const t0 = this.now();
    if (fn) await fn();
    const need = estSeconds(text) + minExtra;
    const spent = this.now() - t0;
    if (spent < need) await sleep((need - spent) * 1000);
    // tiny repaint so a frame exists right at the end of the segment
    await this.page.evaluate(() => { const c = document.getElementById("__cursor"); if (c) c.style.opacity = c.style.opacity === "0.999" ? "1" : "0.999"; });
    await sleep(120);
    this.segments.push({ id, text, start: t0, end: this.now() });
    console.log(`  [${id}] ${(this.now() - t0).toFixed(1)}s`);
  }

  /** A title card segment rendered at assembly time (no screen frames). */
  card(id, title, subtitle, text) {
    this.segments.push({ id, text, card: { title, subtitle } });
  }

  loc(sel) { return typeof sel === "string" ? this.page.locator(sel).first() : sel; }

  async box(sel) {
    const l = this.loc(sel);
    await l.waitFor({ state: "visible" });
    await l.scrollIntoViewIfNeeded();
    const b = await l.boundingBox();
    if (!b) throw new Error("no box for " + sel);
    return b;
  }

  async moveTo(sel, ms = 650) {
    const b = await this.box(sel);
    const x = b.x + b.width / 2, y = b.y + Math.min(b.height / 2, 18);
    await this.page.evaluate(([x, y, ms]) => window.__moveCursor(x, y, ms), [x, y, ms]);
    return { x, y, b };
  }

  async click(sel, { wait = 500, nav = false } = {}) {
    const { x, y } = await this.moveTo(sel);
    await sleep(150);
    await this.page.evaluate(([x, y]) => window.__ripple(x, y), [x, y]);
    await sleep(120);
    if (nav) await Promise.all([this.page.waitForLoadState("networkidle"), this.loc(sel).click()]);
    else await this.loc(sel).click();
    await sleep(wait);
  }

  async tryClick(sel, opts) {
    try { await this.loc(sel).waitFor({ state: "visible", timeout: 6000 }); await this.click(sel, opts); return true; }
    catch (e) { console.log("    (click skipped: " + sel + ")"); return false; }
  }

  async type(sel, text, delay = 70) {
    await this.click(sel, { wait: 200 });
    await this.loc(sel).pressSequentially(text, { delay });
    await sleep(300);
  }

  async select(sel, value) {
    await this.click(sel, { wait: 250 });
    await this.loc(sel).selectOption(value);
    await sleep(400);
  }

  async highlight(sel, ms = 1800, { move = true } = {}) {
    let b;
    try { await this.loc(sel).waitFor({ state: "visible", timeout: 6000 }); b = await this.box(sel); }
    catch { console.log("    (highlight skipped: " + sel + ")"); await sleep(ms / 2); return; }
    if (move) await this.page.evaluate(([x, y]) => window.__moveCursor(x, y, 600), [b.x + b.width / 2, b.y + Math.min(b.height / 2, 18)]);
    await this.page.evaluate(([x, y, w, h]) => window.__highlight(x, y, w, h), [b.x, b.y, b.width, b.height]);
    await sleep(ms);
    await this.page.evaluate(() => window.__clearHl());
  }

  /** Highlight the visual "card" (bordered/rounded box) that contains the given text. */
  async hlCard(text, ms = 2400, { minWidth = 260, nth = 0 } = {}) {
    try {
      const el = this.page.getByText(text, { exact: false }).nth(nth);
      await el.waitFor({ state: "visible", timeout: 6000 });
      await el.scrollIntoViewIfNeeded();
      const b = await el.evaluate((n, minWidth) => {
        let e = n;
        while (e && e !== document.body) {
          const cs = getComputedStyle(e), r = e.getBoundingClientRect();
          const boxed = (parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== "none") && parseFloat(cs.borderTopLeftRadius) >= 6;
          if ((boxed || e.tagName === "TABLE" || e.tagName === "FORM") && r.width >= minWidth) return { x: r.x, y: r.y, width: r.width, height: r.height };
          e = e.parentElement;
        }
        const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
      }, minWidth);
      await this.page.evaluate(([x, y]) => window.__moveCursor(x, y, 600), [b.x + b.width - 40, b.y + 20]);
      await this.page.evaluate(([x, y, w, h]) => window.__highlight(x, y, w, Math.min(h, window.innerHeight - y - 10)), [b.x, b.y, b.width, b.height]);
      await sleep(ms);
      await this.page.evaluate(() => window.__clearHl());
    } catch (e) { console.log("    (hlCard skipped: " + text + ")"); await sleep(ms / 2); }
  }

  async scroll(y, ms = 900) {
    await this.page.evaluate(([y]) => window.scrollTo({ top: y, behavior: "smooth" }), [y]);
    await sleep(ms);
  }

  async scrollTo(sel, block = "center") {
    await this.loc(sel).evaluate((el, block) => el.scrollIntoView({ behavior: "smooth", block }), block);
    await sleep(1000);
  }

  async goto(p) {
    await this.page.goto(BASE + p, { waitUntil: "networkidle" });
    await sleep(500);
  }

  async finish() {
    await this.capture(false).catch(() => {});
    await sleep(300);
    await this.browser.close();
    fs.writeFileSync(path.join(this.outDir, "timeline.json"), JSON.stringify({ frames: this.frames.map((f) => ({ file: path.basename(f.file), t: f.t })), segments: this.segments }, null, 1));
    console.log(`frames: ${this.frames.length}, segments: ${this.segments.length}`);
  }
}

module.exports = { Recorder, sleep, BASE, estSeconds };
