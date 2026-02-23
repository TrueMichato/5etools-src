/**
 * Character Sheet Class Utilities
 * Shared static helpers used by both LevelUp and QuickBuild modules.
 * Single source of truth for class data parsing, spell metadata, feature analysis,
 * combat traditions, and state mutation helpers.
 */
class CharacterSheetClassUtils {
	// ==========================================
	// Pure Utility Methods
	// ==========================================

	/**
	 * Check if a class level grants an Ability Score Improvement.
	 * @param {Object} classData - The class data object
	 * @param {number} level - The class level
	 * @returns {boolean}
	 */
	static levelGrantsAsi (classData, level) {
		const standardAsiLevels = [4, 8, 12, 16, 19];
		if (classData.name === "Fighter") {
			return [...standardAsiLevels, 6, 14].includes(level);
		}
		if (classData.name === "Rogue") {
			return [...standardAsiLevels, 10].includes(level);
		}
		return standardAsiLevels.includes(level);
	}

	/**
	 * Check if a class level grants a subclass feature (data-driven).
	 * @param {Object} classData - The class data with classFeatures
	 * @param {number} level - The class level
	 * @returns {boolean}
	 */
	static levelGrantsSubclass (classData, level) {
		if (classData.classFeatures && Array.isArray(classData.classFeatures)) {
			const isArrayOfArrays = Array.isArray(classData.classFeatures[0]);
			const levelFeatures = isArrayOfArrays
				? classData.classFeatures[level - 1] || []
				: classData.classFeatures.filter(f => {
					if (typeof f === "string") {
						const parts = f.split("|");
						return parseInt(parts[3]) === level;
					}
					if (typeof f === "object" && f.classFeature) {
						const parts = f.classFeature.split("|");
						return parseInt(parts[3]) === level;
					}
					return f.level === level;
				});

			return levelFeatures.some(f =>
				typeof f === "object" && f.gainSubclassFeature,
			);
		}

		// Fallback: default subclass level 3
		return level === 3;
	}

	/**
	 * Get the level at which a class gains its subclass (data-driven).
	 * @param {Object} classData - The class data with classFeatures
	 * @returns {number} The subclass level (default: 3)
	 */
	static getSubclassLevel (classData) {
		if (classData.classFeatures && Array.isArray(classData.classFeatures)) {
			const isArrayOfArrays = Array.isArray(classData.classFeatures[0]);
			if (isArrayOfArrays) {
				for (let lvl = 1; lvl <= 20; lvl++) {
					const features = classData.classFeatures[lvl - 1] || [];
					if (features.some(f => typeof f === "object" && f.gainSubclassFeature)) return lvl;
				}
			} else {
				for (const f of classData.classFeatures) {
					if (typeof f === "object" && f.gainSubclassFeature) {
						const parts = f.classFeature.split("|");
						const lvl = parseInt(parts[3]);
						if (!isNaN(lvl)) return lvl;
					}
				}
			}
		}
		return 3;
	}

	/**
	 * Filter optional features to only include those matching the class's edition.
	 * @param {Array} optFeatures - All optional features
	 * @param {string} classSource - The class's source book
	 * @returns {Array} Filtered optional features
	 */
	static filterOptFeaturesByEdition (optFeatures, classSource) {
		if (!classSource || !optFeatures?.length) return optFeatures;

		const editionMap = {
			"TGTT": ["TGTT"],
			"XPHB": ["XPHB", "TCE", "XGE", "FTD", "SCC"],
			"PHB": ["PHB", "TCE", "XGE", "UA", "FTD", "SCC"],
		};

		const allowedSources = editionMap[classSource];
		if (!allowedSources) return optFeatures;

		return optFeatures.filter(opt => {
			if (!opt.source) return true;
			return allowedSources.includes(opt.source);
		});
	}

	/**
	 * Get the hit die size for a class.
	 * @param {Object} classData - The class data
	 * @returns {number} Hit die size (e.g. 6, 8, 10, 12)
	 */
	static getClassHitDie (classData) {
		const hitDieMap = {
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
		};
		return classData.hd?.faces || hitDieMap[classData.name] || 8;
	}

	/**
	 * Get the spellcasting ability for a class.
	 * @param {Object} classData - The class data
	 * @returns {string|null} Ability abbreviation or null
	 */
	static getSpellcastingAbility (classData) {
		const abilityMap = {
			"Wizard": "int",
			"Artificer": "int",
			"Bard": "cha",
			"Paladin": "cha",
			"Sorcerer": "cha",
			"Warlock": "cha",
			"Cleric": "wis",
			"Druid": "wis",
			"Ranger": "wis",
			"Monk": "wis",
		};
		return classData.spellcastingAbility || abilityMap[classData.name] || null;
	}

	/**
	 * Extract the degree number from a combat method's feature type.
	 * @param {Object} opt - Optional feature with featureType array
	 * @returns {number} The degree (0 if not found)
	 */
	static getMethodDegree (opt) {
		if (!opt.featureType) return 0;
		for (const ft of opt.featureType) {
			const match = ft.match(/^CTM:(\d)[A-Z]{2}$/);
			if (match) return parseInt(match[1]);
		}
		return 0;
	}

	/**
	 * Extract the tradition code from a combat method's feature type.
	 * @param {Object} opt - Optional feature with featureType array
	 * @returns {string|null} Two-letter tradition code or null
	 */
	static getMethodTradition (opt) {
		if (!opt.featureType) return null;
		for (const ft of opt.featureType) {
			const match = ft.match(/^CTM:\d([A-Z]{2})$/);
			if (match) return match[1];
		}
		return null;
	}

	/**
	 * Get ordinal suffix for a number (1st, 2nd, 3rd, 4th...).
	 * @param {number} n
	 * @returns {string} The suffix
	 */
	static getOrdinalSuffix (n) {
		const s = ["th", "st", "nd", "rd"];
		const v = n % 100;
		return s[(v - 20) % 10] || s[v] || s[0];
	}

	/**
	 * Get emoji for a spell school abbreviation.
	 * @param {string} school - Single-letter school abbreviation
	 * @returns {string} Emoji
	 */
	static getSchoolEmoji (school) {
		const schoolEmojis = {
			"A": "✨", // Abjuration
			"C": "🌀", // Conjuration
			"D": "👁️", // Divination
			"E": "💫", // Enchantment
			"V": "🔥", // Evocation
			"I": "🎭", // Illusion
			"N": "💀", // Necromancy
			"T": "🔄", // Transmutation
		};
		return schoolEmojis[school] || "📜";
	}

	/**
	 * Check if a spell belongs to a class's spell list (using Renderer API with fallback).
	 * @param {Object} spell - Spell data object
	 * @param {string} className - Class name to check
	 * @returns {boolean}
	 */
	static spellIsForClass (spell, className) {
		try {
			const classList = Renderer.spell.getCombinedClasses(spell, "fromClassList");
			if (classList?.some(c => c.name === className)) return true;
		} catch (e) { /* fall through */ }
		return spell.classes?.fromClassList?.some(c => c.name === className) || false;
	}

