/**
 * Character Sheet State - Unit Tests
 * Tests for core state management, getters/setters, and computed values
 */

import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

describe("CharacterSheetState", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
	});

	// ==========================================================================
	// Initialization
	// ==========================================================================
	describe("Initialization", () => {
		it("should create a new state with default values", () => {
			expect(state).toBeDefined();
			expect(state.getName()).toBe("");
			expect(state.getRace()).toBeNull();
			expect(state.getClasses()).toEqual([]);
		});

		it("should initialize ability scores to 10", () => {
			expect(state.getAbilityScore("str")).toBe(10);
			expect(state.getAbilityScore("dex")).toBe(10);
			expect(state.getAbilityScore("con")).toBe(10);
			expect(state.getAbilityScore("int")).toBe(10);
			expect(state.getAbilityScore("wis")).toBe(10);
			expect(state.getAbilityScore("cha")).toBe(10);
		});

		it("should initialize HP to 0", () => {
			const hp = state.getHp();
			expect(hp.current).toBe(0);
			expect(hp.temp).toBe(0);
		});

		it("should initialize death saves to 0", () => {
			const deathSaves = state.getDeathSaves();
			expect(deathSaves.successes).toBe(0);
			expect(deathSaves.failures).toBe(0);
		});

		it("should initialize inspiration to false", () => {
			expect(state.getInspiration()).toBe(false);
		});
	});

	// ==========================================================================
	// Basic Info
	// ==========================================================================
	describe("Basic Info", () => {
		it("should set and get character name", () => {
			state.setName("Gandalf");
			expect(state.getName()).toBe("Gandalf");
		});

		it("should set and get race", () => {
			const race = {name: "Elf", source: "PHB"};
			state.setRace(race);
			expect(state.getRace()).toEqual(race);
		});

		it("should set and get race with subrace", () => {
			const race = {name: "Elf", source: "PHB"};
			const subrace = {name: "High Elf", source: "PHB"};
			state.setRace(race, subrace);
			expect(state.getRace()).toEqual(race);
			expect(state.getSubrace()).toEqual(subrace);
		});

		it("should get race name correctly", () => {
			state.setRace({name: "Dwarf", source: "PHB"});
			expect(state.getRaceName()).toBe("Dwarf");
		});

		it("should get race name with subrace", () => {
			state.setRace(
				{name: "Dwarf", source: "PHB"},
				{name: "Hill Dwarf", source: "PHB"},
			);
			expect(state.getRaceName()).toBe("Hill Dwarf");
		});

		it("should set and get background", () => {
			const background = {name: "Sage", source: "PHB"};
			state.setBackground(background);
			expect(state.getBackground()).toEqual(background);
			expect(state.getBackgroundName()).toBe("Sage");
		});
	});

	// ==========================================================================
	// Classes and Levels
	// ==========================================================================
	describe("Classes and Levels", () => {
		it("should add a class", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 1});
			expect(state.getClasses()).toHaveLength(1);
			expect(state.getClasses()[0].name).toBe("Fighter");
		});

		it("should calculate total level from single class", () => {
			state.addClass({name: "Wizard", source: "PHB", level: 5});
			expect(state.getTotalLevel()).toBe(5);
		});

		it("should calculate total level for multiclass", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 3});
			state.addClass({name: "Rogue", source: "PHB", level: 2});
			expect(state.getTotalLevel()).toBe(5);
		});

		it("should return 1 as minimum level when no classes", () => {
			expect(state.getTotalLevel()).toBe(1);
		});

		it("should generate class summary", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 3});
			expect(state.getClassSummary()).toBe("Fighter 3");
		});

		it("should generate multiclass summary", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 3});
			state.addClass({name: "Rogue", source: "PHB", level: 2});
			expect(state.getClassSummary()).toBe("Fighter 3 / Rogue 2");
		});

		it("should include subclass in summary", () => {
			state.addClass({
				name: "Fighter",
				source: "PHB",
				level: 3,
				subclass: {name: "Champion", source: "PHB"},
			});
			expect(state.getClassSummary()).toBe("Fighter 3 (Champion)");
		});
	});

	// ==========================================================================
	// Proficiency Bonus
	// ==========================================================================
	describe("Proficiency Bonus", () => {
		const profBonusTests = [
			{level: 1, expected: 2},
			{level: 4, expected: 2},
			{level: 5, expected: 3},
			{level: 8, expected: 3},
			{level: 9, expected: 4},
			{level: 12, expected: 4},
			{level: 13, expected: 5},
			{level: 16, expected: 5},
			{level: 17, expected: 6},
			{level: 20, expected: 6},
		];

		profBonusTests.forEach(({level, expected}) => {
			it(`should return +${expected} proficiency bonus at level ${level}`, () => {
				state.addClass({name: "Fighter", source: "PHB", level});
				expect(state.getProficiencyBonus()).toBe(expected);
			});
		});

		it("should return +2 when no classes (level 1)", () => {
			expect(state.getProficiencyBonus()).toBe(2);
		});
	});

	// ==========================================================================
	// Ability Scores and Modifiers
	// ==========================================================================
	describe("Ability Scores and Modifiers", () => {
		it("should set and get base ability score", () => {
			state.setAbilityBase("str", 16);
			expect(state.getAbilityBase("str")).toBe(16);
		});

		it("should apply ability bonuses", () => {
			state.setAbilityBase("str", 14);
			state.setAbilityBonus("str", 2);
			expect(state.getAbilityScore("str")).toBe(16);
		});

		it("should calculate ability modifier correctly", () => {
			const modifierTests = [
				{score: 1, expected: -5},
				{score: 3, expected: -4},
				{score: 8, expected: -1},
				{score: 9, expected: -1},
				{score: 10, expected: 0},
				{score: 11, expected: 0},
				{score: 12, expected: 1},
				{score: 13, expected: 1},
				{score: 14, expected: 2},
				{score: 15, expected: 2},
				{score: 16, expected: 3},
				{score: 18, expected: 4},
				{score: 20, expected: 5},
				{score: 22, expected: 6},
				{score: 30, expected: 10},
			];

			modifierTests.forEach(({score, expected}) => {
				state.setAbilityBase("str", score);
				expect(state.getAbilityMod("str")).toBe(expected);
			});
		});

		it("should combine base + bonus for ability score", () => {
			state.setAbilityBase("dex", 15);
			state.setAbilityBonus("dex", 2);
			expect(state.getAbilityScore("dex")).toBe(17);
			expect(state.getAbilityMod("dex")).toBe(3);
		});

		it("should return total bonus separately", () => {
			state.setAbilityBase("con", 14);
			state.setAbilityBonus("con", 2);
			expect(state.getAbilityBonus("con")).toBe(2);
		});
	});

	// ==========================================================================
	// Hit Points
	// ==========================================================================
	describe("Hit Points", () => {
		beforeEach(() => {
			// Set up a level 5 fighter with 14 CON
			state.addClass({name: "Fighter", source: "PHB", level: 5});
			state.setAbilityBase("con", 14);
		});

		it("should set and get current HP", () => {
			state.setMaxHp(44);
			state.setCurrentHp(30);
			expect(state.getCurrentHp()).toBe(30);
		});

		it("should not allow current HP to exceed max HP", () => {
			state.setMaxHp(44);
			state.setCurrentHp(100);
			expect(state.getCurrentHp()).toBe(44);
		});

		it("should not allow current HP to go below 0", () => {
			state.setMaxHp(44);
			state.setCurrentHp(-10);
			expect(state.getCurrentHp()).toBe(0);
		});

		it("should set and get temp HP", () => {
			state.setTempHp(10);
			expect(state.getTempHp()).toBe(10);
		});

		it("should not allow negative temp HP", () => {
			state.setTempHp(-5);
			expect(state.getTempHp()).toBe(0);
		});

		it("should heal character without exceeding max", () => {
			state.setMaxHp(44);
			state.setCurrentHp(20);
			state.heal(10);
			expect(state.getCurrentHp()).toBe(30);
		});

		it("should cap healing at max HP", () => {
			state.setMaxHp(44);
			state.setCurrentHp(40);
			state.heal(100);
			expect(state.getCurrentHp()).toBe(44);
		});

		it("should return unified HP object", () => {
			state.setMaxHp(44);
			state.setCurrentHp(30);
			state.setTempHp(5);
			const hp = state.getHp();
			expect(hp.current).toBe(30);
			expect(hp.max).toBe(44);
			expect(hp.temp).toBe(5);
		});
	});

	// ==========================================================================
	// Hit Dice
	// ==========================================================================
	describe("Hit Dice", () => {
		it("should track hit dice by type", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 5});
			const hitDice = state.getHitDice();
			expect(hitDice).toHaveLength(1);
			expect(hitDice[0].type).toBe("d10");
			expect(hitDice[0].max).toBe(5);
		});

		it("should track multiple hit die types for multiclass", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 3});
			state.addClass({name: "Wizard", source: "PHB", level: 2});
			const hitDice = state.getHitDice();
			expect(hitDice.length).toBeGreaterThanOrEqual(2);
		});

		it("should use hit die and reduce current count", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 5});
			const initialHd = state.getHitDice()[0].current;
			state.useHitDie("d10");
			const afterHd = state.getHitDice()[0].current;
			expect(afterHd).toBe(initialHd - 1);
		});

		it("should not use hit die if none available", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 1});
			state.setHitDice([{type: "d10", current: 0, max: 1}]);
			const result = state.useHitDie("d10");
			expect(result).toBe(false);
		});

		it("should recover hit dice correctly", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 6});
			state.setHitDice([{type: "d10", current: 0, max: 6}]);
			state.recoverHitDice(); // Should recover half = 3
			const hitDice = state.getHitDice();
			expect(hitDice[0].current).toBe(3);
		});

		it("should recover at least 1 hit die on long rest", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 1});
			state.setHitDice([{type: "d10", current: 0, max: 1}]);
			state.recoverHitDice();
			expect(state.getHitDice()[0].current).toBe(1);
		});
	});

	// ==========================================================================
	// Death Saves
	// ==========================================================================
	describe("Death Saves", () => {
		it("should add death save success", () => {
			state.addDeathSaveSuccess();
			expect(state.getDeathSaves().successes).toBe(1);
		});

		it("should add death save failure", () => {
			state.addDeathSaveFailure();
			expect(state.getDeathSaves().failures).toBe(1);
		});

		it("should cap successes at 3", () => {
			state.setDeathSaves({successes: 2, failures: 0});
			state.addDeathSaveSuccess();
			state.addDeathSaveSuccess();
			expect(state.getDeathSaves().successes).toBe(3);
		});

		it("should cap failures at 3", () => {
			state.setDeathSaves({successes: 0, failures: 2});
			state.addDeathSaveFailure();
			state.addDeathSaveFailure();
			expect(state.getDeathSaves().failures).toBe(3);
		});

		it("should reset death saves", () => {
			state.setDeathSaves({successes: 2, failures: 1});
			state.resetDeathSaves();
			const saves = state.getDeathSaves();
			expect(saves.successes).toBe(0);
			expect(saves.failures).toBe(0);
		});
	});

	// ==========================================================================
	// Inspiration
	// ==========================================================================
	describe("Inspiration", () => {
		it("should set and get inspiration", () => {
			state.setInspiration(true);
			expect(state.getInspiration()).toBe(true);
		});

		it("should toggle inspiration", () => {
			expect(state.getInspiration()).toBe(false);
			state.setInspiration(true);
			expect(state.getInspiration()).toBe(true);
			state.setInspiration(false);
			expect(state.getInspiration()).toBe(false);
		});
	});

	// ==========================================================================
	// Senses
	// ==========================================================================
	describe("Senses", () => {
		it("should set and get base senses", () => {
			state.setSense("darkvision", 60);
			expect(state.getSense("darkvision")).toBe(60);
		});

		it("should return 0 for unset senses", () => {
			expect(state.getSense("darkvision")).toBe(0);
		});

		it("should get all senses", () => {
			state.setSense("darkvision", 60);
			state.setSense("blindsight", 10);
			const senses = state.getSenses();
			expect(senses.darkvision).toBe(60);
			expect(senses.blindsight).toBe(10);
			expect(senses.tremorsense).toBe(0);
		});
	});

	// ==========================================================================
	// Passive Scores
	// ==========================================================================
	describe("Passive Scores", () => {
		it("should calculate passive perception (10 + perception mod)", () => {
			state.setAbilityBase("wis", 14); // +2 mod
			// No proficiency, so just ability mod
			expect(state.getPassivePerception()).toBe(12);
		});

		it("should include skill proficiency in passive perception", () => {
			state.setAbilityBase("wis", 14); // +2 mod
			state.addClass({name: "Cleric", source: "PHB", level: 1}); // +2 prof
			state.setSkillProficiency("perception", 1);
			expect(state.getPassivePerception()).toBe(14); // 10 + 2 + 2
		});

		it("should calculate passive investigation", () => {
			state.setAbilityBase("int", 16); // +3 mod
			expect(state.getPassiveInvestigation()).toBe(13);
		});

		it("should calculate passive insight", () => {
			state.setAbilityBase("wis", 12); // +1 mod
			expect(state.getPassiveInsight()).toBe(11);
		});
	});

	// ==========================================================================
	// Skills and Proficiencies
	// ==========================================================================
	describe("Skills and Proficiencies", () => {
		beforeEach(() => {
			state.addClass({name: "Rogue", source: "PHB", level: 1});
		});

		it("should set skill proficiency", () => {
			state.setSkillProficiency("stealth", 1);
			expect(state.getSkillProficiency("stealth")).toBe(1);
		});

		it("should set expertise (double proficiency)", () => {
			state.setSkillProficiency("stealth", 2);
			expect(state.getSkillProficiency("stealth")).toBe(2);
		});

		it("should calculate skill modifier without proficiency", () => {
			state.setAbilityBase("dex", 14); // +2
			expect(state.getSkillMod("stealth")).toBe(2);
		});

		it("should calculate skill modifier with proficiency", () => {
			state.setAbilityBase("dex", 14); // +2
			state.setSkillProficiency("stealth", 1); // +2 prof at level 1
			expect(state.getSkillMod("stealth")).toBe(4); // 2 + 2
		});

		it("should calculate skill modifier with expertise", () => {
			state.setAbilityBase("dex", 14); // +2
			state.setSkillProficiency("stealth", 2); // expertise = +4 at level 1
			expect(state.getSkillMod("stealth")).toBe(6); // 2 + 4
		});

		it("should check if proficient in skill", () => {
			state.setSkillProficiency("athletics", 1);
			expect(state.isProficientInSkill("athletics")).toBe(true);
			expect(state.isProficientInSkill("acrobatics")).toBe(false);
		});

		it("should check if has expertise in skill", () => {
			state.setSkillProficiency("stealth", 2);
			expect(state.hasExpertise("stealth")).toBe(true);
			expect(state.hasExpertise("athletics")).toBe(false);
		});
	});

	// ==========================================================================
	// Saving Throws
	// ==========================================================================
	describe("Saving Throws", () => {
		beforeEach(() => {
			state.addClass({name: "Fighter", source: "PHB", level: 1});
			state.setAbilityBase("str", 16);
			state.setAbilityBase("con", 14);
		});

		it("should calculate save without proficiency", () => {
			expect(state.getSaveMod("dex")).toBe(0); // 10 DEX = +0
		});

		it("should calculate save with proficiency", () => {
			state.addSaveProficiency("str");
			expect(state.getSaveMod("str")).toBe(5); // +3 STR + 2 prof
		});

		it("should add saving throw proficiency", () => {
			state.addSaveProficiency("con");
			expect(state.hasSaveProficiency("con")).toBe(true);
		});

		it("should not duplicate save proficiencies", () => {
			state.addSaveProficiency("str");
			state.addSaveProficiency("str");
			const profs = state.getSaveProficiencies();
			expect(profs.filter(p => p === "str").length).toBe(1);
		});
	});

	// ==========================================================================
	// Speed
	// ==========================================================================
	describe("Speed", () => {
		it("should get default walking speed", () => {
			expect(state.getSpeed("walk")).toBe(30);
		});

		it("should set and get walking speed", () => {
			state.setSpeed("walk", 35);
			expect(state.getSpeed("walk")).toBe(35);
		});

		it("should set and get flying speed", () => {
			state.setSpeed("fly", 60);
			expect(state.getSpeed("fly")).toBe(60);
		});

		it("should return null for unset special speeds", () => {
			expect(state.getSpeed("fly")).toBeNull();
			expect(state.getSpeed("swim")).toBeNull();
			expect(state.getSpeed("climb")).toBeNull();
			expect(state.getSpeed("burrow")).toBeNull();
		});

		it("should get all speeds", () => {
			state.setSpeed("walk", 30);
			state.setSpeed("fly", 60);
			const speeds = state.getSpeeds();
			expect(speeds.walk).toBe(30);
			expect(speeds.fly).toBe(60);
		});
	});

	// ==========================================================================
	// Armor Class
	// ==========================================================================
	describe("Armor Class", () => {
		beforeEach(() => {
			state.setAbilityBase("dex", 14); // +2 DEX
		});

		it("should calculate base AC (10 + DEX)", () => {
			expect(state.getAC()).toBe(12);
		});

		it("should apply armor AC", () => {
			state.setArmor({name: "Chain Mail", ac: 16, type: "heavy"});
			expect(state.getAC()).toBe(16); // Heavy armor ignores DEX
		});

		it("should apply medium armor with DEX cap", () => {
			state.setAbilityBase("dex", 18); // +4 DEX
			state.setArmor({name: "Scale Mail", ac: 14, type: "medium"});
			expect(state.getAC()).toBe(16); // 14 + 2 (max DEX for medium)
		});

		it("should apply light armor with full DEX", () => {
			state.setAbilityBase("dex", 18); // +4 DEX
			state.setArmor({name: "Leather", ac: 11, type: "light"});
			expect(state.getAC()).toBe(15); // 11 + 4
		});

		it("should add shield bonus", () => {
			state.setShield(true);
			expect(state.getAC()).toBe(14); // 10 + 2 DEX + 2 shield
		});

		it("should combine armor and shield", () => {
			state.setArmor({name: "Chain Mail", ac: 16, type: "heavy"});
			state.setShield(true);
			expect(state.getAC()).toBe(18); // 16 + 2 shield
		});
	});

	// ==========================================================================
	// Serialization
	// ==========================================================================
	describe("Serialization", () => {
		it("should serialize to JSON", () => {
			state.setName("Test Character");
			state.addClass({name: "Fighter", source: "PHB", level: 5});
			state.setAbilityBase("str", 16);

			const json = state.toJSON();
			expect(json.name).toBe("Test Character");
			expect(json.classes).toHaveLength(1);
			expect(json.abilities.str).toBe(16);
		});

		it("should deserialize from JSON", () => {
			const json = {
				name: "Loaded Character",
				classes: [{name: "Wizard", source: "PHB", level: 3}],
				abilities: {str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10},
			};

			state.fromJSON(json);
			expect(state.getName()).toBe("Loaded Character");
			expect(state.getClasses()).toHaveLength(1);
			expect(state.getAbilityBase("int")).toBe(18);
		});

		it("should round-trip serialize and deserialize", () => {
			state.setName("Round Trip");
			state.addClass({name: "Paladin", source: "PHB", level: 7});
			state.setAbilityBase("cha", 18);
			state.setCurrentHp(50);
			state.setMaxHp(65);

			const json = state.toJSON();
			const newState = new CharacterSheetState();
			newState.fromJSON(json);

			expect(newState.getName()).toBe("Round Trip");
			expect(newState.getTotalLevel()).toBe(7);
			expect(newState.getAbilityScore("cha")).toBe(18);
		});
	});
});
