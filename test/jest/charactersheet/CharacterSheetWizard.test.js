/**
 * Character Sheet Wizard Class Tests
 * Comprehensive testing for all Wizard class features and subclasses (Arcane Traditions)
 *
 * This test suite verifies that:
 * - Spellcasting calculations are correct (save DC, attack bonus)
 * - Cantrips and prepared spells progression is correct
 * - Arcane Recovery slot recovery is correct
 * - Spellbook spells known tracking is correct
 * - PHB vs XPHB differences are handled correctly
 * - All subclass (Arcane Tradition) features work correctly
 */

import "./setup.js";
import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

// ==========================================================================
// PART 1: CORE WIZARD CLASS FEATURES (PHB)
// ==========================================================================
describe("Wizard Core Class Features (PHB)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 1});
		state.setAbilityBase("str", 8);
		state.setAbilityBase("dex", 14);
		state.setAbilityBase("con", 12);
		state.setAbilityBase("int", 16); // +3 modifier
		state.setAbilityBase("wis", 10);
		state.setAbilityBase("cha", 10);
	});

	// -------------------------------------------------------------------------
	// Spellcasting (Level 1)
	// -------------------------------------------------------------------------
	describe("Spellcasting", () => {
		it("should have Spellcasting at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasSpellcasting).toBe(true);
		});

		it("should use INT as spellcasting ability", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.spellcastingAbility).toBe("int");
		});

		it("should calculate spell save DC as 8 + prof + INT", () => {
			const calculations = state.getFeatureCalculations();
			// 8 + 2 (prof at 1) + 3 (INT) = 13
			expect(calculations.spellSaveDc).toBe(13);
		});

		it("should calculate spell attack bonus as prof + INT", () => {
			const calculations = state.getFeatureCalculations();
			// 2 (prof at 1) + 3 (INT) = 5
			expect(calculations.spellAttackBonus).toBe(5);
		});

		it("should scale spell save DC with level", () => {
			const state5 = new CharacterSheetState();
			state5.setRace({name: "High Elf", source: "PHB"});
			state5.addClass({name: "Wizard", source: "PHB", level: 5});
			state5.setAbilityBase("int", 16);
			const calculations = state5.getFeatureCalculations();
			// 8 + 3 (prof at 5) + 3 (INT) = 14
			expect(calculations.spellSaveDc).toBe(14);
		});

		it("should work with higher INT", () => {
			state.setAbilityBase("int", 20);
			const calculations = state.getFeatureCalculations();
			// 8 + 2 (prof at 1) + 5 (INT) = 15
			expect(calculations.spellSaveDc).toBe(15);
		});
	});

	// -------------------------------------------------------------------------
	// Cantrips Known
	// -------------------------------------------------------------------------
	describe("Cantrips Known", () => {
		it("should start with 3 cantrips known at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.cantripsKnown).toBe(3);
		});

		it("should have 4 cantrips at level 4", () => {
			const state4 = new CharacterSheetState();
			state4.setRace({name: "High Elf", source: "PHB"});
			state4.addClass({name: "Wizard", source: "PHB", level: 4});
			state4.setAbilityBase("int", 16);
			const calculations = state4.getFeatureCalculations();
			expect(calculations.cantripsKnown).toBe(4);
		});

		it("should have 5 cantrips at level 10", () => {
			const state10 = new CharacterSheetState();
			state10.setRace({name: "High Elf", source: "PHB"});
			state10.addClass({name: "Wizard", source: "PHB", level: 10});
			state10.setAbilityBase("int", 16);
			const calculations = state10.getFeatureCalculations();
			expect(calculations.cantripsKnown).toBe(5);
		});
	});

	// -------------------------------------------------------------------------
	// Prepared Spells (PHB: level + INT mod, minimum 1)
	// -------------------------------------------------------------------------
	describe("Prepared Spells (PHB)", () => {
		it("should calculate prepared spells as level + INT mod", () => {
			const calculations = state.getFeatureCalculations();
			// Level 1 + INT mod 3 = 4
			expect(calculations.preparedSpells).toBe(4);
		});

		it("should scale prepared spells with level", () => {
			const state10 = new CharacterSheetState();
			state10.setRace({name: "High Elf", source: "PHB"});
			state10.addClass({name: "Wizard", source: "PHB", level: 10});
			state10.setAbilityBase("int", 16);
			const calculations = state10.getFeatureCalculations();
			// Level 10 + INT mod 3 = 13
			expect(calculations.preparedSpells).toBe(13);
		});

		it("should have minimum 1 prepared spell with low INT", () => {
			state.setAbilityBase("int", 8); // -1 modifier
			const calculations = state.getFeatureCalculations();
			// Level 1 + INT mod -1 = 0, minimum 1
			expect(calculations.preparedSpells).toBe(1);
		});
	});

	// -------------------------------------------------------------------------
	// Spellbook Spells Known
	// -------------------------------------------------------------------------
	describe("Spellbook Spells Known", () => {
		it("should start with 6 spells in spellbook at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.spellbookSpellsKnown).toBe(6);
		});

		it("should have 24 spells at level 10", () => {
			const state10 = new CharacterSheetState();
			state10.setRace({name: "High Elf", source: "PHB"});
			state10.addClass({name: "Wizard", source: "PHB", level: 10});
			state10.setAbilityBase("int", 16);
			const calculations = state10.getFeatureCalculations();
			// 6 + (9 * 2) = 24
			expect(calculations.spellbookSpellsKnown).toBe(24);
		});
	});

	// -------------------------------------------------------------------------
	// Arcane Recovery (Level 1)
	// -------------------------------------------------------------------------
	describe("Arcane Recovery", () => {
		it("should have Arcane Recovery at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasArcaneRecovery).toBe(true);
		});

		it("should recover 1 slot level at level 1", () => {
			const calculations = state.getFeatureCalculations();
			// ceil(1/2) = 1
			expect(calculations.arcaneRecoverySlotLevels).toBe(1);
		});

		it("should recover 5 slot levels at level 10", () => {
			const state10 = new CharacterSheetState();
			state10.setRace({name: "High Elf", source: "PHB"});
			state10.addClass({name: "Wizard", source: "PHB", level: 10});
			state10.setAbilityBase("int", 16);
			const calculations = state10.getFeatureCalculations();
			// ceil(10/2) = 5
			expect(calculations.arcaneRecoverySlotLevels).toBe(5);
		});
	});

	// -------------------------------------------------------------------------
	// Spell Mastery (Level 18) & Signature Spells (Level 20)
	// -------------------------------------------------------------------------
	describe("High Level Features", () => {
		it("should have Spell Mastery at level 18", () => {
			const state18 = new CharacterSheetState();
			state18.setRace({name: "High Elf", source: "PHB"});
			state18.addClass({name: "Wizard", source: "PHB", level: 18});
			state18.setAbilityBase("int", 16);
			const calculations = state18.getFeatureCalculations();
			expect(calculations.hasSpellMastery).toBe(true);
		});

		it("should have Signature Spells at level 20", () => {
			const state20 = new CharacterSheetState();
			state20.setRace({name: "High Elf", source: "PHB"});
			state20.addClass({name: "Wizard", source: "PHB", level: 20});
			state20.setAbilityBase("int", 16);
			const calculations = state20.getFeatureCalculations();
			expect(calculations.hasSignatureSpells).toBe(true);
		});
	});
});

