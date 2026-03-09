import {Locator, Page, expect} from "@playwright/test";

/**
 * Page Object Model for the Level-Up wizard modal
 * Provides methods to complete level-up choices
 */
export class LevelUpPage {
	readonly page: Page;

	// Modal container
	readonly modalContainer: Locator;

	// Progress elements
	readonly progressBar: Locator;
	readonly progressText: Locator;

	// Accordion sections
	readonly accordionSubclass: Locator;
	readonly accordionAsi: Locator;
	readonly accordionFeatures: Locator;
	readonly accordionHp: Locator;
	readonly accordionExpertise: Locator;
	readonly accordionKnownSpells: Locator;
	readonly accordionOptFeatures: Locator;

	// Buttons
	readonly btnFinish: Locator;
	readonly btnCancel: Locator;

	constructor (page: Page) {
		this.page = page;

		// Modal
		this.modalContainer = page.locator(".charsheet__levelup-wizard");

		// Progress
		this.progressBar = page.locator(".charsheet__levelup-progress-fill");
		this.progressText = page.locator(".charsheet__levelup-progress-text");

		// Accordions - these are dynamically shown based on level/class
		this.accordionSubclass = page.locator('[data-accordion-id="subclass"]');
		this.accordionAsi = page.locator('[data-accordion-id="asi"]');
		this.accordionFeatures = page.locator('[data-accordion-id="features"]');
		this.accordionHp = page.locator('[data-accordion-id="hp"]');
		this.accordionExpertise = page.locator('[data-accordion-id="expertise"]');
		this.accordionKnownSpells = page.locator('[data-accordion-id="knownspells"]');
		this.accordionOptFeatures = page.locator('[data-accordion-id="optfeatures"]');

		// Action buttons
		this.btnFinish = page.locator('[data-testid="levelup-finish"]');
		this.btnCancel = page.locator('[data-testid="levelup-cancel"]');
	}

	/**
	 * Wait for the level-up modal to appear
	 */
	async waitForModal (): Promise<void> {
		await this.modalContainer.waitFor({state: "visible", timeout: 10000});
	}

	/**
	 * Check if level-up modal is visible
	 */
	async isVisible (): Promise<boolean> {
		return await this.modalContainer.isVisible();
	}

	/**
	 * Expand an accordion section by clicking its header
	 */
	async expandAccordion (accordionId: string): Promise<void> {
		// Try data-accordion-id first
		const accordion = this.page.locator(`[data-accordion-id="${accordionId}"]`);
		if (await accordion.count() > 0 && await accordion.isVisible()) {
			const header = accordion.locator(".charsheet__levelup-accordion-header");
			if (await header.count() > 0) {
				await header.click();
				await this.page.waitForTimeout(200);
				return;
			}
			// Click the accordion itself
			await accordion.click();
			await this.page.waitForTimeout(200);
			return;
		}

		// Fallback: click the clickable element that contains the text
		const textMap: Record<string, string> = {
			subclass: "Choose",
			asi: "Ability Score",
			hp: "Hit Points",
			optfeatures: "Optional Feature",
			featoptions: "Feature Option",
			expertise: "Expertise",
			knownspells: "Spells",
			features: "New Features",
		};

		const searchText = textMap[accordionId];
		if (searchText) {
			// Find a clickable ancestor of the text within the wizard
			const textEl = this.page.locator(".charsheet__levelup-wizard").getByText(searchText, {exact: false}).first();
			if (await textEl.count() > 0) {
				await textEl.click();
				await this.page.waitForTimeout(300);
			}
		}
	}

