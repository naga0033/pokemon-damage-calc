"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const damage_1 = require("../lib/damage");
const items_1 = require("../lib/items");
const baseMove = (overrides = {}) => ({
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
        supremeOverlordFaintedAllies: 0,
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
(0, node_test_1.default)("fling power changes based on the held item", () => {
    strict_1.default.equal((0, items_1.getFlingPower)("sitrus-berry"), 10);
    strict_1.default.equal((0, items_1.getFlingPower)("life-orb"), 30);
    strict_1.default.equal((0, items_1.getFlingPower)("eviolite"), 40);
    strict_1.default.equal((0, items_1.getFlingPower)("sharp-beak"), 50);
    strict_1.default.equal((0, items_1.getFlingPower)("rocky-helmet"), 60);
    strict_1.default.equal((0, items_1.getFlingPower)("dragon-fang"), 70);
    strict_1.default.equal((0, items_1.getFlingPower)("weakness-policy"), 80);
    strict_1.default.equal((0, items_1.getFlingPower)("hard-stone"), 100);
    strict_1.default.equal((0, items_1.getFlingPower)("iron-ball"), 130);
    strict_1.default.equal((0, items_1.getFlingPower)(""), null);
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
(0, node_test_1.default)("stellar tera blast becomes super effective against terastallized defenders", () => {
    const move = baseMove({
        name: "tera-blast",
        japaneseName: "テラバースト",
        type: "stellar",
        power: 80,
    });
    const versusTerastallized = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["dragon", "flying"],
        defenderTypes: ["water"],
        attackerTeraType: "stellar",
        isTerastallized: true,
        defenderTeraType: "fire",
        defenderTerastallized: true,
    }));
    const versusNormal = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["dragon", "flying"],
        defenderTypes: ["water"],
        attackerTeraType: "stellar",
        isTerastallized: true,
        defenderTeraType: null,
        defenderTerastallized: false,
    }));
    strict_1.default.equal(versusTerastallized.typeEffectiveness, 2);
    strict_1.default.equal(versusNormal.typeEffectiveness, 1);
    strict_1.default.equal(versusTerastallized.modifiers?.some((modifier) => modifier.label === "ステラテラバースト"), true);
    strict_1.default.ok(versusTerastallized.maxDamage > versusNormal.maxDamage);
});
(0, node_test_1.default)("doubles spread move gets reduced power", () => {
    const move = baseMove({
        name: "rock-slide",
        japaneseName: "いわなだれ",
        type: "rock",
        category: "physical",
        target: "all-opponents",
        power: 75,
    });
    const singles = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["rock"],
        defenderTypes: ["fire"],
        attackStat: 180,
        isDoubles: false,
    }));
    const doubles = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["rock"],
        defenderTypes: ["fire"],
        attackStat: 180,
        isDoubles: true,
    }));
    strict_1.default.ok(doubles.maxDamage < singles.maxDamage);
    strict_1.default.equal(doubles.modifiers?.some((modifier) => modifier.label === "ダブル全体技"), true);
});
(0, node_test_1.default)("astral barrage also gets doubles spread reduction", () => {
    const move = baseMove({
        name: "astral-barrage",
        japaneseName: "アストラルビット",
        type: "ghost",
        target: "all-opponents",
        power: 120,
    });
    const singles = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["ghost"],
        defenderTypes: ["psychic"],
        isDoubles: false,
    }));
    const doubles = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["ghost"],
        defenderTypes: ["psychic"],
        isDoubles: true,
    }));
    strict_1.default.ok(doubles.maxDamage < singles.maxDamage);
    strict_1.default.equal(doubles.modifiers?.some((modifier) => modifier.label === "ダブル全体技"), true);
});
(0, node_test_1.default)("helping hand, steely spirit, and power spot boost damage", () => {
    const move = baseMove({
        name: "flash-cannon",
        japaneseName: "ラスターカノン",
        type: "steel",
        power: 80,
    });
    const normal = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["steel"],
        defenderTypes: ["fairy"],
    }));
    const boosted = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["steel"],
        defenderTypes: ["fairy"],
        helpingHand: true,
        steelworker: true,
        powerSpot: true,
    }));
    strict_1.default.ok(boosted.maxDamage > normal.maxDamage);
    strict_1.default.equal(boosted.modifiers?.some((modifier) => modifier.label === "てだすけ"), true);
    strict_1.default.equal(boosted.modifiers?.some((modifier) => modifier.label === "はがねのせいしん"), true);
    strict_1.default.equal(boosted.modifiers?.some((modifier) => modifier.label === "パワースポット"), true);
});
(0, node_test_1.default)("flower gift boosts physical attack only in sun", () => {
    const move = baseMove({
        name: "earthquake",
        japaneseName: "じしん",
        type: "ground",
        category: "physical",
        power: 100,
    });
    const sunny = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["ground"],
        defenderTypes: ["steel"],
        flowerGift: true,
        weather: "sun",
    }));
    const neutral = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["ground"],
        defenderTypes: ["steel"],
        flowerGift: true,
        weather: "none",
    }));
    strict_1.default.ok(sunny.maxDamage > neutral.maxDamage);
    strict_1.default.equal(sunny.modifiers?.some((modifier) => modifier.label === "フラワーギフト"), true);
});
(0, node_test_1.default)("defender flower gift boosts special defense in sun", () => {
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
    const sunnyBoosted = (0, damage_1.calcDamage)(createInput(specialMove, {
        attackerTypes: ["ghost"],
        defenderTypes: ["psychic"],
        defenderFlowerGift: true,
        weather: "sun",
    }));
    const noSun = (0, damage_1.calcDamage)(createInput(specialMove, {
        attackerTypes: ["ghost"],
        defenderTypes: ["psychic"],
        defenderFlowerGift: true,
        weather: "none",
    }));
    const physicalSunny = (0, damage_1.calcDamage)(createInput(physicalMove, {
        attackerTypes: ["ghost"],
        defenderTypes: ["psychic"],
        defenderFlowerGift: true,
        weather: "sun",
    }));
    const physicalNeutral = (0, damage_1.calcDamage)(createInput(physicalMove, {
        attackerTypes: ["ghost"],
        defenderTypes: ["psychic"],
        defenderFlowerGift: false,
        weather: "sun",
    }));
    strict_1.default.ok(sunnyBoosted.maxDamage < noSun.maxDamage);
    strict_1.default.equal(sunnyBoosted.modifiers?.some((modifier) => modifier.label === "フラワーギフト(特防)"), true);
    strict_1.default.equal(physicalSunny.maxDamage, physicalNeutral.maxDamage);
});
(0, node_test_1.default)("friend guard reduces damage by 25%", () => {
    const move = baseMove({
        name: "moonblast",
        japaneseName: "ムーンフォース",
        type: "fairy",
        power: 95,
    });
    const normal = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["fairy"],
        defenderTypes: ["dragon"],
    }));
    const guarded = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["fairy"],
        defenderTypes: ["dragon"],
        friendGuard: true,
    }));
    strict_1.default.ok(guarded.maxDamage < normal.maxDamage);
    strict_1.default.equal(guarded.modifiers?.some((modifier) => modifier.label === "ともだちガード"), true);
});
(0, node_test_1.default)("gravity lets ground moves hit flying and levitate targets", () => {
    const move = baseMove({
        name: "earthquake",
        japaneseName: "じしん",
        type: "ground",
        category: "physical",
        power: 100,
    });
    const versusFlying = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["ground"],
        defenderTypes: ["flying", "steel"],
        gravity: true,
        attackStat: 180,
    }));
    const versusLevitate = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["ground"],
        defenderTypes: ["electric"],
        defenderAbility: "levitate",
        gravity: true,
        attackStat: 180,
    }));
    strict_1.default.ok(versusFlying.maxDamage > 0);
    strict_1.default.equal(versusFlying.typeEffectiveness, 2);
    strict_1.default.ok(versusLevitate.maxDamage > 0);
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
(0, node_test_1.default)("supreme overlord scales with fainted allies", () => {
    const move = baseMove({
        name: "kowtow-cleave",
        japaneseName: "ドゲザン",
        type: "dark",
        category: "physical",
        power: 85,
    });
    const neutral = (0, damage_1.calcDamage)(createInput(move, {
        attackerAbility: "supreme-overlord",
        attackerTypes: ["dark"],
        defenderTypes: ["ghost"],
        supremeOverlordFaintedAllies: 0,
    }));
    const threeFainted = (0, damage_1.calcDamage)(createInput(move, {
        attackerAbility: "supreme-overlord",
        attackerTypes: ["dark"],
        defenderTypes: ["ghost"],
        supremeOverlordFaintedAllies: 3,
    }));
    const fiveFainted = (0, damage_1.calcDamage)(createInput(move, {
        attackerAbility: "supreme-overlord",
        attackerTypes: ["dark"],
        defenderTypes: ["ghost"],
        supremeOverlordFaintedAllies: 5,
    }));
    strict_1.default.ok(threeFainted.maxDamage > neutral.maxDamage);
    strict_1.default.ok(fiveFainted.maxDamage > threeFainted.maxDamage);
    strict_1.default.equal(fiveFainted.modifiers?.some((modifier) => modifier.label === "そうだいしょう"), true);
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
(0, node_test_1.default)("technician boosts moves with base power 60 or less", () => {
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
    const boosted = (0, damage_1.calcDamage)(createInput(sixtyPowerMove, {
        attackerAbility: "technician",
        attackerTypes: ["fighting"],
        defenderTypes: ["normal"],
    }));
    const neutralSixty = (0, damage_1.calcDamage)(createInput(sixtyPowerMove, {
        attackerTypes: ["fighting"],
        defenderTypes: ["normal"],
    }));
    const neutralSeventy = (0, damage_1.calcDamage)(createInput(seventyPowerMove, {
        attackerTypes: ["psychic"],
        defenderTypes: ["poison"],
    }));
    const technicianSeventy = (0, damage_1.calcDamage)(createInput(seventyPowerMove, {
        attackerAbility: "technician",
        attackerTypes: ["psychic"],
        defenderTypes: ["poison"],
    }));
    strict_1.default.ok(boosted.maxDamage > neutralSixty.maxDamage);
    strict_1.default.equal(boosted.modifiers?.some((modifier) => modifier.label === "テクニシャン"), true);
    strict_1.default.equal(technicianSeventy.maxDamage, neutralSeventy.maxDamage);
});
(0, node_test_1.default)("sheer force boosts moves with secondary effects", () => {
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
    const sheerForceBoosted = (0, damage_1.calcDamage)(createInput(secondaryMove, {
        attackerAbility: "sheer-force",
        attackerTypes: ["fire"],
        defenderTypes: ["grass"],
    }));
    const secondaryNeutral = (0, damage_1.calcDamage)(createInput(secondaryMove, {
        attackerTypes: ["fire"],
        defenderTypes: ["grass"],
    }));
    const sheerForcePlain = (0, damage_1.calcDamage)(createInput(plainMove, {
        attackerAbility: "sheer-force",
        attackerTypes: ["water"],
        defenderTypes: ["fire"],
    }));
    const plainNeutral = (0, damage_1.calcDamage)(createInput(plainMove, {
        attackerTypes: ["water"],
        defenderTypes: ["fire"],
    }));
    strict_1.default.ok(sheerForceBoosted.maxDamage > secondaryNeutral.maxDamage);
    strict_1.default.equal(sheerForceBoosted.modifiers?.some((modifier) => modifier.label === "ちからずく"), true);
    strict_1.default.equal(sheerForcePlain.maxDamage, plainNeutral.maxDamage);
});
(0, node_test_1.default)("reckless boosts recoil moves", () => {
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
    const recklessBoosted = (0, damage_1.calcDamage)(createInput(recoilMove, {
        attackerAbility: "reckless",
        attackerTypes: ["flying"],
        defenderTypes: ["grass"],
    }));
    const recoilNeutral = (0, damage_1.calcDamage)(createInput(recoilMove, {
        attackerTypes: ["flying"],
        defenderTypes: ["grass"],
    }));
    const recklessPlain = (0, damage_1.calcDamage)(createInput(nonRecoilMove, {
        attackerAbility: "reckless",
        attackerTypes: ["flying"],
        defenderTypes: ["grass"],
    }));
    const plainNeutral = (0, damage_1.calcDamage)(createInput(nonRecoilMove, {
        attackerTypes: ["flying"],
        defenderTypes: ["grass"],
    }));
    strict_1.default.ok(recklessBoosted.maxDamage > recoilNeutral.maxDamage);
    strict_1.default.equal(recklessBoosted.modifiers?.some((modifier) => modifier.label === "すてみ"), true);
    strict_1.default.equal(recklessPlain.maxDamage, plainNeutral.maxDamage);
});
(0, node_test_1.default)("water bubble doubles water moves and halves fire damage", () => {
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
    const waterBubbleAttack = (0, damage_1.calcDamage)(createInput(waterMove, {
        attackerAbility: "water-bubble",
        attackerTypes: ["water"],
        defenderTypes: ["rock"],
    }));
    const normalWaterAttack = (0, damage_1.calcDamage)(createInput(waterMove, {
        attackerTypes: ["water"],
        defenderTypes: ["rock"],
    }));
    const waterBubbleDefense = (0, damage_1.calcDamage)(createInput(fireMove, {
        attackerTypes: ["fire"],
        defenderTypes: ["bug"],
        defenderAbility: "water-bubble",
    }));
    const normalFireAttack = (0, damage_1.calcDamage)(createInput(fireMove, {
        attackerTypes: ["fire"],
        defenderTypes: ["bug"],
    }));
    strict_1.default.ok(waterBubbleAttack.maxDamage > normalWaterAttack.maxDamage);
    strict_1.default.equal(waterBubbleAttack.modifiers?.some((modifier) => modifier.label === "すいほう"), true);
    strict_1.default.ok(waterBubbleDefense.maxDamage < normalFireAttack.maxDamage);
    strict_1.default.equal(waterBubbleDefense.modifiers?.some((modifier) => modifier.label === "すいほう(耐性)"), true);
});
(0, node_test_1.default)("muscle band boosts physical moves", () => {
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
    const boostedPhysical = (0, damage_1.calcDamage)(createInput(physicalMove, {
        attackerItem: "muscle-band",
        attackerTypes: ["fighting"],
        defenderTypes: ["normal"],
    }));
    const neutralPhysical = (0, damage_1.calcDamage)(createInput(physicalMove, {
        attackerTypes: ["fighting"],
        defenderTypes: ["normal"],
    }));
    const boostedSpecial = (0, damage_1.calcDamage)(createInput(specialMove, {
        attackerItem: "muscle-band",
        attackerTypes: ["ghost"],
        defenderTypes: ["psychic"],
    }));
    const neutralSpecial = (0, damage_1.calcDamage)(createInput(specialMove, {
        attackerTypes: ["ghost"],
        defenderTypes: ["psychic"],
    }));
    strict_1.default.ok(boostedPhysical.maxDamage > neutralPhysical.maxDamage);
    strict_1.default.equal(boostedPhysical.modifiers?.some((modifier) => modifier.label === "ちからのハチマキ"), true);
    strict_1.default.equal(boostedSpecial.maxDamage, neutralSpecial.maxDamage);
});
(0, node_test_1.default)("wise glasses boosts special moves", () => {
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
    const boostedSpecial = (0, damage_1.calcDamage)(createInput(specialMove, {
        attackerItem: "wise-glasses",
        attackerTypes: ["ghost"],
        defenderTypes: ["psychic"],
    }));
    const neutralSpecial = (0, damage_1.calcDamage)(createInput(specialMove, {
        attackerTypes: ["ghost"],
        defenderTypes: ["psychic"],
    }));
    const boostedPhysical = (0, damage_1.calcDamage)(createInput(physicalMove, {
        attackerItem: "wise-glasses",
        attackerTypes: ["fighting"],
        defenderTypes: ["normal"],
    }));
    const neutralPhysical = (0, damage_1.calcDamage)(createInput(physicalMove, {
        attackerTypes: ["fighting"],
        defenderTypes: ["normal"],
    }));
    strict_1.default.ok(boostedSpecial.maxDamage > neutralSpecial.maxDamage);
    strict_1.default.equal(boostedSpecial.modifiers?.some((modifier) => modifier.label === "ものしりメガネ"), true);
    strict_1.default.equal(boostedPhysical.maxDamage, neutralPhysical.maxDamage);
});
(0, node_test_1.default)("punching glove boosts punch moves", () => {
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
    const boostedPunch = (0, damage_1.calcDamage)(createInput(punchMove, {
        attackerItem: "punching-glove",
        attackerTypes: ["fighting"],
        defenderTypes: ["normal"],
    }));
    const neutralPunch = (0, damage_1.calcDamage)(createInput(punchMove, {
        attackerTypes: ["fighting"],
        defenderTypes: ["normal"],
    }));
    const boostedNonPunch = (0, damage_1.calcDamage)(createInput(nonPunchMove, {
        attackerItem: "punching-glove",
        attackerTypes: ["fighting"],
        defenderTypes: ["normal"],
    }));
    const neutralNonPunch = (0, damage_1.calcDamage)(createInput(nonPunchMove, {
        attackerTypes: ["fighting"],
        defenderTypes: ["normal"],
    }));
    strict_1.default.ok(boostedPunch.maxDamage > neutralPunch.maxDamage);
    strict_1.default.equal(boostedPunch.modifiers?.some((modifier) => modifier.label === "パンチグローブ"), true);
    strict_1.default.equal(boostedNonPunch.maxDamage, neutralNonPunch.maxDamage);
});
(0, node_test_1.default)("expanding force becomes spread move in doubles on psychic terrain", () => {
    const move = baseMove({
        name: "expanding-force",
        japaneseName: "ワイドフォース",
        type: "psychic",
        category: "special",
        power: 80,
    });
    const doubles = (0, damage_1.calcDamage)(createInput(move, {
        terrain: "psychic",
        isDoubles: true,
        attackerIsGrounded: true,
        attackerTypes: ["psychic"],
        defenderTypes: ["fighting"],
    }));
    const singles = (0, damage_1.calcDamage)(createInput(move, {
        terrain: "psychic",
        isDoubles: false,
        attackerIsGrounded: true,
        attackerTypes: ["psychic"],
        defenderTypes: ["fighting"],
    }));
    strict_1.default.ok(doubles.maxDamage < singles.maxDamage);
    strict_1.default.equal(doubles.modifiers?.some((modifier) => modifier.label === "ダブル全体技"), true);
    strict_1.default.equal(singles.modifiers?.some((modifier) => modifier.label === "ダブル全体技"), false);
    strict_1.default.equal(doubles.modifiers?.find((modifier) => modifier.label === "ワイドフォース")?.detail, "サイコフィールド + ダブルで全体化");
});
(0, node_test_1.default)("heavy metal and light metal affect weight-based moves", () => {
    const move = baseMove({
        name: "grass-knot",
        japaneseName: "くさむすび",
        type: "grass",
        category: "special",
        power: null,
    });
    const heavyMetal = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["grass"],
        defenderTypes: ["water"],
        defenderWeight: 500,
        defenderAbility: "heavy-metal",
    }));
    const neutral = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["grass"],
        defenderTypes: ["water"],
        defenderWeight: 500,
    }));
    const lightMetal = (0, damage_1.calcDamage)(createInput(move, {
        attackerTypes: ["grass"],
        defenderTypes: ["water"],
        defenderWeight: 500,
        defenderAbility: "light-metal",
    }));
    strict_1.default.ok(heavyMetal.maxDamage > neutral.maxDamage);
    strict_1.default.ok(lightMetal.maxDamage < neutral.maxDamage);
    strict_1.default.equal(heavyMetal.modifiers?.some((modifier) => modifier.label === "ヘビーメタル"), true);
    strict_1.default.equal(lightMetal.modifiers?.some((modifier) => modifier.label === "ライトメタル"), true);
});
(0, node_test_1.default)("collision course and electro drift get boosted on super effective hits", () => {
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
    const collisionSuper = (0, damage_1.calcDamage)(createInput(collisionCourse, {
        attackerTypes: ["fighting"],
        defenderTypes: ["normal"],
    }));
    const collisionNeutral = (0, damage_1.calcDamage)(createInput(collisionCourse, {
        attackerTypes: ["fighting"],
        defenderTypes: ["dragon"],
    }));
    const electroSuper = (0, damage_1.calcDamage)(createInput(electroDrift, {
        attackerTypes: ["electric"],
        defenderTypes: ["water"],
    }));
    const electroNeutral = (0, damage_1.calcDamage)(createInput(electroDrift, {
        attackerTypes: ["electric"],
        defenderTypes: ["dragon"],
    }));
    strict_1.default.ok(collisionSuper.maxDamage > collisionNeutral.maxDamage);
    strict_1.default.ok(electroSuper.maxDamage > electroNeutral.maxDamage);
    strict_1.default.equal(collisionSuper.modifiers?.some((modifier) => modifier.label === "アクセルブレイク"), true);
    strict_1.default.equal(collisionNeutral.modifiers?.some((modifier) => modifier.label === "アクセルブレイク"), false);
    strict_1.default.equal(electroSuper.modifiers?.some((modifier) => modifier.label === "イナズマドライブ"), true);
    strict_1.default.equal(electroNeutral.modifiers?.some((modifier) => modifier.label === "イナズマドライブ"), false);
});