// ==========================================================================
// PART 2: XPHB WIZARD FEATURES
// ==========================================================================
describe("Wizard XPHB Features", () => {
	it("should have Ritual Adept at level 1 (XPHB)", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "XPHB", level: 1});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasRitualAdept).toBe(true);
	});

	it("should have Scholar at level 2 (XPHB)", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "XPHB", level: 2});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasScholar).toBe(true);
	});

	it("should have Memorize Spell at level 5 (XPHB)", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "XPHB", level: 5});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasMemorizeSpell).toBe(true);
	});

	it("should use fixed prepared spells progression (XPHB)", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "XPHB", level: 10});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.preparedSpells).toBe(15); // Fixed at level 10
	});

	it("should not depend on INT for prepared spells (XPHB)", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "XPHB", level: 1});
		state.setAbilityBase("int", 8);
		const calculations = state.getFeatureCalculations();
		// Should still be 4, not affected by low INT
		expect(calculations.preparedSpells).toBe(4);
	});
});

// ==========================================================================
// PART 3: SCHOOL OF ABJURATION
// ==========================================================================
describe("School of Abjuration (PHB)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 2, subclass: {name: "School of Abjuration", source: "PHB"}});
		state.setAbilityBase("str", 8);
		state.setAbilityBase("dex", 14);
		state.setAbilityBase("con", 12);
		state.setAbilityBase("int", 16);
		state.setAbilityBase("wis", 10);
		state.setAbilityBase("cha", 10);
	});

	it("should have Abjuration Savant at level 2", () => {
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasAbjurationSavant).toBe(true);
	});

	it("should have Arcane Ward at level 2", () => {
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasArcaneWard).toBe(true);
		// 2 * 2 + 3 = 7
		expect(calculations.arcaneWardMaxHp).toBe(7);
	});

	it("should have Projected Ward at level 6", () => {
		const state6 = new CharacterSheetState();
		state6.setRace({name: "High Elf", source: "PHB"});
		state6.addClass({name: "Wizard", source: "PHB", level: 6, subclass: {name: "School of Abjuration", source: "PHB"}});
		state6.setAbilityBase("int", 16);
		const calculations = state6.getFeatureCalculations();
		expect(calculations.hasProjectedWard).toBe(true);
	});

	it("should have Improved Abjuration at level 10", () => {
		const state10 = new CharacterSheetState();
		state10.setRace({name: "High Elf", source: "PHB"});
		state10.addClass({name: "Wizard", source: "PHB", level: 10, subclass: {name: "School of Abjuration", source: "PHB"}});
		state10.setAbilityBase("int", 16);
		const calculations = state10.getFeatureCalculations();
		expect(calculations.hasImprovedAbjuration).toBe(true);
		expect(calculations.improvedAbjurationBonus).toBe(4);
	});

	it("should have Spell Resistance at level 14", () => {
		const state14 = new CharacterSheetState();
		state14.setRace({name: "High Elf", source: "PHB"});
		state14.addClass({name: "Wizard", source: "PHB", level: 14, subclass: {name: "School of Abjuration", source: "PHB"}});
		state14.setAbilityBase("int", 16);
		const calculations = state14.getFeatureCalculations();
		expect(calculations.hasSpellResistance).toBe(true);
	});
});

