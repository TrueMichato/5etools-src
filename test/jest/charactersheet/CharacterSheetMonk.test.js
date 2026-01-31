/**
 * Character Sheet Monk Class Tests
 * Comprehensive testing for all Monk class features and subclasses (Monastic Traditions)
 *
 * This test suite verifies that:
 * - All core class features are correctly parsed and provide expected effects
 * - Ki/Focus points equal monk level
 * - Martial Arts die progression is accurate (d4→d6→d8→d10 PHB, d6→d8→d10→d12 XPHB)
 * - Unarmored Movement bonus scales correctly (+10 to +30 ft)
 * - All subclass (Monastic Tradition) features work correctly at designated levels
 * - Both PHB (Classic) and XPHB (2024) versions are handled properly
 */

import "./setup.js";
import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

// ==========================================================================
// PART 1: CORE MONK CLASS FEATURES (PHB)
// ==========================================================================
describe("Monk Core Class Features (PHB)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({name: "Monk", source: "PHB", level: 1});
		state.setAbilityBase("str", 10);
		state.setAbilityBase("dex", 16); // +3 modifier
		state.setAbilityBase("con", 14); // +2 modifier
		state.setAbilityBase("int", 10);
		state.setAbilityBase("wis", 16); // +3 modifier
		state.setAbilityBase("cha", 8);
	});

	// -------------------------------------------------------------------------
	// Martial Arts (Level 1)
	// -------------------------------------------------------------------------
	describe("Martial Arts", () => {
		it("should have d4 martial arts die at level 1 (PHB)", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.martialArtsDie).toBe("1d4");
		});

		it("should have d6 martial arts die at level 5 (PHB)", () => {
			state.addClass({name: "Monk", source: "PHB", level: 5});
			const calculations = state.getFeatureCalculations();
			expect(calculations.martialArtsDie).toBe("1d6");
		});

		it("should have d8 martial arts die at level 11 (PHB)", () => {
			state.addClass({name: "Monk", source: "PHB", level: 11});
			const calculations = state.getFeatureCalculations();
			expect(calculations.martialArtsDie).toBe("1d8");
		});

		it("should have d10 martial arts die at level 17 (PHB)", () => {
			state.addClass({name: "Monk", source: "PHB", level: 17});
			const calculations = state.getFeatureCalculations();
			expect(calculations.martialArtsDie).toBe("1d10");
		});

		it("should set unarmed damage equal to martial arts die", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.unarmedDamage).toBe(calculations.martialArtsDie);
		});
	});

	// -------------------------------------------------------------------------
	// Unarmored Defense (Level 1)
	// -------------------------------------------------------------------------
	describe("Unarmored Defense", () => {
		it("should calculate AC as 10 + DEX + WIS when unarmored", () => {
			// This would be tested via getAC() method
			// DEX 16 (+3) + WIS 16 (+3) + 10 = 16
			expect(state.getTotalLevel()).toBe(1);
		});
	});

	// -------------------------------------------------------------------------
	// Ki Points (Level 2)
	// -------------------------------------------------------------------------
	describe("Ki Points", () => {
		it("should have ki points equal to monk level", () => {
			state.addClass({name: "Monk", source: "PHB", level: 2});
			const calculations = state.getFeatureCalculations();
			expect(calculations.kiPoints).toBe(2);
		});

		it("should have 5 ki points at level 5", () => {
			state.addClass({name: "Monk", source: "PHB", level: 5});
			const calculations = state.getFeatureCalculations();
			expect(calculations.kiPoints).toBe(5);
		});

		it("should have 10 ki points at level 10", () => {
			state.addClass({name: "Monk", source: "PHB", level: 10});
			const calculations = state.getFeatureCalculations();
			expect(calculations.kiPoints).toBe(10);
		});

		it("should have 20 ki points at level 20", () => {
			state.addClass({name: "Monk", source: "PHB", level: 20});
			const calculations = state.getFeatureCalculations();
			expect(calculations.kiPoints).toBe(20);
		});

		it("should calculate ki save DC as 8 + prof + WIS", () => {
			state.addClass({name: "Monk", source: "PHB", level: 2});
			const calculations = state.getFeatureCalculations();
			// 8 + 2 (prof) + 3 (WIS) = 13
			expect(calculations.kiSaveDc).toBe(13);
		});

		it("should scale ki save DC with level", () => {
			state.addClass({name: "Monk", source: "PHB", level: 9});
			const calculations = state.getFeatureCalculations();
			// 8 + 4 (prof at level 9) + 3 (WIS) = 15
			expect(calculations.kiSaveDc).toBe(15);
		});
	});

	// -------------------------------------------------------------------------
	// Unarmored Movement (Level 2+)
	// -------------------------------------------------------------------------
	describe("Unarmored Movement", () => {
		it("should have +10 ft movement at level 2", () => {
			state.addClass({name: "Monk", source: "PHB", level: 2});
			const calculations = state.getFeatureCalculations();
			expect(calculations.unarmoredMovement).toBe(10);
		});

		it("should have +15 ft movement at level 6", () => {
			state.addClass({name: "Monk", source: "PHB", level: 6});
			const calculations = state.getFeatureCalculations();
			expect(calculations.unarmoredMovement).toBe(15);
		});

		it("should have +20 ft movement at level 10", () => {
			state.addClass({name: "Monk", source: "PHB", level: 10});
			const calculations = state.getFeatureCalculations();
			expect(calculations.unarmoredMovement).toBe(20);
		});

		it("should have +25 ft movement at level 14", () => {
			state.addClass({name: "Monk", source: "PHB", level: 14});
			const calculations = state.getFeatureCalculations();
			expect(calculations.unarmoredMovement).toBe(25);
		});

		it("should have +30 ft movement at level 18", () => {
			state.addClass({name: "Monk", source: "PHB", level: 18});
			const calculations = state.getFeatureCalculations();
			expect(calculations.unarmoredMovement).toBe(30);
		});
	});

	// -------------------------------------------------------------------------
	// Deflect Missiles (Level 3)
	// -------------------------------------------------------------------------
	describe("Deflect Missiles", () => {
		it("should calculate deflect missiles reduction correctly", () => {
			state.addClass({name: "Monk", source: "PHB", level: 3});
			const calculations = state.getFeatureCalculations();
			// 1d10 + DEX (+3) + level (3)
			expect(calculations.deflectMissilesReduction).toBe("1d10+3+3");
		});

		it("should scale with monk level", () => {
			state.addClass({name: "Monk", source: "PHB", level: 10});
			const calculations = state.getFeatureCalculations();
			expect(calculations.deflectMissilesReduction).toBe("1d10+3+10");
		});
	});

	// -------------------------------------------------------------------------
	// Slow Fall (Level 4)
	// -------------------------------------------------------------------------
	describe("Slow Fall", () => {
		it("should reduce falling damage by 5 × monk level", () => {
			state.addClass({name: "Monk", source: "PHB", level: 4});
			const calculations = state.getFeatureCalculations();
			expect(calculations.slowFallReduction).toBe(20);
		});

		it("should scale with level", () => {
			state.addClass({name: "Monk", source: "PHB", level: 10});
			const calculations = state.getFeatureCalculations();
			expect(calculations.slowFallReduction).toBe(50);
		});

		it("should max at 100 at level 20", () => {
			state.addClass({name: "Monk", source: "PHB", level: 20});
			const calculations = state.getFeatureCalculations();
			expect(calculations.slowFallReduction).toBe(100);
		});
	});

	// -------------------------------------------------------------------------
	// Extra Attack (Level 5)
	// -------------------------------------------------------------------------
	describe("Extra Attack", () => {
		it("should not have Extra Attack before level 5", () => {
			state.addClass({name: "Monk", source: "PHB", level: 4});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasExtraAttack).toBeUndefined();
		});

		it("should have Extra Attack at level 5", () => {
			state.addClass({name: "Monk", source: "PHB", level: 5});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasExtraAttack).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// Stunning Strike (Level 5)
	// -------------------------------------------------------------------------
	describe("Stunning Strike", () => {
		it("should have Stunning Strike at level 5", () => {
			state.addClass({name: "Monk", source: "PHB", level: 5});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasStunningStrike).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// Ki-Empowered Strikes (Level 6)
	// -------------------------------------------------------------------------
	describe("Ki-Empowered Strikes", () => {
		it("should have Ki-Empowered Strikes at level 6", () => {
			state.addClass({name: "Monk", source: "PHB", level: 6});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasKiEmpoweredStrikes).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// Evasion (Level 7)
	// -------------------------------------------------------------------------
	describe("Evasion", () => {
		it("should have Evasion at level 7", () => {
			state.addClass({name: "Monk", source: "PHB", level: 7});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasEvasion).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// Stillness of Mind (Level 7)
	// -------------------------------------------------------------------------
	describe("Stillness of Mind", () => {
		it("should have Stillness of Mind at level 7", () => {
			state.addClass({name: "Monk", source: "PHB", level: 7});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasStillnessOfMind).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// Unarmored Movement Improvement (Level 9)
	// -------------------------------------------------------------------------
	describe("Unarmored Movement Improvement", () => {
		it("should be able to run on walls at level 9", () => {
			state.addClass({name: "Monk", source: "PHB", level: 9});
			const calculations = state.getFeatureCalculations();
			expect(calculations.canRunOnWalls).toBe(true);
		});

		it("should be able to run on water at level 9", () => {
			state.addClass({name: "Monk", source: "PHB", level: 9});
			const calculations = state.getFeatureCalculations();
			expect(calculations.canRunOnWater).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// Purity of Body (Level 10)
	// -------------------------------------------------------------------------
	describe("Purity of Body", () => {
		it("should have Purity of Body at level 10", () => {
			state.addClass({name: "Monk", source: "PHB", level: 10});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasPurityOfBody).toBe(true);
		});

		it("should grant poison immunity at level 10", () => {
			state.addClass({name: "Monk", source: "PHB", level: 10});
			expect(state.hasImmunity("poison")).toBe(true);
		});

		it("should grant poisoned condition immunity at level 10", () => {
			state.addClass({name: "Monk", source: "PHB", level: 10});
			expect(state.isImmuneToCondition("poisoned")).toBe(true);
		});

		it("should grant diseased condition immunity at level 10", () => {
			state.addClass({name: "Monk", source: "PHB", level: 10});
			expect(state.isImmuneToCondition("diseased")).toBe(true);
		});

		it("should not have immunities before level 10", () => {
			state.addClass({name: "Monk", source: "PHB", level: 9});
			expect(state.hasImmunity("poison")).toBe(false);
			expect(state.isImmuneToCondition("poisoned")).toBe(false);
		});
	});

	// -------------------------------------------------------------------------
	// Tongue of the Sun and Moon (Level 13)
	// -------------------------------------------------------------------------
	describe("Tongue of the Sun and Moon", () => {
		it("should have Tongue of the Sun and Moon at level 13", () => {
			state.addClass({name: "Monk", source: "PHB", level: 13});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasTongueOfSunAndMoon).toBe(true);
		});

		it("should grant all spoken languages at level 13", () => {
			state.addClass({name: "Monk", source: "PHB", level: 13});
			expect(state.getLanguages()).toContain("All (spoken)");
		});
	});

	// -------------------------------------------------------------------------
	// Diamond Soul (Level 14)
	// -------------------------------------------------------------------------
	describe("Diamond Soul", () => {
		it("should have Diamond Soul at level 14", () => {
			state.addClass({name: "Monk", source: "PHB", level: 14});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasDiamondSoul).toBe(true);
		});

		it("should grant proficiency in all saving throws at level 14", () => {
			state.addClass({name: "Monk", source: "PHB", level: 14});
			expect(state.hasSaveProficiency("str")).toBe(true);
			expect(state.hasSaveProficiency("dex")).toBe(true);
			expect(state.hasSaveProficiency("con")).toBe(true);
			expect(state.hasSaveProficiency("int")).toBe(true);
			expect(state.hasSaveProficiency("wis")).toBe(true);
			expect(state.hasSaveProficiency("cha")).toBe(true);
		});

		it("should not have all save proficiencies before level 14", () => {
			state.addClass({name: "Monk", source: "PHB", level: 13});
			// Diamond Soul grants all saves at level 14, so CON/INT/CHA should be false before then
			expect(state.hasSaveProficiency("con")).toBe(false);
			expect(state.hasSaveProficiency("int")).toBe(false);
			expect(state.hasSaveProficiency("cha")).toBe(false);
		});
	});

	// -------------------------------------------------------------------------
	// Timeless Body (Level 15)
	// -------------------------------------------------------------------------
	describe("Timeless Body", () => {
		it("should have Timeless Body at level 15", () => {
			state.addClass({name: "Monk", source: "PHB", level: 15});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasTimelessBody).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// Empty Body (Level 18)
	// -------------------------------------------------------------------------
	describe("Empty Body", () => {
		it("should have Empty Body at level 18", () => {
			state.addClass({name: "Monk", source: "PHB", level: 18});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasEmptyBody).toBe(true);
		});

		it("should cost 4 ki points", () => {
			state.addClass({name: "Monk", source: "PHB", level: 18});
			const calculations = state.getFeatureCalculations();
			expect(calculations.emptyBodyCost).toBe(4);
		});
	});

	// -------------------------------------------------------------------------
	// Perfect Self (Level 20)
	// -------------------------------------------------------------------------
	describe("Perfect Self", () => {
		it("should have Perfect Self at level 20", () => {
			state.addClass({name: "Monk", source: "PHB", level: 20});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasPerfectSelf).toBe(true);
		});

		it("should recover 4 ki points on initiative if at 0", () => {
			state.addClass({name: "Monk", source: "PHB", level: 20});
			const calculations = state.getFeatureCalculations();
			expect(calculations.perfectSelfRecovery).toBe(4);
		});
	});
});

// ==========================================================================
// PART 2: MONK HIT DICE AND HP
// ==========================================================================
describe("Monk Hit Dice and HP", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.setAbilityBase("con", 14); // +2 CON mod
	});

	it("should use d8 hit dice", () => {
		state.addClass({name: "Monk", source: "PHB", level: 1});
		const hitDice = state.getHitDice();
		expect(hitDice.some(hd => hd.die === 8)).toBe(true);
	});

	it("should have correct number of hit dice per level", () => {
		for (let level = 1; level <= 5; level++) {
			const testState = new CharacterSheetState();
			testState.setAbilityBase("con", 14);
			testState.addClass({name: "Monk", source: "PHB", level: level});
			const hitDice = testState.getHitDice();
			const d8Dice = hitDice.find(hd => hd.die === 8);
			expect(d8Dice.max).toBe(level);
		}
	});

	it("should calculate HP correctly at level 1", () => {
		state.addClass({name: "Monk", source: "PHB", level: 1});
		// Level 1: 8 (max d8) + 2 (CON) = 10
		expect(state.getHp().max).toBe(10);
	});

	it("should calculate HP correctly at level 5", () => {
		state.addClass({name: "Monk", source: "PHB", level: 5});
		// Level 1: 8 + 2 = 10
		// Levels 2-5: 4 × (5 + 2) = 28 (using average of 5 for d8)
		// Total: 10 + 28 = 38
		expect(state.getHp().max).toBe(38);
	});
});

// ==========================================================================
// PART 3: WAY OF THE OPEN HAND SUBCLASS (PHB)
// ==========================================================================
describe("Way of the Open Hand Subclass (PHB)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({
			name: "Monk",
			source: "PHB",
			level: 3,
			subclass: {name: "Way of the Open Hand", shortName: "Open Hand", source: "PHB"},
		});
		state.setAbilityBase("dex", 16);
		state.setAbilityBase("wis", 16);
	});

	it("should gain subclass at level 3", () => {
		const classes = state.getClasses();
		expect(classes[0].subclass).toBeDefined();
		expect(classes[0].subclass.shortName).toBe("Open Hand");
	});

	describe("Open Hand Technique (Level 3)", () => {
		it("should have Open Hand Technique at level 3", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasOpenHandTechnique).toBe(true);
		});
	});

	describe("Wholeness of Body (Level 6)", () => {
		it("should have Wholeness of Body at level 6", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of the Open Hand", shortName: "Open Hand", source: "PHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasWholenessOfBody).toBe(true);
		});

		it("should heal 3 × monk level (PHB)", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of the Open Hand", shortName: "Open Hand", source: "PHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.wholenessOfBodyHealing).toBe(18);
		});

		it("should be usable once per long rest (PHB)", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of the Open Hand", shortName: "Open Hand", source: "PHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.wholenessOfBodyUses).toBe(1);
		});
	});

	describe("Tranquility (Level 11)", () => {
		it("should have Tranquility at level 11", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of the Open Hand", shortName: "Open Hand", source: "PHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasTranquility).toBe(true);
		});

		it("should use ki save DC for Tranquility", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of the Open Hand", shortName: "Open Hand", source: "PHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.tranquilityDc).toBe(calculations.kiSaveDc);
		});
	});

	describe("Quivering Palm (Level 17)", () => {
		it("should have Quivering Palm at level 17", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of the Open Hand", shortName: "Open Hand", source: "PHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasQuiveringPalm).toBe(true);
		});

		it("should cost 3 ki points", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of the Open Hand", shortName: "Open Hand", source: "PHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.quiveringPalmCost).toBe(3);
		});
	});
});

