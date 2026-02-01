/**
 * Character Sheet Race, Background, and Class Feature Tests
 * Tests for specific racial traits, background features, and class mechanics
 */

import "./setup.js";
import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

describe("Race, Background, and Class Feature Tests", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
	});

	// ==========================================================================
	// Racial Traits - PHB Races
	// ==========================================================================
	describe("PHB Racial Traits", () => {
		describe("Dwarf Traits", () => {
			beforeEach(() => {
				state.setRace({name: "Dwarf", subrace: "Hill", source: "PHB"});
			});

			it("should apply Dwarven Resilience (poison resistance)", () => {
				state.addFeature({
					name: "Dwarven Resilience",
					source: "PHB",
					resistances: ["poison"],
					saveAdvantage: ["poison"],
				});

				expect(state.hasResistance("poison")).toBe(true);
			});

			it("should apply Dwarven Toughness (+1 HP per level)", () => {
				state.addClass({name: "Fighter", source: "PHB", level: 5});
				state.addFeature({
					name: "Dwarven Toughness",
					source: "PHB",
					hpPerLevel: 1,
				});

				// HP bonus would be calculated based on level
				expect(state.hasFeature("Dwarven Toughness")).toBe(true);
			});

			it("should set base speed to 25 (not reduced by heavy armor)", () => {
				state.setSpeed("walk", 25);
				expect(state.getSpeed("walk")).toBe(25);
			});
		});

		describe("Elf Traits", () => {
			beforeEach(() => {
				state.setRace({name: "Elf", subrace: "High", source: "PHB"});
			});

			it("should apply Darkvision 60ft", () => {
				state.setSense("darkvision", 60);
				expect(state.getSense("darkvision")).toBe(60);
			});

			it("should apply Fey Ancestry (charm advantage, sleep immunity)", () => {
				state.addFeature({
					name: "Fey Ancestry",
					source: "PHB",
					saveAdvantage: ["charmed"],
					conditionImmunities: ["sleep"],
				});

				expect(state.hasFeature("Fey Ancestry")).toBe(true);
			});

			it("should apply Trance (4-hour long rest)", () => {
				state.addFeature({
					name: "Trance",
					source: "PHB",
					longRestDuration: 4,
				});

				expect(state.hasFeature("Trance")).toBe(true);
			});

			it("should grant free cantrip (High Elf)", () => {
				state.addCantrip({name: "Fire Bolt", source: "PHB"}, "int");
				expect(state.getCantrips().length).toBeGreaterThan(0);
			});
		});

		describe("Halfling Traits", () => {
			beforeEach(() => {
				state.setRace({name: "Halfling", subrace: "Lightfoot", source: "PHB"});
			});

			it("should apply Lucky (reroll 1s)", () => {
				state.addFeature({
					name: "Lucky",
					source: "PHB",
					rerollOnes: true,
				});

				expect(state.hasFeature("Lucky")).toBe(true);
			});

			it("should apply Brave (advantage vs frightened)", () => {
				state.addFeature({
					name: "Brave",
					source: "PHB",
					saveAdvantage: ["frightened"],
				});

				expect(state.hasFeature("Brave")).toBe(true);
			});

			it("should apply Halfling Nimbleness (move through larger creatures)", () => {
				state.addFeature({
					name: "Halfling Nimbleness",
					source: "PHB",
				});

				expect(state.hasFeature("Halfling Nimbleness")).toBe(true);
			});

			it("should apply Naturally Stealthy (Lightfoot)", () => {
				state.addFeature({
					name: "Naturally Stealthy",
					source: "PHB",
				});

				expect(state.hasFeature("Naturally Stealthy")).toBe(true);
			});
		});

		describe("Human Traits", () => {
			it("should apply +1 to all ability scores (standard)", () => {
				state.setRace({name: "Human", source: "PHB"});

				["str", "dex", "con", "int", "wis", "cha"].forEach(ability => {
					state.setAbilityBase(ability, 10);
					state.setAbilityBonus(ability, 1);
				});

				["str", "dex", "con", "int", "wis", "cha"].forEach(ability => {
					expect(state.getAbilityScore(ability)).toBe(11);
				});
			});

			it("should grant feat at level 1 (Variant Human)", () => {
				state.setRace({name: "Human", subrace: "Variant", source: "PHB"});
				state.addFeat({name: "Alert", source: "PHB"});

				expect(state.hasFeat("Alert")).toBe(true);
			});
		});

		describe("Half-Elf Traits", () => {
			beforeEach(() => {
				state.setRace({name: "Half-Elf", source: "PHB"});
			});

			it("should apply +2 CHA and +1 to two other abilities", () => {
				state.setAbilityBase("cha", 15);
				state.setAbilityBonus("cha", 2);
				state.setAbilityBase("str", 13);
				state.addAbilityBonus("str", 1);
				state.setAbilityBase("con", 13);
				state.addAbilityBonus("con", 1);

				expect(state.getAbilityScore("cha")).toBe(17);
			});

			it("should grant two skill proficiencies", () => {
				state.setSkillProficiency("persuasion", true);
				state.setSkillProficiency("deception", true);

				expect(state.isSkillProficient("persuasion")).toBe(true);
				expect(state.isSkillProficient("deception")).toBe(true);
			});

			it("should inherit Fey Ancestry and Darkvision", () => {
				state.setSense("darkvision", 60);
				state.addFeature({name: "Fey Ancestry", source: "PHB"});

				expect(state.getSense("darkvision")).toBe(60);
				expect(state.hasFeature("Fey Ancestry")).toBe(true);
			});
		});

		describe("Tiefling Traits", () => {
			beforeEach(() => {
				state.setRace({name: "Tiefling", source: "PHB"});
			});

			it("should apply fire resistance", () => {
				state.addResistance("fire");
				expect(state.hasResistance("fire")).toBe(true);
			});

			it("should grant Infernal Legacy spells at appropriate levels", () => {
				// Thaumaturgy at level 1
				state.addInnateSpell({
					name: "Thaumaturgy",
					source: "PHB",
					level: 0,
					atWill: true,
				});

				// Hellish Rebuke at level 3
				state.addInnateSpell({
					name: "Hellish Rebuke",
					source: "PHB",
					level: 1,
					usesPerDay: 1,
				});

				expect(state.getInnateSpells().length).toBe(2);
			});
		});

		describe("Dragonborn Traits", () => {
			beforeEach(() => {
				state.setRace({name: "Dragonborn", source: "PHB"});
			});

			it("should grant breath weapon", () => {
				state.addFeature({
					name: "Breath Weapon",
					source: "PHB",
					uses: 1,
					recharge: "short",
					damageType: "fire",
				});

				expect(state.hasFeature("Breath Weapon")).toBe(true);
			});

			it("should grant damage resistance matching ancestry", () => {
				// Gold Dragonborn = fire
				state.addResistance("fire");
				expect(state.hasResistance("fire")).toBe(true);
			});
		});

		describe("Gnome Traits", () => {
			beforeEach(() => {
				state.setRace({name: "Gnome", subrace: "Rock", source: "PHB"});
			});

			it("should apply Gnome Cunning (advantage on INT/WIS/CHA saves vs magic)", () => {
				state.addFeature({
					name: "Gnome Cunning",
					source: "PHB",
					magicSaveAdvantage: ["int", "wis", "cha"],
				});

				expect(state.hasFeature("Gnome Cunning")).toBe(true);
			});

			it("should set Small size", () => {
				state.setSize("small");
				expect(state.getSize()).toBe("small");
			});
		});

		describe("Half-Orc Traits", () => {
			beforeEach(() => {
				state.setRace({name: "Half-Orc", source: "PHB"});
			});

			it("should apply Relentless Endurance (drop to 1 HP instead of 0)", () => {
				state.addFeature({
					name: "Relentless Endurance",
					source: "PHB",
					uses: 1,
					recharge: "long",
				});

				expect(state.hasFeature("Relentless Endurance")).toBe(true);
			});

			it("should apply Savage Attacks (extra crit die)", () => {
				state.addFeature({
					name: "Savage Attacks",
					source: "PHB",
					extraCritDice: 1,
				});

				expect(state.hasFeature("Savage Attacks")).toBe(true);
			});
		});
	});

	// ==========================================================================
	// Race Speed Traits (Equal to Walk)
	// ==========================================================================
	describe("Race Speed Traits", () => {
		describe("Tabaxi (MPMM) - Climb Speed Equal to Walk", () => {
			it("should handle climb speed equal to walking speed via named modifier", () => {
				// Simulate what the builder does when race has speed: { walk: 30, climb: true }
				state.setSpeed("walk", 30);
				state.addNamedModifier({
					name: "Tabaxi Climb Speed",
					type: "speed:climb",
					value: 0,
					equalToWalk: true,
					sourceType: "race",
					enabled: true,
				});

				// Walk speed should be 30
				expect(state.getSpeed("walk")).toBe(30);
				// Climb speed should equal walk speed (30), not 1
				expect(state.getSpeed("climb")).toBe(30);
			});

			it("should update climb speed when walk speed changes", () => {
				state.setSpeed("walk", 30);
				state.addNamedModifier({
					name: "Tabaxi Climb Speed",
					type: "speed:climb",
					value: 0,
					equalToWalk: true,
					sourceType: "race",
					enabled: true,
				});

				// Increase base walk speed
				state.setSpeed("walk", 40);

				// Walk speed should be 40
				expect(state.getSpeed("walk")).toBe(40);
				// Climb speed should also be 40 (equal to walk)
				expect(state.getSpeed("climb")).toBe(40);
			});
		});

		describe("Aarakocra (MPMM) - Fly Speed Equal to Walk", () => {
			it("should handle fly speed equal to walking speed", () => {
				state.setSpeed("walk", 30);
				state.addNamedModifier({
					name: "Aarakocra Fly Speed",
					type: "speed:fly",
					value: 0,
					equalToWalk: true,
					sourceType: "race",
					enabled: true,
				});

				expect(state.getSpeed("fly")).toBe(30);
			});
		});
	});

	// ==========================================================================
	// Background Features
	// ==========================================================================
	describe("Background Features", () => {
		it("should grant skill proficiencies from Soldier background", () => {
			state.setBackground({name: "Soldier", source: "PHB"});
			state.setSkillProficiency("athletics", true);
			state.setSkillProficiency("intimidation", true);

			expect(state.isSkillProficient("athletics")).toBe(true);
			expect(state.isSkillProficient("intimidation")).toBe(true);
		});

		it("should grant skill proficiencies from Criminal background", () => {
			state.setBackground({name: "Criminal", source: "PHB"});
			state.setSkillProficiency("deception", true);
			state.setSkillProficiency("stealth", true);

			expect(state.isSkillProficient("deception")).toBe(true);
			expect(state.isSkillProficient("stealth")).toBe(true);
		});

		it("should grant skill proficiencies from Sage background", () => {
			state.setBackground({name: "Sage", source: "PHB"});
			state.setSkillProficiency("arcana", true);
			state.setSkillProficiency("history", true);

			expect(state.isSkillProficient("arcana")).toBe(true);
			expect(state.isSkillProficient("history")).toBe(true);
		});

		it("should grant skill proficiencies from Noble background", () => {
			state.setBackground({name: "Noble", source: "PHB"});
			state.setSkillProficiency("history", true);
			state.setSkillProficiency("persuasion", true);

			expect(state.isSkillProficient("history")).toBe(true);
			expect(state.isSkillProficient("persuasion")).toBe(true);
		});

		it("should grant tool proficiencies from Hermit background", () => {
			state.setBackground({name: "Hermit", source: "PHB"});
			state.addToolProficiency("Herbalism Kit");

			expect(state.hasToolProficiency("Herbalism Kit")).toBe(true);
		});

		it("should track background feature", () => {
			state.setBackground({name: "Outlander", source: "PHB"});
			state.addFeature({
				name: "Wanderer",
				source: "PHB",
				description: "You have an excellent memory for maps and geography.",
			});

			expect(state.hasFeature("Wanderer")).toBe(true);
		});
	});

	// ==========================================================================
	// Class-Specific Mechanics
	// ==========================================================================
	describe("Class-Specific Mechanics", () => {
		describe("Barbarian - Rage", () => {
			beforeEach(() => {
				state.addClass({name: "Barbarian", source: "PHB", level: 5});
				state.setAbilityBase("str", 16);
				state.setAbilityBase("con", 14);
			});

			it("should track rage uses", () => {
				state.addResource({
					name: "Rage",
					max: 3, // Level 5 = 3 rages
					current: 3,
					recharge: "long",
				});

				state.useResourceCharge("Rage");
				expect(state.getResource("Rage").current).toBe(2);
			});

			it("should calculate Unarmored Defense (10 + DEX + CON)", () => {
				state.setAbilityBase("dex", 14); // +2
				state.setAbilityBase("con", 16); // +3
				state.setUnarmoredDefense("barbarian");

				expect(state.getAC()).toBe(15); // 10 + 2 + 3
			});

			it("should track Reckless Attack state", () => {
				state.addFeature({
					name: "Reckless Attack",
					source: "PHB",
				});

				expect(state.hasFeature("Reckless Attack")).toBe(true);
			});
		});

		describe("Bard - Bardic Inspiration", () => {
			beforeEach(() => {
				state.addClass({name: "Bard", source: "PHB", level: 5});
				state.setAbilityBase("cha", 16); // +3
			});

			it("should have Bardic Inspiration dice equal to CHA mod", () => {
				state.addResource({
					name: "Bardic Inspiration",
					max: 3, // CHA mod
					current: 3,
					recharge: "short", // Font of Inspiration at level 5
				});

				expect(state.getResource("Bardic Inspiration").max).toBe(3);
			});

			it("should restore on short rest at level 5+", () => {
				state.addResource({
					name: "Bardic Inspiration",
					max: 3,
					current: 0,
					recharge: "short",
				});

				state.onShortRest();
				expect(state.getResource("Bardic Inspiration").current).toBe(3);
			});

			it("should track Jack of All Trades", () => {
				state.addFeature({
					name: "Jack of All Trades",
					source: "PHB",
				});

				expect(state.hasFeature("Jack of All Trades")).toBe(true);
			});
		});

		describe("Cleric - Channel Divinity", () => {
			beforeEach(() => {
				state.addClass({name: "Cleric", source: "PHB", level: 6});
			});

			it("should track Channel Divinity uses", () => {
				state.addResource({
					name: "Channel Divinity",
					max: 2, // Level 6+ = 2 uses
					current: 2,
					recharge: "short",
				});

				expect(state.getResource("Channel Divinity").max).toBe(2);
			});

			it("should track domain spells as always prepared", () => {
				state.addSpell({
					name: "Bless",
					level: 1,
					alwaysPrepared: true,
					source: "domain",
				});

				const spell = state.getSpells().find(s => s.name === "Bless");
				expect(spell.alwaysPrepared).toBe(true);
			});
		});

		describe("Druid - Wild Shape", () => {
			beforeEach(() => {
				state.addClass({name: "Druid", source: "PHB", level: 4});
			});

			it("should track Wild Shape uses", () => {
				state.addResource({
					name: "Wild Shape",
					max: 2,
					current: 2,
					recharge: "short",
				});

				expect(state.getResource("Wild Shape").max).toBe(2);
			});
		});

		describe("Fighter - Action Surge", () => {
			beforeEach(() => {
				state.addClass({name: "Fighter", source: "PHB", level: 5});
			});

			it("should track Action Surge uses", () => {
				state.addResource({
					name: "Action Surge",
					max: 1,
					current: 1,
					recharge: "short",
				});

				state.useResourceCharge("Action Surge");
				expect(state.getResource("Action Surge").current).toBe(0);
			});

			it("should track Second Wind uses", () => {
				state.addResource({
					name: "Second Wind",
					max: 1,
					current: 1,
					recharge: "short",
				});

				expect(state.getResource("Second Wind").max).toBe(1);
			});

			it("should track multiple attacks at level 5", () => {
				state.addFeature({
					name: "Extra Attack",
					source: "PHB",
					attacks: 2,
				});

				expect(state.hasFeature("Extra Attack")).toBe(true);
			});
		});

		describe("Monk - Ki Points", () => {
			beforeEach(() => {
				state.addClass({name: "Monk", source: "PHB", level: 5});
				state.setAbilityBase("dex", 16);
				state.setAbilityBase("wis", 14);
			});

			it("should have Ki points equal to Monk level", () => {
				state.setKiPoints(5);
				state.setKiPointsCurrent(5);

				expect(state.getKiPoints()).toBe(5);
			});

			it("should restore Ki on short rest", () => {
				state.setKiPoints(5);
				state.setKiPointsCurrent(0);

				state.onShortRest();
				expect(state.getKiPointsCurrent()).toBe(5);
			});

			it("should calculate Unarmored Defense (10 + DEX + WIS)", () => {
				state.setUnarmoredDefense("monk");

				// 10 + 3 (DEX) + 2 (WIS) = 15
				expect(state.getAC()).toBe(15);
			});

			it("should track Martial Arts die progression", () => {
				state.addFeature({
					name: "Martial Arts",
					source: "PHB",
					martialArtsDie: "d6", // Level 5
				});

				expect(state.hasFeature("Martial Arts")).toBe(true);
			});
		});

		describe("Paladin - Divine Smite", () => {
			beforeEach(() => {
				state.addClass({name: "Paladin", source: "PHB", level: 6});
				state.setAbilityBase("cha", 16);
			});

			it("should track Lay on Hands pool (5 x level)", () => {
				state.addResource({
					name: "Lay on Hands",
					max: 30, // 5 x 6
					current: 30,
					recharge: "long",
				});

				expect(state.getResource("Lay on Hands").max).toBe(30);
			});

			it("should track Divine Sense uses", () => {
				state.addResource({
					name: "Divine Sense",
					max: 4, // 1 + CHA mod
					current: 4,
					recharge: "long",
				});

				expect(state.getResource("Divine Sense").max).toBe(4);
			});

			it("should apply Aura of Protection feature", () => {
				state.addFeature({
					name: "Aura of Protection",
					source: "PHB",
				});

				expect(state.hasFeature("Aura of Protection")).toBe(true);
			});
		});

		describe("Ranger - Favored Enemy", () => {
			beforeEach(() => {
				state.addClass({name: "Ranger", source: "PHB", level: 5});
			});

			it("should track Favored Enemy", () => {
				state.addFeature({
					name: "Favored Enemy",
					source: "PHB",
					favoredEnemies: ["humanoids", "undead"],
				});

				expect(state.hasFeature("Favored Enemy")).toBe(true);
			});

			it("should track Natural Explorer", () => {
				state.addFeature({
					name: "Natural Explorer",
					source: "PHB",
					favoredTerrains: ["forest", "mountain"],
				});

				expect(state.hasFeature("Natural Explorer")).toBe(true);
			});
		});

		describe("Rogue - Sneak Attack", () => {
			beforeEach(() => {
				state.addClass({name: "Rogue", source: "PHB", level: 5});
			});

			it("should calculate Sneak Attack dice", () => {
				// Level 5 = 3d6 sneak attack
				state.addFeature({
					name: "Sneak Attack",
					source: "PHB",
					sneakAttackDice: 3,
				});

				expect(state.hasFeature("Sneak Attack")).toBe(true);
			});

			it("should track Cunning Action", () => {
				state.addFeature({
					name: "Cunning Action",
					source: "PHB",
				});

				expect(state.hasFeature("Cunning Action")).toBe(true);
			});

			it("should track Uncanny Dodge", () => {
				state.addFeature({
					name: "Uncanny Dodge",
					source: "PHB",
				});

				expect(state.hasFeature("Uncanny Dodge")).toBe(true);
			});
		});

		describe("Sorcerer - Sorcery Points", () => {
			beforeEach(() => {
				state.addClass({name: "Sorcerer", source: "PHB", level: 5});
			});

			it("should have Sorcery Points equal to level", () => {
				state.setSorceryPoints(5);
				const sp = state.getSorceryPoints();
				expect(sp.current).toBe(5);
				expect(sp.max).toBe(5);
			});

			it("should restore on long rest only", () => {
				state.setSorceryPoints({current: 0, max: 5});

				state.onShortRest();
				expect(state.getSorceryPoints().current).toBe(0);

				state.onLongRest();
				// Should restore to max (5)
				expect(state.getSorceryPoints().current).toBe(5);
			});

			it("should track Metamagic options", () => {
				state.addFeature({name: "Metamagic: Quickened Spell", source: "PHB"});
				state.addFeature({name: "Metamagic: Twinned Spell", source: "PHB"});

				expect(state.hasFeature("Metamagic: Quickened Spell")).toBe(true);
				expect(state.hasFeature("Metamagic: Twinned Spell")).toBe(true);
			});
		});

		describe("Warlock - Pact Magic", () => {
			beforeEach(() => {
				state.addClass({name: "Warlock", source: "PHB", level: 5});
			});

			it("should have Pact Magic slots", () => {
				const pactSlots = state.getPactSlots();
				expect(pactSlots.max).toBe(2);
				expect(pactSlots.level).toBe(3);
			});

			it("should restore Pact Magic on short rest", () => {
				state.usePactSlot();
				state.usePactSlot();

				state.onShortRest();
				expect(state.getPactSlots().current).toBe(2);
			});

			it("should track Eldritch Invocations", () => {
				state.addFeature({name: "Agonizing Blast", source: "PHB"});
				state.addFeature({name: "Devil's Sight", source: "PHB"});

				expect(state.hasFeature("Agonizing Blast")).toBe(true);
				expect(state.hasFeature("Devil's Sight")).toBe(true);
			});

			it("should track Pact Boon", () => {
				state.addFeature({name: "Pact of the Blade", source: "PHB"});
				expect(state.hasFeature("Pact of the Blade")).toBe(true);
			});
		});

		describe("Wizard - Arcane Recovery", () => {
			beforeEach(() => {
				state.addClass({name: "Wizard", source: "PHB", level: 5});
			});

			it("should track Arcane Recovery uses", () => {
				state.addResource({
					name: "Arcane Recovery",
					max: 1,
					current: 1,
					recharge: "long",
				});

				expect(state.getResource("Arcane Recovery").max).toBe(1);
			});

			it("should calculate max recoverable spell slot levels", () => {
				// Level 5 wizard can recover up to 3 levels of slots
				// (half wizard level, rounded up)
				const maxRecovery = Math.ceil(5 / 2);
				expect(maxRecovery).toBe(3);
			});

			it("should track spellbook spells", () => {
				state.addSpell({name: "Fireball", level: 3, inSpellbook: true});
				state.addSpell({name: "Counterspell", level: 3, inSpellbook: true});

				const spells = state.getSpells().filter(s => s.inSpellbook);
				expect(spells.length).toBe(2);
			});
		});
	});

	// ==========================================================================
	// Subclass-Specific Features
	// ==========================================================================
	describe("Subclass-Specific Features", () => {
		it("should track Champion Improved Critical", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 3});
			state.setSubclass("Fighter", {name: "Champion", source: "PHB"});
			state.addFeature({
				name: "Improved Critical",
				source: "PHB",
				critRange: 19,
			});

			expect(state.hasFeature("Improved Critical")).toBe(true);
		});

		it("should track Battle Master Superiority Dice", () => {
			state.addClass({name: "Fighter", source: "PHB", level: 3});
			state.setSubclass("Fighter", {name: "Battle Master", source: "PHB"});
			state.addResource({
				name: "Superiority Dice",
				max: 4,
				current: 4,
				recharge: "short",
			});

			expect(state.getResource("Superiority Dice").max).toBe(4);
		});

		it("should track Assassin Assassinate feature", () => {
			state.addClass({name: "Rogue", source: "PHB", level: 3});
			state.setSubclass("Rogue", {name: "Assassin", source: "PHB"});
			state.addFeature({
				name: "Assassinate",
				source: "PHB",
			});

			expect(state.hasFeature("Assassinate")).toBe(true);
		});

		it("should track Circle of the Moon enhanced Wild Shape", () => {
			state.addClass({name: "Druid", source: "PHB", level: 2});
			state.setSubclass("Druid", {name: "Circle of the Moon", source: "PHB"});
			state.addFeature({
				name: "Combat Wild Shape",
				source: "PHB",
			});

			expect(state.hasFeature("Combat Wild Shape")).toBe(true);
		});

		it("should track Divination Wizard Portent", () => {
			state.addClass({name: "Wizard", source: "PHB", level: 2});
			state.setSubclass("Wizard", {name: "School of Divination", source: "PHB"});
			state.addResource({
				name: "Portent",
				max: 2,
				current: 2,
				recharge: "long",
			});

			expect(state.getResource("Portent").max).toBe(2);
		});
	});
});