	/**
	 * Check if an accordion section is visible
	 */
	async isAccordionVisible (accordionId: string): Promise<boolean> {
		// Try data-accordion-id first
		const accordion = this.page.locator(`[data-accordion-id="${accordionId}"]`);
		if (await accordion.count() > 0) {
			return await accordion.isVisible();
		}

		// Fallback: check by text content in the wizard
		const textMap: Record<string, string> = {
			subclass: "Choose",
			asi: "Ability Score",
			hp: "Hit Points",
			optfeatures: "Optional Feature",
			featoptions: "Feature Option",
			expertise: "Expertise",
			knownspells: "Spells Known",
			features: "New Features",
		};

		const searchText = textMap[accordionId];
		if (searchText) {
			const el = this.page.locator(".charsheet__levelup-wizard").getByText(searchText, {exact: false});
			return await el.count() > 0;
		}
		return false;
	}

	/**
	 * Check if an accordion section is completed
	 */
	async isAccordionCompleted (accordionId: string): Promise<boolean> {
		const accordion = this.page.locator(`[data-accordion-id="${accordionId}"]`);
		return await accordion.locator(".completed").count() > 0 ||
			(await accordion.getAttribute("class"))?.includes("completed") || false;
	}

	// ========== HP SECTION ==========

	/**
	 * Select HP option (take average or roll)
	 */
	async selectHpOption (option: "average" | "roll"): Promise<void> {
		const btn = this.page.locator(`[data-testid="levelup-hp-${option}"]`);
		if (await btn.isVisible()) {
			await btn.click();
		} else {
			// Fallback: look for button by text
			const avgBtn = this.page.getByRole("button", {name: option === "average" ? /average/i : /roll/i});
			if (await avgBtn.isVisible()) {
				await avgBtn.click();
			}
		}
		await this.page.waitForTimeout(100);
	}

	// ========== ASI/FEAT SECTION ==========

	/**
	 * Select ASI option (increase ability score)
	 */
	async selectAsi (ability: string): Promise<void> {
		const select = this.page.locator(`[data-testid="levelup-asi-${ability.toLowerCase()}"]`);
		if (await select.isVisible()) {
			await select.click();
		}
	}

	/**
	 * Select a feat from the feat picker
	 */
	async selectFeat (featName: string): Promise<void> {
		// Click the "feat" option first
		const featOption = this.page.getByRole("button", {name: /feat/i});
		if (await featOption.isVisible()) {
			await featOption.click();
			await this.page.waitForTimeout(100);
		}

		// Then select the specific feat
		const featItem = this.page.locator(".charsheet__levelup-feat-item").filter({hasText: featName});
		if (await featItem.isVisible()) {
			await featItem.click();
		}
	}

	/**
	 * Select the +2/+1 ability score increase option for ASI
	 */
	async selectAsiScore (firstAbility: string, secondAbility?: string): Promise<void> {
		// Look for ability score selectors in the ASI accordion
		const firstSelect = this.page.locator(`[data-testid="levelup-asi-first"]`);
		if (await firstSelect.isVisible()) {
			await firstSelect.selectOption(firstAbility);
		}
		if (secondAbility) {
			const secondSelect = this.page.locator(`[data-testid="levelup-asi-second"]`);
			if (await secondSelect.isVisible()) {
				await secondSelect.selectOption(secondAbility);
			}
		}
	}

	// ========== SUBCLASS SECTION ==========

	/**
	 * Select a subclass by name (clicks the radio button container)
	 */
	async selectSubclass (subclassName: string, sourceAbbv?: string): Promise<void> {
		await this.expandAccordion("subclass");
		const wizard = this.page.locator(".charsheet__levelup-wizard");
		const subclassAccordion = this.page.locator('[data-accordion-id="subclass"]');
		await subclassAccordion.waitFor({state: "visible", timeout: 10000});

		const options = subclassAccordion.locator(".charsheet__levelup-option");
		await options.first().waitFor({state: "visible", timeout: 10000});

		const optionCount = await options.count();
		for (let i = 0; i < optionCount; i++) {
			const option = options.nth(i);
			if (!(await option.isVisible())) continue;

			const text = await option.textContent() || "";
			if (!text.includes(subclassName)) continue;
			if (sourceAbbv && !text.includes(sourceAbbv)) continue;

			await option.scrollIntoViewIfNeeded();
			await option.click({force: true});

			const radio = option.locator("input[type='radio']").first();
			await expect(radio).toBeChecked({timeout: 5000});

			const summaryItem = wizard.locator(".charsheet__levelup-summary-item").filter({hasText: /Origin|Subclass/i}).first();
			await expect(summaryItem).toContainText(subclassName, {timeout: 5000});
			return;
		}

		throw new Error(`Could not find subclass "${subclassName}"${sourceAbbv ? ` with source "${sourceAbbv}"` : ""}`);
	}

