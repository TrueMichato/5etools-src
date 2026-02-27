import {Page} from "@playwright/test";

/** URL of the Thelemar JSON served by the local web server */
const THELEMAR_URL = "/TravelersGuidetoThelemar.json";

/**
 * Load the Travelers Guide to Thelemar homebrew into the character sheet.
 *
 * Uses the site's own BrewUtil2.pAddBrewFromUrl() on the character sheet page,
 * then refreshes the character sheet's internal data via page reload.
 */
export async function gotoWithThelemar (page: Page): Promise<void> {
	// Navigate to character sheet and wait for full init
	await page.goto("/charactersheet.html");
	await page.waitForFunction(
		() => (window as any).charSheet !== undefined,
		{timeout: 60000},
	);

	// Load the brew using the site's own API
	const result = await page.evaluate(async (url: string) => {
		try {
			await (window as any).BrewUtil2.pAddBrewFromUrl(url);
			return "OK";
		} catch (e: any) {
			return "ERROR: " + e.message;
		}
	}, THELEMAR_URL);

	if (result !== "OK") {
		throw new Error(`Failed to load Thelemar homebrew: ${result}`);
	}

	// The brew is now stored in IndexedDB. Navigate fresh to charactersheet.html
	// so it picks up the brew during its init flow.
	// Use a cache-bust query to avoid hitting the addInitScript from clearCharacterStorage
	await page.goto("/charactersheet.html?_brewloaded=1");
	await page.waitForFunction(
		() => (window as any).charSheet !== undefined,
		{timeout: 90000},
	);

	// Wait for builder lists to populate with homebrew data
	await page.waitForTimeout(2000);
}

/**
 * Clear all homebrew data.
 */
export async function clearHomebrewStorage (page: Page): Promise<void> {
	try {
		await page.evaluate(async () => {
			const BU2 = (window as any).BrewUtil2;
			if (BU2?.pSetBrew) {
				await BU2.pSetBrew([]);
			}
		});
	} catch { /* page may have navigated */ }
}