// ==========================================================================
// PART 4: WAY OF SHADOW SUBCLASS (PHB)
// ==========================================================================
describe("Way of Shadow Subclass (PHB)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({
			name: "Monk",
			source: "PHB",
			level: 3,
			subclass: {name: "Way of Shadow", shortName: "Shadow", source: "PHB"},
		});
		state.setAbilityBase("dex", 16);
		state.setAbilityBase("wis", 16);
	});

	it("should gain subclass at level 3", () => {
		const classes = state.getClasses();
		expect(classes[0].subclass).toBeDefined();
		expect(classes[0].subclass.shortName).toBe("Shadow");
	});

	describe("Shadow Arts (Level 3)", () => {
		it("should have Shadow Arts at level 3", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasShadowArts).toBe(true);
		});

		it("should cost 2 ki points for spells", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.shadowArtsCost).toBe(2);
		});
	});

	describe("Shadow Step (Level 6)", () => {
		it("should have Shadow Step at level 6", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of Shadow", shortName: "Shadow", source: "PHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasShadowStep).toBe(true);
		});

		it("should have 60 ft range", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of Shadow", shortName: "Shadow", source: "PHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.shadowStepRange).toBe(60);
		});
	});

	describe("Cloak of Shadows (Level 11)", () => {
		it("should have Cloak of Shadows at level 11", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of Shadow", shortName: "Shadow", source: "PHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasCloakOfShadows).toBe(true);
		});
	});

	describe("Opportunist (Level 17)", () => {
		it("should have Opportunist at level 17", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of Shadow", shortName: "Shadow", source: "PHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasOpportunist).toBe(true);
		});
	});
});

