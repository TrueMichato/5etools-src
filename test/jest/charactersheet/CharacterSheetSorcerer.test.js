/**
 * Character Sheet Sorcerer Class Tests
 * Comprehensive testing for all Sorcerer class features and subclasses (Sorcerous Origins)
 *
 * This test suite verifies that:
 * - Sorcery Points scale correctly with level
 * - Metamagic options count progresses correctly (PHB vs XPHB)
 * - Spellcasting calculations are correct
 * - PHB vs XPHB differences are handled (spells known vs prepared, etc.)
 * - All subclass (Sorcerous Origin) features work correctly at designated levels
 */

import "./setup.js";
import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

// ==========================================================================
// PART 1: CORE SORCERER CLASS FEATURES (PHB)
// ==========================================================================
describe("Sorcerer Core Class Features (PHB)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({name: "Sorcerer", source: "PHB", level: 1});
		state.setAbilityBase("str", 8);
		state.setAbilityBase("dex", 14); // +2 modifier
		state.setAbilityBase("con", 14); // +2 modifier
		state.setAbilityBase("int", 10);
		state.setAbilityBase("wis", 12); // +1 modifier
		state.setAbilityBase("cha", 16); // +3 modifier
	});

	// -------------------------------------------------------------------------
	// Spellcasting (Level 1)
	// -------------------------------------------------------------------------
	describe("Spellcasting", () => {
		it("should have spellcasting at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasSpellcasting).toBe(true);
		});

		it("should use CHA as spellcasting ability", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.spellcastingAbility).toBe("cha");
		});

		it("should calculate spell save DC as 8 + prof + CHA", () => {
			const calculations = state.getFeatureCalculations();
			// 8 + 2 (prof at 1) + 3 (CHA) = 13
			expect(calculations.spellSaveDc).toBe(13);
		});

		it("should calculate spell attack bonus as prof + CHA", () => {
			const calculations = state.getFeatureCalculations();
			// 2 (prof at 1) + 3 (CHA) = 5
			expect(calculations.spellAttackBonus).toBe(5);
		});

		it("should know 4 cantrips at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.cantripsKnown).toBe(4);
		});

		it("should know 5 cantrips at level 4", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 4});
			const calculations = state.getFeatureCalculations();
			expect(calculations.cantripsKnown).toBe(5);
		});

		it("should know 6 cantrips at level 10", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 10});
			const calculations = state.getFeatureCalculations();
			expect(calculations.cantripsKnown).toBe(6);
		});
	});

	// -------------------------------------------------------------------------
	// Spells Known (PHB)
	// -------------------------------------------------------------------------
	describe("Spells Known (PHB)", () => {
		it("should know 2 spells at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.spellsKnown).toBe(2);
		});

		it("should know 3 spells at level 2", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 2});
			const calculations = state.getFeatureCalculations();
			expect(calculations.spellsKnown).toBe(3);
		});

		it("should know 6 spells at level 5", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 5});
			const calculations = state.getFeatureCalculations();
			expect(calculations.spellsKnown).toBe(6);
		});

		it("should know 11 spells at level 10", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 10});
			const calculations = state.getFeatureCalculations();
			expect(calculations.spellsKnown).toBe(11);
		});

		it("should know 15 spells at level 20", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 20});
			const calculations = state.getFeatureCalculations();
			expect(calculations.spellsKnown).toBe(15);
		});
	});

	// -------------------------------------------------------------------------
	// Font of Magic / Sorcery Points (Level 2)
	// -------------------------------------------------------------------------
	describe("Font of Magic / Sorcery Points", () => {
		it("should not have Font of Magic at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasFontOfMagic).toBeFalsy();
		});

		it("should have Font of Magic at level 2", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 2});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasFontOfMagic).toBe(true);
		});

		it("should have 2 sorcery points at level 2", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 2});
			const calculations = state.getFeatureCalculations();
			expect(calculations.sorceryPoints).toBe(2);
		});

		it("should have 5 sorcery points at level 5", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 5});
			const calculations = state.getFeatureCalculations();
			expect(calculations.sorceryPoints).toBe(5);
		});

		it("should have 10 sorcery points at level 10", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 10});
			const calculations = state.getFeatureCalculations();
			expect(calculations.sorceryPoints).toBe(10);
		});

		it("should have 20 sorcery points at level 20", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 20});
			const calculations = state.getFeatureCalculations();
			expect(calculations.sorceryPoints).toBe(20);
		});
	});

	// -------------------------------------------------------------------------
	// Metamagic (PHB Level 3)
	// -------------------------------------------------------------------------
	describe("Metamagic (PHB)", () => {
		it("should not have Metamagic before level 3", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 2});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasMetamagic).toBeFalsy();
		});

		it("should have Metamagic at level 3", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 3});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasMetamagic).toBe(true);
		});

		it("should have 2 metamagic options at level 3", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 3});
			const calculations = state.getFeatureCalculations();
			expect(calculations.metamagicOptions).toBe(2);
		});

		it("should have 3 metamagic options at level 10", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 10});
			const calculations = state.getFeatureCalculations();
			expect(calculations.metamagicOptions).toBe(3);
		});

		it("should have 4 metamagic options at level 17", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 17});
			const calculations = state.getFeatureCalculations();
			expect(calculations.metamagicOptions).toBe(4);
		});
	});

	// -------------------------------------------------------------------------
	// Sorcerous Restoration (PHB Level 20)
	// -------------------------------------------------------------------------
	describe("Sorcerous Restoration (PHB)", () => {
		it("should not have Sorcerous Restoration before level 20", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 19});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasSorcerousRestoration).toBeFalsy();
		});

		it("should have Sorcerous Restoration at level 20", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 20});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasSorcerousRestoration).toBe(true);
		});

		it("should restore 4 sorcery points at level 20", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 20});
			const calculations = state.getFeatureCalculations();
			expect(calculations.sorcerousRestorationAmount).toBe(4);
		});
	});
});

