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

describe("CharacterSheetClassUtils optional feature parsing", () => {
	const observerFeature = {
		name: "Observer",
		source: "TGTT",
		entries: [
			"You gain a bonus to Wisdom ({@skill Perception}) checks equal to your proficiency bonus. In addition, your passive Wisdom ({@skill Perception}) score increases by 3.",
		],
	};

	const extraSkillFeature = {
		name: "Extra Skill Training",
		source: "TGTT",
		entries: [
			"You gain proficiency in one of the following: {@skill Acrobatics}, {@skill Athletics}, {@skill Investigation}, {@skill Perception}, {@skill Stealth}, or any tool.",
		],
	};

	const expertiseTrainingFeature = {
		name: "Expertise Training",
		source: "TGTT",
		entries: [
			"You gain a bonus equal to your proficiency bonus on checks made with one of the following skills or tools: {@skill Acrobatics}, {@skill Athletics}, {@skill Investigation}, {@skill Perception}, {@skill Stealth}, or any tool.",
		],
	};

	const allOptFeatures = [observerFeature, extraSkillFeature, expertiseTrainingFeature];

	test("parseFeatureAutoEffects should parse passive bonus from optionalfeature", () => {
		const opt = {type: "optionalfeature", ref: "Observer|TGTT", name: "Observer", source: "TGTT"};
		const effects = CharacterSheetClassUtils.parseFeatureAutoEffects(opt, [], {optionalFeatures: allOptFeatures});
		const passiveEffect = effects.find(e => e.type === "passive:perception");
		expect(passiveEffect).toBeDefined();
		expect(passiveEffect.value).toBe(3);
	});

	test("parseFeatureAutoEffects should parse skill PB bonus from optionalfeature", () => {
		const opt = {type: "optionalfeature", ref: "Observer|TGTT", name: "Observer", source: "TGTT"};
		const effects = CharacterSheetClassUtils.parseFeatureAutoEffects(opt, [], {optionalFeatures: allOptFeatures});
		const skillEffect = effects.find(e => e.type === "skill:perception");
		expect(skillEffect).toBeDefined();
		expect(skillEffect.value).toBe("proficiency");
	});

	test("parseFeatureSkillChoice should parse proficiency choice from optionalfeature", () => {
		const opt = {type: "optionalfeature", ref: "Extra Skill Training|TGTT", name: "Extra Skill Training", source: "TGTT"};
		const choice = CharacterSheetClassUtils.parseFeatureSkillChoice(opt, [], {optionalFeatures: allOptFeatures});
		expect(choice).not.toBeNull();
		expect(choice.type).toBe("proficiency");
		expect(choice.count).toBe(1);
		expect(choice.from).toContain("Perception");
	});

	test("parseFeatureSkillChoice should parse PB bonus choice from optionalfeature", () => {
		const opt = {type: "optionalfeature", ref: "Expertise Training|TGTT", name: "Expertise Training", source: "TGTT"};
		const choice = CharacterSheetClassUtils.parseFeatureSkillChoice(opt, [], {optionalFeatures: allOptFeatures});
		expect(choice).not.toBeNull();
		expect(choice.type).toBe("bonus");
		expect(choice.count).toBe(1);
		expect(choice.from).toContain("Athletics");
	});

	test("parseFeatureAutoEffects should still reject unknown types", () => {
		const opt = {type: "unknown", ref: "Observer|TGTT", name: "Observer", source: "TGTT"};
		const effects = CharacterSheetClassUtils.parseFeatureAutoEffects(opt, [], {optionalFeatures: allOptFeatures});
		expect(effects).toEqual([]);
	});

	test("parseFeatureAutoEffects should accept resolvedData directly", () => {
		const opt = {type: "optionalfeature", ref: "Observer|TGTT", name: "Observer", source: "TGTT"};
		const effects = CharacterSheetClassUtils.parseFeatureAutoEffects(opt, [], {resolvedData: observerFeature});
		expect(effects.find(e => e.type === "passive:perception")).toBeDefined();
	});
});