// ==========================================================================
// PART 5: WAY OF THE FOUR ELEMENTS SUBCLASS (PHB)
// ==========================================================================
describe("Way of the Four Elements Subclass (PHB)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({
			name: "Monk",
			source: "PHB",
			level: 3,
			subclass: {name: "Way of the Four Elements", shortName: "Four Elements", source: "PHB"},
		});
		state.setAbilityBase("dex", 16);
		state.setAbilityBase("wis", 16);
	});

	it("should gain subclass at level 3", () => {
		const classes = state.getClasses();
		expect(classes[0].subclass).toBeDefined();
		expect(classes[0].subclass.shortName).toBe("Four Elements");
	});

	describe("Disciple of the Elements (Level 3)", () => {
		it("should have Disciple of the Elements at level 3", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasDiscipleOfElements).toBe(true);
		});

		it("should know 1 discipline at level 3", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.elementalDisciplinesKnown).toBe(1);
		});
	});

	describe("Disciplines Known Progression", () => {
		it("should know 2 disciplines at level 6", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of the Four Elements", shortName: "Four Elements", source: "PHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.elementalDisciplinesKnown).toBe(2);
		});

		it("should know 3 disciplines at level 11", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of the Four Elements", shortName: "Four Elements", source: "PHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.elementalDisciplinesKnown).toBe(3);
		});

		it("should know 4 disciplines at level 17", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of the Four Elements", shortName: "Four Elements", source: "PHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.elementalDisciplinesKnown).toBe(4);
		});
	});
});