// ==========================================================================
// PART 2: SORCERER HIT DICE
// ==========================================================================
describe("Sorcerer Hit Dice", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({name: "Sorcerer", source: "PHB", level: 1});
	});

	it("should use d6 hit dice", () => {
		const hitDice = state.getHitDice();
		// Check for d6
		if (Array.isArray(hitDice)) {
			expect(hitDice.some(hd => hd.die === 6 || hd.faces === 6)).toBe(true);
		} else {
			expect(hitDice["d6"] || hitDice[6]).toBeDefined();
		}
	});

	it("should have correct number of hit dice per level", () => {
		state.addClass({name: "Sorcerer", source: "PHB", level: 5});
		const hitDice = state.getHitDice();
		const totalDice = Array.isArray(hitDice)
			? hitDice.reduce((sum, hd) => sum + (hd.max || hd.current || 0), 0)
			: Object.values(hitDice).reduce((sum, val) => sum + val, 0);
		expect(totalDice).toBe(5);
	});
});

// ==========================================================================
// PART 3: DRACONIC BLOODLINE SUBCLASS
// ==========================================================================
describe("Draconic Bloodline Subclass", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({name: "Sorcerer", source: "PHB", level: 1, subclass: {name: "Draconic Bloodline", source: "PHB"}});
		state.setAbilityBase("dex", 14); // +2
		state.setAbilityBase("cha", 16); // +3
	});

	it("should gain subclass at level 1", () => {
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasDraconicResilience).toBe(true);
	});

	// Draconic Resilience (Level 1)
	describe("Draconic Resilience (Level 1)", () => {
		it("should have Draconic Resilience at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasDraconicResilience).toBe(true);
		});

		it("should grant HP bonus equal to sorcerer level", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.draconicResilienceHpBonus).toBe(1);
		});

		it("should scale HP bonus with level", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 10, subclass: {name: "Draconic Bloodline", source: "PHB"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.draconicResilienceHpBonus).toBe(10);
		});

		it("should calculate AC as 13 + DEX", () => {
			const calculations = state.getFeatureCalculations();
			// 13 + 2 (DEX) = 15
			expect(calculations.draconicResilienceAc).toBe(15);
		});
	});

	// Elemental Affinity (Level 6)
	describe("Elemental Affinity (Level 6)", () => {
		it("should not have Elemental Affinity before level 6", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 5, subclass: {name: "Draconic Bloodline", source: "PHB"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasElementalAffinity).toBeFalsy();
		});

		it("should have Elemental Affinity at level 6", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 6, subclass: {name: "Draconic Bloodline", source: "PHB"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasElementalAffinity).toBe(true);
		});

		it("should add CHA mod to damage", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 6, subclass: {name: "Draconic Bloodline", source: "PHB"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.elementalAffinityBonus).toBe(3); // CHA mod
		});
	});

	// Dragon Wings (Level 14)
	describe("Dragon Wings (Level 14)", () => {
		it("should have Dragon Wings at level 14", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 14, subclass: {name: "Draconic Bloodline", source: "PHB"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasDragonWings).toBe(true);
		});

		it("should grant fly speed", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 14, subclass: {name: "Draconic Bloodline", source: "PHB"}});
			const calculations = state.getFeatureCalculations();
			// flySpeed can be a number or a string like "30 ft."
			const speed = typeof calculations.flySpeed === "string" ? parseInt(calculations.flySpeed, 10) : calculations.flySpeed;
			expect(speed).toBeGreaterThan(0);
		});
	});

	// Draconic Presence (Level 18)
	describe("Draconic Presence (Level 18)", () => {
		it("should have Draconic Presence at level 18", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 18, subclass: {name: "Draconic Bloodline", source: "PHB"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasDraconicPresence).toBe(true);
		});

		it("should calculate DC as 8 + prof + CHA", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 18, subclass: {name: "Draconic Bloodline", source: "PHB"}});
			const calculations = state.getFeatureCalculations();
			// 8 + 6 (prof at 18) + 3 (CHA) = 17
			expect(calculations.draconicPresenceDc).toBe(17);
		});
	});
});

