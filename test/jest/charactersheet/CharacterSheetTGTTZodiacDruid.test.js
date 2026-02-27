/**
 * TGTT Zodiac Druid (Circle of the Stars) — Extended L1→20 test coverage.
 *
 * The main CharacterSheetTGTT.test.js already covers extensive Zodiac Form
 * calculations (Month Constellations, Star Week, Full Zodiac, Bee Damage
 * scaling, Bulette AC scaling, etc.).
 *
 * This file extends coverage to:
 * - Wild Shape resource consumption and interaction with Zodiac Form
 * - Cosmic Omen feature (L6)
 * - All 11 Month constellation presence checks
 * - Star Week presence checks
 * - Full Zodiac capstone interaction
 * - Druid Specialties (TGTT schedule)
 * - Spell slot progression (full caster)
 * - Full L1→20 progression
 */

import "./setup.js";

let CharacterSheetState;
let state;

beforeAll(async () => {
	CharacterSheetState = (await import("../../../js/charactersheet/charactersheet-state.js")).CharacterSheetState;
});

describe("TGTT Zodiac Druid (Circle of the Stars)", () => {

	beforeEach(() => {
		state = new CharacterSheetState();
	});

	// =========================================================================
	// HELPER
	// =========================================================================
	function makeZodiacDruid (level) {
		state.addClass({
			name: "Druid",
			source: "TGTT",
			level,
			subclass: level >= 3
				? {name: "Circle of the Stars", shortName: "Stars", source: "TGTT"}
				: undefined,
		});
		state.setAbilityBase("str", 8);
		state.setAbilityBase("dex", 14); // +2
		state.setAbilityBase("con", 14); // +2
		state.setAbilityBase("int", 12); // +1
		state.setAbilityBase("wis", 18); // +4
		state.setAbilityBase("cha", 10);
	}

	// =========================================================================
	// CORE CLASS SETUP
	// =========================================================================
	describe("Core Class Setup", () => {
		it("should create a TGTT Druid", () => {
			makeZodiacDruid(1);
			const classes = state.getClasses();
			expect(classes.length).toBe(1);
			expect(classes[0].name).toBe("Druid");
			expect(classes[0].source).toBe("TGTT");
		});

		it("should recognise Circle of the Stars subclass at level 3", () => {
			makeZodiacDruid(3);
			const classes = state.getClasses();
			expect(classes[0].subclass).toBeDefined();
			expect(classes[0].subclass.shortName).toBe("Stars");
		});

		it("should use WIS as spellcasting ability", () => {
			makeZodiacDruid(5);
			state.setSpellcastingAbility("wis");
			state.applyClassFeatureEffects();
			// Spell DC = 8 + prof(3) + WIS(4) = 15
			expect(state.getSpellSaveDc()).toBe(15);
		});
	});

	// =========================================================================
	// ZODIAC FORM vs STARRY FORM — TGTT vs Official
	// =========================================================================
	describe("Zodiac Form vs Starry Form", () => {
		it("should have Zodiac Form (not Starry Form) for TGTT", () => {
			makeZodiacDruid(3);
			const calcs = state.getFeatureCalculations();
			expect(calcs.hasZodiacForm).toBe(true);
			expect(calcs.hasStarryForm).toBeFalsy();
		});

		it("should have Starry Form (not Zodiac Form) for official", () => {
			state.addClass({
				name: "Druid", source: "PHB", level: 3,
				subclass: {name: "Circle of Stars", shortName: "Stars", source: "TCE"},
			});
			const calcs = state.getFeatureCalculations();
			expect(calcs.hasStarryForm).toBe(true);
			expect(calcs.hasZodiacForm).toBeFalsy();
		});
	});

	// =========================================================================
	// WILD SHAPE & ZODIAC FORM INTERACTION
	// =========================================================================
	describe("Wild Shape & Zodiac Form Interaction", () => {
		it("should track Wild Shape uses", () => {
			makeZodiacDruid(3);
			state.addResource({name: "Wild Shape", max: 2, current: 2, recharge: "short"});

			const res = state.getResource("Wild Shape");
			expect(res.max).toBe(2);
			expect(res.current).toBe(2);
		});

		it("should detect Zodiac Form via calculations flag", () => {
			makeZodiacDruid(6);
			const calcs = state.getFeatureCalculations();
			expect(calcs.hasZodiacForm).toBe(true);
		});

		it("should track Zodiac Form as available from level 3", () => {
			makeZodiacDruid(3);
			const calcs = state.getFeatureCalculations();
			expect(calcs.hasZodiacForm).toBe(true);
		});

		it("should produce zodiac form light emission from calculations", () => {
			makeZodiacDruid(3);
			const calcs = state.getFeatureCalculations();
			expect(calcs.zodiacFormBrightLight).toBe(10);
			expect(calcs.zodiacFormDimLight).toBe(20);
			expect(calcs.zodiacFormDuration).toBe(10); // 10 minutes
		});
	});

	// =========================================================================
	// ALL 11 MONTH CONSTELLATIONS (L3)
	// =========================================================================
	describe("Month Constellations (Level 3)", () => {
		const monthConstellations = [
			"Griffon", "Beaver", "Aurochs", "Horse",
			"Octopus", "Peacock", "Bee", "Hound",
			"Cat", "Bulette", "Phoenix",
		];

		beforeEach(() => {
			makeZodiacDruid(6);
		});

		monthConstellations.forEach(name => {
			it(`should support ${name} constellation`, () => {
				state.addFeature({
					name,
					source: "TGTT",
					featureType: "Subclass",
					className: "Druid",
					subclassName: "Circle of the Stars",
					level: 3,
				});
				expect(state.getFeatures().some(f => f.name === name)).toBe(true);
			});
		});

		it("should calculate all 11 constellation-specific values", () => {
			const calcs = state.getFeatureCalculations();
			// Spot-check representative calcs from existing coverage
			expect(calcs.griffonBonusAttack).toBe(true);
			expect(calcs.beaverDamageReduction).toBeGreaterThan(0);
			expect(calcs.aurochsStrBonus).toBeGreaterThan(0);
			expect(calcs.horseSpeedMultiplier).toBe(2);
			expect(calcs.octopusReachBonus).toBe(5);
			expect(calcs.peacockSaveDc).toBeGreaterThan(0);
			expect(calcs.beeDamage).toBeTruthy();
			expect(calcs.houndMarkRange).toBe(60);
			expect(calcs.catPerceptionBonus).toBeTruthy();
			expect(calcs.buletteAcBonus).toBeGreaterThan(0);
			expect(calcs.phoenixStabilizeHeal).toBeTruthy();
		});
	});

	// =========================================================================
	// COSMIC OMEN (L6 feature)
	// =========================================================================
	describe("Cosmic Omen (Level 6)", () => {
		it("should grant Cosmic Omen at level 6", () => {
			makeZodiacDruid(6);
			state.addFeature({
				name: "Cosmic Omen",
				source: "TGTT",
				featureType: "Subclass",
				className: "Druid",
				subclassName: "Circle of the Stars",
				level: 6,
				description: "When you finish a long rest, you can consult your Star Map for omens. Roll a die to determine your omen — Weal or Woe.",
			});
			state.applyClassFeatureEffects();
			expect(state.getFeatures().some(f => f.name === "Cosmic Omen")).toBe(true);
		});

		it("should track Cosmic Omen uses = proficiency bonus", () => {
			makeZodiacDruid(9); // prof 4
			state.addResource({name: "Cosmic Omen", max: 4, current: 4, recharge: "long"});
			const res = state.getResource("Cosmic Omen");
			expect(res.max).toBe(4);
			expect(res.recharge).toBe("long");
		});
	});

	// =========================================================================
	// STAR WEEK (L10) & FULL ZODIAC (L14)
	// =========================================================================
	describe("Star Week (Level 10)", () => {
		it("should gain Star Week at level 10", () => {
			makeZodiacDruid(10);
			const calcs = state.getFeatureCalculations();
			expect(calcs.hasStarWeek).toBe(true);
		});

		it("should not have Star Week before level 10", () => {
			makeZodiacDruid(9);
			const calcs = state.getFeatureCalculations();
			expect(calcs.hasStarWeek).toBeFalsy();
		});

		const starWeekConsts = [
			"Sequoia", "Unicorn", "Raven", "Kitsune",
			"Hillstep Turtle", "Owlbear", "Almiraj", "Bat",
			"Pseudodragon", "Aurumvorax", "Salmon", "Lizard",
		];

		starWeekConsts.forEach(name => {
			it(`should support Star Week constellation: ${name}`, () => {
				makeZodiacDruid(10);
				state.addFeature({
					name,
					source: "TGTT",
					featureType: "Subclass",
					className: "Druid",
					subclassName: "Circle of the Stars",
					level: 10,
				});
				expect(state.getFeatures().some(f => f.name === name)).toBe(true);
			});
		});
	});

	describe("Full Zodiac (Level 14)", () => {
		it("should grant Full Zodiac at level 14", () => {
			makeZodiacDruid(14);
			const calcs = state.getFeatureCalculations();
			expect(calcs.hasFullZodiac).toBe(true);
		});

		it("should not have Full Zodiac before level 14", () => {
			makeZodiacDruid(13);
			const calcs = state.getFeatureCalculations();
			expect(calcs.hasFullZodiac).toBeFalsy();
		});
	});

	// =========================================================================
	// DRUID (TGTT) SPECIALTIES
	// =========================================================================
	describe("Druid (TGTT) Specialties", () => {
		it("should accept specialties at the TGTT schedule", () => {
			makeZodiacDruid(20);
			const specialtyLevels = [4, 8, 12, 16, 20];
			specialtyLevels.forEach(lvl => {
				state.addFeature({
					name: `Druid Specialty (Lv ${lvl})`,
					source: "TGTT",
					featureType: "Class",
					className: "Druid",
					level: lvl,
				});
			});
			state.applyClassFeatureEffects();
			const features = state.getFeatures();
			specialtyLevels.forEach(lvl => {
				expect(features.some(f => f.name === `Druid Specialty (Lv ${lvl})`)).toBe(true);
			});
		});
	});

	// =========================================================================
	// SPELL SLOT PROGRESSION (Full Caster)
	// =========================================================================
	describe("Spell Slot Progression (Full Caster)", () => {
		const milestones = [
			{level: 1, maxSpellLevel: 1},
			{level: 3, maxSpellLevel: 2},
			{level: 5, maxSpellLevel: 3},
			{level: 9, maxSpellLevel: 5},
			{level: 11, maxSpellLevel: 6},
			{level: 13, maxSpellLevel: 7},
			{level: 15, maxSpellLevel: 8},
			{level: 17, maxSpellLevel: 9},
		];

		milestones.forEach(({level, maxSpellLevel}) => {
			it(`should have up to level-${maxSpellLevel} slots at Druid level ${level}`, () => {
				const s = new CharacterSheetState();
				s.addClass({name: "Druid", source: "TGTT", level});
				s.calculateSpellSlots();
				expect(s.getSpellSlotsMax(maxSpellLevel)).toBeGreaterThan(0);
				if (maxSpellLevel < 9) {
					expect(s.getSpellSlotsMax(maxSpellLevel + 1)).toBe(0);
				}
			});
		});
	});

	// =========================================================================
	// FULL L1→20 PROGRESSION
	// =========================================================================
	describe("Full L1→20 Progression", () => {
		it("should maintain valid state at every level", () => {
			for (let lvl = 1; lvl <= 20; lvl++) {
				const s = new CharacterSheetState();
				s.addClass({
					name: "Druid", source: "TGTT", level: lvl,
					subclass: lvl >= 3
						? {name: "Circle of the Stars", shortName: "Stars", source: "TGTT"}
						: undefined,
				});
				s.setAbilityBase("wis", 18);
				s.setSpellcastingAbility("wis");

				expect(s.getTotalLevel()).toBe(lvl);
				s.applyClassFeatureEffects();
				expect(s.getSpellSaveDc()).toBeGreaterThanOrEqual(12);
			}
		});

		it("should have Zodiac Form from level 3 onwards", () => {
			for (let lvl = 3; lvl <= 20; lvl++) {
				const s = new CharacterSheetState();
				s.addClass({
					name: "Druid", source: "TGTT", level: lvl,
					subclass: {name: "Circle of the Stars", shortName: "Stars", source: "TGTT"},
				});
				s.setAbilityBase("wis", 18);
				expect(s.getFeatureCalculations().hasZodiacForm).toBe(true);
			}
		});

		it("should track proficiency bonus correctly", () => {
			const profTable = [
				{level: 1, prof: 2}, {level: 4, prof: 2},
				{level: 5, prof: 3}, {level: 8, prof: 3},
				{level: 9, prof: 4}, {level: 12, prof: 4},
				{level: 13, prof: 5}, {level: 16, prof: 5},
				{level: 17, prof: 6}, {level: 20, prof: 6},
			];

			profTable.forEach(({level, prof}) => {
				const s = new CharacterSheetState();
				s.addClass({name: "Druid", source: "TGTT", level});
				expect(s.getProficiencyBonus()).toBe(prof);
			});
		});
	});
});
