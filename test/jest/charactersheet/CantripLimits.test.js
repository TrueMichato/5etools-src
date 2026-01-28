
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
			level: 0
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
			sourceFeature: "Light Domain"
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
			level: 0
		});
		
		let cantrips = state.getCantripsKnown();
		expect(cantrips[0].sourceFeature).toBeFalsy();
		expect(cantrips.filter(c => !c.sourceFeature).length).toBe(1);

		// 2. Add "Light" from feature
		state.addSpell({
			name: "Light",
			source: "PHB",
			level: 0,
			sourceFeature: "Light Domain"
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
