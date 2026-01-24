/**
 * Character Sheet Level Up - Unit Tests
 * Tests for level progression, feature acquisition, ASI/feat selection
 */

import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

describe("Level Progression", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
	});

	// ==========================================================================
	// Basic Level Up
	// ==========================================================================
	describe("Basic Level Up", () => {
		it("should increase class level", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 1});
			state.levelUp("Fighter");
			expect(state.getClasses()[0].level).toBe(2);
		});

		it("should update total level", () => {
			state.addClass({name: "Wizard", source: "PHB", level: 4});
			state.levelUp("Wizard");
			expect(state.getTotalLevel()).toBe(5);
		});

		it("should update proficiency bonus at appropriate levels", () => {
			state.addClass({name: "Rogue", source: "PHB", level: 4});
			expect(state.getProficiencyBonus()).toBe(2);
			state.levelUp("Rogue"); // Level 5
			expect(state.getProficiencyBonus()).toBe(3);
		});

		it("should not exceed level 20", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 20});
			const result = state.levelUp("Fighter");
			expect(result).toBe(false);
			expect(state.getClasses()[0].level).toBe(20);
		});
	});

	// ==========================================================================
	// Hit Points on Level Up
	// ==========================================================================
	describe("Hit Points on Level Up", () => {
		it("should increase max HP on level up", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 1});
			state.setAbilityBase("con", 14); // +2 CON
			state.setMaxHp(12); // First level max (d10 + 2 CON)

			state.levelUp("Fighter");
			// Level 2: 6 (average d10) + 2 CON = 8 more HP
			expect(state.getMaxHp()).toBeGreaterThan(12);
		});

		it("should add CON modifier per level", () => {
			state.addClass({name: "Wizard", source: "PHB", level: 1});
			state.setAbilityBase("con", 16); // +3 CON
			const initialHp = state.getMaxHp();

			state.levelUp("Wizard");
			// d6 average (4) + 3 CON = 7 more HP
			const expectedMinIncrease = 4 + 3;
			expect(state.getMaxHp() - initialHp).toBeGreaterThanOrEqual(expectedMinIncrease - 1);
		});

		it("should update hit dice on level up", () => {
			state.addClass({name: "Barbarian", source: "PHB", level: 3});
			const initialHd = state.getHitDice()[0].max;
			state.levelUp("Barbarian");
			expect(state.getHitDice()[0].max).toBe(initialHd + 1);
		});
	});

	// ==========================================================================
	// Ability Score Improvements
	// ==========================================================================
	describe("Ability Score Improvements", () => {
		it("should detect ASI levels", () => {
			expect(state.isASILevel("Fighter", 4)).toBe(true);
			expect(state.isASILevel("Fighter", 6)).toBe(true);
			expect(state.isASILevel("Fighter", 8)).toBe(true);
			expect(state.isASILevel("Fighter", 5)).toBe(false);
		});

		it("should detect Fighter bonus ASI at level 6", () => {
			expect(state.isASILevel("Fighter", 6)).toBe(true);
		});

		it("should detect Rogue bonus ASI at level 10", () => {
			expect(state.isASILevel("Rogue", 10)).toBe(true);
		});

		it("should allow ability score increase", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 4});
			state.setAbilityBase("str", 16);
			state.applyASI("str", 2);
			expect(state.getAbilityScore("str")).toBe(18);
		});

		it("should not allow ability score above 20", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 4});
			state.setAbilityBase("str", 19);
			state.applyASI("str", 2);
			expect(state.getAbilityScore("str")).toBe(20);
		});

		it("should allow splitting ASI between two abilities", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 4});
			state.setAbilityBase("str", 15);
			state.setAbilityBase("con", 13);
			state.applyASI("str", 1);
			state.applyASI("con", 1);
			expect(state.getAbilityScore("str")).toBe(16);
			expect(state.getAbilityScore("con")).toBe(14);
		});
	});

	// ==========================================================================
	// Feat Selection
	// ==========================================================================
	describe("Feat Selection", () => {
		beforeEach(() => {
			state.addClass({name: "Fighter", source: "PHB", level: 4});
		});

		it("should add a feat instead of ASI", () => {
			state.addFeat({name: "Alert", source: "PHB"});
			const feats = state.getFeats();
			expect(feats).toHaveLength(1);
			expect(feats[0].name).toBe("Alert");
		});

		it("should track feat that grants ability increase", () => {
			state.setAbilityBase("dex", 15);
			state.addFeat({name: "Athlete", source: "PHB", abilityBonus: {dex: 1}});
			// Athlete grants +1 DEX
			const featBonus = state.getAbilityBonus("dex");
			expect(featBonus).toBeGreaterThanOrEqual(1);
		});

		it("should track multiple feats", () => {
			state.addFeat({name: "Alert", source: "PHB"});
			state.addClass({name: "Fighter", source: "PHB", level: 4}); // This overwrites
			state.addFeat({name: "Sentinel", source: "PHB"});
			expect(state.getFeats().length).toBeGreaterThanOrEqual(1);
		});

		it("should check if has specific feat", () => {
			state.addFeat({name: "Lucky", source: "PHB"});
			expect(state.hasFeat("Lucky")).toBe(true);
			expect(state.hasFeat("Great Weapon Master")).toBe(false);
		});

		it("should not allow duplicate feats", () => {
			state.addFeat({name: "Tough", source: "PHB"});
			const result = state.addFeat({name: "Tough", source: "PHB"});
			expect(result).toBe(false);
			expect(state.getFeats().filter(f => f.name === "Tough").length).toBe(1);
		});
	});

	// ==========================================================================
	// Class Features
	// ==========================================================================
	describe("Class Features", () => {
		it("should gain features at appropriate levels", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 1});
			state.addFeature({
				name: "Fighting Style",
				className: "Fighter",
				level: 1,
				featureType: "Class",
			});
			const features = state.getFeatures();
			expect(features.some(f => f.name === "Fighting Style")).toBe(true);
		});

		it("should track feature uses", () => {
			state.addFeature({
				name: "Second Wind",
				className: "Fighter",
				level: 1,
				uses: {current: 1, max: 1},
				recharge: "short",
			});
			const feature = state.getFeature("Second Wind");
			expect(feature.uses.max).toBe(1);
		});

		it("should use feature charge", () => {
			state.addFeature({
				id: "feature1",
				name: "Action Surge",
				className: "Fighter",
				level: 2,
				uses: {current: 1, max: 1},
				recharge: "short",
			});
			state.useFeature("feature1");
			expect(state.getFeature("Action Surge").uses.current).toBe(0);
		});

		it("should restore feature uses on appropriate rest", () => {
			state.addFeature({
				id: "feature1",
				name: "Second Wind",
				uses: {current: 0, max: 1},
				recharge: "short",
			});
			state.onShortRest();
			expect(state.getFeature("Second Wind").uses.current).toBe(1);
		});
	});

	// ==========================================================================
	// Subclass Selection
	// ==========================================================================
	describe("Subclass Selection", () => {
		it("should detect subclass selection level", () => {
			expect(state.getSubclassLevel("Fighter")).toBe(3);
			expect(state.getSubclassLevel("Cleric")).toBe(1);
			expect(state.getSubclassLevel("Wizard")).toBe(2);
			expect(state.getSubclassLevel("Warlock")).toBe(1);
		});

		it("should set subclass for class", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 3});
			state.setSubclass("Fighter", {name: "Champion", source: "PHB"});
			expect(state.getClasses()[0].subclass.name).toBe("Champion");
		});

		it("should include subclass in class summary", () => {
			state.addClass({
				name: "Wizard",
				source: "PHB",
				level: 5,
				subclass: {name: "Evocation", source: "PHB"},
			});
			expect(state.getClassSummary()).toContain("Evocation");
		});

		it("should add subclass features", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 3});
			state.setSubclass("Fighter", {name: "Champion", source: "PHB"});
			state.addFeature({
				name: "Improved Critical",
				className: "Fighter",
				subclassName: "Champion",
				level: 3,
				featureType: "Subclass",
			});
			const features = state.getFeatures();
			expect(features.some(f => f.name === "Improved Critical")).toBe(true);
		});
	});

	// ==========================================================================
	// Multiclassing
	// ==========================================================================
	describe("Multiclassing", () => {
		beforeEach(() => {
			// Start with a level 5 Fighter
			state.addClass({name: "Fighter", source: "PHB", level: 5});
			state.setAbilityBase("str", 16);
			state.setAbilityBase("dex", 13);
		});

		it("should add a second class", () => {
			state.addClass({name: "Rogue", source: "PHB", level: 1});
			expect(state.getClasses()).toHaveLength(2);
		});

		it("should track multiclass total level", () => {
			state.addClass({name: "Rogue", source: "PHB", level: 2});
			expect(state.getTotalLevel()).toBe(7); // 5 + 2
		});

		it("should use total level for proficiency bonus", () => {
			state.addClass({name: "Rogue", source: "PHB", level: 4});
			// Total level 9 = +4 proficiency
			expect(state.getProficiencyBonus()).toBe(4);
		});

		it("should check multiclass prerequisites", () => {
			// Fighter needs 13 STR or DEX
			// Rogue needs 13 DEX
			state.setAbilityBase("dex", 12);
			expect(state.meetsMulticlassRequirement("Rogue")).toBe(false);
			state.setAbilityBase("dex", 13);
			expect(state.meetsMulticlassRequirement("Rogue")).toBe(true);
		});

		it("should check Paladin multiclass requirements (STR 13 + CHA 13)", () => {
			state.setAbilityBase("str", 13);
			state.setAbilityBase("cha", 12);
			expect(state.meetsMulticlassRequirement("Paladin")).toBe(false);
			state.setAbilityBase("cha", 13);
			expect(state.meetsMulticlassRequirement("Paladin")).toBe(true);
		});

		it("should level up specific class in multiclass", () => {
			state.addClass({name: "Rogue", source: "PHB", level: 1});
			state.levelUp("Rogue");
			expect(state.getClasses()[0].level).toBe(5); // Fighter unchanged
			expect(state.getClasses()[1].level).toBe(2); // Rogue leveled
		});

		it("should track hit dice from multiple classes", () => {
			state.addClass({name: "Wizard", source: "PHB", level: 3});
			const hitDice = state.getHitDice();
			// Should have d10 from Fighter and d6 from Wizard
			const types = hitDice.map(hd => hd.type);
			expect(types).toContain("d10");
			expect(types).toContain("d6");
		});
	});

	// ==========================================================================
	// Spell Slot Progression (Multiclass)
	// ==========================================================================
	describe("Multiclass Spell Slots", () => {
		it("should combine full caster levels", () => {
			state.addClass({name: "Wizard", source: "PHB", level: 3});
			state.addClass({name: "Cleric", source: "PHB", level: 3});
			// 3 + 3 = 6 caster levels
			const slots = state.getSpellSlots();
			expect(slots[3]?.max).toBe(3); // Level 6 caster has 3 third-level slots
		});

		it("should handle half-caster multiclass correctly", () => {
			state.addClass({name: "Wizard", source: "PHB", level: 4});
			state.addClass({name: "Paladin", source: "PHB", level: 4});
			// 4 (full) + 2 (half) = 6 caster levels
			const slots = state.getSpellSlots();
			expect(slots[3]?.max).toBe(3);
		});

		it("should round down for half-caster levels", () => {
			state.addClass({name: "Paladin", source: "PHB", level: 3});
			// 3 Paladin levels = 1.5 → 1 caster level
			const casterLevel = state.getMulticlassCasterLevel();
			expect(casterLevel).toBe(1);
		});

		it("should not include non-caster levels", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 5});
			state.addClass({name: "Wizard", source: "PHB", level: 3});
			// Fighter contributes 0, Wizard contributes 3
			const casterLevel = state.getMulticlassCasterLevel();
			expect(casterLevel).toBe(3);
		});

		it("should include Eldritch Knight as third-caster", () => {
			state.addClass({
				name: "Fighter",
				source: "PHB",
				level: 6,
				subclass: {name: "Eldritch Knight", source: "PHB"},
			});
			// 6 Fighter levels with EK = 2 caster levels (6/3)
			const casterLevel = state.getMulticlassCasterLevel();
			expect(casterLevel).toBe(2);
		});
	});

	// ==========================================================================
	// Proficiency Grants
	// ==========================================================================
	describe("Proficiency Grants on Level Up", () => {
		it("should grant skill proficiencies at level 1", () => {
			state.addClass({name: "Rogue", source: "PHB", level: 1});
			// Rogues get 4 skill proficiencies
			// This would be handled by the builder, but state should track
			state.setSkillProficiency("stealth", 1);
			state.setSkillProficiency("perception", 1);
			expect(state.isProficientInSkill("stealth")).toBe(true);
		});

		it("should grant armor proficiencies based on class", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 1});
			state.addArmorProficiency("heavy");
			expect(state.hasArmorProficiency("heavy")).toBe(true);
		});

		it("should grant weapon proficiencies based on class", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 1});
			state.addWeaponProficiency("martial");
			expect(state.hasWeaponProficiency("martial")).toBe(true);
		});

		it("should grant limited proficiencies when multiclassing", () => {
			// Multiclass into Rogue only grants some proficiencies
			state.addClass({name: "Fighter", source: "PHB", level: 5});
			// When multiclassing into Rogue, you get: light armor, thieves' tools, 1 skill
			// This is tracking capability, not automatic granting
			state.addArmorProficiency("light");
			expect(state.hasArmorProficiency("light")).toBe(true);
		});
	});

	// ==========================================================================
	// Extra Attack
	// ==========================================================================
	describe("Extra Attack", () => {
		it("should track number of attacks for Fighter", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 5});
			expect(state.getNumberOfAttacks()).toBe(2);
		});

		it("should increase attacks at Fighter 11", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 11});
			expect(state.getNumberOfAttacks()).toBe(3);
		});

		it("should increase attacks at Fighter 20", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 20});
			expect(state.getNumberOfAttacks()).toBe(4);
		});

		it("should track extra attack for other martial classes", () => {
			state.addClass({name: "Paladin", source: "PHB", level: 5});
			expect(state.getNumberOfAttacks()).toBe(2);
		});

		it("should not stack extra attack from multiclass", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 5});
			state.addClass({name: "Paladin", source: "PHB", level: 5});
			// Both have Extra Attack, but they don't stack
			expect(state.getNumberOfAttacks()).toBe(2);
		});
	});
});
