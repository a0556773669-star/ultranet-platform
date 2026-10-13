// Generates Hebrew narration per segment with Google Cloud Text-to-Speech (male voice).
// usage: GOOGLE_TTS_API_KEY=... [TTS_RATE=1.15] node tts.cjs out/renter [voiceName]
// TTS_MODEL=gemini-2.5-pro-tts — קולות Gemini (כמו ב-AI Studio), voiceName בלי קידומת שפה (למשל Charon),
//   ו-TTS_PROMPT מכוון את סגנון ההקראה. דורש הפעלת Vertex AI API בפרויקט.
// TTS_RATE מאיץ את הקריינות (דרך ffmpeg, כי לא כל קולות Chirp3 מקבלים speakingRate).
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const recDir = path.resolve(process.argv[2]);
const KEY = process.env.GOOGLE_TTS_API_KEY;
if (!KEY) { console.error("GOOGLE_TTS_API_KEY is not set"); process.exit(1); }
const API = "https://texttospeech.googleapis.com/v1";

const MODEL = process.env.TTS_MODEL;
const PROMPT = process.env.TTS_PROMPT || "Read in a warm, natural, friendly Israeli Hebrew voice, at a brisk lively pace, like a professional tutorial narrator. Pronounce numbers in Hebrew.";

async function pickVoice() {
  if (MODEL) return process.argv[3] || "Charon";
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

(async () => {
  const tl = JSON.parse(fs.readFileSync(path.join(recDir, "timeline.json"), "utf8"));
  const out = path.join(recDir, "..", "audio", path.basename(recDir));
  fs.mkdirSync(out, { recursive: true });
  const voice = await pickVoice();
  console.log("voice:", voice);
  for (const seg of tl.segments) {
    const file = path.join(out, `${seg.id}.wav`);
    if (fs.existsSync(file)) continue;
    const body = {
      input: MODEL ? { prompt: PROMPT, text: seg.text } : { text: seg.text },
      voice: { languageCode: "he-IL", name: voice, ...(MODEL ? { modelName: MODEL } : {}) },
      audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 48000, ...(voice.includes("Chirp3") || MODEL ? {} : { speakingRate: 1.0 }) },
    };
    const res = await fetch(`${API}/text:synthesize?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${seg.id}: ${res.status} ${await res.text()}`);
    const { audioContent } = await res.json();
    const rate = parseFloat(process.env.TTS_RATE || "1");
    if (rate !== 1) {
      fs.writeFileSync(file + ".raw.wav", Buffer.from(audioContent, "base64"));
      execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", file + ".raw.wav", "-af", `atempo=${rate}`, file]);
      fs.rmSync(file + ".raw.wav");
    } else fs.writeFileSync(file, Buffer.from(audioContent, "base64"));
    console.log("  ", seg.id);
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
