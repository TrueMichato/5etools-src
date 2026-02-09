/**
 * Character Sheet Level Up
 * Handles level up process including class features, ability score improvements, subclass selection
 */
class CharacterSheetLevelUp {
	constructor (page) {
		this._page = page;
		this._state = page.getState();
		this._selectedFeatureSkillChoices = {}; // For specialty features that require skill/expertise choices
	}

	/**
	 * Find entries of type "options" in a feature's entries array
	 * These represent choices the player must make (like Specialties)
	 * @param {Object} feature - The feature object with entries
	 * @param {number} characterLevel - Current character level for filtering
	 * @returns {Array} Array of {count, options} objects
	 */
	_findFeatureOptions (feature, characterLevel = 1) {
		if (!feature?.entries) return [];

		const results = [];

		const searchEntries = (entries) => {
			if (!Array.isArray(entries)) return;

			for (const entry of entries) {
				if (typeof entry === "object" && entry.type === "options") {
					// Found an options entry
					const count = entry.count || 1;
					const options = [];

					// Process the option entries
					if (entry.entries) {
						for (const opt of entry.entries) {
							if (opt.type === "refClassFeature" && opt.classFeature) {
								// Parse "FeatureName|ClassName|Source|Level" format
								const parts = opt.classFeature.split("|");
								const optLevel = parseInt(parts[3]) || 1;

								// Only include options available at current level
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
								const optLevel = parseInt(parts[5]) || 1;

								if (optLevel <= characterLevel) {
									options.push({
										name: parts[0],
										className: parts[1],
										classSource: parts[2],
										subclassShortName: parts[3],
										subclassSource: parts[4],
										level: optLevel,
										type: "subclassFeature",
										ref: opt.subclassFeature,
									});
								}
							} else if (opt.type === "refOptionalfeature" && opt.optionalfeature) {
								options.push({
									name: opt.optionalfeature.split("|")[0],
									source: opt.optionalfeature.split("|")[1],
									type: "optionalfeature",
									ref: opt.optionalfeature,
								});
							} else if (typeof opt === "string") {
								options.push({
									name: opt,
									type: "text",
								});
							}
						}
					}

					if (options.length > 0) {
						results.push({count, options, featureName: feature.name});
					}
				} else if (typeof entry === "string") {
					// Check for features that reference another feature's options
					// Pattern: "{@classFeature FeatureName|ClassName|Source|Level}" in text like
					// "You gain another specialty of your choice from the {@classFeature Specialties|Fighter|TGTT|1}."
					const refMatch = entry.match(/\{@classFeature\s+([^}]+)\}/);
					if (refMatch && /another|additional|gain/i.test(entry)) {
						const refParts = refMatch[1].split("|");
						const refFeatureName = refParts[0];
						const refClassName = refParts[1];
						const refSource = refParts[2];
						const refLevel = parseInt(refParts[3]) || 1;

						// Look up the referenced feature
						const referencedFeature = this._getClassFeatureByRef(refFeatureName, refClassName, refSource, refLevel);
						if (referencedFeature) {
							// Get options from the referenced feature
							const refResults = this._findFeatureOptions(referencedFeature, characterLevel);
							for (const refResult of refResults) {
								// Use count of 1 for "gain another" features
								results.push({
									count: 1,
									options: refResult.options,
									featureName: feature.name,
									referencedFrom: refMatch[1],
								});
							}
						}
					}
				}

				// Recursively search nested entries
				if (entry.entries) {
					searchEntries(entry.entries);
				}
			}
		};