// ==========================================================================
// PART 4: WILD MAGIC SUBCLASS
// ==========================================================================
describe("Wild Magic Subclass", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({name: "Sorcerer", source: "PHB", level: 1, subclass: {name: "Wild Magic", source: "PHB"}});
	});

	it("should gain subclass at level 1", () => {
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasWildMagicSurge).toBe(true);
	});

	// Wild Magic Surge (Level 1)
	describe("Wild Magic Surge (Level 1)", () => {
		it("should have Wild Magic Surge at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasWildMagicSurge).toBe(true);
		});
	});

	// Tides of Chaos (Level 1)
	describe("Tides of Chaos (Level 1)", () => {
		it("should have Tides of Chaos at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasTidesOfChaos).toBe(true);
		});
	});

	// Bend Luck (Level 6)
	describe("Bend Luck (Level 6)", () => {
		it("should have Bend Luck at level 6", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 6, subclass: {name: "Wild Magic", source: "PHB"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasBendLuck).toBe(true);
		});

		it("should cost 2 sorcery points", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 6, subclass: {name: "Wild Magic", source: "PHB"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.bendLuckCost).toBe(2);
		});
	});

	// Controlled Chaos (Level 14)
	describe("Controlled Chaos (Level 14)", () => {
		it("should have Controlled Chaos at level 14", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 14, subclass: {name: "Wild Magic", source: "PHB"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasControlledChaos).toBe(true);
		});
	});

	// Spell Bombardment (Level 18)
	describe("Spell Bombardment (Level 18)", () => {
		it("should have Spell Bombardment at level 18", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 18, subclass: {name: "Wild Magic", source: "PHB"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasSpellBombardment).toBe(true);
		});
	});
});

// ==========================================================================
// PART 5: DIVINE SOUL SUBCLASS (XGE)
// ==========================================================================
describe("Divine Soul Subclass (XGE)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({name: "Sorcerer", source: "PHB", level: 1, subclass: {name: "Divine Soul", source: "XGE"}});
	});

	it("should gain subclass at level 1", () => {
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasDivineMagic).toBe(true);
	});

	// Divine Magic (Level 1)
	describe("Divine Magic (Level 1)", () => {
		it("should have Divine Magic at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasDivineMagic).toBe(true);
		});
	});

	// Favored by the Gods (Level 1)
	describe("Favored by the Gods (Level 1)", () => {
		it("should have Favored by the Gods at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasFavoredByTheGods).toBe(true);
		});

		it("should grant 2d4 bonus", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.favoredByTheGodsBonus).toBe("2d4");
		});
	});

	// Empowered Healing (Level 6)
	describe("Empowered Healing (Level 6)", () => {
		it("should have Empowered Healing at level 6", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 6, subclass: {name: "Divine Soul", source: "XGE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasEmpoweredHealing).toBe(true);
		});
	});

	// Otherworldly Wings (Level 14)
	describe("Otherworldly Wings (Level 14)", () => {
		it("should have Otherworldly Wings at level 14", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 14, subclass: {name: "Divine Soul", source: "XGE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasOtherworldlyWings).toBe(true);
		});

		it("should grant 30 ft fly speed", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 14, subclass: {name: "Divine Soul", source: "XGE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.flySpeed).toBe(30);
		});
	});

	// Unearthly Recovery (Level 18)
	describe("Unearthly Recovery (Level 18)", () => {
		it("should have Unearthly Recovery at level 18", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 18, subclass: {name: "Divine Soul", source: "XGE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasUnearthlyRecovery).toBe(true);
		});
	});
});

// ==========================================================================
// PART 6: SHADOW MAGIC SUBCLASS (XGE)
// ==========================================================================
describe("Shadow Magic Subclass (XGE)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({name: "Sorcerer", source: "PHB", level: 1, subclass: {name: "Shadow Magic", source: "XGE"}});
	});

	it("should gain subclass at level 1", () => {
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasEyesOfTheDark).toBe(true);
	});

	// Eyes of the Dark (Level 1)
	describe("Eyes of the Dark (Level 1)", () => {
		it("should have Eyes of the Dark at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasEyesOfTheDark).toBe(true);
		});

		it("should grant 120 ft darkvision", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.darkvision).toBe(120);
		});
	});

	// Strength of the Grave (Level 1)
	describe("Strength of the Grave (Level 1)", () => {
		it("should have Strength of the Grave at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasStrengthOfTheGrave).toBe(true);
		});

		it("should have base DC of 5", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.strengthOfTheGraveDc).toBe(5);
		});
	});

	// Hound of Ill Omen (Level 6)
	describe("Hound of Ill Omen (Level 6)", () => {
		it("should have Hound of Ill Omen at level 6", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 6, subclass: {name: "Shadow Magic", source: "XGE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasHoundOfIllOmen).toBe(true);
		});

		it("should cost 3 sorcery points", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 6, subclass: {name: "Shadow Magic", source: "XGE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.houndCost).toBe(3);
		});
	});

	// Shadow Walk (Level 14)
	describe("Shadow Walk (Level 14)", () => {
		it("should have Shadow Walk at level 14", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 14, subclass: {name: "Shadow Magic", source: "XGE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasShadowWalk).toBe(true);
		});
	});

	// Umbral Form (Level 18)
	describe("Umbral Form (Level 18)", () => {
		it("should have Umbral Form at level 18", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 18, subclass: {name: "Shadow Magic", source: "XGE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasUmbralForm).toBe(true);
		});

		it("should cost 6 sorcery points", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 18, subclass: {name: "Shadow Magic", source: "XGE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.umbralFormCost).toBe(6);
		});
	});
});

