/**
 * Character Sheet Quick Build
 * A guided wizard that allows players to create/level a character to any target level (1–20)
 * in one streamlined flow, collecting all leveling choices (subclass, ASIs/feats, optional features,
 * expertise, spells, HP) and batch-applying them.
 *
 * Supports:
 * - Single class and multiclass builds
 * - Entry from both the Builder (new characters) and header button (existing characters)
 * - Full interactive wizard with all choice points
 * - Average or rolled HP
 * - Batch spell selection
 */
class CharacterSheetQuickBuild {
	constructor (page) {
		this._page = page;
		this._state = page.getState();

		// Wizard navigation state
		this._currentStep = 0;
		this._steps = [];

		// Selection state
		this._targetLevel = 2;
		this._classAllocations = []; // [{classData, source, targetLevel, startLevel, order}]
		this._fromLevel = 0; // Starting character level (0 for new, >0 for existing)

		// Per-level analysis results
		this._levelAnalysis = []; // [{level, classData, classEntry, needsSubclass, hasAsi, ...}]

		// Collected choices
		this._selections = {
			subclasses: {}, // {className: subclassData}
			asi: {}, // {levelKey: {abilityChoices: {}, feat: null, isBoth: false}}
			optionalFeatures: {}, // {levelKey: {featureTypeKey: [optionObj, ...]}}
			featureOptions: {}, // {levelKey: {featureKey: [optionObj, ...]}}
			expertise: {}, // {levelKey: {featureName: [skill, ...]}}
			languages: {}, // {levelKey: {featureName: [language, ...]}}
			scholarSkill: null,
			spellbookSpells: [], // [{name, source, level, ...}]
			spells: [], // batch spell selections
			hpMethod: "average", // "average" or "roll"
			hpRolls: {}, // {levelKey: rollResult}
		};

		// Modal/overlay reference
		this._$overlay = null;
		this._isActive = false;

		// Resolve references for level-up shared logic
		this._levelUpModule = null;
	}

	// ==========================================
	// Public API
	// ==========================================

	/**
	 * Show the Quick Build wizard for an existing character
	 * Entry point from the header "Quick Build" button
	 */
	async showQuickBuild () {
		const totalLevel = this._state.getTotalLevel();
		if (totalLevel >= 20) {
			JqueryUtil.doToast({type: "warning", content: "Character is already at maximum level (20)."});
			return;
		}
		if (totalLevel < 1) {
			JqueryUtil.doToast({type: "warning", content: "Please create a character first using the Builder."});
			return;
		}

		this._fromLevel = totalLevel;
		this._targetLevel = Math.min(20, totalLevel + 1);

		// Pre-fill class allocations from existing classes
		this._classAllocations = this._state.getClasses().map(c => ({
			className: c.name,
			classSource: c.source,
			classData: null, // Will be resolved
			currentLevel: c.level,
			targetLevel: c.level, // Start with current levels
			subclass: c.subclass || null,
		}));

		this._resetSelections();
		await this._showWizard();
	}

	/**
	 * Show the Quick Build wizard during character creation (Builder handoff)
	 * @param {Object} opts
	 * @param {Object} opts.classData - The selected class data
	 * @param {number} opts.targetLevel - Target level to build to
	 */
	async showFromBuilder ({classData, targetLevel}) {
		this._fromLevel = 1; // Builder creates at level 1
		this._targetLevel = targetLevel;

		this._classAllocations = [{
			className: classData.name,
			classSource: classData.source,
			classData: classData,
			currentLevel: 1,
			targetLevel: targetLevel,
			subclass: null,
		}];

		this._resetSelections();
		await this._showWizard();
	}

	/**
	 * Check if Quick Build is currently active
	 */
	get isActive () { return this._isActive; }

	// ==========================================
	// Selection Reset
	// ==========================================

	_resetSelections () {
		this._selections = {
			subclasses: {},
			asi: {},
			optionalFeatures: {},
			featureOptions: {},
			expertise: {},
			languages: {},
			scholarSkill: null,
			spellbookSpells: [],
			knownSpells: [], // Known-caster spells (Sorcerer, Bard, etc.)
			knownCantrips: [], // Known-caster cantrips
			spells: [],
			hpMethod: "average",
			hpRolls: {},
		};
		this._levelAnalysis = [];
		this._steps = [];
		this._currentStep = 0;
	}

	// ==========================================
	// Level Analysis Engine
	// ==========================================

	/**
	 * Resolve class data objects from the page's loaded data
	 */
	_resolveClassData () {
		const allClasses = this._page.getClasses();
		for (const alloc of this._classAllocations) {
			if (!alloc.classData) {
				alloc.classData = allClasses.find(c => c.name === alloc.className && c.source === alloc.classSource);
			}
		}
	}