// ==========================================================================
// PART 4: SCHOOL OF CONJURATION
// ==========================================================================
describe("School of Conjuration (PHB)", () => {
	it("should have Conjuration Savant and Minor Conjuration at level 2", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 2, subclass: {name: "School of Conjuration", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasConjurationSavant).toBe(true);
		expect(calculations.hasMinorConjuration).toBe(true);
	});

	it("should have Benign Transposition at level 6", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 6, subclass: {name: "School of Conjuration", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasBenignTransposition).toBe(true);
		expect(calculations.benignTranspositionRange).toBe(30);
	});

	it("should have Focused Conjuration at level 10", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 10, subclass: {name: "School of Conjuration", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasFocusedConjuration).toBe(true);
	});

	it("should have Durable Summons at level 14", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 14, subclass: {name: "School of Conjuration", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasDurableSummons).toBe(true);
		expect(calculations.durableSummonsTempHp).toBe(30);
	});
});

// ==========================================================================
// PART 5: SCHOOL OF DIVINATION
// ==========================================================================
describe("School of Divination (PHB)", () => {
	it("should have Divination Savant and Portent at level 2", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 2, subclass: {name: "School of Divination", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasDivinationSavant).toBe(true);
		expect(calculations.hasPortent).toBe(true);
		expect(calculations.portentDice).toBe(2);
	});

	it("should have Expert Divination at level 6", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 6, subclass: {name: "School of Divination", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasExpertDivination).toBe(true);
	});

	it("should have The Third Eye at level 10", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 10, subclass: {name: "School of Divination", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasTheThirdEye).toBe(true);
	});

	it("should have Greater Portent with 3 dice at level 14", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 14, subclass: {name: "School of Divination", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasGreaterPortent).toBe(true);
		expect(calculations.portentDice).toBe(3);
	});
});

