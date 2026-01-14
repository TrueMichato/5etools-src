/**
 * Character Sheet State Management
 * Manages all character data and provides computed values
 */

/**
 * Utility to parse feature text and extract limited-use information
 * Works with both official and homebrew content
 */
class FeatureUsesParser {
	/**
	 * Parse feature text to extract uses information
	 * @param {string} text - The feature description text (can include HTML)
	 * @param {function} getAbilityMod - Function to get ability modifier by ability name
	 * @param {function} getProfBonus - Function to get proficiency bonus
	 * @returns {object|null} - {max: number, recharge: "short"|"long"} or null if no uses found
	 */
	static parseUses (text, getAbilityMod, getProfBonus) {
		if (!text) return null;

		// Strip HTML tags for easier parsing
		const plainText = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").toLowerCase();

		let uses = null;
		let recharge = null;

		// Determine recharge type first
		if (/short or long rest|short rest/i.test(plainText)) {
			recharge = "short";
		} else if (/long rest|dawn|dusk|midnight/i.test(plainText)) {
			recharge = "long";
		}

		// If no recharge mentioned, not a limited use feature
		if (!recharge) return null;

		// Pattern: "X times" or "X uses"
		const timesMatch = plainText.match(/(\d+)\s*(?:times?|uses?)/);
		if (timesMatch) {
			uses = parseInt(timesMatch[1]);
		}

		// Pattern: "once" = 1 use
		if (!uses && /\bonce\b/.test(plainText)) {
			uses = 1;
		}

		// Pattern: "twice" = 2 uses
		if (!uses && /\btwice\b/.test(plainText)) {
			uses = 2;
		}

		// Pattern: "a number of times equal to your proficiency bonus"
		if (!uses && /(?:times|uses)?\s*equal\s*to\s*(?:your\s*)?proficiency\s*bonus/i.test(plainText)) {
			uses = getProfBonus ? getProfBonus() : 2;
		}

		// Pattern: "a number of times equal to X your proficiency bonus" (e.g., "twice your proficiency bonus")
		const profMultMatch = plainText.match(/(\w+)\s*(?:times\s*)?your\s*proficiency\s*bonus/);
		if (!uses && profMultMatch) {
			const multiplierWord = profMultMatch[1];
			const multipliers = {twice: 2, three: 3, four: 4, five: 5, half: 0.5};
			const mult = multipliers[multiplierWord];
			if (mult) {
				uses = Math.floor((getProfBonus ? getProfBonus() : 2) * mult);
			}
		}

		// Pattern: "equal to your [ability] modifier"
		const abilityModMatch = plainText.match(/(?:times|uses)?\s*equal\s*to\s*(?:your\s*)?(\w+)\s*modifier/i);
		if (!uses && abilityModMatch && getAbilityMod) {
			const abilityMap = {
				strength: "str", str: "str",
				dexterity: "dex", dex: "dex",
				constitution: "con", con: "con",
				intelligence: "int", int: "int",
				wisdom: "wis", wis: "wis",
				charisma: "cha", cha: "cha",
			};
			const ability = abilityMap[abilityModMatch[1].toLowerCase()];
			if (ability) {
				uses = Math.max(1, getAbilityMod(ability));
			}
		}

		// Pattern: "1 + your [ability] modifier"
		const onePlusAbilityMatch = plainText.match(/1\s*\+\s*(?:your\s*)?(\w+)\s*modifier/i);
		if (!uses && onePlusAbilityMatch && getAbilityMod) {
			const abilityMap = {
				strength: "str", str: "str",
				dexterity: "dex", dex: "dex",
				constitution: "con", con: "con",
				intelligence: "int", int: "int",
				wisdom: "wis", wis: "wis",
				charisma: "cha", cha: "cha",
			};
			const ability = abilityMap[onePlusAbilityMatch[1].toLowerCase()];
			if (ability) {
				uses = 1 + getAbilityMod(ability);
			}
		}

		// If we found uses and recharge, return the result
		if (uses && uses > 0 && recharge) {
			return {max: uses, recharge};
		}

		return null;
	}

	/**
	 * Check if text indicates this feature has limited uses (even if we can't parse exact number)
	 */
	static hasLimitedUses (text) {
		if (!text) return false;
		const plainText = text.replace(/<[^>]*>/g, " ").toLowerCase();
		return /(?:times?|uses?|once|twice).*(?:rest|dawn|dusk)/i.test(plainText) ||
			/(?:regain|recover).*(?:expended|all|uses)/i.test(plainText);
	}
}

// Make available globally
globalThis.FeatureUsesParser = FeatureUsesParser;

/**
 * Utility to parse feature text and extract natural weapon information
 * Works with both official and homebrew content
 */
class NaturalWeaponParser {
	/**
	 * Parse feature text to extract natural weapon information
	 * @param {string} text - The feature description text (can include HTML)
	 * @param {string} featureName - Name of the feature (e.g., "Talons", "Bite", "Claws")
	 * @returns {object|null} - Attack object or null if not a natural weapon
	 */
	static parseNaturalWeapon (text, featureName) {
		if (!text) return null;

		// Strip HTML tags for easier parsing, but preserve structure
		const plainText = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").toLowerCase();

		// Check if this describes a natural weapon or unarmed strike enhancement
		const isNaturalWeapon = /natural\s*weapon|unarmed\s*strike|melee\s*weapon\s*attack/i.test(plainText);
		if (!isNaturalWeapon) return null;

		// Extract damage die (e.g., "1d4", "1d6", "2d6")
		const damageMatch = text.match(/\{@damage\s*(\d+d\d+)\}/i) || text.match(/(\d+d\d+)/i);
		const damage = damageMatch ? damageMatch[1] : "1d4";

		// Extract damage type - common natural weapon types
		const damageTypeMap = {
			slashing: /slashing/i,
			piercing: /piercing/i,
			bludgeoning: /bludgeoning/i,
			necrotic: /necrotic/i,
			poison: /poison/i,
			acid: /acid/i,
		};

		let damageType = "bludgeoning"; // Default
		for (const [type, regex] of Object.entries(damageTypeMap)) {
			if (regex.test(plainText)) {
				damageType = type;
				break;
			}
		}

		// Determine ability modifier to use
		// Default is Strength, but some features specify Constitution, Dex, or spellcasting ability
		let abilityMod = "str";
		if (/constitution\s*modifier/i.test(plainText)) {
			abilityMod = "con";
		} else if (/dexterity\s*modifier/i.test(plainText)) {
			abilityMod = "dex";
		} else if (/spellcasting\s*ability/i.test(plainText)) {
			abilityMod = "spellcasting"; // Will need special handling
		} else if (/finesse/i.test(plainText)) {
			abilityMod = "finesse"; // Can use STR or DEX
		}

		// Determine weapon name from feature name
		const weaponNames = {
			talons: "Talons",
			claws: "Claws",
			bite: "Bite",
			fangs: "Fangs",
			hooves: "Hooves",
			horns: "Horns",
			tusks: "Tusks",
			tail: "Tail",
			sting: "Sting",
			tentacle: "Tentacle",
			slam: "Slam",
			fist: "Fist",
		};

		let weaponName = featureName;
		const featureNameLower = featureName.toLowerCase();
		for (const [key, name] of Object.entries(weaponNames)) {
			if (featureNameLower.includes(key) || plainText.includes(key)) {
				weaponName = name;
				break;
			}
		}

		// Check for special properties
		const properties = [];
		if (/reach/i.test(plainText)) properties.push("Reach");
		if (/light/i.test(plainText)) properties.push("Light");

		return {
			name: weaponName,
			isMelee: true,
			isNaturalWeapon: true,
			abilityMod,
			damage,
			damageType,
			damageBonus: 0,
			attackBonus: 0,
			range: "5 ft",
			properties,
			sourceFeature: featureName, // Track which feature this came from
		};
	}

	/**
	 * Check if feature text describes a natural weapon
	 */
	static isNaturalWeapon (text) {
		if (!text) return false;
		const plainText = text.replace(/<[^>]*>/g, " ").toLowerCase();
		return /natural\s*weapon|unarmed\s*strike.*(?:deal|damage)|melee\s*weapon\s*attack/i.test(plainText) &&
			/\d+d\d+/i.test(plainText);
	}
}

// Make available globally
globalThis.NaturalWeaponParser = NaturalWeaponParser;

/**
 * Utility to parse feature text and extract spell grants
 * Works with both structured additionalSpells data and text parsing for homebrew
 */
class SpellGrantParser {
	/**
	 * Parse additionalSpells structure from official data
	 * @param {Array} additionalSpells - The additionalSpells array from feature/feat data
	 * @param {string} featureName - Name of the feature granting spells
	 * @returns {Array} Array of spell objects with casting info
	 */
	static parseAdditionalSpells (additionalSpells, featureName) {
		if (!additionalSpells?.length) return [];

		const spells = [];

		additionalSpells.forEach(spellBlock => {
			// Handle innate spells (at-will or limited uses)
			if (spellBlock.innate) {
				const innate = spellBlock.innate._ || spellBlock.innate;
				
				// At-will spells (array format)
				if (Array.isArray(innate)) {
					innate.forEach(spellRef => {
						if (typeof spellRef === "string") {
							spells.push(this._parseSpellRef(spellRef, {
								innate: true,
								atWill: true,
								sourceFeature: featureName,
							}));
						}
					});
				}

				// Daily use spells
				if (innate.daily) {
					Object.entries(innate.daily).forEach(([uses, spellRefs]) => {
						// Parse uses like "1e" (1 each), "2" (2 total), etc.
						const usesNum = parseInt(uses);
						const isEach = uses.endsWith("e");
						
						(Array.isArray(spellRefs) ? spellRefs : [spellRefs]).forEach(spellRef => {
							if (typeof spellRef === "string") {
								spells.push(this._parseSpellRef(spellRef, {
									innate: true,
									uses: usesNum,
									usesEach: isEach,
									recharge: "long",
									sourceFeature: featureName,
								}));
							} else if (spellRef?.choose) {
								// Choice required - mark for UI
								spells.push({
									requiresChoice: true,
									choiceFilter: spellRef.choose,
									innate: true,
									uses: usesNum,
									usesEach: isEach,
									recharge: "long",
									sourceFeature: featureName,
								});
							}
						});
					});
				}
			}

			// Handle known/prepared spells
			if (spellBlock.known || spellBlock.prepared) {
				const spellList = spellBlock.known || spellBlock.prepared;
				(Array.isArray(spellList) ? spellList : []).forEach(spellRef => {
					if (typeof spellRef === "string") {
						spells.push(this._parseSpellRef(spellRef, {
							prepared: !!spellBlock.prepared,
							sourceFeature: featureName,
						}));
					}
				});
			}
		});

		return spells.filter(s => s && (s.name || s.requiresChoice));
	}

	/**
	 * Parse a spell reference string like "misty step" or "mage armor|xphb"
	 */
	static _parseSpellRef (spellRef, additionalProps = {}) {
		if (!spellRef || typeof spellRef !== "string") return null;
		
		const [name, source] = spellRef.split("|");
		return {
			name: name.toTitleCase(),
			source: source?.toUpperCase() || Parser.SRC_PHB,
			...additionalProps,
		};
	}

	/**
	 * Parse spell references from feature description text
	 * Fallback for when additionalSpells is not available
	 */
	static parseSpellsFromText (text, featureName) {
		if (!text) return [];

		const spells = [];
		
		// Look for {@spell SpellName} or {@spell SpellName|Source} references
		const spellPattern = /\{@spell\s+([^}|]+)(?:\|([^}]+))?\}/gi;
		let match;

		while ((match = spellPattern.exec(text)) !== null) {
			const spellName = match[1].trim();
			const source = match[2]?.trim()?.toUpperCase() || Parser.SRC_PHB;

			// Try to determine casting type from context
			const contextBefore = text.substring(Math.max(0, match.index - 100), match.index).toLowerCase();
			const contextAfter = text.substring(match.index, Math.min(text.length, match.index + 200)).toLowerCase();
			const context = contextBefore + contextAfter;

			const isAtWill = /at will|at-will|without expending/i.test(context);
			const isOnce = /once|one time/i.test(context) && /rest|dawn|day/i.test(context);
			const recharge = /short rest/i.test(context) ? "short" : (/long rest|dawn|day/i.test(context) ? "long" : null);

			spells.push({
				name: spellName.toTitleCase(),
				source,
				innate: isAtWill || isOnce,
				atWill: isAtWill,
				uses: isOnce ? 1 : (isAtWill ? null : undefined),
				recharge: recharge,
				sourceFeature: featureName,
			});
		}

		// Deduplicate by name
		const uniqueSpells = [];
		const seen = new Set();
		spells.forEach(s => {
			const key = `${s.name}|${s.source}`.toLowerCase();
			if (!seen.has(key)) {
				seen.add(key);
				uniqueSpells.push(s);
			}
		});

		return uniqueSpells;
	}

	/**
	 * Check if text mentions spell granting
	 */
	static grantsSpells (text) {
		if (!text) return false;
		return /\{@spell/i.test(text) && 
			(/can cast|learn|know|at will|without expending|gain access/i.test(text));
	}
}

// Make available globally
globalThis.SpellGrantParser = SpellGrantParser;

/**
 * Utility to parse feature text and extract modifiers to rolls, AC, saves, etc.
 * Works with both official and homebrew content
 */
