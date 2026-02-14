/**
 * Character Sheet Spell Automation - Unit Tests (Phase 6)
 * Tests for:
 * - Expanded _parseBuffs (B2)
 * - Spell-buff registry (B3)
 * - Concentration break cleanup (B4)
 * - parseSpellEffects with registry integration (B5)
 */

import "./setup.js";

let CharacterSheetState;

beforeAll(async () => {
	CharacterSheetState = (await import("../../../js/charactersheet/charactersheet-state.js")).CharacterSheetState;
});

describe("Spell Automation (Phase 6)", () => {
	// ===================================================================
	// B2: Expanded _parseBuffs
	// ===================================================================
	describe("_parseBuffs - expanded pattern matching", () => {
		test("should parse AC bonus (+N bonus to AC)", () => {
			const spell = {
				entries: ["The target gains a +2 bonus to AC for the duration."],
			};
			const buffs = CharacterSheetState._parseBuffs(spell);
			expect(buffs.some(b => b.target === "ac" && b.value === 2)).toBe(true);
		});

		test("should parse AC formula (base AC becomes N + DEX)", () => {
			const spell = {
				entries: ["The target's base AC becomes 13 + Dexterity modifier."],
			};
			const buffs = CharacterSheetState._parseBuffs(spell);
			const formula = buffs.find(b => b.type === "formula");
			expect(formula).toBeDefined();
			expect(formula.baseAc).toBe(13);
			expect(formula.addDex).toBe(true);
		});

		test("should parse AC minimum (Barkskin: AC can't be less than 16)", () => {
			const spell = {
				entries: ["The target's AC can't be less than 16, regardless of armor."],
			};
			const buffs = CharacterSheetState._parseBuffs(spell);
			const minimum = buffs.find(b => b.type === "minimum");
			expect(minimum).toBeDefined();
			expect(minimum.minAc).toBe(16);
		});

		test("should parse roll bonus (Bless: +{@dice 1d4} to the roll)", () => {
			const spell = {
				entries: ["Whenever a target makes an attack roll or saving throw, it can roll a {@dice 1d4} to the roll."],
			};
			const buffs = CharacterSheetState._parseBuffs(spell);
			const rollBonus = buffs.find(b => b.type === "rollBonus");
			expect(rollBonus).toBeDefined();
			expect(rollBonus.dice).toBe("1d4");
			expect(rollBonus.applies).toContain("attack");
			expect(rollBonus.applies).toContain("save");
		});

		test("should parse roll bonus alt pattern (add {@dice 1d4} to attack rolls)", () => {
			const spell = {
				entries: ["You can add a {@dice 1d4} to attack rolls and saving throws."],
			};
			const buffs = CharacterSheetState._parseBuffs(spell);
			const rollBonus = buffs.find(b => b.type === "rollBonus");
			expect(rollBonus).toBeDefined();
			expect(rollBonus.dice).toBe("1d4");
		});

		test("should parse roll penalty (Bane: subtract {@dice 1d4})", () => {
			const spell = {
				entries: ["Must subtract a {@dice 1d4} from attack roll or saving throw."],
			};
			const buffs = CharacterSheetState._parseBuffs(spell);
			const penalty = buffs.find(b => b.type === "rollPenalty");
			expect(penalty).toBeDefined();
			expect(penalty.dice).toBe("1d4");
		});

		test("should parse speed doubled (Haste)", () => {
			const spell = {
				entries: ["The target's speed is doubled."],
			};
			const buffs = CharacterSheetState._parseBuffs(spell);
			const speedBuff = buffs.find(b => b.target === "speed" && b.type === "multiplier");
			expect(speedBuff).toBeDefined();
			expect(speedBuff.value).toBe(2);
		});

		test("should parse speed increase by N (Longstrider)", () => {
			const spell = {
				entries: ["The target's speed increases by 10 feet."],
			};
			const buffs = CharacterSheetState._parseBuffs(spell);
			const speedBuff = buffs.find(b => b.target === "speed" && b.type === "bonus");
			expect(speedBuff).toBeDefined();
			expect(speedBuff.value).toBe(10);
		});

		test("should parse saving throw bonus", () => {
			const spell = {
				entries: ["The target gains a +1 bonus to saving throws."],
			};
			const buffs = CharacterSheetState._parseBuffs(spell);
			const saveBuff = buffs.find(b => b.target === "save");
			expect(saveBuff).toBeDefined();
			expect(saveBuff.value).toBe(1);
		});

		test("should parse attack roll bonus", () => {
			const spell = {
				entries: ["You gain a +3 bonus to attack rolls."],
			};
			const buffs = CharacterSheetState._parseBuffs(spell);
			const atkBuff = buffs.find(b => b.target === "attack");
			expect(atkBuff).toBeDefined();
			expect(atkBuff.value).toBe(3);
		});

		test("should parse extra damage dice", () => {
			const spell = {
				entries: ["You deal an extra {@damage 2d6} fire damage on each hit."],
			};
			const buffs = CharacterSheetState._parseBuffs(spell);
			const dmg = buffs.find(b => b.type === "extraDamage");
			expect(dmg).toBeDefined();
			expect(dmg.dice).toBe("2d6");
			expect(dmg.damageType).toBe("fire");
		});

		test("should parse resistance to damage type", () => {
			const spell = {
				entries: ["You have resistance to cold damage."],
			};
			const buffs = CharacterSheetState._parseBuffs(spell);
			const resist = buffs.find(b => b.type === "resistance");
			expect(resist).toBeDefined();
			expect(resist.damageType).toBe("cold");
		});

		test("should parse advantage on ability checks", () => {
			const spell = {
				entries: ["You have advantage on Strength checks."],
			};
			const buffs = CharacterSheetState._parseBuffs(spell);
			const adv = buffs.find(b => b.type === "advantage" && b.target === "check:str");
			expect(adv).toBeDefined();
		});

		test("should parse advantage on saving throws", () => {
			const spell = {
				entries: ["You have advantage on Wisdom saving throws."],
			};
			const buffs = CharacterSheetState._parseBuffs(spell);
			const adv = buffs.find(b => b.type === "advantage" && b.target === "save:wis");
			expect(adv).toBeDefined();
		});

		test("should parse per-turn temp HP", () => {
			const spell = {
				entries: ["The creature gains 5 temporary hit points at the start of each of its turns."],
			};
			const buffs = CharacterSheetState._parseBuffs(spell);
			const tempHp = buffs.find(b => b.type === "perTurnTempHp");
			expect(tempHp).toBeDefined();
			expect(tempHp.value).toBe(5);
		});

		test("should handle miscTags MAC for unmatched AC buffs", () => {
			const spell = {
				entries: ["Your magic gives a +1 bonus to AC."],
				miscTags: ["MAC"],
			};
			const buffs = CharacterSheetState._parseBuffs(spell);
			expect(buffs.some(b => b.target === "ac")).toBe(true);
		});

		test("should return empty array for spells with no buffs", () => {
			const spell = {
				entries: ["You throw a ball of fire."],
			};
			const buffs = CharacterSheetState._parseBuffs(spell);
			expect(buffs).toEqual([]);
		});
	});

	// ===================================================================
	// B3: Spell-Buff Registry
	// ===================================================================
	describe("Spell-buff registry", () => {
		test("should have entries for common buff spells", () => {
			expect(CharacterSheetState.SPELL_BUFF_REGISTRY["shield of faith"]).toBeDefined();
			expect(CharacterSheetState.SPELL_BUFF_REGISTRY["bless"]).toBeDefined();
			expect(CharacterSheetState.SPELL_BUFF_REGISTRY["mage armor"]).toBeDefined();
			expect(CharacterSheetState.SPELL_BUFF_REGISTRY["haste"]).toBeDefined();
			expect(CharacterSheetState.SPELL_BUFF_REGISTRY["hex"]).toBeDefined();
			expect(CharacterSheetState.SPELL_BUFF_REGISTRY["hunter's mark"]).toBeDefined();
		});

		test("getSpellFromRegistry should look up by name (case-insensitive)", () => {
			const result = CharacterSheetState.getSpellFromRegistry("Shield of Faith");
			expect(result).toBeDefined();
			expect(result.selfEffects).toContainEqual({type: "bonus", target: "ac", value: 2});
			expect(result.concentration).toBe(true);
		});

		test("getSpellFromRegistry should return null for unknown spells", () => {
			expect(CharacterSheetState.getSpellFromRegistry("Made Up Spell")).toBeNull();
			expect(CharacterSheetState.getSpellFromRegistry(null)).toBeNull();
		});

		test("registry entries should have valid effect structures", () => {
			for (const [name, entry] of Object.entries(CharacterSheetState.SPELL_BUFF_REGISTRY)) {
				if (entry.selfEffects) {
					expect(Array.isArray(entry.selfEffects)).toBe(true);
					for (const effect of entry.selfEffects) {
						expect(effect.type).toBeDefined();
					}
				}
			}
		});

		test("Shield of Faith should have +2 AC bonus", () => {
			const entry = CharacterSheetState.getSpellFromRegistry("Shield of Faith");
			expect(entry.selfEffects).toContainEqual({type: "bonus", target: "ac", value: 2});
		});

		test("Hex should have 1d6 necrotic extra damage", () => {
			const entry = CharacterSheetState.getSpellFromRegistry("Hex");
			expect(entry.selfEffects).toContainEqual({type: "extraDamage", dice: "1d6", damageType: "necrotic"});
		});

		test("Haste should have multiple effects", () => {
			const entry = CharacterSheetState.getSpellFromRegistry("Haste");
			expect(entry.concentration).toBe(true);
			expect(entry.selfEffects.length).toBeGreaterThanOrEqual(2);
			expect(entry.selfEffects).toContainEqual({type: "bonus", target: "ac", value: 2});
			expect(entry.selfEffects).toContainEqual({type: "speedMultiplier", value: 2});
		});

		test("Mage Armor should set AC formula", () => {
			const entry = CharacterSheetState.getSpellFromRegistry("Mage Armor");
			expect(entry.selfEffects).toContainEqual({type: "setAc", baseAc: 13, addDex: true});
			expect(entry.duration).toEqual({amount: 8, unit: "hour"});
		});

		test("Barkskin should set minimum AC 16", () => {
			const entry = CharacterSheetState.getSpellFromRegistry("Barkskin");
			expect(entry.selfEffects).toContainEqual({type: "minAc", value: 16});
		});

		test("Stoneskin should have physical damage resistance", () => {
			const entry = CharacterSheetState.getSpellFromRegistry("Stoneskin");
			expect(entry.selfEffects).toContainEqual({type: "resistance", target: "damage:bludgeoning"});
			expect(entry.selfEffects).toContainEqual({type: "resistance", target: "damage:piercing"});
			expect(entry.selfEffects).toContainEqual({type: "resistance", target: "damage:slashing"});
		});

		test("Aid should have HP max increase with upcast scaling", () => {
			const entry = CharacterSheetState.getSpellFromRegistry("Aid");
			expect(entry.selfEffects).toContainEqual({type: "hpMaxIncrease", value: 5});
			expect(entry.upcastPerLevel).toBeDefined();
			expect(entry.upcastPerLevel.hpMaxIncrease).toBe(5);
		});

		test("Enlarge/Reduce should have size increase and extra damage", () => {
			const entry = CharacterSheetState.getSpellFromRegistry("Enlarge/Reduce");
			expect(entry.selfEffects.some(e => e.type === "sizeIncrease")).toBe(true);
			expect(entry.selfEffects.some(e => e.type === "extraDamage")).toBe(true);
			expect(entry.selfEffects.some(e => e.type === "advantage" && e.target === "check:str")).toBe(true);
		});

		test("Greater Invisibility should have attack advantage and enemy disadvantage", () => {
			const entry = CharacterSheetState.getSpellFromRegistry("Greater Invisibility");
			expect(entry.selfEffects).toContainEqual({type: "advantage", target: "attack"});
			expect(entry.selfEffects).toContainEqual({type: "disadvantage", target: "attacksAgainst"});
		});
	});

	// ===================================================================
	// B5: parseSpellEffects enrichment with registry
	// ===================================================================
	describe("parseSpellEffects with registry integration", () => {
		test("should set registryMatch when spell is in registry", () => {
			const spell = {
				name: "Shield of Faith",
				level: 1,
				entries: ["A shimmering field grants a +2 bonus to AC."],
				duration: [{type: "timed", concentration: true, duration: {amount: 10, type: "minute"}}],
			};

			const effects = CharacterSheetState.parseSpellEffects(spell);
			expect(effects.registryMatch).toBe(true);
			expect(effects.registryEffects).toBeDefined();
			expect(effects.registryEffects).toContainEqual({type: "bonus", target: "ac", value: 2});
		});

		test("should not set registryMatch for unknown spells", () => {
			const spell = {
				name: "Custom Spell",
				level: 1,
				entries: ["Does something."],
			};

			const effects = CharacterSheetState.parseSpellEffects(spell);
			expect(effects.registryMatch).toBeFalsy();
		});

		test("should include upcastPerLevel from registry", () => {
			const spell = {
				name: "Aid",
				level: 2,
				entries: ["Hit point maximum increase by 5."],
			};

			const effects = CharacterSheetState.parseSpellEffects(spell);
			expect(effects.upcastPerLevel).toBeDefined();
			expect(effects.upcastPerLevel.hpMaxIncrease).toBe(5);
		});

		test("should still parse buffs even without registry match", () => {
			const spell = {
				name: "Custom Ward",
				level: 1,
				entries: ["The target gains a +3 bonus to AC."],
			};

			const effects = CharacterSheetState.parseSpellEffects(spell);
			expect(effects.buffs).toBeDefined();
			expect(effects.buffs.some(b => b.target === "ac" && b.value === 3)).toBe(true);
		});

		test("should parse both parsed buffs and registry effects", () => {
			const spell = {
				name: "Haste",
				level: 3,
				entries: ["The target's speed is doubled, it gains a +2 bonus to AC."],
				duration: [{type: "timed", concentration: true, duration: {amount: 1, type: "minute"}}],
			};

			const effects = CharacterSheetState.parseSpellEffects(spell);
			// Both parsed buffs and registry effects should be present
			expect(effects.buffs).toBeDefined();
			expect(effects.registryEffects).toBeDefined();

			// Parsed buffs from text
			expect(effects.buffs.some(b => b.target === "ac" && b.value === 2)).toBe(true);
			expect(effects.buffs.some(b => b.target === "speed" && b.type === "multiplier")).toBe(true);

			// Registry effects (more comprehensive)
			expect(effects.registryEffects.some(e => e.type === "advantage" && e.target === "save:dex")).toBe(true);
		});
	});

	// ===================================================================
	// B4: Concentration cleanup in parseSpellEffects context
	// ===================================================================
	describe("Concentration flag in parseSpellEffects", () => {
		test("should detect concentration from duration", () => {
			const spell = {
				name: "Bless",
				level: 1,
				entries: ["Add a d4 to attack and save rolls."],
				duration: [{type: "timed", concentration: true, duration: {amount: 1, type: "minute"}}],
			};

			const effects = CharacterSheetState.parseSpellEffects(spell);
			expect(effects.concentration).toBe(true);
		});

		test("should not flag non-concentration spells", () => {
			const spell = {
				name: "Mage Armor",
				level: 1,
				entries: ["Base AC becomes 13 + Dexterity modifier."],
				duration: [{type: "timed", duration: {amount: 8, type: "hour"}}],
			};

			const effects = CharacterSheetState.parseSpellEffects(spell);
			expect(effects.concentration).toBeFalsy();
		});
	});

	// ===================================================================
	// _parseTempHp
	// ===================================================================
	describe("_parseTempHp", () => {
		test("should parse flat temp HP amount", () => {
			const spell = {
				entries: ["You gain 10 temporary hit points."],
			};
			const result = CharacterSheetState._parseTempHp(spell);
			expect(result).toBeDefined();
			expect(result.amount).toBe(10);
		});

		test("should return null for spells without temp HP", () => {
			const spell = {
				entries: ["You deal damage."],
			};
			expect(CharacterSheetState._parseTempHp(spell)).toBeNull();
		});
	});
});