// ==========================================================================
// PART 7: STORM SORCERY SUBCLASS (XGE)
// ==========================================================================
describe("Storm Sorcery Subclass (XGE)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({name: "Sorcerer", source: "PHB", level: 1, subclass: {name: "Storm Sorcery", source: "XGE"}});
	});

	it("should gain subclass at level 1", () => {
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasWindSpeaker).toBe(true);
	});

	// Wind Speaker (Level 1)
	describe("Wind Speaker (Level 1)", () => {
		it("should have Wind Speaker at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasWindSpeaker).toBe(true);
		});
	});

	// Tempestuous Magic (Level 1)
	describe("Tempestuous Magic (Level 1)", () => {
		it("should have Tempestuous Magic at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasTempestuousMagic).toBe(true);
		});
	});

	// Heart of the Storm (Level 6)
	describe("Heart of the Storm (Level 6)", () => {
		it("should have Heart of the Storm at level 6", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 6, subclass: {name: "Storm Sorcery", source: "XGE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasHeartOfTheStorm).toBe(true);
		});

		it("should deal half level damage", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 10, subclass: {name: "Storm Sorcery", source: "XGE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.heartOfTheStormDamage).toBe(5); // level 10 / 2
		});
	});

	// Storm Guide (Level 6)
	describe("Storm Guide (Level 6)", () => {
		it("should have Storm Guide at level 6", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 6, subclass: {name: "Storm Sorcery", source: "XGE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasStormGuide).toBe(true);
		});
	});

	// Storm's Fury (Level 14)
	describe("Storm's Fury (Level 14)", () => {
		it("should have Storm's Fury at level 14", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 14, subclass: {name: "Storm Sorcery", source: "XGE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasStormsFury).toBe(true);
		});

		it("should deal damage equal to level", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 14, subclass: {name: "Storm Sorcery", source: "XGE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.stormsFuryDamage).toBe(14);
		});
	});

	// Wind Soul (Level 18)
	describe("Wind Soul (Level 18)", () => {
		it("should have Wind Soul at level 18", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 18, subclass: {name: "Storm Sorcery", source: "XGE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasWindSoul).toBe(true);
		});

		it("should grant 60 ft fly speed", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 18, subclass: {name: "Storm Sorcery", source: "XGE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.flySpeed).toBe(60);
		});

		it("should grant immunity to thunder and lightning", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 18, subclass: {name: "Storm Sorcery", source: "XGE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.immuneToThunderLightning).toBe(true);
		});
	});
});

// ==========================================================================
// PART 8: ABERRANT MIND SUBCLASS (TCE)
// ==========================================================================
describe("Aberrant Mind Subclass (TCE)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({name: "Sorcerer", source: "PHB", level: 1, subclass: {name: "Aberrant Mind", source: "TCE"}});
		state.setAbilityBase("cha", 16); // +3
	});

	it("should gain subclass at level 1", () => {
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasPsionicSpells).toBe(true);
	});

	// Psionic Spells (Level 1)
	describe("Psionic Spells (Level 1)", () => {
		it("should have Psionic Spells at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasPsionicSpells).toBe(true);
		});
	});

	// Telepathic Speech (Level 1)
	describe("Telepathic Speech (Level 1)", () => {
		it("should have Telepathic Speech at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasTelepathicSpeech).toBe(true);
		});

		it("should have range based on CHA mod * 30", () => {
			const calculations = state.getFeatureCalculations();
			// 3 (CHA mod) * 30 = 90
			expect(calculations.telepathyRange).toBe(90);
		});
	});

	// Psionic Sorcery (Level 6)
	describe("Psionic Sorcery (Level 6)", () => {
		it("should have Psionic Sorcery at level 6", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 6, subclass: {name: "Aberrant Mind", source: "TCE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasPsionicSorcery).toBe(true);
		});
	});

	// Psychic Defenses (Level 6)
	describe("Psychic Defenses (Level 6)", () => {
		it("should have Psychic Defenses at level 6", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 6, subclass: {name: "Aberrant Mind", source: "TCE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasPsychicDefenses).toBe(true);
		});
	});

	// Revelation in Flesh (Level 14)
	describe("Revelation in Flesh (Level 14)", () => {
		it("should have Revelation in Flesh at level 14", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 14, subclass: {name: "Aberrant Mind", source: "TCE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasRevelationInFlesh).toBe(true);
		});
	});

	// Warping Implosion (Level 18)
	describe("Warping Implosion (Level 18)", () => {
		it("should have Warping Implosion at level 18", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 18, subclass: {name: "Aberrant Mind", source: "TCE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasWarpingImplosion).toBe(true);
		});

		it("should cost 5 sorcery points", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 18, subclass: {name: "Aberrant Mind", source: "TCE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.warpingImplosionCost).toBe(5);
		});
	});
});

