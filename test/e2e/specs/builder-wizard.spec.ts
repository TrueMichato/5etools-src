import {expect, test} from "@playwright/test";
import {CharacterSheetPage} from "../pages/CharacterSheetPage";
import {BuilderWizardPage} from "../pages/BuilderWizardPage";
import {clearCharacterStorage} from "../utils/characterStorage";

test.describe("Builder Wizard", () => {
	test.beforeEach(async ({page}) => {
		// Clear any existing character data
		await clearCharacterStorage(page);
	});

	test("should create a Human Fighter through the wizard", async ({page}) => {
		const charSheet = new CharacterSheetPage(page);
		const builder = new BuilderWizardPage(page);

		// Navigate to character sheet
		await charSheet.goto();

		// Should start on builder tab for new character
		await charSheet.switchToTab(charSheet.tabBuilder);
		await expect(builder.wizardContainer).toBeVisible();

		// Step 1: Select Race - Aarakocra (simple race with no subraces or extra selections)
		await builder.selectRaceExact("Aarakocra", "MPMM");
		// Wait a moment for selection to register
		await page.waitForTimeout(500);
		await builder.clickNext();

		// Step 2: Select Class - Fighter
		let step = await builder.getCurrentStep();
		expect(step).toBe(2); // Verify we're on Class step
		
		await builder.selectClassExact("Fighter", "PHB'24");
		// Wait for class preview to appear
		await page.waitForTimeout(500);
		// Select skills if required (Fighter needs 2 skills)
		await builder.selectFirstAvailableSkills(2);
		// Select weapon masteries if required (Fighter PHB'24 needs 3)
		await builder.selectFirstAvailableWeaponMasteries(3);
		// Select optional features if required (Fighter PHB'24 gets Fighting Style at level 1)
		await builder.selectFirstAvailableOptionalFeatures(1);
		await builder.clickNext();

		// Step 3: Abilities - use standard array
		step = await builder.getCurrentStep();
		expect(step).toBe(3); // Verify we advanced to Abilities step
		
		// For standard array, we need to assign ability scores - use a simple assignment for smoke test
		await builder.assignStandardArrayDefaults();
		await builder.clickNext();

		// Step 4: Background - Soldier
		step = await builder.getCurrentStep();
		expect(step).toBe(4); // Verify we advanced to Background step
		
		await builder.selectBackgroundExact("Soldier", "PHB'24");
		await builder.clickNext();

		// Step 5: Equipment - take starting gold
		await builder.selectEquipmentOption("gold");
		await builder.clickNext();

		// Step 6: Details - enter name and finish
		await builder.fillDetails({
			name: "Test Aarakocra Fighter",
		});
		await builder.finishWizard();

		// Verify character was created
		await builder.expectWizardComplete();
		await charSheet.expectCharacterName("Test Aarakocra Fighter");
		await charSheet.expectLevel(1);
	});

	test("should allow navigating between steps", async ({page}) => {
		const charSheet = new CharacterSheetPage(page);
		const builder = new BuilderWizardPage(page);

		await charSheet.goto();
		await charSheet.switchToTab(charSheet.tabBuilder);

		// Start on step 1
		let step = await builder.getCurrentStep();
		expect(step).toBe(1);

		// Select a race (use Aarakocra - no subraces needed) and go to step 2
		await builder.selectRaceExact("Aarakocra", "MPMM");
		await builder.clickNext();
		step = await builder.getCurrentStep();
		expect(step).toBe(2);

		// Go back to step 1
		await builder.clickPrev();
		step = await builder.getCurrentStep();
		expect(step).toBe(1);

		// Race should still be selected
		const selectedRace = builder.raceList.locator(".charsheet__builder-list-item.active");
		await expect(selectedRace).toBeVisible();
	});

	test("should show subrace options for elves", async ({page}) => {
		const charSheet = new CharacterSheetPage(page);
		const builder = new BuilderWizardPage(page);

		await charSheet.goto();
		await charSheet.switchToTab(charSheet.tabBuilder);

		// Select Elf PHB'24 (which has 3 subraces: Drow, High Elf, Wood Elf)
		await builder.selectRaceExact("Elf", "PHB'24");
		await page.waitForTimeout(300);

		// Should show subrace selection
		const hasSubraces = await builder.hasSubraceSelection();
		expect(hasSubraces).toBe(true);
	});

	test("should create a Dwarf Cleric", async ({page}) => {
		const charSheet = new CharacterSheetPage(page);
		const builder = new BuilderWizardPage(page);

		await charSheet.goto();
		await charSheet.switchToTab(charSheet.tabBuilder);

		// Step 1: Dwarf PHB'24 (no subraces in 2024 rules)
		await builder.selectRaceExact("Dwarf", "PHB'24");
		await page.waitForTimeout(300);
		await builder.clickNext();

		// Step 2: Cleric PHB'24
		let step = await builder.getCurrentStep();
		expect(step).toBe(2); // Verify we're on Class step
		
		await builder.selectClassExact("Cleric", "PHB'24");
		await page.waitForTimeout(500);
		// Select skills (Cleric gets 2)
		await builder.selectFirstAvailableSkills(2);
		// Select Divine Order (Holy Order in PHB'24) - this is an optional feature
		await builder.selectFirstAvailableOptionalFeatures(1);
		// Select any feature options (specialties) if present
		await builder.selectFirstAvailableFeatureOptions(10); // Select up to 10 to cover any requirements
		await builder.clickNext();

		// Step 3: Abilities - assign standard array
		step = await builder.getCurrentStep();
		expect(step).toBe(3); // Verify we advanced to Abilities step
		
		await builder.assignStandardArrayDefaults();
		await builder.clickNext();

		// Step 4: Background
		step = await builder.getCurrentStep();
		expect(step).toBe(4); // Verify we advanced to Background step
		
		await builder.selectBackgroundExact("Acolyte", "PHB'24");
		await builder.clickNext();

		// Step 5: Equipment
		await builder.selectEquipmentOption("gold");
		await builder.clickNext();

		// Step 6: Details
		await builder.fillDetails({name: "Dwarf Cleric Test"});
		await builder.finishWizard();

		await charSheet.expectCharacterName("Dwarf Cleric Test");
	});
});

