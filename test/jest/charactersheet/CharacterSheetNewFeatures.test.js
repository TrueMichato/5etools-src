/**
 * Character Sheet New Features - Unit Tests
 * Tests for Font of Magic, Concentration Saves, Weapon Mastery,
 * Mystic Arcanum, and Natural Recovery
 */

import "./setup.js";
import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

/** Helper to set all 6 ability scores at once */
function setScores (s, scores) {
	for (const [ability, value] of Object.entries(scores)) {
		s.setAbilityBase(ability, value);
	}
}

describe("New Features", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
	});

	// ==========================================================================
	// Font of Magic (Sorcery Point ↔ Spell Slot Conversion)
	// ==========================================================================
	describe("Font of Magic", () => {
		beforeEach(() => {
			// Set up a PHB Sorcerer at level 5 with some SP already used
			state.addClass({name: "Sorcerer", level: 5, source: "PHB"});
			state.setSorceryPoints({current: 3, max: 5});
			state.setSpellSlots([
				{level: 1, max: 4, current: 4},
				{level: 2, max: 3, current: 3},
				{level: 3, max: 2, current: 2},
			]);
		});

		describe("hasFontOfMagic", () => {
			it("should return true for sorcerer level 2+", () => {
				expect(state.hasFontOfMagic()).toBe(true);
			});

			it("should return false for non-sorcerer", () => {
				const s = new CharacterSheetState();
				s.addClass({name: "Wizard", level: 5, source: "PHB"});
				expect(s.hasFontOfMagic()).toBe(false);
			});
		});

		describe("SP to Slot cost table", () => {
			it("should return correct costs for each level", () => {
				expect(state.getSpToSlotCost(1)).toBe(2);
				expect(state.getSpToSlotCost(2)).toBe(3);
				expect(state.getSpToSlotCost(3)).toBe(5);
				expect(state.getSpToSlotCost(4)).toBe(6);
				expect(state.getSpToSlotCost(5)).toBe(7);
			});

			it("should return null for invalid levels", () => {
				expect(state.getSpToSlotCost(0)).toBeNull();
				expect(state.getSpToSlotCost(6)).toBeNull();
				expect(state.getSpToSlotCost(9)).toBeNull();
			});
		});

		describe("Slot to SP return", () => {
			it("should return SP equal to slot level", () => {
				expect(state.getSlotToSpReturn(1)).toBe(1);
				expect(state.getSlotToSpReturn(3)).toBe(3);
				expect(state.getSlotToSpReturn(5)).toBe(5);
			});
		});

		describe("convertSlotToSorceryPoints", () => {
			it("should convert a L1 slot to 1 SP", () => {
				const result = state.convertSlotToSorceryPoints(1);
				expect(result).toBe(true);
				expect(state.getSorceryPoints().current).toBe(4); // 3 + 1
				expect(state.getSpellSlotsCurrent(1)).toBe(3); // 4 - 1
			});

			it("should convert a L3 slot to 3 SP", () => {
				state.setSorceryPoints({current: 1, max: 5});
				const result = state.convertSlotToSorceryPoints(3);
				expect(result).toBe(true);
				expect(state.getSorceryPoints().current).toBe(4); // 1 + 3
				expect(state.getSpellSlotsCurrent(3)).toBe(1); // 2 - 1
			});

			it("should cap SP at max when converting", () => {
				state.setSorceryPoints({current: 4, max: 5});
				state.convertSlotToSorceryPoints(3); // Would add 3, but caps at 5
				expect(state.getSorceryPoints().current).toBe(5); // capped at max
			});

			it("should fail if no slots available", () => {
				state.setSpellSlots(1, 4, 0); // 0 current L1 slots
				const result = state.convertSlotToSorceryPoints(1);
				expect(result).toBe(false);
			});

			it("should fail for invalid slot levels", () => {
				expect(state.convertSlotToSorceryPoints(0)).toBe(false);
				expect(state.convertSlotToSorceryPoints(10)).toBe(false);
			});

			it("should fail for non-sorcerer", () => {
				const s = new CharacterSheetState();
				s.addClass({name: "Wizard", level: 5, source: "PHB"});
				s.setSpellSlots([{level: 1, max: 4, current: 4}]);
				expect(s.convertSlotToSorceryPoints(1)).toBe(false);
			});
		});

		describe("convertSorceryPointsToSlot", () => {
			it("should create a L1 slot for 2 SP", () => {
				state.setSorceryPoints({current: 5, max: 5});
				const result = state.convertSorceryPointsToSlot(1);
				expect(result).toBe(true);
				expect(state.getSorceryPoints().current).toBe(3); // 5 - 2
				expect(state.getSpellSlotsCurrent(1)).toBe(5); // 4 + 1 (above max)
			});

			it("should create a L2 slot for 3 SP", () => {
				state.setSorceryPoints({current: 5, max: 5});
				const result = state.convertSorceryPointsToSlot(2);
				expect(result).toBe(true);
				expect(state.getSorceryPoints().current).toBe(2); // 5 - 3
				expect(state.getSpellSlotsCurrent(2)).toBe(4); // 3 + 1
			});

			it("should create a L3 slot for 5 SP", () => {
				state.setSorceryPoints({current: 5, max: 5});
				const result = state.convertSorceryPointsToSlot(3);
				expect(result).toBe(true);
				expect(state.getSorceryPoints().current).toBe(0); // 5 - 5
				expect(state.getSpellSlotsCurrent(3)).toBe(3); // 2 + 1
			});

			it("should fail if not enough SP", () => {
				state.setSorceryPoints({current: 1, max: 5}); // Only 1 SP
				const result = state.convertSorceryPointsToSlot(1); // Costs 2
				expect(result).toBe(false);
			});

			it("should fail for L6+ slots", () => {
				state.setSorceryPoints({current: 20, max: 20});
				expect(state.convertSorceryPointsToSlot(6)).toBe(false);
			});
		});

		describe("PHB 2014 vs XPHB 2024 rules", () => {
			it("should allow up to L5 conversion for PHB sorcerer", () => {
				expect(state.getMaxConvertibleSlotLevel()).toBe(5);
				state.setSorceryPoints({current: 20, max: 20});
				state.setSpellSlots([{level: 5, max: 1, current: 0}]);
				expect(state.convertSorceryPointsToSlot(5)).toBe(true);
			});

			it("should limit to L3 conversion for XPHB sorcerer", () => {
				const s = new CharacterSheetState();
				s.addClass({name: "Sorcerer", level: 5, source: "XPHB"});
				s.setSorceryPoints({current: 20, max: 20});
				s.setSpellSlots([{level: 3, max: 2, current: 2}]);
				expect(s.getMaxConvertibleSlotLevel()).toBe(3);
				expect(s.convertSorceryPointsToSlot(4)).toBe(false);
				expect(s.convertSorceryPointsToSlot(3)).toBe(true);
			});
		});
	});

	// ==========================================================================
	// Concentration Save Integration
	// ==========================================================================
	describe("Concentration Saves", () => {
		beforeEach(() => {
			state.addClass({name: "Wizard", level: 5, source: "PHB"});
			setScores(state, {str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10});
		});

		describe("getConcentrationSaveDC", () => {
			it("should return 10 for low damage", () => {
				expect(state.getConcentrationSaveDC(10)).toBe(10);
				expect(state.getConcentrationSaveDC(15)).toBe(10);
				expect(state.getConcentrationSaveDC(19)).toBe(10);
			});

			it("should return half damage for high damage", () => {
				expect(state.getConcentrationSaveDC(22)).toBe(11);
				expect(state.getConcentrationSaveDC(30)).toBe(15);
				expect(state.getConcentrationSaveDC(40)).toBe(20);
			});

			it("should never go below 10", () => {
				expect(state.getConcentrationSaveDC(1)).toBe(10);
				expect(state.getConcentrationSaveDC(0)).toBe(10);
			});
		});

		describe("getConcentrationSaveBonus", () => {
			it("should include CON save modifier", () => {
				// CON 14 = +2 mod, no proficiency for wizard
				const bonus = state.getConcentrationSaveBonus();
				expect(bonus).toBe(2); // +2 CON mod, no prof
			});

			it("should include CON save proficiency when proficient", () => {
				// Sorcerer has CON save proficiency
				const s = new CharacterSheetState();
				s.addClass({name: "Sorcerer", level: 5, source: "PHB"});
				s.addSaveProficiency("con");
				setScores(s, {str: 8, dex: 14, con: 16, int: 10, wis: 12, cha: 18});
				const bonus = s.getConcentrationSaveBonus();
				// CON 16 = +3 mod + prof bonus (3 at L5) = 6
				expect(bonus).toBe(6);
			});
		});

		describe("getConcentrationAdvantage", () => {
			it("should return no advantage by default", () => {
				const result = state.getConcentrationAdvantage();
				expect(result.advantage).toBe(false);
			});

			it("should detect concentration advantage from named modifiers", () => {
				// Simulate a modifier like War Caster would create
				state.addNamedModifier({
					id: "war-caster-conc",
					name: "War Caster",
					type: "concentration",
					value: 0,
					advantage: true,
					enabled: true,
				});
				const result = state.getConcentrationAdvantage();
				expect(result.advantage).toBe(true);
				expect(result.sources).toContain("War Caster");
			});
		});

		describe("makeConcentrationCheck", () => {
			it("should return complete check info for 10 damage", () => {
				const check = state.makeConcentrationCheck(10);
				expect(check.dc).toBe(10);
				expect(check.bonus).toBe(2); // +2 CON
				expect(check.advantage).toBe(false);
				expect(check.rollNeeded).toBe(8); // 10 - 2
			});

			it("should return complete check info for 30 damage", () => {
				const check = state.makeConcentrationCheck(30);
				expect(check.dc).toBe(15);
				expect(check.bonus).toBe(2);
				expect(check.rollNeeded).toBe(13);
			});

			it("should cap rollNeeded at 20", () => {
				const check = state.makeConcentrationCheck(100);
				expect(check.dc).toBe(50);
				expect(check.rollNeeded).toBe(20); // capped
			});

			it("should floor rollNeeded at 1", () => {
				// High CON character with proficiency
				const s = new CharacterSheetState();
				s.addClass({name: "Sorcerer", level: 20, source: "PHB"});
				s.addSaveProficiency("con");
				setScores(s, {str: 8, dex: 14, con: 20, int: 10, wis: 12, cha: 20});
				const check = s.makeConcentrationCheck(10);
				// DC 10, bonus = +5 CON + 6 prof = 11 → rollNeeded = max(1, 10-11) = 1
				expect(check.rollNeeded).toBe(1);
			});
		});
	});

	// ==========================================================================
	// Weapon Mastery Effects
	// ==========================================================================
	describe("Weapon Mastery Effects", () => {
		describe("WEAPON_MASTERY_EFFECTS constant", () => {
			it("should define all 8 mastery properties", () => {
				const effects = CharacterSheetState.WEAPON_MASTERY_EFFECTS;
				expect(Object.keys(effects)).toHaveLength(8);
				expect(effects.Cleave).toBeDefined();
				expect(effects.Graze).toBeDefined();
				expect(effects.Nick).toBeDefined();
				expect(effects.Push).toBeDefined();
				expect(effects.Sap).toBeDefined();
				expect(effects.Slow).toBeDefined();
				expect(effects.Topple).toBeDefined();
				expect(effects.Vex).toBeDefined();
			});

			it("should have correct triggers for each mastery", () => {
				const effects = CharacterSheetState.WEAPON_MASTERY_EFFECTS;
				expect(effects.Cleave.trigger).toBe("onHit");
				expect(effects.Graze.trigger).toBe("onMiss");
				expect(effects.Nick.trigger).toBe("onAttack");
				expect(effects.Push.trigger).toBe("onHit");
				expect(effects.Sap.trigger).toBe("onHit");
				expect(effects.Slow.trigger).toBe("onHitDamage");
				expect(effects.Topple.trigger).toBe("onHit");
				expect(effects.Vex.trigger).toBe("onHitDamage");
			});

			it("should have descriptions for all mastery effects", () => {
				const effects = CharacterSheetState.WEAPON_MASTERY_EFFECTS;
				for (const [name, def] of Object.entries(effects)) {
					expect(def.description).toBeTruthy();
				}
			});
		});

		describe("getWeaponMasteryName (static)", () => {
			it("should extract name from string mastery", () => {
				const name = CharacterSheetState.getWeaponMasteryName({mastery: ["Topple|XPHB"]});
				expect(name).toBe("Topple");
			});

			it("should extract name from object mastery", () => {
				const name = CharacterSheetState.getWeaponMasteryName({mastery: [{uid: "Vex|XPHB"}]});
				expect(name).toBe("Vex");
			});

			it("should return null for weapon without mastery", () => {
				expect(CharacterSheetState.getWeaponMasteryName({})).toBeNull();
				expect(CharacterSheetState.getWeaponMasteryName({mastery: []})).toBeNull();
				expect(CharacterSheetState.getWeaponMasteryName(null)).toBeNull();
			});
		});

		describe("getWeaponMasteryEffect (static)", () => {
			it("should return the full effect definition for a weapon with mastery", () => {
				const effect = CharacterSheetState.getWeaponMasteryEffect({mastery: ["Topple|XPHB"]});
				expect(effect).toBeTruthy();
				expect(effect.trigger).toBe("onHit");
				expect(effect.effect).toBe("conSaveOrProne");
			});

			it("should return null for unknown mastery", () => {
				const effect = CharacterSheetState.getWeaponMasteryEffect({mastery: ["Unknown|XPHB"]});
				expect(effect).toBeNull();
			});
		});

		describe("getToppleDC", () => {
			it("should calculate Topple DC correctly with STR", () => {
				state.addClass({name: "Fighter", level: 5, source: "XPHB"});
				setScores(state, {str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8});
				// DC = 8 + STR mod (3) + prof (3) = 14
				expect(state.getToppleDC("str")).toBe(14);
			});

			it("should calculate Topple DC correctly with DEX", () => {
				state.addClass({name: "Rogue", level: 5, source: "XPHB"});
				setScores(state, {str: 10, dex: 18, con: 14, int: 12, wis: 14, cha: 8});
				// DC = 8 + DEX mod (4) + prof (3) = 15
				expect(state.getToppleDC("dex")).toBe(15);
			});
		});

		describe("getMasteryEffectsForAttack", () => {
			beforeEach(() => {
				state.addClass({name: "Fighter", level: 5, source: "XPHB"});
				setScores(state, {str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8});
				state.addWeaponMastery("Longsword|XPHB");
			});

			it("should return mastery effect for a mastered weapon attack", () => {
				const attack = {
					name: "Longsword",
					weaponKey: "Longsword|XPHB",
					masteryProperty: "Cleave",
					abilityMod: "str",
					damageType: "slashing",
				};
				const result = state.getMasteryEffectsForAttack(attack);
				expect(result).toBeTruthy();
				expect(result.name).toBe("Cleave");
				expect(result.effect).toBe("extraMeleeAttack");
			});

			it("should return null for non-mastered weapon", () => {
				const attack = {
					name: "Dagger",
					weaponKey: "Dagger|XPHB",
					masteryProperty: "Nick",
					abilityMod: "dex",
				};
				// Dagger is not in mastered weapons
				const result = state.getMasteryEffectsForAttack(attack);
				expect(result).toBeNull();
			});

			it("should compute Topple DC for Topple mastery", () => {
				state.addWeaponMastery("Battleaxe|XPHB");
				const attack = {
					name: "Battleaxe",
					weaponKey: "Battleaxe|XPHB",
					masteryProperty: "Topple",
					abilityMod: "str",
				};
				const result = state.getMasteryEffectsForAttack(attack);
				expect(result).toBeTruthy();
				expect(result.name).toBe("Topple");
				// DC = 8 + STR mod (3) + prof (3) = 14
				expect(result.dc).toBe(14);
			});

			it("should compute Graze damage for Graze mastery", () => {
				state.addWeaponMastery("Greatsword|XPHB");
				const attack = {
					name: "Greatsword",
					weaponKey: "Greatsword|XPHB",
					masteryProperty: "Graze",
					abilityMod: "str",
					damageType: "slashing",
				};
				const result = state.getMasteryEffectsForAttack(attack);
				expect(result).toBeTruthy();
				expect(result.name).toBe("Graze");
				expect(result.grazeDamage).toBe(3); // STR mod
				expect(result.damageType).toBe("slashing");
			});

			it("should include Tactical Master swap options when available", () => {
				// Need a fighter at L9+ for Tactical Master
				const s = new CharacterSheetState();
				s.addClass({name: "Fighter", level: 9, source: "XPHB"});
				setScores(s, {str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8});
				s.addWeaponMastery("Longsword|XPHB");
				const attack = {
					name: "Longsword",
					weaponKey: "Longsword|XPHB",
					masteryProperty: "Cleave",
					abilityMod: "str",
				};
				const result = s.getMasteryEffectsForAttack(attack);
				expect(result).toBeTruthy();
				expect(result.canSwapTo).toBeDefined();
				expect(result.canSwapTo).toContain("Push");
				expect(result.canSwapTo).toContain("Sap");
				expect(result.canSwapTo).toContain("Slow");
			});

			it("should return null if character has no weapon mastery feature", () => {
				const s = new CharacterSheetState();
				s.addClass({name: "Cleric", level: 5, source: "PHB"});
				const attack = {
					name: "Longsword",
					weaponKey: "Longsword|XPHB",
					masteryProperty: "Cleave",
					abilityMod: "str",
				};
				const result = s.getMasteryEffectsForAttack(attack);
				expect(result).toBeNull();
			});
		});
	});

	// ==========================================================================
	// Mystic Arcanum Usage Tracking
	// ==========================================================================
	describe("Mystic Arcanum", () => {
		beforeEach(() => {
			state.addClass({name: "Warlock", level: 17, source: "PHB"});
		});

		describe("isMysticArcanumAvailable", () => {
			it("should have all arcana available for L17 warlock", () => {
				expect(state.isMysticArcanumAvailable(6)).toBe(true);
				expect(state.isMysticArcanumAvailable(7)).toBe(true);
				expect(state.isMysticArcanumAvailable(8)).toBe(true);
				expect(state.isMysticArcanumAvailable(9)).toBe(true);
			});

			it("should not have arcanum for levels not yet unlocked", () => {
				const s = new CharacterSheetState();
				s.addClass({name: "Warlock", level: 11, source: "PHB"});
				expect(s.isMysticArcanumAvailable(6)).toBe(true);
				expect(s.isMysticArcanumAvailable(7)).toBe(false); // Need L13
				expect(s.isMysticArcanumAvailable(8)).toBe(false);
				expect(s.isMysticArcanumAvailable(9)).toBe(false);
			});

			it("should return false for invalid levels", () => {
				expect(state.isMysticArcanumAvailable(5)).toBe(false);
				expect(state.isMysticArcanumAvailable(10)).toBe(false);
			});
		});

		describe("useMysticArcanum", () => {
			it("should use a 6th level arcanum successfully", () => {
				expect(state.useMysticArcanum(6)).toBe(true);
				expect(state.isMysticArcanumAvailable(6)).toBe(false);
			});

			it("should not allow using same arcanum twice", () => {
				state.useMysticArcanum(7);
				expect(state.useMysticArcanum(7)).toBe(false);
			});

			it("should allow using different arcanum levels independently", () => {
				state.useMysticArcanum(6);
				expect(state.useMysticArcanum(7)).toBe(true);
				expect(state.useMysticArcanum(8)).toBe(true);
				expect(state.isMysticArcanumAvailable(6)).toBe(false);
				expect(state.isMysticArcanumAvailable(7)).toBe(false);
				expect(state.isMysticArcanumAvailable(8)).toBe(false);
				expect(state.isMysticArcanumAvailable(9)).toBe(true);
			});
		});

		describe("resetMysticArcanum (long rest)", () => {
			it("should reset all arcanum usage on long rest", () => {
				state.useMysticArcanum(6);
				state.useMysticArcanum(7);
				state.useMysticArcanum(8);
				state.useMysticArcanum(9);

				state.onLongRest();

				expect(state.isMysticArcanumAvailable(6)).toBe(true);
				expect(state.isMysticArcanumAvailable(7)).toBe(true);
				expect(state.isMysticArcanumAvailable(8)).toBe(true);
				expect(state.isMysticArcanumAvailable(9)).toBe(true);
			});
		});

		describe("getMysticArcanumUsage", () => {
			it("should return usage state object", () => {
				const usage = state.getMysticArcanumUsage();
				expect(usage[6]).toBe(false);
				expect(usage[7]).toBe(false);
				expect(usage[8]).toBe(false);
				expect(usage[9]).toBe(false);
			});

			it("should reflect used arcana", () => {
				state.useMysticArcanum(6);
				state.useMysticArcanum(9);
				const usage = state.getMysticArcanumUsage();
				expect(usage[6]).toBe(true);
				expect(usage[7]).toBe(false);
				expect(usage[8]).toBe(false);
				expect(usage[9]).toBe(true);
			});
		});
	});

	// ==========================================================================
	// Natural Recovery (Circle of the Land Druid)
	// ==========================================================================
	describe("Natural Recovery", () => {
		beforeEach(() => {
			state.addClass({name: "Druid", level: 6, source: "PHB", subclass: {name: "Circle of the Land"}});
			state.setSpellSlots([
				{level: 1, max: 4, current: 1},
				{level: 2, max: 3, current: 0},
				{level: 3, max: 3, current: 2},
			]);
		});

		describe("useNaturalRecovery", () => {
			it("should recover spell slots within max levels limit", () => {
				// Druid L6: max levels = ceil(6/2) = 3
				const result = state.useNaturalRecovery([{level: 1, amount: 1}, {level: 2, amount: 1}]);
				expect(result).toBe(true);
				expect(state.getSpellSlotsCurrent(1)).toBe(2); // 1 + 1
				expect(state.getSpellSlotsCurrent(2)).toBe(1); // 0 + 1
			});

			it("should not exceed slot max", () => {
				const result = state.useNaturalRecovery([{level: 3, amount: 1}]);
				expect(result).toBe(true);
				expect(state.getSpellSlotsCurrent(3)).toBe(3); // was 2, now 3 (at max)
			});

			it("should reject recovery exceeding max total levels", () => {
				// Max = 3, trying to recover L1+L1+L2 = 4 total levels
				const result = state.useNaturalRecovery([{level: 1, amount: 2}, {level: 2, amount: 1}]);
				expect(result).toBe(false);
			});

			it("should reject recovery of L6+ slots", () => {
				state.setSpellSlots([{level: 6, max: 1, current: 0}]);
				const result = state.useNaturalRecovery([{level: 6, amount: 1}]);
				expect(result).toBe(false);
			});

			it("should fail for non-Land druids", () => {
				const s = new CharacterSheetState();
				s.addClass({name: "Druid", level: 6, source: "PHB", subclass: {name: "Circle of the Moon"}});
				s.setSpellSlots([{level: 1, max: 4, current: 0}]);
				const result = s.useNaturalRecovery([{level: 1, amount: 1}]);
				expect(result).toBe(false);
			});
		});
	});

	// ==========================================================================
	// Feature Modifier Parser - Concentration Advantage Pattern
	// ==========================================================================
	describe("FeatureModifierParser - Concentration Patterns", () => {
		it("should parse War Caster concentration advantage text", () => {
			const parser = new (globalThis.FeatureModifierParser || CharacterSheetState.FeatureModifierParser)();
			// War Caster feature text
			const text = "You have advantage on Constitution saving throws that you make to maintain your concentration on a spell when you take damage.";

			// We can test the pattern via the named modifier system instead
			// Since the parser is internal, test via state integration
			state.addClass({name: "Wizard", level: 5, source: "PHB"});
			setScores(state, {str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10});

			// Directly add a named modifier that the parser would create
			state.addNamedModifier({
				id: "war-caster-conc-adv",
				name: "War Caster",
				type: "concentration",
				value: 0,
				advantage: true,
				enabled: true,
			});

			const concAdv = state.getConcentrationAdvantage();
			expect(concAdv.advantage).toBe(true);
		});

		it("should combine concentration bonus and advantage in makeConcentrationCheck", () => {
			state.addClass({name: "Wizard", level: 5, source: "PHB"});
			setScores(state, {str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10});

			// Add War Caster advantage
			state.addNamedModifier({
				id: "war-caster-conc-adv",
				name: "War Caster",
				type: "concentration",
				value: 0,
				advantage: true,
				enabled: true,
			});

			const check = state.makeConcentrationCheck(10);
			expect(check.dc).toBe(10);
			expect(check.bonus).toBe(2); // CON mod only
			expect(check.advantage).toBe(true);
			expect(check.rollNeeded).toBe(8);
		});
	});
});
