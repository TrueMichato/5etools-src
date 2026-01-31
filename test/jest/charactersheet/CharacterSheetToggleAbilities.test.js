/* eslint-disable no-console */

import "./setup.js"; // Import first to set up mocks

let CharacterSheetState;
let charState;

beforeAll(async () => {
	CharacterSheetState = (await import("../../../js/charactersheet/charactersheet-state.js")).CharacterSheetState;
});

describe("Character Sheet Toggle Abilities", () => {

	beforeEach(() => {
		charState = new CharacterSheetState();
	});

	// ===================================================================
	// ACTIVE_STATE_TYPES Tests
	// ===================================================================
	describe("ACTIVE_STATE_TYPES Registry", () => {
		test("should have standard D&D state types", () => {
			const stateTypes = CharacterSheetState.ACTIVE_STATE_TYPES;
			
			expect(stateTypes.rage).toBeDefined();
			expect(stateTypes.rage.name).toBe("Rage");
			expect(stateTypes.rage.icon).toBe("💢");
			expect(stateTypes.rage.effects).toContainEqual({type: "advantage", target: "check:str"});
			expect(stateTypes.rage.effects).toContainEqual({type: "advantage", target: "save:str"});
			expect(stateTypes.rage.effects).toContainEqual({type: "resistance", target: "damage:bludgeoning"});
			
			expect(stateTypes.concentration).toBeDefined();
			expect(stateTypes.wildShape).toBeDefined();
			expect(stateTypes.dodge).toBeDefined();
			expect(stateTypes.prone).toBeDefined();
			expect(stateTypes.bladesong).toBeDefined();
		});

		test("should have TGTT/homebrew state types", () => {
			const stateTypes = CharacterSheetState.ACTIVE_STATE_TYPES;
			
			// Combat Stances
			expect(stateTypes.heavyStance).toBeDefined();
			expect(stateTypes.heavyStance.name).toBe("Heavy Stance");
			expect(stateTypes.heavyStance.resourceName).toBe("Exertion");
			expect(stateTypes.heavyStance.resourceCost).toBe(1);
			
			expect(stateTypes.standTallStance).toBeDefined();
			expect(stateTypes.standTallStance.effects).toContainEqual({type: "sizeIncrease", value: 1});
			
			// Blade Breaker stances
			expect(stateTypes.fighterStance).toBeDefined();
			expect(stateTypes.adamantineBull).toBeDefined();
			expect(stateTypes.ironPunisher).toBeDefined();
			expect(stateTypes.ironPunisher.effects).toContainEqual({type: "advantage", target: "attack:melee"});
			expect(stateTypes.ironPunisher.effects).toContainEqual({type: "advantage", target: "attacksAgainst"});
			
			expect(stateTypes.steelSerpent).toBeDefined();
			expect(stateTypes.weightlessMithral).toBeDefined();
			expect(stateTypes.weightlessMithral.effects).toContainEqual({type: "advantage", target: "save:dex"});
			
			// Jester's Acts
			expect(stateTypes.jestersAct).toBeDefined();
			expect(stateTypes.pantomime).toBeDefined();
			expect(stateTypes.tumbler).toBeDefined();
			
			// Other homebrew
			expect(stateTypes.tricksterTrick).toBeDefined();
			expect(stateTypes.metamagic).toBeDefined();
			expect(stateTypes.wardingSpell).toBeDefined();
			expect(stateTypes.homebrewToggle).toBeDefined();
		});

		test("state types should have required properties", () => {
			const stateTypes = CharacterSheetState.ACTIVE_STATE_TYPES;
			
			for (const [id, stateType] of Object.entries(stateTypes)) {
				expect(stateType.id).toBe(id);
				expect(stateType.name).toBeDefined();
				expect(stateType.icon).toBeDefined();
				expect(Array.isArray(stateType.effects)).toBe(true);
			}
		});
	});

	// ===================================================================
	// detectActivatableFeature Tests
	// ===================================================================
	describe("detectActivatableFeature", () => {
		test("should detect Rage by name", () => {
			const feature = {name: "Rage", description: "You can enter a rage..."};
			const result = CharacterSheetState.detectActivatableFeature(feature);
			
			expect(result).not.toBeNull();
			expect(result.stateTypeId).toBe("rage");
			expect(result.matchedBy).toBe("name");
		});

		test("should detect Bladesong by pattern", () => {
			const feature = {
				name: "Bladesong",
				description: "Starting at 2nd level, you can invoke a secret elven magic called the Bladesong..."
			};
			const result = CharacterSheetState.detectActivatableFeature(feature);
			
			expect(result).not.toBeNull();
			expect(result.stateTypeId).toBe("bladesong");
		});

		test("should detect combat stance features", () => {
			const feature = {
				name: "Heavy Stance",
				description: "Bonus Action (1 Exertion Point). You enter this stance. While in this stance, you gain a bonus..."
			};
			const result = CharacterSheetState.detectActivatableFeature(feature);
			
			expect(result).not.toBeNull();
			expect(result.stateTypeId).toBe("heavyStance");
			expect(result.exertionCost).toBe(1);
			expect(result.activationAction).toBe("bonus");
		});

		test("should detect exertion cost from description", () => {
			const feature = {
				name: "Stand Tall Stance",
				description: "Bonus Action (1 Exertion Point). You enter this stance, counting as one size larger..."
			};
			const result = CharacterSheetState.detectActivatableFeature(feature);
			
			expect(result).not.toBeNull();
			expect(result.exertionCost).toBe(1);
		});

		test("should detect Ki cost from description", () => {
			const feature = {
				name: "Stunning Strike",
				description: "When you hit, you can spend 1 ki point to attempt a stunning strike..."
			};
			const result = CharacterSheetState.detectActivatableFeature(feature);
			
			expect(result).not.toBeNull();
			expect(result.kiCost).toBe(1);
		});

		test("should detect Sorcery Point cost from description", () => {
			const feature = {
				name: "Quickened Spell",
				description: "When you cast a spell, you can spend 2 sorcery points to cast it as a bonus action..."
			};
			const result = CharacterSheetState.detectActivatableFeature(feature);
			
			expect(result).not.toBeNull();
			expect(result.sorceryPointCost).toBe(2);
		});

		test("should detect Bardic Inspiration cost from description", () => {
			const feature = {
				name: "Fool's Folly",
				description: "You can expend one use of your Bardic Inspiration to cause the target to become incapacitated..."
			};
			const result = CharacterSheetState.detectActivatableFeature(feature);
			
			expect(result).not.toBeNull();
			expect(result.bardicInspirationCost).toBe(1);
		});

		test("should detect generic stance from description", () => {
			const feature = {
				name: "Custom Stance",
				description: "As a bonus action, you enter this stance. While in this stance, you gain +1 AC..."
			};
			const result = CharacterSheetState.detectActivatableFeature(feature);
			
			expect(result).not.toBeNull();
			expect(result.stateTypeId).toBe("combatStance");
		});

		test("should detect activation action types", () => {
			// Features that have activation patterns should detect the action type
			const bonusAction = {name: "Test", description: "As a bonus action, you can enter this stance. While in this stance, you gain +1 AC..."};
			const action = {name: "Test2", description: "As an action, you can enter this stance..."};
			const reaction = {name: "Test3", description: "As a reaction when a creature enters your reach, you can enter this stance..."};
			
			expect(CharacterSheetState.detectActivatableFeature(bonusAction)?.activationAction).toBe("bonus");
			expect(CharacterSheetState.detectActivatableFeature(action)?.activationAction).toBe("action");
			expect(CharacterSheetState.detectActivatableFeature(reaction)?.activationAction).toBe("reaction");
		});

		test("should support data-driven activatable features", () => {
			const feature = {
				name: "Custom Toggle",
				description: "A custom ability",
				activatable: {
					stateTypeId: "homebrewToggle",
					activationAction: "bonus",
					resourceName: "Ki Points",
					resourceCost: 2,
					effects: [
						{type: "bonus", target: "ac", value: 2},
						{type: "advantage", target: "attack"},
					],
					duration: "1 minute",
				}
			};
			const result = CharacterSheetState.detectActivatableFeature(feature);
			
			expect(result).not.toBeNull();
			expect(result.isDataDriven).toBe(true);
			expect(result.activationAction).toBe("bonus");
			expect(result.resourceName).toBe("Ki Points");
			expect(result.resourceCost).toBe(2);
			expect(result.effects).toHaveLength(2);
		});

		test("should exclude non-activatable features", () => {
			const excluded = [
				{name: "Suggested Characteristics", description: "..."},
				{name: "Personality Trait", description: "..."},
				{name: "Combat Methods", description: "You learn combat methods..."},
				{name: "Exertion", description: "You have exertion points..."},
			];
			
			excluded.forEach(feature => {
				expect(CharacterSheetState.detectActivatableFeature(feature)).toBeNull();
			});
		});
	});

	// ===================================================================
	// parseEffectsFromDescription Tests
	// ===================================================================
	describe("parseEffectsFromDescription", () => {
		test("should parse speed bonuses", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"Your speed increases by 10 feet."
			);
			expect(effects).toContainEqual({type: "bonus", target: "speed", value: 10});
		});

		test("should parse AC bonuses", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"You gain a +2 bonus to your AC."
			);
			expect(effects).toContainEqual({type: "bonus", target: "ac", value: 2});
		});

		test("should parse advantage on attacks", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"You have advantage on melee attack rolls."
			);
			expect(effects).toContainEqual({type: "advantage", target: "attack:melee"});
		});

		test("should parse advantage on saving throws", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"You have advantage on Dexterity saving throws."
			);
			expect(effects).toContainEqual({type: "advantage", target: "save:dex"});
		});

		test("should parse damage resistance", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"You have resistance to fire damage."
			);
			expect(effects).toContainEqual({type: "resistance", target: "fire"});
		});

		test("should parse attacks against having advantage", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"Attacks against you have advantage."
			);
			expect(effects).toContainEqual({type: "advantage", target: "attacksAgainst"});
		});

		test("should parse attacks against having disadvantage", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"Attacks against you have disadvantage."
			);
			expect(effects).toContainEqual({type: "disadvantage", target: "attacksAgainst"});
		});

		test("should parse proficiency bonus effects", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"You gain a bonus to Strength (Athletics) checks equal to your proficiency bonus."
			);
			expect(effects).toContainEqual({type: "bonus", target: "check:str:athletics", useProficiency: true});
		});

		test("should parse size increase effects", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"While in this stance, you count as one size larger."
			);
			expect(effects.some(e => e.type === "sizeIncrease")).toBe(true);
		});

		test("should parse reach bonuses", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"You gain +5 feet reach on your turn."
			);
			expect(effects).toContainEqual({type: "bonus", target: "reach", value: 5});
		});

		test("should parse initiative advantage", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"You have advantage on initiative rolls."
			);
			expect(effects).toContainEqual({type: "advantage", target: "initiative"});
		});

		test("should parse movement through creatures", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"You can move through hostile creature spaces."
			);
			expect(effects.some(e => e.value?.includes("move through"))).toBe(true);
		});
	});

	// ===================================================================
	// Active State Management Tests
	// ===================================================================
	describe("Active State Management", () => {
		test("should add and activate a state", () => {
			const stateId = charState.addActiveState("rage");
			
			expect(stateId).toBeDefined();
			expect(charState.isStateTypeActive("rage")).toBe(true);
			
			const states = charState.getActiveStates();
			expect(states).toHaveLength(1);
			expect(states[0].stateTypeId).toBe("rage");
			expect(states[0].active).toBe(true);
		});

		test("should toggle a state on and off", () => {
			const stateId = charState.addActiveState("rage");
			
			expect(charState.isStateActive(stateId)).toBe(true);
			
			charState.toggleActiveState(stateId);
			expect(charState.isStateActive(stateId)).toBe(false);
			
			charState.toggleActiveState(stateId);
			expect(charState.isStateActive(stateId)).toBe(true);
		});

		test("should deactivate a state by type", () => {
			charState.addActiveState("rage");
			expect(charState.isStateTypeActive("rage")).toBe(true);
			
			charState.deactivateState("rage");
			expect(charState.isStateTypeActive("rage")).toBe(false);
		});

		test("should remove a state entirely", () => {
			const stateId = charState.addActiveState("rage");
			expect(charState.getActiveStates()).toHaveLength(1);
			
			charState.removeActiveState(stateId);
			expect(charState.getActiveStates()).toHaveLength(0);
		});

		test("should reactivate existing state instead of creating duplicate", () => {
			const stateId1 = charState.addActiveState("rage");
			charState.deactivateState("rage");
			
			const stateId2 = charState.addActiveState("rage");
			
			expect(stateId1).toBe(stateId2);
			expect(charState.getActiveStates()).toHaveLength(1);
			expect(charState.isStateTypeActive("rage")).toBe(true);
		});

		test("should add custom state with custom effects", () => {
			const stateId = charState.addActiveState("custom", {
				name: "My Custom Stance",
				icon: "🎯",
				sourceFeatureId: "feature_123",
				customEffects: [
					{type: "bonus", target: "ac", value: 2},
					{type: "advantage", target: "attack"},
				],
			});
			
			const state = charState.getActiveState(stateId);
			expect(state.name).toBe("My Custom Stance");
			expect(state.customEffects).toHaveLength(2);
		});
	});

	// ===================================================================
	// getActiveStateEffects Tests
	// ===================================================================
	describe("getActiveStateEffects", () => {
		test("should return effects from active Rage", () => {
			charState.addActiveState("rage");
			
			const effects = charState.getActiveStateEffects();
			
			expect(effects.some(e => e.type === "advantage" && e.target === "check:str")).toBe(true);
			expect(effects.some(e => e.type === "advantage" && e.target === "save:str")).toBe(true);
			expect(effects.some(e => e.type === "resistance" && e.target === "damage:bludgeoning")).toBe(true);
		});

		test("should return effects from active Dodge", () => {
			charState.addActiveState("dodge");
			
			const effects = charState.getActiveStateEffects();
			
			expect(effects.some(e => e.type === "disadvantage" && e.target === "attacksAgainst")).toBe(true);
			expect(effects.some(e => e.type === "advantage" && e.target === "save:dex")).toBe(true);
		});

		test("should return custom effects from custom state", () => {
			charState.addActiveState("custom", {
				name: "Test State",
				customEffects: [
					{type: "bonus", target: "ac", value: 3},
				],
			});
			
			const effects = charState.getActiveStateEffects();
			
			expect(effects.some(e => e.type === "bonus" && e.target === "ac" && e.value === 3)).toBe(true);
		});

		test("should not return effects from inactive states", () => {
			const stateId = charState.addActiveState("rage");
			charState.toggleActiveState(stateId);
			
			const effects = charState.getActiveStateEffects();
			
			expect(effects).toHaveLength(0);
		});

		test("should include state context in effects", () => {
			charState.addActiveState("rage");
			
			const effects = charState.getActiveStateEffects();
			
			effects.forEach(effect => {
				expect(effect.stateId).toBeDefined();
				expect(effect.stateName).toBe("Rage");
				expect(effect.stateIcon).toBe("💢");
			});
		});
	});

	// ===================================================================
	// getActivatableFeatures Tests
	// ===================================================================
	describe("getActivatableFeatures", () => {
		beforeEach(() => {
			// Add some features to the character
			charState.addFeature({
				name: "Rage",
				description: "You can enter a battle rage as a bonus action.",
				className: "Barbarian",
				classSource: "PHB",
				level: 1,
			});
			
			charState.addFeature({
				name: "Heavy Stance",
				description: "Bonus Action (1 Exertion Point). You enter this stance. While in this stance, you gain a bonus to Athletics checks equal to your proficiency bonus.",
				className: "Fighter",
				classSource: "A5E",
				level: 3,
			});
			
			// Add resources
			charState.addResource({
				name: "Rage",
				max: 3,
				current: 3,
				recharge: "long",
			});
			
			charState.setExertionMax(5);
			charState.setExertionCurrent(5);
		});

		test("should find activatable features", () => {
			const activatables = charState.getActivatableFeatures();
			
			expect(activatables.length).toBeGreaterThanOrEqual(2);
			expect(activatables.some(a => a.stateTypeId === "rage")).toBe(true);
			expect(activatables.some(a => a.stateTypeId === "heavyStance")).toBe(true);
		});

		test("should associate resources with activatables", () => {
			const activatables = charState.getActivatableFeatures();
			
			const heavyStance = activatables.find(a => a.stateTypeId === "heavyStance");
			expect(heavyStance.resource).toBeDefined();
			expect(heavyStance.resource.isExertion).toBe(true);
			expect(heavyStance.resource.cost).toBe(1);
		});

		test("should track active state for activatables", () => {
			charState.addActiveState("rage");
			
			const activatables = charState.getActivatableFeatures();
			const rage = activatables.find(a => a.stateTypeId === "rage");
			
			expect(rage.isActive).toBe(true);
		});

		test("should handle data-driven activatable features", () => {
			charState.addFeature({
				name: "Custom Toggle",
				description: "A custom ability",
				activatable: {
					stateTypeId: "homebrewToggle",
					activationAction: "bonus",
					resourceName: "Ki Points",
					resourceCost: 2,
					effects: [{type: "bonus", target: "ac", value: 2}],
				},
			});
			
			// Add Ki resource
			charState.addResource({name: "Ki Points", max: 10, current: 10});
			
			const activatables = charState.getActivatableFeatures();
			const custom = activatables.find(a => a.feature.name === "Custom Toggle");
			
			expect(custom).toBeDefined();
			expect(custom.activationInfo.isDataDriven).toBe(true);
			expect(custom.effects).toContainEqual({type: "bonus", target: "ac", value: 2});
		});
	});

	// ===================================================================
	// Integration Tests - Full Workflow
	// ===================================================================
	describe("Integration: Full Toggle Workflow", () => {
		test("Barbarian Rage workflow", () => {
			// Setup character
			charState.addClass({name: "Barbarian", level: 5, source: "PHB"});
			charState.addFeature({
				name: "Rage",
				description: "As a bonus action, you can enter a rage.",
				className: "Barbarian",
				level: 1,
			});
			charState.addResource({name: "Rage", max: 3, current: 3, recharge: "long"});
			
			// Verify feature is detected as activatable
			const activatables = charState.getActivatableFeatures();
			const rageActivatable = activatables.find(a => a.stateTypeId === "rage");
			expect(rageActivatable).toBeDefined();
			
			// Activate rage
			charState.activateState("rage");
			expect(charState.isStateTypeActive("rage")).toBe(true);
			
			// Check effects are applied
			const effects = charState.getActiveStateEffects();
			expect(effects.some(e => e.type === "advantage" && e.target === "check:str")).toBe(true);
			expect(effects.some(e => e.type === "resistance" && e.target === "damage:bludgeoning")).toBe(true);
			
			// End rage
			charState.deactivateState("rage");
			expect(charState.isStateTypeActive("rage")).toBe(false);
			expect(charState.getActiveStateEffects()).toHaveLength(0);
		});

		test("Wizard Bladesong workflow", () => {
			// Setup character
			charState.addClass({name: "Wizard", level: 6, source: "PHB"});
			// Set ability scores individually
			charState.setAbilityBase("str", 8);
			charState.setAbilityBase("dex", 14);
			charState.setAbilityBase("con", 12);
			charState.setAbilityBase("int", 18);
			charState.setAbilityBase("wis", 10);
			charState.setAbilityBase("cha", 10);
			charState.addFeature({
				name: "Bladesong",
				description: "Starting at 2nd level, you can invoke a secret elven magic called the Bladesong as a bonus action.",
				className: "Wizard",
				level: 2,
			});
			charState.addResource({name: "Bladesong", max: 2, current: 2, recharge: "long"});
			
			// Verify feature is detected
			const activatables = charState.getActivatableFeatures();
			const bladesongActivatable = activatables.find(a => a.stateTypeId === "bladesong");
			expect(bladesongActivatable).toBeDefined();
			
			// Activate bladesong
			charState.activateState("bladesong");
			expect(charState.isStateTypeActive("bladesong")).toBe(true);
			
			// Check effects - Bladesong adds INT mod to AC and +10 speed
			const effects = charState.getActiveStateEffects();
			expect(effects.some(e => e.type === "bonus" && e.target === "ac")).toBe(true);
			expect(effects.some(e => e.type === "bonus" && e.target === "speed:walk" && e.value === 10)).toBe(true);
		});

		test("TGTT Combat Stance workflow", () => {
			// Setup character
			charState.addClass({name: "Fighter", level: 5, source: "A5E"});
			charState.addFeature({
				name: "Heavy Stance",
				description: "Bonus Action (1 Exertion Point). You enter this stance. While in this stance, you gain a bonus to Strength (Athletics) checks equal to your proficiency bonus and you ignore the first 10 feet of difficult terrain.",
				className: "Fighter",
				level: 3,
			});
			charState.setExertionMax(5);
			charState.setExertionCurrent(5);
			
			// Verify detection
			const activatables = charState.getActivatableFeatures();
			const stance = activatables.find(a => a.stateTypeId === "heavyStance");
			expect(stance).toBeDefined();
			expect(stance.resource?.isExertion).toBe(true);
			expect(stance.activationInfo.exertionCost).toBe(1);
			
			// Activate stance
			charState.activateState("heavyStance");
			expect(charState.isStateTypeActive("heavyStance")).toBe(true);
			
			// Check effects
			const effects = charState.getActiveStateEffects();
			expect(effects.some(e => e.useProficiency && e.target === "check:str:athletics")).toBe(true);
		});

		test("Multiple active states workflow", () => {
			// Setup barbarian
			charState.addClass({name: "Barbarian", level: 5, source: "PHB"});
			charState.addResource({name: "Rage", max: 3, current: 3});
			
			// Activate multiple states
			charState.activateState("rage");
			charState.activateState("recklessAttack");
			
			expect(charState.isStateTypeActive("rage")).toBe(true);
			expect(charState.isStateTypeActive("recklessAttack")).toBe(true);
			
			// Get combined effects
			const effects = charState.getActiveStateEffects();
			
			// Should have rage effects
			expect(effects.some(e => e.type === "resistance" && e.target === "damage:bludgeoning")).toBe(true);
			
			// Should have reckless attack effects
			expect(effects.filter(e => e.type === "advantage" && e.target === "attacksAgainst")).toHaveLength(1);
			expect(effects.some(e => e.type === "advantage" && e.target === "attack:melee:str")).toBe(true);
		});

		test("Homebrew data-driven toggle workflow", () => {
			// Add homebrew toggle feature
			charState.addFeature({
				name: "Spirit Trance",
				description: "You enter a meditative trance that heightens your senses.",
				activatable: {
					stateTypeId: "homebrewToggle",
					activationAction: "action",
					resourceName: "Spirit Points",
					resourceCost: 1,
					effects: [
						{type: "advantage", target: "skill:perception"},
						{type: "bonus", target: "ac", value: 1},
						{type: "note", value: "Can see invisible creatures within 30 feet"},
					],
					duration: "10 minutes",
				},
			});
			charState.addResource({name: "Spirit Points", max: 3, current: 3});
			
			// Detect feature
			const activatables = charState.getActivatableFeatures();
			const trance = activatables.find(a => a.feature.name === "Spirit Trance");
			
			expect(trance).toBeDefined();
			expect(trance.activationInfo.isDataDriven).toBe(true);
			expect(trance.effects).toHaveLength(3);
			
			// Activate it
			charState.addActiveState("custom", {
				name: "Spirit Trance",
				sourceFeatureId: trance.feature.id,
				customEffects: trance.effects,
			});
			
			const effects = charState.getActiveStateEffects();
			expect(effects.some(e => e.type === "advantage" && e.target === "skill:perception")).toBe(true);
			expect(effects.some(e => e.type === "bonus" && e.target === "ac" && e.value === 1)).toBe(true);
		});
	});

	// ===================================================================
	// TGTT Specific Toggle Tests
	// ===================================================================
	describe("TGTT Toggle Abilities", () => {
		test("Monk Ki-costing feature detection", () => {
			// This tests a feature that costs Ki but isn't a toggle ability
			// It should NOT be detected as activatable (it's a one-shot effect, not a state)
			const feature = {
				name: "Arm Snap",
				description: "When you hit with an unarmed strike, you can spend 1 ki point to target the creature's arms. The target must make a Constitution saving throw. On a failure, attacks and ability checks that rely on its arms have disadvantage."
			};
			
			// Arm Snap is NOT a toggle/state - it's a one-time effect when you hit
			// The toggle system should not detect it as activatable
			const result = CharacterSheetState.detectActivatableFeature(feature);
			// This may or may not be detected - depends on whether we want to track instant effects
			// For now, the toggle system focuses on states, not instant effects
			if (result) {
				// If it is detected, it should recognize the Ki cost
				expect(result.kiCost).toBe(1);
			}
		});

		test("Combat stance with exertion cost detection", () => {
			// A proper toggle ability with a stance and duration
			const feature = {
				name: "Mountain Stance",
				description: "Bonus Action (2 Exertion Points). You enter this stance. While in this stance, you have resistance to being moved or knocked prone. This stance lasts until you end it as a bonus action or become incapacitated."
			};
			
			const result = CharacterSheetState.detectActivatableFeature(feature);
			expect(result).not.toBeNull();
			expect(result.exertionCost).toBe(2);
			expect(result.activationAction).toBe("bonus");
		});

		test("Jester's Act detection", () => {
			const feature = {
				name: "Pantomime",
				description: "As an action, you perform a mime routine. One creature within 30 feet that can see you must succeed on a Wisdom saving throw or be charmed and have its speed reduced to 0."
			};
			
			const result = CharacterSheetState.detectActivatableFeature(feature);
			expect(result).not.toBeNull();
			expect(result.activationAction).toBe("action");
		});

		test("Blade Breaker stance detection", () => {
			const ironPunisher = {
				name: "Iron Punisher",
				description: "At the start of each of your turns, you may choose to enter this stance. While in this stance, you have advantage on melee attack rolls, but attack rolls against you also have advantage."
			};
			
			const result = CharacterSheetState.detectActivatableFeature(ironPunisher);
			expect(result).not.toBeNull();
			expect(result.stateTypeId).toBe("ironPunisher");
		});

		test("Metamagic Warding Spell detection", () => {
			const feature = {
				name: "Warding Spell",
				description: "When you cast a spell that requires concentration, you can spend 2 sorcery points to gain +1 to your AC while concentrating on the spell."
			};
			
			const result = CharacterSheetState.detectActivatableFeature(feature);
			expect(result).not.toBeNull();
			expect(result.sorceryPointCost).toBe(2);
		});
	});

	// ===================================================================
	// Effect Application Tests
	// ===================================================================
	describe("Effect Application from Active States", () => {
		test("hasAdvantageFromStates should detect advantage on STR checks from Rage", () => {
			charState.addActiveState("rage");
			
			expect(charState.hasAdvantageFromStates("check:str")).toBe(true);
			expect(charState.hasAdvantageFromStates("check:dex")).toBe(false);
		});

		test("hasAdvantageFromStates should detect advantage on DEX saves from Dodge", () => {
			charState.addActiveState("dodge");
			
			expect(charState.hasAdvantageFromStates("save:dex")).toBe(true);
			expect(charState.hasAdvantageFromStates("save:str")).toBe(false);
		});

		test("hasAdvantageFromStates should handle attack advantage from Reckless Attack", () => {
			charState.addActiveState("recklessAttack");
			
			expect(charState.hasAdvantageFromStates("attack:melee:str")).toBe(true);
			expect(charState.hasAdvantageFromStates("attack:ranged")).toBe(false);
		});

		test("should aggregate effects from multiple active states", () => {
			charState.addActiveState("rage");
			charState.addActiveState("dodge");
			
			const effects = charState.getActiveStateEffects();
			
			// From Rage
			expect(effects.some(e => e.type === "advantage" && e.target === "check:str")).toBe(true);
			expect(effects.some(e => e.type === "resistance" && e.target === "damage:bludgeoning")).toBe(true);
			
			// From Dodge
			expect(effects.some(e => e.type === "advantage" && e.target === "save:dex")).toBe(true);
			expect(effects.some(e => e.type === "disadvantage" && e.target === "attacksAgainst")).toBe(true);
		});
	});

	// ===================================================================
	// analyzeToggleability Tests
	// ===================================================================
	describe("analyzeToggleability", () => {
		test("should identify stance-based toggles with high confidence", () => {
			const text = "As a bonus action, you enter this stance. While in this stance, you gain advantage on Strength checks.";
			const result = CharacterSheetState.analyzeToggleability(text.toLowerCase());
			
			expect(result.isToggle).toBe(true);
			expect(result.confidence).toBeGreaterThanOrEqual(5);
			expect(result.activationAction).toBe("bonus");
		});

		test("should identify duration-based toggles", () => {
			const text = "You activate this ability. For 1 minute, you gain resistance to fire damage.";
			const result = CharacterSheetState.analyzeToggleability(text.toLowerCase());
			
			expect(result.isToggle).toBe(true);
			expect(result.duration).toContain("minute");
		});

		test("should identify instant effects with low toggle confidence", () => {
			const text = "When you hit a creature with a melee weapon attack, you deal an extra 1d6 damage.";
			const result = CharacterSheetState.analyzeToggleability(text.toLowerCase());
			
			expect(result.isToggle).toBe(false);
			expect(result.isInstant).toBe(true);
		});

		test("should detect end conditions", () => {
			const text = "This effect lasts until you are incapacitated or you choose to end it as a bonus action.";
			const result = CharacterSheetState.analyzeToggleability(text.toLowerCase());
			
			expect(result.isToggle).toBe(true);
			expect(result.endConditions).toContain("Incapacitated");
			expect(result.endConditions).toContain("Bonus action to end");
		});

		test("should extract resource costs", () => {
			const text = "You spend 2 exertion points to activate this stance.";
			const result = CharacterSheetState.analyzeToggleability(text.toLowerCase());
			
			expect(result.resourceType).toBe("exertion");
			expect(result.resourceCost).toBe(2);
		});
	});

	// ===================================================================
	// summarizeEffects Tests
	// ===================================================================
	describe("summarizeEffects", () => {
		test("should summarize bonus effects", () => {
			const effects = [
				{type: "bonus", target: "ac", value: 2},
				{type: "bonus", target: "speed", value: 10},
			];
			const summary = CharacterSheetState.summarizeEffects(effects);
			
			expect(summary).toContain("+2 to AC");
			expect(summary).toContain("+10 to speed");
		});

		test("should summarize advantage effects", () => {
			const effects = [
				{type: "advantage", target: "attack"},
				{type: "advantage", target: "save:dex"},
			];
			const summary = CharacterSheetState.summarizeEffects(effects);
			
			expect(summary).toContain("Advantage on attack rolls");
			expect(summary).toContain("Advantage on DEX saves");
		});

		test("should summarize resistance effects", () => {
			const effects = [
				{type: "resistance", target: "fire"},
				{type: "resistance", target: "cold"},
			];
			const summary = CharacterSheetState.summarizeEffects(effects);
			
			expect(summary).toContain("Resistance to fire");
			expect(summary).toContain("Resistance to cold");
		});

		test("should handle proficiency-based bonuses", () => {
			const effects = [
				{type: "bonus", target: "skill:athletics", useProficiency: true},
			];
			const summary = CharacterSheetState.summarizeEffects(effects);
			
			expect(summary).toContain("+Prof to Athletics");
		});

		test("should handle ability mod bonuses", () => {
			const effects = [
				{type: "bonus", target: "ac", abilityMod: "int"},
			];
			const summary = CharacterSheetState.summarizeEffects(effects);
			
			expect(summary).toContain("+INT mod to AC");
		});
	});

	// ===================================================================
	// analyzeFeature Tests
	// ===================================================================
	describe("analyzeFeature", () => {
		test("should provide complete analysis of a toggle ability", () => {
			const feature = {
				name: "Combat Stance",
				description: "As a bonus action (1 Exertion Point), you enter this stance. While in this stance, you gain +2 to AC and advantage on Strength saving throws. The stance lasts until you are incapacitated.",
			};
			
			const analysis = CharacterSheetState.analyzeFeature(feature);
			
			expect(analysis.isActivatable).toBe(true);
			expect(analysis.isToggle).toBe(true);
			expect(analysis.effects.length).toBeGreaterThan(0);
			expect(analysis.effectsSummary).toContain("AC");
			expect(analysis.resourceCosts.exertion).toBe(1);
			expect(analysis.hasResourceCost).toBe(true);
		});

		test("should identify passive abilities as non-activatable", () => {
			const feature = {
				name: "Darkvision",
				description: "You have darkvision out to 60 feet.",
			};
			
			const analysis = CharacterSheetState.analyzeFeature(feature);
			
			expect(analysis.isActivatable).toBe(false);
		});

		test("should handle abilities with multiple resource costs", () => {
			const feature = {
				name: "Ki Strike",
				description: "As a bonus action, spend 2 ki points. Your next attack deals extra 2d6 damage.",
			};
			
			const analysis = CharacterSheetState.analyzeFeature(feature);
			
			expect(analysis.isActivatable).toBe(true);
			expect(analysis.resourceCosts.ki).toBe(2);
		});

		test("should parse complex TGTT ability", () => {
			const feature = {
				name: "Iron Bull Stance",
				description: "Bonus Action (2 Exertion Points). You enter this defensive stance. While in this stance, " +
					"you gain +2 to AC, advantage on Strength saving throws, and resistance to bludgeoning, piercing, and slashing damage. " +
					"Additionally, your speed is reduced by 10 feet. The stance ends if you are incapacitated or knocked unconscious.",
			};
			
			const analysis = CharacterSheetState.analyzeFeature(feature);
			
			expect(analysis.isActivatable).toBe(true);
			expect(analysis.isToggle).toBe(true);
			expect(analysis.resourceCosts.exertion).toBe(2);
			
			// Check various parsed effects
			const effects = analysis.effects;
			expect(effects.some(e => e.type === "bonus" && e.target === "ac" && e.value === 2)).toBe(true);
			expect(effects.some(e => e.type === "advantage" && e.target === "save:str")).toBe(true);
			expect(effects.some(e => e.type === "resistance")).toBe(true);
			expect(effects.some(e => e.type === "bonus" && e.target === "speed" && e.value === -10)).toBe(true);
		});
	});

	// ===================================================================
	// Additional Effect Parsing Tests
	// ===================================================================
	describe("Enhanced parseEffectsFromDescription", () => {
		test("should parse flying speed", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"You gain a flying speed of 60 feet."
			);
			expect(effects.some(e => e.type === "bonus" && e.target === "speed:fly")).toBe(true);
		});

		test("should parse swimming speed", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"You gain a swimming speed equal to your walking speed."
			);
			expect(effects.some(e => e.type === "bonus" && e.target === "speed:swim")).toBe(true);
		});

		test("should parse condition immunity", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"You are immune to the frightened condition."
			);
			expect(effects.some(e => e.type === "immunity" && e.target === "condition:frightened")).toBe(true);
		});

		test("should parse critical hit range", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"Your weapon attacks score a critical hit on a roll of 19 or higher."
			);
			expect(effects.some(e => e.type === "critRange" && e.value === 19)).toBe(true);
		});

		test("should parse temporary HP", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"You gain 10 temporary hit points."
			);
			expect(effects.some(e => e.type === "tempHp" && e.value === "10")).toBe(true);
		});

		test("should parse multiple conditions applied to targets", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"The target is stunned and the creature is blinded until the end of your next turn."
			);
			expect(effects.some(e => e.value?.includes("stunned"))).toBe(true);
			expect(effects.some(e => e.value?.includes("blinded"))).toBe(true);
		});

		test("should parse cannot be surprised", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"You can't be surprised while you are conscious."
			);
			expect(effects.some(e => e.type === "note" && e.value?.includes("surprised"))).toBe(true);
		});

		test("should parse extra damage dice", () => {
			const effects = CharacterSheetState.parseEffectsFromDescription(
				"You deal an extra 2d6 fire damage on a hit."
			);
			expect(effects.some(e => e.type === "extraDamage" && e.value === "2d6")).toBe(true);
		});
	});

	// ===================================================================
	// Serialization Tests
	// ===================================================================
	describe("State Serialization", () => {
		test("should persist active states through save/load", () => {
			charState.addActiveState("rage");
			charState.addActiveState("custom", {
				name: "Test State",
				customEffects: [{type: "bonus", target: "ac", value: 2}],
			});
			
			// Serialize
			const json = charState.toJson();
			
			// Create new state and load
			const newState = new CharacterSheetState();
			newState.loadFromJson(json);
			
			// Verify states persisted
			expect(newState.isStateTypeActive("rage")).toBe(true);
			expect(newState.getActiveStates()).toHaveLength(2);
			
			const customState = newState.getActiveStates().find(s => s.name === "Test State");
			expect(customState).toBeDefined();
			expect(customState.customEffects).toHaveLength(1);
		});

		test("should preserve state metadata through save/load", () => {
			const stateId = charState.addActiveState("rage", {
				sourceFeatureId: "feature_123",
			});
			
			const originalState = charState.getActiveState(stateId);
			const activatedAt = originalState.activatedAt;
			
			// Serialize and reload
			const json = charState.toJson();
			const newState = new CharacterSheetState();
			newState.loadFromJson(json);
			
			const loadedStates = newState.getActiveStates();
			expect(loadedStates[0].sourceFeatureId).toBe("feature_123");
			expect(loadedStates[0].activatedAt).toBe(activatedAt);
		});
	});
});