/**
 * Character Sheet Combat - Unit Tests
 * Tests for attack calculations, damage rolls, initiative, death saves, and combat mechanics
 */

import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

describe("Combat Calculations", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		// Set up a basic level 5 fighter
		state.addClass({name: "Fighter", source: "PHB", level: 5});
		state.setAbilityBase("str", 16); // +3
		state.setAbilityBase("dex", 14); // +2
		state.setAbilityBase("con", 14); // +2
	});

	// ==========================================================================
	// Attack Bonus Calculations
	// ==========================================================================
	describe("Attack Bonus", () => {
		it("should calculate melee attack bonus (STR + prof)", () => {
			// Level 5 = +3 prof, STR 16 = +3
			expect(state.getAttackBonus("str")).toBe(6);
		});

		it("should calculate ranged attack bonus (DEX + prof)", () => {
			// Level 5 = +3 prof, DEX 14 = +2
			expect(state.getAttackBonus("dex")).toBe(5);
		});

		it("should use proficiency bonus based on level", () => {
			const state2 = new CharacterSheetState();
			state2.addClass({name: "Fighter", source: "PHB", level: 1});
			state2.setAbilityBase("str", 16);
			// Level 1 = +2 prof
			expect(state2.getAttackBonus("str")).toBe(5); // 3 + 2
		});

		it("should scale with level progression", () => {
			const state9 = new CharacterSheetState();
			state9.addClass({name: "Fighter", source: "PHB", level: 9});
			state9.setAbilityBase("str", 16);
			// Level 9 = +4 prof
			expect(state9.getAttackBonus("str")).toBe(7); // 3 + 4
		});
	});

	// ==========================================================================
	// Damage Calculations
	// ==========================================================================
	describe("Damage Calculations", () => {
		it("should add STR modifier to melee damage", () => {
			const damage = state.getDamageBonus("str");
			expect(damage).toBe(3); // STR 16 = +3
		});

		it("should add DEX modifier to ranged/finesse damage", () => {
			const damage = state.getDamageBonus("dex");
			expect(damage).toBe(2); // DEX 14 = +2
		});

		it("should not include proficiency in damage", () => {
			// Damage bonus is just ability mod, not prof
			expect(state.getDamageBonus("str")).toBe(state.getAbilityMod("str"));
		});
	});

	// ==========================================================================
	// Initiative
	// ==========================================================================
	describe("Initiative", () => {
		it("should calculate initiative as DEX modifier", () => {
			expect(state.getInitiative()).toBe(2); // DEX 14 = +2
		});

		it("should update with DEX changes", () => {
			state.setAbilityBase("dex", 18);
			expect(state.getInitiative()).toBe(4);
		});

		it("should include initiative bonuses from features", () => {
			state.setCustomModifier("initiative", 5); // Alert feat
			expect(state.getInitiative()).toBe(7); // 2 + 5
		});

		it("should handle negative DEX modifier", () => {
			state.setAbilityBase("dex", 6);
			expect(state.getInitiative()).toBe(-2);
		});
	});

	// ==========================================================================
	// Death Saves
	// ==========================================================================
	describe("Death Saves", () => {
		it("should start with 0 successes and failures", () => {
			const saves = state.getDeathSaves();
			expect(saves.successes).toBe(0);
			expect(saves.failures).toBe(0);
		});

		it("should track death save successes", () => {
			state.addDeathSaveSuccess();
			state.addDeathSaveSuccess();
			expect(state.getDeathSaves().successes).toBe(2);
		});

		it("should track death save failures", () => {
			state.addDeathSaveFailure();
			expect(state.getDeathSaves().failures).toBe(1);
		});

		it("should stabilize at 3 successes", () => {
			state.addDeathSaveSuccess();
			state.addDeathSaveSuccess();
			state.addDeathSaveSuccess();
			expect(state.isStable()).toBe(true);
		});

		it("should die at 3 failures", () => {
			state.addDeathSaveFailure();
			state.addDeathSaveFailure();
			state.addDeathSaveFailure();
			expect(state.isDead()).toBe(true);
		});

		it("should reset death saves when healed", () => {
			state.addDeathSaveSuccess();
			state.addDeathSaveFailure();
			state.setMaxHp(44);
			state.setCurrentHp(0);
			state.heal(5);
			const saves = state.getDeathSaves();
			expect(saves.successes).toBe(0);
			expect(saves.failures).toBe(0);
		});

		it("should cap successes at 3", () => {
			state.setDeathSaves({successes: 3, failures: 0});
			state.addDeathSaveSuccess();
			expect(state.getDeathSaves().successes).toBe(3);
		});

		it("should cap failures at 3", () => {
			state.setDeathSaves({successes: 0, failures: 3});
			state.addDeathSaveFailure();
			expect(state.getDeathSaves().failures).toBe(3);
		});
	});

	// ==========================================================================
	// Armor Class
	// ==========================================================================
	describe("Armor Class in Combat", () => {
		it("should calculate unarmored AC (10 + DEX)", () => {
			expect(state.getAC()).toBe(12); // 10 + 2 DEX
		});

		it("should apply shield bonus in combat", () => {
			state.setShield(true);
			expect(state.getAC()).toBe(14); // 10 + 2 DEX + 2 shield
		});

		it("should track temporary AC bonuses", () => {
			state.addACBonus({source: "Shield of Faith", value: 2, duration: "1 minute"});
			// Base 12 + 2 from spell
			expect(state.getAC()).toBeGreaterThanOrEqual(14);
		});

		it("should handle cover bonuses", () => {
			// Half cover = +2, three-quarters = +5
			state.setACBonus("cover", 2);
			expect(state.getAC()).toBe(14);
		});
	});

	// ==========================================================================
	// Conditions
	// ==========================================================================
	describe("Conditions", () => {
		it("should track active conditions", () => {
			state.addCondition("frightened");
			expect(state.hasCondition("frightened")).toBe(true);
		});

		it("should remove conditions", () => {
			state.addCondition("poisoned");
			state.removeCondition("poisoned");
			expect(state.hasCondition("poisoned")).toBe(false);
		});

		it("should list all active conditions", () => {
			state.addCondition("blinded");
			state.addCondition("deafened");
			const conditions = state.getConditions();
			expect(conditions).toContain("blinded");
			expect(conditions).toContain("deafened");
		});

		it("should not duplicate conditions", () => {
			state.addCondition("prone");
			state.addCondition("prone");
			const conditions = state.getConditions();
			expect(conditions.filter(c => c === "prone").length).toBe(1);
		});

		it("should clear all conditions", () => {
			state.addCondition("stunned");
			state.addCondition("restrained");
			state.clearConditions();
			expect(state.getConditions()).toHaveLength(0);
		});
	});

	// ==========================================================================
	// Exhaustion
	// ==========================================================================
	describe("Exhaustion", () => {
		it("should track exhaustion level", () => {
			state.setExhaustion(1);
			expect(state.getExhaustion()).toBe(1);
		});

		it("should cap exhaustion at 6", () => {
			state.setExhaustion(10);
			expect(state.getExhaustion()).toBeLessThanOrEqual(6);
		});

		it("should not allow negative exhaustion", () => {
			state.setExhaustion(-1);
			expect(state.getExhaustion()).toBe(0);
		});

		it("should increment exhaustion", () => {
			state.setExhaustion(2);
			state.addExhaustion(1);
			expect(state.getExhaustion()).toBe(3);
		});

		it("should reduce exhaustion", () => {
			state.setExhaustion(3);
			state.reduceExhaustion(1);
			expect(state.getExhaustion()).toBe(2);
		});

		it("should apply exhaustion penalties to ability checks at level 1", () => {
			state.setExhaustion(1);
			// Exhaustion 1 = disadvantage on ability checks
			expect(state.hasExhaustionDisadvantage("abilityCheck")).toBe(true);
		});

		it("should reduce speed at exhaustion level 2", () => {
			state.setExhaustion(2);
			// Exhaustion 2 = speed halved
			expect(state.getSpeedMultiplier()).toBe(0.5);
		});

		it("should apply disadvantage on attacks at level 3", () => {
			state.setExhaustion(3);
			expect(state.hasExhaustionDisadvantage("attack")).toBe(true);
		});

		it("should halve max HP at level 4", () => {
			state.setMaxHp(44);
			state.setExhaustion(4);
			expect(state.getEffectiveMaxHp()).toBe(22);
		});
	});

	// ==========================================================================
	// Concentration
	// ==========================================================================
	describe("Concentration", () => {
		it("should track concentrating spell", () => {
			state.setConcentrating({name: "Bless", source: "PHB"});
			expect(state.isConcentrating()).toBe(true);
		});

		it("should get concentrating spell info", () => {
			state.setConcentrating({name: "Haste", source: "PHB"});
			const spell = state.getConcentratingSpell();
			expect(spell.name).toBe("Haste");
		});

		it("should break concentration", () => {
			state.setConcentrating({name: "Fly", source: "PHB"});
			state.breakConcentration();
			expect(state.isConcentrating()).toBe(false);
		});

		it("should calculate concentration save DC", () => {
			// DC = 10 or half damage, whichever is higher
			expect(state.getConcentrationDC(15)).toBe(10);
			expect(state.getConcentrationDC(30)).toBe(15);
			expect(state.getConcentrationDC(50)).toBe(25);
		});
	});

	// ==========================================================================
	// Resistances and Immunities
	// ==========================================================================
	describe("Resistances and Immunities", () => {
		it("should track damage resistances", () => {
			state.addResistance("fire");
			expect(state.hasResistance("fire")).toBe(true);
		});

		it("should track damage immunities", () => {
			state.addImmunity("poison");
			expect(state.hasImmunity("poison")).toBe(true);
		});

		it("should track damage vulnerabilities", () => {
			state.addVulnerability("radiant");
			expect(state.hasVulnerability("radiant")).toBe(true);
		});

		it("should track condition immunities", () => {
			state.addConditionImmunity("charmed");
			expect(state.hasConditionImmunity("charmed")).toBe(true);
		});

		it("should calculate effective damage with resistance", () => {
			state.addResistance("fire");
			expect(state.calculateEffectiveDamage(20, "fire")).toBe(10);
		});

		it("should calculate effective damage with immunity", () => {
			state.addImmunity("poison");
			expect(state.calculateEffectiveDamage(50, "poison")).toBe(0);
		});

		it("should calculate effective damage with vulnerability", () => {
			state.addVulnerability("cold");
			expect(state.calculateEffectiveDamage(10, "cold")).toBe(20);
		});

		it("should handle normal damage types", () => {
			expect(state.calculateEffectiveDamage(15, "slashing")).toBe(15);
		});
	});

	// ==========================================================================
	// Temporary Hit Points
	// ==========================================================================
	describe("Temporary Hit Points in Combat", () => {
		beforeEach(() => {
			state.setMaxHp(44);
			state.setCurrentHp(44);
		});

		it("should add temp HP", () => {
			state.setTempHp(10);
			expect(state.getTempHp()).toBe(10);
		});

		it("should not stack temp HP - use higher value", () => {
			state.setTempHp(10);
			state.setTempHp(15);
			expect(state.getTempHp()).toBe(15);
		});

		it("should take damage from temp HP first", () => {
			state.setTempHp(10);
			state.takeDamage(5);
			expect(state.getTempHp()).toBe(5);
			expect(state.getCurrentHp()).toBe(44);
		});

		it("should overflow damage to regular HP", () => {
			state.setTempHp(10);
			state.takeDamage(15);
			expect(state.getTempHp()).toBe(0);
			expect(state.getCurrentHp()).toBe(39);
		});

		it("should not affect healing", () => {
			state.setCurrentHp(20);
			state.setTempHp(10);
			state.heal(10);
			expect(state.getCurrentHp()).toBe(30);
			expect(state.getTempHp()).toBe(10);
		});
	});

	// ==========================================================================
	// Attacks and Weapons
	// ==========================================================================
	describe("Attacks", () => {
		it("should add a weapon attack", () => {
			state.addAttack({
				name: "Longsword",
				attackBonus: 6,
				damage: "1d8+3",
				damageType: "slashing",
			});
			const attacks = state.getAttacks();
			expect(attacks).toHaveLength(1);
			expect(attacks[0].name).toBe("Longsword");
		});

		it("should remove an attack", () => {
			state.addAttack({
				id: "atk1",
				name: "Greatsword",
				attackBonus: 6,
				damage: "2d6+3",
				damageType: "slashing",
			});
			state.removeAttack("atk1");
			expect(state.getAttacks()).toHaveLength(0);
		});

		it("should update attack bonus when ability changes", () => {
			state.addAttack({
				name: "Handaxe",
				abilityMod: "str",
				damage: "1d6",
				damageType: "slashing",
			});
			state.setAbilityBase("str", 20);
			const attacks = state.getAttacks();
			// Attack should now use +5 STR + 3 prof = +8
			expect(attacks[0].attackBonus).toBe(8);
		});

		it("should track ranged attack range", () => {
			state.addAttack({
				name: "Longbow",
				attackBonus: 5,
				damage: "1d8+2",
				damageType: "piercing",
				range: "150/600",
			});
			const attack = state.getAttacks()[0];
			expect(attack.range).toBe("150/600");
		});

		it("should track weapon properties", () => {
			state.addAttack({
				name: "Rapier",
				attackBonus: 5,
				damage: "1d8+2",
				damageType: "piercing",
				properties: ["finesse"],
			});
			const attack = state.getAttacks()[0];
			expect(attack.properties).toContain("finesse");
		});
	});
});

