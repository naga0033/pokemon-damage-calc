"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseStatLetterEvs = parseStatLetterEvs;
exports.parseStatLetterRows = parseStatLetterRows;
exports.parseJapaneseEvStatGrid = parseJapaneseEvStatGrid;
exports.normalizeOcrEvs = normalizeOcrEvs;
exports.parseStatLetterActualStats = parseStatLetterActualStats;
exports.normalizeOcrActualStats = normalizeOcrActualStats;
exports.parseJapaneseLabeledActualStats = parseJapaneseLabeledActualStats;
const STAT_LETTER_MAP = {
    H: "hp",
    A: "attack",
    B: "defense",
    C: "spAtk",
    D: "spDef",
    S: "speed",
};
const JAPANESE_STAT_MAP = {
    HP: "hp",
    こうげき: "attack",
    ぼうぎょ: "defense",
    とくこう: "spAtk",
    とくぼう: "spDef",
    すばやさ: "speed",
};
function parseStatLetterEvs(input) {
    const normalized = input
        .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
        .toUpperCase();
    const parsed = {};
    const matches = normalized.matchAll(/(?:^|[^A-Z])([HABCDS])\s*[:：=]?\s*(\d{1,3})(?=$|[^0-9])/g);
    for (const match of matches) {
        const key = STAT_LETTER_MAP[match[1]];
        const value = parseInt(match[2], 10);
        if (!key || Number.isNaN(value) || value < 0 || value > 252)
            continue;
        parsed[key] = value;
    }
    return parsed;
}
function parseStatLetterRows(input) {
    const normalized = input
        .replace(/[０-９Ａ-Ｚａ-ｚ＋]/g, (char) => {
        const code = char.charCodeAt(0);
        if (code === 0xFF0B)
            return "+";
        return String.fromCharCode(code - 0xFEE0);
    })
        .replace(/[Il|]/g, "1")
        .replace(/\s*\n\s*/g, " ")
        .toUpperCase();
    const evs = {};
    const stats = {};
    const rowStarts = [];
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized[i];
        if (!"HABCDS".includes(char))
            continue;
        const prev = i > 0 ? normalized[i - 1] : "";
        const next = i < normalized.length - 1 ? normalized[i + 1] : "";
        if ((prev && /[A-Z]/.test(prev)) || (next && /[A-Z]/.test(next)))
            continue;
        rowStarts.push({ letter: char, index: i });
    }
    const parseStatDigits = (digits) => {
        if (!digits)
            return undefined;
        if (digits.length <= 3) {
            const statOnly = parseInt(digits, 10);
            return !Number.isNaN(statOnly) && statOnly > 0 && statOnly <= 255 ? statOnly : undefined;
        }
        for (let statLen = 3; statLen >= 1; statLen--) {
            const stat = parseInt(digits.slice(0, statLen), 10);
            if (!Number.isNaN(stat) && stat > 0 && stat <= 255)
                return stat;
        }
        return undefined;
    };
    const parseCombinedDigits = (digits) => {
        if (!digits)
            return {};
        if (digits.length <= 3) {
            const stat = parseStatDigits(digits);
            if (stat)
                return { stat };
            for (let statLen = digits.length - 1; statLen >= 1; statLen--) {
                const splitStat = parseInt(digits.slice(0, statLen), 10);
                const splitEv = parseInt(digits.slice(statLen), 10);
                if (Number.isNaN(splitStat) || Number.isNaN(splitEv))
                    continue;
                if (splitStat > 0 && splitStat <= 255 && splitEv >= 0 && splitEv <= 252) {
                    return { stat: splitStat, ev: splitEv };
                }
            }
            return {};
        }
        for (let statLen = Math.min(3, digits.length - 1); statLen >= 1; statLen--) {
            const stat = parseInt(digits.slice(0, statLen), 10);
            const ev = parseInt(digits.slice(statLen), 10);
            if (Number.isNaN(stat) || Number.isNaN(ev))
                continue;
            if (stat > 0 && stat <= 255 && ev >= 0 && ev <= 252) {
                return { stat, ev };
            }
        }
        const stat = parseStatDigits(digits);
        return stat ? { stat } : {};
    };
    for (let i = 0; i < rowStarts.length; i++) {
        const current = rowStarts[i];
        const next = rowStarts[i + 1];
        const key = STAT_LETTER_MAP[current.letter];
        const segment = normalized.slice(current.index + 1, next?.index ?? normalized.length);
        if (!key)
            continue;
        const plusIndex = segment.indexOf("+");
        if (plusIndex >= 0) {
            const leftDigits = segment.slice(0, plusIndex).replace(/\D/g, "");
            const rightDigits = segment.slice(plusIndex + 1).replace(/\D/g, "");
            const stat = parseStatDigits(leftDigits);
            if (stat)
                stats[key] = stat;
            if (rightDigits) {
                const evValue = parseInt(rightDigits.slice(0, 3), 10);
                if (!Number.isNaN(evValue) && evValue >= 0 && evValue <= 252) {
                    evs[key] = evValue;
                }
            }
            continue;
        }
        const numberTokens = segment.match(/\d+/g) ?? [];
        let stat;
        let ev;
        if (numberTokens.length >= 2) {
            stat = numberTokens[0] ? parseStatDigits(numberTokens[0]) : undefined;
            const parsedEv = parseInt(numberTokens[1], 10);
            if (!Number.isNaN(parsedEv) && parsedEv >= 0 && parsedEv <= 252) {
                ev = parsedEv;
            }
        }
        else {
            const rawDigits = segment.replace(/\D/g, "");
            ({ stat, ev } = parseCombinedDigits(rawDigits));
        }
        if (stat)
            stats[key] = stat;
        if (typeof ev === "number")
            evs[key] = ev;
    }
    return { evs, stats };
}
function parseJapaneseEvStatGrid(input) {
    const normalized = input
        .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
        .replace(/\s+/g, " ");
    const evs = {};
    const stats = {};
    for (const [label, key] of Object.entries(JAPANESE_STAT_MAP)) {
        const match = normalized.match(new RegExp(`${label}[^\\dX×]{0,20}努力値[^\\d]{0,10}(\\d{1,3})[^\\dX×]{0,20}実数値[^\\dX×]{0,10}(\\d{1,3}|[X×])`, "i"));
        if (!match)
            continue;
        const evValue = parseInt(match[1], 10);
        if (!Number.isNaN(evValue) && evValue >= 0 && evValue <= 252) {
            evs[key] = evValue;
        }
        const rawStat = match[2];
        if (rawStat !== "X" && rawStat !== "×") {
            const statValue = parseInt(rawStat, 10);
            if (!Number.isNaN(statValue) && statValue > 0) {
                stats[key] = statValue;
            }
        }
    }
    return { evs, stats };
}
const EV_FIELD_ALIASES = {
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
function parseEvValue(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value >= 0 && value <= 252 ? value : 0;
    }
    if (typeof value === "string") {
        const match = value.match(/\d{1,3}/);
        if (!match)
            return 0;
        const parsed = parseInt(match[0], 10);
        return parsed >= 0 && parsed <= 252 ? parsed : 0;
    }
    return 0;
}
function normalizeOcrEvs(input) {
    const normalized = { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 };
    if (typeof input === "string") {
        const fromRows = parseStatLetterRows(input).evs;
        const fromGrid = parseJapaneseEvStatGrid(input).evs;
        return { ...normalized, ...parseStatLetterEvs(input), ...fromGrid, ...fromRows };
    }
    if (!input || typeof input !== "object")
        return normalized;
    for (const [rawKey, rawValue] of Object.entries(input)) {
        const compactKey = rawKey.replace(/[^a-zA-Z]/g, "").toLowerCase();
        const key = EV_FIELD_ALIASES[compactKey];
        if (!key)
            continue;
        normalized[key] = parseEvValue(rawValue);
    }
    return normalized;
}
function parseStatLetterActualStats(input) {
    const normalized = input
        .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
        .toUpperCase();
    const parsed = {};
    const matches = normalized.matchAll(/([HABCDS])\s*[:：]?\s*([0-9]{1,3}|[X×])/g);
    for (const match of matches) {
        const key = STAT_LETTER_MAP[match[1]];
        const rawValue = match[2];
        if (!key || rawValue === "X" || rawValue === "×")
            continue;
        const value = parseInt(rawValue, 10);
        if (Number.isNaN(value) || value <= 0)
            continue;
        parsed[key] = value;
    }
    return parsed;
}
function normalizeOcrActualStats(input) {
    if (typeof input === "string") {
        return {
            ...parseJapaneseEvStatGrid(input).stats,
            ...parseStatLetterRows(input).stats,
            ...parseStatLetterActualStats(input),
            ...parseJapaneseLabeledActualStats(input),
        };
    }
    const normalized = {};
    if (!input || typeof input !== "object")
        return normalized;
    for (const [rawKey, rawValue] of Object.entries(input)) {
        const compactKey = rawKey.replace(/[^a-zA-Z]/g, "").toLowerCase();
        const key = EV_FIELD_ALIASES[compactKey];
        if (!key)
            continue;
        const value = parseEvValue(rawValue);
        if (value > 0)
            normalized[key] = value;
    }
    return normalized;
}
function parseJapaneseLabeledActualStats(input) {
    const normalized = input
        .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
        .replace(/\s+/g, " ");
    const parsed = {};
    for (const [label, key] of Object.entries(JAPANESE_STAT_MAP)) {
        const match = normalized.match(new RegExp(`${label}\\s*[:：]?\\s*(\\d{1,3})`, "i"));
        if (!match)
            continue;
        const value = parseInt(match[1], 10);
        if (Number.isNaN(value) || value <= 0)
            continue;
        parsed[key] = value;
    }
    return parsed;
}
