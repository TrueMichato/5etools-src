import {Locator, Page, expect} from "@playwright/test";
import {waitForListItems} from "../utils/waitHelpers";

/**
 * Page Object Model for the Character Builder wizard
 * Provides methods to navigate through each step
 */
export class BuilderWizardPage {
	readonly page: Page;

	// Navigation
	readonly btnPrev: Locator;
	readonly btnNext: Locator;
	readonly wizardContainer: Locator;

	// Step indicators
	readonly stepIndicators: Locator;

	// Race step
	readonly raceSearchInput: Locator;
	readonly raceList: Locator;
	readonly racePreview: Locator;
	readonly subraceSelect: Locator;

	// Class step
	readonly classSearchInput: Locator;
	readonly classList: Locator;
	readonly classPreview: Locator;
	readonly subclassSelect: Locator;

	// Abilities step
	readonly abilityMethodSelect: Locator;

	// Background step
	readonly backgroundSearchInput: Locator;
	readonly backgroundList: Locator;
	readonly backgroundPreview: Locator;

	// Details step
	readonly nameInput: Locator;
	readonly personalityInput: Locator;
	readonly idealsInput: Locator;
	readonly bondsInput: Locator;
	readonly flawsInput: Locator;

	constructor (page: Page) {
		this.page = page;

		// Navigation
		this.btnPrev = page.locator("#charsheet-builder-prev");
		this.btnNext = page.locator("#charsheet-builder-next");
		this.wizardContainer = page.locator("#charsheet-builder");

		// Step indicators
		this.stepIndicators = page.locator(".charsheet__builder-step");

		// Race step
		this.raceSearchInput = page.locator("#builder-race-search");
		this.raceList = page.locator("#builder-race-list");
		this.racePreview = page.locator("#builder-race-preview");
		this.subraceSelect = page.locator("#builder-subrace-select");

		// Class step
		this.classSearchInput = page.locator("#builder-class-search");
		this.classList = page.locator("#builder-class-list");
		this.classPreview = page.locator("#builder-class-preview");
		this.subclassSelect = page.locator("#builder-subclass-select");

		// Abilities step
		this.abilityMethodSelect = page.locator('[data-testid="builder-ability-method"]');

		// Background step
		this.backgroundSearchInput = page.locator("#builder-bg-search");
		this.backgroundList = page.locator("#builder-bg-list");
		this.backgroundPreview = page.locator("#builder-bg-preview");

		// Details step
		this.nameInput = page.locator("#builder-name");
		this.personalityInput = page.locator("#builder-personality");
		this.idealsInput = page.locator("#builder-ideals");
		this.bondsInput = page.locator("#builder-bonds");
		this.flawsInput = page.locator("#builder-flaws");
	}

	/**
	 * Get the current step number (1-6)
	 */
	async getCurrentStep (): Promise<number> {
		const activeStep = this.page.locator(".charsheet__builder-step.active");
		const stepAttr = await activeStep.getAttribute("data-step");
		return parseInt(stepAttr || "1", 10);
	}

	/**
	 * Click Next to proceed to the next step
	 */
	async clickNext (): Promise<void> {
		await this.btnNext.click();
		// Wait for any toast messages (validation errors) or step change
		await this.page.waitForTimeout(500);
	}

	/**
	 * Click Previous to go back a step
	 */
	async clickPrev (): Promise<void> {
		await this.btnPrev.click();
		await this.page.waitForTimeout(200);
	}

	// ========== RACE STEP ==========

	/**
	 * Select a race by name from the list
	 */
	async selectRace (raceName: string): Promise<void> {
		await waitForListItems(this.page, "#builder-race-list");
		const raceItem = this.raceList.locator(`.charsheet__builder-list-item`).filter({
			has: this.page.locator(`.charsheet__builder-list-item-name`, {hasText: raceName}),
		});
		await raceItem.click();
		await this.page.waitForTimeout(100);
	}

