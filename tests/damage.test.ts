import test from "node:test";
import assert from "node:assert/strict";
import { calcDamage, isGrounded } from "../lib/damage";
import type { MoveData, PokemonType } from "../lib/types";

const baseMove = (overrides: Partial<MoveData> = {}): MoveData => ({
  name: "thunderbolt",
  japaneseName: "10まんボルト",
  type: "electric",
  category: "special",
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