	// ========== KNOWN SPELLS SECTION ==========

	/**
	 * Add a spell to known spells
	 */
	async addKnownSpell (spellName: string): Promise<void> {
		const knownSpellsAccordion = this.page.locator('[data-accordion-id="knownspells"]');
		const spellItem = knownSpellsAccordion.locator(".charsheet__modal-list-item").filter({hasText: spellName}).first();
		await spellItem.waitFor({state: "visible", timeout: 10000});
		await spellItem.locator(".spell-toggle").click();
		await this.page.waitForTimeout(150);
	}

	async addFirstAvailableKnownSpells (count: number): Promise<void> {
		const knownSpellsAccordion = this.page.locator('[data-accordion-id="knownspells"]');
		for (let i = 0; i < count; i++) {
			const addButton = knownSpellsAccordion.locator(".spell-toggle.ve-btn-primary").first();
			await addButton.waitFor({state: "visible", timeout: 10000});
			await addButton.click();
			await this.page.waitForTimeout(150);
		}
	}

	async selectOptionalFeature (featureName: string): Promise<void> {
		const optFeaturesAccordion = this.page.locator('[data-accordion-id="optfeatures"]');
		const label = optFeaturesAccordion.locator("label").filter({hasText: featureName}).first();
		await label.waitFor({state: "visible", timeout: 10000});
		await label.click();
		await this.page.waitForTimeout(150);
	}

	// ========== COMPLETION ==========

	// ========== GENERIC OPTIONS ==========

	/**
	 * Select first available options in the currently expanded accordion
	 * (works for optional features, feature options, etc.)
	 */
	async selectFirstAvailableOptions (): Promise<void> {
		await this.page.waitForTimeout(200);
		// Try clicking first unchecked checkbox labels in the active accordion body
		const labels = this.page.locator(".charsheet__levelup-accordion-body:visible label:has(input[type='checkbox'])");
		const count = await labels.count();
		for (let i = 0; i < count && i < 5; i++) {
			const label = labels.nth(i);
			const checkbox = label.locator("input[type='checkbox']");
			if (await label.isVisible() && await checkbox.count() > 0 && !(await checkbox.isChecked())) {
				await label.click();
				await this.page.waitForTimeout(100);
			}
		}
	}

	/**
	 * Auto-fill all remaining required selections in the level-up wizard.
	 * Uses jQuery to find and check unchecked checkboxes in sections that need more selections.
	 */
	async autoFillAllSelections (): Promise<void> {
		await this.page.evaluate(() => {
			const $ = (window as any).jQuery || (window as any).$;
			if (!$) return;

			$(".charsheet__levelup-wizard").find("*").filter(function (this: HTMLElement) {
				const text = $(this).text();
				return /^Selected:\s*\d+\s*\/\s*\d+$/.test(text.trim());
			}).each(function (this: HTMLElement) {
				const text = $(this).text().trim();
				const match = text.match(/Selected:\s*(\d+)\s*\/\s*(\d+)/);
				if (!match) return;
				const current = parseInt(match[1]);
				const max = parseInt(match[2]);
				if (current >= max) return;

				const needed = max - current;
				let $el = $(this);
				for (let depth = 0; depth < 8; depth++) {
					$el = $el.parent();
					if (!$el.length) break;
					const $checkboxes = $el.find("input[type='checkbox']:not(:checked)");
					if ($checkboxes.length > 0) {
						$checkboxes.slice(0, needed).each(function (this: HTMLInputElement) {
							$(this).prop("checked", true).trigger("change");
						});
						break;
					}
				}
			});
		});
		await this.page.waitForTimeout(500);
	}

