// Assembles a recorded timeline into a 1080p H.264 video: per-segment clips, title cards,
// burned-in Hebrew captions (rendered by Chromium for perfect RTL) and narration audio if present.
// usage: node assemble.cjs <recDir> <out.mp4>
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { estSeconds } = require("./engine.cjs");

const recDir = path.resolve(process.argv[2]), outFile = path.resolve(process.argv[3]);
const tl = JSON.parse(fs.readFileSync(path.join(recDir, "timeline.json"), "utf8"));
const work = path.join(recDir, "work");
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });
const audioDir = path.join(recDir, "..", "audio", path.basename(recDir));
const FPS = 30;
const FONT_DIR = path.join(__dirname, "node_modules/@fontsource/heebo/files");

const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
const probe = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());

function fontFaces() {
  return [400, 500, 700, 800].map((w) => `@font-face{font-family:H;font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(FONT_DIR, `heebo-hebrew-${w}-normal.woff2`)).toString("base64")}) format('woff2');}
@font-face{font-family:H;font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(FONT_DIR, `heebo-latin-${w}-normal.woff2`)).toString("base64")}) format('woff2');unicode-range:U+0000-00FF;}`).join("\n");
}

/** Split narration into caption chunks of ~2 lines each. */
function chunks(text) {
  const sentences = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?:])\s+/);
  const out = [];
  for (const s of sentences) {
    if (s.length <= 95) { out.push(s); continue; }
    // split long sentence on commas / dashes, then by words
    let cur = "";
    for (const part of s.split(/(?<=[,–—])\s+/)) {
      if ((cur + " " + part).trim().length > 95 && cur) { out.push(cur.trim()); cur = part; }
      else cur = (cur + " " + part).trim();
    }
    if (cur) out.push(cur.trim());
  }
  // merge very short neighbours
  const merged = [];
  for (const c of out) {
    const last = merged[merged.length - 1];
    if (last && last.length + c.length < 70) merged[merged.length - 1] = last + " " + c;
    else merged.push(c);
  }
  return merged;
}

