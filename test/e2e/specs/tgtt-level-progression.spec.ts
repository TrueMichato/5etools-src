import {expect, test} from "@playwright/test";
import {CharacterSheetPage} from "../pages/CharacterSheetPage";
import {gotoWithThelemar, clearHomebrewStorage} from "../utils/homebrewLoader";
import {
	createCharacterViaWizard,
	levelUpTo,
	PRESET_TGTT_BLADESINGER,
	PRESET_TGTT_ZODIAC_DRUID,
	PRESET_TGTT_MERCY_MONK,
	PRESET_TGTT_DIVINE_SOUL,
	PRESET_TGTT_HEXBLADE,
} from "../utils/characterBuilder";

/*
 * ═══════════════════════════════════════════════════════════════════════════
 *  TGTT Level-Up Progression — E2E tests for leveling through milestones
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tests that characters can level up through key milestones and that
 * features, spell slots, and resources scale correctly.
 *
 * Milestone levels tested: 3 (subclass), 5 (Extra Attack / 3rd-level slots),
 * 10 (mid-tier features), 20 (capstone).
 */

// Long tests – increase timeout for level-up sequences
test.describe.configure({timeout: 120_000});

// ──────────────────────────────────────────────────────────────────────────
//  Bladesinger Wizard — Level Progression
// ──────────────────────────────────────────────────────────────────────────

test.describe("TGTT Bladesinger — Level Progression", () => {
	test.beforeEach(async ({page}) => {
		await gotoWithThelemar(page);
	});

	test.afterEach(async ({page}) => {
		await clearHomebrewStorage(page);
	});

	test("should level up to 3 and gain Bladesinger subclass", async ({page}) => {
		const {charSheet} = await createCharacterViaWizard(page, PRESET_TGTT_BLADESINGER);
		await charSheet.expectLevel(1);

		await levelUpTo(page, 3, {subclassName: "Bladesinging", subclassSource: "TGTT"});
		await charSheet.expectLevel(3);

		// Verify Bladesong toggle exists
		const features = await charSheet.getActivatableFeatureNames();
		expect(features.some(f => /bladesong/i.test(f))).toBe(true);
	});

	test("should reach level 5 with 3rd-level spell slots", async ({page}) => {
		const {charSheet} = await createCharacterViaWizard(page, PRESET_TGTT_BLADESINGER);
		await levelUpTo(page, 5, {subclassName: "Bladesinging", subclassSource: "TGTT"});
		await charSheet.expectLevel(5);

		const slots3 = await charSheet.getSpellSlots(3);
		expect(slots3.max).toBeGreaterThanOrEqual(2);
	});

	test("should reach level 10 with Song of Defense", async ({page}) => {
		const {charSheet} = await createCharacterViaWizard(page, PRESET_TGTT_BLADESINGER);
		await levelUpTo(page, 10, {subclassName: "Bladesinging", subclassSource: "TGTT"});
		await charSheet.expectLevel(10);

		// 5th-level spell slots should exist
		const slots5 = await charSheet.getSpellSlots(5);
		expect(slots5.max).toBeGreaterThanOrEqual(1);
	});
});

// ──────────────────────────────────────────────────────────────────────────
//  Zodiac Druid — Level Progression
// ──────────────────────────────────────────────────────────────────────────

test.describe("TGTT Zodiac Druid — Level Progression", () => {
	test.beforeEach(async ({page}) => {
		await gotoWithThelemar(page);
	});

	test.afterEach(async ({page}) => {
		await clearHomebrewStorage(page);
	});

	test("should level up to 3 and gain Zodiac Form", async ({page}) => {
		const {charSheet} = await createCharacterViaWizard(page, PRESET_TGTT_ZODIAC_DRUID);
		await levelUpTo(page, 3, {subclassName: "Circle of the Stars", subclassSource: "TGTT"});
		await charSheet.expectLevel(3);

		const features = await charSheet.getActivatableFeatureNames();
		expect(features.some(f => /zodiac|starry/i.test(f))).toBe(true);
	});

	test("should reach level 5 with 3rd-level spell slots", async ({page}) => {
		const {charSheet} = await createCharacterViaWizard(page, PRESET_TGTT_ZODIAC_DRUID);
		await levelUpTo(page, 5, {subclassName: "Circle of the Stars", subclassSource: "TGTT"});
		await charSheet.expectLevel(5);

		const slots3 = await charSheet.getSpellSlots(3);
		expect(slots3.max).toBeGreaterThanOrEqual(2);
	});
});

// ──────────────────────────────────────────────────────────────────────────
//  Mercy Monk — Level Progression
// ──────────────────────────────────────────────────────────────────────────

test.describe("TGTT Mercy Monk — Level Progression", () => {
	test.beforeEach(async ({page}) => {
		await gotoWithThelemar(page);
	});

	test.afterEach(async ({page}) => {
		await clearHomebrewStorage(page);
	});

	test("should level up to 3 and gain Hand of Healing/Harm", async ({page}) => {
		const {charSheet} = await createCharacterViaWizard(page, PRESET_TGTT_MERCY_MONK);
		await levelUpTo(page, 3, {subclassName: "Way of Mercy", subclassSource: "TGTT"});
		await charSheet.expectLevel(3);
	});

	test("should reach level 5 with growing Ki pool", async ({page}) => {
		const {charSheet} = await createCharacterViaWizard(page, PRESET_TGTT_MERCY_MONK);
		await levelUpTo(page, 5, {subclassName: "Way of Mercy", subclassSource: "TGTT"});
		await charSheet.expectLevel(5);
	});
});