	// ========== COMPLETION ==========

	/**
	 * Click finish to complete level-up
	 */
	async finish (): Promise<void> {
		// Primary: button text pattern (most reliable based on actual DOM)
		const levelUpBtn = this.page.locator(".charsheet__levelup-wizard button").filter({hasText: /Level Up to/i});
		if (await levelUpBtn.count() > 0 && await levelUpBtn.first().isVisible()) {
			await levelUpBtn.first().click();
			await this.page.waitForTimeout(1000);
			return;
		}
		// Try data-testid
		const finishBtn = this.page.locator('[data-testid="levelup-finish"]');
		if (await finishBtn.count() > 0 && await finishBtn.isVisible()) {
			await finishBtn.click();
			await this.page.waitForTimeout(1000);
			return;
		}
		// Fallback: primary button in the wizard
		const primaryBtn = this.page.locator(".charsheet__levelup-wizard .ve-btn-primary");
		if (await primaryBtn.count() > 0 && await primaryBtn.first().isVisible()) {
			await primaryBtn.first().click();
			await this.page.waitForTimeout(1000);
		}
	}

	async expectDivineSoulAffinityModalVisible (): Promise<void> {
		await expect(this.page.locator(".ui-modal__inner").filter({hasText: "Divine Soul Affinity"}).last()).toBeVisible();
	}

	async selectDivineSoulAffinity (affinityName: string): Promise<void> {
		const modal = this.page.locator(".ui-modal__inner").filter({hasText: "Divine Soul Affinity"}).last();
		await modal.waitFor({state: "visible", timeout: 10000});
		const select = modal.locator("select").first();
		await select.selectOption({label: affinityName});
		await modal.getByRole("button", {name: "OK"}).click();
		await modal.waitFor({state: "hidden", timeout: 10000});
	}

	/**
	 * Cancel level-up
	 */
	async cancel (): Promise<void> {
		// Try data-testid first
		const cancelBtn = this.page.locator('[data-testid="levelup-cancel"]');
		if (await cancelBtn.count() > 0 && await cancelBtn.isVisible()) {
			await cancelBtn.click();
			await this.page.waitForTimeout(500);
			return;
		}
		// Fallback: button text in wizard container
		const closeBtn = this.page.locator(".charsheet__levelup-wizard button").filter({hasText: /Cancel/});
		if (await closeBtn.count() > 0 && await closeBtn.first().isVisible()) {
			await closeBtn.first().click();
			await this.page.waitForTimeout(500);
			return;
		}
		// Final fallback: default button in wizard
		const defaultBtn = this.page.locator(".charsheet__levelup-wizard .ve-btn-default");
		if (await defaultBtn.count() > 0 && await defaultBtn.first().isVisible()) {
			await defaultBtn.first().click();
			await this.page.waitForTimeout(500);
			return;
		}
		// Last resort: click modal overlay to close
		const overlay = this.page.locator(".ui-modal__overlay");
		if (await overlay.count() > 0) {
			await overlay.click({position: {x: 5, y: 5}});
			await this.page.waitForTimeout(500);
		}
	}

	/**
	 * Verify modal is closed after completion
	 */
	async expectModalClosed (): Promise<void> {
		await expect(this.modalContainer).not.toBeVisible({timeout: 10000});
	}

	/**
	 * Get progress percentage
	 */
	async getProgressPercentage (): Promise<number> {
		const text = await this.progressText.textContent();
		const match = text?.match(/(\d+)%/);
		return match ? parseInt(match[1], 10) : 0;
	}
}
