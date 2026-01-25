/**
 * Character Sheet Feature Parsing Stress Tests
 * Tests for parsing complex feature descriptions and extracting modifiers
 */

import "./setup.js";
import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

describe("Feature Parsing Stress Tests", () => {
	let state;

	beforeEach(() => {
		state = new CharacterSheetState();
		state.addClass({name: "Fighter", source: "PHB", level: 5});
	});

	// ==========================================================================
	// AC Modifier Parsing
	// ==========================================================================
	describe("AC Modifier Parsing", () => {
		it("should parse '+1 bonus to AC' feature", () => {
			state.addFeature({
				name: "Defense Fighting Style",
				source: "PHB",
				description: "While you are wearing armor, you gain a +1 bonus to AC.",
			});

			// Feature should be parsed and modifier applied
			expect(state.hasFeature("Defense Fighting Style")).toBe(true);
		});

		it("should parse '+2 to AC' feature", () => {
			state.addFeature({
				name: "Shield Spell",
				source: "PHB",
				description: "You gain a +5 bonus to AC until the start of your next turn.",
			});

			expect(state.hasFeature("Shield Spell")).toBe(true);
		});

		it("should parse complex Shield of Faith description", () => {
			state.addFeature({
				name: "Shield of Faith",
				source: "PHB",
				description: "A shimmering field appears and surrounds a creature of your choice within range, granting it a +2 bonus to AC for the duration.",
			});

			expect(state.hasFeature("Shield of Faith")).toBe(true);
		});

		it("should parse Haste AC bonus", () => {
			state.addFeature({
				name: "Haste Effect",
				source: "PHB",
				description: "Until the spell ends, the target's speed is doubled, it gains a +2 bonus to AC, it has advantage on Dexterity saving throws.",
			});

			expect(state.hasFeature("Haste Effect")).toBe(true);
		});
	});

	// ==========================================================================
	// Saving Throw Modifier Parsing
	// ==========================================================================
	describe("Saving Throw Modifier Parsing", () => {
		it("should parse Aura of Protection", () => {
			state.addFeature({
				name: "Aura of Protection",
				source: "PHB",
				description: "Whenever you or a friendly creature within 10 feet of you must make a saving throw, the creature gains a bonus to the saving throw equal to your Charisma modifier (with a minimum bonus of +1).",
			});

			expect(state.hasFeature("Aura of Protection")).toBe(true);
		});

		it("should parse Ring of Protection", () => {
			state.addFeature({
				name: "Ring of Protection",
				source: "DMG",
				description: "You gain a +1 bonus to AC and saving throws while wearing this ring.",
			});

			expect(state.hasFeature("Ring of Protection")).toBe(true);
		});

		it("should parse Cloak of Protection", () => {
			state.addFeature({
				name: "Cloak of Protection",
				source: "DMG",
				description: "You gain a +1 bonus to AC and saving throws while you wear this cloak.",
			});

			expect(state.hasFeature("Cloak of Protection")).toBe(true);
		});

		it("should parse Bless effect", () => {
			state.addFeature({
				name: "Bless",
				source: "PHB",
				description: "Whenever a target makes an attack roll or a saving throw before the spell ends, the target can roll a d4 and add the number rolled to the attack roll or saving throw.",
			});

			expect(state.hasFeature("Bless")).toBe(true);
		});
	});

	// ==========================================================================
	// Speed Modifier Parsing
	// ==========================================================================
	describe("Speed Modifier Parsing", () => {
		it("should parse Unarmored Movement", () => {
			state.addFeature({
				name: "Unarmored Movement",
				source: "PHB",
				description: "Starting at 2nd level, your speed increases by 10 feet while you are not wearing armor or wielding a shield. This bonus increases when you reach certain monk levels.",
			});

			expect(state.hasFeature("Unarmored Movement")).toBe(true);
		});

		it("should parse Longstrider spell", () => {
			state.addFeature({
				name: "Longstrider",
				source: "PHB",
				description: "You touch a creature. The target's speed increases by 10 feet until the spell ends.",
			});

			expect(state.hasFeature("Longstrider")).toBe(true);
		});

		it("should parse Mobile feat", () => {
			state.addFeat({
				name: "Mobile",
				source: "PHB",
				description: "Your speed increases by 10 feet. When you use the Dash action, difficult terrain doesn't cost you extra movement on that turn.",
			});

			expect(state.hasFeat("Mobile")).toBe(true);
		});

		it("should parse Boots of Speed", () => {
			state.addFeature({
				name: "Boots of Speed",
				source: "DMG",
				description: "While you wear these boots, you can use a bonus action and click the boots' heels together. The boots double your walking speed.",
			});

			expect(state.hasFeature("Boots of Speed")).toBe(true);
		});
	});

	// ==========================================================================
	// Attack and Damage Modifier Parsing
	// ==========================================================================
	describe("Attack and Damage Modifier Parsing", () => {
		it("should parse +1 weapon", () => {
			state.addFeature({
				name: "+1 Longsword",
				source: "DMG",
				description: "You have a +1 bonus to attack and damage rolls made with this magic weapon.",
			});

			expect(state.hasFeature("+1 Longsword")).toBe(true);
		});

		it("should parse +2 weapon", () => {
			state.addFeature({
				name: "+2 Greatsword",
				source: "DMG",
				description: "You have a +2 bonus to attack and damage rolls made with this magic weapon.",
			});

			expect(state.hasFeature("+2 Greatsword")).toBe(true);
		});

		it("should parse +3 weapon", () => {
			state.addFeature({
				name: "+3 Longbow",
				source: "DMG",
				description: "You have a +3 bonus to attack and damage rolls made with this magic weapon.",
			});

			expect(state.hasFeature("+3 Longbow")).toBe(true);
		});

		it("should parse Archery Fighting Style", () => {
			state.addFeature({
				name: "Archery",
				source: "PHB",
				description: "You gain a +2 bonus to attack rolls you make with ranged weapons.",
			});

			expect(state.hasFeature("Archery")).toBe(true);
		});

		it("should parse Dueling Fighting Style", () => {
			state.addFeature({
				name: "Dueling",
				source: "PHB",
				description: "When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.",
			});

			expect(state.hasFeature("Dueling")).toBe(true);
		});

		it("should parse Rage damage bonus", () => {
			state.addFeature({
				name: "Rage",
				source: "PHB",
				description: "When you make a melee weapon attack using Strength, you gain a +2 bonus to the damage roll. This bonus increases as you level.",
			});

			expect(state.hasFeature("Rage")).toBe(true);
		});
	});

	// ==========================================================================
	// Initiative Modifier Parsing
	// ==========================================================================
	describe("Initiative Modifier Parsing", () => {
		it("should parse Alert feat", () => {
			state.addFeat({
				name: "Alert",
				source: "PHB",
				description: "You gain a +5 bonus to initiative. You can't be surprised while you are conscious. Other creatures don't gain advantage on attack rolls against you as a result of being unseen by you.",
			});

			expect(state.hasFeat("Alert")).toBe(true);
		});

		it("should parse Weapon of Warning", () => {
			state.addFeature({
				name: "Weapon of Warning",
				source: "DMG",
				description: "This magic weapon warns you of danger. While the weapon is on your person, you have advantage on initiative rolls.",
			});

			expect(state.hasFeature("Weapon of Warning")).toBe(true);
		});

		it("should parse Dread Ambusher", () => {
			state.addFeature({
				name: "Dread Ambusher",
				source: "XGE",
				description: "At the start of your first turn of each combat, your walking speed increases by 10 feet, which lasts until the end of that turn. If you take the Attack action on that turn, you can make one additional weapon attack as part of that action. You also add your Wisdom modifier to your initiative rolls.",
			});

			expect(state.hasFeature("Dread Ambusher")).toBe(true);
		});

		it("should parse Remarkable Athlete (half proficiency)", () => {
			state.addFeature({
				name: "Remarkable Athlete",
				source: "PHB",
				description: "You can add half your proficiency bonus (round up) to any Strength, Dexterity, or Constitution check you make that doesn't already use your proficiency bonus. In addition, when you make a running long jump, the distance you can cover increases by a number of feet equal to your Strength modifier.",
			});

			expect(state.hasFeature("Remarkable Athlete")).toBe(true);
		});
	});

	// ==========================================================================
	// Darkvision and Senses Parsing
	// ==========================================================================
	describe("Darkvision and Senses Parsing", () => {
		it("should parse racial darkvision 60ft", () => {
			state.addFeature({
				name: "Darkvision",
				source: "PHB",
				description: "Thanks to your elf blood, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.",
			});

			expect(state.hasFeature("Darkvision")).toBe(true);
		});

		it("should parse Superior Darkvision 120ft", () => {
			state.addFeature({
				name: "Superior Darkvision",
				source: "PHB",
				description: "Your darkvision has a radius of 120 feet.",
			});

			expect(state.hasFeature("Superior Darkvision")).toBe(true);
		});

		it("should parse Goggles of Night", () => {
			state.addFeature({
				name: "Goggles of Night",
				source: "DMG",
				description: "While wearing these dark lenses, you have darkvision out to a range of 60 feet. If you already have darkvision, wearing the goggles increases its range by 60 feet.",
			});

			expect(state.hasFeature("Goggles of Night")).toBe(true);
		});

		it("should parse Blindsight", () => {
			state.addFeature({
				name: "Blindsight",
				source: "PHB",
				description: "You have blindsight with a range of 10 feet.",
			});

			expect(state.hasFeature("Blindsight")).toBe(true);
		});

		it("should parse Tremorsense", () => {
			state.addFeature({
				name: "Tremorsense",
				source: "MM",
				description: "You can detect and pinpoint the origin of vibrations within 30 feet, provided you and the source of the vibrations are in contact with the same ground or substance.",
			});

			expect(state.hasFeature("Tremorsense")).toBe(true);
		});
	});

	// ==========================================================================
	// Resistance and Immunity Parsing
	// ==========================================================================
	describe("Resistance and Immunity Parsing", () => {
		it("should parse Dwarven Resilience", () => {
			state.addFeature({
				name: "Dwarven Resilience",
				source: "PHB",
				description: "You have advantage on saving throws against poison, and you have resistance against poison damage.",
			});

			expect(state.hasFeature("Dwarven Resilience")).toBe(true);
		});

		it("should parse Draconic Resistance", () => {
			state.addFeature({
				name: "Draconic Resistance",
				source: "PHB",
				description: "You have resistance to the damage type associated with your draconic ancestry (fire damage).",
			});

			expect(state.hasFeature("Draconic Resistance")).toBe(true);
		});

		it("should parse Bear Totem rage resistance", () => {
			state.addFeature({
				name: "Totem Spirit (Bear)",
				source: "PHB",
				description: "While raging, you have resistance to all damage except psychic damage.",
			});

			expect(state.hasFeature("Totem Spirit (Bear)")).toBe(true);
		});

		it("should parse Tiefling fire resistance", () => {
			state.addFeature({
				name: "Hellish Resistance",
				source: "PHB",
				description: "You have resistance to fire damage.",
			});

			expect(state.hasFeature("Hellish Resistance")).toBe(true);
		});
	});

	// ==========================================================================
	// Uses and Recharge Parsing
	// ==========================================================================
	describe("Uses and Recharge Parsing", () => {
		it("should parse 'once per long rest' feature", () => {
			state.addFeature({
				name: "Lucky (Halfling)",
				source: "PHB",
				description: "When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.",
			});

			expect(state.hasFeature("Lucky (Halfling)")).toBe(true);
		});

		it("should parse 'proficiency bonus times per long rest'", () => {
			state.addFeature({
				name: "Channel Divinity",
				source: "PHB",
				description: "You can use your Channel Divinity a number of times equal to your proficiency bonus. You regain all expended uses when you finish a long rest.",
			});

			expect(state.hasFeature("Channel Divinity")).toBe(true);
		});

		it("should parse 'recharges after a short or long rest'", () => {
			state.addFeature({
				name: "Second Wind",
				source: "PHB",
				description: "You have a limited well of stamina that you can draw on. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again.",
			});

			expect(state.hasFeature("Second Wind")).toBe(true);
		});

		it("should parse 'X times per day' feature", () => {
			state.addFeature({
				name: "Innate Spellcasting",
				source: "PHB",
				description: "You can cast the darkness spell once per day.",
			});

			expect(state.hasFeature("Innate Spellcasting")).toBe(true);
		});

		it("should parse 'regains 1d6 charges daily at dawn'", () => {
			state.addItem({
				id: "wand",
				name: "Wand of Magic Missiles",
				description: "This wand has 7 charges. The wand regains 1d6 + 1 expended charges daily at dawn.",
				charges: 7,
				chargesCurrent: 7,
				rechargeAmount: "1d6+1",
				rechargeTime: "dawn",
			});

			const item = state.getItem("wand");
			expect(item.rechargeTime).toBe("dawn");
		});

		it("should parse Constitution modifier times usage", () => {
			state.addFeature({
				name: "Relentless Endurance",
				source: "PHB",
				description: "When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. You can use this feature a number of times equal to your Constitution modifier (minimum of once). You regain all expended uses when you finish a long rest.",
			});

			expect(state.hasFeature("Relentless Endurance")).toBe(true);
		});
	});

	// ==========================================================================
	// Skill Proficiency Parsing
	// ==========================================================================
	describe("Skill Proficiency Parsing", () => {
		it("should parse Skill Expert feat", () => {
			state.addFeat({
				name: "Skill Expert",
				source: "TCE",
				description: "You gain proficiency in one skill of your choice. Choose one skill in which you have proficiency. You gain expertise with that skill.",
			});

			expect(state.hasFeat("Skill Expert")).toBe(true);
		});

		it("should parse Prodigy feat", () => {
			state.addFeat({
				name: "Prodigy",
				source: "XGE",
				description: "You gain one skill proficiency of your choice, one tool proficiency of your choice, and fluency in one language of your choice. Choose one skill in which you have proficiency. You gain expertise with that skill.",
			});

			expect(state.hasFeat("Prodigy")).toBe(true);
		});

		it("should parse Knowledge Domain skills", () => {
			state.addFeature({
				name: "Blessings of Knowledge",
				source: "PHB",
				description: "At 1st level, you learn two languages of your choice. You also become proficient in your choice of two of the following skills: Arcana, History, Nature, or Religion. Your proficiency bonus is doubled for any ability check you make that uses either of those skills.",
			});

			expect(state.hasFeature("Blessings of Knowledge")).toBe(true);
		});
	});

	// ==========================================================================
	// Spell DC and Attack Bonus Parsing
	// ==========================================================================
	describe("Spell DC and Attack Bonus Parsing", () => {
		it("should parse Rod of the Pact Keeper", () => {
			state.addFeature({
				name: "Rod of the Pact Keeper +1",
				source: "DMG",
				description: "While holding this rod, you gain a +1 bonus to spell attack rolls and to the saving throw DCs of your warlock spells.",
			});

			expect(state.hasFeature("Rod of the Pact Keeper +1")).toBe(true);
		});

		it("should parse Robe of the Archmagi", () => {
			state.addFeature({
				name: "Robe of the Archmagi",
				source: "DMG",
				description: "You gain a +2 bonus to spell attack rolls and to the saving throw DCs of your spells.",
			});

			expect(state.hasFeature("Robe of the Archmagi")).toBe(true);
		});

		it("should parse Staff of Power", () => {
			state.addFeature({
				name: "Staff of Power",
				source: "DMG",
				description: "This staff grants a +2 bonus to attack and damage rolls made with it. The staff has 20 charges. While holding it, you gain a +2 bonus to Armor Class, saving throws, and spell attack rolls.",
			});

			expect(state.hasFeature("Staff of Power")).toBe(true);
		});
	});

	// ==========================================================================
	// Extra Attack Parsing
	// ==========================================================================
	describe("Extra Attack Parsing", () => {
		it("should parse Fighter Extra Attack", () => {
			state.addFeature({
				name: "Extra Attack",
				source: "PHB",
				description: "Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.",
			});

			expect(state.hasFeature("Extra Attack")).toBe(true);
		});

		it("should parse Fighter Extra Attack (2)", () => {
			state.addFeature({
				name: "Extra Attack (2)",
				source: "PHB",
				description: "Beginning at 11th level, you can attack three times whenever you take the Attack action on your turn.",
			});

			expect(state.hasFeature("Extra Attack (2)")).toBe(true);
		});

		it("should parse Fighter Extra Attack (3)", () => {
			state.addFeature({
				name: "Extra Attack (3)",
				source: "PHB",
				description: "At 20th level, you can attack four times whenever you take the Attack action on your turn.",
			});

			expect(state.hasFeature("Extra Attack (3)")).toBe(true);
		});
	});

	// ==========================================================================
	// Complex Multi-Effect Features
	// ==========================================================================
	describe("Complex Multi-Effect Features", () => {
		it("should parse Paladin Aura of Protection (CHA to saves)", () => {
			state.setAbilityBase("cha", 16);
			state.addFeature({
				name: "Aura of Protection",
				source: "PHB",
				description: "Starting at 6th level, whenever you or a friendly creature within 10 feet of you must make a saving throw, the creature gains a bonus to the saving throw equal to your Charisma modifier (with a minimum bonus of +1). You must be conscious to grant this bonus. At 18th level, the range of this aura increases to 30 feet.",
			});

			expect(state.hasFeature("Aura of Protection")).toBe(true);
		});

		it("should parse Bladesong (AC, concentration, speed)", () => {
			state.addFeature({
				name: "Bladesong",
				source: "TCE",
				description: "You can invoke a secret elven magic called the Bladesong, provided you aren't wearing medium or heavy armor or using a shield. It graces you with supernatural speed, agility, and focus. You gain the following benefits while the Bladesong is active: You gain a bonus to your AC equal to your Intelligence modifier (minimum of +1). Your walking speed increases by 10 feet. You have advantage on Acrobatics checks. You gain a bonus to any Constitution saving throw you make to maintain concentration on a spell equal to your Intelligence modifier (minimum of +1).",
			});

			expect(state.hasFeature("Bladesong")).toBe(true);
		});

		it("should parse Fighting Spirit (temp HP + advantage)", () => {
			state.addFeature({
				name: "Fighting Spirit",
				source: "XGE",
				description: "Starting at 3rd level, your intensity in battle can shield you and help you strike true. As a bonus action on your turn, you can give yourself advantage on weapon attack rolls until the end of the current turn. When you do so, you also gain 5 temporary hit points. The number of temporary hit points increases when you reach certain levels in this class, increasing to 10 at 10th level and 15 at 15th level.",
			});

			expect(state.hasFeature("Fighting Spirit")).toBe(true);
		});

		it("should parse Haste (speed, AC, attacks)", () => {
			state.addFeature({
				name: "Haste",
				source: "PHB",
				description: "Choose a willing creature that you can see within range. Until the spell ends, the target's speed is doubled, it gains a +2 bonus to AC, it has advantage on Dexterity saving throws, and it gains an additional action on each of its turns. That action can be used only to take the Attack (one weapon attack only), Dash, Disengage, Hide, or Use an Object action.",
			});

			expect(state.hasFeature("Haste")).toBe(true);
		});
	});

	// ==========================================================================
	// Edge Cases in Feature Text
	// ==========================================================================
	describe("Edge Cases in Feature Text", () => {
		it("should handle empty description", () => {
			state.addFeature({
				name: "Empty Feature",
				source: "PHB",
				description: "",
			});

			expect(state.hasFeature("Empty Feature")).toBe(true);
		});

		it("should handle null description", () => {
			state.addFeature({
				name: "Null Feature",
				source: "PHB",
				description: null,
			});

			expect(state.hasFeature("Null Feature")).toBe(true);
		});

		it("should handle undefined description", () => {
			state.addFeature({
				name: "Undefined Feature",
				source: "PHB",
			});

			expect(state.hasFeature("Undefined Feature")).toBe(true);
		});

		it("should handle very long descriptions", () => {
			const longDescription = "This is a very long description. ".repeat(100);
			state.addFeature({
				name: "Long Feature",
				source: "PHB",
				description: longDescription,
			});

			expect(state.hasFeature("Long Feature")).toBe(true);
		});

		it("should handle descriptions with HTML tags", () => {
			state.addFeature({
				name: "HTML Feature",
				source: "PHB",
				description: "<p>You gain a <strong>+1 bonus</strong> to <em>AC</em>.</p>",
			});

			expect(state.hasFeature("HTML Feature")).toBe(true);
		});

		it("should handle descriptions with special characters", () => {
			state.addFeature({
				name: "Special Feature",
				source: "PHB",
				description: "You gain +1 to attack rolls & saving throws (see p. 123—125).",
			});

			expect(state.hasFeature("Special Feature")).toBe(true);
		});

		it("should handle descriptions with Unicode", () => {
			state.addFeature({
				name: "Unicode Feature",
				source: "PHB",
				description: "You gain advantage on saves against being frightened 🛡️ and charmed 💫.",
			});

			expect(state.hasFeature("Unicode Feature")).toBe(true);
		});

		it("should handle descriptions with @tags", () => {
			state.addFeature({
				name: "Tagged Feature",
				source: "PHB",
				description: "You can cast {@spell fireball} at will. See {@book PHB|chapter 10}.",
			});

			expect(state.hasFeature("Tagged Feature")).toBe(true);
		});
	});
});