class FeatureModifierParser {
	/**
	 * Parse feature/item text to extract modifiers
	 * @param {string} text - The feature description text (can include HTML)
	 * @param {string} sourceName - Name of the feature/item granting the modifier
	 * @param {object} options - Additional context (isItem, isAttuned, etc.)
	 * @returns {Array} Array of modifier objects {type, value, note, conditional}
	 */
	static parseModifiers (text, sourceName, options = {}) {
		if (!text) return [];

		const modifiers = [];
		const plainText = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

		// Helper to parse signed number from various formats
		const parseSignedValue = (match, signGroup, numGroup) => {
			const sign = match[signGroup];
			const num = parseInt(match[numGroup]);
			if (sign === "-" || sign === "−") return -num;
			return num;
		};

		// ===================
		// ARMOR CLASS (AC)
		// ===================
		// Patterns: "+X to AC", "-X to AC", "AC increases/decreases by X", "bonus/penalty of X to AC"
		const acPatterns = [
			// +X or -X to AC
			{pattern: /([+\-−])(\d+)\s*(?:bonus\s*)?to\s*(?:your\s*)?(?:armor\s*class|ac)\b/gi, signed: true},
			// bonus/penalty of X to AC
			{pattern: /(?:bonus|penalty)\s*of\s*([+\-−])?(\d+)\s*to\s*(?:your\s*)?(?:armor\s*class|ac)\b/gi, signed: true, defaultPositive: true},
			// AC increases by X
			{pattern: /(?:armor\s*class|ac)\s*(?:increases?|is\s*increased)\s*by\s*(\d+)/gi, positive: true},
			// AC decreases by X / AC is reduced by X
			{pattern: /(?:armor\s*class|ac)\s*(?:decreases?|is\s*(?:decreased|reduced))\s*by\s*(\d+)/gi, negative: true},
			// gain a +X bonus to AC
			{pattern: /gain(?:s)?\s*(?:a\s*)?([+\-−])?(\d+)\s*(?:bonus\s*)?to\s*(?:your\s*)?(?:armor\s*class|ac)\b/gi, signed: true, defaultPositive: true},
		];
		this._applyPatterns(plainText, acPatterns, "ac", sourceName, modifiers, parseSignedValue);

		// ===================
		// SAVING THROWS
		// ===================
		// All saving throws
		const saveAllPatterns = [
			{pattern: /([+\-−])(\d+)\s*(?:bonus\s*)?to\s*(?:all\s*)?saving\s*throws/gi, signed: true},
			{pattern: /saving\s*throws?\s*(?:increase|bonus)\s*(?:by|of)\s*([+\-−])?(\d+)/gi, signed: true, defaultPositive: true},
			{pattern: /saving\s*throws?\s*(?:decrease|penalty|are\s*reduced)\s*by\s*(\d+)/gi, negative: true},
			{pattern: /(?:bonus|penalty)\s*of\s*([+\-−])?(\d+)\s*to\s*(?:all\s*)?saving\s*throws/gi, signed: true, defaultPositive: true},
			{pattern: /gain(?:s)?\s*(?:a\s*)?([+\-−])?(\d+)\s*(?:bonus\s*)?to\s*(?:all\s*)?saving\s*throws/gi, signed: true, defaultPositive: true},
		];
		this._applyPatterns(plainText, saveAllPatterns, "save:all", sourceName, modifiers, parseSignedValue);

		// Specific ability saving throws
		const abilities = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
		const abilityMap = {strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha"};
		abilities.forEach(ability => {
			const abl = abilityMap[ability];
			const saveSpecificPatterns = [
				{pattern: new RegExp(`([+\\-−])(\\d+)\\s*(?:bonus\\s*)?to\\s*(?:your\\s*)?${ability}\\s*saving\\s*throws?`, "gi"), signed: true},
				{pattern: new RegExp(`${ability}\\s*saving\\s*throws?\\s*(?:increase|bonus)\\s*(?:by|of)\\s*([+\\-−])?(\\d+)`, "gi"), signed: true, defaultPositive: true},
				{pattern: new RegExp(`${ability}\\s*saving\\s*throws?\\s*(?:decrease|penalty)\\s*by\\s*(\\d+)`, "gi"), negative: true},
				{pattern: new RegExp(`(?:bonus|penalty)\\s*of\\s*([+\\-−])?(\\d+)\\s*to\\s*(?:your\\s*)?${ability}\\s*saving\\s*throws?`, "gi"), signed: true, defaultPositive: true},
			];
			this._applyPatterns(plainText, saveSpecificPatterns, `save:${abl}`, sourceName, modifiers, parseSignedValue);
		});

		// ===================
		// ATTACK ROLLS (includes "to hit" phrasing common in D&D)
		// ===================
		const attackPatterns = [
			{pattern: /([+\-−])(\d+)\s*(?:bonus\s*)?to\s*(?:weapon\s*)?attack\s*rolls?/gi, signed: true},
			{pattern: /attack\s*rolls?\s*(?:increase|bonus)\s*(?:by|of)\s*([+\-−])?(\d+)/gi, signed: true, defaultPositive: true},
			{pattern: /attack\s*rolls?\s*(?:decrease|penalty|are\s*reduced)\s*by\s*(\d+)/gi, negative: true},
			{pattern: /(?:bonus|penalty)\s*of\s*([+\-−])?(\d+)\s*to\s*(?:weapon\s*)?attack\s*rolls?/gi, signed: true, defaultPositive: true},
			{pattern: /gain(?:s)?\s*(?:a\s*)?([+\-−])?(\d+)\s*(?:bonus\s*)?to\s*(?:weapon\s*)?attack\s*rolls?/gi, signed: true, defaultPositive: true},
			// "to hit" patterns (common D&D phrasing)
			{pattern: /([+\-−])(\d+)\s*(?:bonus\s*)?to\s*hit/gi, signed: true},
			{pattern: /(?:bonus|penalty)\s*of\s*([+\-−])?(\d+)\s*to\s*hit/gi, signed: true, defaultPositive: true},
			{pattern: /gain(?:s)?\s*(?:a\s*)?([+\-−])?(\d+)\s*(?:bonus\s*)?to\s*hit/gi, signed: true, defaultPositive: true},
		];
		this._applyPatterns(plainText, attackPatterns, "attack", sourceName, modifiers, parseSignedValue);

		// Check for "attack and damage rolls" combo
		if (/attack\s*and\s*damage\s*rolls?/i.test(plainText)) {
			const comboPatterns = [
				{pattern: /([+\-−])(\d+)\s*(?:bonus\s*)?to\s*(?:weapon\s*)?attack\s*and\s*damage\s*rolls?/gi, signed: true},
				{pattern: /(?:bonus|penalty)\s*of\s*([+\-−])?(\d+)\s*to\s*(?:weapon\s*)?attack\s*and\s*damage\s*rolls?/gi, signed: true, defaultPositive: true},
			];
			this._applyPatterns(plainText, comboPatterns, "damage", sourceName, modifiers, parseSignedValue);
		}

		// ===================
		// DAMAGE ROLLS
		// ===================
		const damagePatterns = [
			{pattern: /([+\-−])(\d+)\s*(?:bonus\s*)?to\s*(?:weapon\s*)?damage\s*rolls?/gi, signed: true},
			{pattern: /damage\s*rolls?\s*(?:increase|bonus)\s*(?:by|of)\s*([+\-−])?(\d+)/gi, signed: true, defaultPositive: true},
			{pattern: /damage\s*rolls?\s*(?:decrease|penalty|are\s*reduced)\s*by\s*(\d+)/gi, negative: true},
			{pattern: /(?:deal|deals?)\s*(?:an?\s*)?(?:extra|additional)\s*(\d+)\s*(?:extra\s*)?damage/gi, positive: true},
			{pattern: /(?:bonus|penalty)\s*of\s*([+\-−])?(\d+)\s*to\s*(?:weapon\s*)?damage\s*rolls?/gi, signed: true, defaultPositive: true},
		];
		this._applyPatterns(plainText, damagePatterns, "damage", sourceName, modifiers, parseSignedValue);

		// ===================
		// SPELL SAVE DC
		// ===================
		const spellDcPatterns = [
			{pattern: /([+\-−])(\d+)\s*(?:bonus\s*)?to\s*(?:your\s*)?spell\s*save\s*dc/gi, signed: true},
			{pattern: /spell\s*save\s*dc\s*(?:increases?|is\s*increased)\s*by\s*(\d+)/gi, positive: true},
			{pattern: /spell\s*save\s*dc\s*(?:decreases?|is\s*(?:decreased|reduced))\s*by\s*(\d+)/gi, negative: true},
		];
		this._applyPatterns(plainText, spellDcPatterns, "spellDc", sourceName, modifiers, parseSignedValue);

		// ===================
		// SPELL ATTACK ROLLS
		// ===================
		const spellAttackPatterns = [
			{pattern: /([+\-−])(\d+)\s*(?:bonus\s*)?to\s*(?:your\s*)?spell\s*attack\s*rolls?/gi, signed: true},
			{pattern: /spell\s*attack\s*rolls?\s*(?:increase|bonus)\s*(?:by|of)\s*([+\-−])?(\d+)/gi, signed: true, defaultPositive: true},
			{pattern: /spell\s*attack\s*rolls?\s*(?:decrease|penalty)\s*by\s*(\d+)/gi, negative: true},
		];
		this._applyPatterns(plainText, spellAttackPatterns, "spellAttack", sourceName, modifiers, parseSignedValue);

		// ===================
		// INITIATIVE
		// ===================
		const initiativePatterns = [
			{pattern: /([+\-−])(\d+)\s*(?:bonus\s*)?to\s*(?:your\s*)?initiative/gi, signed: true},
			{pattern: /initiative\s*(?:increases?|bonus)\s*(?:by|of)\s*([+\-−])?(\d+)/gi, signed: true, defaultPositive: true},
			{pattern: /initiative\s*(?:decreases?|penalty)\s*by\s*(\d+)/gi, negative: true},
			{pattern: /add\s*(?:your\s*)?(\w+)\s*modifier\s*to\s*(?:your\s*)?initiative/gi, abilityMod: true},
		];
		this._applyPatterns(plainText, initiativePatterns, "initiative", sourceName, modifiers, parseSignedValue);

		// ===================
		// SPEED (Walking, Flying, Swimming, Climbing, Burrowing)
		// ===================
		const speedTypes = [
			{name: "walking", type: "speed:walk", aliases: ["walking speed", "speed", "movement"]},
			{name: "flying", type: "speed:fly", aliases: ["flying speed", "fly speed", "flight speed"]},
			{name: "swimming", type: "speed:swim", aliases: ["swimming speed", "swim speed"]},
			{name: "climbing", type: "speed:climb", aliases: ["climbing speed", "climb speed"]},
			{name: "burrowing", type: "speed:burrow", aliases: ["burrowing speed", "burrow speed"]},
		];

		speedTypes.forEach(speedType => {
			const aliasPattern = speedType.aliases.join("|");
			const speedPatterns = [
				// Your speed increases/decreases by X feet
				{pattern: new RegExp(`(?:your\\s*)?(?:${aliasPattern})\\s*(?:increases?|is\\s*increased)\\s*by\\s*(\\d+)\\s*(?:feet|ft\\.?)`, "gi"), positive: true},
				{pattern: new RegExp(`(?:your\\s*)?(?:${aliasPattern})\\s*(?:decreases?|is\\s*(?:decreased|reduced))\\s*by\\s*(\\d+)\\s*(?:feet|ft\\.?)`, "gi"), negative: true},
				// gain a +X bonus to speed
				{pattern: new RegExp(`([+\\-−])(\\d+)\\s*(?:feet|ft\\.?)?\\s*(?:bonus\\s*)?to\\s*(?:your\\s*)?(?:${aliasPattern})`, "gi"), signed: true},
				// +X feet to speed
				{pattern: new RegExp(`([+\\-−])(\\d+)\\s*(?:feet|ft\\.?)\\s*to\\s*(?:your\\s*)?(?:${aliasPattern})`, "gi"), signed: true},
				// speed is increased/reduced by X
				{pattern: new RegExp(`(?:${aliasPattern})\\s*(?:bonus|penalty)\\s*of\\s*([+\\-−])?(\\d+)\\s*(?:feet|ft\\.?)`, "gi"), signed: true, defaultPositive: true},
				// gain a swimming/climbing speed equal to your walking speed (Amphibious Combatant, Mountaineer, etc.)
				{pattern: new RegExp(`(?:you\\s*)?gain\\s*(?:a\\s*)?(?:${aliasPattern})\\s*equal\\s*to\\s*(?:your\\s*)?(?:walking\\s*speed|speed|movement)`, "gi"), equalToWalk: true},
			];
			this._applyPatterns(plainText, speedPatterns, speedType.type, sourceName, modifiers, parseSignedValue);
		});

		// General speed (applies to all movement)
		const generalSpeedPatterns = [
			{pattern: /(?:your\s*)?(?:base\s*)?speed\s*(?:increases?|is\s*increased)\s*by\s*(\d+)\s*(?:feet|ft\.?)/gi, positive: true},
			{pattern: /(?:your\s*)?(?:base\s*)?speed\s*(?:decreases?|is\s*(?:decreased|reduced))\s*by\s*(\d+)\s*(?:feet|ft\.?)/gi, negative: true},
			{pattern: /([+\-−])(\d+)\s*(?:feet|ft\.?)?\s*(?:bonus\s*)?to\s*(?:your\s*)?(?:base\s*)?speed/gi, signed: true},
			{pattern: /gain(?:s)?\s*(?:a\s*)?([+\-−])?(\d+)\s*(?:feet|ft\.?)\s*(?:bonus\s*)?to\s*(?:your\s*)?speed/gi, signed: true, defaultPositive: true},
		];
		this._applyPatterns(plainText, generalSpeedPatterns, "speed:walk", sourceName, modifiers, parseSignedValue);

		// ===================
		// SENSES (Darkvision, Blindsight, Tremorsense, Truesight)
		// ===================
		const senseTypes = [
			{name: "darkvision", type: "sense:darkvision"},
			{name: "blindsight", type: "sense:blindsight"},
			{name: "tremorsense", type: "sense:tremorsense"},
			{name: "truesight", type: "sense:truesight"},
		];

		senseTypes.forEach(sense => {
			const sensePatterns = [
				// gain darkvision out to X feet
				{pattern: new RegExp(`(?:gain|have|grants?)\\s*${sense.name}\\s*(?:out\\s*to|to\\s*a\\s*(?:range|distance)\\s*of)?\\s*(\\d+)\\s*(?:feet|ft\\.?)`, "gi"), setValue: true},
				// darkvision with a range of X feet (e.g., "You gain darkvision with a range of 60 feet")
				{pattern: new RegExp(`(?:gain|have|grants?)\\s*${sense.name}\\s*with\\s*a\\s*range\\s*of\\s*(\\d+)\\s*(?:feet|ft\\.?)`, "gi"), setValue: true},
				// darkvision increases by X feet
				{pattern: new RegExp(`${sense.name}\\s*(?:increases?|is\\s*increased|extends?)\\s*by\\s*(\\d+)\\s*(?:feet|ft\\.?)`, "gi"), positive: true},
				// darkvision of X feet
				{pattern: new RegExp(`${sense.name}\\s*(?:of|to)\\s*(\\d+)\\s*(?:feet|ft\\.?)`, "gi"), setValue: true},
				// X feet of darkvision
				{pattern: new RegExp(`(\\d+)\\s*(?:feet|ft\\.?)\\s*of\\s*${sense.name}`, "gi"), setValue: true},
				// your darkvision range increases to X feet
				{pattern: new RegExp(`${sense.name}\\s*(?:range\\s*)?(?:increases?\\s*)?to\\s*(\\d+)\\s*(?:feet|ft\\.?)`, "gi"), setValue: true},
			];
			this._applyPatterns(plainText, sensePatterns, sense.type, sourceName, modifiers, parseSignedValue);
		});

		// ===================
		// HIT POINTS
		// ===================
		const hpPatterns = [
			// hit point maximum increases/decreases by X
			{pattern: /hit\s*point\s*maximum\s*(?:increases?|is\s*increased)\s*by\s*(\d+)/gi, positive: true},
			{pattern: /hit\s*point\s*maximum\s*(?:decreases?|is\s*(?:decreased|reduced))\s*by\s*(\d+)/gi, negative: true},
			// gain X additional hit points
			{pattern: /gain(?:s)?\s*(?:an?\s*)?(?:additional|extra)\s*(\d+)\s*hit\s*points?/gi, positive: true},
			// +X hit points per level
			{pattern: /([+\-−])(\d+)\s*hit\s*points?\s*(?:per|for\s*each)\s*(?:level|character\s*level)/gi, signed: true, perLevel: true},
			// hit points increase by X per level
			{pattern: /hit\s*points?\s*(?:increase|maximum\s*increases?)\s*by\s*(\d+)\s*(?:per|for\s*each)\s*(?:level|character\s*level)/gi, positive: true, perLevel: true},
			// lose X hit points
			{pattern: /lose(?:s)?\s*(\d+)\s*hit\s*points?/gi, negative: true},
		];
		this._applyPatterns(plainText, hpPatterns, "hp", sourceName, modifiers, parseSignedValue);

		// ===================
		// ABILITY SCORES
		// ===================
		abilities.forEach(ability => {
			const abl = abilityMap[ability];
			const shortAbl = abl.toUpperCase();
			const abilityPatterns = [
				// Strength score increases by X / Strength increases by X
				{pattern: new RegExp(`(?:your\\s*)?${ability}(?:\\s*score)?\\s*(?:increases?|is\\s*increased)\\s*by\\s*(\\d+)`, "gi"), positive: true},
				{pattern: new RegExp(`(?:your\\s*)?${ability}(?:\\s*score)?\\s*(?:decreases?|is\\s*(?:decreased|reduced))\\s*by\\s*(\\d+)`, "gi"), negative: true},
				// +X to Strength / +X Strength
				{pattern: new RegExp(`([+\\-−])(\\d+)\\s*(?:to\\s*(?:your\\s*)?)?${ability}(?:\\s*score)?(?!\\s*(?:saving|check|modifier))`, "gi"), signed: true},
				// gain +X to your Strength score
				{pattern: new RegExp(`gain(?:s)?\\s*(?:a\\s*)?([+\\-−])?(\\d+)\\s*(?:bonus\\s*)?(?:to\\s*(?:your\\s*)?)?${ability}(?:\\s*score)?`, "gi"), signed: true, defaultPositive: true},
				// STR +X or STR increases by X
				{pattern: new RegExp(`${shortAbl}\\s*([+\\-−])(\\d+)(?!\\s*(?:save|check))`, "gi"), signed: true},
			];
			this._applyPatterns(plainText, abilityPatterns, `ability:${abl}`, sourceName, modifiers, parseSignedValue);
		});

		// ===================
		// SKILL CHECKS
		// ===================
		const skillNames = [
			"acrobatics", "animal handling", "arcana", "athletics", "deception",
			"history", "insight", "intimidation", "investigation", "medicine",
			"nature", "perception", "performance", "persuasion", "religion",
			"sleight of hand", "stealth", "survival",
		];
		skillNames.forEach(skill => {
			const skillKey = skill.replace(/\s+/g, "");
			const skillPatterns = [
				{pattern: new RegExp(`([+\\-−])(\\d+)\\s*(?:bonus\\s*)?to\\s*(?:your\\s*)?${skill}\\s*(?:checks?|rolls?)?`, "gi"), signed: true},
				{pattern: new RegExp(`${skill}\\s*(?:checks?|rolls?)?\\s*(?:increase|bonus)\\s*(?:by|of)\\s*([+\\-−])?(\\d+)`, "gi"), signed: true, defaultPositive: true},
				{pattern: new RegExp(`${skill}\\s*(?:checks?|rolls?)?\\s*(?:decrease|penalty)\\s*by\\s*(\\d+)`, "gi"), negative: true},
				{pattern: new RegExp(`(?:bonus|penalty)\\s*of\\s*([+\\-−])?(\\d+)\\s*to\\s*(?:your\\s*)?${skill}\\s*(?:checks?|rolls?)?`, "gi"), signed: true, defaultPositive: true},
			];
			this._applyPatterns(plainText, skillPatterns, `skill:${skillKey}`, sourceName, modifiers, parseSignedValue);
		});

		// ===================
		// ABILITY CHECKS (All or specific)
		// ===================
		const abilityCheckAllPatterns = [
			{pattern: /([+\-−])(\d+)\s*(?:bonus\s*)?to\s*(?:all\s*)?ability\s*checks/gi, signed: true},
			{pattern: /ability\s*checks?\s*(?:increase|bonus)\s*(?:by|of)\s*([+\-−])?(\d+)/gi, signed: true, defaultPositive: true},
			{pattern: /ability\s*checks?\s*(?:decrease|penalty|are\s*reduced)\s*by\s*(\d+)/gi, negative: true},
		];
		this._applyPatterns(plainText, abilityCheckAllPatterns, "check:all", sourceName, modifiers, parseSignedValue);

		// Specific ability checks (Strength checks, Dexterity checks, etc.)
		abilities.forEach(ability => {
			const abl = abilityMap[ability];
			const abilityCheckPatterns = [
				{pattern: new RegExp(`([+\\-−])(\\d+)\\s*(?:bonus\\s*)?to\\s*(?:your\\s*)?${ability}\\s*(?:ability\\s*)?checks?(?!.*saving)`, "gi"), signed: true},
				{pattern: new RegExp(`${ability}\\s*(?:ability\\s*)?checks?\\s*(?:increase|bonus)\\s*(?:by|of)\\s*([+\\-−])?(\\d+)`, "gi"), signed: true, defaultPositive: true},
				{pattern: new RegExp(`${ability}\\s*(?:ability\\s*)?checks?\\s*(?:decrease|penalty)\\s*by\\s*(\\d+)`, "gi"), negative: true},
			];
			this._applyPatterns(plainText, abilityCheckPatterns, `check:${abl}`, sourceName, modifiers, parseSignedValue);
		});

		// ===================
		// PROFICIENCY BONUS
		// ===================
		const profBonusPatterns = [
			{pattern: /proficiency\s*bonus\s*(?:increases?|is\s*increased)\s*by\s*(\d+)/gi, positive: true},
			{pattern: /proficiency\s*bonus\s*(?:decreases?|is\s*(?:decreased|reduced))\s*by\s*(\d+)/gi, negative: true},
			{pattern: /([+\-−])(\d+)\s*(?:to\s*(?:your\s*)?)?proficiency\s*bonus/gi, signed: true},
			{pattern: /add\s*(\d+)\s*to\s*(?:your\s*)?proficiency\s*bonus/gi, positive: true},
		];
		this._applyPatterns(plainText, profBonusPatterns, "proficiencyBonus", sourceName, modifiers, parseSignedValue);

		// ===================
		// SPELL SLOTS
		// ===================
		const spellSlotPatterns = [
			{pattern: /gain(?:s)?\s*(?:an?\s*)?(?:additional|extra)\s*(\d+)(?:st|nd|rd|th)?\s*level\s*spell\s*slots?/gi, positive: true, spellSlot: true},
			{pattern: /(\d+)\s*(?:additional|extra)\s*(\d+)(?:st|nd|rd|th)?\s*level\s*spell\s*slots?/gi, spellSlotCount: true},
		];
		this._applyPatterns(plainText, spellSlotPatterns, "spellSlots", sourceName, modifiers, parseSignedValue);

		// ===================
		// CARRY CAPACITY
		// ===================
		const carryPatterns = [
			{pattern: /carrying\s*capacity\s*(?:increases?|is\s*(?:increased|doubled))\s*(?:by\s*)?(\d+)?/gi, positive: true, maybeDouble: true},
			{pattern: /carrying\s*capacity\s*(?:decreases?|is\s*(?:decreased|reduced|halved))\s*(?:by\s*)?(\d+)?/gi, negative: true, maybeHalve: true},
			{pattern: /count(?:s)?\s*as\s*(?:one\s*)?size\s*(?:category\s*)?larger\s*(?:for|when)\s*(?:determining\s*)?(?:your\s*)?carrying\s*capacity/gi, sizeIncrease: true},
		];
		this._applyPatterns(plainText, carryPatterns, "carryCapacity", sourceName, modifiers, parseSignedValue);

		// ===================
		// SKILL PROFICIENCIES
		// ===================
		skillNames.forEach(skill => {
			const skillKey = skill.replace(/\s+/g, "");
			const profPatterns = [
				// "you gain proficiency in Athletics" / "you are proficient in Athletics"
				{pattern: new RegExp(`(?:you\\s+)?(?:gain|have|are)\\s+proficien(?:cy|t)\\s+(?:in|with)\\s+(?:the\\s+)?${skill}(?:\\s+skill)?`, "gi"), proficiency: true},
				// "proficiency in Athletics" / "proficiency with the Athletics skill"
				{pattern: new RegExp(`proficien(?:cy|t)\\s+(?:in|with)\\s+(?:the\\s+)?${skill}(?:\\s+skill)?`, "gi"), proficiency: true},
				// "you gain expertise in Athletics"
				{pattern: new RegExp(`(?:you\\s+)?(?:gain|have)\\s+expertise\\s+(?:in|with)\\s+(?:the\\s+)?${skill}(?:\\s+skill)?`, "gi"), expertise: true},
			];
			profPatterns.forEach(({pattern, proficiency, expertise}) => {
				if (pattern.test(plainText)) {
					modifiers.push({
						type: `proficiency:skill:${skillKey}`,
						value: expertise ? 2 : 1,
						note: sourceName,
						isProficiency: true,
					});
				}
			});
		});

		// ===================
		// SAVING THROW PROFICIENCIES
		// ===================
		abilities.forEach(ability => {
			const abl = abilityMap[ability];
			const saveProfPatterns = [
				// "you gain proficiency in Wisdom saving throws"
				{pattern: new RegExp(`(?:you\\s+)?(?:gain|have|are)\\s+proficien(?:cy|t)\\s+(?:in|with)\\s+${ability}\\s+saving\\s+throws?`, "gi")},
				// "proficiency in Strength saves"
				{pattern: new RegExp(`proficien(?:cy|t)\\s+(?:in|with)\\s+${ability}\\s+(?:saving\\s+throws?|saves?)`, "gi")},
				// "proficiency in Strength and Wisdom saving throws" (multi-ability)
				{pattern: new RegExp(`proficien(?:cy|t)\\s+(?:in|with)\\s+(?:\\w+\\s+and\\s+)?${ability}(?:\\s+and\\s+\\w+)?\\s+saving\\s+throws?`, "gi")},
			];
			saveProfPatterns.forEach(({pattern}) => {
				if (pattern.test(plainText)) {
					modifiers.push({
						type: `proficiency:save:${abl}`,
						value: 1,
						note: sourceName,
						isProficiency: true,
					});
				}
			});
		});

		// ===================
		// ARMOR PROFICIENCIES
		// ===================
		const armorTypes = ["light armor", "medium armor", "heavy armor", "shields"];
		armorTypes.forEach(armor => {
			const armorKey = armor.replace(/\s+/g, "");
			const armorProfPatterns = [
				{pattern: new RegExp(`(?:you\\s+)?(?:gain|have|are)\\s+proficien(?:cy|t)\\s+(?:in|with)\\s+${armor}`, "gi")},
				{pattern: new RegExp(`proficien(?:cy|t)\\s+(?:in|with)\\s+${armor}`, "gi")},
			];
			armorProfPatterns.forEach(({pattern}) => {
				if (pattern.test(plainText)) {
					modifiers.push({
						type: `proficiency:armor:${armorKey}`,
						value: 1,
						note: sourceName,
						isProficiency: true,
					});
				}
			});
		});

		// ===================
		// WEAPON PROFICIENCIES
		// ===================
		const weaponCategories = ["simple weapons", "martial weapons"];
		weaponCategories.forEach(category => {
			const categoryKey = category.replace(/\s+/g, "");
			const weaponProfPatterns = [
				{pattern: new RegExp(`(?:you\\s+)?(?:gain|have|are)\\s+proficien(?:cy|t)\\s+(?:in|with)\\s+${category}`, "gi")},
				{pattern: new RegExp(`proficien(?:cy|t)\\s+(?:in|with)\\s+${category}`, "gi")},
			];
			weaponProfPatterns.forEach(({pattern}) => {
				if (pattern.test(plainText)) {
					modifiers.push({
						type: `proficiency:weapon:${categoryKey}`,
						value: 1,
						note: sourceName,
						isProficiency: true,
					});
				}
			});
		});

		// Specific weapon proficiencies (common ones)
		const specificWeapons = [
			"longsword", "shortsword", "longbow", "shortbow", "rapier", "scimitar",
			"hand crossbow", "light crossbow", "heavy crossbow", "battleaxe", "warhammer",
			"glaive", "halberd", "pike", "greatsword", "maul", "trident", "whip",
		];
		specificWeapons.forEach(weapon => {
			const weaponPattern = new RegExp(`(?:you\\s+)?(?:gain|have|are)\\s+proficien(?:cy|t)\\s+(?:in|with)\\s+(?:the\\s+)?${weapon}s?`, "gi");
			if (weaponPattern.test(plainText)) {
				modifiers.push({
					type: `proficiency:weapon:${weapon}`,
					value: 1,
					note: sourceName,
					isProficiency: true,
				});
			}
		});

		// ===================
		// COMBINED WEAPON AND ARMOR PROFICIENCIES
		// ===================
		// "proficiency with martial weapons and heavy armor"
		// "proficiency with martial weapons and medium armor"
		const combinedProfPatterns = [
			{pattern: /proficien(?:cy|t)\s+(?:in|with)\s+martial\s+weapons?\s+and\s+heavy\s+armou?r/gi, weapon: "martialweapons", armor: "heavy"},
			{pattern: /proficien(?:cy|t)\s+(?:in|with)\s+martial\s+weapons?\s+and\s+medium\s+armou?r/gi, weapon: "martialweapons", armor: "medium"},
			{pattern: /proficien(?:cy|t)\s+(?:in|with)\s+martial\s+weapons?\s+and\s+light\s+armou?r/gi, weapon: "martialweapons", armor: "light"},
			{pattern: /proficien(?:cy|t)\s+(?:in|with)\s+simple\s+weapons?\s+and\s+heavy\s+armou?r/gi, weapon: "simpleweapons", armor: "heavy"},
			{pattern: /proficien(?:cy|t)\s+(?:in|with)\s+simple\s+weapons?\s+and\s+medium\s+armou?r/gi, weapon: "simpleweapons", armor: "medium"},
			{pattern: /proficien(?:cy|t)\s+(?:in|with)\s+simple\s+weapons?\s+and\s+light\s+armou?r/gi, weapon: "simpleweapons", armor: "light"},
		];
		combinedProfPatterns.forEach(({pattern, weapon, armor}) => {
			if (pattern.test(plainText)) {
				modifiers.push({
					type: `proficiency:weapon:${weapon}`,
					value: 1,
					note: sourceName,
					isProficiency: true,
				});
				modifiers.push({
					type: `proficiency:armor:${armor}`,
					value: 1,
					note: sourceName,
					isProficiency: true,
				});
			}
		});

		// ===================
		// TOOL PROFICIENCIES
		// ===================
		const commonTools = [
			"thieves' tools", "thieves tools", "artisan's tools", "musical instrument",
			"navigator's tools", "poisoner's kit", "herbalism kit", "alchemist's supplies",
			"brewer's supplies", "calligrapher's supplies", "carpenter's tools", "cartographer's tools",
			"cobbler's tools", "cook's utensils", "glassblower's tools", "jeweler's tools",
			"leatherworker's tools", "mason's tools", "painter's supplies", "potter's tools",
			"smith's tools", "tinker's tools", "weaver's tools", "woodcarver's tools",
			"disguise kit", "forgery kit", "gaming set", "vehicles",
			"healer's kit", "healer's kits", "healers kit", // Combat Medic specialty
		];
		commonTools.forEach(tool => {
			// Simplified pattern: just needs "proficiency with/in [tool]"
			const toolPattern = new RegExp(`proficien(?:cy|t)\\s+(?:in|with)\\s+(?:one\\s+)?${tool.replace(/'/g, ".")}s?`, "gi");
			if (toolPattern.test(plainText)) {
				modifiers.push({
					type: `proficiency:tool:${tool.replace(/['\s]+/g, "")}`,
					value: 1,
					note: sourceName,
					isProficiency: true,
				});
			}
		});

		// ===================
		// IMPROVISED WEAPONS PROFICIENCY
		// ===================
		if (/proficien(?:cy|t)\s+(?:in|with)\s+improvised\s+weapons?/gi.test(plainText)) {
			modifiers.push({
				type: "proficiency:weapon:improvisedweapons",
				value: 1,
				note: sourceName,
				isProficiency: true,
			});
		}

		// ===================
		// ADVANTAGE ON SAVING THROWS (Conditional)
		// ===================
		// "advantage on saving throws to avoid being knocked prone"
		// "advantage on saving throws made to resist the effects of X"
		const advantageSavePatterns = [
			{pattern: /advantage\s+on\s+saving\s+throws?\s+(?:and\s+ability\s+checks?\s+)?to\s+avoid\s+being\s+knocked\s+prone/gi, condition: "to avoid being knocked prone"},
			{pattern: /advantage\s+on\s+saving\s+throws?\s+(?:made\s+)?to\s+resist\s+(?:the\s+effects?\s+of\s+)?extreme\s+heat\s+or\s+cold/gi, condition: "against extreme heat or cold"},
			{pattern: /advantage\s+on\s+saving\s+throws?\s+(?:made\s+)?to\s+resist\s+(?:the\s+effects?\s+of\s+)?cold\s+weather/gi, condition: "against cold weather"},
			{pattern: /advantage\s+on\s+saving\s+throws?\s+(?:made\s+)?to\s+resist\s+(?:the\s+effects?\s+of\s+)?hot\s+weather/gi, condition: "against hot weather"},
			{pattern: /advantage\s+on\s+(?:checks?\s+and\s+)?saving\s+throws?\s+to\s+avoid\s+drowning/gi, condition: "to avoid drowning"},
			{pattern: /advantage\s+on\s+saving\s+throws?\s+against\s+being\s+(?:charmed|frightened|poisoned)/gi, condition: (m) => `against being ${m[0].match(/charmed|frightened|poisoned/i)[0].toLowerCase()}`},
			{pattern: /advantage\s+on\s+saving\s+throws?\s+against\s+(?:poison|disease|magic|spells?)/gi, condition: (m) => `against ${m[0].match(/poison|disease|magic|spells?/i)[0].toLowerCase()}`},
		];
		advantageSavePatterns.forEach(({pattern, condition}) => {
			if (pattern.test(plainText)) {
				const condText = typeof condition === "function" ? condition(plainText.match(pattern)) : condition;
				modifiers.push({
					type: "save:all",
					value: 0,
					note: sourceName,
					advantage: true,
					conditional: condText,
				});
			}
		});

		// ===================
		// ADVANTAGE ON ABILITY CHECKS (Conditional)
		// ===================
		// "advantage on ability checks to avoid being knocked prone"
		// "advantage on checks made to secure a structure"
		const advantageCheckPatterns = [
			{pattern: /advantage\s+on\s+(?:saving\s+throws?\s+and\s+)?ability\s+checks?\s+to\s+avoid\s+being\s+knocked\s+prone/gi, condition: "to avoid being knocked prone"},
			{pattern: /advantage\s+on\s+checks?\s+(?:made\s+)?to\s+secure\s+a\s+structure/gi, condition: "to secure a structure"},
			{pattern: /advantage\s+on\s+(?:ability\s+)?checks?\s+(?:made\s+)?to\s+find\s+or\s+harvest/gi, condition: "to find or harvest plants"},
			// "advantage on Wisdom (Survival) checks for the Hunt and Gather activity" - handles both plain parens and {@skill}
			{pattern: /advantage\s+on\s+wisdom\s*\((?:{@skill\s*)?survival\}?\)\s*checks?/gi, condition: "on Survival checks", skill: "survival"},
			// "advantage on Charisma (Deception) and Charisma (Intimidation) checks to imitate"
			{pattern: /advantage\s+on\s+charisma\s*\((?:{@skill\s*)?deception\}?\)[^.]*checks?\s+to\s+imitate/gi, condition: "to imitate creatures", skill: "deception"},
			{pattern: /advantage\s+on\s+charisma\s*\((?:{@skill\s*)?intimidation\}?\)[^.]*checks?\s+to\s+imitate/gi, condition: "to imitate creatures", skill: "intimidation"},
		];
		advantageCheckPatterns.forEach(({pattern, condition, skill}) => {
			if (pattern.test(plainText)) {
				modifiers.push({
					type: skill ? `skill:${skill}` : "check:all",
					value: 0,
					note: sourceName,
					advantage: true,
					conditional: condition,
				});
			}
		});

		// ===================
		// BONUS TO SPECIFIC SKILL CHECKS
		// ===================
		// "bonus to Dexterity (Acrobatics) checks equal to your proficiency bonus"
		// Also handles: "gain a bonus to X checks. The bonus equals your proficiency bonus"
		skillNames.forEach(skill => {
			const skillKey = skill.replace(/\s+/g, "");
			// Pattern 1: "bonus to X checks equal to your proficiency bonus" - handles both plain parens and {@skill}
			const bonusPattern1 = new RegExp(`(?:gain\\s+)?(?:a\\s+)?bonus\\s+to\\s+(?:\\w+\\s*\\((?:{@skill\\s*)?)?${skill}(?:\\}?\\))?\\s*checks?\\s+equal\\s+to\\s+(?:your\\s+)?proficiency\\s+bonus`, "gi");
			// Pattern 2: "gain a bonus to X checks...The bonus equals your proficiency bonus"
			const bonusPattern2 = new RegExp(`(?:gain\\s+)?(?:a\\s+)?bonus\\s+to[^.]*(?:\\w+\\s*\\((?:{@skill\\s*)?)?${skill}(?:\\}?\\))?[^.]*checks?[^.]*\\.\\s*(?:The\\s+)?bonus\\s+equals\\s+(?:your\\s+)?proficiency\\s+bonus`, "gi");
			if (bonusPattern1.test(plainText) || bonusPattern2.test(plainText)) {
				modifiers.push({
					type: `skill:${skillKey}`,
					value: 0,
					note: sourceName,
					proficiencyBonus: true, // Special flag: adds proficiency bonus
				});
			}
		});

		// ===================
		// DIFFICULT TERRAIN IMMUNITY
		// ===================
		// "difficult terrain costs you no extra movement"
		// "ignore nonmagical difficult terrain"
		// "Moving through difficult terrain ... costs you no extra movement"
		if (/(?:difficult\s+terrain\s+(?:costs?\s+you\s+no\s+extra\s+movement|doesn.?t\s+cost\s+(?:you\s+)?extra\s+movement))|(?:ignore\s+(?:nonmagical\s+)?difficult\s+terrain)|(?:moving\s+through\s+(?:nonmagical\s+)?difficult\s+terrain[^.]*costs?\s+(?:you\s+)?no\s+extra\s+movement)/gi.test(plainText)) {
			modifiers.push({
				type: "movement:difficultTerrain",
				value: 0,
				note: sourceName,
				ignore: true,
				conditional: this._extractCondition(plainText, 0),
			});
		}

		// ===================
		// DISADVANTAGE REMOVAL
		// ===================
		// "don't have disadvantage on Perception checks made in lightly obscured areas"
		if (/(?:don.?t\s+have|do\s+not\s+have)\s+disadvantage\s+on\s+(?:\w+\s*\((?:{@skill\s*)?)?perception/gi.test(plainText)) {
			const condition = plainText.match(/(?:don.?t\s+have|do\s+not\s+have)\s+disadvantage[^.]+/i)?.[0] || "on Perception checks";
			modifiers.push({
				type: "skill:perception",
				value: 0,
				note: sourceName,
				removeDisadvantage: true,
				conditional: condition.replace(/(?:don.?t\s+have|do\s+not\s+have)\s+disadvantage\s+on\s+/i, "").trim(),
			});
		}

		// ===================
		// CARRYING CAPACITY DOUBLED
		// ===================
		// "Your carrying capacity is doubled"
		if (/carrying\s+capacity\s+is\s+doubled/gi.test(plainText)) {
			modifiers.push({
				type: "carryCapacity",
				value: 2,
				note: sourceName,
				multiplier: true,
			});
		}

		// ===================
		// JUMP DISTANCE DOUBLED
		// ===================
		// "your jump distance is doubled"
		if (/jump\s+distance\s+(?:is\s+)?doubled/gi.test(plainText)) {
			modifiers.push({
				type: "movement:jumpDistance",
				value: 2,
				note: sourceName,
				multiplier: true,
				conditional: this._extractCondition(plainText, 0),
			});
		}

		// ===================
		// TRAVEL PACE BONUSES
		// ===================
		// "travel 1 mile per hour faster" / "travel pace is increased by X feet per hour"
		const travelMatch = plainText.match(/travel\s+(\d+)\s*(?:mile|feet|ft)s?\s+(?:per\s+hour\s+)?faster/gi);
		if (travelMatch) {
			const milesMatch = plainText.match(/travel\s+(\d+)\s*miles?\s+(?:per\s+hour\s+)?faster/i);
			if (milesMatch) {
				modifiers.push({
					type: "travel:paceBonus",
					value: parseInt(milesMatch[1]),
					note: sourceName,
					unit: "miles",
				});
			}
		}
		// "travel pace is increased by X feet per hour"
		const paceMatch = plainText.match(/travel\s+pace\s+is\s+increased\s+by\s+(\d+)\s*(?:feet|ft)/i);
		if (paceMatch) {
			modifiers.push({
				type: "travel:paceBonus",
				value: parseInt(paceMatch[1]),
				note: sourceName,
				unit: "feet",
			});
		}

		// ===================
		// NO TRAVEL PENALTIES
		// ===================
		// "don't take the -5 penalty to your passive Perception score" when traveling at fast pace
		if (/travel\s+at\s+a\s+fast\s+pace.*don.?t\s+take\s+the\s+-?\d+\s+penalty/gi.test(plainText) ||
			/don.?t\s+take\s+the\s+-?\d+\s+penalty.*fast\s+pace/gi.test(plainText)) {
			modifiers.push({
				type: "travel:fastPace",
				value: 0,
				note: sourceName,
				removesPenalty: true,
			});
		}

		// ===================
		// USE DIFFERENT ABILITY MODIFIER
		// ===================
		// "use your Dexterity modifier instead of your Strength modifier for Athletics checks"
		// "use your Strength modifier instead of your Dexterity modifier for Acrobatics checks"
		const abilitySwapPatterns = [
			// For skill checks
			{pattern: /use\s+(?:your\s+)?(\w+)\s+modifier\s+instead\s+of\s+(?:your\s+)?(\w+)\s+(?:modifier\s+)?for\s+(?:the\s+)?(?:\w+\s*\((?:{@skill\s*)?)?(\w+)/gi},
			// For ability checks
			{pattern: /use\s+(?:your\s+)?(\w+)\s+modifier\s+instead\s+of\s+(?:your\s+)?(\w+)\s+(?:modifier\s+)?for\s+(\w+)\s+(?:ability\s+)?checks/gi},
		];
		abilitySwapPatterns.forEach(({pattern}) => {
			let match;
			while ((match = pattern.exec(plainText)) !== null) {
				const newAbility = match[1].toLowerCase().substring(0, 3);
				const oldAbility = match[2].toLowerCase().substring(0, 3);
				const skillOrCheck = match[3].toLowerCase().replace(/}?\)?$/, "");
				modifiers.push({
					type: `abilitySwap:${skillOrCheck}`,
					value: 0,
					note: sourceName,
					newAbility,
					oldAbility,
				});
			}
		});

		// ===================
		// ADD ABILITY MODIFIER TO CHECKS/SAVES/DAMAGE
		// ===================
		// "Add your Wisdom modifier to any saving throw against being charmed"
		// "add your Wisdom modifier to Perception checks"
		// "You add your Wisdom modifier to the damage you deal with any cleric cantrip"
		const addModPatterns = [
			// Add modifier to saving throw
			{pattern: /add\s+(?:your\s+)?(\w+)\s+modifier\s+to\s+(?:any\s+)?(?:saving\s+throws?)(?:\s+against\s+([^.]+))?/gi, type: "save"},
			// Add modifier to skill/ability checks
			{pattern: /add\s+(?:your\s+)?(\w+)\s+modifier\s+to\s+(?:\w+\s*\((?:{@skill\s*)?)?(\w+)(?:\}?\))?\s*checks?/gi, type: "check"},
			// Add modifier to damage with cantrips
			{pattern: /add\s+(?:your\s+)?(\w+)\s+modifier\s+to\s+the\s+damage\s+(?:you\s+deal\s+)?(?:with\s+)?(?:any\s+)?(?:\w+\s+)?cantrips?/gi, type: "cantripDamage"},
		];
		addModPatterns.forEach(({pattern, type}) => {
			let match;
			while ((match = pattern.exec(plainText)) !== null) {
				const ability = match[1].toLowerCase().substring(0, 3);
				const target = match[2] ? match[2].toLowerCase().replace(/}?\)?$/, "") : null;
				modifiers.push({
					type: type === "save" ? "save:all" : type === "cantripDamage" ? "damage:cantrip" : `skill:${target}`,
					value: 0,
					note: sourceName,
					addAbilityMod: ability,
					conditional: type === "save" && target ? `against ${target}` : undefined,
				});
			}
		});

		// ===================
		// SEE NORMALLY IN DARKNESS (SUPERIOR DARKVISION)
		// ===================
		// "You can see normally in darkness, both magical and nonmagical, to a distance of 120 feet"
		const devilSightMatch = plainText.match(/see\s+normally\s+in\s+darkness,?\s+(?:both\s+)?magical\s+and\s+nonmagical,?\s+to\s+a\s+distance\s+of\s+(\d+)\s*(?:feet|ft)/i);
		if (devilSightMatch) {
			modifiers.push({
				type: "sense:devilSight",
				value: parseInt(devilSightMatch[1]),
				note: sourceName,
				seesInMagicalDarkness: true,
			});
		}

		// ===================
		// ADD DICE TO SKILL CHECKS
		// ===================
		// "add a d10 to your Dexterity (Acrobatics) checks"
		// "add a {@dice d10} to your Dexterity ({@skill Acrobatics}) checks"
		const diceSkillPattern = /add\s+(?:a\s+)?(?:(?:roll\s+of\s+)?(?:your\s+)?)?(?:{@dice\s*)?d(\d+)\}?\s+to\s+(?:your\s+)?(?:\w+\s*\((?:{@skill\s*)?)?(\w+)(?:\}?\))?\s*checks?/gi;
		let diceMatch;
		while ((diceMatch = diceSkillPattern.exec(plainText)) !== null) {
			const dieSize = parseInt(diceMatch[1]);
			const skill = diceMatch[2].toLowerCase().replace(/}?\)?$/, "");
			modifiers.push({
				type: `skill:${skill}`,
				value: 0,
				note: sourceName,
				bonusDie: `d${dieSize}`,
			});
		}

