import test from "node:test";
import assert from "node:assert/strict";
import { findPokemonCandidates, getEnSlug, resolvePokemonJaName } from "../lib/pokemon-names";

test("common battle abbreviations resolve to the intended form names", () => {
  assert.equal(getEnSlug("黒バド"), "calyrex-shadow");
  assert.equal(getEnSlug("黒バドレックス"), "calyrex-shadow");
  assert.equal(getEnSlug("白バド"), "calyrex-ice");
  assert.equal(getEnSlug("白バドレックス"), "calyrex-ice");
});

test("candidate lookup includes the correct form for common abbreviations", () => {
  const blackRiderCandidates = findPokemonCandidates("黒バドレックス");
  const whiteRiderCandidates = findPokemonCandidates("白バド");

  assert.ok(blackRiderCandidates.some((candidate) => candidate.name === "calyrex-shadow"));
  assert.ok(whiteRiderCandidates.some((candidate) => candidate.name === "calyrex-ice"));
});

test("pokemon name resolver prefers clear heading-like names from OCR", () => {
  assert.equal(resolvePokemonJaName("テラパゴス"), "テラパゴス");
  assert.equal(resolvePokemonJaName("黒馬バドレックス"), "バドレックス(こくばじょう)");
  assert.equal(resolvePokemonJaName("るさ"), null);
});