	/**
	 * Select a race by exact name and source (e.g., "Human", "PHB")
	 */
	async selectRaceExact (raceName: string, sourceAbbv: string): Promise<void> {
		await waitForListItems(this.page, "#builder-race-list");
		// Find items with the source, then look for exact name match
		// The source element might have different formats, so be flexible
		const items = this.raceList.locator(`.charsheet__builder-list-item`);
		const count = await items.count();
		for (let i = 0; i < count; i++) {
			const item = items.nth(i);
			const nameEl = item.locator(`.charsheet__builder-list-item-name`);
			const sourceEl = item.locator(`.charsheet__builder-list-item-source`);
			const nameText = await nameEl.textContent() || "";
			const sourceText = await sourceEl.textContent() || "";
			// Match exact name (not containing subraces info) and source
			if (nameText.startsWith(raceName) && sourceText.includes(sourceAbbv)) {
				// Skip entries with subraces since we want the non-subrace version first
				if (!nameText.includes("subraces")) {
					// Scroll into view and click
					await item.scrollIntoViewIfNeeded();
					await item.click();
					await this.page.waitForTimeout(200);
					return;
				}
			}
		}
		// Fallback: try first match with subraces
		for (let i = 0; i < count; i++) {
			const item = items.nth(i);
			const nameEl = item.locator(`.charsheet__builder-list-item-name`);
			const sourceEl = item.locator(`.charsheet__builder-list-item-source`);
			const nameText = await nameEl.textContent() || "";
			const sourceText = await sourceEl.textContent() || "";
			if (nameText.startsWith(raceName) && sourceText.includes(sourceAbbv)) {
				await item.scrollIntoViewIfNeeded();
				await item.click();
				await this.page.waitForTimeout(200);
				return;
			}
		}
		throw new Error(`Could not find race "${raceName}" with source "${sourceAbbv}"`);
	}

	/**
	 * Select a subrace if the preview shows a subrace dropdown
	 */
	async selectSubrace (subraceName: string): Promise<void> {
		await this.subraceSelect.selectOption({label: subraceName});
		await this.page.waitForTimeout(100);
	}

	/**
	 * Check if subrace selection is available
	 */
	async hasSubraceSelection (): Promise<boolean> {
		return await this.subraceSelect.isVisible();
	}

	// ========== CLASS STEP ==========

	/**
	 * Select a class by name from the list
	 */
	async selectClass (className: string): Promise<void> {
		await waitForListItems(this.page, "#builder-class-list");
		const classItem = this.classList.locator(`.charsheet__builder-list-item`).filter({
			has: this.page.locator(`.charsheet__builder-list-item-name`, {hasText: className}),
		});
		await classItem.click();
		await this.page.waitForTimeout(100);
	}

	/**
	 * Select a class by exact name and source (e.g., "Fighter", "PHB")
	 */
	async selectClassExact (className: string, sourceAbbv: string): Promise<void> {
		await waitForListItems(this.page, "#builder-class-list");
		// Find items matching class name and source
		const items = this.classList.locator(`.charsheet__builder-list-item`);
		const count = await items.count();
		for (let i = 0; i < count; i++) {
			const item = items.nth(i);
			const nameEl = item.locator(`.charsheet__builder-list-item-name`);
			const sourceEl = item.locator(`.charsheet__builder-list-item-source`);
			const nameText = await nameEl.textContent() || "";
			const sourceText = await sourceEl.textContent() || "";
			if (nameText === className && sourceText.includes(sourceAbbv)) {
				await item.click();
				await this.page.waitForTimeout(100);
				return;
			}
		}
		throw new Error(`Could not find class "${className}" with source "${sourceAbbv}"`);
	}

	/**
	 * Select a subclass from the dropdown
	 */
	async selectSubclass (subclassName: string): Promise<void> {
		await this.subclassSelect.selectOption({label: subclassName});
		await this.page.waitForTimeout(100);
	}

	/**
	 * Check if subclass selection is available
	 */
	async hasSubclassSelection (): Promise<boolean> {
		return await this.subclassSelect.isVisible();
	}

	/**
	 * Select skill proficiency if available
	 */
	async selectSkillProficiency (skillName: string): Promise<void> {
		const checkbox = this.page.locator(`[data-testid="builder-skill-${skillName.toLowerCase()}"]`);
		if (await checkbox.isVisible()) {
			await checkbox.check();
		}
	}

	/**
	 * Select the first N available skill checkboxes (for class skill proficiency)
	 */
	async selectFirstAvailableSkills (count: number): Promise<void> {
		const skillCheckboxes = this.page.locator(".charsheet__builder-skill-checkbox input[type='checkbox']");
		const visibleCount = await skillCheckboxes.count();
		const toSelect = Math.min(count, visibleCount);
		for (let i = 0; i < toSelect; i++) {
			const checkbox = skillCheckboxes.nth(i);
			if (await checkbox.isVisible() && !(await checkbox.isChecked())) {
				await checkbox.check();
				await this.page.waitForTimeout(50);
			}
		}
	}

