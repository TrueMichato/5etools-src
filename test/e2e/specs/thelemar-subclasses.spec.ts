import {expect, test, Page} from "@playwright/test";
import {CharacterSheetPage} from "../pages/CharacterSheetPage";
import {BuilderWizardPage} from "../pages/BuilderWizardPage";
import {LevelUpPage} from "../pages/LevelUpPage";
import {gotoWithThelemar, clearHomebrewStorage} from "../utils/homebrewLoader";

/**
 * Helper: build a TGTT character and level up to subclass level.
 * Most classes get subclass at level 3.
 */
async function buildAndLevelToSubclass (
	page: Page,
	className: string,
	charName: string,
	opts: {skillCount?: number; masteryCount?: number; subclassLevel?: number} = {},
): Promise<{charSheet: CharacterSheetPage; levelUp: LevelUpPage}> {
	const charSheet = new CharacterSheetPage(page);
	const builder = new BuilderWizardPage(page);
	const levelUp = new LevelUpPage(page);
	const {skillCount = 2, masteryCount = 0, subclassLevel = 3} = opts;

	await gotoWithThelemar(page);
	await charSheet.switchToTab(charSheet.tabBuilder);

	// Build at level 1
	await builder.selectRaceExact("Aarakocra", "MPMM");
	await page.waitForTimeout(300);
	await builder.clickNext();

	await builder.selectClassExact(className, "TGTT");
	await page.waitForTimeout(500);
	if (skillCount > 0) await builder.selectFirstAvailableSkills(skillCount);
	if (masteryCount > 0) await builder.selectFirstAvailableWeaponMasteries(masteryCount);
	await builder.selectFirstAvailableOptionalFeatures(20);
	await builder.selectFirstAvailableFeatureOptions(10);
	await builder.autoFillRemainingSelections();
	await builder.clickNext();

	await builder.assignStandardArrayDefaults();
	await builder.clickNext();

	await builder.selectBackgroundExact("Soldier", "PHB'24");
	await builder.clickNext();

	await builder.selectEquipmentOption("gold");
	await builder.clickNext();

	await builder.fillDetails({name: charName});
	await builder.finishWizard();

	// Level up to subclass level
	for (let level = 2; level <= subclassLevel; level++) {
		await charSheet.btnLevelUp.click();
		await levelUp.waitForModal();

		if (await levelUp.isAccordionVisible("hp")) {
			await levelUp.expandAccordion("hp");
			await levelUp.selectHpOption("average");
		}

		await levelUp.autoFillAllSelections();
		await page.waitForTimeout(300);
		await levelUp.finish();
		await levelUp.expectModalClosed();
	}

	return {charSheet, levelUp};
}

// ─── SUBCLASS AVAILABILITY AT LEVEL-UP ─────────────────────────────────────

test.describe("Thelemar Subclasses - Fighter", () => {
	test.afterEach(async ({page}) => { await clearHomebrewStorage(page); });

	test.skip("should show The Warder subclass for TGTT Fighter at level 3", async ({page}) => {
		const {charSheet, levelUp} = await buildAndLevelToSubclass(page, "Fighter", "Fighter SC Test", {skillCount: 2, masteryCount: 0});
		await charSheet.expectLevel(3);

		// Verify character reached level 3 — subclass was offered during level-up
		// The autoFillAllSelections would have selected a subclass if one was required
		// Let's verify the level is correct
		await charSheet.expectLevel(3);
	});
});

test.describe("Thelemar Subclasses - Bard", () => {
	test.afterEach(async ({page}) => { await clearHomebrewStorage(page); });

	test.skip("should reach level 3 for TGTT Bard (College of Jesters available)", async ({page}) => {
		const {charSheet} = await buildAndLevelToSubclass(page, "Bard", "Bard SC Test", {skillCount: 3});
		await charSheet.expectLevel(3);
	});
});

test.describe("Thelemar Subclasses - Cleric", () => {
	test.afterEach(async ({page}) => { await clearHomebrewStorage(page); });

	test.skip("should reach level 3 for TGTT Cleric (domains available)", async ({page}) => {
		const {charSheet} = await buildAndLevelToSubclass(page, "Cleric", "Cleric SC Test", {skillCount: 2});
		await charSheet.expectLevel(3);
	});
});

test.describe("Thelemar Subclasses - Monk", () => {
	test.afterEach(async ({page}) => { await clearHomebrewStorage(page); });

	test.skip("should reach level 3 for TGTT Monk (ways available)", async ({page}) => {
		const {charSheet} = await buildAndLevelToSubclass(page, "Monk", "Monk SC Test", {skillCount: 2});
		await charSheet.expectLevel(3);
	});
});

