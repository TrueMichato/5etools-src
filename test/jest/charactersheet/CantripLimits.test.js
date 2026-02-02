
import "./setup.js";
import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

describe("Cantrip Limits Logic", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
	});

	it("should count manual cantrips against limit", () => {
		// Add manual cantrip
		state.addSpell({
			name: "Sacred Flame",
			source: "PHB",
			level: 0,
		});

		const cantrips = state.getCantripsKnown();
		expect(cantrips.length).toBe(1);
		expect(cantrips[0].name).toBe("Sacred Flame");
		expect(cantrips[0].sourceFeature).toBeFalsy();

		// Logic used in UI:
		const count = cantrips.filter(c => !c.sourceFeature).length;
		expect(count).toBe(1);
	});

	it("should NOT count feature-granted cantrips against limit", () => {
		// Add feature cantrip (simulating _processFeatureSpells logic)
		state.addSpell({
			name: "Light",
			source: "PHB",
			level: 0,
			sourceFeature: "Light Domain",
		});

		const cantrips = state.getCantripsKnown();
		expect(cantrips.length).toBe(1);
		expect(cantrips[0].name).toBe("Light");
		expect(cantrips[0].sourceFeature).toBe("Light Domain");

		// Logic used in UI:
		const count = cantrips.filter(c => !c.sourceFeature).length;
		expect(count).toBe(0);
	});

	it("should update manual cantrip to feature cantrip if granted later", () => {
		// 1. Add manual "Light"
		state.addSpell({
			name: "Light",
			source: "PHB",
			level: 0,
		});

		let cantrips = state.getCantripsKnown();
		expect(cantrips[0].sourceFeature).toBeFalsy();
		expect(cantrips.filter(c => !c.sourceFeature).length).toBe(1);

		// 2. Add "Light" from feature
		state.addSpell({
			name: "Light",
			source: "PHB",
			level: 0,
			sourceFeature: "Light Domain",
		});

		cantrips = state.getCantripsKnown();
		expect(cantrips.length).toBe(1); // Should still be 1 entry
		expect(cantrips[0].sourceFeature).toBe("Light Domain"); // Should be updated

		// Logic used in UI:
		const count = cantrips.filter(c => !c.sourceFeature).length;
		expect(count).toBe(0); // Should now count as 0
	});

	it("should handle mixed cantrips", () => {
		state.addSpell({ name: "Manual 1", source: "PHB", level: 0 });
		state.addSpell({ name: "Feature 1", source: "PHB", level: 0, sourceFeature: "Feat" });
		state.addSpell({ name: "Manual 2", source: "PHB", level: 0 });

		const cantrips = state.getCantripsKnown();
		const count = cantrips.filter(c => !c.sourceFeature).length;
		expect(count).toBe(2);
	});
});

describe("Spells Known Limits Logic", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
	});

	describe("PHB Sorcerer (Known Caster)", () => {
		beforeEach(() => {
			// Set up a level 5 PHB Sorcerer (should have 6 spells known)
			state.addClass({
				name: "Sorcerer",
				source: "PHB",
				level: 5,
			});
		});

		it("should return spellcasting info for known caster", () => {
			const info = state.getSpellcastingInfo();
			expect(info).toBeTruthy();
			expect(info.type).toBe("known");
			expect(info.spellsKnownMax).toBe(6); // Sorcerer level 5 = 6 spells known
		});

		it("should track leveled spells known count", () => {
			// Add some spells
			state.addSpell({ name: "Magic Missile", source: "PHB", level: 1 });
			state.addSpell({ name: "Shield", source: "PHB", level: 1 });
			state.addSpell({ name: "Fireball", source: "PHB", level: 3 });

			const spells = state.getSpells();
			const leveledSpells = spells.filter(s => s.level > 0);
			expect(leveledSpells.length).toBe(3);
		});

		it("should not count feature spells against known limit", () => {
			// Add a manual spell
			state.addSpell({ name: "Magic Missile", source: "PHB", level: 1 });
			// Add a feature spell (e.g., from Draconic Bloodline)
			state.addSpell({ name: "Cause Fear", source: "XGE", level: 1, sourceFeature: "Draconic Bloodline" });

			const spells = state.getSpells();
			const leveledSpells = spells.filter(s => s.level > 0);
			const manualSpells = leveledSpells.filter(s => !s.sourceFeature);

			expect(leveledSpells.length).toBe(2); // Total
			expect(manualSpells.length).toBe(1); // Only manual counts against limit
		});
	});

	describe("PHB Bard (Known Caster)", () => {
		beforeEach(() => {
			// Set up a level 3 PHB Bard (should have 6 spells known)
			state.addClass({
				name: "Bard",
				source: "PHB",
				level: 3,
			});
		});

		it("should return correct spells known for Bard", () => {
			const info = state.getSpellcastingInfo();
			expect(info).toBeTruthy();
			expect(info.type).toBe("known");
			expect(info.spellsKnownMax).toBe(6); // Bard level 3 = 6 spells known
		});
	});

	describe("PHB Warlock (Known Caster)", () => {
		beforeEach(() => {
			// Set up a level 5 PHB Warlock (should have 6 spells known)
			state.addClass({
				name: "Warlock",
				source: "PHB",
				level: 5,
			});
		});

		it("should return correct spells known for Warlock", () => {
			const info = state.getSpellcastingInfo();
			expect(info).toBeTruthy();
			expect(info.type).toBe("known");
			expect(info.spellsKnownMax).toBe(6); // Warlock level 5 = 6 spells known
		});
	});

	describe("PHB Ranger (Known Caster)", () => {
		beforeEach(() => {
			// Set up a level 5 PHB Ranger (should have 4 spells known)
			state.addClass({
				name: "Ranger",
				source: "PHB",
				level: 5,
			});
		});

		it("should return correct spells known for Ranger", () => {
			const info = state.getSpellcastingInfo();
			expect(info).toBeTruthy();
			expect(info.type).toBe("known");
			expect(info.spellsKnownMax).toBe(4); // Ranger level 5 = 4 spells known
		});
	});

	describe("Multiclass (Known + Prepared)", () => {
		beforeEach(() => {
			// Set up Sorcerer 3 / Cleric 2 multiclass
			state.addClass({
				name: "Sorcerer",
				source: "PHB",
				level: 3,
			});
			state.addClass({
				name: "Cleric",
				source: "PHB",
				level: 2,
			});
		});

		it("should return mixed type for multiclass with known and prepared", () => {
			const info = state.getSpellcastingInfo();
			expect(info).toBeTruthy();
			expect(info.isMulticlass).toBe(true);
			expect(info.type).toBe("mixed");
		});

		it("should include byClass breakdown", () => {
			const info = state.getSpellcastingInfo();
			expect(info.byClass).toBeTruthy();
			expect(info.byClass.length).toBe(2);

			const sorcererInfo = info.byClass.find(c => c.className === "Sorcerer");
			expect(sorcererInfo).toBeTruthy();
			expect(sorcererInfo.type).toBe("known");
			expect(sorcererInfo.spellsKnownMax).toBe(4); // Sorcerer level 3

			const clericInfo = info.byClass.find(c => c.className === "Cleric");
			expect(clericInfo).toBeTruthy();
			expect(clericInfo.type).toBe("prepared");
		});

		it("should track total spells known limit from known casters only", () => {
			const info = state.getSpellcastingInfo();
			// spellsKnownMax should only count from known casters (Sorcerer)
			expect(info.spellsKnownMax).toBe(4); // Only Sorcerer's known spells
		});
	});
});
