import crypto from "crypto";

export const DEVICE_TRUST_COOKIE = "ultranet_trusted_device";
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  return process.env.NEXTAUTH_SECRET ?? "dev-secret-fallback";
}

export function signDeviceToken(email: string): string {
  const normalized = email.trim().toLowerCase();
  const expires = Date.now() + MAX_AGE_MS;
  const payload = normalized + "|" + expires;
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return payload + "|" + sig;
}

export function verifyDeviceToken(token: string | undefined | null, email: string): boolean {
  if (!token) return false;
  const parts = token.split("|");
  if (parts.length !== 3) return false;
  const tokenEmail = parts[0];
  const expiresStr = parts[1];
  const sig = parts[2];
  const payload = tokenEmail + "|" + expiresStr;
  const expectedSig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  if (sig !== expectedSig) return false;
  const expires = Number(expiresStr);
  if (!expires || Date.now() > expires) return false;
  if (tokenEmail !== email.trim().toLowerCase()) return false;
  return true;
}

export const DEVICE_TRUST_MAX_AGE_SECONDS = Math.floor(MAX_AGE_MS / 1000);
