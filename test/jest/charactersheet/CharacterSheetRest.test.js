/**
 * Character Sheet Rest Mechanics - Unit Tests
 * Tests for short rest, long rest, resource recovery, hit dice recovery
 */

import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

describe("Rest Mechanics", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.addClass({name: "Fighter", source: "PHB", level: 5});
		state.setAbilityBase("con", 14); // +2 CON
	});

	// ==========================================================================
	// Short Rest - HP Recovery
	// ==========================================================================
	describe("Short Rest - HP Recovery", () => {
		beforeEach(() => {
			state.setMaxHp(44);
			state.setCurrentHp(20);
		});

		it("should allow spending hit dice to recover HP", () => {
			const initialHp = state.getCurrentHp();
			state.spendHitDie("d10");
			// d10 + 2 (CON) = 3-12 HP restored
			expect(state.getCurrentHp()).toBeGreaterThan(initialHp);
		});

		it("should reduce available hit dice when spent", () => {
			const hd = state.getHitDice().find(h => h.type === "d10");
			const initialCurrent = hd.current;
			state.spendHitDie("d10");
			expect(state.getHitDice().find(h => h.type === "d10").current).toBe(initialCurrent - 1);
		});

		it("should not allow spending hit dice when none available", () => {
			// Spend all hit dice
			for (let i = 0; i < 5; i++) {
				state.spendHitDie("d10");
			}
			const currentHp = state.getCurrentHp();
			const result = state.spendHitDie("d10");
			expect(result).toBe(false);
			expect(state.getCurrentHp()).toBe(currentHp);
		});

		it("should not exceed max HP when recovering", () => {
			state.setCurrentHp(42);
			state.spendHitDie("d10"); // Could restore 3-12 HP
			expect(state.getCurrentHp()).toBeLessThanOrEqual(state.getMaxHp());
		});

		it("should add CON modifier to hit die roll", () => {
			state.setAbilityBase("con", 20); // +5 CON
			state.setCurrentHp(10);
			// d10 + 5 = minimum 6 HP
			state.spendHitDie("d10");
			expect(state.getCurrentHp()).toBeGreaterThanOrEqual(16);
		});

		it("should restore minimum 1 HP from hit die (even with negative CON)", () => {
			state.setAbilityBase("con", 6); // -2 CON
			state.setCurrentHp(10);
			state.spendHitDie("d10");
			// d10 - 2, but minimum 1
			expect(state.getCurrentHp()).toBeGreaterThanOrEqual(11);
		});
	});

	// ==========================================================================
	// Short Rest - Resource Recovery
	// ==========================================================================
	describe("Short Rest - Resource Recovery", () => {
		beforeEach(() => {
			state.addFeature({
				id: "secondWind",
				name: "Second Wind",
				uses: {current: 0, max: 1},
				recharge: "short",
			});
			state.addFeature({
				id: "actionSurge",
				name: "Action Surge",
				uses: {current: 0, max: 1},
				recharge: "short",
			});
			state.addFeature({
				id: "indomitable",
				name: "Indomitable",
				uses: {current: 0, max: 1},
				recharge: "long",
			});
		});

		it("should restore short rest features", () => {
			state.onShortRest();
			expect(state.getFeature("Second Wind").uses.current).toBe(1);
			expect(state.getFeature("Action Surge").uses.current).toBe(1);
		});

		it("should not restore long rest features on short rest", () => {
			state.onShortRest();
			expect(state.getFeature("Indomitable").uses.current).toBe(0);
		});

		it("should restore Warlock spell slots on short rest", () => {
			state.addClass({name: "Warlock", source: "PHB", level: 3});
			state.setPactSlots({current: 0, max: 2});
			state.onShortRest();
			expect(state.getPactSlots().current).toBe(2);
		});

		it("should track short rest count", () => {
			state.onShortRest();
			state.onShortRest();
			expect(state.getShortRestCount()).toBe(2);
		});
	});

	// ==========================================================================
	// Short Rest - Ki Points (Monk)
	// ==========================================================================
	describe("Short Rest - Ki Points", () => {
		beforeEach(() => {
			state.addClass({name: "Monk", source: "PHB", level: 5});
		});

		it("should have ki points equal to monk level", () => {
			state.setKiPoints({current: 5, max: 5});
			expect(state.getKiPoints().max).toBe(5);
		});

		it("should restore ki points on short rest", () => {
			state.setKiPoints({current: 0, max: 5});
			state.onShortRest();
			expect(state.getKiPoints().current).toBe(5);
		});

		it("should track ki point usage", () => {
			state.setKiPoints({current: 5, max: 5});
			state.useKiPoint();
			state.useKiPoint();
			expect(state.getKiPoints().current).toBe(3);
		});
	});

	// ==========================================================================
	// Long Rest - Full Recovery
	// ==========================================================================
	describe("Long Rest - Full Recovery", () => {
		beforeEach(() => {
			state.setMaxHp(44);
			state.setCurrentHp(20);
			// Spend some hit dice
			state.setHitDice([{type: "d10", current: 2, max: 5}]);
		});

		it("should restore HP to maximum", () => {
			state.onLongRest();
			expect(state.getCurrentHp()).toBe(state.getMaxHp());
		});

		it("should restore half (rounded up) of max hit dice", () => {
			// 5 max hit dice → restore 3 (half rounded up)
			// Currently at 2, so should be at 5 (2 + 3, capped at max)
			state.setHitDice([{type: "d10", current: 0, max: 5}]);
			state.onLongRest();
			expect(state.getHitDice()[0].current).toBe(3);
		});

		it("should not exceed max hit dice on recovery", () => {
			state.setHitDice([{type: "d10", current: 4, max: 5}]);
			state.onLongRest();
			expect(state.getHitDice()[0].current).toBe(5);
		});

		it("should restore at least 1 hit die", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 1});
			state.setHitDice([{type: "d10", current: 0, max: 1}]);
			state.onLongRest();
			expect(state.getHitDice()[0].current).toBe(1);
		});
	});

	// ==========================================================================
	// Long Rest - Spell Slots
	// ==========================================================================
	describe("Long Rest - Spell Slots", () => {
		beforeEach(() => {
			state.addClass({name: "Wizard", source: "PHB", level: 5});
			state.setSpellSlots([
				{level: 1, current: 0, max: 4},
				{level: 2, current: 1, max: 3},
				{level: 3, current: 0, max: 2},
			]);
		});

		it("should restore all spell slots on long rest", () => {
			state.onLongRest();
			expect(state.getSpellSlots()[1].current).toBe(4);
			expect(state.getSpellSlots()[2].current).toBe(3);
			expect(state.getSpellSlots()[3].current).toBe(2);
		});

		it("should restore Arcane Recovery uses", () => {
			state.addFeature({
				id: "arcaneRecovery",
				name: "Arcane Recovery",
				uses: {current: 0, max: 1},
				recharge: "long",
			});
			state.onLongRest();
			expect(state.getFeature("Arcane Recovery").uses.current).toBe(1);
		});
	});

	// ==========================================================================
	// Long Rest - Feature Recovery
	// ==========================================================================
	describe("Long Rest - Feature Recovery", () => {
		beforeEach(() => {
			state.addFeature({
				id: "secondWind",
				name: "Second Wind",
				uses: {current: 0, max: 1},
				recharge: "short",
			});
			state.addFeature({
				id: "indomitable",
				name: "Indomitable",
				uses: {current: 0, max: 1},
				recharge: "long",
			});
			state.addFeature({
				id: "channelDivinity",
				name: "Channel Divinity",
				uses: {current: 0, max: 2},
				recharge: "short",
			});
		});

		it("should restore long rest features", () => {
			state.onLongRest();
			expect(state.getFeature("Indomitable").uses.current).toBe(1);
		});

		it("should also restore short rest features on long rest", () => {
			state.onLongRest();
			expect(state.getFeature("Second Wind").uses.current).toBe(1);
			expect(state.getFeature("Channel Divinity").uses.current).toBe(2);
		});

		it("should reset daily use items", () => {
			state.addItem({
				id: "item1",
				name: "Healing Potion of Plenty",
				charges: {current: 0, max: 3},
				recharge: "dawn",
			});
			state.onLongRest();
			expect(state.getItem("item1").charges.current).toBe(3);
		});
	});

	// ==========================================================================
	// Long Rest - Conditions
	// ==========================================================================
	describe("Long Rest - Conditions", () => {
		it("should reduce exhaustion by 1 level", () => {
			state.setExhaustion(3);
			state.onLongRest();
			expect(state.getExhaustion()).toBe(2);
		});

		it("should reduce exhaustion to 0 if at level 1", () => {
			state.setExhaustion(1);
			state.onLongRest();
			expect(state.getExhaustion()).toBe(0);
		});

		it("should not affect exhaustion if already 0", () => {
			state.setExhaustion(0);
			state.onLongRest();
			expect(state.getExhaustion()).toBe(0);
		});

		it("should clear death save successes and failures", () => {
			state.setDeathSaves({successes: 2, failures: 2});
			state.onLongRest();
			const deathSaves = state.getDeathSaves();
			expect(deathSaves.successes).toBe(0);
			expect(deathSaves.failures).toBe(0);
		});
	});

	// ==========================================================================
	// Long Rest - Temp HP
	// ==========================================================================
	describe("Long Rest - Temp HP", () => {
		it("should preserve temp HP through long rest", () => {
			state.setTempHp(10);
			state.onLongRest();
			// RAW: Temp HP persists through rests
			expect(state.getTempHp()).toBe(10);
		});

		it("should optionally clear temp HP (house rule setting)", () => {
			state.setTempHp(10);
			state.onLongRest({clearTempHp: true});
			expect(state.getTempHp()).toBe(0);
		});
	});

	// ==========================================================================
	// Interrupted Rest
	// ==========================================================================
	describe("Interrupted Rest", () => {
		it("should track if long rest was interrupted", () => {
			state.startLongRest();
			state.interruptRest();
			expect(state.isRestInterrupted()).toBe(true);
		});

		it("should not grant benefits if long rest interrupted before 1 hour", () => {
			state.setCurrentHp(20);
			state.startLongRest();
			state.interruptRest({hoursCompleted: 0.5});
			state.completeLongRest();
			// No benefits if less than 1 hour completed
			expect(state.getCurrentHp()).toBe(20);
		});

		it("should allow continuing rest after 1 hour of combat", () => {
			state.startLongRest();
			state.interruptRest({hoursCompleted: 4, combatDuration: 30}); // 30 minutes
			// Can continue if combat was 1 hour or less
			expect(state.canContinueRest()).toBe(true);
		});

		it("should require new long rest if interrupted too long", () => {
			state.startLongRest();
			state.interruptRest({hoursCompleted: 2, combatDuration: 90}); // 90 minutes
			expect(state.canContinueRest()).toBe(false);
		});
	});

	// ==========================================================================
	// Class-Specific Rest Features
	// ==========================================================================
	describe("Class-Specific Rest Features", () => {
		describe("Wizard - Arcane Recovery", () => {
			beforeEach(() => {
				state.addClass({name: "Wizard", source: "PHB", level: 5});
				state.addFeature({
					id: "arcaneRecovery",
					name: "Arcane Recovery",
					uses: {current: 1, max: 1},
					recharge: "long",
				});
				state.setSpellSlots([
					{level: 1, current: 0, max: 4},
					{level: 2, current: 0, max: 3},
					{level: 3, current: 0, max: 2},
				]);
			});

			it("should recover spell slots equal to half wizard level", () => {
				// Level 5 = recover up to 3 levels of slots
				state.useArcaneRecovery([{level: 2, amount: 1}, {level: 1, amount: 1}]); // 3 levels
				expect(state.getSpellSlots()[1].current).toBe(1);
				expect(state.getSpellSlots()[2].current).toBe(1);
			});

			it("should not recover slots of 6th level or higher", () => {
				state.addClass({name: "Wizard", source: "PHB", level: 11});
				state.setSpellSlots([
					{level: 6, current: 0, max: 1},
				]);
				const result = state.useArcaneRecovery([{level: 6, amount: 1}]);
				expect(result).toBe(false);
			});

			it("should use feature charge", () => {
				state.useArcaneRecovery([{level: 1, amount: 2}]);
				expect(state.getFeature("Arcane Recovery").uses.current).toBe(0);
			});
		});

		describe("Bard - Song of Rest", () => {
			it("should add extra healing when spending hit dice", () => {
				state.addClass({name: "Bard", source: "PHB", level: 2});
				state.setCurrentHp(10);
				// Song of Rest adds d6 at level 2
				state.addShortRestBonus("songOfRest", "d6");
				state.spendHitDie("d10", {includeSongOfRest: true});
				// d10 + CON + d6
				expect(state.getCurrentHp()).toBeGreaterThanOrEqual(14); // min roll + CON
			});
		});

		describe("Warlock - Pact Magic", () => {
			beforeEach(() => {
				state.addClass({name: "Warlock", source: "PHB", level: 5});
				state.setPactSlots({current: 0, max: 2, level: 3});
			});

			it("should restore pact slots on short rest", () => {
				state.onShortRest();
				expect(state.getPactSlots().current).toBe(2);
			});

			it("should restore pact slots on long rest", () => {
				state.onLongRest();
				expect(state.getPactSlots().current).toBe(2);
			});
		});

		describe("Sorcerer - Font of Magic", () => {
			beforeEach(() => {
				state.addClass({name: "Sorcerer", source: "PHB", level: 5});
				state.setSorceryPoints({current: 0, max: 5});
			});

			it("should restore sorcery points on long rest", () => {
				state.onLongRest();
				expect(state.getSorceryPoints().current).toBe(5);
			});

			it("should not restore sorcery points on short rest", () => {
				state.onShortRest();
				expect(state.getSorceryPoints().current).toBe(0);
			});
		});
	});

	// ==========================================================================
	// Rest Requirements
	// ==========================================================================
	describe("Rest Requirements", () => {
		it("should require 1 hour for short rest", () => {
			expect(state.getRestRequirements("short").duration).toBe(60); // minutes
		});

		it("should require 8 hours for long rest", () => {
			expect(state.getRestRequirements("long").duration).toBe(480); // minutes
		});

		it("should track time since last long rest", () => {
			state.onLongRest();
			state.advanceTime(8); // 8 hours
			expect(state.getTimeSinceLastLongRest()).toBe(8);
		});

		it("should not allow long rest if one taken in last 24 hours", () => {
			state.onLongRest();
			state.advanceTime(20); // 20 hours
			expect(state.canLongRest()).toBe(false);
		});

		it("should allow long rest after 24 hours", () => {
			state.onLongRest();
			state.advanceTime(25); // 25 hours
			expect(state.canLongRest()).toBe(true);
		});
	});

	// ==========================================================================
	// Multiclass Hit Dice Recovery
	// ==========================================================================
	describe("Multiclass Hit Dice Recovery", () => {
		beforeEach(() => {
			state.addClass({name: "Fighter", source: "PHB", level: 3});
			state.addClass({name: "Wizard", source: "PHB", level: 2});
			state.setHitDice([
				{type: "d10", current: 0, max: 3},
				{type: "d6", current: 0, max: 2},
			]);
		});

		it("should recover hit dice from all classes", () => {
			// Total 5 hit dice, recover 3 (half rounded up)
			state.onLongRest();
			const hitDice = state.getHitDice();
			const totalRecovered = hitDice.reduce((sum, hd) => sum + hd.current, 0);
			expect(totalRecovered).toBeGreaterThanOrEqual(1);
		});

		it("should allow choosing which hit dice to recover", () => {
			// When recovering, player can choose
			state.recoverHitDice([
				{type: "d10", amount: 2},
				{type: "d6", amount: 1},
			]);
			expect(state.getHitDice().find(h => h.type === "d10").current).toBe(2);
			expect(state.getHitDice().find(h => h.type === "d6").current).toBe(1);
		});
	});

	// ==========================================================================
	// Magic Item Rest Features
	// ==========================================================================
	describe("Magic Item Rest Features", () => {
		it("should recharge magic item at dawn", () => {
			state.addItem({
				id: "item1",
				name: "Staff of Fire",
				charges: {current: 0, max: 10},
				recharge: "dawn",
				rechargeAmount: "1d6+4",
			});
			state.onLongRest();
			expect(state.getItem("item1").charges.current).toBeGreaterThanOrEqual(5);
		});

		it("should track items that recharge at dusk", () => {
			state.addItem({
				id: "item2",
				name: "Cloak of Shadows",
				charges: {current: 0, max: 3},
				recharge: "dusk",
				rechargeAmount: "all",
			});
			state.onDusk();
			expect(state.getItem("item2").charges.current).toBe(3);
		});

		it("should track items that recharge on specific conditions", () => {
			state.addItem({
				id: "item3",
				name: "Ring of Spell Storing",
				charges: {current: 5, max: 5},
				recharge: "manual",
			});
			// Doesn't auto-recharge
			state.onLongRest();
			expect(state.getItem("item3").charges.current).toBe(5);
		});
	});
});
