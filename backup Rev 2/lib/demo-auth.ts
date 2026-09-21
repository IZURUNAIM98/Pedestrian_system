import { createHmac, pbkdf2Sync, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "lintas_link2_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 8;

const FALLBACK_ITERATIONS = 210_000;
const FALLBACK_ID_SALT = "lintas-link2-id-v1";
const FALLBACK_PASSWORD_SALT = "lintas-link2-password-v1";
const FALLBACK_ID_HASH = "88fb2ec2bafc06298c0daf0c654e6bab9627a72c2f68c30e33ef750f7087a07f";
const FALLBACK_PASSWORD_HASH = "7fa756c8b59d63d52ecb7b82b15be3ddc05f9e2c3a486d12ac87727746a97bc1";

function configuredId(): string {
  return process.env.DEMO_ACCESS_ID ?? "";
}

function configuredPassword(): string {
  return process.env.DEMO_ACCESS_PASSWORD ?? "";
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function matchesFallback(value: string, salt: string, expectedHash: string): boolean {
  const actualHash = pbkdf2Sync(value, salt, FALLBACK_ITERATIONS, 32, "sha256").toString("hex");
  return safeEqual(actualHash, expectedHash);
}

function sessionSecret(): string {
  return configuredPassword() || FALLBACK_PASSWORD_HASH;
}

function sign(expiry: number): string {
  return createHmac("sha256", sessionSecret()).update(`lintas-link2:${expiry}`).digest("hex");
}

export function credentialsAreValid(id: string, password: string): boolean {
  const expectedId = configuredId();
  const expectedPassword = configuredPassword();
  if (expectedId && expectedPassword) {
    return safeEqual(id, expectedId) && safeEqual(password, expectedPassword);
  }

  return (
    matchesFallback(id, FALLBACK_ID_SALT, FALLBACK_ID_HASH) &&
    matchesFallback(password, FALLBACK_PASSWORD_SALT, FALLBACK_PASSWORD_HASH)
  );
}

export function createSessionToken(now = Date.now()): string {
  const expiry = Math.floor(now / 1000) + SESSION_DURATION_SECONDS;
  return `${expiry}.${sign(expiry)}`;
}

export function sessionIsValid(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [rawExpiry, signature, extra] = token.split(".");
  const expiry = Number(rawExpiry);
  if (extra || !rawExpiry || !signature || !Number.isSafeInteger(expiry) || expiry <= Math.floor(now / 1000)) return false;
  return safeEqual(signature, sign(expiry));
}