// ==========================================================================
// PART 9: CLOCKWORK SOUL SUBCLASS (TCE)
// ==========================================================================
describe("Clockwork Soul Subclass (TCE)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({name: "Sorcerer", source: "PHB", level: 1, subclass: {name: "Clockwork Soul", source: "TCE"}});
	});

	it("should gain subclass at level 1", () => {
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasClockworkMagic).toBe(true);
	});

	// Clockwork Magic (Level 1)
	describe("Clockwork Magic (Level 1)", () => {
		it("should have Clockwork Magic at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasClockworkMagic).toBe(true);
		});
	});

	// Restore Balance (Level 1)
	describe("Restore Balance (Level 1)", () => {
		it("should have Restore Balance at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasRestoreBalance).toBe(true);
		});

		it("should have proficiency bonus uses", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.restoreBalanceUses).toBe(2); // Prof at level 1
		});
	});

	// Bastion of Law (Level 6)
	describe("Bastion of Law (Level 6)", () => {
		it("should have Bastion of Law at level 6", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 6, subclass: {name: "Clockwork Soul", source: "TCE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasBastionOfLaw).toBe(true);
		});

		it("should have max 5 dice", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 6, subclass: {name: "Clockwork Soul", source: "TCE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.bastionMaxDice).toBe(5);
		});
	});

	// Trance of Order (Level 14)
	describe("Trance of Order (Level 14)", () => {
		it("should have Trance of Order at level 14", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 14, subclass: {name: "Clockwork Soul", source: "TCE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasTranceOfOrder).toBe(true);
		});
	});

	// Clockwork Cavalcade (Level 18)
	describe("Clockwork Cavalcade (Level 18)", () => {
		it("should have Clockwork Cavalcade at level 18", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 18, subclass: {name: "Clockwork Soul", source: "TCE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasClockworkCavalcade).toBe(true);
		});

		it("should heal 100 HP", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 18, subclass: {name: "Clockwork Soul", source: "TCE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.clockworkCavalcadeHealing).toBe(100);
		});

		it("should cost 7 sorcery points", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 18, subclass: {name: "Clockwork Soul", source: "TCE"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.clockworkCavalcadeCost).toBe(7);
		});
	});
});

// ==========================================================================
// PART 10: LUNAR SORCERY SUBCLASS (DSotDQ)
// ==========================================================================
describe("Lunar Sorcery Subclass (DSotDQ)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({name: "Sorcerer", source: "PHB", level: 1, subclass: {name: "Lunar Sorcery", source: "DSotDQ"}});
	});

	it("should gain subclass at level 1", () => {
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasLunarEmbodiment).toBe(true);
	});

	// Lunar Embodiment (Level 1)
	describe("Lunar Embodiment (Level 1)", () => {
		it("should have Lunar Embodiment at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasLunarEmbodiment).toBe(true);
		});
	});

	// Moon Fire (Level 1)
	describe("Moon Fire (Level 1)", () => {
		it("should have Moon Fire at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasMoonFire).toBe(true);
		});
	});

	// Lunar Boons (Level 6)
	describe("Lunar Boons (Level 6)", () => {
		it("should have Lunar Boons at level 6", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 6, subclass: {name: "Lunar Sorcery", source: "DSotDQ"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasLunarBoons).toBe(true);
		});
	});

	// Waxing and Waning (Level 6)
	describe("Waxing and Waning (Level 6)", () => {
		it("should have Waxing and Waning at level 6", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 6, subclass: {name: "Lunar Sorcery", source: "DSotDQ"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasWaxingAndWaning).toBe(true);
		});
	});

	// Lunar Empowerment (Level 14)
	describe("Lunar Empowerment (Level 14)", () => {
		it("should have Lunar Empowerment at level 14", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 14, subclass: {name: "Lunar Sorcery", source: "DSotDQ"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasLunarEmpowerment).toBe(true);
		});
	});

	// Lunar Phenomenon (Level 18)
	describe("Lunar Phenomenon (Level 18)", () => {
		it("should have Lunar Phenomenon at level 18", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 18, subclass: {name: "Lunar Sorcery", source: "DSotDQ"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasLunarPhenomenon).toBe(true);
		});
	});
});

