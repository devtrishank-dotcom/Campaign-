import crypto from "crypto";
import { ENV } from "../config/env.js";

const ALGO = "aes-256-gcm";

function key() {
  // Derive a stable 32-byte key from the configured secret
  return crypto.createHash("sha256").update(String(ENV.SETTINGS_ENCRYPTION_KEY)).digest();
}

export function encryptObject(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const json = JSON.stringify(obj ?? {});
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptObject(payload) {
  if (!payload) return {};
  const parts = String(payload).split(":");
  if (parts.length !== 3) return {};
  const [ivB64, tagB64, dataB64] = parts;
  try {
    const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return {};
  }
}

// Mask sensitive values before sending to the client
export function maskSecrets(config = {}) {
  const secretWords = ["password", "secret", "token", "key", "apikey", "api_key", "auth", "sid"];
  const out = {};
  for (const [k, v] of Object.entries(config || {})) {
    const isSecret = secretWords.some((w) => k.toLowerCase().includes(w));
    if (isSecret && v) {
      const s = String(v);
      out[k] = s.length <= 4 ? "••••" : `${s.slice(0, 2)}••••${s.slice(-2)}`;
    } else {
      out[k] = v;
    }
  }
  return out;
}