// ==========================================================================
// PART 6: SCHOOL OF ENCHANTMENT
// ==========================================================================
describe("School of Enchantment (PHB)", () => {
	it("should have Enchantment Savant and Hypnotic Gaze at level 2", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 2, subclass: {name: "School of Enchantment", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasEnchantmentSavant).toBe(true);
		expect(calculations.hasHypnoticGaze).toBe(true);
	});

	it("should have Instinctive Charm at level 6", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 6, subclass: {name: "School of Enchantment", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasInstinctiveCharm).toBe(true);
		// DC = 8 + 3 (prof) + 3 (INT) = 14
		expect(calculations.instinctiveCharmDc).toBe(14);
	});

	it("should have Split Enchantment at level 10", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 10, subclass: {name: "School of Enchantment", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasSplitEnchantment).toBe(true);
	});

	it("should have Alter Memories at level 14", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 14, subclass: {name: "School of Enchantment", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasAlterMemories).toBe(true);
	});
});

// ==========================================================================
// PART 7: SCHOOL OF EVOCATION
// ==========================================================================
describe("School of Evocation (PHB)", () => {
	it("should have Evocation Savant and Sculpt Spells at level 2", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 2, subclass: {name: "School of Evocation", source: "PHB"}});
		state.setAbilityBase("int", 18);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasEvocationSavant).toBe(true);
		expect(calculations.hasSculptSpells).toBe(true);
		expect(calculations.sculptSpellsTargets).toBe(1);
	});

	it("should have Potent Cantrip at level 6", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 6, subclass: {name: "School of Evocation", source: "PHB"}});
		state.setAbilityBase("int", 18);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasPotentCantrip).toBe(true);
	});

	it("should have Empowered Evocation at level 10", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 10, subclass: {name: "School of Evocation", source: "PHB"}});
		state.setAbilityBase("int", 18);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasEmpoweredEvocation).toBe(true);
		expect(calculations.empoweredEvocationBonus).toBe(4);
	});

	it("should have Overchannel at level 14", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 14, subclass: {name: "School of Evocation", source: "PHB"}});
		state.setAbilityBase("int", 18);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasOverchannel).toBe(true);
	});
});

// ==========================================================================
// PART 8: SCHOOL OF ILLUSION
// ==========================================================================
describe("School of Illusion (PHB)", () => {
	it("should have Illusion Savant and Improved Minor Illusion at level 2", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 2, subclass: {name: "School of Illusion", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasIllusionSavant).toBe(true);
		expect(calculations.hasImprovedMinorIllusion).toBe(true);
	});

	it("should have Malleable Illusions at level 6", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 6, subclass: {name: "School of Illusion", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasMalleableIllusions).toBe(true);
	});

	it("should have Illusory Self at level 10", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 10, subclass: {name: "School of Illusion", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasIllusorySelf).toBe(true);
	});

	it("should have Illusory Reality at level 14", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 14, subclass: {name: "School of Illusion", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasIllusoryReality).toBe(true);
	});
});

