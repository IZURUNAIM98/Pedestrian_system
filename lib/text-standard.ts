export const DISPLAY_LOCALE = "en-MY";
export const HTML_UTF8_CONTENT_TYPE = "text/html; charset=utf-8";
export const JSON_UTF8_CONTENT_TYPE = "application/json; charset=utf-8";

const FORBIDDEN_MOJIBAKE = /[\u00c2\u00c3\u00e2\ufffd]/u;
const FORBIDDEN_INVISIBLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufeff\uffa0]/u;
const UNEXPECTED_ALPHABET = /[\u0370-\u052f\u0590-\u08ff\u0900-\u1fff\u2c00-\u2dff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\ua640-\ua69f\uac00-\ud7af\uf900-\ufaff]/u;

export type TextSource = "static" | "simulator" | "api" | "import" | "ai" | "database";

export function validateEnglishText(value: string, source: TextSource = "static"): void {
  if (value !== value.normalize("NFC")) throw new Error(`Non-NFC Unicode text rejected from ${source}.`);
  if (FORBIDDEN_MOJIBAKE.test(value)) throw new Error(`Mojibake or a replacement glyph was rejected from ${source}.`);
  if (FORBIDDEN_INVISIBLE.test(value)) throw new Error(`Invisible or non-printing Unicode was rejected from ${source}.`);
  if (UNEXPECTED_ALPHABET.test(value)) throw new Error(`An unexpected non-Latin alphabet was rejected from ${source}.`);
}

export function normaliseDisplayText(value: string, source: TextSource = "static"): string {
  const normalised = value.normalize("NFC");
  validateEnglishText(normalised, source);
  return normalised;
}

export function normaliseTextPayload<T>(value: T, source: TextSource = "import"): T {
  if (typeof value === "string") return normaliseDisplayText(value, source) as T;
  if (Array.isArray(value)) return value.map((item) => normaliseTextPayload(item, source)) as T;
  if (value && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      normaliseDisplayText(key, source),
      normaliseTextPayload(item, source),
    ])) as T;
  }
  return value;
}

export function capitaliseEnglish(value: string): string {
  const normalised = normaliseDisplayText(value);
  return normalised.length === 0 ? normalised : `${normalised[0].toLocaleUpperCase(DISPLAY_LOCALE)}${normalised.slice(1)}`;
}

export function humaniseEnglishState(value: string): string {
  return normaliseDisplayText(value.replaceAll("_", " ").replaceAll("-", " ").toLocaleLowerCase(DISPLAY_LOCALE), "simulator");
}

export function escapeHtmlText(value: string, source: TextSource = "import"): string {
  return normaliseDisplayText(value, source)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function withUtf8JsonContentType<T extends Response>(response: T): T {
  response.headers.set("Content-Type", JSON_UTF8_CONTENT_TYPE);
  return response;
}
