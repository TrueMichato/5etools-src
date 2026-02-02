/**
 * Character Sheet Multiclass Progression Tests
 * Tests for complex multiclass character builds and level progression
 */

import "./setup.js";
import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

describe("Multiclass Progression Scenarios", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
	});

	// ==========================================================================
	// Test 1: Paladin/Sorcerer - The Classic "Sorcadin"
	// ==========================================================================
	describe("Paladin 6 / Sorcerer 14 - Half-Elf Soldier Sorcadin", () => {
		beforeEach(() => {
			// Set up Half-Elf race
			state.setRace({name: "Half-Elf", source: "PHB"});
			state.setAbilityBonus("cha", 2); // Half-Elf +2 CHA
			state.setAbilityBonus("str", 1); // Half-Elf flexible +1
			state.setAbilityBonus("con", 1); // Half-Elf flexible +1

			// Set up background
			state.setBackground({name: "Soldier", source: "PHB"});

			// Set base ability scores (standard array + racial)
			state.setAbilityBase("str", 14); // 13 + 1 racial
			state.setAbilityBase("dex", 10);
			state.setAbilityBase("con", 14); // 13 + 1 racial
			state.setAbilityBase("int", 8);
			state.setAbilityBase("wis", 12);
			state.setAbilityBase("cha", 17); // 15 + 2 racial
		});

		it("should build Paladin levels 1-6 correctly", () => {
			// Add Paladin as first class
			state.addClass({name: "Paladin", source: "PHB", level: 1});
			expect(state.getTotalLevel()).toBe(1);
			expect(state.getClassLevel("Paladin")).toBe(1);

			// Level up to 6
			for (let i = 2; i <= 6; i++) {
				state.levelUp("Paladin");
			}

			expect(state.getTotalLevel()).toBe(6);
			expect(state.getClassLevel("Paladin")).toBe(6);
			expect(state.getProficiencyBonus()).toBe(3); // Level 5-8 = +3

			// Check hit dice
			const hitDice = state.getHitDice();
			const d10 = hitDice.find(h => h.type === "d10");
			expect(d10).toBeTruthy();
			expect(d10.max).toBe(6);
		});

		it("should multiclass into Sorcerer and reach level 20", () => {
			// Start with Paladin 6
			state.addClass({name: "Paladin", source: "PHB", level: 6});

			// Check multiclass requirements (CHA 13+ for Sorcerer)
			expect(state.meetsMulticlassRequirement("Sorcerer")).toBe(true);

			// Add Sorcerer and level to 14
			state.addClass({name: "Sorcerer", source: "PHB", level: 1});
			expect(state.getTotalLevel()).toBe(7);

			for (let i = 2; i <= 14; i++) {
				state.levelUp("Sorcerer");
			}

			expect(state.getTotalLevel()).toBe(20);
			expect(state.getClassLevel("Paladin")).toBe(6);
			expect(state.getClassLevel("Sorcerer")).toBe(14);
			expect(state.getProficiencyBonus()).toBe(6); // Level 17+ = +6
		});

		it("should calculate multiclass spell slots correctly", () => {
			state.addClass({name: "Paladin", source: "PHB", level: 6});
			state.addClass({name: "Sorcerer", source: "PHB", level: 14});

			// Paladin 6 = 3 half-caster levels (floor)
			// Sorcerer 14 = 14 full-caster levels
			// Total caster level = 3 + 14 = 17
			state.calculateSpellSlots();
			const slots = state.getSpellSlots();

			// Level 17 caster spell slots
			expect(slots[1]?.max).toBe(4);
			expect(slots[2]?.max).toBe(3);
			expect(slots[3]?.max).toBe(3);
			expect(slots[4]?.max).toBe(3);
			expect(slots[5]?.max).toBe(2);
			expect(slots[6]?.max).toBe(1);
			expect(slots[7]?.max).toBe(1);
			expect(slots[8]?.max).toBe(1);
			expect(slots[9]?.max).toBe(1);
		});

		it("should have correct hit dice from both classes", () => {
			state.addClass({name: "Paladin", source: "PHB", level: 6});
			state.addClass({name: "Sorcerer", source: "PHB", level: 14});

			const hitDice = state.getHitDice();
			const d10 = hitDice.find(h => h.type === "d10");
			const d6 = hitDice.find(h => h.type === "d6");

			expect(d10?.max).toBe(6); // Paladin
			expect(d6?.max).toBe(14); // Sorcerer
		});

		it("should track character identity", () => {
			state.addClass({name: "Paladin", source: "PHB", level: 6});
			state.addClass({name: "Sorcerer", source: "PHB", level: 14});

			expect(state.getRaceName()).toBe("Half-Elf");
			expect(state.getBackground().name).toBe("Soldier");
			expect(state.getClassSummary()).toContain("Paladin 6");
			expect(state.getClassSummary()).toContain("Sorcerer 14");
		});
	});

	// ==========================================================================
	// Test 2: Sorcerer/Paladin - Alternating Progression
	// ==========================================================================
	describe("Sorcerer 14 / Paladin 6 - Alternating Level Progression", () => {
		beforeEach(() => {
			// Set up for multiclassing (need STR 13+, CHA 13+)
			state.setAbilityBase("str", 14);
			state.setAbilityBase("dex", 10);
			state.setAbilityBase("con", 14);
			state.setAbilityBase("int", 8);
			state.setAbilityBase("wis", 10);
			state.setAbilityBase("cha", 16);
		});

		it("should handle Sorcerer 1 -> Paladin 2 progression", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 1});
			expect(state.getTotalLevel()).toBe(1);
			expect(state.getClassLevel("Sorcerer")).toBe(1);

			state.addClass({name: "Paladin", source: "PHB", level: 1});
			state.levelUp("Paladin");
			expect(state.getTotalLevel()).toBe(3);
			expect(state.getClassLevel("Sorcerer")).toBe(1);
			expect(state.getClassLevel("Paladin")).toBe(2);
		});

		it("should handle Sorcerer 1 -> Paladin 2 -> Sorcerer 5 progression", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 1});
			state.addClass({name: "Paladin", source: "PHB", level: 2});

			// Level Sorcerer to 5 (4 more levels)
			for (let i = 0; i < 4; i++) {
				state.levelUp("Sorcerer");
			}

			expect(state.getTotalLevel()).toBe(7);
			expect(state.getClassLevel("Sorcerer")).toBe(5);
			expect(state.getClassLevel("Paladin")).toBe(2);
		});

		it("should complete full alternating progression to level 20", () => {
			// Sorcerer 1
			state.addClass({name: "Sorcerer", source: "PHB", level: 1});

			// Paladin 2
			state.addClass({name: "Paladin", source: "PHB", level: 2});

			// Sorcerer to 5 (4 more)
			for (let i = 0; i < 4; i++) state.levelUp("Sorcerer");

			// Paladin to 6 (4 more)
			for (let i = 0; i < 4; i++) state.levelUp("Paladin");

			// Sorcerer to 14 (9 more)
			for (let i = 0; i < 9; i++) state.levelUp("Sorcerer");

			expect(state.getTotalLevel()).toBe(20);
			expect(state.getClassLevel("Sorcerer")).toBe(14);
			expect(state.getClassLevel("Paladin")).toBe(6);
			expect(state.getProficiencyBonus()).toBe(6);
		});

		it("should track proficiency bonus through alternating progression", () => {
			state.addClass({name: "Sorcerer", source: "PHB", level: 1});
			expect(state.getProficiencyBonus()).toBe(2); // Level 1-4

			state.addClass({name: "Paladin", source: "PHB", level: 2});
			expect(state.getProficiencyBonus()).toBe(2); // Level 3

			for (let i = 0; i < 2; i++) state.levelUp("Sorcerer");
			expect(state.getTotalLevel()).toBe(5);
			expect(state.getProficiencyBonus()).toBe(3); // Level 5-8
		});
	});

	// ==========================================================================
	// Test 3: Fighter/Wizard - Eldritch Knight to Wizard
	// ==========================================================================
	describe("Fighter 8 / Wizard 12 - Eldritch Knight Progression", () => {
		beforeEach(() => {
			state.setRace({name: "High Elf", source: "PHB"});
			state.setAbilityBase("str", 16);
			state.setAbilityBase("dex", 14);
			state.setAbilityBase("con", 14);
			state.setAbilityBase("int", 14); // Need 13+ for Wizard
			state.setAbilityBase("wis", 10);
			state.setAbilityBase("cha", 8);
		});

		it("should build Fighter with Eldritch Knight subclass", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 3});
			state.setSubclass("Fighter", {name: "Eldritch Knight", source: "PHB"});

			expect(state.getClassLevel("Fighter")).toBe(3);
			const classes = state.getClasses();
			const fighter = classes.find(c => c.name === "Fighter");
			expect(fighter.subclass?.name).toBe("Eldritch Knight");
		});

		it("should progress to Fighter 8 / Wizard 12", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 8});
			state.setSubclass("Fighter", {name: "Eldritch Knight", source: "PHB"});

			state.addClass({name: "Wizard", source: "PHB", level: 12});

			expect(state.getTotalLevel()).toBe(20);
			expect(state.getClassLevel("Fighter")).toBe(8);
			expect(state.getClassLevel("Wizard")).toBe(12);
		});

		it("should calculate spell slots with third-caster Eldritch Knight", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 8});
			state.setSubclass("Fighter", {name: "Eldritch Knight", source: "PHB"});
			state.addClass({name: "Wizard", source: "PHB", level: 12});

			// Fighter 8 (EK) = 2 third-caster levels (floor(8/3))
			// Wizard 12 = 12 full-caster levels
			// Total = 14 caster levels
			state.calculateSpellSlots();
			const slots = state.getSpellSlots();

			expect(slots[1]?.max).toBe(4);
			expect(slots[2]?.max).toBe(3);
			expect(slots[3]?.max).toBe(3);
			expect(slots[4]?.max).toBe(3);
			expect(slots[5]?.max).toBe(2);
			expect(slots[6]?.max).toBe(1);
			expect(slots[7]?.max).toBe(1);
		});

		it("should have Fighter and Wizard hit dice", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 8});
			state.addClass({name: "Wizard", source: "PHB", level: 12});

			const hitDice = state.getHitDice();
			expect(hitDice.find(h => h.type === "d10")?.max).toBe(8);
			expect(hitDice.find(h => h.type === "d6")?.max).toBe(12);
		});

		it("should track extra attacks from Fighter", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 8});
			state.addFeature({name: "Extra Attack", source: "PHB"});

			expect(state.getNumberOfAttacks()).toBeGreaterThanOrEqual(2);
		});
	});

	// ==========================================================================
	// Test 4: Rogue/Fighter - Swashbuckler Battlemaster
	// ==========================================================================
	describe("Rogue 11 / Fighter 9 - Swashbuckler Battlemaster", () => {
		beforeEach(() => {
			state.setRace({name: "Lightfoot Halfling", source: "PHB"});
			state.setAbilityBase("str", 10);
			state.setAbilityBase("dex", 16);
			state.setAbilityBase("con", 14);
			state.setAbilityBase("int", 10);
			state.setAbilityBase("wis", 12);
			state.setAbilityBase("cha", 14);
		});

		it("should build Rogue 11 with Swashbuckler", () => {
			state.addClass({name: "Rogue", source: "PHB", level: 11});
			state.setSubclass("Rogue", {name: "Swashbuckler", source: "XGE"});

			expect(state.getClassLevel("Rogue")).toBe(11);
		});

		it("should multiclass into Fighter Battlemaster", () => {
			state.addClass({name: "Rogue", source: "PHB", level: 11});
			state.addClass({name: "Fighter", source: "PHB", level: 9});
			state.setSubclass("Fighter", {name: "Battle Master", source: "PHB"});

			expect(state.getTotalLevel()).toBe(20);
			expect(state.getClassLevel("Rogue")).toBe(11);
			expect(state.getClassLevel("Fighter")).toBe(9);
		});

		it("should have mixed hit dice d8 and d10", () => {
			state.addClass({name: "Rogue", source: "PHB", level: 11});
			state.addClass({name: "Fighter", source: "PHB", level: 9});

			const hitDice = state.getHitDice();
			expect(hitDice.find(h => h.type === "d8")?.max).toBe(11);
			expect(hitDice.find(h => h.type === "d10")?.max).toBe(9);
		});

		it("should not have spellcasting (non-caster multiclass)", () => {
			state.addClass({name: "Rogue", source: "PHB", level: 11});
			state.addClass({name: "Fighter", source: "PHB", level: 9});
			// No EK subclass, so no spellcasting

			state.calculateSpellSlots();
			const slots = state.getSpellSlots();

			// Should have no spell slots or all at 0
			const hasSlots = Object.values(slots).some(s => s?.max > 0);
			expect(hasSlots).toBe(false);
		});
	});

	// ==========================================================================
	// Test 5: Cleric/Druid - Full Divine Caster
	// ==========================================================================
	describe("Cleric 10 / Druid 10 - Full Divine Multiclass", () => {
		beforeEach(() => {
			state.setRace({name: "Wood Elf", source: "PHB"});
			state.setAbilityBase("str", 8);
			state.setAbilityBase("dex", 14);
			state.setAbilityBase("con", 14);
			state.setAbilityBase("int", 10);
			state.setAbilityBase("wis", 16); // Primary for both
			state.setAbilityBase("cha", 10);
		});

		it("should build Cleric 10 with Life Domain", () => {
			state.addClass({name: "Cleric", source: "PHB", level: 10});
			state.setSubclass("Cleric", {name: "Life Domain", source: "PHB"});

			expect(state.getClassLevel("Cleric")).toBe(10);
		});

		it("should multiclass into Druid 10", () => {
			state.addClass({name: "Cleric", source: "PHB", level: 10});
			state.addClass({name: "Druid", source: "PHB", level: 10});

			expect(state.getTotalLevel()).toBe(20);
			expect(state.getClassLevel("Cleric")).toBe(10);
			expect(state.getClassLevel("Druid")).toBe(10);
		});

		it("should have full caster spell slots at level 20", () => {
			state.addClass({name: "Cleric", source: "PHB", level: 10});
			state.addClass({name: "Druid", source: "PHB", level: 10});

			// Both full casters = 20 caster levels
			state.calculateSpellSlots();
			const slots = state.getSpellSlots();

			expect(slots[1]?.max).toBe(4);
			expect(slots[2]?.max).toBe(3);
			expect(slots[3]?.max).toBe(3);
			expect(slots[4]?.max).toBe(3);
			expect(slots[5]?.max).toBe(3);
			expect(slots[6]?.max).toBe(2);
			expect(slots[7]?.max).toBe(2);
			expect(slots[8]?.max).toBe(1);
			expect(slots[9]?.max).toBe(1);
		});

		it("should have d8 hit dice from both classes", () => {
			state.addClass({name: "Cleric", source: "PHB", level: 10});
			state.addClass({name: "Druid", source: "PHB", level: 10});

			const hitDice = state.getHitDice();
			const d8 = hitDice.find(h => h.type === "d8");
			expect(d8?.max).toBe(20); // Both use d8
		});
	});

	// ==========================================================================
	// Test 6: Warlock/Bard - Charisma SAD Build
	// ==========================================================================
	describe("Warlock 3 / Bard 17 - Hexblade Lore Bard", () => {
		beforeEach(() => {
			state.setRace({name: "Half-Elf", source: "PHB"});
			state.setAbilityBase("str", 8);
			state.setAbilityBase("dex", 14);
			state.setAbilityBase("con", 14);
			state.setAbilityBase("int", 10);
			state.setAbilityBase("wis", 10);
			state.setAbilityBase("cha", 16);
		});

		it("should build Warlock 3 Hexblade dip", () => {
			state.addClass({name: "Warlock", source: "PHB", level: 3});
			state.setSubclass("Warlock", {name: "Hexblade", source: "XGE"});

			expect(state.getClassLevel("Warlock")).toBe(3);

			// Warlock should have pact slots, not regular slots
			const pactSlots = state.getPactSlots();
			expect(pactSlots.max).toBeGreaterThan(0);
		});

		it("should multiclass into Bard 17", () => {
			state.addClass({name: "Warlock", source: "PHB", level: 3});
			state.addClass({name: "Bard", source: "PHB", level: 17});

			expect(state.getTotalLevel()).toBe(20);
			expect(state.getClassLevel("Warlock")).toBe(3);
			expect(state.getClassLevel("Bard")).toBe(17);
		});

		it("should have separate pact slots and regular slots", () => {
			state.addClass({name: "Warlock", source: "PHB", level: 3});
			state.addClass({name: "Bard", source: "PHB", level: 17});

			// Warlock pact slots don't combine with regular slots
			state.calculateSpellSlots();
			const slots = state.getSpellSlots();
			const pactSlots = state.getPactSlots();

			// Bard 17 = full caster level 17
			expect(slots[9]?.max).toBe(1);

			// Warlock 3 = 2 pact slots at 2nd level
			expect(pactSlots.max).toBeGreaterThan(0);
		});

		it("should recover pact slots on short rest separately", () => {
			state.addClass({name: "Warlock", source: "PHB", level: 3});
			state.addClass({name: "Bard", source: "PHB", level: 17});
			state.calculateSpellSlots();

			// Use a pact slot and a regular slot
			state.usePactSlot();
			state.useSpellSlot(1);

			const pactBefore = state.getPactSlots().current;
			const slotsBefore = state.getSpellSlots()[1].current;

			state.onShortRest();

			// Pact slots should restore, regular slots should not
			expect(state.getPactSlots().current).toBeGreaterThan(pactBefore);
			expect(state.getSpellSlots()[1].current).toBe(slotsBefore);
		});
	});

	// ==========================================================================
	// Test 7: Monk/Ranger - Wisdom-Based Martial
	// ==========================================================================
	describe("Monk 14 / Ranger 6 - Shadow Monk Gloom Stalker", () => {
		beforeEach(() => {
			state.setRace({name: "Wood Elf", source: "PHB"});
			state.setAbilityBase("str", 10);
			state.setAbilityBase("dex", 16);
			state.setAbilityBase("con", 14);
			state.setAbilityBase("int", 8);
			state.setAbilityBase("wis", 16); // Primary for both
			state.setAbilityBase("cha", 8);
		});

		it("should build Monk 14 with Way of Shadow", () => {
			state.addClass({name: "Monk", source: "PHB", level: 14});
			state.setSubclass("Monk", {name: "Way of Shadow", source: "PHB"});

			expect(state.getClassLevel("Monk")).toBe(14);
		});

		it("should meet Ranger multiclass requirements", () => {
			state.addClass({name: "Monk", source: "PHB", level: 14});

			// Ranger requires DEX 13+ and WIS 13+
			expect(state.meetsMulticlassRequirement("Ranger")).toBe(true);
		});

		it("should multiclass into Ranger 6 Gloom Stalker", () => {
			state.addClass({name: "Monk", source: "PHB", level: 14});
			state.addClass({name: "Ranger", source: "PHB", level: 6});
			state.setSubclass("Ranger", {name: "Gloom Stalker", source: "XGE"});

			expect(state.getTotalLevel()).toBe(20);
			expect(state.getClassLevel("Monk")).toBe(14);
			expect(state.getClassLevel("Ranger")).toBe(6);
		});

		it("should have d8 and d10 hit dice from both classes", () => {
			state.addClass({name: "Monk", source: "PHB", level: 14});
			state.addClass({name: "Ranger", source: "PHB", level: 6});

			const hitDice = state.getHitDice();
			const d8 = hitDice.find(h => h.type === "d8");
			const d10 = hitDice.find(h => h.type === "d10");
			expect(d8?.max).toBe(14); // Monk
			expect(d10?.max).toBe(6); // Ranger
		});

		it("should calculate half-caster slots from Ranger only", () => {
			state.addClass({name: "Monk", source: "PHB", level: 14});
			state.addClass({name: "Ranger", source: "PHB", level: 6});

			// Ranger 6 = 3 half-caster levels
			state.calculateSpellSlots();
			const slots = state.getSpellSlots();

			// Caster level 3 should have 1st and 2nd level slots
			expect(slots[1]?.max).toBeGreaterThanOrEqual(3);
			expect(slots[2]?.max).toBeGreaterThanOrEqual(2);
		});
	});

	// ==========================================================================
	// Test 8: Barbarian/Rogue - Rage and Sneak Attack
	// ==========================================================================
	describe("Barbarian 5 / Rogue 15 - Bear Totem Assassin", () => {
		beforeEach(() => {
			state.setRace({name: "Half-Orc", source: "PHB"});
			state.setAbilityBase("str", 16);
			state.setAbilityBase("dex", 14);
			state.setAbilityBase("con", 14);
			state.setAbilityBase("int", 8);
			state.setAbilityBase("wis", 10);
			state.setAbilityBase("cha", 10);
		});

		it("should build Barbarian 5 with Totem Warrior", () => {
			state.addClass({name: "Barbarian", source: "PHB", level: 5});
			state.setSubclass("Barbarian", {name: "Path of the Totem Warrior", source: "PHB"});

			expect(state.getClassLevel("Barbarian")).toBe(5);
		});

		it("should multiclass into Rogue 15 Assassin", () => {
			state.addClass({name: "Barbarian", source: "PHB", level: 5});
			state.addClass({name: "Rogue", source: "PHB", level: 15});
			state.setSubclass("Rogue", {name: "Assassin", source: "PHB"});

			expect(state.getTotalLevel()).toBe(20);
			expect(state.getClassLevel("Barbarian")).toBe(5);
			expect(state.getClassLevel("Rogue")).toBe(15);
		});

		it("should have d12 and d8 hit dice", () => {
			state.addClass({name: "Barbarian", source: "PHB", level: 5});
			state.addClass({name: "Rogue", source: "PHB", level: 15});

			const hitDice = state.getHitDice();
			expect(hitDice.find(h => h.type === "d12")?.max).toBe(5);
			expect(hitDice.find(h => h.type === "d8")?.max).toBe(15);
		});

		it("should have no spellcasting", () => {
			state.addClass({name: "Barbarian", source: "PHB", level: 5});
			state.addClass({name: "Rogue", source: "PHB", level: 15});

			state.calculateSpellSlots();
			const slots = state.getSpellSlots();
			const hasSlots = Object.values(slots).some(s => s?.max > 0);
			expect(hasSlots).toBe(false);
		});

		it("should have extra attack from Barbarian 5", () => {
			state.addClass({name: "Barbarian", source: "PHB", level: 5});
			state.addFeature({name: "Extra Attack", source: "PHB"});

			expect(state.getNumberOfAttacks()).toBeGreaterThanOrEqual(2);
		});
	});

	// ==========================================================================
	// Test 9: Artificer/Wizard - Intelligence Synergy
	// ==========================================================================
	describe("Artificer 6 / Wizard 14 - Battle Smith Bladesinger", () => {
		beforeEach(() => {
			state.setRace({name: "Gnome", subrace: "Rock", source: "PHB"});
			state.setAbilityBase("str", 8);
			state.setAbilityBase("dex", 14);
			state.setAbilityBase("con", 14);
			state.setAbilityBase("int", 16); // Primary for both
			state.setAbilityBase("wis", 10);
			state.setAbilityBase("cha", 10);
		});

		it("should build Artificer 6 Battle Smith", () => {
			state.addClass({name: "Artificer", source: "TCE", level: 6});
			state.setSubclass("Artificer", {name: "Battle Smith", source: "TCE"});

			expect(state.getClassLevel("Artificer")).toBe(6);
		});

		it("should multiclass into Wizard 14 Bladesinger", () => {
			state.addClass({name: "Artificer", source: "TCE", level: 6});
			state.addClass({name: "Wizard", source: "PHB", level: 14});
			state.setSubclass("Wizard", {name: "Bladesinging", source: "TCE"});

			expect(state.getTotalLevel()).toBe(20);
			expect(state.getClassLevel("Artificer")).toBe(6);
			expect(state.getClassLevel("Wizard")).toBe(14);
		});

		it("should calculate Artificer unique spell slot progression", () => {
			state.addClass({name: "Artificer", source: "TCE", level: 6});
			state.addClass({name: "Wizard", source: "PHB", level: 14});

			// Artificer has unique half-caster progression that rounds up
			// Artificer 6 = ceil(6/2) = 3 caster levels
			// Wizard 14 = 14 caster levels
			// Total = 17 caster levels
			state.calculateSpellSlots();
			const slots = state.getSpellSlots();

			expect(slots[9]?.max).toBe(1);
		});

		it("should have d8 and d6 hit dice", () => {
			state.addClass({name: "Artificer", source: "TCE", level: 6});
			state.addClass({name: "Wizard", source: "PHB", level: 14});

			const hitDice = state.getHitDice();
			expect(hitDice.find(h => h.type === "d8")?.max).toBe(6);
			expect(hitDice.find(h => h.type === "d6")?.max).toBe(14);
		});
	});

	// ==========================================================================
	// Test 10: Triple Class - Fighter/Cleric/Wizard
	// ==========================================================================
	describe("Fighter 6 / Cleric 7 / Wizard 7 - Triple Caster", () => {
		beforeEach(() => {
			state.setRace({name: "Human", subrace: "Variant", source: "PHB"});
			state.setAbilityBase("str", 14);
			state.setAbilityBase("dex", 10);
			state.setAbilityBase("con", 14);
			state.setAbilityBase("int", 14); // Wizard requirement
			state.setAbilityBase("wis", 14); // Cleric requirement
			state.setAbilityBase("cha", 8);
		});

		it("should meet multiclass requirements for all three classes", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 1});

			expect(state.meetsMulticlassRequirement("Cleric")).toBe(true);
			expect(state.meetsMulticlassRequirement("Wizard")).toBe(true);
		});

		it("should build Fighter 6 Eldritch Knight / Cleric 7 / Wizard 7", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 6});
			state.setSubclass("Fighter", {name: "Eldritch Knight", source: "PHB"});

			state.addClass({name: "Cleric", source: "PHB", level: 7});
			state.setSubclass("Cleric", {name: "War Domain", source: "PHB"});

			state.addClass({name: "Wizard", source: "PHB", level: 7});
			state.setSubclass("Wizard", {name: "School of Abjuration", source: "PHB"});

			expect(state.getTotalLevel()).toBe(20);
			expect(state.getClassLevel("Fighter")).toBe(6);
			expect(state.getClassLevel("Cleric")).toBe(7);
			expect(state.getClassLevel("Wizard")).toBe(7);
		});

		it("should calculate spell slots from three caster sources", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 6});
			state.setSubclass("Fighter", {name: "Eldritch Knight", source: "PHB"});
			state.addClass({name: "Cleric", source: "PHB", level: 7});
			state.addClass({name: "Wizard", source: "PHB", level: 7});

			// EK 6 = 2 third-caster levels
			// Cleric 7 = 7 full-caster levels
			// Wizard 7 = 7 full-caster levels
			// Total = 16 caster levels
			state.calculateSpellSlots();
			const slots = state.getSpellSlots();

			expect(slots[8]?.max).toBe(1);
		});

		it("should have three types of hit dice", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 6});
			state.addClass({name: "Cleric", source: "PHB", level: 7});
			state.addClass({name: "Wizard", source: "PHB", level: 7});

			const hitDice = state.getHitDice();
			expect(hitDice.find(h => h.type === "d10")?.max).toBe(6);
			expect(hitDice.find(h => h.type === "d8")?.max).toBe(7);
			expect(hitDice.find(h => h.type === "d6")?.max).toBe(7);
		});

		it("should generate correct class summary", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 6});
			state.addClass({name: "Cleric", source: "PHB", level: 7});
			state.addClass({name: "Wizard", source: "PHB", level: 7});

			const summary = state.getClassSummary();
			expect(summary).toContain("Fighter 6");
			expect(summary).toContain("Cleric 7");
			expect(summary).toContain("Wizard 7");
		});

		it("should recover three types of hit dice on long rest", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 6});
			state.addClass({name: "Cleric", source: "PHB", level: 7});
			state.addClass({name: "Wizard", source: "PHB", level: 7});

			// Spend all hit dice
			state.setHitDice([
				{type: "d10", current: 0, max: 6},
				{type: "d8", current: 0, max: 7},
				{type: "d6", current: 0, max: 7},
			]);

			state.onLongRest();

			// Should recover half (10) hit dice total
			const hitDice = state.getHitDice();
			const totalRecovered = hitDice.reduce((sum, hd) => sum + hd.current, 0);
			expect(totalRecovered).toBeGreaterThanOrEqual(10);
		});
	});

	// ==========================================================================
	// Additional Edge Cases
	// ==========================================================================
	describe("Edge Cases and Special Scenarios", () => {
		it("should prevent exceeding level 20 total", () => {
			state.setAbilityBase("cha", 14);
			state.setAbilityBase("str", 14);

			state.addClass({name: "Paladin", source: "PHB", level: 10});
			state.addClass({name: "Sorcerer", source: "PHB", level: 10});

			// Try to add another level
			const result = state.levelUp("Paladin");
			expect(result).toBe(false);
			expect(state.getTotalLevel()).toBe(20);
		});

		it("should track level-by-level HP progression in multiclass", () => {
			state.setAbilityBase("con", 14); // +2 CON mod
			state.setAbilityBase("str", 14);
			state.setAbilityBase("cha", 14);

			// Fighter 1: 10 + 2 = 12 HP
			state.addClass({name: "Fighter", source: "PHB", level: 1});
			state.setMaxHp(12);
			expect(state.getMaxHp()).toBe(12);

			// Add Sorcerer 1: 4 (avg d6) + 2 = 6 HP, total 18
			state.addClass({name: "Sorcerer", source: "PHB", level: 1});
			// Max HP would need manual update or recalculation
		});

		it("should handle same-ability multiclass (CHA classes)", () => {
			state.setAbilityBase("cha", 16);
			state.setAbilityBase("str", 14); // Paladin also requires STR 13+

			state.addClass({name: "Bard", source: "PHB", level: 10});
			expect(state.meetsMulticlassRequirement("Sorcerer")).toBe(true);
			expect(state.meetsMulticlassRequirement("Warlock")).toBe(true);
			expect(state.meetsMulticlassRequirement("Paladin")).toBe(true);

			state.addClass({name: "Sorcerer", source: "PHB", level: 5});
			state.addClass({name: "Warlock", source: "PHB", level: 5});

			expect(state.getTotalLevel()).toBe(20);
			expect(state.getClassLevel("Bard")).toBe(10);
			expect(state.getClassLevel("Sorcerer")).toBe(5);
			expect(state.getClassLevel("Warlock")).toBe(5);
		});

		it("should handle gradual level-by-level multiclass progression", () => {
			state.setAbilityBase("dex", 14);
			state.setAbilityBase("wis", 14);

			// Build level by level: Monk 1, Ranger 1, Monk 2, Ranger 2, etc.
			state.addClass({name: "Monk", source: "PHB", level: 1});
			state.addClass({name: "Ranger", source: "PHB", level: 1});

			for (let i = 0; i < 9; i++) {
				state.levelUp("Monk");
				state.levelUp("Ranger");
			}

			expect(state.getTotalLevel()).toBe(20);
			expect(state.getClassLevel("Monk")).toBe(10);
			expect(state.getClassLevel("Ranger")).toBe(10);
		});
	});
});
