/**
 * Character Sheet Spellcasting - Unit Tests
 * Tests for spell slots, spell save DC, spell attack, concentration, and spell management
 */

import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

describe("Spellcasting", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
	});

	// ==========================================================================
	// Spell Slots
	// ==========================================================================
	describe("Spell Slots", () => {
		beforeEach(() => {
			// Level 5 Wizard
			state.addClass({name: "Wizard", source: "PHB", level: 5});
			state.setAbilityBase("int", 16);
		});

		it("should have correct spell slots for level 5 wizard", () => {
			const slots = state.getSpellSlots();
			expect(slots[1]?.max).toBe(4); // 4 first-level slots
			expect(slots[2]?.max).toBe(3); // 3 second-level slots
			expect(slots[3]?.max).toBe(2); // 2 third-level slots
		});

		it("should track current spell slot usage", () => {
			state.setSpellSlots(1, 4, 4);
			state.useSpellSlot(1);
			expect(state.getSpellSlots()[1].current).toBe(3);
		});

		it("should not use slot if none available", () => {
			state.setSpellSlots(3, 0, 2);
			const result = state.useSpellSlot(3);
			expect(result).toBe(false);
			expect(state.getSpellSlots()[3].current).toBe(0);
		});

		it("should restore spell slots", () => {
			state.setSpellSlots(1, 1, 4);
			state.restoreSpellSlot(1);
			expect(state.getSpellSlots()[1].current).toBe(2);
		});

		it("should not exceed max when restoring", () => {
			state.setSpellSlots(1, 4, 4);
			state.restoreSpellSlot(1);
			expect(state.getSpellSlots()[1].current).toBe(4);
		});

		it("should restore all slots on long rest", () => {
			state.setSpellSlots(1, 1, 4);
			state.setSpellSlots(2, 0, 3);
			state.restoreAllSpellSlots();
			expect(state.getSpellSlots()[1].current).toBe(4);
			expect(state.getSpellSlots()[2].current).toBe(3);
		});
	});

	// ==========================================================================
	// Spell Slot Progression by Level
	// ==========================================================================
	describe("Spell Slot Progression", () => {
		const slotProgression = [
			{level: 1, slots: {1: 2}},
			{level: 2, slots: {1: 3}},
			{level: 3, slots: {1: 4, 2: 2}},
			{level: 4, slots: {1: 4, 2: 3}},
			{level: 5, slots: {1: 4, 2: 3, 3: 2}},
			{level: 9, slots: {1: 4, 2: 3, 3: 3, 4: 3, 5: 1}},
		];

		slotProgression.forEach(({level, slots}) => {
			it(`should have correct slots at level ${level}`, () => {
				const wizardState = new CharacterSheetState();
				wizardState.addClass({name: "Wizard", source: "PHB", level});
				const actualSlots = wizardState.getSpellSlots();

				Object.entries(slots).forEach(([slotLevel, expectedMax]) => {
					expect(actualSlots[slotLevel]?.max).toBe(expectedMax);
				});
			});
		});
	});

	// ==========================================================================
	// Pact Magic (Warlock)
	// ==========================================================================
	describe("Pact Magic", () => {
		beforeEach(() => {
			state.addClass({name: "Warlock", source: "PHB", level: 5});
			state.setAbilityBase("cha", 16);
		});

		it("should have pact slots instead of normal slots", () => {
			const pactSlots = state.getPactSlots();
			expect(pactSlots).toBeDefined();
			expect(pactSlots.max).toBe(2); // Level 5 warlock = 2 pact slots
			expect(pactSlots.level).toBe(3); // 3rd level slots
		});

		it("should use pact slots", () => {
			state.setPactSlots(2, 2, 3);
			state.usePactSlot();
			expect(state.getPactSlots().current).toBe(1);
		});

		it("should restore pact slots on short rest", () => {
			state.setPactSlots(0, 2, 3);
			state.restorePactSlots();
			expect(state.getPactSlots().current).toBe(2);
		});
	});

	// ==========================================================================
	// Spell Save DC
	// ==========================================================================
	describe("Spell Save DC", () => {
		it("should calculate wizard spell save DC (8 + prof + INT)", () => {
			state.addClass({name: "Wizard", source: "PHB", level: 5});
			state.setAbilityBase("int", 16);
			state.setSpellcastingAbility("int");
			// DC = 8 + 3 (prof at level 5) + 3 (INT mod) = 14
			expect(state.getSpellSaveDC()).toBe(14);
		});

		it("should calculate cleric spell save DC (8 + prof + WIS)", () => {
			state.addClass({name: "Cleric", source: "PHB", level: 5});
			state.setAbilityBase("wis", 18);
			state.setSpellcastingAbility("wis");
			// DC = 8 + 3 + 4 = 15
			expect(state.getSpellSaveDC()).toBe(15);
		});

		it("should calculate sorcerer spell save DC (8 + prof + CHA)", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 1});
			state.setAbilityBase("cha", 16);
			state.setSpellcastingAbility("cha");
			// DC = 8 + 2 + 3 = 13
			expect(state.getSpellSaveDC()).toBe(13);
		});

		it("should include item bonuses to spell save DC", () => {
			state.addClass({name: "Wizard", source: "PHB", level: 5});
			state.setAbilityBase("int", 16);
			state.setSpellcastingAbility("int");
			state.setItemBonus("spellSaveDc", 2); // +2 from Arcane Grimoire
			expect(state.getSpellSaveDC()).toBe(16);
		});
	});

	// ==========================================================================
	// Spell Attack Bonus
	// ==========================================================================
	describe("Spell Attack Bonus", () => {
		it("should calculate spell attack bonus (prof + ability mod)", () => {
			state.addClass({name: "Wizard", source: "PHB", level: 5});
			state.setAbilityBase("int", 16);
			state.setSpellcastingAbility("int");
			// Attack = 3 (prof) + 3 (INT) = +6
			expect(state.getSpellAttackBonus()).toBe(6);
		});

		it("should scale with level", () => {
			state.addClass({name: "Wizard", source: "PHB", level: 9});
			state.setAbilityBase("int", 16);
			state.setSpellcastingAbility("int");
			// Attack = 4 (prof at level 9) + 3 (INT) = +7
			expect(state.getSpellAttackBonus()).toBe(7);
		});

		it("should include item bonuses", () => {
			state.addClass({name: "Wizard", source: "PHB", level: 5});
			state.setAbilityBase("int", 16);
			state.setSpellcastingAbility("int");
			state.setItemBonus("spellAttack", 1);
			expect(state.getSpellAttackBonus()).toBe(7);
		});
	});

	// ==========================================================================
	// Known Spells
	// ==========================================================================
	describe("Known Spells", () => {
		beforeEach(() => {
			state.addClass({name: "Wizard", source: "PHB", level: 5});
		});

		it("should add a known spell", () => {
			state.addKnownSpell({name: "Fireball", source: "PHB", level: 3});
			const spells = state.getKnownSpells();
			expect(spells).toHaveLength(1);
			expect(spells[0].name).toBe("Fireball");
		});

		it("should track spell level", () => {
			state.addKnownSpell({name: "Magic Missile", source: "PHB", level: 1});
			const spell = state.getKnownSpells()[0];
			expect(spell.level).toBe(1);
		});

		it("should remove a known spell", () => {
			state.addKnownSpell({name: "Shield", source: "PHB", level: 1, id: "spell1"});
			state.removeKnownSpell("spell1");
			expect(state.getKnownSpells()).toHaveLength(0);
		});

		it("should track prepared status", () => {
			state.addKnownSpell({name: "Detect Magic", source: "PHB", level: 1, prepared: true});
			const spell = state.getKnownSpells()[0];
			expect(spell.prepared).toBe(true);
		});

		it("should toggle prepared status", () => {
			state.addKnownSpell({name: "Sleep", source: "PHB", level: 1, id: "spell1", prepared: false});
			state.toggleSpellPrepared("spell1");
			expect(state.getKnownSpells()[0].prepared).toBe(true);
		});
	});

	// ==========================================================================
	// Cantrips
	// ==========================================================================
	describe("Cantrips", () => {
		beforeEach(() => {
			state.addClass({name: "Wizard", source: "PHB", level: 5});
		});

		it("should add a cantrip", () => {
			state.addCantrip({name: "Fire Bolt", source: "PHB"});
			const cantrips = state.getCantrips();
			expect(cantrips).toHaveLength(1);
		});

		it("should track cantrips separately from spells", () => {
			state.addCantrip({name: "Prestidigitation", source: "PHB"});
			state.addKnownSpell({name: "Magic Missile", source: "PHB", level: 1});
			expect(state.getCantrips()).toHaveLength(1);
			expect(state.getKnownSpells()).toHaveLength(1);
		});

		it("should get cantrip damage scaling by level", () => {
			// Cantrip damage scales at levels 5, 11, 17
			expect(state.getCantripDice()).toBe(2); // Level 5 = 2 dice
		});

		it("should scale cantrip damage at level 11", () => {
			const highLevel = new CharacterSheetState();
			highLevel.addClass({name: "Wizard", source: "PHB", level: 11});
			expect(highLevel.getCantripDice()).toBe(3); // Level 11 = 3 dice
		});

		it("should scale cantrip damage at level 17", () => {
			const highLevel = new CharacterSheetState();
			highLevel.addClass({name: "Wizard", source: "PHB", level: 17});
			expect(highLevel.getCantripDice()).toBe(4); // Level 17 = 4 dice
		});
	});

	// ==========================================================================
	// Concentration
	// ==========================================================================
	describe("Concentration", () => {
		beforeEach(() => {
			state.addClass({name: "Wizard", source: "PHB", level: 5});
			state.setAbilityBase("con", 14);
		});

		it("should set concentrating spell", () => {
			state.setConcentrating({name: "Haste", source: "PHB"});
			expect(state.isConcentrating()).toBe(true);
		});

		it("should get concentrating spell name", () => {
			state.setConcentrating({name: "Fly", source: "PHB"});
			expect(state.getConcentratingSpell().name).toBe("Fly");
		});

		it("should replace concentration when new spell is cast", () => {
			state.setConcentrating({name: "Bless", source: "PHB"});
			state.setConcentrating({name: "Hold Person", source: "PHB"});
			expect(state.getConcentratingSpell().name).toBe("Hold Person");
		});

		it("should break concentration", () => {
			state.setConcentrating({name: "Invisibility", source: "PHB"});
			state.breakConcentration();
			expect(state.isConcentrating()).toBe(false);
		});

		it("should calculate concentration save bonus", () => {
			// CON 14 = +2, plus proficiency if proficient
			const bonus = state.getConcentrationSaveBonus();
			expect(bonus).toBeGreaterThanOrEqual(2);
		});

		it("should include War Caster advantage", () => {
			state.setFeatEffect("War Caster", {concentrationAdvantage: true});
			expect(state.hasConcentrationAdvantage()).toBe(true);
		});
	});

	// ==========================================================================
	// Innate Spellcasting
	// ==========================================================================
	describe("Innate Spellcasting", () => {
		it("should add innate spell with uses", () => {
			state.addInnateSpell({
				name: "Misty Step",
				source: "PHB",
				level: 2,
				uses: {current: 1, max: 1},
				recharge: "long",
				sourceFeature: "Fey Ancestry",
			});
			const innate = state.getInnateSpells();
			expect(innate).toHaveLength(1);
			expect(innate[0].uses.max).toBe(1);
		});

		it("should track at-will innate spells", () => {
			state.addInnateSpell({
				name: "Detect Magic",
				source: "PHB",
				level: 1,
				atWill: true,
				sourceFeature: "Detect Magic at Will",
			});
			const innate = state.getInnateSpells();
			expect(innate[0].atWill).toBe(true);
		});

		it("should use innate spell charge", () => {
			state.addInnateSpell({
				name: "Darkness",
				source: "PHB",
				level: 2,
				uses: {current: 1, max: 1},
				id: "innate1",
			});
			state.useInnateSpell("innate1");
			expect(state.getInnateSpells()[0].uses.current).toBe(0);
		});

		it("should restore innate spells on appropriate rest", () => {
			state.addInnateSpell({
				name: "Faerie Fire",
				source: "PHB",
				level: 1,
				uses: {current: 0, max: 1},
				recharge: "long",
				id: "innate1",
			});
			state.onLongRest();
			expect(state.getInnateSpells()[0].uses.current).toBe(1);
		});
	});

	// ==========================================================================
	// Multiclass Spellcasting
	// ==========================================================================
	describe("Multiclass Spellcasting", () => {
		it("should calculate multiclass spell slots", () => {
			// Wizard 3 / Cleric 2 = 5 caster levels
			state.addClass({name: "Wizard", source: "PHB", level: 3});
			state.addClass({name: "Cleric", source: "PHB", level: 2});

			const slots = state.getSpellSlots();
			// Full casters combined: level 5 slots
			expect(slots[1]?.max).toBe(4);
			expect(slots[2]?.max).toBe(3);
			expect(slots[3]?.max).toBe(2);
		});

		it("should handle half-caster multiclass", () => {
			// Paladin 4 = 2 caster levels
			state.addClass({name: "Paladin", source: "PHB", level: 4});

			const slots = state.getSpellSlots();
			expect(slots[1]?.max).toBe(3); // Level 2 caster
		});

		it("should handle Warlock multiclass separately", () => {
			// Warlock slots don't combine with other classes
			state.addClass({name: "Wizard", source: "PHB", level: 3});
			state.addClass({name: "Warlock", source: "PHB", level: 2});

			// Should have both regular slots and pact slots
			const regularSlots = state.getSpellSlots();
			const pactSlots = state.getPactSlots();

			expect(regularSlots[1]?.max).toBeGreaterThan(0);
			expect(pactSlots?.max).toBeGreaterThan(0);
		});
	});

	// ==========================================================================
	// Ritual Casting
	// ==========================================================================
	describe("Ritual Casting", () => {
		beforeEach(() => {
			state.addClass({name: "Wizard", source: "PHB", level: 5});
		});

		it("should identify ritual spells", () => {
			state.addKnownSpell({
				name: "Find Familiar",
				source: "PHB",
				level: 1,
				ritual: true,
			});
			const spell = state.getKnownSpells()[0];
			expect(spell.ritual).toBe(true);
		});

		it("should allow ritual casting without using slot", () => {
			const canRitual = state.canCastAsRitual({name: "Detect Magic", ritual: true});
			// Wizards can cast rituals from spellbook
			expect(canRitual).toBe(true);
		});
	});

	// ==========================================================================
	// Spell Preparation
	// ==========================================================================
	describe("Spell Preparation", () => {
		beforeEach(() => {
			state.addClass({name: "Wizard", source: "PHB", level: 5});
			state.setAbilityBase("int", 16);
		});

		it("should calculate max prepared spells for Wizard", () => {
			// Wizard: INT mod + wizard level = 3 + 5 = 8
			expect(state.getMaxPreparedSpells()).toBe(8);
		});

		it("should count current prepared spells", () => {
			state.addKnownSpell({name: "Fireball", source: "PHB", level: 3, prepared: true});
			state.addKnownSpell({name: "Shield", source: "PHB", level: 1, prepared: true});
			state.addKnownSpell({name: "Sleep", source: "PHB", level: 1, prepared: false});
			expect(state.getPreparedSpellCount()).toBe(2);
		});

		it("should check if can prepare more spells", () => {
			// Max 8, none prepared yet
			expect(state.canPrepareMoreSpells()).toBe(true);
		});

		it("should get list of prepared spells only", () => {
			state.addKnownSpell({name: "Magic Missile", source: "PHB", level: 1, prepared: true});
			state.addKnownSpell({name: "Charm Person", source: "PHB", level: 1, prepared: false});
			const prepared = state.getPreparedSpells();
			expect(prepared).toHaveLength(1);
			expect(prepared[0].name).toBe("Magic Missile");
		});
	});
});