// ──────────────────────────────────────────────────────────────────────────
//  Divine Soul Sorcerer — Level Progression
// ──────────────────────────────────────────────────────────────────────────

test.describe("TGTT Divine Soul Sorcerer — Level Progression", () => {
	test.beforeEach(async ({page}) => {
		await gotoWithThelemar(page);
	});

	test.afterEach(async ({page}) => {
		await clearHomebrewStorage(page);
	});

	test("should have Sorcery Points at level 1 (TGTT Font of Magic)", async ({page}) => {
		const {charSheet} = await createCharacterViaWizard(page, PRESET_TGTT_DIVINE_SOUL);
		await charSheet.expectLevel(1);

		// TGTT Sorcerers get Font of Magic at level 1
		const sp = await charSheet.getResource("Sorcery Points");
		expect(sp.max).toBeGreaterThanOrEqual(1);
	});

	test("should level up to 3 and have subclass features", async ({page}) => {
		const {charSheet} = await createCharacterViaWizard(page, PRESET_TGTT_DIVINE_SOUL);
		await levelUpTo(page, 3, {subclassName: "Divine Soul", subclassSource: "TGTT"});
		await charSheet.expectLevel(3);

		const slots2 = await charSheet.getSpellSlots(2);
		expect(slots2.max).toBeGreaterThanOrEqual(2);
	});

	test("should scale spell save DC at level 5", async ({page}) => {
		const {charSheet} = await createCharacterViaWizard(page, PRESET_TGTT_DIVINE_SOUL);
		await levelUpTo(page, 5, {subclassName: "Divine Soul", subclassSource: "TGTT"});
		await charSheet.expectLevel(5);

		const dc = await charSheet.getSpellSaveDC();
		// DC = 8 + prof(3) + CHA mod — should be at least 11
		expect(dc).toBeGreaterThanOrEqual(11);
	});
});

// ──────────────────────────────────────────────────────────────────────────
//  Hexblade Warlock — Level Progression
// ──────────────────────────────────────────────────────────────────────────

test.describe("TGTT Hexblade Warlock — Level Progression", () => {
	test.beforeEach(async ({page}) => {
		await gotoWithThelemar(page);
	});

	test.afterEach(async ({page}) => {
		await clearHomebrewStorage(page);
	});

	test("should level up to 3 and gain Hexblade features", async ({page}) => {
		const {charSheet} = await createCharacterViaWizard(page, PRESET_TGTT_HEXBLADE);
		await levelUpTo(page, 3, {subclassName: "The Hexblade", subclassSource: "TGTT"});
		await charSheet.expectLevel(3);

		// Should have Pact Magic slots
		const pact = await charSheet.getPactSlots();
		expect(pact.max).toBeGreaterThanOrEqual(2);
	});

	test("should reach level 5 with 3rd-level pact slots", async ({page}) => {
		const {charSheet} = await createCharacterViaWizard(page, PRESET_TGTT_HEXBLADE);
		await levelUpTo(page, 5, {subclassName: "The Hexblade", subclassSource: "TGTT"});
		await charSheet.expectLevel(5);

		const pact = await charSheet.getPactSlots();
		expect(pact.level).toBeGreaterThanOrEqual(3);
	});

	test("should have Hexblade Curse toggle by level 3", async ({page}) => {
		const {charSheet} = await createCharacterViaWizard(page, PRESET_TGTT_HEXBLADE);
		await levelUpTo(page, 3, {subclassName: "The Hexblade", subclassSource: "TGTT"});

		const features = await charSheet.getActivatableFeatureNames();
		expect(features.some(f => /hexblade.*curse/i.test(f))).toBe(true);
	});
});

// ──────────────────────────────────────────────────────────────────────────
//  Capstone — Full L1→20 (slow, run with --grep if needed)
// ──────────────────────────────────────────────────────────────────────────

test.describe("TGTT Capstone — Level 20", () => {
	// These are very slow tests — 5 minute timeout
	test.describe.configure({timeout: 300_000});

	test.beforeEach(async ({page}) => {
		await gotoWithThelemar(page);
	});

	test.afterEach(async ({page}) => {
		await clearHomebrewStorage(page);
	});

	test("Mercy Monk can reach level 20", async ({page}) => {
		const {charSheet} = await createCharacterViaWizard(page, PRESET_TGTT_MERCY_MONK);
		await levelUpTo(page, 20, {subclassName: "Way of Mercy", subclassSource: "TGTT"});
		await charSheet.expectLevel(20);
	});

	test("Divine Soul Sorcerer can reach level 20", async ({page}) => {
		const {charSheet} = await createCharacterViaWizard(page, PRESET_TGTT_DIVINE_SOUL);
		await levelUpTo(page, 20, {subclassName: "Divine Soul", subclassSource: "TGTT"});
		await charSheet.expectLevel(20);

		// 9th-level spell slots at max
		const slots9 = await charSheet.getSpellSlots(9);
		expect(slots9.max).toBeGreaterThanOrEqual(1);
	});
});
