import {Page} from "@playwright/test";

/**
 * Wait for the character sheet page to fully load
 * Waits for the 'toolsLoaded' event which fires when all data is ready
 */
export async function waitForToolsLoaded (page: Page): Promise<void> {
	await page.waitForFunction(
		() =>
			// @ts-ignore - window.charSheet is set by the app after initialization
			window.charSheet !== undefined,
		{timeout: 60000},
	);
}

/**
 * Wait for a specific element to have content (not empty)
 */
export async function waitForContentLoaded (page: Page, selector: string): Promise<void> {
	await page.waitForFunction(
		sel => {
			const el = document.querySelector(sel);
			return el && el.children.length > 0;
		},
		selector,
		{timeout: 15000},
	);
}

/**
 * Wait for list items to populate in a builder list
 */
export async function waitForListItems (page: Page, listSelector: string, minCount = 1): Promise<void> {
	await page.waitForFunction(
		({sel, min}) => {
			const items = document.querySelectorAll(`${sel} .charsheet__builder-list-item`);
			return items.length >= min;
		},
		{sel: listSelector, min: minCount},
		{timeout: 15000},
	);
}
