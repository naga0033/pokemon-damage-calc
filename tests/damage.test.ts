import test from "node:test";
import assert from "node:assert/strict";
import { calcDamage, isGrounded } from "../lib/damage";
import type { MoveData, PokemonType } from "../lib/types";

const baseMove = (overrides: Partial<MoveData> = {}): MoveData => ({
  name: "thunderbolt",
  japaneseName: "10まんボルト",
  type: "electric",
  category: "special",
  target: "selected-pokemon",
  power: 90,
  accuracy: 100,
  priority: 0,
  ...overrides,
});

function createInput(move: MoveData, overrides: Record<string, unknown> = {}) {
  return {
    attackerLevel: 50,
    move,
    attackStat: 200,
    defenseStat: 120,
    defenderHp: 200,
    attackerTypes: ["electric"] as PokemonType[],
    defenderTypes: ["water"] as PokemonType[],
    attackerTeraType: null,
    isTerastallized: false,
    defenderTeraType: null,
    defenderTerastallized: false,
    isCritical: false,
    isBurned: false,
    weather: "none" as const,
    terrain: "none" as const,
    attackerItem: "",
    defenderItem: "",
    attackerAbility: "",
    defenderAbility: "",
    attackerRank: 0,
    defenderRank: 0,
    isCharged: false,
    attackerIsGrounded: true,
    defenderIsGrounded: true,
    attackerAbilityBoostedStat: null,
    ...overrides,
  };
}

test("electric terrain boosts grounded electric attacks only", () => {
  const move = baseMove();
  const grounded = calcDamage(createInput(move, { terrain: "electric", attackerIsGrounded: true }));
  const airborne = calcDamage(createInput(move, { terrain: "electric", attackerIsGrounded: false }));

  assert.ok(grounded.maxDamage > airborne.maxDamage);
  assert.equal(grounded.modifiers?.some((modifier) => modifier.label === "フィールド"), true);
  assert.equal(airborne.modifiers?.some((modifier) => modifier.label === "フィールド"), false);
});

test("misty terrain halves dragon damage only against grounded defenders", () => {
  const move = baseMove({ name: "draco-meteor", japaneseName: "りゅうせいぐん", type: "dragon", power: 130 });
  const grounded = calcDamage(createInput(move, {
    terrain: "misty",
    attackerTypes: ["dragon"],
    defenderTypes: ["dragon"],
    defenderIsGrounded: true,
  }));
  const airborne = calcDamage(createInput(move, {
    terrain: "misty",
    attackerTypes: ["dragon"],
    defenderTypes: ["dragon"],
    defenderIsGrounded: false,
  }));

  assert.ok(grounded.maxDamage < airborne.maxDamage);
});

test("psychic terrain blocks priority moves into grounded targets", () => {
  const move = baseMove({
    name: "extreme-speed",
    japaneseName: "しんそく",
    type: "normal",
    category: "physical",
    power: 80,
    priority: 2,
  });
  const result = calcDamage(createInput(move, {
    terrain: "psychic",
    attackerTypes: ["normal"],
    defenderIsGrounded: true,
  }));

  assert.equal(result.maxDamage, 0);
  assert.equal(result.koLabel, "サイコフィールドで無効");
});

test("snow and sand apply defensive boosts to matching types", () => {
  const physicalMove = baseMove({
    name: "earthquake",
    japaneseName: "じしん",
    type: "ground",
    category: "physical",
    power: 100,
  });
  const specialMove = baseMove({
    name: "surf",
    japaneseName: "なみのり",
    type: "water",
    category: "special",
    power: 90,
  });

  const snowBoosted = calcDamage(createInput(physicalMove, {
    weather: "snow",
    attackerTypes: ["ground"],
    defenderTypes: ["ice"],
  }));
  const snowNeutral = calcDamage(createInput(physicalMove, {
    weather: "none",
    attackerTypes: ["ground"],
    defenderTypes: ["ice"],
  }));
  const sandBoosted = calcDamage(createInput(specialMove, {
    weather: "sand",
    attackerTypes: ["water"],
    defenderTypes: ["rock"],
  }));
  const sandNeutral = calcDamage(createInput(specialMove, {
    weather: "none",
    attackerTypes: ["water"],
    defenderTypes: ["rock"],
  }));

  assert.ok(snowBoosted.maxDamage < snowNeutral.maxDamage);
  assert.ok(sandBoosted.maxDamage < sandNeutral.maxDamage);
});

test("protosynthesis only boosts the relevant offensive stat when it is the highest", () => {
  const physicalMove = baseMove({
    name: "earthquake",
    japaneseName: "じしん",
    type: "ground",
    category: "physical",
    power: 100,
  });
  const attackBoosted = calcDamage(createInput(physicalMove, {
    attackerAbility: "protosynthesis",
    weather: "sun",
    attackerAbilityBoostedStat: "attack",
    attackerTypes: ["ground"],
  }));
  const speedBoosted = calcDamage(createInput(physicalMove, {
    attackerAbility: "protosynthesis",
    weather: "sun",
    attackerAbilityBoostedStat: "speed",
    attackerTypes: ["ground"],
  }));

  assert.ok(attackBoosted.maxDamage > speedBoosted.maxDamage);
});

