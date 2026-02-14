/**
 * Character Sheet Phase 5 — XPHB Epic Boons
 * Tests for ability score max override (max 30), applyASI / increaseAbility with maxScore param,
 * and Epic Boon ability choice application.
 */

import "./setup.js";
import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

describe("Epic Boons — Ability Score Max Override", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
	});

	// ==========================================================================
	// applyASI with maxScore parameter
	// ==========================================================================
	describe("applyASI with maxScore", () => {
		it("should cap at 20 by default", () => {
			state.applyASI("str", 2); // 10 → 12
			expect(state.getAbilityBase("str")).toBe(12);

			// Set to 19, then try +2 → should cap at 20
			state.setAbilityBase("str", 19);
			state.applyASI("str", 2);
			expect(state.getAbilityBase("str")).toBe(20);
		});

		it("should cap at 30 when maxScore is 30", () => {
			state.setAbilityBase("str", 19);
			state.applyASI("str", 2, 30);
			expect(state.getAbilityBase("str")).toBe(21);
		});

		it("should allow ability score to reach 30 with Epic Boon max", () => {
			state.setAbilityBase("str", 29);
			state.applyASI("str", 2, 30);
			expect(state.getAbilityBase("str")).toBe(30);
		});

		it("should not exceed 30 even with large bonus", () => {
			state.setAbilityBase("str", 29);
			state.applyASI("str", 5, 30);
			expect(state.getAbilityBase("str")).toBe(30);
		});

		it("should still cap at 20 when no maxScore specified", () => {
			state.setAbilityBase("dex", 19);
			state.applyASI("dex", 2);
			expect(state.getAbilityBase("dex")).toBe(20);
		});
	});

	// ==========================================================================
	// increaseAbility with maxScore parameter
	// ==========================================================================
	describe("increaseAbility with maxScore", () => {
		it("should cap at 20 by default", () => {
			state.setAbilityBase("con", 19);
			state.increaseAbility("con", 2);
			expect(state.getAbilityBase("con")).toBe(20);
		});

		it("should cap at 30 when maxScore is 30", () => {
			state.setAbilityBase("con", 19);
			state.increaseAbility("con", 2, 30);
			expect(state.getAbilityBase("con")).toBe(21);
		});

		it("should work with different max values", () => {
			state.setAbilityBase("wis", 23);
			state.increaseAbility("wis", 2, 24);
			expect(state.getAbilityBase("wis")).toBe(24);
		});
	});

	// ==========================================================================
	// Epic Boon feat data patterns
	// ==========================================================================
	describe("Epic Boon feat data patterns", () => {
		it("should recognise Epic Boon category marker", () => {
			// Epic Boons have category: "EB" in feat data
			const mockBoon = {
				name: "Boon of Combat Prowess",
				source: "XPHB",
				category: "EB",
				ability: [{choose: {from: ["str", "dex", "con"]}, max: 30}],
			};

			expect(mockBoon.category).toBe("EB");
			expect(mockBoon.ability[0].max).toBe(30);
			expect(mockBoon.ability[0].choose.from).toContain("str");
		});

		it("should handle fixed ability bonuses with max 30", () => {
			// Some boons have fixed ability bonuses like {str: 1, max: 30}
			const mockBoon = {
				ability: [{str: 1, max: 30}],
			};

			const ablEntry = mockBoon.ability[0];
			const max = ablEntry.max || 20;
			expect(max).toBe(30);

			// Simulate applying the bonus
			state.setAbilityBase("str", 20);
			const bonus = ablEntry.str;
			const current = state.getAbilityBase("str");
			state.setAbilityBase("str", Math.min(max, current + bonus));
			expect(state.getAbilityBase("str")).toBe(21);
		});

		it("should handle choose-based ability bonuses with max 30", () => {
			// Most boons have {choose: {from: [...]}, max: 30}
			const mockBoon = {
				ability: [{choose: {from: ["str", "dex", "con", "int", "wis", "cha"]}, max: 30}],
				_epicBoonAbilityChoice: {ability: "cha", amount: 1, max: 30},
			};

			// Simulate applying the choice
			state.setAbilityBase("cha", 20);
			const {ability, amount, max} = mockBoon._epicBoonAbilityChoice;
			const current = state.getAbilityBase(ability);
			state.setAbilityBase(ability, Math.min(max, current + amount));
			expect(state.getAbilityBase("cha")).toBe(21);
		});
	});

	// ==========================================================================
	// Non-Epic-Boon feats should still cap at 20
	// ==========================================================================
	describe("Non-Epic-Boon feats retain cap of 20", () => {
		it("should not exceed 20 for regular feats", () => {
			// Regular feat with ability bonus (no max property)
			state.setAbilityBase("str", 19);
			const ablEntry = {str: 2}; // No max property
			const max = ablEntry.max || 20;
			const bonus = ablEntry.str;
			const current = state.getAbilityBase("str");
			state.setAbilityBase("str", Math.min(max, current + bonus));
			expect(state.getAbilityBase("str")).toBe(20);
		});

		it("applyASI without maxScore should cap at 20", () => {
			state.setAbilityBase("int", 19);
			state.applyASI("int", 2);
			expect(state.getAbilityBase("int")).toBe(20);
		});
	});
});
