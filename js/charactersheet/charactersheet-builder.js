/**
 * Character Sheet Builder
 * Step-by-step character creation wizard
 */
class CharacterSheetBuilder {
	constructor (page) {
		this._page = page;
		this._state = page.getState();
		this._currentStep = 1;
		this._maxSteps = 6;

		this._selectedRace = null;
		this._selectedSubrace = null;
		this._selectedClass = null;
		this._selectedSubclass = null;
		this._selectedBackground = null;
		this._abilityMethod = "standard";
		this._abilityScores = {str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10};
		this._pointBuyRemaining = 27;
		this._selectedSkills = []; // For class skill proficiency choices
		this._selectedAbilityBonuses = {}; // For background ASI choices
		this._selectedOptionalFeatures = {}; // For class optional features like invocations {featureType: [features]}

		this._init();
	}

	// Helper to detect if content is from 2024 edition (D&D One)
	_is2024Edition (entity) {
		if (!entity) return false;
		// 2024 content has "edition": "one" or source "XPHB"
		return entity.edition === "one" || entity.source === "XPHB";
	}

	// Check if race uses 2024 ASI rules (ASI comes from background, not race)
	_raceUses2024ASI () {
		if (!this._selectedRace) return false;
		// 2024 species have no "ability" property - ASI moved to background
		return this._is2024Edition(this._selectedRace) || !this._selectedRace.ability;
	}

	// Check if background provides ASI (2024 backgrounds)
	_backgroundProvidesASI () {
		if (!this._selectedBackground) return false;
		return !!(this._selectedBackground.ability && this._selectedBackground.ability.length);
	}

	_init () {
		this._initStepClickHandlers();
		this._initNavButtons();
		this._renderCurrentStep();
	}

	_initStepClickHandlers () {
		$(".charsheet__builder-step").on("click", (e) => {
			const step = parseInt($(e.currentTarget).data("step"));
			if (step <= this._currentStep) {
				this._goToStep(step);
			}
		});
	}

	_initNavButtons () {
		$("#charsheet-builder-prev").on("click", () => this._prevStep());
		$("#charsheet-builder-next").on("click", () => this._nextStep());
	}

	_updateStepIndicators () {
		$(".charsheet__builder-step").each((i, el) => {
			const $step = $(el);
			const stepNum = parseInt($step.data("step"));

			$step.removeClass("active completed");

			if (stepNum === this._currentStep) {
				$step.addClass("active");
			} else if (stepNum < this._currentStep) {
				$step.addClass("completed");
			}
		});

		// Update nav buttons
		$("#charsheet-builder-prev").prop("disabled", this._currentStep <= 1);
		const $nextBtn = $("#charsheet-builder-next");

		if (this._currentStep >= this._maxSteps) {
			$nextBtn.html(`<span class="glyphicon glyphicon-ok"></span> Finish`);
		} else {
			$nextBtn.html(`Next <span class="glyphicon glyphicon-chevron-right"></span>`);
		}
	}

	_goToStep (step) {
		this._currentStep = step;
		this._updateStepIndicators();
		this._renderCurrentStep();
	}

	_prevStep () {
		if (this._currentStep > 1) {
			this._goToStep(this._currentStep - 1);
		}
	}

	async _nextStep () {
		// Validate current step before proceeding
		if (!this._validateCurrentStep()) return;

		// Apply current step's choices
		this._applyCurrentStep();

		if (this._currentStep >= this._maxSteps) {
			// Finish character creation
			await this._finishCharacter();
		} else {
			this._goToStep(this._currentStep + 1);
		}
	}

	_validateCurrentStep () {
		switch (this._currentStep) {
			case 1: // Race
				if (!this._selectedRace) {
					JqueryUtil.doToast({type: "warning", content: "Please select a species."});
					return false;
				}
				return true;

			case 2: // Class
				if (!this._selectedClass) {
					JqueryUtil.doToast({type: "warning", content: "Please select a class."});
					return false;
				}
				// Validate skill selection if class has skill choices
				if (this._selectedClass.startingProficiencies?.skills) {
					const skillChoices = this._selectedClass.startingProficiencies.skills;
					let requiredCount = 2;
					skillChoices.forEach(sc => {
						if (sc.choose?.count) requiredCount = sc.choose.count;
					});
					if (this._selectedSkills.length < requiredCount) {
						JqueryUtil.doToast({type: "warning", content: `Please select ${requiredCount} skills for your class.`});
						return false;
					}
				}
				return true;

			case 3: // Abilities
				if (this._abilityMethod === "pointbuy" && this._pointBuyRemaining !== 0) {
					JqueryUtil.doToast({type: "warning", content: "Please spend all ability score points."});
					return false;
				}
				return true;

			case 4: // Background
				if (!this._selectedBackground) {
					JqueryUtil.doToast({type: "warning", content: "Please select a background."});
					return false;
				}
				return true;

			default:
				return true;
		}
	}

	_applyCurrentStep () {
		switch (this._currentStep) {
			case 1: // Race
				this._state.setRace(this._selectedRace, this._selectedSubrace);
				this._applyRacialTraits();
				break;

			case 2: // Class
				this._state.addClass({
					name: this._selectedClass.name,
					source: this._selectedClass.source,
					level: 1,
					subclass: this._selectedSubclass,
				});
				this._applyClassFeatures();
				break;

			case 3: // Abilities
				Parser.ABIL_ABVS.forEach(abl => {
					const score = this._abilityScores[abl];
					if (score != null) {
						this._state.setAbilityBase(abl, score);
					}
				});
				break;

			case 4: // Background
				this._state.setBackground(this._selectedBackground);
				this._applyBackgroundFeatures();
				break;

			case 5: // Equipment
				this._applyEquipmentChoices();
				break;

			case 6: // Details
				// Details are saved directly in the details step
				break;
		}

		this._page.renderCharacter();
	}

	_applyEquipmentChoices () {
		if (!this._selectedClass?.startingEquipment) return;

		const startingEquip = this._selectedClass.startingEquipment;
		const defaultData = startingEquip.defaultData || [];

		// Check if this is 2024 format (uppercase keys like A, B, C)
		const is2024Format = defaultData.length > 0 && defaultData[0] && 
			Object.keys(defaultData[0]).some(k => /^[A-Z]$/.test(k));

		if (is2024Format) {
			this._apply2024EquipmentChoices(startingEquip);
		} else {
			this._applyClassicEquipmentChoices(startingEquip);
		}
	}

	_apply2024EquipmentChoices (startingEquip) {
		const defaultData = startingEquip.defaultData || [];
		if (!defaultData.length) return;

		const choiceData = defaultData[0];
		const selectedKey = this._equipmentChoices["2024"] || Object.keys(choiceData).filter(k => /^[A-Z]$/.test(k))[0];
		const items = choiceData[selectedKey] || [];

		const allItems = this._page.getItems();

		items.forEach(itemEntry => {
			if (itemEntry.item) {
				// Item with optional quantity
				const [name, source] = itemEntry.item.split("|");
				const item = allItems.find(i =>
					i.name.toLowerCase() === name.toLowerCase() &&
					(!source || i.source?.toLowerCase() === source.toLowerCase()),
				);
				if (item) {
					this._state.addItem(item, itemEntry.quantity || 1);
				}
			} else if (itemEntry.value) {
				// Gold value in copper pieces
				const gp = Math.floor(itemEntry.value / 100);
				this._state.setCurrency("gp", (this._state.getCurrency("gp") || 0) + gp);
			} else if (itemEntry.special) {
				// Special items like "Spellbook" - try to find in items list
				const item = allItems.find(i => i.name.toLowerCase() === itemEntry.special.toLowerCase());
				if (item) {
					this._state.addItem(item, 1);
				}
			}
		});
	}

	_applyClassicEquipmentChoices (startingEquip) {
		// If using gold alternative, add gold instead
		if (this._useGoldAlternative && startingEquip.goldAlternative) {
			// Parse gold amount from string like "{@dice 5d4 × 10|5d4 × 10|Starting Gold}"
			// For simplicity, use average value
			const goldMatch = startingEquip.goldAlternative.match(/(\d+)d(\d+)\s*[×x*]\s*(\d+)/i);
			if (goldMatch) {
				const numDice = parseInt(goldMatch[1]);
				const dieFaces = parseInt(goldMatch[2]);
				const multiplier = parseInt(goldMatch[3]);
				const avgRoll = numDice * (dieFaces + 1) / 2;
				const gold = Math.floor(avgRoll * multiplier);
				this._state.setCurrency("gp", (this._state.getCurrency("gp") || 0) + gold);
			}
			return;
		}

		const defaultData = startingEquip.defaultData || [];

		defaultData.forEach((choiceSet, idx) => {
			const selectedKey = this._equipmentChoices?.[idx] || Object.keys(choiceSet).filter(k => k !== "_")[0] || "_";
			const items = choiceSet[selectedKey] || choiceSet._ || [];

			this._addEquipmentItems(items);
		});
	}

	_addEquipmentItems (items) {
		if (!Array.isArray(items)) return;

		const allItems = this._page.getItems();

		items.forEach(itemEntry => {
			if (typeof itemEntry === "string") {
				// Direct item reference like "chain mail|phb"
				const [name, source] = itemEntry.split("|");
				const item = allItems.find(i =>
					i.name.toLowerCase() === name.toLowerCase() &&
					(!source || i.source?.toLowerCase() === source.toLowerCase()),
				);
				if (item) {
					this._state.addItem(item, 1);
				}
			} else if (itemEntry.item) {
				// Item with quantity
				const [name, source] = itemEntry.item.split("|");
				const item = allItems.find(i =>
					i.name.toLowerCase() === name.toLowerCase() &&
					(!source || i.source?.toLowerCase() === source.toLowerCase()),
				);
				if (item) {
					this._state.addItem(item, itemEntry.quantity || 1);
				}
			} else if (itemEntry.equipmentType) {
				// Generic equipment type - user would need to choose
				// For now, we'll skip these and let user add manually
				// In a full implementation, this would show a picker
			}
		});
	}

