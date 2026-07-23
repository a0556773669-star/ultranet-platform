// One-shot driver for `bubblewrap init`'s interactive wizard, so the TWA
// (Android wrapper around the PWA) can be generated non-interactively in CI.
// Only used to produce the initial signed APK/AAB for manual sideload install
// (see .github/workflows/build-twa-apk.yml) - not part of the app itself.
const { spawn } = require("child_process");

const KEYSTORE_PASS = process.env.KEYSTORE_PASS;
const KEY_PASS = process.env.KEY_PASS;
const MANIFEST_URL = process.env.TWA_MANIFEST_URL;
const PACKAGE_ID = process.env.TWA_PACKAGE_ID;
const PROJECT_DIR = process.env.TWA_PROJECT_DIR;

if (!KEYSTORE_PASS || !KEY_PASS || !MANIFEST_URL || !PACKAGE_ID || !PROJECT_DIR) {
  console.error("Missing required env vars (KEYSTORE_PASS/KEY_PASS/TWA_MANIFEST_URL/TWA_PACKAGE_ID/TWA_PROJECT_DIR)");
  process.exit(1);
}

// [matchSubstring, answer]. Order-independent: some prompts (JDK/SDK install)
// may not appear at all if already configured/cached, so every remaining step
// is checked on each chunk instead of requiring strict sequence.
const steps = [
  ["does not exist. Do you want to create it now?", "Y"],
  ["Do you want Bubblewrap to install the JDK", "Y"],
  ["Do you want Bubblewrap to install the Android SDK", "Y"],
  ["Do you agree to the Android SDK terms", "y"],
  ["Domain:", ""],
  ["URL path:", ""],
  ["Application name:", ""],
  ["Short name:", "אולטרנט"],
  ["Application ID:", PACKAGE_ID],
  ["Starting version code", ""],
  ["Display mode:", ""],
  ["Orientation:", ""],
  ["Status bar color:", ""],
  ["Splash screen color:", ""],
  ["Icon URL:", ""],
  ["Maskable icon URL:", ""],
  ["Include app shortcuts?", "Y"],
  ["Monochrome icon URL:", ""],
  ["Include support for Play Billing?", "N"],
  ["Request geolocation permission?", "N"],
  ["Key store location:", ""],
  ["Key name:", "ultranet"],
  ["Do you want to create one now?", "Y"],
  ["First and Last names", "Ultranet Admin"],
  ["Organizational Unit", "IT"],
  ["Organization (eg", "Ultranet"],
  ["Country (2 letter code):", "IL"],
  ["Password for the Key Store:", KEYSTORE_PASS],
  ["Password for the Key:", KEY_PASS],
];

const child = spawn(
  "npx",
  ["--yes", "@bubblewrap/cli", "init", `--manifest=${MANIFEST_URL}`, `--directory=${PROJECT_DIR}`],
  { stdio: ["pipe", "pipe", "pipe"], env: process.env }
);

let buf = "";
let stepIdx = 0;
let lastFireAt = Date.now();

function tryFire() {
  for (let i = stepIdx; i < steps.length; i++) {
    const [needle, answer] = steps[i];
    if (buf.includes(needle)) {
      stepIdx = i + 1;
      lastFireAt = Date.now();
      setTimeout(() => {
        child.stdin.write(answer + "\n");
        process.stdout.write(`\n>>> MATCHED "${needle}"\n`);
      }, 150);
      buf = "";
      return;
    }
  }
}

function onData(d) {
  const s = d.toString();
  buf += s;
  process.stdout.write(s);
  tryFire();
}

child.stdout.on("data", onData);
child.stderr.on("data", onData);

child.on("exit", (code) => {
  console.log(`\n>>> EXIT CODE ${code}, steps fired: ${stepIdx}/${steps.length}`);
  process.exit(code ?? 0);
});

const stallCheck = setInterval(() => {
  if (Date.now() - lastFireAt > 30000 && buf.trim()) {
    console.log(`\n>>> STALLED at step ${stepIdx} ("${steps[stepIdx]?.[0]}"). Buffer tail:\n${buf.slice(-500)}`);
    lastFireAt = Date.now();
  }
}, 5000);

child.on("exit", () => clearInterval(stallCheck));