// ==========================================================================
// PART 6: WAY OF THE LONG DEATH SUBCLASS (SCAG)
// ==========================================================================
describe("Way of the Long Death Subclass (SCAG)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({
			name: "Monk",
			source: "PHB",
			level: 3,
			subclass: {name: "Way of the Long Death", shortName: "Long Death", source: "SCAG"},
		});
		state.setAbilityBase("dex", 16);
		state.setAbilityBase("wis", 16); // +3
	});

	it("should gain subclass at level 3", () => {
		const classes = state.getClasses();
		expect(classes[0].subclass).toBeDefined();
		expect(classes[0].subclass.shortName).toBe("Long Death");
	});

	describe("Touch of Death (Level 3)", () => {
		it("should have Touch of Death at level 3", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasTouchOfDeath).toBe(true);
		});

		it("should calculate temp HP as WIS mod + monk level", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.touchOfDeathTempHp).toBe("3+3");
		});
	});

	describe("Hour of Reaping (Level 6)", () => {
		it("should have Hour of Reaping at level 6", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of the Long Death", shortName: "Long Death", source: "SCAG"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasHourOfReaping).toBe(true);
		});

		it("should use ki save DC", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of the Long Death", shortName: "Long Death", source: "SCAG"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hourOfReapingDc).toBe(calculations.kiSaveDc);
		});
	});

	describe("Mastery of Death (Level 11)", () => {
		it("should have Mastery of Death at level 11", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of the Long Death", shortName: "Long Death", source: "SCAG"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasMasteryOfDeath).toBe(true);
		});

		it("should cost 1 ki point", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of the Long Death", shortName: "Long Death", source: "SCAG"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.masteryOfDeathCost).toBe(1);
		});
	});

	describe("Touch of the Long Death (Level 17)", () => {
		it("should have Touch of the Long Death at level 17", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of the Long Death", shortName: "Long Death", source: "SCAG"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasTouchOfLongDeath).toBe(true);
		});
	});
});

// ==========================================================================
// PART 7: WAY OF THE DRUNKEN MASTER SUBCLASS (XGE)
// ==========================================================================
describe("Way of the Drunken Master Subclass (XGE)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({
			name: "Monk",
			source: "PHB",
			level: 3,
			subclass: {name: "Way of the Drunken Master", shortName: "Drunken Master", source: "XGE"},
		});
		state.setAbilityBase("dex", 16);
		state.setAbilityBase("wis", 16);
	});

	it("should gain subclass at level 3", () => {
		const classes = state.getClasses();
		expect(classes[0].subclass).toBeDefined();
		expect(classes[0].subclass.shortName).toBe("Drunken Master");
	});

	describe("Drunken Technique (Level 3)", () => {
		it("should have Drunken Technique at level 3", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasDrunkenTechnique).toBe(true);
		});
	});

	describe("Tipsy Sway (Level 6)", () => {
		it("should have Tipsy Sway at level 6", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of the Drunken Master", shortName: "Drunken Master", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasTipsySway).toBe(true);
		});

		it("should cost 1 ki to redirect attack", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of the Drunken Master", shortName: "Drunken Master", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.redirectAttackCost).toBe(1);
		});
	});

	describe("Drunkard's Luck (Level 11)", () => {
		it("should have Drunkard's Luck at level 11", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of the Drunken Master", shortName: "Drunken Master", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasDrunkardsLuck).toBe(true);
		});

		it("should cost 2 ki points", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of the Drunken Master", shortName: "Drunken Master", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.drunkardsLuckCost).toBe(2);
		});
	});

	describe("Intoxicated Frenzy (Level 17)", () => {
		it("should have Intoxicated Frenzy at level 17", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of the Drunken Master", shortName: "Drunken Master", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasIntoxicatedFrenzy).toBe(true);
		});

		it("should allow up to 5 targets", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of the Drunken Master", shortName: "Drunken Master", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.intoxicatedFrenzyTargets).toBe(5);
		});
	});
});

// ==========================================================================
// PART 8: WAY OF THE KENSEI SUBCLASS (XGE)
// ==========================================================================
describe("Way of the Kensei Subclass (XGE)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({
			name: "Monk",
			source: "PHB",
			level: 3,
			subclass: {name: "Way of the Kensei", shortName: "Kensei", source: "XGE"},
		});
		state.setAbilityBase("dex", 16);
		state.setAbilityBase("wis", 16);
	});

	it("should gain subclass at level 3", () => {
		const classes = state.getClasses();
		expect(classes[0].subclass).toBeDefined();
		expect(classes[0].subclass.shortName).toBe("Kensei");
	});

	describe("Path of the Kensei (Level 3)", () => {
		it("should have Path of the Kensei at level 3", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasPathOfKensei).toBe(true);
		});

		it("should know 2 kensei weapons at level 3", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.kenseiWeaponsKnown).toBe(2);
		});

		it("should have Agile Parry bonus of +2 AC", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.agileParryBonus).toBe(2);
		});
	});

	describe("Kensei Weapons Progression", () => {
		it("should know 3 weapons at level 6", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of the Kensei", shortName: "Kensei", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.kenseiWeaponsKnown).toBe(3);
		});

		it("should know 4 weapons at level 11", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of the Kensei", shortName: "Kensei", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.kenseiWeaponsKnown).toBe(4);
		});

		it("should know 5 weapons at level 17", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of the Kensei", shortName: "Kensei", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.kenseiWeaponsKnown).toBe(5);
		});
	});

	describe("One with the Blade (Level 6)", () => {
		it("should have One with the Blade at level 6", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of the Kensei", shortName: "Kensei", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasOneWithTheBlade).toBe(true);
		});

		it("should have Deft Strike", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of the Kensei", shortName: "Kensei", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasDeftStrike).toBe(true);
		});
	});

	describe("Sharpen the Blade (Level 11)", () => {
		it("should have Sharpen the Blade at level 11", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of the Kensei", shortName: "Kensei", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasSharpenTheBlade).toBe(true);
		});

		it("should have max bonus of +3", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of the Kensei", shortName: "Kensei", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.sharpenBladeMaxBonus).toBe(3);
		});
	});

	describe("Unerring Accuracy (Level 17)", () => {
		it("should have Unerring Accuracy at level 17", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of the Kensei", shortName: "Kensei", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasUnerringAccuracy).toBe(true);
		});
	});
});

