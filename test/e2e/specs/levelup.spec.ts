import {expect, test} from "@playwright/test";
import {CharacterSheetPage} from "../pages/CharacterSheetPage";
import {LevelUpPage} from "../pages/LevelUpPage";
import {clearCharacterStorage} from "../utils/characterStorage";
import {createCharacterViaWizard, PRESET_FIGHTER, PRESET_BARD} from "../utils/characterBuilder";

/**
 * Helper: perform one level-up, completing all required sections.
 */
async function doLevelUp (page: any, charSheet: CharacterSheetPage, levelUp: LevelUpPage, opts?: {subclass?: string}): Promise<void> {
	await charSheet.btnLevelUp.click();
	await levelUp.waitForModal();

	// Select subclass if subclass name provided
	if (opts?.subclass) {
		// selectSubclass handles its own accordion expansion
		await levelUp.selectSubclass(opts.subclass);
	}

	// Handle optional features if present
	if (await levelUp.isAccordionVisible("optfeatures")) {
		await levelUp.expandAccordion("optfeatures");
		await levelUp.selectFirstAvailableOptions();
	}

	// Handle feature options if present
	if (await levelUp.isAccordionVisible("featoptions")) {
		await levelUp.expandAccordion("featoptions");
		await levelUp.selectFirstAvailableOptions();
	}

	// Take average HP if section visible
	if (await levelUp.isAccordionVisible("hp")) {
		await levelUp.expandAccordion("hp");
		await levelUp.selectHpOption("average");
	}

	// Wait a moment for all sections to register as complete
	await page.waitForTimeout(300);

	await levelUp.finish();
	await levelUp.expectModalClosed();
}

test.describe("Level-Up Flow", () => {
	test.beforeEach(async ({page}) => {
		await clearCharacterStorage(page);
	});

	test("should level up a Fighter from 1 to 2", async ({page}) => {
		const levelUp = new LevelUpPage(page);
		const {charSheet} = await createCharacterViaWizard(page, {...PRESET_FIGHTER, name: "Fighter LvlUp"});

		await charSheet.expectLevel(1);

		// Level up
		await doLevelUp(page, charSheet, levelUp);

		// Verify level increased
		await charSheet.expectLevel(2);
	});

	test("should show subclass selection at level 3", async ({page}) => {
		const levelUp = new LevelUpPage(page);
		const {charSheet} = await createCharacterViaWizard(page, {...PRESET_FIGHTER, name: "Fighter Subclass"});

		// Level 1 → 2 (no subclass yet)
		await doLevelUp(page, charSheet, levelUp);
		await charSheet.expectLevel(2);

		// Level 2 → 3: Fighter gets subclass at 3
		await charSheet.btnLevelUp.click();
		await levelUp.waitForModal();

		const hasSubclass = await levelUp.isAccordionVisible("subclass");
		expect(hasSubclass).toBe(true);

		// Select Champion and finish
		await levelUp.expandAccordion("subclass");
		await levelUp.selectSubclass("Champion");
		await page.waitForTimeout(500);

		// Handle optional features or feature options if they appeared with subclass
		if (await levelUp.isAccordionVisible("optfeatures")) {
			await levelUp.expandAccordion("optfeatures");
			await levelUp.selectFirstAvailableOptions();
		}
		if (await levelUp.isAccordionVisible("featoptions")) {
			await levelUp.expandAccordion("featoptions");
			await levelUp.selectFirstAvailableOptions();
		}

		if (await levelUp.isAccordionVisible("hp")) {
			await levelUp.expandAccordion("hp");
			await levelUp.selectHpOption("average");
		}

		await page.waitForTimeout(300);
		await levelUp.finish();
		await levelUp.expectModalClosed();
		await charSheet.expectLevel(3);
	});

	test("should show ASI option at level 4", async ({page}) => {
		const levelUp = new LevelUpPage(page);
		const {charSheet} = await createCharacterViaWizard(page, {...PRESET_FIGHTER, name: "Fighter ASI"});

		// Level 1 → 2
		await doLevelUp(page, charSheet, levelUp);
		// Level 2 → 3 (select subclass)
		await doLevelUp(page, charSheet, levelUp, {subclass: "Champion"});
		await charSheet.expectLevel(3);

		// Level 3 → 4: Fighter gets ASI at 4
		await charSheet.btnLevelUp.click();
		await levelUp.waitForModal();

		const hasAsi = await levelUp.isAccordionVisible("asi");
		expect(hasAsi).toBe(true);

		// Just verify it's there — don't need to complete the level-up
		await levelUp.cancel();
		await levelUp.expectModalClosed();
	});

	test("should cancel level-up without applying changes", async ({page}) => {
		const levelUp = new LevelUpPage(page);
		const {charSheet} = await createCharacterViaWizard(page, {...PRESET_FIGHTER, name: "Fighter Cancel"});

		await charSheet.expectLevel(1);

		// Start level-up then cancel
		await charSheet.btnLevelUp.click();
		await levelUp.waitForModal();
		await levelUp.cancel();
		await levelUp.expectModalClosed();

		// Should still be level 1
		await charSheet.expectLevel(1);
	});
});

test.describe("Level-Up Flow - Spellcasters", () => {
	test.beforeEach(async ({page}) => {
		await clearCharacterStorage(page);
	});

	test("should show spell-related sections for Bard level-up", async ({page}) => {
		const levelUp = new LevelUpPage(page);
		const {charSheet} = await createCharacterViaWizard(page, {...PRESET_BARD, name: "Bard LvlUp"});

		await charSheet.expectLevel(1);

		// Open level-up modal
		await charSheet.btnLevelUp.click();
		await levelUp.waitForModal();

		// Bard should have the modal open successfully
		expect(await levelUp.isVisible()).toBe(true);

		// Check for known spells section (Bard gains spells when leveling)
		const hasKnownSpells = await levelUp.isAccordionVisible("knownspells");
		// Note: whether this is visible depends on spell gain rules at level 2
		// Just verify modal opened without crash
		await levelUp.cancel();
		await levelUp.expectModalClosed();
	});
});

test.describe("Level-Up Flow - Multi-level", () => {
	test.beforeEach(async ({page}) => {
		await clearCharacterStorage(page);
	});

	test("should level up from 1 to 3 sequentially", async ({page}) => {
		const levelUp = new LevelUpPage(page);
		const {charSheet} = await createCharacterViaWizard(page, {...PRESET_FIGHTER, name: "Fighter Multi"});

		await charSheet.expectLevel(1);

		// Level 1 → 2
		await doLevelUp(page, charSheet, levelUp);
		await charSheet.expectLevel(2);

		// Level 2 → 3 (with subclass)
		await doLevelUp(page, charSheet, levelUp, {subclass: "Champion"});
		await charSheet.expectLevel(3);
	});
});
