import test from "node:test";
import assert from "node:assert/strict";
import { findBestJaMatch, normalizeJaText } from "../lib/japanese-match";

test("normalizeJaText normalizes width, script, and punctuation", () => {
  assert.equal(normalizeJaText("１０まんボルト"), normalizeJaText("10マンボルト"));
  assert.equal(normalizeJaText("こだわり＠スカーフ"), normalizeJaText("こだわりスカーフ"));
});

test("findBestJaMatch tolerates small OCR mistakes", () => {
  assert.equal(findBestJaMatch("ハイパーボィス", ["ハイパーボイス", "みがわり"], { maxDistance: 2 }), "ハイパーボイス");
  assert.equal(findBestJaMatch("こたわりスカーフ", ["こだわりスカーフ", "きあいのタスキ"], { maxDistance: 2 }), "こだわりスカーフ");
  assert.equal(findBestJaMatch("ひひいろのこどう", ["ひひいろのこどう", "マルチスケイル"]), "ひひいろのこどう");
});
