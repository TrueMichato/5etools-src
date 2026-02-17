/**
 * Tests for Character Sheet Level History and Respec functionality
 */

import "./setup.js";
import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

describe("CharacterSheetLevelHistory", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
	});

	describe("Level History Storage", () => {
		it("should initialize with empty level history", () => {
			expect(state.getLevelHistory()).toEqual([]);
		});

		it("should not be legacy character with no levels", () => {
			expect(state.isLegacyCharacter()).toBe(false);
		});

		it("should have complete history with no levels", () => {
			expect(state.hasCompleteLevelHistory()).toBe(true);
		});

		it("should record a level choice", () => {
			state.recordLevelChoice({
				level: 1,
				class: {name: "Fighter", source: "PHB"},
				choices: {
					skills: ["athletics", "perception"],
				},
				complete: true,
			});

			const history = state.getLevelHistory();
			expect(history.length).toBe(1);
			expect(history[0].level).toBe(1);
			expect(history[0].class.name).toBe("Fighter");
			expect(history[0].choices.skills).toContain("athletics");
		});

		it("should replace existing history entry for same level", () => {
			state.recordLevelChoice({
				level: 1,
				class: {name: "Fighter", source: "PHB"},
				choices: {skills: ["athletics"]},
			});

			state.recordLevelChoice({
				level: 1,
				class: {name: "Fighter", source: "PHB"},
				choices: {skills: ["perception"]},
			});

			const history = state.getLevelHistory();
			expect(history.length).toBe(1);
			expect(history[0].choices.skills).toContain("perception");
			expect(history[0].choices.skills).not.toContain("athletics");
		});

		it("should sort history entries by level", () => {
			state.recordLevelChoice({level: 3, class: {name: "Fighter", source: "PHB"}, choices: {}});
			state.recordLevelChoice({level: 1, class: {name: "Fighter", source: "PHB"}, choices: {}});
			state.recordLevelChoice({level: 2, class: {name: "Fighter", source: "PHB"}, choices: {}});

			const history = state.getLevelHistory();
			expect(history[0].level).toBe(1);
			expect(history[1].level).toBe(2);
			expect(history[2].level).toBe(3);
		});

		it("should get history entry for specific level", () => {
			state.recordLevelChoice({level: 1, class: {name: "Fighter", source: "PHB"}, choices: {}});
			state.recordLevelChoice({level: 2, class: {name: "Fighter", source: "PHB"}, choices: {}});

			const entry = state.getLevelHistoryEntry(1);
			expect(entry).not.toBeNull();
			expect(entry.level).toBe(1);

			expect(state.getLevelHistoryEntry(3)).toBeNull();
		});

		it("should update level choice", () => {
			state.recordLevelChoice({
				level: 4,
				class: {name: "Fighter", source: "PHB"},
				choices: {asi: {str: 2}},
			});

			const updated = state.updateLevelChoice(4, {
				asi: {dex: 1, wis: 1},
			});

			expect(updated).toBe(true);
			const entry = state.getLevelHistoryEntry(4);
			expect(entry.choices.asi.dex).toBe(1);
			expect(entry.choices.asi.wis).toBe(1);
		});

		it("should return false when updating non-existent level", () => {
			const updated = state.updateLevelChoice(10, {asi: {str: 2}});
			expect(updated).toBe(false);
		});

		it("should clear level history", () => {
			state.recordLevelChoice({level: 1, class: {name: "Fighter", source: "PHB"}, choices: {}});
			state.recordLevelChoice({level: 2, class: {name: "Fighter", source: "PHB"}, choices: {}});

			state.clearLevelHistory();
			expect(state.getLevelHistory()).toEqual([]);
		});
	});

	describe("Legacy Character Detection", () => {
		it("should detect legacy character when levels exist without history", () => {
			// Add class directly without going through level-up flow
			state.addClass({name: "Fighter", source: "PHB", level: 3});

			expect(state.getTotalLevel()).toBe(3);
			expect(state.isLegacyCharacter()).toBe(true);
			expect(state.hasCompleteLevelHistory()).toBe(false);
		});

		it("should not be legacy when history matches levels", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 2});

			state.recordLevelChoice({level: 1, class: {name: "Fighter", source: "PHB"}, choices: {}});
			state.recordLevelChoice({level: 2, class: {name: "Fighter", source: "PHB"}, choices: {}});

			expect(state.isLegacyCharacter()).toBe(false);
			expect(state.hasCompleteLevelHistory()).toBe(true);
		});

		it("should be legacy when history is partial", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 3});

			state.recordLevelChoice({level: 1, class: {name: "Fighter", source: "PHB"}, choices: {}});
			// Missing level 2 and 3

			expect(state.isLegacyCharacter()).toBe(true);
		});
	});

	describe("ASI and Feat Tracking", () => {
		it("should record ASI choice in history", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 4});

			state.recordLevelChoice({
				level: 4,
				class: {name: "Fighter", source: "PHB"},
				choices: {
					asi: {str: 1, con: 1},
				},
			});

			const asiChoices = state.getAsiAndFeatChoices();
			expect(asiChoices.length).toBe(1);
			expect(asiChoices[0].type).toBe("asi");
			expect(asiChoices[0].data.str).toBe(1);
			expect(asiChoices[0].data.con).toBe(1);
		});

		it("should record feat choice in history", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 4});

			state.recordLevelChoice({
				level: 4,
				class: {name: "Fighter", source: "PHB"},
				choices: {
					feat: {name: "Sentinel", source: "PHB"},
				},
			});

			const asiChoices = state.getAsiAndFeatChoices();
			expect(asiChoices.length).toBe(1);
			expect(asiChoices[0].type).toBe("feat");
			expect(asiChoices[0].data.name).toBe("Sentinel");
		});

		it("should track multiple ASI levels", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 8});

			state.recordLevelChoice({
				level: 4,
				class: {name: "Fighter", source: "PHB"},
				choices: {asi: {str: 2}},
			});

			state.recordLevelChoice({
				level: 6,
				class: {name: "Fighter", source: "PHB"},
				choices: {feat: {name: "Great Weapon Master", source: "PHB"}},
			});

			state.recordLevelChoice({
				level: 8,
				class: {name: "Fighter", source: "PHB"},
				choices: {asi: {con: 2}},
			});

			const choices = state.getAsiAndFeatChoices();
			expect(choices.length).toBe(3);
			expect(choices.find(c => c.level === 6).type).toBe("feat");
		});
	});

	describe("Subclass Tracking", () => {
		it("should record subclass choice in history", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 3});

			state.recordLevelChoice({
				level: 3,
				class: {name: "Fighter", source: "PHB"},
				choices: {
					subclass: {name: "Champion", shortName: "Champion", source: "PHB"},
				},
			});

			const subclassChoices = state.getSubclassChoices();
			expect(subclassChoices.length).toBe(1);
			expect(subclassChoices[0].subclass.name).toBe("Champion");
		});

		it("should track subclass for level 1 casters", () => {
			state.addClass({name: "Cleric", source: "PHB", level: 1});

			state.recordLevelChoice({
				level: 1,
				class: {name: "Cleric", source: "PHB"},
				choices: {
					subclass: {name: "Life Domain", shortName: "Life", source: "PHB"},
				},
			});

			const subclassChoices = state.getSubclassChoices();
			expect(subclassChoices.length).toBe(1);
			expect(subclassChoices[0].level).toBe(1);
		});
	});

	describe("Level Summary", () => {
		it("should return null for non-existent level", () => {
			expect(state.getLevelSummary(5)).toBeNull();
		});

		it("should return summary with choices and features", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 1});

			state.recordLevelChoice({
				level: 1,
				class: {name: "Fighter", source: "PHB"},
				choices: {
					skills: ["athletics", "intimidation"],
					featureChoices: [{featureName: "Fighting Style", choice: "Defense"}],
				},
			});

			// Add a feature at level 1
			state.addFeature({
				name: "Second Wind",
				source: "PHB",
				className: "Fighter",
				level: 1,
				featureType: "Class",
			});

			const summary = state.getLevelSummary(1);
			expect(summary.level).toBe(1);
			expect(summary.class.name).toBe("Fighter");
			expect(summary.choices.skills).toContain("athletics");
			expect(summary.features.length).toBeGreaterThan(0);
		});
	});

	describe("Serialization", () => {
		it("should serialize and deserialize level history", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 2});

			state.recordLevelChoice({
				level: 1,
				class: {name: "Fighter", source: "PHB"},
				choices: {skills: ["athletics", "perception"]},
				complete: true,
				timestamp: 12345,
			});

			state.recordLevelChoice({
				level: 2,
				class: {name: "Fighter", source: "PHB"},
				choices: {},
				complete: true,
			});

			const json = state.toJson();
			const newState = new CharacterSheetState();
			newState.loadFromJson(json);

			const history = newState.getLevelHistory();
			expect(history.length).toBe(2);
			expect(history[0].choices.skills).toEqual(["athletics", "perception"]);
			expect(history[0].timestamp).toBe(12345);
		});

		it("should handle missing level history in old saves", () => {
			const oldSave = {
				name: "Old Character",
				classes: [{name: "Fighter", source: "PHB", level: 5}],
				// No levelHistory field - simulating old save format
			};

			state.loadFromJson(oldSave);

			// Should initialize empty array, not fail
			expect(state.getLevelHistory()).toEqual([]);
			// Should be detected as legacy
			expect(state.isLegacyCharacter()).toBe(true);
		});
	});

	describe("Feature Choices Recording", () => {
		it("should record optional features like invocations", () => {
			state.addClass({name: "Warlock", source: "PHB", level: 2});

			state.recordLevelChoice({
				level: 2,
				class: {name: "Warlock", source: "PHB"},
				choices: {
					optionalFeatures: [
						{name: "Agonizing Blast", source: "PHB", type: "EI"},
						{name: "Eldritch Spear", source: "PHB", type: "EI"},
					],
				},
			});

			const entry = state.getLevelHistoryEntry(2);
			expect(entry.choices.optionalFeatures.length).toBe(2);
			expect(entry.choices.optionalFeatures[0].name).toBe("Agonizing Blast");
		});

		it("should record expertise selections", () => {
			state.addClass({name: "Rogue", source: "PHB", level: 1});

			state.recordLevelChoice({
				level: 1,
				class: {name: "Rogue", source: "PHB"},
				choices: {
					skills: ["stealth", "sleight of hand", "perception", "investigation"],
					expertise: ["stealth", "sleight of hand"],
				},
			});

			const entry = state.getLevelHistoryEntry(1);
			expect(entry.choices.expertise).toContain("stealth");
			expect(entry.choices.expertise.length).toBe(2);
		});
	});
});
