import "./setup.js";
import "../../../js/charactersheet/charactersheet-class-utils.js";
import "../../../js/charactersheet/charactersheet-builder.js";

const CharacterSheetBuilder = globalThis.CharacterSheetBuilder;

describe("CharacterSheetBuilder feature entry ingestion", () => {
	test("_addFeatureEntries preserves metadata-first fields", () => {
		const captured = [];
		const builder = Object.create(CharacterSheetBuilder.prototype);
		builder._state = {
			addFeature: (feature) => captured.push(feature),
		};

		const entry = {
			name: "Ancestral Burst",
			entries: [{type: "entries", entries: ["You can unleash a burst of force."]}],
			activatable: {
				interactionMode: "trigger",
				activationAction: "reaction",
				effects: [{type: "bonus", target: "ac", value: 1}],
			},
			effects: [{type: "resistance", target: "force"}],
			uses: {current: 1, max: 1, recharge: "long"},
		};

		builder._addFeatureEntries([entry], "HB", "Species");

		expect(captured).toHaveLength(1);
		expect(captured[0].name).toBe("Ancestral Burst");
		expect(captured[0].source).toBe("HB");
		expect(captured[0].featureType).toBe("Species");
		expect(captured[0].activatable).toEqual(entry.activatable);
		expect(captured[0].effects).toEqual(entry.effects);
		expect(captured[0].uses).toEqual(entry.uses);
		expect(captured[0].description).toBeTruthy();
	});

	test("_addFeatureEntries keeps explicit entry source over fallback source", () => {
		const captured = [];
		const builder = Object.create(CharacterSheetBuilder.prototype);
		builder._state = {
			addFeature: (feature) => captured.push(feature),
		};

		builder._addFeatureEntries([
			{
				name: "Shadow Gift",
				source: "BookOfEbonTides",
				entries: [{type: "entries", entries: ["You gain shadow affinity."]}],
			},
		], "HB", "Background");

		expect(captured).toHaveLength(1);
		expect(captured[0].source).toBe("BookOfEbonTides");
		expect(captured[0].featureType).toBe("Background");
	});
});
