import "./setup.js";
import "../../../js/charactersheet/charactersheet-class-utils.js";

const CharacterSheetClassUtils = globalThis.CharacterSheetClassUtils;

describe("CharacterSheetClassUtils feature payload normalization", () => {
	test("buildFeatureStateObject preserves metadata-first fields", () => {
		const raw = {
			name: "Homebrew Aura",
			source: "HB",
			featureType: ["CTM:1AM", "CTM:2AM"],
			activatable: {
				interactionMode: "trigger",
				activationAction: "reaction",
				effects: [{type: "bonus", target: "ac", value: 1}],
			},
			effects: [{type: "resistance", target: "fire"}],
			uses: {current: 1, max: 1, recharge: "long"},
			entries: [{type: "entries", entries: ["Test"]}],
		};

		const out = CharacterSheetClassUtils.buildFeatureStateObject(raw, {
			className: "Fighter",
			classSource: "PHB",
			level: 3,
			featureType: "Optional Feature",
		});

		expect(out.name).toBe("Homebrew Aura");
		expect(out.className).toBe("Fighter");
		expect(out.featureType).toBe("Optional Feature");
		expect(out.optionalFeatureTypes).toEqual(["CTM:1AM", "CTM:2AM"]);
		expect(out.activatable).toEqual(raw.activatable);
		expect(out.effects).toEqual(raw.effects);
		expect(out.uses).toEqual(raw.uses);
		expect(out.entries).toEqual(raw.entries);
		expect(out.description).toBeTruthy();
	});

	test("dedupAndBuildFeatures keeps activatable metadata on class features", () => {
		const features = [
			{
				name: "Blade Warding Stance",
				source: "TGTT",
				entries: [{type: "entries", entries: ["You can activate this stance."]}],
				activatable: {
					interactionMode: "toggle",
					activationAction: "bonus",
					effects: [{type: "bonus", target: "ac", value: 2}],
				},
			},
		];

		const out = CharacterSheetClassUtils.dedupAndBuildFeatures(features, [], {
			className: "Fighter",
			classSource: "PHB",
			level: 5,
		});

		expect(out).toHaveLength(1);
		expect(out[0].name).toBe("Blade Warding Stance");
		expect(out[0].featureType).toBe("Class");
		expect(out[0].activatable).toEqual(features[0].activatable);
		expect(out[0].description).toBeTruthy();
	});
});