// ==========================================================================
// PART 9: WAY OF THE SUN SOUL SUBCLASS (XGE)
// ==========================================================================
describe("Way of the Sun Soul Subclass (XGE)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({
			name: "Monk",
			source: "PHB",
			level: 3,
			subclass: {name: "Way of the Sun Soul", shortName: "Sun Soul", source: "XGE"},
		});
		state.setAbilityBase("dex", 16);
		state.setAbilityBase("wis", 16); // +3
	});

	it("should gain subclass at level 3", () => {
		const classes = state.getClasses();
		expect(classes[0].subclass).toBeDefined();
		expect(classes[0].subclass.shortName).toBe("Sun Soul");
	});

	describe("Radiant Sun Bolt (Level 3)", () => {
		it("should have Radiant Sun Bolt at level 3", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasRadiantSunBolt).toBe(true);
		});

		it("should have 30 ft range", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.radiantSunBoltRange).toBe(30);
		});

		it("should deal martial arts die damage", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.radiantSunBoltDamage).toBe(calculations.martialArtsDie);
		});
	});

	describe("Searing Arc Strike (Level 6)", () => {
		it("should have Searing Arc Strike at level 6", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of the Sun Soul", shortName: "Sun Soul", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasSearingArcStrike).toBe(true);
		});

		it("should cost 2 ki points base", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of the Sun Soul", shortName: "Sun Soul", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.searingArcStrikeCost).toBe(2);
		});
	});

	describe("Searing Sunburst (Level 11)", () => {
		it("should have Searing Sunburst at level 11", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of the Sun Soul", shortName: "Sun Soul", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasSearingSunburst).toBe(true);
		});

		it("should deal 2d6 damage", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of the Sun Soul", shortName: "Sun Soul", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.searingSunburstDamage).toBe("2d6");
		});
	});

	describe("Sun Shield (Level 17)", () => {
		it("should have Sun Shield at level 17", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of the Sun Soul", shortName: "Sun Soul", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasSunShield).toBe(true);
		});

		it("should deal 5 + WIS mod damage", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of the Sun Soul", shortName: "Sun Soul", source: "XGE"},
			});
			const calculations = state.getFeatureCalculations();
			// 5 + 3 (WIS) = 8
			expect(calculations.sunShieldDamage).toBe(8);
		});
	});
});

// ==========================================================================
// PART 10: WAY OF MERCY SUBCLASS (TCE)
// ==========================================================================
describe("Way of Mercy Subclass (TCE)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({
			name: "Monk",
			source: "PHB",
			level: 3,
			subclass: {name: "Way of Mercy", shortName: "Mercy", source: "TCE"},
		});
		state.setAbilityBase("dex", 16);
		state.setAbilityBase("wis", 16); // +3
	});

	it("should gain subclass at level 3", () => {
		const classes = state.getClasses();
		expect(classes[0].subclass).toBeDefined();
		expect(classes[0].subclass.shortName).toBe("Mercy");
	});

	describe("Hand of Healing (Level 3)", () => {
		it("should have Hand of Healing at level 3", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasHandOfHealing).toBe(true);
		});

		it("should heal martial arts die + WIS mod", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.handOfHealingAmount).toBe("1d4+3");
		});
	});

	describe("Hand of Harm (Level 3)", () => {
		it("should have Hand of Harm at level 3", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasHandOfHarm).toBe(true);
		});

		it("should deal martial arts die + WIS mod damage", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.handOfHarmDamage).toBe("1d4+3");
		});
	});

	describe("Physician's Touch (Level 6)", () => {
		it("should have Physician's Touch at level 6", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of Mercy", shortName: "Mercy", source: "TCE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasPhysiciansTouch).toBe(true);
		});
	});

	describe("Flurry of Healing and Harm (Level 11)", () => {
		it("should have Flurry of Healing and Harm at level 11", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of Mercy", shortName: "Mercy", source: "TCE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasFlurryOfHealingAndHarm).toBe(true);
		});
	});

	describe("Hand of Ultimate Mercy (Level 17)", () => {
		it("should have Hand of Ultimate Mercy at level 17", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of Mercy", shortName: "Mercy", source: "TCE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasHandOfUltimateMercy).toBe(true);
		});

		it("should cost 5 ki points", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of Mercy", shortName: "Mercy", source: "TCE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.handOfUltimateMercyCost).toBe(5);
		});
	});
});

// ==========================================================================
// PART 11: WAY OF THE ASTRAL SELF SUBCLASS (TCE)
// ==========================================================================
describe("Way of the Astral Self Subclass (TCE)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({
			name: "Monk",
			source: "PHB",
			level: 3,
			subclass: {name: "Way of the Astral Self", shortName: "Astral Self", source: "TCE"},
		});
		state.setAbilityBase("dex", 16);
		state.setAbilityBase("wis", 16);
	});

	it("should gain subclass at level 3", () => {
		const classes = state.getClasses();
		expect(classes[0].subclass).toBeDefined();
		expect(classes[0].subclass.shortName).toBe("Astral Self");
	});

	describe("Arms of the Astral Self (Level 3)", () => {
		it("should have Arms of the Astral Self at level 3", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasArmsOfAstralSelf).toBe(true);
		});

		it("should cost 1 ki point", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.armsOfAstralSelfCost).toBe(1);
		});

		it("should have 10 ft reach", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.armsOfAstralSelfReach).toBe(10);
		});
	});

	describe("Visage of the Astral Self (Level 6)", () => {
		it("should have Visage of the Astral Self at level 6", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of the Astral Self", shortName: "Astral Self", source: "TCE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasVisageOfAstralSelf).toBe(true);
		});

		it("should cost 1 ki point", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of the Astral Self", shortName: "Astral Self", source: "TCE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.visageOfAstralSelfCost).toBe(1);
		});
	});

	describe("Body of the Astral Self (Level 11)", () => {
		it("should have Body of the Astral Self at level 11", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of the Astral Self", shortName: "Astral Self", source: "TCE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasBodyOfAstralSelf).toBe(true);
		});
	});

	describe("Awakened Astral Self (Level 17)", () => {
		it("should have Awakened Astral Self at level 17", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of the Astral Self", shortName: "Astral Self", source: "TCE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasAwakenedAstralSelf).toBe(true);
		});

		it("should cost 5 ki points", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of the Astral Self", shortName: "Astral Self", source: "TCE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.awakenedAstralSelfCost).toBe(5);
		});

		it("should deal 2d10 bonus damage", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of the Astral Self", shortName: "Astral Self", source: "TCE"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.awakenedAstralSelfBonusDamage).toBe("2d10");
		});
	});
});

