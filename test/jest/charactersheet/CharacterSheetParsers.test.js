/**
 * Character Sheet Parsers - Unit Tests
 * Tests for FeatureUsesParser, NaturalWeaponParser, SpellGrantParser, FeatureModifierParser
 */

import "../../../js/charactersheet/charactersheet-state.js";

const FeatureUsesParser = globalThis.FeatureUsesParser;
const NaturalWeaponParser = globalThis.NaturalWeaponParser;
const SpellGrantParser = globalThis.SpellGrantParser;
const FeatureModifierParser = globalThis.FeatureModifierParser;

// ==========================================================================
// FeatureUsesParser
// ==========================================================================
describe("FeatureUsesParser", () => {
	// Mock ability mod getter
	const mockGetAbilityMod = (ability) => {
		const mods = {str: 3, dex: 2, con: 2, int: 0, wis: 1, cha: 4};
		return mods[ability.toLowerCase()] || 0;
	};

	// Mock proficiency bonus getter
	const mockGetProfBonus = () => 3;

	describe("parseUses", () => {
		it("should parse 'once per long rest' as 1 use with long rest recharge", () => {
			const text = "You can use this feature once. You regain the ability to do so when you finish a long rest.";
			const result = FeatureUsesParser.parseUses(text, mockGetAbilityMod, mockGetProfBonus);
			expect(result).not.toBeNull();
			expect(result.max).toBe(1);
			expect(result.recharge).toBe("long");
		});

		it("should parse 'twice per short or long rest'", () => {
			const text = "You can use this feature twice. You regain all expended uses when you finish a short or long rest.";
			const result = FeatureUsesParser.parseUses(text, mockGetAbilityMod, mockGetProfBonus);
			expect(result).not.toBeNull();
			expect(result.max).toBe(2);
			expect(result.recharge).toBe("short");
		});

		it("should parse 'proficiency bonus times per long rest'", () => {
			const text = "You can use this feature a number of times equal to your proficiency bonus. You regain all expended uses when you finish a long rest.";
			const result = FeatureUsesParser.parseUses(text, mockGetAbilityMod, mockGetProfBonus);
			expect(result).not.toBeNull();
			expect(result.max).toBe(3); // proficiency bonus
			expect(result.recharge).toBe("long");
		});

		it("should parse 'Charisma modifier times'", () => {
			const text = "You can use this feature a number of times equal to your Charisma modifier (minimum of once). You regain all expended uses when you finish a long rest.";
			const result = FeatureUsesParser.parseUses(text, mockGetAbilityMod, mockGetProfBonus);
			expect(result).not.toBeNull();
			expect(result.max).toBe(4); // Charisma modifier
			expect(result.recharge).toBe("long");
		});

		it("should parse '1 + Constitution modifier times'", () => {
			const text = "You can use this feature 1 + your Constitution modifier times. You regain all uses after a long rest.";
			const result = FeatureUsesParser.parseUses(text, mockGetAbilityMod, mockGetProfBonus);
			expect(result).not.toBeNull();
			expect(result.max).toBe(3); // 1 + 2 CON
		});

		it("should return null for features without uses", () => {
			const text = "You gain proficiency in heavy armor.";
			const result = FeatureUsesParser.parseUses(text, mockGetAbilityMod, mockGetProfBonus);
			expect(result).toBeNull();
		});

		it("should handle HTML in text", () => {
			const text = "<p>You can use this feature <strong>once</strong>. You regain the ability when you finish a <em>long rest</em>.</p>";
			const result = FeatureUsesParser.parseUses(text, mockGetAbilityMod, mockGetProfBonus);
			expect(result).not.toBeNull();
			expect(result.max).toBe(1);
		});
	});

	describe("hasLimitedUses", () => {
		it("should return true for features with uses", () => {
			expect(FeatureUsesParser.hasLimitedUses("You can use this once per long rest.")).toBe(true);
			expect(FeatureUsesParser.hasLimitedUses("Regain all uses when you finish a short rest.")).toBe(true);
		});

		it("should return false for features without uses", () => {
			expect(FeatureUsesParser.hasLimitedUses("You gain proficiency in athletics.")).toBe(false);
		});
	});
});