	/**
	 * Select the first N available weapon mastery checkboxes (for PHB'24 Fighter/other martial classes)
	 */
	async selectFirstAvailableWeaponMasteries (count: number): Promise<void> {
		// Weapon mastery checkboxes have a title attribute with "Mastery:"
		const masteryCheckboxes = this.page.locator(".charsheet__builder-skill-checkbox input[type='checkbox']").filter({
			has: this.page.locator("xpath=ancestor::label[@title]"),
		});
		// Fallback: look for weapon names in checkbox values (things like "(Nick)", "(Sap)", "(Vex)", etc.)
		let checkboxes = await masteryCheckboxes.count() > 0
			? masteryCheckboxes
			: this.page.locator("input[type='checkbox'][value*='(']");

		if (await checkboxes.count() === 0) {
			// No masteries found, skip
			return;
		}

		const visibleCount = await checkboxes.count();
		const toSelect = Math.min(count, visibleCount);
		for (let i = 0; i < toSelect; i++) {
			const checkbox = checkboxes.nth(i);
			if (await checkbox.isVisible() && !(await checkbox.isChecked())) {
				await checkbox.check();
				await this.page.waitForTimeout(50);
			}
		}
	}

	/**
	 * Select first available optional features (fighting styles, divine order, invocations, etc.)
	 * Uses specific CSS selectors for optional feature sections (NOT skill checkboxes)
	 */
	async selectFirstAvailableOptionalFeatures (count: number): Promise<void> {
		// Wait for optional features section to appear
		await this.page.waitForTimeout(300);

		let selected = 0;

		// Primary approach: use label elements for optional feature items
		// Clicking the label toggles the checkbox
		let optFeatLabels = this.page.locator(".charsheet__builder-opt-feat-item");

		if (await optFeatLabels.count() === 0) {
			// Try the section class with labels
			optFeatLabels = this.page.locator(".charsheet__builder-opt-feat-section label");
		}

		if (await optFeatLabels.count() === 0) {
			// Try the container class
			optFeatLabels = this.page.locator(".charsheet__builder-optional-features label");
		}

		const visibleCount = await optFeatLabels.count();
		for (let i = 0; i < visibleCount && selected < count; i++) {
			const label = optFeatLabels.nth(i);
			const checkbox = label.locator("input[type='checkbox']");
			if (await label.isVisible() && await checkbox.count() > 0 && !(await checkbox.isChecked())) {
				await label.click();
				await this.page.waitForTimeout(100);
				selected++;
			}
		}

		if (selected >= count) return;

		// Fallback: try known Fighting Style names by label
		const knownFightingStyles = ["Archery", "Defense", "Dueling", "Great Weapon Fighting", "Protection", "Two-Weapon Fighting"];
		for (const styleName of knownFightingStyles) {
			if (selected >= count) break;
			const label = this.page.locator(`label:has(input[type="checkbox"]):has-text("${styleName}")`);
			if (await label.count() > 0 && await label.first().isVisible()) {
				const cb = label.first().locator("input[type='checkbox']");
				if (await cb.count() > 0 && !(await cb.isChecked())) {
					await label.first().click();
					await this.page.waitForTimeout(100);
					selected++;
				}
			}
		}
	}

	/**
	 * Select first available feature options (specialties embedded in class features).
	 * These are different from optional features - they're choices within a feature itself.
	 * Uses .charsheet__builder-feat-opt-* selectors.
	 */
	async selectFirstAvailableFeatureOptions (count: number): Promise<void> {
		await this.page.waitForTimeout(300);

		let selected = 0;

		// Feature options use label elements with checkboxes inside
		// Clicking the label toggles the checkbox
		let featureOptLabels = this.page.locator(".charsheet__builder-feat-opt-item");

		if (await featureOptLabels.count() === 0) {
			// Try the container
			featureOptLabels = this.page.locator(".charsheet__builder-feat-opt-section label");
		}

		const visibleCount = await featureOptLabels.count();
		for (let i = 0; i < visibleCount && selected < count; i++) {
			const label = featureOptLabels.nth(i);
			const checkbox = label.locator("input[type='checkbox']");
			if (await label.isVisible() && await checkbox.count() > 0 && !(await checkbox.isChecked())) {
				await label.click();
				await this.page.waitForTimeout(100);
				selected++;
			}
		}
	}

	// ========== ABILITIES STEP ==========

	/**
	 * Select ability score method (standard-array, point-buy, or roll)
	 */
	async selectAbilityMethod (method: "standard-array" | "point-buy" | "roll"): Promise<void> {
		const methodSelect = this.page.locator(`[data-testid="builder-ability-method"]`);
		if (await methodSelect.isVisible()) {
			await methodSelect.selectOption(method);
		} else {
			// Fallback: click the method button/tab if it exists
			const methodTab = this.page.locator(`[data-method-id="${method}"]`);
			if (await methodTab.isVisible()) {
				await methodTab.click();
			}
		}
		await this.page.waitForTimeout(100);
	}

	/**
	 * Assign an ability score value to an ability (for standard array assignment)
	 */
	async assignAbilityScore (ability: string, value: number): Promise<void> {
		const select = this.page.locator(`[data-testid="builder-ability-${ability.toLowerCase()}"]`);
		if (await select.isVisible()) {
			await select.selectOption(String(value));
		}
	}

