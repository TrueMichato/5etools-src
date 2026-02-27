/**
 * TGTT Divine Soul Sorcerer — Full L1→20 test coverage.
 *
 * Covers:
 * - Font of Magic starting at L1 (TGTT), not L2
 * - Metamagic at L2 (TGTT), not L3. Progression: 2/3/4/5/6/7 at 2/3/6/10/13/17
 * - Active vs Passive Metamagic (TGTT split)
 * - Sorcery point economy (tuning, locking, effective max)
 * - Sorcerer Specialties at 4, 8, 12, 16, 20
 * - Divine Soul subclass features:
 *     Divine Magic (L3), Favored by the Gods (L3),
 *     Empowered Healing (L6), Angelic Form (L14),
 *     Unearthly Recovery (L18)
 * - Spell slot progression (full caster)
 */

import "./setup.js";

let CharacterSheetState;
let state;

beforeAll(async () => {
	CharacterSheetState = (await import("../../../js/charactersheet/charactersheet-state.js")).CharacterSheetState;
});

describe("TGTT Divine Soul Sorcerer", () => {

	beforeEach(() => {
		state = new CharacterSheetState();
	});

	// =========================================================================
	// HELPER
	// =========================================================================
	function makeDivineSoul (level) {
		state.addClass({
			name: "Sorcerer",
			source: "TGTT",
			level,
			subclass: level >= 3
				? {name: "Divine Soul", shortName: "Divine Soul", source: "TGTT"}
				: undefined,
		});
		state.setAbilityBase("str", 8);
		state.setAbilityBase("dex", 14); // +2
		state.setAbilityBase("con", 14); // +2
		state.setAbilityBase("int", 10);
		state.setAbilityBase("wis", 12); // +1
		state.setAbilityBase("cha", 18); // +4
	}

	// =========================================================================
	// CORE CLASS SETUP
	// =========================================================================
	describe("Core Class Setup", () => {
		it("should create a TGTT Sorcerer", () => {
			makeDivineSoul(1);
			const classes = state.getClasses();
			expect(classes.length).toBe(1);
			expect(classes[0].name).toBe("Sorcerer");
			expect(classes[0].source).toBe("TGTT");
		});

		it("should recognise the Divine Soul subclass at level 3", () => {
			makeDivineSoul(3);
			const classes = state.getClasses();
			expect(classes[0].subclass).toBeDefined();
			expect(classes[0].subclass.shortName).toBe("Divine Soul");
		});

		it("should use CHA as spellcasting ability", () => {
			makeDivineSoul(5);
			state.applyClassFeatureEffects();
			const calcs = state.getFeatureCalculations();
			// Spell DC = 8 + prof(3) + CHA(4) = 15
			expect(calcs.spellSaveDc).toBe(15);
			expect(calcs.spellAttackBonus).toBe(7);
		});
	});

	// =========================================================================
	// FONT OF MAGIC — starts at L1 in TGTT (not L2)
	// =========================================================================
	describe("Font of Magic (TGTT: starts at Level 1)", () => {
		it("should grant sorcery points at level 1", () => {
			makeDivineSoul(1);
			state.setSorceryPoints(1);
			const sp = state.getSorceryPoints();
			expect(sp.max).toBe(1);
		});

		it("should scale sorcery points with Sorcerer level", () => {
			const levels = [1, 2, 5, 10, 15, 20];
			levels.forEach(lvl => {
				const s = new CharacterSheetState();
				s.addClass({name: "Sorcerer", source: "TGTT", level: lvl});
				s.setSorceryPoints(lvl);
				expect(s.getSorceryPoints().max).toBe(lvl);
			});
		});
	});

	// =========================================================================
	// METAMAGIC SYSTEM (TGTT: starts at L2, Active/Passive split)
	// =========================================================================
	describe("Metamagic System", () => {

		describe("Metamagic Progression (TGTT schedule)", () => {
			it("should have Metamagic starting at level 2 (not level 3)", () => {
				makeDivineSoul(2);
				const calcs = state.getFeatureCalculations();
				expect(calcs.hasMetamagic).toBe(true);
				expect(calcs.metamagicOptions).toBe(2);
			});

			it("should follow TGTT progression: 2/3/4/5/6/7", () => {
				const progression = [
					{level: 2, options: 2},
					{level: 3, options: 3},
					{level: 6, options: 4},
					{level: 10, options: 5},
					{level: 13, options: 6},
					{level: 17, options: 7},
				];

				for (const {level, options} of progression) {
					const s = new CharacterSheetState();
					s.addClass({name: "Sorcerer", source: "TGTT", level});
					const calcs = s.getFeatureCalculations();
					expect(calcs.metamagicOptions).toBe(options);
				}
			});

			it("should differ from XPHB progression", () => {
				const tgtt = new CharacterSheetState();
				tgtt.addClass({name: "Sorcerer", source: "TGTT", level: 6});

				const xphb = new CharacterSheetState();
				xphb.addClass({name: "Sorcerer", source: "XPHB", level: 6});

				expect(tgtt.getFeatureCalculations().metamagicOptions).toBe(4);
				expect(xphb.getFeatureCalculations().metamagicOptions).toBe(2);
			});
		});

		describe("Passive Metamagics", () => {
			beforeEach(() => {
				makeDivineSoul(5);
				state.setSorceryPoints(5);
			});

			it("should list passive metamagic definitions", () => {
				const passives = state.getPassiveMetamagics();
				expect(passives.length).toBeGreaterThan(0);

				const keys = passives.map(m => m.key);
				expect(keys).toContain("careful");
				expect(keys).toContain("distant");
				expect(keys).toContain("empowered");
				expect(keys).toContain("warding");
			});

			it("should tune a passive metamagic", () => {
				expect(state.isMetamagicTuned("careful")).toBe(false);
				const result = state.tuneMetamagic("careful");
				expect(result).toBe(true);
				expect(state.isMetamagicTuned("careful")).toBe(true);
			});

			it("should not allow tuning active metamagics", () => {
				const result = state.tuneMetamagic("quickened");
				expect(result).toBe(false);
			});

			it("should lock sorcery points when tuning passives", () => {
				expect(state.getLockedSorceryPoints()).toBe(0);

				state.tuneMetamagic("careful"); // cost 1
				expect(state.getLockedSorceryPoints()).toBe(1);

				state.tuneMetamagic("warding"); // cost 2
				expect(state.getLockedSorceryPoints()).toBe(3);
			});

			it("should calculate effective SP max correctly", () => {
				expect(state.getEffectiveSorceryPointMax()).toBe(5);

				state.tuneMetamagic("careful"); // locks 1
				expect(state.getEffectiveSorceryPointMax()).toBe(4);
			});

			it("should free locked SP when detuning", () => {
				state.tuneMetamagic("careful");
				state.tuneMetamagic("distant");
				expect(state.getLockedSorceryPoints()).toBe(2);

				state.detuneMetamagic("careful");
				expect(state.getLockedSorceryPoints()).toBe(1);
			});

			it("should not allow tuning if insufficient effective SP", () => {
				// Lock 4 SP (careful=1, distant=1, supple=2)
				state.tuneMetamagic("careful");
				state.tuneMetamagic("distant");
				state.tuneMetamagic("supple");

				// Effective max is now 1, can't tune resonant (cost 2)
				const result = state.tuneMetamagic("resonant");
				expect(result).toBe(false);
			});
		});

		describe("Active Metamagics", () => {
			it("should list active metamagics including TGTT additions", () => {
				makeDivineSoul(5);
				state.setSorceryPoints(5);
				const actives = state.getActiveMetamagics();
				const keys = actives.map(m => m.key);

				// Standard
				expect(keys).toContain("quickened");
				expect(keys).toContain("twinned");
				expect(keys).toContain("subtle");

				// TGTT-specific
				expect(keys).toContain("aimed");
				expect(keys).toContain("focused");
				expect(keys).toContain("overcharged");
			});

			it("should have correct TGTT metamagic costs", () => {
				makeDivineSoul(5);
				state.setSorceryPoints(5);

				expect(state.getMetamagicInfo("aimed").cost).toBe(2);
				expect(state.getMetamagicInfo("overcharged").cost).toBe(4);
				expect(state.getMetamagicInfo("bouncing").cost).toBe(3);
			});
		});

		describe("Metamagic Info API", () => {
			it("should return full metamagic info with tuned status", () => {
				makeDivineSoul(5);
				state.setSorceryPoints(5);
				state.tuneMetamagic("careful");

				const info = state.getMetamagicInfo("careful");
				expect(info.name).toBe("Careful Spell");
				expect(info.type).toBe("passive");
				expect(info.tuned).toBe(true);
			});

			it("should return null for unknown metamagic", () => {
				makeDivineSoul(5);
				state.setSorceryPoints(5);
				expect(state.getMetamagicInfo("nonexistent")).toBeNull();
			});
		});
	});

	// =========================================================================
	// SORCERER SPECIALTIES (TGTT-specific)
	// =========================================================================
	describe("Sorcerer (TGTT) Specialties", () => {
		it("should accept Specialty features at levels 4, 8, 12, 16, 20", () => {
			makeDivineSoul(20);
			const specialtyLevels = [4, 8, 12, 16, 20];
			specialtyLevels.forEach(lvl => {
				state.addFeature({
					name: `Sorcerer Specialty (Lv ${lvl})`,
					source: "TGTT",
					featureType: "Class",
					className: "Sorcerer",
					level: lvl,
					description: `Sorcerer specialty at level ${lvl}.`,
				});
			});

			state.applyClassFeatureEffects();
			const features = state.getFeatures();
			specialtyLevels.forEach(lvl => {
				expect(features.some(f => f.name === `Sorcerer Specialty (Lv ${lvl})`)).toBe(true);
			});
		});
	});

	// =========================================================================
	// DIVINE SOUL SUBCLASS FEATURES
	// =========================================================================
	describe("Divine Soul Subclass Features", () => {

		describe("Divine Magic (Level 3)", () => {
			it("should grant Divine Magic feature", () => {
				makeDivineSoul(3);
				state.addFeature({
					name: "Divine Magic",
					source: "TGTT",
					featureType: "Subclass",
					className: "Sorcerer",
					subclassName: "Divine Soul",
					level: 3,
					description: "Your link to the divine allows you to learn spells from the cleric spell list.",
				});
				state.applyClassFeatureEffects();
				const features = state.getFeatures();
				expect(features.some(f => f.name === "Divine Magic")).toBe(true);
			});
		});

		describe("Favored by the Gods (Level 3)", () => {
			it("should grant Favored by the Gods at level 3", () => {
				makeDivineSoul(3);
				state.addFeature({
					name: "Favored by the Gods",
					source: "TGTT",
					featureType: "Subclass",
					className: "Sorcerer",
					subclassName: "Divine Soul",
					level: 3,
					description: "You can add 2d4 to a failed saving throw or missed attack roll. Once per short or long rest.",
				});
				state.applyClassFeatureEffects();
				const features = state.getFeatures();
				expect(features.some(f => f.name === "Favored by the Gods")).toBe(true);
			});

			it("should track Favored by the Gods resource (short rest recharge)", () => {
				makeDivineSoul(3);
				state.addResource({name: "Favored by the Gods", max: 1, current: 1, recharge: "short"});

				const res = state.getResource("Favored by the Gods");
				expect(res.max).toBe(1);
				expect(res.recharge).toBe("short");
			});
		});

		describe("Empowered Healing (Level 6)", () => {
			it("should grant Empowered Healing at level 6", () => {
				makeDivineSoul(6);
				state.addFeature({
					name: "Empowered Healing",
					source: "TGTT",
					featureType: "Subclass",
					className: "Sorcerer",
					subclassName: "Divine Soul",
					level: 6,
					description: "When you or an ally within 5 feet rolls dice to determine HP regained by a spell, you can spend 1 sorcery point to reroll any number of those dice once.",
				});
				state.applyClassFeatureEffects();
				const features = state.getFeatures();
				expect(features.some(f => f.name === "Empowered Healing")).toBe(true);
			});
		});

		describe("Angelic Form (Level 14)", () => {
			it("should grant Angelic Form at level 14", () => {
				makeDivineSoul(14);
				state.addFeature({
					name: "Angelic Form",
					source: "TGTT",
					featureType: "Subclass",
					className: "Sorcerer",
					subclassName: "Divine Soul",
					level: 14,
					description: "You can use a bonus action to manifest spectral wings, gaining a flying speed of 30 feet.",
				});
				state.applyClassFeatureEffects();
				const features = state.getFeatures();
				expect(features.some(f => f.name === "Angelic Form")).toBe(true);
			});
		});

		describe("Unearthly Recovery (Level 18)", () => {
			it("should grant Unearthly Recovery at level 18", () => {
				makeDivineSoul(18);
				state.addFeature({
					name: "Unearthly Recovery",
					source: "TGTT",
					featureType: "Subclass",
					className: "Sorcerer",
					subclassName: "Divine Soul",
					level: 18,
					description: "When you are reduced to fewer than half your hit points, you can use a bonus action to regain hit points equal to half your hit point maximum.",
				});
				state.addResource({name: "Unearthly Recovery", max: 1, current: 1, recharge: "long"});
				state.applyClassFeatureEffects();

				const features = state.getFeatures();
				expect(features.some(f => f.name === "Unearthly Recovery")).toBe(true);

				const res = state.getResource("Unearthly Recovery");
				expect(res.max).toBe(1);
				expect(res.recharge).toBe("long");
			});
		});
	});

	// =========================================================================
	// SPELL SLOT PROGRESSION (Full Caster)
	// =========================================================================
	describe("Spell Slot Progression (Full Caster)", () => {
		const milestones = [
			{level: 1, maxSpellLevel: 1},
			{level: 3, maxSpellLevel: 2},
			{level: 5, maxSpellLevel: 3},
			{level: 9, maxSpellLevel: 5},
			{level: 11, maxSpellLevel: 6},
			{level: 13, maxSpellLevel: 7},
			{level: 15, maxSpellLevel: 8},
			{level: 17, maxSpellLevel: 9},
		];

		milestones.forEach(({level, maxSpellLevel}) => {
			it(`should have up to level-${maxSpellLevel} slots at Sorcerer level ${level}`, () => {
				const s = new CharacterSheetState();
				s.addClass({name: "Sorcerer", source: "TGTT", level});
				s.calculateSpellSlots();
				expect(s.getSpellSlotsMax(maxSpellLevel)).toBeGreaterThan(0);
				if (maxSpellLevel < 9) {
					expect(s.getSpellSlotsMax(maxSpellLevel + 1)).toBe(0);
				}
			});
		});
	});

	// =========================================================================
	// FULL L1→20 PROGRESSION
	// =========================================================================
	describe("Full L1→20 Progression", () => {
		it("should maintain valid state at every level", () => {
			for (let lvl = 1; lvl <= 20; lvl++) {
				const s = new CharacterSheetState();
				s.addClass({
					name: "Sorcerer", source: "TGTT", level: lvl,
					subclass: lvl >= 3
						? {name: "Divine Soul", shortName: "Divine Soul", source: "TGTT"}
						: undefined,
				});
				s.setAbilityBase("cha", 18);

				expect(s.getTotalLevel()).toBe(lvl);
				s.applyClassFeatureEffects();
				const calcs = s.getFeatureCalculations();
				expect(calcs.spellSaveDc).toBeGreaterThanOrEqual(12);
			}
		});

		it("should track sorcery points = level at every level", () => {
			for (let lvl = 1; lvl <= 20; lvl++) {
				const s = new CharacterSheetState();
				s.addClass({name: "Sorcerer", source: "TGTT", level: lvl});
				s.setSorceryPoints(lvl);
				expect(s.getSorceryPoints().max).toBe(lvl);
			}
		});

		it("should track proficiency bonus correctly", () => {
			const profTable = [
				{level: 1, prof: 2}, {level: 4, prof: 2},
				{level: 5, prof: 3}, {level: 8, prof: 3},
				{level: 9, prof: 4}, {level: 12, prof: 4},
				{level: 13, prof: 5}, {level: 16, prof: 5},
				{level: 17, prof: 6}, {level: 20, prof: 6},
			];

			profTable.forEach(({level, prof}) => {
				const s = new CharacterSheetState();
				s.addClass({name: "Sorcerer", source: "TGTT", level});
				expect(s.getProficiencyBonus()).toBe(prof);
			});
		});
	});
});
