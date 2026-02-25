import "./setup.js";
import "../../../js/charactersheet/charactersheet-combat.js";

const CharacterSheetCombat = globalThis.CharacterSheetCombat;

describe("CharacterSheetCombat Sneak Attack gating", () => {
	let combat;
	let mockState;
	let inCombat;
	let currentRound;

	beforeEach(() => {
		inCombat = true;
		currentRound = 1;
		mockState = {
			isInCombat: () => inCombat,
			getCombatRound: () => currentRound,
		};

		combat = Object.create(CharacterSheetCombat.prototype);
		combat._state = mockState;
		combat._sneakAttackEnabled = true;
		combat._lastSneakAttackRoundUsed = null;
		combat._lastAttackContext = null;
		combat._sneakAttackHasAdjacentAlly = false;
	});

	it("allows finesse attacks for Sneak Attack when attack has advantage", () => {
		const attack = {id: "atk-1", abilityMod: "dex", isSpell: false, isRanged: false, properties: ["F"]};
		combat._lastAttackContext = {attackId: "atk-1", mode: "advantage"};
		expect(combat._canApplySneakAttack(attack, {dice: "3d6"}, {showWarnings: false})).toBe(true);
	});

	it("allows ranged attacks for Sneak Attack when adjacent ally trigger is set", () => {
		const attack = {id: "atk-2", abilityMod: "str", isSpell: false, isRanged: true, properties: []};
		combat._sneakAttackHasAdjacentAlly = true;
		expect(combat._canApplySneakAttack(attack, {dice: "3d6"}, {showWarnings: false})).toBe(true);
	});

	it("blocks non-finesse non-ranged weapon attacks", () => {
		const attack = {abilityMod: "str", isSpell: false, isRanged: false, properties: []};
		expect(combat._canApplySneakAttack(attack, {dice: "3d6"}, {showWarnings: false})).toBe(false);
	});

	it("enforces once-per-round in combat", () => {
		const attack = {id: "atk-3", abilityMod: "dex", isSpell: false, isRanged: false, properties: ["F"]};
		combat._lastAttackContext = {attackId: "atk-3", mode: "advantage"};
		expect(combat._canApplySneakAttack(attack, {dice: "3d6"}, {showWarnings: false})).toBe(true);

		combat._markSneakAttackUsedThisTurn();
		expect(combat._canApplySneakAttack(attack, {dice: "3d6"}, {showWarnings: false})).toBe(false);

		currentRound = 2;
		expect(combat._canApplySneakAttack(attack, {dice: "3d6"}, {showWarnings: false})).toBe(true);
	});

	it("blocks sneak attack when attack has disadvantage", () => {
		const attack = {id: "atk-4", abilityMod: "dex", isSpell: false, isRanged: false, properties: ["F"]};
		combat._lastAttackContext = {attackId: "atk-4", mode: "disadvantage"};
		combat._sneakAttackHasAdjacentAlly = true;

		expect(combat._canApplySneakAttack(attack, {dice: "3d6"}, {showWarnings: false})).toBe(false);
	});

	it("requires advantage or adjacent ally trigger", () => {
		const attack = {id: "atk-5", abilityMod: "dex", isSpell: false, isRanged: false, properties: ["F"]};
		combat._lastAttackContext = {attackId: "atk-5", mode: "normal"};

		expect(combat._canApplySneakAttack(attack, {dice: "3d6"}, {showWarnings: false})).toBe(false);
	});

	it("does not enforce round lock outside combat", () => {
		inCombat = false;
		combat._lastSneakAttackRoundUsed = 1;
		combat._sneakAttackHasAdjacentAlly = true;

		const attack = {id: "atk-6", abilityMod: "dex", isSpell: false, isRanged: false, properties: ["F"]};
		expect(combat._canApplySneakAttack(attack, {dice: "3d6"}, {showWarnings: false})).toBe(true);
	});
});
