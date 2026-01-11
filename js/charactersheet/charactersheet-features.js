/**
 * Character Sheet Features Manager
 * Handles class features, racial traits, feats, and other abilities
 */
class CharacterSheetFeatures {
	constructor (page) {
		this._page = page;
		this._state = page.getState();
		this._allFeats = [];
		this._expandedFeatures = new Set();

		this._init();
	}

	_init () {
		this._initEventListeners();
	}

	setFeats (feats) {
		this._allFeats = feats;
	}

	/**
	 * Look up a class feature's description from loaded data
	 */
	_getClassFeatureDescription (feature) {
		const classFeatures = this._page.getClassFeatures();
		if (!classFeatures?.length) return null;

		const match = classFeatures.find(f =>
			f.name === feature.name &&
			f.className === feature.className &&
			f.level === feature.level,
		);

		if (match?.entries) {
			return Renderer.get().render({entries: match.entries});
		}
		return null;
	}

	/**
	 * Look up a subclass feature's description from loaded data
	 */
	_getSubclassFeatureDescription (feature) {
		const subclassFeatures = this._page.getSubclassFeatures();
		if (!subclassFeatures?.length) return null;

		const match = subclassFeatures.find(f =>
			f.name === feature.name &&
			f.className === feature.className &&
			f.subclassShortName === (feature.subclassShortName || feature.subclassName) &&
			f.level === feature.level,
		);

		if (match?.entries) {
			return Renderer.get().render({entries: match.entries});
		}
		return null;
	}

	/**
	 * Look up a feat's description from loaded data
	 */
	_getFeatDescription (feat) {
		const allFeats = this._allFeats;
		if (!allFeats?.length) return null;

		const match = allFeats.find(f =>
			f.name === feat.name &&
			f.source === feat.source,
		);

		if (match?.entries) {
			return Renderer.get().render({type: "entries", entries: match.entries});
		}
		return null;
	}

	/**
	 * Get the description for a feature, looking it up if not stored
	 */
	_getFeatureDescription (feature) {
		// If description is already stored, use it
		if (feature.description) return feature.description;

		// Try to look up the description based on feature type
		if (feature.featureType === "Class" && feature.className) {
			if (feature.isSubclassFeature || feature.subclassName) {
				return this._getSubclassFeatureDescription(feature);
			}
			return this._getClassFeatureDescription(feature);
		}

		return null;
	}

	_initEventListeners () {
		// Add feat button
		$(document).on("click", "#charsheet-add-feat", () => this._showFeatPicker());

		// Toggle feature expansion - only on the chevron toggle button
		$(document).on("click", ".charsheet__feature-toggle", (e) => {
			e.stopPropagation();
			const $feature = $(e.currentTarget).closest(".charsheet__feature");
			const featureId = $feature.data("feature-id");
			this._toggleFeatureExpansion(featureId);
		});

		// Also toggle on header click, but not if clicking a link
		$(document).on("click", ".charsheet__feature-header", (e) => {
			// Don't toggle if clicking on a link, button, or actions area
			if ($(e.target).closest("a, button, .charsheet__feature-actions").length) return;
			const $feature = $(e.currentTarget).closest(".charsheet__feature");
			const featureId = $feature.data("feature-id");
			this._toggleFeatureExpansion(featureId);
		});

		// Remove feature
		$(document).on("click", ".charsheet__feature-remove", (e) => {
			e.stopPropagation();
			const featureId = $(e.currentTarget).closest(".charsheet__feature").data("feature-id");
			this._removeFeature(featureId);
		});

		// Use feature (for features with limited uses)
		$(document).on("click", ".charsheet__feature-use", (e) => {
			e.stopPropagation();
			const featureId = $(e.currentTarget).closest(".charsheet__feature").data("feature-id");
			this._useFeature(featureId);
		});

		// Resource management
		$(document).on("click", ".charsheet__resource-pip", (e) => {
			const $pip = $(e.currentTarget);
			const resourceId = $pip.closest(".charsheet__resource").data("resource-id");
			this._toggleResourcePip(resourceId, $pip);
		});
	}

	_toggleFeatureExpansion (featureId) {
		const $feature = $(`.charsheet__feature[data-feature-id="${featureId}"]`);
		const $body = $feature.find(".charsheet__feature-body");
		const $toggle = $feature.find(".charsheet__feature-toggle");

		if (this._expandedFeatures.has(featureId)) {
			this._expandedFeatures.delete(featureId);
			$body.slideUp(200);
			$toggle.removeClass("glyphicon-chevron-up").addClass("glyphicon-chevron-down");
		} else {
			this._expandedFeatures.add(featureId);
			$body.slideDown(200);
			$toggle.removeClass("glyphicon-chevron-down").addClass("glyphicon-chevron-up");
		}
	}

