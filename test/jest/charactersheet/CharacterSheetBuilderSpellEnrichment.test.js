import "./setup.js";
import "../../../js/charactersheet/charactersheet-class-utils.js";
import "../../../js/charactersheet/charactersheet-builder.js";

const CharacterSheetBuilder = globalThis.CharacterSheetBuilder;
const CharacterSheetClassUtils = globalThis.CharacterSheetClassUtils;

// A realistic raw spell object as it comes from the data files / spell picker
const MOCK_FIREBALL = {
	name: "Fireball",
	source: "PHB",
	level: 3,
	school: "V",
	time: [{number: 1, unit: "action"}],
	range: {type: "point", distance: {type: "feet", amount: 150}},
	components: {v: true, s: true, m: "a tiny ball of bat guano and sulfur"},
	duration: [{type: "instant"}],
	concentration: false,
	ritual: false,
	subschools: [],
};

const MOCK_SHIELD = {
	name: "Shield",
	source: "PHB",
	level: 1,
	school: "A",
	time: [{number: 1, unit: "reaction"}],
	range: {type: "point", distance: {type: "self"}},
	components: {v: true, s: true},
	duration: [{type: "timed", duration: {amount: 1, type: "round"}}],
	concentration: false,
	ritual: false,
};

const MOCK_FIRE_BOLT = {
	name: "Fire Bolt",
	source: "PHB",
	level: 0,
	school: "V",
	time: [{number: 1, unit: "action"}],
	range: {type: "point", distance: {type: "feet", amount: 120}},
	components: {v: true, s: true},
	duration: [{type: "instant"}],
	concentration: false,
	ritual: false,
	subschools: [],
};

const MOCK_DETECT_MAGIC = {
	name: "Detect Magic",
	source: "PHB",
	level: 1,
	school: "D",
	time: [{number: 1, unit: "action"}],
	range: {type: "point", distance: {type: "self"}},
	components: {v: true, s: true},
	duration: [{type: "timed", duration: {amount: 10, type: "minute"}, concentration: true}],
	ritual: true,
	subschools: [],
};

