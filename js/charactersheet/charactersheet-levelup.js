/**
 * Character Sheet Level Up
 * Handles level up process including class features, ability score improvements, subclass selection
 */
class CharacterSheetLevelUp {
	constructor (page) {
		this._page = page;
		this._state = page.getState();
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
				sc.name === classEntry.subclass.name &&
				(sc.source === classEntry.subclass.source || !classEntry.subclass.source),
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
			title: `Level Up: ${classEntry.name} → Level ${newLevel}`,
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

		// Subclass selection
		if (needsSubclass) {
			const $subclassSection = this._renderSubclassSelection(classData, (subclass) => {
				selectedSubclass = subclass;
				// Update features to include subclass features and filter out placeholders
				currentFeatures = this._getLevelFeatures(classData, newLevel, subclass);
				updateFeaturesDisplay();
			});
			$content.append($subclassSection);
		}

		// ASI / Feat selection
		if (hasAsi) {
			const $asiSection = this._renderAsiSelection(
				(ability, delta) => {
					asiChoices[ability] = (asiChoices[ability] || 0) + delta;
				},
				(feat) => {
					selectedFeat = feat;
				},
			);
			$content.append($asiSection);
		}

		// Optional features (metamagic, invocations, maneuvers, etc.)
		const optionalFeatureGains = this._getOptionalFeatureGains(classData, classEntry.level, newLevel);
		if (optionalFeatureGains.length) {
			const $optSection = this._renderOptionalFeaturesSelection(classData, optionalFeatureGains, (featureType, features) => {
				selectedOptionalFeatures[featureType] = features;
			});
			$content.append($optSection);
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
				if (hasAsi && !selectedFeat) {
					const totalAsi = Object.values(asiChoices).reduce((sum, v) => sum + v, 0);
					if (totalAsi !== 2) {
						JqueryUtil.doToast({type: "warning", content: "Please allocate all ability score points (2 total)."});
						return;
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

				// Apply level up
				await this._applyLevelUp({
					classEntry,
					newLevel,
					asiChoices,
					selectedFeat,
					selectedSubclass,
					selectedOptionalFeatures,
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
					<span class="glyphicon glyphicon-book"></span> Choose ${classData.subclassTitle || "Subclass"}
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

	_renderAsiSelection (onAsiChange, onFeatSelect) {
		const $section = $(`
			<div class="charsheet__levelup-section">
				<h5 class="charsheet__levelup-section-title">
					<span class="glyphicon glyphicon-plus"></span> Ability Score Improvement
				</h5>
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
				<div id="asi-abilities-container"></div>
				<div id="asi-feats-container" style="display: none;"></div>
			</div>
		`);

		const $abilitiesContainer = $section.find("#asi-abilities-container");
		const $featsContainer = $section.find("#asi-feats-container");

		// Toggle between ASI and Feat
		$section.find('input[name="asi-type"]').on("change", (e) => {
			if (e.target.value === "asi") {
				$abilitiesContainer.show();
				$featsContainer.hide();
				onFeatSelect(null);
			} else {
				$abilitiesContainer.hide();
				$featsContainer.show();
			}
		});

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
				f.name.toLowerCase().includes(filter.toLowerCase())
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
					<span class="glyphicon glyphicon-star"></span> New Features
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
					<span class="glyphicon glyphicon-heart"></span> Hit Points
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
				// Parse feature reference - format is "FeatureName|ClassName|ClassSource|Level"
				if (typeof featureRef === "string") {
					const parts = featureRef.split("|");
					features.push({
						name: parts[0],
						className: parts[1] || classData.name,
						classSource: parts[2] || classData.source,
						source: parts[2] || classData.source,
						level: level,
						gainSubclassFeature: false,
					});
				} else if (typeof featureRef === "object" && featureRef.classFeature) {
					const parts = featureRef.classFeature.split("|");
					features.push({
						name: parts[0],
						className: parts[1] || classData.name,
						classSource: parts[2] || classData.source,
						source: parts[2] || classData.source,
						level: level,
						gainSubclassFeature: !!featureRef.gainSubclassFeature,
					});
				} else if (typeof featureRef === "object" && featureRef.name) {
					features.push({
						name: featureRef.name,
						className: classData.name,
						classSource: classData.source,
						source: featureRef.source || classData.source,
						level: level,
						gainSubclassFeature: !!featureRef.gainSubclassFeature,
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
			const existingOfType = existingOptFeatures.filter(f => 
				f.optionalFeatureTypes?.some(ft => featureTypes.includes(ft))
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
	 */
	_renderOptionalFeaturesSelection (classData, gains, onSelect) {
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
			const selectedForType = [];

			// Check if a feature is repeatable (can be taken multiple times)
			const isRepeatable = (opt) => {
				if (!opt.entries) return false;
				// Check for "Repeatable" entry in the feature
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

			// Filter options by feature type and prerequisites (but include already-taken ones)
			const allMatchingOptions = allOptFeatures.filter(opt => {
				// Check feature type match
				if (!opt.featureType?.some(ft => gain.featureTypes.includes(ft))) return false;

				// Check prerequisites
				if (opt.prerequisite) {
					for (const prereq of opt.prerequisite) {
						// Level prerequisite
						if (prereq.level) {
							const reqLevel = prereq.level.level || prereq.level;
							const classes = this._state.getClasses();
							const totalLevel = this._state.getTotalLevel();
							// Check if prereq is for specific class or general
							if (prereq.level.class) {
								const classMatch = classes.find(c => 
									c.name.toLowerCase() === prereq.level.class.name.toLowerCase()
								);
								if (!classMatch || classMatch.level < reqLevel) return false;
							} else if (totalLevel < reqLevel) {
								return false;
							}
						}
						// TODO: Could add more prerequisite checks (spells, pact boon, other features, etc.)
					}
				}

				return true;
			});

			// Mark options as already taken or available
			const availableOptions = allMatchingOptions.map(opt => {
				const alreadyHas = existingOptFeatures.some(
					existing => existing.name === opt.name && existing.source === opt.source,
				);
				const repeatable = isRepeatable(opt);
				return {
					...opt,
					_alreadyKnown: alreadyHas,
					_selectable: !alreadyHas || repeatable,
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
				// Sort: selectable first, then already known
				availableOptions.sort((a, b) => {
					if (a._selectable !== b._selectable) return a._selectable ? -1 : 1;
					return a.name.localeCompare(b.name);
				}).forEach(opt => {
					const isDisabled = !opt._selectable;
					const knownBadge = opt._alreadyKnown ? `<span class="badge badge-secondary ml-1" title="Already known">Known</span>` : "";
					const repeatableBadge = opt._alreadyKnown && opt._selectable ? `<span class="badge badge-info ml-1" title="Can be taken multiple times">Repeatable</span>` : "";
					
					const $item = $(`
						<label class="charsheet__levelup-opt-item d-block mb-1${isDisabled ? " charsheet__levelup-opt-item--disabled" : ""}" style="cursor: ${isDisabled ? "not-allowed" : "pointer"}; padding: 0.25rem; border-radius: 4px;${isDisabled ? " opacity: 0.6;" : ""}">
							<input type="checkbox" class="mr-2"${isDisabled ? " disabled" : ""}>
							<strong class="opt-name">${opt.name}</strong>
							${knownBadge}${repeatableBadge}
							<span class="ve-muted ve-small ml-1">(${Parser.sourceJsonToAbv(opt.source)})</span>
						</label>
					`);

					// Show description on name click
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

	async _applyLevelUp ({classEntry, newLevel, asiChoices, selectedFeat, selectedSubclass, selectedOptionalFeatures, newFeatures, hpMethod, classData}) {
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
				targetClass.subclass = selectedSubclass;
			}
		}

		// Apply ASI or feat
		if (selectedFeat) {
			this._state.addFeat(selectedFeat);
			// Apply feat bonuses if any
			this._applyFeatBonuses(selectedFeat);
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
				// featureKey is like "EI" or "MM" - the feature types joined
				const featureTypes = featureKey.split("_");
				opts.forEach(opt => {
					const featureData = {
						name: opt.name,
						source: opt.source,
						className: classEntry.name,
						classSource: classEntry.source,
						level: newLevel,
						featureType: "Optional Feature",
						optionalFeatureTypes: featureTypes, // Store which type for grouping
						description: opt.entries ? Renderer.get().render({entries: opt.entries}) : "",
						entries: opt.entries,
					};
					this._state.addFeature(featureData);
				});
			});
		}

		// Apply HP increase
		let hpIncrease = 0;
		const hitDie = this._getClassHitDie(classData);
		const conMod = this._state.getAbilityMod("con");

		if (hpMethod === "roll") {
			const roll = RollerUtil.roll(hitDie);
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
				description: feature.description || "",
			};
			this._state.addFeature(featureData);
		});

		// Update hit dice
		this._updateHitDice(classData);

		// Update class resources (Ki Points, Rage, etc.)
		this._updateClassResources(classEntry, newLevel, classData);

		// Update spell slots if applicable
		this._updateSpellSlots(classEntry, newLevel, classData);

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
		// Class resource definitions - same as in builder
		const resourceDefs = {
			"Barbarian": [{name: "Rage", maxByLevel: [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 999], recharge: "long"}],
			"Monk": [{name: "Ki Points", maxByLevel: level => level >= 2 ? level : 0, recharge: "short"}],
			"Sorcerer": [{name: "Sorcery Points", maxByLevel: level => level >= 2 ? level : 0, recharge: "long"}],
			"Fighter": [{name: "Second Wind", maxByLevel: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], recharge: "short"}],
			"Cleric": [{name: "Channel Divinity", maxByLevel: [0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], recharge: "short"}],
			"Paladin": [
				{name: "Lay on Hands", maxByLevel: level => level * 5, recharge: "long"},
				{name: "Channel Divinity", maxByLevel: [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], recharge: "short"},
			],
			"Bard": [{name: "Bardic Inspiration", maxByLevel: () => Math.max(1, this._state.getAbilityMod("cha")), recharge: "short"}],
			"Druid": [{name: "Wild Shape", maxByLevel: [0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], recharge: "short"}],
		};

		const classResourceDefs = resourceDefs[classData.name];
		if (!classResourceDefs) return;

		const currentResources = this._state.getResources();

		classResourceDefs.forEach(resourceDef => {
			let newMax;
			if (typeof resourceDef.maxByLevel === "function") {
				newMax = resourceDef.maxByLevel(newLevel);
			} else if (Array.isArray(resourceDef.maxByLevel)) {
				newMax = resourceDef.maxByLevel[newLevel - 1] || 0;
			} else {
				newMax = resourceDef.maxByLevel;
			}

			// Find existing resource
			const existingResource = currentResources.find(r => r.name === resourceDef.name);

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
					name: resourceDef.name,
					max: newMax,
					current: newMax,
					recharge: resourceDef.recharge,
				});
			}
		});
	}

	_updateSpellSlots (classEntry, newLevel, classData) {
		// Check if class is a spellcaster
		const spellcastingAbility = this._getSpellcastingAbility(classData);
		if (!spellcastingAbility) return;

		// Get spell slot progression based on class type
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
	 * Add multiclass to character
	 */
	async showMulticlass () {
		const classes = this._page.getClasses();
		const currentClasses = this._state.getClasses().map(c => c.name);

		// Filter out classes character already has
		const availableClasses = classes.filter(c => !currentClasses.includes(c.name));

		if (!availableClasses.length) {
			JqueryUtil.doToast({type: "warning", content: "No additional classes available."});
			return;
		}

		// Check multiclass prerequisites (simplified)
		const totalLevel = this._state.getTotalLevel();
		if (totalLevel >= 20) {
			JqueryUtil.doToast({type: "warning", content: "Character has reached maximum total level (20)."});
			return;
		}

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "Add New Class (Multiclass)",
			isMinHeight0: true,
			isWidth100: true,
		});

		let selectedClass = null;

		const $search = $(`<input type="text" class="form-control" placeholder="Filter...">`);
		const $list = $(`<div class="charsheet__picker-list"></div>`);

		const renderList = (filter = "") => {
			$list.empty();

			const filtered = availableClasses.filter(c => 
				c.name.toLowerCase().includes(filter.toLowerCase())
			);

			filtered.forEach(cls => {
				const $item = $$`
					<div class="charsheet__picker-item">
						<strong>${cls.name}</strong>
						<span class="ve-muted">(${Parser.sourceJsonToAbv(cls.source)})</span>
					</div>
				`;

				$item.on("click", () => {
					$list.find(".charsheet__picker-item").removeClass("selected");
					$item.addClass("selected");
					selectedClass = cls;
					$btnConfirm.prop("disabled", false);
				});

				$list.append($item);
			});
		};

		$search.on("input", (e) => renderList(e.target.value));
		renderList();

		$$`<div>
			<div class="alert alert-info">
				<strong>Note:</strong> Multiclassing has ability score prerequisites. 
				Make sure your character meets the requirements.
			</div>
			<div class="form-group">
				<label>Search Classes</label>
				${$search}
			</div>
			${$list}
		</div>`.appendTo($modalInner);

		// Footer buttons
		const $btnCancel = $(`<button class="ve-btn ve-btn-default">Cancel</button>`)
			.on("click", () => doClose(false));
		const $btnConfirm = $(`<button class="ve-btn ve-btn-primary" disabled>Add Class</button>`)
			.on("click", async () => {
				if (!selectedClass) return;

				// Add class at level 1
				this._state.addClass({
					name: selectedClass.name,
					source: selectedClass.source,
					level: 1,
					subclass: null,
				});

				// Get first level features
				const features = this._getLevelFeatures(selectedClass, 1);
				features.forEach(f => {
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
						description: "",
					});
				});

				// Add hit die (don't add first level HP for multiclass - only on level up)
				this._updateHitDice(selectedClass);

				// Add proficiencies from multiclass
				this._applyMulticlassProficiencies(selectedClass);

				await this._page.saveCharacter();
				this._page.renderCharacter();

				doClose(true);
				JqueryUtil.doToast({type: "success", content: `Added ${selectedClass.name} to your character!`});
			});

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			${$btnCancel}
			${$btnConfirm}
		</div>`.appendTo($modalInner);
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
}

// Export for use in other modules
export {CharacterSheetLevelUp};
globalThis.CharacterSheetLevelUp = CharacterSheetLevelUp;
