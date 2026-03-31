import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOcrActualStats, normalizeOcrEvs, parseJapaneseEvStatGrid, parseJapaneseLabeledActualStats, parseStatLetterEvs, parseStatLetterRows } from "../lib/ocr-ev";

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

test("parseStatLetterRows reads stat and ev columns from overlay layout", () => {
  assert.deepEqual(
    parseStatLetterRows("H 179 +228 A 115 0 B 147 +16 C 58 0 D 139 +252 S 117 +12"),
    {
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
    },
  );
});

test("normalize OCR helpers support overlay row layout", () => {
  const raw = "H 179 +228 A 115 0 B 147 +16 C 58 0 D 139 +252 S 117 +12";

  assert.deepEqual(normalizeOcrEvs(raw), {
    hp: 228,
    attack: 0,
    defense: 16,
    spAtk: 0,
    spDef: 252,
    speed: 12,
  });

  assert.deepEqual(normalizeOcrActualStats(raw), {
    hp: 179,
    attack: 115,
    defense: 147,
    spAtk: 58,
    spDef: 139,
    speed: 117,
  });
});

test("parseStatLetterRows handles OCR-merged overlay rows", () => {
  const raw = "H1751+116 A720 B94+68 C175+156 D126+4 S155+164";

  assert.deepEqual(parseStatLetterRows(raw), {
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

test("parseJapaneseEvStatGrid reads builder style effort/stat cards", () => {
  const raw = "HP 努力値 0 実数値 150 こうげき 努力値 252 実数値 147 ぼうぎょ 努力値 0 実数値 145 とくこう 努力値 0 実数値 65 とくぼう 努力値 0 実数値 95 すばやさ 努力値 252 実数値 147";

  assert.deepEqual(parseJapaneseEvStatGrid(raw), {
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

test("normalize OCR helpers support builder style effort/stat cards", () => {
  const raw = "HP 努力値 0 実数値 150 こうげき 努力値 252 実数値 147 ぼうぎょ 努力値 0 実数値 145 とくこう 努力値 0 実数値 65 とくぼう 努力値 0 実数値 95 すばやさ 努力値 252 実数値 147";

  assert.deepEqual(normalizeOcrEvs(raw), {
    hp: 0,
    attack: 252,
    defense: 0,
    spAtk: 0,
    spDef: 0,
    speed: 252,
  });

  assert.deepEqual(normalizeOcrActualStats(raw), {
    hp: 150,
    attack: 147,
    defense: 145,
    spAtk: 65,
    spDef: 95,
    speed: 147,
  });
});