		searchEntries(feature.entries);
		return results;
	}

	/**
	 * Look up a class feature by reference parts
	 */
	_getClassFeatureByRef (featureName, className, source, level) {
		const classFeatures = this._page.getClassFeatures();
		if (!classFeatures?.length) return null;

		return classFeatures.find(f => {
			if (f.name !== featureName) return false;
			if (f.className !== className) return false;
			if (f.level !== level) return false;
			// Be flexible with source matching
			if (source && f.source && f.source !== source) {
				return false;
			}
			return true;
		});
	}

	/**
	 * Get feature options from features gained at a specific level
	 * @param {Array} features - Array of features gained at this level
	 * @param {number} level - The level being gained
	 * @returns {Array} Array of {featureName, featureSource, count, options} objects
	 */
	_getFeatureOptionsForLevel (features, level) {
		const allOptions = [];

		for (const feature of features) {
			const featureOptions = this._findFeatureOptions(feature, level);
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
	 * Get expertise grants from features at the new level
	 * Features like Deft Explorer Improvement grant expertise at levels 6 and 10
	 * @param {Array} features - Features gained at the new level
	 * @returns {Array} Array of {featureName, count, allowTools, toolName} objects
	 */
	_getExpertiseGrantsForLevel (features) {
		const grants = [];

		for (const feature of features) {
			const expertiseInfo = this._findExpertiseInFeature(feature);
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
	 * Find expertise grant in a feature's entries
	 * @param {Object} feature - Feature with entries
	 * @returns {{count: number, allowTools: boolean, toolName: string}|null}
	 */
	_findExpertiseInFeature (feature) {
		if (!feature?.entries) return null;

		// Check if feature name is "Expertise"
		if (feature.name === "Expertise") {
			return this._parseExpertiseEntries(feature.entries);
		}

		// Search nested entries for Expertise grants
		return this._findExpertiseInEntries(feature.entries);
	}

	/**
	 * Recursively search entries for nested Expertise grants
	 * @param {Array} entries - Feature entries
	 * @returns {{count: number, allowTools: boolean, toolName: string}|null}
	 */
	_findExpertiseInEntries (entries) {
		for (const entry of entries) {
			if (typeof entry === "object" && entry.type === "entries") {
				// Check if this sub-entry's name is "Expertise"
				if (entry.name === "Expertise") {
					return this._parseExpertiseEntries(entry.entries || []);
				}
				// Check if this sub-entry's text grants expertise
				if (this._entryGrantsExpertise(entry.entries || [])) {
					return this._parseExpertiseEntries(entry.entries || []);
				}
				// Recursively check nested entries
				if (entry.entries) {
					const result = this._findExpertiseInEntries(entry.entries);
					if (result) return result;
				}
			}
		}
		return null;
	}

	/**
	 * Check if entries text indicates an expertise grant
	 * @param {Array} entries - Feature entries to check
	 * @returns {boolean}
	 */
	_entryGrantsExpertise (entries) {
		const entriesText = entries.map(e => typeof e === "string" ? e : JSON.stringify(e)).join(" ").toLowerCase();
		return entriesText.includes("proficiency bonus is doubled")
			|| entriesText.includes("gain expertise")
			|| entriesText.includes("double your proficiency bonus");
	}

	/**
	 * Parse expertise entries to determine count and tool allowance
	 * @param {Array} entries - Expertise feature entries
	 * @returns {{count: number, allowTools: boolean, toolName: string}}
	 */
	_parseExpertiseEntries (entries) {
		const entriesText = entries.map(e => typeof e === "string" ? e : JSON.stringify(e)).join(" ").toLowerCase();

		// Determine count - look for expertise-specific patterns
		// We need to be careful: "two languages" shouldn't affect expertise count
		// Look for patterns like "one of your skill proficiencies" or "two skill proficiencies"
		let count = 1; // Default to 1 for safety

		// Check for specific expertise-granting patterns
		// "choose two skills" or "two of your skill proficiencies"
		if (entriesText.match(/(?:choose|pick|select|gain|get)\s+(?:two|2)\s+(?:skills?|proficienc)/i)
			|| entriesText.match(/two\s+(?:of\s+)?(?:your\s+)?skill(?:\s+proficienc)?/i)) {
			count = 2;
		}
		// "choose one skill" or "one of your skill proficiencies" (this should take precedence)
		if (entriesText.match(/(?:choose|pick|select|gain|get)\s+(?:one|1|a)\s+(?:skill|proficienc)/i)
			|| entriesText.match(/one\s+(?:of\s+)?(?:your\s+)?skill(?:\s+proficienc)?/i)) {
			count = 1;
		}
		// "another" typically means 1 additional
		if (entriesText.includes("another")) count = 1;
		// Explicit number mentions with expertise
		if (entriesText.includes("three") && entriesText.includes("expertise")) count = 3;
		if (entriesText.includes("four") && entriesText.includes("expertise")) count = 4;

		// Check if tools are allowed
		const allowTools = entriesText.includes("thieves' tools") && !entriesText.includes("variantrule");

		return {
			count,
			allowTools,
			toolName: allowTools ? "Thieves' Tools" : null,
		};
	}

	/**
	 * Get language grants from features at the new level
	 * Features like Deft Explorer Improvement grant languages at levels 6 and 10
	 * @param {Array} features - Features gained at the new level
	 * @returns {Array} Array of {featureName, count} objects
	 */
	_getLanguageGrantsForLevel (features) {
		const grants = [];

		for (const feature of features) {
			const langInfo = this._findLanguageGrantsInFeature(feature);
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
	 * Find language grant in a feature's entries
	 * @param {Object} feature - Feature with entries
	 * @returns {{count: number}|null}
	 */
	_findLanguageGrantsInFeature (feature) {
		if (!feature?.entries) return null;
		return this._findLanguageGrantsInEntries(feature.entries, feature.name);
	}

	/**
	 * Recursively search entries for language grants
	 * @param {Array} entries - Feature entries
	 * @param {string} featureName - Name of the feature for reference
	 * @returns {{count: number}|null}
	 */
	_findLanguageGrantsInEntries (entries, featureName) {
		const entriesText = entries.map(e => {
			if (typeof e === "string") return e;
			if (typeof e === "object" && e.type === "list" && e.items) {
				return e.items.map(item => typeof item === "string" ? item : JSON.stringify(item)).join(" ");
			}
			return JSON.stringify(e);
		}).join(" ").toLowerCase();

		// Check for language-granting patterns
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

				// Special cases for patterns without capture groups
				if (count === 0 && entriesText.includes("two additional languages")) count = 2;
				if (count === 0 && entriesText.includes("two languages of your choice")) count = 2;
				if (count === 0 && entriesText.includes("one additional language")) count = 1;
				if (count === 0 && entriesText.includes("one language of your choice")) count = 1;

				if (count > 0) {
					return {count};
				}
			}
		}

		// Recursively check nested entries
		for (const entry of entries) {
			if (typeof entry === "object" && entry.entries) {
				const result = this._findLanguageGrantsInEntries(entry.entries, featureName);
				if (result) return result;
			}
		}

		return null;
	}

	/**
	 * Show level up dialog for a specific class
	 * @param {string} className - The class to level up (optional, prompts if multiple classes)
	 */
	async showLevelUp (className = null) {
		const classes = this._state.getClasses();

		if (!classes.length) {
			JqueryUtil.doToast({type: "warning", content: "Create a character first before leveling up."});
			return;
		}

		// If character has multiple classes and no class specified, prompt to choose
		let targetClass = null;
		if (className) {
			targetClass = classes.find(c => c.name === className);
		} else if (classes.length === 1) {
			targetClass = classes[0];
		} else {
			// Prompt user to select which class to level
			const classChoice = await InputUiUtil.pGetUserEnum({
				title: "Level Up",
				fnDisplay: c => `${c.name} (Level ${c.level})`,
				values: classes,
				isResolveItem: true,
			});
			if (!classChoice) return;
			targetClass = classChoice;
		}

		if (!targetClass) {
			JqueryUtil.doToast({type: "warning", content: "Class not found."});
			return;
		}

		await this._doLevelUp(targetClass);
	}

	async _doLevelUp (classEntry) {
		const classData = this._page.getClasses().find(c => c.name === classEntry.name && c.source === classEntry.source);
		if (!classData) {
			JqueryUtil.doToast({type: "danger", content: "Class data not found."});
			return;
		}

		const currentLevel = classEntry.level;
		const newLevel = currentLevel + 1;

		if (newLevel > 20) {
			JqueryUtil.doToast({type: "warning", content: "Maximum level (20) reached for this class."});
			return;
		}

		// Check total level cap
		const totalLevel = this._state.getTotalLevel();
		if (totalLevel >= 20) {
			JqueryUtil.doToast({type: "warning", content: "Character has reached maximum total level (20)."});
			return;
		}

		// Look up full subclass data if we have a saved subclass reference
		let fullSubclassData = null;
		if (classEntry.subclass && classData.subclasses) {
			fullSubclassData = classData.subclasses.find(sc =>
				sc.name === classEntry.subclass.name
				&& (sc.source === classEntry.subclass.source || !classEntry.subclass.source),
			);
		}

		// Get features for the new level
		const newFeatures = this._getLevelFeatures(classData, newLevel, fullSubclassData);

		// Check if this level grants an ASI
		const hasAsi = this._levelGrantsAsi(classData, newLevel);

		// Check if this level grants a subclass (usually level 3 for most classes)
		const needsSubclass = this._levelGrantsSubclass(classData, newLevel) && !classEntry.subclass;

		// Build the level up modal
		await this._pShowLevelUpModal({
			classData,
			classEntry,
			newLevel,
			newFeatures,
			hasAsi,
			needsSubclass,
		});
	}

	async _pShowLevelUpModal ({classData, classEntry, newLevel, newFeatures, hasAsi, needsSubclass}) {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: `🎉 Level Up: ${classEntry.name} → Level ${newLevel}`,
			isMinHeight0: true,
			isWidth100: true,
		});

		let asiChoices = {str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0};
		let selectedFeat = null;
		let selectedSubclass = null;
		let hpMethod = "average";
		let currentFeatures = newFeatures; // Track current features
		let selectedOptionalFeatures = {}; // Track optional feature selections by type

		const $content = $(`<div class="charsheet__levelup-body"></div>`).appendTo($modalInner);
		let $featuresSection = null; // Reference to features section for updates

		// Filter out ASI-related features if ASI is being handled separately
		const filterAsiFeatures = (features) => {
			if (!hasAsi) return features;
			// Filter out features whose names indicate they are ASI/Feat choices
			const asiFeatureNames = [
				"ability score improvement",
				"ability score increase",
				"asi",
				"feat",
			];
			return features.filter(f => {
				const nameLower = f.name.toLowerCase();
				return !asiFeatureNames.some(asi => nameLower.includes(asi));
			});
		};

		// Helper to update features display
		const updateFeaturesDisplay = () => {
			if ($featuresSection) {
				$featuresSection.remove();
			}
			const filteredFeatures = filterAsiFeatures(currentFeatures);
			if (filteredFeatures.length) {
				$featuresSection = this._renderNewFeatures(filteredFeatures);
				// Insert before HP section (or at end if no HP section)
				const $hpSection = $content.find(".charsheet__levelup-section").last();
				if ($hpSection.length) {
					$featuresSection.insertBefore($hpSection);
				} else {
					$content.append($featuresSection);
				}
			}
		};

		// Feature options tracking - defined early for use in subclass callback
		let selectedFeatureOptions = {};
		let featureOptionGroups = [];
		this._selectedFeatureSkillChoices = {}; // Reset skill sub-choices for new level-up
		let $featOptSection = null;

		const updateFeatureOptionsDisplay = () => {
			if ($featOptSection) {
				$featOptSection.remove();
				$featOptSection = null;
			}
			selectedFeatureOptions = {}; // Reset selections when features change
			featureOptionGroups = this._getFeatureOptionsForLevel(currentFeatures, newLevel);
			if (featureOptionGroups.length) {
				$featOptSection = this._renderFeatureOptionsSelection(featureOptionGroups, (featureKey, options) => {
					selectedFeatureOptions[featureKey] = options;
				});
				// Insert after optional features section or before HP section
				const $hpSection = $content.find(".charsheet__levelup-section").last();
				if ($hpSection.length) {
					$featOptSection.insertBefore($hpSection);
				} else {
					$content.append($featOptSection);
				}
			}
		};

		// Subclass selection
		if (needsSubclass) {
			const $subclassSection = this._renderSubclassSelection(classData, (subclass) => {
				selectedSubclass = subclass;
				// Update features to include subclass features and filter out placeholders
				currentFeatures = this._getLevelFeatures(classData, newLevel, subclass);
				updateFeaturesDisplay();
				updateFeatureOptionsDisplay();
				// Note: updateExpertiseDisplay and updateLanguageDisplay are defined after this block
				// They will be called on initial render, but subclass selection at levels with
				// expertise/language grants is uncommon (usually level 3 when these features come at 6+)
			});
			$content.append($subclassSection);
		}

		// ASI / Feat selection
		if (hasAsi) {
			// Check if Thelemar ASI+Feat rule is enabled and this is level 4
			const thelemar_asiFeat = this._state.getSettings()?.thelemar_asiFeat || false;
			const isBothAsiAndFeat = thelemar_asiFeat && newLevel === 4;

			const $asiSection = this._renderAsiSelection(
				(ability, delta) => {
					asiChoices[ability] = (asiChoices[ability] || 0) + delta;
				},
				(feat) => {
					selectedFeat = feat;
				},
				isBothAsiAndFeat, // Pass flag to show both
			);
			$content.append($asiSection);
		}

		// Optional features (metamagic, invocations, maneuvers, etc.)
		const optionalFeatureGains = this._getOptionalFeatureGains(classData, classEntry.level, newLevel);
		if (optionalFeatureGains.length) {
			const $optSection = this._renderOptionalFeaturesSelection(classData, optionalFeatureGains, (featureType, features) => {
				selectedOptionalFeatures[featureType] = features;
			}, newLevel);
			$content.append($optSection);
		}

		// Feature options (features with embedded type: "options", like Specialties)
		// Initial render (updateFeatureOptionsDisplay is defined above for subclass callback use)
		featureOptionGroups = this._getFeatureOptionsForLevel(currentFeatures, newLevel);
		if (featureOptionGroups.length) {
			$featOptSection = this._renderFeatureOptionsSelection(featureOptionGroups, (featureKey, options) => {
				selectedFeatureOptions[featureKey] = options;
			});
			$content.append($featOptSection);
		}

		// Expertise grants from features like Deft Explorer Improvement
		let selectedExpertise = {};
		let expertiseGrants = this._getExpertiseGrantsForLevel(currentFeatures);
		let $expertiseSection = null;

		const updateExpertiseDisplay = () => {
			if ($expertiseSection) {
				$expertiseSection.remove();
				$expertiseSection = null;
			}
			selectedExpertise = {}; // Reset selections when features change
			expertiseGrants = this._getExpertiseGrantsForLevel(currentFeatures);
			if (expertiseGrants.length) {
				$expertiseSection = this._renderExpertiseSelectionForLevelUp(expertiseGrants, (featureKey, skills) => {
					selectedExpertise[featureKey] = skills;
				});
				// Insert before HP section
				const $hpSection = $content.find(".charsheet__levelup-section").last();
				if ($hpSection.length) {
					$expertiseSection.insertBefore($hpSection);
				} else {
					$content.append($expertiseSection);
				}
			}
		};

		if (expertiseGrants.length) {
			$expertiseSection = this._renderExpertiseSelectionForLevelUp(expertiseGrants, (featureKey, skills) => {
				selectedExpertise[featureKey] = skills;
			});
			$content.append($expertiseSection);
		}

		// Language grants from features like Deft Explorer Improvement
		let selectedLanguages = {};
		let languageGrants = this._getLanguageGrantsForLevel(currentFeatures);
		let $languageSection = null;

		const updateLanguageDisplay = () => {
			if ($languageSection) {
				$languageSection.remove();
				$languageSection = null;
			}
			selectedLanguages = {}; // Reset selections when features change
			languageGrants = this._getLanguageGrantsForLevel(currentFeatures);
			if (languageGrants.length) {
				$languageSection = this._renderLanguageSelectionForLevelUp(languageGrants, (featureKey, languages) => {
					selectedLanguages[featureKey] = languages;
				});
				// Insert before HP section
				const $hpSection = $content.find(".charsheet__levelup-section").last();
				if ($hpSection.length) {
					$languageSection.insertBefore($hpSection);
				} else {
					$content.append($languageSection);
				}
			}
		};

		if (languageGrants.length) {
			$languageSection = this._renderLanguageSelectionForLevelUp(languageGrants, (featureKey, languages) => {
				selectedLanguages[featureKey] = languages;
			});
			$content.append($languageSection);
		}

		// New features (initial render with ASI features filtered)
		const filteredFeatures = filterAsiFeatures(currentFeatures);
		if (filteredFeatures.length) {
			$featuresSection = this._renderNewFeatures(filteredFeatures);
			$content.append($featuresSection);
		}

		// HP increase section
		const $hpSection = this._renderHpIncrease(classData, newLevel, (method) => { hpMethod = method; });
		$content.append($hpSection);

		// Footer buttons
		const $btnCancel = $(`<button class="ve-btn ve-btn-default">Cancel</button>`)
			.on("click", () => doClose(false));
		const $btnConfirm = $(`<button class="ve-btn ve-btn-primary"><span class="glyphicon glyphicon-arrow-up"></span> Level Up</button>`)
			.on("click", async () => {
				// Validate subclass if needed
				if (needsSubclass && !selectedSubclass) {
					JqueryUtil.doToast({type: "warning", content: "Please select a subclass."});
					return;
				}

				// Validate ASI if applicable
				if (hasAsi) {
					const thelemar_asiFeat = this._state.getSettings()?.thelemar_asiFeat || false;
					const isBothAsiAndFeat = thelemar_asiFeat && newLevel === 4;

					const totalAsi = Object.values(asiChoices).reduce((sum, v) => sum + v, 0);

					if (isBothAsiAndFeat) {
						// Need both ASI points spent AND a feat selected
						if (totalAsi !== 2) {
							JqueryUtil.doToast({type: "warning", content: "Please allocate all ability score points (2 total)."});
							return;
						}
						if (!selectedFeat) {
							JqueryUtil.doToast({type: "warning", content: "Please also select a feat (Thelemar rules: ASI + Feat at level 4)."});
							return;
						}
					} else if (!selectedFeat) {
						// Normal rules: either ASI or Feat
						if (totalAsi !== 2) {
							JqueryUtil.doToast({type: "warning", content: "Please allocate all ability score points (2 total)."});
							return;
						}
					}
				}

				// Validate optional features if applicable
				for (const gain of optionalFeatureGains) {
					const featureKey = gain.featureTypes.join("_");
					const selected = selectedOptionalFeatures[featureKey] || [];
					if (selected.length < gain.newCount) {
						JqueryUtil.doToast({type: "warning", content: `Please select ${gain.newCount} ${gain.name}.`});
						return;
					}
				}

				// Validate feature options if applicable
				for (const optGroup of featureOptionGroups) {
					const featureKey = `${optGroup.featureName}_${optGroup.featureSource || ""}`;
					const selected = selectedFeatureOptions[featureKey] || [];
					if (selected.length < optGroup.count) {
						JqueryUtil.doToast({type: "warning", content: `Please select ${optGroup.count} option(s) for ${optGroup.featureName}.`});
						return;
					}
				}

				// Validate expertise selections if applicable
				for (const grant of expertiseGrants) {
					const selected = selectedExpertise[grant.featureName] || [];
					if (selected.length < grant.count) {
						JqueryUtil.doToast({type: "warning", content: `Please select ${grant.count} skill(s) for expertise from ${grant.featureName}.`});
						return;
					}
				}

				// Validate language selections if applicable
				for (const grant of languageGrants) {
					const selected = selectedLanguages[grant.featureName] || [];
					if (selected.length < grant.count) {
						JqueryUtil.doToast({type: "warning", content: `Please select ${grant.count} language(s) from ${grant.featureName}.`});
						return;
					}
				}

				// Apply level up
				await this._applyLevelUp({
					classEntry,
					newLevel,
					asiChoices,
					selectedFeat,
					selectedSubclass,
					selectedOptionalFeatures,
					selectedFeatureOptions,
					selectedExpertise,
					selectedLanguages,
					newFeatures: currentFeatures, // Use updated features if subclass was selected
					hpMethod,
					classData,
				});

				doClose(true);
			});

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			${$btnCancel}
			${$btnConfirm}
		</div>`.appendTo($modalInner);
	}

	_renderSubclassSelection (classData, onSelect) {
		const subclasses = classData.subclasses || [];

		const $section = $(`
			<div class="charsheet__levelup-section">
				<h5 class="charsheet__levelup-section-title">
					📚 Choose ${classData.subclassTitle || "Subclass"}
				</h5>
				<div class="charsheet__levelup-subclasses"></div>
			</div>
		`);

		const $container = $section.find(".charsheet__levelup-subclasses");

		subclasses.forEach(subclass => {
			console.log(`[LevelUp] Available subclass: ${subclass.name}, has subclassFeatures: ${!!subclass.subclassFeatures}, count: ${subclass.subclassFeatures?.length || 0}`);
			const $option = $(`
				<div class="charsheet__levelup-option" data-subclass="${subclass.name}">
					<div class="charsheet__levelup-option-header">
						<input type="radio" name="subclass-choice" value="${subclass.name}">
						<strong>${subclass.name}</strong>
						<span class="ve-muted">(${Parser.sourceJsonToAbv(subclass.source)})</span>
					</div>
					<div class="charsheet__levelup-option-description ve-small ve-muted">
						${subclass.shortName || ""}
					</div>
				</div>
			`);

			$option.on("click", () => {
				$container.find(".charsheet__levelup-option").removeClass("selected");
				$option.addClass("selected");
				$option.find("input").prop("checked", true);
				onSelect(subclass);
			});

			$container.append($option);
		});

		return $section;
	}

	_renderAsiSelection (onAsiChange, onFeatSelect, isBothAsiAndFeat = false) {
		// When Thelemar rules give both ASI and Feat at level 4
		const sectionTitle = isBothAsiAndFeat
			? "📈 Ability Score Improvement + Feat (Thelemar)"
			: "📈 Ability Score Improvement";

		const $section = $(`
			<div class="charsheet__levelup-section">
				<h5 class="charsheet__levelup-section-title">
					${sectionTitle}
				</h5>
				${isBothAsiAndFeat ? `
					<div class="alert alert-info ve-small mb-3">
						<strong>🌍 Thelemar Rule:</strong> At level 4, you gain both an ASI <em>and</em> a feat!
					</div>
				` : `
					<div class="charsheet__levelup-asi-choice mb-3">
						<label class="ve-flex-v-center mr-3">
							<input type="radio" name="asi-type" value="asi" checked class="mr-1">
							<span>Increase Ability Scores (+2 total)</span>
						</label>
						<label class="ve-flex-v-center">
							<input type="radio" name="asi-type" value="feat" class="mr-1">
							<span>Take a Feat</span>
						</label>
					</div>
				`}
				<div id="asi-abilities-container"></div>
				<div id="asi-feats-container" style="${isBothAsiAndFeat ? "" : "display: none;"}"></div>
			</div>
		`);

		const $abilitiesContainer = $section.find("#asi-abilities-container");
		const $featsContainer = $section.find("#asi-feats-container");

		// Toggle between ASI and Feat (only if not both)
		if (!isBothAsiAndFeat) {
			$section.find("input[name=\"asi-type\"]").on("change", (e) => {
				if (e.target.value === "asi") {
					$abilitiesContainer.show();
					$featsContainer.hide();
					onFeatSelect(null);
				} else {
					$abilitiesContainer.hide();
					$featsContainer.show();
				}
			});
		}

		// Add section labels when both are shown
		if (isBothAsiAndFeat) {
			$abilitiesContainer.prepend(`<h6 class="ve-bold mb-2">📊 Ability Score Increase (+2 points)</h6>`);
			$featsContainer.prepend(`<h6 class="ve-bold mb-2 mt-3">🎭 Select a Feat</h6>`);
		}

		// Ability score selectors
		let pointsRemaining = 2;
		const asiValues = {str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0};

		const updatePointsDisplay = () => {
			$abilitiesContainer.find(".asi-points-remaining").text(pointsRemaining);
		};

		const $abilitiesGrid = $(`
			<div class="charsheet__levelup-asi-grid">
				<div class="ve-text-center mb-2">Points remaining: <strong class="asi-points-remaining">${pointsRemaining}</strong></div>
			</div>
		`);

		Parser.ABIL_ABVS.forEach(abl => {
			const currentScore = this._state.getAbilityScore(abl);

			const $row = $(`
				<div class="charsheet__levelup-asi-row">
					<span class="charsheet__levelup-asi-name">${Parser.attAbvToFull(abl)}</span>
					<span class="charsheet__levelup-asi-current">${currentScore}</span>
					<button class="ve-btn ve-btn-xs ve-btn-default asi-minus" data-ability="${abl}">−</button>
					<span class="charsheet__levelup-asi-bonus" id="asi-bonus-${abl}">+0</span>
					<button class="ve-btn ve-btn-xs ve-btn-default asi-plus" data-ability="${abl}">+</button>
					<span class="charsheet__levelup-asi-new" id="asi-new-${abl}">${currentScore}</span>
				</div>
			`);

			$row.find(".asi-minus").on("click", () => {
				if (asiValues[abl] <= 0) return;
				asiValues[abl]--;
				pointsRemaining++;
				$row.find(`#asi-bonus-${abl}`).text(asiValues[abl] > 0 ? `+${asiValues[abl]}` : "+0");
				$row.find(`#asi-new-${abl}`).text(currentScore + asiValues[abl]);
				updatePointsDisplay();
				onAsiChange(abl, -1);
			});

			$row.find(".asi-plus").on("click", () => {
				if (pointsRemaining <= 0) return;
				if (asiValues[abl] >= 2) return; // Max +2 per ability
				if (currentScore + asiValues[abl] >= 20) return; // Cap at 20
				asiValues[abl]++;
				pointsRemaining--;
				$row.find(`#asi-bonus-${abl}`).text(`+${asiValues[abl]}`);
				$row.find(`#asi-new-${abl}`).text(currentScore + asiValues[abl]);
				updatePointsDisplay();
				onAsiChange(abl, 1);
			});

			$abilitiesGrid.append($row);
		});

		$abilitiesContainer.append($abilitiesGrid);

		// Feats list - filtered by allowed sources
		const feats = this._page.filterByAllowedSources(this._page.getFeats() || []);
		const $featSearch = $(`<input type="text" class="form-control mb-2" placeholder="Search feats...">`);
		const $featList = $(`<div class="charsheet__levelup-feats-list"></div>`);

		const renderFeats = (filter = "") => {
			$featList.empty();
			const filteredFeats = feats.filter(f =>
				f.name.toLowerCase().includes(filter.toLowerCase()),
			).slice(0, 50);

			filteredFeats.forEach(feat => {
				const $feat = $(`
					<div class="charsheet__levelup-feat-option" data-feat="${feat.name}">
						<input type="radio" name="feat-choice" value="${feat.name}">
						<strong>${feat.name}</strong>
						<span class="ve-muted">(${Parser.sourceJsonToAbv(feat.source)})</span>
					</div>
				`);

				$feat.on("click", () => {
					$featList.find(".charsheet__levelup-feat-option").removeClass("selected");
					$feat.addClass("selected");
					$feat.find("input").prop("checked", true);
					onFeatSelect(feat);
				});

				$featList.append($feat);
			});
		};

		$featSearch.on("input", (e) => renderFeats(e.target.value));
		renderFeats();

		$featsContainer.append($featSearch, $featList);

		return $section;
	}

	_renderNewFeatures (features) {
		const $section = $(`
			<div class="charsheet__levelup-section">
				<h5 class="charsheet__levelup-section-title">
					⭐ New Features
				</h5>
				<div class="charsheet__levelup-features"></div>
			</div>
		`);

		const $container = $section.find(".charsheet__levelup-features");

		features.forEach(feature => {
			const $feature = $(`
				<div class="charsheet__levelup-feature">
					<div class="charsheet__levelup-feature-header">
						<strong>${feature.name}</strong>
					</div>
					<div class="charsheet__levelup-feature-description ve-small">
						${Renderer.get().render({entries: feature.entries || []})}
					</div>
				</div>
			`);
			$container.append($feature);
		});

		return $section;
	}

	_renderHpIncrease (classData, newLevel, onMethodChange) {
		const hitDie = this._getClassHitDie(classData);
		const conMod = this._state.getAbilityMod("con");
		const averageHp = Math.ceil(hitDie / 2) + 1 + conMod;

		const $radioAverage = $(`<input type="radio" name="hp-method" value="average" checked class="mr-2">`)
			.on("change", () => onMethodChange?.("average"));
		const $radioRoll = $(`<input type="radio" name="hp-method" value="roll" class="mr-2">`)
			.on("change", () => onMethodChange?.("roll"));

		const $section = $$`
			<div class="charsheet__levelup-section">
				<h5 class="charsheet__levelup-section-title">
					❤️ Hit Points
				</h5>
				<div class="charsheet__levelup-hp">
					<label class="ve-flex-v-center mb-2">
						${$radioAverage}
						<span>Take average: <strong>${averageHp}</strong> HP (${Math.ceil(hitDie / 2) + 1} + ${conMod} CON)</span>
					</label>
					<label class="ve-flex-v-center">
						${$radioRoll}
						<span>Roll: 1d${hitDie} + ${conMod} CON</span>
					</label>
				</div>
			</div>
		`;

		return $section;
	}

	_getLevelFeatures (classData, level, subclass = null) {
		const features = [];

		console.log(`[LevelUp] _getLevelFeatures called: level=${level}, subclass=${subclass?.name || "null"}`);
		if (subclass) {
			console.log(`[LevelUp] Subclass has subclassFeatures:`, subclass.subclassFeatures);
		}

		// Get base class features for this level
		// classFeatures is an array of arrays where index = level - 1
		if (classData.classFeatures && Array.isArray(classData.classFeatures)) {
			// Check if it's array-of-arrays format (new format) or flat array (old format)
			const isArrayOfArrays = Array.isArray(classData.classFeatures[0]);
			console.log(`[LevelUp] classFeatures format: ${isArrayOfArrays ? "array-of-arrays" : "flat array"}`);

			const levelFeatures = isArrayOfArrays
				? classData.classFeatures[level - 1] || [] // Array of arrays: index = level - 1
				: classData.classFeatures; // Flat array: filter by level

			const featureRefs = isArrayOfArrays
				? levelFeatures // Already filtered by level index
				: levelFeatures.filter(f => {
					if (typeof f === "string") {
						const parts = f.split("|");
						return parseInt(parts[parts.length - 1]) === level;
					}
					if (typeof f === "object" && f.classFeature) {
						const parts = f.classFeature.split("|");
						return parseInt(parts[parts.length - 1]) === level;
					}
					return f.level === level;
				});

			console.log(`[LevelUp] Level ${level} feature refs (before parsing):`, featureRefs);

			featureRefs.forEach(featureRef => {
				// Parse feature reference - format is "FeatureName|ClassName|ClassSource|Level|FeatureSource"
				// FeatureSource is optional, defaults to ClassSource
				if (typeof featureRef === "string") {
					const parts = featureRef.split("|");
					const featureName = parts[0];
					const className = parts[1] || classData.name;
					const classSource = parts[2] || classData.source;
					const featureSource = parts[4] || classSource; // Feature source defaults to class source

					// Look up full feature data to get entries
					const fullFeature = this._getClassFeatureData(featureName, className, classSource, level);

					features.push({
						name: featureName,
						className: className,
						classSource: classSource,
						source: featureSource,
						level: level,
						gainSubclassFeature: false,
						entries: fullFeature?.entries, // Include entries for option detection
					});
				} else if (typeof featureRef === "object" && featureRef.classFeature) {
					const parts = featureRef.classFeature.split("|");
					const featureName = parts[0];
					const className = parts[1] || classData.name;
					const classSource = parts[2] || classData.source;
					const featureSource = parts[4] || classSource; // Feature source defaults to class source

					// Look up full feature data to get entries
					const fullFeature = this._getClassFeatureData(featureName, className, classSource, level);

					features.push({
						name: featureName,
						className: className,
						classSource: classSource,
						source: featureSource,
						level: level,
						gainSubclassFeature: !!featureRef.gainSubclassFeature,
						entries: fullFeature?.entries, // Include entries for option detection
					});
				} else if (typeof featureRef === "object" && featureRef.name) {
					// Feature object - may have classSource and source properties
					const classSource = featureRef.classSource || classData.source;
					const featureSource = featureRef.source || classSource;

					// Look up full feature data to get entries
					const fullFeature = this._getClassFeatureData(
						featureRef.name,
						classData.name,
						classSource,
						level,
					);

					features.push({
						name: featureRef.name,
						className: classData.name,
						classSource: classSource,
						source: featureSource,
						level: level,
						gainSubclassFeature: !!featureRef.gainSubclassFeature,
						entries: fullFeature?.entries, // Include entries for option detection
					});
				}
			});
		}

		// Get subclass features if applicable
		// Subclass features should REPLACE features that have gainSubclassFeature: true
		// NOTE: After DataLoader processing, subclassFeatures is an array-of-arrays where each inner array
		// contains feature OBJECTS (with level, name, entries properties), not strings
		if (subclass && subclass.subclassFeatures) {
			console.log(`[LevelUp] Processing subclassFeatures for level ${level}:`, subclass.subclassFeatures.length, "level arrays");
			subclass.subclassFeatures.forEach((levelFeatures, idx) => {
				// levelFeatures is an array of feature objects for a specific level
				if (Array.isArray(levelFeatures)) {
					console.log(`[LevelUp] levelFeatures[${idx}] is array with ${levelFeatures.length} items:`, levelFeatures);
					levelFeatures.forEach(feature => {
						console.log(`[LevelUp] Checking feature:`, feature, `feature.level=${feature?.level}, looking for level=${level}`);
						// Feature is an object with level, name, entries, source, etc.
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
							// Fallback for raw string format (shouldn't happen after loading but just in case)
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
					// Raw string format (pre-DataLoader format)
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

		// Filter out features with gainSubclassFeature: true when we have actual subclass features
		// These are placeholder entries like "Subclass Feature", "Bard College", "Bard Subclass", etc.
		const actualSubclassFeatures = features.filter(f => f.isSubclassFeature);
		console.log(`[LevelUp] All features before filtering:`, features.map(f => `${f.name} (gainSubclass=${f.gainSubclassFeature}, isSubclass=${f.isSubclassFeature})`));
		console.log(`[LevelUp] Actual subclass features count:`, actualSubclassFeatures.length);
		if (actualSubclassFeatures.length > 0) {
			const filtered = features.filter(f => !f.gainSubclassFeature);
			console.log(`[LevelUp] Features after filtering out gainSubclassFeature:`, filtered.map(f => f.name));
			return filtered;
		}

		return features;
	}

	_levelGrantsAsi (classData, level) {
		// Standard ASI levels for most classes
		const standardAsiLevels = [4, 8, 12, 16, 19];

		// Fighter gets extra at 6 and 14
		if (classData.name === "Fighter") {
			return [...standardAsiLevels, 6, 14].includes(level);
		}

		// Rogue gets extra at 10
		if (classData.name === "Rogue") {
			return [...standardAsiLevels, 10].includes(level);
		}

		return standardAsiLevels.includes(level);
	}

	_levelGrantsSubclass (classData, level) {
		// Most classes get subclass at level 3
		const subclassLevel = classData.subclassTitle === "Sorcerous Origin" ? 1
			: classData.subclassTitle === "Otherworldly Patron" ? 1
				: classData.subclassTitle === "Divine Domain" ? 1
					: 3;

		return level === subclassLevel;
	}

	/**
	 * Get optional feature gains for a level up (metamagic, invocations, maneuvers, etc.)
	 * @param {Object} classData - The class data
	 * @param {number} currentLevel - Current class level
	 * @param {number} newLevel - New class level
	 * @returns {Array} Array of {featureTypes, name, newCount} objects for features that gain new options
	 */
	_getOptionalFeatureGains (classData, currentLevel, newLevel) {
		const gains = [];

		if (!classData.optionalfeatureProgression?.length) return gains;

		classData.optionalfeatureProgression.forEach(optFeatProg => {
			const featureTypes = optFeatProg.featureType || [];
			const name = optFeatProg.name || featureTypes.map(ft => ft.replace(/:/g, " ")).join(", ");

			// Get count at current level and new level
			let countAtCurrent = 0;
			let countAtNew = 0;

			if (Array.isArray(optFeatProg.progression)) {
				// Array format: index = level - 1
				countAtCurrent = optFeatProg.progression[currentLevel - 1] || 0;
				countAtNew = optFeatProg.progression[newLevel - 1] || 0;
			} else if (typeof optFeatProg.progression === "object") {
				// Object format: key is level string
				countAtCurrent = optFeatProg.progression[String(currentLevel)] || 0;
				countAtNew = optFeatProg.progression[String(newLevel)] || 0;
			}

			// Count how many of this feature type the character already has
			const existingOptFeatures = this._state.getFeatures().filter(f => f.featureType === "Optional Feature");

			// Helper to check if a feature type matches (exact or prefix match)
			const matchesFeatureType = (optFeatTypes) => {
				return optFeatTypes?.some(ft =>
					featureTypes.some(progType => ft === progType || ft.startsWith(progType)),
				);
			};

			const existingOfType = existingOptFeatures.filter(f =>
				matchesFeatureType(f.optionalFeatureTypes),
			).length;

			// Calculate how many new options to pick
			// totalCount is from class progression, existingOfType is what player already has
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

	/**
	 * Render optional features selection UI for level up
	 * @param {Object} classData - The class data
	 * @param {Array} gains - Array of feature gains from _getOptionalFeatureGains
	 * @param {Function} onSelect - Callback(featureType, selectedFeatures)
	 * @param {number} newLevel - The new level for filtering by max degree
	 */
	_renderOptionalFeaturesSelection (classData, gains, onSelect, newLevel) {
		// Filter optional features by allowed sources
		const allOptFeatures = this._page.filterByAllowedSources(this._page.getOptionalFeatures() || []);
		const existingOptFeatures = this._state.getFeatures().filter(f => f.featureType === "Optional Feature");

		const $section = $(`
			<div class="charsheet__levelup-section">
				<h5 class="charsheet__levelup-section-title">
					<span class="glyphicon glyphicon-list-alt"></span> Choose Features
				</h5>
				<div class="charsheet__levelup-opt-features"></div>
			</div>
		`);

		const $container = $section.find(".charsheet__levelup-opt-features");

		gains.forEach(gain => {
			const featureKey = gain.featureTypes.join("_");
			const isCombatMethods = gain.featureTypes.some(ft => ft.startsWith("CTM:"));

			if (isCombatMethods) {
				// Use special Combat Methods rendering with tradition filtering
				this._renderCombatMethodsLevelUp($container, classData, gain, newLevel, allOptFeatures, existingOptFeatures, onSelect, featureKey);
			} else {
				// Standard optional feature rendering
				this._renderStandardOptionalFeaturesLevelUp($container, gain, allOptFeatures, existingOptFeatures, onSelect, featureKey);
			}
		});

		return $section;
	}

	/**
	 * Render Combat Methods selection during level-up with tradition filtering
	 */
	_renderCombatMethodsLevelUp ($container, classData, gain, newLevel, allOptFeatures, existingOptFeatures, onSelect, featureKey) {
		const selectedForType = [];

		// Get character's known traditions from existing Combat Methods or state
		let knownTraditions = this._getKnownCombatTraditions(existingOptFeatures);

		// Get max degree for the new level
		const maxDegree = this._getMaxMethodDegree(classData, newLevel);

		// Track selected traditions during this level-up (for characters without traditions)
		let tempSelectedTraditions = [...knownTraditions];

		// If no traditions set, allow selecting them now (retroactive fix)
		if (knownTraditions.length === 0) {
			// Filter traditions to only those the class has access to
			const classAllowedTypes = gain.featureTypes || [];
			const availableTraditions = this._getAvailableTraditionsForClass(allOptFeatures, classAllowedTypes, classData?.name);
			const traditionCount = 2; // Default tradition count

			const $section = $(`
				<div class="charsheet__levelup-opt-gain mb-3">
					<p><strong>${gain.name}:</strong></p>
					<div class="charsheet__levelup-traditions mb-3">
						<p class="ve-muted ve-small mb-2">You haven't selected Combat Traditions yet. Please choose ${traditionCount} traditions first:</p>
						<div class="charsheet__levelup-tradition-list" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--rgb-border-grey); border-radius: 4px; padding: 0.5rem;"></div>
						<div class="ve-small ve-muted mt-1">Selected: <span class="tradition-count">0</span>/${traditionCount}</div>
					</div>
					<div class="charsheet__levelup-methods-container"></div>
				</div>
			`);

			const $traditionList = $section.find(".charsheet__levelup-tradition-list");
			const $methodsContainer = $section.find(".charsheet__levelup-methods-container");

			availableTraditions.forEach(trad => {
				const $item = $(`
					<label class="charsheet__builder-tradition-item d-block mb-1" style="cursor: pointer;">
						<input type="checkbox" class="mr-2">
						<strong>${trad.name}</strong>
						<span class="ve-muted ve-small ml-1">(${trad.code})</span>
					</label>
				`);

				$item.find("input").on("change", (e) => {
					if (e.target.checked) {
						if (tempSelectedTraditions.length < traditionCount) {
							tempSelectedTraditions.push(trad.code);
							// Save to state immediately
							this._state.setCombatTraditions([...tempSelectedTraditions]);
						} else {
							e.target.checked = false;
							JqueryUtil.doToast({type: "warning", content: `You can only choose ${traditionCount} traditions.`});
							return;
						}
					} else {
						tempSelectedTraditions = tempSelectedTraditions.filter(t => t !== trad.code);
						this._state.setCombatTraditions([...tempSelectedTraditions]);
					}
					$section.find(".tradition-count").text(tempSelectedTraditions.length);
					// Re-render methods when traditions change
					this._renderMethodsForLevelUp($methodsContainer, classData, gain, newLevel, allOptFeatures, existingOptFeatures, onSelect, featureKey, tempSelectedTraditions, maxDegree, selectedForType);
				});

				$traditionList.append($item);
			});

			$container.append($section);
			return;
		}

		// Normal flow: has traditions, render methods directly
		this._renderMethodsForLevelUp($container, classData, gain, newLevel, allOptFeatures, existingOptFeatures, onSelect, featureKey, knownTraditions, maxDegree, selectedForType);
	}

	/**
	 * Render the actual method selection list (used by both flows)
	 */
	_renderMethodsForLevelUp ($container, classData, gain, newLevel, allOptFeatures, existingOptFeatures, onSelect, featureKey, knownTraditions, maxDegree, selectedForType) {
		$container.empty();

		if (knownTraditions.length === 0) {
			$container.append(`<p class="ve-muted ve-small">Select traditions above to see available methods.</p>`);
			return;
		}

		// Filter methods by known traditions and max degree
		const availableMethods = allOptFeatures.filter(opt => {
			if (!opt.featureType) return false;

			return opt.featureType.some(ft => {
				const match = ft.match(/^CTM:(\d)([A-Z]{2})$/);
				if (!match) return false;

				const degree = parseInt(match[1]);
				const tradCode = match[2];

				return degree <= maxDegree && knownTraditions.includes(tradCode);
			});
		});

		// Mark as already known or available
		const processedMethods = availableMethods.map(opt => {
			const alreadyHas = existingOptFeatures.some(
				existing => existing.name === opt.name && existing.source === opt.source,
			);
			return {
				...opt,
				_alreadyKnown: alreadyHas,
				_selectable: !alreadyHas,
				_degree: this._getMethodDegree(opt),
				_tradition: this._getMethodTradition(opt),
			};
		});

		const $gainSection = $(`
			<div class="charsheet__levelup-opt-gain mb-3">
				<p><strong>${gain.name}:</strong> Choose ${gain.newCount} new method${gain.newCount > 1 ? "s" : ""}</p>
				<p class="ve-small ve-muted">Max degree available: ${maxDegree}${this._getOrdinalSuffix(maxDegree)} | Traditions: ${knownTraditions.map(t => this._getTraditionName(t)).join(", ")}</p>
				<div class="charsheet__levelup-opt-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--rgb-border-grey); border-radius: 4px; padding: 0.5rem;"></div>
				<div class="ve-small ve-muted mt-1">Selected: <span class="opt-count">0</span>/${gain.newCount}</div>
			</div>
		`);

		const $list = $gainSection.find(".charsheet__levelup-opt-list");

		// Group by tradition
		const methodsByTradition = new Map();
		for (const method of processedMethods) {
			const trad = method._tradition;
			if (!methodsByTradition.has(trad)) {
				methodsByTradition.set(trad, []);
			}
			methodsByTradition.get(trad).push(method);
		}

		// Render grouped by tradition
		for (const tradCode of knownTraditions) {
			const methods = methodsByTradition.get(tradCode) || [];
			if (methods.length === 0) continue;

			const $tradGroup = $(`
				<div class="charsheet__levelup-method-group mb-2">
					<p class="ve-small mb-1"><strong>${this._getTraditionName(tradCode)}</strong></p>
				</div>
			`);

			methods.sort((a, b) => a._degree - b._degree || a.name.localeCompare(b.name)).forEach(method => {
				const isDisabled = !method._selectable;
				const knownBadge = method._alreadyKnown ? `<span class="badge badge-secondary ml-1">Known</span>` : "";

				const $item = $(`
					<label class="charsheet__levelup-opt-item d-block mb-1 ml-2${isDisabled ? " charsheet__levelup-opt-item--disabled" : ""}" style="cursor: ${isDisabled ? "not-allowed" : "pointer"}; padding: 0.25rem; border-radius: 4px;${isDisabled ? " opacity: 0.6;" : ""}">
						<input type="checkbox" class="mr-2"${isDisabled ? " disabled" : ""}>
						<strong class="opt-name">${method.name}</strong>
						${knownBadge}
						<span class="ve-muted ve-small ml-1">(${method._degree}${this._getOrdinalSuffix(method._degree)} degree)</span>
					</label>
				`);

				$item.find(".opt-name").on("click", (e) => {
					e.preventDefault();
					e.stopPropagation();
					const desc = Renderer.get().render({entries: method.entries || []});
					JqueryUtil.doToast({type: "info", content: $(`<div><strong>${method.name}</strong><br>${desc}</div>`)});
				});

				$item.find("input").on("change", (e) => {
					if (e.target.checked) {
						if (selectedForType.length < gain.newCount) {
							selectedForType.push(method);
							$item.css("background", "var(--rgb-link-opacity-10)");
						} else {
							e.target.checked = false;
							JqueryUtil.doToast({type: "warning", content: `You can only choose ${gain.newCount} methods.`});
						}
					} else {
						const idx = selectedForType.findIndex(s => s.name === method.name && s.source === method.source);
						if (idx >= 0) selectedForType.splice(idx, 1);
						$item.css("background", "");
					}
					$gainSection.find(".opt-count").text(selectedForType.length);
					onSelect(featureKey, [...selectedForType]);
				});

				$tradGroup.append($item);
			});

			$list.append($tradGroup);
		}

		if ($list.children().length === 0) {
			$list.append(`<div class="ve-muted">No new methods available at this level.</div>`);
		}

		$container.append($gainSection);
	}

	/**
	 * Render standard optional features (non-Combat Methods) during level-up
	 */
	_renderStandardOptionalFeaturesLevelUp ($container, gain, allOptFeatures, existingOptFeatures, onSelect, featureKey) {
		const selectedForType = [];

		// Check if a feature is repeatable
		const isRepeatable = (opt) => {
			if (!opt.entries) return false;
			const checkEntries = (entries) => {
				for (const entry of entries) {
					if (typeof entry === "string" && entry.toLowerCase().includes("repeatable")) return true;
					if (entry?.name?.toLowerCase().includes("repeatable")) return true;
					if (entry?.entries && checkEntries(entry.entries)) return true;
				}
				return false;
			};
			return checkEntries(opt.entries);
		};

		// Filter options by feature type
		const allMatchingOptions = allOptFeatures.filter(opt => {
			const matchesType = opt.featureType?.some(ft =>
				gain.featureTypes.some(progType => ft === progType || ft.startsWith(progType)),
			);
			if (!matchesType) return false;

			if (opt.prerequisite) {
				for (const prereq of opt.prerequisite) {
					if (prereq.level) {
						const reqLevel = prereq.level.level || prereq.level;
						const totalLevel = this._state.getTotalLevel();
						if (prereq.level.class) {
							const classes = this._state.getClasses();
							const classMatch = classes.find(c =>
								c.name.toLowerCase() === prereq.level.class.name.toLowerCase(),
							);
							if (!classMatch || classMatch.level < reqLevel) return false;
						} else if (totalLevel < reqLevel) {
							return false;
						}
					}
				}
			}
			return true;
		});

		const availableOptions = allMatchingOptions.map(opt => {
			// Count how many times this option has been taken
			const timesKnown = existingOptFeatures.filter(
				existing => existing.name === opt.name && existing.source === opt.source,
			).length;
			const alreadyHas = timesKnown > 0;
			const repeatable = isRepeatable(opt);
			return {
				...opt,
				_alreadyKnown: alreadyHas,
				_timesKnown: timesKnown,
				_selectable: !alreadyHas || repeatable,
				_repeatable: repeatable,
			};
		});

		const $gainSection = $(`
			<div class="charsheet__levelup-opt-gain mb-3">
				<p><strong>${gain.name}:</strong> Choose ${gain.newCount} new option${gain.newCount > 1 ? "s" : ""}</p>
				<div class="charsheet__levelup-opt-list" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--rgb-border-grey); border-radius: 4px; padding: 0.5rem;"></div>
				<div class="ve-small ve-muted mt-1">Selected: <span class="opt-count">0</span>/${gain.newCount}</div>
			</div>
		`);

		const $list = $gainSection.find(".charsheet__levelup-opt-list");

		const selectableOptions = availableOptions.filter(opt => opt._selectable);
		if (!selectableOptions.length && !availableOptions.some(opt => opt._alreadyKnown)) {
			$list.append(`<div class="ve-muted">No options available at this level.</div>`);
		} else {
			// Add legend for badges
			const hasKnownOptions = availableOptions.some(opt => opt._alreadyKnown);
			if (hasKnownOptions) {
				$list.prepend(`
					<div class="ve-small ve-muted mb-2 pb-2" style="border-bottom: 1px solid var(--rgb-border-grey);">
						<span class="badge badge-success mr-1">✓ Known</span> = Already selected
						<span class="badge badge-info ml-2 mr-1">↺ Repeatable</span> = Can be taken again
					</div>
				`);
			}

			availableOptions.sort((a, b) => {
				// Selectable options first, then by name
				if (a._selectable !== b._selectable) return a._selectable ? -1 : 1;
				// Known options at the top of their section so players can see what they have
				if (a._alreadyKnown !== b._alreadyKnown) return a._alreadyKnown ? -1 : 1;
				return a.name.localeCompare(b.name);
			}).forEach(opt => {
				const isDisabled = !opt._selectable;
				// Show count if taken multiple times
				const knownText = opt._timesKnown > 1 ? `Known ×${opt._timesKnown}` : "Known";
				const knownBadge = opt._alreadyKnown
					? `<span class="badge badge-success ml-1" title="Already selected${opt._timesKnown > 1 ? ` (${opt._timesKnown} times)` : ""}">✓ ${knownText}</span>`
					: "";
				const repeatableBadge = opt._repeatable
					? `<span class="badge badge-info ml-1" title="Can be taken multiple times">↺ Repeatable</span>`
					: "";

				const $item = $(`
					<label class="charsheet__levelup-opt-item d-block mb-1${isDisabled ? " charsheet__levelup-opt-item--disabled" : ""}${opt._alreadyKnown ? " charsheet__levelup-opt-item--known" : ""}" style="cursor: ${isDisabled ? "not-allowed" : "pointer"}; padding: 0.5rem; border-radius: 4px;${isDisabled ? " opacity: 0.5;" : ""}${opt._alreadyKnown && opt._selectable ? " background: rgba(var(--rgb-success-rgb), 0.1); border-left: 3px solid var(--rgb-success);" : ""}${opt._alreadyKnown && !opt._selectable ? " background: rgba(128, 128, 128, 0.1);" : ""}">
						<input type="checkbox" class="mr-2"${isDisabled ? " disabled" : ""}>
						<strong class="opt-name" style="cursor: help; text-decoration: underline dotted;">${opt.name}</strong>
						${knownBadge}${repeatableBadge}
						<span class="ve-muted ve-small ml-1">(${Parser.sourceJsonToAbv(opt.source)})</span>
					</label>
				`);

				$item.find(".opt-name").on("click", (e) => {
					e.preventDefault();
					e.stopPropagation();
					const desc = Renderer.get().render({entries: opt.entries || []});
					JqueryUtil.doToast({type: "info", content: $(`<div><strong>${opt.name}</strong><br>${desc}</div>`)});
				});

				$item.find("input").on("change", (e) => {
					if (e.target.checked) {
						if (selectedForType.length < gain.newCount) {
							selectedForType.push(opt);
							$item.css("background", "var(--rgb-link-opacity-10)");
						} else {
							e.target.checked = false;
							JqueryUtil.doToast({type: "warning", content: `You can only choose ${gain.newCount} ${gain.name}.`});
						}
					} else {
						const idx = selectedForType.findIndex(s => s.name === opt.name && s.source === opt.source);
						if (idx >= 0) selectedForType.splice(idx, 1);
						$item.css("background", "");
					}
					$gainSection.find(".opt-count").text(selectedForType.length);
					onSelect(featureKey, [...selectedForType]);
				});

				$list.append($item);
			});
		}

		$container.append($gainSection);
	}

	/**
	 * Get character's known combat traditions from stored traditions or infer from existing features
	 */
	_getKnownCombatTraditions (existingOptFeatures) {
		// First check if traditions are explicitly stored on the character
		const storedTraditions = this._state.getCombatTraditions?.() || [];
		if (storedTraditions.length > 0) {
			return storedTraditions;
		}

		// Fall back to inferring from existing combat method features
		const traditions = new Set();

		for (const feature of existingOptFeatures) {
			if (!feature.optionalFeatureTypes) continue;

			for (const ft of feature.optionalFeatureTypes) {
				// Match CTM:XYY where X is degree and YY is tradition code
				const match = ft.match(/^CTM:(\d)?([A-Z]{2})$/);
				if (match) {
					traditions.add(match[2]);
				}
			}
		}

		return Array.from(traditions);
	}

	/**
	 * Get the maximum method degree available at a given level from the class table
	 */
	_getMaxMethodDegree (cls, level) {
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
	 * Get tradition name from code
	 */
	_getTraditionName (tradCode) {
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
	 * Get available combat traditions from optional features
	 * Traditions are identified by feature types like "CTM:1AM", "CTM:2RC", etc.
	 */
	_getAvailableTraditions (allOptFeatures) {
		const traditions = new Map();

		// Find all unique traditions from optional features
		for (const opt of allOptFeatures) {
			if (!opt.featureType) continue;
			for (const ft of opt.featureType) {
				// Match tradition codes like "CTM:1AM", "CTM:2RC", etc.
				const match = ft.match(/^CTM:\d([A-Z]{2})$/);
				if (match) {
					const tradCode = match[1];
					if (!traditions.has(tradCode)) {
						traditions.set(tradCode, {
							code: tradCode,
							name: this._getTraditionName(tradCode),
						});
					}
				}
			}
		}

		return Array.from(traditions.values()).sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Extract tradition codes from class feature description text.
	 * Looks for patterns like {@filter ...|feature type=ctm:am} in the feature entries.
	 * @param {string} className - The class name to look up
	 * @param {number} level - The level to search features at (default 1-2 for Combat Methods)
	 * @returns {Set<string>} Set of tradition codes like "AM", "RC", etc.
	 */
	_extractTraditionsFromClassFeature (className, level = 2) {
		const traditions = new Set();

		// Look up "Combat Methods" feature for this class
		const classFeatures = this._page.getClassFeatures?.();
		if (!classFeatures?.length) {
			console.log("[LevelUp] No class features available for tradition extraction");
			return traditions;
		}

		// Find the Combat Methods feature (prioritize "Combat Methods" over "Specialties")
		// "Combat Methods" is the feature that contains the tradition list
		let combatMethodsFeature = classFeatures.find(f =>
			f.className === className
			&& f.name === "Combat Methods"
			&& f.level <= 5,
		);

		// If no "Combat Methods" feature found, this class might not have combat traditions
		if (!combatMethodsFeature) {
			console.log(`[LevelUp] No Combat Methods feature found for ${className}`);
			return traditions;
		}

		console.log(`[LevelUp] Found Combat Methods feature:`, combatMethodsFeature.name, "at level", combatMethodsFeature.level, "with", combatMethodsFeature.entries?.length, "entries");

		// Recursively extract text from entries and look for tradition codes
		const extractFromEntries = (entries) => {
			if (!entries) return;
			if (typeof entries === "string") {
				// Look for patterns like "feature type=ctm:am" or "feature type=CTM:AM"
				const matches = entries.matchAll(/feature\s+type[=:]\s*ctm:([a-z]{2})/gi);
				for (const match of matches) {
					traditions.add(match[1].toUpperCase());
				}
				return;
			}
			if (Array.isArray(entries)) {
				for (const entry of entries) {
					extractFromEntries(entry);
				}
				return;
			}
			if (typeof entries === "object") {
				if (entries.entries) extractFromEntries(entries.entries);
				if (entries.items) extractFromEntries(entries.items);
				if (entries.entry) extractFromEntries(entries.entry);
			}
		};

		extractFromEntries(combatMethodsFeature.entries);

		console.log(`[LevelUp] Extracted traditions from feature text:`, [...traditions]);
		return traditions;
	}

	/**
	 * Get available combat traditions filtered by what the class has access to
	 * @param {Array} allOptFeatures - All optional features
	 * @param {Array<string>} classAllowedTypes - Feature types the class has access to (e.g., ["CTM:1", "CTM:2"])
	 * @param {string} [className] - The class name to extract traditions from
	 */
	_getAvailableTraditionsForClass (allOptFeatures, classAllowedTypes, className) {
		console.log("[LevelUp] _getAvailableTraditionsForClass called with classAllowedTypes:", classAllowedTypes, "className:", className);

		// First try to extract tradition codes from class-allowed types (e.g., "CTM:AM" -> "AM", "CTM:1AM" -> "AM")
		const allowedTraditionCodes = new Set();
		for (const ft of classAllowedTypes) {
			const match = ft.match(/^CTM:(\d)?([A-Z]{2})$/);
			if (match && match[2]) {
				allowedTraditionCodes.add(match[2]);
			}
		}

		console.log("[LevelUp] Extracted tradition codes from types:", [...allowedTraditionCodes]);

		// If no tradition codes found in types, try to extract from class feature description
		if (allowedTraditionCodes.size === 0 && className) {
			const featureTraditions = this._extractTraditionsFromClassFeature(className);
			for (const trad of featureTraditions) {
				allowedTraditionCodes.add(trad);
			}
		}

		// If still no traditions found, fall back to all traditions
		if (allowedTraditionCodes.size === 0) {
			console.log("[LevelUp] No tradition codes found, falling back to all traditions");
			return this._getAvailableTraditions(allOptFeatures);
		}

		console.log("[LevelUp] Filtering to allowed traditions:", [...allowedTraditionCodes]);

		// Filter to only allowed traditions
		const traditions = new Map();
		for (const tradCode of allowedTraditionCodes) {
			traditions.set(tradCode, {
				code: tradCode,
				name: this._getTraditionName(tradCode),
			});
		}

		return Array.from(traditions.values()).sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Get method degree from optional feature
	 */
	_getMethodDegree (opt) {
		if (!opt.featureType) return 0;
		for (const ft of opt.featureType) {
			const match = ft.match(/^CTM:(\d)[A-Z]{2}$/);
			if (match) return parseInt(match[1]);
		}
		return 0;
	}

	/**
	 * Get method tradition code from optional feature
	 */
	_getMethodTradition (opt) {
		if (!opt.featureType) return null;
		for (const ft of opt.featureType) {
			const match = ft.match(/^CTM:\d([A-Z]{2})$/);
			if (match) return match[1];
		}
		return null;
	}

	_getOrdinalSuffix (n) {
		const s = ["th", "st", "nd", "rd"];
		const v = n % 100;
		return s[(v - 20) % 10] || s[v] || s[0];
	}

	/**
	 * Look up full class feature data to get description/entries
	 */
	_getClassFeatureData (featureName, className, source, level) {
		const classFeatures = this._page.getClassFeatures?.();
		if (!classFeatures?.length) {
			console.log("[LevelUp] No class features available for lookup");
			return null;
		}

		const result = classFeatures.find(f => {
			if (f.name !== featureName) return false;
			if (f.className !== className) return false;
			if (f.level !== level) return false;
			// Be more flexible with source matching
			if (source && f.source && f.source !== source) {
				const sourcesMatch = [Parser.SRC_PHB, Parser.SRC_XPHB, "SRD"].includes(source)
					&& [Parser.SRC_PHB, Parser.SRC_XPHB, "SRD"].includes(f.source);
				if (!sourcesMatch) return false;
			}
			return true;
		});

		if (!result && featureName) {
			console.log(`[LevelUp] Could not find class feature: ${featureName} for ${className} level ${level} (source: ${source})`);
		}
		return result;
	}

	/**
	 * Look up full class feature data from a reference string
	 * @param {string} featureRef - "FeatureName|ClassName|Source|Level" format
	 * @returns {Object|null} The feature object or null
	 */
	_getClassFeatureDataFromRef (featureRef) {
		const parts = featureRef.split("|");
		const [name, className, source, level] = parts;
		const parsedLevel = parseInt(level) || 1;

		return this._getClassFeatureData(name, className, source, parsedLevel);
	}

	/**
	 * Render feature options selection UI for level up (for features with embedded type: "options")
	 * @param {Array} optionGroups - Array of {featureName, featureSource, count, options} objects
	 * @param {Function} onSelect - Callback(featureKey, selectedOptions)
	 */
	/**
	 * Analyze a feature's text to detect if it requires a skill/expertise choice.
	 * @param {Object} opt - The option object
	 * @returns {Object|null} - { type: "proficiency"|"expertise"|"bonus", count: number, from: "any_proficient"|string[] }
	 */
	_parseFeatureSkillChoice (opt) {
		if (opt.type !== "classFeature" || !opt.ref) return null;

		const parts = opt.ref.split("|");
		const classFeatures = this._page.getClassFeatures();
		const fullOpt = classFeatures.find(f =>
			f.name === parts[0] && f.className === parts[1] && f.source === parts[2],
		);
		if (!fullOpt?.entries) return null;

		const text = JSON.stringify(fullOpt.entries);

		if (text.includes("You gain proficiency in one of the following")) {
			const skills = this._extractSkillListFromText(text);
			return {type: "proficiency", count: 1, from: skills.length ? skills : "any_proficient"};
		}
		if (text.includes("bonus equal to your proficiency bonus on checks made with one of")) {
			const skills = this._extractSkillListFromText(text);
			return {type: "bonus", count: 1, from: skills.length ? skills : "any_proficient"};
		}
		if (text.includes("Choose one skill you are proficient in")) {
			return {type: "bonus", count: 1, from: "any_proficient"};
		}
		if (/Choose two (more )?of your skill proficiencies/.test(text)) {
			return {type: "expertise", count: 2, from: "any_proficient"};
		}
		if (text.includes("Choose one of the following skills in which you have proficiency")) {
			const skills = this._extractSkillListFromText(text);
			return {type: "expertise", count: 1, from: skills.length ? skills : "any_proficient"};
		}
		if (text.includes("Choose one skill proficiency") && text.includes("Expertise")) {
			return {type: "expertise", count: 1, from: "any_proficient"};
		}
		if (text.includes("Choose two skill proficiencies") && text.includes("Expertise")) {
			return {type: "expertise", count: 2, from: "any_proficient"};
		}

		return null;
	}

	/** Extract skill names from feature text */
	_extractSkillListFromText (text) {
		const allSkills = [
			"Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception",
			"History", "Insight", "Intimidation", "Investigation", "Medicine",
			"Nature", "Perception", "Performance", "Persuasion", "Religion",
			"Sleight of Hand", "Stealth", "Survival",
		];

		const found = [];
		const tagMatches = text.matchAll(/\{@skill\s+([^}]+)\}/gi);
		for (const m of tagMatches) {
			const skillName = m[1].trim();
			if (allSkills.some(s => s.toLowerCase() === skillName.toLowerCase())) {
				found.push(skillName.toTitleCase());
			}
		}
		if (found.length) return [...new Set(found)];

		for (const skill of allSkills) {
			if (text.includes(skill)) found.push(skill);
		}
		return [...new Set(found)];
	}

	/**
	 * Render a skill sub-choice UI below a specialty checkbox (level-up version).
	 * @param {Object} choice - From _parseFeatureSkillChoice: {type, count, from}
	 * @param {string} choiceKey - Unique key for storing selections
	 * @returns {jQuery}
	 */
	_renderFeatureSkillSubChoice (choice, choiceKey) {
		const allSkills = [
			"Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception",
			"History", "Insight", "Intimidation", "Investigation", "Medicine",
			"Nature", "Perception", "Performance", "Persuasion", "Religion",
			"Sleight of Hand", "Stealth", "Survival",
		];

		let availableSkills;
		if (choice.from === "any_proficient") {
			const proficientSkills = allSkills.filter(s => {
				const key = s.toLowerCase().replace(/\s+/g, "");
				return this._state?.getSkillProficiency?.(key) > 0;
			});
			availableSkills = proficientSkills.length ? proficientSkills : allSkills;
		} else {
			availableSkills = choice.from;
		}

		const typeLabel = choice.type === "proficiency" ? "Proficiency"
			: choice.type === "expertise" ? "Expertise" : "Bonus";

		if (!this._selectedFeatureSkillChoices[choiceKey]) {
			this._selectedFeatureSkillChoices[choiceKey] = [];
		}

		const $wrapper = $(`
			<div class="charsheet__levelup-feat-skill-sub-choice ml-4 mt-1 mb-1 pl-2" style="border-left: 2px solid var(--rgb-border-grey, #888);">
				<div class="ve-small"><em>Choose ${choice.count} skill${choice.count > 1 ? "s" : ""} for ${typeLabel}:</em></div>
				<div class="charsheet__levelup-feat-skill-checkboxes"></div>
				<div class="ve-small ve-muted">Selected: <span class="feat-skill-count">${this._selectedFeatureSkillChoices[choiceKey].length}</span>/${choice.count}</div>
			</div>
		`);

		const $checkboxes = $wrapper.find(".charsheet__levelup-feat-skill-checkboxes");

		for (const skill of availableSkills) {
			const isSelected = this._selectedFeatureSkillChoices[choiceKey].includes(skill);
			const $label = $(`
				<label class="mr-2 mb-1" style="display: inline-block; cursor: pointer;">
					<input type="checkbox" value="${skill}" ${isSelected ? "checked" : ""}>
					<span class="ve-small">${skill}</span>
				</label>
			`);

			$label.find("input").on("change", (e) => {
				if (e.target.checked) {
					if (this._selectedFeatureSkillChoices[choiceKey].length < choice.count) {
						this._selectedFeatureSkillChoices[choiceKey].push(skill);
					} else {
						e.target.checked = false;
						JqueryUtil.doToast({type: "warning", content: `You can only choose ${choice.count} skill${choice.count > 1 ? "s" : ""}.`});
					}
				} else {
					this._selectedFeatureSkillChoices[choiceKey] = this._selectedFeatureSkillChoices[choiceKey].filter(s => s !== skill);
				}
				$wrapper.find(".feat-skill-count").text(this._selectedFeatureSkillChoices[choiceKey].length);
			});

			$checkboxes.append($label);
		}

		return $wrapper;
	}

	_renderFeatureOptionsSelection (optionGroups, onSelect) {
		const $section = $(`
			<div class="charsheet__levelup-section">
				<h5 class="charsheet__levelup-section-title">
					<span class="glyphicon glyphicon-star"></span> Feature Choices
				</h5>
				<div class="charsheet__levelup-feat-options"></div>
			</div>
		`);

		const $container = $section.find(".charsheet__levelup-feat-options");

		optionGroups.forEach(optGroup => {
			const featureKey = `${optGroup.featureName}_${optGroup.featureSource || ""}`;
			const selectedForGroup = [];

			const $groupSection = $(`
				<div class="charsheet__levelup-feat-opt-group mb-3">
					<p><strong>${optGroup.featureName}:</strong> Choose ${optGroup.count}</p>
					<div class="charsheet__levelup-feat-opt-list" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--rgb-border-grey); border-radius: 4px; padding: 0.5rem;"></div>
					<div class="ve-small ve-muted mt-1">Selected: <span class="feat-opt-count">0</span>/${optGroup.count}</div>
				</div>
			`);

			const $list = $groupSection.find(".charsheet__levelup-feat-opt-list");

			// Get already-chosen features to filter out duplicates
			const existingFeatures = this._state.getFeatures?.() || [];
			const existingFeatureNames = new Set(existingFeatures.map(f => f.name));

			if (!optGroup.options.length) {
				$list.append(`<div class="ve-muted">No options available.</div>`);
			} else {
				optGroup.options.forEach(opt => {
					// Check if this option was already chosen (deduplication)
					const isAlreadyChosen = existingFeatureNames.has(opt.name);

					// Check if the feature can be taken multiple times
					let canRepeat = false;
					if (isAlreadyChosen && opt.type === "classFeature" && opt.ref) {
						const parts = opt.ref.split("|");
						const classFeatures = this._page.getClassFeatures();
						const fullOpt = classFeatures.find(f =>
							f.name === parts[0]
							&& f.className === parts[1]
							&& f.source === parts[2],
						);
						if (fullOpt?.entries) {
							const text = JSON.stringify(fullOpt.entries).toLowerCase();
							canRepeat = text.includes("multiple times") || text.includes("chosen again") || text.includes("retaken");
						}
					}

					// Skip already-chosen non-repeatable features
					if (isAlreadyChosen && !canRepeat) return;
					const $item = $(`
						<label class="charsheet__levelup-feat-opt-item d-block mb-1" style="cursor: pointer; padding: 0.25rem; border-radius: 4px;">
							<input type="checkbox" class="mr-2">
							<span class="feat-opt-name"></span>
							${opt.source ? `<span class="ve-muted ve-small ml-1">(${Parser.sourceJsonToAbv(opt.source)})</span>` : ""}
						</label>
					`);

					// Create hoverable link for the option name
					const $nameSpan = $item.find(".feat-opt-name");
					if (opt.type === "classFeature" && opt.ref) {
						const parts = opt.ref.split("|");
						// Hash format: name, className, classSource, level, featureSource
						const featureSource = parts[2] || opt.source || "TGTT";
						const hash = UrlUtil.encodeArrayForHash(parts[0], parts[1], parts[2], parts[3], featureSource);
						try {
							const hoverAttrs = Renderer.hover.getHoverElementAttributes({page: UrlUtil.PG_CLASS_SUBCLASS_FEATURES, source: featureSource, hash});
							$nameSpan.html(`<a href="${UrlUtil.PG_CLASS_SUBCLASS_FEATURES}#${hash}" ${hoverAttrs} onclick="event.preventDefault(); event.stopPropagation();">${opt.name}</a>`);
						} catch (e) {
							$nameSpan.text(opt.name);
						}
					} else if (opt.type === "optionalfeature" && opt.ref) {
						const refParts = opt.ref.split("|");
						try {
							$nameSpan.html(CharacterSheetPage.getHoverLink(UrlUtil.PG_OPT_FEATURES, refParts[0], refParts[1] || opt.source || "TGTT"));
							$nameSpan.find("a").on("click", (e) => e.preventDefault());
						} catch (e) {
							$nameSpan.text(opt.name);
						}
					} else {
						$nameSpan.text(opt.name);
					}

					// Show description on name click for class features
					if (opt.type === "classFeature" && opt.ref) {
						$item.find(".feat-opt-name").on("click", (e) => {
							e.preventDefault();
							e.stopPropagation();
							const parts = opt.ref.split("|");
							const classFeatures = this._page.getClassFeatures();
							const fullOpt = classFeatures.find(f =>
								f.name === parts[0]
								&& f.className === parts[1]
								&& f.source === parts[2],
							);
							if (fullOpt) {
								const desc = Renderer.get().render({entries: fullOpt.entries || []});
								JqueryUtil.doToast({type: "info", content: $(`<div><strong>${opt.name}</strong><br>${desc}</div>`)});
							}
						});
					}

					$item.find("input").on("change", (e) => {
						if (e.target.checked) {
							if (selectedForGroup.length < optGroup.count) {
								selectedForGroup.push(opt);
								$item.css("background", "var(--rgb-link-opacity-10)");

								// Check if this option requires a skill sub-choice
								const skillChoice = this._parseFeatureSkillChoice(opt);
								if (skillChoice) {
									const choiceKey = `${featureKey}__${opt.name}__${opt.ref || ""}`;
									const $subChoice = this._renderFeatureSkillSubChoice(skillChoice, choiceKey);
									$item.after($subChoice);
								}
							} else {
								e.target.checked = false;
								JqueryUtil.doToast({type: "warning", content: `You can only choose ${optGroup.count} options.`});
							}
						} else {
							const idx = selectedForGroup.findIndex(s => s.name === opt.name && s.ref === opt.ref);
							if (idx >= 0) selectedForGroup.splice(idx, 1);
							$item.css("background", "");

							// Remove skill sub-choice UI
							const choiceKey = `${featureKey}__${opt.name}__${opt.ref || ""}`;
							delete this._selectedFeatureSkillChoices[choiceKey];
							$item.next(".charsheet__levelup-feat-skill-sub-choice").remove();
						}
						$groupSection.find(".feat-opt-count").text(selectedForGroup.length);
						onSelect(featureKey, [...selectedForGroup]);
					});

					$list.append($item);
				});
			}

			$container.append($groupSection);
		});

		return $section;
	}

	/**
	 * Render expertise selection UI for level up
	 * @param {Array} expertiseGrants - Array of {featureName, count, allowTools, toolName} objects
	 * @param {Function} onSelect - Callback(featureKey, selectedSkills)
	 * @returns {jQuery} The section element
	 */
	_renderExpertiseSelectionForLevelUp (expertiseGrants, onSelect) {
		const $section = $(`
			<div class="charsheet__levelup-section">
				<h5 class="charsheet__levelup-section-title">
					<span class="glyphicon glyphicon-star-empty"></span> Expertise
				</h5>
				<div class="charsheet__levelup-expertise-grants"></div>
			</div>
		`);

		const $container = $section.find(".charsheet__levelup-expertise-grants");

		// Get character's current skill proficiencies
		const skillProficiencies = this._state.getSkillProficiencies();
		const existingExpertise = this._state.getExpertise() || [];

		expertiseGrants.forEach(grant => {
			const featureKey = grant.featureName;
			const selectedForGrant = [];

			const $grantSection = $(`
				<div class="charsheet__levelup-expertise-grant mb-3">
					<p><strong>${grant.featureName}:</strong> Choose ${grant.count} skill${grant.count > 1 ? "s" : ""} for expertise:</p>
					${grant.allowTools && grant.toolName ? `<p class="ve-small ve-muted">You may also choose ${grant.toolName} if you're proficient with it.</p>` : ""}
					<div class="charsheet__levelup-expertise-checkboxes"></div>
					<div class="ve-small ve-muted mt-1">Selected: <span class="expertise-count">0</span>/${grant.count}</div>
				</div>
			`);

			const $checkboxes = $grantSection.find(".charsheet__levelup-expertise-checkboxes");

			// Get eligible skills (proficient but not already expertise)
			const eligibleSkills = Object.keys(skillProficiencies)
				.filter(skill => skillProficiencies[skill])
				.filter(skill => !existingExpertise.includes(skill))
				.map(skill => skill.toTitleCase());

			// Optionally add thieves' tools
			if (grant.allowTools && grant.toolName) {
				const toolProficiencies = this._state.getToolProficiencies?.() || [];
				if (toolProficiencies.some(t => t.toLowerCase().includes("thieves"))) {
					if (!existingExpertise.includes(grant.toolName)) {
						eligibleSkills.push(grant.toolName);
					}
				}
			}

			if (eligibleSkills.length === 0) {
				$checkboxes.append(`<p class="ve-muted">No eligible skills available (already have expertise in all proficient skills).</p>`);
			} else {
				eligibleSkills.forEach(skill => {
					const $label = $(`
						<label class="charsheet__levelup-skill-checkbox mr-3 mb-1 d-inline-block" style="cursor: pointer;">
							<input type="checkbox" class="mr-1" value="${skill}">
							${skill}
						</label>
					`);

					$label.find("input").on("change", (e) => {
						if (e.target.checked) {
							if (selectedForGrant.length < grant.count) {
								selectedForGrant.push(skill);
							} else {
								e.target.checked = false;
								JqueryUtil.doToast({type: "warning", content: `You can only choose ${grant.count} skills for expertise.`});
							}
						} else {
							const idx = selectedForGrant.indexOf(skill);
							if (idx >= 0) selectedForGrant.splice(idx, 1);
						}
						$grantSection.find(".expertise-count").text(selectedForGrant.length);
						onSelect(featureKey, [...selectedForGrant]);
					});

					$checkboxes.append($label);
				});
			}

			$container.append($grantSection);
		});

		return $section;
	}

	/**
	 * Render language selection UI for level up
	 * @param {Array} languageGrants - Array of {featureName, count} objects
	 * @param {Function} onSelect - Callback(featureKey, selectedLanguages)
	 * @returns {jQuery} The section element
	 */
	_renderLanguageSelectionForLevelUp (languageGrants, onSelect) {
		const $section = $(`
			<div class="charsheet__levelup-section">
				<h5 class="charsheet__levelup-section-title">
					<span class="glyphicon glyphicon-comment"></span> Languages
				</h5>
				<div class="charsheet__levelup-language-grants"></div>
			</div>
		`);

		const $container = $section.find(".charsheet__levelup-language-grants");

		// Get current character languages
		const currentLanguages = (this._state.getLanguages() || []).map(l => l.toLowerCase());

		// Get grouped language options including homebrew
		const langOptions = this._page.getLanguageOptionsGrouped?.() || {
			standard: Parser.LANGUAGES_STANDARD || ["Common", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc"],
			exotic: Parser.LANGUAGES_EXOTIC || ["Abyssal", "Celestial", "Draconic", "Deep Speech", "Infernal", "Primordial", "Sylvan", "Undercommon"],
			secret: Parser.LANGUAGES_SECRET || ["Druidic", "Thieves' Cant"],
			homebrew: [],
		};

		languageGrants.forEach(grant => {
			const featureKey = grant.featureName;
			const selectedForGrant = [];

			const $grantSection = $(`
				<div class="charsheet__levelup-language-grant mb-3">
					<p><strong>${grant.featureName}:</strong> Choose ${grant.count} language${grant.count > 1 ? "s" : ""}:</p>
					<div class="charsheet__levelup-language-dropdowns"></div>
					<div class="ve-small ve-muted mt-1">Selected: <span class="lang-count">0</span>/${grant.count}</div>
				</div>
			`);

			const $dropdowns = $grantSection.find(".charsheet__levelup-language-dropdowns");

			// Create dropdowns for each language selection
			for (let i = 0; i < grant.count; i++) {
				const $select = $(`
					<select class="form-control form-control-sm mb-1" style="max-width: 200px; display: inline-block; margin-right: 0.5rem;">
						<option value="">-- Select Language ${i + 1} --</option>
					</select>
				`);

				// Add language options grouped by type - homebrew first if available
				if (langOptions.homebrew.length) {
					$select.append(`<optgroup label="──── Homebrew Languages ────">`);
					langOptions.homebrew.forEach(lang => {
						if (!currentLanguages.includes(lang.toLowerCase())) {
							$select.append(`<option value="${lang}">${lang}</option>`);
						}
					});
					$select.append(`</optgroup>`);
				}

				$select.append(`<optgroup label="──── Standard Languages ────">`);
				langOptions.standard.forEach(lang => {
					if (!currentLanguages.includes(lang.toLowerCase())) {
						$select.append(`<option value="${lang}">${lang}</option>`);
					}
				});
				$select.append(`</optgroup>`);

				$select.append(`<optgroup label="──── Exotic/Rare Languages ────">`);
				langOptions.exotic.forEach(lang => {
					if (!currentLanguages.includes(lang.toLowerCase())) {
						$select.append(`<option value="${lang}">${lang}</option>`);
					}
				});
				$select.append(`</optgroup>`);

				$select.append(`<optgroup label="──── Secret Languages ────">`);
				langOptions.secret.forEach(lang => {
					if (!currentLanguages.includes(lang.toLowerCase())) {
						$select.append(`<option value="${lang}">${lang}</option>`);
					}
				});
				$select.append(`</optgroup>`);

				$select.on("change", () => {
					// Rebuild selected languages from all dropdowns
					selectedForGrant.length = 0;
					$dropdowns.find("select").each(function () {
						const val = $(this).val();
						if (val) selectedForGrant.push(val);
					});
					$grantSection.find(".lang-count").text(selectedForGrant.length);
					onSelect(featureKey, [...selectedForGrant]);
				});

				$dropdowns.append($select);
			}

			$container.append($grantSection);
		});

		return $section;
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

	async _applyLevelUp ({classEntry, newLevel, asiChoices, selectedFeat, selectedSubclass, selectedOptionalFeatures, selectedFeatureOptions, selectedExpertise, selectedLanguages, newFeatures, hpMethod, classData}) {
		console.log(`[LevelUp] _applyLevelUp called: selectedSubclass=${selectedSubclass?.name || "null"}`);
		console.log(`[LevelUp] Initial newFeatures:`, newFeatures?.map(f => f.name));

		// If a subclass was just selected, re-compute features to include actual subclass features
		if (selectedSubclass) {
			// Get the subclass features for this level (replacing placeholders like "Subclass Feature")
			console.log(`[LevelUp] Recomputing features with selected subclass:`, selectedSubclass.name);
			newFeatures = this._getLevelFeatures(classData, newLevel, selectedSubclass);
			console.log(`[LevelUp] Recomputed newFeatures:`, newFeatures?.map(f => f.name));
		}

		// Update class level
		const classes = this._state.getClasses();
		const targetClass = classes.find(c => c.name === classEntry.name && c.source === classEntry.source);
		if (targetClass) {
			targetClass.level = newLevel;
			if (selectedSubclass) {
				// Store subclass info with caster progression for multiclass spell slot calculation
				targetClass.subclass = {
					name: selectedSubclass.name,
					shortName: selectedSubclass.shortName,
					source: selectedSubclass.source,
					casterProgression: selectedSubclass.casterProgression,
					spellcastingAbility: selectedSubclass.spellcastingAbility,
				};
				// Update class-level caster progression if subclass grants spellcasting (like Eldritch Knight)
				if (selectedSubclass.casterProgression && !targetClass.casterProgression) {
					targetClass.casterProgression = selectedSubclass.casterProgression;
					targetClass.spellcastingAbility = selectedSubclass.spellcastingAbility;
				}
			}
		}

		// Update unarmed strike (monk martial arts die progression)
		this._state.ensureUnarmedStrike();

		// Check if Thelemar ASI+Feat rule applies
		const thelemar_asiFeat = this._state.getSettings()?.thelemar_asiFeat || false;
		const isBothAsiAndFeat = thelemar_asiFeat && newLevel === 4;

		// Apply ASI and/or feat
		if (isBothAsiAndFeat) {
			// Thelemar rule: Apply BOTH ASI and Feat at level 4
			// Apply ability score increases
			const increases = [];
			Parser.ABIL_ABVS.forEach(abl => {
				if (asiChoices[abl]) {
					const currentBase = this._state.getAbilityBase(abl);
					this._state.setAbilityBase(abl, Math.min(20, currentBase + asiChoices[abl]));
					increases.push(`${Parser.attAbvToFull(abl)} +${asiChoices[abl]}`);
				}
			});

			// Add a tracking feature for the ASI choice
			if (increases.length > 0) {
				const asiFeature = {
					name: "Ability Score Improvement",
					source: classData.source,
					className: classEntry.name,
					classSource: classEntry.source,
					level: newLevel,
					featureType: "Class",
					description: `<p><strong>Ability Score Increases:</strong> ${increases.join(", ")}</p>`,
					isAsiChoice: true,
				};
				this._state.addFeature(asiFeature);
			}

			// Also apply the feat
			if (selectedFeat) {
				this._state.addFeat(selectedFeat);
				this._applyFeatBonuses(selectedFeat);
				await this._processFeatSpellChoices();
			}
		} else if (selectedFeat) {
			// Normal rules: Feat chosen instead of ASI
			this._state.addFeat(selectedFeat);
			// Apply feat bonuses if any
			this._applyFeatBonuses(selectedFeat);
			// Process pending spell choices from the feat
			await this._processFeatSpellChoices();
		} else if (asiChoices) {
			// Apply ability score increases
			const increases = [];
			Parser.ABIL_ABVS.forEach(abl => {
				if (asiChoices[abl]) {
					const currentBase = this._state.getAbilityBase(abl);
					this._state.setAbilityBase(abl, Math.min(20, currentBase + asiChoices[abl]));
					increases.push(`${Parser.attAbvToFull(abl)} +${asiChoices[abl]}`);
				}
			});

			// Add a tracking feature for the ASI choice
			if (increases.length > 0) {
				const asiFeature = {
					name: "Ability Score Improvement",
					source: classData.source,
					className: classEntry.name,
					classSource: classEntry.source,
					level: newLevel,
					featureType: "Class",
					description: `<p><strong>Ability Score Increases:</strong> ${increases.join(", ")}</p>`,
					isAsiChoice: true, // Mark as ASI choice for special handling
				};
				this._state.addFeature(asiFeature);
			}
		}

		// Apply selected optional features (invocations, metamagic, maneuvers, etc.)
		if (selectedOptionalFeatures) {
			Object.entries(selectedOptionalFeatures).forEach(([featureKey, opts]) => {
				// featureKey is like "EI" or "MM" or "CTM:1_CTM:2_..." - the feature types joined
				const featureTypes = featureKey.split("_");
				opts.forEach(opt => {
					// Use the original feature's featureType if available (e.g., ["CTM:1AM", "CTM:2AM"])
					// This preserves the full type info including tradition codes
					const originalTypes = opt.featureType || featureTypes;

					const featureData = {
						name: opt.name,
						source: opt.source,
						className: classEntry.name,
						classSource: classEntry.source,
						level: newLevel,
						featureType: "Optional Feature",
						optionalFeatureTypes: originalTypes, // Store original types for proper grouping
						description: opt.entries ? Renderer.get().render({entries: opt.entries}) : "",
						entries: opt.entries,
					};
					console.log("[LevelUp] Adding optional feature:", featureData.name, "types:", featureData.optionalFeatureTypes);
					this._state.addFeature(featureData);
				});
			});
		}

		// Apply selected feature options (specialties, etc. - features with embedded options)
		if (selectedFeatureOptions) {
			const classFeatures = this._page.getClassFeatures();
			Object.entries(selectedFeatureOptions).forEach(([featureKey, options]) => {
				options.forEach(opt => {
					if (opt.type === "classFeature" && opt.ref) {
						// Look up full feature data
						const parts = opt.ref.split("|");
						const fullOpt = classFeatures.find(f =>
							f.name === parts[0]
							&& f.className === parts[1]
							&& f.source === parts[2],
						);

						this._state.addFeature({
							name: opt.name,
							source: opt.source || fullOpt?.source || classEntry.source,
							level: opt.level || newLevel,
							className: opt.className || classEntry.name,
							classSource: classEntry.source,
							featureType: "Class",
							entries: fullOpt?.entries,
							description: fullOpt?.entries ? Renderer.get().render({entries: fullOpt.entries}) : "",
							isFeatureOption: true,
							parentFeature: featureKey.split("_")[0],
						});

						// Apply any skill sub-choices for this specialty
						const choiceKey = `${featureKey}__${opt.name}__${opt.ref || ""}`;
						const skillSelections = this._selectedFeatureSkillChoices[choiceKey];
						if (skillSelections?.length) {
							const skillChoice = this._parseFeatureSkillChoice(opt);
							if (skillChoice) {
								skillSelections.forEach(skill => {
									const skillKey = skill.toLowerCase().replace(/\s+/g, "");
									if (skillChoice.type === "proficiency") {
										this._state.setSkillProficiency(skillKey, 1);
										console.log(`[LevelUp] Applied proficiency in ${skill} from "${opt.name}"`);
									} else if (skillChoice.type === "expertise") {
										this._state.setSkillProficiency(skillKey, 2);
										console.log(`[LevelUp] Applied expertise in ${skill} from "${opt.name}"`);
									} else if (skillChoice.type === "bonus") {
										this._state.addNamedModifier({
											name: `${opt.name} (${skill})`,
											type: `skill:${skillKey}`,
											value: "proficiency",
											note: `From ${opt.name}: bonus equal to proficiency bonus`,
											enabled: true,
										});
										console.log(`[LevelUp] Applied skill bonus to ${skill} from "${opt.name}"`);
									}
								});
							}
						}
					} else if (opt.type === "subclassFeature" && opt.ref) {
						const currentSubclass = this._state.getClasses().find(c => c.name === classEntry.name)?.subclass;
						// Look up full subclass feature data for description
						const subclassFeatures = this._page.getSubclassFeatures() || [];
						const fullSubFeature = subclassFeatures.find(f =>
							f.name === opt.name
							&& (f.subclassShortName === currentSubclass?.shortName || f.subclassShortName === opt.subclassShortName),
						);
						this._state.addFeature({
							name: opt.name,
							source: opt.subclassSource || currentSubclass?.source || classEntry.source,
							level: opt.level || newLevel,
							className: opt.className || classEntry.name,
							classSource: classEntry.source,
							subclassName: currentSubclass?.name,
							subclassShortName: opt.subclassShortName || currentSubclass?.shortName,
							subclassSource: opt.subclassSource || currentSubclass?.source,
							featureType: "Class",
							isSubclassFeature: true,
							isFeatureOption: true,
							parentFeature: featureKey.split("_")[0],
							entries: fullSubFeature?.entries,
							description: fullSubFeature?.entries ? Renderer.get().render({entries: fullSubFeature.entries}) : "",
						});
					} else if (opt.type === "optionalfeature" && opt.ref) {
						const allOptFeatures = this._page.getOptionalFeatures();
						const fullOpt = allOptFeatures.find(f =>
							f.name === opt.name
							&& (f.source === opt.source || !opt.source),
						);
						this._state.addFeature({
							name: opt.name,
							source: opt.source || fullOpt?.source,
							level: newLevel,
							className: classEntry.name,
							classSource: classEntry.source,
							featureType: "Optional Feature",
							entries: fullOpt?.entries,
							description: fullOpt?.entries ? Renderer.get().render({entries: fullOpt.entries}) : "",
							isFeatureOption: true,
							parentFeature: featureKey.split("_")[0],
						});
					}
				});
			});
		}

		// Apply selected expertise from features like Deft Explorer Improvement
		if (selectedExpertise) {
			Object.entries(selectedExpertise).forEach(([featureName, skills]) => {
				skills.forEach(skill => {
					this._state.addExpertise(skill.toLowerCase());
				});
				console.log(`[LevelUp] Applied expertise from ${featureName}:`, skills);
			});
		}

		// Apply selected languages from features like Deft Explorer Improvement
		if (selectedLanguages) {
			Object.entries(selectedLanguages).forEach(([featureName, languages]) => {
				languages.forEach(lang => {
					this._state.addLanguage(lang);
				});
				console.log(`[LevelUp] Applied languages from ${featureName}:`, languages);
			});
		}

		// Apply HP increase
		let hpIncrease = 0;
		const hitDie = this._getClassHitDie(classData);
		const conMod = this._state.getAbilityMod("con");

		if (hpMethod === "roll") {
			const roll = RollerUtil.randomise(hitDie);
			hpIncrease = Math.max(1, roll + conMod);
			this._page.showDiceResult({
				title: "HP Roll",
				total: hpIncrease,
				subtitle: `1d${hitDie} (${roll}) + ${conMod} CON`,
			});
		} else {
			hpIncrease = Math.ceil(hitDie / 2) + 1 + conMod;
		}

		const currentMaxHp = this._state.getMaxHp();
		this._state.setMaxHp(currentMaxHp + hpIncrease);
		this._state.setCurrentHp(this._state.getCurrentHp() + hpIncrease);

		// Add new features to character
		// Filter out placeholder features and ASI features (since ASI is handled separately)
		const asiFeatureNames = [
			"ability score improvement",
			"ability score increase",
			"asi",
		];

		// Get existing non-subclass feature names to prevent duplicates (like "Metamagic" at level 3 and 10)
		// Only filter class features, not subclass features (those can have same-named features at different levels)
		const existingClassFeatureNames = this._state.getFeatures()
			.filter(f => f.className === classEntry.name && !f.subclassName && !f.isSubclassFeature)
			.map(f => f.name.toLowerCase());

		const featuresToAdd = newFeatures.filter(f => {
			if (f.gainSubclassFeature) return false;
			// Filter out ASI features since we handle them in the UI
			const nameLower = f.name.toLowerCase();
			if (asiFeatureNames.some(asi => nameLower.includes(asi))) return false;
			// Filter out duplicate non-subclass features (e.g., "Metamagic" at level 3 and 10)
			// But always include subclass features
			if (!f.isSubclassFeature && !f.subclassName && existingClassFeatureNames.includes(nameLower)) return false;
			return true;
		});
		console.log(`[LevelUp] FINAL features to add:`, featuresToAdd?.map(f => `${f.name} (isSubclass=${f.isSubclassFeature})`));
		featuresToAdd.forEach(feature => {
			// Render description from entries if not already rendered
			let description = feature.description;
			if (!description && feature.entries) {
				description = Renderer.get().render({entries: feature.entries});
			}

			const featureData = {
				name: feature.name,
				source: feature.source || classData.source,
				className: feature.className || classEntry.name,
				classSource: feature.classSource || classData.source,
				level: feature.level || newLevel,
				subclassName: feature.subclassName,
				subclassShortName: feature.subclassShortName,
				subclassSource: feature.subclassSource,
				featureType: "Class",
				description: description || "",
			};
			this._state.addFeature(featureData);
		});

		// Update hit dice
		this._updateHitDice(classData);

		// Update class resources (Ki Points, Rage, etc.)
		this._updateClassResources(classEntry, newLevel, classData);

		// Update spell slots if applicable
		this._updateSpellSlots(classEntry, newLevel, classData);

		// Check for racial spells at the new character level
		this._updateRacialSpells();

		// Save and re-render
		await this._page.saveCharacter();
		this._page.renderCharacter();

		JqueryUtil.doToast({type: "success", content: `Leveled up to ${classEntry.name} ${newLevel}!`});
	}

	_applyFeatBonuses (feat) {
		// Handle common feat patterns
		if (feat.ability) {
			// Feats that grant ability score increases
			feat.ability.forEach(ablChoice => {
				if (ablChoice.choose) {
					// Would need UI for this, skip for now
				} else {
					Object.entries(ablChoice).forEach(([abl, bonus]) => {
						if (Parser.ABIL_ABVS.includes(abl)) {
							const current = this._state.getAbilityBase(abl);
							this._state.setAbilityBase(abl, Math.min(20, current + bonus));
						}
					});
				}
			});
		}

		if (feat.skillProficiencies) {
			feat.skillProficiencies.forEach(sp => {
				Object.keys(sp).forEach(skill => {
					if (skill !== "choose" && skill !== "any") {
						this._state.addSkillProficiency(skill.toLowerCase().replace(/\s+/g, ""));
					}
				});
			});
		}

		if (feat.languageProficiencies) {
			feat.languageProficiencies.forEach(lp => {
				Object.keys(lp).forEach(lang => {
					if (lang !== "anyStandard" && lang !== "any") {
						this._state.addLanguage(lang);
					}
				});
			});
		}
	}

	_updateHitDice (classData) {
		const hitDie = `d${this._getClassHitDie(classData)}`;
		const hitDice = this._state.getHitDiceByType();

		if (!hitDice[hitDie]) {
			hitDice[hitDie] = {current: 1, max: 1};
		} else {
			hitDice[hitDie].max += 1;
			hitDice[hitDie].current += 1;
		}

		this._state.setHitDice(hitDice);
	}

	_updateClassResources (classEntry, newLevel, classData) {
		// Fallback class resource definitions for features with non-parseable descriptions
		// Most resources are auto-detected by addFeature(), this handles edge cases
		const resourceDefs = {
			"Barbarian": [
				{name: "Rage", maxByLevel: [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 999], recharge: "long"},
			],
			"Monk": [
				// Use placeholder - resolved below based on edition
				{name: "__MONK_RESOURCE__", maxByLevel: lvl => lvl >= 2 ? lvl : 0, recharge: "short"},
			],
			"Sorcerer": [
				{name: "Sorcery Points", maxByLevel: lvl => lvl >= 2 ? lvl : 0, recharge: "long"},
			],
			"Paladin": [
				{name: "Lay on Hands", maxByLevel: lvl => lvl * 5, recharge: "long"},
			],
			"Bard": [
				{name: "Bardic Inspiration", maxByLevel: () => Math.max(1, this._state.getAbilityMod("cha")), recharge: newLevel >= 5 ? "short" : "long"},
			],
		};

		const classResourceDefs = resourceDefs[classData.name];
		if (!classResourceDefs) {
			// No fallback resources, but recalculate any auto-detected resources
			this._state.recalculateResourceMaximums();
			return;
		}

		const currentResources = this._state.getResources();

		classResourceDefs.forEach(resourceDef => {
			// Resolve special placeholder for monk Ki/Focus Points
			let resourceName = resourceDef.name;
			if (resourceName === "__MONK_RESOURCE__") {
				// Use "Focus Points" for 2024 (XPHB) monks, "Ki Points" for 2014 monks
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

			// Find existing resource (check both Ki and Focus for monks - they're interchangeable)
			const isMonkResource = resourceName === "Ki Points" || resourceName === "Focus Points";
			let existingResource;
			if (isMonkResource) {
				existingResource = currentResources.find(r => r.name === "Ki Points" || r.name === "Focus Points");
			} else {
				existingResource = currentResources.find(r => r.name === resourceName);
			}

			if (existingResource) {
				// Update max if it increased
				const oldMax = existingResource.max;
				if (newMax > oldMax) {
					existingResource.max = newMax;
					existingResource.current += (newMax - oldMax);
				}
			} else if (newMax > 0) {
				// Add new resource
				this._state.addResource({
					name: resourceName,
					max: newMax,
					current: newMax,
					recharge: resourceDef.recharge,
				});
			}
		});

		// Also recalculate auto-detected resources (based on proficiency bonus, ability mods, etc.)
		this._state.recalculateResourceMaximums();
	}

	_updateSpellSlots (classEntry, newLevel, classData) {
		// Check if class is a spellcaster
		const spellcastingAbility = this._getSpellcastingAbility(classData);
		if (!spellcastingAbility) return;

		// For multiclass characters, always use the proper multiclass spell slot calculation
		// This correctly handles full/half/third casters according to 2024 rules
		const classes = this._state.getClasses();
		const isMulticlass = classes.length > 1;

		if (isMulticlass) {
			// Use the state's multiclass spell slot calculator which handles:
			// - Full casters: all levels count
			// - Half casters (Paladin, Ranger): half levels rounded UP
			// - Third casters (Eldritch Knight, Arcane Trickster): third levels rounded DOWN
			// - Warlock Pact Magic: separate from other casters
			this._state.calculateSpellSlots();
		} else {
			// Single class: use class-specific progression tables
			const slots = this._getSpellSlotsForLevel(classData, newLevel);

			// Update spellcasting
			const spellcasting = this._state.getSpellcasting();
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
			"Monk": "wis",
		};
		return classData.spellcastingAbility || abilityMap[classData.name] || null;
	}

	_getSpellSlotsForLevel (classData, level) {
		// Full casters spell slot progression
		const fullCasterSlots = {
			1: {1: 2},
			2: {1: 3},
			3: {1: 4, 2: 2},
			4: {1: 4, 2: 3},
			5: {1: 4, 2: 3, 3: 2},
			6: {1: 4, 2: 3, 3: 3},
			7: {1: 4, 2: 3, 3: 3, 4: 1},
			8: {1: 4, 2: 3, 3: 3, 4: 2},
			9: {1: 4, 2: 3, 3: 3, 4: 3, 5: 1},
			10: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2},
			11: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1},
			12: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1},
			13: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1},
			14: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1},
			15: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1},
			16: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1},
			17: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1},
			18: {1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1},
			19: {1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1},
			20: {1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1},
		};

		// Half casters (Paladin, Ranger)
		const halfCasterSlots = {
			2: {1: 2},
			3: {1: 3},
			4: {1: 3},
			5: {1: 4, 2: 2},
			6: {1: 4, 2: 2},
			7: {1: 4, 2: 3},
			8: {1: 4, 2: 3},
			9: {1: 4, 2: 3, 3: 2},
			10: {1: 4, 2: 3, 3: 2},
			11: {1: 4, 2: 3, 3: 3},
			12: {1: 4, 2: 3, 3: 3},
			13: {1: 4, 2: 3, 3: 3, 4: 1},
			14: {1: 4, 2: 3, 3: 3, 4: 1},
			15: {1: 4, 2: 3, 3: 3, 4: 2},
			16: {1: 4, 2: 3, 3: 3, 4: 2},
			17: {1: 4, 2: 3, 3: 3, 4: 3, 5: 1},
			18: {1: 4, 2: 3, 3: 3, 4: 3, 5: 1},
			19: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2},
			20: {1: 4, 2: 3, 3: 3, 4: 3, 5: 2},
		};

		const fullCasters = ["Wizard", "Sorcerer", "Cleric", "Druid", "Bard"];
		const halfCasters = ["Paladin", "Ranger"];

		if (fullCasters.includes(classData.name)) {
			return fullCasterSlots[level] || {};
		} else if (halfCasters.includes(classData.name)) {
			return halfCasterSlots[level] || {};
		}

		// Warlock uses pact magic (handled separately)
		// Fighter/Rogue get limited casting via subclass

		return {};
	}

	/**
	 * Check for and add racial spells at the current character level
	 * Called after level-up to grant spells from racial features (e.g., Tiefling, High Elf)
	 */
	_updateRacialSpells () {
		const race = this._state.getRace();
		if (!race?.additionalSpells?.length) return;

		const totalLevel = this._state.getTotalLevel();
		const allSpells = this._page.getSpells();
		const raceName = race.name;
		const subraceName = race._subraceName || race.subrace;

		console.log(`[LevelUp] Checking racial spells for level ${totalLevel}: ${raceName} ${subraceName ? `(${subraceName})` : ""}`);

		race.additionalSpells.forEach(spellBlock => {
			// Check if this spell block is subrace-specific
			if (spellBlock.name) {
				// This spell block is for a specific subrace - only apply if it matches
				if (!subraceName || spellBlock.name.toLowerCase() !== subraceName.toLowerCase()) {
					return;
				}
			}

			// Process "known" spells at this level
			if (spellBlock.known) {
				Object.entries(spellBlock.known).forEach(([levelStr, spellsAtLevel]) => {
					const charLevel = parseInt(levelStr);
					// Only add spells for this exact level (don't re-add lower level spells)
					if (charLevel !== totalLevel) return;

					this._processRacialSpellList(spellsAtLevel, allSpells, raceName);
				});
			}

			// Process "innate" spells at this level
			if (spellBlock.innate) {
				Object.entries(spellBlock.innate).forEach(([levelStr, spellConfig]) => {
					const charLevel = parseInt(levelStr);
					// Only add spells for this exact level
					if (charLevel !== totalLevel) return;

					if (typeof spellConfig === "object") {
						if (spellConfig.daily) {
							Object.entries(spellConfig.daily).forEach(([uses, spellList]) => {
								this._processRacialInnateSpells(spellList, allSpells, raceName, parseInt(uses), "long");
							});
						}
						if (spellConfig.rest) {
							Object.entries(spellConfig.rest).forEach(([uses, spellList]) => {
								this._processRacialInnateSpells(spellList, allSpells, raceName, parseInt(uses), "short");
							});
						}
						if (Array.isArray(spellConfig)) {
							this._processRacialInnateSpells(spellConfig, allSpells, raceName, 0, null);
						}
					} else if (Array.isArray(spellConfig)) {
						this._processRacialInnateSpells(spellConfig, allSpells, raceName, 0, null);
					}
				});
			}
		});
	}

	/**
	 * Process a list of spells and add them as known spells
	 */
	_processRacialSpellList (spellList, allSpells, sourceName) {
		if (!Array.isArray(spellList)) {
			if (typeof spellList === "object" && spellList._) {
				this._processRacialSpellList(spellList._, allSpells, sourceName);
			}
			return;
		}

		spellList.forEach(spellRef => {
			const spellData = this._resolveSpellReference(spellRef, allSpells);
			if (spellData) {
				// Check if spell already known
				const existing = this._state.getSpells().find(s =>
					s.name === spellData.name && s.source === spellData.source,
				);
				if (existing) return;

				this._state.addSpell({
					name: spellData.name,
					source: spellData.source,
					level: spellData.level,
					school: spellData.school,
					prepared: spellData.level === 0, // Cantrips always prepared
					ritual: spellData.ritual || false,
					concentration: spellData.concentration || false,
					castingTime: this._getSpellCastingTime(spellData),
					range: this._getSpellRange(spellData),
					components: this._getSpellComponents(spellData),
					duration: this._getSpellDuration(spellData),
				});
				console.log(`[LevelUp] Added racial spell: ${spellData.name}`);
			}
		});
	}

	/**
	 * Process innate spells with uses/recharge
	 */
	_processRacialInnateSpells (spellList, allSpells, sourceName, uses, recharge) {
		if (!Array.isArray(spellList)) return;

		spellList.forEach(spellRef => {
			const spellData = this._resolveSpellReference(spellRef, allSpells);
			if (spellData) {
				// Check if innate spell already exists
				const existing = this._state.getInnateSpells().find(s =>
					s.name === spellData.name && s.source === spellData.source,
				);
				if (existing) return;

				const atWill = uses === 0;
				this._state.addInnateSpell({
					name: spellData.name,
					source: spellData.source,
					level: spellData.level,
					atWill: atWill,
					uses: atWill ? null : uses,
					recharge: recharge,
					sourceFeature: sourceName,
				});
				console.log(`[LevelUp] Added innate spell: ${spellData.name} (${atWill ? "at-will" : `${uses}/rest`})`);
			}
		});
	}

	/**
	 * Resolve a spell reference to full spell data
	 */
	_resolveSpellReference (spellRef, allSpells) {
		if (typeof spellRef !== "string") return null;

		let spellName = spellRef.replace(/#c$/, "");
		let source = null;

		const parts = spellName.split("|");
		spellName = parts[0].toLowerCase();
		if (parts.length > 1) {
			source = parts[1].toUpperCase();
		}

		return allSpells.find(s => {
			const nameMatch = s.name.toLowerCase() === spellName;
			if (!nameMatch) return false;
			if (source) return s.source === source;
			return true;
		});
	}

	// Spell data formatting helpers
	_getSpellCastingTime (spell) {
		if (!spell.time?.length) return "";
		const time = spell.time[0];
		return `${time.number} ${time.unit}`;
	}

	_getSpellRange (spell) {
		if (!spell.range) return "";
		const range = spell.range;
		if (range.type === "point") {
			if (range.distance?.type === "self") return "Self";
			if (range.distance?.type === "touch") return "Touch";
			return `${range.distance?.amount || ""} ${range.distance?.type || ""}`.trim();
		}
		return `${range.distance?.amount || ""} ${range.distance?.type || ""}`.trim();
	}

	_getSpellComponents (spell) {
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

	_getSpellDuration (spell) {
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
	 * Add multiclass to character
	 */
	async showMulticlass () {
		const classes = this._page.getClasses();
		const currentClasses = this._state.getClasses();

		// Filter out classes character already has
		const availableClasses = classes.filter(c => !currentClasses.some(cc => cc.name === c.name));

		if (!availableClasses.length) {
			JqueryUtil.doToast({type: "warning", content: "No additional classes available."});
			return;
		}

		// Check total level cap
		const totalLevel = this._state.getTotalLevel();
		if (totalLevel >= 20) {
			JqueryUtil.doToast({type: "warning", content: "Character has reached maximum total level (20)."});
			return;
		}

		// Helper to get primary ability for a class (for multiclass prerequisites)
		const getPrimaryAbility = (classData) => {
			if (!classData.primaryAbility) return null;
			// primaryAbility is an array of ability options
			// Each option is an object like {str: true} or {str: true, dex: true} for "or" choice
			return classData.primaryAbility.map(abilityObj => {
				return Object.keys(abilityObj).filter(k => Parser.ABIL_ABVS.includes(k));
			});
		};

		// Check if character meets prerequisites for a class
		// Must have 13+ in new class's primary ability AND current class(es) primary abilities
		const checkPrerequisites = (newClassData) => {
			const result = {met: true, failedAbilities: [], warnings: []};

			// Check new class requirements
			const newClassAbilities = getPrimaryAbility(newClassData);
			if (newClassAbilities) {
				for (const abilityOptions of newClassAbilities) {
					// For "or" choices, need at least one to meet 13
					const meetsRequirement = abilityOptions.some(abl => this._state.getAbilityScore(abl) >= 13);
					if (!meetsRequirement) {
						result.met = false;
						const abilityNames = abilityOptions.map(a => Parser.attAbvToFull(a)).join(" or ");
						result.failedAbilities.push(`${newClassData.name} requires ${abilityNames} 13+`);
					}
				}
			}

			// Check current class(es) requirements
			for (const currentCls of currentClasses) {
				const currentClassData = classes.find(c => c.name === currentCls.name);
				if (currentClassData) {
					const currentAbilities = getPrimaryAbility(currentClassData);
					if (currentAbilities) {
						for (const abilityOptions of currentAbilities) {
							const meetsRequirement = abilityOptions.some(abl => this._state.getAbilityScore(abl) >= 13);
							if (!meetsRequirement) {
								result.met = false;
								const abilityNames = abilityOptions.map(a => Parser.attAbvToFull(a)).join(" or ");
								result.failedAbilities.push(`${currentCls.name} requires ${abilityNames} 13+`);
							}
						}
					}
				}
			}

			return result;
		};

		// Format prerequisite display for a class
		const formatPrerequisiteDisplay = (classData) => {
			const abilities = getPrimaryAbility(classData);
			if (!abilities?.length) return null;

			return abilities.map(abilityOptions => {
				const abilityChecks = abilityOptions.map(abl => {
					const score = this._state.getAbilityScore(abl);
					const met = score >= 13;
					return {abl, score, met, name: Parser.attAbvToFull(abl)};
				});

				// For "or" choices, at least one needs to be met
				const groupMet = abilityChecks.some(c => c.met);
				return {abilityChecks, groupMet};
			});
		};

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "📚 Add New Class (Multiclass)",
			isMinHeight0: true,
			isWidth100: true,
		});

		let selectedClass = null;
		let updateConfirmButton = null; // Will be assigned after button is created

		const $search = $(`<input type="text" class="form-control charsheet__modal-search" placeholder="🔍 Search classes...">`);
		const $list = $(`<div class="charsheet__levelup-subclasses" style="max-height: 350px;"></div>`);

		// Selection display showing which class is chosen
		const $selectionDisplay = $(`
			<div class="charsheet__multiclass-selection" style="display: none;">
				<span class="charsheet__multiclass-selection-icon">✅</span>
				<strong>Selected:</strong> <span class="charsheet__multiclass-selection-name"></span>
				<div class="charsheet__multiclass-prereq-status"></div>
			</div>
		`);

		const renderList = (filter = "") => {
			$list.empty();

			const filtered = availableClasses.filter(c =>
				c.name.toLowerCase().includes(filter.toLowerCase()),
			);

			if (filtered.length === 0) {
				$list.append(`<div class="ve-muted p-2 text-center">No matching classes found</div>`);
				return;
			}

			filtered.forEach(cls => {
				// Get hit die info
				const hitDie = cls.hd?.faces ? `d${cls.hd.faces}` : "—";
				// Get primary ability if available
				const spellcaster = cls.spellcastingAbility
					? `✨ Spellcaster (${Parser.attAbvToFull(cls.spellcastingAbility)})`
					: "";

				// Get prerequisite info
				const prereqInfo = formatPrerequisiteDisplay(cls);
				let prereqHtml = "";
				if (prereqInfo) {
					const prereqParts = prereqInfo.map(group => {
						const abilityStrs = group.abilityChecks.map(c => {
							const icon = c.met ? "✅" : "❌";
							return `${icon} ${c.name} ${c.score}/13`;
						}).join(" or ");
						return abilityStrs;
					});
					prereqHtml = `<div class="charsheet__multiclass-prereq ve-small ve-muted">📋 Prerequisite: ${prereqParts.join(", ")}</div>`;
				}

				const $item = $$`
					<div class="charsheet__levelup-option" data-class-name="${cls.name}">
						<div class="charsheet__levelup-option-header">
							<input type="radio" name="multiclass-choice" value="${cls.name}">
							<strong>${cls.name}</strong>
							<span class="ve-muted ml-1">(${Parser.sourceJsonToAbv(cls.source)})</span>
						</div>
						<div class="charsheet__levelup-option-description ve-small">
							<span class="charsheet__class-stat">❤️ Hit Die: ${hitDie}</span>
							${spellcaster ? `<span class="charsheet__class-stat">${spellcaster}</span>` : ""}
						</div>
						${prereqHtml}
					</div>
				`;

				$item.on("click", () => {
					$list.find(".charsheet__levelup-option").removeClass("selected");
					$list.find("input[type='radio']").prop("checked", false);
					$item.addClass("selected");
					$item.find("input[type='radio']").prop("checked", true);
					selectedClass = cls;

					// Update selection display
					$selectionDisplay.find(".charsheet__multiclass-selection-name").text(cls.name);

					// Check and display prerequisite status
					const prereqCheck = checkPrerequisites(cls);
					const $prereqStatus = $selectionDisplay.find(".charsheet__multiclass-prereq-status");
					if (prereqCheck.met) {
						$prereqStatus.html(`<span class="text-success">✅ Prerequisites met</span>`);
					} else {
						$prereqStatus.html(`<span class="text-danger">❌ ${prereqCheck.failedAbilities.join("; ")}</span>`);
					}
					$selectionDisplay.show();

					// Update confirm button (will be set after button is created)
					if (typeof updateConfirmButton === "function") updateConfirmButton(cls, prereqCheck);
				});

				$list.append($item);
			});
		};

		$search.on("input", (e) => renderList(e.target.value));
		renderList();

		$$`<div class="charsheet__multiclass-body">
			<div class="charsheet__modal-info-banner charsheet__modal-info-banner--info">
				<div class="charsheet__modal-info-banner-icon">📚</div>
				<div class="charsheet__modal-info-banner-content">
					<strong>Add a New Class</strong>
					<div class="ve-small">Select a class to multiclass into. You'll start at level 1 in the new class. 
					Make sure your character meets the ability score prerequisites for multiclassing.</div>
				</div>
			</div>
			<div class="charsheet__modal-search-wrapper">
				${$search}
				<span class="charsheet__modal-search-count">${availableClasses.length} classes</span>
			</div>
			${$list}
			${$selectionDisplay}
		</div>`.appendTo($modalInner);

		// Footer buttons
		const $btnCancel = $(`<button class="ve-btn ve-btn-default">Cancel</button>`)
			.on("click", () => doClose(false));
		const $btnConfirm = $(`<button class="ve-btn ve-btn-primary" disabled><span class="btn-text">Select a Class</span></button>`);

		let currentPrereqCheck = null;

		// Assign update function now that button exists
		updateConfirmButton = (cls, prereqCheck) => {
			currentPrereqCheck = prereqCheck;
			if (cls) {
				const prereqsMet = prereqCheck?.met !== false;
				if (prereqsMet) {
					$btnConfirm.find(".btn-text").text(`Add ${cls.name} (Level 1)`);
					$btnConfirm.removeClass("ve-btn-warning").addClass("ve-btn-primary");
				} else {
					$btnConfirm.find(".btn-text").text(`Add ${cls.name} Anyway`);
					$btnConfirm.removeClass("ve-btn-primary").addClass("ve-btn-warning");
				}
				$btnConfirm.prop("disabled", false);
			} else {
				$btnConfirm.find(".btn-text").text("Select a Class");
				$btnConfirm.removeClass("ve-btn-warning").addClass("ve-btn-primary");
				$btnConfirm.prop("disabled", true);
			}
		};

		$btnConfirm.on("click", async () => {
			if (!selectedClass) return;

			// Warn if prerequisites not met
			if (currentPrereqCheck && !currentPrereqCheck.met) {
				const confirmAnyway = confirm(
					`Warning: Your character does not meet the multiclass prerequisites:\n\n`
						+ `${currentPrereqCheck.failedAbilities.join("\n")}\n\n`
						+ `The rules require 13+ in the primary ability of both your current class(es) and the new class. `
						+ `Add this class anyway?`,
				);
				if (!confirmAnyway) return;
			}

			// Close class selection modal
			doClose(true);

			// Check for level 1 choices (optional features, feature options)
			const hasLevel1Choices = await this._showMulticlassChoices(selectedClass);

			// If choices modal was cancelled, don't add the class
			if (hasLevel1Choices === false) {
				JqueryUtil.doToast({type: "info", content: "Multiclass cancelled."});
			}
		});

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			${$btnCancel}
			${$btnConfirm}
		</div>`.appendTo($modalInner);
	}

	/**
	 * Show level 1 choices for multiclassing (Fighting Style, etc.)
	 * Returns true if class was added, false if cancelled
	 */
	async _showMulticlassChoices (selectedClass) {
		// Get level 1 features
		const features = this._getLevelFeatures(selectedClass, 1);

		// Get optional feature gains (Fighting Style, etc.)
		const optionalFeatureGains = this._getOptionalFeatureGains(selectedClass, 0, 1);

		// Get feature options (choices within features)
		const featureOptionGroups = this._getFeatureOptionsForLevel(features, 1);

		// Get multiclass skill grant info
		const multiclassSkillGrants = {
			"Bard": {count: 1, from: Object.keys(Parser.SKILL_TO_ATB_ABV)}, // Any skill
			"Ranger": {count: 1, from: ["animal handling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"]},
			"Rogue": {count: 1, from: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleight of hand", "stealth"]},
		};
		const skillGrant = multiclassSkillGrants[selectedClass.name];

		// If no choices needed, add the class directly
		if (!optionalFeatureGains.length && !featureOptionGroups.length && !skillGrant) {
			await this._applyMulticlass(selectedClass, features, {}, {}, []);
			return true;
		}

		// Show choices modal
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: `${selectedClass.name} - Level 1 Choices`,
			isMinHeight0: true,
			isWidth100: true,
		});

		let selectedOptionalFeatures = {};
		let selectedFeatureOptions = {};
		let selectedSkills = [];

		const $content = $(`<div></div>`);

		// Info about what choices need to be made
		const choicesList = [];
		if (optionalFeatureGains.length) {
			optionalFeatureGains.forEach(g => choicesList.push(`${g.newCount} ${g.name}`));
		}
		if (featureOptionGroups.length) {
			featureOptionGroups.forEach(g => choicesList.push(`${g.count} option(s) for ${g.featureName}`));
		}
		if (skillGrant) {
			choicesList.push(`${skillGrant.count} skill proficiency`);
		}

		$content.append(`
			<div class="alert alert-info mb-3">
				<strong>🎯 Make Your Choices</strong><br>
				<span class="ve-small">As a level 1 ${selectedClass.name}, you need to select: ${choicesList.join(", ")}</span>
			</div>
		`);

		// Render skill selection for multiclass (if applicable)
		if (skillGrant) {
			const currentSkills = this._state.getSkillProficiencies();
			const availableSkills = skillGrant.from.filter(s => !currentSkills.includes(s));

			const $skillSection = $(`<div class="charsheet__levelup-section mb-3">
				<h5>🎓 Skill Proficiency</h5>
				<p class="ve-small ve-muted">Select ${skillGrant.count} skill${skillGrant.count > 1 ? "s" : ""} to gain proficiency in:</p>
				<div class="charsheet__skill-choice-list"></div>
			</div>`);

			const $skillList = $skillSection.find(".charsheet__skill-choice-list");
			availableSkills.forEach(skill => {
				const skillName = skill.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
				const $checkbox = $(`<label class="charsheet__skill-choice-item">
					<input type="checkbox" value="${skill}">
					<span>${skillName}</span>
				</label>`);

				$checkbox.find("input").on("change", function () {
					const isChecked = $(this).is(":checked");
					const value = $(this).val();

					if (isChecked) {
						if (selectedSkills.length < skillGrant.count) {
							selectedSkills.push(value);
						} else {
							$(this).prop("checked", false);
							JqueryUtil.doToast({type: "warning", content: `You can only select ${skillGrant.count} skill${skillGrant.count > 1 ? "s" : ""}.`});
						}
					} else {
						selectedSkills = selectedSkills.filter(s => s !== value);
					}
				});

				$skillList.append($checkbox);
			});

			$content.append($skillSection);
		}

		// Render optional features selection (Fighting Style, etc.)
		if (optionalFeatureGains.length) {
			const $optSection = this._renderOptionalFeaturesSelection(selectedClass, optionalFeatureGains, (featureType, featuresList) => {
				selectedOptionalFeatures[featureType] = featuresList;
			}, 1);
			$content.append($optSection);
		}

		// Render feature options selection
		if (featureOptionGroups.length) {
			const $featOptSection = this._renderFeatureOptionsSelection(featureOptionGroups, (featureKey, options) => {
				selectedFeatureOptions[featureKey] = options;
			});
			$content.append($featOptSection);
		}

		$content.appendTo($modalInner);

		// Footer buttons
		const $btnCancel = $(`<button class="ve-btn ve-btn-default">Cancel</button>`)
			.on("click", () => doClose(false));
		const $btnConfirm = $(`<button class="ve-btn ve-btn-primary">Confirm & Add ${selectedClass.name}</button>`)
			.on("click", async () => {
				// Validate optional features
				for (const gain of optionalFeatureGains) {
					const featureKey = gain.featureTypes.join("_");
					const selected = selectedOptionalFeatures[featureKey] || [];
					if (selected.length < gain.newCount) {
						JqueryUtil.doToast({type: "warning", content: `Please select ${gain.newCount} ${gain.name}.`});
						return;
					}
				}

				// Validate feature options
				for (const optGroup of featureOptionGroups) {
					const featureKey = `${optGroup.featureName}_${optGroup.featureSource || ""}`;
					const selected = selectedFeatureOptions[featureKey] || [];
					if (selected.length < optGroup.count) {
						JqueryUtil.doToast({type: "warning", content: `Please select ${optGroup.count} option(s) for ${optGroup.featureName}.`});
						return;
					}
				}

				// Validate skill selections
				if (skillGrant && selectedSkills.length < skillGrant.count) {
					JqueryUtil.doToast({type: "warning", content: `Please select ${skillGrant.count} skill proficiency.`});
					return;
				}

				// Apply multiclass with selections
				await this._applyMulticlass(selectedClass, features, selectedOptionalFeatures, selectedFeatureOptions, selectedSkills);

				doClose(true);
			});

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			${$btnCancel}
			${$btnConfirm}
		</div>`.appendTo($modalInner);

		// Wait for modal to close and return result
		return new Promise(resolve => {
			const checkClosed = setInterval(() => {
				if (!$modalInner.is(":visible")) {
					clearInterval(checkClosed);
					// Check if class was added by looking for it
					const wasAdded = this._state.getClasses().some(c => c.name === selectedClass.name);
					resolve(wasAdded);
				}
			}, 100);
		});
	}

	/**
	 * Apply multiclass - add class, features, proficiencies, and selected optional features
	 */
	async _applyMulticlass (selectedClass, features, selectedOptionalFeatures, selectedFeatureOptions, selectedSkills = []) {
		// Add class at level 1 with caster info for multiclass spell slot calculation
		this._state.addClass({
			name: selectedClass.name,
			source: selectedClass.source,
			level: 1,
			subclass: null,
			casterProgression: selectedClass.casterProgression || null,
			spellcastingAbility: selectedClass.spellcastingAbility || null,
		});

		// Add first level features
		features.forEach(f => {
			let description = f.description;
			if (!description && f.entries) {
				description = Renderer.get().render({entries: f.entries});
			}

			this._state.addFeature({
				name: f.name,
				source: f.source || selectedClass.source,
				level: f.level || 1,
				className: f.className || selectedClass.name,
				classSource: f.classSource || selectedClass.source,
				subclassName: f.subclassName,
				subclassShortName: f.subclassShortName,
				subclassSource: f.subclassSource,
				featureType: "Class",
				description: description || "",
			});
		});

		// Add selected optional features (Fighting Style, etc.)
		for (const [featureKey, optFeatures] of Object.entries(selectedOptionalFeatures)) {
			for (const optFeat of optFeatures) {
				const description = optFeat.entries
					? Renderer.get().render({entries: optFeat.entries})
					: "";

				this._state.addFeature({
					name: optFeat.name,
					source: optFeat.source,
					level: 1,
					className: selectedClass.name,
					classSource: selectedClass.source,
					featureType: "Optional Feature",
					optionalFeatureTypes: optFeat.featureType,
					description,
				});
			}
		}

		// Add selected feature options
		for (const [featureKey, options] of Object.entries(selectedFeatureOptions)) {
			const [featureName] = featureKey.split("_");
			for (const option of options) {
				const description = option.entries
					? Renderer.get().render({entries: option.entries})
					: option.description || "";

				this._state.addFeature({
					name: option.name || `${featureName} Option`,
					source: option.source || selectedClass.source,
					level: 1,
					className: selectedClass.name,
					classSource: selectedClass.source,
					featureType: "Class",
					parentFeature: featureName,
					description,
				});

				// Apply any skill sub-choices for this specialty
				const choiceKey = `${featureKey}__${option.name}__${option.ref || ""}`;
				const skillSelections = this._selectedFeatureSkillChoices[choiceKey];
				if (skillSelections?.length) {
					const skillChoice = this._parseFeatureSkillChoice(option);
					if (skillChoice) {
						skillSelections.forEach(skill => {
							const skillKey = skill.toLowerCase().replace(/\s+/g, "");
							if (skillChoice.type === "proficiency") {
								this._state.setSkillProficiency(skillKey, 1);
							} else if (skillChoice.type === "expertise") {
								this._state.setSkillProficiency(skillKey, 2);
							} else if (skillChoice.type === "bonus") {
								this._state.addNamedModifier({
									name: `${option.name} (${skill})`,
									type: `skill:${skillKey}`,
									value: "proficiency",
									note: `From ${option.name}`,
									enabled: true,
								});
							}
						});
					}
				}
			}
		}

		// Add hit die (don't add first level HP for multiclass - only on level up)
		this._updateHitDice(selectedClass);

		// Add proficiencies from multiclass (armor/weapons)
		this._applyMulticlassProficiencies(selectedClass);

		// Add selected skill proficiencies
		if (selectedSkills && selectedSkills.length) {
			selectedSkills.forEach(skill => {
				this._state.addSkillProficiency(skill.toLowerCase().replace(/\s+/g, ""));
			});
		}

		// Recalculate spell slots for multiclass using the proper multiclass rules
		// This is important even if the new class isn't a caster - it updates
		// the spellcasting info display to show correct multiclass caster level
		this._state.calculateSpellSlots();

		await this._page.saveCharacter();
		this._page.renderCharacter();

		JqueryUtil.doToast({type: "success", content: `Added ${selectedClass.name} to your character!`});
	}

	_applyMulticlassProficiencies (classData) {
		// Simplified multiclass proficiency grants
		const multiclassProfs = {
			"Barbarian": {armor: ["Shields"], weapons: ["Simple weapons", "Martial weapons"]},
			"Bard": {armor: ["Light armor"], skills: 1},
			"Cleric": {armor: ["Light armor", "Medium armor", "Shields"]},
			"Druid": {armor: ["Light armor", "Medium armor", "Shields"]},
			"Fighter": {armor: ["Light armor", "Medium armor", "Shields"], weapons: ["Simple weapons", "Martial weapons"]},
			"Monk": {weapons: ["Simple weapons", "Shortswords"]},
			"Paladin": {armor: ["Light armor", "Medium armor", "Shields"], weapons: ["Simple weapons", "Martial weapons"]},
			"Ranger": {armor: ["Light armor", "Medium armor", "Shields"], weapons: ["Simple weapons", "Martial weapons"], skills: 1},
			"Rogue": {armor: ["Light armor"], skills: 1},
			"Sorcerer": {},
			"Warlock": {armor: ["Light armor"], weapons: ["Simple weapons"]},
			"Wizard": {},
		};

		const profs = multiclassProfs[classData.name] || {};

		if (profs.armor) {
			profs.armor.forEach(a => this._state.addArmorProficiency(a));
		}
		if (profs.weapons) {
			profs.weapons.forEach(w => this._state.addWeaponProficiency(w));
		}
		// Skills would need UI selection - skip for now
	}

	/**
	 * Process pending spell choices from a recently added feat
	 */
	async _processFeatSpellChoices () {
		if (!this._state.hasPendingSpellChoices()) return;

		// Give UI time to update before showing modal
		await MiscUtil.pDelay(100);

		if (this._page._spells) {
			await this._page._spells.processPendingSpellChoices();
		}
	}
}

// Export for use in other modules
export {CharacterSheetLevelUp};
globalThis.CharacterSheetLevelUp = CharacterSheetLevelUp;