// ==========================================================================
// NaturalWeaponParser
// ==========================================================================
describe("NaturalWeaponParser", () => {
	describe("parseNaturalWeapon", () => {
		it("should parse simple claw attack", () => {
			const text = "You have claws that deal 1d4 slashing damage.";
			const result = NaturalWeaponParser.parseNaturalWeapon(text, "Claws");
			expect(result).not.toBeNull();
			expect(result.name).toBe("Claws");
			expect(result.damage).toContain("1d4");
			expect(result.damageType).toBe("slashing");
		});

		it("should parse bite attack with piercing damage", () => {
			const text = "Your fanged maw is a natural weapon, which you can use to make unarmed strikes. If you hit with it, you deal piercing damage equal to 1d6 + your Strength modifier.";
			const result = NaturalWeaponParser.parseNaturalWeapon(text, "Bite");
			expect(result).not.toBeNull();
			expect(result.name).toBe("Bite");
			expect(result.damage).toContain("1d6");
			expect(result.damageType).toBe("piercing");
		});

		it("should parse talon attack", () => {
			const text = "You have talons that you can use to make unarmed strikes. When you hit with them, the strike deals 1d6 + your Strength modifier slashing damage.";
			const result = NaturalWeaponParser.parseNaturalWeapon(text, "Talons");
			expect(result).not.toBeNull();
			expect(result.damageType).toBe("slashing");
		});

		it("should return null for non-weapon features", () => {
			const text = "You gain darkvision out to 60 feet.";
			const result = NaturalWeaponParser.parseNaturalWeapon(text, "Darkvision");
			expect(result).toBeNull();
		});
	});

	describe("isNaturalWeapon", () => {
		it("should identify natural weapon text", () => {
			expect(NaturalWeaponParser.isNaturalWeapon("deal 1d6 slashing damage")).toBe(true);
			expect(NaturalWeaponParser.isNaturalWeapon("natural weapon")).toBe(true);
			expect(NaturalWeaponParser.isNaturalWeapon("unarmed strike")).toBe(true);
		});

		it("should not identify non-weapon text", () => {
			expect(NaturalWeaponParser.isNaturalWeapon("gain proficiency")).toBe(false);
		});
	});
});

// ==========================================================================
// SpellGrantParser
// ==========================================================================
describe("SpellGrantParser", () => {
	describe("parseAdditionalSpells", () => {
		it("should parse innate spell with daily uses", () => {
			const additionalSpells = [
				{
					innate: {
						1: {daily: {1: ["misty step"]}},
					},
				},
			];
			const result = SpellGrantParser.parseAdditionalSpells(additionalSpells, "Fey Ancestry");
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("misty step");
			expect(result[0].usesMax).toBe(1);
		});

		it("should parse at-will spell", () => {
			const additionalSpells = [
				{
					innate: {
						1: {will: ["detect magic"]},
					},
				},
			];
			const result = SpellGrantParser.parseAdditionalSpells(additionalSpells, "Magic Sense");
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("detect magic");
			expect(result[0].atWill).toBe(true);
		});

		it("should parse known/prepared spells", () => {
			const additionalSpells = [
				{
					known: {
						1: ["mage hand"],
						3: ["invisibility"],
					},
				},
			];
			const result = SpellGrantParser.parseAdditionalSpells(additionalSpells, "Magical Training");
			expect(result.length).toBeGreaterThanOrEqual(2);
		});

		it("should handle spell with source like 'spell|source'", () => {
			const additionalSpells = [
				{
					innate: {
						1: {daily: {1: ["cure wounds|phb"]}},
					},
				},
			];
			const result = SpellGrantParser.parseAdditionalSpells(additionalSpells, "Healing Touch");
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("cure wounds");
			expect(result[0].source).toBe("phb");
		});

		it("should return empty array for null input", () => {
			expect(SpellGrantParser.parseAdditionalSpells(null, "Test")).toEqual([]);
			expect(SpellGrantParser.parseAdditionalSpells(undefined, "Test")).toEqual([]);
		});
	});

	describe("parseSpellsFromText", () => {
		it("should extract spell names from text", () => {
			const text = "You know the {@spell mage hand} cantrip. At 3rd level, you can cast {@spell invisibility} once per long rest.";
			const result = SpellGrantParser.parseSpellsFromText(text, "Magic");
			expect(result.length).toBeGreaterThanOrEqual(1);
		});

		it("should return empty array for text without spells", () => {
			const text = "You gain proficiency in stealth.";
			const result = SpellGrantParser.parseSpellsFromText(text, "Sneaky");
			expect(result).toEqual([]);
		});
	});

	describe("grantsSpells", () => {
		it("should detect spell-granting text", () => {
			expect(SpellGrantParser.grantsSpells("You know the mage hand cantrip")).toBe(true);
			expect(SpellGrantParser.grantsSpells("You can cast invisibility")).toBe(true);
			expect(SpellGrantParser.grantsSpells("learn one spell")).toBe(true);
		});

		it("should return false for non-spell text", () => {
			expect(SpellGrantParser.grantsSpells("You gain darkvision")).toBe(false);
		});
	});
});