// ==========================================================================
// PART 9: SCHOOL OF NECROMANCY
// ==========================================================================
describe("School of Necromancy (PHB)", () => {
	it("should have Necromancy Savant and Grim Harvest at level 2", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 2, subclass: {name: "School of Necromancy", source: "PHB"}});
		state.setAbilityBase("int", 18);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasNecromancySavant).toBe(true);
		expect(calculations.hasGrimHarvest).toBe(true);
	});

	it("should have Undead Thralls at level 6", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 6, subclass: {name: "School of Necromancy", source: "PHB"}});
		state.setAbilityBase("int", 18);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasUndeadThralls).toBe(true);
		expect(calculations.undeadThrallsHpBonus).toBe(6);
		expect(calculations.undeadThrallsDamageBonus).toBe(3);
	});

	it("should have Inured to Undeath at level 10", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 10, subclass: {name: "School of Necromancy", source: "PHB"}});
		state.setAbilityBase("int", 18);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasInuredToUndeath).toBe(true);
	});

	it("should have Command Undead at level 14", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 14, subclass: {name: "School of Necromancy", source: "PHB"}});
		state.setAbilityBase("int", 18);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasCommandUndead).toBe(true);
		// DC = 8 + 5 (prof) + 4 (INT) = 17
		expect(calculations.commandUndeadDc).toBe(17);
	});
});

// ==========================================================================
// PART 10: SCHOOL OF TRANSMUTATION
// ==========================================================================
describe("School of Transmutation (PHB)", () => {
	it("should have Transmutation Savant and Minor Alchemy at level 2", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 2, subclass: {name: "School of Transmutation", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasTransmutationSavant).toBe(true);
		expect(calculations.hasMinorAlchemy).toBe(true);
	});

	it("should have Transmuter's Stone at level 6", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 6, subclass: {name: "School of Transmutation", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasTransmutersStone).toBe(true);
	});

	it("should have Shapechanger at level 10", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 10, subclass: {name: "School of Transmutation", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasShapechanger).toBe(true);
	});

	it("should have Master Transmuter at level 14", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 14, subclass: {name: "School of Transmutation", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasMasterTransmuter).toBe(true);
	});
});

// ==========================================================================
// PART 11: WAR MAGIC (XGE)
// ==========================================================================
describe("War Magic (XGE)", () => {
	it("should have Arcane Deflection and Tactical Wit at level 2", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 2, subclass: {name: "War Magic", source: "XGE"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasArcaneDeflection).toBe(true);
		expect(calculations.arcaneDeflectionAcBonus).toBe(2);
		expect(calculations.arcaneDeflectionSaveBonus).toBe(4);
		expect(calculations.hasTacticalWit).toBe(true);
		expect(calculations.tacticalWitBonus).toBe(3);
	});

	it("should have Power Surge at level 6", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 6, subclass: {name: "War Magic", source: "XGE"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasPowerSurge).toBe(true);
		expect(calculations.powerSurgeMaxStored).toBe(3);
		expect(calculations.powerSurgeDamage).toBe(3);
	});

	it("should have Durable Magic at level 10", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 10, subclass: {name: "War Magic", source: "XGE"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasDurableMagic).toBe(true);
		expect(calculations.durableMagicAcBonus).toBe(2);
		expect(calculations.durableMagicSaveBonus).toBe(2);
	});

	it("should have Deflecting Shroud at level 14", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 14, subclass: {name: "War Magic", source: "XGE"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasDeflectingShroud).toBe(true);
		expect(calculations.deflectingShroudDamage).toBe(7);
	});
});

// ==========================================================================
// PART 12: BLADESINGING (TCE)
// ==========================================================================
describe("Bladesinging (TCE)", () => {
	it("should have Training in War and Song and Bladesong at level 2", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 2, subclass: {name: "Bladesinging", source: "TCE"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasTrainingInWarAndSong).toBe(true);
		expect(calculations.hasBladesong).toBe(true);
		expect(calculations.bladesongAcBonus).toBe(3);
		expect(calculations.bladesongConcentrationBonus).toBe(3);
		expect(calculations.bladesongSpeedBonus).toBe(10);
	});

	it("should have Extra Attack at level 6", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 6, subclass: {name: "Bladesinging", source: "TCE"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasExtraAttack).toBe(true);
		expect(calculations.attacksPerAction).toBe(2);
		expect(calculations.canReplaceAttackWithCantrip).toBe(true);
	});

	it("should have Song of Defense at level 10", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 10, subclass: {name: "Bladesinging", source: "TCE"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasSongOfDefense).toBe(true);
	});

	it("should have Song of Victory at level 14", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 14, subclass: {name: "Bladesinging", source: "TCE"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasSongOfVictory).toBe(true);
		expect(calculations.songOfVictoryDamageBonus).toBe(3);
	});
});

