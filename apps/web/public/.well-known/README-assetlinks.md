# assetlinks.json — TWA (Trusted Web Activity) setup

`assetlinks.json` in this folder currently has placeholder values. It only
matters if/when you wrap this PWA in a real installable Android APK (TWA) —
plain "Add to Home Screen" from the browser (on the tablet or on the car's
Android head unit) works today without touching this file at all.

To produce the actual APK once the production domain is live:

1. `npx @bubblewrap/cli init --manifest https://<your-production-domain>/manifest.webmanifest`
   — this creates an Android Studio project and a signing keystore.
2. `npx @bubblewrap/cli build` — produces the signed `.apk` / `.aab`.
3. Get the SHA-256 fingerprint of that signing key:
   `keytool -list -v -keystore <your-keystore>.jks` (or the command
   Bubblewrap prints after `init`).
4. Replace `REPLACE_WITH_TWA_PACKAGE_NAME` and
   `REPLACE_WITH_SIGNING_KEY_SHA256_FINGERPRINT` in `assetlinks.json` with
   the real package name and fingerprint, then deploy.
5. Install the resulting APK on the tablet and/or sideload it on the car's
   Android multimedia unit (via USB/file manager — most aftermarket
   Android head units allow installing external APKs directly).

Once `assetlinks.json` is correct and deployed, Chrome verifies the domain
and the TWA opens with no browser UI at all (full native-looking app). Until
then, the TWA still works but falls back to showing a URL bar.

No app-store submission is required for sideloading on a car head unit —
only for a Play Store listing on the tablet, which is optional.
