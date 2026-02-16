
import "./setup.js";

let CharacterSheetState;
let state;

beforeAll(async () => {
	CharacterSheetState = (await import("../../../js/charactersheet/charactersheet-state.js")).CharacterSheetState;
});

describe("Bug Fixes", () => {
	beforeEach(() => {
		state = new CharacterSheetState();
		state.setAbilityBase("str", 14);
		state.setAbilityBase("dex", 14);
		state.setAbilityBase("con", 14);
		state.setAbilityBase("int", 16);
		state.setAbilityBase("wis", 14);
		state.setAbilityBase("cha", 10);
		state.addClass({name: "Wizard", source: "PHB", level: 5});
	});

	// ===================================================================
	// BLADE WARD SPELL BUFF REGISTRY
	// ===================================================================
	describe("Blade Ward Registry", () => {
		it("should be in the spell buff registry", () => {
			const entry = CharacterSheetState.getSpellFromRegistry("Blade Ward");
			expect(entry).not.toBeNull();
			expect(entry.selfEffects).toBeDefined();
		});

		it("should grant B/P/S resistance", () => {
			const entry = CharacterSheetState.getSpellFromRegistry("blade ward");
			const resistances = entry.selfEffects.filter(e => e.type === "resistance");
			expect(resistances).toHaveLength(3);

			const targets = resistances.map(r => r.target).sort();
			expect(targets).toEqual([
				"damage:bludgeoning",
				"damage:piercing",
				"damage:slashing",
			]);
		});

		it("should have 1 round duration", () => {
			const entry = CharacterSheetState.getSpellFromRegistry("Blade Ward");
			expect(entry.duration).toEqual({amount: 1, unit: "round"});
		});

		it("should apply B/P/S resistance when activated as state", () => {
			state.activateState("custom", {
				name: "Blade Ward",
				customEffects: CharacterSheetState.getSpellFromRegistry("blade ward").selfEffects,
				isSpellEffect: true,
			});

			// hasResistanceFromStates takes the damage type without the "damage:" prefix
			expect(state.hasResistanceFromStates("bludgeoning")).toBe(true);
			expect(state.hasResistanceFromStates("piercing")).toBe(true);
			expect(state.hasResistanceFromStates("slashing")).toBe(true);
			expect(state.hasResistanceFromStates("fire")).toBe(false);
		});

		it("should appear in getResistances() when active", () => {
			state.activateState("custom", {
				name: "Blade Ward",
				customEffects: CharacterSheetState.getSpellFromRegistry("blade ward").selfEffects,
				isSpellEffect: true,
			});

			const resistances = state.getResistances();
			expect(resistances).toContain("bludgeoning");
			expect(resistances).toContain("piercing");
			expect(resistances).toContain("slashing");
		});

		it("should parse blade ward spell effects with registry match", () => {
			const spellData = {
				name: "Blade Ward",
				source: "XPHB",
				level: 0,
				school: "A",
				duration: [{type: "timed", concentration: true, duration: {amount: 1, type: "round"}}],
				entries: ["Spectral blades ward you. Until the end of your next turn, you have resistance against bludgeoning, piercing, and slashing damage."],
			};

			const effects = CharacterSheetState.parseSpellEffects(spellData);
			expect(effects.registryMatch).toBe(true);
			expect(effects.registryEffects).toHaveLength(3);
			expect(effects.registryEffects[0].type).toBe("resistance");
		});
	});

	// ===================================================================
	// AUTO-BLOODIED CONDITION
	// ===================================================================
	describe("Auto-Bloodied Condition", () => {
		beforeEach(() => {
			// setHp(current, max) — first param is current, second is max
			state.setHp(40, 40);
		});

		it("should NOT be bloodied at full HP", () => {
			expect(state.isBloodied()).toBe(false);
			expect(state.hasCondition("bloodied")).toBe(false);
		});

		it("should NOT be bloodied above 50% HP", () => {
			state.setHp(21, 40);
			expect(state.isBloodied()).toBe(false);
			expect(state.hasCondition("bloodied")).toBe(false);
		});

		it("should be bloodied at exactly 50% HP", () => {
			state.setHp(20, 40);
			expect(state.isBloodied()).toBe(true);
			expect(state.hasCondition("bloodied")).toBe(true);
		});

		it("should be bloodied below 50% HP", () => {
			state.setHp(10, 40);
			expect(state.isBloodied()).toBe(true);
			expect(state.hasCondition("bloodied")).toBe(true);
		});

		it("should NOT be bloodied at 0 HP (unconscious, not bloodied)", () => {
			state.setHp(0, 40);
			expect(state.isBloodied()).toBe(false);
			expect(state.hasCondition("bloodied")).toBe(false);
		});

		it("should auto-add bloodied when taking damage below 50%", () => {
			state.setHp(30, 40);
			expect(state.hasCondition("bloodied")).toBe(false);

			state.takeDamage(15); // 30 -> 15
			expect(state.getHp().current).toBe(15);
			expect(state.hasCondition("bloodied")).toBe(true);
		});

		it("should auto-remove bloodied when healed above 50%", () => {
			state.setHp(15, 40);
			expect(state.hasCondition("bloodied")).toBe(true);

			state.heal(10); // 15 -> 25
			expect(state.getHp().current).toBe(25);
			expect(state.hasCondition("bloodied")).toBe(false);
		});

		it("should track bloodied through combat damage sequence", () => {
			state.setHp(40, 40);
			expect(state.hasCondition("bloodied")).toBe(false);

			state.takeDamage(5); // 40 -> 35
			expect(state.hasCondition("bloodied")).toBe(false);

			state.takeDamage(20); // 35 -> 15
			expect(state.hasCondition("bloodied")).toBe(true);

			state.heal(5); // 15 -> 20 (exactly 50% = still bloodied)
			expect(state.hasCondition("bloodied")).toBe(true);

			state.heal(1); // 20 -> 21 (above 50% = no longer bloodied)
			expect(state.hasCondition("bloodied")).toBe(false);
		});

		it("should handle odd max HP correctly (floor for 50%)", () => {
			state.setHp(39, 39); // 50% of 39 = 19.5, floored to 19
			expect(state.isBloodied()).toBe(false);

			state.setHp(19, 39);
			expect(state.isBloodied()).toBe(true); // 19 <= floor(39/2) = 19

			state.setHp(20, 39);
			expect(state.isBloodied()).toBe(false); // 20 > 19
		});

		it("should not crash if HP max is 0", () => {
			state.setHp(0, 0);
			expect(state.isBloodied()).toBe(false);
		});
	});

	// ===================================================================
	// SCHOLAR EXPERTISE (XPHB Wizard Level 2)
	// ===================================================================
	describe("Scholar Expertise", () => {
		let wizardState;

		beforeEach(() => {
			wizardState = new CharacterSheetState();
			wizardState.setAbilityBase("str", 8);
			wizardState.setAbilityBase("dex", 14);
			wizardState.setAbilityBase("con", 14);
			wizardState.setAbilityBase("int", 16);
			wizardState.setAbilityBase("wis", 12);
			wizardState.setAbilityBase("cha", 10);
		});

		it("should expose Scholar feature at XPHB Wizard level 2", () => {
			wizardState.addClass({name: "Wizard", source: "XPHB", level: 2});
			const calcs = wizardState.getFeatureCalculations();
			expect(calcs.hasScholar).toBe(true);
		});

		it("should not expose Scholar for PHB Wizard", () => {
			wizardState.addClass({name: "Wizard", source: "PHB", level: 2});
			const calcs = wizardState.getFeatureCalculations();
			expect(calcs.hasScholar).toBeFalsy();
		});

		it("should not expose Scholar at level 1", () => {
			wizardState.addClass({name: "Wizard", source: "XPHB", level: 1});
			const calcs = wizardState.getFeatureCalculations();
			expect(calcs.hasScholar).toBeFalsy();
		});

		it("should offer correct skill options", () => {
			wizardState.addClass({name: "Wizard", source: "XPHB", level: 2});
			const calcs = wizardState.getFeatureCalculations();
			expect(calcs.scholarSkillOptions).toEqual([
				"arcana", "history", "investigation", "medicine", "nature", "religion",
			]);
		});

		it("should allow setting expertise in any of the Scholar skills", () => {
			wizardState.addClass({name: "Wizard", source: "XPHB", level: 5});
			wizardState.setSkillProficiency("arcana", 1); // Must be proficient first

			// Apply scholar expertise choice
			wizardState.addExpertise("arcana");
			expect(wizardState.getSkillProficiency("arcana")).toBe(2);
		});

		it("should allow expertise in history (not just arcana)", () => {
			wizardState.addClass({name: "Wizard", source: "XPHB", level: 5});
			wizardState.setSkillProficiency("history", 1);

			wizardState.addExpertise("history");
			expect(wizardState.getSkillProficiency("history")).toBe(2);
		});

		it("should double proficiency bonus for expertise skill", () => {
			wizardState.addClass({name: "Wizard", source: "XPHB", level: 5});
			wizardState.setSkillProficiency("arcana", 1);
			wizardState.addExpertise("arcana");

			const profBonus = wizardState.getProficiencyBonus(); // +3 at level 5
			const intMod = wizardState.getAbilityMod("int"); // +3
			// Expertise = 2x proficiency bonus
			const expectedMod = intMod + (profBonus * 2); // 3 + 6 = 9
			expect(wizardState.getSkillMod("arcana")).toBe(expectedMod);
		});
	});

	// ===================================================================
	// FALSE LIFE TEMP HP
	// ===================================================================
	describe("False Life Temp HP", () => {
		it("should be in the spell buff registry", () => {
			const entry = CharacterSheetState.getSpellFromRegistry("False Life");
			expect(entry).not.toBeNull();
			expect(entry.selfEffects).toBeDefined();
		});

		it("should have tempHp effect in registry", () => {
			const entry = CharacterSheetState.getSpellFromRegistry("false life");
			const tempHpEffect = entry.selfEffects.find(e => e.type === "tempHp");
			expect(tempHpEffect).toBeDefined();
			expect(tempHpEffect.value).toBe(8); // 1d4+4 average
		});

		it("should have upcast scaling", () => {
			const entry = CharacterSheetState.getSpellFromRegistry("false life");
			expect(entry.upcastPerLevel).toBeDefined();
			expect(entry.upcastPerLevel.tempHp).toBe(5);
		});

		it("should apply temp HP when activated via activateState", () => {
			state.setHp(40, 40);
			expect(state.getTempHp()).toBe(0);

			const entry = CharacterSheetState.getSpellFromRegistry("false life");
			state.activateState("custom", {
				name: "False Life",
				customEffects: entry.selfEffects,
				isSpellEffect: true,
				duration: entry.duration,
			});

			expect(state.getTempHp()).toBe(8);
		});

		it("should take the higher temp HP value (no stacking)", () => {
			state.setHp(40, 40);
			state.setTempHp(5); // Already have 5 temp HP

			const entry = CharacterSheetState.getSpellFromRegistry("false life");
			state.activateState("custom", {
				name: "False Life",
				customEffects: entry.selfEffects,
				isSpellEffect: true,
			});

			expect(state.getTempHp()).toBe(8); // 8 > 5, so it replaces
		});

		it("should NOT replace higher existing temp HP", () => {
			state.setHp(40, 40);
			state.setTempHp(15); // Already have 15 temp HP

			const entry = CharacterSheetState.getSpellFromRegistry("false life");
			state.activateState("custom", {
				name: "False Life",
				customEffects: entry.selfEffects,
				isSpellEffect: true,
			});

			expect(state.getTempHp()).toBe(15); // 15 > 8, keeps existing
		});

		it("should create active state for duration tracking", () => {
			const entry = CharacterSheetState.getSpellFromRegistry("false life");
			state.activateState("custom", {
				name: "False Life",
				customEffects: entry.selfEffects,
				isSpellEffect: true,
				duration: entry.duration,
			});

			const activeStates = state.getActiveStates();
			const falseLife = activeStates.find(s => s.name === "False Life");
			expect(falseLife).toBeDefined();
			expect(falseLife.active).toBe(true);
			expect(falseLife.isSpellEffect).toBe(true);
		});
	});

	// ===================================================================
	// _parseTempHp REGEX FIX
	// ===================================================================
	describe("_parseTempHp Regex", () => {
		it("should parse simple 'N temporary hit points'", () => {
			const spell = {
				entries: ["You gain 5 temporary hit points."],
			};
			const result = CharacterSheetState._parseTempHp(spell);
			expect(result).not.toBeNull();
			expect(result.amount).toBe(5);
		});

		it("should parse dice notation followed by temporary hit points", () => {
			// This is how False Life typically appears: {@dice 1d4+4} temporary hit points
			const spell = {
				entries: ["You gain {@dice 1d4+4} temporary hit points for the duration."],
			};
			const result = CharacterSheetState._parseTempHp(spell);
			expect(result).not.toBeNull();
			expect(result.amount).toBe(4); // captures the last digit before non-alpha
		});

		it("should parse Armor of Agathys pattern", () => {
			const spell = {
				entries: ["You gain 5 temporary hit points and deal 5 cold damage."],
			};
			const result = CharacterSheetState._parseTempHp(spell);
			expect(result).not.toBeNull();
			expect(result.amount).toBe(5);
		});

		it("should return null for spells without temp HP", () => {
			const spell = {
				entries: ["You deal {@damage 3d6} fire damage."],
			};
			const result = CharacterSheetState._parseTempHp(spell);
			expect(result).toBeNull();
		});

		it("should handle 'temporary hit point' singular", () => {
			const spell = {
				entries: ["You gain 1 temporary hit point."],
			};
			const result = CharacterSheetState._parseTempHp(spell);
			expect(result).not.toBeNull();
			expect(result.amount).toBe(1);
		});
	});

	// ===================================================================
	// SPELL BUFF REGISTRY COMPLETENESS
	// ===================================================================
	describe("Spell Buff Registry", () => {
		// Only actual spells in SPELL_BUFF_REGISTRY (not active state types like rage/bladesong)
		const expectedSpells = [
			"shield", "shield of faith", "mage armor", "bless", "bane",
			"hex", "hunter's mark", "haste", "blur",
			"mirror image", "barkskin", "stoneskin", "fire shield",
			"protection from evil and good",
			"heroism", "divine favor",
			"holy weapon", "guidance", "resistance",
			"pass without trace", "armor of agathys", "false life",
			"warding bond", "beacon of hope", "magic weapon",
			"elemental weapon", "crusader's mantle", "death ward",
			"gift of alacrity", "foresight", "sanctuary",
			"blade ward", "longstrider", "aid", "darkvision",
			"enlarge/reduce", "fly", "freedom of movement",
			"greater invisibility", "spirit shroud",
		];

		it("should contain all registered spells", () => {
			for (const spellName of expectedSpells) {
				const entry = CharacterSheetState.getSpellFromRegistry(spellName);
				expect(entry).not.toBeNull();
			}
		});

		it("should return null for unregistered spells", () => {
			expect(CharacterSheetState.getSpellFromRegistry("nonexistent spell")).toBeNull();
			expect(CharacterSheetState.getSpellFromRegistry("fireball")).toBeNull();
		});

		it("should be case insensitive via lowercasing", () => {
			// getSpellFromRegistry lowercases the input
			expect(CharacterSheetState.getSpellFromRegistry("Shield")).not.toBeNull();
			expect(CharacterSheetState.getSpellFromRegistry("BLADE WARD")).not.toBeNull();
			expect(CharacterSheetState.getSpellFromRegistry("blade ward")).not.toBeNull();
			expect(CharacterSheetState.getSpellFromRegistry("False Life")).not.toBeNull();
		});

		it("should have selfEffects array for buff spells", () => {
			const heroism = CharacterSheetState.getSpellFromRegistry("heroism");
			expect(heroism.selfEffects).toBeDefined();
			expect(Array.isArray(heroism.selfEffects)).toBe(true);
			expect(heroism.selfEffects.length).toBeGreaterThan(0);
		});
	});

	// ===================================================================
	// TEMP HP VIA activateState
	// ===================================================================
	describe("TempHp via State Activation", () => {
		it("should apply tempHp from customEffects on activateState", () => {
			state.setHp(40, 40);

			state.activateState("custom", {
				name: "Test Spell",
				customEffects: [{type: "tempHp", value: 10}],
			});

			expect(state.getTempHp()).toBe(10);
		});

		it("should NOT apply tempHp from addActiveState (no side effects)", () => {
			state.setHp(40, 40);

			state.addActiveState("custom", {
				name: "Test Spell",
				customEffects: [{type: "tempHp", value: 10}],
			});

			// addActiveState does NOT trigger _applyTempHpFromState
			expect(state.getTempHp()).toBe(0);
		});

		it("should apply tempHp on reactivation via activateState", () => {
			state.setHp(40, 40);

			// First activation
			state.activateState("custom", {
				name: "Recurring Temp HP",
				customEffects: [{type: "tempHp", value: 7}],
			});
			expect(state.getTempHp()).toBe(7);

			// Consume temp HP
			state.setTempHp(0);
			expect(state.getTempHp()).toBe(0);

			// Reactivate — should re-apply temp HP
			state.activateState("custom", {
				name: "Recurring Temp HP",
				customEffects: [{type: "tempHp", value: 7}],
			});
			expect(state.getTempHp()).toBe(7);
		});

		it("should handle multiple tempHp effects (take highest)", () => {
			state.setHp(40, 40);

			state.activateState("custom", {
				name: "Multi Temp HP",
				customEffects: [
					{type: "tempHp", value: 5},
					{type: "tempHp", value: 12},
					{type: "tempHp", value: 8},
				],
			});

			// Each is applied in order; 5 sets to 5, then 12 > 5 so sets to 12, then 8 < 12 so stays 12
			expect(state.getTempHp()).toBe(12);
		});

		it("should combine tempHp with other buff effects", () => {
			state.setHp(40, 40);

			state.activateState("custom", {
				name: "Armor of Agathys",
				customEffects: [
					{type: "tempHp", value: 5},
					{type: "extraDamage", dice: "1d6", damageType: "cold"},
				],
				isSpellEffect: true,
			});

			expect(state.getTempHp()).toBe(5);
			const activeStates = state.getActiveStates();
			const agathys = activeStates.find(s => s.name === "Armor of Agathys");
			expect(agathys).toBeDefined();
			expect(agathys.customEffects).toHaveLength(2);
		});
	});

	// ===================================================================
	// BLOODIED + HEALING INTERACTION
	// ===================================================================
	describe("Bloodied + Healing Interactions", () => {
		beforeEach(() => {
			state.setHp(40, 40);
		});

		it("should remove bloodied after healing past 50%", () => {
			state.takeDamage(25); // 40 -> 15
			expect(state.hasCondition("bloodied")).toBe(true);

			state.heal(10); // 15 -> 25
			expect(state.hasCondition("bloodied")).toBe(false);
		});

		it("should keep bloodied if healed but still below 50%", () => {
			state.takeDamage(30); // 40 -> 10
			expect(state.hasCondition("bloodied")).toBe(true);

			state.heal(5); // 10 -> 15
			expect(state.hasCondition("bloodied")).toBe(true);
		});

		it("should add bloodied via setHp", () => {
			// setHp(current, max) — current=18, max=40
			state.setHp(18, 40);
			expect(state.hasCondition("bloodied")).toBe(true);
		});

		it("should remove bloodied via setHp", () => {
			state.setHp(10, 40);
			expect(state.hasCondition("bloodied")).toBe(true);

			state.setHp(30, 40);
			expect(state.hasCondition("bloodied")).toBe(false);
		});

		it("should not be bloodied at 0 HP even via takeDamage", () => {
			state.takeDamage(40); // 40 -> 0
			expect(state.isBloodied()).toBe(false);
			// Character is unconscious, not bloodied
		});
	});

	// ===================================================================
	// CONCENTRATION AND BLADE WARD INTERACTION
	// ===================================================================
	describe("Concentration Spell Interactions", () => {
		it("should track Blade Ward as concentration", () => {
			// Blade Ward in 2024 XPHB requires concentration
			const spellData = {
				name: "Blade Ward",
				source: "XPHB",
				level: 0,
				school: "A",
				duration: [{type: "timed", concentration: true, duration: {amount: 1, type: "round"}}],
				entries: ["Until the end of your next turn, you have resistance against bludgeoning, piercing, and slashing damage."],
			};

			const effects = CharacterSheetState.parseSpellEffects(spellData);
			expect(effects.concentration).toBe(true);
		});

		it("should drop Blade Ward effects when concentration breaks", () => {
			state.activateState("custom", {
				name: "Blade Ward",
				customEffects: CharacterSheetState.getSpellFromRegistry("blade ward").selfEffects,
				isSpellEffect: true,
				concentration: true,
			});

			expect(state.hasResistanceFromStates("bludgeoning")).toBe(true);

			// Deactivate (simulating concentration break)
			state.deactivateState("custom");

			expect(state.hasResistanceFromStates("bludgeoning")).toBe(false);
		});
	});
});