	_applyRacialTraits () {
		if (!this._selectedRace) return;

		// Speed
		if (this._selectedRace.speed) {
			if (typeof this._selectedRace.speed === "number") {
				this._state.setSpeed("walk", this._selectedRace.speed);
			} else {
				if (this._selectedRace.speed.walk) this._state.setSpeed("walk", this._selectedRace.speed.walk);
				if (this._selectedRace.speed.fly) this._state.setSpeed("fly", this._selectedRace.speed.fly);
				if (this._selectedRace.speed.swim) this._state.setSpeed("swim", this._selectedRace.speed.swim);
				if (this._selectedRace.speed.climb) this._state.setSpeed("climb", this._selectedRace.speed.climb);
			}
		}

		// Ability score bonuses
		if (this._selectedRace.ability) {
			this._selectedRace.ability.forEach(abiSet => {
				Object.entries(abiSet).forEach(([abi, bonus]) => {
					if (Parser.ABIL_ABVS.includes(abi)) {
						this._state.setAbilityBonus(abi, bonus);
					}
				});
			});
		}

		// Subrace bonuses
		if (this._selectedSubrace?.ability) {
			this._selectedSubrace.ability.forEach(abiSet => {
				Object.entries(abiSet).forEach(([abi, bonus]) => {
					if (Parser.ABIL_ABVS.includes(abi)) {
						const current = this._state.getAbilityBonus(abi);
						this._state.setAbilityBonus(abi, current + bonus);
					}
				});
			});
		}

		// Languages
		if (this._selectedRace.languageProficiencies) {
			this._selectedRace.languageProficiencies.forEach(langProf => {
				Object.keys(langProf).forEach(lang => {
					if (lang !== "anyStandard" && lang !== "any") {
						this._state.addLanguage(lang.toTitleCase());
					}
				});
			});
		}

		// Resistances
		if (this._selectedRace.resist) {
			this._selectedRace.resist.forEach(r => {
				if (typeof r === "string") this._state.addResistance(r);
			});
		}

		// Darkvision and other senses are stored as features
		if (this._selectedRace.darkvision) {
			this._state.addFeature({
				name: "Darkvision",
				source: this._selectedRace.source,
				description: `You can see in dim light within ${this._selectedRace.darkvision} feet of you as if it were bright light, and in darkness as if it were dim light.`,
				featureType: "Species",
			});
		}

		// Add racial features
		if (this._selectedRace.entries) {
			this._addFeatureEntries(this._selectedRace.entries, this._selectedRace.source, "Species");
		}

		if (this._selectedSubrace?.entries) {
			this._addFeatureEntries(this._selectedSubrace.entries, this._selectedSubrace.source, "Subrace");
		}
	}