	async _showFeatPicker () {
		await this._pShowFeatPickerModal();
	}

	async _pShowFeatPickerModal () {
		const knownFeatNames = this._state.getFeats().map(f => f.name.toLowerCase());

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "Add Feat",
			isMinHeight0: true,
		});

		const $search = $(`<input type="text" class="form-control form-control--minimal mb-3" placeholder="Search feats...">`);
		$search.appendTo($modalInner);
		const $list = $(`<div class="feat-picker-list" style="max-height: 400px; overflow-y: auto;"></div>`).appendTo($modalInner);

		// Filter feats by allowed sources
		const sourceFilteredFeats = this._page.filterByAllowedSources(this._allFeats);

		const renderList = (filter = "") => {
			$list.empty();

			const filtered = sourceFilteredFeats.filter(feat => {
				if (filter && !feat.name.toLowerCase().includes(filter.toLowerCase())) return false;
				return true;
			});

			if (!filtered.length) {
				$list.append(`<p class="ve-muted text-center">No feats found</p>`);
				return;
			}

			filtered.forEach(feat => {
				const isKnown = knownFeatNames.includes(feat.name.toLowerCase());

				const $item = $(`
					<div class="ve-flex-v-center p-2 ${isKnown ? "ve-muted" : "clickable"}" style="border-bottom: 1px solid var(--rgb-border-grey);">
						<div class="ve-flex-col" style="flex: 1;">
							<span class="bold">${feat.name}</span>
							<span class="ve-small ve-muted">
								${feat.prerequisite ? `Prereq: ${this._formatPrerequisite(feat.prerequisite)}` : ""}
								${Parser.sourceJsonToAbv(feat.source)}
							</span>
						</div>
						${isKnown
							? `<span class="ve-muted">Known</span>`
							: `<button class="ve-btn ve-btn-primary ve-btn-xs feat-picker-add">Add</button>`
						}
					</div>
				`);

				if (!isKnown) {
					$item.find(".feat-picker-add").on("click", () => {
						this._addFeat(feat);
						knownFeatNames.push(feat.name.toLowerCase());
						$item.addClass("ve-muted");
						$item.find(".feat-picker-add").replaceWith(`<span class="ve-muted">Known</span>`);
						JqueryUtil.doToast({type: "success", content: `Added ${feat.name}`});
					});

					$item.on("click", (e) => {
						if (!$(e.target).is("button")) {
							this._showFeatInfo(feat);
						}
					});
				}

				$list.append($item);
			});
		};

		$search.on("input", () => renderList($search.val()));
		renderList();

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			<button class="ve-btn ve-btn-default">Close</button>
		</div>`.appendTo($modalInner).find("button").on("click", () => doClose(false));
	}

	_formatPrerequisite (prereq) {
		if (!prereq?.length) return "";

		return prereq.map(p => {
			const parts = [];
			if (p.ability) {
				p.ability.forEach(a => {
					Object.entries(a).forEach(([abi, score]) => {
						parts.push(`${Parser.attAbvToFull(abi)} ${score}+`);
					});
				});
			}
			if (p.spellcasting) parts.push("Spellcasting");
			if (p.proficiency) {
				p.proficiency.forEach(prof => {
					if (prof.armor) parts.push(`${prof.armor} armor proficiency`);
					if (prof.weapon) parts.push(`${prof.weapon} weapon proficiency`);
				});
			}
			if (p.race) {
				p.race.forEach(r => parts.push(r.name));
			}
			if (p.level) {
				parts.push(`Level ${p.level.level}+`);
			}
			return parts.join(", ");
		}).join("; ");
	}

	_addFeat (feat) {
		const newFeat = {
			name: feat.name,
			source: feat.source,
			description: feat.entries ? Renderer.get().render({type: "entries", entries: feat.entries}) : "",
		};

		// Apply ability score increases
		if (feat.ability) {
			feat.ability.forEach(abiSet => {
				Object.entries(abiSet).forEach(([abi, bonus]) => {
					if (Parser.ABIL_ABVS.includes(abi) && typeof bonus === "number") {
						const current = this._state.getAbilityBase(abi);
						this._state.setAbilityBase(abi, Math.min(20, current + bonus));
					}
				});
			});
		}

		this._state.addFeat(newFeat);
		this.render();
		this._page.saveCharacter();
	}

	async _showFeatInfo (feat) {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: feat.name,
			isMinHeight0: true,
		});

		if (feat.prerequisite) {
			$modalInner.append(`<p class="ve-muted"><em>Prerequisite: ${this._formatPrerequisite(feat.prerequisite)}</em></p>`);
		}
		if (feat.entries) {
			$modalInner.append(`<div class="rd__b">${Renderer.get().render({type: "entries", entries: feat.entries})}</div>`);
		}

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			<button class="ve-btn ve-btn-default">Close</button>
		</div>`.appendTo($modalInner).find("button").on("click", () => doClose(false));
	}

	_removeFeature (featureId) {
		this._state.removeFeature(featureId);
		this.render();
		this._page.saveCharacter();
	}

	_useFeature (featureId) {
		// For features with limited uses, decrement the use count
		const features = this._state.getFeatures();
		const feature = features.find(f => f.id === featureId);
		if (!feature || !feature.uses) return;

		if (feature.uses.current > 0) {
			// Use state method to persist the change
			this._state.setFeatureUses(featureId, feature.uses.current - 1);
			this.render();
			this._page.saveCharacter();
		} else {
			JqueryUtil.doToast({type: "warning", content: `No uses of ${feature.name} remaining!`});
		}
	}

	_toggleResourcePip (resourceId, $pip) {
		const resources = this._state.getResources();
		const resource = resources.find(r => r.id === resourceId);
		if (!resource) return;

		const $container = $pip.closest(".charsheet__resource");
		const $pips = $container.find(".charsheet__resource-pip");
		const pipIndex = $pips.index($pip);

		let newCurrent;
		if ($pip.hasClass("used")) {
			// Restore this pip and all pips after it
			$pips.slice(pipIndex).removeClass("used");
			newCurrent = resource.max - pipIndex;
		} else {
			// Use this pip and all pips before it
			$pips.slice(0, pipIndex + 1).addClass("used");
			newCurrent = resource.max - pipIndex - 1;
		}

		// Use state method to persist the change
		this._state.setResourceCurrent(resourceId, newCurrent);
		this._page.saveCharacter();
	}

	// #region Rendering
	render () {
		this._renderClassFeatures();
		this._renderRaceFeatures();
		this._renderBackgroundFeatures();
		this._renderFeats();
		this._renderResources();
		this._renderProficiencies();
		this._renderLanguages();
		this._renderFeaturesSummary();
	}

	_renderClassFeatures () {
		const $container = $("#charsheet-class-features");
		if (!$container.length) return;

		$container.empty();

		const classes = this._state.getClasses();
		const allFeatures = this._state.getFeatures();
		const classNames = classes.map(c => c.name?.toLowerCase()).filter(Boolean);

		console.log("[CharSheet Features] Rendering class features:", {
			classCount: classes.length,
			classNames,
			totalFeatures: allFeatures.length,
			features: allFeatures.map(f => ({name: f.name, featureType: f.featureType, className: f.className, source: f.source, level: f.level})),
		});

		// Filter for class features - be lenient for compatibility with old saves
		// Old saves may have features without explicit featureType markers
		const features = allFeatures.filter(f => {
			// Explicitly marked as Class feature
			if (f.featureType === "Class") return true;
			// Optional Features (invocations, metamagic, etc.) are displayed with class features
			if (f.featureType === "Optional Feature") return true;
			// Has className property (primary indicator of a class feature)
			if (f.className) return true;
			// Has classSource property
			if (f.classSource) return true;
			// Has a level property (class features have levels, racial/background don't)
			if (f.level && typeof f.level === "number") return true;
			// Exclude features explicitly marked as other types
			if (f.featureType === "Race" || f.featureType === "Background" || f.featureType === "Feat") return false;
			// For old saves without markers: if we have classes but this feature isn't marked as race/background,
			// and there are no race/background features with this name, treat it as a class feature
			if (classes.length > 0 && !f.featureType) {
				// Check if this might be a known class feature by source containing class name
				if (f.source) {
					const sourceLower = f.source.toLowerCase();
					if (classNames.some(cn => sourceLower.includes(cn))) return true;
				}
				// Default: include unmarked features when character has classes
				// This handles old saves where features weren't typed
				return true;
			}
			return false;
		});

		console.log("[CharSheet Features] Filtered class features:", features.length, features);

		if (!classes.length) {
			$container.append(`<div class="ve-muted ve-text-center py-2">Select a class to see features</div>`);
			return;
		}

		if (!features.length) {
			$container.append(`<div class="ve-muted ve-text-center py-2">No class features yet</div>`);
			return;
		}

		// Separate regular class features from optional features (invocations, metamagic, etc.)
		const regularFeatures = features.filter(f => f.featureType !== "Optional Feature");
		const optionalFeatures = features.filter(f => f.featureType === "Optional Feature");

		// Separate feature options (like Specialties) from standalone features
		const standaloneFeatures = regularFeatures.filter(f => !f.parentFeature);
		const featureOptions = regularFeatures.filter(f => f.parentFeature);

		// Render standalone class features
		standaloneFeatures.forEach(feature => {
			const $feature = this._renderFeature(feature);
			$container.append($feature);
		});

		// Group and render feature options by parentFeature
		if (featureOptions.length > 0) {
			const featureOptionGroups = {};
			featureOptions.forEach(f => {
				const groupKey = f.parentFeature;
				if (!featureOptionGroups[groupKey]) {
					featureOptionGroups[groupKey] = {name: groupKey, features: []};
				}
				featureOptionGroups[groupKey].features.push(f);
			});

			// Render each group
			Object.values(featureOptionGroups).forEach(group => {
				const $groupContainer = $(`
					<div class="charsheet__feature-group mb-3">
						<div class="charsheet__feature-group-header">
							<span class="glyphicon glyphicon-list-alt"></span> ${group.name}
							<span class="badge badge-info">${group.features.length}</span>
						</div>
						<div class="charsheet__feature-group-body"></div>
					</div>
				`);
				const $groupBody = $groupContainer.find(".charsheet__feature-group-body");
				
				group.features.forEach(feature => {
					const $feature = this._renderFeature(feature);
					$groupBody.append($feature);
				});
				
				$container.append($groupContainer);
			});
		}

		// Group and render optional features by type
		if (optionalFeatures.length > 0) {
			// Group by optional feature types
			const optFeatureGroups = {};
			optionalFeatures.forEach(f => {
				// Get the group name from optionalFeatureTypes or use a default
				const groupKey = f.optionalFeatureTypes?.join("_") || "other";
				const groupName = this._getOptionalFeatureGroupName(f.optionalFeatureTypes);
				if (!optFeatureGroups[groupKey]) {
					optFeatureGroups[groupKey] = {name: groupName, features: []};
				}
				optFeatureGroups[groupKey].features.push(f);
			});

			// Render each group
			Object.values(optFeatureGroups).forEach(group => {
				const $groupContainer = $(`
					<div class="charsheet__feature-group mb-3">
						<div class="charsheet__feature-group-header">
							<span class="glyphicon glyphicon-list-alt"></span> ${group.name}
							<span class="badge badge-info">${group.features.length}</span>
						</div>
						<div class="charsheet__feature-group-body"></div>
					</div>
				`);
				const $groupBody = $groupContainer.find(".charsheet__feature-group-body");
				
				group.features.forEach(feature => {
					const $feature = this._renderFeature(feature);
					$groupBody.append($feature);
				});
				
				$container.append($groupContainer);
			});
		}
	}

	_renderRaceFeatures () {
		const $container = $("#charsheet-race-features");
		if (!$container.length) return;

		$container.empty();

		// Include Species, Subrace, and legacy "Race" features
		const features = this._state.getFeatures().filter(f =>
			f.featureType === "Species" ||
			f.featureType === "Subrace" ||
			f.featureType === "Race",
		);
		const race = this._state.getRace();

		if (!race) {
			$container.append(`<div class="ve-muted ve-text-center py-2">Select a species to see traits</div>`);
			return;
		}

		if (!features.length) {
			$container.append(`<div class="ve-muted ve-text-center py-2">No species traits yet</div>`);
			return;
		}

		features.forEach(feature => {
			const $feature = this._renderFeature(feature);
			$container.append($feature);
		});
	}

	_renderBackgroundFeatures () {
		const $container = $("#charsheet-background-features");
		if (!$container.length) return;

		$container.empty();

		const features = this._state.getFeatures().filter(f => f.featureType === "Background");
		const background = this._state.getBackground();

		if (!background) {
			$container.append(`<div class="ve-muted ve-text-center py-2">Select a background to see feature</div>`);
			return;
		}

		if (!features.length) {
			$container.append(`<div class="ve-muted ve-text-center py-2">No background feature yet</div>`);
			return;
		}

		features.forEach(feature => {
			const $feature = this._renderFeature(feature);
			$container.append($feature);
		});
	}

	_renderFeaturesSummary () {
		const $container = $("#charsheet-features-summary");
		if (!$container.length) return;

		$container.empty();

		const features = this._state.getFeatures();
		const classes = this._state.getClasses();
		const race = this._state.getRace();

		if (!classes.length && !race) {
			$container.append(`<div class="ve-muted ve-text-center py-2">Build your character to see features</div>`);
			return;
		}

		if (!features.length) {
			$container.append(`<div class="ve-muted ve-text-center py-2">No features yet</div>`);
			return;
		}

		// Helper to create feature link - always display feature name
		const getFeatureHtml = (feature) => {
			let featureNameHtml = feature.name;
			if (this._page?.getHoverLink) {
				try {
					// Species/Race features link to races page - but SHOW THE FEATURE NAME
					if (feature.featureType === "Species" || feature.featureType === "Race" || feature.featureType === "Subrace") {
						const race = this._state.getRace();
						if (race) {
							// Create link that shows feature name but hovers/links to race
							const raceHash = UrlUtil.encodeForHash([race.name, race.source || Parser.SRC_XPHB].join(HASH_LIST_SEP));
							const hoverAttrs = Renderer.hover.getHoverElementAttributes({page: UrlUtil.PG_RACES, source: race.source || Parser.SRC_XPHB, hash: raceHash});
							featureNameHtml = `<a href="${UrlUtil.PG_RACES}#${raceHash}" ${hoverAttrs}>${feature.name}</a>`;
						}
					// Class/Subclass features
					} else if (feature.source && feature.className) {
						const hashInput = {
							name: feature.name,
							className: feature.className,
							classSource: feature.classSource || feature.source || Parser.SRC_XPHB,
							level: feature.level || 1,
							source: feature.source,
						};
						if (feature.subclassName) {
							hashInput.subclassShortName = feature.subclassShortName || feature.subclassName;
							hashInput.subclassSource = feature.subclassSource || feature.source;
						}
						const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASS_SUBCLASS_FEATURES](hashInput);
						featureNameHtml = this._page.getHoverLink(
							UrlUtil.PG_CLASS_SUBCLASS_FEATURES,
							feature.name,
							feature.source,
							hash,
						);
					// Background features - show feature name but link to background
					} else if (feature.featureType === "Background") {
						const background = this._state.getBackground();
						if (background) {
							const bgHash = UrlUtil.encodeForHash([background.name, background.source || Parser.SRC_XPHB].join(HASH_LIST_SEP));
							const hoverAttrs = Renderer.hover.getHoverElementAttributes({page: UrlUtil.PG_BACKGROUNDS, source: background.source || Parser.SRC_XPHB, hash: bgHash});
							featureNameHtml = `<a href="${UrlUtil.PG_BACKGROUNDS}#${bgHash}" ${hoverAttrs}>${feature.name}</a>`;
						}
					}
				} catch (e) {
					// Fall back to plain name
				}
			}
			return featureNameHtml;
		};

		// Define important features - features with limited uses, or key combat/exploration features
		const importantKeywords = [
			"darkvision", "resistance", "advantage", "immunity", "bonus action",
			"reaction", "rage", "sneak attack", "divine sense", "lay on hands",
			"channel divinity", "wild shape", "action surge", "second wind",
			"bardic inspiration", "cunning action", "uncanny dodge", "evasion",
			"metamagic", "sorcery points", "ki", "smite", "spellcasting",
			"fighting style", "extra attack", "eldritch invocation",
		];

		const isImportantFeature = (feature) => {
			// Features with limited uses are important
			if (feature.uses && feature.uses.max > 0) return true;
			// Explicitly marked important
			if (feature.important) return true;
			// Key features by name
			const nameLower = feature.name.toLowerCase();
			return importantKeywords.some(keyword => nameLower.includes(keyword));
		};

		// Get important features grouped by type
		const importantFeatures = features.filter(isImportantFeature);

		// Group by feature type
		const byType = {
			"Class": [],
			"Species": [],
			"Subrace": [],
			"Background": [],
			"Other": [],
		};

		importantFeatures.forEach(f => {
			const type = f.featureType || "Other";
			if (byType[type]) {
				byType[type].push(f);
			} else {
				byType.Other.push(f);
			}
		});

		let hasContent = false;

		// Render Class features first (most relevant for gameplay)
		if (byType.Class.length) {
			hasContent = true;
			$container.append(`<div class="ve-small ve-muted mb-1"><strong>Class</strong></div>`);
			byType.Class.slice(0, 5).forEach(feature => {
				const usesStr = feature.uses ? ` <span class="ve-muted">(${feature.uses.current}/${feature.uses.max})</span>` : "";
				$container.append(`<div class="charsheet__feature-summary-item">${getFeatureHtml(feature)}${usesStr}</div>`);
			});
			if (byType.Class.length > 5) {
				$container.append(`<div class="ve-muted ve-small">+${byType.Class.length - 5} more class features</div>`);
			}
		}

		// Then Species/Race features
		const speciesFeatures = [...byType.Species, ...byType.Subrace];
		if (speciesFeatures.length) {
			hasContent = true;
			$container.append(`<div class="ve-small ve-muted mb-1 ${byType.Class.length ? "mt-2" : ""}"><strong>Species</strong></div>`);
			speciesFeatures.slice(0, 3).forEach(feature => {
				$container.append(`<div class="charsheet__feature-summary-item">${getFeatureHtml(feature)}</div>`);
			});
			if (speciesFeatures.length > 3) {
				$container.append(`<div class="ve-muted ve-small">+${speciesFeatures.length - 3} more species features</div>`);
			}
		}

		// Background features
		if (byType.Background.length) {
			hasContent = true;
			$container.append(`<div class="ve-small ve-muted mb-1 mt-2"><strong>Background</strong></div>`);
			byType.Background.slice(0, 2).forEach(feature => {
				$container.append(`<div class="charsheet__feature-summary-item">${getFeatureHtml(feature)}</div>`);
			});
		}

		// Fallback if no important features found
		if (!hasContent) {
			// Show a representative sample from each type
			const classFeatures = features.filter(f => f.featureType === "Class").slice(0, 3);
			const raceFeatures = features.filter(f => f.featureType === "Species" || f.featureType === "Subrace").slice(0, 2);

			[...classFeatures, ...raceFeatures].forEach(feature => {
				$container.append(`<div class="charsheet__feature-summary-item">${getFeatureHtml(feature)}</div>`);
			});

			if (features.length > 5) {
				$container.append(`<div class="ve-muted ve-small text-center">View all ${features.length} features in Features tab</div>`);
			}
		}
	}

	/**
	 * Get a human-readable name for optional feature types
	 */
	_getOptionalFeatureGroupName (featureTypes) {
		if (!featureTypes?.length) return "Other Features";

		// Map of feature type codes to human-readable names
		const typeNames = {
			"EI": "Eldritch Invocations",
			"MM": "Metamagic Options",
			"MV:B": "Battle Master Maneuvers",
			"MV:C2-UA": "Cavalier Maneuvers",
			"AS:V1-UA": "Arcane Shot Options",
			"AS:V2-UA": "Arcane Shot Options",
			"AS": "Arcane Shot Options",
			"OTH": "Other Options",
			"ED": "Elemental Disciplines",
			"PB": "Pact Boons",
			"AI": "Artificer Infusions",
			"FS:F": "Fighter Fighting Styles",
			"FS:P": "Paladin Fighting Styles",
			"FS:R": "Ranger Fighting Styles",
			"FS:B": "Bard Fighting Styles",
			"RN": "Rune Knight Runes",
			"AF": "Alchemist Formulas",
		};

		// Combat tradition names (Thelemar homebrew)
		const traditionNames = {
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

		// Check for Combat Methods (CTM:X patterns) - group by tradition
		for (const ft of featureTypes) {
			const ctmMatch = ft.match(/^CTM:\d([A-Z]{2})$/);
			if (ctmMatch) {
				const tradCode = ctmMatch[1];
				const tradName = traditionNames[tradCode] || tradCode;
				return `Combat Methods: ${tradName}`;
			}
		}

		// Try to find a matching name
		for (const ft of featureTypes) {
			if (typeNames[ft]) return typeNames[ft];
		}

		// Fall back to the raw type names
		return featureTypes.map(ft => ft.replace(/:/g, " ")).join(", ");
	}

	_renderFeature (feature) {
		const isExpanded = this._expandedFeatures.has(feature.id);
		const hasUses = feature.uses && feature.uses.max > 0;

		let featureNameHtml = feature.name;
		if (this._page?.getHoverLink) {
			try {
				// Class/Subclass features - link to the actual class feature page
				if (feature.featureType === "Class" && feature.className) {
					const hashInput = {
						name: feature.name,
						className: feature.className,
						classSource: feature.classSource || feature.source || Parser.SRC_XPHB,
						level: feature.level || 1,
						source: feature.source || Parser.SRC_XPHB,
					};
					if (feature.subclassName || feature.isSubclassFeature) {
						hashInput.subclassShortName = feature.subclassShortName || feature.subclassName;
						hashInput.subclassSource = feature.subclassSource || feature.source || Parser.SRC_XPHB;
					}
					const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASS_SUBCLASS_FEATURES](hashInput);
					featureNameHtml = this._page.getHoverLink(
						UrlUtil.PG_CLASS_SUBCLASS_FEATURES,
						feature.name,
						feature.source || Parser.SRC_XPHB,
						hash,
					);
				// Species/Race features - link to races page with hover
				} else if (feature.featureType === "Species" || feature.featureType === "Race" || feature.featureType === "Subrace") {
					const race = this._state.getRace();
					if (race) {
						// Use getHoverLink but display the feature name
						const raceHash = UrlUtil.encodeForHash([race.name, race.source || Parser.SRC_XPHB].join(HASH_LIST_SEP));
						const hoverAttrs = Renderer.hover.getHoverElementAttributes({page: UrlUtil.PG_RACES, source: race.source || Parser.SRC_XPHB, hash: raceHash});
						featureNameHtml = `<a href="${UrlUtil.PG_RACES}#${raceHash}" ${hoverAttrs}>${feature.name}</a>`;
					}
				// Background features - link to background page with hover
				} else if (feature.featureType === "Background") {
					const background = this._state.getBackground();
					if (background) {
						const bgHash = UrlUtil.encodeForHash([background.name, background.source || Parser.SRC_XPHB].join(HASH_LIST_SEP));
						const hoverAttrs = Renderer.hover.getHoverElementAttributes({page: UrlUtil.PG_BACKGROUNDS, source: background.source || Parser.SRC_XPHB, hash: bgHash});
						featureNameHtml = `<a href="${UrlUtil.PG_BACKGROUNDS}#${bgHash}" ${hoverAttrs}>${feature.name}</a>`;
					}
				// Optional features (invocations, etc.) - link to optional features page with hover
				} else if (feature.featureType === "Optional Feature") {
					featureNameHtml = this._page.getHoverLink(
						UrlUtil.PG_OPT_FEATURES,
						feature.name,
						feature.source || Parser.SRC_XPHB,
					);
				}
			} catch (e) {
				console.error("[CharSheet Features] Error creating feature link:", e);
				featureNameHtml = feature.name;
			}
		}

		// Get description - look it up if not stored
		const description = this._getFeatureDescription(feature) || "<em class='ve-muted'>No description available</em>";

		return $(`
			<div class="charsheet__feature" data-feature-id="${feature.id}">
				<div class="charsheet__feature-header">
					<span class="charsheet__feature-toggle glyphicon ${isExpanded ? "glyphicon-chevron-down" : "glyphicon-chevron-right"}"></span>
					<span class="charsheet__feature-name">${featureNameHtml}</span>
					${feature.level ? `<span class="badge badge-secondary">Lvl ${feature.level}</span>` : ""}
					${hasUses ? `<span class="badge badge-info">${feature.uses.current}/${feature.uses.max}</span>` : ""}
					<div class="charsheet__feature-actions">
						${hasUses ? `<button class="ve-btn ve-btn-xs ve-btn-primary charsheet__feature-use" title="Use Feature">Use</button>` : ""}
						<button class="ve-btn ve-btn-xs ve-btn-danger charsheet__feature-remove" title="Remove">
							<span class="glyphicon glyphicon-trash"></span>
						</button>
					</div>
				</div>
				<div class="charsheet__feature-body" style="display: ${isExpanded ? "block" : "none"};">
					${description}
				</div>
			</div>
		`);
	}

	_renderFeats () {
		const $container = $("#charsheet-feats, #charsheet-feats-list");
		if (!$container.length) return;

		$container.empty();

		const feats = this._state.getFeats();

		if (!feats.length) {
			$container.append(`<div class="ve-muted ve-text-center py-2">No feats selected</div>`);
			return;
		}

		feats.forEach(feat => {
			const isExpanded = this._expandedFeatures.has(`feat-${feat.id}`);

			// Create hover link for feat name
			let featNameHtml = feat.name;
			if (this._page?.getHoverLink && feat.source) {
				try {
					featNameHtml = this._page.getHoverLink(UrlUtil.PG_FEATS, feat.name, feat.source);
				} catch (e) {
					// Fall back to plain name
				}
			}

			// Get description - look it up if not stored
			const description = feat.description || this._getFeatDescription(feat) || "<em class='ve-muted'>No description available</em>";

			const $feat = $(`
				<div class="charsheet__feat charsheet__feature">
					<div class="charsheet__feat-header charsheet__feature-header">
						<span class="charsheet__feature-toggle glyphicon ${isExpanded ? "glyphicon-chevron-down" : "glyphicon-chevron-right"}"></span>
						<span class="charsheet__feat-name charsheet__feature-name">${featNameHtml}</span>
						<div class="charsheet__feature-actions">
							<button class="ve-btn ve-btn-xs ve-btn-danger charsheet__feat-remove" data-feat-id="${feat.id}">
								<span class="glyphicon glyphicon-trash"></span>
							</button>
						</div>
					</div>
					<div class="charsheet__feat-body charsheet__feature-body" style="display: ${isExpanded ? "block" : "none"};">
						${description}
					</div>
				</div>
			`);

			// Toggle expansion
			$feat.find(".charsheet__feature-toggle").on("click", (e) => {
				e.stopPropagation();
				const featKey = `feat-${feat.id}`;
				const isCurrentlyExpanded = this._expandedFeatures.has(featKey);
				if (isCurrentlyExpanded) {
					this._expandedFeatures.delete(featKey);
				} else {
					this._expandedFeatures.add(featKey);
				}
				this.render();
			});

			$feat.find(".charsheet__feat-remove").on("click", (e) => {
				e.stopPropagation();
				this._state.removeFeat(feat.id);
				this.render();
				this._page.saveCharacter();
			});

			$container.append($feat);
		});
	}

	_renderResources () {
		const $container = $("#charsheet-resources-list");
		if (!$container.length) return;

		$container.empty();

		const resources = this._state.getResources();

		// Check if character has combat methods (for exertion display)
		const features = this._state.getFeatures();
		const hasCombatMethods = features.some(f => {
			if (f.featureType !== "Optional Feature") return false;
			return f.optionalFeatureTypes?.some(ft => /^CTM:\d[A-Z]{2}$/.test(ft));
		});

		// Add exertion as a tracked resource if character has combat methods
		if (hasCombatMethods) {
			const exertionMax = this._state.getExertionMax() || 0;
			const exertionCurrent = this._state.getExertionCurrent() ?? exertionMax;
			const exertionUsed = exertionMax - exertionCurrent;

			if (exertionMax > 0) {
				const $exertion = $(`
					<div class="charsheet__resource" data-resource-id="exertion">
						<div class="charsheet__resource-header">
							<span class="charsheet__resource-name">Exertion</span>
							<span class="charsheet__resource-recharge ve-muted ve-small">Short Rest</span>
						</div>
						<div class="charsheet__resource-pips">
							${Array(exertionMax).fill(0).map((_, i) => `<span class="charsheet__resource-pip charsheet__resource-pip--exertion ${i < exertionUsed ? "used" : ""}" data-pip="${i}"></span>`).join("")}
						</div>
					</div>
				`);

				// Allow clicking pips to toggle exertion
				$exertion.find(".charsheet__resource-pip--exertion").on("click", (e) => {
					const pipIndex = $(e.currentTarget).data("pip");
					const current = this._state.getExertionCurrent() || 0;
					const max = this._state.getExertionMax() || 0;
					// If clicking a used pip, restore up to that point
					// If clicking an available pip, use down to that point
					const used = max - current;
					if (pipIndex < used) {
						// Restore: set current to (max - pipIndex)
						this._state.setExertionCurrent(max - pipIndex);
					} else {
						// Use: set current to (max - pipIndex - 1)
						this._state.setExertionCurrent(max - pipIndex - 1);
					}
					this._renderResources();
					// Also update combat tab display
					if (this._page?._combat) {
						this._page._combat._updateExertionDisplay();
					}
				});

				$container.append($exertion);
			}
		}

		if (!resources.length && !hasCombatMethods) {
			$container.append(`<p class="ve-muted text-center">No class resources</p>`);
			return;
		}

		resources.forEach(resource => {
			const used = resource.max - resource.current;

			const $resource = $(`
				<div class="charsheet__resource" data-resource-id="${resource.id}">
					<div class="charsheet__resource-header">
						<span class="charsheet__resource-name">${resource.name}</span>
						<span class="charsheet__resource-recharge ve-muted ve-small">${resource.recharge === "short" ? "Short Rest" : "Long Rest"}</span>
					</div>
					<div class="charsheet__resource-pips">
						${Array(resource.max).fill(0).map((_, i) => `<span class="charsheet__resource-pip ${i < used ? "used" : ""}"></span>`).join("")}
					</div>
				</div>
			`);

			$container.append($resource);
		});
	}

	_renderProficiencies () {
		// Armor
		const armorProfs = this._state.getArmorProficiencies();
		$("#charsheet-armor-proficiencies").text(armorProfs.length ? armorProfs.join(", ") : "None");

		// Weapons
		const weaponProfs = this._state.getWeaponProficiencies();
		$("#charsheet-weapon-proficiencies").text(weaponProfs.length ? weaponProfs.join(", ") : "None");

		// Tools
		const toolProfs = this._state.getToolProficiencies();
		if (toolProfs.length) {
			$("#charsheet-tool-proficiencies").html(this._renderToolProficiencies(toolProfs));
		} else {
			$("#charsheet-tool-proficiencies").text("None");
		}

		// Saving throws
		const saveProfs = this._state.getSaveProficiencies();
		$("#charsheet-save-proficiencies").text(
			saveProfs.length ? saveProfs.map(s => Parser.attAbvToFull(s)).join(", ") : "None",
		);
	}

	/**
	 * Render tool proficiencies with hover links
	 */
	_renderToolProficiencies (tools) {
		return tools.map(tool => {
			// Try to create a hover link for the tool
			try {
				const toolLower = tool.toLowerCase();
				// Use {@item} tag format for proper rendering
				return Renderer.get().render(`{@item ${toolLower}}`);
			} catch (e) {
				// Fallback to plain text if hover fails
				return tool;
			}
		}).join(", ");
	}

	_renderInlineList (list) {
		return list.map(entry => {
			if (!entry) return "";
			const rendered = Renderer.get().render(entry);
			return rendered.replace(/^<p>|<\/p>$/g, "");
		}).filter(Boolean).join(", ");
	}

	_renderLanguages () {
		const languages = this._state.getLanguages();
		$("#charsheet-languages").text(languages.length ? languages.join(", ") : "None");
	}
	// #endregion
}

globalThis.CharacterSheetFeatures = CharacterSheetFeatures;

export {CharacterSheetFeatures};
