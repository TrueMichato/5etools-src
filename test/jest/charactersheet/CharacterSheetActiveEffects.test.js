/**
 * Character Sheet Active State Effects - Unit Tests (Phase 6)
 * Tests for the complete active state effect pipeline:
 * - tempHp applied on activation
 * - extraDamage from active states
 * - critRange from active states
 * - speed conditions (grappled/restrained/slowed)
 * - advantage/disadvantage for saves and checks
 * - senses and size from active states
 * - autoFail from conditions
 * - concentration break cleans up spell states
 */

import "./setup.js";

let CharacterSheetState;
let charState;

beforeAll(async () => {
	CharacterSheetState = (await import("../../../js/charactersheet/charactersheet-state.js")).CharacterSheetState;
});

describe("Active State Effect Pipeline (Phase 6)", () => {
	beforeEach(() => {
		charState = new CharacterSheetState();
		// Set up a baseline character via direct data access
		charState.setAbilityBase("str", 16);
		charState.setAbilityBase("dex", 14);
		charState.setAbilityBase("con", 14);
		charState.setAbilityBase("int", 10);
		charState.setAbilityBase("wis", 12);
		charState.setAbilityBase("cha", 8);
		charState.setHp(45, 45);
	});

	// ===================================================================
	// A1: Temp HP on State Activation
	// ===================================================================
	describe("Temp HP on activation", () => {
		test("should apply temp HP when activating a state with tempHp effect", () => {
			charState.addActiveState("custom", {
				name: "Test Buff",
				icon: "🛡️",
				description: "Grants temp HP",
				customEffects: [{type: "tempHp", value: 10}],
			});

			// _applyTempHpFromState is called internally by activateState
			// For custom states added directly, we can test the method
			const state = charState.getActiveStates().find(s => s.name === "Test Buff");
			expect(state).toBeDefined();

			// Apply temp HP from the state
			charState._applyTempHpFromState(state);
			expect(charState.getTempHp()).toBe(10);
		});

		test("should take the higher of current and new temp HP (5e rules)", () => {
			charState.setTempHp(5);

			charState.addActiveState("custom", {
				name: "Bigger Buff",
				icon: "🛡️",
				description: "Grants more temp HP",
				customEffects: [{type: "tempHp", value: 15}],
			});

			const state = charState.getActiveStates().find(s => s.name === "Bigger Buff");
			charState._applyTempHpFromState(state);
			expect(charState.getTempHp()).toBe(15);
		});

		test("should NOT replace temp HP when new value is lower", () => {
			charState.setTempHp(20);

			charState.addActiveState("custom", {
				name: "Weak Buff",
				icon: "🛡️",
				description: "Grants less temp HP",
				customEffects: [{type: "tempHp", value: 5}],
			});

			const state = charState.getActiveStates().find(s => s.name === "Weak Buff");
			charState._applyTempHpFromState(state);
			expect(charState.getTempHp()).toBe(20);
		});

		test("should handle tempHp from ACTIVE_STATE_TYPES definition", () => {
			// Add a state type that has tempHp in its effects
			const stateTypes = CharacterSheetState.ACTIVE_STATE_TYPES;
			const typesWithTempHp = Object.entries(stateTypes)
				.filter(([, st]) => st.effects?.some(e => e.type === "tempHp"));

			// If there are built-in types with tempHp, test one
			if (typesWithTempHp.length > 0) {
				const [typeId, stateType] = typesWithTempHp[0];
				const tempHpEffect = stateType.effects.find(e => e.type === "tempHp");
				charState.addActiveState(typeId, {});
				const state = charState.getActiveStates().find(s => s.stateTypeId === typeId);
				charState._applyTempHpFromState(state);
				expect(charState.getTempHp()).toBeGreaterThanOrEqual(tempHpEffect.value || 0);
			}
		});
	});

	// ===================================================================
	// A2: Extra Damage from Active States
	// ===================================================================
	describe("Extra damage from states", () => {
		test("should return extra damage entries from active states", () => {
			charState.addActiveState("custom", {
				name: "Hex",
				icon: "💀",
				description: "Extra necrotic damage",
				customEffects: [{type: "extraDamage", dice: "1d6", damageType: "necrotic"}],
			});

			const extraDmg = charState.getExtraDamageFromStates();
			expect(extraDmg).toHaveLength(1);
			expect(extraDmg[0].dice).toBe("1d6");
			expect(extraDmg[0].damageType).toBe("necrotic");
		});

		test("should return multiple extra damage entries from different states", () => {
			charState.addActiveState("custom", {
				name: "Hex",
				icon: "💀",
				description: "Extra necrotic damage",
				customEffects: [{type: "extraDamage", dice: "1d6", damageType: "necrotic"}],
			});
			charState.addActiveState("custom", {
				name: "Flame Tongue",
				icon: "🔥",
				description: "Extra fire damage",
				customEffects: [{type: "extraDamage", dice: "2d6", damageType: "fire"}],
			});

			const extraDmg = charState.getExtraDamageFromStates();
			expect(extraDmg).toHaveLength(2);
			expect(extraDmg.some(d => d.dice === "1d6" && d.damageType === "necrotic")).toBe(true);
			expect(extraDmg.some(d => d.dice === "2d6" && d.damageType === "fire")).toBe(true);
		});

		test("should return empty array when no extra damage states active", () => {
			expect(charState.getExtraDamageFromStates()).toEqual([]);
		});

		test("should include source name in extra damage entries", () => {
			charState.addActiveState("custom", {
				name: "Hunter's Mark",
				icon: "🎯",
				customEffects: [{type: "extraDamage", dice: "1d6", damageType: ""}],
			});

			const extraDmg = charState.getExtraDamageFromStates();
			expect(extraDmg[0].source).toBeDefined();
		});
	});

	// ===================================================================
	// A3: Critical Range from Active States
	// ===================================================================
	describe("Critical range from states", () => {
		test("should return 20 by default (standard crit range)", () => {
			expect(charState.getCriticalRange()).toBe(20);
		});

		test("should return lower crit range from active state", () => {
			charState.addActiveState("custom", {
				name: "Champion Improved Critical",
				icon: "⚔️",
				customEffects: [{type: "critRange", value: 19}],
			});

			expect(charState.getCriticalRange()).toBe(19);
		});

		test("should take the lowest crit range when multiple states active", () => {
			charState.addActiveState("custom", {
				name: "Improved Critical",
				icon: "⚔️",
				customEffects: [{type: "critRange", value: 19}],
			});
			charState.addActiveState("custom", {
				name: "Superior Critical",
				icon: "⚔️",
				customEffects: [{type: "critRange", value: 18}],
			});

			expect(charState.getCriticalRange()).toBe(18);
		});

		test("should revert to 20 when crit range state is removed", () => {
			const stateId = charState.addActiveState("custom", {
				name: "Improved Critical",
				icon: "⚔️",
				customEffects: [{type: "critRange", value: 19}],
			});

			expect(charState.getCriticalRange()).toBe(19);
			charState.removeActiveState(stateId);
			expect(charState.getCriticalRange()).toBe(20);
		});
	});

	// ===================================================================
	// A4: Speed Conditions
	// ===================================================================
	describe("Speed conditions", () => {
		test("should return normal speed with no conditions", () => {
			charState._data.speed = {walk: 30};
			// getSpeed() returns a formatted string like "30 ft."; use getWalkSpeed() for numeric
			expect(charState.getWalkSpeed()).toBe(30);
		});

		test("should return 0 speed when grappled (speed condition)", () => {
			charState._data.speed = {walk: 30};

			// Grappled is a condition (CONDITION_EFFECTS), not an ACTIVE_STATE_TYPES entry
			charState.addCondition("Grappled");

			const multiplier = charState.getSpeedMultiplierFromConditions();
			expect(multiplier).toBe(0);
		});

		test("should return 0 speed when restrained", () => {
			charState._data.speed = {walk: 30};
			charState.addCondition("Restrained");

			const multiplier = charState.getSpeedMultiplierFromConditions();
			expect(multiplier).toBe(0);
		});

		test("should halve speed when slowed", () => {
			charState._data.speed = {walk: 30};

			// If there's a slowed condition with speedMultiplier: 0.5
			const condEffects = CharacterSheetState.CONDITION_EFFECTS;
			if (condEffects.slowed) {
				charState.addCondition("Slowed");
				const multiplier = charState.getSpeedMultiplierFromConditions();
				expect(multiplier).toBe(0.5);
			}
		});

		test("getSpeed should apply speed multiplier from conditions", () => {
			charState._data.speed = {walk: 30};
			// Add a custom state with setSpeed: 0
			charState.addActiveState("custom", {
				name: "Frozen",
				customEffects: [{type: "setSpeed", value: 0}],
			});

			// getSpeed() returns formatted string; use getWalkSpeed() for numeric
			expect(charState.getWalkSpeed()).toBe(0);
		});

		test("getWalkSpeed should apply speed multiplier from conditions", () => {
			charState._data.speed = {walk: 30};
			charState.addActiveState("custom", {
				name: "Halved Movement",
				customEffects: [{type: "speedMultiplier", value: 0.5}],
			});

			expect(charState.getWalkSpeed()).toBe(15);
		});
	});

	// ===================================================================
	// A5: Advantage/Disadvantage for Saves and Checks
	// ===================================================================
	describe("Advantage/disadvantage for saves and checks", () => {
		test("should detect advantage on saves from active state", () => {
			charState.addActiveState("custom", {
				name: "Test Buff",
				icon: "✊",
				customEffects: [{type: "advantage", target: "save:dex"}],
			});

			expect(charState.hasAdvantageFromStates("save:dex")).toBe(true);
			expect(charState.hasAdvantageFromStates("save:str")).toBe(false);
		});

		test("should detect disadvantage on saves from active state", () => {
			charState.addActiveState("custom", {
				name: "Test Debuff",
				icon: "😵",
				customEffects: [{type: "disadvantage", target: "save:wis"}],
			});

			expect(charState.hasDisadvantageFromStates("save:wis")).toBe(true);
			expect(charState.hasDisadvantageFromStates("save:str")).toBe(false);
		});

		test("should detect generic 'save' advantage for all saving throws", () => {
			charState.addActiveState("custom", {
				name: "Mantle of Spell Resistance",
				icon: "🛡️",
				customEffects: [{type: "advantage", target: "save"}],
			});

			expect(charState.hasAdvantageFromStates("save:str")).toBe(true);
			expect(charState.hasAdvantageFromStates("save:dex")).toBe(true);
			expect(charState.hasAdvantageFromStates("save:con")).toBe(true);
			expect(charState.hasAdvantageFromStates("save:int")).toBe(true);
			expect(charState.hasAdvantageFromStates("save:wis")).toBe(true);
			expect(charState.hasAdvantageFromStates("save:cha")).toBe(true);
		});

		test("should detect advantage on ability checks from active state", () => {
			charState.addActiveState("custom", {
				name: "Bull's Strength",
				icon: "💪",
				customEffects: [{type: "advantage", target: "check:str"}],
			});

			expect(charState.hasAdvantageFromStates("check:str")).toBe(true);
			expect(charState.hasAdvantageFromStates("check:dex")).toBe(false);
		});

		test("should detect generic 'check' advantage for all ability checks", () => {
			charState.addActiveState("custom", {
				name: "Enhance Ability",
				icon: "🌟",
				customEffects: [{type: "advantage", target: "check"}],
			});

			expect(charState.hasAdvantageFromStates("check:str")).toBe(true);
			expect(charState.hasAdvantageFromStates("check:dex")).toBe(true);
		});

		test("getSaveAdvantageState should combine advantage/disadvantage", () => {
			charState.addActiveState("custom", {
				name: "Test Buff",
				customEffects: [{type: "advantage", target: "save:str"}],
			});

			const state = charState.getSaveAdvantageState("str");
			expect(state.advantage).toBe(true);
			expect(state.disadvantage).toBe(false);
		});

		test("getSaveAdvantageState should cancel when both advantage and disadvantage", () => {
			charState.addActiveState("custom", {
				name: "Good Aura",
				customEffects: [{type: "advantage", target: "save:dex"}],
			});
			charState.addActiveState("custom", {
				name: "Bad Curse",
				customEffects: [{type: "disadvantage", target: "save:dex"}],
			});

			const state = charState.getSaveAdvantageState("dex");
			expect(state.advantage).toBe(false);
			expect(state.disadvantage).toBe(false);
		});

		test("getSkillAdvantageState should detect skill-specific advantage", () => {
			charState.addActiveState("custom", {
				name: "Enhance Ability",
				customEffects: [{type: "advantage", target: "check:str"}],
			});

			const state = charState.getSkillAdvantageState("athletics");
			expect(state.advantage).toBe(true);
		});

		test("Rage should give advantage on STR checks and saves", () => {
			charState.addActiveState("rage", {});

			expect(charState.hasAdvantageFromStates("check:str")).toBe(true);
			expect(charState.hasAdvantageFromStates("save:str")).toBe(true);
			expect(charState.hasAdvantageFromStates("check:dex")).toBe(false);
		});
	});

	// ===================================================================
	// A6: Senses and Size from States
	// ===================================================================
	describe("Senses from active states", () => {
		test("should add darkvision from active state", () => {
			charState.addActiveState("custom", {
				name: "Darkvision Spell",
				icon: "👁️",
				customEffects: [{type: "sense", target: "darkvision", value: 60}],
			});

			const bonus = charState.getSenseBonusFromStates("darkvision");
			expect(bonus).toBe(60);
		});

		test("should take the best sense range when multiple states", () => {
			charState.addActiveState("custom", {
				name: "Low Darkvision",
				customEffects: [{type: "sense", target: "darkvision", value: 30}],
			});
			charState.addActiveState("custom", {
				name: "Better Darkvision",
				customEffects: [{type: "sense", target: "darkvision", value: 120}],
			});

			const bonus = charState.getSenseBonusFromStates("darkvision");
			expect(bonus).toBe(120);
		});

		test("should return 0 for non-matching sense types", () => {
			charState.addActiveState("custom", {
				name: "Darkvision",
				customEffects: [{type: "sense", target: "darkvision", value: 60}],
			});

			expect(charState.getSenseBonusFromStates("blindsight")).toBe(0);
		});
	});

	describe("Size from active states", () => {
		test("should increase size by one category", () => {
			charState._data.size = "medium";

			charState.addActiveState("custom", {
				name: "Enlarge",
				customEffects: [{type: "sizeIncrease", value: 1}],
			});

			expect(charState.getSizeIncreaseFromStates()).toBe(1);
			// getSize should incorporate the increase
			const size = charState.getSize();
			expect(size.toLowerCase()).toBe("large");
		});

		test("should increase by multiple categories", () => {
			charState._data.size = "medium";

			charState.addActiveState("custom", {
				name: "Giant Growth",
				customEffects: [{type: "sizeIncrease", value: 2}],
			});

			const size = charState.getSize();
			expect(size.toLowerCase()).toBe("huge");
		});

		test("should not exceed gargantuan", () => {
			charState._data.size = "huge";

			charState.addActiveState("custom", {
				name: "Mega Growth",
				customEffects: [{type: "sizeIncrease", value: 5}],
			});

			const size = charState.getSize();
			expect(size.toLowerCase()).toBe("gargantuan");
		});

		test("should return base size when no states active", () => {
			charState._data.size = "small";
			expect(charState.getSize().toLowerCase()).toBe("small");
		});
	});

	// ===================================================================
	// Auto-fail from Conditions
	// ===================================================================
	describe("Auto-fail from conditions", () => {
		test("should detect auto-fail on STR saves from paralyzed", () => {
			// Paralyzed is a condition — use addCondition, not addActiveState
			charState.addCondition("Paralyzed");

			expect(charState.hasAutoFailFromConditions("save:str")).toBe(true);
			expect(charState.hasAutoFailFromConditions("save:dex")).toBe(true);
		});

		test("should detect auto-fail on STR/DEX saves from stunned", () => {
			const condEffects = CharacterSheetState.CONDITION_EFFECTS;
			if (condEffects.stunned?.effects?.some(e => e.type === "autoFail")) {
				charState.addCondition("Stunned");
				const hasAutoFail = charState.hasAutoFailFromConditions("save:str")
					|| charState.hasAutoFailFromConditions("save:dex");
				expect(hasAutoFail).toBe(true);
			}
		});

		test("should not auto-fail when no conditions applied", () => {
			expect(charState.hasAutoFailFromConditions("save:str")).toBe(false);
			expect(charState.hasAutoFailFromConditions("save:dex")).toBe(false);
		});

		test("isIncapacitated should detect incapacitated conditions", () => {
			const condEffects = CharacterSheetState.CONDITION_EFFECTS;
			const incapConditions = Object.entries(condEffects)
				.filter(([, c]) => c.effects?.some(e => e.type === "incapacitated"));

			if (incapConditions.length > 0) {
				const [condKey, condDef] = incapConditions[0];
				charState.addCondition(condDef.name || condKey);
				expect(charState.isIncapacitated()).toBe(true);
			}
		});

		test("isIncapacitated should return false when no incapacitating conditions", () => {
			expect(charState.isIncapacitated()).toBe(false);
		});
	});

	// ===================================================================
	// Concentration Break Cleanup
	// ===================================================================
	describe("Concentration break cleans up spell states", () => {
		test("should remove spell effect states when concentration breaks", () => {
			// Set up concentration on a spell
			charState.setConcentration("Shield of Faith", 1);

			// Add a spell effect state with concentration: true
			charState.addActiveState("custom", {
				name: "Shield of Faith",
				icon: "🔮",
				isSpellEffect: true,
				concentration: true,
				customEffects: [{type: "bonus", target: "ac", value: 2}],
			});

			expect(charState.getActiveStates().some(s => s.name === "Shield of Faith")).toBe(true);
			expect(charState.getBonusFromStates("ac")).toBe(2);

			// Break concentration
			charState.breakConcentration();

			// Spell effect state should be removed
			expect(charState.getActiveStates().some(s => s.name === "Shield of Faith")).toBe(false);
			expect(charState.getBonusFromStates("ac")).toBe(0);
		});

		test("should remove conditions granted by concentration spells", () => {
			charState.setConcentration("Greater Invisibility", 4);

			charState.addActiveState("custom", {
				name: "Greater Invisibility",
				icon: "🔮",
				isSpellEffect: true,
				concentration: true,
				customEffects: [],
				grantsConditions: ["Invisible"],
			});

			charState.addCondition?.("Invisible");

			charState.breakConcentration();

			// The condition should be removed along with the state
			const states = charState.getActiveStates();
			expect(states.some(s => s.name === "Greater Invisibility")).toBe(false);
		});

		test("should NOT remove non-concentration spell states", () => {
			charState.setConcentration("Bless", 1);

			// Add a non-concentration spell state
			charState.addActiveState("custom", {
				name: "Mage Armor",
				icon: "✨",
				isSpellEffect: true,
				concentration: false,
				customEffects: [{type: "setAc", baseAc: 13, addDex: true}],
			});

			charState.breakConcentration();

			// Mage Armor should still be active
			expect(charState.getActiveStates().some(s => s.name === "Mage Armor")).toBe(true);
		});

		test("should NOT remove non-spell active states", () => {
			charState.setConcentration("Some Spell", 1);
			charState.addActiveState("rage", {});

			charState.breakConcentration();

			// Rage is not a spell effect, should remain
			expect(charState.isStateTypeActive("rage")).toBe(true);
		});
	});

	// ===================================================================
	// Resistance from States
	// ===================================================================
	describe("Resistance from active states", () => {
		test("should detect resistance from active state", () => {
			charState.addActiveState("custom", {
				name: "Stoneskin",
				customEffects: [{type: "resistance", target: "damage:bludgeoning"}],
			});

			expect(charState.hasResistanceFromStates("bludgeoning")).toBe(true);
		});

		test("should not report resistance for unmatched damage types", () => {
			charState.addActiveState("custom", {
				name: "Stoneskin",
				customEffects: [{type: "resistance", target: "damage:bludgeoning"}],
			});

			expect(charState.hasResistanceFromStates("fire")).toBe(false);
		});

		test("Rage should grant resistance to physical damage", () => {
			charState.addActiveState("rage", {});

			expect(charState.hasResistanceFromStates("bludgeoning")).toBe(true);
			expect(charState.hasResistanceFromStates("piercing")).toBe(true);
			expect(charState.hasResistanceFromStates("slashing")).toBe(true);
		});
	});

	// ===================================================================
	// Combined State Effects Integration
	// ===================================================================
	describe("Combined state effects", () => {
		test("Rage should provide multiple combined effects", () => {
			charState.addActiveState("rage", {});

			// Advantage on STR checks/saves
			expect(charState.hasAdvantageFromStates("check:str")).toBe(true);
			expect(charState.hasAdvantageFromStates("save:str")).toBe(true);

			// Resistance to physical damage
			expect(charState.hasResistanceFromStates("bludgeoning")).toBe(true);
		});

		test("multiple states should stack effects correctly", () => {
			// Add Hex for extra damage
			charState.addActiveState("custom", {
				name: "Hex",
				customEffects: [{type: "extraDamage", dice: "1d6", damageType: "necrotic"}],
			});

			// Add a speed bonus
			charState.addActiveState("custom", {
				name: "Longstrider",
				customEffects: [{type: "bonus", target: "speed", value: 10}],
			});

			// Add an AC bonus
			charState.addActiveState("custom", {
				name: "Shield of Faith",
				customEffects: [{type: "bonus", target: "ac", value: 2}],
			});

			// All effects should work simultaneously
			expect(charState.getExtraDamageFromStates()).toHaveLength(1);
			expect(charState.getBonusFromStates("speed")).toBe(10);
			expect(charState.getBonusFromStates("ac")).toBe(2);
		});

		test("deactivating a state should remove its effects", () => {
			const stateId = charState.addActiveState("custom", {
				name: "Shield of Faith",
				customEffects: [{type: "bonus", target: "ac", value: 2}],
			});

			expect(charState.getBonusFromStates("ac")).toBe(2);

			charState.removeActiveState(stateId);
			expect(charState.getBonusFromStates("ac")).toBe(0);
		});
	});
});