	/**
	 * Get the maximum spell level a class can cast at a given level.
	 * @param {string} className - Class name
	 * @param {number} classLevel - Current class level
	 * @returns {number} Max spell level (0 if non-caster)
	 */
	static getMaxSpellLevelForClass (className, classLevel) {
		const fullCasters = ["Wizard", "Cleric", "Druid", "Bard", "Sorcerer", "Warlock"];
		const halfCasters = ["Paladin", "Ranger", "Artificer"];

		if (fullCasters.includes(className)) {
			return Math.min(9, Math.ceil(classLevel / 2));
		}
		if (halfCasters.includes(className)) {
			return Math.min(5, Math.ceil((classLevel + 1) / 4));
		}
		return 0;
	}

	// ==========================================
	// Spell Metadata Helpers
	// ==========================================

	/**
	 * Get casting time string from spell data.
	 * @param {Object} spell
	 * @returns {string}
	 */
	static getSpellCastingTime (spell) {
		if (!spell.time?.length) return "";
		const time = spell.time[0];
		return `${time.number} ${time.unit}`;
	}

	/**
	 * Get range string from spell data.
	 * @param {Object} spell
	 * @returns {string}
	 */
	static getSpellRange (spell) {
		if (!spell.range) return "";
		const range = spell.range;
		if (range.type === "point") {
			if (range.distance?.type === "self") return "Self";
			if (range.distance?.type === "touch") return "Touch";
			return `${range.distance?.amount || ""} ${range.distance?.type || ""}`.trim();
		}
		return `${range.distance?.amount || ""} ${range.distance?.type || ""}`.trim();
	}

	/**
	 * Get components string from spell data.
	 * @param {Object} spell
	 * @returns {string}
	 */
	static getSpellComponents (spell) {
		if (!spell.components) return "";
		const parts = [];
		if (spell.components.v) parts.push("V");
		if (spell.components.s) parts.push("S");
		if (spell.components.m) {
			const mText = typeof spell.components.m === "string" ? spell.components.m : spell.components.m?.text || "";
			parts.push(mText ? `M (${mText})` : "M");
		}
		return parts.join(", ");
	}

	/**
	 * Get duration string from spell data.
	 * @param {Object} spell
	 * @returns {string}
	 */
	static getSpellDuration (spell) {
		if (!spell.duration?.length) return "";
		const dur = spell.duration[0];
		if (dur.type === "instant") return "Instantaneous";
		if (dur.type === "permanent") return "Until dispelled";
		if (dur.concentration) {
			return `Concentration, up to ${dur.duration?.amount || ""} ${dur.duration?.type || ""}`.trim();
		}
		return `${dur.duration?.amount || ""} ${dur.duration?.type || ""}`.trim();
	}

	/**
	 * Check if a spell requires concentration.
	 * @param {Object} spell
	 * @returns {boolean}
	 */
	static spellIsConcentration (spell) {
		return spell.concentration || spell.duration?.some?.(d => d.concentration) || false;
	}

	/**
	 * Check if a spell is a ritual.
	 * @param {Object} spell
	 * @returns {boolean}
	 */
	static spellIsRitual (spell) {
		return spell.ritual || spell.meta?.ritual || false;
	}

	// ==========================================
	// Known-Caster Progression Tables
	// ==========================================