	/**
	 * Analyze all levels from current to target, determining what choices are needed at each level.
	 * Returns an array of per-level analysis objects.
	 */
	_analyzeLevels () {
		this._resolveClassData();
		this._levelAnalysis = [];

		// Build a level-by-level plan: which class gains a level at each character level
		const levelPlan = this._buildLevelPlan();

		// Track running state for analysis
		let runningOptionalFeatureCounts = {}; // {featureTypeKey: count}

		for (const planEntry of levelPlan) {
			const {characterLevel, className, classSource, classLevel, classData} = planEntry;

			if (!classData) {
				console.warn(`[QuickBuild] No class data found for ${className}`);
				continue;
			}

			// Get the subclass (may have been selected in an earlier level's choice)
			const subclass = this._getSubclassForClass(className, classSource, classLevel);

			// Get features for this class level
			const features = this._getLevelFeatures(classData, classLevel, subclass);

			// Check what choices this level requires
			const needsSubclass = this._levelGrantsSubclass(classData, classLevel)
				&& !this._hasSubclass(className, classSource);

			const hasAsi = this._levelGrantsAsi(classData, classLevel);

			const optionalFeatureGains = this._getOptionalFeatureGains(
				classData, classLevel, runningOptionalFeatureCounts,
			);

			const featureOptions = this._getFeatureOptionsForLevel(features, classLevel)
				// Filter out option groups where ALL options are optional features — those are
				// handled by optionalfeatureProgression in the Class Options step (e.g. Battle Tactics)
				.filter(optGroup => !optGroup.options.every(opt => opt.type === "optionalfeature"));
			const expertiseGrants = this._getExpertiseGrantsForLevel(features);
			const languageGrants = this._getLanguageGrantsForLevel(features);

			// Check for Wizard-specific features
			const isWizard = classData.name === "Wizard";
			const isXPHBWizard = isWizard && (classSource === "XPHB" || classData.source === "XPHB");
			const isScholarLevel = isXPHBWizard && classLevel === 2;
			const isSpellbookLevel = isWizard && classLevel >= 2;

			// Known-spell caster detection (Sorcerer, Bard, Ranger, Warlock, etc.)
			let isKnownCaster = false;
			let knownSpellsGainAtLevel = 0;
			let knownCantripsGainAtLevel = 0;
			let knownMaxSpellLevel = 0;

			if (!isWizard && !classData.preparedSpellsProgression) {
				const spellsKnownTables = {
					"Bard": [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
					"Sorcerer": [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
					"Warlock": [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
					"Ranger": [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
				};
				const cantripTables = {
					"Bard": [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
					"Sorcerer": [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
					"Warlock": [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
				};

				const prog = classData.spellsKnownProgression || spellsKnownTables[className];
				if (prog) {
					isKnownCaster = true;
					const prevKnown = classLevel >= 2 ? (prog[classLevel - 2] || 0) : 0;
					const newKnown = prog[classLevel - 1] || 0;
					knownSpellsGainAtLevel = Math.max(0, newKnown - prevKnown);

					const cProg = classData.cantripProgression || cantripTables[className];
					if (cProg) {
						const prevCantrips = classLevel >= 2 ? (cProg[classLevel - 2] || 0) : 0;
						const newCantrips = cProg[classLevel - 1] || 0;
						knownCantripsGainAtLevel = Math.max(0, newCantrips - prevCantrips);
					}

					const casterProg = classData.casterProgression;
					if (casterProg === "full" || !casterProg) {
						knownMaxSpellLevel = Math.min(9, Math.ceil(classLevel / 2));
					} else if (casterProg === "1/2") {
						knownMaxSpellLevel = Math.min(5, Math.ceil(classLevel / 4));
					} else if (casterProg === "1/3") {
						knownMaxSpellLevel = Math.min(4, Math.ceil(classLevel / 7));
					} else if (casterProg === "pact") {
						knownMaxSpellLevel = Math.min(5, Math.ceil(classLevel / 2));
					} else {
						knownMaxSpellLevel = Math.min(9, Math.ceil(classLevel / 2));
					}
				}
			}

			// Check for weapon mastery progression
			const weaponMasteryCount = this._getWeaponMasteryCountAtLevel(classData, classLevel);

			// Update running optional feature counts
			for (const gain of optionalFeatureGains) {
				const key = gain.featureTypes.join("_");
				runningOptionalFeatureCounts[key] = (runningOptionalFeatureCounts[key] || 0) + gain.newCount;
			}

			const analysis = {
				characterLevel,
				className,
				classSource,
				classLevel,
				classData,
				features,
				needsSubclass,
				hasAsi,
				optionalFeatureGains,
				featureOptions,
				expertiseGrants,
				languageGrants,
				isScholarLevel,
				isSpellbookLevel,
				isWizard,
				isKnownCaster,
				knownSpellsGainAtLevel,
				knownCantripsGainAtLevel,
				knownMaxSpellLevel,
				weaponMasteryCount,
			};

			this._levelAnalysis.push(analysis);
		}

		return this._levelAnalysis;
	}

	/**
	 * Build a level-by-level plan determining which class gains a level at each character level.
	 * For single class: straightforward level 2→N.
	 * For multiclass: respects the user's class allocation order.
	 */
	_buildLevelPlan () {
		const plan = [];
		let characterLevel = this._fromLevel;

		// For simple single-class case
		if (this._classAllocations.length === 1) {
			const alloc = this._classAllocations[0];
			const startClassLevel = alloc.currentLevel;
			for (let cl = startClassLevel + 1; cl <= alloc.targetLevel; cl++) {
				characterLevel++;
				plan.push({
					characterLevel,
					className: alloc.className,
					classSource: alloc.classSource,
					classLevel: cl,
					classData: alloc.classData,
					isNewClass: cl === 1,
				});
			}
			return plan;
		}

		// Multiclass: iterate allocations in order
		// Each allocation specifies a class and how many levels to go up
		// First, process existing classes' additional levels, then new classes
		const classLevelTrackers = {};
		for (const alloc of this._classAllocations) {
			classLevelTrackers[`${alloc.className}_${alloc.classSource}`] = alloc.currentLevel || 0;
		}

		for (const alloc of this._classAllocations) {
			const key = `${alloc.className}_${alloc.classSource}`;
			const startAt = classLevelTrackers[key];
			for (let cl = startAt + 1; cl <= alloc.targetLevel; cl++) {
				characterLevel++;
				if (characterLevel > 20) break;
				plan.push({
					characterLevel,
					className: alloc.className,
					classSource: alloc.classSource,
					classLevel: cl,
					classData: alloc.classData,
					isNewClass: cl === 1,
				});
				classLevelTrackers[key] = cl;
			}
		}

		return plan;
	}

	// ==========================================
	// Level-Up Logic (shared with CharacterSheetLevelUp)
	// ==========================================

	/**
	 * Get the LevelUp module for reusing its methods
	 */
	_getLevelUpModule () {
		if (!this._levelUpModule) {
			this._levelUpModule = this._page._levelUp;
		}
		return this._levelUpModule;
	}

	_levelGrantsAsi (classData, level) {
		const standardAsiLevels = [4, 8, 12, 16, 19];
		if (classData.name === "Fighter") {
			return [...standardAsiLevels, 6, 14].includes(level);
		}
		if (classData.name === "Rogue") {
			return [...standardAsiLevels, 10].includes(level);
		}
		return standardAsiLevels.includes(level);
	}

	_levelGrantsSubclass (classData, level) {
		// Data-driven: check if any feature at this level has gainSubclassFeature: true
		if (classData.classFeatures && Array.isArray(classData.classFeatures)) {
			const isArrayOfArrays = Array.isArray(classData.classFeatures[0]);
			const levelFeatures = isArrayOfArrays
				? classData.classFeatures[level - 1] || []
				: classData.classFeatures.filter(f => {
					if (typeof f === "string") {
						const parts = f.split("|");
						// Format: "Name|Class|Source|Level" or "Name|Class|Source|Level|FeatureSource"
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

	_getSubclassLevel (classData) {
		// Data-driven: find the level where gainSubclassFeature appears
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
		// Fallback: default subclass level 3
		return 3;
	}

	/**
	 * Filter optional features to only include those matching the class's edition.
	 * TGTT classes get TGTT optional features.
	 * XPHB/2024 classes get XPHB (+ TCE/XGE expansion content).
	 * PHB/2014 classes get PHB/TCE/XGE.
	 * If no edition info is available, returns all features (no filter).
	 */
	_filterOptFeaturesByEdition (optFeatures, classSource) {
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

	_hasSubclass (className, classSource) {
		// Check if user already selected a subclass for this class in selections
		if (this._selections.subclasses[`${className}_${classSource}`]) return true;
		// Check if existing character has a subclass for this class
		const existing = this._state.getClasses().find(c => c.name === className && c.source === classSource);
		return !!existing?.subclass;
	}

	_getSubclassForClass (className, classSource, classLevel) {
		// Check quick build selection first
		const selected = this._selections.subclasses[`${className}_${classSource}`];
		if (selected) return selected;
		// Check existing character
		const existing = this._state.getClasses().find(c => c.name === className && c.source === classSource);
		return existing?.subclass || null;
	}

	_getLevelFeatures (classData, level, subclass = null) {
		const levelUp = this._getLevelUpModule();
		if (levelUp) {
			return levelUp._getLevelFeatures(classData, level, subclass);
		}
		return [];
	}

	_getOptionalFeatureGains (classData, classLevel, runningCounts) {
		const gains = [];
		if (!classData.optionalfeatureProgression?.length) return gains;

		classData.optionalfeatureProgression.forEach(optFeatProg => {
			const featureTypes = optFeatProg.featureType || [];
			const name = optFeatProg.name || featureTypes.map(ft => ft.replace(/:/g, " ")).join(", ");
			const key = featureTypes.join("_");

			let countAtLevel = 0;
			if (Array.isArray(optFeatProg.progression)) {
				countAtLevel = optFeatProg.progression[classLevel - 1] || 0;
			} else if (typeof optFeatProg.progression === "object") {
				// Object format: find highest key <= classLevel
				let highest = 0;
				for (const [lvlStr, count] of Object.entries(optFeatProg.progression)) {
					const lvl = parseInt(lvlStr);
					if (lvl <= classLevel && lvl > highest) {
						highest = lvl;
						countAtLevel = count;
					}
				}
				if (highest === 0) countAtLevel = 0;
			}

			// How many do we already have from previous levels in quick build + existing?
			const existingCount = runningCounts[key] || 0;
			const existingFromCharacter = this._state.getFeatures().filter(f =>
				f.featureType === "Optional Feature"
				&& f.optionalFeatureTypes?.some(ft => featureTypes.some(pt => ft === pt || ft.startsWith(pt))),
			).length;

			const totalExisting = existingCount + existingFromCharacter;
			const newCount = countAtLevel - totalExisting;

			if (newCount > 0) {
				gains.push({
					featureTypes,
					name,
					currentCount: totalExisting,
					totalCount: countAtLevel,
					newCount,
					required: optFeatProg.required || false,
				});
			}
		});

		return gains;
	}

	_getFeatureOptionsForLevel (features, level) {
		const levelUp = this._getLevelUpModule();
		if (levelUp) {
			return levelUp._getFeatureOptionsForLevel(features, level);
		}
		return [];
	}

	_getExpertiseGrantsForLevel (features) {
		const levelUp = this._getLevelUpModule();
		if (levelUp) {
			return levelUp._getExpertiseGrantsForLevel(features);
		}
		return [];
	}

	_getLanguageGrantsForLevel (features) {
		const levelUp = this._getLevelUpModule();
		if (levelUp) {
			return levelUp._getLanguageGrantsForLevel(features);
		}
		return [];
	}

	_getClassHitDie (classData) {
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
	 * Get weapon mastery count at a given class level from classTableGroups.
	 * Returns 0 if the class doesn't have a Weapon Mastery progression.
	 */
	_getWeaponMasteryCountAtLevel (classData, level) {
		if (!classData.classTableGroups?.length) return 0;

		for (const tableGroup of classData.classTableGroups) {
			const masteryColIndex = tableGroup.colLabels?.findIndex(
				col => typeof col === "string" && (col === "Weapon Mastery" || col.toLowerCase().includes("mastery")),
			);
			if (masteryColIndex == null || masteryColIndex === -1) continue;

			const row = tableGroup.rows?.[level - 1];
			if (!row) continue;

			const value = row[masteryColIndex];
			if (typeof value === "number") return value;
			if (typeof value === "string") return parseInt(value) || 0;
		}

		return 0;
	}

	// ==========================================
	// Wizard Step Generation
	// ==========================================

	/**
	 * Build wizard steps based on the level analysis.
	 * Steps with no applicable choices are skipped.
	 */
	_buildWizardSteps () {
		this._steps = [];

		// Step 1: Target Level & Class Allocation (always shown)
		this._steps.push({
			id: "target",
			label: "Target Level",
			icon: "🎯",
			required: true,
			render: ($content) => this._renderTargetStep($content),
			validate: () => this._validateTargetStep(),
		});

		const analysis = this._analyzeLevels();
		if (analysis.length === 0) return;

		// Step 2: Subclass Selection (if any class needs one)
		const subclassLevels = analysis.filter(a => a.needsSubclass);
		if (subclassLevels.length > 0) {
			this._steps.push({
				id: "subclass",
				label: "Subclass",
				icon: "📚",
				required: true,
				data: subclassLevels,
				render: ($content) => this._renderSubclassStep($content, subclassLevels),
				validate: () => this._validateSubclassStep(subclassLevels),
			});
		}

		// Step 3: ASI / Feat Selection (if any level grants ASI)
		const asiLevels = analysis.filter(a => a.hasAsi);
		if (asiLevels.length > 0) {
			this._steps.push({
				id: "asi",
				label: "ASI / Feats",
				icon: "📈",
				required: true,
				data: asiLevels,
				render: ($content) => this._renderAsiStep($content, asiLevels),
				validate: () => this._validateAsiStep(asiLevels),
			});
		}

		// Step 4: Class Options / Optional Features (if any level has them)
		const optFeatLevels = analysis.filter(a => a.optionalFeatureGains.length > 0);
		if (optFeatLevels.length > 0) {
			this._steps.push({
				id: "optfeatures",
				label: "Class Options",
				icon: "✨",
				required: true,
				data: optFeatLevels,
				render: ($content) => this._renderOptionalFeaturesStep($content, optFeatLevels),
				validate: () => this._validateOptionalFeaturesStep(optFeatLevels),
			});
		}

		// Step 5: Feature Choices (if any level has embedded options)
		const featureOptionLevels = analysis.filter(a => a.featureOptions.length > 0);
		if (featureOptionLevels.length > 0) {
			this._steps.push({
				id: "featoptions",
				label: "Feature Choices",
				icon: "🎯",
				required: true,
				data: featureOptionLevels,
				render: ($content) => this._renderFeatureOptionsStep($content, featureOptionLevels),
				validate: () => this._validateFeatureOptionsStep(featureOptionLevels),
			});
		}

		// Step 5b: Weapon Masteries (if any class gains new mastery slots)
		const masteryInfo = this._getWeaponMasteryGains(analysis);
		if (masteryInfo && masteryInfo.newSlots > 0) {
			this._steps.push({
				id: "weaponmastery",
				label: "Weapon Mastery",
				icon: "⚔️",
				required: true,
				data: masteryInfo,
				render: ($content) => this._renderWeaponMasteryStep($content, masteryInfo),
				validate: () => this._validateWeaponMasteryStep(masteryInfo),
			});
		}

		// Step 6: Expertise & Languages (if any level has them)
		const expertiseLevels = analysis.filter(a => a.expertiseGrants.length > 0);
		const languageLevels = analysis.filter(a => a.languageGrants.length > 0);
		const scholarLevel = analysis.find(a => a.isScholarLevel);
		if (expertiseLevels.length > 0 || languageLevels.length > 0 || scholarLevel) {
			this._steps.push({
				id: "expertise",
				label: "Expertise",
				icon: "⭐",
				required: true,
				data: {expertiseLevels, languageLevels, scholarLevel},
				render: ($content) => this._renderExpertiseStep($content, {expertiseLevels, languageLevels, scholarLevel}),
				validate: () => this._validateExpertiseStep({expertiseLevels, languageLevels, scholarLevel}),
			});
		}

		// Step 7: Spells (if any class is a spellcaster or wizard with spellbook)
		const hasSpellcasting = analysis.some(a => {
			const ability = this._getSpellcastingAbility(a.classData);
			return !!ability;
		});
		const spellbookLevels = analysis.filter(a => a.isSpellbookLevel);

		// Aggregate known-spell gains across all levels for this QB
		const knownCasterLevels = analysis.filter(a => a.isKnownCaster && (a.knownSpellsGainAtLevel > 0 || a.knownCantripsGainAtLevel > 0));
		let totalKnownSpellsGain = 0;
		let totalKnownCantripsGain = 0;
		let knownMaxSpellLevel = 0;
		let knownCasterClassName = null;
		let knownCasterClassSource = null;
		for (const a of knownCasterLevels) {
			totalKnownSpellsGain += a.knownSpellsGainAtLevel;
			totalKnownCantripsGain += a.knownCantripsGainAtLevel;
			knownMaxSpellLevel = Math.max(knownMaxSpellLevel, a.knownMaxSpellLevel);
			knownCasterClassName = a.className;
			knownCasterClassSource = a.classSource;
		}
		const knownCasterInfo = totalKnownSpellsGain > 0 || totalKnownCantripsGain > 0 ? {
			className: knownCasterClassName,
			classSource: knownCasterClassSource,
			totalSpells: totalKnownSpellsGain,
			totalCantrips: totalKnownCantripsGain,
			maxSpellLevel: knownMaxSpellLevel,
		} : null;

		if (hasSpellcasting || spellbookLevels.length > 0 || knownCasterInfo) {
			this._steps.push({
				id: "spells",
				label: "Spells",
				icon: "🔮",
				required: true,
				data: {hasSpellcasting, spellbookLevels, knownCasterInfo},
				render: ($content) => this._renderSpellsStep($content, {hasSpellcasting, spellbookLevels, knownCasterInfo}),
				validate: () => this._validateSpellsStep({hasSpellcasting, spellbookLevels, knownCasterInfo}),
			});
		}

		// Step 8: HP & Hit Dice (always shown)
		this._steps.push({
			id: "hp",
			label: "Hit Points",
			icon: "❤️",
			required: true,
			render: ($content) => this._renderHpStep($content),
			validate: () => this._validateHpStep(),
		});

		// Step 9: Review & Confirm (always shown)
		this._steps.push({
			id: "review",
			label: "Review",
			icon: "✅",
			required: false,
			render: ($content) => this._renderReviewStep($content),
			validate: () => true,
		});
	}

	_getSpellcastingAbility (classData) {
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
		};
		return classData.spellcastingAbility || abilityMap[classData.name] || null;
	}

	// ==========================================
	// Wizard UI (Full-Screen Overlay)
	// ==========================================

	async _showWizard () {
		this._isActive = true;

		// Build initial steps (just target step; rest built after analysis)
		this._buildWizardSteps();

		// Create overlay
		this._$overlay = $(`
			<div class="charsheet__quickbuild-overlay">
				<div class="charsheet__quickbuild-container">
					<div class="charsheet__quickbuild-header">
						<h3 class="charsheet__quickbuild-title">⚡ Quick Build</h3>
						<button class="ve-btn ve-btn-default ve-btn-xs charsheet__quickbuild-close" title="Cancel">✕</button>
					</div>
					<div class="charsheet__quickbuild-steps" id="quickbuild-steps"></div>
					<div class="charsheet__quickbuild-content" id="quickbuild-content"></div>
					<div class="charsheet__quickbuild-nav">
						<button class="ve-btn ve-btn-default" id="quickbuild-prev" disabled>
							<span class="glyphicon glyphicon-chevron-left"></span> Previous
						</button>
						<div class="charsheet__quickbuild-nav-info" id="quickbuild-nav-info"></div>
						<button class="ve-btn ve-btn-primary" id="quickbuild-next">
							Next <span class="glyphicon glyphicon-chevron-right"></span>
						</button>
					</div>
				</div>
			</div>
		`);

		$("body").append(this._$overlay);

		// Wire events
		this._$overlay.find(".charsheet__quickbuild-close").on("click", () => this._closeWizard());
		this._$overlay.find("#quickbuild-prev").on("click", () => this._prevStep());
		this._$overlay.find("#quickbuild-next").on("click", () => this._nextStep());

		// Render initial step
		this._renderStepIndicators();
		this._renderCurrentStep();
	}

	_closeWizard () {
		if (this._$overlay) {
			this._$overlay.remove();
			this._$overlay = null;
		}
		this._isActive = false;
	}

	_renderStepIndicators () {
		const $steps = this._$overlay.find("#quickbuild-steps");
		$steps.empty();

		this._steps.forEach((step, i) => {
			const state = i === this._currentStep ? "active"
				: i < this._currentStep ? "completed"
					: "";
			const $step = $(`
				<div class="charsheet__builder-step ${state}" data-step="${i}">
					<span class="charsheet__builder-step-num">${step.icon || (i + 1)}</span>
					<span class="charsheet__builder-step-label">${step.label}</span>
				</div>
			`);
			$step.on("click", () => {
				if (i <= this._currentStep) this._goToStep(i);
			});
			$steps.append($step);
		});
	}

	_renderCurrentStep () {
		const $content = this._$overlay.find("#quickbuild-content");
		$content.empty();

		if (this._currentStep < this._steps.length) {
			this._steps[this._currentStep].render($content);
		}

		// Update nav
		this._$overlay.find("#quickbuild-prev").prop("disabled", this._currentStep <= 0);
		const $nextBtn = this._$overlay.find("#quickbuild-next");
		if (this._currentStep >= this._steps.length - 1) {
			$nextBtn.html(`<span class="glyphicon glyphicon-ok"></span> Build Character`);
			$nextBtn.removeClass("ve-btn-primary").addClass("ve-btn-success");
		} else {
			$nextBtn.html(`Next <span class="glyphicon glyphicon-chevron-right"></span>`);
			$nextBtn.removeClass("ve-btn-success").addClass("ve-btn-primary");
		}

		// Update nav info
		const $info = this._$overlay.find("#quickbuild-nav-info");
		$info.text(`Step ${this._currentStep + 1} of ${this._steps.length}`);
	}

	_goToStep (step) {
		this._currentStep = step;
		this._renderStepIndicators();
		this._renderCurrentStep();
	}

	_prevStep () {
		if (this._currentStep > 0) {
			this._goToStep(this._currentStep - 1);
		}
	}

	async _nextStep () {
		const currentStep = this._steps[this._currentStep];
		if (currentStep?.validate && !currentStep.validate()) return;

		// After the Target step, rebuild steps based on analysis
		if (currentStep?.id === "target") {
			this._buildWizardSteps();
			this._renderStepIndicators();
		}

		if (this._currentStep >= this._steps.length - 1) {
			// Final step — apply the build
			await this._applyQuickBuild();
			this._closeWizard();
		} else {
			this._goToStep(this._currentStep + 1);
		}
	}

	// ==========================================
	// Step 1: Target Level & Class Allocation
	// ==========================================

	_renderTargetStep ($content) {
		const isExisting = this._fromLevel > 0;
		const classes = this._page.filterByAllowedSources(this._page.getClasses());

		const $step = $(`<div class="charsheet__quickbuild-step"></div>`);

		// Title
		$step.append($(`
			<div class="charsheet__quickbuild-step-header">
				<h4>${isExisting ? "Level Up To..." : "Build Character To Level..."}</h4>
				<p class="ve-muted">Select your target level${isExisting ? ` (currently level ${this._fromLevel})` : ""} and configure your class allocation.</p>
			</div>
		`));

		// Target level selector
		const $levelSection = $(`<div class="charsheet__quickbuild-section mb-3"></div>`);
		$levelSection.append(`<label class="ve-bold mb-1">Target Level</label>`);
		const $levelRow = $(`<div class="ve-flex-v-center gap-3"></div>`);

		const minLevel = this._fromLevel + 1;
		const $levelSlider = $(`<input type="range" class="form-control-range" min="${minLevel}" max="20" value="${this._targetLevel}" style="flex: 1;">`);
		const $levelDisplay = $(`<span class="charsheet__quickbuild-level-display">${this._targetLevel}</span>`);
		const $levelInput = $(`<input type="number" class="form-control form-control-sm" style="max-width: 70px;" min="${minLevel}" max="20" value="${this._targetLevel}">`);

		$levelSlider.on("input", () => {
			const val = parseInt($levelSlider.val());
			this._targetLevel = val;
			$levelDisplay.text(val);
			$levelInput.val(val);
			this._updateClassAllocations();
			renderAllocations();
		});

		$levelInput.on("change", () => {
			let val = parseInt($levelInput.val());
			val = Math.max(minLevel, Math.min(20, val || minLevel));
			this._targetLevel = val;
			$levelSlider.val(val);
			$levelDisplay.text(val);
			$levelInput.val(val);
			this._updateClassAllocations();
			renderAllocations();
		});

		$levelRow.append($levelSlider, $levelDisplay, $levelInput);
		$levelSection.append($levelRow);
		$step.append($levelSection);

		// Class allocation section
		const $classSection = $(`<div class="charsheet__quickbuild-section mb-3"></div>`);
		$classSection.append(`<label class="ve-bold mb-1">Class Allocation</label>`);
		const $allocations = $(`<div id="quickbuild-class-allocations"></div>`);
		$classSection.append($allocations);

		// Add class button (for multiclass)
		const $addClassBtn = $(`<button class="ve-btn ve-btn-sm ve-btn-primary mt-2"><span class="glyphicon glyphicon-plus"></span> Add Class (Multiclass)</button>`);
		$addClassBtn.on("click", () => {
			this._showAddClassModal(classes, () => {
				renderAllocations();
			});
		});

		// Only show add-class if total allocated < 20 and not at target
		if (this._targetLevel < 20) {
			$classSection.append($addClassBtn);
		}

		$step.append($classSection);

		// Level summary
		const $summary = $(`<div class="charsheet__quickbuild-section" id="quickbuild-target-summary"></div>`);
		$step.append($summary);

		const renderAllocations = () => {
			$allocations.empty();
			const totalAllocated = this._classAllocations.reduce((sum, a) => sum + (a.targetLevel - (a.currentLevel || 0)), 0);
			const totalNeeded = this._targetLevel - this._fromLevel;

			this._classAllocations.forEach((alloc, idx) => {
				const levelsToGain = alloc.targetLevel - (alloc.currentLevel || 0);
				const $row = $(`
					<div class="charsheet__quickbuild-class-row ve-flex-v-center gap-2 mb-2 p-2" style="border: 1px solid var(--cs-border, #ddd); border-radius: 8px;">
						<div class="ve-flex-1">
							<strong>${alloc.className}</strong>
							<span class="ve-muted ve-small">(${Parser.sourceJsonToAbv(alloc.classSource)})</span>
							${alloc.currentLevel > 0 ? `<span class="ve-muted"> — currently Lv${alloc.currentLevel}</span>` : ""}
						</div>
						<div class="ve-flex-v-center gap-2">
							<label class="ve-small ve-muted mb-0">Target Lv:</label>
							<input type="number" class="form-control form-control-sm"
								style="max-width: 60px;"
								min="${alloc.currentLevel || 1}" max="20"
								value="${alloc.targetLevel}">
						</div>
						${this._classAllocations.length > 1 && !alloc.currentLevel
							? `<button class="ve-btn ve-btn-xs ve-btn-danger" title="Remove class"><span class="glyphicon glyphicon-trash"></span></button>`
							: ""}
					</div>
				`);

				// Wire level input
				$row.find("input[type=number]").on("change", (e) => {
					let val = parseInt($(e.target).val());
					val = Math.max(alloc.currentLevel || 1, Math.min(20, val || 1));
					alloc.targetLevel = val;
					$(e.target).val(val);
					renderSummary();
				});

				// Wire remove button
				$row.find(".ve-btn-danger").on("click", () => {
					this._classAllocations.splice(idx, 1);
					renderAllocations();
				});

				$allocations.append($row);
			});

			renderSummary();
		};

		const renderSummary = () => {
			const $summary = this._$overlay.find("#quickbuild-target-summary");
			$summary.empty();

			const totalAllocated = this._classAllocations.reduce((sum, a) => sum + a.targetLevel, 0);
			const totalNew = totalAllocated - this._fromLevel;
			const targetNew = this._targetLevel - this._fromLevel;
			const isValid = totalNew === targetNew && totalAllocated <= 20;

			const $summaryContent = $(`
				<div class="p-2" style="background: ${isValid ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)"}; border-radius: 8px;">
					<strong>${isValid ? "✓" : "⚠"} Summary:</strong>
					Character Level ${this._fromLevel} → ${totalAllocated}
					(${totalNew} level${totalNew !== 1 ? "s" : ""} to gain${targetNew !== totalNew ? `, target: ${targetNew}` : ""})
					${!isValid ? `<br><span class="text-danger ve-small">Level allocation must equal target level (${this._targetLevel})</span>` : ""}
				</div>
			`);
			$summary.append($summaryContent);
		};

		renderAllocations();
		$content.append($step);
	}

	_updateClassAllocations () {
		// For single class, just update the target level
		if (this._classAllocations.length === 1) {
			this._classAllocations[0].targetLevel = this._targetLevel;
		}
	}

	_showAddClassModal (allClasses, onComplete) {
		// Filter out already-selected classes
		const existingNames = new Set(this._classAllocations.map(a => `${a.className}_${a.classSource}`));
		const available = allClasses.filter(c => !existingNames.has(`${c.name}_${c.source}`));

		if (available.length === 0) {
			JqueryUtil.doToast({type: "warning", content: "No more classes available to add."});
			return;
		}

		const {$modalInner, doClose} = UiUtil.getShowModal({
			title: "Add Multiclass",
			isMinHeight0: true,
		});

		const $search = $(`<input type="text" class="form-control mb-2" placeholder="Search classes...">`);
		const $list = $(`<div style="max-height: 300px; overflow-y: auto;"></div>`);

		const renderList = (filter = "") => {
			$list.empty();
			const filterLower = filter.toLowerCase();
			available
				.filter(c => !filter || c.name.toLowerCase().includes(filterLower))
				.sort((a, b) => a.name.localeCompare(b.name))
				.forEach(cls => {
					const $item = $(`
						<div class="charsheet__builder-list-item" style="cursor: pointer;">
							<span class="charsheet__builder-list-item-name">${cls.name}</span>
							<span class="charsheet__builder-list-item-source">${Parser.sourceJsonToAbv(cls.source)}</span>
						</div>
					`);
					$item.on("click", () => {
						this._classAllocations.push({
							className: cls.name,
							classSource: cls.source,
							classData: cls,
							currentLevel: 0,
							targetLevel: 1,
							subclass: null,
						});
						doClose(true);
						onComplete();
					});
					$list.append($item);
				});
		};

		$search.on("input", () => renderList($search.val()));
		renderList();

		$modalInner.append($search, $list);
	}

	_validateTargetStep () {
		const totalAllocated = this._classAllocations.reduce((sum, a) => sum + a.targetLevel, 0);
		const targetNew = this._targetLevel - this._fromLevel;
		const totalNew = totalAllocated - this._fromLevel;

		if (totalAllocated > 20) {
			JqueryUtil.doToast({type: "warning", content: "Total allocated levels cannot exceed 20."});
			return false;
		}

		if (totalNew !== targetNew) {
			JqueryUtil.doToast({type: "warning", content: `Class allocation levels must add up to target level ${this._targetLevel}.`});
			return false;
		}

		if (this._classAllocations.length === 0) {
			JqueryUtil.doToast({type: "warning", content: "You must have at least one class."});
			return false;
		}

		// Resolve class data
		this._resolveClassData();
		return true;
	}

	// ==========================================
	// Step 2: Subclass Selection
	// ==========================================

	_renderSubclassStep ($content, subclassLevels) {
		const $step = $(`<div class="charsheet__quickbuild-step"></div>`);
		$step.append(`
			<div class="charsheet__quickbuild-step-header">
				<h4>Choose Subclass${subclassLevels.length > 1 ? "es" : ""}</h4>
				<p class="ve-muted">Select a subclass for each class that requires one.</p>
			</div>
		`);

		subclassLevels.forEach(analysis => {
			const {classData, className, classSource, classLevel} = analysis;
			const key = `${className}_${classSource}`;
			const subclassTitle = classData.subclassTitle || "Subclass";

			const $section = $(`
				<div class="charsheet__quickbuild-section mb-3">
					<h5>${className} — ${subclassTitle} (Level ${classLevel})</h5>
				</div>
			`);

			// Get available subclasses
			const subclasses = (classData.subclasses || [])
				.filter(sc => this._page.filterByAllowedSources([sc]).length > 0);

			if (subclasses.length === 0) {
				$section.append(`<p class="ve-muted">No subclasses available for this class with current source settings.</p>`);
			} else {
				const $list = $(`<div class="charsheet__quickbuild-subclass-list"></div>`);
				subclasses
					.sort((a, b) => a.name.localeCompare(b.name))
					.forEach(sc => {
						const isSelected = this._selections.subclasses[key]?.name === sc.name
							&& this._selections.subclasses[key]?.source === sc.source;
						const $item = $(`
							<div class="charsheet__quickbuild-option ${isSelected ? "selected" : ""}">
								<div class="ve-flex-v-center">
									<input type="radio" name="qb-subclass-${key}" ${isSelected ? "checked" : ""}>
									<strong class="ml-2">${sc.name}</strong>
									<span class="ve-muted ve-small ml-2">(${Parser.sourceJsonToAbv(sc.source)})</span>
								</div>
								${sc.shortName && sc.shortName !== sc.name ? `<div class="ve-muted ve-small ml-4">${sc.shortName}</div>` : ""}
							</div>
						`);
						$item.on("click", () => {
							$list.find(".charsheet__quickbuild-option").removeClass("selected");
							$list.find("input[type=radio]").prop("checked", false);
							$item.addClass("selected");
							$item.find("input[type=radio]").prop("checked", true);
							this._selections.subclasses[key] = sc;
						});
						$list.append($item);
					});
				$section.append($list);
			}

			$step.append($section);
		});

		$content.append($step);
	}

	_validateSubclassStep (subclassLevels) {
		for (const analysis of subclassLevels) {
			const key = `${analysis.className}_${analysis.classSource}`;
			if (!this._selections.subclasses[key]) {
				JqueryUtil.doToast({type: "warning", content: `Please select a subclass for ${analysis.className}.`});
				return false;
			}
		}
		return true;
	}

	// ==========================================
	// Step 3: ASI / Feat Selection
	// ==========================================

	_renderAsiStep ($content, asiLevels) {
		const $step = $(`<div class="charsheet__quickbuild-step"></div>`);
		const thelemar_asiFeat = this._state.getSettings()?.thelemar_asiFeat || false;

		$step.append(`
			<div class="charsheet__quickbuild-step-header">
				<h4>Ability Score Improvements & Feats</h4>
				<p class="ve-muted">${asiLevels.length} ASI level${asiLevels.length > 1 ? "s" : ""} to configure. Each grants +2 ability score points or a feat.</p>
			</div>
		`);

		// Collect section containers for re-rendering when earlier ASI choices change
		const sectionRenderers = [];

		/**
		 * Compute running scores: start from full ability score (base + racial + background + items)
		 * then layer in ASI choices from all levels up to (but not including) startIdx.
		 */
		const computeRunningScores = (upToIdx) => {
			const scores = {};
			Parser.ABIL_ABVS.forEach(abl => {
				scores[abl] = this._state.getAbilityScore(abl);
			});
			for (let i = 0; i < upToIdx; i++) {
				const prevKey = `${asiLevels[i].className}_${asiLevels[i].classLevel}`;
				const prevSel = this._selections.asi[prevKey];
				if (prevSel && (prevSel.mode === "asi" || prevSel.isBoth)) {
					for (const [abl, inc] of Object.entries(prevSel.abilityChoices || {})) {
						scores[abl] = (scores[abl] || 0) + inc;
					}
				}
			}
			return scores;
		};

		/** Re-render all ASI sections from startIdx onward (called when an earlier selection changes). */
		const reRenderFrom = (startIdx) => {
			for (let i = startIdx; i < sectionRenderers.length; i++) {
				sectionRenderers[i]();
			}
		};

		asiLevels.forEach((analysis, idx) => {
			const {characterLevel, className, classLevel, classData} = analysis;
			const levelKey = `${className}_${classLevel}`;
			const isBoth = thelemar_asiFeat && classLevel === 4;
			const isEpicBoon = classLevel === 19;

			// Init selection if not exists
			if (!this._selections.asi[levelKey]) {
				this._selections.asi[levelKey] = {
					mode: "asi", // "asi" or "feat"
					abilityChoices: {},
					feat: null,
					isBoth,
				};
			}
			const sel = this._selections.asi[levelKey];

			const $section = $(`
				<div class="charsheet__quickbuild-section mb-3">
					<h5>${className} Level ${classLevel} — ${isEpicBoon ? "Epic Boon" : "ASI / Feat"}
						${isBoth ? ` <span class="badge badge-info">ASI + Feat</span>` : ""}
					</h5>
				</div>
			`);

			if (isBoth) {
				$section.append(`<p class="ve-small text-info">At level 4, you gain both an Ability Score Improvement and a Feat!</p>`);
			}

			// Mode toggle (ASI vs Feat) — not shown for isBoth
			const $modeRow = $(`<div class="ve-flex-v-center gap-2 mb-2"></div>`);
			if (!isBoth) {
				const $asiRadio = $(`<label class="ve-flex-v-center gap-1"><input type="radio" name="qb-asi-mode-${levelKey}" value="asi" ${sel.mode === "asi" ? "checked" : ""}> Increase Ability Scores (+2 total)</label>`);
				const $featRadio = $(`<label class="ve-flex-v-center gap-1"><input type="radio" name="qb-asi-mode-${levelKey}" value="feat" ${sel.mode === "feat" ? "checked" : ""}> Take a ${isEpicBoon ? "Boon" : "Feat"}</label>`);

				$asiRadio.find("input").on("change", () => { sel.mode = "asi"; renderAsiContent(); reRenderFrom(idx + 1); });
				$featRadio.find("input").on("change", () => { sel.mode = "feat"; renderAsiContent(); reRenderFrom(idx + 1); });

				$modeRow.append($asiRadio, $featRadio);
			}
			$section.append($modeRow);

			const $asiContent = $(`<div class="charsheet__quickbuild-asi-content"></div>`);
			$section.append($asiContent);

			const renderAsiContent = () => {
				$asiContent.empty();
				const runningScores = computeRunningScores(idx);

				// Show ASI controls (always for isBoth, conditional otherwise)
				if (isBoth || sel.mode === "asi") {
					const $asiControls = this._renderAsiControls(levelKey, sel, runningScores, () => reRenderFrom(idx + 1));
					$asiContent.append($asiControls);
				}

				// Show feat selection (always for isBoth, conditional otherwise)
				if (isBoth || sel.mode === "feat") {
					const $featSelect = this._renderFeatSelector(levelKey, sel, isEpicBoon);
					$asiContent.append($featSelect);
				}
			};

			sectionRenderers.push(renderAsiContent);
			renderAsiContent();
			$step.append($section);
		});

		$content.append($step);
	}

	_renderAsiControls (levelKey, sel, runningScores, onChanged) {
		const $container = $(`<div class="charsheet__quickbuild-asi-controls mb-2"></div>`);
		$container.append(`<label class="ve-bold ve-small">Ability Score Increases (+2 total)</label>`);

		let pointsRemaining = 2;
		const tempChoices = {...(sel.abilityChoices || {})};
		Object.values(tempChoices).forEach(v => { pointsRemaining -= v; });

		const $points = $(`<div class="ve-small mb-1">Points remaining: <strong id="qb-asi-points-${levelKey}">${pointsRemaining}</strong></div>`);
		$container.append($points);

		const $grid = $(`<div class="charsheet__quickbuild-asi-grid"></div>`);
		Parser.ABIL_ABVS.forEach(abl => {
			const currentBase = runningScores[abl];
			const increase = tempChoices[abl] || 0;

			const $row = $(`
				<div class="ve-flex-v-center gap-2 mb-1">
					<span style="width: 70px; font-weight: 600;">${Parser.attAbvToFull(abl)}</span>
					<span class="ve-muted ve-small" style="width: 30px;">${currentBase}</span>
					<button class="ve-btn ve-btn-xs ve-btn-default qb-asi-minus" data-abl="${abl}">−</button>
					<span class="qb-asi-val" style="width: 25px; text-align: center; font-weight: 700;">+${increase}</span>
					<button class="ve-btn ve-btn-xs ve-btn-default qb-asi-plus" data-abl="${abl}">+</button>
					<span class="ve-muted ve-small">→ ${currentBase + increase}</span>
				</div>
			`);

			$row.find(".qb-asi-plus").on("click", () => {
				const currentIncrease = tempChoices[abl] || 0;
				if (pointsRemaining <= 0) return;
				if (currentIncrease >= 2) return;
				if (runningScores[abl] + currentIncrease + 1 > 20) return;

				tempChoices[abl] = currentIncrease + 1;
				sel.abilityChoices = {...tempChoices};
				pointsRemaining--;
				// Re-render this control and propagate to subsequent ASI sections
				$container.replaceWith(this._renderAsiControls(levelKey, sel, runningScores, onChanged));
				if (onChanged) onChanged();
			});

			$row.find(".qb-asi-minus").on("click", () => {
				const currentIncrease = tempChoices[abl] || 0;
				if (currentIncrease <= 0) return;

				tempChoices[abl] = currentIncrease - 1;
				if (tempChoices[abl] === 0) delete tempChoices[abl];
				sel.abilityChoices = {...tempChoices};
				pointsRemaining++;
				$container.replaceWith(this._renderAsiControls(levelKey, sel, runningScores, onChanged));
				if (onChanged) onChanged();
			});

			$grid.append($row);
		});

		$container.append($grid);
		return $container;
	}

	_renderFeatSelector (levelKey, sel, isEpicBoon) {
		const $container = $(`<div class="charsheet__quickbuild-feat-select mb-2"></div>`);
		$container.append(`<label class="ve-bold ve-small">${isEpicBoon ? "Epic Boon" : "Feat"} Selection</label>`);

		let feats = this._page.filterByAllowedSources(this._page.getFeats() || []);
		if (isEpicBoon) {
			feats = feats.filter(f => f.category === "EB");
		} else {
			feats = feats.filter(f => f.category !== "EB");
		}

		const $search = $(`<input type="text" class="form-control form-control-sm mb-1" placeholder="Search ${isEpicBoon ? "boons" : "feats"}...">`);
		const $list = $(`<div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--cs-border, #ddd); border-radius: 8px;"></div>`);

		const renderList = (filter = "") => {
			$list.empty();
			const filterLower = filter.toLowerCase();
			feats
				.filter(f => !filter || f.name.toLowerCase().includes(filterLower))
				.sort((a, b) => a.name.localeCompare(b.name))
				.slice(0, 50)
				.forEach(feat => {
					const isSelected = sel.feat?.name === feat.name && sel.feat?.source === feat.source;
					const $item = $(`
						<div class="charsheet__quickbuild-option ve-small ${isSelected ? "selected" : ""}" style="padding: 4px 8px; cursor: pointer;">
							<strong>${feat.name}</strong>
							<span class="ve-muted">(${Parser.sourceJsonToAbv(feat.source)})</span>
						</div>
					`);
					$item.on("click", () => {
						$list.find(".charsheet__quickbuild-option").removeClass("selected");
						$item.addClass("selected");
						sel.feat = feat;
					});
					$list.append($item);
				});
		};

		$search.on("input", () => renderList($search.val()));
		renderList();

		$container.append($search, $list);

		if (sel.feat) {
			$container.append($(`<div class="ve-small mt-1"><strong>Selected:</strong> ${sel.feat.name}</div>`));
		}

		return $container;
	}

	_validateAsiStep (asiLevels) {
		const thelemar_asiFeat = this._state.getSettings()?.thelemar_asiFeat || false;

		for (const analysis of asiLevels) {
			const levelKey = `${analysis.className}_${analysis.classLevel}`;
			const sel = this._selections.asi[levelKey];
			if (!sel) {
				JqueryUtil.doToast({type: "warning", content: `Please configure ASI for ${analysis.className} level ${analysis.classLevel}.`});
				return false;
			}

			const isBoth = thelemar_asiFeat && analysis.classLevel === 4;

			if (isBoth) {
				// Need both ASI points spent AND a feat
				const pointsUsed = Object.values(sel.abilityChoices || {}).reduce((s, v) => s + v, 0);
				if (pointsUsed !== 2) {
					JqueryUtil.doToast({type: "warning", content: `Please allocate all 2 ASI points for ${analysis.className} level ${analysis.classLevel}.`});
					return false;
				}
				if (!sel.feat) {
					JqueryUtil.doToast({type: "warning", content: `Please select a feat for ${analysis.className} level ${analysis.classLevel}.`});
					return false;
				}
			} else if (sel.mode === "asi") {
				const pointsUsed = Object.values(sel.abilityChoices || {}).reduce((s, v) => s + v, 0);
				if (pointsUsed !== 2) {
					JqueryUtil.doToast({type: "warning", content: `Please allocate all 2 ASI points for ${analysis.className} level ${analysis.classLevel}.`});
					return false;
				}
			} else if (sel.mode === "feat") {
				if (!sel.feat) {
					JqueryUtil.doToast({type: "warning", content: `Please select a feat for ${analysis.className} level ${analysis.classLevel}.`});
					return false;
				}
			}
		}
		return true;
	}

	// ==========================================
	// Step 4: Optional Features (Invocations, Metamagic, etc.)
	// ==========================================

	_renderOptionalFeaturesStep ($content, optFeatLevels) {
		const $step = $(`<div class="charsheet__quickbuild-step"></div>`);

		// Aggregate gains by feature type across all levels
		const aggregatedGains = {};
		optFeatLevels.forEach(analysis => {
			analysis.optionalFeatureGains.forEach(gain => {
				const key = gain.featureTypes.join("_");
				if (!aggregatedGains[key]) {
					aggregatedGains[key] = {
						name: gain.name,
						featureTypes: gain.featureTypes,
						totalNeeded: 0,
						className: analysis.className,
						classSource: analysis.classSource,
						classData: analysis.classData,
						maxClassLevel: analysis.classLevel,
					};
				}
				aggregatedGains[key].totalNeeded += gain.newCount;
				aggregatedGains[key].maxClassLevel = Math.max(aggregatedGains[key].maxClassLevel, analysis.classLevel);
			});
		});

		$step.append(`
			<div class="charsheet__quickbuild-step-header">
				<h4>Class Options</h4>
				<p class="ve-muted">Select your optional class features (invocations, metamagic, etc.).</p>
			</div>
		`);

		Object.entries(aggregatedGains).forEach(([typeKey, gain]) => {
			const isCombatMethods = gain.featureTypes.some(ft => ft.startsWith("CTM:"));

			if (isCombatMethods) {
				this._renderCombatMethodsOptFeature($step, typeKey, gain);
			} else {
				this._renderStandardOptFeature($step, typeKey, gain);
			}
		});

		$content.append($step);
	}

	_validateOptionalFeaturesStep (optFeatLevels) {
		// Check all aggregated gains are met
		const aggregatedGains = {};
		optFeatLevels.forEach(analysis => {
			analysis.optionalFeatureGains.forEach(gain => {
				const key = gain.featureTypes.join("_");
				if (!aggregatedGains[key]) {
					aggregatedGains[key] = {name: gain.name, totalNeeded: 0};
				}
				aggregatedGains[key].totalNeeded += gain.newCount;
			});
		});

		for (const [key, gain] of Object.entries(aggregatedGains)) {
			const selected = this._selections.optionalFeatures[key] || [];
			if (selected.length < gain.totalNeeded) {
				JqueryUtil.doToast({type: "warning", content: `Please select ${gain.totalNeeded} ${gain.name} (currently ${selected.length}).`});
				return false;
			}
		}
		return true;
	}

	/**
	 * Render a standard (non-Combat-Methods) optional feature gain section.
	 */
	_renderStandardOptFeature ($step, typeKey, gain) {
		if (!this._selections.optionalFeatures[typeKey]) {
			this._selections.optionalFeatures[typeKey] = [];
		}
		const selectedList = this._selections.optionalFeatures[typeKey];

		const $section = $(`
			<div class="charsheet__quickbuild-section mb-3">
				<h5>${gain.name} <span class="badge badge-primary">${selectedList.length}/${gain.totalNeeded}</span></h5>
			</div>
		`);

		const allOptFeatures = this._page.getOptionalFeatures() || [];
		const filtered = allOptFeatures.filter(f => {
			const fTypes = f.featureType || [];
			return fTypes.some(ft =>
				gain.featureTypes.some(pt => ft === pt || ft.startsWith(pt)),
			);
		});

		// Apply edition filtering based on class source
		const classSource = gain.classData?.source || gain.classSource;
		const editionFiltered = this._filterOptFeaturesByEdition(filtered, classSource);

		// Pre-filter by allowed sources (hoisted out of render loop)
		const sourceFiltered = this._page.filterByAllowedSources(editionFiltered);

		const $search = $(`<input type="text" class="form-control form-control-sm mb-1" placeholder="Search...">`);
		const $list = $(`<div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--cs-border, #ddd); border-radius: 8px;"></div>`);

		const renderList = (filter = "") => {
			$list.empty();
			const filterLower = filter.toLowerCase();
			sourceFiltered
				.filter(f => !filter || f.name.toLowerCase().includes(filterLower))
				.sort((a, b) => a.name.localeCompare(b.name))
				.forEach(opt => {
					const isSelected = selectedList.some(s => s.name === opt.name && s.source === opt.source);
					const $item = $(`
						<div class="charsheet__quickbuild-option ve-small ${isSelected ? "selected" : ""}" style="padding: 6px 8px; cursor: pointer;">
							<div class="ve-flex-v-center">
								<input type="checkbox" ${isSelected ? "checked" : ""}>
								<span class="qb-opt-name ml-2"></span>
								<span class="ve-muted ml-1">(${Parser.sourceJsonToAbv(opt.source)})</span>
							</div>
							${opt.entries ? `<div class="ve-muted ve-small ml-4" style="max-height: 40px; overflow: hidden;">${(() => { try { return Renderer.get().render({entries: opt.entries}).substring(0, 120); } catch (e) { return opt.entries.map(e => typeof e === "string" ? e : "").join(" ").substring(0, 120); } })()}...</div>` : ""}
						</div>
					`);

					// Create hoverable link for the optional feature name
					const $optName = $item.find(".qb-opt-name");
					try {
						const resolvedSource = this._page.resolveOptionalFeatureSource(opt.name, [
							opt.source,
							Parser.SRC_XPHB,
							Parser.SRC_PHB,
						]);
						$optName.html(CharacterSheetPage.getHoverLink(UrlUtil.PG_OPT_FEATURES, opt.name, resolvedSource));
						$optName.find("a").on("click", (e) => { e.preventDefault(); e.stopPropagation(); });
					} catch (e) {
						$optName.html(`<strong>${opt.name}</strong>`);
					}

					$item.on("click", () => {
						if (isSelected) {
							const idx = selectedList.findIndex(s => s.name === opt.name && s.source === opt.source);
							if (idx >= 0) selectedList.splice(idx, 1);
						} else {
							if (selectedList.length >= gain.totalNeeded) {
								JqueryUtil.doToast({type: "warning", content: `You can only select ${gain.totalNeeded} ${gain.name}.`});
								return;
							}
							selectedList.push(opt);
						}
						renderList(filter);
						$section.find(".badge").text(`${selectedList.length}/${gain.totalNeeded}`);
					});
					$list.append($item);
				});
		};

		$search.on("input", () => renderList($search.val()));
		renderList();

		$section.append($search, $list);
		$step.append($section);
	}

	/**
	 * Render a Combat Methods optional feature gain with tradition + degree filtering.
	 */
	_renderCombatMethodsOptFeature ($step, typeKey, gain) {
		if (!this._selections.optionalFeatures[typeKey]) {
			this._selections.optionalFeatures[typeKey] = [];
		}
		const selectedList = this._selections.optionalFeatures[typeKey];

		const levelUp = this._getLevelUpModule();
		const classSource = gain.classData?.source || gain.classSource;
		const rawOptFeatures = this._page.getOptionalFeatures() || [];
		const editionFiltered = this._filterOptFeaturesByEdition(rawOptFeatures, classSource);
		const allOptFeatures = this._page.filterByAllowedSources(editionFiltered);
		const existingOptFeatures = this._state.getFeatures().filter(f => f.featureType === "Optional Feature");

		// Get max degree from class table
		const maxDegree = levelUp?._getMaxMethodDegree(gain.classData, gain.maxClassLevel) || 1;

		// Get known traditions — from state or inferred from existing features
		let knownTraditions = levelUp?._getKnownCombatTraditions(existingOptFeatures) || [];

		// If no traditions selected, we need a tradition picker first
		if (!this._selections._combatTraditions) {
			this._selections._combatTraditions = [...knownTraditions];
		}

		const $section = $(`
			<div class="charsheet__quickbuild-section mb-3">
				<h5>${gain.name} <span class="badge badge-primary">${selectedList.length}/${gain.totalNeeded}</span></h5>
				<p class="ve-muted ve-small">Max degree: ${maxDegree}${this._getOrdinalSuffix(maxDegree)}</p>
			</div>
		`);

		const $tradContainer = $(`<div class="mb-2"></div>`);
		const $methodsContainer = $(`<div></div>`);

		// Tradition picker (if no traditions are known yet)
		if (knownTraditions.length === 0) {
			const availableTraditions = levelUp?._getAvailableTraditions(allOptFeatures) || [];
			const traditionCount = 2; // Default combat tradition count

			$tradContainer.append(`
				<p class="ve-small ve-muted mb-1">Choose ${traditionCount} Combat Traditions:</p>
				<div class="ve-small ve-muted mb-1">Selected: <span class="qb-trad-count">${this._selections._combatTraditions.length}</span>/${traditionCount}</div>
			`);

			const $tradList = $(`<div style="max-height: 180px; overflow-y: auto; border: 1px solid var(--cs-border, #ddd); border-radius: 8px; padding: 4px; margin-bottom: 8px;"></div>`);

			availableTraditions.forEach(trad => {
				const isChecked = this._selections._combatTraditions.includes(trad.code);
				const $item = $(`
					<label class="d-block ve-small mb-1" style="cursor: pointer; padding: 4px 6px;">
						<input type="checkbox" class="mr-2" ${isChecked ? "checked" : ""}>
						<strong>${trad.name}</strong>
						<span class="ve-muted ml-1">(${trad.code})</span>
					</label>
				`);

				$item.find("input").on("change", (e) => {
					if (e.target.checked) {
						if (this._selections._combatTraditions.length < traditionCount) {
							this._selections._combatTraditions.push(trad.code);
						} else {
							e.target.checked = false;
							JqueryUtil.doToast({type: "warning", content: `You can only choose ${traditionCount} traditions.`});
							return;
						}
					} else {
						this._selections._combatTraditions = this._selections._combatTraditions.filter(t => t !== trad.code);
						// Clear selected methods from removed tradition
						const remaining = selectedList.filter(s => {
							const ft = (s.featureType || []).find(t => t.startsWith("CTM:"));
							if (!ft) return true;
							const match = ft.match(/^CTM:\d([A-Z]{2})$/);
							return !match || this._selections._combatTraditions.includes(match[1]);
						});
						selectedList.length = 0;
						remaining.forEach(s => selectedList.push(s));
					}
					$tradContainer.find(".qb-trad-count").text(this._selections._combatTraditions.length);
					renderMethods();
					$section.find(".badge").text(`${selectedList.length}/${gain.totalNeeded}`);
				});

				$tradList.append($item);
			});

			$tradContainer.append($tradList);
		} else {
			const tradNames = knownTraditions.map(t => levelUp?._getTraditionName(t) || t).join(", ");
			$tradContainer.append(`<p class="ve-small ve-muted">Traditions: ${tradNames}</p>`);
		}

		// Render filtered methods
		const renderMethods = () => {
			$methodsContainer.empty();
			const activeTraditions = knownTraditions.length > 0 ? knownTraditions : this._selections._combatTraditions;

			if (activeTraditions.length === 0) {
				$methodsContainer.append(`<p class="ve-muted ve-small">Select traditions above to see available methods.</p>`);
				return;
			}

			// Filter methods by tradition + degree
			const availableMethods = allOptFeatures.filter(opt => {
				if (!opt.featureType) return false;
				return opt.featureType.some(ft => {
					const match = ft.match(/^CTM:(\d)([A-Z]{2})$/);
					if (!match) return false;
					const degree = parseInt(match[1]);
					const tradCode = match[2];
					return degree <= maxDegree && activeTraditions.includes(tradCode);
				});
			});

			// Exclude already-known methods
			const existingNames = new Set(existingOptFeatures.map(f => `${f.name}|${f.source}`));
			const newMethods = availableMethods.filter(m => !existingNames.has(`${m.name}|${m.source}`));

			// Group by tradition
			const $search = $(`<input type="text" class="form-control form-control-sm mb-1" placeholder="Search methods...">`);
			const $list = $(`<div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--cs-border, #ddd); border-radius: 8px;"></div>`);

			const renderFiltered = (filter = "") => {
				$list.empty();
				const filterLower = filter.toLowerCase();

				for (const tradCode of activeTraditions) {
					const tradName = levelUp?._getTraditionName(tradCode) || tradCode;
					const tradMethods = newMethods.filter(m => {
						if (filter && !m.name.toLowerCase().includes(filterLower)) return false;
						return (m.featureType || []).some(ft => {
							const match = ft.match(/^CTM:\d([A-Z]{2})$/);
							return match && match[1] === tradCode;
						});
					});
					if (tradMethods.length === 0) continue;

					$list.append(`<div class="ve-small px-2 pt-2 pb-1" style="font-weight: 600; border-bottom: 1px solid var(--cs-border, #ddd);">${tradName}</div>`);

					tradMethods.sort((a, b) => {
						const dA = this._getMethodDegree(a);
						const dB = this._getMethodDegree(b);
						return dA - dB || a.name.localeCompare(b.name);
					}).forEach(opt => {
						const degree = this._getMethodDegree(opt);
						const isSelected = selectedList.some(s => s.name === opt.name && s.source === opt.source);
						const $item = $(`
							<div class="charsheet__quickbuild-option ve-small ${isSelected ? "selected" : ""}" style="padding: 6px 8px; cursor: pointer;">
								<div class="ve-flex-v-center">
									<input type="checkbox" ${isSelected ? "checked" : ""}>
									<span class="qb-method-name ml-2"></span>
									<span class="ve-muted ml-1">(${degree}${this._getOrdinalSuffix(degree)} degree)</span>
								</div>
							</div>
						`);

						// Create hoverable link for the method name
						const $methodName = $item.find(".qb-method-name");
						try {
							const resolvedSource = this._page.resolveOptionalFeatureSource(opt.name, [
								opt.source,
								Parser.SRC_XPHB,
								Parser.SRC_PHB,
							]);
							$methodName.html(CharacterSheetPage.getHoverLink(UrlUtil.PG_OPT_FEATURES, opt.name, resolvedSource));
							$methodName.find("a").on("click", (e) => { e.preventDefault(); e.stopPropagation(); });
						} catch (e) {
							$methodName.html(`<strong>${opt.name}</strong>`);
						}

						$item.on("click", () => {
							if (isSelected) {
								const idx = selectedList.findIndex(s => s.name === opt.name && s.source === opt.source);
								if (idx >= 0) selectedList.splice(idx, 1);
							} else {
								if (selectedList.length >= gain.totalNeeded) {
									JqueryUtil.doToast({type: "warning", content: `You can only select ${gain.totalNeeded} ${gain.name}.`});
									return;
								}
								selectedList.push(opt);
							}
							renderFiltered(filter);
							$section.find(".badge").text(`${selectedList.length}/${gain.totalNeeded}`);
						});
						$list.append($item);
					});
				}

				if ($list.children().length === 0) {
					$list.append(`<div class="ve-muted ve-small p-2">No methods available.</div>`);
				}
			};

			$search.on("input", () => renderFiltered($search.val()));
			renderFiltered();

			$methodsContainer.append($search, $list);
		};

		renderMethods();
		$section.append($tradContainer, $methodsContainer);
		$step.append($section);
	}

	/**
	 * Extract degree number from a combat method's feature types
	 */
	_getMethodDegree (opt) {
		for (const ft of (opt.featureType || [])) {
			const match = ft.match(/^CTM:(\d)/);
			if (match) return parseInt(match[1]);
		}
		return 0;
	}

	/**
	 * Ordinal suffix helper (1st, 2nd, 3rd, etc.)
	 */
	_getOrdinalSuffix (n) {
		const s = ["th", "st", "nd", "rd"];
		const v = n % 100;
		return s[(v - 20) % 10] || s[v] || s[0];
	}

	// ==========================================
	// Step 5b: Weapon Mastery
	// ==========================================

	/**
	 * Compute how many new weapon mastery slots the character gains during this Quick Build.
	 * Compares the mastery count at the starting level vs. the target level.
	 */
	_getWeaponMasteryGains (analysisArray) {
		// Find the highest target mastery count across all classes
		let targetTotal = 0;
		let className = null;
		let classData = null;

		for (const a of analysisArray) {
			if (a.weaponMasteryCount > targetTotal) {
				targetTotal = a.weaponMasteryCount;
				className = a.className;
				classData = a.classData;
			}
		}

		if (targetTotal === 0) return null;

		// Current mastery count = whatever the character already has set
		const currentMasteries = this._state.getWeaponMasteries() || [];
		const existingCount = currentMasteries.length;

		const newSlots = targetTotal - existingCount;
		if (newSlots <= 0) return null;

		return {
			className,
			classData,
			currentMasteries,
			existingCount,
			targetTotal,
			newSlots,
		};
	}

	/**
	 * Render the weapon mastery step: let the user fill up to the new total.
	 */
	_renderWeaponMasteryStep ($content, masteryInfo) {
		const $step = $(`<div class="charsheet__quickbuild-step"></div>`);
		$step.append(`
			<div class="charsheet__quickbuild-step-header">
				<h4>Weapon Mastery</h4>
				<p class="ve-muted">Choose weapons to master. You can change these after a Long Rest.
					Your ${masteryInfo.className} now masters ${masteryInfo.targetTotal} weapon${masteryInfo.targetTotal !== 1 ? "s" : ""}
					(was ${masteryInfo.existingCount}).</p>
			</div>
		`);

		if (!this._selections.weaponMasteries) {
			this._selections.weaponMasteries = [...masteryInfo.currentMasteries];
		}
		const selectedList = this._selections.weaponMasteries;

		const $section = $(`
			<div class="charsheet__quickbuild-section mb-3">
				<h5>Weapon Masteries <span class="badge badge-primary">${selectedList.length}/${masteryInfo.targetTotal}</span></h5>
			</div>
		`);

		// Get base weapons with mastery properties
		const allItems = this._page.getItems?.() || [];
		const weaponsWithMastery = allItems.filter(item => {
			if (!item._isBaseItem) return false;
			if (!item.weaponCategory && !["M", "R", "S"].includes(item.type)) return false;
			return item.mastery?.length > 0;
		});

		const getMasteryName = (entry) => {
			if (!entry) return "";
			if (typeof entry === "string") return entry.split("|")[0];
			if (typeof entry === "object" && entry.uid) return entry.uid.split("|")[0];
			return "";
		};

		const simpleWeapons = weaponsWithMastery.filter(w =>
			w.weaponCategory === "simple" || w.type === "S",
		).sort((a, b) => a.name.localeCompare(b.name));

		const martialWeapons = weaponsWithMastery.filter(w =>
			w.weaponCategory === "martial" || w.type === "M",
		).sort((a, b) => a.name.localeCompare(b.name));

		const $list = $(`<div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--cs-border, #ddd); border-radius: 8px;"></div>`);

		const renderList = () => {
			$list.empty();

			const renderGroup = (weapons, groupName) => {
				if (!weapons.length) return;
				$list.append(`<div class="ve-small px-2 pt-2 pb-1" style="font-weight: 600; border-bottom: 1px solid var(--cs-border, #ddd);">${groupName}</div>`);
				weapons.forEach(weapon => {
					const weaponKey = `${weapon.name}|${weapon.source}`;
					const masteryProp = getMasteryName(weapon.mastery?.[0]);
					const isSelected = selectedList.includes(weaponKey);

					const $item = $(`
						<div class="charsheet__quickbuild-option ve-small ${isSelected ? "selected" : ""}" style="padding: 6px 8px; cursor: pointer;">
							<div class="ve-flex-v-center">
								<input type="checkbox" ${isSelected ? "checked" : ""}>
								<strong class="ml-2">${weapon.name}</strong>
								${masteryProp ? `<span class="ve-muted ml-1">(${masteryProp})</span>` : ""}
							</div>
						</div>
					`);
					$item.on("click", () => {
						if (isSelected) {
							const idx = selectedList.indexOf(weaponKey);
							if (idx >= 0) selectedList.splice(idx, 1);
						} else {
							if (selectedList.length >= masteryInfo.targetTotal) {
								JqueryUtil.doToast({type: "warning", content: `You can only master ${masteryInfo.targetTotal} weapons.`});
								return;
							}
							selectedList.push(weaponKey);
						}
						renderList();
						$section.find(".badge").text(`${selectedList.length}/${masteryInfo.targetTotal}`);
					});
					$list.append($item);
				});
			};

			renderGroup(simpleWeapons, "Simple Weapons");
			renderGroup(martialWeapons, "Martial Weapons");
		};

		renderList();
		$section.append($list);
		$step.append($section);
		$content.append($step);
	}

	_validateWeaponMasteryStep (masteryInfo) {
		const selected = this._selections.weaponMasteries || [];
		if (selected.length < masteryInfo.targetTotal) {
			JqueryUtil.doToast({
				type: "warning",
				content: `Please select ${masteryInfo.targetTotal} weapon masteries (currently ${selected.length}).`,
			});
			return false;
		}
		return true;
	}

	// ==========================================
	// Step 5: Feature Choices (Specialties, etc.)
	// ==========================================

	_renderFeatureOptionsStep ($content, featureOptionLevels) {
		const $step = $(`<div class="charsheet__quickbuild-step"></div>`);
		$step.append(`
			<div class="charsheet__quickbuild-step-header">
				<h4>Feature Choices</h4>
				<p class="ve-muted">Select options for features that offer choices (fighting styles, specialties, etc.).</p>
			</div>
		`);

		// Collect all option groups and identify shared option pools.
		// Groups that reference the same base feature share a pool and should cross-deduplicate.
		const allSections = [];
		featureOptionLevels.forEach(analysis => {
			const {className, classLevel, featureOptions} = analysis;

			featureOptions.forEach(optGroup => {
				const levelKey = `${className}_${classLevel}_${optGroup.featureName}`;
				if (!this._selections.featureOptions[levelKey]) {
					this._selections.featureOptions[levelKey] = [];
				}
				// Pool key: groups that share the same base option list.
				// `referencedFrom` is set by _findFeatureOptions for "gain another X" refs.
				// Normalize: convert "FeatureName|ClassName|Source|Level" → "ClassName_FeatureName"
				// so that both the base feature and its "gain another" references share the same pool.
				let poolKey;
				if (optGroup.referencedFrom) {
					const refParts = optGroup.referencedFrom.split("|");
					poolKey = `${refParts[1] || className}_${refParts[0]}`;
				} else {
					poolKey = `${className}_${optGroup.featureName}`;
				}
				allSections.push({
					analysis,
					optGroup,
					levelKey,
					poolKey,
					$section: null,
					$list: null,
				});
			});
		});

		// Build a map of pool key → sections sharing that pool
		const poolMap = {};
		for (const sec of allSections) {
			if (!poolMap[sec.poolKey]) poolMap[sec.poolKey] = [];
			poolMap[sec.poolKey].push(sec);
		}

		// Get names already selected in OTHER sections of the same pool
		const getPoolSelectedNames = (poolKey, excludeLevelKey) => {
			const names = new Set();
			for (const sec of (poolMap[poolKey] || [])) {
				if (sec.levelKey === excludeLevelKey) continue;
				for (const s of (this._selections.featureOptions[sec.levelKey] || [])) {
					names.add(s.name);
				}
			}
			return names;
		};

		// Check if a feature option is repeatable (can be taken multiple times)
		const isRepeatableOpt = (opt) => {
			if (opt.type !== "classFeature" || !opt.ref) return false;
			const parts = opt.ref.split("|");
			const classFeatures = this._page.getClassFeatures();
			const fullOpt = classFeatures.find(f =>
				f.name === parts[0]
				&& f.className === parts[1]
				&& (f.source === parts[2] || !parts[2]),
			);
			if (!fullOpt?.entries) return false;
			const text = JSON.stringify(fullOpt.entries).toLowerCase();
			return text.includes("multiple times") || text.includes("chosen again") || text.includes("retaken");
		};

		// Render a single section; callable multiple times for re-render on selection change
		const renderSection = (sec) => {
			const {optGroup, levelKey, poolKey} = sec;
			const selectedList = this._selections.featureOptions[levelKey];

			sec.$list.empty();

			const usedNames = getPoolSelectedNames(poolKey, levelKey);

			(optGroup.options || []).forEach(opt => {
				// Hide options already picked in another section of the same pool
				// unless the feature is explicitly repeatable
				if (usedNames.has(opt.name) && !isRepeatableOpt(opt)) return;

				const isSelected = selectedList.some(s => s.name === opt.name);
				const $item = $(`
					<div class="charsheet__quickbuild-option ve-small ${isSelected ? "selected" : ""}" style="padding: 6px 8px; cursor: pointer;">
						<div class="ve-flex-v-center">
							<input type="${optGroup.count === 1 ? "radio" : "checkbox"}" name="qb-featopt-${levelKey}" ${isSelected ? "checked" : ""}>
							<span class="qb-feat-opt-name ml-2"></span>
							${opt.source ? `<span class="ve-muted ml-1">(${Parser.sourceJsonToAbv(opt.source)})</span>` : ""}
						</div>
					</div>
				`);

				// Create hoverable link for the feature option name
				const $featOptName = $item.find(".qb-feat-opt-name");
				if (opt.type === "classFeature" && opt.ref) {
					const parts = opt.ref.split("|");
					const featureSource = parts[2] || opt.source || "TGTT";
					const hash = UrlUtil.encodeArrayForHash(parts[0], parts[1], parts[2], parts[3], featureSource);
					try {
						const hoverAttrs = Renderer.hover.getHoverElementAttributes({page: UrlUtil.PG_CLASS_SUBCLASS_FEATURES, source: featureSource, hash});
						$featOptName.html(`<a href="${UrlUtil.PG_CLASS_SUBCLASS_FEATURES}#${hash}" ${hoverAttrs} onclick="event.preventDefault(); event.stopPropagation();">${opt.name}</a>`);
					} catch (e) {
						$featOptName.html(`<strong>${opt.name}</strong>`);
					}
				} else if (opt.type === "optionalfeature" && opt.ref) {
					const refParts = opt.ref.split("|");
					try {
						const resolvedSource = this._page.resolveOptionalFeatureSource(refParts[0] || opt.name, [
							refParts[1],
							opt.source,
							Parser.SRC_XPHB,
							Parser.SRC_PHB,
						]);
						$featOptName.html(CharacterSheetPage.getHoverLink(UrlUtil.PG_OPT_FEATURES, refParts[0], resolvedSource));
						$featOptName.find("a").on("click", (e) => { e.preventDefault(); e.stopPropagation(); });
					} catch (e) {
						$featOptName.html(`<strong>${opt.name}</strong>`);
					}
				} else {
					$featOptName.html(`<strong>${opt.name}</strong>`);
				}

				$item.on("click", () => {
					if (isSelected) {
						const idx = selectedList.findIndex(s => s.name === opt.name);
						if (idx >= 0) selectedList.splice(idx, 1);
					} else {
						if (optGroup.count === 1) {
							selectedList.length = 0; // Clear for radio
						}
						if (selectedList.length >= optGroup.count) return;
						selectedList.push(opt);
					}
					// Re-render ALL sections in the same pool (selections propagate)
					for (const poolSec of (poolMap[poolKey] || [])) {
						renderSection(poolSec);
						poolSec.$section.find(".badge").text(
							`${(this._selections.featureOptions[poolSec.levelKey] || []).length}/${poolSec.optGroup.count}`,
						);
					}
				});
				sec.$list.append($item);
			});
		};

		// Build DOM for each section
		for (const sec of allSections) {
			const {analysis, optGroup, levelKey} = sec;
			const selectedList = this._selections.featureOptions[levelKey];

			const $section = $(`
				<div class="charsheet__quickbuild-section mb-3">
					<h5>${analysis.className} Level ${analysis.classLevel} — ${optGroup.featureName}
						<span class="badge badge-primary">${selectedList.length}/${optGroup.count}</span>
					</h5>
				</div>
			`);
			const $list = $(`<div></div>`);

			sec.$section = $section;
			sec.$list = $list;

			renderSection(sec);

			$section.append($list);
			$step.append($section);
		}

		$content.append($step);
	}

	_validateFeatureOptionsStep (featureOptionLevels) {
		for (const analysis of featureOptionLevels) {
			for (const optGroup of analysis.featureOptions) {
				const levelKey = `${analysis.className}_${analysis.classLevel}_${optGroup.featureName}`;
				const selected = this._selections.featureOptions[levelKey] || [];
				if (selected.length < optGroup.count) {
					JqueryUtil.doToast({type: "warning", content: `Please select ${optGroup.count} option${optGroup.count > 1 ? "s" : ""} for ${optGroup.featureName}.`});
					return false;
				}
			}
		}
		return true;
	}

	// ==========================================
	// Step 6: Expertise & Languages
	// ==========================================

	_renderExpertiseStep ($content, {expertiseLevels, languageLevels, scholarLevel}) {
		const $step = $(`<div class="charsheet__quickbuild-step"></div>`);
		$step.append(`
			<div class="charsheet__quickbuild-step-header">
				<h4>Expertise, Languages & Scholar</h4>
				<p class="ve-muted">Configure skill expertise, language proficiencies, and scholar choices.</p>
			</div>
		`);

		// Scholar expertise (Wizard XPHB level 2)
		if (scholarLevel) {
			const $section = $(`
				<div class="charsheet__quickbuild-section mb-3">
					<h5>Scholar Expertise (Wizard Level 2)</h5>
					<p class="ve-small ve-muted">Choose a skill to gain expertise in.</p>
				</div>
			`);

			const scholarSkills = ["arcana", "history", "investigation", "nature", "religion"];
			const $list = $(`<div></div>`);
			scholarSkills.forEach(skill => {
				const isSelected = this._selections.scholarSkill === skill;
				const $item = $(`
					<div class="charsheet__quickbuild-option ve-small ${isSelected ? "selected" : ""}" style="padding: 4px 8px; cursor: pointer;">
						<input type="radio" name="qb-scholar" ${isSelected ? "checked" : ""}>
						<strong class="ml-2">${skill.toTitleCase()}</strong>
					</div>
				`);
				$item.on("click", () => {
					$list.find(".charsheet__quickbuild-option").removeClass("selected").find("input").prop("checked", false);
					$item.addClass("selected").find("input").prop("checked", true);
					this._selections.scholarSkill = skill;
				});
				$list.append($item);
			});
			$section.append($list);
			$step.append($section);
		}

		// Expertise grants
		if (expertiseLevels.length > 0) {
			expertiseLevels.forEach(analysis => {
				analysis.expertiseGrants.forEach(grant => {
					const levelKey = `${analysis.className}_${analysis.classLevel}_${grant.featureName}`;
					if (!this._selections.expertise[levelKey]) {
						this._selections.expertise[levelKey] = [];
					}

					const $section = $(`
						<div class="charsheet__quickbuild-section mb-3">
							<h5>${analysis.className} Level ${analysis.classLevel} — ${grant.featureName} Expertise
								<span class="badge badge-primary">${this._selections.expertise[levelKey].length}/${grant.count || 2}</span>
							</h5>
						</div>
					`);

					// Get proficient skills for expertise selection
					const skillProfs = this._state._data?.skillProficiencies || {};
					const proficientSkills = Object.keys(skillProfs).filter(s => skillProfs[s] >= 1);

					const $list = $(`<div></div>`);
					proficientSkills.forEach(skill => {
						const isSelected = this._selections.expertise[levelKey].includes(skill);
						const $item = $(`
							<div class="charsheet__quickbuild-option ve-small ${isSelected ? "selected" : ""}" style="padding: 4px 8px; cursor: pointer;">
								<input type="checkbox" ${isSelected ? "checked" : ""}>
								<strong class="ml-2">${skill.toTitleCase()}</strong>
							</div>
						`);
						$item.on("click", () => {
							const list = this._selections.expertise[levelKey];
							const maxCount = grant.count || 2;
							if (isSelected) {
								const idx = list.indexOf(skill);
								if (idx >= 0) list.splice(idx, 1);
							} else {
								if (list.length >= maxCount) return;
								list.push(skill);
							}
							// Refresh
							$section.find(".badge").text(`${list.length}/${maxCount}`);
							$item.toggleClass("selected").find("input").prop("checked", !isSelected);
						});
						$list.append($item);
					});
					$section.append($list);
					$step.append($section);
				});
			});
		}

		// Language grants
		if (languageLevels.length > 0) {
			languageLevels.forEach(analysis => {
				analysis.languageGrants.forEach(grant => {
					const levelKey = `${analysis.className}_${analysis.classLevel}_${grant.featureName}`;
					if (!this._selections.languages[levelKey]) {
						this._selections.languages[levelKey] = [];
					}

					const $section = $(`
						<div class="charsheet__quickbuild-section mb-3">
							<h5>${analysis.className} Level ${analysis.classLevel} — ${grant.featureName} Languages
								<span class="badge badge-primary">${this._selections.languages[levelKey].length}/${grant.count}</span>
							</h5>
						</div>
					`);

					const allLanguages = this._page.getLanguagesList() || [];
					const knownLanguages = this._state.getLanguages().map(l => l.toLowerCase());

					const $list = $(`<div style="max-height: 200px; overflow-y: auto;"></div>`);
					allLanguages
						.filter(l => !knownLanguages.includes(l.name?.toLowerCase()))
						.sort((a, b) => a.name.localeCompare(b.name))
						.forEach(lang => {
							const isSelected = this._selections.languages[levelKey].includes(lang.name);
							const $item = $(`
								<div class="charsheet__quickbuild-option ve-small ${isSelected ? "selected" : ""}" style="padding: 4px 8px; cursor: pointer;">
									<input type="checkbox" ${isSelected ? "checked" : ""}>
									<strong class="ml-2">${lang.name}</strong>
								</div>
							`);
							$item.on("click", () => {
								const list = this._selections.languages[levelKey];
								if (isSelected) {
									const idx = list.indexOf(lang.name);
									if (idx >= 0) list.splice(idx, 1);
								} else {
									if (list.length >= grant.count) return;
									list.push(lang.name);
								}
								$section.find(".badge").text(`${list.length}/${grant.count}`);
								$item.toggleClass("selected").find("input").prop("checked", !isSelected);
							});
							$list.append($item);
						});
					$section.append($list);
					$step.append($section);
				});
			});
		}

		$content.append($step);
	}

	_validateExpertiseStep ({expertiseLevels, languageLevels, scholarLevel}) {
		if (scholarLevel && !this._selections.scholarSkill) {
			JqueryUtil.doToast({type: "warning", content: "Please select a Scholar expertise skill."});
			return false;
		}

		for (const analysis of expertiseLevels) {
			for (const grant of analysis.expertiseGrants) {
				const levelKey = `${analysis.className}_${analysis.classLevel}_${grant.featureName}`;
				const selected = this._selections.expertise[levelKey] || [];
				const needed = grant.count || 2;
				if (selected.length < needed) {
					JqueryUtil.doToast({type: "warning", content: `Please select ${needed} expertise skill${needed > 1 ? "s" : ""} for ${grant.featureName}.`});
					return false;
				}
			}
		}

		for (const analysis of languageLevels) {
			for (const grant of analysis.languageGrants) {
				const levelKey = `${analysis.className}_${analysis.classLevel}_${grant.featureName}`;
				const selected = this._selections.languages[levelKey] || [];
				if (selected.length < grant.count) {
					JqueryUtil.doToast({type: "warning", content: `Please select ${grant.count} language${grant.count > 1 ? "s" : ""} for ${grant.featureName}.`});
					return false;
				}
			}
		}

		return true;
	}

	// ==========================================
	// Step 7: Spells
	// ==========================================

	_renderSpellsStep ($content, {hasSpellcasting, spellbookLevels, knownCasterInfo}) {
		const $step = $(`<div class="charsheet__quickbuild-step"></div>`);
		$step.append(`
			<div class="charsheet__quickbuild-step-header">
				<h4>Spell Selection</h4>
				<p class="ve-muted">Select spells gained across all levels. Spells are organized by level.</p>
			</div>
		`);

		// Wizard spellbook
		if (spellbookLevels.length > 0) {
			const totalSpellbookSpells = spellbookLevels.length * 2;
			const maxSpellLevel = this._getMaxSpellLevelForClass("Wizard", this._targetLevel);

			const $section = $(`
				<div class="charsheet__quickbuild-section mb-3">
					<h5>Wizard Spellbook <span class="badge badge-primary">${this._selections.spellbookSpells.length}/${totalSpellbookSpells}</span></h5>
					<p class="ve-small ve-muted">Select ${totalSpellbookSpells} spells to add to your spellbook (levels 1-${maxSpellLevel}).</p>
				</div>
			`);

			const allSpells = this._page.getSpells() || [];
			const wizardSpells = this._page.filterByAllowedSources(allSpells.filter(s =>
				s.level > 0
				&& s.level <= maxSpellLevel
				&& this._spellIsForClass(s, "Wizard"),
			));

			const $search = $(`<input type="text" class="form-control form-control-sm mb-1" placeholder="Search wizard spells...">`);
			const $list = $(`<div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--cs-border, #ddd); border-radius: 8px;"></div>`);

			const renderList = (filter = "") => {
				$list.empty();
				const filterLower = filter.toLowerCase();
				wizardSpells
					.filter(s => !filter || s.name.toLowerCase().includes(filterLower))
					.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
					.slice(0, 80)
					.forEach(spell => {
						const isSelected = this._selections.spellbookSpells.some(s => s.name === spell.name && s.source === spell.source);
						const $item = $(`
							<div class="charsheet__quickbuild-option ve-small ${isSelected ? "selected" : ""}" style="padding: 4px 8px; cursor: pointer;">
								<input type="checkbox" ${isSelected ? "checked" : ""}>
								<strong class="ml-2">${spell.name}</strong>
								<span class="ve-muted ml-1">Lv${spell.level}</span>
								<span class="ve-muted ml-1">(${Parser.sourceJsonToAbv(spell.source)})</span>
							</div>
						`);
						$item.on("click", () => {
							if (isSelected) {
								const idx = this._selections.spellbookSpells.findIndex(s => s.name === spell.name && s.source === spell.source);
								if (idx >= 0) this._selections.spellbookSpells.splice(idx, 1);
							} else {
								if (this._selections.spellbookSpells.length >= totalSpellbookSpells) {
									JqueryUtil.doToast({type: "warning", content: `You can only select ${totalSpellbookSpells} spellbook spells.`});
									return;
								}
								this._selections.spellbookSpells.push(spell);
							}
							renderList(filter);
							$section.find(".badge").text(`${this._selections.spellbookSpells.length}/${totalSpellbookSpells}`);
						});
						$list.append($item);
					});
			};

			$search.on("input", () => renderList($search.val()));
			renderList();

			$section.append($search, $list);
			$step.append($section);
		}

		// Known-spell caster picker (Sorcerer, Bard, Ranger, Warlock, etc.)
		if (knownCasterInfo) {
			this._renderKnownSpellPicker($step, knownCasterInfo);
		} else if (hasSpellcasting && spellbookLevels.length === 0) {
			// Prepared casters only need slot management
			$step.append(`
				<div class="charsheet__quickbuild-section mb-3">
					<p class="ve-muted">Spell preparation and known spell management can be done from the Spells tab after building your character. Your spell slots will be automatically calculated based on your class levels.</p>
				</div>
			`);
		}

		$content.append($step);
	}

	/**
	 * Render a known-spell picker section for the Quick Build spells step.
	 * Supports both leveled spells and cantrips with search/filter.
	 */
	_renderKnownSpellPicker ($step, knownCasterInfo) {
		const {className, classSource, totalSpells, totalCantrips, maxSpellLevel} = knownCasterInfo;

		const parts = [];
		if (totalSpells > 0) parts.push(`${totalSpells} spell${totalSpells !== 1 ? "s" : ""} (up to level ${maxSpellLevel})`);
		if (totalCantrips > 0) parts.push(`${totalCantrips} cantrip${totalCantrips !== 1 ? "s" : ""}`);

		const $section = $(`
			<div class="charsheet__quickbuild-section mb-3">
				<h5>Spells Known — ${className}
					${totalSpells > 0 ? `<span class="badge badge-primary spell-badge">${this._selections.knownSpells.length}/${totalSpells}</span>` : ""}
					${totalCantrips > 0 ? `<span class="badge badge-info cantrip-badge ml-1">${this._selections.knownCantrips.length}/${totalCantrips}</span>` : ""}
				</h5>
				<p class="ve-small ve-muted">Choose ${parts.join(" and ")} for your ${className}.</p>
			</div>
		`);

		// Pre-compute class spells once
		const allSpells = this._page.getSpells() || [];
		const sourceFiltered = this._page.filterByAllowedSources(allSpells);
		const classSpells = sourceFiltered.filter(spell => {
			if (spell.level > maxSpellLevel) return false;
			if (totalCantrips === 0 && spell.level === 0) return false;
			if (totalSpells === 0 && spell.level > 0) return false;
			return this._spellIsForClass(spell, className);
		}).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

		// Get already-known spells to mark them
		const knownSpells = this._state.getSpells?.() || [];
		const knownCantrips = this._state.getCantripsKnown?.() || [];
		const knownIds = new Set([...knownSpells, ...knownCantrips].map(s => `${s.name}|${s.source}`));

		// Filter controls
		const $filterRow = $(`<div class="ve-flex-wrap gap-2 mb-2" style="align-items: center;"></div>`);

		const $search = $(`<input type="text" class="form-control form-control-sm" placeholder="Search spells..." style="flex: 1; min-width: 150px;">`);
		$filterRow.append($search);

		const levelOptions = [];
		if (totalCantrips > 0) levelOptions.push({value: "0", label: "Cantrips"});
		for (let i = 1; i <= maxSpellLevel; i++) levelOptions.push({value: String(i), label: `Level ${i}`});
		const $levelFilter = $(`
			<select class="form-control form-control-sm" style="width: auto; min-width: 100px;">
				<option value="">All Levels</option>
				${levelOptions.map(l => `<option value="${l.value}">${l.label}</option>`).join("")}
			</select>
		`);
		$filterRow.append($levelFilter);

		$section.append($filterRow);

		const $spellList = $(`<div style="max-height: 350px; overflow-y: auto; border: 1px solid var(--cs-border, #ddd); border-radius: 8px;"></div>`);
		$section.append($spellList);

		const updateBadges = () => {
			$section.find(".spell-badge").text(`${this._selections.knownSpells.length}/${totalSpells}`);
			$section.find(".cantrip-badge").text(`${this._selections.knownCantrips.length}/${totalCantrips}`);
		};

		const renderList = () => {
			$spellList.empty();
			const searchText = ($search.val() || "").toLowerCase();
			const levelVal = $levelFilter.val();

			const filtered = classSpells.filter(spell => {
				if (searchText && !spell.name.toLowerCase().includes(searchText)) return false;
				if (levelVal !== "" && levelVal !== undefined && spell.level !== parseInt(levelVal)) return false;
				return true;
			});

			if (!filtered.length) {
				$spellList.append(`<p class="ve-muted text-center py-2">No spells match your filters</p>`);
				return;
			}

			// Group by level
			const byLevel = {};
			filtered.forEach(spell => {
				if (!byLevel[spell.level]) byLevel[spell.level] = [];
				byLevel[spell.level].push(spell);
			});

			Object.keys(byLevel).sort((a, b) => Number(a) - Number(b)).forEach(level => {
				const levelNum = parseInt(level);
				const levelLabel = levelNum === 0 ? "🔮 Cantrips" : `Level ${level}`;

				$spellList.append(`<div class="ve-small ve-bold px-2 py-1" style="background: var(--cs-bg-alt, #f5f5f5); border-bottom: 1px solid var(--cs-border, #ddd);">${levelLabel} <span style="opacity: 0.6;">(${byLevel[level].length})</span></div>`);

				byLevel[level].forEach(spell => {
					const spellId = `${spell.name}|${spell.source}`;
					const isKnown = knownIds.has(spellId);
					const isCantrip = spell.level === 0;
					const targetArr = isCantrip ? this._selections.knownCantrips : this._selections.knownSpells;
					const maxCount = isCantrip ? totalCantrips : totalSpells;
					const isSelected = targetArr.some(s => `${s.name}|${s.source}` === spellId);

					const isConc = spell.concentration || spell.duration?.some?.(d => d.concentration) || false;
					const isRitual = spell.ritual || spell.meta?.ritual || false;
					const tags = [];
					if (isRitual) tags.push("🔮");
					if (isConc) tags.push("⏳");
					const tagsStr = tags.length ? ` ${tags.join(" ")}` : "";

					const $item = $(`
						<div class="charsheet__quickbuild-option ve-small ${isSelected ? "selected" : ""} ${isKnown ? "ve-muted" : ""}" style="padding: 5px 8px; cursor: pointer; display: flex; align-items: center; justify-content: space-between;">
							<div>
								<input type="checkbox" ${isSelected ? "checked" : ""} ${isKnown ? "disabled" : ""}>
								<span class="qb-spell-name ml-2"></span>
								<span class="ve-muted ml-1">(${Parser.sourceJsonToAbv(spell.source)})</span>
								${tagsStr}
							</div>
							${isKnown ? `<span class="ve-muted ve-small">✓ Known</span>` : ""}
						</div>
					`);

					// Add spell name with hover link
					const $spellName = $item.find(".qb-spell-name");
					try {
						$spellName.html(CharacterSheetPage.getHoverLink(UrlUtil.PG_SPELLS, spell.name, spell.source));
						$spellName.find("a").on("click", (e) => { e.preventDefault(); e.stopPropagation(); });
					} catch (e) {
						$spellName.html(`<strong>${spell.name}</strong>`);
					}

					if (!isKnown) {
						$item.on("click", () => {
							if (isSelected) {
								const idx = targetArr.findIndex(s => `${s.name}|${s.source}` === spellId);
								if (idx >= 0) targetArr.splice(idx, 1);
							} else {
								if (targetArr.length >= maxCount) {
									const typeLabel = isCantrip ? "cantrips" : "spells";
									JqueryUtil.doToast({type: "warning", content: `You can only select ${maxCount} ${typeLabel}.`});
									return;
								}
								targetArr.push(spell);
							}
							updateBadges();
							renderList();
						});
					}

					$spellList.append($item);
				});
			});
		};

		$search.on("input", renderList);
		$levelFilter.on("change", renderList);
		renderList();

		$step.append($section);
	}

	/**
	 * Check if a spell belongs to a class's spell list, using Renderer API with fallback.
	 */
	_spellIsForClass (spell, className) {
		try {
			const classList = Renderer.spell.getCombinedClasses(spell, "fromClassList");
			if (classList?.some(c => c.name === className)) return true;
		} catch (e) { /* fall through */ }
		return spell.classes?.fromClassList?.some(c => c.name === className) || false;
	}

	_getMaxSpellLevelForClass (className, classLevel) {
		// Simple max spell level lookup
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

	_validateSpellsStep ({hasSpellcasting, spellbookLevels, knownCasterInfo}) {
		if (spellbookLevels.length > 0) {
			const totalNeeded = spellbookLevels.length * 2;
			if (this._selections.spellbookSpells.length < totalNeeded) {
				JqueryUtil.doToast({type: "warning", content: `Please select ${totalNeeded} spellbook spells (currently ${this._selections.spellbookSpells.length}).`});
				return false;
			}
		}
		if (knownCasterInfo) {
			if (knownCasterInfo.totalSpells > 0 && this._selections.knownSpells.length < knownCasterInfo.totalSpells) {
				JqueryUtil.doToast({type: "warning", content: `Please select ${knownCasterInfo.totalSpells} spells (currently ${this._selections.knownSpells.length}).`});
				return false;
			}
			if (knownCasterInfo.totalCantrips > 0 && this._selections.knownCantrips.length < knownCasterInfo.totalCantrips) {
				JqueryUtil.doToast({type: "warning", content: `Please select ${knownCasterInfo.totalCantrips} cantrips (currently ${this._selections.knownCantrips.length}).`});
				return false;
			}
		}
		return true;
	}

	// ==========================================
	// Step 8: HP & Hit Dice
	// ==========================================

	_renderHpStep ($content) {
		const $step = $(`<div class="charsheet__quickbuild-step"></div>`);

		const conMod = this._state.getAbilityMod("con");
		const levelsToGain = this._targetLevel - this._fromLevel;

		$step.append(`
			<div class="charsheet__quickbuild-step-header">
				<h4>Hit Points</h4>
				<p class="ve-muted">${levelsToGain} level${levelsToGain > 1 ? "s" : ""} to gain. Choose how to determine HP for each level.</p>
			</div>
		`);

		// HP method toggle
		const $methodSection = $(`
			<div class="charsheet__quickbuild-section mb-3">
				<h5>HP Method</h5>
			</div>
		`);

		const $avgRadio = $(`<label class="ve-flex-v-center gap-2 mb-1">
			<input type="radio" name="qb-hp-method" value="average" ${this._selections.hpMethod === "average" ? "checked" : ""}>
			<strong>Average HP (Recommended)</strong>
			<span class="ve-muted ve-small">— Uses the standard average value per level</span>
		</label>`);
		const $rollRadio = $(`<label class="ve-flex-v-center gap-2 mb-1">
			<input type="radio" name="qb-hp-method" value="roll" ${this._selections.hpMethod === "roll" ? "checked" : ""}>
			<strong>Roll HP</strong>
			<span class="ve-muted ve-small">— Roll hit dice for each level</span>
		</label>`);

		$avgRadio.find("input").on("change", () => {
			this._selections.hpMethod = "average";
			renderHpDetails();
		});
		$rollRadio.find("input").on("change", () => {
			this._selections.hpMethod = "roll";
			renderHpDetails();
		});

		$methodSection.append($avgRadio, $rollRadio);
		$step.append($methodSection);

		// HP details
		const $details = $(`<div id="quickbuild-hp-details"></div>`);
		$step.append($details);

		const renderHpDetails = () => {
			$details.empty();

			let totalHp = 0;
			const $table = $(`<table class="table table-sm table-striped ve-small">
				<thead><tr><th>Level</th><th>Class</th><th>Hit Die</th><th>CON</th><th>HP Gain</th></tr></thead>
				<tbody></tbody>
			</table>`);
			const $tbody = $table.find("tbody");

			for (const analysis of this._levelAnalysis) {
				const hitDie = this._getClassHitDie(analysis.classData);
				const levelKey = `${analysis.className}_${analysis.classLevel}`;

				let hpGain;
				if (this._selections.hpMethod === "average") {
					hpGain = Math.ceil(hitDie / 2) + 1 + conMod;
				} else {
					// Roll
					if (!this._selections.hpRolls[levelKey]) {
						this._selections.hpRolls[levelKey] = Math.max(1, Math.floor(Math.random() * hitDie) + 1 + conMod);
					}
					hpGain = this._selections.hpRolls[levelKey];
				}
				hpGain = Math.max(1, hpGain);
				totalHp += hpGain;

				const $row = $(`
					<tr>
						<td>${analysis.characterLevel}</td>
						<td>${analysis.className} ${analysis.classLevel}</td>
						<td>d${hitDie}</td>
						<td>${conMod >= 0 ? "+" : ""}${conMod}</td>
						<td class="ve-bold">${hpGain}</td>
					</tr>
				`);

				// Re-roll button for roll mode
				if (this._selections.hpMethod === "roll") {
					const $reroll = $(`<td><button class="ve-btn ve-btn-xs ve-btn-default" title="Re-roll">🎲</button></td>`);
					$reroll.find("button").on("click", () => {
						this._selections.hpRolls[levelKey] = Math.max(1, Math.floor(Math.random() * hitDie) + 1 + conMod);
						renderHpDetails();
					});
					$row.append($reroll);
				}

				$tbody.append($row);
			}

			// Summary
			const currentMaxHp = this._state.getMaxHp();
			const $summary = $(`
				<div class="charsheet__quickbuild-section p-2" style="background: rgba(16, 185, 129, 0.1); border-radius: 8px;">
					<strong>Total HP Gain: +${totalHp}</strong>
					<span class="ve-muted ml-2">(Current ${currentMaxHp} → ${currentMaxHp + totalHp})</span>
				</div>
			`);

			$details.append($table, $summary);

			if (this._selections.hpMethod === "roll") {
				const $rollAllBtn = $(`<button class="ve-btn ve-btn-sm ve-btn-primary mt-2">🎲 Re-roll All</button>`);
				$rollAllBtn.on("click", () => {
					this._selections.hpRolls = {};
					renderHpDetails();
				});
				$details.append($rollAllBtn);
			}
		};

		renderHpDetails();
		$content.append($step);
	}

	_validateHpStep () {
		return true; // HP is always valid (average or rolled)
	}

	// ==========================================
	// Step 9: Review & Confirm
	// ==========================================

	_renderReviewStep ($content) {
		const $step = $(`<div class="charsheet__quickbuild-step"></div>`);
		$step.append(`
			<div class="charsheet__quickbuild-step-header">
				<h4>Review & Confirm</h4>
				<p class="ve-muted">Review your selections before building. Click "Build Character" to apply all changes.</p>
			</div>
		`);

		// Class summary
		const $classSummary = $(`<div class="charsheet__quickbuild-section mb-3"><h5>📊 Classes</h5></div>`);
		this._classAllocations.forEach(alloc => {
			const levelsGained = alloc.targetLevel - (alloc.currentLevel || 0);
			const subclass = this._selections.subclasses[`${alloc.className}_${alloc.classSource}`];
			$classSummary.append(`
				<div class="ve-small mb-1">
					<strong>${alloc.className}</strong> ${alloc.currentLevel || 0} → ${alloc.targetLevel}
					(+${levelsGained} level${levelsGained !== 1 ? "s" : ""})
					${subclass ? `<span class="text-info"> — ${subclass.name}</span>` : ""}
				</div>
			`);
		});
		$step.append($classSummary);

		// ASI / Feat summary
		const asiKeys = Object.keys(this._selections.asi);
		if (asiKeys.length > 0) {
			const $asiSummary = $(`<div class="charsheet__quickbuild-section mb-3"><h5>📈 ASI / Feats</h5></div>`);
			asiKeys.forEach(key => {
				const sel = this._selections.asi[key];
				const [className, classLevel] = key.split("_");
				const increases = Object.entries(sel.abilityChoices || {})
					.filter(([_, v]) => v > 0)
					.map(([abl, v]) => `${Parser.attAbvToFull(abl)} +${v}`);

				let text = `${className} Lv${classLevel}: `;
				if (sel.isBoth) {
					text += `ASI (${increases.join(", ") || "none"}) + Feat: ${sel.feat?.name || "none"}`;
				} else if (sel.mode === "feat") {
					text += `Feat: ${sel.feat?.name || "none"}`;
				} else {
					text += increases.join(", ") || "none";
				}
				$asiSummary.append(`<div class="ve-small mb-1">${text}</div>`);
			});
			$step.append($asiSummary);
		}

		// Optional features summary
		const optFeatKeys = Object.keys(this._selections.optionalFeatures);
		if (optFeatKeys.length > 0) {
			const $optSummary = $(`<div class="charsheet__quickbuild-section mb-3"><h5>✨ Class Options</h5></div>`);
			optFeatKeys.forEach(key => {
				const list = this._selections.optionalFeatures[key];
				if (list.length > 0) {
					$optSummary.append(`<div class="ve-small mb-1">${list.map(f => f.name).join(", ")}</div>`);
				}
			});
			$step.append($optSummary);
		}

		// Feature options summary
		const featOptKeys = Object.keys(this._selections.featureOptions);
		if (featOptKeys.length > 0) {
			const $featOptSummary = $(`<div class="charsheet__quickbuild-section mb-3"><h5>🎯 Feature Choices</h5></div>`);
			featOptKeys.forEach(key => {
				const list = this._selections.featureOptions[key];
				if (list.length > 0) {
					const [className, classLevel, featureName] = key.split("_");
					$featOptSummary.append(`<div class="ve-small mb-1">${featureName}: ${list.map(f => f.name).join(", ")}</div>`);
				}
			});
			$step.append($featOptSummary);
		}

		// Spellbook summary
		if (this._selections.spellbookSpells.length > 0) {
			const $spellSummary = $(`<div class="charsheet__quickbuild-section mb-3"><h5>📕 Spellbook Spells</h5></div>`);
			const byLevel = {};
			this._selections.spellbookSpells.forEach(s => {
				if (!byLevel[s.level]) byLevel[s.level] = [];
				byLevel[s.level].push(s.name);
			});
			Object.entries(byLevel).sort(([a], [b]) => Number(a) - Number(b)).forEach(([lvl, names]) => {
				$spellSummary.append(`<div class="ve-small mb-1">Level ${lvl}: ${names.join(", ")}</div>`);
			});
			$step.append($spellSummary);
		}

		// Known spells summary
		if (this._selections.knownSpells.length > 0 || this._selections.knownCantrips.length > 0) {
			const $knownSummary = $(`<div class="charsheet__quickbuild-section mb-3"><h5>🔮 Spells Known</h5></div>`);
			if (this._selections.knownCantrips.length > 0) {
				$knownSummary.append(`<div class="ve-small mb-1">Cantrips: ${this._selections.knownCantrips.map(s => s.name).join(", ")}</div>`);
			}
			if (this._selections.knownSpells.length > 0) {
				const byLevel = {};
				this._selections.knownSpells.forEach(s => {
					if (!byLevel[s.level]) byLevel[s.level] = [];
					byLevel[s.level].push(s.name);
				});
				Object.entries(byLevel).sort(([a], [b]) => Number(a) - Number(b)).forEach(([lvl, names]) => {
					$knownSummary.append(`<div class="ve-small mb-1">Level ${lvl}: ${names.join(", ")}</div>`);
				});
			}
			$step.append($knownSummary);
		}

		// HP summary
		const conMod = this._state.getAbilityMod("con");
		let totalHp = 0;
		for (const analysis of this._levelAnalysis) {
			const hitDie = this._getClassHitDie(analysis.classData);
			const levelKey = `${analysis.className}_${analysis.classLevel}`;
			if (this._selections.hpMethod === "average") {
				totalHp += Math.max(1, Math.ceil(hitDie / 2) + 1 + conMod);
			} else {
				totalHp += Math.max(1, this._selections.hpRolls[levelKey] || (Math.ceil(hitDie / 2) + 1 + conMod));
			}
		}

		const $hpSummary = $(`
			<div class="charsheet__quickbuild-section mb-3">
				<h5>❤️ Hit Points</h5>
				<div class="ve-small">
					Method: <strong>${this._selections.hpMethod === "average" ? "Average" : "Rolled"}</strong><br>
					HP Gained: <strong>+${totalHp}</strong>
					(${this._state.getMaxHp()} → ${this._state.getMaxHp() + totalHp})
				</div>
			</div>
		`);
		$step.append($hpSummary);

		// Features gained
		const $featureSummary = $(`<div class="charsheet__quickbuild-section mb-3"><h5>⭐ Features Gained</h5></div>`);
		const featureNames = [];
		for (const analysis of this._levelAnalysis) {
			(analysis.features || []).forEach(f => {
				if (!f.gainSubclassFeature && !featureNames.includes(f.name)) {
					featureNames.push(f.name);
				}
			});
		}
		if (featureNames.length > 0) {
			$featureSummary.append(`<div class="ve-small">${featureNames.join(", ")}</div>`);
		} else {
			$featureSummary.append(`<div class="ve-small ve-muted">No new features.</div>`);
		}
		$step.append($featureSummary);

		$content.append($step);
	}

	// ==========================================
	// Batch Apply Engine
	// ==========================================

	/**
	 * Apply all Quick Build selections to the character state.
	 * Mirrors _applyLevelUp() from CharacterSheetLevelUp but processes multiple levels at once.
	 */
	async _applyQuickBuild () {
		const levelUp = this._getLevelUpModule();
		if (!levelUp) {
			JqueryUtil.doToast({type: "danger", content: "Error: Level-up module not available."});
			return;
		}


		const conMod = this._state.getAbilityMod("con");

		// Process each level in order
		for (const analysis of this._levelAnalysis) {
			const {characterLevel, className, classSource, classLevel, classData, features} = analysis;
			const levelKey = `${className}_${classLevel}`;


			// 1. Resolve subclass if this is the subclass level
			let selectedSubclass = null;
			if (analysis.needsSubclass) {
				selectedSubclass = this._selections.subclasses[`${className}_${classSource}`];
			}

			// Re-compute features with subclass if just selected
			let levelFeatures = features;
			if (selectedSubclass) {
				levelFeatures = this._getLevelFeatures(classData, classLevel, selectedSubclass);
			}

			// 2. Update class level
			const classes = this._state.getClasses();
			const targetClass = classes.find(c => c.name === className && c.source === classSource);

			if (targetClass) {
				targetClass.level = classLevel;
				if (selectedSubclass) {
					targetClass.subclass = {
						name: selectedSubclass.name,
						shortName: selectedSubclass.shortName,
						source: selectedSubclass.source,
						casterProgression: selectedSubclass.casterProgression,
						spellcastingAbility: selectedSubclass.spellcastingAbility,
					};
					if (selectedSubclass.casterProgression && !targetClass.casterProgression) {
						targetClass.casterProgression = selectedSubclass.casterProgression;
						targetClass.spellcastingAbility = selectedSubclass.spellcastingAbility;
					}
				}
			} else if (classLevel === 1) {
				// New multiclass — add to state
				this._state.addClass({
					name: className,
					source: classSource,
					level: 1,
					subclass: null,
					casterProgression: classData.casterProgression,
					spellcastingAbility: classData.spellcastingAbility,
				});
			}

			this._state.ensureXpMatchesLevel();
			this._state.ensureUnarmedStrike();

			// 3. Apply ASI / Feat
			if (analysis.hasAsi) {
				const asiSel = this._selections.asi[levelKey];
				if (asiSel) {
					const classEntry = {name: className, source: classSource};
					this._applyAsiOrFeat(asiSel, classEntry, classLevel, classData);
				}
			}

			// 4. Apply Optional Features for this level
			if (analysis.optionalFeatureGains.length > 0) {
				this._applyOptionalFeaturesForLevel(analysis, levelKey);
			}

			// 5. Apply Feature Options for this level
			if (analysis.featureOptions.length > 0) {
				this._applyFeatureOptionsForLevel(analysis);
			}

			// 6. Apply Expertise
			if (analysis.expertiseGrants.length > 0) {
				for (const grant of analysis.expertiseGrants) {
					const expKey = `${className}_${classLevel}_${grant.featureName}`;
					const skills = this._selections.expertise[expKey] || [];
					skills.forEach(skill => this._state.addExpertise(skill.toLowerCase()));
				}
			}

			// 7. Apply Scholar
			if (analysis.isScholarLevel && this._selections.scholarSkill) {
				this._state.setScholarExpertise(this._selections.scholarSkill);
			}

			// 8. Apply Languages
			if (analysis.languageGrants.length > 0) {
				for (const grant of analysis.languageGrants) {
					const langKey = `${className}_${classLevel}_${grant.featureName}`;
					const langs = this._selections.languages[langKey] || [];
					langs.forEach(lang => this._state.addLanguage(lang));
				}
			}

			// 9. Apply HP
			const hitDie = this._getClassHitDie(classData);
			let hpIncrease;
			if (this._selections.hpMethod === "average") {
				hpIncrease = Math.ceil(hitDie / 2) + 1 + conMod;
			} else {
				hpIncrease = this._selections.hpRolls[levelKey]
					|| (Math.ceil(hitDie / 2) + 1 + conMod);
			}
			hpIncrease = Math.max(1, hpIncrease);

			const currentMaxHp = this._state.getMaxHp();
			this._state.setMaxHp(currentMaxHp + hpIncrease);
			this._state.setCurrentHp(this._state.getCurrentHp() + hpIncrease);

			// 10. Add features
			const asiFeatureNames = ["ability score improvement", "ability score increase", "asi"];
			const existingClassFeatureNames = this._state.getFeatures()
				.filter(f => f.className === className && !f.subclassName && !f.isSubclassFeature)
				.map(f => f.name.toLowerCase());

			const featuresToAdd = levelFeatures.filter(f => {
				if (f.gainSubclassFeature) return false;
				const nameLower = f.name.toLowerCase();
				if (asiFeatureNames.some(asi => nameLower.includes(asi))) return false;
				if (!f.isSubclassFeature && !f.subclassName && existingClassFeatureNames.includes(nameLower)) return false;
				return true;
			});

			featuresToAdd.forEach(feature => {
				let description = feature.description;
				if (!description && feature.entries) {
					try { description = Renderer.get().render({entries: feature.entries}); } catch (e) { description = ""; }
				}
				this._state.addFeature({
					name: feature.name,
					source: feature.source || classData.source,
					className: feature.className || className,
					classSource: feature.classSource || classData.source,
					level: feature.level || classLevel,
					subclassName: feature.subclassName,
					subclassShortName: feature.subclassShortName,
					subclassSource: feature.subclassSource,
					featureType: "Class",
					description: description || "",
				});
			});

			// 11. Update hit dice
			levelUp._updateHitDice(classData);

			// 12. Update class resources
			const classEntry = this._state.getClasses().find(c => c.name === className && c.source === classSource);
			if (classEntry) {
				levelUp._updateClassResources(classEntry, classLevel, classData);
			}

			// 13. Update spell slots
			if (classEntry) {
				levelUp._updateSpellSlots(classEntry, classLevel, classData);
			}

			// 14. Record level history
			const historyEntry = this._buildHistoryEntry(analysis, levelKey);
			this._state.recordLevelChoice(historyEntry);
		}

		// Post-loop finalizations

		// Apply weapon masteries
		if (this._selections.weaponMasteries?.length > 0) {
			this._state.setWeaponMasteries(this._selections.weaponMasteries);
		}

		// Apply combat traditions (if selected during QB)
		if (this._selections._combatTraditions?.length > 0) {
			this._state.setCombatTraditions(this._selections._combatTraditions);
		}

		// Apply spellbook spells
		if (this._selections.spellbookSpells.length > 0) {
			this._selections.spellbookSpells.forEach(spell => {
				const isConcentration = spell.concentration || spell.duration?.some?.(d => d.concentration) || false;
				const isRitual = spell.ritual || spell.meta?.ritual || false;
				this._state.addSpell({
					name: spell.name,
					source: spell.source,
					level: spell.level,
					school: spell.school,
					ritual: isRitual,
					concentration: isConcentration,
					prepared: false,
					inSpellbook: true,
					sourceFeature: "Wizard Spellbook",
					sourceClass: "Wizard",
				});
			});
		}

		// Apply known spells (Sorcerer, Bard, Ranger, Warlock, etc.)
		if (this._selections.knownSpells.length > 0) {
			const knownClassName = this._classAllocations.find(a =>
				!a.classData?.preparedSpellsProgression && a.classData?.name !== "Wizard",
			)?.className;
			this._selections.knownSpells.forEach(spell => {
				const isConcentration = spell.concentration || spell.duration?.some?.(d => d.concentration) || false;
				const isRitual = spell.ritual || spell.meta?.ritual || false;
				this._state.addSpell({
					name: spell.name,
					source: spell.source,
					level: spell.level,
					school: spell.school,
					ritual: isRitual,
					concentration: isConcentration,
					prepared: true,
					sourceFeature: "Spells Known",
					sourceClass: knownClassName || "",
				});
			});
		}

		// Apply known cantrips
		if (this._selections.knownCantrips.length > 0) {
			const knownClassName = this._classAllocations.find(a =>
				!a.classData?.preparedSpellsProgression && a.classData?.name !== "Wizard",
			)?.className;
			this._selections.knownCantrips.forEach(spell => {
				this._state.addCantrip({
					name: spell.name,
					source: spell.source,
					school: spell.school,
					sourceFeature: "Cantrips Known",
					sourceClass: knownClassName || "",
				});
			});
		}

		// Check racial spells
		if (levelUp._updateRacialSpells) {
			levelUp._updateRacialSpells();
		}

		// Final recalculations
		this._state.ensureXpMatchesLevel();
		this._state.applyClassFeatureEffects();
		this._state.calculateSpellSlots();
		this._state.recalculateAllCompanions();

		// Save and re-render
		await this._page.saveCharacter();
		this._page.renderCharacter();
		this._page._updateTabVisibility();

		const levelsGained = this._targetLevel - this._fromLevel;
		JqueryUtil.doToast({
			type: "success",
			content: `Quick Build complete! Gained ${levelsGained} level${levelsGained !== 1 ? "s" : ""} (now level ${this._targetLevel}).`,
		});
	}

	// ==========================================
	// Apply Helpers
	// ==========================================

	_applyAsiOrFeat (asiSel, classEntry, classLevel, classData) {
		if (asiSel.isBoth) {
			// Apply ASI
			const increases = [];
			Parser.ABIL_ABVS.forEach(abl => {
				if (asiSel.abilityChoices?.[abl]) {
					const currentBase = this._state.getAbilityBase(abl);
					this._state.setAbilityBase(abl, Math.min(20, currentBase + asiSel.abilityChoices[abl]));
					increases.push(`${Parser.attAbvToFull(abl)} +${asiSel.abilityChoices[abl]}`);
				}
			});
			if (increases.length > 0) {
				this._state.addFeature({
					name: "Ability Score Improvement",
					source: classData.source,
					className: classEntry.name,
					classSource: classEntry.source,
					level: classLevel,
					featureType: "Class",
					description: `<p><strong>Ability Score Increases:</strong> ${increases.join(", ")}</p>`,
					isAsiChoice: true,
				});
			}
			// Apply feat
			if (asiSel.feat) {
				this._state.addFeat(asiSel.feat);
				const levelUp = this._getLevelUpModule();
				if (levelUp) levelUp._applyFeatBonuses(asiSel.feat);
			}
		} else if (asiSel.mode === "feat" && asiSel.feat) {
			this._state.addFeat(asiSel.feat);
			const levelUp = this._getLevelUpModule();
			if (levelUp) levelUp._applyFeatBonuses(asiSel.feat);
		} else if (asiSel.mode === "asi") {
			const increases = [];
			Parser.ABIL_ABVS.forEach(abl => {
				if (asiSel.abilityChoices?.[abl]) {
					const currentBase = this._state.getAbilityBase(abl);
					this._state.setAbilityBase(abl, Math.min(20, currentBase + asiSel.abilityChoices[abl]));
					increases.push(`${Parser.attAbvToFull(abl)} +${asiSel.abilityChoices[abl]}`);
				}
			});
			if (increases.length > 0) {
				this._state.addFeature({
					name: "Ability Score Improvement",
					source: classData.source,
					className: classEntry.name,
					classSource: classEntry.source,
					level: classLevel,
					featureType: "Class",
					description: `<p><strong>Ability Score Increases:</strong> ${increases.join(", ")}</p>`,
					isAsiChoice: true,
				});
			}
		}
	}

	_applyOptionalFeaturesForLevel (analysis, levelKey) {
		// Distribute selected optional features to this level
		analysis.optionalFeatureGains.forEach(gain => {
			const key = gain.featureTypes.join("_");
			const allSelected = this._selections.optionalFeatures[key] || [];
			// Take the next N unassigned
			const alreadyAssigned = this._levelAnalysis
				.filter(a => a !== analysis)
				.reduce((count, a) => {
					return count + a.optionalFeatureGains
						.filter(g => g.featureTypes.join("_") === key)
						.reduce((s, g) => s + g.newCount, 0);
				}, 0);

			// This is simplified — just assign features from the pool in order
			const startIdx = this._getOptionalFeatureStartIndex(key, analysis);
			const endIdx = startIdx + gain.newCount;
			const assigned = allSelected.slice(startIdx, endIdx);

			assigned.forEach(opt => {
				const featureData = {
					name: opt.name,
					source: opt.source,
					className: analysis.className,
					classSource: analysis.classSource,
					level: analysis.classLevel,
					featureType: "Optional Feature",
					optionalFeatureTypes: opt.featureType || gain.featureTypes,
					description: opt.entries ? Renderer.get().render({entries: opt.entries}) : "",
					entries: opt.entries,
				};
				this._state.addFeature(featureData);
			});
		});
	}

	_getOptionalFeatureStartIndex (typeKey, targetAnalysis) {
		let idx = 0;
		for (const analysis of this._levelAnalysis) {
			if (analysis === targetAnalysis) break;
			for (const gain of analysis.optionalFeatureGains) {
				if (gain.featureTypes.join("_") === typeKey) {
					idx += gain.newCount;
				}
			}
		}
		return idx;
	}

	_applyFeatureOptionsForLevel (analysis) {
		analysis.featureOptions.forEach(optGroup => {
			const levelKey = `${analysis.className}_${analysis.classLevel}_${optGroup.featureName}`;
			const selected = this._selections.featureOptions[levelKey] || [];

			selected.forEach(opt => {
				if (opt.type === "classFeature" && opt.ref) {
					const classFeatures = this._page.getClassFeatures();
					const parts = opt.ref.split("|");
					const fullOpt = classFeatures.find(f =>
						f.name === parts[0] && f.className === parts[1] && f.source === parts[2],
					);
					this._state.addFeature({
						name: opt.name,
						source: opt.source || fullOpt?.source || analysis.classSource,
						level: opt.level || analysis.classLevel,
						className: analysis.className,
						classSource: analysis.classSource,
						featureType: "Class",
						entries: fullOpt?.entries,
						description: fullOpt?.entries ? Renderer.get().render({entries: fullOpt.entries}) : "",
						isFeatureOption: true,
						parentFeature: optGroup.featureName,
					});
				} else if (opt.type === "subclassFeature" && opt.ref) {
					const subclass = this._getSubclassForClass(analysis.className, analysis.classSource, analysis.classLevel);
					this._state.addFeature({
						name: opt.name,
						source: opt.subclassSource || subclass?.source || analysis.classSource,
						level: opt.level || analysis.classLevel,
						className: analysis.className,
						classSource: analysis.classSource,
						subclassName: subclass?.name,
						subclassShortName: opt.subclassShortName || subclass?.shortName,
						featureType: "Class",
						isSubclassFeature: true,
						isFeatureOption: true,
						parentFeature: optGroup.featureName,
					});
				} else if (opt.type === "optionalfeature" && opt.ref) {
					const allOptFeats = this._page.getOptionalFeatures();
					const fullOpt = allOptFeats.find(f => f.name === opt.name);
					this._state.addFeature({
						name: opt.name,
						source: opt.source || fullOpt?.source,
						level: analysis.classLevel,
						className: analysis.className,
						classSource: analysis.classSource,
						featureType: "Optional Feature",
						entries: fullOpt?.entries,
						description: fullOpt?.entries ? Renderer.get().render({entries: fullOpt.entries}) : "",
						isFeatureOption: true,
						parentFeature: optGroup.featureName,
					});
				}
			});
		});
	}

	_buildHistoryEntry (analysis, levelKey) {
		const entry = {
			level: analysis.characterLevel,
			class: {name: analysis.className, source: analysis.classSource},
			choices: {},
			complete: true,
			timestamp: Date.now(),
		};

		// ASI / Feat
		const asiSel = this._selections.asi[levelKey];
		if (asiSel) {
			if (asiSel.feat) {
				entry.choices.feat = {name: asiSel.feat.name, source: asiSel.feat.source};
			}
			const asiData = {};
			Parser.ABIL_ABVS.forEach(abl => {
				if (asiSel.abilityChoices?.[abl]) asiData[abl] = asiSel.abilityChoices[abl];
			});
			if (Object.keys(asiData).length > 0) entry.choices.asi = asiData;
		}

		// Subclass
		const subclass = this._selections.subclasses[`${analysis.className}_${analysis.classSource}`];
		if (analysis.needsSubclass && subclass) {
			entry.choices.subclass = {name: subclass.name, shortName: subclass.shortName, source: subclass.source};
		}

		// Optional features
		const optFeatures = [];
		analysis.optionalFeatureGains.forEach(gain => {
			const key = gain.featureTypes.join("_");
			const startIdx = this._getOptionalFeatureStartIndex(key, analysis);
			const allSelected = this._selections.optionalFeatures[key] || [];
			const assigned = allSelected.slice(startIdx, startIdx + gain.newCount);
			assigned.forEach(opt => {
				optFeatures.push({name: opt.name, source: opt.source, type: key});
			});
		});
		if (optFeatures.length > 0) entry.choices.optionalFeatures = optFeatures;

		// Feature options
		const featureChoices = [];
		analysis.featureOptions.forEach(optGroup => {
			const selKey = `${analysis.className}_${analysis.classLevel}_${optGroup.featureName}`;
			const selected = this._selections.featureOptions[selKey] || [];
			selected.forEach(opt => {
				featureChoices.push({featureName: optGroup.featureName, choice: opt.name, source: opt.source});
			});
		});
		if (featureChoices.length > 0) entry.choices.featureChoices = featureChoices;

		// Expertise
		analysis.expertiseGrants.forEach(grant => {
			const expKey = `${analysis.className}_${analysis.classLevel}_${grant.featureName}`;
			const skills = this._selections.expertise[expKey] || [];
			if (skills.length > 0) entry.choices.expertise = skills.map(s => s.toLowerCase());
		});

		// Languages
		analysis.languageGrants.forEach(grant => {
			const langKey = `${analysis.className}_${analysis.classLevel}_${grant.featureName}`;
			const langs = this._selections.languages[langKey] || [];
			if (langs.length > 0) {
				entry.choices.languages = langs.map(l => ({featureName: grant.featureName, language: l}));
			}
		});

		// Scholar
		if (analysis.isScholarLevel && this._selections.scholarSkill) {
			entry.choices.scholarSkill = this._selections.scholarSkill;
		}

		return entry;
	}
}

// Export
export {CharacterSheetQuickBuild};
globalThis.CharacterSheetQuickBuild = CharacterSheetQuickBuild;