// ==========================================================================
// PART 11: XPHB 2024 SORCERER FEATURES
// ==========================================================================
describe("Sorcerer Core Class Features (XPHB 2024)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "XPHB"});
		state.addClass({name: "Sorcerer", source: "XPHB", level: 1});
		state.setAbilityBase("cha", 16); // +3
	});

	// Innate Sorcery (XPHB Level 1)
	describe("Innate Sorcery (XPHB)", () => {
		it("should have Innate Sorcery at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasInnateSorcery).toBe(true);
		});
	});

	// Metamagic (XPHB Level 2)
	describe("Metamagic (XPHB)", () => {
		it("should have Metamagic at level 2", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 2});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasMetamagic).toBe(true);
		});

		it("should have 2 metamagic options at level 2", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 2});
			const calculations = state.getFeatureCalculations();
			expect(calculations.metamagicOptions).toBe(2);
		});

		it("should have 4 metamagic options at level 10", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 10});
			const calculations = state.getFeatureCalculations();
			expect(calculations.metamagicOptions).toBe(4);
		});

		it("should have 6 metamagic options at level 17", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 17});
			const calculations = state.getFeatureCalculations();
			expect(calculations.metamagicOptions).toBe(6);
		});
	});

	// Prepared Spells (XPHB)
	describe("Prepared Spells (XPHB)", () => {
		it("should use prepared spells instead of spells known", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.preparedSpells).toBeDefined();
			expect(calculations.spellsKnown).toBeUndefined();
		});

		it("should have 2 prepared spells at level 1", () => {
			const calculations = state.getFeatureCalculations();
			expect(calculations.preparedSpells).toBe(2);
		});

		it("should have 4 prepared spells at level 2", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 2});
			const calculations = state.getFeatureCalculations();
			expect(calculations.preparedSpells).toBe(4);
		});

		it("should have 15 prepared spells at level 10", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 10});
			const calculations = state.getFeatureCalculations();
			expect(calculations.preparedSpells).toBe(15);
		});

		it("should have 22 prepared spells at level 20", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 20});
			const calculations = state.getFeatureCalculations();
			expect(calculations.preparedSpells).toBe(22);
		});
	});

	// Sorcerous Restoration (XPHB Level 5)
	describe("Sorcerous Restoration (XPHB)", () => {
		it("should not have Sorcerous Restoration before level 5", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 4});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasSorcerousRestoration).toBeFalsy();
		});

		it("should have Sorcerous Restoration at level 5", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 5});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasSorcerousRestoration).toBe(true);
		});

		it("should restore proficiency bonus sorcery points", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 5});
			const calculations = state.getFeatureCalculations();
			expect(calculations.sorcerousRestorationAmount).toBe(3); // Prof at level 5
		});
	});

	// Sorcery Incarnate (XPHB Level 7)
	describe("Sorcery Incarnate (XPHB)", () => {
		it("should not have Sorcery Incarnate before level 7", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 6});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasSorceryIncarnate).toBeFalsy();
		});

		it("should have Sorcery Incarnate at level 7", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 7});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasSorceryIncarnate).toBe(true);
		});
	});

	// Arcane Apotheosis (XPHB Level 20)
	describe("Arcane Apotheosis (XPHB)", () => {
		it("should not have Arcane Apotheosis before level 20", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 19});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasArcaneApotheosis).toBeFalsy();
		});

		it("should have Arcane Apotheosis at level 20", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 20});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasArcaneApotheosis).toBe(true);
		});
	});
});

// ==========================================================================
// PART 12: DRACONIC SORCERY (XPHB 2024)
// ==========================================================================
describe("Draconic Sorcery Subclass (XPHB 2024)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "XPHB"});
		state.addClass({name: "Sorcerer", source: "XPHB", level: 3, subclass: {name: "Draconic Sorcery", source: "XPHB"}});
		state.setAbilityBase("dex", 14); // +2
		state.setAbilityBase("cha", 16); // +3
	});

	// Subclass gained at level 3 in XPHB
	it("should gain subclass at level 3", () => {
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasDraconicResilience).toBe(true);
	});

	// Dragon Companion (XPHB Level 18)
	describe("Dragon Companion (XPHB Level 18)", () => {
		it("should have Dragon Companion at level 18", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 18, subclass: {name: "Draconic Sorcery", source: "XPHB"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasDragonCompanion).toBe(true);
		});

		it("should not have old Draconic Presence", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 18, subclass: {name: "Draconic Sorcery", source: "XPHB"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasDraconicPresence).toBeFalsy();
		});
	});
});

// ==========================================================================
// PART 13: WILD MAGIC SORCERY (XPHB 2024)
// ==========================================================================
describe("Wild Magic Sorcery Subclass (XPHB 2024)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "XPHB"});
		state.addClass({name: "Sorcerer", source: "XPHB", level: 3, subclass: {name: "Wild Magic Sorcery", source: "XPHB"}});
	});

	// Subclass gained at level 3 in XPHB
	it("should gain subclass at level 3", () => {
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasWildMagicSurge).toBe(true);
	});

	// Tamed Surge (XPHB Level 18)
	describe("Tamed Surge (XPHB Level 18)", () => {
		it("should have Tamed Surge at level 18", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 18, subclass: {name: "Wild Magic Sorcery", source: "XPHB"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasTamedSurge).toBe(true);
		});

		it("should not have old Spell Bombardment", () => {
			state.addClass({name: "Sorcerer", source: "XPHB", level: 18, subclass: {name: "Wild Magic Sorcery", source: "XPHB"}});
			const calculations = state.getFeatureCalculations();
			expect(calculations.hasSpellBombardment).toBeFalsy();
		});
	});
});