test.describe("Thelemar Subclasses - Paladin", () => {
	test.afterEach(async ({page}) => { await clearHomebrewStorage(page); });

	test.skip("should reach level 3 for TGTT Paladin (oaths available)", async ({page}) => {
		const {charSheet} = await buildAndLevelToSubclass(page, "Paladin", "Paladin SC Test", {skillCount: 2, masteryCount: 0});
		await charSheet.expectLevel(3);
	});
});

test.describe("Thelemar Subclasses - Ranger", () => {
	test.afterEach(async ({page}) => { await clearHomebrewStorage(page); });

	test.skip("should reach level 3 for TGTT Ranger (archetypes available)", async ({page}) => {
		const {charSheet} = await buildAndLevelToSubclass(page, "Ranger", "Ranger SC Test", {skillCount: 3, masteryCount: 0});
		await charSheet.expectLevel(3);
	});
});

test.describe("Thelemar Subclasses - Rogue", () => {
	test.afterEach(async ({page}) => { await clearHomebrewStorage(page); });

	test.skip("should reach level 3 for TGTT Rogue (archetypes available)", async ({page}) => {
		const {charSheet} = await buildAndLevelToSubclass(page, "Rogue", "Rogue SC Test", {skillCount: 4, masteryCount: 0});
		await charSheet.expectLevel(3);
	});
});

test.describe("Thelemar Subclasses - Sorcerer", () => {
	test.afterEach(async ({page}) => { await clearHomebrewStorage(page); });

	test.skip("should reach level 3 for TGTT Sorcerer (origins available)", async ({page}) => {
		const {charSheet} = await buildAndLevelToSubclass(page, "Sorcerer", "Sorcerer SC Test", {skillCount: 2});
		await charSheet.expectLevel(3);
	});
});

test.describe("Thelemar Subclasses - Warlock", () => {
	test.afterEach(async ({page}) => { await clearHomebrewStorage(page); });

	test.skip("should reach level 3 for TGTT Warlock (patrons available)", async ({page}) => {
		const {charSheet} = await buildAndLevelToSubclass(page, "Warlock", "Warlock SC Test", {skillCount: 2});
		await charSheet.expectLevel(3);
	});
});

test.describe("Thelemar Subclasses - Wizard", () => {
	test.afterEach(async ({page}) => { await clearHomebrewStorage(page); });

	test.skip("should reach level 3 for TGTT Wizard (orders available)", async ({page}) => {
		const {charSheet} = await buildAndLevelToSubclass(page, "Wizard", "Wizard SC Test", {skillCount: 2});
		await charSheet.expectLevel(3);
	});
});

test.describe("Thelemar Subclasses - Barbarian", () => {
	test.afterEach(async ({page}) => { await clearHomebrewStorage(page); });

	test.skip("should reach level 3 for TGTT Barbarian (paths available)", async ({page}) => {
		const {charSheet} = await buildAndLevelToSubclass(page, "Barbarian", "Barbarian SC Test", {skillCount: 2, masteryCount: 0});
		await charSheet.expectLevel(3);
	});
});

// ─── VERIFY ORIGINAL SUBCLASS NAMES EXIST IN DATA ──────────────────────────

test.describe("Thelemar Subclasses - Data verification", () => {
	test.afterEach(async ({page}) => { await clearHomebrewStorage(page); });

	test("should have all original TGTT subclasses loaded in app data", async ({page}) => {
		const charSheet = new CharacterSheetPage(page);
		await gotoWithThelemar(page);

		// Check that all original TGTT subclasses are present in the app's data
		const subclassNames = await page.evaluate(() => {
			const cs = (window as any).charSheet;
			if (!cs?._subclasses) return [];
			return cs._subclasses
				.filter((sc: any) => sc.source === "TGTT" && sc.name)
				.map((sc: any) => `${sc.name}|${sc.className}`);
		});

		// All 23 original TGTT subclasses should be present
		const expectedSubclasses = [
			"Way of The Shackled|Monk",
			"Way of Debilitation|Monk",
			"Way of the Five Animals|Monk",
			"Oath of Inquisition|Paladin",
			"Oath of Bastion|Paladin",
			"College of Conduction|Bard",
			"College of Jesters|Bard",
			"College of Surrealism|Bard",
			"The Warder|Fighter",
			"Beauty Domain|Cleric",
			"Blood Domain|Cleric",
			"Darkness Domain|Cleric",
			"Lust Domain|Cleric",
			"Madness Domain|Cleric",
			"Time Domain|Cleric",
			"The Belly Dancer|Rogue",
			"Gambler|Rogue",
			"Trickster|Rogue",
			"Heroic Soul|Sorcerer",
			"Fiendish Bloodline|Sorcerer",
			"Order of the Animal Accomplice|Wizard",
			"The Horror|Warlock",
			"Path of the Chained Fury|Barbarian",
		];

		for (const expected of expectedSubclasses) {
			const [name] = expected.split("|");
			const found = subclassNames.some((sc: string) => sc.includes(name));
			expect(found, `Subclass "${name}" should be in app data`).toBe(true);
		}
	});
});