test.describe("Builder Wizard - Edge Cases", () => {
	test.beforeEach(async ({page}) => {
		await clearCharacterStorage(page);
	});

	test("should handle searching for races", async ({page}) => {
		const charSheet = new CharacterSheetPage(page);
		const builder = new BuilderWizardPage(page);

		await charSheet.goto();
		await charSheet.switchToTab(charSheet.tabBuilder);

		// Type in search to filter races
		await builder.raceSearchInput.fill("half");

		// Should filter to show Half-Elf, Half-Orc, Halfling
		const visibleItems = builder.raceList.locator(".charsheet__builder-list-item:visible");
		const count = await visibleItems.count();
		expect(count).toBeGreaterThan(0);
		expect(count).toBeLessThan(20); // Should be filtered down
	});

	test("should handle searching for classes", async ({page}) => {
		const charSheet = new CharacterSheetPage(page);
		const builder = new BuilderWizardPage(page);

		await charSheet.goto();
		await charSheet.switchToTab(charSheet.tabBuilder);

		// Select race first (use Aarakocra - no additional selections needed)
		await builder.selectRaceExact("Aarakocra", "MPMM");
		await page.waitForTimeout(300);
		await builder.clickNext();

		// Verify we're on class step
		const step = await builder.getCurrentStep();
		expect(step).toBe(2);

		// Search for wizard
		await builder.classSearchInput.fill("wiz");

		// Should show Wizard
		const wizardItem = builder.classList.locator(".charsheet__builder-list-item").filter({hasText: "Wizard"});
		await expect(wizardItem.first()).toBeVisible();
	});
});
