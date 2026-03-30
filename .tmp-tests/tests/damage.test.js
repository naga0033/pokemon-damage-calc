"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const damage_1 = require("../lib/damage");
const baseMove = (overrides = {}) => ({
    name: "thunderbolt",
    japaneseName: "10まんボルト",
    type: "electric",
    category: "special",
    power: 90,
    accuracy: 100,
    priority: 0,
    ...overrides,
});
function createInput(move, overrides = {}) {
    return {
        attackerLevel: 50,
        move,
        attackStat: 200,
        defenseStat: 120,
        defenderHp: 200,
        attackerTypes: ["electric"],
        defenderTypes: ["water"],
        attackerTeraType: null,
        isTerastallized: false,
        defenderTeraType: null,
        defenderTerastallized: false,
        isCritical: false,
        isBurned: false,
        weather: "none",
        terrain: "none",
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
(0, node_test_1.default)("electric terrain boosts grounded electric attacks only", () => {
    const move = baseMove();
    const grounded = (0, damage_1.calcDamage)(createInput(move, { terrain: "electric", attackerIsGrounded: true }));
    const airborne = (0, damage_1.calcDamage)(createInput(move, { terrain: "electric", attackerIsGrounded: false }));
    strict_1.default.ok(grounded.maxDamage > airborne.maxDamage);
    strict_1.default.equal(grounded.modifiers?.some((modifier) => modifier.label === "フィールド"), true);
    strict_1.default.equal(airborne.modifiers?.some((modifier) => modifier.label === "フィールド"), false);
});
(0, node_test_1.default)("misty terrain halves dragon damage only against grounded defenders", () => {
    const move = baseMove({ name: "draco-meteor", japaneseName: "りゅうせいぐん", type: "dragon", power: 130 });
    const grounded = (0, damage_1.calcDamage)(createInput(move, {
        terrain: "misty",
        attackerTypes: ["dragon"],
        defenderTypes: ["dragon"],
        defenderIsGrounded: true,
    }));
    const airborne = (0, damage_1.calcDamage)(createInput(move, {
        terrain: "misty",
        attackerTypes: ["dragon"],
        defenderTypes: ["dragon"],
        defenderIsGrounded: false,
    }));
    strict_1.default.ok(grounded.maxDamage < airborne.maxDamage);
});
(0, node_test_1.default)("psychic terrain blocks priority moves into grounded targets", () => {
    const move = baseMove({
        name: "extreme-speed",
        japaneseName: "しんそく",
        type: "normal",
        category: "physical",
        power: 80,
        priority: 2,
    });
    const result = (0, damage_1.calcDamage)(createInput(move, {
        terrain: "psychic",
        attackerTypes: ["normal"],
        defenderIsGrounded: true,
    }));
    strict_1.default.equal(result.maxDamage, 0);
    strict_1.default.equal(result.koLabel, "サイコフィールドで無効");
});
(0, node_test_1.default)("snow and sand apply defensive boosts to matching types", () => {
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
    const snowBoosted = (0, damage_1.calcDamage)(createInput(physicalMove, {
        weather: "snow",
        attackerTypes: ["ground"],
        defenderTypes: ["ice"],
    }));
    const snowNeutral = (0, damage_1.calcDamage)(createInput(physicalMove, {
        weather: "none",
        attackerTypes: ["ground"],
        defenderTypes: ["ice"],
    }));
    const sandBoosted = (0, damage_1.calcDamage)(createInput(specialMove, {
        weather: "sand",
        attackerTypes: ["water"],
        defenderTypes: ["rock"],
    }));
    const sandNeutral = (0, damage_1.calcDamage)(createInput(specialMove, {
        weather: "none",
        attackerTypes: ["water"],
        defenderTypes: ["rock"],
    }));
    strict_1.default.ok(snowBoosted.maxDamage < snowNeutral.maxDamage);
    strict_1.default.ok(sandBoosted.maxDamage < sandNeutral.maxDamage);
});
(0, node_test_1.default)("protosynthesis only boosts the relevant offensive stat when it is the highest", () => {
    const physicalMove = baseMove({
        name: "earthquake",
        japaneseName: "じしん",
        type: "ground",
        category: "physical",
        power: 100,
    });
    const attackBoosted = (0, damage_1.calcDamage)(createInput(physicalMove, {
        attackerAbility: "protosynthesis",
        weather: "sun",
        attackerAbilityBoostedStat: "attack",
        attackerTypes: ["ground"],
    }));
    const speedBoosted = (0, damage_1.calcDamage)(createInput(physicalMove, {
        attackerAbility: "protosynthesis",
        weather: "sun",
        attackerAbilityBoostedStat: "speed",
        attackerTypes: ["ground"],
    }));
    strict_1.default.ok(attackBoosted.maxDamage > speedBoosted.maxDamage);
});
(0, node_test_1.default)("facade applies its dedicated burn modifier", () => {
    const move = baseMove({
        name: "facade",
        japaneseName: "からげんき",
        type: "normal",
        category: "physical",
        power: 70,
    });
    const burned = (0, damage_1.calcDamage)(createInput(move, {
        isBurned: true,
        attackerTypes: ["normal"],
    }));
    const healthy = (0, damage_1.calcDamage)(createInput(move, {
        isBurned: false,
        attackerTypes: ["normal"],
    }));
    strict_1.default.ok(Math.abs(burned.maxDamage - healthy.maxDamage) <= 1);
    strict_1.default.equal(burned.modifiers?.some((modifier) => modifier.label === "からげんき"), true);
});
(0, node_test_1.default)("grounded helper handles balloon, flying type, levitate, iron ball, and stellar tera", () => {
    strict_1.default.equal((0, damage_1.isGrounded)(["flying"], "", "", null, false), false);
    strict_1.default.equal((0, damage_1.isGrounded)(["electric"], "levitate", "", null, false), false);
    strict_1.default.equal((0, damage_1.isGrounded)(["electric"], "", "air-balloon", null, false), false);
    strict_1.default.equal((0, damage_1.isGrounded)(["flying"], "", "iron-ball", null, false), true);
    strict_1.default.equal((0, damage_1.isGrounded)(["flying"], "", "", "stellar", true), false);
    strict_1.default.equal((0, damage_1.isGrounded)(["flying"], "", "", "ground", true), true);
});
(0, node_test_1.default)("freeze-dry becomes super effective against water", () => {
    const move = baseMove({
        name: "freeze-dry",
        japaneseName: "フリーズドライ",
        type: "ice",
        power: 70,
    });
    const versusWater = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["ice"],
        defenderTypes: ["water"],
    }));
    const versusNormal = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["ice"],
        defenderTypes: ["normal"],
    }));
    strict_1.default.equal(versusWater.typeEffectiveness, 2);
    strict_1.default.equal(versusWater.modifiers?.some((modifier) => modifier.label === "フリーズドライ"), true);
    strict_1.default.equal(versusWater.modifiers?.find((modifier) => modifier.label === "フリーズドライ")?.value, 2);
    strict_1.default.ok(versusWater.maxDamage > versusNormal.maxDamage);
});
(0, node_test_1.default)("freeze-dry special case also works when move name is passed in Japanese", () => {
    const move = baseMove({
        name: "フリーズドライ",
        japaneseName: "フリーズドライ",
        type: "ice",
        power: 70,
    });
    const result = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["ice"],
        defenderTypes: ["water"],
    }));
    strict_1.default.equal(result.typeEffectiveness, 2);
});
(0, node_test_1.default)("thousand arrows hits flying and levitate targets", () => {
    const move = baseMove({
        name: "thousand-arrows",
        japaneseName: "サウザンアロー",
        type: "ground",
        category: "physical",
        power: 90,
    });
    const versusFlying = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["ground"],
        defenderTypes: ["flying"],
    }));
    const versusLevitate = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["ground"],
        defenderTypes: ["electric"],
        defenderAbility: "levitate",
    }));
    strict_1.default.ok(versusFlying.maxDamage > 0);
    strict_1.default.ok(versusLevitate.maxDamage > 0);
});
(0, node_test_1.default)("psyshock and secret sword use defense instead of special defense", () => {
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
    const lowDefense = (0, damage_1.calcDamage)(createInput(psyshock, {
        attackerTypes: ["psychic"],
        defenderTypes: ["normal"],
        defenseStat: 100,
    }));
    const highDefense = (0, damage_1.calcDamage)(createInput(psyshock, {
        attackerTypes: ["psychic"],
        defenderTypes: ["normal"],
        defenseStat: 200,
    }));
    const swordLowDefense = (0, damage_1.calcDamage)(createInput(secretSword, {
        attackerTypes: ["fighting"],
        defenderTypes: ["normal"],
        defenseStat: 100,
    }));
    const swordHighDefense = (0, damage_1.calcDamage)(createInput(secretSword, {
        attackerTypes: ["fighting"],
        defenderTypes: ["normal"],
        defenseStat: 200,
    }));
    strict_1.default.ok(lowDefense.maxDamage > highDefense.maxDamage);
    strict_1.default.ok(swordLowDefense.maxDamage > swordHighDefense.maxDamage);
});
(0, node_test_1.default)("expanding force and rising voltage gain their terrain-based power boosts", () => {
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
    const expandingBoosted = (0, damage_1.calcDamage)(createInput(expandingForce, {
        terrain: "psychic",
        attackerTypes: ["psychic"],
        defenderTypes: ["poison"],
        attackerIsGrounded: true,
    }));
    const expandingNeutral = (0, damage_1.calcDamage)(createInput(expandingForce, {
        terrain: "psychic",
        attackerTypes: ["psychic"],
        defenderTypes: ["poison"],
        attackerIsGrounded: false,
    }));
    const voltageBoosted = (0, damage_1.calcDamage)(createInput(risingVoltage, {
        terrain: "electric",
        attackerTypes: ["electric"],
        defenderTypes: ["water"],
        defenderIsGrounded: true,
    }));
    const voltageNeutral = (0, damage_1.calcDamage)(createInput(risingVoltage, {
        terrain: "electric",
        attackerTypes: ["electric"],
        defenderTypes: ["water"],
        defenderIsGrounded: false,
    }));
    strict_1.default.ok(expandingBoosted.maxDamage > expandingNeutral.maxDamage);
    strict_1.default.ok(voltageBoosted.maxDamage > voltageNeutral.maxDamage);
});
(0, node_test_1.default)("solar beam is weakened by harsh weather and hydro steam is boosted in sun", () => {
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
    const solarRain = (0, damage_1.calcDamage)(createInput(solarBeam, {
        weather: "rain",
        attackerTypes: ["grass"],
        defenderTypes: ["water"],
    }));
    const solarClear = (0, damage_1.calcDamage)(createInput(solarBeam, {
        weather: "none",
        attackerTypes: ["grass"],
        defenderTypes: ["water"],
    }));
    const steamSun = (0, damage_1.calcDamage)(createInput(hydroSteam, {
        weather: "sun",
        attackerTypes: ["water"],
        defenderTypes: ["ground"],
    }));
    const steamClear = (0, damage_1.calcDamage)(createInput(hydroSteam, {
        weather: "none",
        attackerTypes: ["water"],
        defenderTypes: ["ground"],
    }));
    strict_1.default.ok(solarRain.maxDamage < solarClear.maxDamage);
    strict_1.default.ok(steamSun.maxDamage > steamClear.maxDamage);
});
(0, node_test_1.default)("common offensive abilities boost the matching move groups", () => {
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
    const strongJaw = (0, damage_1.calcDamage)(createInput(crunch, {
        attackerAbility: "strong-jaw",
        attackerTypes: ["dark"],
        defenderTypes: ["ghost"],
    }));
    const megaLauncher = (0, damage_1.calcDamage)(createInput(auraSphere, {
        attackerAbility: "mega-launcher",
        attackerTypes: ["fighting"],
        defenderTypes: ["normal"],
    }));
    const sharpness = (0, damage_1.calcDamage)(createInput(psychoCut, {
        attackerAbility: "sharpness",
        attackerTypes: ["psychic"],
        defenderTypes: ["poison"],
    }));
    const punkRock = (0, damage_1.calcDamage)(createInput(bugBuzz, {
        attackerAbility: "punk-rock",
        attackerTypes: ["bug"],
        defenderTypes: ["dark"],
    }));
    const neutralCrunch = (0, damage_1.calcDamage)(createInput(crunch, {
        attackerTypes: ["dark"],
        defenderTypes: ["ghost"],
    }));
    strict_1.default.ok(strongJaw.maxDamage > neutralCrunch.maxDamage);
    strict_1.default.ok(megaLauncher.maxDamage > (0, damage_1.calcDamage)(createInput(auraSphere, {
        attackerTypes: ["fighting"],
        defenderTypes: ["normal"],
    })).maxDamage);
    strict_1.default.ok(sharpness.maxDamage > (0, damage_1.calcDamage)(createInput(psychoCut, {
        attackerTypes: ["psychic"],
        defenderTypes: ["poison"],
    })).maxDamage);
    strict_1.default.ok(punkRock.maxDamage > (0, damage_1.calcDamage)(createInput(bugBuzz, {
        attackerTypes: ["bug"],
        defenderTypes: ["dark"],
    })).maxDamage);
});
(0, node_test_1.default)("sniper, tinted lens, punk rock defense, and bulletproof apply their special rules", () => {
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
    const tintedLens = (0, damage_1.calcDamage)(createInput(resistedMove, {
        attackerAbility: "tinted-lens",
        attackerTypes: ["grass"],
        defenderTypes: ["fire"],
    }));
    const resistedNeutral = (0, damage_1.calcDamage)(createInput(resistedMove, {
        attackerTypes: ["grass"],
        defenderTypes: ["fire"],
    }));
    const punkRockDefense = (0, damage_1.calcDamage)(createInput(soundMove, {
        attackerTypes: ["normal"],
        defenderTypes: ["electric"],
        defenderAbility: "punk-rock",
    }));
    const soundNeutral = (0, damage_1.calcDamage)(createInput(soundMove, {
        attackerTypes: ["normal"],
        defenderTypes: ["electric"],
    }));
    const bulletproof = (0, damage_1.calcDamage)(createInput(bulletMove, {
        attackerTypes: ["ghost"],
        defenderTypes: ["psychic"],
        defenderAbility: "bulletproof",
    }));
    const sniperCrit = (0, damage_1.calcDamage)(createInput(critMove, {
        attackerAbility: "sniper",
        attackerTypes: ["ground"],
        defenderTypes: ["electric"],
        isCritical: true,
    }));
    const normalCrit = (0, damage_1.calcDamage)(createInput(critMove, {
        attackerTypes: ["ground"],
        defenderTypes: ["electric"],
        isCritical: true,
    }));
    strict_1.default.ok(tintedLens.maxDamage > resistedNeutral.maxDamage);
    strict_1.default.ok(punkRockDefense.maxDamage < soundNeutral.maxDamage);
    strict_1.default.equal(bulletproof.maxDamage, 0);
    strict_1.default.ok(sniperCrit.maxDamage > normalCrit.maxDamage);
});
(0, node_test_1.default)("unaware ignores offensive stat boosts unless the move bypasses abilities", () => {
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
    const boostedVsUnaware = (0, damage_1.calcDamage)(createInput(iceMove, {
        attackerTypes: ["ice"],
        defenderTypes: ["water"],
        attackerRank: 2,
        defenderAbility: "unaware",
    }));
    const neutralVsUnaware = (0, damage_1.calcDamage)(createInput(iceMove, {
        attackerTypes: ["ice"],
        defenderTypes: ["water"],
        attackerRank: 0,
        defenderAbility: "unaware",
    }));
    const boostedShadowRay = (0, damage_1.calcDamage)(createInput(moongeistBeam, {
        attackerTypes: ["ghost"],
        defenderTypes: ["psychic"],
        attackerRank: 2,
        defenderAbility: "unaware",
    }));
    const neutralShadowRay = (0, damage_1.calcDamage)(createInput(moongeistBeam, {
        attackerTypes: ["ghost"],
        defenderTypes: ["psychic"],
        attackerRank: 0,
        defenderAbility: "unaware",
    }));
    strict_1.default.equal(boostedVsUnaware.maxDamage, neutralVsUnaware.maxDamage);
    strict_1.default.ok(boostedShadowRay.maxDamage > neutralShadowRay.maxDamage);
});