// ==========================================================================
// FeatureModifierParser
// ==========================================================================
describe("FeatureModifierParser", () => {
	describe("parseModifiers", () => {
		it("should parse AC bonus", () => {
			const text = "While you are not wearing any armor, your Armor Class equals 10 + your Dexterity modifier + your Constitution modifier.";
			const result = FeatureModifierParser.parseModifiers(text);
			// Should detect this as an AC formula
			expect(result.acFormula || result.ac).toBeDefined();
		});

		it("should parse saving throw advantage", () => {
			const text = "You have advantage on saving throws against being frightened.";
			const result = FeatureModifierParser.parseModifiers(text);
			expect(result.savingThrowAdvantage).toBeDefined();
		});

		it("should parse resistance", () => {
			const text = "You have resistance to fire damage.";
			const result = FeatureModifierParser.parseModifiers(text);
			expect(result.resistances).toBeDefined();
			expect(result.resistances).toContain("fire");
		});

		it("should parse multiple resistances", () => {
			const text = "You have resistance to cold and fire damage.";
			const result = FeatureModifierParser.parseModifiers(text);
			expect(result.resistances).toContain("cold");
			expect(result.resistances).toContain("fire");
		});

		it("should parse damage immunity", () => {
			const text = "You are immune to poison damage.";
			const result = FeatureModifierParser.parseModifiers(text);
			expect(result.immunities).toBeDefined();
			expect(result.immunities).toContain("poison");
		});

		it("should parse condition immunity", () => {
			const text = "You can't be charmed.";
			const result = FeatureModifierParser.parseModifiers(text);
			expect(result.conditionImmunities).toBeDefined();
		});

		it("should parse speed bonus", () => {
			const text = "Your walking speed increases by 10 feet.";
			const result = FeatureModifierParser.parseModifiers(text);
			expect(result.speed || result.speedBonus).toBeDefined();
		});

		it("should parse flying speed", () => {
			const text = "You have a flying speed of 30 feet.";
			const result = FeatureModifierParser.parseModifiers(text);
			expect(result.flySpeed).toBe(30);
		});

		it("should parse swimming speed", () => {
			const text = "You have a swimming speed of 30 feet.";
			const result = FeatureModifierParser.parseModifiers(text);
			expect(result.swimSpeed).toBe(30);
		});

		it("should parse darkvision", () => {
			const text = "You can see in dim light within 60 feet of you as if it were bright light.";
			const result = FeatureModifierParser.parseModifiers(text);
			expect(result.darkvision).toBe(60);
		});

		it("should return empty object for text without modifiers", () => {
			const text = "You gain proficiency in one skill of your choice.";
			const result = FeatureModifierParser.parseModifiers(text);
			// Should be an object, possibly empty or with minimal properties
			expect(typeof result).toBe("object");
		});
	});

	describe("extractCombatEffects", () => {
		it("should detect advantage on attack rolls", () => {
			const text = "You have advantage on attack rolls against creatures that haven't taken a turn yet.";
			const result = FeatureModifierParser.parseModifiers(text);
			expect(result.attackAdvantage).toBeDefined();
		});

		it("should detect bonus to damage", () => {
			const text = "When you hit with a melee weapon attack, you deal an extra 1d6 damage.";
			const result = FeatureModifierParser.parseModifiers(text);
			expect(result.bonusDamage).toBeDefined();
		});
	});
});