	/**
	 * Assign standard array ability scores using a sensible default distribution
	 * Standard array: 15, 14, 13, 12, 10, 8
	 * Default assigns: STR=15, DEX=14, CON=13, INT=12, WIS=10, CHA=8
	 */
	async assignStandardArrayDefaults (): Promise<void> {
		const assignments: Array<{score: number; ability: string}> = [
			{score: 15, ability: "str"},
			{score: 14, ability: "dex"},
			{score: 13, ability: "con"},
			{score: 12, ability: "int"},
			{score: 10, ability: "wis"},
			{score: 8, ability: "cha"},
		];

		for (const {score, ability} of assignments) {
			// Click the score badge to select it
			const scoreBadge = this.page.locator(`.charsheet__builder-score-badge[data-score="${score}"]`);
			if (await scoreBadge.isVisible()) {
				await scoreBadge.click();
				await this.page.waitForTimeout(100);

				// Click the ability dropzone to assign it
				const abilityDropzone = this.page.locator(`.charsheet__builder-ability-dropzone[data-ability="${ability}"]`);
				if (await abilityDropzone.isVisible()) {
					await abilityDropzone.click();
					await this.page.waitForTimeout(100);
				}
			}
		}
	}

	// ========== BACKGROUND STEP ==========

	/**
	 * Select a background by name
	 */
	async selectBackground (backgroundName: string): Promise<void> {
		await waitForListItems(this.page, "#builder-bg-list");
		const bgItem = this.backgroundList.locator(`.charsheet__builder-list-item`).filter({
			has: this.page.locator(`.charsheet__builder-list-item-name`, {hasText: backgroundName}),
		});
		await bgItem.click();
		await this.page.waitForTimeout(100);
	}

	/**
	 * Select a background by exact name and source (e.g., "Soldier", "PHB'24")
	 */
	async selectBackgroundExact (backgroundName: string, sourceAbbv: string): Promise<void> {
		await waitForListItems(this.page, "#builder-bg-list");
		const items = this.backgroundList.locator(`.charsheet__builder-list-item`);
		const count = await items.count();
		for (let i = 0; i < count; i++) {
			const item = items.nth(i);
			const nameEl = item.locator(`.charsheet__builder-list-item-name`);
			const sourceEl = item.locator(`.charsheet__builder-list-item-source`);
			const nameText = await nameEl.textContent() || "";
			const sourceText = await sourceEl.textContent() || "";
			// Match exact name and source
			if (nameText.trim() === backgroundName && sourceText.includes(sourceAbbv)) {
				await item.scrollIntoViewIfNeeded();
				await item.click();
				await this.page.waitForTimeout(100);
				return;
			}
		}
		throw new Error(`Background "${backgroundName}" with source "${sourceAbbv}" not found`);
	}

	// ========== EQUIPMENT STEP ==========

	/**
	 * Select equipment option (starting equipment or gold)
	 */
	async selectEquipmentOption (option: "equipment" | "gold"): Promise<void> {
		const btn = this.page.locator(`[data-testid="builder-equipment-${option}"]`);
		if (await btn.isVisible()) {
			await btn.click();
		}
	}

	// ========== DETAILS STEP ==========

	/**
	 * Fill in character name
	 */
	async fillName (name: string): Promise<void> {
		await this.nameInput.fill(name);
	}

	/**
	 * Fill in character details
	 */
	async fillDetails (details: {
		name?: string;
		personality?: string;
		ideals?: string;
		bonds?: string;
		flaws?: string;
	}): Promise<void> {
		if (details.name && await this.nameInput.isVisible()) {
			await this.nameInput.fill(details.name);
		}
		if (details.personality && await this.personalityInput.isVisible()) {
			await this.personalityInput.fill(details.personality);
		}
		if (details.ideals && await this.idealsInput.isVisible()) {
			await this.idealsInput.fill(details.ideals);
		}
		if (details.bonds && await this.bondsInput.isVisible()) {
			await this.bondsInput.fill(details.bonds);
		}
		if (details.flaws && await this.flawsInput.isVisible()) {
			await this.flawsInput.fill(details.flaws);
		}
	}

	/**
	 * Complete the wizard by clicking Finish
	 */
	async finishWizard (): Promise<void> {
		// On the last step, the Next button becomes "Finish"
		await this.btnNext.click();
		// Wait for the character sheet to load
		await this.page.waitForTimeout(500);
	}

	/**
	 * Verify that the wizard completed successfully
	 */
	async expectWizardComplete (): Promise<void> {
		// After completion, builder should be hidden and overview visible
		await expect(this.page.locator("#charsheet-tab-overview")).toBeVisible();
	}
}
