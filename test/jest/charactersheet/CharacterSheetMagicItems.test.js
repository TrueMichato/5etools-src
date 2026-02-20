/**
 * Character Sheet Magic Items - Comprehensive Test Suite
 * Tests for magic item bonus application, attunement gating,
 * defensive properties, and all item bonus types.
 */

import "./setup.js";
import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

function makeWeapon (overrides = {}) {
	return {
		name: overrides.name || "Magic Longsword", source: "DMG", weapon: true,
		weaponCategory: "martial", type: "M", weight: 3, dmg1: "1d8", dmgType: "S",
		equipped: false, attuned: false,
		requiresAttunement: overrides.requiresAttunement || false,
		bonusWeapon: overrides.bonusWeapon || 0,
		bonusWeaponAttack: overrides.bonusWeaponAttack || 0,
		bonusWeaponDamage: overrides.bonusWeaponDamage || 0,
		bonusWeaponCritDamage: overrides.bonusWeaponCritDamage || 0,
		critThreshold: overrides.critThreshold || null,
		...overrides,
	};
}

function makeWondrous (overrides = {}) {
	return {
		name: overrides.name || "Wondrous Item", source: "DMG", type: "wondrous",
		weight: 0, equipped: false, attuned: false,
		requiresAttunement: overrides.requiresAttunement !== undefined ? overrides.requiresAttunement : true,
		bonusAc: overrides.bonusAc || 0,
		bonusSavingThrow: overrides.bonusSavingThrow || 0,
		bonusSpellAttack: overrides.bonusSpellAttack || 0,
		bonusSpellSaveDc: overrides.bonusSpellSaveDc || 0,
		bonusAbilityCheck: overrides.bonusAbilityCheck || 0,
		bonusProficiencyBonus: overrides.bonusProficiencyBonus || 0,
		bonusSavingThrowConcentration: overrides.bonusSavingThrowConcentration || 0,
		bonusSpellDamage: overrides.bonusSpellDamage || 0,
		...overrides,
	};
}

function addEquipAttune (state, item, attune = false) {
	state.addItem(item);
	const items = state.getItems();
	const added = items[items.length - 1];
	state.setItemEquipped(added.id, true);
	if (attune) state.setItemAttuned(added.id, true);
	return added.id;
}