// ==========================================================================
// PART 13: ORDER OF SCRIBES (TCE)
// ==========================================================================
describe("Order of Scribes (TCE)", () => {
	it("should have Wizardly Quill and Awakened Spellbook at level 2", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 2, subclass: {name: "Order of Scribes", source: "TCE"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasWizardlyQuill).toBe(true);
		expect(calculations.hasAwakenedSpellbook).toBe(true);
	});

	it("should have Manifest Mind at level 6", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 6, subclass: {name: "Order of Scribes", source: "TCE"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasManifestMind).toBe(true);
		expect(calculations.manifestMindUses).toBe(3);
	});

	it("should have Master Scrivener at level 10", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 10, subclass: {name: "Order of Scribes", source: "TCE"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasMasterScrivener).toBe(true);
	});

	it("should have One with the Word at level 14", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 14, subclass: {name: "Order of Scribes", source: "TCE"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasOneWithTheWord).toBe(true);
	});
});

// ==========================================================================
// PART 14: CHRONURGY MAGIC (EGW)
// ==========================================================================
describe("Chronurgy Magic (EGW)", () => {
	it("should have Chronal Shift and Temporal Awareness at level 2", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 2, subclass: {name: "Chronurgy Magic", source: "EGW"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasChronalShift).toBe(true);
		expect(calculations.chronalShiftUses).toBe(2);
		expect(calculations.hasTemporalAwareness).toBe(true);
		expect(calculations.temporalAwarenessBonus).toBe(3);
	});

	it("should have Momentary Stasis at level 6", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 6, subclass: {name: "Chronurgy Magic", source: "EGW"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasMomentaryStasis).toBe(true);
		// DC = 8 + 3 (prof) + 3 (INT) = 14
		expect(calculations.momentaryStasisDc).toBe(14);
		expect(calculations.momentaryStasisUses).toBe(3);
	});

	it("should have Arcane Abeyance at level 10", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 10, subclass: {name: "Chronurgy Magic", source: "EGW"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasArcaneAbeyance).toBe(true);
	});

	it("should have Convergent Future at level 14", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 14, subclass: {name: "Chronurgy Magic", source: "EGW"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasConvergentFuture).toBe(true);
	});
});

// ==========================================================================
// PART 15: GRAVITURGY MAGIC (EGW)
// ==========================================================================
describe("Graviturgy Magic (EGW)", () => {
	it("should have Adjust Density at level 2", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 2, subclass: {name: "Graviturgy Magic", source: "EGW"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasAdjustDensity).toBe(true);
	});

	it("should have Gravity Well at level 6", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 6, subclass: {name: "Graviturgy Magic", source: "EGW"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasGravityWell).toBe(true);
	});

	it("should have Violent Attraction at level 10", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 10, subclass: {name: "Graviturgy Magic", source: "EGW"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasViolentAttraction).toBe(true);
		expect(calculations.violentAttractionDamage).toBe("2d10");
		expect(calculations.violentAttractionUses).toBe(3);
	});

	it("should have Event Horizon at level 14", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 14, subclass: {name: "Graviturgy Magic", source: "EGW"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasEventHorizon).toBe(true);
		expect(calculations.eventHorizonRange).toBe(30);
	});
});

