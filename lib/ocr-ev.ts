import type { EVIVs } from "./types";

const STAT_LETTER_MAP: Record<string, keyof EVIVs> = {
  H: "hp",
  A: "attack",
  B: "defense",
  C: "spAtk",
  D: "spDef",
  S: "speed",
};

const JAPANESE_STAT_MAP: Record<string, keyof EVIVs> = {
  HP: "hp",
  こうげき: "attack",
  ぼうぎょ: "defense",
  とくこう: "spAtk",
  とくぼう: "spDef",
  すばやさ: "speed",
};

export function parseStatLetterEvs(input: string): Partial<EVIVs> {
  const normalized = input
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
    .toUpperCase();

  const parsed: Partial<EVIVs> = {};
  const matches = normalized.matchAll(/(?:^|[^A-Z])([HABCDS])\s*[:：=]?\s*(\d{1,3})(?=$|[^0-9])/g);

  for (const match of matches) {
    const key = STAT_LETTER_MAP[match[1]];
    const value = parseInt(match[2], 10);
    if (!key || Number.isNaN(value) || value < 0 || value > 252) continue;
    parsed[key] = value;
  }

  return parsed;
}

const EV_FIELD_ALIASES: Record<string, keyof EVIVs> = {
  hp: "hp",
  h: "hp",
  attack: "attack",
  a: "attack",
  defense: "defense",
  b: "defense",
  spatk: "spAtk",
  sp_atk: "spAtk",
  specialattack: "spAtk",
  c: "spAtk",
  spdef: "spDef",
  sp_def: "spDef",
  specialdefense: "spDef",
  d: "spDef",
  speed: "speed",
  s: "speed",
};

function parseEvValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 && value <= 252 ? value : 0;
  }

  if (typeof value === "string") {
    const match = value.match(/\d{1,3}/);
    if (!match) return 0;
    const parsed = parseInt(match[0], 10);
    return parsed >= 0 && parsed <= 252 ? parsed : 0;
  }

  return 0;
}

export function normalizeOcrEvs(input: unknown): EVIVs {
  const normalized: EVIVs = { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 };
  if (typeof input === "string") {
    return { ...normalized, ...parseStatLetterEvs(input) };
  }
  if (!input || typeof input !== "object") return normalized;

  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    const compactKey = rawKey.replace(/[^a-zA-Z]/g, "").toLowerCase();
    const key = EV_FIELD_ALIASES[compactKey];
    if (!key) continue;
    normalized[key] = parseEvValue(rawValue);
  }

  return normalized;
}

export function parseStatLetterActualStats(input: string): Partial<EVIVs> {
  const normalized = input
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
    .toUpperCase();

  const parsed: Partial<EVIVs> = {};
  const matches = normalized.matchAll(/([HABCDS])\s*[:：]?\s*([0-9]{1,3}|[X×])/g);

  for (const match of matches) {
    const key = STAT_LETTER_MAP[match[1]];
    const rawValue = match[2];
    if (!key || rawValue === "X" || rawValue === "×") continue;
    const value = parseInt(rawValue, 10);
    if (Number.isNaN(value) || value <= 0) continue;
    parsed[key] = value;
  }

  return parsed;
}

export function normalizeOcrActualStats(input: unknown): Partial<EVIVs> {
  if (typeof input === "string") {
    return {
      ...parseStatLetterActualStats(input),
      ...parseJapaneseLabeledActualStats(input),
    };
  }
  const normalized: Partial<EVIVs> = {};
  if (!input || typeof input !== "object") return normalized;

  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    const compactKey = rawKey.replace(/[^a-zA-Z]/g, "").toLowerCase();
    const key = EV_FIELD_ALIASES[compactKey];
    if (!key) continue;
    const value = parseEvValue(rawValue);
    if (value > 0) normalized[key] = value;
  }

  return normalized;
}

export function parseJapaneseLabeledActualStats(input: string): Partial<EVIVs> {
  const normalized = input
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
    .replace(/\s+/g, " ");

  const parsed: Partial<EVIVs> = {};
  for (const [label, key] of Object.entries(JAPANESE_STAT_MAP)) {
    const match = normalized.match(new RegExp(`${label}\\s*[:：]?\\s*(\\d{1,3})`, "i"));
    if (!match) continue;
    const value = parseInt(match[1], 10);
    if (Number.isNaN(value) || value <= 0) continue;
    parsed[key] = value;
  }

  return parsed;
}