describe("CharacterSheetBuilder spell enrichment", () => {
	describe("_applyBuilderSpellChoices — known caster spells", () => {
		test("adds spells with full enrichment fields via buildSpellStateObject", () => {
			const capturedSpells = [];
			const capturedCantrips = [];
			const builder = Object.create(CharacterSheetBuilder.prototype);
			builder._selectedKnownSpells = [MOCK_FIREBALL, MOCK_SHIELD];
			builder._selectedKnownCantrips = [MOCK_FIRE_BOLT];
			builder._selectedSubclass = null;
			builder._divineSoulAffinity = null;
			builder._state = {
				setSubclassChoice: () => {},
				addSpell: (spell) => capturedSpells.push(spell),
				addCantrip: (cantrip) => capturedCantrips.push(cantrip),
			};
			builder._getKnownCasterInfoForBuilder = () => ({
				className: "Sorcerer",
				classSource: "PHB",
				spellCount: 2,
				cantripCount: 1,
				maxSpellLevel: 2,
			});

			builder._applyBuilderSpellChoices();

			// Known spells should have all enrichment fields
			expect(capturedSpells).toHaveLength(2);
			const fireball = capturedSpells.find(s => s.name === "Fireball");
			expect(fireball).toBeDefined();
			expect(fireball.school).toBe("V");
			expect(fireball.concentration).toBe(false);
			expect(fireball.ritual).toBe(false);
			expect(fireball.castingTime).toBe("1 action");
			expect(fireball.range).toBe("150 feet");
			expect(fireball.components).toBe("V, S, M (a tiny ball of bat guano and sulfur)");
			expect(fireball.duration).toBe("Instantaneous");
			expect(fireball.sourceFeature).toBe("Spells Known");
			expect(fireball.sourceClass).toBe("Sorcerer");
			expect(fireball.prepared).toBe(true);
			expect(fireball.subschools).toEqual([]);

			// Cantrips should use buildCantripStateObject
			expect(capturedCantrips).toHaveLength(1);
			const fireBolt = capturedCantrips[0];
			expect(fireBolt.name).toBe("Fire Bolt");
			expect(fireBolt.school).toBe("V");
			expect(fireBolt.castingTime).toBe("1 action");
			expect(fireBolt.range).toBe("120 feet");
			expect(fireBolt.sourceFeature).toBe("Cantrips Known");
			expect(fireBolt.sourceClass).toBe("Sorcerer");
		});

		test("ritual spell from builder has ritual flag set correctly", () => {
			const capturedSpells = [];
			const builder = Object.create(CharacterSheetBuilder.prototype);
			builder._selectedKnownSpells = [MOCK_DETECT_MAGIC];
			builder._selectedKnownCantrips = [];
			builder._selectedSubclass = null;
			builder._divineSoulAffinity = null;
			builder._state = {
				setSubclassChoice: () => {},
				addSpell: (spell) => capturedSpells.push(spell),
				addCantrip: () => {},
			};
			builder._getKnownCasterInfoForBuilder = () => ({
				className: "Bard",
				classSource: "PHB",
				spellCount: 4,
				cantripCount: 2,
				maxSpellLevel: 1,
			});

			builder._applyBuilderSpellChoices();

			const dm = capturedSpells[0];
			expect(dm.ritual).toBe(true);
			expect(dm.concentration).toBe(true);
			expect(dm.range).toBe("Self");
		});
	});

	describe("_applySelectedRacialSpells — racial spell choices", () => {
		test("racial cantrip gets full enrichment via buildCantripStateObject", () => {
			const capturedCantrips = [];
			const builder = Object.create(CharacterSheetBuilder.prototype);
			builder._selectedRacialSpells = [MOCK_FIRE_BOLT];
			builder._state = {
				addCantrip: (cantrip) => capturedCantrips.push(cantrip),
				addSpell: () => {},
			};

			builder._applySelectedRacialSpells("High Elf Cantrip", "int");

			expect(capturedCantrips).toHaveLength(1);
			const c = capturedCantrips[0];
			expect(c.name).toBe("Fire Bolt");
			expect(c.school).toBe("V");
			expect(c.castingTime).toBe("1 action");
			expect(c.range).toBe("120 feet");
			expect(c.sourceFeature).toBe("High Elf Cantrip");
		});

		test("racial leveled spell gets full enrichment via buildSpellStateObject", () => {
			const capturedSpells = [];
			const builder = Object.create(CharacterSheetBuilder.prototype);
			builder._selectedRacialSpells = [MOCK_SHIELD];
			builder._state = {
				addCantrip: () => {},
				addSpell: (spell) => capturedSpells.push(spell),
			};

			builder._applySelectedRacialSpells("Drow Magic", "cha");

			expect(capturedSpells).toHaveLength(1);
			const s = capturedSpells[0];
			expect(s.name).toBe("Shield");
			expect(s.school).toBe("A");
			expect(s.concentration).toBe(false);
			expect(s.castingTime).toBe("1 reaction");
			expect(s.range).toBe("Self");
			expect(s.components).toBe("V, S");
			expect(s.sourceFeature).toBe("Drow Magic");
			expect(s.prepared).toBe(true);
		});
	});

	describe("_addRacialSpell — data-resolved racial spells", () => {
		test("cantrip routes to addCantrip with full enrichment", () => {
			const capturedCantrips = [];
			const builder = Object.create(CharacterSheetBuilder.prototype);
			builder._state = {
				addCantrip: (c) => capturedCantrips.push(c),
				addSpell: () => { throw new Error("Should not call addSpell for cantrip"); },
			};

			builder._addRacialSpell(MOCK_FIRE_BOLT, "Racial Feature", false);

			expect(capturedCantrips).toHaveLength(1);
			expect(capturedCantrips[0].school).toBe("V");
			expect(capturedCantrips[0].sourceFeature).toBe("Racial Feature");
		});

		test("leveled spell routes to addSpell with full enrichment", () => {
			const capturedSpells = [];
			const builder = Object.create(CharacterSheetBuilder.prototype);
			builder._state = {
				addCantrip: () => { throw new Error("Should not call addCantrip for leveled spell"); },
				addSpell: (s) => capturedSpells.push(s),
			};

			builder._addRacialSpell(MOCK_DETECT_MAGIC, "Racial Feature", true);

			expect(capturedSpells).toHaveLength(1);
			const s = capturedSpells[0];
			expect(s.school).toBe("D");
			expect(s.ritual).toBe(true);
			expect(s.concentration).toBe(true);
			expect(s.sourceFeature).toBe("Racial Feature");
			expect(s.prepared).toBe(true);
		});
	});
});
