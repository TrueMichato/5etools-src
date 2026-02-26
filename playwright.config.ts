import {defineConfig, devices} from "@playwright/test";

/**
 * Playwright configuration for Character Sheet E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
	testDir: "./test/e2e/specs",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : 3,
	reporter: "html",
	timeout: 60000,
	use: {
		baseURL: "http://localhost:8080",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: {...devices["Desktop Chrome"]},
		},
	],
	/* Run local dev server before starting tests */
	webServer: {
		command: "python3 -m http.server 8080",
		url: "http://localhost:8080",
		reuseExistingServer: !process.env.CI,
		timeout: 30000,
	},
});