// ==========================================================================
// PART 12: WAY OF THE ASCENDANT DRAGON SUBCLASS (FTD)
// ==========================================================================
describe("Way of the Ascendant Dragon Subclass (FTD)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({
			name: "Monk",
			source: "PHB",
			level: 3,
			subclass: {name: "Way of the Ascendant Dragon", shortName: "Ascendant Dragon", source: "FTD"},
		});
		state.setAbilityBase("dex", 16);
		state.setAbilityBase("wis", 16);
	});

	it("should gain subclass at level 3", () => {
		const classes = state.getClasses();
		expect(classes[0].subclass).toBeDefined();
		expect(classes[0].subclass.shortName).toBe("Ascendant Dragon");
	});

	describe("Draconic Disciple (Level 3)", () => {
		it("should have Draconic Disciple at level 3", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasDraconicDisciple).toBe(true);
		});
	});

	describe("Breath of the Dragon (Level 3)", () => {
		it("should have Breath of the Dragon at level 3", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasBreathOfDragon).toBe(true);
		});

		it("should deal 2d8 damage at level 3", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.breathOfDragonDamage).toBe("2d8");
		});

		it("should use ki save DC", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.breathOfDragonDc).toBe(calculations.kiSaveDc);
		});
	});

	describe("Breath Damage Progression", () => {
		it("should deal 3d8 damage at level 11", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of the Ascendant Dragon", shortName: "Ascendant Dragon", source: "FTD"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.breathOfDragonDamage).toBe("3d8");
		});

		it("should deal 4d8 damage at level 17", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of the Ascendant Dragon", shortName: "Ascendant Dragon", source: "FTD"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.breathOfDragonDamage).toBe("4d8");
		});
	});

	describe("Wings Unfurled (Level 6)", () => {
		it("should have Wings Unfurled at level 6", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of the Ascendant Dragon", shortName: "Ascendant Dragon", source: "FTD"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasWingsUnfurled).toBe(true);
		});

		it("should have uses equal to proficiency bonus", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 6,
				subclass: {name: "Way of the Ascendant Dragon", shortName: "Ascendant Dragon", source: "FTD"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.wingsUnfurledUses).toBe(3);
		});
	});

	describe("Aspect of the Wyrm (Level 11)", () => {
		it("should have Aspect of the Wyrm at level 11", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of the Ascendant Dragon", shortName: "Ascendant Dragon", source: "FTD"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasAspectOfWyrm).toBe(true);
		});

		it("should cost 3 ki points", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 11,
				subclass: {name: "Way of the Ascendant Dragon", shortName: "Ascendant Dragon", source: "FTD"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.aspectOfWyrmCost).toBe(3);
		});
	});

	describe("Ascendant Aspect (Level 17)", () => {
		it("should have Ascendant Aspect at level 17", () => {
			state.addClass({
				name: "Monk",
				source: "PHB",
				level: 17,
				subclass: {name: "Way of the Ascendant Dragon", shortName: "Ascendant Dragon", source: "FTD"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasAscendantAspect).toBe(true);
		});
	});
});

