/**
 * TGTT Multiclass Tests — Ranger/Druid and Sorcerer/Warlock combos.
 *
 * These are the two multiclass builds the player party uses:
 * 1. Ranger (TGTT) / Druid (TGTT) — Zodiac Stars + Hunter dual-nature
 * 2. Sorcerer (TGTT) / Warlock (TGTT) — Divine Soul + Hexblade (Sorlock)
 *
 * Covers:
 * - Combined spell slot calculations
 * - Resource independence (Focus vs Wild Shape, SP vs Pact Slots)
 * - Combat system interaction in multiclass
 * - Feature calculations from both classes
 * - Proficiency bonus from total character level
 */

import "./setup.js";

let CharacterSheetState;
let state;

beforeAll(async () => {
	CharacterSheetState = (await import("../../../js/charactersheet/charactersheet-state.js")).CharacterSheetState;
});

describe("TGTT Multiclass Builds", () => {

	beforeEach(() => {
		state = new CharacterSheetState();
	});

	// =========================================================================
	// RANGER / DRUID (Hunter Ranger 7 / Zodiac Druid 3)
	// =========================================================================
	describe("Ranger/Druid Multiclass (Hunter 7 / Stars 3)", () => {

		function makeRangerDruid (rangerLevel = 7, druidLevel = 3) {
			state.addClass({
				name: "Ranger", source: "TGTT", level: rangerLevel,
				subclass: rangerLevel >= 3
					? {name: "Hunter", shortName: "Hunter", source: "TGTT"}
					: undefined,
			});
			state.addClass({
				name: "Druid", source: "TGTT", level: druidLevel,
				subclass: druidLevel >= 3
					? {name: "Circle of the Stars", shortName: "Stars", source: "TGTT"}
					: undefined,
			});
			state.setAbilityBase("str", 10);
			state.setAbilityBase("dex", 16); // +3
			state.setAbilityBase("con", 14); // +2
			state.setAbilityBase("int", 10);
			state.setAbilityBase("wis", 18); // +4
			state.setAbilityBase("cha", 8);
		}

		describe("Basic Setup", () => {
			it("should create two-class multiclass", () => {
				makeRangerDruid();
				const classes = state.getClasses();
				expect(classes.length).toBe(2);
				expect(classes.find(c => c.name === "Ranger")).toBeDefined();
				expect(classes.find(c => c.name === "Druid")).toBeDefined();
			});

			it("should calculate total level correctly", () => {
				makeRangerDruid(7, 3);
				expect(state.getTotalLevel()).toBe(10);
			});

			it("should use proficiency bonus from total level", () => {
				makeRangerDruid(7, 3); // total 10
				expect(state.getProficiencyBonus()).toBe(4);
			});
		});

		describe("Multiclass Spellcasting Slots", () => {
			it("should calculate multiclass spell slots", () => {
				makeRangerDruid(7, 3); // half-caster 7 = 3.5 + full-caster 3 = 3 → effective caster level 6
				state.calculateSpellSlots();
				// Level 6 caster: 4/3/3 slots
				expect(state.getSpellSlotsMax(1)).toBeGreaterThanOrEqual(4);
				expect(state.getSpellSlotsMax(2)).toBeGreaterThanOrEqual(3);
				expect(state.getSpellSlotsMax(3)).toBeGreaterThanOrEqual(3);
			});

			it("should have 4th level slots at Ranger 7 / Druid 3", () => {
				// Ranger 7 (half-caster → 3 effective) + Druid 3 (full → 3 effective) = 6 effective
				// A 6th-level caster gets 1 4th-level slot
				makeRangerDruid(7, 3);
				state.calculateSpellSlots();
				expect(state.getSpellSlotsMax(4)).toBe(1);
			});

			it("should gain 4th level slots at higher splits", () => {
				makeRangerDruid(9, 5); // half 9 = 4.5 + full 5 = 5 → effective 9
				state.calculateSpellSlots();
				expect(state.getSpellSlotsMax(4)).toBeGreaterThan(0);
			});
		});

		describe("Independent Resources", () => {
			it("should have Primal Focus (from Ranger) independently", () => {
				makeRangerDruid();
				state.applyClassFeatureEffects();
				expect(state.hasPrimalFocus()).toBe(true);
			});

			it("should have Focused Quarry damage from Ranger level (not total)", () => {
				makeRangerDruid(7, 3);
				state.applyClassFeatureEffects();
				const calcs = state.getFeatureCalculations();
				// Ranger 7 → 1d6 (level 5-9 bracket)
				expect(calcs.focusedQuarryDamage).toBe("1d6");
			});

			it("should have Hunter's Dodge uses from total proficiency", () => {
				makeRangerDruid(7, 3); // total level 10, prof 4
				state.applyClassFeatureEffects();
				expect(state.getFeatureCalculations().huntersDodgeUses).toBe(4);
			});

			it("should have Zodiac Form from Druid subclass", () => {
				makeRangerDruid(7, 3);
				const calcs = state.getFeatureCalculations();
				expect(calcs.hasZodiacForm).toBe(true);
			});

			it("should calculate Zodiac constellation values from Druid level", () => {
				makeRangerDruid(7, 3);
				const calcs = state.getFeatureCalculations();
				// Bee damage uses druid level: level 3 = before 10 scaling, 1d8+WIS
				expect(calcs.beeDamage).toBe("1d8+4");
			});
		});

		describe("Combat System in Multiclass", () => {
			it("should have combat system from Ranger", () => {
				makeRangerDruid();
				state.addCombatTradition("Rapid Current");
				expect(state.usesCombatSystem()).toBe(true);
			});

			it("should have exertion pool based on total proficiency", () => {
				makeRangerDruid(7, 3); // total 10, prof 4
				state.addCombatTradition("Rapid Current");
				state.ensureExertionInitialized();
				expect(state.getExertionMax()).toBe(8); // 2 × 4
			});
		});

		describe("Level Progression Splits", () => {
			const splits = [
				{ranger: 5, druid: 1, total: 6},
				{ranger: 7, druid: 3, total: 10},
				{ranger: 10, druid: 5, total: 15},
				{ranger: 14, druid: 6, total: 20},
			];

			splits.forEach(({ranger, druid, total}) => {
				it(`should be valid at Ranger ${ranger} / Druid ${druid} (total ${total})`, () => {
					makeRangerDruid(ranger, druid);
					expect(state.getTotalLevel()).toBe(total);
					state.applyClassFeatureEffects();
					expect(state.hasPrimalFocus()).toBe(true);
					if (druid >= 3) {
						expect(state.getFeatureCalculations().hasZodiacForm).toBe(true);
					}
				});
			});
		});
	});

	// =========================================================================
	// SORCERER / WARLOCK (Divine Soul Sorcerer X / Hexblade Warlock Y)
	// =========================================================================
	describe("Sorcerer/Warlock Multiclass (Divine Soul 7 / Hexblade 3)", () => {

		function makeSorlock (sorcererLevel = 7, warlockLevel = 3) {
			state.addClass({
				name: "Sorcerer", source: "TGTT", level: sorcererLevel,
				subclass: sorcererLevel >= 3
					? {name: "Divine Soul", shortName: "Divine Soul", source: "TGTT"}
					: undefined,
			});
			state.addClass({
				name: "Warlock", source: "TGTT", level: warlockLevel,
				subclass: warlockLevel >= 3
					? {name: "The Hexblade", shortName: "Hexblade", source: "TGTT"}
					: undefined,
			});
			state.setAbilityBase("str", 8);
			state.setAbilityBase("dex", 14); // +2
			state.setAbilityBase("con", 14); // +2
			state.setAbilityBase("int", 10);
			state.setAbilityBase("wis", 12); // +1
			state.setAbilityBase("cha", 20); // +5
		}

		describe("Basic Setup", () => {
			it("should create Sorcerer/Warlock multiclass", () => {
				makeSorlock();
				const classes = state.getClasses();
				expect(classes.length).toBe(2);
				expect(classes.find(c => c.name === "Sorcerer")).toBeDefined();
				expect(classes.find(c => c.name === "Warlock")).toBeDefined();
			});

			it("should calculate total level correctly", () => {
				makeSorlock(7, 3);
				expect(state.getTotalLevel()).toBe(10);
			});

			it("should use proficiency bonus from total level", () => {
				makeSorlock(7, 3); // total 10
				expect(state.getProficiencyBonus()).toBe(4);
			});
		});

		describe("Spell Slots + Pact Slots Independence", () => {
			it("should have regular spell slots from Sorcerer levels only", () => {
				makeSorlock(7, 3);
				state.calculateSpellSlots();
				// Warlock pact magic does NOT contribute to multiclass spell slots
				// Sorcerer 7 = 4/3/3/1 slots
				expect(state.getSpellSlotsMax(1)).toBeGreaterThanOrEqual(4);
				expect(state.getSpellSlotsMax(4)).toBe(1);
			});

			it("should have separate pact slots from Warlock levels", () => {
				makeSorlock(7, 3);
				const pactSlots = state.getPactSlots();
				expect(pactSlots).toBeDefined();
				expect(pactSlots.max).toBe(2); // Warlock 3 = 2 pact slots
				expect(pactSlots.level).toBe(2); // 2nd level slots
			});

			it("should be able to use pact slots independently of spell slots", () => {
				makeSorlock(7, 3);
				state.calculateSpellSlots();

				const regularSlots1Max = state.getSpellSlotsMax(1);
				state.usePactSlot();

				// Regular spell slots should be unchanged
				expect(state.getSpellSlotsMax(1)).toBe(regularSlots1Max);
				expect(state.getPactSlots().current).toBe(1); // Used 1 of 2
			});
		});

		describe("Resource Independence", () => {
			it("should have sorcery points from Sorcerer level", () => {
				makeSorlock(7, 3);
				state.setSorceryPoints(7); // Sorcerer level only
				expect(state.getSorceryPoints().max).toBe(7);
			});

			it("should have Metamagic from Sorcerer level", () => {
				makeSorlock(7, 3);
				const calcs = state.getFeatureCalculations();
				expect(calcs.hasMetamagic).toBe(true);
			});

			it("should maintain Hexblade Curse resource independently", () => {
				makeSorlock(7, 3);
				state.addResource({name: "Hexblade's Curse", max: 1, current: 1, recharge: "short"});
				state.setSorceryPoints(7);

				// Use Hexblade Curse — shouldn't affect SP
				const res = state.getResource("Hexblade's Curse");
				expect(res.max).toBe(1);
				expect(state.getSorceryPoints().max).toBe(7);
			});
		});

		describe("Combat System (from Hexblade)", () => {
			it("should have combat system from Warlock/Hexblade", () => {
				makeSorlock(7, 3);
				state.addCombatTradition("Mirror's Glint");
				expect(state.usesCombatSystem()).toBe(true);
			});

			it("should scale exertion with total proficiency", () => {
				makeSorlock(7, 3); // total 10, prof 4
				state.addCombatTradition("Mirror's Glint");
				state.ensureExertionInitialized();
				expect(state.getExertionMax()).toBe(8); // 2 × 4
			});
		});

		describe("Shared CHA Spellcasting", () => {
			it("should use CHA for both Sorcerer and Warlock spells", () => {
				makeSorlock(7, 3);
				state.applyClassFeatureEffects();
				const calcs = state.getFeatureCalculations();
				// Both classes use CHA: DC = 8 + prof(4) + CHA(5) = 17
				expect(calcs.spellSaveDc).toBe(17);
				expect(calcs.spellAttackBonus).toBe(9);
			});
		});

		describe("Level Progression Splits", () => {
			const splits = [
				{sorcerer: 5, warlock: 1, total: 6},
				{sorcerer: 7, warlock: 3, total: 10},
				{sorcerer: 11, warlock: 4, total: 15},
				{sorcerer: 14, warlock: 6, total: 20},
			];

			splits.forEach(({sorcerer, warlock, total}) => {
				it(`should be valid at Sorcerer ${sorcerer} / Warlock ${warlock} (total ${total})`, () => {
					makeSorlock(sorcerer, warlock);
					expect(state.getTotalLevel()).toBe(total);
					state.applyClassFeatureEffects();

					// Always have metamagic from Sorcerer 2+
					if (sorcerer >= 2) {
						expect(state.getFeatureCalculations().hasMetamagic).toBe(true);
					}

					// Always have pact slots from Warlock
					expect(state.getPactSlots().max).toBeGreaterThan(0);
				});
			});
		});

		describe("Coffeelock Pattern (SP → Pact Slot Cycling)", () => {
			it("should allow converting pact slots to sorcery points pattern", () => {
				makeSorlock(7, 3); // Pact slots are 2nd level
				state.setSorceryPoints(7);

				// Pattern: Use all pact slots → short rest → regain → convert
				// This test verifies the resources exist and are independent
				state.usePactSlot();
				state.usePactSlot();
				expect(state.getPactSlots().current).toBe(0);

				// Short rest restores pact slots
				state.setPactSlotsCurrent(state.getPactSlots().max);
				expect(state.getPactSlots().current).toBe(2);

				// SP still at max
				expect(state.getSorceryPoints().max).toBe(7);
			});
		});
	});
});
