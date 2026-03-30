"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const japanese_match_1 = require("../lib/japanese-match");
(0, node_test_1.default)("normalizeJaText normalizes width, script, and punctuation", () => {
    strict_1.default.equal((0, japanese_match_1.normalizeJaText)("１０まんボルト"), (0, japanese_match_1.normalizeJaText)("10マンボルト"));
    strict_1.default.equal((0, japanese_match_1.normalizeJaText)("こだわり＠スカーフ"), (0, japanese_match_1.normalizeJaText)("こだわりスカーフ"));
});
(0, node_test_1.default)("findBestJaMatch tolerates small OCR mistakes", () => {
    strict_1.default.equal((0, japanese_match_1.findBestJaMatch)("ハイパーボィス", ["ハイパーボイス", "みがわり"], { maxDistance: 2 }), "ハイパーボイス");
    strict_1.default.equal((0, japanese_match_1.findBestJaMatch)("こたわりスカーフ", ["こだわりスカーフ", "きあいのタスキ"], { maxDistance: 2 }), "こだわりスカーフ");
    strict_1.default.equal((0, japanese_match_1.findBestJaMatch)("ひひいろのこどう", ["ひひいろのこどう", "マルチスケイル"]), "ひひいろのこどう");
});
