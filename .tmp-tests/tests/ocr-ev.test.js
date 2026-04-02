"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const ocr_ev_1 = require("../lib/ocr-ev");
(0, node_test_1.default)("parseStatLetterEvs reads HABCDS effort values", () => {
    strict_1.default.deepEqual((0, ocr_ev_1.parseStatLetterEvs)("H252 A252 B4"), {
        hp: 252,
        attack: 252,
        defense: 4,
    });
});
(0, node_test_1.default)("parseStatLetterEvs handles separators and fullwidth characters", () => {
    strict_1.default.deepEqual((0, ocr_ev_1.parseStatLetterEvs)("Ｈ:252／Ａ:4／Ｓ:252"), {
        hp: 252,
        attack: 4,
        speed: 252,
    });
});
(0, node_test_1.default)("parseStatLetterEvs ignores out-of-range values", () => {
    strict_1.default.deepEqual((0, ocr_ev_1.parseStatLetterEvs)("H999 A252"), {
        attack: 252,
    });
});
(0, node_test_1.default)("normalizeOcrEvs accepts HABCDS keys and string values", () => {
    strict_1.default.deepEqual((0, ocr_ev_1.normalizeOcrEvs)({
        H: "252",
        A: "244(↑)",
        S: "12(↑)",
    }), {
        hp: 252,
        attack: 244,
        defense: 0,
        spAtk: 0,
        spDef: 0,
        speed: 12,
    });
});
(0, node_test_1.default)("normalizeOcrEvs accepts a raw HABCDS string", () => {
    strict_1.default.deepEqual((0, ocr_ev_1.normalizeOcrEvs)("H252 A244 S12"), {
        hp: 252,
        attack: 244,
        defense: 0,
        spAtk: 0,
        spDef: 0,
        speed: 12,
    });
});
(0, node_test_1.default)("normalizeOcrActualStats accepts a raw HABCDS string", () => {
    strict_1.default.deepEqual((0, ocr_ev_1.normalizeOcrActualStats)("H207, A199, B120, Cx, D80, S119"), {
        hp: 207,
        attack: 199,
        defense: 120,
        spDef: 80,
        speed: 119,
    });
});
(0, node_test_1.default)("parseJapaneseLabeledActualStats reads game stat rows", () => {
    strict_1.default.deepEqual((0, ocr_ev_1.parseJapaneseLabeledActualStats)("HP 198 32 こうげき 154 0 ぼうぎょ 161 32 すばやさ 100 0"), {
        hp: 198,
        attack: 154,
        defense: 161,
        speed: 100,
    });
});
(0, node_test_1.default)("parseStatLetterRows reads stat and ev columns from overlay layout", () => {
    strict_1.default.deepEqual((0, ocr_ev_1.parseStatLetterRows)("H 179 +228 A 115 0 B 147 +16 C 58 0 D 139 +252 S 117 +12"), {
        evs: {
            hp: 228,
            attack: 0,
            defense: 16,
            spAtk: 0,
            spDef: 252,
            speed: 12,
        },
        stats: {
            hp: 179,
            attack: 115,
            defense: 147,
            spAtk: 58,
            spDef: 139,
            speed: 117,
        },
    });
});
(0, node_test_1.default)("normalize OCR helpers support overlay row layout", () => {
    const raw = "H 179 +228 A 115 0 B 147 +16 C 58 0 D 139 +252 S 117 +12";
    strict_1.default.deepEqual((0, ocr_ev_1.normalizeOcrEvs)(raw), {
        hp: 228,
        attack: 0,
        defense: 16,
        spAtk: 0,
        spDef: 252,
        speed: 12,
    });
    strict_1.default.deepEqual((0, ocr_ev_1.normalizeOcrActualStats)(raw), {
        hp: 179,
        attack: 115,
        defense: 147,
        spAtk: 58,
        spDef: 139,
        speed: 117,
    });
});
(0, node_test_1.default)("parseStatLetterRows handles OCR-merged overlay rows", () => {
    const raw = "H1751+116 A720 B94+68 C175+156 D126+4 S155+164";
    strict_1.default.deepEqual((0, ocr_ev_1.parseStatLetterRows)(raw), {
        evs: {
            hp: 116,
            attack: 0,
            defense: 68,
            spAtk: 156,
            spDef: 4,
            speed: 164,
        },
        stats: {
            hp: 175,
            attack: 72,
            defense: 94,
            spAtk: 175,
            spDef: 126,
            speed: 155,
        },
    });
});
(0, node_test_1.default)("parseJapaneseEvStatGrid reads builder style effort/stat cards", () => {
    const raw = "HP 努力値 0 実数値 150 こうげき 努力値 252 実数値 147 ぼうぎょ 努力値 0 実数値 145 とくこう 努力値 0 実数値 65 とくぼう 努力値 0 実数値 95 すばやさ 努力値 252 実数値 147";
    strict_1.default.deepEqual((0, ocr_ev_1.parseJapaneseEvStatGrid)(raw), {
        evs: {
            hp: 0,
            attack: 252,
            defense: 0,
            spAtk: 0,
            spDef: 0,
            speed: 252,
        },
        stats: {
            hp: 150,
            attack: 147,
            defense: 145,
            spAtk: 65,
            spDef: 95,
            speed: 147,
        },
    });
});
(0, node_test_1.default)("normalize OCR helpers support builder style effort/stat cards", () => {
    const raw = "HP 努力値 0 実数値 150 こうげき 努力値 252 実数値 147 ぼうぎょ 努力値 0 実数値 145 とくこう 努力値 0 実数値 65 とくぼう 努力値 0 実数値 95 すばやさ 努力値 252 実数値 147";
    strict_1.default.deepEqual((0, ocr_ev_1.normalizeOcrEvs)(raw), {
        hp: 0,
        attack: 252,
        defense: 0,
        spAtk: 0,
        spDef: 0,
        speed: 252,
    });
    strict_1.default.deepEqual((0, ocr_ev_1.normalizeOcrActualStats)(raw), {
        hp: 150,
        attack: 147,
        defense: 145,
        spAtk: 65,
        spDef: 95,
        speed: 147,
    });
});