test("facade applies its dedicated burn modifier", () => {
  const move = baseMove({
    name: "facade",
    japaneseName: "からげんき",
    type: "normal",
    category: "physical",
    power: 70,
  });
  const burned = calcDamage(createInput(move, {
    isBurned: true,
    attackerTypes: ["normal"],
  }));
  const healthy = calcDamage(createInput(move, {
    isBurned: false,
    attackerTypes: ["normal"],
  }));

  assert.ok(Math.abs(burned.maxDamage - healthy.maxDamage) <= 1);
  assert.equal(burned.modifiers?.some((modifier) => modifier.label === "からげんき"), true);
});

test("grounded helper handles balloon, flying type, levitate, iron ball, and stellar tera", () => {
  assert.equal(isGrounded(["flying"], "", "", null, false), false);
  assert.equal(isGrounded(["electric"], "levitate", "", null, false), false);
  assert.equal(isGrounded(["electric"], "", "air-balloon", null, false), false);
  assert.equal(isGrounded(["flying"], "", "iron-ball", null, false), true);
  assert.equal(isGrounded(["flying"], "", "", "stellar", true), false);
  assert.equal(isGrounded(["flying"], "", "", "ground", true), true);
});

test("freeze-dry becomes super effective against water", () => {
  const move = baseMove({
    name: "freeze-dry",
    japaneseName: "フリーズドライ",
    type: "ice",
    power: 70,
  });
  const versusWater = calcDamage(createInput(move, {
    attackerTypes: ["ice"] as PokemonType[],
    defenderTypes: ["water"] as PokemonType[],
  }));
  const versusNormal = calcDamage(createInput(move, {
    attackerTypes: ["ice"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
  }));

  assert.equal(versusWater.typeEffectiveness, 2);
  assert.equal(versusWater.modifiers?.some((modifier) => modifier.label === "フリーズドライ"), true);
  assert.equal(versusWater.modifiers?.find((modifier) => modifier.label === "フリーズドライ")?.value, 2);
  assert.ok(versusWater.maxDamage > versusNormal.maxDamage);
});

test("freeze-dry special case also works when move name is passed in Japanese", () => {
  const move = baseMove({
    name: "フリーズドライ",
    japaneseName: "フリーズドライ",
    type: "ice",
    power: 70,
  });
  const result = calcDamage(createInput(move, {
    attackerTypes: ["ice"] as PokemonType[],
    defenderTypes: ["water"] as PokemonType[],
  }));

  assert.equal(result.typeEffectiveness, 2);
});

test("stellar tera blast becomes super effective against terastallized defenders", () => {
  const move = baseMove({
    name: "tera-blast",
    japaneseName: "テラバースト",
    type: "stellar",
    power: 80,
  });
  const versusTerastallized = calcDamage(createInput(move, {
    attackerTypes: ["dragon", "flying"] as PokemonType[],
    defenderTypes: ["water"] as PokemonType[],
    attackerTeraType: "stellar",
    isTerastallized: true,
    defenderTeraType: "fire",
    defenderTerastallized: true,
  }));
  const versusNormal = calcDamage(createInput(move, {
    attackerTypes: ["dragon", "flying"] as PokemonType[],
    defenderTypes: ["water"] as PokemonType[],
    attackerTeraType: "stellar",
    isTerastallized: true,
    defenderTeraType: null,
    defenderTerastallized: false,
  }));

  assert.equal(versusTerastallized.typeEffectiveness, 2);
  assert.equal(versusNormal.typeEffectiveness, 1);
  assert.equal(versusTerastallized.modifiers?.some((modifier) => modifier.label === "ステラテラバースト"), true);
  assert.ok(versusTerastallized.maxDamage > versusNormal.maxDamage);
});

test("doubles spread move gets reduced power", () => {
  const move = baseMove({
    name: "rock-slide",
    japaneseName: "いわなだれ",
    type: "rock",
    category: "physical",
    target: "all-opponents",
    power: 75,
  });
  const singles = calcDamage(createInput(move, {
    attackerTypes: ["rock"] as PokemonType[],
    defenderTypes: ["fire"] as PokemonType[],
    attackStat: 180,
    isDoubles: false,
  }));
  const doubles = calcDamage(createInput(move, {
    attackerTypes: ["rock"] as PokemonType[],
    defenderTypes: ["fire"] as PokemonType[],
    attackStat: 180,
    isDoubles: true,
  }));

  assert.ok(doubles.maxDamage < singles.maxDamage);
  assert.equal(doubles.modifiers?.some((modifier) => modifier.label === "ダブル全体技"), true);
});

test("astral barrage also gets doubles spread reduction", () => {
  const move = baseMove({
    name: "astral-barrage",
    japaneseName: "アストラルビット",
    type: "ghost",
    target: "all-opponents",
    power: 120,
  });
  const singles = calcDamage(createInput(move, {
    attackerTypes: ["ghost"] as PokemonType[],
    defenderTypes: ["psychic"] as PokemonType[],
    isDoubles: false,
  }));
  const doubles = calcDamage(createInput(move, {
    attackerTypes: ["ghost"] as PokemonType[],
    defenderTypes: ["psychic"] as PokemonType[],
    isDoubles: true,
  }));

  assert.ok(doubles.maxDamage < singles.maxDamage);
  assert.equal(doubles.modifiers?.some((modifier) => modifier.label === "ダブル全体技"), true);
});

test("helping hand, steely spirit, and power spot boost damage", () => {
  const move = baseMove({
    name: "flash-cannon",
    japaneseName: "ラスターカノン",
    type: "steel",
    power: 80,
  });
  const normal = calcDamage(createInput(move, {
    attackerTypes: ["steel"] as PokemonType[],
    defenderTypes: ["fairy"] as PokemonType[],
  }));
  const boosted = calcDamage(createInput(move, {
    attackerTypes: ["steel"] as PokemonType[],
    defenderTypes: ["fairy"] as PokemonType[],
    helpingHand: true,
    steelworker: true,
    powerSpot: true,
  }));

  assert.ok(boosted.maxDamage > normal.maxDamage);
  assert.equal(boosted.modifiers?.some((modifier) => modifier.label === "てだすけ"), true);
  assert.equal(boosted.modifiers?.some((modifier) => modifier.label === "はがねのせいしん"), true);
  assert.equal(boosted.modifiers?.some((modifier) => modifier.label === "パワースポット"), true);
});

test("flower gift boosts physical attack only in sun", () => {
  const move = baseMove({
    name: "earthquake",
    japaneseName: "じしん",
    type: "ground",
    category: "physical",
    power: 100,
  });
  const sunny = calcDamage(createInput(move, {
    attackerTypes: ["ground"] as PokemonType[],
    defenderTypes: ["steel"] as PokemonType[],
    flowerGift: true,
    weather: "sun",
  }));
  const neutral = calcDamage(createInput(move, {
    attackerTypes: ["ground"] as PokemonType[],
    defenderTypes: ["steel"] as PokemonType[],
    flowerGift: true,
    weather: "none",
  }));

  assert.ok(sunny.maxDamage > neutral.maxDamage);
  assert.equal(sunny.modifiers?.some((modifier) => modifier.label === "フラワーギフト"), true);
});

test("defender flower gift boosts special defense in sun", () => {
  const specialMove = baseMove({
    name: "shadow-ball",
    japaneseName: "シャドーボール",
    type: "ghost",
    power: 80,
  });
  const physicalMove = baseMove({
    name: "shadow-claw",
    japaneseName: "シャドークロー",
    type: "ghost",
    category: "physical",
    power: 70,
  });
  const sunnyBoosted = calcDamage(createInput(specialMove, {
    attackerTypes: ["ghost"] as PokemonType[],
    defenderTypes: ["psychic"] as PokemonType[],
    defenderFlowerGift: true,
    weather: "sun",
  }));
  const noSun = calcDamage(createInput(specialMove, {
    attackerTypes: ["ghost"] as PokemonType[],
    defenderTypes: ["psychic"] as PokemonType[],
    defenderFlowerGift: true,
    weather: "none",
  }));
  const physicalSunny = calcDamage(createInput(physicalMove, {
    attackerTypes: ["ghost"] as PokemonType[],
    defenderTypes: ["psychic"] as PokemonType[],
    defenderFlowerGift: true,
    weather: "sun",
  }));
  const physicalNeutral = calcDamage(createInput(physicalMove, {
    attackerTypes: ["ghost"] as PokemonType[],
    defenderTypes: ["psychic"] as PokemonType[],
    defenderFlowerGift: false,
    weather: "sun",
  }));

  assert.ok(sunnyBoosted.maxDamage < noSun.maxDamage);
  assert.equal(sunnyBoosted.modifiers?.some((modifier) => modifier.label === "フラワーギフト(特防)"), true);
  assert.equal(physicalSunny.maxDamage, physicalNeutral.maxDamage);
});

test("friend guard reduces damage by 25%", () => {
  const move = baseMove({
    name: "moonblast",
    japaneseName: "ムーンフォース",
    type: "fairy",
    power: 95,
  });
  const normal = calcDamage(createInput(move, {
    attackerTypes: ["fairy"] as PokemonType[],
    defenderTypes: ["dragon"] as PokemonType[],
  }));
  const guarded = calcDamage(createInput(move, {
    attackerTypes: ["fairy"] as PokemonType[],
    defenderTypes: ["dragon"] as PokemonType[],
    friendGuard: true,
  }));

  assert.ok(guarded.maxDamage < normal.maxDamage);
  assert.equal(guarded.modifiers?.some((modifier) => modifier.label === "ともだちガード"), true);
});

test("gravity lets ground moves hit flying and levitate targets", () => {
  const move = baseMove({
    name: "earthquake",
    japaneseName: "じしん",
    type: "ground",
    category: "physical",
    power: 100,
  });
  const versusFlying = calcDamage(createInput(move, {
    attackerTypes: ["ground"] as PokemonType[],
    defenderTypes: ["flying", "steel"] as PokemonType[],
    gravity: true,
    attackStat: 180,
  }));
  const versusLevitate = calcDamage(createInput(move, {
    attackerTypes: ["ground"] as PokemonType[],
    defenderTypes: ["electric"] as PokemonType[],
    defenderAbility: "levitate",
    gravity: true,
    attackStat: 180,
  }));

  assert.ok(versusFlying.maxDamage > 0);
  assert.equal(versusFlying.typeEffectiveness, 2);
  assert.ok(versusLevitate.maxDamage > 0);
});

test("thousand arrows hits flying and levitate targets", () => {
  const move = baseMove({
    name: "thousand-arrows",
    japaneseName: "サウザンアロー",
    type: "ground",
    category: "physical",
    power: 90,
  });
  const versusFlying = calcDamage(createInput(move, {
    attackerTypes: ["ground"] as PokemonType[],
    defenderTypes: ["flying"] as PokemonType[],
  }));
  const versusLevitate = calcDamage(createInput(move, {
    attackerTypes: ["ground"] as PokemonType[],
    defenderTypes: ["electric"] as PokemonType[],
    defenderAbility: "levitate",
  }));

  assert.ok(versusFlying.maxDamage > 0);
  assert.ok(versusLevitate.maxDamage > 0);
});

test("psyshock and secret sword use defense instead of special defense", () => {
  const psyshock = baseMove({
    name: "psyshock",
    japaneseName: "サイコショック",
    type: "psychic",
    power: 80,
  });
  const secretSword = baseMove({
    name: "secret-sword",
    japaneseName: "しんぴのつるぎ",
    type: "fighting",
    power: 85,
  });

  const lowDefense = calcDamage(createInput(psyshock, {
    attackerTypes: ["psychic"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
    defenseStat: 100,
  }));
  const highDefense = calcDamage(createInput(psyshock, {
    attackerTypes: ["psychic"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
    defenseStat: 200,
  }));
  const swordLowDefense = calcDamage(createInput(secretSword, {
    attackerTypes: ["fighting"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
    defenseStat: 100,
  }));
  const swordHighDefense = calcDamage(createInput(secretSword, {
    attackerTypes: ["fighting"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
    defenseStat: 200,
  }));

  assert.ok(lowDefense.maxDamage > highDefense.maxDamage);
  assert.ok(swordLowDefense.maxDamage > swordHighDefense.maxDamage);
});

test("expanding force and rising voltage gain their terrain-based power boosts", () => {
  const expandingForce = baseMove({
    name: "expanding-force",
    japaneseName: "ワイドフォース",
    type: "psychic",
    power: 80,
  });
  const risingVoltage = baseMove({
    name: "rising-voltage",
    japaneseName: "ライジングボルト",
    type: "electric",
    power: 70,
  });

  const expandingBoosted = calcDamage(createInput(expandingForce, {
    terrain: "psychic",
    attackerTypes: ["psychic"] as PokemonType[],
    defenderTypes: ["poison"] as PokemonType[],
    attackerIsGrounded: true,
  }));
  const expandingNeutral = calcDamage(createInput(expandingForce, {
    terrain: "psychic",
    attackerTypes: ["psychic"] as PokemonType[],
    defenderTypes: ["poison"] as PokemonType[],
    attackerIsGrounded: false,
  }));
  const voltageBoosted = calcDamage(createInput(risingVoltage, {
    terrain: "electric",
    attackerTypes: ["electric"] as PokemonType[],
    defenderTypes: ["water"] as PokemonType[],
    defenderIsGrounded: true,
  }));
  const voltageNeutral = calcDamage(createInput(risingVoltage, {
    terrain: "electric",
    attackerTypes: ["electric"] as PokemonType[],
    defenderTypes: ["water"] as PokemonType[],
    defenderIsGrounded: false,
  }));

  assert.ok(expandingBoosted.maxDamage > expandingNeutral.maxDamage);
  assert.ok(voltageBoosted.maxDamage > voltageNeutral.maxDamage);
});

test("solar beam is weakened by harsh weather and hydro steam is boosted in sun", () => {
  const solarBeam = baseMove({
    name: "solar-beam",
    japaneseName: "ソーラービーム",
    type: "grass",
    power: 120,
  });
  const hydroSteam = baseMove({
    name: "hydro-steam",
    japaneseName: "ハイドロスチーム",
    type: "water",
    power: 80,
  });

  const solarRain = calcDamage(createInput(solarBeam, {
    weather: "rain",
    attackerTypes: ["grass"] as PokemonType[],
    defenderTypes: ["water"] as PokemonType[],
  }));
  const solarClear = calcDamage(createInput(solarBeam, {
    weather: "none",
    attackerTypes: ["grass"] as PokemonType[],
    defenderTypes: ["water"] as PokemonType[],
  }));
  const steamSun = calcDamage(createInput(hydroSteam, {
    weather: "sun",
    attackerTypes: ["water"] as PokemonType[],
    defenderTypes: ["ground"] as PokemonType[],
  }));
  const steamClear = calcDamage(createInput(hydroSteam, {
    weather: "none",
    attackerTypes: ["water"] as PokemonType[],
    defenderTypes: ["ground"] as PokemonType[],
  }));

  assert.ok(solarRain.maxDamage < solarClear.maxDamage);
  assert.ok(steamSun.maxDamage > steamClear.maxDamage);
});

test("common offensive abilities boost the matching move groups", () => {
  const crunch = baseMove({
    name: "crunch",
    japaneseName: "かみくだく",
    type: "dark",
    category: "physical",
    power: 80,
  });
  const auraSphere = baseMove({
    name: "aura-sphere",
    japaneseName: "はどうだん",
    type: "fighting",
    category: "special",
    power: 80,
  });
  const psychoCut = baseMove({
    name: "psycho-cut",
    japaneseName: "サイコカッター",
    type: "psychic",
    category: "physical",
    power: 70,
  });
  const bugBuzz = baseMove({
    name: "bug-buzz",
    japaneseName: "むしのさざめき",
    type: "bug",
    category: "special",
    power: 90,
  });

  const strongJaw = calcDamage(createInput(crunch, {
    attackerAbility: "strong-jaw",
    attackerTypes: ["dark"] as PokemonType[],
    defenderTypes: ["ghost"] as PokemonType[],
  }));
  const megaLauncher = calcDamage(createInput(auraSphere, {
    attackerAbility: "mega-launcher",
    attackerTypes: ["fighting"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
  }));
  const sharpness = calcDamage(createInput(psychoCut, {
    attackerAbility: "sharpness",
    attackerTypes: ["psychic"] as PokemonType[],
    defenderTypes: ["poison"] as PokemonType[],
  }));
  const punkRock = calcDamage(createInput(bugBuzz, {
    attackerAbility: "punk-rock",
    attackerTypes: ["bug"] as PokemonType[],
    defenderTypes: ["dark"] as PokemonType[],
  }));
  const neutralCrunch = calcDamage(createInput(crunch, {
    attackerTypes: ["dark"] as PokemonType[],
    defenderTypes: ["ghost"] as PokemonType[],
  }));

  assert.ok(strongJaw.maxDamage > neutralCrunch.maxDamage);
  assert.ok(megaLauncher.maxDamage > calcDamage(createInput(auraSphere, {
    attackerTypes: ["fighting"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
  })).maxDamage);
  assert.ok(sharpness.maxDamage > calcDamage(createInput(psychoCut, {
    attackerTypes: ["psychic"] as PokemonType[],
    defenderTypes: ["poison"] as PokemonType[],
  })).maxDamage);
  assert.ok(punkRock.maxDamage > calcDamage(createInput(bugBuzz, {
    attackerTypes: ["bug"] as PokemonType[],
    defenderTypes: ["dark"] as PokemonType[],
  })).maxDamage);
});

test("sniper, tinted lens, punk rock defense, and bulletproof apply their special rules", () => {
  const resistedMove = baseMove({
    name: "leaf-storm",
    japaneseName: "リーフストーム",
    type: "grass",
    category: "special",
    power: 130,
  });
  const soundMove = baseMove({
    name: "hyper-voice",
    japaneseName: "ハイパーボイス",
    type: "normal",
    category: "special",
    power: 90,
  });
  const bulletMove = baseMove({
    name: "shadow-ball",
    japaneseName: "シャドーボール",
    type: "ghost",
    category: "special",
    power: 80,
  });
  const critMove = baseMove({
    name: "drill-run",
    japaneseName: "ドリルライナー",
    type: "ground",
    category: "physical",
    power: 80,
  });

  const tintedLens = calcDamage(createInput(resistedMove, {
    attackerAbility: "tinted-lens",
    attackerTypes: ["grass"] as PokemonType[],
    defenderTypes: ["fire"] as PokemonType[],
  }));
  const resistedNeutral = calcDamage(createInput(resistedMove, {
    attackerTypes: ["grass"] as PokemonType[],
    defenderTypes: ["fire"] as PokemonType[],
  }));
  const punkRockDefense = calcDamage(createInput(soundMove, {
    attackerTypes: ["normal"] as PokemonType[],
    defenderTypes: ["electric"] as PokemonType[],
    defenderAbility: "punk-rock",
  }));
  const soundNeutral = calcDamage(createInput(soundMove, {
    attackerTypes: ["normal"] as PokemonType[],
    defenderTypes: ["electric"] as PokemonType[],
  }));
  const bulletproof = calcDamage(createInput(bulletMove, {
    attackerTypes: ["ghost"] as PokemonType[],
    defenderTypes: ["psychic"] as PokemonType[],
    defenderAbility: "bulletproof",
  }));
  const sniperCrit = calcDamage(createInput(critMove, {
    attackerAbility: "sniper",
    attackerTypes: ["ground"] as PokemonType[],
    defenderTypes: ["electric"] as PokemonType[],
    isCritical: true,
  }));
  const normalCrit = calcDamage(createInput(critMove, {
    attackerTypes: ["ground"] as PokemonType[],
    defenderTypes: ["electric"] as PokemonType[],
    isCritical: true,
  }));

  assert.ok(tintedLens.maxDamage > resistedNeutral.maxDamage);
  assert.ok(punkRockDefense.maxDamage < soundNeutral.maxDamage);
  assert.equal(bulletproof.maxDamage, 0);
  assert.ok(sniperCrit.maxDamage > normalCrit.maxDamage);
});

test("unaware ignores offensive stat boosts unless the move bypasses abilities", () => {
  const iceMove = baseMove({
    name: "ice-beam",
    japaneseName: "れいとうビーム",
    type: "ice",
    category: "special",
    power: 90,
  });
  const moongeistBeam = baseMove({
    name: "moongeist-beam",
    japaneseName: "シャドーレイ",
    type: "ghost",
    category: "special",
    power: 100,
  });

  const boostedVsUnaware = calcDamage(createInput(iceMove, {
    attackerTypes: ["ice"] as PokemonType[],
    defenderTypes: ["water"] as PokemonType[],
    attackerRank: 2,
    defenderAbility: "unaware",
  }));
  const neutralVsUnaware = calcDamage(createInput(iceMove, {
    attackerTypes: ["ice"] as PokemonType[],
    defenderTypes: ["water"] as PokemonType[],
    attackerRank: 0,
    defenderAbility: "unaware",
  }));
  const boostedShadowRay = calcDamage(createInput(moongeistBeam, {
    attackerTypes: ["ghost"] as PokemonType[],
    defenderTypes: ["psychic"] as PokemonType[],
    attackerRank: 2,
    defenderAbility: "unaware",
  }));
  const neutralShadowRay = calcDamage(createInput(moongeistBeam, {
    attackerTypes: ["ghost"] as PokemonType[],
    defenderTypes: ["psychic"] as PokemonType[],
    attackerRank: 0,
    defenderAbility: "unaware",
  }));

  assert.equal(boostedVsUnaware.maxDamage, neutralVsUnaware.maxDamage);
  assert.ok(boostedShadowRay.maxDamage > neutralShadowRay.maxDamage);
});

test("technician boosts moves with base power 60 or less", () => {
  const sixtyPowerMove = baseMove({
    name: "mach-punch",
    japaneseName: "マッハパンチ",
    type: "fighting",
    category: "physical",
    power: 60,
  });
  const seventyPowerMove = baseMove({
    name: "psycho-cut",
    japaneseName: "サイコカッター",
    type: "psychic",
    category: "physical",
    power: 70,
  });

  const boosted = calcDamage(createInput(sixtyPowerMove, {
    attackerAbility: "technician",
    attackerTypes: ["fighting"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
  }));
  const neutralSixty = calcDamage(createInput(sixtyPowerMove, {
    attackerTypes: ["fighting"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
  }));
  const neutralSeventy = calcDamage(createInput(seventyPowerMove, {
    attackerTypes: ["psychic"] as PokemonType[],
    defenderTypes: ["poison"] as PokemonType[],
  }));
  const technicianSeventy = calcDamage(createInput(seventyPowerMove, {
    attackerAbility: "technician",
    attackerTypes: ["psychic"] as PokemonType[],
    defenderTypes: ["poison"] as PokemonType[],
  }));

  assert.ok(boosted.maxDamage > neutralSixty.maxDamage);
  assert.equal(boosted.modifiers?.some((modifier) => modifier.label === "テクニシャン"), true);
  assert.equal(technicianSeventy.maxDamage, neutralSeventy.maxDamage);
});

test("sheer force boosts moves with secondary effects", () => {
  const secondaryMove = baseMove({
    name: "flamethrower",
    japaneseName: "かえんほうしゃ",
    type: "fire",
    category: "special",
    power: 90,
  });
  const plainMove = baseMove({
    name: "surf",
    japaneseName: "なみのり",
    type: "water",
    category: "special",
    power: 90,
  });

  const sheerForceBoosted = calcDamage(createInput(secondaryMove, {
    attackerAbility: "sheer-force",
    attackerTypes: ["fire"] as PokemonType[],
    defenderTypes: ["grass"] as PokemonType[],
  }));
  const secondaryNeutral = calcDamage(createInput(secondaryMove, {
    attackerTypes: ["fire"] as PokemonType[],
    defenderTypes: ["grass"] as PokemonType[],
  }));
  const sheerForcePlain = calcDamage(createInput(plainMove, {
    attackerAbility: "sheer-force",
    attackerTypes: ["water"] as PokemonType[],
    defenderTypes: ["fire"] as PokemonType[],
  }));
  const plainNeutral = calcDamage(createInput(plainMove, {
    attackerTypes: ["water"] as PokemonType[],
    defenderTypes: ["fire"] as PokemonType[],
  }));

  assert.ok(sheerForceBoosted.maxDamage > secondaryNeutral.maxDamage);
  assert.equal(sheerForceBoosted.modifiers?.some((modifier) => modifier.label === "ちからずく"), true);
  assert.equal(sheerForcePlain.maxDamage, plainNeutral.maxDamage);
});

test("reckless boosts recoil moves", () => {
  const recoilMove = baseMove({
    name: "brave-bird",
    japaneseName: "ブレイブバード",
    type: "flying",
    category: "physical",
    power: 120,
  });
  const nonRecoilMove = baseMove({
    name: "drill-peck",
    japaneseName: "ドリルくちばし",
    type: "flying",
    category: "physical",
    power: 80,
  });

  const recklessBoosted = calcDamage(createInput(recoilMove, {
    attackerAbility: "reckless",
    attackerTypes: ["flying"] as PokemonType[],
    defenderTypes: ["grass"] as PokemonType[],
  }));
  const recoilNeutral = calcDamage(createInput(recoilMove, {
    attackerTypes: ["flying"] as PokemonType[],
    defenderTypes: ["grass"] as PokemonType[],
  }));
  const recklessPlain = calcDamage(createInput(nonRecoilMove, {
    attackerAbility: "reckless",
    attackerTypes: ["flying"] as PokemonType[],
    defenderTypes: ["grass"] as PokemonType[],
  }));
  const plainNeutral = calcDamage(createInput(nonRecoilMove, {
    attackerTypes: ["flying"] as PokemonType[],
    defenderTypes: ["grass"] as PokemonType[],
  }));

  assert.ok(recklessBoosted.maxDamage > recoilNeutral.maxDamage);
  assert.equal(recklessBoosted.modifiers?.some((modifier) => modifier.label === "すてみ"), true);
  assert.equal(recklessPlain.maxDamage, plainNeutral.maxDamage);
});

test("water bubble doubles water moves and halves fire damage", () => {
  const waterMove = baseMove({
    name: "water-gun",
    japaneseName: "みずでっぽう",
    type: "water",
    category: "special",
    power: 40,
  });
  const fireMove = baseMove({
    name: "flamethrower",
    japaneseName: "かえんほうしゃ",
    type: "fire",
    category: "special",
    power: 90,
  });

  const waterBubbleAttack = calcDamage(createInput(waterMove, {
    attackerAbility: "water-bubble",
    attackerTypes: ["water"] as PokemonType[],
    defenderTypes: ["rock"] as PokemonType[],
  }));
  const normalWaterAttack = calcDamage(createInput(waterMove, {
    attackerTypes: ["water"] as PokemonType[],
    defenderTypes: ["rock"] as PokemonType[],
  }));
  const waterBubbleDefense = calcDamage(createInput(fireMove, {
    attackerTypes: ["fire"] as PokemonType[],
    defenderTypes: ["bug"] as PokemonType[],
    defenderAbility: "water-bubble",
  }));
  const normalFireAttack = calcDamage(createInput(fireMove, {
    attackerTypes: ["fire"] as PokemonType[],
    defenderTypes: ["bug"] as PokemonType[],
  }));

  assert.ok(waterBubbleAttack.maxDamage > normalWaterAttack.maxDamage);
  assert.equal(waterBubbleAttack.modifiers?.some((modifier) => modifier.label === "すいほう"), true);
  assert.ok(waterBubbleDefense.maxDamage < normalFireAttack.maxDamage);
  assert.equal(waterBubbleDefense.modifiers?.some((modifier) => modifier.label === "すいほう(耐性)"), true);
});

test("muscle band boosts physical moves", () => {
  const physicalMove = baseMove({
    name: "drain-punch",
    japaneseName: "ドレインパンチ",
    type: "fighting",
    category: "physical",
    power: 75,
  });
  const specialMove = baseMove({
    name: "shadow-ball",
    japaneseName: "シャドーボール",
    type: "ghost",
    category: "special",
    power: 80,
  });

  const boostedPhysical = calcDamage(createInput(physicalMove, {
    attackerItem: "muscle-band",
    attackerTypes: ["fighting"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
  }));
  const neutralPhysical = calcDamage(createInput(physicalMove, {
    attackerTypes: ["fighting"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
  }));
  const boostedSpecial = calcDamage(createInput(specialMove, {
    attackerItem: "muscle-band",
    attackerTypes: ["ghost"] as PokemonType[],
    defenderTypes: ["psychic"] as PokemonType[],
  }));
  const neutralSpecial = calcDamage(createInput(specialMove, {
    attackerTypes: ["ghost"] as PokemonType[],
    defenderTypes: ["psychic"] as PokemonType[],
  }));

  assert.ok(boostedPhysical.maxDamage > neutralPhysical.maxDamage);
  assert.equal(boostedPhysical.modifiers?.some((modifier) => modifier.label === "ちからのハチマキ"), true);
  assert.equal(boostedSpecial.maxDamage, neutralSpecial.maxDamage);
});

test("wise glasses boosts special moves", () => {
  const specialMove = baseMove({
    name: "shadow-ball",
    japaneseName: "シャドーボール",
    type: "ghost",
    category: "special",
    power: 80,
  });
  const physicalMove = baseMove({
    name: "drain-punch",
    japaneseName: "ドレインパンチ",
    type: "fighting",
    category: "physical",
    power: 75,
  });

  const boostedSpecial = calcDamage(createInput(specialMove, {
    attackerItem: "wise-glasses",
    attackerTypes: ["ghost"] as PokemonType[],
    defenderTypes: ["psychic"] as PokemonType[],
  }));
  const neutralSpecial = calcDamage(createInput(specialMove, {
    attackerTypes: ["ghost"] as PokemonType[],
    defenderTypes: ["psychic"] as PokemonType[],
  }));
  const boostedPhysical = calcDamage(createInput(physicalMove, {
    attackerItem: "wise-glasses",
    attackerTypes: ["fighting"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
  }));
  const neutralPhysical = calcDamage(createInput(physicalMove, {
    attackerTypes: ["fighting"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
  }));

  assert.ok(boostedSpecial.maxDamage > neutralSpecial.maxDamage);
  assert.equal(boostedSpecial.modifiers?.some((modifier) => modifier.label === "ものしりメガネ"), true);
  assert.equal(boostedPhysical.maxDamage, neutralPhysical.maxDamage);
});

test("punching glove boosts punch moves", () => {
  const punchMove = baseMove({
    name: "drain-punch",
    japaneseName: "ドレインパンチ",
    type: "fighting",
    category: "physical",
    power: 75,
  });
  const nonPunchMove = baseMove({
    name: "close-combat",
    japaneseName: "インファイト",
    type: "fighting",
    category: "physical",
    power: 120,
  });

  const boostedPunch = calcDamage(createInput(punchMove, {
    attackerItem: "punching-glove",
    attackerTypes: ["fighting"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
  }));
  const neutralPunch = calcDamage(createInput(punchMove, {
    attackerTypes: ["fighting"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
  }));
  const boostedNonPunch = calcDamage(createInput(nonPunchMove, {
    attackerItem: "punching-glove",
    attackerTypes: ["fighting"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
  }));
  const neutralNonPunch = calcDamage(createInput(nonPunchMove, {
    attackerTypes: ["fighting"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
  }));

  assert.ok(boostedPunch.maxDamage > neutralPunch.maxDamage);
  assert.equal(boostedPunch.modifiers?.some((modifier) => modifier.label === "パンチグローブ"), true);
  assert.equal(boostedNonPunch.maxDamage, neutralNonPunch.maxDamage);
});

test("expanding force becomes spread move in doubles on psychic terrain", () => {
  const move = baseMove({
    name: "expanding-force",
    japaneseName: "ワイドフォース",
    type: "psychic",
    category: "special",
    power: 80,
  });

  const doubles = calcDamage(createInput(move, {
    terrain: "psychic",
    isDoubles: true,
    attackerIsGrounded: true,
    attackerTypes: ["psychic"] as PokemonType[],
    defenderTypes: ["fighting"] as PokemonType[],
  }));
  const singles = calcDamage(createInput(move, {
    terrain: "psychic",
    isDoubles: false,
    attackerIsGrounded: true,
    attackerTypes: ["psychic"] as PokemonType[],
    defenderTypes: ["fighting"] as PokemonType[],
  }));

  assert.ok(doubles.maxDamage < singles.maxDamage);
  assert.equal(doubles.modifiers?.some((modifier) => modifier.label === "ダブル全体技"), true);
  assert.equal(singles.modifiers?.some((modifier) => modifier.label === "ダブル全体技"), false);
  assert.equal(
    doubles.modifiers?.find((modifier) => modifier.label === "ワイドフォース")?.detail,
    "サイコフィールド + ダブルで全体化",
  );
});

test("heavy metal and light metal affect weight-based moves", () => {
  const move = baseMove({
    name: "grass-knot",
    japaneseName: "くさむすび",
    type: "grass",
    category: "special",
    power: null,
  });

  const heavyMetal = calcDamage(createInput(move, {
    attackerTypes: ["grass"] as PokemonType[],
    defenderTypes: ["water"] as PokemonType[],
    defenderWeight: 500,
    defenderAbility: "heavy-metal",
  }));
  const neutral = calcDamage(createInput(move, {
    attackerTypes: ["grass"] as PokemonType[],
    defenderTypes: ["water"] as PokemonType[],
    defenderWeight: 500,
  }));
  const lightMetal = calcDamage(createInput(move, {
    attackerTypes: ["grass"] as PokemonType[],
    defenderTypes: ["water"] as PokemonType[],
    defenderWeight: 500,
    defenderAbility: "light-metal",
  }));

  assert.ok(heavyMetal.maxDamage > neutral.maxDamage);
  assert.ok(lightMetal.maxDamage < neutral.maxDamage);
  assert.equal(heavyMetal.modifiers?.some((modifier) => modifier.label === "ヘビーメタル"), true);
  assert.equal(lightMetal.modifiers?.some((modifier) => modifier.label === "ライトメタル"), true);
});

test("collision course and electro drift get boosted on super effective hits", () => {
  const collisionCourse = baseMove({
    name: "collision-course",
    japaneseName: "アクセルブレイク",
    type: "fighting",
    category: "physical",
    power: 100,
  });
  const electroDrift = baseMove({
    name: "electro-drift",
    japaneseName: "イナズマドライブ",
    type: "electric",
    category: "special",
    power: 100,
  });

  const collisionSuper = calcDamage(createInput(collisionCourse, {
    attackerTypes: ["fighting"] as PokemonType[],
    defenderTypes: ["normal"] as PokemonType[],
  }));
  const collisionNeutral = calcDamage(createInput(collisionCourse, {
    attackerTypes: ["fighting"] as PokemonType[],
    defenderTypes: ["dragon"] as PokemonType[],
  }));
  const electroSuper = calcDamage(createInput(electroDrift, {
    attackerTypes: ["electric"] as PokemonType[],
    defenderTypes: ["water"] as PokemonType[],
  }));
  const electroNeutral = calcDamage(createInput(electroDrift, {
    attackerTypes: ["electric"] as PokemonType[],
    defenderTypes: ["dragon"] as PokemonType[],
  }));

  assert.ok(collisionSuper.maxDamage > collisionNeutral.maxDamage);
  assert.ok(electroSuper.maxDamage > electroNeutral.maxDamage);
  assert.equal(collisionSuper.modifiers?.some((modifier) => modifier.label === "アクセルブレイク"), true);
  assert.equal(collisionNeutral.modifiers?.some((modifier) => modifier.label === "アクセルブレイク"), false);
  assert.equal(electroSuper.modifiers?.some((modifier) => modifier.label === "イナズマドライブ"), true);
  assert.equal(electroNeutral.modifiers?.some((modifier) => modifier.label === "イナズマドライブ"), false);
});
