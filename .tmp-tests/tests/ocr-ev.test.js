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