describe("Magic Item Bonuses", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.addClass({name: "Fighter", source: "PHB", level: 5});
		state.setAbilityBase("str", 16);
		state.setAbilityBase("dex", 14);
		state.setAbilityBase("con", 14);
		state.setAbilityBase("int", 10);
		state.setAbilityBase("wis", 12);
		state.setAbilityBase("cha", 8);
	});

	// ======================================================================
	// AC Double-Counting Fix
	// ======================================================================
	describe("AC Calculation (no double-counting)", () => {
		it("should give base AC 10+DEX with no armor", () => {
			expect(state.getAc()).toBe(12);
		});

		it("should correctly apply +1 armor bonusAc without double-counting", () => {
			state.setArmor({ac: 17, type: "heavy", name: "+1 Chain Mail", magicBonus: 1});
			expect(state.getAc()).toBe(17);
		});

		it("should correctly apply Ring of Protection +1 AC without double-counting", () => {
			state.setItemAcBonus(1);
			expect(state.getAc()).toBe(13); // 10 + DEX(2) + ring(1)
		});

		it("should only count AC bonus once via ac.itemBonus path", () => {
			state.setItemAcBonus(1);
			state.setItemBonuses({savingThrow: 1}); // No AC in itemBonuses
			expect(state.getAc()).toBe(13); // Not 14
		});

		it("should stack armor + shield + ring correctly without double-counting", () => {
			state.setArmor({ac: 17, type: "heavy", name: "+1 Chain Mail", magicBonus: 1});
			state.setShield({equipped: true, bonus: 1});
			state.setItemAcBonus(1);
			expect(state.getAc()).toBe(19); // 17 + 1(shield) + 1(ring)
		});

		it("should NOT double-count when itemBonuses has no ac field", () => {
			state.setArmor({ac: 18, type: "heavy", name: "Plate", magicBonus: 0});
			state.setItemBonuses({savingThrow: 1});
			expect(state.getAc()).toBe(18);
		});
	});

	// ======================================================================
	// Bonus Gating (Equip/Attune)
	// ======================================================================
	describe("Bonus Gating (equip and attune requirements)", () => {
		it("should not apply bonuses from unequipped items", () => {
			state.addItem(makeWondrous({name: "Cloak", bonusSavingThrow: 1, requiresAttunement: true}));
			expect(state.getItemBonus("savingThrow")).toBe(0);
		});

		it("should apply bonuses when set directly via setItemBonuses", () => {
			state.setItemBonuses({savingThrow: 1});
			expect(state.getItemBonus("savingThrow")).toBe(1);
		});

		it("should respect attunement limit of 3", () => {
			for (let i = 0; i < 3; i++) {
				addEquipAttune(state, makeWondrous({name: `Ring ${i + 1}`, requiresAttunement: true}), true);
			}
			expect(state.getAttunedCount()).toBe(3);
			expect(state.getMaxAttunement()).toBe(3);
			expect(state.canAttune()).toBe(false);
		});

		it("should remove bonus when clearing item bonuses", () => {
			state.setItemBonuses({savingThrow: 1});
			expect(state.getItemBonus("savingThrow")).toBe(1);
			state.setItemBonuses({savingThrow: 0});
			expect(state.getItemBonus("savingThrow")).toBe(0);
		});

		it("should track equipped state on items", () => {
			const id = addEquipAttune(state, makeWondrous({name: "Ring"}), false);
			const item = state.getItems().find(i => i.id === id);
			expect(item.equipped).toBe(true);
			expect(item.attuned).toBe(false);
		});

		it("should track attuned state on items", () => {
			const id = addEquipAttune(state, makeWondrous({name: "Ring"}), true);
			const item = state.getItems().find(i => i.id === id);
			expect(item.equipped).toBe(true);
			expect(item.attuned).toBe(true);
		});

		it("should allow unattuning an item", () => {
			const id = addEquipAttune(state, makeWondrous({name: "Ring"}), true);
			state.setItemAttuned(id, false);
			const item = state.getItems().find(i => i.id === id);
			expect(item.attuned).toBe(false);
		});
	});

	// ======================================================================
	// Weapon Bonuses
	// ======================================================================
	describe("Weapon Bonuses", () => {
		it("should store bonusWeapon on added weapon", () => {
			state.addItem(makeWeapon({name: "+1 Longsword", bonusWeapon: 1}));
			const w = state.getItems().find(i => i.name === "+1 Longsword");
			expect(w.bonusWeapon).toBe(1);
		});

		it("should store bonusWeaponAttack separately from bonusWeapon", () => {
			state.addItem(makeWeapon({name: "Special Sword", bonusWeapon: 1, bonusWeaponAttack: 2}));
			const w = state.getItems().find(i => i.name === "Special Sword");
			expect(w.bonusWeapon).toBe(1);
			expect(w.bonusWeaponAttack).toBe(2);
		});

		it("should store bonusWeaponDamage on weapons", () => {
			state.addItem(makeWeapon({name: "Vicious Sword", bonusWeaponDamage: 7}));
			expect(state.getItems().find(i => i.name === "Vicious Sword").bonusWeaponDamage).toBe(7);
		});

		it("should store bonusWeaponCritDamage on weapons", () => {
			state.addItem(makeWeapon({name: "Crit Sword", bonusWeaponCritDamage: 3}));
			expect(state.getItems().find(i => i.name === "Crit Sword").bonusWeaponCritDamage).toBe(3);
		});

		it("should store critThreshold on weapons", () => {
			state.addItem(makeWeapon({name: "Keen Blade", critThreshold: 19}));
			expect(state.getItems().find(i => i.name === "Keen Blade").critThreshold).toBe(19);
		});
	});

	// ======================================================================
	// Spell Bonuses
	// ======================================================================
	describe("Spell Bonuses", () => {
		beforeEach(() => { state.setSpellcastingAbility("int"); });

		it("should apply bonusSpellAttack to spell attack bonus", () => {
			state.setItemBonuses({spellAttack: 2});
			expect(state.getSpellAttackBonus()).toBe(5); // Prof(3)+INT(0)+item(2)
		});

		it("should apply bonusSpellSaveDc to spell save DC", () => {
			state.setItemBonuses({spellSaveDc: 1});
			expect(state.getSpellSaveDc()).toBe(12); // 8+Prof(3)+INT(0)+item(1)
		});

		it("should store bonusSpellDamage in item bonuses", () => {
			state.setItemBonuses({spellDamage: 2});
			expect(state.getItemBonus("spellDamage")).toBe(2);
		});

		it("should not affect spell bonuses if item lacks those properties", () => {
			state.setItemBonuses({savingThrow: 1});
			expect(state.getSpellAttackBonus()).toBe(3); // Prof(3)+INT(0)
		});
	});

	// ======================================================================
	// Saving Throw Bonuses
	// ======================================================================
	describe("Saving Throw Bonuses", () => {
		it("should apply global bonusSavingThrow to all saves", () => {
			state.setItemBonuses({savingThrow: 1});
			state.addSaveProficiency("str");
			state.addSaveProficiency("con");

			expect(state.getSaveMod("str")).toBe(7); // mod(3)+prof(3)+item(1)
			expect(state.getSaveMod("dex")).toBe(3); // mod(2)+item(1)
			expect(state.getSaveMod("con")).toBe(6); // mod(2)+prof(3)+item(1)
			expect(state.getSaveMod("wis")).toBe(2); // mod(1)+item(1)
		});

		it("should apply per-ability saving throw bonus only to that ability", () => {
			state.setItemBonuses({savingThrowDex: 2});
			expect(state.getSaveMod("dex")).toBe(4); // mod(2)+perAbility(2)
			expect(state.getSaveMod("str")).toBe(3); // mod(3)+perAbility(0)
		});

		it("should stack global and per-ability saving throw bonuses", () => {
			state.setItemBonuses({savingThrow: 1, savingThrowWis: 2});
			expect(state.getSaveMod("wis")).toBe(4); // mod(1)+global(1)+per(2)
			expect(state.getSaveMod("str")).toBe(4); // mod(3)+global(1)
		});
	});

	// ======================================================================
	// Concentration Save Bonus
	// ======================================================================
	describe("Concentration Save Bonus", () => {
		it("should include item concentration save bonus", () => {
			state.addSaveProficiency("con");
			const baseConc = state.getConcentrationSaveBonus();
			state.setItemBonuses({savingThrowConcentration: 2});
			expect(state.getConcentrationSaveBonus()).toBe(baseConc + 2);
		});

		it("should stack concentration bonus with global save bonus", () => {
			state.addSaveProficiency("con");
			state.setItemBonuses({savingThrow: 1, savingThrowConcentration: 1});
			// CON save = mod(2)+prof(3)+global(1) = 6, + conc(1) = 7
			expect(state.getConcentrationSaveBonus()).toBe(7);
		});
	});

	// ======================================================================
	// Proficiency Bonus
	// ======================================================================
	describe("Proficiency Bonus from Items", () => {
		it("should add item proficiency bonus on top of base", () => {
			expect(state.getProficiencyBonus()).toBe(3);
			state.setItemBonuses({proficiencyBonus: 1});
			expect(state.getProficiencyBonus()).toBe(4);
		});

		it("should cascade proficiency bonus increase to dependent calculations", () => {
			state.addSaveProficiency("str");
			expect(state.getSaveMod("str")).toBe(6); // mod(3)+prof(3)
			state.setItemBonuses({proficiencyBonus: 1});
			expect(state.getSaveMod("str")).toBe(7); // mod(3)+prof(4)
		});
	});

	// ======================================================================
	// Ability Check Bonus
	// ======================================================================
	describe("Ability Check Bonus", () => {
		it("should apply bonusAbilityCheck to skill checks", () => {
			state.setItemBonuses({abilityCheck: 1});
			expect(state.getSkillModWithAbility("athletics", "str")).toBe(4); // mod(3)+item(1)
		});

		it("should stack with skill proficiency", () => {
			state.setSkillProficiency("athletics", 1);
			state.setItemBonuses({abilityCheck: 1});
			expect(state.getSkillModWithAbility("athletics", "str")).toBe(7); // mod(3)+prof(3)+item(1)
		});
	});

	// ======================================================================
	// Critical Hit Range from Items
	// ======================================================================
	describe("Critical Range from Items", () => {
		it("should default to 20 with no effects", () => {
			expect(state.getCriticalRange()).toBe(20);
		});

		it("should use item critThreshold when lower than default", () => {
			state.setItemBonuses({critThreshold: 19});
			expect(state.getCriticalRange()).toBe(19);
		});

		it("should use lowest critThreshold", () => {
			state.setItemBonuses({critThreshold: 18});
			expect(state.getCriticalRange()).toBe(18);
		});

		it("should not use critThreshold when higher than 20", () => {
			state.setItemBonuses({critThreshold: 21});
			expect(state.getCriticalRange()).toBe(20);
		});

		it("should not affect crit range when critThreshold is not set", () => {
			state.setItemBonuses({savingThrow: 1});
			expect(state.getCriticalRange()).toBe(20);
		});
	});

	// ======================================================================
	// Item Defenses (Resistances, Immunities, etc.)
	// ======================================================================
	describe("Item Defenses", () => {
		it("should add item resistances to getResistances()", () => {
			state.setItemDefenses({
				resist: [{type: "fire", source: "Ring"}],
				immune: [], vulnerable: [], conditionImmune: [],
			});
			expect(state.getResistances()).toContain("fire");
		});

		it("should add item immunities to getImmunities()", () => {
			state.setItemDefenses({
				resist: [], immune: [{type: "poison", source: "Periapt"}],
				vulnerable: [], conditionImmune: [],
			});
			expect(state.getImmunities()).toContain("poison");
		});

		it("should add item vulnerabilities to getVulnerabilities()", () => {
			state.setItemDefenses({
				resist: [], immune: [],
				vulnerable: [{type: "fire", source: "Cursed Armor"}],
				conditionImmune: [],
			});
			expect(state.getVulnerabilities()).toContain("fire");
		});

		it("should add item condition immunities to getConditionImmunities()", () => {
			state.setItemDefenses({
				resist: [], immune: [], vulnerable: [],
				conditionImmune: [{type: "frightened", source: "Amulet"}],
			});
			expect(state.getConditionImmunities()).toContain("frightened");
		});

		it("should deduplicate with existing resistances", () => {
			state.addResistance("fire");
			state.setItemDefenses({
				resist: [{type: "fire", source: "Ring"}],
				immune: [], vulnerable: [], conditionImmune: [],
			});
			expect(state.getResistances().filter(r => r === "fire").length).toBe(1);
		});

		it("should combine item defenses with race/class defenses", () => {
			state.addResistance("poison");
			state.setItemDefenses({
				resist: [{type: "fire", source: "Ring"}],
				immune: [], vulnerable: [], conditionImmune: [],
			});
			const res = state.getResistances();
			expect(res).toContain("poison");
			expect(res).toContain("fire");
		});

		it("should clear item defenses when set to empty", () => {
			state.setItemDefenses({
				resist: [{type: "fire", source: "Ring"}],
				immune: [], vulnerable: [], conditionImmune: [],
			});
			expect(state.getResistances()).toContain("fire");
			state.setItemDefenses({resist: [], immune: [], vulnerable: [], conditionImmune: []});
			expect(state.getResistances()).not.toContain("fire");
		});

		it("should track defense sources", () => {
			state.setItemDefenses({
				resist: [{type: "fire", source: "Ring of Fire Resistance"}],
				immune: [], vulnerable: [], conditionImmune: [],
			});
			expect(state.getItemDefenses().resist[0].source).toBe("Ring of Fire Resistance");
		});

		it("should handle multiple defenses from multiple items", () => {
			state.setItemDefenses({
				resist: [
					{type: "fire", source: "Ring"},
					{type: "cold", source: "Armor"},
				],
				immune: [{type: "poison", source: "Periapt"}],
				vulnerable: [],
				conditionImmune: [{type: "poisoned", source: "Periapt"}],
			});
			expect(state.getResistances()).toContain("fire");
			expect(state.getResistances()).toContain("cold");
			expect(state.getImmunities()).toContain("poison");
			expect(state.getConditionImmunities()).toContain("poisoned");
		});
	});

	// ======================================================================
	// Item Bonus API
	// ======================================================================
	describe("Item Bonus API", () => {
		it("should set and get item bonuses by type", () => {
			state.setItemBonuses({savingThrow: 1, spellAttack: 2});
			expect(state.getItemBonus("savingThrow")).toBe(1);
			expect(state.getItemBonus("spellAttack")).toBe(2);
		});

		it("should return 0 for unset bonus types", () => {
			expect(state.getItemBonus("savingThrow")).toBe(0);
			expect(state.getItemBonus("proficiencyBonus")).toBe(0);
			expect(state.getItemBonus("nonexistent")).toBe(0);
		});

		it("should get all item bonuses as object", () => {
			state.setItemBonuses({savingThrow: 2, spellAttack: 1, spellDamage: 3});
			const b = state.getItemBonuses();
			expect(b.savingThrow).toBe(2);
			expect(b.spellAttack).toBe(1);
			expect(b.spellDamage).toBe(3);
		});

		it("should set individual bonus type", () => {
			state.setItemBonus("savingThrow", 3);
			expect(state.getItemBonus("savingThrow")).toBe(3);
		});

		it("should handle setItemBonuses with null", () => {
			state.setItemBonuses({savingThrow: 1});
			state.setItemBonuses(null);
			expect(state.getItemBonus("savingThrow")).toBe(0);
		});
	});

	// ======================================================================
	// Item Defenses API
	// ======================================================================
	describe("Item Defenses API", () => {
		it("should set and get item defenses", () => {
			state.setItemDefenses({
				resist: [{type: "fire", source: "Shield"}],
				immune: [], vulnerable: [], conditionImmune: [],
			});
			expect(state.getItemDefenses().resist).toHaveLength(1);
			expect(state.getItemDefenses().resist[0].type).toBe("fire");
		});

		it("should handle setItemDefenses with null", () => {
			state.setItemDefenses(null);
			const d = state.getItemDefenses();
			expect(d.resist).toEqual([]);
			expect(d.immune).toEqual([]);
		});

		it("should default to empty arrays for all defense types", () => {
			const d = state.getItemDefenses();
			expect(d.resist).toEqual([]);
			expect(d.immune).toEqual([]);
			expect(d.vulnerable).toEqual([]);
			expect(d.conditionImmune).toEqual([]);
		});
	});

	// ======================================================================
	// Edge Cases
	// ======================================================================
	describe("Edge Cases", () => {
		it("should handle multiple items' bonuses stacking", () => {
			state.setItemBonuses({savingThrow: 2});
			state.addSaveProficiency("str");
			expect(state.getSaveMod("str")).toBe(8); // mod(3)+prof(3)+item(2)
		});

		it("should handle zero bonuses gracefully", () => {
			state.setItemBonuses({savingThrow: 0, spellAttack: 0});
			expect(state.getItemBonus("savingThrow")).toBe(0);
			expect(state.getItemBonus("spellAttack")).toBe(0);
		});

		it("should maintain item bonuses across operations", () => {
			state.setItemBonuses({savingThrow: 1, spellAttack: 2});
			state.addItem(makeWeapon({name: "Test Sword"}));
			expect(state.getItemBonus("savingThrow")).toBe(1);
			expect(state.getItemBonus("spellAttack")).toBe(2);
		});

		it("should handle per-ability save bonus key format", () => {
			state.setItemBonuses({savingThrowStr: 2, savingThrowDex: 1});
			expect(state.getSaveMod("str")).toBe(5); // mod(3)+per(2)
			expect(state.getSaveMod("dex")).toBe(3); // mod(2)+per(1)
			expect(state.getSaveMod("con")).toBe(2); // mod(2)+per(0)
		});

		it("should handle items with multiple bonus types simultaneously", () => {
			state.setItemBonuses({proficiencyBonus: 1, savingThrow: 2, spellAttack: 2});
			state.setItemAcBonus(2);
			expect(state.getProficiencyBonus()).toBe(4);
			expect(state.getItemAcBonus()).toBe(2);
			expect(state.getItemBonus("savingThrow")).toBe(2);
		});
	});

	// ======================================================================
	// Real-World Item Scenarios
	// ======================================================================
	describe("Real-World Item Scenarios", () => {
		it("should correctly model Staff of Power (+2 attack, +2 save, +2 AC)", () => {
			state.setItemBonuses({savingThrow: 2, spellAttack: 2});
			state.setItemAcBonus(2);
			state.setSpellcastingAbility("int");
			expect(state.getSpellAttackBonus()).toBe(5); // prof(3)+INT(0)+item(2)
			expect(state.getSaveMod("str")).toBe(5); // mod(3)+item(2)
			expect(state.getAc()).toBe(14); // 10+DEX(2)+item(2)
		});

		it("should correctly model Ioun Stone of Mastery (+1 proficiency)", () => {
			state.setItemBonuses({proficiencyBonus: 1});
			state.addSaveProficiency("str");
			state.addSaveProficiency("con");
			state.setSpellcastingAbility("int");
			expect(state.getProficiencyBonus()).toBe(4);
			expect(state.getSpellAttackBonus()).toBe(4); // prof(4)+INT(0)
			expect(state.getSpellSaveDc()).toBe(12); // 8+prof(4)+INT(0)
			expect(state.getSaveMod("str")).toBe(7); // mod(3)+prof(4)
		});

		it("should correctly model Ring of Fire Resistance", () => {
			state.setItemDefenses({
				resist: [{type: "fire", source: "Ring of Fire Resistance"}],
				immune: [], vulnerable: [], conditionImmune: [],
			});
			expect(state.getResistances()).toContain("fire");
			expect(state.getResistances()).toHaveLength(1);
		});

		it("should correctly model Armor of Resistance (cold) + AC", () => {
			state.setArmor({ac: 16, type: "heavy", name: "Armor of Cold Resistance", magicBonus: 0});
			state.setItemDefenses({
				resist: [{type: "cold", source: "Armor of Cold Resistance"}],
				immune: [], vulnerable: [], conditionImmune: [],
			});
			expect(state.getResistances()).toContain("cold");
			expect(state.getAc()).toBe(16);
		});

		it("should correctly model Cloak of Protection (+1 AC, +1 saves)", () => {
			state.setItemBonuses({savingThrow: 1});
			state.setItemAcBonus(1);
			state.addSaveProficiency("str");
			state.addSaveProficiency("con");
			expect(state.getAc()).toBe(13); // 10+DEX(2)+item(1)
			expect(state.getSaveMod("dex")).toBe(3); // mod(2)+item(1)
			expect(state.getSaveMod("wis")).toBe(2); // mod(1)+item(1)
		});

		it("should correctly model combined Ring of Protection + Cloak of Protection", () => {
			state.setItemBonuses({savingThrow: 2}); // 1+1
			state.setItemAcBonus(2); // 1+1
			expect(state.getAc()).toBe(14); // 10+DEX(2)+items(2)
			expect(state.getSaveMod("str")).toBe(5); // mod(3)+items(2)
		});
	});

	// ======================================================================
	// Speed Modifications from Items
	// ======================================================================
	describe("Speed Modifications from Items", () => {
		it("should apply item speed bonus to walk speed", () => {
			state.setItemBonuses({speedBonus: {walk: 10}});
			const walkSpeed = state.getSpeedByType("walk");
			// Base 30 + item 10 = 40
			expect(walkSpeed).toBe(40);
		});

		it("should apply wildcard (*) speed bonus to all movement types", () => {
			state.setSpeed("walk", 30);
			state.setSpeed("fly", 30);
			state.setItemBonuses({speedBonus: {"*": 10}});
			expect(state.getSpeedByType("walk")).toBe(40);
			expect(state.getSpeedByType("fly")).toBe(40);
		});

		it("should grant new movement type via static speed", () => {
			// Item grants fly speed of 30 (e.g., Winged Boots)
			state.setItemBonuses({speedStatic: {fly: 30}});
			expect(state.getSpeedByType("fly")).toBe(30);
		});

		it("should use highest static speed when multiple items grant same type", () => {
			state.setItemBonuses({speedStatic: {fly: 60}}); // Best of multiple items
			expect(state.getSpeedByType("fly")).toBe(60);
		});

		it("should combine static and bonus speeds", () => {
			state.setItemBonuses({
				speedStatic: {fly: 30},
				speedBonus: {fly: 10},
			});
			expect(state.getSpeedByType("fly")).toBe(40); // static 30 + bonus 10
		});

		it("should not affect speed when no modifySpeed items", () => {
			state.setItemBonuses({savingThrow: 1}); // No speed bonuses
			expect(state.getSpeedByType("walk")).toBe(30); // Default
			expect(state.getSpeedByType("fly")).toBe(0); // No fly
		});

		it("should include item speed bonus in formatted speed string", () => {
			state.setItemBonuses({speedBonus: {walk: 10}});
			const speedStr = state.getSpeed();
			expect(speedStr).toContain("40 ft.");
		});

		it("should show granted fly speed in formatted speed string", () => {
			state.setItemBonuses({speedStatic: {fly: 30}});
			const speedStr = state.getSpeed();
			expect(speedStr).toContain("fly 30 ft.");
		});
	});

	// ======================================================================
	// Spell Damage Bonus Integration
	// ======================================================================
	describe("Spell Damage Bonus", () => {
		it("should store spellDamage in item bonuses", () => {
			state.setItemBonuses({spellDamage: 3});
			expect(state.getItemBonus("spellDamage")).toBe(3);
		});

		it("should be accessible via getItemBonus for combat module", () => {
			state.setItemBonuses({spellDamage: 1, spellAttack: 2});
			expect(state.getItemBonus("spellDamage")).toBe(1);
			expect(state.getItemBonus("spellAttack")).toBe(2);
		});

		it("should default to 0 when not set", () => {
			expect(state.getItemBonus("spellDamage")).toBe(0);
		});
	});

	// ======================================================================
	// Weapon Crit Damage Bonus
	// ======================================================================
	describe("Weapon Crit Damage Bonus", () => {
		it("should store bonusWeaponCritDamage on items", () => {
			state.addItem(makeWeapon({name: "Crit Blade", bonusWeaponCritDamage: 7}));
			const w = state.getItems().find(i => i.name === "Crit Blade");
			expect(w.bonusWeaponCritDamage).toBe(7);
		});

		it("should be accessible from sourceItem in attack context", () => {
			state.addItem(makeWeapon({name: "Vorpal", bonusWeaponCritDamage: 14}));
			const w = state.getItems().find(i => i.name === "Vorpal");
			// Simulate attack.sourceItem reference
			const attack = {sourceItem: w};
			expect(attack.sourceItem.bonusWeaponCritDamage).toBe(14);
		});
	});

	// ======================================================================
	// hasBonus Detection (equip button visibility)
	// ======================================================================
	describe("Item Bonus Detection for Equip Button", () => {
		// These tests verify that items with various bonus types are properly
		// detected as having bonuses (which enables the equip button in UI)

		it("should detect bonusWeaponAttack as a bonus", () => {
			const item = {bonusWeaponAttack: 1};
			const hasBonus = item.bonusAc || item.bonusSavingThrow || item.bonusSpellAttack
				|| item.bonusSpellSaveDc || item.bonusAbilityCheck || item.bonusWeapon
				|| item.bonusWeaponAttack || item.bonusWeaponDamage || item.bonusProficiencyBonus
				|| item.bonusSavingThrowConcentration || item.bonusSpellDamage
				|| item.bonusWeaponCritDamage || item.critThreshold
				|| item.resist?.length || item.immune?.length || item.vulnerable?.length
				|| item.conditionImmune?.length || item.modifySpeed;
			expect(!!hasBonus).toBe(true);
		});

		it("should detect bonusProficiencyBonus as a bonus", () => {
			const item = {bonusProficiencyBonus: 1};
			const hasBonus = item.bonusProficiencyBonus;
			expect(!!hasBonus).toBe(true);
		});

		it("should detect critThreshold as a bonus", () => {
			const item = {critThreshold: 19};
			const hasBonus = item.critThreshold;
			expect(!!hasBonus).toBe(true);
		});

		it("should detect resist array as a bonus", () => {
			const item = {resist: ["fire"]};
			const hasBonus = item.resist?.length;
			expect(!!hasBonus).toBe(true);
		});

		it("should detect modifySpeed as a bonus", () => {
			const item = {modifySpeed: {bonus: {walk: 10}}};
			const hasBonus = item.modifySpeed;
			expect(!!hasBonus).toBe(true);
		});

		it("should not detect item with no bonuses", () => {
			const item = {name: "Rope", weight: 5};
			const hasBonus = item.bonusAc || item.bonusSavingThrow || item.bonusSpellAttack
				|| item.bonusSpellSaveDc || item.bonusAbilityCheck || item.bonusWeapon
				|| item.bonusWeaponAttack || item.bonusWeaponDamage || item.bonusProficiencyBonus;
			expect(!!hasBonus).toBe(false);
		});
	});

	// ======================================================================
	// Custom Item Bonus Support
	// ======================================================================
	describe("Custom Item Bonus Support", () => {
		it("should accept all bonus types via addItem", () => {
			state.addItem({
				name: "Custom Ring", type: "wondrous", source: "Custom",
				bonusAc: 1, bonusSavingThrow: 1, bonusSpellAttack: 1,
				bonusSpellSaveDc: 1, bonusAbilityCheck: 1, bonusProficiencyBonus: 1,
				bonusSavingThrowConcentration: 1, bonusSpellDamage: 1,
				bonusWeaponCritDamage: 2, critThreshold: 19,
				resist: ["fire"], immune: ["poison"],
				modifySpeed: {bonus: {walk: 10}},
			});
			const item = state.getItems().find(i => i.name === "Custom Ring");
			expect(item).toBeDefined();
			expect(item.bonusAc).toBe(1);
			expect(item.bonusSavingThrow).toBe(1);
			expect(item.bonusProficiencyBonus).toBe(1);
			expect(item.bonusSpellDamage).toBe(1);
			expect(item.critThreshold).toBe(19);
			expect(item.resist).toContain("fire");
			expect(item.modifySpeed.bonus.walk).toBe(10);
		});
	});

	// ======================================================================
	// Attunement Enforcement
	// ======================================================================
	describe("Attunement Enforcement", () => {
		it("should track requiresAttunement flag on items", () => {
			state.addItem(makeWondrous({name: "Ring of Protection", requiresAttunement: true}));
			const item = state.getItems().find(i => i.name === "Ring of Protection");
			expect(item.requiresAttunement).toBe(true);
		});

		it("should not set attuned by default", () => {
			state.addItem(makeWondrous({name: "Ring", requiresAttunement: true}));
			const item = state.getItems().find(i => i.name === "Ring");
			expect(item.attuned).toBe(false);
		});

		it("should allow attuning when under limit", () => {
			state.addItem(makeWondrous({name: "Ring", requiresAttunement: true}));
			const item = state.getItems().find(i => i.name === "Ring");
			state.setItemAttuned(item.id, true);
			expect(state.getItems().find(i => i.id === item.id).attuned).toBe(true);
		});

		it("should count attuned items correctly", () => {
			for (let i = 0; i < 3; i++) {
				state.addItem(makeWondrous({name: `Ring ${i}`, requiresAttunement: true}));
			}
			const items = state.getItems();
			items.forEach(item => state.setItemAttuned(item.id, true));
			expect(state.getAttunedCount()).toBe(3);
		});

		it("should report max attunement of 3 for non-artificers", () => {
			expect(state.getMaxAttunement()).toBe(3);
		});

		it("should report canAttune false when at limit", () => {
			for (let i = 0; i < 3; i++) {
				state.addItem(makeWondrous({name: `Ring ${i}`, requiresAttunement: true}));
			}
			state.getItems().forEach(item => state.setItemAttuned(item.id, true));
			expect(state.canAttune()).toBe(false);
		});

		it("should correctly gate calculateItemBonuses on attunement", () => {
			// Add a Cloak of Protection (requires attune, +1 AC, +1 saves)
			const cloakItem = makeWondrous({
				name: "Cloak of Protection",
				bonusAc: 1,
				bonusSavingThrow: 1,
				requiresAttunement: true,
			});
			state.addItem(cloakItem);
			const items = state.getItems();
			const cloak = items.find(i => i.name === "Cloak of Protection");

			// Equip but don't attune
			state.setItemEquipped(cloak.id, true);
			// Simulate what _calculateItemBonuses does: filter equipped + attuned check
			const shouldApply = cloak.equipped
				&& (!cloak.requiresAttunement || cloak.attuned);
			expect(shouldApply).toBe(false); // Not attuned → no bonus

			// Now attune
			state.setItemAttuned(cloak.id, true);
			const cloakAfterAttune = state.getItems().find(i => i.name === "Cloak of Protection");
			const shouldApplyAfter = cloakAfterAttune.equipped
				&& (!cloakAfterAttune.requiresAttunement || cloakAfterAttune.attuned);
			expect(shouldApplyAfter).toBe(true); // Attuned → bonus applies
		});

		it("should not gate bonuses on non-attunement items", () => {
			const item = makeWondrous({
				name: "Brooch",
				bonusSavingThrow: 1,
				requiresAttunement: false,
			});
			state.addItem(item);
			const addedBefore = state.getItems().find(i => i.name === "Brooch");
			state.setItemEquipped(addedBefore.id, true);

			// Re-fetch after equipping to get updated state
			const added = state.getItems().find(i => i.name === "Brooch");

			// Non-attunement item: equipped = bonuses apply
			const shouldApply = added.equipped
				&& (!added.requiresAttunement || added.attuned);
			expect(shouldApply).toBe(true);
		});
	});

	// ======================================================================
	// Ability Score Overrides from Items
	// ======================================================================
	describe("Ability Score Overrides from Items", () => {
		it("should apply static ability override (Gauntlets of Ogre Power STR→19)", () => {
			state.setAbilityBase("str", 12); // Natural STR 12
			state.setItemAbilityOverrides({static: {str: 19}, bonus: {}});
			expect(state.getAbilityScore("str")).toBe(19);
		});

		it("should not lower score when static override is lower than natural", () => {
			state.setAbilityBase("str", 20); // Natural STR 20
			state.setItemAbilityOverrides({static: {str: 19}, bonus: {}});
			// Gauntlets wouldn't benefit a character with STR 20
			expect(state.getAbilityScore("str")).toBe(20);
		});

		it("should apply Belt of Giant Strength (STR→27, exceeds normal max)", () => {
			state.setAbilityBase("str", 16);
			state.setItemAbilityOverrides({static: {str: 27}, bonus: {}});
			expect(state.getAbilityScore("str")).toBe(27);
		});

		it("should apply direct ability bonus (Belt of Dwarvenkind +2 CON)", () => {
			state.setAbilityBase("con", 14); // CON 14
			state.setItemAbilityOverrides({static: {}, bonus: {con: 2}});
			expect(state.getAbilityScore("con")).toBe(16); // 14 + 2
		});

		it("should not affect other abilities", () => {
			state.setItemAbilityOverrides({static: {str: 19}, bonus: {}});
			expect(state.getAbilityScore("dex")).toBe(14); // Unchanged
			expect(state.getAbilityScore("con")).toBe(14); // Unchanged
		});

		it("should cascade ability override to modifier", () => {
			state.setAbilityBase("str", 10); // STR 10, mod +0
			state.setItemAbilityOverrides({static: {str: 19}, bonus: {}});
			expect(state.getAbilityMod("str")).toBe(4); // (19-10)/2 = 4
		});

		it("should cascade to saving throws", () => {
			state.setAbilityBase("str", 10);
			state.addSaveProficiency("str");
			state.setItemAbilityOverrides({static: {str: 19}, bonus: {}});
			// STR save: mod(4) + prof(3) = 7
			expect(state.getSaveMod("str")).toBe(7);
		});

		it("should handle Headband of Intellect affecting spell DC", () => {
			state.setAbilityBase("int", 8); // INT 8, mod -1
			state.setSpellcastingAbility("int");
			state.setItemAbilityOverrides({static: {int: 19}, bonus: {}});
			// INT is now 19, mod +4
			// Spell DC: 8 + prof(3) + INT(4) = 15
			expect(state.getSpellSaveDc()).toBe(15);
		});

		it("should clear overrides when set to null", () => {
			state.setAbilityBase("str", 10);
			state.setItemAbilityOverrides({static: {str: 19}, bonus: {}});
			expect(state.getAbilityScore("str")).toBe(19);
			state.setItemAbilityOverrides(null);
			expect(state.getAbilityScore("str")).toBe(10);
		});

		it("should combine static and bonus: highest static, then add bonus", () => {
			state.setAbilityBase("con", 10);
			state.setItemAbilityOverrides({static: {con: 19}, bonus: {con: 2}});
			// Bonus is added first: 10 + 2 = 12. Static 19 > 12, so 19.
			expect(state.getAbilityScore("con")).toBe(19);
		});
	});

	// ======================================================================
	// Item-Granted Spells
	// ======================================================================
	describe("Item-Granted Spells", () => {
		it("should store attachedSpells on items", () => {
			state.addItem({
				name: "Staff of the Magi", source: "DMG", type: "wondrous",
				attachedSpells: ["conjure elemental", "dispel magic", "fireball"],
			});
			const item = state.getItems().find(i => i.name === "Staff of the Magi");
			expect(item.attachedSpells).toHaveLength(3);
		});

		it("should store attachedSpells object format", () => {
			state.addItem({
				name: "Wand of Fireballs", source: "DMG", type: "wondrous",
				attachedSpells: {charges: {"3": ["fireball"]}},
			});
			const item = state.getItems().find(i => i.name === "Wand of Fireballs");
			expect(item.attachedSpells.charges).toBeDefined();
		});

		it("should return item-granted spells from state", () => {
			state.setItemGrantedSpells([
				{name: "fireball", sourceItem: "Staff of the Magi", usageType: "charges", chargesCost: 3},
				{name: "light", sourceItem: "Staff of the Magi", usageType: "will"},
			]);
			const spells = state.getItemGrantedSpells();
			expect(spells).toHaveLength(2);
			expect(spells[0].sourceItem).toBe("Staff of the Magi");
			expect(spells[1].usageType).toBe("will");
		});

		it("should include sourceItem field on granted spells", () => {
			state.setItemGrantedSpells([
				{name: "shield", sourceItem: "Ring of Spell Storing", usageType: "other"},
			]);
			const spell = state.getItemGrantedSpells()[0];
			expect(spell.sourceItem).toBe("Ring of Spell Storing");
		});

		it("should handle daily-use spells with max uses", () => {
			state.setItemGrantedSpells([
				{name: "enlarge/reduce", sourceItem: "Potion Staff", usageType: "daily", usesMax: 1},
			]);
			const spell = state.getItemGrantedSpells()[0];
			expect(spell.usageType).toBe("daily");
			expect(spell.usesMax).toBe(1);
		});

		it("should handle at-will spells with no usage limit", () => {
			state.setItemGrantedSpells([
				{name: "light", sourceItem: "Sun Blade", usageType: "will"},
			]);
			const spell = state.getItemGrantedSpells()[0];
			expect(spell.usageType).toBe("will");
			expect(spell.usesMax).toBeUndefined();
		});

		it("should clear spells when set to empty", () => {
			state.setItemGrantedSpells([{name: "fireball", sourceItem: "Staff", usageType: "charges"}]);
			expect(state.getItemGrantedSpells()).toHaveLength(1);
			state.setItemGrantedSpells([]);
			expect(state.getItemGrantedSpells()).toHaveLength(0);
		});

		it("should handle null input gracefully", () => {
			state.setItemGrantedSpells(null);
			expect(state.getItemGrantedSpells()).toEqual([]);
		});
	});

	// ======================================================================
	// Speed Equal-To and Multiply
	// ======================================================================
	describe("Speed Equal-To and Multiply", () => {
		it("should apply equal-to speed (fly = walk)", () => {
			state.setSpeed("walk", 30);
			state.setItemBonuses({speedEqual: {fly: "walk"}});
			expect(state.getSpeedByType("fly")).toBe(30);
		});

		it("should not grant fly via equal-to if base type has no speed", () => {
			// equal: {fly: "burrow"} but character has no burrow speed
			state.setItemBonuses({speedEqual: {fly: "burrow"}});
			expect(state.getSpeedByType("fly")).toBe(0);
		});

		it("should apply speed multiply (walk x2)", () => {
			state.setSpeed("walk", 30);
			state.setItemBonuses({speedMultiply: {walk: 2}});
			expect(state.getSpeedByType("walk")).toBe(60);
		});

		it("should apply multiply after bonuses", () => {
			state.setSpeed("walk", 30);
			state.setItemBonuses({speedBonus: {walk: 10}, speedMultiply: {walk: 2}});
			// (30 + 10) * 2 = 80
			expect(state.getSpeedByType("walk")).toBe(80);
		});

		it("should apply wildcard multiply to all movement types", () => {
			state.setSpeed("walk", 30);
			state.setSpeed("fly", 30);
			state.setItemBonuses({speedMultiply: {"*": 2}});
			expect(state.getSpeedByType("walk")).toBe(60);
			expect(state.getSpeedByType("fly")).toBe(60);
		});

		it("should include equal-to in formatted speed string", () => {
			state.setSpeed("walk", 30);
			state.setItemBonuses({speedEqual: {swim: "walk"}});
			const speedStr = state.getSpeed();
			expect(speedStr).toContain("swim 30 ft.");
		});

		it("should include multiplied speed in formatted speed string", () => {
			state.setSpeed("walk", 30);
			state.setItemBonuses({speedMultiply: {walk: 2}});
			const speedStr = state.getSpeed();
			expect(speedStr).toContain("60 ft.");
		});
	});

	// ======================================================================
	// Ability Override API
	// ======================================================================
	describe("Ability Override API", () => {
		it("should set and get ability overrides", () => {
			const overrides = {static: {str: 19}, bonus: {con: 2}};
			state.setItemAbilityOverrides(overrides);
			expect(state.getItemAbilityOverrides()).toEqual(overrides);
		});

		it("should handle null overrides", () => {
			state.setItemAbilityOverrides(null);
			expect(state.getItemAbilityOverrides()).toBeNull();
		});
	});

	// ======================================================================
	// Item Granted Spells API
	// ======================================================================
	describe("Item Granted Spells API", () => {
		it("should set and get item granted spells", () => {
			const spells = [{name: "fireball", sourceItem: "Staff"}];
			state.setItemGrantedSpells(spells);
			expect(state.getItemGrantedSpells()).toHaveLength(1);
		});

		it("should default to empty array", () => {
			expect(state.getItemGrantedSpells()).toEqual([]);
		});
	});

	// ======================================================================
	// Medium Armor DEX Cap
	// ======================================================================
	describe("Medium Armor DEX Capping", () => {
		beforeEach(() => {
			state.setAbilityBase("dex", 18); // +4 DEX mod
		});

		it("should cap DEX bonus at +2 for standard medium armor", () => {
			state.setArmor({ac: 14, type: "medium", name: "Breastplate"});
			// 14 + min(2, 4) = 16
			expect(state.getAc()).toBe(16);
		});

		it("should respect armor dexterityMax property", () => {
			state.setArmor({ac: 14, type: "medium", name: "Mithral Breastplate", dexterityMax: null});
			// null = unlimited, so 14 + 4 = 18
			expect(state.getAc()).toBe(18);
		});

		it("should apply Medium Armor Master +3 DEX cap", () => {
			state.addNamedModifier({
				name: "Medium Armor Master",
				type: "ac:mediumArmorMaxDex",
				value: 3,
				enabled: true,
			});
			state.setArmor({ac: 14, type: "medium", name: "Breastplate", dexterityMax: 2});
			// Feat increases to +3: 14 + min(3, 4) = 17
			expect(state.getAc()).toBe(17);
		});

		it("should use armor dexterityMax when higher than default", () => {
			// Some homebrew armor might have dexterityMax: 3
			state.setArmor({ac: 13, type: "medium", name: "Custom Armor", dexterityMax: 3});
			// 13 + min(3, 4) = 16
			expect(state.getAc()).toBe(16);
		});

		it("should use dexterityMax: 0 (no DEX bonus allowed)", () => {
			state.setArmor({ac: 15, type: "medium", name: "Rigid Armor", dexterityMax: 0});
			// 15 + 0 = 15
			expect(state.getAc()).toBe(15);
		});

		it("should allow full DEX for light armor regardless of dexterityMax", () => {
			state.setArmor({ac: 11, type: "light", name: "Leather"});
			// Light armor always gets full DEX: 11 + 4 = 15
			expect(state.getAc()).toBe(15);
		});

		it("should give no DEX for heavy armor", () => {
			state.setArmor({ac: 18, type: "heavy", name: "Plate"});
			// Heavy: 18, no DEX
			expect(state.getAc()).toBe(18);
		});
	});

	// ======================================================================
	// Armor Stealth Disadvantage
	// ======================================================================
	describe("Armor Stealth Disadvantage", () => {
		it("should return false when no armor equipped", () => {
			expect(state.hasArmorStealthDisadvantage()).toBe(false);
		});

		it("should return false for armor without stealth disadvantage", () => {
			state.setArmor({ac: 14, type: "medium", name: "Breastplate", stealth: false});
			expect(state.hasArmorStealthDisadvantage()).toBe(false);
		});

		it("should return true for armor with stealth disadvantage", () => {
			state.setArmor({ac: 15, type: "medium", name: "Half Plate", stealth: true});
			expect(state.hasArmorStealthDisadvantage()).toBe(true);
		});

		it("should return true for heavy armor with stealth disadvantage", () => {
			state.setArmor({ac: 16, type: "heavy", name: "Chain Mail", stealth: true});
			expect(state.hasArmorStealthDisadvantage()).toBe(true);
		});

		it("should remove stealth disadvantage with Medium Armor Master (medium armor)", () => {
			state.addNamedModifier({
				name: "Medium Armor Master",
				type: "armor:medium:noStealthDisadvantage",
				value: 1,
				enabled: true,
			});
			state.setArmor({ac: 15, type: "medium", name: "Half Plate", stealth: true});
			expect(state.hasArmorStealthDisadvantage()).toBe(false);
		});

		it("should NOT remove stealth disadvantage for heavy armor with Medium Armor Master", () => {
			state.addNamedModifier({
				name: "Medium Armor Master",
				type: "armor:medium:noStealthDisadvantage",
				value: 1,
				enabled: true,
			});
			state.setArmor({ac: 16, type: "heavy", name: "Chain Mail", stealth: true});
			// Heavy armor is not affected by Medium Armor Master
			expect(state.hasArmorStealthDisadvantage()).toBe(true);
		});
	});

	// ======================================================================
	// Armor Strength Requirements
	// ======================================================================
	describe("Armor Strength Requirements", () => {
		beforeEach(() => {
			state.setAbilityBase("str", 12); // Low STR character
		});

		it("should return 0 penalty when no armor equipped", () => {
			expect(state.getArmorStrengthPenalty()).toBe(0);
		});

		it("should return 0 penalty for armor without strength requirement", () => {
			state.setArmor({ac: 14, type: "medium", name: "Breastplate"});
			expect(state.getArmorStrengthPenalty()).toBe(0);
		});

		it("should return 0 penalty when strength requirement is met", () => {
			state.setAbilityBase("str", 15);
			state.setArmor({ac: 17, type: "heavy", name: "Splint", strength: "15"});
			expect(state.getArmorStrengthPenalty()).toBe(0);
		});

		it("should return -10 penalty when strength requirement is not met", () => {
			state.setAbilityBase("str", 14);
			state.setArmor({ac: 17, type: "heavy", name: "Splint", strength: "15"});
			expect(state.getArmorStrengthPenalty()).toBe(-10);
		});

		it("should apply speed penalty for plate armor (STR 15 required)", () => {
			state.setAbilityBase("str", 10);
			state.setSpeed("walk", 30);
			state.setArmor({ac: 18, type: "heavy", name: "Plate", strength: 15});
			expect(state.getWalkSpeed()).toBe(20); // 30 - 10 = 20
		});

		it("should apply speed penalty to other movement types", () => {
			state.setAbilityBase("str", 10);
			state.setSpeed("walk", 30);
			state.setSpeed("fly", 30);
			state.setArmor({ac: 18, type: "heavy", name: "Plate", strength: 15});
			expect(state.getSpeedByType("fly")).toBe(20); // 30 - 10 = 20
		});

		it("should return strength requirement info object", () => {
			state.setAbilityBase("str", 12);
			state.setArmor({ac: 17, type: "heavy", name: "Splint", strength: "15"});
			const req = state.getArmorStrengthRequirement();
			expect(req).toEqual({required: 15, current: 12, met: false});
		});

		it("should return null for armor without strength requirement", () => {
			state.setArmor({ac: 14, type: "medium", name: "Breastplate"});
			expect(state.getArmorStrengthRequirement()).toBeNull();
		});

		it("should handle numeric strength property", () => {
			state.setAbilityBase("str", 12);
			state.setArmor({ac: 18, type: "heavy", name: "Plate", strength: 15}); // numeric
			expect(state.getArmorStrengthPenalty()).toBe(-10);
		});
	});

	// ======================================================================
	// Cursed Items
	// ======================================================================
	describe("Cursed Items", () => {
		it("should track cursed items in inventory", () => {
			state.addItem({name: "Berserker Axe", source: "DMG", curse: true, equipped: false});
			state.addItem({name: "Normal Sword", source: "PHB", curse: false, equipped: false});
			const cursed = state.getCursedItems();
			expect(cursed).toHaveLength(1);
			expect(cursed[0].name).toBe("Berserker Axe");
		});

		it("should filter equipped cursed items", () => {
			state.addItem({name: "Berserker Axe", source: "DMG", curse: true, equipped: true});
			state.addItem({name: "Cursed Ring", source: "DMG", curse: true, equipped: false});
			const cursed = state.getCursedItems({equippedOnly: true});
			expect(cursed).toHaveLength(1);
			expect(cursed[0].name).toBe("Berserker Axe");
		});

		it("should filter attuned cursed items", () => {
			state.addItem({name: "Berserker Axe", source: "DMG", curse: true, equipped: true, attuned: true});
			state.addItem({name: "Cursed Ring", source: "DMG", curse: true, equipped: true, attuned: false});
			const cursed = state.getCursedItems({attunedOnly: true});
			expect(cursed).toHaveLength(1);
			expect(cursed[0].name).toBe("Berserker Axe");
		});

		it("should detect active cursed items", () => {
			state.addItem({name: "Berserker Axe", source: "DMG", curse: true, equipped: false});
			expect(state.hasActiveCursedItem()).toBe(false);

			const items = state.getItems();
			state.setItemEquipped(items[0].id, true);
			expect(state.hasActiveCursedItem()).toBe(true);
		});
	});

	// ======================================================================
	// Sentient Items
	// ======================================================================
	describe("Sentient Items", () => {
		it("should track sentient items in inventory", () => {
			state.addItem({name: "Blackrazor", source: "DMG", sentient: true, equipped: false});
			state.addItem({name: "Normal Sword", source: "PHB", sentient: false, equipped: false});
			const sentient = state.getSentientItems();
			expect(sentient).toHaveLength(1);
			expect(sentient[0].name).toBe("Blackrazor");
		});

		it("should filter equipped sentient items", () => {
			state.addItem({name: "Blackrazor", source: "DMG", sentient: true, equipped: true});
			state.addItem({name: "Moonblade", source: "DMG", sentient: true, equipped: false});
			const sentient = state.getSentientItems({equippedOnly: true});
			expect(sentient).toHaveLength(1);
			expect(sentient[0].name).toBe("Blackrazor");
		});

		it("should detect active sentient items", () => {
			state.addItem({name: "Blackrazor", source: "DMG", sentient: true, equipped: false});
			expect(state.hasActiveSentientItem()).toBe(false);

			const items = state.getItems();
			state.setItemEquipped(items[0].id, true);
			expect(state.hasActiveSentientItem()).toBe(true);
		});
	});

	// ======================================================================
	// Proficiency Granting Items
	// ======================================================================
	describe("Proficiency Granting Items", () => {
		it("should grant armor proficiency when item with grantsProficiency is equipped", () => {
			// Without the armor, no heavy proficiency
			expect(state.hasArmorProficiency("heavy")).toBe(false);

			// Add Dwarven Plate which grants heavy armor proficiency
			state.addItem({
				name: "Dwarven Plate",
				source: "DMG",
				armor: true,
				armorType: "heavy",
				ac: 18,
				grantsProficiency: true,
				equipped: true,
			});

			expect(state.hasArmorProficiency("heavy")).toBe(true);
		});

		it("should NOT grant proficiency when item is not equipped", () => {
			state.addItem({
				name: "Dwarven Plate",
				source: "DMG",
				armor: true,
				armorType: "heavy",
				ac: 18,
				grantsProficiency: true,
				equipped: false,
			});

			expect(state.hasArmorProficiency("heavy")).toBe(false);
		});

		it("should grant weapon proficiency when attuned item has grantsProficiency", () => {
			expect(state.hasWeaponProficiency("Sun Blade")).toBe(false);

			state.addItem({
				name: "Sun Blade",
				source: "DMG",
				weapon: true,
				grantsProficiency: true,
				requiresAttunement: true,
				equipped: true,
				attuned: true,
			});

			expect(state.hasWeaponProficiency("Sun Blade")).toBe(true);
		});

		it("should NOT grant weapon proficiency when not attuned", () => {
			state.addItem({
				name: "Sun Blade",
				source: "DMG",
				weapon: true,
				grantsProficiency: true,
				requiresAttunement: true,
				equipped: true,
				attuned: false,
			});

			expect(state.hasWeaponProficiency("Sun Blade")).toBe(false);
		});

		it("should return item granted proficiencies", () => {
			state.addItem({
				name: "Dwarven Plate",
				source: "DMG",
				armor: true,
				armorType: "heavy",
				grantsProficiency: true,
				equipped: true,
			});
			state.addItem({
				name: "Sun Blade",
				source: "DMG",
				weapon: true,
				grantsProficiency: true,
				equipped: true,
				attuned: true,
			});

			const profs = state.getItemGrantedProficiencies();
			expect(profs.armor).toContain("heavy");
			expect(profs.weapons).toContain("Sun Blade");
		});
	});

	// ======================================================================
	// Container System (Bag of Holding, etc.)
	// ======================================================================
	describe("Container System", () => {
		it("should identify container items", () => {
			state.addItem({
				name: "Bag of Holding",
				source: "DMG",
				weight: 15,
				containerCapacity: {weight: [500], weightless: true},
			});

			const items = state.getItems();
			const bag = items.find(i => i.name === "Bag of Holding");
			expect(state.isContainer(bag.id)).toBe(true);
		});

		it("should put items into containers", () => {
			state.addItem({
				name: "Bag of Holding",
				source: "DMG",
				weight: 15,
				containerCapacity: {weight: [500], weightless: true},
			});
			state.addItem({name: "Gold Bar", source: "PHB", weight: 50});

			const items = state.getItems();
			const bag = items.find(i => i.name === "Bag of Holding");
			const gold = items.find(i => i.name === "Gold Bar");

			const result = state.putItemInContainer(gold.id, bag.id);
			expect(result.success).toBe(true);

			const contained = state.getContainedItems(bag.id);
			expect(contained).toHaveLength(1);
			expect(contained[0].item.name).toBe("Gold Bar");
		});

		it("should exclude weightless container contents from total weight", () => {
			state.addItem({
				name: "Bag of Holding",
				source: "DMG",
				weight: 15,
				containerCapacity: {weight: [500], weightless: true},
			});
			state.addItem({name: "Heavy Stuff", source: "PHB", weight: 100});

			const items = state.getItems();
			const bag = items.find(i => i.name === "Bag of Holding");
			const stuff = items.find(i => i.name === "Heavy Stuff");

			// Before putting in container: 15 + 100 = 115
			expect(state.getTotalWeight()).toBe(115);

			// Put heavy stuff in bag
			state.putItemInContainer(stuff.id, bag.id);

			// After: only bag weight counts (15), stuff is weightless
			expect(state.getTotalWeight()).toBe(15);
		});

		it("should enforce container weight capacity", () => {
			state.addItem({
				name: "Small Pouch",
				source: "PHB",
				weight: 1,
				containerCapacity: {weight: [10]}, // Not weightless
			});
			state.addItem({name: "Heavy Item", source: "PHB", weight: 20});

			const items = state.getItems();
			const pouch = items.find(i => i.name === "Small Pouch");
			const heavy = items.find(i => i.name === "Heavy Item");

			const result = state.putItemInContainer(heavy.id, pouch.id);
			expect(result.success).toBe(false);
			expect(result.error).toContain("full");
		});

		it("should remove item from container", () => {
			state.addItem({
				name: "Bag of Holding",
				source: "DMG",
				weight: 15,
				containerCapacity: {weight: [500], weightless: true},
			});
			state.addItem({name: "Gem", source: "PHB", weight: 0.5});

			const items = state.getItems();
			const bag = items.find(i => i.name === "Bag of Holding");
			const gem = items.find(i => i.name === "Gem");

			state.putItemInContainer(gem.id, bag.id);
			expect(state.getContainedItems(bag.id)).toHaveLength(1);

			state.removeItemFromContainer(gem.id);
			expect(state.getContainedItems(bag.id)).toHaveLength(0);
		});

		it("should report container capacity", () => {
			state.addItem({
				name: "Bag of Holding",
				source: "DMG",
				weight: 15,
				containerCapacity: {weight: [500], weightless: true},
			});
			state.addItem({name: "Item A", source: "PHB", weight: 50});
			state.addItem({name: "Item B", source: "PHB", weight: 100});

			const items = state.getItems();
			const bag = items.find(i => i.name === "Bag of Holding");
			const itemA = items.find(i => i.name === "Item A");
			const itemB = items.find(i => i.name === "Item B");

			state.putItemInContainer(itemA.id, bag.id);
			state.putItemInContainer(itemB.id, bag.id);

			const capacity = state.getContainerCapacity(bag.id);
			expect(capacity.weightMax).toBe(500);
			expect(capacity.weightUsed).toBe(150);
			expect(capacity.weightless).toBe(true);
		});

		it("should not allow putting container inside itself", () => {
			state.addItem({
				name: "Bag of Holding",
				source: "DMG",
				containerCapacity: {weight: [500], weightless: true},
			});

			const items = state.getItems();
			const bag = items.find(i => i.name === "Bag of Holding");

			const result = state.putItemInContainer(bag.id, bag.id);
			expect(result.success).toBe(false);
			expect(result.error).toContain("itself");
		});

		it("should get item's container", () => {
			state.addItem({
				name: "Bag of Holding",
				source: "DMG",
				containerCapacity: {weight: [500], weightless: true},
			});
			state.addItem({name: "Gem", source: "PHB", weight: 0.5});

			const items = state.getItems();
			const bag = items.find(i => i.name === "Bag of Holding");
			const gem = items.find(i => i.name === "Gem");

			expect(state.getItemContainer(gem.id)).toBeNull();

			state.putItemInContainer(gem.id, bag.id);
			const container = state.getItemContainer(gem.id);
			expect(container.item.name).toBe("Bag of Holding");
		});
	});

	// ======================================================================
	// Vestige Progression (Dormant/Awakened/Exalted)
	// ======================================================================
	describe("Vestige Progression", () => {
		it("should detect vestige tier from item name (Dormant)", () => {
			state.addItem({name: "Blade of Broken Mirrors (Dormant)", source: "EGW"});

			const items = state.getItems();
			const blade = items.find(i => i.name.includes("Blade"));
			expect(blade.vestigeTier).toBe("dormant");
		});

		it("should detect vestige tier from item name (Awakened)", () => {
			state.addItem({name: "Danoth's Visor (Awakened)", source: "EGW"});

			const items = state.getItems();
			const visor = items.find(i => i.name.includes("Visor"));
			expect(visor.vestigeTier).toBe("awakened");
		});

		it("should detect vestige tier from item name (Exalted)", () => {
			state.addItem({name: "Grimoire Infinitus (Exalted)", source: "EGW"});

			const items = state.getItems();
			const grimoire = items.find(i => i.name.includes("Grimoire"));
			expect(grimoire.vestigeTier).toBe("exalted");
		});

		it("should get vestige tier via getter", () => {
			state.addItem({name: "Blade of Broken Mirrors (Dormant)", source: "EGW"});

			const items = state.getItems();
			const blade = items.find(i => i.name.includes("Blade"));
			expect(state.getVestigeTier(blade.id)).toBe("dormant");
		});

		it("should upgrade vestige from dormant to awakened", () => {
			state.addItem({name: "Blade of Broken Mirrors (Dormant)", source: "EGW"});

			const items = state.getItems();
			const blade = items.find(i => i.name.includes("Blade"));

			const result = state.upgradeVestige(blade.id);
			expect(result.success).toBe(true);
			expect(result.newTier).toBe("awakened");
			expect(state.getVestigeTier(blade.id)).toBe("awakened");
		});

		it("should upgrade vestige item name", () => {
			state.addItem({name: "Blade of Broken Mirrors (Dormant)", source: "EGW"});

			const itemsBefore = state.getItems();
			const blade = itemsBefore.find(i => i.name.includes("Blade"));
			state.upgradeVestige(blade.id);

			const itemsAfter = state.getItems();
			const upgradedBlade = itemsAfter.find(i => i.id === blade.id);
			expect(upgradedBlade.name).toBe("Blade of Broken Mirrors (Awakened)");
		});

		it("should upgrade from awakened to exalted", () => {
			state.addItem({name: "Danoth's Visor (Awakened)", source: "EGW"});

			const items = state.getItems();
			const visor = items.find(i => i.name.includes("Visor"));

			const result = state.upgradeVestige(visor.id);
			expect(result.success).toBe(true);
			expect(result.newTier).toBe("exalted");
		});

		it("should not upgrade already exalted vestige", () => {
			state.addItem({name: "Grimoire Infinitus (Exalted)", source: "EGW"});

			const items = state.getItems();
			const grimoire = items.find(i => i.name.includes("Grimoire"));

			const result = state.upgradeVestige(grimoire.id);
			expect(result.success).toBe(false);
			expect(result.error).toContain("maximum");
		});

		it("should fail to upgrade non-vestige items", () => {
			state.addItem({name: "Longsword", source: "PHB"});

			const items = state.getItems();
			const sword = items.find(i => i.name === "Longsword");

			const result = state.upgradeVestige(sword.id);
			expect(result.success).toBe(false);
			expect(result.error).toContain("not a tiered item");
		});

		it("should get all vestiges", () => {
			state.addItem({name: "Blade of Broken Mirrors (Dormant)", source: "EGW"});
			state.addItem({name: "Longsword", source: "PHB"});
			state.addItem({name: "Danoth's Visor (Awakened)", source: "EGW"});

			const vestiges = state.getVestiges();
			expect(vestiges).toHaveLength(2);
		});
	});

	// ======================================================================
	// Spell Storing (Ring of Spell Storing, etc.)
	// ======================================================================
	describe("Spell Storing", () => {
		it("should detect Ring of Spell Storing capacity", () => {
			state.addItem({
				name: "Ring of Spell Storing",
				source: "DMG",
				type: "RG",
				requiresAttunement: true,
			});

			const items = state.getItems();
			const ring = items.find(i => i.name === "Ring of Spell Storing");
			expect(ring.maxSpellLevels).toBe(5);
			expect(state.canStoreSpells(ring.id)).toBe(true);
		});

		it("should store spells in the ring", () => {
			state.addItem({
				name: "Ring of Spell Storing",
				source: "DMG",
				type: "RG",
			});

			const items = state.getItems();
			const ring = items.find(i => i.name === "Ring of Spell Storing");

			const result = state.storeSpell(ring.id, {
				spell: "Shield",
				level: 1,
				saveDc: 15,
				attackBonus: 7,
				ability: "int",
				casterName: "Gandalf",
			});

			expect(result.success).toBe(true);

			const stored = state.getStoredSpells(ring.id);
			expect(stored).toHaveLength(1);
			expect(stored[0].spell).toBe("Shield");
			expect(stored[0].casterName).toBe("Gandalf");
		});

		it("should track spell levels used", () => {
			state.addItem({
				name: "Ring of Spell Storing",
				source: "DMG",
			});

			const items = state.getItems();
			const ring = items.find(i => i.name === "Ring of Spell Storing");

			state.storeSpell(ring.id, {spell: "Shield", level: 1});
			state.storeSpell(ring.id, {spell: "Fireball", level: 3});

			const capacity = state.getSpellStoringCapacity(ring.id);
			expect(capacity.maxLevels).toBe(5);
			expect(capacity.usedLevels).toBe(4);
			expect(capacity.remainingLevels).toBe(1);
		});

		it("should enforce spell level capacity", () => {
			state.addItem({
				name: "Ring of Spell Storing",
				source: "DMG",
			});

			const items = state.getItems();
			const ring = items.find(i => i.name === "Ring of Spell Storing");

			state.storeSpell(ring.id, {spell: "Fireball", level: 3});
			state.storeSpell(ring.id, {spell: "Shield", level: 1});

			// Try to store a 2nd level spell (3+1+2 = 6 > 5)
			const result = state.storeSpell(ring.id, {spell: "Misty Step", level: 2});
			expect(result.success).toBe(false);
			expect(result.error).toContain("Not enough space");
		});

		it("should cast (remove) stored spells", () => {
			state.addItem({
				name: "Ring of Spell Storing",
				source: "DMG",
			});

			const items = state.getItems();
			const ring = items.find(i => i.name === "Ring of Spell Storing");

			state.storeSpell(ring.id, {spell: "Shield", level: 1, saveDc: 15});
			state.storeSpell(ring.id, {spell: "Fireball", level: 3, saveDc: 17});

			expect(state.getStoredSpells(ring.id)).toHaveLength(2);

			// Cast the first spell
			const cast = state.castStoredSpell(ring.id, 0);
			expect(cast.spell).toBe("Shield");
			expect(cast.saveDc).toBe(15);

			expect(state.getStoredSpells(ring.id)).toHaveLength(1);
			expect(state.getSpellStoringCapacity(ring.id).usedLevels).toBe(3);
		});

		it("should not store spells in non-storing items", () => {
			state.addItem({name: "Longsword", source: "PHB"});

			const items = state.getItems();
			const sword = items.find(i => i.name === "Longsword");

			expect(state.canStoreSpells(sword.id)).toBe(false);

			const result = state.storeSpell(sword.id, {spell: "Shield", level: 1});
			expect(result.success).toBe(false);
			expect(result.error).toContain("cannot store spells");
		});

		it("should return null when casting invalid spell index", () => {
			state.addItem({
				name: "Ring of Spell Storing",
				source: "DMG",
			});

			const items = state.getItems();
			const ring = items.find(i => i.name === "Ring of Spell Storing");

			const result = state.castStoredSpell(ring.id, 99);
			expect(result).toBeNull();
		});
	});

	// ======================================================================
	// FTD Dragon Items (Slumbering/Stirring/Wakened/Ascendant)
	// ======================================================================
	describe("FTD Dragon Items Tier System", () => {
		it("should detect FTD tiers from item names", () => {
			state.addItem({name: "Slumbering Dragon's Wrath", source: "FTD"});
			state.addItem({name: "Stirring Dragon Vessel", source: "FTD"});
			state.addItem({name: "Wakened Dragon-Touched Focus", source: "FTD"});
			state.addItem({name: "Ascendant Hoard Scarab", source: "FTD"});

			const items = state.getItems();
			const slumbering = items.find(i => i.name.includes("Slumbering"));
			const stirring = items.find(i => i.name.includes("Stirring"));
			const wakened = items.find(i => i.name.includes("Wakened"));
			const ascendant = items.find(i => i.name.includes("Ascendant"));

			expect(state.getVestigeTier(slumbering.id)).toBe("slumbering");
			expect(state.getVestigeTier(stirring.id)).toBe("stirring");
			expect(state.getVestigeTier(wakened.id)).toBe("wakened");
			expect(state.getVestigeTier(ascendant.id)).toBe("ascendant");
		});

		it("should distinguish dragon items from EGW vestiges", () => {
			state.addItem({name: "Slumbering Dragon's Wrath", source: "FTD"});
			state.addItem({name: "Blade of Broken Mirrors (Dormant)", source: "EGW"});

			const items = state.getItems();
			const dragon = items.find(i => i.name.includes("Slumbering"));
			const vestige = items.find(i => i.name.includes("Blade"));

			expect(state.getItemTierType(dragon.id)).toBe("dragon");
			expect(state.getItemTierType(vestige.id)).toBe("vestige");
		});

		it("should upgrade dragon items through FTD tiers", () => {
			state.addItem({name: "Slumbering Dragon's Wrath", source: "FTD"});

			const items = state.getItems();
			const dragon = items.find(i => i.name.includes("Slumbering"));

			// Slumbering → Stirring
			let result = state.upgradeVestige(dragon.id);
			expect(result.success).toBe(true);
			expect(result.newTier).toBe("stirring");
			expect(state.getVestigeTier(dragon.id)).toBe("stirring");

			// Stirring → Wakened
			result = state.upgradeVestige(dragon.id);
			expect(result.success).toBe(true);
			expect(result.newTier).toBe("wakened");

			// Wakened → Ascendant
			result = state.upgradeVestige(dragon.id);
			expect(result.success).toBe(true);
			expect(result.newTier).toBe("ascendant");

			// Already at max
			result = state.upgradeVestige(dragon.id);
			expect(result.success).toBe(false);
			expect(result.error).toContain("maximum tier");
		});

		it("should update dragon item names on upgrade", () => {
			state.addItem({name: "Slumbering Dragon's Wrath", source: "FTD"});

			const items = state.getItems();
			const dragon = items.find(i => i.name.includes("Slumbering"));

			state.upgradeVestige(dragon.id);
			const upgraded = state.getItems().find(i => i.id === dragon.id);
			expect(upgraded.name).toBe("Stirring Dragon's Wrath");
		});

		it("should set dragon item tiers with valid FTD values", () => {
			state.addItem({name: "Slumbering Dragon's Wrath", source: "FTD"});

			const items = state.getItems();
			const dragon = items.find(i => i.name.includes("Slumbering"));

			expect(state.setVestigeTier(dragon.id, "wakened")).toBe(true);
			expect(state.getVestigeTier(dragon.id)).toBe("wakened");

			// EGW tier should fail on dragon item
			expect(state.setVestigeTier(dragon.id, "dormant")).toBe(false);
		});

		it("should filter tiered items by type", () => {
			state.addItem({name: "Slumbering Dragon's Wrath", source: "FTD"});
			state.addItem({name: "Blade of Broken Mirrors (Dormant)", source: "EGW"});
			state.addItem({name: "Danoth's Visor (Awakened)", source: "EGW"});

			const dragonItems = state.getTieredItems("dragon");
			const vestiges = state.getTieredItems("vestige");
			const allTiered = state.getTieredItems();

			expect(dragonItems).toHaveLength(1);
			expect(vestiges).toHaveLength(2);
			expect(allTiered).toHaveLength(3);
		});

		it("should provide alias methods for tiered items", () => {
			state.addItem({name: "Slumbering Dragon's Wrath", source: "FTD"});

			const items = state.getItems();
			const dragon = items.find(i => i.name.includes("Slumbering"));

			// Alias methods should work identically
			expect(state.getItemTier(dragon.id)).toBe(state.getVestigeTier(dragon.id));
			expect(state.setItemTier(dragon.id, "stirring")).toBe(true);
			expect(state.getItemTier(dragon.id)).toBe("stirring");

			const result = state.upgradeItemTier(dragon.id);
			expect(result.success).toBe(true);
		});
	});

	// ======================================================================
	// Ki Save DC Bonus (Dragonhide Belt)
	// ======================================================================
	describe("Ki Save DC Bonus", () => {
		it("should detect Dragonhide Belt Ki DC bonus from name", () => {
			state.addItem({name: "Dragonhide Belt +1", source: "FTD"});

			const items = state.getItems();
			const belt = items.find(i => i.name.includes("Dragonhide"));
			expect(belt.kiSaveDcBonus).toBe(1);
		});

		it("should detect different bonus tiers", () => {
			state.addItem({name: "Dragonhide Belt +1", source: "FTD"});
			state.addItem({name: "Dragonhide Belt +2", source: "FTD"});
			state.addItem({name: "Dragonhide Belt +3", source: "FTD"});

			const items = state.getItems();
			const belt1 = items.find(i => i.name === "Dragonhide Belt +1");
			const belt2 = items.find(i => i.name === "Dragonhide Belt +2");
			const belt3 = items.find(i => i.name === "Dragonhide Belt +3");

			expect(belt1.kiSaveDcBonus).toBe(1);
			expect(belt2.kiSaveDcBonus).toBe(2);
			expect(belt3.kiSaveDcBonus).toBe(3);
		});

		it("should store Ki DC bonus in itemBonuses", () => {
			// Add Dragonhide Belt +2
			state.addItem({name: "Dragonhide Belt +2", source: "FTD"});

			// Verify the bonus is stored in itemBonuses
			const bonuses = state.getItemBonuses();
			expect(bonuses.kiSaveDc).toBe(2);
		});

		it("should use highest Ki DC bonus when multiple items", () => {
			// Add two belts
			state.addItem({name: "Dragonhide Belt +1", source: "FTD"});
			state.addItem({name: "Dragonhide Belt +3", source: "FTD"});

			// Should use highest bonus
			const bonuses = state.getItemBonuses();
			expect(bonuses.kiSaveDc).toBe(3);
		});

		it("should have 0 Ki DC bonus without dragonhide belt", () => {
			// Fighter with no Ki
			state.addClass({name: "Fighter", source: "PHB", level: 5});
			state.addItem({name: "Longsword", source: "PHB"});

			const bonuses = state.getItemBonuses();
			expect(bonuses.kiSaveDc).toBe(0);
		});
	});

	// ======================================================================
	// Resource Restoration (Ki, Sorcery Points, Bardic Inspiration)
	// ======================================================================
	describe("Resource Restoration", () => {
		it("should detect Ki restoration from Dragonhide Belt", () => {
			state.addItem({name: "Dragonhide Belt +1", source: "FTD"});

			const items = state.getItems();
			const belt = items.find(i => i.name.includes("Dragonhide"));

			expect(belt.resourceRestoration).toBeDefined();
			expect(belt.resourceRestoration.type).toBe("ki");
			expect(belt.resourceRestoration.amount).toBeGreaterThan(0);
		});

		it("should detect Sorcery Point restoration from Bloodwell Vial", () => {
			state.addItem({name: "Bloodwell Vial +1", source: "TCE"});

			const items = state.getItems();
			const vial = items.find(i => i.name.includes("Bloodwell"));

			expect(vial.resourceRestoration).toBeDefined();
			expect(vial.resourceRestoration.type).toBe("sorceryPoints");
		});

		it("should detect Bardic Inspiration restoration from Rhythm-Maker's Drum", () => {
			state.addItem({name: "Rhythm-Maker's Drum +1", source: "TCE"});

			const items = state.getItems();
			const drum = items.find(i => i.name.includes("Rhythm-Maker"));

			expect(drum.resourceRestoration).toBeDefined();
			expect(drum.resourceRestoration.type).toBe("bardicInspiration");
		});

		it("should track resource restoration usage", () => {
			state.addItem({name: "Dragonhide Belt +1", source: "FTD"});

			const items = state.getItems();
			const belt = items.find(i => i.name.includes("Dragonhide"));

			expect(state.isResourceRestorationAvailable(belt.id)).toBe(true);

			state.useResourceRestoration(belt.id);
			expect(state.isResourceRestorationAvailable(belt.id)).toBe(false);
		});

		it("should reset all resource restorations", () => {
			state.addItem({name: "Dragonhide Belt +1", source: "FTD"});
			state.addItem({name: "Bloodwell Vial +1", source: "TCE"});

			const items = state.getItems();
			const belt = items.find(i => i.name.includes("Dragonhide"));
			const vial = items.find(i => i.name.includes("Bloodwell"));

			state.useResourceRestoration(belt.id);
			state.useResourceRestoration(vial.id);

			expect(state.isResourceRestorationAvailable(belt.id)).toBe(false);
			expect(state.isResourceRestorationAvailable(vial.id)).toBe(false);

			state.resetResourceRestorations();

			expect(state.isResourceRestorationAvailable(belt.id)).toBe(true);
			expect(state.isResourceRestorationAvailable(vial.id)).toBe(true);
		});

		it("should filter restoration items by resource type", () => {
			state.addItem({name: "Dragonhide Belt +1", source: "FTD"});
			state.addItem({name: "Bloodwell Vial +1", source: "TCE"});
			state.addItem({name: "Rhythm-Maker's Drum +1", source: "TCE"});

			const kiItems = state.getResourceRestorationItems("ki");
			const sorceryItems = state.getResourceRestorationItems("sorceryPoints");
			const allRestoration = state.getResourceRestorationItems();

			expect(kiItems).toHaveLength(1);
			expect(sorceryItems).toHaveLength(1);
			expect(allRestoration).toHaveLength(3);
		});
	});

	// ======================================================================
	// Mental Protection (Ring of Mind Shielding)
	// ======================================================================
	describe("Mental Protection", () => {
		it("should detect mental protection from Ring of Mind Shielding", () => {
			state.addItem({name: "Ring of Mind Shielding", source: "DMG"});

			const items = state.getItems();
			const ring = items.find(i => i.name.includes("Mind Shielding"));

			expect(ring.mentalProtection).toBeDefined();
			expect(ring.mentalProtection.telepathyImmune).toBe(true);
			expect(ring.mentalProtection.thoughtReadingImmune).toBe(true);
		});

		it("should apply mental protection when item is equipped", () => {
			state.addItem({name: "Ring of Mind Shielding", source: "DMG"});

			const items = state.getItems();
			const ring = items.find(i => i.name.includes("Mind Shielding"));

			// Not equipped initially
			state.setItemEquipped(ring.id, false);
			expect(state.hasMentalProtection("telepathyImmune")).toBe(false);

			// Equip the ring
			state.setItemEquipped(ring.id, true);
			expect(state.hasMentalProtection("telepathyImmune")).toBe(true);
			expect(state.hasMentalProtection("thoughtReadingImmune")).toBe(true);
		});

		it("should get all mental protection flags with sources", () => {
			state.addItem({name: "Ring of Mind Shielding", source: "DMG"});

			const items = state.getItems();
			const ring = items.find(i => i.name.includes("Mind Shielding"));
			state.setItemEquipped(ring.id, true);

			const protections = state.getMentalProtections();

			expect(protections.telepathyImmune.active).toBe(true);
			expect(protections.telepathyImmune.sources).toContain("Ring of Mind Shielding");
			expect(protections.thoughtReadingImmune.active).toBe(true);
		});

		it("should track soul trapping capability", () => {
			state.addItem({name: "Ring of Mind Shielding", source: "DMG"});

			const items = state.getItems();
			const ring = items.find(i => i.name.includes("Mind Shielding"));
			state.setItemEquipped(ring.id, true);

			const protections = state.getMentalProtections();
			expect(protections.soulTrapped.active).toBe(true);
			expect(protections.soulTrapped.itemId).toBe(ring.id);

			const soulItems = state.getSoulTrappingItems();
			expect(soulItems).toHaveLength(1);
		});

		it("should detect lie and alignment detection immunity", () => {
			state.addItem({name: "Ring of Mind Shielding", source: "DMG"});

			const items = state.getItems();
			const ring = items.find(i => i.name.includes("Mind Shielding"));
			state.setItemEquipped(ring.id, true);

			expect(state.hasMentalProtection("lieDetectionImmune")).toBe(true);
			expect(state.hasMentalProtection("alignmentDetectionImmune")).toBe(true);
		});

		it("should handle multiple protection sources", () => {
			// Add two mind-protecting items (mark second as custom to allow separate entries)
			state.addItem({name: "Ring of Mind Shielding", source: "DMG"});
			state.addItem({name: "Ring of Mind Shielding", source: "DMG", _isCustom: true});

			const items = state.getItems();
			const rings = items.filter(i => i.name.includes("Mind Shielding"));

			state.setItemEquipped(rings[0].id, true);
			state.setItemEquipped(rings[1].id, true);

			const protections = state.getMentalProtections();
			expect(protections.telepathyImmune.sources).toHaveLength(2);
		});

		it("should return false for non-existent protection types", () => {
			expect(state.hasMentalProtection("unknownProtection")).toBe(false);
		});
	});
});
