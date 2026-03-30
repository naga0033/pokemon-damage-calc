"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const pokemon_names_1 = require("../lib/pokemon-names");
(0, node_test_1.default)("common battle abbreviations resolve to the intended form names", () => {
    strict_1.default.equal((0, pokemon_names_1.getEnSlug)("黒バド"), "calyrex-shadow");
    strict_1.default.equal((0, pokemon_names_1.getEnSlug)("黒バドレックス"), "calyrex-shadow");
    strict_1.default.equal((0, pokemon_names_1.getEnSlug)("白バド"), "calyrex-ice");
    strict_1.default.equal((0, pokemon_names_1.getEnSlug)("白バドレックス"), "calyrex-ice");
});
(0, node_test_1.default)("candidate lookup includes the correct form for common abbreviations", () => {
    const blackRiderCandidates = (0, pokemon_names_1.findPokemonCandidates)("黒バドレックス");
    const whiteRiderCandidates = (0, pokemon_names_1.findPokemonCandidates)("白バド");
    strict_1.default.ok(blackRiderCandidates.some((candidate) => candidate.name === "calyrex-shadow"));
    strict_1.default.ok(whiteRiderCandidates.some((candidate) => candidate.name === "calyrex-ice"));
});
(0, node_test_1.default)("pokemon name resolver prefers clear heading-like names from OCR", () => {
    strict_1.default.equal((0, pokemon_names_1.resolvePokemonJaName)("テラパゴス"), "テラパゴス");
    strict_1.default.equal((0, pokemon_names_1.resolvePokemonJaName)("黒馬バドレックス"), "バドレックス(こくばじょう)");
    strict_1.default.equal((0, pokemon_names_1.resolvePokemonJaName)("るさ"), null);
});
