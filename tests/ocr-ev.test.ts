import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOcrActualStats, normalizeOcrEvs, parseJapaneseLabeledActualStats, parseStatLetterEvs } from "../lib/ocr-ev";

test("parseStatLetterEvs reads HABCDS effort values", () => {
  assert.deepEqual(parseStatLetterEvs("H252 A252 B4"), {
    hp: 252,
    attack: 252,
    defense: 4,
  });
});

test("parseStatLetterEvs handles separators and fullwidth characters", () => {
  assert.deepEqual(parseStatLetterEvs("Ｈ:252／Ａ:4／Ｓ:252"), {
    hp: 252,
    attack: 4,
    speed: 252,
  });
});

test("parseStatLetterEvs ignores out-of-range values", () => {
  assert.deepEqual(parseStatLetterEvs("H999 A252"), {
    attack: 252,
  });
});

test("normalizeOcrEvs accepts HABCDS keys and string values", () => {
  assert.deepEqual(normalizeOcrEvs({
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

test("normalizeOcrEvs accepts a raw HABCDS string", () => {
  assert.deepEqual(normalizeOcrEvs("H252 A244 S12"), {
    hp: 252,
    attack: 244,
    defense: 0,
    spAtk: 0,
    spDef: 0,
    speed: 12,
  });
});

test("normalizeOcrActualStats accepts a raw HABCDS string", () => {
  assert.deepEqual(normalizeOcrActualStats("H207, A199, B120, Cx, D80, S119"), {
    hp: 207,
    attack: 199,
    defense: 120,
    spDef: 80,
    speed: 119,
  });
});

test("parseJapaneseLabeledActualStats reads game stat rows", () => {
  assert.deepEqual(parseJapaneseLabeledActualStats("HP 198 32 こうげき 154 0 ぼうぎょ 161 32 すばやさ 100 0"), {
    hp: 198,
    attack: 154,
    defense: 161,
    speed: 100,
  });
});
