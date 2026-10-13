// Generates Hebrew narration per segment with Google Cloud Text-to-Speech (male voice).
// usage: GOOGLE_TTS_API_KEY=... [TTS_RATE=1.15] node tts.cjs out/renter [voiceName]
// TTS_MODEL=gemini-2.5-pro-tts — קולות Gemini (כמו ב-AI Studio), voiceName בלי קידומת שפה (למשל Charon),
//   ו-TTS_PROMPT מכוון את סגנון ההקראה. דורש הפעלת Vertex AI API בפרויקט.
// GEMINI_API_KEY=... (מפתח מ-aistudio.google.com/apikey) — אותם קולות Gemini דרך ה-API של AI Studio,
//   בלי Vertex. אם הוא מוגדר הוא גובר על כל השאר; המודל ב-TTS_MODEL (ברירת מחדל gemini-2.5-pro-preview-tts).
// TTS_RATE מאיץ את הקריינות (דרך ffmpeg, כי לא כל קולות Chirp3 מקבלים speakingRate).
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const recDir = path.resolve(process.argv[2]);
const KEY = process.env.GOOGLE_TTS_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!KEY && !GEMINI_KEY) { console.error("GOOGLE_TTS_API_KEY is not set"); process.exit(1); }
const API = "https://texttospeech.googleapis.com/v1";

const MODEL = process.env.TTS_MODEL;
const PROMPT = process.env.TTS_PROMPT || "Read in a warm, natural, friendly Israeli Hebrew voice, at a brisk lively pace, like a professional tutorial narrator. Pronounce numbers in Hebrew.";

async function pickVoice() {
  if (MODEL || GEMINI_KEY) return process.argv[3] || "Charon";
  if (process.argv[3]) return process.argv[3];
  const res = await fetch(`${API}/voices?languageCode=he-IL&key=${KEY}`);
  if (!res.ok) throw new Error(`voices: ${res.status} ${await res.text()}`);
  const { voices = [] } = await res.json();
  const male = voices.filter((v) => v.ssmlGender === "MALE").map((v) => v.name);
  // Best quality first: Chirp3 HD → Neural2 → Wavenet → Standard
  for (const kind of ["Chirp3-HD", "Neural2", "Wavenet", "Standard"]) {
    const hit = male.find((n) => n.includes(kind));
    if (hit) return hit;
  }
  throw new Error("no male he-IL voice: " + voices.map((v) => v.name).join(", "));
}

async function cloudSynth(text, voice, id) {
  const body = {
    input: MODEL ? { prompt: PROMPT, text } : { text },
    voice: { languageCode: "he-IL", name: voice, ...(MODEL ? { modelName: MODEL } : {}) },
    audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 48000, ...(voice.includes("Chirp3") || MODEL ? {} : { speakingRate: 1.0 }) },
  };
  const res = await fetch(`${API}/text:synthesize?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`);
  return (await res.json()).audioContent;
}

/** Gemini API (AI Studio): מחזיר PCM גולמי 24kHz/16bit/mono — עוטפים ב-WAV. */
async function geminiSynth(text, voice) {
  const model = MODEL || "gemini-2.5-pro-preview-tts";
  const body = {
    contents: [{ parts: [{ text: `${PROMPT}\n\n${text}` }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
  };
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      const part = (await res.json()).candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (part) {
        const pcm = Buffer.from(part.inlineData.data, "base64");
        const h = Buffer.alloc(44);
        h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
        h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(24000, 24);
        h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
        return Buffer.concat([h, pcm]).toString("base64");
      }
    }
    const err = res.ok ? "no audio in response" : `${res.status} ${await res.text()}`;
    if (attempt >= 4) throw new Error(err);
    console.log("    retry:", err.slice(0, 120));
    await new Promise((r) => setTimeout(r, 20000 * attempt)); // מכסת דקה בחשבון חינמי
  }
}

(async () => {
  const tl = JSON.parse(fs.readFileSync(path.join(recDir, "timeline.json"), "utf8"));
  const out = path.join(recDir, "..", "audio", path.basename(recDir));
  fs.mkdirSync(out, { recursive: true });
  const voice = await pickVoice();
  console.log("voice:", voice);
  for (const seg of tl.segments) {
    const file = path.join(out, `${seg.id}.wav`);
    if (fs.existsSync(file)) continue;
    const audioContent = GEMINI_KEY ? await geminiSynth(seg.text, voice) : await cloudSynth(seg.text, voice, seg.id);
    const rate = parseFloat(process.env.TTS_RATE || "1");
    if (rate !== 1) {
      fs.writeFileSync(file + ".raw.wav", Buffer.from(audioContent, "base64"));
      execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", file + ".raw.wav", "-af", `atempo=${rate}`, file]);
      fs.rmSync(file + ".raw.wav");
    } else fs.writeFileSync(file, Buffer.from(audioContent, "base64"));
    console.log("  ", seg.id);
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
