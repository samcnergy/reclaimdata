/**
 * AES-256-GCM with the workspace-wide encryption key. Used for OAuth
 * refresh tokens at rest. Format: <iv-12>.<ciphertext>.<tag-16>, all
 * base64url. Key rotation requires decrypt + re-encrypt of every stored
 * token (or invalidating all sessions and asking users to reconnect).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function getKey(): Buffer {
  const hex = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY is not set");
  }
  if (hex.length !== 64) {
    throw new Error(
      "OAUTH_TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars). Generate with: openssl rand -hex 32",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${encrypted.toString("base64url")}.${tag.toString("base64url")}`;
}

export function decryptToken(blob: string): string {
  const key = getKey();
  const [ivB64, ctB64, tagB64] = blob.split(".");
  if (!ivB64 || !ctB64 || !tagB64) {
    throw new Error("malformed encrypted token");
  }
  const iv = Buffer.from(ivB64, "base64url");
  const ct = Buffer.from(ctB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString("utf8");
}