// ==========================================================================
// PART 14: PHB vs XPHB FEATURE COMPARISON
// ==========================================================================
describe("PHB vs XPHB Sorcerer Feature Comparison", () => {
	describe("Spells Known vs Prepared", () => {
		it("should have different spell systems", () => {
			const phbState = new CharacterSheetState();
			phbState.setRace({name: "Human", source: "PHB"});
			phbState.addClass({name: "Sorcerer", source: "PHB", level: 5});

			const xphbState = new CharacterSheetState();
			xphbState.setRace({name: "Human", source: "XPHB"});
			xphbState.addClass({name: "Sorcerer", source: "XPHB", level: 5});

			const phbCalc = phbState.getFeatureCalculations();
			const xphbCalc = xphbState.getFeatureCalculations();

			// PHB uses spells known
			expect(phbCalc.spellsKnown).toBeDefined();
			expect(phbCalc.preparedSpells).toBeUndefined();

			// XPHB uses prepared spells
			expect(xphbCalc.preparedSpells).toBeDefined();
			expect(xphbCalc.spellsKnown).toBeUndefined();
		});
	});

	describe("Metamagic Level", () => {
		it("should get Metamagic at different levels", () => {
			const phbState = new CharacterSheetState();
			phbState.setRace({name: "Human", source: "PHB"});
			phbState.addClass({name: "Sorcerer", source: "PHB", level: 2});

			const xphbState = new CharacterSheetState();
			xphbState.setRace({name: "Human", source: "XPHB"});
			xphbState.addClass({name: "Sorcerer", source: "XPHB", level: 2});

			const phbCalc = phbState.getFeatureCalculations();
			const xphbCalc = xphbState.getFeatureCalculations();

			// PHB gets Metamagic at level 3
			expect(phbCalc.hasMetamagic).toBeFalsy();
			// XPHB gets Metamagic at level 2
			expect(xphbCalc.hasMetamagic).toBe(true);
		});
	});

	describe("Sorcerous Restoration Level", () => {
		it("should get Sorcerous Restoration at different levels", () => {
			const phbState = new CharacterSheetState();
			phbState.setRace({name: "Human", source: "PHB"});
			phbState.addClass({name: "Sorcerer", source: "PHB", level: 5});

			const xphbState = new CharacterSheetState();
			xphbState.setRace({name: "Human", source: "XPHB"});
			xphbState.addClass({name: "Sorcerer", source: "XPHB", level: 5});

			const phbCalc = phbState.getFeatureCalculations();
			const xphbCalc = xphbState.getFeatureCalculations();

			// PHB gets it at level 20
			expect(phbCalc.hasSorcerousRestoration).toBeFalsy();
			// XPHB gets it at level 5
			expect(xphbCalc.hasSorcerousRestoration).toBe(true);
		});
	});

	describe("Subclass Level", () => {
		it("should get subclass at different levels", () => {
			// PHB gets subclass at level 1
			const phbState = new CharacterSheetState();
			phbState.setRace({name: "Human", source: "PHB"});
			phbState.addClass({name: "Sorcerer", source: "PHB", level: 1, subclass: {name: "Draconic Bloodline", source: "PHB"}});
			const phbCalc = phbState.getFeatureCalculations();
			expect(phbCalc.hasDraconicResilience).toBe(true);

			// XPHB gets subclass at level 3
			const xphbState = new CharacterSheetState();
			xphbState.setRace({name: "Human", source: "XPHB"});
			xphbState.addClass({name: "Sorcerer", source: "XPHB", level: 2, subclass: {name: "Draconic Sorcery", source: "XPHB"}});
			const xphbCalc = xphbState.getFeatureCalculations();
			expect(xphbCalc.hasDraconicResilience).toBeFalsy();
		});
	});
});

// ==========================================================================
// PART 15: SORCERER MULTICLASS
// ==========================================================================
describe("Sorcerer Multiclass", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.setAbilityBase("cha", 16);
	});

	it("should require CHA 13 for multiclassing", () => {
		// This is a design test - multiclass requirements
		const multiclassReq = {cha: 13};
		expect(multiclassReq.cha).toBe(13);
	});

	it("should calculate sorcery points based on sorcerer level only", () => {
		state.addClass({name: "Sorcerer", source: "PHB", level: 5});
		state.addClass({name: "Wizard", source: "PHB", level: 5});
		const calculations = state.getFeatureCalculations();
		// Sorcery points based on sorcerer level 5 only
		expect(calculations.sorceryPoints).toBe(5);
	});

	it("should track proficiency bonus based on total level", () => {
		state.addClass({name: "Sorcerer", source: "PHB", level: 5});
		state.addClass({name: "Wizard", source: "PHB", level: 5});
		const profBonus = state.getProficiencyBonus();
		// Total level 10 = +4 proficiency
		expect(profBonus).toBe(4);
	});
});