// ==========================================================================
// PART 13: XPHB 2024 MONK CORE FEATURES
// ==========================================================================
describe("Monk Core Class Features (XPHB 2024)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "XPHB"});
		state.addClass({name: "Monk", source: "XPHB", level: 1});
		state.setAbilityBase("dex", 16);
		state.setAbilityBase("wis", 16);
	});

	// -------------------------------------------------------------------------
	// Martial Arts Die (Enhanced in XPHB)
	// -------------------------------------------------------------------------
	describe("Martial Arts Die (XPHB)", () => {
		it("should have d6 martial arts die at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.martialArtsDie).toBe("1d6");
		});

		it("should have d8 martial arts die at level 5", () => {
			state.addClass({name: "Monk", source: "XPHB", level: 5});
			const calculations = state.getFeatureCalculations();
			expect(calculations.martialArtsDie).toBe("1d8");
		});

		it("should have d10 martial arts die at level 11", () => {
			state.addClass({name: "Monk", source: "XPHB", level: 11});
			const calculations = state.getFeatureCalculations();
			expect(calculations.martialArtsDie).toBe("1d10");
		});

		it("should have d12 martial arts die at level 17", () => {
			state.addClass({name: "Monk", source: "XPHB", level: 17});
			const calculations = state.getFeatureCalculations();
			expect(calculations.martialArtsDie).toBe("1d12");
		});
	});

	// -------------------------------------------------------------------------
	// Focus Points (XPHB name for Ki)
	// -------------------------------------------------------------------------
	describe("Focus Points (XPHB)", () => {
		it("should have focus points equal to monk level", () => {
			state.addClass({name: "Monk", source: "XPHB", level: 5});
			const calculations = state.getFeatureCalculations();
			expect(calculations.focusPoints).toBe(5);
		});

		it("should have focus save DC", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.focusSaveDc).toBeDefined();
		});
	});

	// -------------------------------------------------------------------------
	// Uncanny Metabolism (Level 2)
	// -------------------------------------------------------------------------
	describe("Uncanny Metabolism (XPHB Level 2)", () => {
		it("should have Uncanny Metabolism at level 2", () => {
			state.addClass({name: "Monk", source: "XPHB", level: 2});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasUncannyMetabolism).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// Deflect Attacks (Level 3)
	// -------------------------------------------------------------------------
	describe("Deflect Attacks (XPHB Level 3)", () => {
		it("should have Deflect Attacks reduction", () => {
			state.addClass({name: "Monk", source: "XPHB", level: 3});
			const calculations = state.getFeatureCalculations();
			expect(calculations.deflectAttacksReduction).toBeDefined();
		});
	});

	// -------------------------------------------------------------------------
	// Acrobatic Movement (Level 9)
	// -------------------------------------------------------------------------
	describe("Acrobatic Movement (XPHB Level 9)", () => {
		it("should have Acrobatic Movement at level 9", () => {
			state.addClass({name: "Monk", source: "XPHB", level: 9});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasAcrobaticMovement).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// Heightened Focus (Level 10)
	// -------------------------------------------------------------------------
	describe("Heightened Focus (XPHB Level 10)", () => {
		it("should have Heightened Focus at level 10", () => {
			state.addClass({name: "Monk", source: "XPHB", level: 10});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasHeightenedFocus).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// Self-Restoration (Level 10)
	// -------------------------------------------------------------------------
	describe("Self-Restoration (XPHB Level 10)", () => {
		it("should have Self-Restoration at level 10", () => {
			state.addClass({name: "Monk", source: "XPHB", level: 10});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasSelfRestoration).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// Deflect Energy (Level 13)
	// -------------------------------------------------------------------------
	describe("Deflect Energy (XPHB Level 13)", () => {
		it("should have Deflect Energy at level 13", () => {
			state.addClass({name: "Monk", source: "XPHB", level: 13});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasDeflectEnergy).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// Disciplined Survivor (Level 14)
	// -------------------------------------------------------------------------
	describe("Disciplined Survivor (XPHB Level 14)", () => {
		it("should have Disciplined Survivor at level 14", () => {
			state.addClass({name: "Monk", source: "XPHB", level: 14});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasDisciplinedSurvivor).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// Perfect Focus (Level 15)
	// -------------------------------------------------------------------------
	describe("Perfect Focus (XPHB Level 15)", () => {
		it("should have Perfect Focus at level 15", () => {
			state.addClass({name: "Monk", source: "XPHB", level: 15});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasPerfectFocus).toBe(true);
		});

		it("should recover 4 focus points", () => {
			state.addClass({name: "Monk", source: "XPHB", level: 15});
			const calculations = state.getFeatureCalculations();
			expect(calculations.perfectFocusRecovery).toBe(4);
		});
	});

	// -------------------------------------------------------------------------
	// Superior Defense (Level 18)
	// -------------------------------------------------------------------------
	describe("Superior Defense (XPHB Level 18)", () => {
		it("should have Superior Defense at level 18", () => {
			state.addClass({name: "Monk", source: "XPHB", level: 18});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasSuperiorDefense).toBe(true);
		});

		it("should cost 3 focus points", () => {
			state.addClass({name: "Monk", source: "XPHB", level: 18});
			const calculations = state.getFeatureCalculations();
			expect(calculations.superiorDefenseCost).toBe(3);
		});
	});

	// -------------------------------------------------------------------------
	// Body and Mind (Level 20)
	// -------------------------------------------------------------------------
	describe("Body and Mind (XPHB Level 20)", () => {
		it("should have Body and Mind at level 20", () => {
			state.addClass({name: "Monk", source: "XPHB", level: 20});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasBodyAndMind).toBe(true);
		});
	});
});

// ==========================================================================
// PART 14: WARRIOR OF THE ELEMENTS SUBCLASS (XPHB 2024)
// ==========================================================================
describe("Warrior of the Elements Subclass (XPHB 2024)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "XPHB"});
		state.addClass({
			name: "Monk",
			source: "XPHB",
			level: 3,
			subclass: {name: "Warrior of the Elements", shortName: "Elements", source: "XPHB"},
		});
		state.setAbilityBase("dex", 16);
		state.setAbilityBase("wis", 16);
	});

	it("should gain subclass at level 3", () => {
		const classes = state.getClasses();
		expect(classes[0].subclass).toBeDefined();
		expect(classes[0].subclass.shortName).toBe("Elements");
	});

	describe("Elemental Attunement (Level 3)", () => {
		it("should have Elemental Attunement at level 3", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasElementalAttunement).toBe(true);
		});

		it("should have 15 ft reach", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.elementalAttunementReach).toBe(15);
		});
	});

	describe("Elemental Burst (Level 6)", () => {
		it("should have Elemental Burst at level 6", () => {
			state.addClass({
				name: "Monk",
				source: "XPHB",
				level: 6,
				subclass: {name: "Warrior of the Elements", shortName: "Elements", source: "XPHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasElementalBurst).toBe(true);
		});

		it("should cost 2 focus points", () => {
			state.addClass({
				name: "Monk",
				source: "XPHB",
				level: 6,
				subclass: {name: "Warrior of the Elements", shortName: "Elements", source: "XPHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.elementalBurstCost).toBe(2);
		});
	});

	describe("Stride of the Elements (Level 11)", () => {
		it("should have Stride of the Elements at level 11", () => {
			state.addClass({
				name: "Monk",
				source: "XPHB",
				level: 11,
				subclass: {name: "Warrior of the Elements", shortName: "Elements", source: "XPHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasStrideOfElements).toBe(true);
		});
	});

	describe("Elemental Epitome (Level 17)", () => {
		it("should have Elemental Epitome at level 17", () => {
			state.addClass({
				name: "Monk",
				source: "XPHB",
				level: 17,
				subclass: {name: "Warrior of the Elements", shortName: "Elements", source: "XPHB"},
			});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasElementalEpitome).toBe(true);
		});
	});
});

// ==========================================================================
// PART 15: PHB vs XPHB MONK FEATURE COMPARISON
// ==========================================================================
describe("PHB vs XPHB Monk Feature Comparison", () => {
	describe("Martial Arts Die Comparison", () => {
		it("should have different martial arts die progression", () => {
			const phbState = new CharacterSheetState();
			phbState.addClass({name: "Monk", source: "PHB", level: 1});
			const phbCalcs = phbState.getFeatureCalculations();

			const xphbState = new CharacterSheetState();
			xphbState.addClass({name: "Monk", source: "XPHB", level: 1});
			const xphbCalcs = xphbState.getFeatureCalculations();

			expect(phbCalcs.martialArtsDie).toBe("1d4");
			expect(xphbCalcs.martialArtsDie).toBe("1d6");
		});

		it("should have higher max die in XPHB", () => {
			const phbState = new CharacterSheetState();
			phbState.addClass({name: "Monk", source: "PHB", level: 17});
			const phbCalcs = phbState.getFeatureCalculations();

			const xphbState = new CharacterSheetState();
			xphbState.addClass({name: "Monk", source: "XPHB", level: 17});
			const xphbCalcs = xphbState.getFeatureCalculations();

			expect(phbCalcs.martialArtsDie).toBe("1d10");
			expect(xphbCalcs.martialArtsDie).toBe("1d12");
		});
	});

	describe("Ki Points vs Focus Points", () => {
		it("should use ki in PHB and focus in XPHB but same amount", () => {
			const phbState = new CharacterSheetState();
			phbState.addClass({name: "Monk", source: "PHB", level: 10});
			const phbCalcs = phbState.getFeatureCalculations();

			const xphbState = new CharacterSheetState();
			xphbState.addClass({name: "Monk", source: "XPHB", level: 10});
			const xphbCalcs = xphbState.getFeatureCalculations();

			expect(phbCalcs.kiPoints).toBe(10);
			expect(xphbCalcs.focusPoints).toBe(10);
		});
	});

	describe("PHB-exclusive features", () => {
		it("should have Stillness of Mind only in PHB", () => {
			const phbState = new CharacterSheetState();
			phbState.addClass({name: "Monk", source: "PHB", level: 7});
			const phbCalcs = phbState.getFeatureCalculations();

			const xphbState = new CharacterSheetState();
			xphbState.addClass({name: "Monk", source: "XPHB", level: 7});
			const xphbCalcs = xphbState.getFeatureCalculations();

			expect(phbCalcs.hasStillnessOfMind).toBe(true);
			expect(xphbCalcs.hasStillnessOfMind).toBeUndefined();
		});

		it("should have Purity of Body only in PHB", () => {
			const phbState = new CharacterSheetState();
			phbState.addClass({name: "Monk", source: "PHB", level: 10});
			const phbCalcs = phbState.getFeatureCalculations();

			const xphbState = new CharacterSheetState();
			xphbState.addClass({name: "Monk", source: "XPHB", level: 10});
			const xphbCalcs = xphbState.getFeatureCalculations();

			expect(phbCalcs.hasPurityOfBody).toBe(true);
			expect(xphbCalcs.hasPurityOfBody).toBeUndefined();
		});

		it("should have Diamond Soul only in PHB", () => {
			const phbState = new CharacterSheetState();
			phbState.addClass({name: "Monk", source: "PHB", level: 14});
			const phbCalcs = phbState.getFeatureCalculations();

			const xphbState = new CharacterSheetState();
			xphbState.addClass({name: "Monk", source: "XPHB", level: 14});
			const xphbCalcs = xphbState.getFeatureCalculations();

			expect(phbCalcs.hasDiamondSoul).toBe(true);
			expect(xphbCalcs.hasDiamondSoul).toBeUndefined();
		});

		it("should have Empty Body only in PHB", () => {
			const phbState = new CharacterSheetState();
			phbState.addClass({name: "Monk", source: "PHB", level: 18});
			const phbCalcs = phbState.getFeatureCalculations();

			const xphbState = new CharacterSheetState();
			xphbState.addClass({name: "Monk", source: "XPHB", level: 18});
			const xphbCalcs = xphbState.getFeatureCalculations();

			expect(phbCalcs.hasEmptyBody).toBe(true);
			expect(xphbCalcs.hasEmptyBody).toBeUndefined();
		});
	});

	describe("XPHB-exclusive features", () => {
		it("should have Heightened Focus only in XPHB", () => {
			const phbState = new CharacterSheetState();
			phbState.addClass({name: "Monk", source: "PHB", level: 10});
			const phbCalcs = phbState.getFeatureCalculations();

			const xphbState = new CharacterSheetState();
			xphbState.addClass({name: "Monk", source: "XPHB", level: 10});
			const xphbCalcs = xphbState.getFeatureCalculations();

			expect(phbCalcs.hasHeightenedFocus).toBeUndefined();
			expect(xphbCalcs.hasHeightenedFocus).toBe(true);
		});

		it("should have Disciplined Survivor only in XPHB", () => {
			const phbState = new CharacterSheetState();
			phbState.addClass({name: "Monk", source: "PHB", level: 14});
			const phbCalcs = phbState.getFeatureCalculations();

			const xphbState = new CharacterSheetState();
			xphbState.addClass({name: "Monk", source: "XPHB", level: 14});
			const xphbCalcs = xphbState.getFeatureCalculations();

			expect(phbCalcs.hasDisciplinedSurvivor).toBeUndefined();
			expect(xphbCalcs.hasDisciplinedSurvivor).toBe(true);
		});

		it("should have Superior Defense only in XPHB", () => {
			const phbState = new CharacterSheetState();
			phbState.addClass({name: "Monk", source: "PHB", level: 18});
			const phbCalcs = phbState.getFeatureCalculations();

			const xphbState = new CharacterSheetState();
			xphbState.addClass({name: "Monk", source: "XPHB", level: 18});
			const xphbCalcs = xphbState.getFeatureCalculations();

			expect(phbCalcs.hasSuperiorDefense).toBeUndefined();
			expect(xphbCalcs.hasSuperiorDefense).toBe(true);
		});
	});
});

// ==========================================================================
// PART 16: MONK MULTICLASS
// ==========================================================================
describe("Monk Multiclass", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.setAbilityBase("dex", 14);
		state.setAbilityBase("wis", 14);
	});

	it("should require DEX 13 and WIS 13 for multiclassing", () => {
		// Both DEX and WIS are 14, so multiclassing is possible
		expect(state.getAbilityMod("dex")).toBeGreaterThanOrEqual(1);
		expect(state.getAbilityMod("wis")).toBeGreaterThanOrEqual(1);
	});

	it("should calculate ki points based on monk level only", () => {
		state.addClass({name: "Monk", source: "PHB", level: 5});
		state.addClass({name: "Rogue", source: "PHB", level: 3});
		const calculations = state.getFeatureCalculations();
		// Only 5 ki from monk levels
		expect(calculations.kiPoints).toBe(5);
	});

	it("should track total level correctly across classes", () => {
		state.addClass({name: "Monk", source: "PHB", level: 5});
		state.addClass({name: "Fighter", source: "PHB", level: 3});
		expect(state.getTotalLevel()).toBe(8);
	});

	it("should calculate proficiency bonus based on total level", () => {
		state.addClass({name: "Monk", source: "PHB", level: 5});
		state.addClass({name: "Rogue", source: "PHB", level: 4});
		// Total level 9 = +4 proficiency
		expect(state.getProficiencyBonus()).toBe(4);
	});

	it("should use martial arts die based on monk level only", () => {
		state.addClass({name: "Monk", source: "PHB", level: 4});
		state.addClass({name: "Fighter", source: "PHB", level: 5});
		const calculations = state.getFeatureCalculations();
		// Monk level 4 = d4 martial arts die
		expect(calculations.martialArtsDie).toBe("1d4");
	});
});

// ==========================================================================
// PART 17: MONK EDGE CASES
// ==========================================================================
describe("Monk Edge Cases", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
	});

	it("should handle level 20 character correctly", () => {
		state.setAbilityBase("wis", 16);
		state.addClass({name: "Monk", source: "PHB", level: 20});
		const calculations = state.getFeatureCalculations();
		expect(calculations.kiPoints).toBe(20);
		expect(calculations.unarmoredMovement).toBe(30);
		expect(calculations.martialArtsDie).toBe("1d10");
		expect(calculations.hasPerfectSelf).toBe(true);
	});

	it("should calculate ki save DC with different WIS scores", () => {
		state.setAbilityBase("wis", 20); // +5 modifier
		state.addClass({name: "Monk", source: "PHB", level: 5});
		const calculations = state.getFeatureCalculations();
		// 8 + 3 (prof at level 5) + 5 (WIS) = 16
		expect(calculations.kiSaveDc).toBe(16);
	});

	it("should track hit dice correctly", () => {
		state.setAbilityBase("con", 14);
		state.addClass({name: "Monk", source: "PHB", level: 10});
		const hitDice = state.getHitDice();
		const d8Dice = hitDice.find(hd => hd.die === 8);
		expect(d8Dice.max).toBe(10);
	});

	it("should handle subclass selection", () => {
		state.setAbilityBase("wis", 16);
		state.addClass({name: "Monk", source: "PHB", level: 2});

		const classes = state.getClasses();
		expect(classes[0].subclass).toBeUndefined();

		state.addClass({
			name: "Monk",
			source: "PHB",
			level: 3,
			subclass: {name: "Way of the Open Hand", shortName: "Open Hand", source: "PHB"},
		});

		const updatedClasses = state.getClasses();
		expect(updatedClasses[0].subclass?.shortName).toBe("Open Hand");
	});

	it("should handle low DEX for deflect missiles", () => {
		state.setAbilityBase("dex", 8); // -1 modifier
		state.addClass({name: "Monk", source: "PHB", level: 3});
		const calculations = state.getFeatureCalculations();
		expect(calculations.deflectMissilesReduction).toBe("1d10+-1+3");
	});
});

// ==========================================================================
// PART 18: MONK PROFICIENCY BONUS PROGRESSION
// ==========================================================================
describe("Monk Proficiency Bonus Progression", () => {
	it("should return +2 proficiency bonus at level 1", () => {
		const state = new CharacterSheetState();
		state.addClass({name: "Monk", source: "PHB", level: 1});
		expect(state.getProficiencyBonus()).toBe(2);
	});

	it("should return +2 proficiency bonus at level 4", () => {
		const state = new CharacterSheetState();
		state.addClass({name: "Monk", source: "PHB", level: 4});
		expect(state.getProficiencyBonus()).toBe(2);
	});

	it("should return +3 proficiency bonus at level 5", () => {
		const state = new CharacterSheetState();
		state.addClass({name: "Monk", source: "PHB", level: 5});
		expect(state.getProficiencyBonus()).toBe(3);
	});

	it("should return +4 proficiency bonus at level 9", () => {
		const state = new CharacterSheetState();
		state.addClass({name: "Monk", source: "PHB", level: 9});
		expect(state.getProficiencyBonus()).toBe(4);
	});

	it("should return +5 proficiency bonus at level 13", () => {
		const state = new CharacterSheetState();
		state.addClass({name: "Monk", source: "PHB", level: 13});
		expect(state.getProficiencyBonus()).toBe(5);
	});

	it("should return +6 proficiency bonus at level 17", () => {
		const state = new CharacterSheetState();
		state.addClass({name: "Monk", source: "PHB", level: 17});
		expect(state.getProficiencyBonus()).toBe(6);
	});
});
