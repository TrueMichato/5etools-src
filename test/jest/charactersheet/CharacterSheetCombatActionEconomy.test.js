import "./setup.js";
import "../../../js/charactersheet/charactersheet-combat.js";

const CharacterSheetCombat = globalThis.CharacterSheetCombat;

describe("CharacterSheetCombat action economy gating", () => {
	let combat;
	let inCombat;
	let toasts;
	let featureList;
	let useCustomAbilityCalls;

	beforeEach(() => {
		inCombat = true;
		toasts = [];
		useCustomAbilityCalls = 0;
		featureList = [];

		globalThis.JqueryUtil = {
			doToast: (payload) => toasts.push(payload),
		};

		const mockState = {
			isInCombat: () => inCombat,
			getFeatures: () => featureList,
			canUseCustomAbility: () => true,
			useCustomAbility: () => {
				useCustomAbilityCalls++;
				return true;
			},
		};

		combat = Object.create(CharacterSheetCombat.prototype);
		combat._state = mockState;
		combat._page = {
			_renderFeatures: () => {},
			_renderResources: () => {},
			_renderOverviewAbilities: () => {},
			_customAbilities: {render: () => {}},
			_saveCurrentCharacter: () => {},
		};
		combat.renderCombatActions = () => {};
		combat.renderCombatResources = () => {};
		combat._resetTurnActionUsage();
	});

	it("tracks Cunning Action as bonus action usage even without limited uses", () => {
		const feature = {
			name: "Cunning Action",
			source: "PHB",
			description: "You can take a bonus action on each of your turns to Dash, Disengage, or Hide.",
		};
		featureList.push(feature);

		combat._useCombatAction(feature);
		expect(combat._turnActionUsage.bonus).toBe(true);
		expect(toasts.some(t => t.type === "success")).toBe(true);
	});

	it("blocks reusing the same bonus action in the same combat round", () => {
		const feature = {
			name: "Cunning Action",
			source: "PHB",
			description: "You can take a bonus action on each of your turns to Dash, Disengage, or Hide.",
		};
		featureList.push(feature);

		combat._useCombatAction(feature);
		combat._useCombatAction(feature);

		const warningToasts = toasts.filter(t => t.type === "warning");
		expect(warningToasts.some(t => /bonus action/i.test(t.content))).toBe(true);
	});

	it("resets per-turn action economy on round reset", () => {
		combat._consumeActionType("bonus");
		expect(combat._isActionTypeAvailable("bonus")).toBe(false);

		combat._resetTurnActionUsage();
		expect(combat._isActionTypeAvailable("bonus")).toBe(true);
	});

	it("gates limited custom abilities by action economy", () => {
		const ability = {
			id: "ab1",
			name: "Shadow Jaunt",
			activationAction: "bonus",
		};

		combat._useCustomAbility(ability);
		combat._useCustomAbility(ability);

		expect(useCustomAbilityCalls).toBe(1);
		expect(toasts.some(t => t.type === "warning" && /bonus action/i.test(t.content))).toBe(true);
	});

	it("does not enforce action gating outside combat", () => {
		inCombat = false;
		combat._consumeActionType("bonus");
		expect(combat._isActionTypeAvailable("bonus")).toBe(true);
	});

	it("uses interaction mode to render Use/Activate labels", () => {
		expect(combat._getActivationButtonText({activationInfo: {interactionMode: "toggle"}})).toBe("Activate");
		expect(combat._getActivationButtonText({activationInfo: {interactionMode: "limited"}})).toBe("Use");
		expect(combat._getActivationButtonText({activationInfo: {interactionMode: "trigger"}})).toBe("Use");
		expect(combat._getActivationButtonText({activationInfo: {interactionMode: "instant"}})).toBe("Use");
		expect(combat._getActivationButtonText({activationInfo: {isToggle: true}})).toBe("Activate");
		expect(combat._getActivationButtonText({activationInfo: null})).toBe("Use");
	});

	it("forwards activationInfo through combat activation helper", () => {
		let callArgs = null;
		combat._page._activateFeatureState = (...args) => {
			callArgs = args;
		};
		combat._page._renderActiveStates = () => {};
		combat.renderCombatStates = () => {};

		const feature = {name: "Sneak Attack Trigger"};
		const stateTypeId = "custom";
		const stateType = {icon: "⚡"};
		const resource = {id: "r1", current: 1, max: 1};
		const resourceCost = 1;
		const activationInfo = {interactionMode: "trigger", effects: [{type: "extraDamage", value: "2d6"}]};

		combat._activateCombatFeature(feature, stateTypeId, stateType, resource, resourceCost, activationInfo);

		expect(callArgs).not.toBeNull();
		expect(callArgs[0]).toBe(feature);
		expect(callArgs[1]).toBe(stateTypeId);
		expect(callArgs[2]).toBe(stateType);
		expect(callArgs[3]).toBe(resource);
		expect(callArgs[4]).toBe(resourceCost);
		expect(callArgs[5]).toBe(activationInfo);
	});
});