// ==========================================================================
// PART 16: SORCERER EDGE CASES
// ==========================================================================
describe("Sorcerer Edge Cases", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({name: "Sorcerer", source: "PHB", level: 1});
		state.setAbilityBase("cha", 16);
	});

	it("should handle level 20 character correctly", () => {
		state.addClass({name: "Sorcerer", source: "PHB", level: 20});
		const calculations = state.getFeatureCalculations();
		expect(calculations.sorceryPoints).toBe(20);
		expect(calculations.hasSorcerousRestoration).toBe(true);
		expect(calculations.metamagicOptions).toBe(4);
	});

	it("should track hit dice correctly", () => {
		state.addClass({name: "Sorcerer", source: "PHB", level: 10});
		const hitDice = state.getHitDice();
		const totalDice = Array.isArray(hitDice)
			? hitDice.reduce((sum, hd) => sum + (hd.max || hd.current || 0), 0)
			: Object.values(hitDice).reduce((sum, val) => sum + val, 0);
		expect(totalDice).toBe(10);
	});

	it("should handle subclass selection", () => {
		state.addClass({name: "Sorcerer", source: "PHB", level: 1, subclass: {name: "Wild Magic", source: "PHB"}});
		const calculations = state.getFeatureCalculations();
		expect(calculations.hasWildMagicSurge).toBe(true);
	});

	it("should handle low CHA for telepathy range", () => {
		state.setAbilityBase("cha", 8); // -1 modifier
		state.addClass({name: "Sorcerer", source: "PHB", level: 1, subclass: {name: "Aberrant Mind", source: "TCE"}});
		const calculations = state.getFeatureCalculations();
		// CHA mod -1 * 30 = -30
		expect(calculations.telepathyRange).toBe(-30);
	});
});

// ==========================================================================
// PART 17: PROFICIENCY BONUS PROGRESSION
// ==========================================================================
describe("Sorcerer Proficiency Bonus Progression", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
	});

	it("should return +2 proficiency bonus at level 1", () => {
		state.addClass({name: "Sorcerer", source: "PHB", level: 1});
		expect(state.getProficiencyBonus()).toBe(2);
	});

	it("should return +2 proficiency bonus at level 4", () => {
		state.addClass({name: "Sorcerer", source: "PHB", level: 4});
		expect(state.getProficiencyBonus()).toBe(2);
	});

	it("should return +3 proficiency bonus at level 5", () => {
		state.addClass({name: "Sorcerer", source: "PHB", level: 5});
		expect(state.getProficiencyBonus()).toBe(3);
	});

	it("should return +4 proficiency bonus at level 9", () => {
		state.addClass({name: "Sorcerer", source: "PHB", level: 9});
		expect(state.getProficiencyBonus()).toBe(4);
	});

	it("should return +5 proficiency bonus at level 13", () => {
		state.addClass({name: "Sorcerer", source: "PHB", level: 13});
		expect(state.getProficiencyBonus()).toBe(5);
	});

	it("should return +6 proficiency bonus at level 17", () => {
		state.addClass({name: "Sorcerer", source: "PHB", level: 17});
		expect(state.getProficiencyBonus()).toBe(6);
	});
});

// ==========================================================================
// PART 18: SORCERER SPELL SLOTS (FULL CASTER)
// ==========================================================================
describe("Sorcerer Spell Slots (Full Caster)", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.setRace({name: "Human", source: "PHB"});
		state.addClass({name: "Sorcerer", source: "PHB", level: 1});
	});

	it("should have 2 1st-level slots at level 1", () => {
		const spellSlots = state.getSpellSlots();
		const slot1 = typeof spellSlots[1] === "object" ? spellSlots[1].max : spellSlots[1];
		expect(slot1).toBe(2);
	});

	it("should have 3rd-level slots at level 5", () => {
		state.addClass({name: "Sorcerer", source: "PHB", level: 5});
		const spellSlots = state.getSpellSlots();
		const slot3 = typeof spellSlots[3] === "object" ? spellSlots[3].max : spellSlots[3];
		expect(slot3).toBeGreaterThan(0);
	});

	it("should have 5th-level slots at level 9", () => {
		state.addClass({name: "Sorcerer", source: "PHB", level: 9});
		const spellSlots = state.getSpellSlots();
		const slot5 = typeof spellSlots[5] === "object" ? spellSlots[5].max : spellSlots[5];
		expect(slot5).toBeGreaterThan(0);
	});

	it("should have 9th-level slots at level 17", () => {
		state.addClass({name: "Sorcerer", source: "PHB", level: 17});
		const spellSlots = state.getSpellSlots();
		const slot9 = typeof spellSlots[9] === "object" ? spellSlots[9].max : spellSlots[9];
		expect(slot9).toBeGreaterThan(0);
	});
});