(async () => {
  const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const css = fontFaces();

  async function renderCaption(text, file) {
    await page.setContent(`<html dir="rtl"><head><style>${css}
      html,body{margin:0;background:transparent;width:1920px;height:1080px}
      .wrap{position:absolute;left:0;right:0;bottom:46px;display:flex;justify-content:center}
      .cap{max-width:1500px;background:rgba(12,24,33,.86);color:#fff;font-family:H;font-weight:500;font-size:40px;line-height:1.38;padding:14px 34px 16px;border-radius:16px;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.35)}
      </style></head><body><div class="wrap"><div class="cap">${text}</div></div></body></html>`);
    await page.screenshot({ path: file, omitBackground: true });
  }

  async function renderCard(card, file) {
    await page.setContent(`<html dir="rtl"><head><style>${css}
      html,body{margin:0;width:1920px;height:1080px;font-family:H}
      body{background:radial-gradient(circle at 70% 30%,#22b09a 0%,#1a8a76 45%,#0f5e4c 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff}
      .logo{font-size:56px;font-weight:800;letter-spacing:1px;opacity:.95;margin-bottom:40px;padding:10px 34px;border:3px solid rgba(255,255,255,.6);border-radius:22px}
      h1{font-size:92px;font-weight:800;margin:0 0 22px;text-align:center;max-width:1600px;line-height:1.15}
      h2{font-size:44px;font-weight:400;margin:0;opacity:.92;text-align:center;max-width:1500px}
      </style></head><body><div class="logo">אולטרנט</div><h1>${card.title}</h1>${card.subtitle ? `<h2>${card.subtitle}</h2>` : ""}</body></html>`);
    await page.screenshot({ path: file });
  }

  const list = [];
  const frames = tl.frames;
  let i = 0;
  for (const seg of tl.segments) {
    i++;
    const base = path.join(work, String(i).padStart(3, "0"));
    const audio = ["wav", "mp3"].map((e) => path.join(audioDir, `${seg.id}.${e}`)).find((f) => fs.existsSync(f));
    const audioDur = audio ? probe(audio) : 0;

    // ---- picture
    let picDur;
    const silentClip = `${base}-pic.mp4`;
    if (seg.card) {
      await renderCard(seg.card, `${base}-card.png`);
      picDur = Math.max(audio ? 0 : estSeconds(seg.text) + 0.8, 3.5);
      ff(["-loop", "1", "-t", String(picDur), "-i", `${base}-card.png`, "-vf", `fps=${FPS},format=yuv420p`, "-c:v", "libx264", "-preset", "medium", "-crf", "18", silentClip]);
    } else {
      const inSeg = frames.filter((f) => f.t >= seg.start && f.t < seg.end);
      const before = [...frames].reverse().find((f) => f.t < seg.start);
      const seq = [];
      if (before) seq.push({ file: before.file, t: seg.start });
      for (const f of inSeg) seq.push(f);
      if (!seq.length) throw new Error("no frames for " + seg.id);
      let concat = "";
      for (let k = 0; k < seq.length; k++) {
        const next = k + 1 < seq.length ? seq[k + 1].t : seg.end;
        const d = Math.max(0.001, next - seq[k].t);
        concat += `file '${path.join(recDir, "frames", seq[k].file)}'\nduration ${d.toFixed(4)}\n`;
      }
      concat += `file '${path.join(recDir, "frames", seq[seq.length - 1].file)}'\n`;
      fs.writeFileSync(`${base}-frames.txt`, concat);
      picDur = seg.end - seg.start;
      ff(["-f", "concat", "-safe", "0", "-i", `${base}-frames.txt`, "-vf", `fps=${FPS},scale=1920:1080:flags=lanczos,format=yuv420p`, "-t", picDur.toFixed(3), "-c:v", "libx264", "-preset", "medium", "-crf", "18", silentClip]);
    }

    // ---- final segment length: never cut the voice
    const total = Math.max(picDur, audioDur + 0.45);

    // ---- captions
    const caps = chunks(seg.text);
    const weights = caps.map((c) => c.length + 12);
    const sum = weights.reduce((a, b) => a + b, 0);
    const span = (audioDur || Math.min(total, estSeconds(seg.text))) ;
    const capStart = seg.card ? 0.3 : 0.15;
    let t = capStart;
    const overlays = [];
    for (let k = 0; k < caps.length; k++) {
      const dur = (span - capStart * 0.5) * (weights[k] / sum);
      const png = `${base}-cap${k}.png`;
      await renderCaption(caps[k], png);
      const end = k === caps.length - 1 ? Math.max(t + dur, total - 0.15) : t + dur;
      overlays.push({ png, from: t, to: end });
      t += dur;
    }

    const inputs = ["-i", silentClip];
    for (const o of overlays) inputs.push("-i", o.png);
    if (audio) inputs.push("-i", audio);
    else inputs.push("-f", "lavfi", "-t", total.toFixed(3), "-i", "anullsrc=r=48000:cl=stereo");
    let fc = `[0:v]tpad=stop_mode=clone:stop_duration=${(total - picDur + 0.1).toFixed(3)}[v0]`;
    overlays.forEach((o, k) => {
      fc += `;[v${k}][${k + 1}:v]overlay=0:0:enable='between(t,${o.from.toFixed(3)},${o.to.toFixed(3)})'[v${k + 1}]`;
    });
    const aIdx = overlays.length + 1;
    fc += `;[${aIdx}:a]aresample=48000,aformat=channel_layouts=stereo,apad[a]`;
    const out = `${base}.mp4`;
    ff([...inputs, "-filter_complex", fc, "-map", `[v${overlays.length}]`, "-map", "[a]", "-t", total.toFixed(3), "-r", String(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", out]);
    list.push(out);
    console.log(`${seg.id}: pic ${picDur.toFixed(1)}s audio ${audioDur.toFixed(1)}s -> ${total.toFixed(1)}s`);
  }
  await browser.close();

  fs.writeFileSync(path.join(work, "list.txt"), list.map((f) => `file '${f}'`).join("\n"));
  ff(["-f", "concat", "-safe", "0", "-i", path.join(work, "list.txt"), "-c", "copy", "-movflags", "+faststart", outFile]);
  console.log("done", outFile, probe(outFile).toFixed(1) + "s", (fs.statSync(outFile).size / 1e6).toFixed(1) + "MB");
})().catch((e) => { console.error(e); process.exit(1); });
