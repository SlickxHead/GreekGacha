/**
 * Portrait art lives in assets/portraits/{key}.svg (default) or {key}.png for listed keys.
 * Keys match hero id after normalizing instance suffixes (e.g. roman_soldier_0 → roman_soldier).
 */

const PORTRAIT_PNG_KEYS = new Set(["perseus", "aethra", "heracles", "hermes", "hades", "medusa", "cupid", "zeus", "ares", "athena", "artemis"]);

export function normalizePortraitKey(id) {
  if (id == null || id === "") return "default";
  let s = String(id);
  s = s.replace(/_[0-9]+$/, "");
  s = s.replace(/^L[0-9]+_/, "");
  return s || "default";
}

export function getPortraitUrl(id) {
  const key = normalizePortraitKey(id);
  const ext = PORTRAIT_PNG_KEYS.has(key) ? "png" : "svg";
  return new URL(`./assets/portraits/${key}.${ext}`, import.meta.url).href;
}