// ==========================================================================
// PART 16: XPHB SUBCLASSES
// ==========================================================================
describe("XPHB Wizard Subclasses", () => {
	it("should have Abjurer features at level 3 (XPHB)", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "XPHB", level: 3, subclass: {name: "Abjurer", source: "XPHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasArcaneWard).toBe(true);
		// Should NOT have Savant in XPHB
		expect(calculations.hasAbjurationSavant).toBeFalsy();
	});

	it("should have Diviner features at level 3 (XPHB)", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "XPHB", level: 3, subclass: {name: "Diviner", source: "XPHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasPortent).toBe(true);
		// Should NOT have Savant in XPHB
		expect(calculations.hasDivinationSavant).toBeFalsy();
	});

	it("should have Evoker features at level 3 (XPHB)", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "XPHB", level: 3, subclass: {name: "Evoker", source: "XPHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasSculptSpells).toBe(true);
		// Should NOT have Savant in XPHB
		expect(calculations.hasEvocationSavant).toBeFalsy();
	});

	it("should scale Sculpt Spells targets with level (XPHB)", () => {
		const state5 = new CharacterSheetState();
		state5.setRace({name: "High Elf", source: "PHB"});
		state5.addClass({name: "Wizard", source: "XPHB", level: 5, subclass: {name: "Evoker", source: "XPHB"}});
		state5.setAbilityBase("int", 16);
		expect(state5.getFeatureCalculations().sculptSpellsTargets).toBe(2);

		const state10 = new CharacterSheetState();
		state10.setRace({name: "High Elf", source: "PHB"});
		state10.addClass({name: "Wizard", source: "XPHB", level: 10, subclass: {name: "Evoker", source: "XPHB"}});
		state10.setAbilityBase("int", 16);
		expect(state10.getFeatureCalculations().sculptSpellsTargets).toBe(3);
	});

	it("should have Illusionist features at level 3 (XPHB)", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "XPHB", level: 3, subclass: {name: "Illusionist", source: "XPHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasImprovedMinorIllusion).toBe(true);
		// Should NOT have Savant in XPHB
		expect(calculations.hasIllusionSavant).toBeFalsy();
	});
});

// ==========================================================================
// PART 17: PHB VS XPHB COMPARISONS
// ==========================================================================
describe("PHB vs XPHB Edition Comparisons", () => {
	it("should get subclass features at level 2 in PHB", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 2, subclass: {name: "School of Evocation", source: "PHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasSculptSpells).toBe(true);
	});

	it("should NOT get subclass features at level 2 in XPHB", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "XPHB", level: 2, subclass: {name: "Evoker", source: "XPHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasSculptSpells).toBeFalsy();
	});

	it("should get subclass features at level 3 in XPHB", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "XPHB", level: 3, subclass: {name: "Evoker", source: "XPHB"}});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasSculptSpells).toBe(true);
	});

	it("should calculate prepared spells differently between editions", () => {
		// PHB: level + INT mod = 10 + 3 = 13
		const phbState = new CharacterSheetState();
		phbState.setRace({name: "High Elf", source: "PHB"});
		phbState.addClass({name: "Wizard", source: "PHB", level: 10});
		phbState.setAbilityBase("int", 16);
		expect(phbState.getFeatureCalculations().preparedSpells).toBe(13);

		// XPHB: fixed progression at level 10 = 15
		const xphbState = new CharacterSheetState();
		xphbState.setRace({name: "High Elf", source: "PHB"});
		xphbState.addClass({name: "Wizard", source: "XPHB", level: 10});
		xphbState.setAbilityBase("int", 16);
		expect(xphbState.getFeatureCalculations().preparedSpells).toBe(15);
	});

	it("should have XPHB-only features in XPHB wizard", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "XPHB", level: 5});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasRitualAdept).toBe(true);
		expect(calculations.hasScholar).toBe(true);
		expect(calculations.hasMemorizeSpell).toBe(true);
	});

	it("should NOT have XPHB-only features in PHB wizard", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 5});
		state.setAbilityBase("int", 16);
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasRitualAdept).toBeFalsy();
		expect(calculations.hasScholar).toBeFalsy();
		expect(calculations.hasMemorizeSpell).toBeFalsy();
	});
});

