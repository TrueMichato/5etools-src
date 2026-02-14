/**
 * Character Sheet Phase 5 — Duration Tracking & Combat Round Counter
 * Tests for parseDurationToRounds, startCombat, endCombat, advanceRound,
 * and integration with activateState / toggleActiveState.
 */

import "./setup.js";
import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

describe("Duration Tracking & Combat Round Counter", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
	});

	// ==========================================================================
	// parseDurationToRounds — static method
	// ==========================================================================
	describe("parseDurationToRounds", () => {
		it("should return null for null/undefined/empty input", () => {
			expect(CharacterSheetState.parseDurationToRounds(null)).toBeNull();
			expect(CharacterSheetState.parseDurationToRounds(undefined)).toBeNull();
			expect(CharacterSheetState.parseDurationToRounds("")).toBeNull();
		});

		it("should return 0 for instantaneous", () => {
			expect(CharacterSheetState.parseDurationToRounds("Instantaneous")).toBe(0);
			expect(CharacterSheetState.parseDurationToRounds("instant")).toBe(0);
		});

		it("should parse minutes to rounds (1 min = 10 rounds)", () => {
			expect(CharacterSheetState.parseDurationToRounds("1 minute")).toBe(10);
			expect(CharacterSheetState.parseDurationToRounds("10 minutes")).toBe(100);
		});

		it("should parse hours to rounds (1 hour = 600 rounds)", () => {
			expect(CharacterSheetState.parseDurationToRounds("1 hour")).toBe(600);
			expect(CharacterSheetState.parseDurationToRounds("8 hours")).toBe(4800);
		});

		it("should parse rounds directly", () => {
			expect(CharacterSheetState.parseDurationToRounds("1 round")).toBe(1);
			expect(CharacterSheetState.parseDurationToRounds("3 rounds")).toBe(3);
		});

		it("should parse seconds to rounds (6 sec = 1 round)", () => {
			expect(CharacterSheetState.parseDurationToRounds("6 seconds")).toBe(1);
			expect(CharacterSheetState.parseDurationToRounds("30 seconds")).toBe(5);
		});

		it("should strip concentration prefix and parse time", () => {
			expect(CharacterSheetState.parseDurationToRounds("Concentration, up to 1 minute")).toBe(10);
			expect(CharacterSheetState.parseDurationToRounds("Concentration, up to 10 minutes")).toBe(100);
			expect(CharacterSheetState.parseDurationToRounds("Concentration, up to 1 hour")).toBe(600);
		});

		it("should return 1 for this-turn / next-turn durations", () => {
			expect(CharacterSheetState.parseDurationToRounds("This turn")).toBe(1);
			expect(CharacterSheetState.parseDurationToRounds("Until start of next turn")).toBe(1);
			expect(CharacterSheetState.parseDurationToRounds("Until the end of your next turn")).toBe(1);
			expect(CharacterSheetState.parseDurationToRounds("Until end of next turn")).toBe(1);
			expect(CharacterSheetState.parseDurationToRounds("Until the end of your turn")).toBe(1);
		});

		it("should return null for indefinite / manual durations", () => {
			expect(CharacterSheetState.parseDurationToRounds("Until ended")).toBeNull();
			expect(CharacterSheetState.parseDurationToRounds("Until ended or incapacitated")).toBeNull();
			expect(CharacterSheetState.parseDurationToRounds("Until dispelled")).toBeNull();
			expect(CharacterSheetState.parseDurationToRounds("Permanent")).toBeNull();
			expect(CharacterSheetState.parseDurationToRounds("Until you stand up")).toBeNull();
			expect(CharacterSheetState.parseDurationToRounds("Varies")).toBeNull();
		});

		it("should handle durations from ACTIVE_STATE_TYPES", () => {
			// Rage: "1 minute"
			const rageDur = CharacterSheetState.ACTIVE_STATE_TYPES.rage.duration;
			expect(CharacterSheetState.parseDurationToRounds(rageDur)).toBe(10);

			// Dodge: "Until start of next turn"
			const dodgeDur = CharacterSheetState.ACTIVE_STATE_TYPES.dodge.duration;
			expect(CharacterSheetState.parseDurationToRounds(dodgeDur)).toBe(1);

			// Bladesong: "1 minute"
			const bsDur = CharacterSheetState.ACTIVE_STATE_TYPES.bladesong.duration;
			expect(CharacterSheetState.parseDurationToRounds(bsDur)).toBe(10);

			// Prone: "Until you stand up" → null
			const proneDur = CharacterSheetState.ACTIVE_STATE_TYPES.prone.duration;
			expect(CharacterSheetState.parseDurationToRounds(proneDur)).toBeNull();
		});
	});

	// ==========================================================================
	// startCombat / endCombat / getCombatRound / isInCombat
	// ==========================================================================
	describe("Combat lifecycle", () => {
		it("should start in non-combat state", () => {
			expect(state.isInCombat()).toBe(false);
			expect(state.getCombatRound()).toBe(0);
		});

		it("should start combat at round 1", () => {
			state.startCombat();
			expect(state.isInCombat()).toBe(true);
			expect(state.getCombatRound()).toBe(1);
		});

		it("should end combat and reset round", () => {
			state.startCombat();
			state.advanceRound();
			state.endCombat();
			expect(state.isInCombat()).toBe(false);
			expect(state.getCombatRound()).toBe(0);
		});

		it("should stamp activatedAtRound on pre-existing active states when combat starts", () => {
			// Activate rage before combat
			state.activateState("rage");
			const rageState = state.getActiveStates().find(s => s.stateTypeId === "rage");
			expect(rageState.activatedAtRound).toBeNull();
			expect(rageState.roundsRemaining).toBeNull();

			// Start combat
			state.startCombat();
			expect(rageState.activatedAtRound).toBe(1);
			// Rage is "1 minute" = 10 rounds
			expect(rageState.roundsRemaining).toBe(10);
		});

		it("should clear round tracking data on end combat", () => {
			state.startCombat();
			state.activateState("rage");
			const rageState = state.getActiveStates().find(s => s.stateTypeId === "rage");
			expect(rageState.roundsRemaining).toBe(10);

			state.endCombat();
			expect(rageState.roundsRemaining).toBeNull();
			expect(rageState.activatedAtRound).toBeNull();
		});
	});

	// ==========================================================================
	// advanceRound
	// ==========================================================================
	describe("advanceRound", () => {
		it("should increment combat round", () => {
			state.startCombat();
			expect(state.getCombatRound()).toBe(1);
			state.advanceRound();
			expect(state.getCombatRound()).toBe(2);
			state.advanceRound();
			expect(state.getCombatRound()).toBe(3);
		});

		it("should do nothing when not in combat", () => {
			const expired = state.advanceRound();
			expect(expired).toEqual([]);
			expect(state.getCombatRound()).toBe(0);
		});

		it("should decrement roundsRemaining on active states", () => {
			state.startCombat();
			state.activateState("rage"); // 10 rounds
			const rageState = state.getActiveStates().find(s => s.stateTypeId === "rage");
			expect(rageState.roundsRemaining).toBe(10);

			state.advanceRound();
			expect(rageState.roundsRemaining).toBe(9);

			state.advanceRound();
			expect(rageState.roundsRemaining).toBe(8);
		});

		it("should auto-deactivate states at 0 rounds and return expired names", () => {
			state.startCombat();
			state.activateState("dodge"); // 1 round
			const dodgeState = state.getActiveStates().find(s => s.stateTypeId === "dodge");
			expect(dodgeState.roundsRemaining).toBe(1);
			expect(dodgeState.active).toBe(true);

			const expired = state.advanceRound();
			expect(expired).toContain("Dodging");
			expect(dodgeState.active).toBe(false);
			expect(dodgeState.roundsRemaining).toBe(0);
		});

		it("should not affect states with null roundsRemaining (indefinite)", () => {
			state.startCombat();
			state.activateState("prone"); // "Until you stand up" → null rounds
			const proneState = state.getActiveStates().find(s => s.stateTypeId === "prone");
			expect(proneState.roundsRemaining).toBeNull();

			state.advanceRound();
			expect(proneState.active).toBe(true);
			expect(proneState.roundsRemaining).toBeNull();
		});

		it("should handle multiple states expiring at different times", () => {
			state.startCombat();
			state.activateState("dodge"); // 1 round
			state.activateState("rage"); // 10 rounds

			// Round 2: dodge should expire, rage should be at 9
			const expired = state.advanceRound();
			expect(expired).toContain("Dodging");
			expect(expired).not.toContain("Rage");

			const dodge = state.getActiveStates().find(s => s.stateTypeId === "dodge");
			const rage = state.getActiveStates().find(s => s.stateTypeId === "rage");
			expect(dodge.active).toBe(false);
			expect(rage.active).toBe(true);
			expect(rage.roundsRemaining).toBe(9);
		});

		it("should not decrement already-inactive states", () => {
			state.startCombat();
			state.activateState("rage");
			state.deactivateState("rage");
			const rage = state.getActiveStates().find(s => s.stateTypeId === "rage");
			const before = rage.roundsRemaining;

			state.advanceRound();
			// Inactive state should not be decremented
			expect(rage.roundsRemaining).toBe(before);
		});
	});

	// ==========================================================================
	// activateState integration with combat round tracking
	// ==========================================================================
	describe("activateState integration", () => {
		it("should set roundsRemaining when activating during combat", () => {
			state.startCombat();
			state.activateState("rage");
			const rage = state.getActiveStates().find(s => s.stateTypeId === "rage");
			expect(rage.roundsRemaining).toBe(10); // "1 minute" = 10 rounds
			expect(rage.activatedAtRound).toBe(1);
		});

		it("should NOT set roundsRemaining when activating outside combat", () => {
			state.activateState("rage");
			const rage = state.getActiveStates().find(s => s.stateTypeId === "rage");
			expect(rage.roundsRemaining).toBeNull();
			expect(rage.activatedAtRound).toBeNull();
		});

		it("should use state type duration when no explicit duration is passed", () => {
			state.startCombat();
			// Bladesong has "1 minute" = 10 rounds
			state.activateState("bladesong");
			const bs = state.getActiveStates().find(s => s.stateTypeId === "bladesong");
			expect(bs.roundsRemaining).toBe(10);
			expect(bs.duration).toBe("1 minute");
		});

		it("should use explicit duration over state type duration", () => {
			state.startCombat();
			state.activateState("concentration", {duration: "10 minutes", spellName: "Bless"});
			const conc = state.getActiveStates().find(s => s.stateTypeId === "concentration");
			expect(conc.roundsRemaining).toBe(100); // 10 min = 100 rounds
		});

		it("should re-parse duration when reactivating an existing state", () => {
			state.startCombat();
			state.activateState("dodge"); // 1 round
			const dodge = state.getActiveStates().find(s => s.stateTypeId === "dodge");
			state.advanceRound(); // expires
			expect(dodge.active).toBe(false);
			expect(dodge.roundsRemaining).toBe(0);

			// Reactivate via activateState
			state.activateState("dodge");
			expect(dodge.active).toBe(true);
			expect(dodge.roundsRemaining).toBe(1); // Reset to 1 round
		});
	});

	// ==========================================================================
	// toggleActiveState integration
	// ==========================================================================
	describe("toggleActiveState integration", () => {
		it("should set roundsRemaining when toggling ON during combat", () => {
			state.startCombat();
			// First create the state
			const stateId = state.addActiveState("rage", {});
			const rage = state.getActiveStates().find(s => s.id === stateId);
			// Deactivate it
			rage.active = false;

			// Toggle ON
			state.toggleActiveState(stateId);
			expect(rage.active).toBe(true);
			expect(rage.roundsRemaining).toBe(10);
			expect(rage.activatedAtRound).toBe(1);
		});

		it("should NOT set roundsRemaining when toggling ON outside combat", () => {
			const stateId = state.addActiveState("rage", {});
			const rage = state.getActiveStates().find(s => s.id === stateId);
			rage.active = false;

			state.toggleActiveState(stateId);
			expect(rage.active).toBe(true);
			expect(rage.roundsRemaining).toBeNull();
			expect(rage.activatedAtRound).toBeNull();
		});
	});

	// ==========================================================================
	// Full combat scenario
	// ==========================================================================
	describe("Full combat scenario", () => {
		it("should run a multi-round combat with multiple state expirations", () => {
			// Start combat
			state.startCombat();
			expect(state.getCombatRound()).toBe(1);

			// Round 1: activate Rage (10 rounds) and Dodge (1 round)
			state.activateState("rage");
			state.activateState("dodge");

			const rage = state.getActiveStates().find(s => s.stateTypeId === "rage");
			const dodge = state.getActiveStates().find(s => s.stateTypeId === "dodge");

			expect(rage.roundsRemaining).toBe(10);
			expect(dodge.roundsRemaining).toBe(1);

			// Round 2: dodge expires
			let expired = state.advanceRound();
			expect(state.getCombatRound()).toBe(2);
			expect(expired).toEqual(["Dodging"]);
			expect(dodge.active).toBe(false);
			expect(rage.roundsRemaining).toBe(9);

			// Advance through rounds 3-10 (8 more)
			for (let i = 0; i < 8; i++) {
				expired = state.advanceRound();
				expect(expired).toEqual([]);
			}
			expect(state.getCombatRound()).toBe(10);
			expect(rage.roundsRemaining).toBe(1);

			// Round 11: rage expires
			expired = state.advanceRound();
			expect(expired).toEqual(["Rage"]);
			expect(rage.active).toBe(false);
			expect(state.getCombatRound()).toBe(11);

			// End combat
			state.endCombat();
			expect(state.isInCombat()).toBe(false);
			expect(rage.roundsRemaining).toBeNull();
		});
	});
});