	_applyClassFeatures () {
		if (!this._selectedClass) return;

		// Hit die type is implicit in state calculation

		// Saving throw proficiencies
		if (this._selectedClass.proficiency) {
			this._selectedClass.proficiency.forEach(prof => {
				if (Parser.ABIL_ABVS.includes(prof)) {
					this._state.addSaveProficiency(prof);
				}
			});
		}

		// Skill proficiencies (from user selection)
		if (this._selectedSkills.length) {
			this._selectedSkills.forEach(skill => {
				const skillKey = skill.toLowerCase().replace(/\s+/g, "");
				this._state.setSkillProficiency(skillKey, 1);
			});
		}

		// Armor proficiencies
		if (this._selectedClass.startingProficiencies?.armor) {
			this._selectedClass.startingProficiencies.armor.forEach(armor => {
				if (typeof armor === "string") {
					this._state.addArmorProficiency(armor);
				} else if (armor.full) {
					this._state.addArmorProficiency(armor.full);
				}
			});
		}

		// Weapon proficiencies
		if (this._selectedClass.startingProficiencies?.weapons) {
			this._selectedClass.startingProficiencies.weapons.forEach(weapon => {
				if (typeof weapon === "string") {
					this._state.addWeaponProficiency(weapon);
				} else if (weapon.full) {
					this._state.addWeaponProficiency(weapon.full);
				}
			});
		}

		// Tool proficiencies
		if (this._selectedClass.startingProficiencies?.tools) {
			this._selectedClass.startingProficiencies.tools.forEach(tool => {
				if (typeof tool === "string") {
					// Extract tool name from {@item} tags if present and normalize
					const toolName = tool.replace(/{@item\s+([^|}]+)[^}]*}/gi, "$1").toTitleCase();
					this._state.addToolProficiency(toolName);
				}
			});
		}

		// Spellcasting
		if (this._selectedClass.spellcastingAbility) {
			this._state.setSpellcastingAbility(this._selectedClass.spellcastingAbility);

			// Set initial spell slots for level 1
			const slots = this._getSpellSlotsForLevel(this._selectedClass.name, 1);
			Object.entries(slots).forEach(([level, count]) => {
				this._state.setSpellSlots(parseInt(level), count, count);
			});
		}

		// Add level 1 class features
		// classFeatures can be:
		// 1. An array of arrays - index 0 = level 1 features, index 1 = level 2 features, etc.
		// 2. An array of strings/objects directly for level 1 features
		if (this._selectedClass.classFeatures && this._selectedClass.classFeatures.length > 0) {
			// Get features at index 0 (level 1)
			let level1Features = this._selectedClass.classFeatures[0];
			
			// If the first element is not an array, the classFeatures array itself contains the features
			// (happens with some class formats where classFeatures is flat)
			if (level1Features && !Array.isArray(level1Features)) {
				// Check if this is a string/object feature entry rather than an array of features
				// In this case, filter for level 1 features from the flat array
				level1Features = this._selectedClass.classFeatures.filter(f => {
					if (typeof f === "string") {
						const parts = f.split("|");
						return parts[3] === "1" || parts.length < 4; // Level 1 or no level specified
					} else if (typeof f === "object" && f.classFeature) {
						const parts = f.classFeature.split("|");
						return parts[3] === "1" || parts.length < 4;
					} else if (typeof f === "object" && f.level !== undefined) {
						return f.level === 1;
					}
					return true; // Include if we can't determine level
				});
			}
			
			level1Features = level1Features || [];
			console.log("[CharSheet Builder] Level 1 features (from index 0):", level1Features);

			// Check if we have a subclass selected - if so, we'll filter out features with gainSubclassFeature
			const hasSubclass = !!this._selectedSubclass;

			level1Features.forEach(f => {
				let featureName, featureSource;
				let hasGainSubclassFeature = false;

				if (typeof f === "string") {
					// Format: "Feature Name|ClassName|ClassSource|Level"
					const parts = f.split("|");
					featureName = parts[0];
					featureSource = parts[2] || this._selectedClass.source;
				} else if (typeof f === "object" && f.classFeature) {
					// Format: {classFeature: "Feature Name|ClassName|ClassSource|Level", gainSubclassFeature: true}
					const parts = f.classFeature.split("|");
					featureName = parts[0];
					featureSource = parts[2] || this._selectedClass.source;
					hasGainSubclassFeature = !!f.gainSubclassFeature;
				} else if (typeof f === "object" && f.name) {
					featureName = f.name;
					featureSource = f.source || this._selectedClass.source;
					hasGainSubclassFeature = !!f.gainSubclassFeature;
				} else {
					console.log("[CharSheet Builder] Unknown feature format:", f);
					return;
				}

				// Skip features with gainSubclassFeature if we have an actual subclass selected
				// These are placeholder features like "Bard Subclass", "Subclass Feature", etc.
				if (hasSubclass && hasGainSubclassFeature) {
					console.log("[CharSheet Builder] Skipping gainSubclassFeature placeholder:", featureName);
					return;
				}

				// Look up full feature data to get description
				const fullFeatureData = this._getClassFeatureData(featureName, this._selectedClass.name, featureSource, 1);
				const description = fullFeatureData?.entries
					? Renderer.get().render({entries: fullFeatureData.entries})
					: "";

				const featureToAdd = {
					name: featureName,
					source: featureSource || this._selectedClass.source,
					level: 1,
					className: this._selectedClass.name,
					classSource: this._selectedClass.source,
					featureType: "Class",
					description,
				};
				console.log("[CharSheet Builder] Adding feature:", featureToAdd);
				this._state.addFeature(featureToAdd);
			});
		} else {
			console.log("[CharSheet Builder] No classFeatures found on selected class:", this._selectedClass);
		}

		// Add level 1 subclass features if a subclass is selected
		// NOTE: After DataLoader processing, subclassFeatures is an array-of-arrays where each inner array
		// contains feature OBJECTS (with level, name, entries properties), not strings
		if (this._selectedSubclass && this._selectedSubclass.subclassFeatures) {
			this._selectedSubclass.subclassFeatures.forEach(levelFeatures => {
				// levelFeatures is an array of feature objects for a specific level
				if (Array.isArray(levelFeatures)) {
					levelFeatures.forEach(feature => {
						// Feature is an object with level, name, entries, source, etc.
						if (typeof feature === "object" && feature.level === 1) {
							const featureName = feature.name || Renderer.findName(feature);
							if (featureName) {
								// Render the description from entries
								const description = feature.entries
									? Renderer.get().render({entries: feature.entries})
									: "";

								const featureToAdd = {
									name: featureName,
									source: feature.source || this._selectedSubclass.source || this._selectedClass.source,
									level: 1,
									className: this._selectedClass.name,
									classSource: this._selectedClass.source,
									subclassName: this._selectedSubclass.name,
									subclassShortName: feature.subclassShortName || this._selectedSubclass.shortName,
									subclassSource: feature.subclassSource || this._selectedSubclass.source,
									featureType: "Class",
									isSubclassFeature: true,
									description,
								};
								console.log("[CharSheet Builder] Adding subclass feature:", featureToAdd);
								this._state.addFeature(featureToAdd);
							}
						} else if (typeof feature === "string") {
							// Fallback for raw string format - look up description from subclass features data
							const parts = feature.split("|");
							const featureLevel = parseInt(parts[parts.length - 1]);
							if (featureLevel === 1) {
								const fullFeatureData = this._getSubclassFeatureData(
									parts[0],
									this._selectedClass.name,
									parts[3] || this._selectedSubclass.shortName,
									parts[4] || this._selectedSubclass.source,
									1,
								);
								const description = fullFeatureData?.entries
									? Renderer.get().render({entries: fullFeatureData.entries})
									: "";

								const featureToAdd = {
									name: parts[0],
									source: parts[4] || this._selectedSubclass.source || this._selectedClass.source,
									level: 1,
									className: this._selectedClass.name,
									classSource: this._selectedClass.source,
									subclassName: this._selectedSubclass.name,
									subclassShortName: parts[3] || this._selectedSubclass.shortName,
									subclassSource: parts[4] || this._selectedSubclass.source,
									featureType: "Class",
									isSubclassFeature: true,
									description,
								};
								console.log("[CharSheet Builder] Adding subclass feature:", featureToAdd);
								this._state.addFeature(featureToAdd);
							}
						}
					});
				} else if (typeof levelFeatures === "string") {
					// Raw string format (pre-DataLoader format)
					const parts = levelFeatures.split("|");
					const featureLevel = parseInt(parts[parts.length - 1]);
					if (featureLevel === 1) {
						const fullFeatureData = this._getSubclassFeatureData(
							parts[0],
							this._selectedClass.name,
							parts[3] || this._selectedSubclass.shortName,
							parts[4] || this._selectedSubclass.source,
							1,
						);
						const description = fullFeatureData?.entries
							? Renderer.get().render({entries: fullFeatureData.entries})
							: "";

						const featureToAdd = {
							name: parts[0],
							source: parts[4] || this._selectedSubclass.source || this._selectedClass.source,
							level: 1,
							className: this._selectedClass.name,
							classSource: this._selectedClass.source,
							subclassName: this._selectedSubclass.name,
							subclassShortName: parts[3] || this._selectedSubclass.shortName,
							subclassSource: parts[4] || this._selectedSubclass.source,
							featureType: "Class",
							isSubclassFeature: true,
							description,
						};
						console.log("[CharSheet Builder] Adding subclass feature:", featureToAdd);
						this._state.addFeature(featureToAdd);
					}
				}
			});
		}

		// Add class resources (like Rage, Ki, etc.)
		this._addClassResources(this._selectedClass, 1);

		// Apply selected optional features (invocations, metamagic, etc.)
		this._applySelectedOptionalFeatures();
	}

	_applySelectedOptionalFeatures () {
		if (!this._selectedOptionalFeatures) return;

		Object.entries(this._selectedOptionalFeatures).forEach(([featureKey, features]) => {
			features.forEach(opt => {
				this._state.addFeature({
					name: opt.name,
					source: opt.source,
					level: 1,
					className: this._selectedClass?.name,
					classSource: this._selectedClass?.source,
					featureType: "Optional Feature",
					entries: opt.entries,
					description: Renderer.get().render({entries: opt.entries || []}),
				});
			});
		});
	}

	_applyBackgroundFeatures () {
		if (!this._selectedBackground) return;

		// Ability Score Increases (2024 backgrounds)
		// First clear any previous background bonuses
		["str", "dex", "con", "int", "wis", "cha"].forEach(abi => {
			// We can track background bonuses separately or add to existing
			// Here we add to any racial bonuses
		});

		// Apply selected ability bonuses from 2024 background
		if (this._selectedAbilityBonuses) {
			Object.entries(this._selectedAbilityBonuses).forEach(([key, value]) => {
				if (key.startsWith("bg_") && !key.includes("weight") && value) {
					const weightKey = `${key}_weight`;
					const bonus = this._selectedAbilityBonuses[weightKey] || 0;
					if (bonus && Parser.ABIL_ABVS.includes(value)) {
						const current = this._state.getAbilityBonus(value);
						this._state.setAbilityBonus(value, current + bonus);
					}
				}
			});
		}

		// Skill proficiencies
		if (this._selectedBackground.skillProficiencies) {
			this._selectedBackground.skillProficiencies.forEach(skillSet => {
				Object.keys(skillSet).forEach(skill => {
					if (skill !== "choose" && skill !== "any") {
						const skillKey = skill.toLowerCase().replace(/\s+/g, "");
						this._state.setSkillProficiency(skillKey, 1);
					}
				});
			});
		}

		// Tool proficiencies
		if (this._selectedBackground.toolProficiencies) {
			this._selectedBackground.toolProficiencies.forEach(toolSet => {
				Object.keys(toolSet).forEach(tool => {
					if (tool !== "choose" && tool !== "any") {
						this._state.addToolProficiency(tool.toTitleCase());
					}
				});
			});
		}

		// Languages
		if (this._selectedBackground.languageProficiencies) {
			this._selectedBackground.languageProficiencies.forEach(langSet => {
				Object.keys(langSet).forEach(lang => {
					if (lang !== "anyStandard" && lang !== "any") {
						this._state.addLanguage(lang.toTitleCase());
					}
				});
			});
		}

		// Background feature
		if (this._selectedBackground.entries) {
			this._addFeatureEntries(this._selectedBackground.entries, this._selectedBackground.source, "Background");
		}
	}

	_addFeatureEntries (entries, source, featureType) {
		entries.forEach(entry => {
			if (typeof entry === "object" && entry.name) {
				this._state.addFeature({
					name: entry.name,
					source,
					description: entry.entries ? Renderer.get().render({entries: entry.entries}) : "",
					featureType,
				});
			}
		});
	}

	/**
	 * Look up full class feature data to get description/entries
	 */
	_getClassFeatureData (featureName, className, source, level) {
		const classFeatures = this._page.getClassFeatures();
		if (!classFeatures?.length) {
			console.log("[CharSheet Builder] No class features available for lookup");
			return null;
		}

		// Class features can have different property combinations depending on source
		const result = classFeatures.find(f => {
			if (f.name !== featureName) return false;
			if (f.className !== className) return false;
			if (f.level !== level) return false;
			// Be more flexible with source matching
			if (source && f.source && f.source !== source) {
				// Allow XPHB/PHB/SRD flexibility
				const sourcesMatch = [Parser.SRC_PHB, Parser.SRC_XPHB, "SRD"].includes(source) &&
					[Parser.SRC_PHB, Parser.SRC_XPHB, "SRD"].includes(f.source);
				if (!sourcesMatch) return false;
			}
			return true;
		});

		if (!result && featureName) {
			console.log(`[CharSheet Builder] Could not find class feature: ${featureName} for ${className} level ${level} (source: ${source})`);
		}
		return result;
	}

	/**
	 * Look up full subclass feature data to get description/entries
	 */
	_getSubclassFeatureData (featureName, className, subclassShortName, source, level) {
		const subclassFeatures = this._page.getSubclassFeatures();
		if (!subclassFeatures?.length) {
			console.log("[CharSheet Builder] No subclass features available for lookup");
			return null;
		}

		const result = subclassFeatures.find(f => {
			if (f.name !== featureName) return false;
			if (f.className !== className) return false;
			if (f.subclassShortName !== subclassShortName) return false;
			if (f.level !== level) return false;
			// Be more flexible with source matching
			if (source && f.source && f.source !== source) {
				const sourcesMatch = [Parser.SRC_PHB, Parser.SRC_XPHB, "SRD"].includes(source) &&
					[Parser.SRC_PHB, Parser.SRC_XPHB, "SRD"].includes(f.source);
				if (!sourcesMatch) return false;
			}
			return true;
		});

		if (!result && featureName) {
			console.log(`[CharSheet Builder] Could not find subclass feature: ${featureName} for ${className}/${subclassShortName} level ${level}`);
		}
		return result;
	}

	_addClassResources (cls, level) {
		// Add class-specific resources based on class and level
		const resources = {
			"Barbarian": [{name: "Rage", maxByLevel: [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 999], recharge: "long"}],
			"Monk": [{name: "Ki Points", maxByLevel: level => level >= 2 ? level : 0, recharge: "short"}],
			"Sorcerer": [{name: "Sorcery Points", maxByLevel: level => level >= 2 ? level : 0, recharge: "long"}],
			"Fighter": [{name: "Second Wind", maxByLevel: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], recharge: "short"}],
			"Cleric": [{name: "Channel Divinity", maxByLevel: [0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], recharge: "short"}],
			"Paladin": [{name: "Lay on Hands", maxByLevel: level => level * 5, recharge: "long"}, {name: "Channel Divinity", maxByLevel: [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], recharge: "short"}],
			"Bard": [{name: "Bardic Inspiration", maxByLevel: level => Math.max(1, this._state.getAbilityMod("cha")), recharge: level >= 5 ? "short" : "long"}],
			"Druid": [{name: "Wild Shape", maxByLevel: [0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], recharge: "short"}],
		};

		const classResources = resources[cls.name];
		if (classResources) {
			classResources.forEach(resource => {
				let max;
				if (typeof resource.maxByLevel === "function") {
					max = resource.maxByLevel(level);
				} else if (Array.isArray(resource.maxByLevel)) {
					max = resource.maxByLevel[level - 1] || 0;
				} else {
					max = resource.maxByLevel;
				}

				if (max > 0) {
					this._state.addResource({
						name: resource.name,
						max,
						recharge: resource.recharge,
					});
				}
			});
		}
	}

	_getSpellSlotsForLevel (className, level) {
		// Full casters
		const fullCasterSlots = {
			1: {1: 2},
			2: {1: 3},
			3: {1: 4, 2: 2},
			4: {1: 4, 2: 3},
			5: {1: 4, 2: 3, 3: 2},
			// ... continues
		};

		// Half casters
		const halfCasterSlots = {
			2: {1: 2},
			3: {1: 3},
			4: {1: 3},
			5: {1: 4, 2: 2},
			// ... continues
		};

		const fullCasters = ["Bard", "Cleric", "Druid", "Sorcerer", "Wizard"];
		const halfCasters = ["Paladin", "Ranger", "Artificer"];

		if (fullCasters.includes(className)) {
			return fullCasterSlots[level] || {};
		} else if (halfCasters.includes(className)) {
			return halfCasterSlots[level] || {};
		}

		return {};
	}

	async _finishCharacter () {
		// Save the character
		await this._page.saveCharacter();

		// Switch to overview tab
		this._page.switchToTab("#charsheet-tab-overview");

		JqueryUtil.doToast({type: "success", content: "Character created successfully!"});
	}

	_renderCurrentStep () {
		const $content = $("#charsheet-builder-content");
		$content.empty();

		switch (this._currentStep) {
			case 1:
				this._renderRaceStep($content);
				break;
			case 2:
				this._renderClassStep($content);
				break;
			case 3:
				this._renderAbilitiesStep($content);
				break;
			case 4:
				this._renderBackgroundStep($content);
				break;
			case 5:
				this._renderEquipmentStep($content);
				break;
			case 6:
				this._renderDetailsStep($content);
				break;
		}
	}

	// #region Step 1: Race
	_renderRaceStep ($content) {
		// Get races filtered by allowed sources
		const races = this._page.filterByAllowedSources(this._page.getRaces());

		const $container = $(`
			<div class="charsheet__builder-selection">
				<div class="charsheet__builder-list">
					<div class="charsheet__builder-list-header">
						<input type="text" class="form-control form-control--minimal" placeholder="Search species..." id="builder-race-search">
					</div>
					<div class="charsheet__builder-list-content" id="builder-race-list"></div>
				</div>
				<div class="charsheet__builder-preview" id="builder-race-preview">
					<div class="charsheet__builder-preview-placeholder">Select a species to see details</div>
				</div>
			</div>
		`);

		$content.append($container);

		const $list = $("#builder-race-list");
		const $preview = $("#builder-race-preview");
		const $search = $("#builder-race-search");

		// Populate race list
		const renderRaceList = (filter = "") => {
			$list.empty();
			const filterLower = filter.toLowerCase();

			races
				.filter(race => !filter || race.name.toLowerCase().includes(filterLower))
				.sort((a, b) => a.name.localeCompare(b.name))
				.forEach(race => {
					const isSelected = this._selectedRace?.name === race.name && this._selectedRace?.source === race.source;
					const $item = $(`
						<div class="charsheet__builder-list-item ${isSelected ? "active" : ""}">
							<span class="charsheet__builder-list-item-name">${race.name}</span>
							<span class="charsheet__builder-list-item-source">${Parser.sourceJsonToAbv(race.source)}</span>
						</div>
					`);

					$item.on("click", () => {
						$list.find(".charsheet__builder-list-item").removeClass("active");
						$item.addClass("active");
						this._selectedRace = race;
						this._selectedSubrace = null;
						this._renderRacePreview($preview, race);
					});

					$list.append($item);
				});
		};

		$search.on("input", (e) => renderRaceList(e.target.value));
		renderRaceList();

		// If race already selected, show preview
		if (this._selectedRace) {
			this._renderRacePreview($preview, this._selectedRace);
		}
	}

	_renderRacePreview ($preview, race) {
		$preview.empty();

		const $content = $(`
			<div>
				<h4>${race.name}</h4>
				<p class="ve-muted">${Parser.sourceJsonToFull(race.source)}</p>
			</div>
		`);

		// Ability scores
		if (race.ability?.length) {
			const abilityStr = race.ability.map(a => {
				return Object.entries(a)
					.filter(([k]) => Parser.ABIL_ABVS.includes(k))
					.map(([k, v]) => `${k.toUpperCase()} +${v}`)
					.join(", ");
			}).join("; ");

			if (abilityStr) {
				$content.append(`<p><strong>Ability Scores:</strong> ${abilityStr}</p>`);
			}
		}

		// Speed
		if (race.speed) {
			const speedStr = typeof race.speed === "number" ? `${race.speed} ft.` : `${race.speed.walk || 30} ft.`;
			$content.append(`<p><strong>Speed:</strong> ${speedStr}</p>`);
		}

		// Size
		if (race.size) {
			const sizeStr = race.size.map(s => Parser.sizeAbvToFull(s)).join(" or ");
			$content.append(`<p><strong>Size:</strong> ${sizeStr}</p>`);
		}

		// Traits
		if (race.entries) {
			const $traits = $(`<div class="mt-2"><strong>Traits:</strong></div>`);
			race.entries.forEach(entry => {
				if (typeof entry === "object" && entry.name) {
					$traits.append(`<p><em>${entry.name}.</em> ${Renderer.get().render({entries: entry.entries || []})}</p>`);
				}
			});
			$content.append($traits);
		}

		// Subraces
		if (race.subraces?.length) {
			const $subraces = $(`
				<div class="mt-3">
					<strong>Subrace:</strong>
					<select class="form-control form-control--minimal mt-1" id="builder-subrace-select">
						<option value="">-- Select Subrace --</option>
					</select>
				</div>
			`);

			const $select = $subraces.find("select");
			race.subraces.forEach((subrace, idx) => {
				$select.append(`<option value="${idx}">${subrace.name}</option>`);
			});

			$select.on("change", (e) => {
				const idx = e.target.value;
				if (idx !== "") {
					this._selectedSubrace = race.subraces[parseInt(idx)];
				} else {
					this._selectedSubrace = null;
				}
			});

			// Pre-select if already chosen
			if (this._selectedSubrace) {
				const idx = race.subraces.findIndex(s => s.name === this._selectedSubrace.name);
				if (idx >= 0) $select.val(idx);
			}

			$content.append($subraces);
		}

		$preview.append($content);
	}
	// #endregion

	// #region Step 2: Class
	_renderClassStep ($content) {
		// Get classes filtered by allowed sources
		const classes = this._page.filterByAllowedSources(this._page.getClasses());

		const $container = $(`
			<div class="charsheet__builder-selection">
				<div class="charsheet__builder-list">
					<div class="charsheet__builder-list-header">
						<input type="text" class="form-control form-control--minimal" placeholder="Search classes..." id="builder-class-search">
					</div>
					<div class="charsheet__builder-list-content" id="builder-class-list"></div>
				</div>
				<div class="charsheet__builder-preview" id="builder-class-preview">
					<div class="charsheet__builder-preview-placeholder">Select a class to see details</div>
				</div>
			</div>
		`);

		$content.append($container);

		const $list = $("#builder-class-list");
		const $preview = $("#builder-class-preview");
		const $search = $("#builder-class-search");

		const renderClassList = (filter = "") => {
			$list.empty();
			const filterLower = filter.toLowerCase();

			classes
				.filter(cls => !filter || cls.name.toLowerCase().includes(filterLower))
				.sort((a, b) => a.name.localeCompare(b.name))
				.forEach(cls => {
					const isSelected = this._selectedClass?.name === cls.name && this._selectedClass?.source === cls.source;
					const $item = $(`
						<div class="charsheet__builder-list-item ${isSelected ? "active" : ""}">
							<span class="charsheet__builder-list-item-name">${cls.name}</span>
							<span class="charsheet__builder-list-item-source">${Parser.sourceJsonToAbv(cls.source)}</span>
						</div>
					`);

					$item.on("click", () => {
						$list.find(".charsheet__builder-list-item").removeClass("active");
						$item.addClass("active");
						this._selectedClass = cls;
						this._selectedSubclass = null;
						// Reset skill selections when changing class
						this._selectedSkills = [];
						// Reset equipment choices when changing class
						this._equipmentChoices = {};
						this._useGoldAlternative = false;
						// Reset optional features when changing class
						this._selectedOptionalFeatures = {};
						this._renderClassPreview($preview, cls);
					});

					$list.append($item);
				});
		};

		$search.on("input", (e) => renderClassList(e.target.value));
		renderClassList();

		if (this._selectedClass) {
			this._renderClassPreview($preview, this._selectedClass);
		}
	}

	_renderClassPreview ($preview, cls) {
		$preview.empty();

		const hitDie = cls.hd?.faces || 8;

		const $content = $(`
			<div>
				<h4>${cls.name}</h4>
				<p class="ve-muted">${Parser.sourceJsonToFull(cls.source)}</p>
				<p><strong>Hit Die:</strong> d${hitDie}</p>
			</div>
		`);

		// Primary ability
		if (cls.primaryAbility) {
			const abilityStr = cls.primaryAbility.map(a => {
				return Object.entries(a)
					.filter(([k]) => Parser.ABIL_ABVS.includes(k))
					.map(([k]) => Parser.attAbvToFull(k))
					.join(" or ");
			}).join(", ");
			$content.append(`<p><strong>Primary Ability:</strong> ${abilityStr}</p>`);
		}

		// Saving throws
		if (cls.proficiency) {
			const saves = cls.proficiency.map(p => Parser.attAbvToFull(p)).join(", ");
			$content.append(`<p><strong>Saving Throws:</strong> ${saves}</p>`);
		}

		// Armor
		if (cls.startingProficiencies?.armor) {
			const armor = cls.startingProficiencies.armor.map(a => typeof a === "string" ? a : a.full).join(", ");
			// Render through Renderer to handle any tags
			$content.append($(`<p><strong>Armor:</strong> ${Renderer.get().render(armor)}</p>`));
		}

		// Weapons
		if (cls.startingProficiencies?.weapons) {
			const weapons = cls.startingProficiencies.weapons.map(w => typeof w === "string" ? w : w.full).join(", ");
			// Render through Renderer to handle {@filter} and other tags
			$content.append($(`<p><strong>Weapons:</strong> ${Renderer.get().render(weapons)}</p>`));
		}

		// Tools
		if (cls.startingProficiencies?.tools) {
			const tools = cls.startingProficiencies.tools.map(t => typeof t === "string" ? t : t.full).join(", ");
			$content.append($(`<p><strong>Tools:</strong> ${Renderer.get().render(tools)}</p>`));
		}

		// Skills selection
		if (cls.startingProficiencies?.skills) {
			const skillChoices = cls.startingProficiencies.skills;
			const $skillSection = this._renderClassSkillSelection(cls, skillChoices);
			$content.append($skillSection);
		}

		// Optional features selection (invocations, metamagic, etc.)
		if (cls.optionalfeatureProgression?.length) {
			const $optFeatSection = this._renderClassOptionalFeatures(cls);
			$content.append($optFeatSection);
		}

		// Spellcasting
		if (cls.spellcastingAbility) {
			$content.append(`<p><strong>Spellcasting:</strong> ${Parser.attAbvToFull(cls.spellcastingAbility)}</p>`);
		}

		$preview.append($content);
	}

	_renderClassSkillSelection (cls, skillChoices) {
		// Parse skill choices - typically like {choose: {from: ["athletics", "acrobatics"], count: 2}}
		// or {any: 3} for Bard
		let availableSkills = [];
		let chooseCount = 2;

		// Get skills dynamically from loaded data (supports homebrew)
		const allSkills = this._page.getSkillsList();

		skillChoices.forEach(skillChoice => {
			if (skillChoice.choose) {
				if (skillChoice.choose.from) {
					availableSkills = skillChoice.choose.from;
				}
				if (skillChoice.choose.count) {
					chooseCount = skillChoice.choose.count;
				}
			} else if (skillChoice.any) {
				// "any" means choose from all skills (like Bard)
				chooseCount = skillChoice.any;
				availableSkills = allSkills.map(s => s.toLowerCase().replace(/\s+/g, ""));
			} else {
				// Fixed skills
				availableSkills = Object.keys(skillChoice).filter(k => k !== "choose" && k !== "any");
			}
		});

		// Match available skills to proper names
		const formattedSkills = availableSkills.map(skill => {
			const match = allSkills.find(s => s.toLowerCase().replace(/\s+/g, "") === skill.toLowerCase().replace(/\s+/g, ""));
			return match || skill;
		});

		const $section = $(`
			<div class="charsheet__builder-skill-selection mt-3">
				<p><strong>Skills:</strong> Choose ${chooseCount} from:</p>
				<div class="charsheet__builder-skill-checkboxes"></div>
				<div class="ve-small ve-muted mt-1">Selected: <span class="skill-count">${this._selectedSkills.length}</span>/${chooseCount}</div>
			</div>
		`);

		const $checkboxes = $section.find(".charsheet__builder-skill-checkboxes");

		formattedSkills.forEach(skill => {
			const isSelected = this._selectedSkills.includes(skill);
			const $label = $(`
				<label class="charsheet__builder-skill-checkbox mr-3 mb-1">
					<input type="checkbox" value="${skill}" ${isSelected ? "checked" : ""}>
					${skill}
				</label>
			`);

			$label.find("input").on("change", (e) => {
				if (e.target.checked) {
					if (this._selectedSkills.length < chooseCount) {
						this._selectedSkills.push(skill);
					} else {
						e.target.checked = false;
						JqueryUtil.doToast({type: "warning", content: `You can only choose ${chooseCount} skills.`});
					}
				} else {
					this._selectedSkills = this._selectedSkills.filter(s => s !== skill);
				}
				$section.find(".skill-count").text(this._selectedSkills.length);
			});

			$checkboxes.append($label);
		});

		return $section;
	}

	_renderClassOptionalFeatures (cls) {
		const allOptFeatures = this._page.getOptionalFeatures();
		const $container = $(`<div class="charsheet__builder-optional-features mt-3"></div>`);

		cls.optionalfeatureProgression.forEach(optFeatProg => {
			// Get how many of this feature type at level 1
			let count = 0;
			if (Array.isArray(optFeatProg.progression)) {
				count = optFeatProg.progression[0] || 0; // Level 1 is index 0
			} else if (typeof optFeatProg.progression === "object") {
				count = optFeatProg.progression["1"] || 0;
			}

			if (count === 0) return; // No choices at level 1

			const featureTypes = optFeatProg.featureType || [];
			const name = optFeatProg.name || featureTypes.join(", ");

			// Filter available options by feature type and match class/source requirements
			const availableOptions = allOptFeatures.filter(opt => {
				// Check feature type match
				if (!opt.featureType?.some(ft => featureTypes.includes(ft))) return false;

				// Check prerequisites
				if (opt.prerequisite) {
					for (const prereq of opt.prerequisite) {
						// Level prerequisite
						if (prereq.level) {
							const reqLevel = prereq.level.level || prereq.level;
							if (reqLevel > 1) return false;
						}
						// TODO: Could add more prerequisite checks (spells, pact boon, etc.)
					}
				}

				return true;
			});

			// Initialize storage for this feature type if needed
			const featureKey = featureTypes.join("_");
			if (!this._selectedOptionalFeatures[featureKey]) {
				this._selectedOptionalFeatures[featureKey] = [];
			}

			const $section = $(`
				<div class="charsheet__builder-opt-feat-section mb-3">
					<p><strong>${name}:</strong> Choose ${count}</p>
					<div class="charsheet__builder-opt-feat-list" style="max-height: 200px; overflow-y: auto;"></div>
					<div class="ve-small ve-muted mt-1">Selected: <span class="opt-feat-count">${this._selectedOptionalFeatures[featureKey].length}</span>/${count}</div>
				</div>
			`);

			const $list = $section.find(".charsheet__builder-opt-feat-list");

			availableOptions.sort((a, b) => a.name.localeCompare(b.name)).forEach(opt => {
				const isSelected = this._selectedOptionalFeatures[featureKey].some(
					s => s.name === opt.name && s.source === opt.source,
				);
				const $item = $(`
					<label class="charsheet__builder-opt-feat-item d-block mb-1" style="cursor: pointer;">
						<input type="checkbox" class="mr-2" ${isSelected ? "checked" : ""}>
						<span class="opt-feat-name">${opt.name}</span>
						<span class="ve-muted ve-small ml-1">(${Parser.sourceJsonToAbv(opt.source)})</span>
					</label>
				`);

				// Show description on hover/click
				$item.find(".opt-feat-name").on("click", (e) => {
					e.preventDefault();
					const desc = Renderer.get().render({entries: opt.entries || []});
					JqueryUtil.doToast({type: "info", content: $(`<div><strong>${opt.name}</strong><br>${desc}</div>`)});
				});

				$item.find("input").on("change", (e) => {
					if (e.target.checked) {
						if (this._selectedOptionalFeatures[featureKey].length < count) {
							this._selectedOptionalFeatures[featureKey].push(opt);
						} else {
							e.target.checked = false;
							JqueryUtil.doToast({type: "warning", content: `You can only choose ${count} ${name}.`});
						}
					} else {
						this._selectedOptionalFeatures[featureKey] = this._selectedOptionalFeatures[featureKey].filter(
							s => !(s.name === opt.name && s.source === opt.source),
						);
					}
					$section.find(".opt-feat-count").text(this._selectedOptionalFeatures[featureKey].length);
				});

				$list.append($item);
			});

			$container.append($section);
		});

		return $container;
	}
	// #endregion

	// #region Step 3: Abilities
	_renderAbilitiesStep ($content) {
		const $container = $(`
			<div class="charsheet__builder-abilities">
				<div>
					<div class="charsheet__builder-ability-method mb-3">
						<label class="mr-3">
							<input type="radio" name="ability-method" value="standard" ${this._abilityMethod === "standard" ? "checked" : ""}> Standard Array
						</label>
						<label class="mr-3">
							<input type="radio" name="ability-method" value="pointbuy" ${this._abilityMethod === "pointbuy" ? "checked" : ""}> Point Buy
						</label>
						<label>
							<input type="radio" name="ability-method" value="manual" ${this._abilityMethod === "manual" ? "checked" : ""}> Manual Entry
						</label>
					</div>
					<div class="charsheet__builder-points-remaining" id="builder-points-remaining" style="display: ${this._abilityMethod === "pointbuy" ? "block" : "none"}">
						Points Remaining: <span id="points-value">${this._pointBuyRemaining}</span>
					</div>
					<div id="builder-abilities-inputs"></div>
				</div>
				<div>
					<div class="charsheet__section">
						<h5>Racial Bonuses</h5>
						<div id="builder-racial-bonuses">
							${this._selectedRace ? this._getRacialBonusesHtml() : "<p class='ve-muted'>Select a race first</p>"}
						</div>
					</div>
					<div class="charsheet__section mt-3">
						<h5>Summary</h5>
						<div id="builder-abilities-summary"></div>
					</div>
				</div>
			</div>
		`);

		$content.append($container);

		// Method selection
		$('input[name="ability-method"]').on("change", (e) => {
			this._abilityMethod = e.target.value;
			this._resetAbilityScores();
			this._renderAbilityInputs();
		});

		this._renderAbilityInputs();
	}

	_resetAbilityScores () {
		if (this._abilityMethod === "standard") {
			// Don't auto-assign - let user choose
			this._abilityScores = {str: null, dex: null, con: null, int: null, wis: null, cha: null};
			this._standardArrayPool = [15, 14, 13, 12, 10, 8];
		} else {
			this._abilityScores = {str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8};
		}
		this._pointBuyRemaining = 27;
	}

	_renderAbilityInputs () {
		const $container = $("#builder-abilities-inputs");
		$container.empty();

		const $pointsDisplay = $("#builder-points-remaining");
		$pointsDisplay.toggle(this._abilityMethod === "pointbuy");

		// Initialize standard array pool if needed
		if (this._abilityMethod === "standard" && !this._standardArrayPool) {
			this._standardArrayPool = [15, 14, 13, 12, 10, 8];
		}

		Parser.ABIL_ABVS.forEach(abl => {
			const score = this._abilityScores[abl];
			const racialBonus = this._getRacialBonus(abl);
			const total = (score || 0) + racialBonus;
			const mod = score != null ? Math.floor((total - 10) / 2) : null;

			const scoreDisplay = this._abilityMethod === "standard"
				? `<span class="charsheet__builder-ability-score charsheet__builder-ability-dropzone" data-ability="${abl}" style="min-width: 2rem; text-align: center; border: 1px dashed #ccc; padding: 0.25rem 0.5rem; cursor: pointer;">${score ?? "—"}</span>`
				: this._abilityMethod === "manual"
					? `<input type="number" class="form-control form-control--minimal charsheet__builder-ability-score" value="${score}" min="3" max="20">`
					: `<span class="charsheet__builder-ability-score">${score}</span>`;

			const $row = $(`
				<div class="charsheet__builder-ability-row">
					<span class="charsheet__builder-ability-name">${Parser.attAbvToFull(abl)}</span>
					<div class="charsheet__builder-ability-controls">
						${this._abilityMethod === "pointbuy" ? `<button class="ve-btn ve-btn-default ve-btn-xs" data-action="decrease">−</button>` : ""}
						${scoreDisplay}
						${this._abilityMethod === "pointbuy" ? `<button class="ve-btn ve-btn-default ve-btn-xs" data-action="increase">+</button>` : ""}
						${racialBonus ? `<span class="charsheet__builder-ability-racial">+${racialBonus}</span>` : ""}
						<span class="charsheet__builder-ability-mod">(${mod != null ? (mod >= 0 ? "+" : "") + mod : "—"})</span>
					</div>
				</div>
			`);

			if (this._abilityMethod === "pointbuy") {
				$row.find('[data-action="decrease"]').on("click", () => this._adjustPointBuy(abl, -1));
				$row.find('[data-action="increase"]').on("click", () => this._adjustPointBuy(abl, 1));
			}

			if (this._abilityMethod === "manual") {
				$row.find("input").on("change", (e) => {
					this._abilityScores[abl] = Math.max(3, Math.min(20, parseInt(e.target.value) || 8));
					this._updateAbilitySummary();
				});
			}

			$container.append($row);
		});

		// Standard array assignment
		if (this._abilityMethod === "standard") {
			this._renderStandardArrayAssignment($container);
		}

		this._updateAbilitySummary();
	}

	_renderStandardArrayAssignment ($container) {
		const $assignment = $(`
			<div class="mt-3">
				<p class="ve-muted">Click a score, then click an ability to assign it:</p>
				<div class="ve-flex ve-flex-wrap" id="standard-array-pool"></div>
			</div>
		`);

		const $pool = $assignment.find("#standard-array-pool");

		// Render available scores
		this._standardArrayPool.forEach((score, idx) => {
			const $badge = $(`<span class="badge badge-primary mr-1 mb-1 charsheet__builder-score-badge" data-score="${score}" data-idx="${idx}" style="cursor: pointer; font-size: 1rem; padding: 0.5rem;">${score}</span>`);

			$badge.on("click", () => {
				// Toggle selection
				if ($badge.hasClass("active")) {
					$badge.removeClass("active");
					this._selectedStandardScore = null;
				} else {
					$pool.find(".badge").removeClass("active");
					$badge.addClass("active");
					this._selectedStandardScore = {score, idx};
				}
			});

			$pool.append($badge);
		});

		// Add click handlers to ability dropzones
		$container.find(".charsheet__builder-ability-dropzone").on("click", (e) => {
			const abl = $(e.target).data("ability");

			if (this._selectedStandardScore != null) {
				// Assign the selected score to this ability
				const oldScore = this._abilityScores[abl];

				// If this ability already had a score, put it back in the pool
				if (oldScore != null) {
					this._standardArrayPool.push(oldScore);
					this._standardArrayPool.sort((a, b) => b - a);
				}

				// Assign the new score
				this._abilityScores[abl] = this._selectedStandardScore.score;

				// Remove from pool
				this._standardArrayPool = this._standardArrayPool.filter((_, i) => i !== this._standardArrayPool.indexOf(this._selectedStandardScore.score));

				this._selectedStandardScore = null;
				this._renderAbilityInputs();
			} else if (this._abilityScores[abl] != null) {
				// Clicking an assigned ability with no selection - return to pool
				this._standardArrayPool.push(this._abilityScores[abl]);
				this._standardArrayPool.sort((a, b) => b - a);
				this._abilityScores[abl] = null;
				this._renderAbilityInputs();
			}
		});

		$container.append($assignment);
	}

	_adjustPointBuy (ability, delta) {
		const currentScore = this._abilityScores[ability];
		const newScore = currentScore + delta;

		if (newScore < 8 || newScore > 15) return;

		const currentCost = this._getPointBuyCost(currentScore);
		const newCost = this._getPointBuyCost(newScore);
		const costDelta = newCost - currentCost;

		if (this._pointBuyRemaining - costDelta < 0) return;

		this._abilityScores[ability] = newScore;
		this._pointBuyRemaining -= costDelta;

		$("#points-value").text(this._pointBuyRemaining);
		this._renderAbilityInputs();
	}

	_getPointBuyCost (score) {
		if (score <= 8) return 0;
		if (score <= 13) return score - 8;
		if (score === 14) return 7;
		if (score === 15) return 9;
		return 0;
	}

	_getRacialBonus (ability) {
		let bonus = 0;

		if (this._selectedRace?.ability) {
			this._selectedRace.ability.forEach(abiSet => {
				if (abiSet[ability]) bonus += abiSet[ability];
			});
		}

		if (this._selectedSubrace?.ability) {
			this._selectedSubrace.ability.forEach(abiSet => {
				if (abiSet[ability]) bonus += abiSet[ability];
			});
		}

		return bonus;
	}

	_getRacialBonusesHtml () {
		const bonuses = [];

		if (this._selectedRace?.ability) {
			this._selectedRace.ability.forEach(abiSet => {
				Object.entries(abiSet).forEach(([abi, bonus]) => {
					if (Parser.ABIL_ABVS.includes(abi)) {
						bonuses.push(`${Parser.attAbvToFull(abi)} +${bonus}`);
					}
				});
			});
		}

		if (this._selectedSubrace?.ability) {
			this._selectedSubrace.ability.forEach(abiSet => {
				Object.entries(abiSet).forEach(([abi, bonus]) => {
					if (Parser.ABIL_ABVS.includes(abi)) {
						bonuses.push(`${Parser.attAbvToFull(abi)} +${bonus} (${this._selectedSubrace.name})`);
					}
				});
			});
		}

		return bonuses.length ? bonuses.join("<br>") : "<p class='ve-muted'>No racial ability bonuses</p>";
	}

	_updateAbilitySummary () {
		const $summary = $("#builder-abilities-summary");
		$summary.empty();

		Parser.ABIL_ABVS.forEach(abl => {
			const base = this._abilityScores[abl];
			const racial = this._getRacialBonus(abl);
			const total = base + racial;
			const mod = Math.floor((total - 10) / 2);

			$summary.append(`
				<div class="ve-flex-v-center">
					<strong class="mr-2" style="width: 80px;">${Parser.attAbvToFull(abl)}:</strong>
					<span>${total} (${mod >= 0 ? "+" : ""}${mod})</span>
				</div>
			`);
		});
	}
	// #endregion

	// #region Step 4: Background
	_renderBackgroundStep ($content) {
		// Get backgrounds filtered by allowed sources
		const backgrounds = this._page.filterByAllowedSources(this._page.getBackgrounds());

		const $container = $(`
			<div class="charsheet__builder-selection">
				<div class="charsheet__builder-list">
					<div class="charsheet__builder-list-header">
						<input type="text" class="form-control form-control--minimal" placeholder="Search backgrounds..." id="builder-bg-search">
					</div>
					<div class="charsheet__builder-list-content" id="builder-bg-list"></div>
				</div>
				<div class="charsheet__builder-preview" id="builder-bg-preview">
					<div class="charsheet__builder-preview-placeholder">Select a background to see details</div>
				</div>
			</div>
		`);

		$content.append($container);

		const $list = $("#builder-bg-list");
		const $preview = $("#builder-bg-preview");
		const $search = $("#builder-bg-search");

		const renderBgList = (filter = "") => {
			$list.empty();
			const filterLower = filter.toLowerCase();

			backgrounds
				.filter(bg => !filter || bg.name.toLowerCase().includes(filterLower))
				.sort((a, b) => a.name.localeCompare(b.name))
				.forEach(bg => {
					const isSelected = this._selectedBackground?.name === bg.name;
					const $item = $(`
						<div class="charsheet__builder-list-item ${isSelected ? "active" : ""}">
							<span class="charsheet__builder-list-item-name">${bg.name}</span>
							<span class="charsheet__builder-list-item-source">${Parser.sourceJsonToAbv(bg.source)}</span>
						</div>
					`);

					$item.on("click", () => {
						$list.find(".charsheet__builder-list-item").removeClass("active");
						$item.addClass("active");
						this._selectedBackground = bg;
						this._renderBackgroundPreview($preview, bg);
					});

					$list.append($item);
				});
		};

		$search.on("input", (e) => renderBgList(e.target.value));
		renderBgList();

		if (this._selectedBackground) {
			this._renderBackgroundPreview($preview, this._selectedBackground);
		}
	}

	_renderBackgroundPreview ($preview, bg) {
		$preview.empty();

		const $content = $(`
			<div>
				<h4>${bg.name}</h4>
				<p class="ve-muted">${Parser.sourceJsonToFull(bg.source)}</p>
			</div>
		`);

		// Edition mixing detection
		const raceIs2024 = this._raceUses2024ASI();
		const bgIs2024 = this._is2024Edition(bg);
		const bgHasASI = bg.ability && bg.ability.length;

		// Show edition mixing warnings
		if (this._selectedRace) {
			if (!raceIs2024 && bgIs2024) {
				// 2014 race + 2024 background: warn that ASI from background shouldn't apply
				$content.append(`
					<div class="alert alert-warning ve-small mb-2">
						<strong>Edition Mixing:</strong> You've selected a 2014 race that provides its own ability score bonuses. 
						The ASI options from this 2024 background will be ignored. Consider using a 2014 background instead.
					</div>
				`);
			} else if (raceIs2024 && !bgHasASI && !bgIs2024) {
				// 2024 species + 2014 background (no ASI): offer free ASI choice
				$content.append(`
					<div class="alert alert-info ve-small mb-2">
						<strong>Note:</strong> You've selected a 2024 species that expects ability score bonuses from your background. 
						Since this is a 2014 background without ASI, you can choose +2 to one ability and +1 to another below.
					</div>
				`);
			}
		}

		// Ability Score Increases
		// Show ASI if: 2024 background has it OR 2024 species + 2014 background needs free choice
		const showBackgroundASI = (bgHasASI && (raceIs2024 || !this._selectedRace));
		const showFreeASIChoice = (raceIs2024 && !bgHasASI);

		if (showBackgroundASI || showFreeASIChoice) {
			const $asiSection = $(`<div class="charsheet__section mb-2"></div>`);
			$asiSection.append(`<p><strong>Ability Score Increases:</strong></p>`);

			// Initialize selected ability bonuses if not set
			if (!this._selectedAbilityBonuses) {
				this._selectedAbilityBonuses = {};
			}

			if (showBackgroundASI && bgHasASI) {
				// Use the background's ASI options
				this._renderBackgroundASIChoices($asiSection, bg.ability[0]);
			} else if (showFreeASIChoice) {
				// Free choice: +2 to one, +1 to another from any ability
				this._renderFreeASIChoices($asiSection);
			}

			$content.append($asiSection);
		}

		// Skills
		if (bg.skillProficiencies) {
			const skills = bg.skillProficiencies.flatMap(sp =>
				Object.keys(sp).filter(k => k !== "choose" && k !== "any").map(s => s.toTitleCase()),
			);
			if (skills.length) {
				$content.append(`<p><strong>Skills:</strong> ${skills.join(", ")}</p>`);
			}
		}

		// Tools
		if (bg.toolProficiencies) {
			const tools = bg.toolProficiencies.flatMap(tp =>
				Object.keys(tp).filter(k => k !== "choose" && k !== "any").map(t => t.toTitleCase()),
			);
			if (tools.length) {
				$content.append(`<p><strong>Tools:</strong> ${tools.join(", ")}</p>`);
			}
		}

		// Languages
		if (bg.languageProficiencies) {
			const langs = bg.languageProficiencies.flatMap(lp =>
				Object.keys(lp).filter(k => k !== "anyStandard" && k !== "any").map(l => l.toTitleCase()),
			);
			if (langs.length) {
				$content.append(`<p><strong>Languages:</strong> ${langs.join(", ")}</p>`);
			}
		}

		// Equipment
		if (bg.startingEquipment) {
			$content.append(`<p><strong>Equipment:</strong> ${Renderer.get().render({entries: bg.startingEquipment})}</p>`);
		}

		// Features
		if (bg.entries) {
			const $features = $(`<div class="mt-2"></div>`);
			bg.entries.forEach(entry => {
				if (typeof entry === "object" && entry.name) {
					$features.append(`<p><strong>${entry.name}.</strong> ${Renderer.get().render({entries: entry.entries || []})}</p>`);
				}
			});
			$content.append($features);
		}

		$preview.append($content);
	}

	_renderBackgroundASIChoices ($container, abilityChoice) {
		if (!abilityChoice) return;

		if (abilityChoice.choose) {
			const choose = abilityChoice.choose;
			const abilities = ["str", "dex", "con", "int", "wis", "cha"];
			const availableAbilities = choose.from || choose.weighted?.from || abilities;

			// Handle weighted format (+2 to one, +1 to another)
			if (choose.weighted) {
				const weights = choose.weighted.weights || [2, 1];
				this._renderWeightedASIChoices($container, availableAbilities, weights);
			} else if (choose.count) {
				// Multiple choices of same amount (e.g., +1/+1/+1)
				const amount = choose.amount || 1;
				const count = choose.count;
				this._renderCountASIChoices($container, availableAbilities, count, amount);
			}
		} else {
			// Fixed ability bonuses
			const bonuses = Object.entries(abilityChoice)
				.filter(([k, v]) => typeof v === "number")
				.map(([ab, bonus]) => `${Parser.attAbvToFull(ab)} +${bonus}`)
				.join(", ");
			if (bonuses) {
				$container.append(`<p class="ve-muted">${bonuses}</p>`);
				// Store fixed bonuses
				Object.entries(abilityChoice)
					.filter(([k, v]) => typeof v === "number")
					.forEach(([ab, bonus], idx) => {
						this._selectedAbilityBonuses[`bg_${idx}`] = ab;
						this._selectedAbilityBonuses[`bg_${idx}_weight`] = bonus;
					});
			}
		}
	}

	_renderFreeASIChoices ($container) {
		// Free choice for 2024 species + 2014 background: +2 to one ability, +1 to another
		const abilities = ["str", "dex", "con", "int", "wis", "cha"];
		const weights = [2, 1];
		this._renderWeightedASIChoices($container, abilities, weights);
	}

	_renderWeightedASIChoices ($container, availableAbilities, weights) {
		const $weightedChoices = $(`<div class="charsheet__builder-asi-choices"></div>`);

		weights.forEach((weight, idx) => {
			const $row = $(`<div class="ve-flex-v-center mb-1"></div>`);
			$row.append(`<span class="mr-2">+${weight}:</span>`);

			const $select = $(`<select class="form-control form-control--minimal ve-inline-block w-auto" data-asi-idx="${idx}"></select>`);
			$select.append(`<option value="">-- Select --</option>`);

			availableAbilities.forEach(ab => {
				const abName = Parser.attAbvToFull(ab);
				const selected = this._selectedAbilityBonuses[`bg_${idx}`] === ab ? "selected" : "";
				$select.append(`<option value="${ab}" ${selected}>${abName}</option>`);
			});

			$select.on("change", (e) => {
				const val = e.target.value;
				this._selectedAbilityBonuses[`bg_${idx}`] = val;
				this._selectedAbilityBonuses[`bg_${idx}_weight`] = weight;

				// Update other selects to disable already-selected options
				$weightedChoices.find("select").each((i, sel) => {
					const $sel = $(sel);
					const selIdx = $sel.data("asi-idx");
					if (selIdx !== idx) {
						$sel.find("option").each((j, opt) => {
							const $opt = $(opt);
							const optVal = $opt.val();
							// Check if this option is selected in another dropdown
							const isSelectedElsewhere = Object.entries(this._selectedAbilityBonuses)
								.some(([k, v]) => k.startsWith("bg_") && !k.includes("weight") && k !== `bg_${selIdx}` && v === optVal);
							$opt.prop("disabled", optVal && isSelectedElsewhere);
						});
					}
				});
			});

			$row.append($select);
			$weightedChoices.append($row);
		});

		$container.append($weightedChoices);
	}

	_renderCountASIChoices ($container, availableAbilities, count, amount) {
		const $countChoices = $(`<div class="charsheet__builder-asi-choices"></div>`);

		for (let i = 0; i < count; i++) {
			const $row = $(`<div class="ve-flex-v-center mb-1"></div>`);
			$row.append(`<span class="mr-2">+${amount}:</span>`);

			const $select = $(`<select class="form-control form-control--minimal ve-inline-block w-auto" data-asi-idx="${i}"></select>`);
			$select.append(`<option value="">-- Select --</option>`);

			availableAbilities.forEach(ab => {
				const abName = Parser.attAbvToFull(ab);
				const selected = this._selectedAbilityBonuses[`bg_${i}`] === ab ? "selected" : "";
				$select.append(`<option value="${ab}" ${selected}>${abName}</option>`);
			});

			$select.on("change", (e) => {
				this._selectedAbilityBonuses[`bg_${i}`] = e.target.value;
				this._selectedAbilityBonuses[`bg_${i}_weight`] = amount;
			});

			$row.append($select);
			$countChoices.append($row);
		}

		$container.append($countChoices);
	}
	// #endregion

	// #region Step 5: Equipment
	_renderEquipmentStep ($content) {
		// Initialize equipment choices if not already set
		if (!this._equipmentChoices) {
			this._equipmentChoices = {};
		}

		const $container = $(`
			<div>
				<h4>Starting Equipment</h4>
				<p class="ve-muted">Choose your starting equipment based on your class and background.</p>
				
				<div class="charsheet__section">
					<h5>Class Equipment</h5>
					<div id="builder-class-equipment"></div>
				</div>
				
				<div class="charsheet__section mt-3">
					<h5>Background Equipment</h5>
					<div id="builder-bg-equipment">
						${this._selectedBackground ? this._getBackgroundEquipmentHtml() : "<p class='ve-muted'>Select a background first</p>"}
					</div>
				</div>
				
				<div class="charsheet__section mt-3 ve-muted ve-small">
					<span class="glyphicon glyphicon-info-sign"></span>
					Additional items can be added from the Inventory tab after character creation.
				</div>
			</div>
		`);

		$content.append($container);

		// Render class equipment with choices
		this._renderClassEquipmentChoices($("#builder-class-equipment"));
	}

	_renderClassEquipmentChoices ($container) {
		$container.empty();

		if (!this._selectedClass) {
			$container.append("<p class='ve-muted'>Select a class first</p>");
			return;
		}

		const startingEquip = this._selectedClass.startingEquipment;
		if (!startingEquip) {
			$container.append("<p class='ve-muted'>No starting equipment defined</p>");
			return;
		}

		// Check if this is 2024 format (has uppercase keys like A, B, C in defaultData)
		const defaultData = startingEquip.defaultData || [];
		const is2024Format = defaultData.length > 0 && defaultData[0] && 
			Object.keys(defaultData[0]).some(k => /^[A-Z]$/.test(k));

		if (is2024Format) {
			// 2024 XPHB format - package choices (A, B, C)
			this._render2024EquipmentChoices($container, startingEquip);
		} else if (startingEquip.default) {
			// Classic format - per-row choices (a, b)
			this._renderClassicEquipmentChoices($container, startingEquip);
		} else {
			$container.append("<p class='ve-muted'>No starting equipment options available</p>");
		}
	}

	_render2024EquipmentChoices ($container, startingEquip) {
		// 2024 format has complete equipment packages as options A, B, C, etc.
		const defaultData = startingEquip.defaultData || [];
		if (!defaultData.length) return;

		const choiceData = defaultData[0]; // All choices are in the first defaultData entry
		const choiceKeys = Object.keys(choiceData).filter(k => /^[A-Z]$/.test(k)).sort();

		if (!choiceKeys.length) {
			$container.append("<p class='ve-muted'>No equipment options found</p>");
			return;
		}

		// Display human-readable description if available
		if (startingEquip.entries?.length) {
			const $desc = $(`<div class="mb-3 ve-muted">${Renderer.get().render({entries: startingEquip.entries})}</div>`);
			$container.append($desc);
		}

		const $choiceGroup = $(`<div class="charsheet__builder-equipment-choice"></div>`);

		// Initialize default choice if not set
		if (!this._equipmentChoices["2024"]) {
			this._equipmentChoices["2024"] = choiceKeys[0];
		}

		choiceKeys.forEach((key) => {
			const items = choiceData[key] || [];
			const isSelected = this._equipmentChoices["2024"] === key;

			// Build label showing what's in this package
			const labelParts = items.map(item => {
				if (item.item) {
					const [name] = item.item.split("|");
					return item.quantity > 1 ? `${item.quantity}× ${name}` : name;
				} else if (item.value) {
					// Gold value in copper pieces
					const gp = Math.floor(item.value / 100);
					return `${gp} GP`;
				} else if (item.special) {
					return item.special;
				}
				return "";
			}).filter(Boolean);

			const $option = $(`
				<label class="charsheet__builder-equipment-option ve-flex-v-center mb-2 p-2" style="border: 1px solid var(--rgb-border-grey); border-radius: 4px; cursor: pointer;">
					<input type="radio" name="equipment-choice-2024" value="${key}" ${isSelected ? "checked" : ""} class="mr-2">
					<div>
						<strong>Option ${key}:</strong>
						<div class="ve-small ve-muted">${labelParts.join(", ")}</div>
					</div>
				</label>
			`);

			$option.find("input").on("change", () => {
				this._equipmentChoices["2024"] = key;
			});

			$choiceGroup.append($option);
		});

		$container.append($choiceGroup);
	}

	_renderClassicEquipmentChoices ($container, startingEquip) {
		const equipmentEntries = startingEquip.default;
		const defaultData = startingEquip.defaultData || [];

		equipmentEntries.forEach((entry, idx) => {
			const $row = $(`<div class="charsheet__builder-equipment-row mb-2"></div>`);

			// Check if this is a choice (contains "or")
			const isChoice = entry.includes(" or ");

			if (isChoice && defaultData[idx]) {
				// Render as radio choices
				const choiceData = defaultData[idx];
				const choiceKeys = Object.keys(choiceData).filter(k => k !== "_");

				if (choiceKeys.length > 1) {
					const $choiceGroup = $(`<div class="charsheet__builder-equipment-choice"></div>`);

					choiceKeys.forEach((key, choiceIdx) => {
						const choiceLabel = this._getEquipmentChoiceLabel(choiceData[key], key);
						const isSelected = this._equipmentChoices[idx] === key || (!this._equipmentChoices[idx] && choiceIdx === 0);

						if (!this._equipmentChoices[idx]) {
							this._equipmentChoices[idx] = choiceKeys[0]; // Default to first choice
						}

						const $option = $(`
							<label class="charsheet__builder-equipment-option ve-flex-v-center mb-1">
								<input type="radio" name="equipment-choice-${idx}" value="${key}" ${isSelected ? "checked" : ""} class="mr-2">
								<span>(${key}) ${Renderer.get().render(choiceLabel)}</span>
							</label>
						`);

						$option.find("input").on("change", () => {
							this._equipmentChoices[idx] = key;
						});

						$choiceGroup.append($option);
					});

					$row.append($choiceGroup);
				} else if (choiceData._) {
					// Fixed equipment (no choice)
					const label = this._getEquipmentChoiceLabel(choiceData._, "_");
					$row.append(`<p>${Renderer.get().render(label)}</p>`);
				}
			} else {
				// Not a choice, just display the entry
				$row.append(`<p>${Renderer.get().render(entry)}</p>`);
			}

			$container.append($row);
		});

		// Add gold alternative option if available
		if (this._selectedClass.startingEquipment.goldAlternative) {
			const $goldOption = $(`
				<div class="charsheet__builder-equipment-gold mt-3">
					<label class="ve-flex-v-center">
						<input type="checkbox" id="equipment-gold-alt" class="mr-2">
						<span>Take starting gold instead: ${Renderer.get().render(this._selectedClass.startingEquipment.goldAlternative)}</span>
					</label>
				</div>
			`);

			$goldOption.find("input").on("change", (e) => {
				this._useGoldAlternative = e.target.checked;
			});

			$container.append($goldOption);
		}
	}

	_getEquipmentChoiceLabel (items, key) {
		if (!Array.isArray(items)) return String(items);

		return items.map(item => {
			if (typeof item === "string") {
				// Item reference like "chain mail|phb"
				const [name] = item.split("|");
				return `{@item ${item}|${name}}`;
			} else if (item.equipmentType) {
				// Generic equipment type
				const typeLabels = {
					"weaponSimple": "any simple weapon",
					"weaponMartial": "any martial weapon",
					"weaponSimpleMelee": "any simple melee weapon",
					"weaponMartialMelee": "any martial melee weapon",
					"armorLight": "any light armor",
					"armorMedium": "any medium armor",
					"armorHeavy": "any heavy armor",
					"instrumentMusical": "any musical instrument",
					"toolArtisan": "any artisan's tools",
				};
				const label = typeLabels[item.equipmentType] || item.equipmentType;
				return item.quantity > 1 ? `${item.quantity} ${label}s` : label;
			} else if (item.item) {
				// Item with quantity
				const [name] = item.item.split("|");
				return item.quantity > 1 ? `${item.quantity} {@item ${item.item}|${name}}` : `{@item ${item.item}|${name}}`;
			} else {
				return JSON.stringify(item);
			}
		}).join(", ");
	}

	_getClassEquipmentHtml () {
		// This is now handled by _renderClassEquipmentChoices
		return "";
	}

	_getBackgroundEquipmentHtml () {
		if (!this._selectedBackground?.startingEquipment) {
			return "<p class='ve-muted'>No starting equipment defined</p>";
		}

		return Renderer.get().render({entries: this._selectedBackground.startingEquipment});
	}

	// #endregion

	// #region Step 6: Details
	_renderDetailsStep ($content) {
		const $container = $(`
			<div class="ve-flex">
				<div class="ve-flex-col" style="flex: 1; padding-right: 1rem;">
					<div class="charsheet__section">
						<h5>Character Name</h5>
						<input type="text" class="form-control" id="builder-name" placeholder="Enter character name" value="${this._state.getName()}">
					</div>
					
					<div class="charsheet__section mt-3">
						<h5>Personality Traits</h5>
						<textarea class="form-control" id="builder-personality" rows="3" placeholder="Describe your character's personality...">${this._state.getNote("personality")}</textarea>
					</div>
					
					<div class="charsheet__section mt-3">
						<h5>Ideals</h5>
						<textarea class="form-control" id="builder-ideals" rows="2" placeholder="What does your character believe in?">${this._state.getNote("ideals")}</textarea>
					</div>
					
					<div class="charsheet__section mt-3">
						<h5>Bonds</h5>
						<textarea class="form-control" id="builder-bonds" rows="2" placeholder="What connections does your character have?">${this._state.getNote("bonds")}</textarea>
					</div>
					
					<div class="charsheet__section mt-3">
						<h5>Flaws</h5>
						<textarea class="form-control" id="builder-flaws" rows="2" placeholder="What are your character's weaknesses?">${this._state.getNote("flaws")}</textarea>
					</div>
				</div>
				
				<div class="ve-flex-col" style="flex: 1;">
					<div class="charsheet__section">
						<h5>Appearance</h5>
						<div class="ve-flex mb-2">
							<div class="ve-flex-col mr-2" style="flex: 1;">
								<label class="ve-muted ve-small">Age</label>
								<input type="number" min="0" class="form-control form-control--minimal" id="builder-age" value="${this._state.getAppearance("age")}" placeholder="Years">
							</div>
							<div class="ve-flex-col mr-2" style="flex: 1;">
								<label class="ve-muted ve-small">Height (ft)</label>
								<input type="number" min="0" step="0.1" class="form-control form-control--minimal" id="builder-height" value="${this._state.getAppearance("height")}" placeholder="Feet">
							</div>
							<div class="ve-flex-col" style="flex: 1;">
								<label class="ve-muted ve-small">Weight (lbs)</label>
								<input type="number" min="0" class="form-control form-control--minimal" id="builder-weight" value="${this._state.getAppearance("weight")}" placeholder="Pounds">
							</div>
						</div>
						<div class="ve-flex">
							<div class="ve-flex-col mr-2" style="flex: 1;">
								<label class="ve-muted ve-small">Eyes</label>
								<input type="text" class="form-control form-control--minimal" id="builder-eyes" value="${this._state.getAppearance("eyes")}">
							</div>
							<div class="ve-flex-col mr-2" style="flex: 1;">
								<label class="ve-muted ve-small">Skin</label>
								<input type="text" class="form-control form-control--minimal" id="builder-skin" value="${this._state.getAppearance("skin")}">
							</div>
							<div class="ve-flex-col" style="flex: 1;">
								<label class="ve-muted ve-small">Hair</label>
								<input type="text" class="form-control form-control--minimal" id="builder-hair" value="${this._state.getAppearance("hair")}">
							</div>
						</div>
					</div>
					
					<div class="charsheet__section mt-3">
						<h5>Backstory</h5>
						<textarea class="form-control" id="builder-backstory" rows="8" placeholder="Write your character's backstory...">${this._state.getNote("backstory")}</textarea>
					</div>
				</div>
			</div>
		`);

		$content.append($container);

		// Save values on change
		$("#builder-name").on("change", (e) => this._state.setName(e.target.value));
		$("#builder-personality").on("change", (e) => this._state.setNote("personality", e.target.value));
		$("#builder-ideals").on("change", (e) => this._state.setNote("ideals", e.target.value));
		$("#builder-bonds").on("change", (e) => this._state.setNote("bonds", e.target.value));
		$("#builder-flaws").on("change", (e) => this._state.setNote("flaws", e.target.value));
		$("#builder-backstory").on("change", (e) => this._state.setNote("backstory", e.target.value));

		["age", "height", "weight", "eyes", "skin", "hair"].forEach(field => {
			$(`#builder-${field}`).on("change", (e) => this._state.setAppearance(field, e.target.value));
		});
	}
	// #endregion
}

globalThis.CharacterSheetBuilder = CharacterSheetBuilder;

export {CharacterSheetBuilder};