	/** @private */
	static _SPELLS_KNOWN_TABLES = {
		"Bard": [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
		"Sorcerer": [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
		"Warlock": [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
		"Ranger": [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
	};

	/** @private */
	static _CANTRIP_TABLES = {
		"Bard": [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
		"Sorcerer": [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
		"Warlock": [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
	};

	/**
	 * Get known-spell count at a class level (for known-caster classes).
	 * @param {Object} classData - The class data
	 * @param {string} className - The class name
	 * @param {number} classLevel - The class level
	 * @returns {number|null} Known spell count, or null if not a known caster
	 */
	static getKnownSpellsAtLevel (classData, className, classLevel) {
		const prog = classData.spellsKnownProgression || CharacterSheetClassUtils._SPELLS_KNOWN_TABLES[className];
		if (!prog) return null;
		return prog[classLevel - 1] || 0;
	}

	/**
	 * Get cantrip count at a class level.
	 * @param {Object} classData - The class data
	 * @param {string} className - The class name
	 * @param {number} classLevel - The class level
	 * @returns {number|null} Cantrip count, or null if no cantrip progression
	 */
	static getCantripsAtLevel (classData, className, classLevel) {
		const prog = classData.cantripProgression || CharacterSheetClassUtils._CANTRIP_TABLES[className];
		if (!prog) return null;
		return prog[classLevel - 1] || 0;
	}

	/**
	 * Parse the maximum castable spell level from a caster progression string.
	 * @param {string} casterProgression - "full", "1/2", "1/3", "pact"
	 * @param {number} classLevel - Current class level
	 * @returns {number} Max spell level
	 */
	static getMaxSpellLevelFromProgression (casterProgression, classLevel) {
		if (casterProgression === "full" || !casterProgression) {
			return Math.min(9, Math.ceil(classLevel / 2));
		} else if (casterProgression === "1/2") {
			return Math.min(5, Math.ceil(classLevel / 4));
		} else if (casterProgression === "1/3") {
			return Math.min(4, Math.ceil(classLevel / 7));
		} else if (casterProgression === "pact") {
			return Math.min(5, Math.ceil(classLevel / 2));
		}
		return Math.min(9, Math.ceil(classLevel / 2));
	}

	// ==========================================
	// Feature Data Extraction
	// ==========================================

	/**
	 * Find entries of type "options" in a feature's entries array.
	 * These represent choices the player must make (like Specialties).
	 * @param {Object} feature - The feature object with entries
	 * @param {number} characterLevel - Current character level for filtering
	 * @param {Array} [classFeatures] - All class features (for ref lookup)
	 * @returns {Array} Array of {count, options} objects
	 */
	static findFeatureOptions (feature, characterLevel = 1, classFeatures = []) {
		if (!feature?.entries) return [];

		const results = [];

		const searchEntries = (entries) => {
			if (!Array.isArray(entries)) return;

			for (const entry of entries) {
				if (typeof entry === "object" && entry.type === "options") {
					const count = entry.count || 1;
					const options = [];

					if (entry.entries) {
						for (const opt of entry.entries) {
							if (opt.type === "refClassFeature" && opt.classFeature) {
								const parts = opt.classFeature.split("|");
								const optLevel = parseInt(parts[3]) || 1;

								if (optLevel <= characterLevel) {
									options.push({
										name: parts[0],
										className: parts[1],
										source: parts[2],
										level: optLevel,
										type: "classFeature",
										ref: opt.classFeature,
									});
								}
							} else if (opt.type === "refSubclassFeature" && opt.subclassFeature) {
								const parts = opt.subclassFeature.split("|");
								options.push({
									name: parts[0],
									className: parts[1],
									source: parts[2],
									subclassShortName: parts[3],
									subclassSource: parts[4],
									level: parseInt(parts[5]) || 1,
									type: "subclassFeature",
									ref: opt.subclassFeature,
								});
							} else if (opt.type === "refOptionalfeature" && opt.optionalfeature) {
								const parts = opt.optionalfeature.split("|");
								options.push({
									name: parts[0],
									source: parts[1] || "PHB",
									type: "optionalfeature",
									ref: opt.optionalfeature,
								});
							} else if (typeof opt === "object" && opt.type === "entries") {
								options.push({
									name: opt.name || "Option",
									type: "inline",
									entries: opt.entries,
									source: opt.source,
								});
							}
						}
					}

					if (options.length > 0) {
						results.push({count, options});
					}
				}

				// Recurse into nested entries
				if (typeof entry === "object") {
					if (entry.entries) searchEntries(entry.entries);
					if (entry.items) searchEntries(entry.items);
				}
			}
		};

		searchEntries(feature.entries);
		return results;
	}

	/**
	 * Get feature options from features gained at a specific level.
	 * @param {Array} features - Array of features gained at this level
	 * @param {number} level - The level being gained
	 * @param {Array} [classFeatures] - All class features (for ref lookup)
	 * @returns {Array} Array of {featureName, featureSource, count, options, isSubclassFeature} objects
	 */
	static getFeatureOptionsForLevel (features, level, classFeatures = []) {
		const allOptions = [];

		for (const feature of features) {
			const featureOptions = CharacterSheetClassUtils.findFeatureOptions(feature, level, classFeatures);
			for (const optionGroup of featureOptions) {
				allOptions.push({
					featureName: feature.name,
					featureSource: feature.source,
					isSubclassFeature: feature.isSubclassFeature,
					...optionGroup,
				});
			}
		}

		return allOptions;
	}

	/**
	 * Look up a class feature by reference parts.
	 * @param {Array} classFeatures - All class features
	 * @param {string} featureName
	 * @param {string} className
	 * @param {string} source
	 * @param {number} level
	 * @returns {Object|null}
	 */
	static getClassFeatureByRef (classFeatures, featureName, className, source, level) {
		if (!classFeatures?.length) return null;

		return classFeatures.find(f => {
			if (f.name !== featureName) return false;
			if (f.className !== className) return false;
			if (f.level !== level) return false;
			if (source && f.source && f.source !== source) {
				return false;
			}
			return true;
		});
	}

	/**
	 * Look up full class feature data with flexible source matching.
	 * @param {Array} classFeatures - All class features
	 * @param {string} featureName
	 * @param {string} className
	 * @param {string} source
	 * @param {number} level
	 * @returns {Object|null}
	 */
	static getClassFeatureData (classFeatures, featureName, className, source, level) {
		if (!classFeatures?.length) return null;

		return classFeatures.find(f => {
			if (f.name !== featureName) return false;
			if (f.className !== className) return false;
			if (f.level !== level) return false;
			if (source && f.source && f.source !== source) {
				const sourcesMatch = [Parser.SRC_PHB, Parser.SRC_XPHB, "SRD"].includes(source)
					&& [Parser.SRC_PHB, Parser.SRC_XPHB, "SRD"].includes(f.source);
				if (!sourcesMatch) return false;
			}
			return true;
		}) || null;
	}

	/**
	 * Look up full class feature data from a reference string.
	 * @param {Array} classFeatures - All class features
	 * @param {string} featureRef - "FeatureName|ClassName|Source|Level" format
	 * @returns {Object|null}
	 */
	static getClassFeatureDataFromRef (classFeatures, featureRef) {
		const parts = featureRef.split("|");
		const [name, className, source, level] = parts;
		return CharacterSheetClassUtils.getClassFeatureData(classFeatures, name, className, source, parseInt(level) || 1);
	}

	/**
	 * Get all features gained at a specific class level (including subclass features).
	 * @param {Object} classData - The class data
	 * @param {number} level - The class level
	 * @param {Object|null} subclass - The subclass object (optional)
	 * @param {Array} classFeatures - All loaded class features (for description lookup)
	 * @returns {Array} Array of feature objects
	 */
	static getLevelFeatures (classData, level, subclass, classFeatures = []) {
		const features = [];

		// Get base class features for this level
		if (classData.classFeatures && Array.isArray(classData.classFeatures)) {
			const isArrayOfArrays = Array.isArray(classData.classFeatures[0]);
			const levelFeatures = isArrayOfArrays
				? classData.classFeatures[level - 1] || []
				: classData.classFeatures;

			const featureRefs = isArrayOfArrays
				? levelFeatures
				: levelFeatures.filter(f => {
					if (typeof f === "string") {
						const parts = f.split("|");
						return parseInt(parts[3]) === level;
					}
					if (typeof f === "object" && f.classFeature) {
						const parts = f.classFeature.split("|");
						return parseInt(parts[3]) === level;
					}
					return f.level === level;
				});

			featureRefs.forEach(featureRef => {
				if (typeof featureRef === "string") {
					const parts = featureRef.split("|");
					const featureName = parts[0];
					const className = parts[1] || classData.name;
					const classSource = parts[2] || classData.source;
					const featureSource = parts[4] || classSource;

					const fullFeature = CharacterSheetClassUtils.getClassFeatureData(classFeatures, featureName, className, classSource, level);

					features.push({
						name: featureName,
						className,
						classSource,
						source: featureSource,
						level,
						gainSubclassFeature: false,
						entries: fullFeature?.entries,
					});
				} else if (typeof featureRef === "object" && featureRef.classFeature) {
					const parts = featureRef.classFeature.split("|");
					const featureName = parts[0];
					const className = parts[1] || classData.name;
					const classSource = parts[2] || classData.source;
					const featureSource = parts[4] || classSource;

					const fullFeature = CharacterSheetClassUtils.getClassFeatureData(classFeatures, featureName, className, classSource, level);

					features.push({
						name: featureName,
						className,
						classSource,
						source: featureSource,
						level,
						gainSubclassFeature: !!featureRef.gainSubclassFeature,
						entries: fullFeature?.entries,
					});
				} else if (typeof featureRef === "object" && featureRef.name) {
					const classSource = featureRef.classSource || classData.source;
					const featureSource = featureRef.source || classSource;

					const fullFeature = CharacterSheetClassUtils.getClassFeatureData(classFeatures, featureRef.name, classData.name, classSource, level);

					features.push({
						name: featureRef.name,
						className: classData.name,
						classSource,
						source: featureSource,
						level,
						gainSubclassFeature: !!featureRef.gainSubclassFeature,
						entries: fullFeature?.entries,
					});
				}
			});
		}

		// Subclass features
		if (subclass && subclass.subclassFeatures) {
			subclass.subclassFeatures.forEach((levelFeatures, idx) => {
				if (Array.isArray(levelFeatures)) {
					levelFeatures.forEach(feature => {
						if (typeof feature === "object" && feature.level === level) {
							const featureName = feature.name || Renderer.findName(feature);
							if (featureName) {
								features.push({
									name: featureName,
									className: feature.className || subclass.className || classData.name,
									classSource: feature.classSource || subclass.classSource || classData.source,
									subclassName: subclass.name,
									subclassShortName: feature.subclassShortName || subclass.shortName,
									subclassSource: feature.subclassSource || subclass.source || classData.source,
									source: feature.source || subclass.source || classData.source,
									level: feature.level,
									entries: feature.entries,
									isSubclassFeature: true,
								});
							}
						} else if (typeof feature === "string") {
							const parts = feature.split("|");
							const featureLevel = parseInt(parts[parts.length - 1]);
							if (featureLevel === level) {
								features.push({
									name: parts[0],
									className: parts[1] || classData.name,
									classSource: parts[2] || classData.source,
									subclassName: subclass.name,
									subclassShortName: parts[3] || subclass.shortName,
									subclassSource: parts[4] || subclass.source || classData.source,
									source: parts[4] || subclass.source || classData.source,
									level: featureLevel,
									isSubclassFeature: true,
								});
							}
						}
					});
				} else if (typeof levelFeatures === "string") {
					const parts = levelFeatures.split("|");
					const featureLevel = parseInt(parts[parts.length - 1]);
					if (featureLevel === level) {
						features.push({
							name: parts[0],
							className: parts[1] || classData.name,
							classSource: parts[2] || classData.source,
							subclassName: subclass.name,
							subclassShortName: parts[3] || subclass.shortName,
							subclassSource: parts[4] || subclass.source || classData.source,
							source: parts[4] || subclass.source || classData.source,
							level: featureLevel,
							isSubclassFeature: true,
						});
					}
				}
			});
		}

		// Filter out placeholder "gain subclass feature" entries when actual subclass features exist
		const actualSubclassFeatures = features.filter(f => f.isSubclassFeature);
		if (actualSubclassFeatures.length > 0) {
			return features.filter(f => !f.gainSubclassFeature);
		}

		return features;
	}

	// ==========================================
	// Expertise & Language Detection
	// ==========================================

	/**
	 * Get expertise grants from features at a level.
	 * @param {Array} features - Features gained at the level
	 * @returns {Array} Array of {featureName, count, allowTools, toolName}
	 */
	static getExpertiseGrantsForLevel (features) {
		const grants = [];

		for (const feature of features) {
			const expertiseInfo = CharacterSheetClassUtils.findExpertiseInFeature(feature);
			if (expertiseInfo) {
				grants.push({
					featureName: feature.name,
					...expertiseInfo,
				});
			}
		}

		return grants;
	}

	/**
	 * Find expertise grant in a feature's entries.
	 * @param {Object} feature - Feature with entries
	 * @returns {{count: number, allowTools: boolean, toolName: string}|null}
	 */
	static findExpertiseInFeature (feature) {
		if (!feature?.entries) return null;

		if (feature.name === "Expertise") {
			return CharacterSheetClassUtils.parseExpertiseEntries(feature.entries);
		}

		return CharacterSheetClassUtils.findExpertiseInEntries(feature.entries);
	}

	/**
	 * Recursively search entries for nested Expertise grants.
	 * @param {Array} entries
	 * @returns {{count: number, allowTools: boolean, toolName: string}|null}
	 */
	static findExpertiseInEntries (entries) {
		for (const entry of entries) {
			if (typeof entry === "object" && entry.type === "entries") {
				if (entry.name === "Expertise") {
					return CharacterSheetClassUtils.parseExpertiseEntries(entry.entries || []);
				}
				if (CharacterSheetClassUtils.entryGrantsExpertise(entry.entries || [])) {
					return CharacterSheetClassUtils.parseExpertiseEntries(entry.entries || []);
				}
				if (entry.entries) {
					const result = CharacterSheetClassUtils.findExpertiseInEntries(entry.entries);
					if (result) return result;
				}
			}
		}
		return null;
	}

	/**
	 * Check if entries text indicates an expertise grant.
	 * @param {Array} entries
	 * @returns {boolean}
	 */
	static entryGrantsExpertise (entries) {
		const entriesText = entries.map(e => typeof e === "string" ? e : JSON.stringify(e)).join(" ").toLowerCase();
		return entriesText.includes("proficiency bonus is doubled")
			|| entriesText.includes("gain expertise")
			|| entriesText.includes("double your proficiency bonus");
	}

	/**
	 * Parse expertise entries to determine count and tool allowance.
	 * @param {Array} entries
	 * @returns {{count: number, allowTools: boolean, toolName: string}}
	 */
	static parseExpertiseEntries (entries) {
		const entriesText = entries.map(e => typeof e === "string" ? e : JSON.stringify(e)).join(" ").toLowerCase();

		let count = 1;

		if (entriesText.match(/(?:choose|pick|select|gain|get)\s+(?:two|2)\s+(?:skills?|proficienc)/i)
			|| entriesText.match(/two\s+(?:of\s+)?(?:your\s+)?skill(?:\s+proficienc)?/i)) {
			count = 2;
		}
		if (entriesText.match(/(?:choose|pick|select|gain|get)\s+(?:one|1|a)\s+(?:skill|proficienc)/i)
			|| entriesText.match(/one\s+(?:of\s+)?(?:your\s+)?skill(?:\s+proficienc)?/i)) {
			count = 1;
		}
		if (entriesText.includes("another")) count = 1;
		if (entriesText.includes("three") && entriesText.includes("expertise")) count = 3;
		if (entriesText.includes("four") && entriesText.includes("expertise")) count = 4;

		const allowTools = entriesText.includes("thieves' tools") && !entriesText.includes("variantrule");

		return {
			count,
			allowTools,
			toolName: allowTools ? "Thieves' Tools" : null,
		};
	}

	/**
	 * Get language grants from features at a level.
	 * @param {Array} features - Features gained at the level
	 * @returns {Array} Array of {featureName, count}
	 */
	static getLanguageGrantsForLevel (features) {
		const grants = [];

		for (const feature of features) {
			const langInfo = CharacterSheetClassUtils.findLanguageGrantsInFeature(feature);
			if (langInfo) {
				grants.push({
					featureName: feature.name,
					count: langInfo.count,
				});
			}
		}

		return grants;
	}

	/**
	 * Find language grant in a feature's entries.
	 * @param {Object} feature
	 * @returns {{count: number}|null}
	 */
	static findLanguageGrantsInFeature (feature) {
		if (!feature?.entries) return null;
		return CharacterSheetClassUtils.findLanguageGrantsInEntries(feature.entries, feature.name);
	}

	/**
	 * Recursively search entries for language grants.
	 * @param {Array} entries
	 * @param {string} featureName
	 * @returns {{count: number}|null}
	 */
	static findLanguageGrantsInEntries (entries, featureName) {
		const entriesText = entries.map(e => {
			if (typeof e === "string") return e;
			if (typeof e === "object" && e.type === "list" && e.items) {
				return e.items.map(item => typeof item === "string" ? item : JSON.stringify(item)).join(" ");
			}
			return JSON.stringify(e);
		}).join(" ").toLowerCase();

		const langPatterns = [
			/learn\s+(one|two|three|four|\d+)\s+(?:additional\s+)?languages?/i,
			/speak,?\s*read,?\s*and\s*write\s+(one|two|three|four|\d+)\s+(?:additional\s+)?languages?/i,
			/two\s+(?:additional\s+)?languages?\s+of\s+your\s+choice/i,
			/one\s+(?:additional\s+)?language\s+of\s+your\s+choice/i,
			/\{@b Languages?\.\}\s*You\s+learn\s+(one|two|three|four|\d+)\s+languages?/i,
		];

		for (const pattern of langPatterns) {
			const match = entriesText.match(pattern);
			if (match) {
				let count = 0;
				const numWord = match[1]?.toLowerCase();
				if (numWord === "one" || numWord === "1") count = 1;
				else if (numWord === "two" || numWord === "2") count = 2;
				else if (numWord === "three" || numWord === "3") count = 3;
				else if (numWord === "four" || numWord === "4") count = 4;
				else if (/^\d+$/.test(numWord)) count = parseInt(numWord);

				if (count === 0 && entriesText.includes("two additional languages")) count = 2;
				if (count === 0 && entriesText.includes("two languages of your choice")) count = 2;
				if (count === 0 && entriesText.includes("one additional language")) count = 1;
				if (count === 0 && entriesText.includes("one language of your choice")) count = 1;

				if (count > 0) return {count};
			}
		}

		// Recursively check nested entries
		for (const entry of entries) {
			if (typeof entry === "object" && entry.entries) {
				const result = CharacterSheetClassUtils.findLanguageGrantsInEntries(entry.entries, featureName);
				if (result) return result;
			}
		}

		return null;
	}

	// ==========================================
	// Combat Tradition Helpers
	// ==========================================

	/**
	 * Map a tradition code to its full name.
	 * @param {string} tradCode - Two-letter code
	 * @returns {string}
	 */
	static getTraditionName (tradCode) {
		const names = {
			"AM": "Adamant Mountain",
			"AK": "Arcane Knight",
			"BU": "Beast Unity",
			"BZ": "Biting Zephyr",
			"CJ": "Comedic Jabs",
			"EB": "Eldritch Blackguard",
			"GH": "Gallant Heart",
			"MG": "Mirror's Glint",
			"MS": "Mist and Shade",
			"RC": "Rapid Current",
			"RE": "Razor's Edge",
			"SK": "Sanguine Knot",
			"SS": "Spirited Steed",
			"TI": "Tempered Iron",
			"TC": "Tooth and Claw",
			"UW": "Unending Wheel",
			"UH": "Unerring Hawk",
		};
		return names[tradCode] || tradCode;
	}

	/**
	 * Get known combat traditions from existing optional features on the character.
	 * @param {Array} existingOptFeatures - Character's existing optional features
	 * @param {Object} state - Character state (for getCombatTraditions)
	 * @returns {Array<string>} Array of tradition codes
	 */
	static getKnownCombatTraditions (existingOptFeatures, state) {
		// First check explicitly stored traditions
		const storedTraditions = state.getCombatTraditions?.() || [];
		if (storedTraditions.length > 0) return storedTraditions;

		// Fall back to inferring from existing combat method features
		const traditions = new Set();
		for (const feature of existingOptFeatures) {
			if (!feature.optionalFeatureTypes) continue;
			for (const ft of feature.optionalFeatureTypes) {
				const match = ft.match(/^CTM:(\d)?([A-Z]{2})$/);
				if (match) traditions.add(match[2]);
			}
		}
		return Array.from(traditions);
	}

	/**
	 * Get the maximum method degree available at a given level from the class table.
	 * @param {Object} cls - Class data
	 * @param {number} level - Class level
	 * @returns {number}
	 */
	static getMaxMethodDegree (cls, level) {
		if (!cls.classTableGroups) return 0;

		for (const group of cls.classTableGroups) {
			const degreeColIdx = group.colLabels?.findIndex(label =>
				label.toLowerCase().includes("method degree"),
			);

			if (degreeColIdx >= 0 && group.rows) {
				const row = group.rows[level - 1];
				if (row) {
					const degreeVal = row[degreeColIdx];
					if (typeof degreeVal === "string") {
						const match = degreeVal.match(/^(\d)/);
						if (match) return parseInt(match[1]);
					} else if (typeof degreeVal === "number") {
						return degreeVal;
					}
				}
			}
		}
		return 0;
	}

	/**
	 * Get available combat traditions from optional features.
	 * @param {Array} allOptFeatures - All optional features
	 * @returns {Array<{code: string, name: string}>}
	 */
	static getAvailableTraditions (allOptFeatures) {
		const traditions = new Map();

		for (const opt of allOptFeatures) {
			if (!opt.featureType) continue;
			for (const ft of opt.featureType) {
				const match = ft.match(/^CTM:\d([A-Z]{2})$/);
				if (match) {
					const tradCode = match[1];
					if (!traditions.has(tradCode)) {
						traditions.set(tradCode, {
							code: tradCode,
							name: CharacterSheetClassUtils.getTraditionName(tradCode),
						});
					}
				}
			}
		}

		return Array.from(traditions.values()).sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Extract tradition codes from a class's Combat Methods feature description.
	 * @param {string} className
	 * @param {number} level
	 * @param {Array} classFeatures - All loaded class features
	 * @returns {Set<string>} Set of tradition codes
	 */
	static extractTraditionsFromClassFeature (className, level, classFeatures) {
		const traditions = new Set();
		if (!classFeatures?.length) return traditions;

		const combatMethodsFeature = classFeatures.find(f =>
			f.className === className
			&& f.name === "Combat Methods"
			&& f.level <= 5,
		);

		if (!combatMethodsFeature) return traditions;

		const extractFromEntries = (entries) => {
			if (!entries) return;
			if (typeof entries === "string") {
				const matches = entries.matchAll(/feature\s+type[=:]\s*ctm:([a-z]{2})/gi);
				for (const match of matches) {
					traditions.add(match[1].toUpperCase());
				}
				return;
			}
			if (Array.isArray(entries)) {
				for (const entry of entries) extractFromEntries(entry);
				return;
			}
			if (typeof entries === "object") {
				if (entries.entries) extractFromEntries(entries.entries);
				if (entries.items) extractFromEntries(entries.items);
				if (entries.entry) extractFromEntries(entries.entry);
			}
		};

		extractFromEntries(combatMethodsFeature.entries);
		return traditions;
	}

	/**
	 * Get available combat traditions filtered by what the class has access to.
	 * @param {Array} allOptFeatures
	 * @param {Array<string>} classAllowedTypes
	 * @param {string} className
	 * @param {Array} classFeatures
	 * @returns {Array<{code: string, name: string}>}
	 */
	static getAvailableTraditionsForClass (allOptFeatures, classAllowedTypes, className, classFeatures) {
		const allowedTraditionCodes = new Set();
		for (const ft of classAllowedTypes) {
			const match = ft.match(/^CTM:(\d)?([A-Z]{2})$/);
			if (match && match[2]) allowedTraditionCodes.add(match[2]);
		}

		if (allowedTraditionCodes.size === 0 && className) {
			const featureTraditions = CharacterSheetClassUtils.extractTraditionsFromClassFeature(className, 2, classFeatures);
			for (const trad of featureTraditions) allowedTraditionCodes.add(trad);
		}

		if (allowedTraditionCodes.size === 0) {
			return CharacterSheetClassUtils.getAvailableTraditions(allOptFeatures);
		}

		const traditions = new Map();
		for (const tradCode of allowedTraditionCodes) {
			traditions.set(tradCode, {
				code: tradCode,
				name: CharacterSheetClassUtils.getTraditionName(tradCode),
			});
		}

		return Array.from(traditions.values()).sort((a, b) => a.name.localeCompare(b.name));
	}

	// ==========================================
	// State Builder Helpers
	// ==========================================

	/**
	 * Build a spell state object ready for state.addSpell().
	 * Single source of truth — includes all enrichment fields.
	 * @param {Object} spell - Raw spell data
	 * @param {Object} opts
	 * @param {string} opts.sourceFeature - e.g. "Wizard Spellbook", "Spells Known"
	 * @param {string} opts.sourceClass - e.g. "Wizard", "Sorcerer"
	 * @param {boolean} [opts.prepared=false] - Whether spell is prepared
	 * @param {boolean} [opts.inSpellbook=false] - Whether spell is in spellbook
	 * @returns {Object} Spell state object
	 */
	static buildSpellStateObject (spell, {sourceFeature, sourceClass, prepared = false, inSpellbook = false}) {
		return {
			name: spell.name,
			source: spell.source,
			level: spell.level,
			school: spell.school,
			ritual: CharacterSheetClassUtils.spellIsRitual(spell),
			concentration: CharacterSheetClassUtils.spellIsConcentration(spell),
			prepared,
			inSpellbook,
			sourceFeature,
			sourceClass,
			castingTime: CharacterSheetClassUtils.getSpellCastingTime(spell),
			range: CharacterSheetClassUtils.getSpellRange(spell),
			components: CharacterSheetClassUtils.getSpellComponents(spell),
			duration: CharacterSheetClassUtils.getSpellDuration(spell),
			subschools: spell.subschools || [],
		};
	}

	/**
	 * Build a cantrip state object ready for state.addCantrip().
	 * @param {Object} spell - Raw cantrip data
	 * @param {Object} opts
	 * @param {string} opts.sourceFeature
	 * @param {string} opts.sourceClass
	 * @returns {Object} Cantrip state object
	 */
	static buildCantripStateObject (spell, {sourceFeature, sourceClass}) {
		return {
			name: spell.name,
			source: spell.source,
			school: spell.school,
			sourceFeature,
			sourceClass,
			castingTime: CharacterSheetClassUtils.getSpellCastingTime(spell),
			range: CharacterSheetClassUtils.getSpellRange(spell),
			components: CharacterSheetClassUtils.getSpellComponents(spell),
			duration: CharacterSheetClassUtils.getSpellDuration(spell),
			subschools: spell.subschools || [],
		};
	}

	/**
	 * Dedup features and build state objects for addFeature().
	 * Filters out ASI placeholders, gainSubclassFeature entries, and already-existing features.
	 * @param {Array} features - Raw features for this level
	 * @param {Array<string>} existingFeatureNames - Lowercase names already on the character
	 * @param {Object} opts
	 * @param {string} opts.className
	 * @param {string} opts.classSource
	 * @param {number} opts.level
	 * @returns {Array} Array of feature data objects ready for state.addFeature()
	 */
	static dedupAndBuildFeatures (features, existingFeatureNames, {className, classSource, level}) {
		const asiFeatureNames = ["ability score improvement", "ability score increase", "asi"];

		const featuresToAdd = features.filter(f => {
			if (f.gainSubclassFeature) return false;
			const nameLower = f.name.toLowerCase();
			if (asiFeatureNames.some(asi => nameLower.includes(asi))) return false;
			if (!f.isSubclassFeature && !f.subclassName && existingFeatureNames.includes(nameLower)) return false;
			return true;
		});

		return featuresToAdd.map(feature => {
			let description = feature.description;
			if (!description && feature.entries) {
				try { description = Renderer.get().render({entries: feature.entries}); } catch (e) { description = ""; }
			}
			return {
				name: feature.name,
				source: feature.source || classSource,
				className: feature.className || className,
				classSource: feature.classSource || classSource,
				level: feature.level || level,
				subclassName: feature.subclassName,
				subclassShortName: feature.subclassShortName,
				subclassSource: feature.subclassSource,
				featureType: "Class",
				description: description || "",
				entries: feature.entries,
				isSubclassFeature: feature.isSubclassFeature,
			};
		});
	}

	// ==========================================
	// State Mutation Helpers
	// ==========================================

	/**
	 * Apply feat ability/skill/language bonuses to state.
	 * @param {Object} state - CharacterSheetState instance
	 * @param {Object} feat - The feat object
	 */
	static applyFeatBonuses (state, feat) {
		if (feat.ability) {
			feat.ability.forEach(ablChoice => {
				const max = ablChoice.max || 20;

				if (ablChoice.choose) {
					if (feat._epicBoonAbilityChoice) {
						const {ability, amount} = feat._epicBoonAbilityChoice;
						const current = state.getAbilityBase(ability);
						state.setAbilityBase(ability, Math.min(max, current + amount));
					}
				} else {
					Object.entries(ablChoice).forEach(([abl, bonus]) => {
						if (abl === "max") return;
						if (Parser.ABIL_ABVS.includes(abl)) {
							const current = state.getAbilityBase(abl);
							state.setAbilityBase(abl, Math.min(max, current + bonus));
						}
					});
				}
			});
		}

		if (feat.skillProficiencies) {
			feat.skillProficiencies.forEach(sp => {
				Object.keys(sp).forEach(skill => {
					if (skill !== "choose" && skill !== "any") {
						state.addSkillProficiency(skill.toLowerCase().replace(/\s+/g, ""));
					}
				});
			});
		}

		if (feat.languageProficiencies) {
			feat.languageProficiencies.forEach(lp => {
				Object.keys(lp).forEach(lang => {
					if (lang !== "anyStandard" && lang !== "any") {
						state.addLanguage(lang);
					}
				});
			});
		}
	}

	/**
	 * Update hit dice tracking after gaining a level.
	 * @param {Object} state - CharacterSheetState instance
	 * @param {Object} classData
	 */
	static updateHitDice (state, classData) {
		const hitDie = `d${CharacterSheetClassUtils.getClassHitDie(classData)}`;
		const hitDice = state.getHitDiceByType();

		if (!hitDice[hitDie]) {
			hitDice[hitDie] = {current: 1, max: 1};
		} else {
			hitDice[hitDie].max += 1;
			hitDice[hitDie].current += 1;
		}

		state.setHitDice(hitDice);
	}

	/**
	 * Update class resources (Rage, Ki, Sorcery Points, etc.) after leveling up.
	 * @param {Object} state - CharacterSheetState instance
	 * @param {Object} classEntry - Class entry from state {name, source}
	 * @param {number} newLevel - New class level
	 * @param {Object} classData - Full class data
	 */
	static updateClassResources (state, classEntry, newLevel, classData) {
		const resourceDefs = {
			"Barbarian": [
				{name: "Rage", maxByLevel: [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 999], recharge: "long"},
			],
			"Monk": [
				{name: "__MONK_RESOURCE__", maxByLevel: lvl => lvl >= 2 ? lvl : 0, recharge: "short"},
			],
			"Sorcerer": [
				{name: "Sorcery Points", maxByLevel: lvl => lvl >= 2 ? lvl : 0, recharge: "long"},
			],
			"Paladin": [
				{name: "Lay on Hands", maxByLevel: lvl => lvl * 5, recharge: "long"},
			],
			"Bard": [
				{name: "Bardic Inspiration", maxByLevel: () => Math.max(1, state.getAbilityMod("cha")), recharge: newLevel >= 5 ? "short" : "long"},
			],
		};

		const classResourceDefs = resourceDefs[classData.name];
		if (!classResourceDefs) {
			state.recalculateResourceMaximums();
			return;
		}

		const currentResources = state.getResources();

		classResourceDefs.forEach(resourceDef => {
			let resourceName = resourceDef.name;
			if (resourceName === "__MONK_RESOURCE__") {
				const is2024 = classEntry.source === "XPHB" || classData.source === "XPHB";
				resourceName = is2024 ? "Focus Points" : "Ki Points";
			}

			let newMax;
			if (typeof resourceDef.maxByLevel === "function") {
				newMax = resourceDef.maxByLevel(newLevel);
			} else if (Array.isArray(resourceDef.maxByLevel)) {
				newMax = resourceDef.maxByLevel[newLevel - 1] || 0;
			} else {
				newMax = resourceDef.maxByLevel;
			}

			const isMonkResource = resourceName === "Ki Points" || resourceName === "Focus Points";
			let existingResource;
			if (isMonkResource) {
				existingResource = currentResources.find(r => r.name === "Ki Points" || r.name === "Focus Points");
			} else {
				existingResource = currentResources.find(r => r.name === resourceName);
			}

			if (existingResource) {
				const oldMax = existingResource.max;
				if (newMax > oldMax) {
					existingResource.max = newMax;
					existingResource.current += (newMax - oldMax);
				}
			} else if (newMax > 0) {
				state.addResource({
					name: resourceName,
					max: newMax,
					current: newMax,
					recharge: resourceDef.recharge,
				});
			}
		});

		state.recalculateResourceMaximums();
	}

	/**
	 * Update spell slots after leveling up.
	 * @param {Object} state - CharacterSheetState instance
	 * @param {Object} classEntry - Class entry from state
	 * @param {number} newLevel - New class level
	 * @param {Object} classData - Full class data
	 */
	static updateSpellSlots (state, classEntry, newLevel, classData) {
		const spellcastingAbility = CharacterSheetClassUtils.getSpellcastingAbility(classData);
		if (!spellcastingAbility) return;

		const classes = state.getClasses();
		const isMulticlass = classes.length > 1;

		if (isMulticlass) {
			state.calculateSpellSlots();
		} else {
			const slots = CharacterSheetClassUtils.getSpellSlotsForLevel(classData, newLevel);

			const spellcasting = state.getSpellcasting();
			spellcasting.ability = spellcastingAbility;

			Object.entries(slots).forEach(([level, count]) => {
				if (!spellcasting.spellSlots[level]) {
					spellcasting.spellSlots[level] = {current: count, max: count};
				} else {
					const diff = count - spellcasting.spellSlots[level].max;
					if (diff > 0) {
						spellcasting.spellSlots[level].max = count;
						spellcasting.spellSlots[level].current += diff;
					}
				}
			});
		}
	}

	/**
	 * Get the spell slot table for a class at a given level.
	 * @param {Object} classData
	 * @param {number} level
	 * @returns {Object} Map of spell level → slot count
	 */
	static getSpellSlotsForLevel (classData, level) {
		const fullCasterSlots = {
			1: {1: 2}, 2: {1: 3}, 3: {1: 4, 2: 2}, 4: {1: 4, 2: 3},
			5: {1: 4, 2: 3, 3: 2}, 6: {1: 4, 2: 3, 3: 3}, 7: {1: 4, 2: 3, 3: 3, 4: 1},
			8: {1: 4, 2: 3, 3: 3, 4: 2}, 9: {1: 4, 2: 3, 3: 3, 4: 3, 5: 1},
			10: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2}, 11: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1},
			12: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1}, 13: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1},
			14: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1}, 15: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1},
			16: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1}, 17: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1},
			18: {1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1}, 19: {1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1},
			20: {1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1},
		};

		const halfCasterSlots = {
			2: {1: 2}, 3: {1: 3}, 4: {1: 3}, 5: {1: 4, 2: 2}, 6: {1: 4, 2: 2},
			7: {1: 4, 2: 3}, 8: {1: 4, 2: 3}, 9: {1: 4, 2: 3, 3: 2}, 10: {1: 4, 2: 3, 3: 2},
			11: {1: 4, 2: 3, 3: 3}, 12: {1: 4, 2: 3, 3: 3}, 13: {1: 4, 2: 3, 3: 3, 4: 1},
			14: {1: 4, 2: 3, 3: 3, 4: 1}, 15: {1: 4, 2: 3, 3: 3, 4: 2}, 16: {1: 4, 2: 3, 3: 3, 4: 2},
			17: {1: 4, 2: 3, 3: 3, 4: 3, 5: 1}, 18: {1: 4, 2: 3, 3: 3, 4: 3, 5: 1},
			19: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2}, 20: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2},
		};

		const fullCasters = ["Wizard", "Sorcerer", "Cleric", "Druid", "Bard"];
		const halfCasters = ["Paladin", "Ranger"];

		if (fullCasters.includes(classData.name)) return fullCasterSlots[level] || {};
		if (halfCasters.includes(classData.name)) return halfCasterSlots[level] || {};
		return {};
	}

	/**
	 * Check for and add racial spells at the current character level.
	 * @param {Object} state - CharacterSheetState instance
	 * @param {Object} page - CharacterSheetPage instance (for getSpells)
	 */
	static updateRacialSpells (state, page) {
		const race = state.getRace();
		if (!race?.additionalSpells?.length) return;

		const totalLevel = state.getTotalLevel();
		const allSpells = page.getSpells();
		const raceName = race.name;
		const subraceName = race._subraceName || race.subrace;

		race.additionalSpells.forEach(spellBlock => {
			if (spellBlock.name) {
				if (!subraceName || spellBlock.name.toLowerCase() !== subraceName.toLowerCase()) return;
			}

			if (spellBlock.known) {
				Object.entries(spellBlock.known).forEach(([levelStr, spellsAtLevel]) => {
					const charLevel = parseInt(levelStr);
					if (charLevel !== totalLevel) return;
					CharacterSheetClassUtils._processRacialSpellList(state, spellsAtLevel, allSpells, raceName);
				});
			}

			if (spellBlock.innate) {
				Object.entries(spellBlock.innate).forEach(([levelStr, spellConfig]) => {
					const charLevel = parseInt(levelStr);
					if (charLevel !== totalLevel) return;

					if (typeof spellConfig === "object") {
						if (spellConfig.daily) {
							Object.entries(spellConfig.daily).forEach(([uses, spellList]) => {
								CharacterSheetClassUtils._processRacialInnateSpells(state, spellList, allSpells, raceName, parseInt(uses), "long");
							});
						}
						if (spellConfig.rest) {
							Object.entries(spellConfig.rest).forEach(([uses, spellList]) => {
								CharacterSheetClassUtils._processRacialInnateSpells(state, spellList, allSpells, raceName, parseInt(uses), "short");
							});
						}
						if (Array.isArray(spellConfig)) {
							CharacterSheetClassUtils._processRacialInnateSpells(state, spellConfig, allSpells, raceName, 0, null);
						}
					} else if (Array.isArray(spellConfig)) {
						CharacterSheetClassUtils._processRacialInnateSpells(state, spellConfig, allSpells, raceName, 0, null);
					}
				});
			}
		});
	}

	/** @private */
	static _processRacialSpellList (state, spellList, allSpells, sourceName) {
		if (!Array.isArray(spellList)) {
			if (typeof spellList === "object" && spellList._) {
				CharacterSheetClassUtils._processRacialSpellList(state, spellList._, allSpells, sourceName);
			}
			return;
		}

		spellList.forEach(spellRef => {
			const spellData = CharacterSheetClassUtils._resolveSpellReference(spellRef, allSpells);
			if (spellData) {
				const existing = state.getSpells().find(s =>
					s.name === spellData.name && s.source === spellData.source,
				);
				if (existing) return;

				state.addSpell(CharacterSheetClassUtils.buildSpellStateObject(spellData, {
					sourceFeature: sourceName,
					sourceClass: "",
					prepared: spellData.level === 0,
				}));
			}
		});
	}

	/** @private */
	static _processRacialInnateSpells (state, spellList, allSpells, sourceName, uses, recharge) {
		if (!Array.isArray(spellList)) return;

		spellList.forEach(spellRef => {
			const spellData = CharacterSheetClassUtils._resolveSpellReference(spellRef, allSpells);
			if (spellData) {
				const existing = state.getInnateSpells().find(s =>
					s.name === spellData.name && s.source === spellData.source,
				);
				if (existing) return;

				const atWill = uses === 0;
				state.addInnateSpell({
					name: spellData.name,
					source: spellData.source,
					level: spellData.level,
					atWill,
					uses: atWill ? null : uses,
					recharge,
					sourceFeature: sourceName,
				});
			}
		});
	}

	/** @private */
	static _resolveSpellReference (spellRef, allSpells) {
		if (typeof spellRef !== "string") return null;

		let spellName = spellRef.replace(/#c$/, "");
		let source = null;

		const parts = spellName.split("|");
		spellName = parts[0].toLowerCase();
		if (parts.length > 1) source = parts[1].toUpperCase();

		return allSpells.find(s => {
			const nameMatch = s.name.toLowerCase() === spellName;
			if (!nameMatch) return false;
			if (source) return s.source === source;
			return true;
		});
	}

	// ------------------------------------------------------------------
	// Optional Feature Progression
	// ------------------------------------------------------------------

	/**
	 * Compute optional feature gains between currentLevel and newLevel.
	 * @param {object} classData - The class data object
	 * @param {number} currentLevel - Previous class level
	 * @param {number} newLevel - New class level
	 * @param {object} state - Character state (needs getFeatures())
	 * @returns {Array} Array of gain objects
	 */
	static getOptionalFeatureGains (classData, currentLevel, newLevel, state) {
		const gains = [];
		if (!classData.optionalfeatureProgression?.length) return gains;

		classData.optionalfeatureProgression.forEach(optFeatProg => {
			const featureTypes = optFeatProg.featureType || [];
			const name = optFeatProg.name || featureTypes.map(ft => ft.replace(/:/g, " ")).join(", ");

			let countAtCurrent = 0;
			let countAtNew = 0;

			if (Array.isArray(optFeatProg.progression)) {
				countAtCurrent = optFeatProg.progression[currentLevel - 1] || 0;
				countAtNew = optFeatProg.progression[newLevel - 1] || 0;
			} else if (typeof optFeatProg.progression === "object") {
				countAtCurrent = optFeatProg.progression[String(currentLevel)] || 0;
				countAtNew = optFeatProg.progression[String(newLevel)] || 0;
			}

			const existingOptFeatures = state.getFeatures().filter(f => f.featureType === "Optional Feature");

			const matchesFeatureType = (optFeatTypes) => {
				return optFeatTypes?.some(ft =>
					featureTypes.some(progType => ft === progType || ft.startsWith(progType)),
				);
			};

			const existingOfType = existingOptFeatures.filter(f =>
				matchesFeatureType(f.optionalFeatureTypes),
			).length;

			const newOptionsCount = countAtNew - existingOfType;
			if (newOptionsCount > 0) {
				gains.push({
					featureTypes,
					name,
					currentCount: existingOfType,
					totalCount: countAtNew,
					newCount: newOptionsCount,
					required: optFeatProg.required || false,
				});
			}
		});

		return gains;
	}
}

// Export
export {CharacterSheetClassUtils};
globalThis.CharacterSheetClassUtils = CharacterSheetClassUtils;