// ==========================================================================
// PART 18: ALTERNATE SUBCLASS NAMES
// ==========================================================================
describe("Alternate Subclass Name Handling", () => {
	it("should recognize short names for PHB schools", () => {
		const shortNames = [
			{short: "Abjuration", feature: "hasArcaneWard"},
			{short: "Conjuration", feature: "hasMinorConjuration"},
			{short: "Divination", feature: "hasPortent"},
			{short: "Enchantment", feature: "hasHypnoticGaze"},
			{short: "Evocation", feature: "hasSculptSpells"},
			{short: "Illusion", feature: "hasImprovedMinorIllusion"},
			{short: "Necromancy", feature: "hasGrimHarvest"},
			{short: "Transmutation", feature: "hasMinorAlchemy"},
		];

		for (const {short, feature} of shortNames) {
			const state = new CharacterSheetState();
			state.setRace({name: "High Elf", source: "PHB"});
			state.addClass({name: "Wizard", source: "PHB", level: 2, subclass: {name: short, source: "PHB"}});
			state.setAbilityBase("int", 16);
			const calculations = state.getFeatureCalculations();
			expect(calculations[feature]).toBe(true);
		}
	});

	it("should recognize short names for XGE/EGW/TCE subclasses", () => {
		const shortNames = [
			{short: "War", feature: "hasArcaneDeflection", source: "XGE"},
			{short: "Chronurgy", feature: "hasChronalShift", source: "EGW"},
			{short: "Graviturgy", feature: "hasAdjustDensity", source: "EGW"},
			{short: "Bladesinger", feature: "hasBladesong", source: "TCE"},
			{short: "Scribes", feature: "hasWizardlyQuill", source: "TCE"},
		];

		for (const {short, feature, source} of shortNames) {
			const state = new CharacterSheetState();
			state.setRace({name: "High Elf", source: "PHB"});
			state.addClass({name: "Wizard", source: "PHB", level: 2, subclass: {name: short, source}});
			state.setAbilityBase("int", 16);
			const calculations = state.getFeatureCalculations();
			expect(calculations[feature]).toBe(true);
		}
	});
});

// ==========================================================================
// PART 19: LEVEL PROGRESSION & INTEGRATION
// ==========================================================================
describe("Level Progression and Integration", () => {
	it("should track proficiency bonus correctly at various levels", () => {
		const levels = [
			{level: 1, proficiency: 2},
			{level: 5, proficiency: 3},
			{level: 9, proficiency: 4},
			{level: 13, proficiency: 5},
			{level: 17, proficiency: 6},
		];

		for (const {level, proficiency} of levels) {
			const state = new CharacterSheetState();
			state.setRace({name: "High Elf", source: "PHB"});
			state.addClass({name: "Wizard", source: "PHB", level});
			state.setAbilityBase("int", 10); // +0 modifier
			const calculations = state.getFeatureCalculations();
			expect(calculations.spellSaveDc).toBe(8 + proficiency + 0);
			expect(calculations.spellAttackBonus).toBe(proficiency + 0);
		}
	});

	it("should stack all features at max level", () => {
		const state = new CharacterSheetState();
		state.setRace({name: "High Elf", source: "PHB"});
		state.addClass({name: "Wizard", source: "PHB", level: 20, subclass: {name: "School of Divination", source: "PHB"}});
		state.setAbilityBase("int", 20);

		const calculations = state.getFeatureCalculations();

		// Core features
		expect(calculations.hasSpellcasting).toBe(true);
		expect(calculations.hasArcaneRecovery).toBe(true);
		expect(calculations.hasSpellMastery).toBe(true);
		expect(calculations.hasSignatureSpells).toBe(true);

		// Subclass features
		expect(calculations.hasDivinationSavant).toBe(true);
		expect(calculations.hasPortent).toBe(true);
		expect(calculations.portentDice).toBe(3);
		expect(calculations.hasExpertDivination).toBe(true);
		expect(calculations.hasTheThirdEye).toBe(true);
		expect(calculations.hasGreaterPortent).toBe(true);

		// Calculations
		expect(calculations.spellSaveDc).toBe(19); // 8 + 6 + 5
		expect(calculations.spellAttackBonus).toBe(11); // 6 + 5
		expect(calculations.preparedSpells).toBe(25); // 20 + 5
		expect(calculations.cantripsKnown).toBe(5);
		expect(calculations.arcaneRecoverySlotLevels).toBe(10);
		expect(calculations.spellbookSpellsKnown).toBe(44);
	});
});