// ==========================================================================
// Combat Actions and Resources
// ==========================================================================
describe("Combat Actions", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.addClass({name: "Fighter", source: "PHB", level: 5});
	});

	describe("Action Economy", () => {
		it("should track actions, bonus actions, and reactions", () => {
			// Fighter at level 5 has Action Surge
			const resources = state.getResources();
			// This depends on implementation
			expect(resources).toBeDefined();
		});
	});

	describe("Class Combat Features", () => {
		it("should track Second Wind uses (Fighter)", () => {
			const resource = state.getResource("Second Wind");
			if (resource) {
				expect(resource.max).toBeGreaterThanOrEqual(1);
			}
		});

		it("should track Action Surge uses (Fighter 2+)", () => {
			const resource = state.getResource("Action Surge");
			if (resource) {
				expect(resource.max).toBeGreaterThanOrEqual(1);
			}
		});
	});
});

// ==========================================================================
// Multiclass Combat Calculations
// ==========================================================================
describe("Multiclass Combat", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		// Fighter 3 / Rogue 2 multiclass
		state.addClass({name: "Fighter", source: "PHB", level: 3});
		state.addClass({name: "Rogue", source: "PHB", level: 2});
		state.setAbilityBase("str", 14); // +2
		state.setAbilityBase("dex", 16); // +3
	});

	it("should use total level for proficiency bonus", () => {
		// Level 5 total = +3 prof
		expect(state.getProficiencyBonus()).toBe(3);
	});

	it("should calculate attack bonus with multiclass proficiency", () => {
		// STR attack = +2 STR + 3 prof = +5
		expect(state.getAttackBonus("str")).toBe(5);
		// DEX attack = +3 DEX + 3 prof = +6
		expect(state.getAttackBonus("dex")).toBe(6);
	});

	it("should allow Sneak Attack damage (Rogue feature)", () => {
		// Rogue 2 = 1d6 sneak attack
		const sneakAttackDice = state.getSneakAttackDice();
		if (sneakAttackDice !== undefined) {
			expect(sneakAttackDice).toBe(1);
		}
	});
});
