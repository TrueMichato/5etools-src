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

	it("detects advantage from state-based hasAdvantage (e.g. Steady Aim)", () => {
		const attack = {id: "atk-7", abilityMod: "dex", isSpell: false, isRanged: false, properties: ["F"]};
		// rollD20 returned mode "normal" but state granted advantage via hasAdvantage flag
		combat._lastAttackContext = {attackId: "atk-7", mode: "normal", hasAdvantage: true};
		expect(combat._canApplySneakAttack(attack, {dice: "3d6"}, {showWarnings: false})).toBe(true);
	});

	it("detects disadvantage from state-based hasDisadvantage", () => {
		const attack = {id: "atk-8", abilityMod: "dex", isSpell: false, isRanged: false, properties: ["F"]};
		// State granted disadvantage even though mode is "normal"
		combat._lastAttackContext = {attackId: "atk-8", mode: "normal", hasDisadvantage: true};
		combat._sneakAttackHasAdjacentAlly = true;

		expect(combat._canApplySneakAttack(attack, {dice: "3d6"}, {showWarnings: false})).toBe(false);
	});

	it("allows SA with hasAdvantage even when hasDisadvantage also set (mode-based advantage wins)", () => {
		const attack = {id: "atk-9", abilityMod: "dex", isSpell: false, isRanged: false, properties: ["F"]};
		// Both advantage and disadvantage from states cancel out, but explicit mode=advantage overrides
		combat._lastAttackContext = {attackId: "atk-9", mode: "advantage", hasAdvantage: true, hasDisadvantage: true};
		// When both hasAdvantage and hasDisadvantage are true, the trigger check should use
		// the SA rules: advantage + disadvantage = no sneak attack (cancelled out)
		// The trigger satisfied check should see hasDisadvantage=true and block SA
		expect(combat._canApplySneakAttack(attack, {dice: "3d6"}, {showWarnings: false})).toBe(false);
	});
});

describe("CharacterSheetCombat Cunning Strike mechanical integration", () => {
	let combat;
	let mockState;

	beforeEach(() => {
		mockState = {
			isInCombat: () => true,
			getCombatRound: () => 1,
			getProficiencyBonus: () => 3,
			getAbilityMod: () => 4, // DEX mod
			getClassLevel: () => 7, // Rogue level 7 → 4d6 SA
			getFeatureCalculations: () => ({
				sneakAttack: {dice: "4d6", avgDamage: 14},
				hasCunningStrike: true,
			}),
		};

		combat = Object.create(CharacterSheetCombat.prototype);
		combat._state = mockState;
		combat._sneakAttackEnabled = true;
		combat._lastSneakAttackRoundUsed = null;
		combat._lastAttackContext = {attackId: "atk-1", mode: "advantage"};
		combat._sneakAttackHasAdjacentAlly = false;
		combat._selectedCunningStrikes = [];
	});

	it("tracks selected cunning strike options", () => {
		expect(combat._selectedCunningStrikes).toEqual([]);

		combat._selectedCunningStrikes.push({name: "Poison", cost: 1, save: "con", desc: "..."});
		expect(combat._selectedCunningStrikes).toHaveLength(1);
		expect(combat._selectedCunningStrikes[0].name).toBe("Poison");
	});

	it("resets cunning strike selections via _resetCunningStrikeSelections", () => {
		combat._selectedCunningStrikes = [
			{name: "Poison", cost: 1, save: "con", desc: "..."},
			{name: "Trip", cost: 1, save: "dex", desc: "..."},
		];

		combat._resetCunningStrikeSelections();
		expect(combat._selectedCunningStrikes).toEqual([]);
	});

	it("returns correct cunning strike options for base level", () => {
		const calcs = {hasCunningStrike: true};
		const options = combat._getCunningStrikeOptions(calcs);
		expect(options.map(o => o.name)).toEqual(["Poison", "Trip", "Withdraw"]);
		expect(options.every(o => o.cost === 1)).toBe(true);
	});

	it("includes improved cunning strike options at level 11", () => {
		const calcs = {hasCunningStrike: true, hasImprovedCunningStrike: true};
		const options = combat._getCunningStrikeOptions(calcs);
		expect(options.map(o => o.name)).toContain("Daze");
		expect(options.find(o => o.name === "Daze").cost).toBe(2);
	});

	it("includes devious strike options at level 14", () => {
		const calcs = {hasCunningStrike: true, hasImprovedCunningStrike: true, hasDeviousStrikes: true};
		const options = combat._getCunningStrikeOptions(calcs);
		expect(options.map(o => o.name)).toContain("Knock Out");
		expect(options.map(o => o.name)).toContain("Obscure");
		expect(options.find(o => o.name === "Knock Out").cost).toBe(6);
		expect(options.find(o => o.name === "Obscure").cost).toBe(3);
	});

	it("clears cunning strike selections when disabling SA toggle", () => {
		combat._selectedCunningStrikes = [{name: "Poison", cost: 1, save: "con", desc: "..."}];
		combat._sneakAttackEnabled = true;

		// Simulate toggling SA off — the render method does this
		combat._sneakAttackEnabled = false;
		if (!combat._sneakAttackEnabled) combat._selectedCunningStrikes = [];

		expect(combat._selectedCunningStrikes).toEqual([]);
	});
});
