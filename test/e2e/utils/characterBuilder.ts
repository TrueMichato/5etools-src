import {Page} from "@playwright/test";
import {CharacterSheetPage} from "../pages/CharacterSheetPage";
import {BuilderWizardPage} from "../pages/BuilderWizardPage";

/**
 * Character build presets for use across E2E tests.
 * Each preset defines the wizard selections needed to create a character.
 */
export interface CharacterPreset {
	race: string;
	raceSource: string;
	className: string;
	classSource: string;
	background: string;
	bgSource: string;
	name: string;
	skillCount?: number;
	masteryCount?: number;
	optFeatCount?: number;
}

/** Simple Fighter — minimal selections, fastest to create */
export const PRESET_FIGHTER: CharacterPreset = {
	race: "Aarakocra",
	raceSource: "MPMM",
	className: "Fighter",
	classSource: "PHB'24",
	background: "Soldier",
	bgSource: "PHB'24",
	name: "Test Fighter",
	skillCount: 2,
	masteryCount: 3,
	optFeatCount: 1,
};

/** Cleric — tests Divine Order optional feature + feature options */
export const PRESET_CLERIC: CharacterPreset = {
	race: "Dwarf",
	raceSource: "PHB'24",
	className: "Cleric",
	classSource: "PHB'24",
	background: "Acolyte",
	bgSource: "PHB'24",
	name: "Test Cleric",
	skillCount: 2,
	optFeatCount: 1,
};

/** Bard — spellcaster with known spells */
export const PRESET_BARD: CharacterPreset = {
	race: "Aarakocra",
	raceSource: "MPMM",
	className: "Bard",
	classSource: "PHB'24",
	background: "Entertainer",
	bgSource: "PHB'24",
	name: "Test Bard",
	skillCount: 3,
};

/**
 * Build a complete character via the Builder Wizard UI.
 * Returns the CharacterSheetPage for further interaction.
 */
export async function createCharacterViaWizard (
	page: Page,
	preset: CharacterPreset = PRESET_FIGHTER,
): Promise<{charSheet: CharacterSheetPage; builder: BuilderWizardPage}> {
	const charSheet = new CharacterSheetPage(page);
	const builder = new BuilderWizardPage(page);

	await charSheet.goto();
	await charSheet.switchToTab(charSheet.tabBuilder);

	// Step 1: Race
	await builder.selectRaceExact(preset.race, preset.raceSource);
	await page.waitForTimeout(300);
	await builder.clickNext();

	// Step 2: Class
	await builder.selectClassExact(preset.className, preset.classSource);
	await page.waitForTimeout(500);
	if (preset.skillCount) {
		await builder.selectFirstAvailableSkills(preset.skillCount);
	}
	if (preset.masteryCount) {
		await builder.selectFirstAvailableWeaponMasteries(preset.masteryCount);
	}
	if (preset.optFeatCount) {
		await builder.selectFirstAvailableOptionalFeatures(preset.optFeatCount);
	}
	// Always try feature options (harmless if none exist)
	await builder.selectFirstAvailableFeatureOptions(10);
	await builder.clickNext();

	// Step 3: Abilities
	await builder.assignStandardArrayDefaults();
	await builder.clickNext();

	// Step 4: Background
	await builder.selectBackgroundExact(preset.background, preset.bgSource);
	await builder.clickNext();

	// Step 5: Equipment — take gold (simplest)
	await builder.selectEquipmentOption("gold");
	await builder.clickNext();

	// Step 6: Details
	await builder.fillDetails({name: preset.name});
	await builder.finishWizard();

	return {charSheet, builder};
}
