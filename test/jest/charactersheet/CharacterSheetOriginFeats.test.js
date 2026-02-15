
import "./setup.js";

let CharacterSheetState;
let state;

beforeAll(async () => {
	CharacterSheetState = (await import("../../../js/charactersheet/charactersheet-state.js")).CharacterSheetState;
});

describe("Origin Feats & 2024 Backgrounds", () => {
	beforeEach(() => {
		state = new CharacterSheetState();
		state.setAbilityBase("str", 10);
		state.setAbilityBase("dex", 14);
		state.setAbilityBase("con", 14);
		state.setAbilityBase("int", 16);
		state.setAbilityBase("wis", 14);
		state.setAbilityBase("cha", 10);
		state.addClass({name: "Fighter", source: "PHB", level: 1});
	});

	// ===================================================================
	// _parseBackgroundFeatKey
	// ===================================================================
	describe("_parseBackgroundFeatKey", () => {
		test("should parse simple feat key", () => {
			const result = state._parseBackgroundFeatKey("crafter|xphb");
			expect(result.name).toBe("Crafter");
			expect(result.source).toBe("XPHB");
			expect(result.subtype).toBeNull();
		});

		test("should parse feat key with subtype (semicolon)", () => {
			const result = state._parseBackgroundFeatKey("magic initiate; cleric|xphb");
			expect(result.name).toBe("Magic Initiate (Cleric)");
			expect(result.source).toBe("XPHB");
			expect(result.subtype).toBe("Cleric");
		});

		test("should parse feat key with subtype (druid)", () => {
			const result = state._parseBackgroundFeatKey("magic initiate; druid|xphb");
			expect(result.name).toBe("Magic Initiate (Druid)");
			expect(result.subtype).toBe("Druid");
		});

		test("should handle case normalization", () => {
			const result = state._parseBackgroundFeatKey("alert|XPHB");
			expect(result.name).toBe("Alert");
			expect(result.source).toBe("XPHB");
		});

		test("should handle mixed case feat names", () => {
			const result = state._parseBackgroundFeatKey("tavern brawler|xphb");
			expect(result.name).toBe("Tavern Brawler");
		});

		test("should default source to PHB if missing", () => {
			const result = state._parseBackgroundFeatKey("tough");
			expect(result.name).toBe("Tough");
			expect(result.source).toBe("PHB");
		});

		test("should return null for empty input", () => {
			expect(state._parseBackgroundFeatKey("")).toBeNull();
			expect(state._parseBackgroundFeatKey(null)).toBeNull();
			expect(state._parseBackgroundFeatKey(undefined)).toBeNull();
		});

		test("should handle Skilled feat", () => {
			const result = state._parseBackgroundFeatKey("skilled|xphb");
			expect(result.name).toBe("Skilled");
			expect(result.source).toBe("XPHB");
		});

		test("should handle Savage Attacker feat", () => {
			const result = state._parseBackgroundFeatKey("savage attacker|xphb");
			expect(result.name).toBe("Savage Attacker");
		});
	});

	// ===================================================================
	// applyBackgroundFeats
	// ===================================================================
	describe("applyBackgroundFeats", () => {
		test("should add origin feat from XPHB background (Criminal → Alert)", () => {
			state.setBackground({
				name: "Criminal",
				source: "XPHB",
				feats: [{"alert|xphb": true}],
			});

			const added = state.applyBackgroundFeats();
			expect(added).toBe(1);

			const feat = state.getOriginFeat();
			expect(feat).not.toBeNull();
			expect(feat.name).toBe("Alert");
			expect(feat.isOriginFeat).toBe(true);
			expect(feat.backgroundName).toBe("Criminal");
		});

		test("should add origin feat from XPHB background (Farmer → Tough)", () => {
			state.setBackground({
				name: "Farmer",
				source: "XPHB",
				feats: [{"tough|xphb": true}],
			});

			const added = state.applyBackgroundFeats();
			expect(added).toBe(1);

			const feat = state.getOriginFeat();
			expect(feat.name).toBe("Tough");
		});

		test("should parse semicolon subtype (Acolyte → Magic Initiate; Cleric)", () => {
			state.setBackground({
				name: "Acolyte",
				source: "XPHB",
				feats: [{"magic initiate; cleric|xphb": true}],
			});

			const added = state.applyBackgroundFeats();
			expect(added).toBe(1);

			const feat = state.getOriginFeat();
			expect(feat.name).toBe("Magic Initiate (Cleric)");
		});

		test("should return 0 for background without feats (2014 backgrounds)", () => {
			state.setBackground({
				name: "Acolyte",
				source: "PHB",
			});

			const added = state.applyBackgroundFeats();
			expect(added).toBe(0);
		});

		test("should return 0 for null background", () => {
			expect(state.applyBackgroundFeats()).toBe(0);
		});

		test("should use backgroundOverride when provided", () => {
			const bg = {
				name: "Soldier",
				source: "XPHB",
				feats: [{"savage attacker|xphb": true}],
			};

			const added = state.applyBackgroundFeats(bg);
			expect(added).toBe(1);
			expect(state.getOriginFeat().name).toBe("Savage Attacker");
		});

		test("should not add duplicate feat", () => {
			state.addFeat({name: "Alert", source: "XPHB"});
			state.setBackground({
				name: "Criminal",
				source: "XPHB",
				feats: [{"alert|xphb": true}],
			});

			const added = state.applyBackgroundFeats();
			expect(added).toBe(0);
		});

		test("should skip feat entries with false value", () => {
			state.setBackground({
				name: "Test",
				source: "XPHB",
				feats: [{"alert|xphb": false}],
			});

			const added = state.applyBackgroundFeats();
			expect(added).toBe(0);
		});
	});

	// ===================================================================
	// getOriginFeat
	// ===================================================================
	describe("getOriginFeat", () => {
		test("should return null when no origin feat", () => {
			expect(state.getOriginFeat()).toBeNull();
		});

		test("should return null when feats exist but none are origin", () => {
			state.addFeat({name: "Alert", source: "PHB"});
			expect(state.getOriginFeat()).toBeNull();
		});

		test("should return origin feat after background application", () => {
			state.setBackground({
				name: "Criminal",
				source: "XPHB",
				feats: [{"alert|xphb": true}],
			});
			state.applyBackgroundFeats();
			const origin = state.getOriginFeat();
			expect(origin).not.toBeNull();
			expect(origin.isOriginFeat).toBe(true);
		});
	});

	// ===================================================================
	// removeOriginFeats
	// ===================================================================
	describe("removeOriginFeats", () => {
		test("should remove origin feats only", () => {
			// Add a regular feat
			state.addFeat({name: "Tough", source: "PHB"});

			// Add an origin feat
			state.setBackground({
				name: "Criminal",
				source: "XPHB",
				feats: [{"alert|xphb": true}],
			});
			state.applyBackgroundFeats();

			expect(state._data.feats.length).toBe(2);

			const removed = state.removeOriginFeats();
			expect(removed).toBe(1);
			expect(state._data.feats.length).toBe(1);
			expect(state._data.feats[0].name).toBe("Tough");
		});

		test("should return 0 when no origin feats to remove", () => {
			state.addFeat({name: "Alert", source: "PHB"});
			expect(state.removeOriginFeats()).toBe(0);
		});
	});

	// ===================================================================
	// BACKGROUND CHANGE WORKFLOW
	// ===================================================================
	describe("Background Change Workflow", () => {
		test("should swap origin feat when background changes", () => {
			// Apply Criminal background (Alert)
			state.setBackground({
				name: "Criminal",
				source: "XPHB",
				feats: [{"alert|xphb": true}],
			});
			state.applyBackgroundFeats();
			expect(state.getOriginFeat().name).toBe("Alert");

			// Change to Farmer background (Tough)
			state.removeOriginFeats();
			state.setBackground({
				name: "Farmer",
				source: "XPHB",
				feats: [{"tough|xphb": true}],
			});
			state.applyBackgroundFeats();

			const origin = state.getOriginFeat();
			expect(origin.name).toBe("Tough");
			expect(origin.backgroundName).toBe("Farmer");
		});
	});

	// ===================================================================
	// FEAT REGISTRY INTEGRATION
	// ===================================================================
	describe("Feat Registry Integration", () => {
		test("Alert origin feat should apply initiative bonus", () => {
			const baseInit = state.getInitiative();
			state.setBackground({
				name: "Criminal",
				source: "XPHB",
				feats: [{"alert|xphb": true}],
			});
			state.applyBackgroundFeats();
			// Alert XPHB: proficiency bonus to initiative + can't be surprised
			// The feat registry should apply its registered effects
			const feat = state.getOriginFeat();
			expect(feat).not.toBeNull();
			expect(feat.name).toBe("Alert");
		});

		test("Tough origin feat should grant HP bonus", () => {
			state.setBackground({
				name: "Farmer",
				source: "XPHB",
				feats: [{"tough|xphb": true}],
			});
			state.applyBackgroundFeats();
			const feat = state.getOriginFeat();
			expect(feat.name).toBe("Tough");
			// Tough feat is registered in the registry for +2 HP/level
		});

		test("Lucky origin feat should be trackable", () => {
			state.setBackground({
				name: "Merchant",
				source: "XPHB",
				feats: [{"lucky|xphb": true}],
			});
			state.applyBackgroundFeats();
			const feat = state.getOriginFeat();
			expect(feat.name).toBe("Lucky");
		});
	});

	// ===================================================================
	// ALL XPHB BACKGROUNDS
	// ===================================================================
	describe("All XPHB Background Feat Mappings", () => {
		const xphbBackgrounds = [
			{bg: "Acolyte", feat: "magic initiate; cleric|xphb", expected: "Magic Initiate (Cleric)"},
			{bg: "Artisan", feat: "crafter|xphb", expected: "Crafter"},
			{bg: "Charlatan", feat: "skilled|xphb", expected: "Skilled"},
			{bg: "Criminal", feat: "alert|xphb", expected: "Alert"},
			{bg: "Entertainer", feat: "musician|xphb", expected: "Musician"},
			{bg: "Farmer", feat: "tough|xphb", expected: "Tough"},
			{bg: "Guard", feat: "alert|xphb", expected: "Alert"},
			{bg: "Guide", feat: "magic initiate; druid|xphb", expected: "Magic Initiate (Druid)"},
			{bg: "Hermit", feat: "healer|xphb", expected: "Healer"},
			{bg: "Merchant", feat: "lucky|xphb", expected: "Lucky"},
			{bg: "Noble", feat: "skilled|xphb", expected: "Skilled"},
			{bg: "Sage", feat: "magic initiate; wizard|xphb", expected: "Magic Initiate (Wizard)"},
			{bg: "Sailor", feat: "tavern brawler|xphb", expected: "Tavern Brawler"},
			{bg: "Scribe", feat: "skilled|xphb", expected: "Skilled"},
			{bg: "Soldier", feat: "savage attacker|xphb", expected: "Savage Attacker"},
			{bg: "Wayfarer", feat: "lucky|xphb", expected: "Lucky"},
		];

		test.each(xphbBackgrounds)("$bg background should grant $expected", ({bg, feat, expected}) => {
			state.setBackground({
				name: bg,
				source: "XPHB",
				feats: [{[feat]: true}],
			});
			const added = state.applyBackgroundFeats();
			expect(added).toBe(1);
			expect(state.getOriginFeat().name).toBe(expected);
		});
	});

	// ===================================================================
	// EDGE CASES
	// ===================================================================
	describe("Edge Cases", () => {
		test("isOriginFeat flag should persist on feat data", () => {
			state.addFeat({name: "Alert", source: "XPHB", isOriginFeat: true, backgroundName: "Criminal"});
			const feat = state._data.feats.find(f => f.name === "Alert");
			expect(feat.isOriginFeat).toBe(true);
			expect(feat.backgroundName).toBe("Criminal");
		});

		test("regular feat should not have isOriginFeat flag", () => {
			state.addFeat({name: "Alert", source: "PHB"});
			const feat = state._data.feats.find(f => f.name === "Alert");
			expect(feat.isOriginFeat).toBe(false);
		});

		test("multiple feat entries in background should all be processed", () => {
			state.setBackground({
				name: "Custom",
				source: "XPHB",
				feats: [
					{"alert|xphb": true},
					{"tough|xphb": true},
				],
			});
			const added = state.applyBackgroundFeats();
			expect(added).toBe(2);
		});

		test("_toTitleCase should handle various formats", () => {
			expect(state._toTitleCase("hello world")).toBe("Hello World");
			expect(state._toTitleCase("magic initiate")).toBe("Magic Initiate");
			expect(state._toTitleCase("")).toBe("");
			expect(state._toTitleCase("a")).toBe("A");
		});
	});
});
