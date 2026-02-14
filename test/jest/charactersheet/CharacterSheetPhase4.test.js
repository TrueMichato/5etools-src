/**
 * Character Sheet Phase 4 Features - Unit Tests
 * Tests for XPHB Weapon Mastery (Monk/Paladin/Ranger),
 * Active State Mutual Exclusivity, and Rage breaks Concentration
 */

import "./setup.js";
import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

describe("Phase 4 Features", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
	});

	// ==========================================================================
	// XPHB Weapon Mastery — Missing Classes
	// ==========================================================================
	describe("XPHB Weapon Mastery - Monk", () => {
		it("should have weapon mastery for XPHB Monk", () => {
			state.addClass({name: "Monk", level: 1, source: "XPHB"});
			const calc = state.getFeatureCalculations();
			expect(calc.hasWeaponMastery).toBe(true);
			expect(calc.weaponMasteryCount).toBe(2);
		});

		it("should NOT have weapon mastery for PHB Monk", () => {
			state.addClass({name: "Monk", level: 1, source: "PHB"});
			const calc = state.getFeatureCalculations();
			expect(calc.hasWeaponMastery).toBeFalsy();
		});

		it("should have weapon mastery for TGTT Monk", () => {
			state.addClass({name: "Monk", level: 1, source: "TGTT"});
			const calc = state.getFeatureCalculations();
			expect(calc.hasWeaponMastery).toBe(true);
		});
	});

	describe("XPHB Weapon Mastery - Paladin", () => {
		it("should have weapon mastery for XPHB Paladin", () => {
			state.addClass({name: "Paladin", level: 1, source: "XPHB"});
			const calc = state.getFeatureCalculations();
			expect(calc.hasWeaponMastery).toBe(true);
			expect(calc.weaponMasteryCount).toBe(2);
		});

		it("should NOT have weapon mastery for PHB Paladin", () => {
			state.addClass({name: "Paladin", level: 1, source: "PHB"});
			const calc = state.getFeatureCalculations();
			expect(calc.hasWeaponMastery).toBeFalsy();
		});
	});

	describe("XPHB Weapon Mastery - Ranger", () => {
		it("should have weapon mastery for XPHB Ranger", () => {
			state.addClass({name: "Ranger", level: 1, source: "XPHB"});
			const calc = state.getFeatureCalculations();
			expect(calc.hasWeaponMastery).toBe(true);
			expect(calc.weaponMasteryCount).toBe(2);
		});

		it("should NOT have weapon mastery for PHB Ranger", () => {
			state.addClass({name: "Ranger", level: 1, source: "PHB"});
			const calc = state.getFeatureCalculations();
			expect(calc.hasWeaponMastery).toBeFalsy();
		});

		it("should NOT have weapon mastery for TGTT Ranger (uses own system)", () => {
			state.addClass({name: "Ranger", level: 1, source: "TGTT"});
			const calc = state.getFeatureCalculations();
			expect(calc.hasWeaponMastery).toBeFalsy();
		});
	});

	// ==========================================================================
	// Active State Mutual Exclusivity
	// ==========================================================================
	describe("Active State Mutual Exclusivity", () => {
		it("activating Rage should deactivate Bladesong", () => {
			state.activateState("bladesong");
			const bs = state.getActiveStates().find(s => s.stateTypeId === "bladesong");
			expect(bs?.active).toBe(true);

			state.activateState("rage");
			const bsAfter = state.getActiveStates().find(s => s.stateTypeId === "bladesong");
			expect(!bsAfter || !bsAfter.active).toBe(true);

			const rage = state.getActiveStates().find(s => s.stateTypeId === "rage");
			expect(rage?.active).toBe(true);
		});

		it("activating Bladesong should deactivate Rage", () => {
			state.activateState("rage");
			const rg = state.getActiveStates().find(s => s.stateTypeId === "rage");
			expect(rg?.active).toBe(true);

			state.activateState("bladesong");
			const rgAfter = state.getActiveStates().find(s => s.stateTypeId === "rage");
			expect(!rgAfter || !rgAfter.active).toBe(true);

			const bs = state.getActiveStates().find(s => s.stateTypeId === "bladesong");
			expect(bs?.active).toBe(true);
		});

		it("activating a non-exclusive state should not deactivate others", () => {
			state.activateState("rage");
			state.activateState("dodge");

			const rage = state.getActiveStates().find(s => s.stateTypeId === "rage");
			const dodge = state.getActiveStates().find(s => s.stateTypeId === "dodge");
			expect(rage?.active).toBe(true);
			expect(dodge?.active).toBe(true);
		});
	});

	// ==========================================================================
	// Rage Breaks Concentration
	// ==========================================================================
	describe("Rage Breaks Concentration", () => {
		it("activating Rage should break concentration", () => {
			state.setConcentration("Bless", 1);
			expect(state.isConcentrating()).toBe(true);

			state.activateState("rage");
			expect(state.isConcentrating()).toBe(false);
		});

		it("activating Rage without concentration should work fine", () => {
			expect(state.isConcentrating()).toBe(false);
			state.activateState("rage");
			const rage = state.getActiveStates().find(s => s.stateTypeId === "rage");
			expect(rage?.active).toBe(true);
		});

		it("activating Bladesong should NOT break concentration", () => {
			state.setConcentration("Haste", 3);
			expect(state.isConcentrating()).toBe(true);

			state.activateState("bladesong");
			expect(state.isConcentrating()).toBe(true);
		});

		it("activating Dodge should NOT break concentration", () => {
			state.setConcentration("Shield of Faith", 1);
			state.activateState("dodge");
			expect(state.isConcentrating()).toBe(true);
		});
	});

	// ==========================================================================
	// State Type Metadata
	// ==========================================================================
	describe("ACTIVE_STATE_TYPES metadata", () => {
		it("rage should have exclusiveWith containing bladesong", () => {
			const rage = CharacterSheetState.ACTIVE_STATE_TYPES.rage;
			expect(rage.exclusiveWith).toContain("bladesong");
		});

		it("rage should have breaksConcentration = true", () => {
			expect(CharacterSheetState.ACTIVE_STATE_TYPES.rage.breaksConcentration).toBe(true);
		});

		it("bladesong should have exclusiveWith containing rage", () => {
			const bs = CharacterSheetState.ACTIVE_STATE_TYPES.bladesong;
			expect(bs.exclusiveWith).toContain("rage");
		});

		it("bladesong should NOT have breaksConcentration", () => {
			expect(CharacterSheetState.ACTIVE_STATE_TYPES.bladesong.breaksConcentration).toBeFalsy();
		});

		it("dodge should NOT have exclusiveWith", () => {
			expect(CharacterSheetState.ACTIVE_STATE_TYPES.dodge.exclusiveWith).toBeFalsy();
		});
	});
});
