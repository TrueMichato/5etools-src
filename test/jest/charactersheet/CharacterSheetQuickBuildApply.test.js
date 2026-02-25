import "./setup.js";
import {jest} from "@jest/globals";
import "../../../js/charactersheet/charactersheet-class-utils.js";
import "../../../js/charactersheet/charactersheet-quickbuild.js";

const CharacterSheetQuickBuild = globalThis.CharacterSheetQuickBuild;
const CharacterSheetClassUtils = globalThis.CharacterSheetClassUtils;

describe("CharacterSheetQuickBuild _applyQuickBuild", () => {
	test("does not throw when there are no analyzed levels", async () => {
		const originalUpdateRacialSpells = CharacterSheetClassUtils.updateRacialSpells;
		CharacterSheetClassUtils.updateRacialSpells = jest.fn();

		const state = {
			getAbilityMod: jest.fn(() => 2),
			setWeaponMasteries: jest.fn(),
			setCombatTraditions: jest.fn(),
			getCombatTraditions: jest.fn(() => []),
			getWeaponMasteries: jest.fn(() => []),
			recordLevelChoice: jest.fn(),
			updateLevelChoice: jest.fn(() => true),
			addSpell: jest.fn(),
			addCantrip: jest.fn(),
			ensureXpMatchesLevel: jest.fn(),
			applyClassFeatureEffects: jest.fn(),
			calculateSpellSlots: jest.fn(),
			recalculateAllCompanions: jest.fn(),
		};

		const page = {
			saveCharacter: jest.fn(async () => {}),
			renderCharacter: jest.fn(),
			_updateTabVisibility: jest.fn(),
		};

		const qb = Object.create(CharacterSheetQuickBuild.prototype);
		qb._state = state;
		qb._page = page;
		qb._levelAnalysis = [];
		qb._classAllocations = [];
		qb._targetLevel = 1;
		qb._fromLevel = 1;
		qb._selections = {
			subclasses: {},
			asi: {},
			optionalFeatures: {},
			featureOptions: {},
			expertise: {},
			languages: {},
			scholarSkill: null,
			spellbookSpells: [],
			knownSpells: [],
			knownCantrips: [],
			hpMethod: "average",
			hpRolls: {},
			weaponMasteries: [],
			_combatTraditions: [],
		};

		globalThis.JqueryUtil = {
			doToast: jest.fn(),
		};

		await expect(qb._applyQuickBuild()).resolves.toBeUndefined();
		expect(state.recordLevelChoice).not.toHaveBeenCalled();
		expect(page.saveCharacter).toHaveBeenCalled();

		CharacterSheetClassUtils.updateRacialSpells = originalUpdateRacialSpells;
	});
});