		// ===================
		// ADD DICE TO TOOL CHECKS
		// ===================
		// "add a d10 to checks made with thieves' tools"
		const diceToolPattern = /add\s+(?:a\s+)?(?:{@dice\s*)?d(\d+)\}?\s+to\s+checks?\s+(?:made\s+)?with\s+(?:the\s+)?([^.]+?)(?:\s+tools?)?(?:\.|,|$)/gi;
		let diceToolMatch;
		while ((diceToolMatch = diceToolPattern.exec(plainText)) !== null) {
			const dieSize = parseInt(diceToolMatch[1]);
			const tool = diceToolMatch[2].toLowerCase().trim().replace(/'/g, "").replace(/\s+/g, "");
			modifiers.push({
				type: `tool:${tool}`,
				value: 0,
				note: sourceName,
				bonusDie: `d${dieSize}`,
			});
		}

		// ===================
		// JUMP DISTANCE INCREASES
		// ===================
		// "jump distance increases by 15 feet vertically"
		// "Your jump distance increases by X feet"
		const jumpPatterns = [
			{pattern: /(?:your\s+)?(?:vertical\s+)?jump\s+distance\s+(?:increases?|is\s+increased)\s+by\s+(\d+)\s*(?:feet|ft)/gi, type: "vertical"},
			{pattern: /(?:your\s+)?(?:horizontal\s+)?(?:long\s+)?jump\s+distance\s+(?:increases?|is\s+increased)\s+by\s+(\d+)\s*(?:feet|ft)/gi, type: "horizontal"},
			{pattern: /jump\s+distance\s+increases?\s+by\s+(\d+)\s*(?:feet|ft)\s+vertically/gi, type: "vertical"},
			{pattern: /jump\s+distance\s+increases?\s+by\s+(\d+)\s*(?:feet|ft)\s+horizontally/gi, type: "horizontal"},
			// "Your jump distance increases by 15 feet vertically, and 30 feet horizontally" - handled by both patterns
		];
		jumpPatterns.forEach(({pattern, type}) => {
			let match;
			while ((match = pattern.exec(plainText)) !== null) {
				modifiers.push({
					type: type === "vertical" ? "movement:jumpVertical" : "movement:jumpHorizontal",
					value: parseInt(match[1]),
					note: sourceName,
				});
			}
		});

		// ===================
		// EXHAUSTION IMMUNITY/REDUCTION
		// ===================
		// "You ignore the first level of exhaustion you would gain each day"
		if (/ignore\s+(?:the\s+)?(?:first\s+)?(?:level\s+of\s+)?exhaustion/gi.test(plainText)) {
			modifiers.push({
				type: "exhaustion:immunity",
				value: 1, // ignores 1 level
				note: sourceName,
			});
		}

		// ===================
		// EXPERTISE DIE
		// ===================
		// "gain an expertise die on Deception checks"
		const expertiseDiePattern = /(?:gain|have)\s+(?:an?\s+)?expertise\s+die\s+on\s+(?:\w+\s*\((?:{@skill\s*)?)?(\w+)(?:\}?\))?\s*(?:checks?)?/gi;
		let expertiseDieMatch;
		while ((expertiseDieMatch = expertiseDiePattern.exec(plainText)) !== null) {
			const skill = expertiseDieMatch[1].toLowerCase().replace(/}?\)?$/, "");
			modifiers.push({
				type: `skill:${skill}`,
				value: 0,
				note: sourceName,
				expertiseDie: true,
			});
		}

		// ===================
		// FLAT TRACKING BONUS
		// ===================
		// "gain a +10 bonus to subsequent checks to track that creature"
		const trackingBonusMatch = plainText.match(/(?:gain|have)\s+(?:a\s+)?([+\-−])?(\d+)\s+bonus\s+to\s+(?:subsequent\s+)?checks?\s+to\s+track/i);
		if (trackingBonusMatch) {
			const sign = trackingBonusMatch[1];
			const value = parseInt(trackingBonusMatch[2]);
			modifiers.push({
				type: "skill:survival",
				value: (sign === "-" || sign === "−") ? -value : value,
				note: sourceName,
				conditional: "when tracking a creature you've found",
			});
		}

		// ===================
		// EXTRA CANTRIPS KNOWN
		// ===================
		// "You know one extra cantrip from the Cleric spell list"
		if (/(?:you\s+)?(?:learn|know)\s+(?:one|an?|\d+)\s+(?:extra|additional)\s+cantrips?\s+from/gi.test(plainText)) {
			const countMatch = plainText.match(/(?:learn|know)\s+(one|an?|\d+)\s+(?:extra|additional)\s+cantrips?/i);
			let count = 1;
			if (countMatch) {
				if (/^\d+$/.test(countMatch[1])) count = parseInt(countMatch[1]);
				else if (countMatch[1].toLowerCase() === "two") count = 2;
			}
			modifiers.push({
				type: "spellsKnown:cantrips",
				value: count,
				note: sourceName,
			});
		}

		// ===================
		// ADVANTAGE ON INITIATIVE
		// ===================
		// "You have advantage on initiative rolls"
		if (/advantage\s+on\s+initiative\s*(?:rolls?)?/gi.test(plainText)) {
			modifiers.push({
				type: "initiative",
				value: 0,
				note: sourceName,
				advantage: true,
			});
		}

		// ===================
		// ADD MARTIAL ARTS DIE TO CHECKS
		// ===================
		// "add a roll of your Martial Arts die to the check"
		const martialArtsCheckPattern = /add\s+(?:a\s+)?(?:roll\s+of\s+)?(?:your\s+)?(?:martial\s+arts?\s+die|martial\s+die)\s+to\s+(?:the\s+)?(?:(\w+)\s*\((?:{@skill\s*)?)?(\w+)?(?:\}?\))?\s*checks?/gi;
		let martialMatch;
		while ((martialMatch = martialArtsCheckPattern.exec(plainText)) !== null) {
			const skill = (martialMatch[2] || martialMatch[1] || "").toLowerCase().replace(/}?\)?$/, "");
			if (skill) {
				modifiers.push({
					type: `skill:${skill}`,
					value: 0,
					note: sourceName,
					bonusDie: "martial",
				});
			}
		}

		// ===================
		// GAIN X RESOURCE POINTS
		// ===================
		// "You gain an additional 2 exertion points"
		const resourcePatterns = [
			{pattern: /(?:you\s+)?gain\s+(?:an?\s+)?(?:additional|extra)\s+(\d+)\s+(exertion|focus|ki|sorcery)\s+points?/gi, resource: true},
			{pattern: /(?:additional|extra)\s+(\d+)\s+(exertion|focus|ki|sorcery)\s+points?/gi, resource: true},
		];
		resourcePatterns.forEach(({pattern}) => {
			let match;
			while ((match = pattern.exec(plainText)) !== null) {
				const count = parseInt(match[1]);
				const resourceType = match[2].toLowerCase();
				modifiers.push({
					type: `resource:${resourceType}`,
					value: count,
					note: sourceName,
				});
			}
		});

		// ===================
		// GAIN FOCUS/RESOURCE ON INITIATIVE
		// ===================
		// "When you roll initiative, you gain 1 Focus Point"
		const initResourceMatch = plainText.match(/when\s+you\s+roll\s+initiative,?\s+(?:you\s+)?gain\s+(\d+)\s+(focus|ki|exertion|sorcery)\s+points?/i);
		if (initResourceMatch) {
			modifiers.push({
				type: `initiative:${initResourceMatch[2].toLowerCase()}`,
				value: parseInt(initResourceMatch[1]),
				note: sourceName,
				onInitiative: true,
			});
		}

		// ===================
		// FORCED MARCH HOURS INCREASE
		// ===================
		// "Increase hours you can travel before forced-march saves by your proficiency bonus"
		if (/(?:increase|adds?)\s+(?:the\s+)?(?:number\s+of\s+)?hours?\s+(?:you\s+can\s+)?travel.*(?:forced.?march|before\s+(?:forced|march))/gi.test(plainText)) {
			modifiers.push({
				type: "travel:forcedMarchHours",
				value: 0,
				note: sourceName,
				proficiencyBonus: true,
			});
		}

		// ===================
		// CLIMB/WALL WALK SPEEDS (without ability check)
		// ===================
		// "You can move up, down, and across vertical surfaces at half your speed without an ability check"
		// "move across vertical surfaces" without falling
		if (/(?:move|climb)\s+(?:up,?\s+down,?\s+and\s+)?(?:across\s+)?vertical\s+surfaces?\s+(?:at\s+(?:half\s+)?your\s+speed\s+)?without\s+(?:an?\s+)?(?:ability\s+)?check/gi.test(plainText)) {
			modifiers.push({
				type: "speed:climbNoCheck",
				value: 0,
				note: sourceName,
				noCheckRequired: true,
			});
		}

		// ===================
		// ADVANTAGE ON SPECIFIC SKILL CHECKS (Deception/Intimidation to imitate)
		// ===================
		// "You have advantage on Charisma (Deception) and Charisma (Intimidation) checks to imitate"
		const specificAdvantagePatterns = [
			{pattern: /advantage\s+on\s+charisma\s*\((?:{@skill\s*)?deception\}?\)\s*(?:and\s+charisma\s*\((?:{@skill\s*)?intimidation\}?\)\s*)?checks?\s+to\s+imitate/gi, skills: ["deception", "intimidation"], condition: "to imitate creatures"},
			{pattern: /advantage\s+on\s+(?:\w+\s*\((?:{@skill\s*)?)?deception\}?\)\s*checks?\s+to\s+(?:lie|deceive|bluff)/gi, skills: ["deception"], condition: "when lying"},
		];
		specificAdvantagePatterns.forEach(({pattern, skills, condition}) => {
			if (pattern.test(plainText)) {
				skills.forEach(skill => {
					modifiers.push({
						type: `skill:${skill}`,
						value: 0,
						note: sourceName,
						advantage: true,
						conditional: condition,
					});
				});
			}
		});

		// ===================
		// DIFFICULT TERRAIN IN SPECIFIC ENVIRONMENTS
		// ===================
		// "Moving through difficult terrain in swamps, bogs, or mud costs you no extra movement"
		if (/moving\s+through\s+(?:nonmagical\s+)?difficult\s+terrain\s+in\s+\w+[^.]+costs?\s+(?:you\s+)?no\s+extra\s+movement/gi.test(plainText)) {
			modifiers.push({
				type: "movement:difficultTerrain",
				value: 0,
				note: sourceName,
				ignore: true,
				conditional: "in specific terrain types",
			});
		}

		// ===================
		// NATURAL ARMOR / CUSTOM AC FORMULAS
		// ===================
		// "your AC equals 13 + your Dexterity modifier" (Lizardfolk, Tortle, etc.)
		const acFormulaPatterns = [
			// AC equals X + DEX modifier
			{pattern: /(?:your\s+)?(?:armor\s*class|ac)\s+(?:equals?|is)\s+(\d+)\s*\+\s*(?:your\s+)?(?:dexterity|dex)(?:\s+modifier)?(?:\s+\(([^)]+)\))?/gi, type: "naturalArmor", addDex: true},
			// AC equals X (no DEX, like Tortle)
			{pattern: /(?:your\s+)?(?:armor\s*class|ac)\s+(?:equals?|is)\s+(\d+)(?:\s+when\s+(?:you\s+)?(?:aren't|are\s+not)\s+wearing\s+armor)?/gi, type: "naturalArmor", noDex: true},
			// Natural armor AC of X
			{pattern: /natural\s+armor\s+(?:that\s+)?(?:gives\s+you\s+)?(?:an?\s+)?(?:ac|armor\s*class)\s*(?:of|equal(?:s?\s+to)?)\s*(\d+)/gi, type: "naturalArmor", noDex: true},
			// base AC of X
			{pattern: /base\s+(?:ac|armor\s*class)\s+(?:of|equal(?:s?\s+to)?|is)\s+(\d+)/gi, type: "naturalArmor"},
			// Unarmored Defense: AC = 10 + DEX + CON/WIS
			{pattern: /(?:your\s+)?(?:armor\s*class|ac)\s+(?:equals?|is)\s+10\s*\+\s*(?:your\s+)?(?:dexterity|dex)(?:\s+modifier)?\s*\+\s*(?:your\s+)?(constitution|con|wisdom|wis|charisma|cha)(?:\s+modifier)?/gi, type: "unarmoredDefense"},
		];
		acFormulaPatterns.forEach(({pattern, type, addDex, noDex}) => {
			let match;
			while ((match = pattern.exec(plainText)) !== null) {
				const baseAc = parseInt(match[1]) || 10;
				let secondAbility = null;
				if (type === "unarmoredDefense" && match[2]) {
					const ablMatch = match[2].toLowerCase();
					if (ablMatch.startsWith("con")) secondAbility = "con";
					else if (ablMatch.startsWith("wis")) secondAbility = "wis";
					else if (ablMatch.startsWith("cha")) secondAbility = "cha";
				}
				modifiers.push({
					type: "acFormula",
					value: baseAc,
					note: sourceName,
					acFormula: {
						base: baseAc,
						addDex: addDex || (type === "unarmoredDefense"),
						noDex: noDex,
						secondAbility,
						formulaType: type,
					},
					conditional: this._extractCondition(plainText, match.index),
				});
			}
		});

		// Deduplicate modifiers of same type from same source
		const unique = [];
		const seen = new Set();
		modifiers.forEach(m => {
			const key = `${m.type}|${m.value}|${m.conditional || ""}`;
			if (!seen.has(key)) {
				seen.add(key);
				unique.push(m);
			}
		});

		return unique;
	}

	/**
	 * Helper to apply multiple patterns and extract modifiers
	 */
	static _applyPatterns (text, patterns, type, sourceName, modifiers, parseSignedValue) {
		patterns.forEach(({pattern, signed, positive, negative, defaultPositive, setValue, perLevel, sizeIncrease, maybeDouble, maybeHalve, abilityMod, equalToWalk}) => {
			let match;
			while ((match = pattern.exec(text)) !== null) {
				let value;

				if (abilityMod) {
					// Special case: "add your X modifier to initiative"
					// We can't resolve this statically, mark it for special handling
					const abilityName = match[1]?.toLowerCase();
					modifiers.push({
						type,
						value: 0,
						note: sourceName,
						abilityMod: abilityName,
						conditional: this._extractCondition(text, match.index),
					});
					continue;
				}

				if (equalToWalk) {
					// Speed equal to walking speed (e.g., "swimming speed equal to your walking speed")
					modifiers.push({
						type,
						value: 0,
						note: sourceName,
						equalToWalk: true,
						conditional: this._extractCondition(text, match.index),
					});
					continue;
				}

				if (sizeIncrease) {
					// Counts as larger for carrying capacity
					modifiers.push({
						type,
						value: 0,
						note: sourceName,
						sizeIncrease: true,
						conditional: this._extractCondition(text, match.index),
					});
					continue;
				}

				if (maybeDouble && !match[1]) {
					modifiers.push({type, value: 0, note: sourceName, multiplier: 2, conditional: this._extractCondition(text, match.index)});
					continue;
				}

				if (maybeHalve && !match[1]) {
					modifiers.push({type, value: 0, note: sourceName, multiplier: 0.5, conditional: this._extractCondition(text, match.index)});
					continue;
				}

				if (setValue) {
					// For senses, this sets the value directly (e.g., "gain darkvision 60 feet")
					value = parseInt(match[1]);
					modifiers.push({
						type,
						value,
						note: sourceName,
						setValue: true,
						conditional: this._extractCondition(text, match.index),
					});
					continue;
				}

				if (signed) {
					// Pattern has sign group and number group
					if (match[2]) {
						value = parseSignedValue(match, 1, 2);
					} else if (match[1] && defaultPositive) {
						// Optional sign, default positive
						value = parseInt(match[1]);
						if (match[0].includes("-") || match[0].includes("−")) value = -value;
					} else if (match[1]) {
						value = parseInt(match[1]);
					}
				} else if (positive) {
					value = parseInt(match[1]);
				} else if (negative) {
					value = -parseInt(match[1]);
				}

				if (value !== undefined && !isNaN(value)) {
					const mod = {
						type,
						value,
						note: sourceName,
						conditional: this._extractCondition(text, match.index),
					};
					if (perLevel) mod.perLevel = true;
					modifiers.push(mod);
				}
			}
		});
	}

	/**
	 * Extract conditional context around a match (e.g., "while raging", "when wearing heavy armor")
	 */
	static _extractCondition (text, matchIndex) {
		// Look at surrounding context
		const start = Math.max(0, matchIndex - 100);
		const end = Math.min(text.length, matchIndex + 100);
		const context = text.substring(start, end).toLowerCase();

		// Common conditional phrases
		const conditions = [
			/while\s+(?:you\s+are\s+)?(raging|concentrating|wearing|wielding|attuned|in\s+(?:dim\s+light|darkness)|bloodied|prone|grappled|restrained)/i,
			/when\s+(?:you\s+are\s+)?(wearing|wielding|in\s+(?:dim\s+light|darkness)|hit\s+by)/i,
			/if\s+you\s+(are|have|wear|wield|aren't|don't)/i,
			/against\s+(aberrations|beasts|celestials|constructs|dragons|elementals|fey|fiends|giants|monstrosities|oozes|plants|undead|(?:creatures?\s+)?(?:that\s+)?(?:can't\s+see\s+you|you\s+can\s+see))/i,
			/within\s+\d+\s*(?:feet|ft\.?)\s*of/i,
			/in\s+(?:bright\s+light|dim\s+light|darkness)/i,
			// "while not wearing armor" or "while you are not wearing armor"
			/(?:only\s+)?(?:while|when)\s+(?:you\s+are\s+)?(?:not\s+)?(?:wearing|in)\s+(?:light|medium|heavy)\s+armor/i,
			/(?:only\s+)?(?:while|when)\s+(?:you\s+are\s+)?(?:not\s+)?wearing\s+(?:a\s+)?(?:shield|armor)/i,
			/(?:only\s+)?(?:while|when)\s+(?:you\s+are\s+)?(?:not\s+)?(?:incapacitated|unconscious|prone|restrained|grappled|charmed|frightened|poisoned|blinded|deafened|stunned|paralyzed|petrified)/i,
			/(?:at\s+the\s+)?(?:start|end)\s+of\s+(?:your|each|the)\s+turn/i,
			/(?:once|twice)\s+per\s+(?:turn|round|short\s+rest|long\s+rest)/i,
			/(?:for|during)\s+(?:the\s+)?(?:first|next)\s+(?:\d+\s+)?(?:round|minute|hour)/i,
			/until\s+(?:the\s+)?(?:start|end)\s+of\s+your\s+next\s+turn/i,
		];

		for (const pattern of conditions) {
			const match = context.match(pattern);
			if (match) {
				return match[0].trim();
			}
		}

		return null;
	}

	/**
	 * Check if text likely contains modifiers worth parsing
	 */
	static hasModifiers (text) {
		if (!text) return false;
		const plainText = text.replace(/<[^>]*>/g, " ").toLowerCase();
		return /[+\-−]\s*\d+\s*(bonus\s*)?(to|on|feet|ft)/i.test(plainText) ||
			/(?:ac|armor\s*class|saving\s*throws?|attack\s*rolls?|damage|speed|initiative|hit\s*points?|darkvision)\s*(?:increase|decrease|bonus|penalty|is\s*(?:increased|reduced))/i.test(plainText) ||
			/(?:strength|dexterity|constitution|intelligence|wisdom|charisma)(?:\s*score)?\s*(?:increase|decrease)/i.test(plainText) ||
			/gain(?:s)?\s*(?:darkvision|blindsight|tremorsense|truesight)/i.test(plainText) ||
			/proficien(?:cy|t)\s*(?:in|with)/i.test(plainText) ||
			/(?:ac|armor\s*class)\s+(?:equals?|is)\s+\d+/i.test(plainText) ||
			/natural\s+armor/i.test(plainText);
	}
}

// Make available globally
globalThis.FeatureModifierParser = FeatureModifierParser;

class CharacterSheetState {
	constructor () {
		this._data = this._getDefaultState();
	}

	_getDefaultState () {
		return {
			id: null,
			name: "",
			race: null,
			subrace: null,
			classes: [], // [{name, source, level, subclass}]
			background: null,

			// Ability scores (base values before racial bonuses)
			abilities: {
				str: 10,
				dex: 10,
				con: 10,
				int: 10,
				wis: 10,
				cha: 10,
			},

			// Ability score bonuses from race, feats, etc.
			abilityBonuses: {
				str: 0,
				dex: 0,
				con: 0,
				int: 0,
				wis: 0,
				cha: 0,
			},

			// HP
			hp: {
				current: 0,
				max: 0,
				temp: 0,
			},

			// Hit dice - keyed by die type
			hitDice: {}, // e.g., {d8: {current: 5, max: 5}, d10: {current: 2, max: 2}}

			// Death saves
			deathSaves: {
				successes: 0,
				failures: 0,
			},

			// Inspiration
			inspiration: false,

			// Proficiencies
			saveProficiencies: [], // ["str", "con"]
			skillProficiencies: {}, // {athletics: 1, stealth: 2} (1 = prof, 2 = expertise)
			customSkills: [], // [{name, ability}] - user-added custom skills
			armorProficiencies: [],
			weaponProficiencies: [],
			toolProficiencies: [],
			languages: [],

			// AC calculation
			ac: {
				base: 10,
				armor: null,
				shield: false,
				bonuses: [],
				itemBonus: 0, // Bonus from non-armor/shield magic items
			},

			// AC formulas from features (natural armor, unarmored defense, etc.)
			acFormulas: [],

			// Item bonuses from equipped/attuned magic items
			itemBonuses: {
				ac: 0,
				savingThrow: 0,
				spellAttack: 0,
				spellSaveDc: 0,
				abilityCheck: 0,
			},

			// Speed
			speed: {
				walk: 30,
				fly: null,
				swim: null,
				climb: null,
				burrow: null,
			},

			// Senses (base values, before feature bonuses)
			senses: {
				darkvision: 0,
				blindsight: 0,
				tremorsense: 0,
				truesight: 0,
			},

			// Spellcasting
			spellcasting: {
				ability: null, // "int", "wis", "cha"
				spellSlots: {}, // {1: {current: 4, max: 4}, 2: {current: 3, max: 3}}
				pactSlots: {current: 0, max: 0, level: 0},
				spellsKnown: [], // [{name, source, prepared: bool}]
				cantripsKnown: [],
				innateSpells: [], // [{name, source, uses: {current, max}, atWill: bool, sourceFeature}]
			},

			// Inventory
			inventory: [], // [{item, quantity, equipped, attuned}]
			currency: {cp: 0, sp: 0, ep: 0, gp: 0, pp: 0},

			// Features and traits
			features: [], // [{name, source, description, uses: {current, max, recharge}}]
			feats: [], // [{name, source}]

			// Weapon Masteries (2024 rules)
			weaponMasteries: [], // ["Longsword|XPHB", "Shortsword|XPHB"] - weapon keys (name|source)

			// Combat Traditions (Thelemar homebrew) - tradition codes like ["AM", "RC"]
			combatTraditions: [],

			// Exertion pool (Thelemar homebrew) - resource for combat methods
			exertionCurrent: 0, // Current exertion points
			exertionMax: 0, // Max exertion = 2 × proficiency bonus

			// Attacks (weapons + custom)
			attacks: [], // [{name, attackBonus, damage, damageType, range, properties}]

			// Conditions
			conditions: [],

			// Exhaustion level (0-6, with 6 being death in 2014 rules, or -1d6 penalty in 2024)
			exhaustion: 0,

			// Resources (class features, racial abilities, etc.)
			resources: [], // [{id, name, current, max, recharge: "short"|"long"|"dawn"}]

			// Notes
			notes: {
				personality: "",
				ideals: "",
				bonds: "",
				flaws: "",
				backstory: "",
				notes: "",
			},

			// Appearance
			appearance: {
				age: "",
				height: "",
				weight: "",
				eyes: "",
				skin: "",
				hair: "",
			},

			// Defenses
			resistances: [],
			immunities: [],
			vulnerabilities: [],
			conditionImmunities: [],

			// Custom modifiers (simple totals for quick access)
			customModifiers: {
				ac: 0,
				initiative: 0,
				speed: {walk: 0, fly: 0, swim: 0, climb: 0, burrow: 0}, // Movement type bonuses
				savingThrows: {}, // {str: 2, dex: 1, ...}
				skills: {}, // {athletics: 2, stealth: -1, ...}
				attackBonus: 0,
				damageBonus: 0,
				spellDc: 0,
				spellAttack: 0,
				abilityChecks: {}, // {str: 1, dex: 2, ...} - raw ability checks
				abilityScores: {}, // {str: 2, dex: 1, ...} - ability score bonuses
				hp: 0, // Hit point maximum bonus
				hpPerLevel: 0, // HP bonus per character level
				proficiencyBonus: 0, // Proficiency bonus modifier
				senses: {darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0}, // Sense ranges (set values)
				carryCapacity: 0, // Carry capacity bonus
				carryCapacityMultiplier: 1, // Carry capacity multiplier (e.g., 2 for doubled)
			},

			// Named modifiers list (for detailed tracking with sources/notes)
			// Each modifier: {id, name, type, value, note, enabled, sourceFeatureId?}
			// type: "ac", "initiative", "speed:walk", "speed:fly", "attack", "damage", "spellDc", "spellAttack", 
			//       "save:all", "save:str", "skill:all", "skill:stealth", "check:all", "check:str",
			//       "ability:str", "hp", "sense:darkvision", "carryCapacity", "proficiencyBonus"
			namedModifiers: [],

			// Active states (e.g., Rage, Concentration, Wild Shape, etc.)
			// Each state: {id, name, active, sourceFeatureId, resourceId?, effects: [{type, value, ...}], duration?, icon?}
			activeStates: [],

			// Concentration tracking
			concentrating: null, // {spellName, spellLevel, startTime?} or null

			// Sheet settings/options
			settings: {
				exhaustionRules: "2024", // "2024" or "2014"
				allowedSources: null, // null = all sources, array = only these sources
			},
		};
	}

	// #region Core State Management
	reset () {
		this._data = this._getDefaultState();
	}

	toJson () {
		return MiscUtil.copyFast(this._data);
	}

	// Alias for compatibility with export module
	toJSON () { return this.toJson(); }

	loadFromJson (json) {
		this._data = {
			...this._getDefaultState(),
			...MiscUtil.copyFast(json),
		};

		// Ensure nested objects exist
		this._data.abilities = {...this._getDefaultState().abilities, ...this._data.abilities};
		this._data.abilityBonuses = {...this._getDefaultState().abilityBonuses, ...this._data.abilityBonuses};
		this._data.hp = {...this._getDefaultState().hp, ...this._data.hp};
		this._data.deathSaves = {...this._getDefaultState().deathSaves, ...this._data.deathSaves};
		this._data.speed = {...this._getDefaultState().speed, ...this._data.speed};
		this._data.senses = {...this._getDefaultState().senses, ...this._data.senses};
		this._data.spellcasting = {...this._getDefaultState().spellcasting, ...this._data.spellcasting};
		this._data.currency = {...this._getDefaultState().currency, ...this._data.currency};
		this._data.notes = {...this._getDefaultState().notes, ...this._data.notes};
		this._data.appearance = {...this._getDefaultState().appearance, ...this._data.appearance};
		this._data.ac = {...this._getDefaultState().ac, ...this._data.ac};
		this._data.customModifiers = {...this._getDefaultState().customModifiers, ...this._data.customModifiers};
		// Ensure nested customModifiers objects exist
		this._data.customModifiers.speed = {...this._getDefaultState().customModifiers.speed, ...this._data.customModifiers.speed};
		this._data.customModifiers.senses = {...this._getDefaultState().customModifiers.senses, ...this._data.customModifiers.senses};
		
		// Ensure namedModifiers array exists
		if (!Array.isArray(this._data.namedModifiers)) {
			this._data.namedModifiers = [];
		}

		// Ensure acFormulas array exists
		if (!Array.isArray(this._data.acFormulas)) {
			this._data.acFormulas = [];
		}

		// Ensure activeStates array exists
		if (!Array.isArray(this._data.activeStates)) {
			this._data.activeStates = [];
		}

		// Migrate features: infer featureType for old saves that don't have it
		this._migrateFeatures();
	}

	_migrateFeatures () {
		if (!this._data.features?.length) return;

		const classNames = (this._data.classes || []).map(c => c.name?.toLowerCase()).filter(Boolean);
		const raceName = this._data.race?.name?.toLowerCase();
		const backgroundName = this._data.background?.name?.toLowerCase();

		this._data.features = this._data.features.map(f => {
			// Already has a featureType, skip
			if (f.featureType) return f;

			// Has className - it's a class feature
			if (f.className) {
				return {...f, featureType: "Class"};
			}

			// Source contains a class name
			if (f.source && classNames.some(cn => f.source.toLowerCase().includes(cn))) {
				return {...f, featureType: "Class"};
			}

			// Source mentions race
			if (f.source && raceName && f.source.toLowerCase().includes(raceName)) {
				return {...f, featureType: "Race"};
			}

			// Source mentions background
			if (f.source && backgroundName && f.source.toLowerCase().includes(backgroundName)) {
				return {...f, featureType: "Background"};
			}

			return f;
		});
	}

	// Alias for compatibility with export module
	fromJSON (json) { return this.loadFromJson(json); }

	// Get all characters - returns array with just this character
	// Note: Multiple character support is handled at the page level via StorageUtil
	getAllCharacters () {
		if (this._data.id) {
			return [this.toJson()];
		}
		return [];
	}

	setId (id) { this._data.id = id; }
	getId () { return this._data.id; }
	// #endregion

	// #region Basic Info
	setName (name) { this._data.name = name; }
	getName () { return this._data.name; }

	setRace (race, subrace = null) {
		this._data.race = race;
		this._data.subrace = subrace;
	}

	getRace () { return this._data.race; }
	getSubrace () { return this._data.subrace; }

	getRaceName () {
		if (!this._data.race) return null;
		// For merged races (with _baseName), the name already includes the subrace
		if (this._data.race._baseName) {
			return this._data.race.name;
		}
		// For non-merged races, append subrace if present
		const subrace = this._data.subrace?.name ? ` (${this._data.subrace.name})` : "";
		return `${this._data.race.name}${subrace}`;
	}

	setBackground (background) { this._data.background = background; }
	getBackground () { return this._data.background; }
	getBackgroundName () { return this._data.background?.name || null; }

	addClass (classData) {
		const existing = this._data.classes.find(c => c.name === classData.name && c.source === classData.source);
		if (existing) {
			existing.level = classData.level;
			existing.subclass = classData.subclass;
		} else {
			this._data.classes.push({...classData});
		}
		this._recalculateMaxHp();
		this._recalculateHitDice();
	}

	removeClass (className, source) {
		this._data.classes = this._data.classes.filter(c => !(c.name === className && c.source === source));
		this._recalculateMaxHp();
		this._recalculateHitDice();
	}

	getClasses () { return this._data.classes; }

	getClassSummary () {
		if (!this._data.classes.length) return null;
		return this._data.classes
			.map(c => `${c.name} ${c.level}${c.subclass ? ` (${c.subclass.name})` : ""}`)
			.join(" / ");
	}

	getTotalLevel () {
		return this._data.classes.reduce((sum, c) => sum + (c.level || 0), 0) || 1;
	}

	getProficiencyBonus () {
		const level = this.getTotalLevel();
		const baseProfBonus = Math.floor((level - 1) / 4) + 2;
		return baseProfBonus + (this._data.customModifiers.proficiencyBonus || 0);
	}
	// #endregion

	// #region Senses
	/**
	 * Get all senses for this character
	 * @returns {object} Object with sense names and ranges
	 */
	getSenses () {
		const senseMods = this._data.customModifiers.senses || {};
		const baseSenses = this._data.senses || {};
		return {
			darkvision: Math.max(baseSenses.darkvision || 0, senseMods.darkvision || 0),
			blindsight: Math.max(baseSenses.blindsight || 0, senseMods.blindsight || 0),
			tremorsense: Math.max(baseSenses.tremorsense || 0, senseMods.tremorsense || 0),
			truesight: Math.max(baseSenses.truesight || 0, senseMods.truesight || 0),
		};
	}

	/**
	 * Get a specific sense range
	 * @param {string} sense - The sense name (darkvision, blindsight, etc.)
	 * @returns {number} The range in feet
	 */
	getSense (sense) {
		const senseMods = this._data.customModifiers.senses || {};
		const baseSenses = this._data.senses || {};
		return Math.max(baseSenses[sense] || 0, senseMods[sense] || 0);
	}

	/**
	 * Set a base sense value
	 * @param {string} sense - The sense name
	 * @param {number} range - The range in feet
	 */
	setSense (sense, range) {
		if (!this._data.senses) this._data.senses = {};
		this._data.senses[sense] = range;
	}

	/**
	 * Get passive perception (10 + perception modifier)
	 * @returns {number} Passive perception score
	 */
	getPassivePerception () {
		return 10 + this.getSkillMod("perception");
	}

	/**
	 * Get passive investigation (10 + investigation modifier)
	 * @returns {number} Passive investigation score
	 */
	getPassiveInvestigation () {
		return 10 + this.getSkillMod("investigation");
	}

	/**
	 * Get passive insight (10 + insight modifier)
	 * @returns {number} Passive insight score
	 */
	getPassiveInsight () {
		return 10 + this.getSkillMod("insight");
	}
	// #endregion

	// #region Ability Scores
	setAbilityBase (ability, score) {
		this._data.abilities[ability] = score;
	}

	setAbilityBonus (ability, bonus) {
		this._data.abilityBonuses[ability] = bonus;
	}

	getAbilityScore (ability) {
		const base = this._data.abilities[ability] || 10;
		const racialBonus = this._data.abilityBonuses[ability] || 0;
		const featureBonus = this._data.customModifiers.abilityScores?.[ability] || 0;
		return base + racialBonus + featureBonus;
	}

	// Alias for compatibility
	getAbilityTotal (ability) {
		return this.getAbilityScore(ability);
	}

	getAbilityMod (ability) {
		return Math.floor((this.getAbilityScore(ability) - 10) / 2);
	}

	getAbilityBase (ability) {
		return this._data.abilities[ability] || 10;
	}

	getAbilityBonus (ability) {
		const racialBonus = this._data.abilityBonuses[ability] || 0;
		const featureBonus = this._data.customModifiers.abilityScores?.[ability] || 0;
		return racialBonus + featureBonus;
	}
	// #endregion

	// #region HP
	setCurrentHp (hp) {
		this._data.hp.current = Math.max(0, Math.min(hp, this.getMaxHp()));
	}

	getCurrentHp () { return this._data.hp.current; }

	setMaxHp (hp) { this._data.hp.max = hp; }

	getMaxHp () {
		if (this._data.hp.max > 0) return this._data.hp.max;
		return this._calculateMaxHp();
	}

	_calculateMaxHp () {
		// Calculate based on class hit dice + CON modifier
		let hp = 0;
		const conMod = this.getAbilityMod("con");

		this._data.classes.forEach((cls, idx) => {
			const hitDie = this._getClassHitDie(cls.name);
			for (let i = 0; i < cls.level; i++) {
				if (idx === 0 && i === 0) {
					// First level of first class: max hit die
					hp += hitDie + conMod;
				} else {
					// Subsequent levels: average (rounded up)
					hp += Math.ceil(hitDie / 2) + 1 + conMod;
				}
			}
		});

		// Add flat HP bonus from features/items
		hp += this._data.customModifiers.hp || 0;

		// Add per-level HP bonus from features (like Tough feat)
		const totalLevel = this.getTotalLevel() || 1;
		hp += (this._data.customModifiers.hpPerLevel || 0) * totalLevel;

		return Math.max(1, hp);
	}

	_recalculateMaxHp () {
		const calculated = this._calculateMaxHp();
		if (this._data.hp.max === 0 || this._data.hp.max === calculated) {
			this._data.hp.max = calculated;
		}
		// If current HP exceeds max, cap it
		if (this._data.hp.current > this._data.hp.max) {
			this._data.hp.current = this._data.hp.max;
		}
	}

	setTempHp (hp) { this._data.hp.temp = Math.max(0, hp); }
	getTempHp () { return this._data.hp.temp; }

	// Unified HP methods for rest.js compatibility
	heal (amount) {
		const maxHp = this.getMaxHp();
		this._data.hp.current = Math.min(maxHp, this._data.hp.current + amount);
	}

	getHp () {
		return {
			current: this._data.hp.current,
			max: this.getMaxHp(),
			temp: this._data.hp.temp,
		};
	}

	setHp (current, max, temp) {
		this._data.hp.current = Math.max(0, current);
		if (max !== undefined) this._data.hp.max = max;
		if (temp !== undefined) this._data.hp.temp = Math.max(0, temp);
	}
	// #endregion

	// #region Hit Dice
	_getClassHitDie (className) {
		const hitDice = {
			"Barbarian": 12,
			"Fighter": 10,
			"Paladin": 10,
			"Ranger": 10,
			"Bard": 8,
			"Cleric": 8,
			"Druid": 8,
			"Monk": 8,
			"Rogue": 8,
			"Warlock": 8,
			"Sorcerer": 6,
			"Wizard": 6,
			"Artificer": 8,
			"Blood Hunter": 10,
		};
		return hitDice[className] || 8;
	}

	_recalculateHitDice () {
		const hitDice = {};
		this._data.classes.forEach(cls => {
			const dieType = `d${this._getClassHitDie(cls.name)}`;
			if (!hitDice[dieType]) {
				hitDice[dieType] = {current: 0, max: 0};
			}
			hitDice[dieType].max += cls.level;
			hitDice[dieType].current = Math.min(
				hitDice[dieType].current + cls.level,
				hitDice[dieType].max,
			);
		});
		this._data.hitDice = hitDice;
	}

	getHitDice () {
		// Return hit dice as an array [{type, die, className, current, max}, ...]
		const types = Object.keys(this._data.hitDice);

		if (types.length === 0) {
			// Default to d8 for total level if no classes yet
			return [{type: "d8", die: 8, className: "Unknown", current: this.getTotalLevel(), max: this.getTotalLevel()}];
		}

		// Build hit dice with class names
		const result = [];
		types.forEach(type => {
			const dieSize = parseInt(type.replace("d", ""));
			// Find class(es) that use this die
			const classNames = this._data.classes
				.filter(cls => this._getClassHitDie(cls.name) === dieSize)
				.map(cls => cls.name);
			
			result.push({
				type,
				die: dieSize,
				className: classNames.join("/") || "Unknown",
				current: this._data.hitDice[type].current,
				max: this._data.hitDice[type].max,
			});
		});

		return result;
	}

	getHitDiceSummary () {
		// Return combined hit dice info as single object
		let total = {current: 0, max: 0, type: "d8"};
		const types = Object.keys(this._data.hitDice);

		if (types.length === 0) {
			return {current: this.getTotalLevel(), max: this.getTotalLevel(), type: "d8"};
		}

		types.forEach(type => {
			total.current += this._data.hitDice[type].current;
			total.max += this._data.hitDice[type].max;
		});

		// Primary type is the one with most dice
		total.type = types.reduce((a, b) =>
			(this._data.hitDice[a]?.max || 0) >= (this._data.hitDice[b]?.max || 0) ? a : b,
		);

		return total;
	}

	getHitDiceByType () {
		return {...this._data.hitDice};
	}

	useHitDie (dieType = null) {
		if (!dieType) {
			// Use the first available hit die
			const types = Object.keys(this._data.hitDice);
			for (const type of types) {
				if (this._data.hitDice[type].current > 0) {
					dieType = type;
					break;
				}
			}
		}

		if (dieType && this._data.hitDice[dieType]?.current > 0) {
			this._data.hitDice[dieType].current--;
			return true;
		}
		return false;
	}

	recoverHitDice (amount = null) {
		// Recover hit dice (usually half total level on long rest)
		const totalLevel = this.getTotalLevel();
		const toRecover = amount ?? Math.max(1, Math.floor(totalLevel / 2));

		let remaining = toRecover;
		for (const type of Object.keys(this._data.hitDice)) {
			const hd = this._data.hitDice[type];
			const canRecover = Math.min(remaining, hd.max - hd.current);
			hd.current += canRecover;
			remaining -= canRecover;
			if (remaining <= 0) break;
		}
	}

	setHitDice (hitDiceArray) {
		// Convert array format [{type, current, max}, ...] to object format {d8: {current, max}, ...}
		if (Array.isArray(hitDiceArray)) {
			this._data.hitDice = {};
			hitDiceArray.forEach(hd => {
				this._data.hitDice[hd.type] = {current: hd.current, max: hd.max};
			});
		} else {
			this._data.hitDice = {...hitDiceArray};
		}
	}
	// #endregion

	// #region Death Saves
	getDeathSaves () { return {...this._data.deathSaves}; }

	setDeathSaves (successesOrObj, failures) {
		// Support both (obj) and (successes, failures) signatures
		if (typeof successesOrObj === "object") {
			this._data.deathSaves.successes = Math.min(3, Math.max(0, successesOrObj.successes || 0));
			this._data.deathSaves.failures = Math.min(3, Math.max(0, successesOrObj.failures || 0));
		} else {
			this._data.deathSaves.successes = Math.min(3, Math.max(0, successesOrObj));
			this._data.deathSaves.failures = Math.min(3, Math.max(0, failures));
		}
	}

	resetDeathSaves () {
		this._data.deathSaves = {successes: 0, failures: 0};
	}
	// #endregion

	// #region Inspiration
	hasInspiration () { return this._data.inspiration; }
	setInspiration (value) { this._data.inspiration = value; }
	toggleInspiration () { this._data.inspiration = !this._data.inspiration; }
	// #endregion

	// #region Saving Throws
	addSaveProficiency (ability) {
		if (!this._data.saveProficiencies.includes(ability)) {
			this._data.saveProficiencies.push(ability);
		}
	}

	removeSaveProficiency (ability) {
		this._data.saveProficiencies = this._data.saveProficiencies.filter(a => a !== ability);
	}

	hasSaveProficiency (ability) {
		return this._data.saveProficiencies.includes(ability);
	}

	getSaveMod (ability) {
		const mod = this.getAbilityMod(ability);
		const prof = this.hasSaveProficiency(ability) ? this.getProficiencyBonus() : 0;
		const custom = this._data.customModifiers.savingThrows[ability] || 0;
		// Add item bonuses (general saving throw bonus from magic items)
		const itemBonus = this._data.itemBonuses?.savingThrow || 0;
		return mod + prof + custom + itemBonus;
	}
	// #endregion

	// #region Skills
	setSkillProficiency (skill, level) {
		// 0 = none, 1 = proficient, 2 = expertise
		if (level === 0) {
			delete this._data.skillProficiencies[skill];
		} else {
			this._data.skillProficiencies[skill] = level;
		}
	}

	// Alias for compatibility with levelup module
	addSkillProficiency (skill) { this.setSkillProficiency(skill, 1); }

	getSkillProficiency (skill) {
		return this._data.skillProficiencies[skill] || 0;
	}

	getSkillMod (skill) {
		const skillAbilities = {
			acrobatics: "dex",
			animalhandling: "wis",
			arcana: "int",
			athletics: "str",
			deception: "cha",
			history: "int",
			insight: "wis",
			intimidation: "cha",
			investigation: "int",
			medicine: "wis",
			nature: "int",
			perception: "wis",
			performance: "cha",
			persuasion: "cha",
			religion: "int",
			sleightofhand: "dex",
			stealth: "dex",
			survival: "wis",
		};

		let ability = skillAbilities[skill];

		// If not a standard skill, check custom skills
		if (!ability) {
			const customSkill = this._data.customSkills.find(s => 
				s.name.toLowerCase().replace(/\s+/g, "") === skill
			);
			ability = customSkill?.ability || "str";
		}

		return this.getSkillModWithAbility(skill, ability);
	}

	/**
	 * Get skill modifier with a specific ability score (for alternate ability skill checks)
	 * @param {string} skill - The skill key (e.g., "stealth", "athletics")
	 * @param {string} ability - The ability to use (e.g., "dex", "int", "str")
	 * @returns {number} The total skill modifier
	 */
	getSkillModWithAbility (skill, ability) {
		const mod = this.getAbilityMod(ability);
		const profLevel = this.getSkillProficiency(skill);
		
		let profBonus = profLevel * this.getProficiencyBonus();
		
		// Jack of All Trades: add half proficiency bonus to skills you're not proficient in
		if (profLevel === 0 && this.hasJackOfAllTrades()) {
			profBonus = Math.floor(this.getProficiencyBonus() / 2);
		}
		
		// Get custom modifiers (specific skill + "all skills" bonus)
		const custom = this.getSkillCustomMod(skill);
		// Add item bonuses (ability check bonus from magic items)
		const itemBonus = this._data.itemBonuses?.abilityCheck || 0;

		return mod + profBonus + custom + itemBonus;
	}

	/**
	 * Check if the character has the Jack of All Trades feature
	 */
	hasJackOfAllTrades () {
		return this._data.features.some(f => 
			f.name?.toLowerCase().includes("jack of all trades")
		);
	}

	/**
	 * Add a custom skill
	 * @param {string} name - The skill name
	 * @param {string} ability - The associated ability (str, dex, con, int, wis, cha)
	 */
	addCustomSkill (name, ability) {
		const key = name.toLowerCase().replace(/\s+/g, "");
		// Don't add if already exists
		if (this._data.customSkills.some(s => s.name.toLowerCase().replace(/\s+/g, "") === key)) {
			return false;
		}
		this._data.customSkills.push({name, ability});
		return true;
	}

	/**
	 * Remove a custom skill
	 * @param {string} name - The skill name to remove
	 */
	removeCustomSkill (name) {
		const key = name.toLowerCase().replace(/\s+/g, "");
		const idx = this._data.customSkills.findIndex(s => s.name.toLowerCase().replace(/\s+/g, "") === key);
		if (idx >= 0) {
			this._data.customSkills.splice(idx, 1);
			// Also remove proficiency if set
			delete this._data.skillProficiencies[key];
			return true;
		}
		return false;
	}

	/**
	 * Get all custom skills
	 * @returns {Array} Array of {name, ability} objects
	 */
	getCustomSkills () {
		return this._data.customSkills || [];
	}
	// #endregion

	// #region AC
	getAc () {
		let ac = this._data.ac.base;
		const dexMod = this.getAbilityMod("dex");

		// Check for Unarmored Defense class features (built-in support for Barbarian/Monk)
		const hasUnarmoredDefense = this._hasUnarmoredDefense();

		// Check for AC formulas from features (natural armor, homebrew unarmored defense, etc.)
		const acFormulas = this._data.acFormulas || [];
		const bestAcFormula = this._getBestAcFormula(acFormulas, dexMod);

		// If wearing armor, use armor AC calculation
		if (this._data.ac.armor) {
			ac = this._data.ac.armor.ac || 10;
			// Add DEX modifier (limited by armor type)
			if (this._data.ac.armor.type === "light") {
				ac += dexMod;
			} else if (this._data.ac.armor.type === "medium") {
				ac += Math.min(2, dexMod);
			}
			// Heavy armor: no DEX bonus

			// Natural armor that doesn't add DEX might still be better (e.g., Tortle's 17)
			if (bestAcFormula && bestAcFormula.ac > ac && bestAcFormula.formula.noDex) {
				ac = bestAcFormula.ac;
			}
		} else if (hasUnarmoredDefense || bestAcFormula) {
			// Use the best unarmored AC option
			const classUnarmoredAc = hasUnarmoredDefense ? this._calculateUnarmoredDefenseAc() : 0;
			const formulaAc = bestAcFormula?.ac || 0;
			const standardAc = 10 + dexMod;

			ac = Math.max(classUnarmoredAc, formulaAc, standardAc);
		} else {
			// Standard unarmored: 10 + DEX
			ac = 10 + dexMod;
		}

		// Shield (only add if not using a formula that forbids it, like Monk unarmored defense)
		if (this._data.ac.shield) {
			const isMonkUnarmored = !this._data.ac.armor && this._hasMonkUnarmoredDefense();
			// Check if current AC formula forbids shields
			const formulaForbidsShield = bestAcFormula?.formula?.formulaType === "unarmoredDefense" && 
				bestAcFormula.ac > (10 + dexMod); // Only matters if we're using the formula
			
			if (!isMonkUnarmored && !formulaForbidsShield) {
				// Base shield bonus is 2, plus any magic bonus
				const baseShieldBonus = 2;
				const magicBonus = (typeof this._data.ac.shield === "object") ? (this._data.ac.shield.bonus || 0) : 0;
				ac += baseShieldBonus + magicBonus;
			}
		}

		// Bonuses from other equipped magic items (e.g., Cloak of Protection, Ring of Protection)
		// Note: Armor and shield bonuses are already included above, this is for OTHER items
		ac += this._data.ac.itemBonus || 0;

		// Custom bonuses
		ac += this._data.customModifiers.ac || 0;

		// Active state bonuses (e.g., Defensive Stance)
		ac += this.getBonusFromStates("ac");

		// Other bonuses
		this._data.ac.bonuses.forEach(bonus => {
			ac += bonus.value || 0;
		});

		return ac;
	}

	/**
	 * Get the best AC formula from available formulas
	 * @param {Array} formulas - AC formula objects from features
	 * @param {number} dexMod - Dexterity modifier
	 * @returns {object|null} Best formula with calculated AC, or null
	 */
	_getBestAcFormula (formulas, dexMod) {
		if (!formulas?.length) return null;

		let best = null;
		let bestAc = 0;

		formulas.forEach(formula => {
			// Skip conditional formulas that aren't active
			if (formula.conditional) return; // For now, skip conditional AC formulas

			let ac = formula.base || 10;

			// Add DEX modifier if formula uses it
			if (formula.addDex && !formula.noDex) {
				ac += dexMod;
			}

			// Add second ability modifier (for unarmored defense style formulas)
			if (formula.secondAbility) {
				ac += this.getAbilityMod(formula.secondAbility);
			}

			if (ac > bestAc) {
				bestAc = ac;
				best = {formula, ac};
			}
		});

		return best;
	}

	_hasUnarmoredDefense () {
		return this._hasBarbarianUnarmoredDefense() || this._hasMonkUnarmoredDefense();
	}

	_hasBarbarianUnarmoredDefense () {
		return this._data.classes.some(c => c.name === "Barbarian");
	}

	_hasMonkUnarmoredDefense () {
		return this._data.classes.some(c => c.name === "Monk");
	}

	_calculateUnarmoredDefenseAc () {
		const dexMod = this.getAbilityMod("dex");

		// Barbarian: 10 + DEX + CON
		if (this._hasBarbarianUnarmoredDefense()) {
			const conMod = this.getAbilityMod("con");
			return 10 + dexMod + conMod;
		}

		// Monk: 10 + DEX + WIS (no shield)
		if (this._hasMonkUnarmoredDefense()) {
			const wisMod = this.getAbilityMod("wis");
			return 10 + dexMod + wisMod;
		}

		return 10 + dexMod;
	}

	// Alias for compatibility with export module
	getArmorClass () { return this.getAc(); }

	setBaseAc (ac) { this._data.ac.base = ac; }
	setArmor (armor) { this._data.ac.armor = armor; }
	setShield (hasShield) { this._data.ac.shield = hasShield; }
	setItemAcBonus (bonus) { this._data.ac.itemBonus = bonus || 0; }
	getItemAcBonus () { return this._data.ac.itemBonus || 0; }

	// Item bonuses from equipped/attuned magic items
	setItemBonuses (bonuses) { this._data.itemBonuses = bonuses || {}; }
	getItemBonuses () { return this._data.itemBonuses || {}; }
	getItemBonus (type) { return this._data.itemBonuses?.[type] || 0; }
	// #endregion

	// #region Speed
	getSpeed () {
		const speedMods = this._data.customModifiers.speed || {walk: 0, fly: 0, swim: 0, climb: 0, burrow: 0};
		const walk = (this._data.speed.walk || 30) + (speedMods.walk || 0);
		const parts = [`${walk} ft.`];

		// Check for "equal to walk" modifiers for each speed type
		const getSpeedWithEqualToWalk = (type, base, bonus) => {
			const equalToWalkMod = this._data.namedModifiers?.find(m => 
				m.type === `speed:${type}` && m.equalToWalk && m.enabled,
			);
			if (equalToWalkMod) {
				return Math.max(base + bonus, walk);
			}
			return base + bonus;
		};

		const fly = getSpeedWithEqualToWalk("fly", this._data.speed.fly || 0, speedMods.fly || 0);
		const swim = getSpeedWithEqualToWalk("swim", this._data.speed.swim || 0, speedMods.swim || 0);
		const climb = getSpeedWithEqualToWalk("climb", this._data.speed.climb || 0, speedMods.climb || 0);
		const burrow = getSpeedWithEqualToWalk("burrow", this._data.speed.burrow || 0, speedMods.burrow || 0);

		if (fly > 0) parts.push(`fly ${fly} ft.`);
		if (swim > 0) parts.push(`swim ${swim} ft.`);
		if (climb > 0) parts.push(`climb ${climb} ft.`);
		if (burrow > 0) parts.push(`burrow ${burrow} ft.`);

		return parts.join(", ");
	}

	setSpeed (type, value) {
		this._data.speed[type] = value;
	}

	getWalkSpeed () {
		const speedMods = this._data.customModifiers.speed || {walk: 0};
		return (this._data.speed.walk || 30) + (speedMods.walk || 0);
	}

	getSpeedByType (type) {
		const speedMods = this._data.customModifiers.speed || {};
		let base = this._data.speed[type] || 0;
		const bonus = speedMods[type] || 0;
		
		// Check for "equal to walk" modifiers (e.g., "swimming speed equal to your walking speed")
		const equalToWalkMod = this._data.namedModifiers?.find(m => 
			m.type === `speed:${type}` && m.equalToWalk && m.enabled,
		);
		if (equalToWalkMod) {
			// Override base with walking speed
			base = Math.max(base, this.getWalkSpeed());
		}
		
		return base + bonus;
	}
	// #endregion

	// #region Initiative
	getInitiative () {
		let initiative = this.getAbilityMod("dex") + (this._data.customModifiers.initiative || 0);
		
		// Jack of All Trades adds half proficiency to initiative (it's a DEX ability check)
		if (this.hasJackOfAllTrades()) {
			initiative += Math.floor(this.getProficiencyBonus() / 2);
		}
		
		return initiative;
	}
	// #endregion

	// #region Proficiencies
	getProficiencies () {
		return {
			armor: [...this._data.armorProficiencies],
			weapons: [...this._data.weaponProficiencies],
			tools: [...this._data.toolProficiencies],
			languages: [...this._data.languages],
		};
	}

	getArmorProficiencies () { return [...this._data.armorProficiencies]; }
	getWeaponProficiencies () { return [...this._data.weaponProficiencies]; }
	getToolProficiencies () { return [...this._data.toolProficiencies]; }
	getLanguages () { return [...this._data.languages]; }
	getSaveProficiencies () { return [...this._data.saveProficiencies]; }

	addArmorProficiency (armor) {
		if (!this._data.armorProficiencies.includes(armor)) {
			this._data.armorProficiencies.push(armor);
		}
	}

	removeArmorProficiency (armor) {
		const idx = this._data.armorProficiencies.indexOf(armor);
		if (idx >= 0) this._data.armorProficiencies.splice(idx, 1);
	}

	addWeaponProficiency (weapon) {
		if (!this._data.weaponProficiencies.includes(weapon)) {
			this._data.weaponProficiencies.push(weapon);
		}
	}

	removeWeaponProficiency (weapon) {
		const idx = this._data.weaponProficiencies.indexOf(weapon);
		if (idx >= 0) this._data.weaponProficiencies.splice(idx, 1);
	}

	addToolProficiency (tool) {
		// Case-insensitive check to avoid duplicates from different sources
		const toolLower = tool.toLowerCase();
		if (!this._data.toolProficiencies.some(t => t.toLowerCase() === toolLower)) {
			this._data.toolProficiencies.push(tool);
		}
	}

	removeToolProficiency (tool) {
		const toolLower = tool.toLowerCase();
		const idx = this._data.toolProficiencies.findIndex(t => t.toLowerCase() === toolLower);
		if (idx >= 0) this._data.toolProficiencies.splice(idx, 1);
	}

	addLanguage (language) {
		if (!this._data.languages.includes(language)) {
			this._data.languages.push(language);
		}
	}

	removeLanguage (language) {
		const idx = this._data.languages.indexOf(language);
		if (idx >= 0) this._data.languages.splice(idx, 1);
	}
	// #endregion

	// #region Spellcasting
	getSpellcasting () { return this._data.spellcasting; }
	getSpellcastingAbility () { return this._data.spellcasting.ability; }
	setSpellcastingAbility (ability) { this._data.spellcasting.ability = ability; }

	getSpellSaveDc () {
		const ability = this._data.spellcasting.ability;
		if (!ability) return null;
		// Add item bonuses (spell save DC bonus from magic items)
		const itemBonus = this._data.itemBonuses?.spellSaveDc || 0;
		// Apply exhaustion DC penalty (Thelemar rules only)
		const exhaustionPenalty = this._getExhaustionDcPenalty();
		return 8 + this.getProficiencyBonus() + this.getAbilityMod(ability) + (this._data.customModifiers.spellDc || 0) + itemBonus - exhaustionPenalty;
	}

	getSpellAttackBonus () {
		const ability = this._data.spellcasting.ability;
		if (!ability) return null;
		// Add item bonuses (spell attack bonus from magic items)
		const itemBonus = this._data.itemBonuses?.spellAttack || 0;
		return this.getProficiencyBonus() + this.getAbilityMod(ability) + (this._data.customModifiers.spellAttack || 0) + itemBonus;
	}

	/**
	 * Get spellcasting info for the character - whether they use spells known or prepared
	 * Reads progression directly from class data when available
	 * @returns {{type: string, max: number, cantripsKnown: number}} or null if no spellcasting
	 */
	getSpellcastingInfo () {
		const classes = this._data.classes || [];
		if (!classes.length) return null;

		const primaryClass = classes[0];
		const className = primaryClass.name;
		const level = primaryClass.level || 1;
		const levelIndex = Math.min(level, 20) - 1;
		const classData = primaryClass._classData; // Full class data if available

		// Try to get progression from class data first (supports 2024 and homebrew)
		if (classData) {
			const cantripsKnown = classData.cantripProgression?.[levelIndex] || 0;

			// 2024 rules use preparedSpellsProgression for all casters
			if (classData.preparedSpellsProgression) {
				return {
					type: "prepared",
					max: classData.preparedSpellsProgression[levelIndex] || 0,
					cantripsKnown,
				};
			}

			// 2014 rules use spellsKnownProgression for some casters
			if (classData.spellsKnownProgression) {
				return {
					type: "known",
					max: classData.spellsKnownProgression[levelIndex] || 0,
					cantripsKnown,
				};
			}

			// Check for prepared caster without explicit progression (2014 Cleric, Druid, etc.)
			if (classData.casterProgression && classData.spellcastingAbility) {
				// These use level + ability mod formula
				const ability = classData.spellcastingAbility;
				const abilityMod = this.getAbilityMod(ability);
				let preparedCount;

				if (classData.casterProgression === "1/2") {
					// Half casters: half level + mod
					preparedCount = Math.max(1, Math.floor(level / 2) + abilityMod);
				} else {
					// Full casters: level + mod
					preparedCount = Math.max(1, level + abilityMod);
				}

				return {
					type: "prepared",
					max: preparedCount,
					cantripsKnown,
				};
			}
		}

		// Fallback: hardcoded tables for when class data isn't available
		// Spells Known tables (2014 rules)
		const spellsKnownTables = {
			"Bard": [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
			"Sorcerer": [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
			"Warlock": [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
			"Ranger": [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
		};

		// Cantrips known
		const cantripsKnownTables = {
			"Bard": [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			"Cleric": [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
			"Druid": [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			"Sorcerer": [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
			"Warlock": [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			"Wizard": [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
		};

		// Prepared casters (2014 rules)
		const preparedCasters = ["Cleric", "Druid", "Paladin", "Wizard", "Artificer"];

		// Get cantrips known
		let cantripsKnown = cantripsKnownTables[className]?.[levelIndex] || 0;

		// Check if spells known class
		if (spellsKnownTables[className]) {
			return {
				type: "known",
				max: spellsKnownTables[className][levelIndex],
				cantripsKnown,
			};
		}

		// Check if prepared caster
		if (preparedCasters.includes(className)) {
			const abilityMap = {
				"Cleric": "wis",
				"Druid": "wis",
				"Paladin": "cha",
				"Wizard": "int",
				"Artificer": "int",
			};

			const ability = abilityMap[className];
			const abilityMod = this.getAbilityMod(ability);

			let preparedCount;
			if (className === "Paladin") {
				preparedCount = Math.max(1, Math.floor(level / 2) + abilityMod);
			} else if (className === "Artificer") {
				preparedCount = Math.max(1, Math.ceil(level / 2) + abilityMod);
			} else {
				preparedCount = Math.max(1, level + abilityMod);
			}

			return {
				type: "prepared",
				max: preparedCount,
				cantripsKnown,
			};
		}

		// Check for third-caster subclasses
		const subclassName = primaryClass.subclass?.name;
		if (subclassName === "Eldritch Knight" || subclassName === "Arcane Trickster") {
			const ekAtSpellsKnown = [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13];
			return {
				type: "known",
				max: ekAtSpellsKnown[levelIndex],
				cantripsKnown: level >= 3 ? (level >= 10 ? 3 : 2) : 0,
			};
		}

		return null;
	}

	getSpellSlots () { return MiscUtil.copyFast(this._data.spellcasting.spellSlots); }

	getSpellSlotsCurrent (level) {
		const slot = this._data.spellcasting.spellSlots[level];
		return slot ? slot.current : 0;
	}

	getSpellSlotsMax (level) {
		const slot = this._data.spellcasting.spellSlots[level];
		return slot ? slot.max : 0;
	}

	getPactSlots () {
		return this._data.spellcasting.pactSlots || {current: 0, max: 0, level: 0};
	}

	setPactSlotsCurrent (current) {
		if (this._data.spellcasting.pactSlots) {
			this._data.spellcasting.pactSlots.current = Math.max(0, Math.min(current, this._data.spellcasting.pactSlots.max));
		}
	}

	usePactSlot () {
		const pact = this._data.spellcasting.pactSlots;
		if (pact && pact.current > 0) {
			pact.current--;
			return true;
		}
		return false;
	}

	setSpellSlots (level, max, current = max) {
		this._data.spellcasting.spellSlots[level] = {current, max};
	}

	/**
	 * Calculate spell slots based on class(es) and level using standard 5e spell slot progression
	 * Handles full casters, half casters, third casters, and multiclassing
	 */
	calculateSpellSlots () {
		const classes = this._data.classes || [];
		if (!classes.length) return;

		// Full casters
		const fullCasters = ["Bard", "Cleric", "Druid", "Sorcerer", "Wizard"];
		// Half casters (round down)
		const halfCasters = ["Paladin", "Ranger", "Artificer"];
		// Warlock is special - has pact slots instead

		// Calculate total caster level (for multiclassing)
		let casterLevel = 0;
		let isWarlock = false;
		let warlockLevel = 0;

		for (const cls of classes) {
			const className = cls.name;
			const level = cls.level || 1;

			if (className === "Warlock") {
				isWarlock = true;
				warlockLevel = level;
			} else if (fullCasters.includes(className)) {
				casterLevel += level;
			} else if (halfCasters.includes(className)) {
				// Half casters need level 2 to start contributing
				casterLevel += Math.floor(level / 2);
			} else {
				// Check for third-caster subclasses (Eldritch Knight, Arcane Trickster)
				const subclassName = cls.subclass?.name;
				if (subclassName === "Eldritch Knight" || subclassName === "Arcane Trickster") {
					casterLevel += Math.floor(level / 3);
				}
			}
		}

		// Standard spell slot progression table (by caster level)
		const slotTable = {
			1:  [2, 0, 0, 0, 0, 0, 0, 0, 0],
			2:  [3, 0, 0, 0, 0, 0, 0, 0, 0],
			3:  [4, 2, 0, 0, 0, 0, 0, 0, 0],
			4:  [4, 3, 0, 0, 0, 0, 0, 0, 0],
			5:  [4, 3, 2, 0, 0, 0, 0, 0, 0],
			6:  [4, 3, 3, 0, 0, 0, 0, 0, 0],
			7:  [4, 3, 3, 1, 0, 0, 0, 0, 0],
			8:  [4, 3, 3, 2, 0, 0, 0, 0, 0],
			9:  [4, 3, 3, 3, 1, 0, 0, 0, 0],
			10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
			11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
			12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
			13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
			14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
			15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
			16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
			17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
			18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
			19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
			20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
		};

		// Set slots based on caster level
		if (casterLevel > 0) {
			const slots = slotTable[Math.min(casterLevel, 20)] || [0, 0, 0, 0, 0, 0, 0, 0, 0];
			for (let level = 1; level <= 9; level++) {
				const max = slots[level - 1];
				// Preserve current usage if already set with same max
				const existing = this._data.spellcasting.spellSlots[level];
				if (existing && existing.max === max) {
					// Keep current value
				} else {
					this._data.spellcasting.spellSlots[level] = {current: max, max: max};
				}
			}
		}

		// Handle Warlock pact slots separately (they use different progression)
		// Warlock pact slots are in addition to regular spell slots for multiclass
		if (isWarlock && warlockLevel > 0) {
			// Pact Magic slot progression table
			// [number of slots, slot level]
			const pactSlotTable = {
				1:  [1, 1],
				2:  [2, 1],
				3:  [2, 2],
				4:  [2, 2],
				5:  [2, 3],
				6:  [2, 3],
				7:  [2, 4],
				8:  [2, 4],
				9:  [2, 5],
				10: [2, 5],
				11: [3, 5],
				12: [3, 5],
				13: [3, 5],
				14: [3, 5],
				15: [3, 5],
				16: [3, 5],
				17: [4, 5],
				18: [4, 5],
				19: [4, 5],
				20: [4, 5],
			};

			const [pactSlots, pactLevel] = pactSlotTable[Math.min(warlockLevel, 20)] || [0, 0];
			const existing = this._data.spellcasting.pactSlots;
			
			if (existing && existing.max === pactSlots && existing.level === pactLevel) {
				// Keep current value
			} else {
				this._data.spellcasting.pactSlots = {
					current: pactSlots,
					max: pactSlots,
					level: pactLevel,
				};
			}
		} else {
			// Reset pact slots if not a warlock
			this._data.spellcasting.pactSlots = {current: 0, max: 0, level: 0};
		}
	}

	setSpellSlotCurrent (level, current) {
		if (this._data.spellcasting.spellSlots[level]) {
			this._data.spellcasting.spellSlots[level].current = Math.max(0, Math.min(current, this._data.spellcasting.spellSlots[level].max));
		}
	}

	useSpellSlot (level) {
		const slot = this._data.spellcasting.spellSlots[level];
		if (slot && slot.current > 0) {
			slot.current--;
			return true;
		}
		return false;
	}

	recoverSpellSlots () {
		for (const level of Object.keys(this._data.spellcasting.spellSlots)) {
			this._data.spellcasting.spellSlots[level].current = this._data.spellcasting.spellSlots[level].max;
		}
	}

	getSpells () {
		// Return spells with IDs for easier manipulation
		const spells = this._data.spellcasting.spellsKnown.map(s => ({
			...s,
			id: s.id || `${s.name}|${s.source}`,
		}));
		const cantrips = this._data.spellcasting.cantripsKnown.map(c => {
			// Ensure cantrips always have a valid ID
			const id = c.id || `${c.name}|${c.source}`;
			return {
				...c,
				id: id,
				level: 0,
				prepared: true, // Cantrips are always prepared
			};
		});
		return [...cantrips, ...spells];
	}
	getSpellsKnown () { return [...this._data.spellcasting.spellsKnown]; }
	getCantripsKnown () { return [...this._data.spellcasting.cantripsKnown]; }

	addSpell (spell, prepared = false) {
		// Check if it's a cantrip
		if (spell.level === 0) {
			this.addCantrip(spell);
			return;
		}

		const existing = this._data.spellcasting.spellsKnown.find(
			s => s.name === spell.name && s.source === spell.source,
		);
		if (!existing) {
			this._data.spellcasting.spellsKnown.push({
				id: CryptUtil.uid(),
				name: spell.name,
				source: spell.source,
				level: spell.level,
				school: spell.school,
				ritual: spell.ritual || false,
				concentration: spell.concentration || false,
				prepared: prepared !== undefined ? prepared : spell.prepared,
				castingTime: spell.castingTime || "",
				range: spell.range || "",
				duration: spell.duration || "",
				components: spell.components || "",
			});
		}
	}

	addCantrip (spell) {
		const existing = this._data.spellcasting.cantripsKnown.find(
			s => s.name === spell.name && s.source === spell.source,
		);
		if (!existing) {
			this._data.spellcasting.cantripsKnown.push({
				id: CryptUtil.uid(),
				name: spell.name,
				source: spell.source,
				school: spell.school,
				castingTime: spell.castingTime || "",
				range: spell.range || "",
				duration: spell.duration || "",
				concentration: spell.concentration || false,
				components: spell.components || "",
			});
		}
	}

	removeSpell (spellIdOrName, source) {
		// Support both ID-based and name/source removal
		this._data.spellcasting.spellsKnown = this._data.spellcasting.spellsKnown.filter(s => {
			if (s.id === spellIdOrName) return false;
			if (s.name === spellIdOrName && s.source === source) return false;
			return true;
		});
		// Also check cantrips
		this._data.spellcasting.cantripsKnown = this._data.spellcasting.cantripsKnown.filter(s => {
			if (s.id === spellIdOrName) return false;
			if (s.name === spellIdOrName && s.source === source) return false;
			return true;
		});
	}

	// Innate spell management
	getInnateSpells () { 
		return [...(this._data.spellcasting.innateSpells || [])]; 
	}

	addInnateSpell (spell) {
		if (!this._data.spellcasting.innateSpells) {
			this._data.spellcasting.innateSpells = [];
		}

		// Check if already exists
		const existing = this._data.spellcasting.innateSpells.find(
			s => s.name === spell.name && s.source === spell.source,
		);
		if (existing) return;

		const innateSpell = {
			id: CryptUtil.uid(),
			name: spell.name,
			source: spell.source || Parser.SRC_PHB,
			level: spell.level,
			atWill: spell.atWill || false,
			sourceFeature: spell.sourceFeature,
		};

		// Add uses tracking if not at-will
		if (!spell.atWill && spell.uses) {
			innateSpell.uses = {
				current: spell.uses,
				max: spell.uses,
			};
			innateSpell.recharge = spell.recharge || "long";
		}

		this._data.spellcasting.innateSpells.push(innateSpell);
		console.log(`[CharSheet State] Added innate spell: ${spell.name} (from ${spell.sourceFeature})`);
	}

	removeInnateSpell (spellIdOrName, source) {
		if (!this._data.spellcasting.innateSpells) return;
		this._data.spellcasting.innateSpells = this._data.spellcasting.innateSpells.filter(s => {
			if (s.id === spellIdOrName) return false;
			if (s.name === spellIdOrName && s.source === source) return false;
			return true;
		});
	}

	removeInnateSpellsByFeature (featureName) {
		if (!this._data.spellcasting.innateSpells) return;
		this._data.spellcasting.innateSpells = this._data.spellcasting.innateSpells.filter(
			s => s.sourceFeature !== featureName,
		);
	}

	useInnateSpell (spellId) {
		if (!this._data.spellcasting.innateSpells) return;
		const spell = this._data.spellcasting.innateSpells.find(s => s.id === spellId);
		if (spell?.uses && spell.uses.current > 0) {
			spell.uses.current--;
		}
	}

	restoreInnateSpells (restType = "long") {
		if (!this._data.spellcasting.innateSpells) return;
		this._data.spellcasting.innateSpells.forEach(spell => {
			if (spell.uses && spell.recharge) {
				if (restType === "long" || (restType === "short" && spell.recharge === "short")) {
					spell.uses.current = spell.uses.max;
				}
			}
		});
	}

	setSpellPrepared (spellIdOrName, sourceOrPrepared, prepared) {
		// Support both (id, prepared) and (name, source, prepared) signatures
		let spell;
		if (prepared === undefined) {
			// Called as (id, prepared)
			spell = this._data.spellcasting.spellsKnown.find(s => s.id === spellIdOrName);
			prepared = sourceOrPrepared;
		} else {
			// Called as (name, source, prepared)
			spell = this._data.spellcasting.spellsKnown.find(
				s => s.name === spellIdOrName && s.source === sourceOrPrepared,
			);
		}
		if (spell) spell.prepared = prepared;
	}
	// #endregion

	// #region Feature DCs and Dice
	/**
	 * Get calculated values for class features (save DCs, damage dice, etc.)
	 * These are computed based on class, level, and ability scores
	 * @returns {object} - Feature calculated values
	 */
	getFeatureCalculations () {
		const classes = this._data.classes || [];
		const profBonus = this.getProficiencyBonus();
		const exhaustionPenalty = this._getExhaustionDcPenalty();
		const calculations = {};

		classes.forEach(cls => {
			const className = cls.name;
			const level = cls.level || 1;

			switch (className) {
				case "Rogue": {
					// Sneak Attack: 1d6 at level 1, +1d6 every 2 levels (rounded up)
					const sneakDice = Math.ceil(level / 2);
					calculations.sneakAttack = {
						dice: `${sneakDice}d6`,
						avgDamage: Math.floor(sneakDice * 3.5),
					};
					break;
				}
				case "Monk": {
					// Ki/Focus Save DC: 8 + prof + WIS
					const kiDc = 8 + profBonus + this.getAbilityMod("wis") - exhaustionPenalty;
					// Martial Arts die progression
					const martialArtsDice = level >= 17 ? "1d12" : level >= 11 ? "1d10" : level >= 5 ? "1d8" : "1d6";
					calculations.kiSaveDc = kiDc;
					calculations.focusSaveDc = kiDc; // 2024 PHB name
					calculations.martialArtsDie = martialArtsDice;
					calculations.unarmedDamage = martialArtsDice;
					break;
				}
				case "Barbarian": {
					// Rage damage bonus
					const rageDamage = level >= 16 ? 4 : level >= 9 ? 3 : 2;
					calculations.rageDamage = rageDamage;
					// Brutal Critical dice (levels 9, 13, 17)
					const brutalDice = level >= 17 ? 3 : level >= 13 ? 2 : level >= 9 ? 1 : 0;
					if (brutalDice > 0) {
						calculations.brutalCritical = `+${brutalDice} dice`;
					}
					break;
				}
				case "Paladin": {
					// Divine Sense, Channel Divinity, Lay on Hands already handled as resources
					// Aura range
					const auraRange = level >= 18 ? 30 : level >= 10 ? 10 : 0;
					if (auraRange > 0) {
						calculations.auraRange = `${auraRange} ft`;
					}
					break;
				}
				case "Fighter": {
					// Superiority dice (Battle Master) - check subclass
					if (cls.subclass?.name === "Battle Master" || cls.subclass?.shortName === "Battle Master") {
						const superiorityDice = level >= 18 ? "1d12" : level >= 10 ? "1d10" : "1d8";
						const maneuverDc = 8 + profBonus + Math.max(this.getAbilityMod("str"), this.getAbilityMod("dex")) - exhaustionPenalty;
						calculations.superiorityDie = superiorityDice;
						calculations.maneuverSaveDc = maneuverDc;
					}
					break;
				}
				case "Warlock": {
					// Eldritch Blast beams
					const beams = level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
					calculations.eldritchBlastBeams = beams;
					break;
				}
				case "Sorcerer": {
					// Metamagic - handled by resources
					break;
				}
				case "Cleric":
				case "Druid": {
					// Channel Divinity DC is spell save DC
					calculations.channelDivinityDc = this.getSpellSaveDc();
					break;
				}
				case "Bard": {
					// Bardic Inspiration die
					const inspirationDie = level >= 15 ? "1d12" : level >= 10 ? "1d10" : level >= 5 ? "1d8" : "1d6";
					calculations.bardicInspirationDie = inspirationDie;
					break;
				}
				case "Ranger": {
					// Favored Foe damage (if using Tasha's optional feature)
					const favoredFoeDamage = level >= 14 ? "1d8" : level >= 6 ? "1d6" : "1d4";
					calculations.favoredFoeDamage = favoredFoeDamage;
					break;
				}
			}
		});

		// Combat Methods DC (Thelemar homebrew)
		if (this.usesCombatSystem?.()) {
			// Combat Method DC: 8 + prof + STR or DEX (whichever is used for attack)
			const strMod = this.getAbilityMod("str");
			const dexMod = this.getAbilityMod("dex");
			calculations.combatMethodDc = 8 + profBonus + Math.max(strMod, dexMod) - exhaustionPenalty;
		}

		return calculations;
	}

	/**
	 * Get a specific calculated value for display
	 * @param {string} key - The calculation key (e.g., "sneakAttack", "kiSaveDc")
	 * @returns {*} The calculated value or null
	 */
	getFeatureCalculation (key) {
		const calculations = this.getFeatureCalculations();
		return calculations[key] ?? null;
	}
	// #endregion

	// #region Inventory
	getInventory () { return [...this._data.inventory]; }

	/**
	 * Returns flattened items for display - merges item data with inventory metadata
	 */
	getItems () {
		return this._data.inventory.map(invItem => ({
			id: invItem.id,
			...invItem.item,
			quantity: invItem.quantity,
			equipped: invItem.equipped,
			attuned: invItem.attuned,
		}));
	}

	addItem (item, quantity = 1, equipped = false, attuned = false) {
		// Handle flat item structure (from inventory module)
		if (item.quantity !== undefined) {
			quantity = item.quantity;
			equipped = item.equipped || false;
			attuned = item.attuned || false;
		}

		const existing = this._data.inventory.find(
			i => i.item.name === item.name && i.item.source === item.source && !i.item._isCustom,
		);
		if (existing) {
			existing.quantity += quantity;
		} else {
			// Extract item properties, excluding wrapper properties
			const {quantity: _q, equipped: _e, attuned: _a, ...itemProps} = item;
			this._data.inventory.push({
				id: CryptUtil.uid(),
				item: {...itemProps},
				quantity,
				equipped,
				attuned,
			});
		}
	}

	removeItem (itemId) {
		this._data.inventory = this._data.inventory.filter(i => i.id !== itemId);
	}

	setItemQuantity (itemId, quantity) {
		const item = this._data.inventory.find(i => i.id === itemId);
		if (item) {
			if (quantity <= 0) {
				this.removeItem(itemId);
			} else {
				item.quantity = quantity;
			}
		}
	}

	setItemEquipped (itemId, equipped) {
		const item = this._data.inventory.find(i => i.id === itemId);
		if (item) item.equipped = equipped;
	}

	setItemAttuned (itemId, attuned) {
		const item = this._data.inventory.find(i => i.id === itemId);
		if (item) item.attuned = attuned;
	}

	setItemCharges (itemId, charges) {
		const item = this._data.inventory.find(i => i.id === itemId);
		if (item && item.item.charges) {
			item.item.chargesCurrent = Math.max(0, Math.min(charges, item.item.charges));
		}
	}

	getAttunedCount () {
		return this._data.inventory.filter(i => i.attuned).length;
	}

	/**
	 * Get maximum number of items a character can attune to.
	 * Base is 3, but Artificer gets more:
	 * - Level 10 (Magic Item Adept): 4 items
	 * - Level 14 (Magic Item Savant): 5 items
	 * - Level 18 (Soul of Artifice): 6 items
	 * @returns {number} Maximum attunement slots
	 */
	getMaxAttunement () {
		let max = 3; // Default max attunement

		// Check for Artificer class levels
		const artificerClass = this._data.classes?.find(c => c.name?.toLowerCase() === "artificer");
		if (artificerClass) {
			const level = artificerClass.level || 0;
			if (level >= 18) {
				max = 6; // Soul of Artifice
			} else if (level >= 14) {
				max = 5; // Magic Item Savant
			} else if (level >= 10) {
				max = 4; // Magic Item Adept
			}
		}

		return max;
	}

	getTotalWeight () {
		return this._data.inventory.reduce((sum, i) => {
			const weight = i.item.weight || 0;
			return sum + (weight * i.quantity);
		}, 0);
	}

	getCarryingCapacity () {
		const baseCapacity = this.getAbilityScore("str") * 15;
		const flatBonus = this._data.customModifiers.carryCapacity || 0;
		const multiplier = this._data.customModifiers.carryCapacityMultiplier || 1;
		return (baseCapacity + flatBonus) * multiplier;
	}
	// #endregion

	// #region Currency
	/**
	 * Get currency - if type is provided returns that amount, otherwise returns the whole object
	 */
	getCurrency (type) {
		if (type === undefined) return {...this._data.currency};
		return this._data.currency[type] || 0;
	}
	setCurrency (type, amount) { this._data.currency[type] = Math.max(0, amount); }

	getTotalGold () {
		return (
			this._data.currency.pp * 10 +
			this._data.currency.gp +
			this._data.currency.ep * 0.5 +
			this._data.currency.sp * 0.1 +
			this._data.currency.cp * 0.01
		);
	}
	// #endregion

	// #region Attacks
	getAttacks () { return [...this._data.attacks]; }

	addAttack (attack) {
		this._data.attacks.push({
			...attack,
			id: attack.id || CryptUtil.uid(),
		});
	}

	updateAttack (attack) {
		const idx = this._data.attacks.findIndex(a => a.id === attack.id);
		if (idx >= 0) {
			this._data.attacks[idx] = {...attack};
		}
	}

	removeAttack (attackId) {
		this._data.attacks = this._data.attacks.filter(a => a.id !== attackId);
	}

	updateAttackFromWeapon (item) {
		// Calculate attack bonus and damage for a weapon
		const isFinesse = item.property?.includes("F");
		const isRanged = item.type === "R" || item.property?.includes("T");

		let abilityMod;
		if (isFinesse) {
			abilityMod = Math.max(this.getAbilityMod("str"), this.getAbilityMod("dex"));
		} else if (isRanged) {
			abilityMod = this.getAbilityMod("dex");
		} else {
			abilityMod = this.getAbilityMod("str");
		}

		const profBonus = this._isWeaponProficient(item) ? this.getProficiencyBonus() : 0;
		const attackBonus = abilityMod + profBonus + (this._data.customModifiers.attackBonus || 0);

		const damageDie = item.dmg1 || "1d4";
		const damageBonus = abilityMod + (this._data.customModifiers.damageBonus || 0);
		const damage = `${damageDie}${damageBonus >= 0 ? "+" : ""}${damageBonus}`;

		return {
			name: item.name,
			attackBonus,
			damage,
			damageType: item.dmgType || "bludgeoning",
			range: item.range || (isRanged ? "80/320 ft." : "5 ft."),
			properties: item.property || [],
		};
	}

	_isWeaponProficient (weapon) {
		// Check simple/martial proficiency
		if (weapon.weaponCategory === "simple" && this._data.weaponProficiencies.includes("simple")) {
			return true;
		}
		if (weapon.weaponCategory === "martial" && this._data.weaponProficiencies.includes("martial")) {
			return true;
		}
		// Check specific weapon proficiency
		return this._data.weaponProficiencies.some(
			p => p.toLowerCase() === weapon.name?.toLowerCase(),
		);
	}
	// #endregion

	// #region Conditions
	getConditions () { return [...this._data.conditions]; }

	/**
	 * Add a condition and apply its effects
	 * @param {string} condition - The condition name
	 */
	addCondition (condition) {
		if (!this._data.conditions.includes(condition)) {
			this._data.conditions.push(condition);
			this._applyConditionEffects(condition);
		}
	}

	/**
	 * Remove a condition and its effects
	 * @param {string} condition - The condition name
	 */
	removeCondition (condition) {
		this._data.conditions = this._data.conditions.filter(c => c !== condition);
		this._removeConditionEffects(condition);
	}

	clearConditions () {
		// Remove all condition effects first
		for (const condition of this._data.conditions) {
			this._removeConditionEffects(condition);
		}
		this._data.conditions = [];
	}

	setConditions (conditions) {
		// Remove old condition effects
		for (const condition of this._data.conditions) {
			if (!conditions.includes(condition)) {
				this._removeConditionEffects(condition);
			}
		}
		// Add new condition effects
		for (const condition of conditions) {
			if (!this._data.conditions.includes(condition)) {
				this._applyConditionEffects(condition);
			}
		}
		this._data.conditions = [...conditions];
	}

	/**
	 * Check if character has a specific condition
	 * @param {string} condition - The condition name
	 * @returns {boolean}
	 */
	hasCondition (condition) {
		const condKey = condition.toLowerCase();
		return this._data.conditions.some(c => c.toLowerCase() === condKey);
	}

	/**
	 * Apply effects for a condition by creating an active state
	 * @param {string} condition - The condition name
	 */
	_applyConditionEffects (condition) {
		const condDef = CharacterSheetState.getConditionEffects(condition);
		if (!condDef) {
			// Unknown condition - just track it without effects
			console.log(`Unknown condition "${condition}" - no effects defined`);
			return;
		}

		// Create an active state for this condition
		const condKey = `condition_${condition.toLowerCase().replace(/\s+/g, "_")}`;
		
		// Add to active states with the condition's effects
		const state = {
			id: `${condKey}_${Date.now()}`,
			stateTypeId: condKey,
			name: condDef.name || condition,
			icon: condDef.icon || "❓",
			active: true,
			activatedAt: Date.now(),
			isCondition: true, // Mark as condition-derived state
			conditionName: condition,
			customEffects: condDef.effects,
		};

		this._data.activeStates.push(state);
	}

	/**
	 * Remove effects for a condition by deactivating its active state
	 * @param {string} condition - The condition name
	 */
	_removeConditionEffects (condition) {
		// Find and remove the active state for this condition
		const condKey = condition.toLowerCase().replace(/\s+/g, "_");
		const stateIndex = this._data.activeStates.findIndex(
			s => s.isCondition && s.conditionName?.toLowerCase().replace(/\s+/g, "_") === condKey
		);
		if (stateIndex !== -1) {
			this._data.activeStates.splice(stateIndex, 1);
		}
	}

	/**
	 * Get all condition-based active states
	 * @returns {Array} Array of condition states
	 */
	getConditionStates () {
		return this._data.activeStates.filter(s => s.isCondition);
	}

	/**
	 * Check if character has a condition effect that auto-fails a check type
	 * @param {string} checkType - The check type (e.g., "save:str", "check:sight")
	 * @returns {boolean}
	 */
	hasAutoFailFromConditions (checkType) {
		const effects = this.getActiveStateEffects();
		return effects.some(e => e.type === "autoFail" && e.target === checkType);
	}

	/**
	 * Check if character is incapacitated from conditions
	 * @returns {boolean}
	 */
	isIncapacitated () {
		const effects = this.getActiveStateEffects();
		return effects.some(e => e.type === "incapacitated" && e.value);
	}

	/**
	 * Get speed modifier from conditions (0 if speed is set to 0, otherwise 1)
	 * @returns {number} Speed multiplier (0 or 1, or fractional for slowed)
	 */
	getSpeedMultiplierFromConditions () {
		const effects = this.getActiveStateEffects();
		
		// Check if speed is set to 0 by any condition
		const speedZero = effects.some(e => e.type === "setSpeed" && e.value === 0);
		if (speedZero) return 0;
		
		// Check for speed multiplier effects (like Slowed)
		let multiplier = 1;
		effects.filter(e => e.type === "speedMultiplier").forEach(e => {
			multiplier *= e.value;
		});
		
		return multiplier;
	}

	// #endregion

	// #region Exhaustion
	getExhaustion () { return this._data.exhaustion || 0; }

	/**
	 * Get the maximum exhaustion level before death based on rules
	 * @returns {number} Maximum exhaustion (6 for 2014/2024, 10 for Thelemar)
	 */
	getMaxExhaustion () {
		const rules = this.getExhaustionRules();
		return rules === "thelemar" ? 10 : 6;
	}

	setExhaustion (level) {
		const max = this.getMaxExhaustion();
		this._data.exhaustion = Math.max(0, Math.min(max, level));
	}

	addExhaustion (amount = 1) {
		const max = this.getMaxExhaustion();
		this._data.exhaustion = Math.min(max, (this._data.exhaustion || 0) + amount);
	}

	removeExhaustion (amount = 1) {
		this._data.exhaustion = Math.max(0, (this._data.exhaustion || 0) - amount);
	}
	// #endregion

	// #region Settings
	getSettings () {
		return this._data.settings || {exhaustionRules: "2024"};
	}

	setSetting (key, value) {
		if (!this._data.settings) this._data.settings = {exhaustionRules: "2024", allowedSources: null};
		this._data.settings[key] = value;
	}

	getExhaustionRules () {
		return this._data.settings?.exhaustionRules || "2024";
	}

	setExhaustionRules (rules) {
		if (!this._data.settings) this._data.settings = {exhaustionRules: "2024", allowedSources: null};
		this._data.settings.exhaustionRules = rules;
		// Clamp current exhaustion to new max when switching rules
		const max = this.getMaxExhaustion();
		if (this._data.exhaustion > max) {
			this._data.exhaustion = max;
		}
	}

	/**
	 * Get exhaustion penalty for DCs (spell save DC, etc.)
	 * Only applies in Thelemar rules (-1 per level)
	 * @returns {number} Penalty to subtract from DCs
	 */
	_getExhaustionDcPenalty () {
		const exhaustion = this.getExhaustion();
		const rules = this.getExhaustionRules();
		if (rules === "thelemar") {
			return exhaustion; // -1 per level in Thelemar rules
		}
		return 0;
	}

	// Source filtering
	getAllowedSources () {
		return this._data.settings?.allowedSources || null; // null means all sources allowed
	}

	setAllowedSources (sources) {
		if (!this._data.settings) this._data.settings = {exhaustionRules: "2024", allowedSources: null};
		this._data.settings.allowedSources = sources?.length ? sources : null;
	}

	isSourceAllowed (source) {
		const allowed = this.getAllowedSources();
		if (!allowed) return true; // null/empty = all sources allowed
		return allowed.includes(source);
	}
	// #endregion

	// #region Resources
	getResources () { return [...this._data.resources]; }

	addResource (resource) {
		this._data.resources.push({
			id: CryptUtil.uid(),
			current: resource.max,
			...resource,
		});
	}

	setResourceCurrent (resourceId, current) {
		const resource = this._data.resources.find(r => r.id === resourceId);
		if (resource) {
			resource.current = Math.max(0, Math.min(current, resource.max));
		}
	}

	recoverResources (rechargeType) {
		this._data.resources.forEach(r => {
			if (r.recharge === rechargeType || (rechargeType === "long" && r.recharge === "short")) {
				r.current = r.max;
			}
		});
	}

	/**
	 * Recalculate resource maximums based on current ability scores and level
	 * Called when ability scores change or on level up
	 */
	recalculateResourceMaximums () {
		const features = this.getFeatures();
		const feats = this.getFeats();

		// Recalculate for each feature with uses
		[...features, ...feats].forEach(item => {
			if (!item.description) return;

			const getAbilityMod = (ability) => this.getAbilityMod(ability);
			const getProfBonus = () => this.getProficiencyBonus();
			const newUses = FeatureUsesParser.parseUses(item.description, getAbilityMod, getProfBonus);

			if (newUses) {
				// Update feature/feat uses
				const dataItem = item.featureType 
					? this._data.features.find(f => f.id === item.id)
					: this._data.feats.find(f => f.id === item.id);

				if (dataItem?.uses && dataItem.uses.max !== newUses.max) {
					const diff = newUses.max - dataItem.uses.max;
					dataItem.uses.max = newUses.max;
					// Increase current if max increased (don't decrease)
					if (diff > 0) {
						dataItem.uses.current = Math.min(dataItem.uses.current + diff, newUses.max);
					}
				}

				// Update associated resource
				const resource = this._data.resources.find(r => r.name === item.name);
				if (resource && resource.max !== newUses.max) {
					const diff = newUses.max - resource.max;
					resource.max = newUses.max;
					if (diff > 0) {
						resource.current = Math.min(resource.current + diff, newUses.max);
					}
				}
			}
		});
	}
	// #endregion

	// #region Features
	getFeatures () {
		return this._data.features.map(f => ({
			...f,
			id: f.id || CryptUtil.uid(),
		}));
	}

	addFeature (feature) {
		// Deduplicate: don't add if feature with same name, source, and className/level combo exists
		const isDuplicate = this._data.features.some(f => {
			if (f.name !== feature.name) return false;
			if (f.source !== feature.source) return false;
			// For class features, also check className and level
			if (feature.className) {
				if (f.className !== feature.className) return false;
				if (f.level !== feature.level) return false;
			}
			return true;
		});

		if (isDuplicate) {
			console.log("[CharSheet State] Skipping duplicate feature:", feature.name);
			return;
		}

		// Auto-extract uses from feature description if not already provided
		// Skip use detection for meta-features that describe resource systems rather than having their own uses
		const isMetaFeature = this._isResourceSystemFeature(feature);
		let uses = feature.uses;
		if (!uses && feature.description && !isMetaFeature) {
			const getAbilityMod = (ability) => this.getAbilityMod(ability);
			const getProfBonus = () => this.getProficiencyBonus();
			uses = FeatureUsesParser.parseUses(feature.description, getAbilityMod, getProfBonus);
			if (uses) {
				console.log(`[CharSheet State] Auto-detected uses for "${feature.name}":`, uses);
			}
		}

		const featureData = {
			id: CryptUtil.uid(),
			...feature,
		};

		// Add uses if detected
		if (uses) {
			featureData.uses = {
				current: uses.max,
				max: uses.max,
				recharge: uses.recharge,
			};
		}

		this._data.features.push(featureData);

		// Also add to resources section for easy tracking
		if (uses && uses.max > 0) {
			// Check if resource already exists
			const existingResource = this._data.resources.find(r => r.name === feature.name);
			if (!existingResource) {
				this.addResource({
					name: feature.name,
					max: uses.max,
					recharge: uses.recharge,
					featureId: featureData.id, // Link to feature
				});
				console.log(`[CharSheet State] Auto-added resource for "${feature.name}":`, uses);
			}
		}

		// Check if this feature grants a natural weapon and auto-add as attack
		if (feature.description && NaturalWeaponParser.isNaturalWeapon(feature.description)) {
			const naturalWeapon = NaturalWeaponParser.parseNaturalWeapon(feature.description, feature.name);
			if (naturalWeapon) {
				// Check if attack already exists
				const existingAttack = this._data.attacks.find(a => 
					a.name === naturalWeapon.name || a.sourceFeature === feature.name,
				);
				if (!existingAttack) {
					this.addAttack({
						...naturalWeapon,
						featureId: featureData.id, // Link to feature for cleanup
					});
					console.log(`[CharSheet State] Auto-added natural weapon attack for "${feature.name}":`, naturalWeapon);
				}
			}
		}

		// Check if this feature grants spells (innate or known)
		this._processFeatureSpells(feature, featureData.id);

		// Check if this feature grants modifiers to rolls, AC, etc.
		this._processFeatureModifiers(feature, featureData.id);
	}

	/**
	 * Check if a feature is a "meta-feature" that describes a resource system
	 * (like Combat Methods, Ki, etc.) or grants spells with their own uses,
	 * rather than having its own uses.
	 * These should not have uses auto-detected from their description.
	 * @param {object} feature - Feature data
	 * @returns {boolean} True if this is a resource system description feature
	 */
	_isResourceSystemFeature (feature) {
		const name = feature.name?.toLowerCase() || "";
		
		// Features that describe resource systems (exertion, ki, etc.)
		// These mention "short rest" or "long rest" but the rest is for the resource, not the feature itself
		const resourceSystemFeatures = [
			"combat methods",      // Thelemar homebrew - describes exertion system
			"ki",                  // Monk - describes ki points
			"focus points",        // Some homebrew - describes focus point system
			"exertion",            // Thelemar homebrew - the exertion pool itself
			"sorcery points",      // Sorcerer - describes sorcery point system
			"superiority dice",    // Battle Master - describes superiority dice
			"psionic power",       // Psi features - describes psionic power dice
		];

		// Check if the feature name matches any resource system feature
		if (resourceSystemFeatures.some(rsf => name.includes(rsf))) {
			return true;
		}

		// Racial/subclass features that grant spells with uses - the feature itself isn't usable
		// Examples: "Elven Lineage" (choose lineage, get spells), "Infernal Legacy", etc.
		// These are NOT the same as features like "Healing Hands" which IS an action you take
		const spellGrantingFeatureNames = [
			"lineage",             // Elven Lineage, Drow Lineage, etc. - grants spells at levels
			"legacy",              // Infernal Legacy, Abyssal Legacy, etc. - grants spells
			"innate spellcasting", // General innate spellcasting trait
		];
		
		if (spellGrantingFeatureNames.some(sgf => name.includes(sgf))) {
			return true;
		}

		if (feature.description) {
			const desc = feature.description.toLowerCase();
			
			// If it talks about spending exertion, it's using the exertion system, not its own uses
			if (/spend(?:ing)?\s+(?:\d+\s+)?exertion/i.test(desc) && 
				/(?:recover|regain|refresh).*exertion.*(?:short|long)\s*rest/i.test(desc)) {
				return true;
			}

			// Features that grant spells at multiple character levels (like Elven Lineage, Infernal Legacy)
			// Pattern: "When you reach character level X" or "at Xth level, you learn/gain"
			// These grant spells at progression, not abilities you activate
			if (/when you reach (?:character )?level|at \d+(?:st|nd|rd|th) level/i.test(desc) && 
				/learn|gain|know.*(?:spell|cantrip)/i.test(desc) &&
				/cast.*(?:once|without a spell slot)/i.test(desc)) {
				return true;
			}

			// Features where the primary purpose is granting a spell list (not an action)
			// Pattern: "Starting at X level, you can cast the [spell] spell"
			// Combined with "you can also cast the spell using any spell slots" (indicates it's a spell grant)
			if (/starting at \d+(?:st|nd|rd|th) level.*you can cast/i.test(desc) &&
				/cast.*using any spell slots/i.test(desc)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Process modifiers granted by a feature (AC bonuses, save bonuses, etc.)
	 * @param {object} feature - Feature data
	 * @param {string} featureId - ID of the feature in state
	 */
	_processFeatureModifiers (feature, featureId) {
		if (!feature.description) {
			console.log(`[CharSheet State] Feature "${feature.name}" has no description, skipping modifier parsing`);
			return;
		}

		console.log(`[CharSheet State] Parsing modifiers for "${feature.name}", description length: ${feature.description.length}`);
		const modifiers = FeatureModifierParser.parseModifiers(feature.description, feature.name);
		console.log(`[CharSheet State] Found ${modifiers.length} modifiers for "${feature.name}":`, modifiers.map(m => m.type).join(", "));
		if (!modifiers.length) return;

		// Determine feature type for special handling
		const isRacialFeature = feature.featureType === "Species" || feature.featureType === "Subrace" || 
			feature.featureType === "Race" || feature.featureType === "Racial";

		modifiers.forEach(mod => {
			// ===================
			// Handle Proficiency Grants
			// ===================
			if (mod.isProficiency && mod.type.startsWith("proficiency:")) {
				const parts = mod.type.split(":");
				const profType = parts[1]; // skill, save, armor, weapon, tool
				const profTarget = parts[2]; // skillname, ability, armortype, weaponname, toolname

				if (profType === "skill") {
					const currentLevel = this.getSkillProficiency(profTarget);
					if (mod.value > currentLevel) {
						this.setSkillProficiency(profTarget, mod.value);
						console.log(`[CharSheet State] Set ${profTarget} proficiency to ${mod.value === 2 ? "expertise" : "proficient"} from "${feature.name}"`);
					}
				} else if (profType === "save") {
					if (!this._data.saveProficiencies.includes(profTarget)) {
						this.addSaveProficiency(profTarget);
						console.log(`[CharSheet State] Added ${profTarget} save proficiency from "${feature.name}"`);
					}
				} else if (profType === "armor") {
					const armorName = profTarget.replace(/armor/gi, " armor").replace(/shields/gi, "shields").trim().toTitleCase();
					if (!this._data.armorProficiencies.some(a => a.toLowerCase() === armorName.toLowerCase())) {
						this.addArmorProficiency(armorName);
						console.log(`[CharSheet State] Added ${armorName} proficiency from "${feature.name}"`);
					}
				} else if (profType === "weapon") {
					const weaponName = profTarget.replace(/weapons/gi, " weapons").trim().toTitleCase();
					if (!this._data.weaponProficiencies.some(w => w.toLowerCase() === weaponName.toLowerCase())) {
						this.addWeaponProficiency(weaponName);
						console.log(`[CharSheet State] Added ${weaponName} proficiency from "${feature.name}"`);
					}
				} else if (profType === "tool") {
					const toolName = profTarget.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/tools/gi, " tools").replace(/kit/gi, " kit").trim().toTitleCase();
					if (!this._data.toolProficiencies.some(t => t.toLowerCase().includes(profTarget.toLowerCase().substring(0, 6)))) {
						this.addToolProficiency(toolName);
						console.log(`[CharSheet State] Added ${toolName} proficiency from "${feature.name}"`);
					}
				}
				return; // Don't create a named modifier for proficiency grants
			}

			// ===================
			// Handle AC Formulas (Natural Armor, Unarmored Defense)
			// ===================
			if (mod.type === "acFormula" && mod.acFormula) {
				// Store AC formula for use in getAc()
				if (!this._data.acFormulas) this._data.acFormulas = [];
				this._data.acFormulas.push({
					...mod.acFormula,
					sourceName: feature.name,
					sourceFeatureId: featureId,
					conditional: mod.conditional,
					featureType: feature.featureType,
				});
				console.log(`[CharSheet State] Added AC formula from "${feature.name}": base ${mod.acFormula.base}${mod.acFormula.addDex ? " + DEX" : ""}${mod.acFormula.secondAbility ? ` + ${mod.acFormula.secondAbility.toUpperCase()}` : ""}`);
				return; // Don't create a named modifier for AC formulas
			}

			// Special handling: Senses that set a value (from any source - racial or class features)
			// e.g., "You gain darkvision with a range of 60 feet" from Clearsight Sentinel
			if (mod.type.startsWith("sense:") && mod.setValue) {
				const senseType = mod.type.split(":")[1];
				const currentValue = this._data.senses?.[senseType] || 0;
				if (mod.value > currentValue) {
					this.setSense(senseType, mod.value);
					console.log(`[CharSheet State] Set base ${senseType} to ${mod.value} from "${feature.name}"`);
				}
				return; // Don't create a named modifier for senses that set values
			}

			// Special handling: Racial/species speed bonuses should modify base speed, not create modifiers
			// (This is for text like "Your speed is 35 feet" - absolute values from race)
			// But increases/decreases should still be modifiers
			if (isRacialFeature && mod.type.startsWith("speed:") && mod.setValue) {
				const speedType = mod.type.split(":")[1];
				this.setSpeed(speedType, mod.value);
				console.log(`[CharSheet State] Set base ${speedType} speed to ${mod.value} from "${feature.name}"`);
				return; // Don't create a named modifier for racial base speed
			}

			// Special handling: Speed equal to walking speed (e.g., "swimming speed equal to your walking speed")
			// Store as a special modifier that links to walking speed
			if (mod.type.startsWith("speed:") && mod.equalToWalk) {
				const speedType = mod.type.split(":")[1];
				const walkSpeed = this.getWalkSpeed();
				// Set this speed type to match walking speed
				this.setSpeed(speedType, walkSpeed);
				console.log(`[CharSheet State] Set ${speedType} speed equal to walking speed (${walkSpeed}) from "${feature.name}"`);
				// Also store as named modifier so it updates when walking speed changes
				const modifierData = {
					name: feature.name,
					type: mod.type,
					value: 0,
					note: `From ${feature.name} - equals walking speed`,
					enabled: true,
					sourceFeatureId: featureId,
					equalToWalk: true,
				};
				this.addNamedModifier(modifierData);
				return;
			}

			// Build modifier name
			let modName = feature.name;
			if (mod.conditional) {
				modName = `${feature.name}: ${mod.conditional}`;
			}

			// Format value for display
			let displayValue = mod.value;
			if (mod.setValue) {
				displayValue = `= ${mod.value}`; // e.g., "= 60" for darkvision
			} else if (mod.multiplier) {
				displayValue = `×${mod.multiplier}`; // e.g., "×2" for doubled carry capacity
			} else if (mod.perLevel) {
				displayValue = `${mod.value > 0 ? "+" : ""}${mod.value}/level`;
			} else if (mod.sizeIncrease) {
				displayValue = "+1 size";
			} else if (mod.advantage) {
				displayValue = "Advantage";
			} else if (mod.removeDisadvantage) {
				displayValue = "Remove disadvantage";
			} else if (mod.proficiencyBonus) {
				displayValue = "+Prof";
			} else if (mod.ignore) {
				displayValue = "Ignore";
			}

			// Build note
			let note = `From ${feature.name}`;
			if (mod.conditional) note += ` - ${mod.conditional}`;
			if (mod.perLevel) note += " (per character level)";
			if (mod.setValue) note += " (sets value)";
			if (mod.advantage) note += " (grants advantage)";
			if (mod.removeDisadvantage) note += " (removes disadvantage)";
			if (mod.proficiencyBonus) note += " (adds proficiency bonus)";
			if (mod.ignore) note += " (ignores)";

			const modifierData = {
				name: modName,
				type: mod.type,
				value: mod.value,
				note,
				enabled: !mod.conditional, // Conditional modifiers start disabled
				sourceFeatureId: featureId,
			};

			// Preserve special properties for calculations
			if (mod.setValue) modifierData.setValue = true;
			if (mod.perLevel) modifierData.perLevel = true;
			if (mod.multiplier) modifierData.multiplier = mod.multiplier;
			if (mod.sizeIncrease) modifierData.sizeIncrease = true;
			if (mod.abilityMod) modifierData.abilityMod = mod.abilityMod;
			if (mod.advantage) modifierData.advantage = true;
			if (mod.removeDisadvantage) modifierData.removeDisadvantage = true;
			if (mod.proficiencyBonus) modifierData.proficiencyBonus = true;
			if (mod.ignore) modifierData.ignore = true;

			this.addNamedModifier(modifierData);

			const valueStr = mod.setValue ? `=${mod.value}` : (mod.value >= 0 ? `+${mod.value}` : `${mod.value}`);
			console.log(`[CharSheet State] ${mod.conditional ? "Conditional" : "Auto-added"} modifier from "${feature.name}": ${mod.type} ${valueStr}${mod.conditional ? ` (${mod.conditional})` : ""}`);
		});
	}

	/**
	 * Process spells granted by a feature
	 * @param {object} feature - Feature data (may have additionalSpells property or description)
	 * @param {string} featureId - ID of the feature in state
	 */
	_processFeatureSpells (feature, featureId) {
		let spells = [];

		// First try structured additionalSpells data (from official content)
		if (feature.additionalSpells) {
			spells = SpellGrantParser.parseAdditionalSpells(feature.additionalSpells, feature.name);
		} 
		// Fall back to parsing from description (for homebrew or missing data)
		else if (feature.description && SpellGrantParser.grantsSpells(feature.description)) {
			spells = SpellGrantParser.parseSpellsFromText(feature.description, feature.name);
		}

		if (!spells.length) return;

		spells.forEach(spell => {
			// Skip choice-required spells (would need UI for selection)
			if (spell.requiresChoice) {
				console.log(`[CharSheet State] Spell choice required for "${feature.name}":`, spell.choiceFilter);
				// Could add to a pending choices list for UI
				return;
			}

			// Add as innate spell if marked as such
			if (spell.innate) {
				this.addInnateSpell({
					name: spell.name,
					source: spell.source,
					level: spell.level,
					atWill: spell.atWill,
					uses: spell.uses,
					recharge: spell.recharge || "long",
					sourceFeature: feature.name,
				});
			} 
			// Otherwise add as known spell
			else {
				this.addSpell({
					name: spell.name,
					source: spell.source,
					level: spell.level || 1,
					prepared: spell.prepared,
				});
			}
		});

		console.log(`[CharSheet State] Processed ${spells.length} spells from "${feature.name}"`);
	}

	removeFeature (featureIdOrName, source) {
		// Find the feature first to get its id
		const feature = this._data.features.find(f => 
			f.id === featureIdOrName || (f.name === featureIdOrName && f.source === source),
		);

		// Remove associated resource if it was auto-added
		if (feature) {
			this._data.resources = this._data.resources.filter(r => r.featureId !== feature.id && r.name !== feature.name);
			// Remove associated attack if it was auto-added (natural weapon)
			this._data.attacks = this._data.attacks.filter(a => a.featureId !== feature.id && a.sourceFeature !== feature.name);
			// Remove associated innate spells
			this.removeInnateSpellsByFeature(feature.name);
			// Remove associated modifiers
			this.removeModifiersByFeature(feature.id);
		}

		// Remove the feature
		this._data.features = this._data.features.filter(f => {
			if (f.id === featureIdOrName) return false;
			if (f.name === featureIdOrName && f.source === source) return false;
			return true;
		});
	}

	setFeatureUses (featureId, current) {
		const feature = this._data.features.find(f => f.id === featureId);
		if (feature?.uses) {
			feature.uses.current = current;
		}
	}

	getFeats () {
		return this._data.feats.map(f => ({
			...f,
			id: f.id || `${f.name}|${f.source}`,
		}));
	}

	addFeat (feat) {
		if (!this._data.feats.find(f => f.name === feat.name && f.source === feat.source)) {
			// Auto-extract uses from feat description
			let uses = feat.uses;
			if (!uses && feat.description) {
				const getAbilityMod = (ability) => this.getAbilityMod(ability);
				const getProfBonus = () => this.getProficiencyBonus();
				uses = FeatureUsesParser.parseUses(feat.description, getAbilityMod, getProfBonus);
				if (uses) {
					console.log(`[CharSheet State] Auto-detected uses for feat "${feat.name}":`, uses);
				}
			}

			const featData = {
				id: CryptUtil.uid(),
				name: feat.name,
				source: feat.source,
				description: feat.description,
				additionalSpells: feat.additionalSpells, // Preserve for spell processing
			};

			// Add uses if detected
			if (uses) {
				featData.uses = {
					current: uses.max,
					max: uses.max,
					recharge: uses.recharge,
				};

				// Also add to resources section
				const existingResource = this._data.resources.find(r => r.name === feat.name);
				if (!existingResource) {
					this.addResource({
						name: feat.name,
						max: uses.max,
						recharge: uses.recharge,
						featId: featData.id,
					});
					console.log(`[CharSheet State] Auto-added resource for feat "${feat.name}":`, uses);
				}
			}

			this._data.feats.push(featData);

			// Process spells granted by this feat
			this._processFeatureSpells(featData, featData.id);

			// Process modifiers granted by this feat
			this._processFeatureModifiers(featData, featData.id);
		}
	}

	removeFeat (featIdOrName, source) {
		// Find the feat first to get its id
		const feat = this._data.feats.find(f => 
			f.id === featIdOrName || (f.name === featIdOrName && f.source === source),
		);

		// Remove associated resource if it was auto-added
		if (feat) {
			this._data.resources = this._data.resources.filter(r => r.featId !== feat.id && r.name !== feat.name);
			// Remove associated innate spells
			this.removeInnateSpellsByFeature(feat.name);
			// Remove associated modifiers
			this.removeModifiersByFeature(feat.id);
		}

		// Remove the feat
		this._data.feats = this._data.feats.filter(f => {
			if (f.id === featIdOrName) return false;
			if (f.name === featIdOrName && f.source === source) return false;
			return true;
		});
	}
	// #endregion

	// #region Weapon Masteries
	/**
	 * Get list of weapon masteries (weapon keys in "name|source" format)
	 */
	getWeaponMasteries () {
		return [...(this._data.weaponMasteries || [])];
	}

	/**
	 * Set the full list of weapon masteries
	 * @param {Array<string>} masteries - Array of weapon keys like "Longsword|XPHB"
	 */
	setWeaponMasteries (masteries) {
		this._data.weaponMasteries = [...masteries];
	}

	/**
	 * Add a weapon mastery
	 * @param {string} weaponKey - Weapon key in "name|source" format
	 */
	addWeaponMastery (weaponKey) {
		if (!this._data.weaponMasteries) this._data.weaponMasteries = [];
		if (!this._data.weaponMasteries.includes(weaponKey)) {
			this._data.weaponMasteries.push(weaponKey);
		}
	}

	/**
	 * Remove a weapon mastery
	 * @param {string} weaponKey - Weapon key to remove
	 */
	removeWeaponMastery (weaponKey) {
		if (!this._data.weaponMasteries) return;
		this._data.weaponMasteries = this._data.weaponMasteries.filter(m => m !== weaponKey);
	}

	/**
	 * Check if character has mastery with a specific weapon
	 * @param {string} weaponName - Weapon name to check
	 * @param {string} weaponSource - Optional source to check
	 * @returns {boolean}
	 */
	hasWeaponMastery (weaponName, weaponSource) {
		if (!this._data.weaponMasteries?.length) return false;
		return this._data.weaponMasteries.some(m => {
			const [name, source] = m.split("|");
			if (weaponSource) {
				return name.toLowerCase() === weaponName.toLowerCase() && source === weaponSource;
			}
			return name.toLowerCase() === weaponName.toLowerCase();
		});
	}
	// #endregion

	// #region Combat Traditions (Thelemar homebrew)
	/**
	 * Get list of combat traditions the character is proficient with
	 * @returns {Array<string>} Array of tradition codes like ["AM", "RC"]
	 */
	getCombatTraditions () {
		return [...(this._data.combatTraditions || [])];
	}

	/**
	 * Set the full list of combat traditions
	 * @param {Array<string>} traditions - Array of tradition codes like ["AM", "RC"]
	 */
	setCombatTraditions (traditions) {
		this._data.combatTraditions = [...traditions];
	}

	/**
	 * Add a combat tradition
	 * @param {string} tradCode - Tradition code like "AM" for Adamant Mountain
	 */
	addCombatTradition (tradCode) {
		if (!this._data.combatTraditions) this._data.combatTraditions = [];
		if (!this._data.combatTraditions.includes(tradCode)) {
			this._data.combatTraditions.push(tradCode);
		}
	}

	/**
	 * Remove a combat tradition
	 * @param {string} tradCode - Tradition code to remove
	 */
	removeCombatTradition (tradCode) {
		if (!this._data.combatTraditions) return;
		this._data.combatTraditions = this._data.combatTraditions.filter(t => t !== tradCode);
	}

	/**
	 * Check if character is proficient with a specific tradition
	 * @param {string} tradCode - Tradition code to check
	 * @returns {boolean}
	 */
	hasCombatTradition (tradCode) {
		return this._data.combatTraditions?.includes(tradCode) ?? false;
	}
	// #endregion

	// #region Exertion (Combat Methods resource)
	/**
	 * Get current exertion points
	 * @returns {number}
	 */
	getExertionCurrent () {
		return this._data.exertionCurrent;
	}

	/**
	 * Set current exertion points
	 * @param {number} value
	 */
	setExertionCurrent (value) {
		this._data.exertionCurrent = Math.max(0, Math.min(value, this.getExertionMax() || Infinity));
	}

	/**
	 * Get maximum exertion points (2 × proficiency bonus)
	 * @returns {number}
	 */
	getExertionMax () {
		return this._data.exertionMax;
	}

	/**
	 * Set maximum exertion points
	 * @param {number} value
	 */
	setExertionMax (value) {
		this._data.exertionMax = value;
		// Ensure current doesn't exceed new max
		if (this._data.exertionCurrent > value) {
			this._data.exertionCurrent = value;
		}
	}

	/**
	 * Restore all exertion (e.g., on short/long rest)
	 */
	restoreExertion () {
		console.log("[CharSheet State] restoreExertion called, current exertionMax:", this._data.exertionMax);
		// Initialize exertion max if not set and character uses combat system
		this._ensureExertionInitialized();
		this._data.exertionCurrent = this._data.exertionMax || 0;
		console.log("[CharSheet State] restoreExertion completed, exertionCurrent:", this._data.exertionCurrent);
	}

	/**
	 * Check if character uses the combat methods system
	 * @returns {boolean}
	 */
	usesCombatSystem () {
		// Check for combat traditions
		if (this._data.combatTraditions?.length > 0) {
			console.log("[CharSheet State] usesCombatSystem: true (has traditions:", this._data.combatTraditions, ")");
			return true;
		}
		
		// Check for combat method features - look for any CTM: feature type
		const hasMethods = this._data.features?.some(f => {
			if (f.featureType !== "Optional Feature") return false;
			// Match any CTM feature type (CTM:1RC, CTM:RC, etc.)
			const result = f.optionalFeatureTypes?.some(ft => ft?.startsWith?.("CTM:"));
			if (result) {
				console.log("[CharSheet State] Found combat method feature:", f.name, f.optionalFeatureTypes);
			}
			return result;
		}) ?? false;
		
		console.log("[CharSheet State] usesCombatSystem:", hasMethods, "(checked", this._data.features?.length || 0, "features)");
		return hasMethods;
	}

	/**
	 * Ensure exertion pool is initialized based on proficiency bonus
	 * This is a public method that can be called from other modules
	 */
	ensureExertionInitialized () {
		if (!this.usesCombatSystem()) {
			console.log("[CharSheet State] ensureExertionInitialized: not using combat system, skipping");
			return;
		}
		
		const profBonus = this.getProficiencyBonus();
		const calculatedMax = profBonus * 2;
		
		console.log("[CharSheet State] ensureExertionInitialized: profBonus=", profBonus, "calculatedMax=", calculatedMax, "currentMax=", this._data.exertionMax);
		
		if (this._data.exertionMax !== calculatedMax) {
			this._data.exertionMax = calculatedMax;
			// If current exceeds new max, adjust it
			if ((this._data.exertionCurrent || 0) > calculatedMax) {
				this._data.exertionCurrent = calculatedMax;
			}
			// If current was 0 (never set), initialize to full
			if (!this._data.exertionCurrent) {
				this._data.exertionCurrent = calculatedMax;
			}
			console.log("[CharSheet State] Exertion initialized: current=", this._data.exertionCurrent, "max=", this._data.exertionMax);
		}
	}
	
	/**
	 * @deprecated Use ensureExertionInitialized instead
	 */
	_ensureExertionInitialized () {
		return this.ensureExertionInitialized();
	}

	/**
	 * Spend exertion points
	 * @param {number} amount - Amount to spend
	 * @returns {boolean} - True if successful, false if not enough exertion
	 */
	spendExertion (amount) {
		if ((this._data.exertionCurrent || 0) < amount) return false;
		this._data.exertionCurrent -= amount;
		return true;
	}
	// #endregion

	// #region Defenses
	getResistances () { return [...this._data.resistances]; }
	getImmunities () { return [...this._data.immunities]; }
	getVulnerabilities () { return [...this._data.vulnerabilities]; }

	addResistance (type) {
		if (!this._data.resistances.includes(type)) {
			this._data.resistances.push(type);
		}
	}

	addImmunity (type) {
		if (!this._data.immunities.includes(type)) {
			this._data.immunities.push(type);
		}
	}

	addVulnerability (type) {
		if (!this._data.vulnerabilities.includes(type)) {
			this._data.vulnerabilities.push(type);
		}
	}
	// #endregion

	// #region Notes
	getNote (field) { return this._data.notes[field] || ""; }
	setNote (field, value) { this._data.notes[field] = value; }
	// #endregion

	// #region Appearance
	getAppearance (field) { return this._data.appearance[field] || ""; }
	setAppearance (field, value) { this._data.appearance[field] = value; }
	// #endregion

	// #region Custom Modifiers
	/**
	 * Get all named modifiers
	 * @returns {Array} Array of modifier objects {id, name, type, value, note, enabled}
	 */
	getNamedModifiers () { return [...this._data.namedModifiers]; }

	/**
	 * Get enabled named modifiers of a specific type
	 * @param {string} type - The modifier type (e.g., "ac", "save:str", "skill:all")
	 * @returns {Array} Array of enabled modifier objects matching the type
	 */
	getNamedModifiersByType (type) {
		return this._data.namedModifiers.filter(m => m.enabled && m.type === type);
	}

	/**
	 * Add a named modifier
	 * @param {Object} modifier - {name, type, value, note, enabled}
	 * @returns {string} The ID of the new modifier
	 */
	addNamedModifier (modifier) {
		const id = CryptUtil.uid();
		this._data.namedModifiers.push({
			id,
			name: modifier.name || "Custom Modifier",
			type: modifier.type || "ac",
			value: modifier.value || 0,
			note: modifier.note || "",
			enabled: modifier.enabled !== false,
		});
		this._recalculateCustomModifiers();
		return id;
	}

	/**
	 * Update a named modifier
	 * @param {string} id - The modifier ID
	 * @param {Object} updates - The fields to update
	 */
	updateNamedModifier (id, updates) {
		const modifier = this._data.namedModifiers.find(m => m.id === id);
		if (modifier) {
			Object.assign(modifier, updates);
			this._recalculateCustomModifiers();
		}
	}

	/**
	 * Remove a named modifier
	 * @param {string} id - The modifier ID
	 */
	removeNamedModifier (id) {
		this._data.namedModifiers = this._data.namedModifiers.filter(m => m.id !== id);
		this._recalculateCustomModifiers();
	}

	/**
	 * Remove all named modifiers associated with a feature
	 * @param {string} featureId - The source feature ID
	 */
	removeModifiersByFeature (featureId) {
		if (!featureId) return;
		const hadModifiers = this._data.namedModifiers.some(m => m.sourceFeatureId === featureId);
		this._data.namedModifiers = this._data.namedModifiers.filter(m => m.sourceFeatureId !== featureId);
		if (hadModifiers) {
			this._recalculateCustomModifiers();
		}
	}

	/**
	 * Toggle a named modifier's enabled state
	 * @param {string} id - The modifier ID
	 * @returns {boolean} The new enabled state
	 */
	toggleNamedModifier (id) {
		const modifier = this._data.namedModifiers.find(m => m.id === id);
		if (modifier) {
			modifier.enabled = !modifier.enabled;
			this._recalculateCustomModifiers();
			return modifier.enabled;
		}
		return false;
	}

	/**
	 * Recalculate the quick-access customModifiers totals from named modifiers
	 * This updates the cached totals used by getSaveMod, getSkillMod, getAc, etc.
	 */
	_recalculateCustomModifiers () {
		// Reset totals
		const cm = this._data.customModifiers;
		cm.ac = 0;
		cm.initiative = 0;
		cm.speed = {walk: 0, fly: 0, swim: 0, climb: 0, burrow: 0};
		cm.attackBonus = 0;
		cm.damageBonus = 0;
		cm.spellDc = 0;
		cm.spellAttack = 0;
		cm.savingThrows = {};
		cm.skills = {};
		cm.abilityChecks = {};
		cm.abilityScores = {};
		cm.hp = 0;
		cm.hpPerLevel = 0;
		cm.proficiencyBonus = 0;
		cm.senses = {darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0};
		cm.carryCapacity = 0;
		cm.carryCapacityMultiplier = 1;

		// Sum up enabled modifiers
		this._data.namedModifiers.forEach(mod => {
			if (!mod.enabled) return;
			
			let value = mod.value || 0;
			
			// Handle per-level modifiers
			if (mod.perLevel) {
				const totalLevel = this.getTotalLevel() || 1;
				value = value * totalLevel;
			}

			switch (mod.type) {
				case "ac": cm.ac += value; break;
				case "initiative": cm.initiative += value; break;
				case "attack": cm.attackBonus += value; break;
				case "damage": cm.damageBonus += value; break;
				case "spellDc": cm.spellDc += value; break;
				case "spellAttack": cm.spellAttack += value; break;
				case "hp": 
					if (mod.perLevel) {
						cm.hpPerLevel += mod.value || 0;
					} else {
						cm.hp += value;
					}
					break;
				case "proficiencyBonus": cm.proficiencyBonus += value; break;
				case "carryCapacity":
					if (mod.multiplier) {
						cm.carryCapacityMultiplier *= mod.multiplier;
					} else if (mod.sizeIncrease) {
						cm.carryCapacityMultiplier *= 2; // Each size category doubles capacity
					} else {
						cm.carryCapacity += value;
					}
					break;
				case "save:all":
					Parser.ABIL_ABVS.forEach(abl => {
						cm.savingThrows[abl] = (cm.savingThrows[abl] || 0) + value;
					});
					break;
				case "check:all":
					Parser.ABIL_ABVS.forEach(abl => {
						cm.abilityChecks[abl] = (cm.abilityChecks[abl] || 0) + value;
					});
					// Also apply to initiative (it's a DEX check)
					cm.initiative += value;
					break;
				default:
					// Handle save:str, save:dex, etc.
					if (mod.type.startsWith("save:")) {
						const abl = mod.type.split(":")[1];
						cm.savingThrows[abl] = (cm.savingThrows[abl] || 0) + value;
					}
					// Handle check:str, check:dex, etc.
					else if (mod.type.startsWith("check:")) {
						const abl = mod.type.split(":")[1];
						cm.abilityChecks[abl] = (cm.abilityChecks[abl] || 0) + value;
						// DEX checks include initiative
						if (abl === "dex") cm.initiative += value;
					}
					// Handle skill:stealth, skill:athletics, etc.
					else if (mod.type.startsWith("skill:")) {
						const skill = mod.type.split(":")[1];
						if (skill === "all") {
							cm.skills["_all"] = (cm.skills["_all"] || 0) + value;
						} else {
							cm.skills[skill] = (cm.skills[skill] || 0) + value;
						}
					}
					// Handle speed:walk, speed:fly, etc.
					else if (mod.type.startsWith("speed:")) {
						const speedType = mod.type.split(":")[1];
						if (cm.speed[speedType] !== undefined) {
							cm.speed[speedType] += value;
						}
					}
					// Handle ability:str, ability:dex, etc.
					else if (mod.type.startsWith("ability:")) {
						const abl = mod.type.split(":")[1];
						cm.abilityScores[abl] = (cm.abilityScores[abl] || 0) + value;
					}
					// Handle sense:darkvision, sense:blindsight, etc.
					else if (mod.type.startsWith("sense:")) {
						const sense = mod.type.split(":")[1];
						if (cm.senses[sense] !== undefined) {
							if (mod.setValue) {
								// Set value takes the maximum
								cm.senses[sense] = Math.max(cm.senses[sense], value);
							} else {
								cm.senses[sense] += value;
							}
						}
					}
					break;
			}
		});
	}

	/**
	 * Get custom modifier for a specific skill (includes "all skills" bonus)
	 * @param {string} skill - The skill key
	 * @returns {number} The total custom modifier
	 */
	getSkillCustomMod (skill) {
		const specific = this._data.customModifiers.skills[skill] || 0;
		const all = this._data.customModifiers.skills["_all"] || 0;
		return specific + all;
	}

	/**
	 * Get custom modifier for a specific ability check (includes "all checks" bonus)
	 * @param {string} ability - The ability abbreviation
	 * @returns {number} The total custom modifier
	 */
	getAbilityCheckCustomMod (ability) {
		return this._data.customModifiers.abilityChecks[ability] || 0;
	}

	/**
	 * Set a quick custom modifier value directly (for simple numeric adjustments)
	 * @param {string} type - The modifier type
	 * @param {number} value - The value to set
	 */
	setCustomModifier (type, value) {
		if (type in this._data.customModifiers) {
			this._data.customModifiers[type] = value;
		} else if (type.startsWith("save:")) {
			const abl = type.split(":")[1];
			this._data.customModifiers.savingThrows[abl] = value;
		} else if (type.startsWith("skill:")) {
			const skill = type.split(":")[1];
			this._data.customModifiers.skills[skill] = value;
		}
	}

	/**
	 * Get total custom modifier for a type (for display purposes)
	 * @param {string} type - The modifier type
	 * @returns {number|object} The total modifier value (or object for complex types like speed)
	 */
	getCustomModifier (type) {
		switch (type) {
			case "ac": return this._data.customModifiers.ac || 0;
			case "initiative": return this._data.customModifiers.initiative || 0;
			case "speed": return this._data.customModifiers.speed?.walk || 0;
			case "speed:walk": return this._data.customModifiers.speed?.walk || 0;
			case "speed:fly": return this._data.customModifiers.speed?.fly || 0;
			case "speed:swim": return this._data.customModifiers.speed?.swim || 0;
			case "speed:climb": return this._data.customModifiers.speed?.climb || 0;
			case "speed:burrow": return this._data.customModifiers.speed?.burrow || 0;
			case "attack": return this._data.customModifiers.attackBonus || 0;
			case "damage": return this._data.customModifiers.damageBonus || 0;
			case "spellDc": return this._data.customModifiers.spellDc || 0;
			case "spellAttack": return this._data.customModifiers.spellAttack || 0;
			case "hp": return this._data.customModifiers.hp || 0;
			case "hpPerLevel": return this._data.customModifiers.hpPerLevel || 0;
			case "proficiencyBonus": return this._data.customModifiers.proficiencyBonus || 0;
			case "carryCapacity": return this._data.customModifiers.carryCapacity || 0;
			default:
				if (type.startsWith("save:")) {
					const abl = type.split(":")[1];
					return this._data.customModifiers.savingThrows[abl] || 0;
				}
				if (type.startsWith("skill:")) {
					const skill = type.split(":")[1];
					return this.getSkillCustomMod(skill);
				}
				if (type.startsWith("check:")) {
					const abl = type.split(":")[1];
					return this.getAbilityCheckCustomMod(abl);
				}
				if (type.startsWith("ability:")) {
					const abl = type.split(":")[1];
					return this._data.customModifiers.abilityScores?.[abl] || 0;
				}
				if (type.startsWith("sense:")) {
					const sense = type.split(":")[1];
					return this._data.customModifiers.senses?.[sense] || 0;
				}
				return 0;
		}
	}
	// #endregion

	// #region Active States (Rage, Concentration, Wild Shape, etc.)

	/**
	 * State type definitions with their effects
	 * Each state defines what effects it provides when active
	 */
	static ACTIVE_STATE_TYPES = {
		rage: {
			id: "rage",
			name: "Rage",
			icon: "💢",
			description: "Advantage on Strength checks/saves, resistance to B/P/S damage, +rage damage bonus",
			effects: [
				{type: "advantage", target: "check:str"},
				{type: "advantage", target: "save:str"},
				{type: "resistance", target: "damage:bludgeoning"},
				{type: "resistance", target: "damage:piercing"},
				{type: "resistance", target: "damage:slashing"},
				{type: "rageDamage", target: "melee:str"}, // Uses calculated rage damage
			],
			duration: "1 minute",
			endConditions: ["No attack or damage taken for 1 turn", "Knocked unconscious", "Ended as bonus action"],
			resourceId: null, // Will be linked to the Rage resource
		},
		concentration: {
			id: "concentration",
			name: "Concentrating",
			icon: "🔮",
			description: "Concentrating on a spell",
			effects: [],
			duration: "Spell duration",
			endConditions: ["Cast another concentration spell", "Take damage (CON save)", "Incapacitated", "Killed"],
		},
		wildShape: {
			id: "wildShape",
			name: "Wild Shape",
			icon: "🐺",
			description: "Transformed into a beast form",
			effects: [
				{type: "replaceStats", targets: ["str", "dex", "con"]}, // Beast's physical stats
				{type: "replaceHp", target: "tempHp"}, // Beast's HP as temp HP
				{type: "replaceAc", target: "naturalArmor"}, // Beast's AC
			],
			duration: "Hours based on druid level",
			endConditions: ["Drop to 0 HP", "Ended as bonus action", "Duration expires"],
			resourceId: null, // Will be linked to Wild Shape resource
		},
		defensiveStance: {
			id: "defensiveStance",
			name: "Defensive Stance",
			icon: "🛡️",
			description: "Fighting defensively for improved AC",
			effects: [
				{type: "bonus", target: "ac", value: 2},
				{type: "disadvantage", target: "attack"},
			],
			duration: "Until end of turn",
		},
		dodge: {
			id: "dodge",
			name: "Dodging",
			icon: "💨",
			description: "Taking the Dodge action",
			effects: [
				{type: "disadvantage", target: "attacksAgainst"}, // Attacks against you have disadvantage
				{type: "advantage", target: "save:dex"},
			],
			duration: "Until start of next turn",
		},
		prone: {
			id: "prone",
			name: "Prone",
			icon: "⬇️",
			description: "You are lying on the ground",
			effects: [
				{type: "disadvantage", target: "attack"},
				{type: "advantage", target: "meleeAttacksAgainst"}, // Melee attacks against you have advantage
				{type: "disadvantage", target: "rangedAttacksAgainst"}, // Ranged attacks against you have disadvantage
			],
			duration: "Until you stand up",
		},
	};

	/**
	 * Standard D&D 5e condition definitions with their mechanical effects
	 * These are automatically applied when a condition is added to the character
	 */
	static CONDITION_EFFECTS = {
		blinded: {
			name: "Blinded",
			icon: "👁️‍🗨️",
			description: "Can't see, auto-fail sight checks, attacks have disadvantage, attacks against have advantage",
			effects: [
				{type: "disadvantage", target: "attack"},
				{type: "advantage", target: "attacksAgainst"},
				{type: "autoFail", target: "check:sight"}, // Auto-fail any check requiring sight
			],
		},
		charmed: {
			name: "Charmed",
			icon: "💕",
			description: "Can't attack the charmer, charmer has advantage on social checks",
			effects: [
				// Charmed is mostly roleplay/situational, limited mechanical effects trackable here
				{type: "note", value: "Cannot attack or target charmer with harmful effects"},
			],
		},
		deafened: {
			name: "Deafened",
			icon: "🔇",
			description: "Can't hear, auto-fail hearing checks",
			effects: [
				{type: "autoFail", target: "check:hearing"},
			],
		},
		frightened: {
			name: "Frightened",
			icon: "😨",
			description: "Disadvantage on ability checks and attacks while source of fear is in sight",
			effects: [
				{type: "disadvantage", target: "attack", condition: "while source visible"},
				{type: "disadvantage", target: "check", condition: "while source visible"},
				{type: "note", value: "Can't willingly move closer to source of fear"},
			],
		},
		grappled: {
			name: "Grappled",
			icon: "🤜",
			description: "Speed becomes 0, can't benefit from speed bonuses",
			effects: [
				{type: "setSpeed", target: "all", value: 0},
			],
		},
		incapacitated: {
			name: "Incapacitated",
			icon: "💫",
			description: "Can't take actions or reactions",
			effects: [
				{type: "note", value: "Cannot take actions or reactions"},
			],
		},
		invisible: {
			name: "Invisible",
			icon: "👻",
			description: "Attacks have advantage, attacks against have disadvantage",
			effects: [
				{type: "advantage", target: "attack"},
				{type: "disadvantage", target: "attacksAgainst"},
			],
		},
		paralyzed: {
			name: "Paralyzed",
			icon: "⚡",
			description: "Incapacitated, can't move or speak, auto-fail STR/DEX saves, attacks against have advantage, crits within 5ft",
			effects: [
				{type: "incapacitated", value: true},
				{type: "setSpeed", target: "all", value: 0},
				{type: "autoFail", target: "save:str"},
				{type: "autoFail", target: "save:dex"},
				{type: "advantage", target: "attacksAgainst"},
				{type: "note", value: "Hits within 5 feet are critical hits"},
			],
		},
		petrified: {
			name: "Petrified",
			icon: "🪨",
			description: "Transformed to stone, incapacitated, unaware, resistance to all damage, immune to poison/disease",
			effects: [
				{type: "incapacitated", value: true},
				{type: "setSpeed", target: "all", value: 0},
				{type: "autoFail", target: "save:str"},
				{type: "autoFail", target: "save:dex"},
				{type: "advantage", target: "attacksAgainst"},
				{type: "resistance", target: "damage:all"},
				{type: "immunity", target: "damage:poison"},
				{type: "note", value: "Immune to poison and disease, unaware of surroundings"},
			],
		},
		poisoned: {
			name: "Poisoned",
			icon: "🤢",
			description: "Disadvantage on attack rolls and ability checks",
			effects: [
				{type: "disadvantage", target: "attack"},
				{type: "disadvantage", target: "check"},
			],
		},
		prone: {
			name: "Prone",
			icon: "⬇️",
			description: "Disadvantage on attacks, melee attacks against have advantage, ranged attacks against have disadvantage",
			effects: [
				{type: "disadvantage", target: "attack"},
				{type: "advantage", target: "meleeAttacksAgainst"},
				{type: "disadvantage", target: "rangedAttacksAgainst"},
				{type: "note", value: "Crawling costs extra movement, standing up costs half speed"},
			],
		},
		restrained: {
			name: "Restrained",
			icon: "🔗",
			description: "Speed 0, attacks have disadvantage, attacks against have advantage, disadvantage on DEX saves",
			effects: [
				{type: "setSpeed", target: "all", value: 0},
				{type: "disadvantage", target: "attack"},
				{type: "advantage", target: "attacksAgainst"},
				{type: "disadvantage", target: "save:dex"},
			],
		},
		stunned: {
			name: "Stunned",
			icon: "💥",
			description: "Incapacitated, can't move, can speak only falteringly, auto-fail STR/DEX saves, attacks against have advantage",
			effects: [
				{type: "incapacitated", value: true},
				{type: "setSpeed", target: "all", value: 0},
				{type: "autoFail", target: "save:str"},
				{type: "autoFail", target: "save:dex"},
				{type: "advantage", target: "attacksAgainst"},
			],
		},
		unconscious: {
			name: "Unconscious",
			icon: "💤",
			description: "Incapacitated, can't move or speak, unaware, drop held items, fall prone, auto-fail STR/DEX saves, attacks have advantage, crits within 5ft",
			effects: [
				{type: "incapacitated", value: true},
				{type: "setSpeed", target: "all", value: 0},
				{type: "autoFail", target: "save:str"},
				{type: "autoFail", target: "save:dex"},
				{type: "advantage", target: "attacksAgainst"},
				{type: "note", value: "Hits within 5 feet are critical hits, falls prone"},
			],
		},
		// Additional common conditions
		exhaustion: {
			name: "Exhaustion",
			icon: "😩",
			description: "Exhaustion is tracked separately with levels",
			effects: [], // Handled by the exhaustion system
		},
		// 2024 specific conditions
		slowed: {
			name: "Slowed",
			icon: "🐢",
			description: "Speed halved, -2 to AC and DEX saves, can't use reactions",
			effects: [
				{type: "speedMultiplier", target: "all", value: 0.5},
				{type: "bonus", target: "ac", value: -2},
				{type: "bonus", target: "save:dex", value: -2},
				{type: "note", value: "Cannot use reactions"},
			],
		},
		// Custom/Homebrew condition placeholder
		// Homebrew conditions can be added dynamically
	};

	/**
	 * Custom/homebrew condition definitions
	 * These are added at runtime from homebrew sources
	 */
	static _customConditions = {};

	/**
	 * Register a custom/homebrew condition
	 * @param {string} name - The condition name
	 * @param {object} definition - The condition definition with effects
	 */
	static registerCustomCondition (name, definition) {
		const key = name.toLowerCase().replace(/\s+/g, "_");
		CharacterSheetState._customConditions[key] = {
			name: definition.name || name,
			icon: definition.icon || "❓",
			description: definition.description || "",
			effects: definition.effects || [],
			source: definition.source || "homebrew",
		};
	}

	/**
	 * Parse a condition's entries to extract mechanical effects
	 * @param {object} condition - The condition data with name, entries, etc.
	 * @returns {object} Parsed condition definition with effects
	 */
	static parseConditionFromEntries (condition) {
		const effects = [];
		const notes = [];
		
		// Flatten entries to get all text
		const allText = CharacterSheetState._flattenEntriesToText(condition.entries || []);
		const textLower = allText.toLowerCase();
		
		// Pattern matching for common mechanical effects
		
		// Speed 0
		if (/speed\s*(?:is\s*)?0|your speed is 0/i.test(allText)) {
			effects.push({type: "setSpeed", target: "all", value: 0});
		}
		// Speed halved / movement costs extra
		if (/speed\s*(?:is\s*)?halved|half(?:ed)?\s*speed|spend\s*1\s*extra\s*foot/i.test(allText)) {
			effects.push({type: "speedMultiplier", target: "all", value: 0.5});
		}
		
		// Advantage on attacks (for the creature with the condition, e.g., hidden)
		if (/you\s*(?:gain|have)\s*advantage\s*on\s*(?:attack|attack\s*roll)/i.test(allText)) {
			effects.push({type: "advantage", target: "attack"});
		}
		// Disadvantage on attack rolls (by the creature with the condition)
		if (/(?:your\s*)?attack\s*rolls?\s*have\s*disadvantage|disadvantage\s*on\s*(?:your\s*)?attack\s*rolls?|have\s*disadvantage\s*on\s*attack\s*rolls/i.test(allText)) {
			effects.push({type: "disadvantage", target: "attack"});
		}
		
		// Disadvantage on ability checks
		if (/disadvantage\s*on\s*(?:all\s*)?ability\s*checks|ability\s*checks[^.]*have\s*disadvantage/i.test(allText)) {
			effects.push({type: "disadvantage", target: "check"});
		}
		
		// Combined: Disadvantage on attack rolls AND ability checks (Poisoned, Frightened)
		if (/disadvantage\s*on\s*attack\s*rolls?\s*and\s*ability\s*checks/i.test(allText)) {
			// Already added attack disadvantage above, just ensure we have check disadvantage
			if (!effects.find(e => e.type === "disadvantage" && e.target === "check")) {
				effects.push({type: "disadvantage", target: "check"});
			}
		}
		
		// Attack rolls against you have advantage
		if (/attack\s*rolls?\s*against\s*(?:you|the\s*creature)\s*have\s*advantage/i.test(allText)) {
			effects.push({type: "advantage", target: "attacksAgainst"});
		}
		// Attack rolls against you have disadvantage
		if (/attack\s*rolls?\s*against\s*(?:you|the\s*creature)\s*have\s*disadvantage/i.test(allText)) {
			effects.push({type: "disadvantage", target: "attacksAgainst"});
		}
		
		// Saving throw disadvantage
		const savingThrowDisadvPatterns = [
			{pattern: /disadvantage\s*on\s*(?:all\s*)?(?:ability\s*)?saving\s*throws?/i, target: "save"},
			{pattern: /disadvantage\s*on\s*dexterity\s*saving\s*throws?/i, target: "save:dex"},
			{pattern: /disadvantage\s*on\s*strength\s*saving\s*throws?/i, target: "save:str"},
			{pattern: /disadvantage\s*on\s*constitution\s*saving\s*throws?/i, target: "save:con"},
			{pattern: /disadvantage\s*on\s*intelligence\s*saving\s*throws?/i, target: "save:int"},
			{pattern: /disadvantage\s*on\s*wisdom\s*saving\s*throws?/i, target: "save:wis"},
			{pattern: /disadvantage\s*on\s*charisma\s*saving\s*throws?/i, target: "save:cha"},
			// Constitution saves for concentration (TGTT Poisoned)
			{pattern: /disadvantage\s*on\s*constitution\s*saving\s*throws?\s*to\s*maintain\s*concentration/i, target: "save:con:concentration"},
		];
		for (const {pattern, target} of savingThrowDisadvPatterns) {
			if (pattern.test(allText)) {
				effects.push({type: "disadvantage", target});
			}
		}
		
		// Auto-fail saving throws
		if (/automatically\s*fails?\s*strength\s*(?:and\s*dexterity\s*)?saving\s*throws?/i.test(allText)) {
			effects.push({type: "autoFail", target: "save:str"});
			if (/and\s*dexterity/i.test(allText)) {
				effects.push({type: "autoFail", target: "save:dex"});
			}
		}
		if (/automatically\s*fails?\s*dexterity\s*(?:and\s*strength\s*)?saving\s*throws?/i.test(allText)) {
			effects.push({type: "autoFail", target: "save:dex"});
			if (/and\s*strength/i.test(allText)) {
				effects.push({type: "autoFail", target: "save:str"});
			}
		}
		if (/automatically\s*fail\s*strength\s*saving\s*throw\s*and\s*dexterity\s*saving\s*throw/i.test(allText)) {
			effects.push({type: "autoFail", target: "save:str"});
			effects.push({type: "autoFail", target: "save:dex"});
		}
		
		// Ability check failures
		if (/automatically\s*fails?\s*(?:any\s*)?ability\s*checks?\s*that\s*require/i.test(allText)) {
			if (/sight/i.test(allText)) {
				effects.push({type: "autoFail", target: "check:sight"});
			}
		}
		
		// Incapacitated (includes note)
		if (/incapacitated|can'?t\s*take\s*(?:any\s*)?actions?\s*or\s*reactions/i.test(allText)) {
			effects.push({type: "incapacitated", value: true});
		}
		
		// Resistance to all damage
		if (/resistance\s*to\s*all\s*damage/i.test(allText)) {
			effects.push({type: "resistance", target: "all"});
		}
		
		// Immunity to conditions (like Poisoned)
		const conditionImmunityMatch = allText.match(/immunity\s*to\s*(?:the\s*)?(?:@condition\s*)?(\w+)\s*condition/i);
		if (conditionImmunityMatch) {
			effects.push({type: "conditionImmunity", target: conditionImmunityMatch[1].toLowerCase()});
			notes.push(`Immune to ${conditionImmunityMatch[1]} condition`);
		}
		
		// Immunity to damage types
		if (/immunity\s*to\s*poison(?:ed)?\s*damage|poison\s*immunity/i.test(allText)) {
			effects.push({type: "immunity", target: "poison"});
		}
		
		// Can't move
		if (/can'?t\s*move|you\s*can'?t\s*move|unable\s*to\s*move/i.test(allText)) {
			notes.push("Cannot move");
		}
		
		// Concentration broken
		if (/concentration\s*(?:is\s*)?broken|your\s*concentration\s*is\s*broken/i.test(allText)) {
			notes.push("Concentration is broken");
		}
		
		// Limited activity (Dazed-like)
		if (/can\s*(?:move|take)\s*(?:or|one)\s*(?:action|move)[^.]*not\s*both/i.test(allText)) {
			notes.push("Move or Action, not both");
		}
		
		// Can't take bonus action or reaction (often with Dazed)
		if (/can'?t\s*take\s*a\s*bonus\s*action/i.test(allText)) {
			notes.push("No Bonus Actions");
		}
		if (/can'?t\s*take\s*(?:a\s*)?reaction/i.test(allText) && !/actions?\s*or\s*reactions/i.test(allText)) {
			notes.push("No Reactions");
		}
		
		// Can't speak or speechless
		if (/can'?t\s*speak|speechless/i.test(allText)) {
			notes.push("Cannot speak");
		}
		
		// Speech limited/faltering (Choked, Stunned)
		if (/speak\s*only\s*falteringly|faltering\s*speech/i.test(allText)) {
			notes.push("Speech is faltering");
		}
		
		// TGTT Somatic Constraint - concentration check for somatic spells
		if (/somatic\s*constraint|spell\s*with\s*(?:a\s*)?somatic\s*component[^.]*concentration\s*check/i.test(allText)) {
			effects.push({type: "somaticConstraint", value: "check"});
			notes.push("Somatic spells require concentration check");
		}
		
		// TGTT Somatic Ban - can't cast somatic spells
		if (/somatic\s*ban|spell\s*with\s*(?:a\s*)?somatic\s*component[^.]*automatically\s*disrupted/i.test(allText)) {
			effects.push({type: "somaticConstraint", value: "banned"});
			notes.push("Somatic spells automatically fail");
		}
		
		// TGTT Verbal component restriction (Choked - Cough)
		if (/verbal\s*component[^.]*concentration\s*check|cough[^.]*verbal/i.test(allText)) {
			effects.push({type: "verbalConstraint", value: "check"});
			notes.push("Verbal spells require concentration check");
		}
		
		// Breath/suffocation effects (Choked - Short Breath)
		if (/hold\s*(?:your\s*)?breath\s*(?:for\s*)?half|short\s*breath/i.test(allText)) {
			notes.push("Breath holding halved");
		}
		
		// Can't use reactions (separate from incapacitated)
		if (/can'?t\s*use\s*reactions/i.test(allText)) {
			notes.push("Cannot use reactions");
		}
		
		// Add any notes as effect entries
		for (const note of notes) {
			effects.push({type: "note", value: note});
		}
		
		// Generate an icon based on condition name patterns
		const icon = CharacterSheetState._getConditionIcon(condition.name);
		
		return {
			name: condition.name,
			icon,
			description: CharacterSheetState._getConditionDescription(allText),
			effects,
			source: condition.source || "homebrew",
		};
	}

	/**
	 * Get an appropriate icon for a condition based on its name
	 * @param {string} name - The condition name
	 * @returns {string} An emoji icon
	 */
	static _getConditionIcon (name) {
		const nameLower = name.toLowerCase();
		const iconMap = {
			"exhaustion": "😩", "exhausted": "😩",
			"slowed": "🐢", "slow": "🐢",
			"hidden": "👁️", "invisible": "👻",
			"undetected": "❓",
			"stunned": "💫", "stun": "💫",
			"dazed": "😵", "confused": "😵",
			"choked": "😤", "suffocating": "😤",
			"grappled": "🤼", "grabbed": "🤼",
			"restrained": "⛓️", "bound": "⛓️",
			"petrified": "🗿", "stone": "🗿",
			"poisoned": "🤢", "poison": "🤢",
			"frightened": "😨", "fear": "😨",
			"charmed": "💕", "charm": "💕",
			"paralyzed": "⚡", "paralysis": "⚡",
			"blinded": "🙈", "blind": "🙈",
			"deafened": "🙉", "deaf": "🙉",
			"unconscious": "💤", "unconsciousness": "💤",
			"prone": "⬇️",
			"incapacitated": "🚫",
		};
		
		for (const [key, emoji] of Object.entries(iconMap)) {
			if (nameLower.includes(key)) return emoji;
		}
		return "❓";
	}

	/**
	 * Extract a brief description from condition text
	 * @param {string} text - The full condition text
	 * @returns {string} A brief description
	 */
	static _getConditionDescription (text) {
		// Get first sentence or first 100 chars
		const firstSentence = text.split(/[.!?]/)[0];
		if (firstSentence.length <= 100) return firstSentence.trim();
		return firstSentence.substring(0, 97).trim() + "...";
	}

	/**
	 * Flatten condition entries to plain text for parsing
	 * @param {Array|string|object} entries - The entries array, string, or object
	 * @returns {string} Flattened text
	 */
	static _flattenEntriesToText (entries) {
		if (!entries) return "";
		if (typeof entries === "string") return entries;
		if (!Array.isArray(entries)) {
			// Handle objects with entries or items properties
			const obj = /** @type {object} */ (entries);
			if (obj.entries) return CharacterSheetState._flattenEntriesToText(obj.entries);
			if (obj.items) return CharacterSheetState._flattenEntriesToText(obj.items);
			return "";
		}
		
		return entries.map(entry => {
			if (typeof entry === "string") {
				// Strip 5etools formatting tags like {@b text}, {@condition name}, etc.
				return entry.replace(/\{@\w+\s+([^}|]+)(?:\|[^}]*)?\}/g, "$1");
			}
			if (typeof entry === "object" && entry !== null) {
				if (entry.entries) return CharacterSheetState._flattenEntriesToText(entry.entries);
				if (entry.items) return CharacterSheetState._flattenEntriesToText(entry.items);
			}
			return "";
		}).join(" ");
	}

	/**
	 * Register homebrew conditions from an array of condition data
	 * @param {Array} conditions - Array of condition objects from homebrew
	 */
	static registerHomebrewConditions (conditions) {
		if (!conditions || !Array.isArray(conditions)) return;
		
		for (const condition of conditions) {
			// Skip conditions that are already in the standard list
			const key = condition.name.toLowerCase().replace(/\s+/g, "_");
			if (CharacterSheetState.CONDITION_EFFECTS[key]) {
				// Could potentially merge/override, but for now skip
				continue;
			}
			
			// Parse the condition entries to extract effects
			const parsed = CharacterSheetState.parseConditionFromEntries(condition);
			CharacterSheetState.registerCustomCondition(condition.name, parsed);
		}
	}

	/**
	 * Get condition effects by name (checks both standard and custom)
	 * @param {string} conditionName - The condition name
	 * @returns {object|null} The condition definition or null
	 */
	static getConditionEffects (conditionName) {
		const key = conditionName.toLowerCase().replace(/\s+/g, "_");
		return CharacterSheetState.CONDITION_EFFECTS[key] 
			|| CharacterSheetState._customConditions[key] 
			|| null;
	}

	/**
	 * Get all active states
	 * @returns {Array} Array of active state objects
	 */
	getActiveStates () {
		return [...this._data.activeStates];
	}

	/**
	 * Get a specific active state by ID
	 * @param {string} stateId - The state ID to find
	 * @returns {object|null} The active state or null
	 */
	getActiveState (stateId) {
		return this._data.activeStates.find(s => s.id === stateId) || null;
	}

	/**
	 * Check if a state is currently active
	 * @param {string} stateId - The state ID to check
	 * @returns {boolean} True if the state is active
	 */
	isStateActive (stateId) {
		return this._data.activeStates.some(s => s.id === stateId && s.active);
	}

	/**
	 * Check if a state TYPE is currently active (e.g., "rage", "concentration")
	 * @param {string} stateTypeId - The state type ID to check
	 * @returns {boolean} True if a state of this type is active
	 */
	isStateTypeActive (stateTypeId) {
		return this._data.activeStates.some(s => s.stateTypeId === stateTypeId && s.active);
	}

	/**
	 * Add a new active state
	 * @param {string} stateTypeId - The state type ID from ACTIVE_STATE_TYPES
	 * @param {object} options - Additional options for this state instance
	 * @returns {string} The unique ID of the new state
	 */
	addActiveState (stateTypeId, options = {}) {
		const stateType = CharacterSheetState.ACTIVE_STATE_TYPES[stateTypeId];
		if (!stateType) {
			console.warn(`Unknown active state type: ${stateTypeId}`);
			return null;
		}

		// Check if this state type is already active (for exclusive states like Rage)
		const existing = this._data.activeStates.find(s => s.stateTypeId === stateTypeId);
		if (existing) {
			// Reactivate existing state
			existing.active = true;
			existing.activatedAt = Date.now();
			return existing.id;
		}

		const state = {
			id: `${stateTypeId}_${Date.now()}`,
			stateTypeId: stateTypeId,
			name: options.name || stateType.name,
			icon: options.icon || stateType.icon,
			active: true,
			activatedAt: Date.now(),
			sourceFeatureId: options.sourceFeatureId || null,
			resourceId: options.resourceId || stateType.resourceId,
			// For states with variable effects (like Wild Shape with beast stats)
			customEffects: options.customEffects || null,
			// For concentration
			spellName: options.spellName || null,
			spellLevel: options.spellLevel || null,
			// For Wild Shape
			beastData: options.beastData || null,
		};

		this._data.activeStates.push(state);
		return state.id;
	}

	/**
	 * Toggle an active state on/off
	 * @param {string} stateId - The unique state instance ID
	 * @returns {boolean} The new active status
	 */
	toggleActiveState (stateId) {
		const state = this._data.activeStates.find(s => s.id === stateId);
		if (state) {
			state.active = !state.active;
			if (state.active) {
				state.activatedAt = Date.now();
			}
			return state.active;
		}
		return false;
	}

	/**
	 * Activate a state by type ID (creates if not exists)
	 * @param {string} stateTypeId - The state type ID
	 * @param {object} options - Options to pass to addActiveState
	 * @returns {string} The state instance ID
	 */
	activateState (stateTypeId, options = {}) {
		const existing = this._data.activeStates.find(s => s.stateTypeId === stateTypeId);
		if (existing) {
			existing.active = true;
			existing.activatedAt = Date.now();
			return existing.id;
		}
		return this.addActiveState(stateTypeId, options);
	}

	/**
	 * Deactivate a state by type ID
	 * @param {string} stateTypeId - The state type ID
	 */
	deactivateState (stateTypeId) {
		const state = this._data.activeStates.find(s => s.stateTypeId === stateTypeId);
		if (state) {
			state.active = false;
		}
	}

	/**
	 * Remove an active state entirely
	 * @param {string} stateId - The unique state instance ID
	 */
	removeActiveState (stateId) {
		const index = this._data.activeStates.findIndex(s => s.id === stateId);
		if (index !== -1) {
			this._data.activeStates.splice(index, 1);
		}
	}

	/**
	 * Get all effects from currently active states
	 * @returns {Array} Array of effect objects with state context
	 */
	getActiveStateEffects () {
		const effects = [];
		for (const state of this._data.activeStates) {
			if (!state.active) continue;

			// For condition-derived states, use customEffects directly
			if (state.isCondition) {
				const stateEffects = state.customEffects || [];
				for (const effect of stateEffects) {
					effects.push({
						...effect,
						stateId: state.id,
						stateName: state.name,
						stateIcon: state.icon,
						isCondition: true,
						conditionName: state.conditionName,
					});
				}
				continue;
			}

			// For regular states, look up the state type
			const stateType = CharacterSheetState.ACTIVE_STATE_TYPES[state.stateTypeId];
			if (!stateType) continue;

			// Use custom effects if provided, otherwise use default effects
			const stateEffects = state.customEffects || stateType.effects;

			for (const effect of stateEffects) {
				effects.push({
					...effect,
					stateId: state.id,
					stateName: state.name,
					stateIcon: state.icon,
				});
			}
		}
		return effects;
	}

	/**
	 * Check if character has advantage on a specific roll type from active states
	 * @param {string} rollType - The roll type (e.g., "check:str", "save:dex", "attack")
	 * @returns {boolean} True if advantage applies
	 */
	hasAdvantageFromStates (rollType) {
		const effects = this.getActiveStateEffects();
		return effects.some(e => {
			if (e.type !== "advantage") return false;
			// Exact match
			if (e.target === rollType) return true;
			// Generic "check" applies to all ability checks (check:str, check:dex, etc.)
			if (e.target === "check" && rollType.startsWith("check:")) return true;
			// Generic "save" applies to all saving throws
			if (e.target === "save" && rollType.startsWith("save:")) return true;
			return false;
		});
	}

	/**
	 * Check if character has disadvantage on a specific roll type from active states
	 * @param {string} rollType - The roll type
	 * @returns {boolean} True if disadvantage applies
	 */
	hasDisadvantageFromStates (rollType) {
		const effects = this.getActiveStateEffects();
		return effects.some(e => {
			if (e.type !== "disadvantage") return false;
			// Exact match
			if (e.target === rollType) return true;
			// Generic "check" applies to all ability checks
			if (e.target === "check" && rollType.startsWith("check:")) return true;
			// Generic "save" applies to all saving throws  
			if (e.target === "save" && rollType.startsWith("save:")) return true;
			return false;
		});
	}

	/**
	 * Get bonus to a specific stat from active states
	 * @param {string} target - The target (e.g., "ac", "attack", "damage")
	 * @returns {number} The total bonus
	 */
	getBonusFromStates (target) {
		const effects = this.getActiveStateEffects();
		return effects
			.filter(e => e.type === "bonus" && e.target === target)
			.reduce((sum, e) => sum + (e.value || 0), 0);
	}

	/**
	 * Check if character has resistance to a damage type from active states
	 * @param {string} damageType - The damage type (e.g., "bludgeoning", "fire")
	 * @returns {boolean} True if resistant
	 */
	hasResistanceFromStates (damageType) {
		const effects = this.getActiveStateEffects();
		return effects.some(e => e.type === "resistance" && e.target === `damage:${damageType}`);
	}

	/**
	 * Check if Rage damage bonus applies to this attack
	 * @param {boolean} isMelee - Whether this is a melee attack
	 * @param {string} abilityUsed - The ability used for the attack
	 * @returns {number} The rage damage bonus if applicable, 0 otherwise
	 */
	getRageDamageBonus (isMelee, abilityUsed) {
		// Check if rage state is active using the new method
		if (!this.isStateTypeActive("rage")) {
			return 0;
		}
		// Rage damage applies to melee attacks using Strength
		if (isMelee && abilityUsed === "str") {
			// Use getFeatureCalculation to get the properly computed rage damage
			const rageDmg = this.getFeatureCalculation("rageDamage");
			if (rageDmg == null) return 2; // Default rage damage if not calculated
			if (typeof rageDmg === "string") {
				return parseInt(rageDmg.replace("+", "")) || 2;
			}
			return rageDmg || 2;
		}
		return 0;
	}

	// --- Concentration Management ---

	/**
	 * Get current concentration info
	 * @returns {object|null} The concentration info or null
	 */
	getConcentration () {
		return this._data.concentrating;
	}

	/**
	 * Start concentrating on a spell
	 * @param {string} spellName - The spell name
	 * @param {number} spellLevel - The spell level
	 */
	setConcentration (spellName, spellLevel = 0) {
		// End any existing concentration
		if (this._data.concentrating) {
			this.breakConcentration();
		}

		this._data.concentrating = {
			spellName,
			spellLevel,
			startedAt: Date.now(),
		};

		// Also add as an active state
		this.activateState("concentration", {
			name: `Concentrating: ${spellName}`,
			spellName,
			spellLevel,
		});
	}

	/**
	 * Break concentration (spell ends)
	 */
	breakConcentration () {
		this._data.concentrating = null;

		// Remove concentration active state
		const concState = this._data.activeStates.find(s => s.stateTypeId === "concentration");
		if (concState) {
			this.removeActiveState(concState.id);
		}
	}

	/**
	 * Check if currently concentrating
	 * @returns {boolean}
	 */
	isConcentrating () {
		return this._data.concentrating !== null;
	}

	/**
	 * Get concentration save DC for damage taken
	 * @param {number} damageTaken - The amount of damage taken
	 * @returns {number} The DC for the concentration save
	 */
	getConcentrationSaveDC (damageTaken) {
		return Math.max(10, Math.floor(damageTaken / 2));
	}

	// --- Rest Integration for Active States ---

	/**
	 * Clear states that end on rest
	 * @param {string} restType - "short" or "long"
	 */
	clearStatesOnRest (restType) {
		// Rage ends on rest
		this.deactivateState("rage");

		// Concentration ends on rest
		if (this._data.concentrating) {
			this.breakConcentration();
		}

		// Clear most combat states
		const combatStates = ["defensiveStance", "dodge", "prone"];
		for (const stateType of combatStates) {
			this.deactivateState(stateType);
		}

		// Wild Shape typically persists but can be cleared on long rest if desired
		if (restType === "long") {
			this.deactivateState("wildShape");
		}
	}

	// #endregion

	// #region Rest
	onShortRest () {
		// Clear active states that end on rest
		this.clearStatesOnRest("short");

		// Recover short rest resources
		this.recoverResources("short");

		// Warlock pact slots
		if (this._data.spellcasting.pactSlots.max > 0) {
			this._data.spellcasting.pactSlots.current = this._data.spellcasting.pactSlots.max;
		}

		// Recover short rest innate spells
		this.restoreInnateSpells("short");

		// Recover exertion (Thelemar: recovers on short rest)
		this.restoreExertion();
	}

	onLongRest () {
		// Clear active states that end on rest
		this.clearStatesOnRest("long");

		// Recover all HP
		this._data.hp.current = this.getMaxHp();

		// Reset death saves
		this.resetDeathSaves();

		// Recover hit dice (half, minimum 1)
		this.recoverHitDice();

		// Recover all spell slots
		this.recoverSpellSlots();

		// Recover all resources
		this.recoverResources("long");
		this.recoverResources("dawn");

		// Recover all innate spells
		this.restoreInnateSpells("long");

		// Reduce exhaustion by 1 level (if any) - applies to both 2014 and 2024 rules
		if (this._data.exhaustion > 0) {
			this._data.exhaustion = Math.max(0, this._data.exhaustion - 1);
		}

		// Recover exertion (Thelemar: recovers on any rest)
		this.restoreExertion();
	}
	// #endregion
}

// Make available globally and as module export
globalThis.CharacterSheetState = CharacterSheetState;

export {CharacterSheetState};
