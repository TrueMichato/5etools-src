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
			f.name === feature.name
			&& f.className === feature.className
			&& f.level === feature.level,
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
			f.name === feature.name
			&& f.className === feature.className
			&& f.subclassShortName === (feature.subclassShortName || feature.subclassName)
			&& f.level === feature.level,
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
			f.name === feat.name
			&& f.source === feat.source,
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
			title: "🎖️ Add Feat",
			isMinHeight0: true,
			isWidth100: true,
		});

		// Filter feats by allowed sources
		const sourceFilteredFeats = this._page.filterByAllowedSources(this._allFeats);

		// Unique sources from feats
		const uniqueSources = [...new Set(sourceFilteredFeats.map(f => f.source))].sort((a, b) => {
			const priority = ["PHB", "XGE", "TCE", "FTD", "XPHB"];
			const aIdx = priority.indexOf(a);
			const bIdx = priority.indexOf(b);
			if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
			if (aIdx !== -1) return -1;
			if (bIdx !== -1) return 1;
			return a.localeCompare(b);
		});

		// Get unique categories from feats
		const categories = [...new Set(sourceFilteredFeats.map(f => f.category || "General"))].sort();

		// Intro text
		$modalInner.append(`
			<p class="ve-small ve-muted mb-3">
				Browse and add feats to your character. Click a feat to view details, or click <strong>+ Add</strong> to add it directly.
			</p>
		`);

		// Build enhanced filter UI (matching spell picker)
		const $filterContainer = $(`<div class="charsheet__modal-filter"></div>`).appendTo($modalInner);

		// Helper function to position dropdown towards center of modal
		const positionDropdown = ($dropdown, $btn) => {
			const btnRect = $btn[0].getBoundingClientRect();
			const modalRect = $modalInner[0].getBoundingClientRect();
			const btnCenterX = btnRect.left + btnRect.width / 2;
			const modalCenterX = modalRect.left + modalRect.width / 2;

			if (btnCenterX < modalCenterX) {
				$dropdown.addClass("open-right").removeClass("open-left");
			} else {
				$dropdown.removeClass("open-right").addClass("open-left");
			}
		};

		// Search input with icon
		const $searchWrapper = $(`<div class="charsheet__modal-search"></div>`).appendTo($filterContainer);
		const $search = $(`<input type="text" class="form-control" placeholder="🔍 Search feats by name...">`).appendTo($searchWrapper);

		// Category filter
		let selectedCategories = new Set(); // Empty = all
		const $categoryDropdown = $(`
			<div class="charsheet__source-multiselect charsheet__category-multiselect">
				<button class="charsheet__source-multiselect-btn">
					<span class="charsheet__source-multiselect-icon">📂</span>
					<span class="charsheet__source-multiselect-text">All Categories</span>
					<span class="charsheet__source-multiselect-arrow">▼</span>
				</button>
				<div class="charsheet__source-multiselect-dropdown">
					<div class="charsheet__source-multiselect-actions">
						<button class="charsheet__source-action-btn" data-action="all">Select All</button>
						<button class="charsheet__source-action-btn" data-action="none">Clear All</button>
					</div>
					<div class="charsheet__source-multiselect-list">
						${categories.map(c => `
							<label class="charsheet__source-multiselect-item">
								<input type="checkbox" value="${c}" checked>
								<span class="charsheet__source-multiselect-check">✓</span>
								<span class="charsheet__source-multiselect-label">${c}</span>
							</label>
						`).join("")}
					</div>
				</div>
			</div>
		`).appendTo($filterContainer);

		// Category dropdown behavior
		const $categoryBtn = $categoryDropdown.find(".charsheet__source-multiselect-btn");
		const $categoryDropdownMenu = $categoryDropdown.find(".charsheet__source-multiselect-dropdown");
		const $categoryText = $categoryDropdown.find(".charsheet__source-multiselect-text");

		$categoryBtn.on("click", (e) => {
			e.stopPropagation();
			positionDropdown($categoryDropdownMenu, $categoryBtn);
			$categoryDropdownMenu.toggleClass("open");
			$sourceDropdownMenu?.removeClass("open");
		});

		const updateCategoryText = () => {
			const checked = $categoryDropdown.find("input:checked");
			if (checked.length === 0) {
				$categoryText.text("No Categories");
				selectedCategories = new Set(["__NONE__"]);
			} else if (checked.length === categories.length) {
				$categoryText.text("All Categories");
				selectedCategories = new Set();
			} else if (checked.length <= 2) {
				$categoryText.text(checked.map((_, el) => $(el).val()).get().join(", "));
				selectedCategories = new Set(checked.map((_, el) => $(el).val()).get());
			} else {
				$categoryText.text(`${checked.length} Categories`);
				selectedCategories = new Set(checked.map((_, el) => $(el).val()).get());
			}
			renderList();
		};

		$categoryDropdown.find("input[type=checkbox]").on("change", updateCategoryText);
		$categoryDropdown.find("[data-action=all]").on("click", () => {
			$categoryDropdown.find("input").prop("checked", true);
			updateCategoryText();
		});
		$categoryDropdown.find("[data-action=none]").on("click", () => {
			$categoryDropdown.find("input").prop("checked", false);
			updateCategoryText();
		});
		$categoryDropdownMenu.on("click", (e) => e.stopPropagation());

		// Spacer to push source filter to the right
		$(`<div class="charsheet__filter-spacer" style="flex: 1;"></div>`).appendTo($filterContainer);

		// Source filter (on the right)
		let selectedSources = new Set(); // Empty = all
		const $sourceDropdown = $(`
			<div class="charsheet__source-multiselect">
				<button class="charsheet__source-multiselect-btn">
					<span class="charsheet__source-multiselect-icon">📖</span>
					<span class="charsheet__source-multiselect-text">All Sources</span>
					<span class="charsheet__source-multiselect-arrow">▼</span>
				</button>
				<div class="charsheet__source-multiselect-dropdown charsheet__source-dropdown--right">
					<div class="charsheet__source-multiselect-actions">
						<button class="charsheet__source-action-btn" data-action="all">Select All</button>
						<button class="charsheet__source-action-btn" data-action="none">Clear All</button>
						<button class="charsheet__source-action-btn" data-action="official">Official</button>
					</div>
					<div class="charsheet__source-multiselect-list">
						${uniqueSources.map(s => `
							<label class="charsheet__source-multiselect-item">
								<input type="checkbox" value="${s}" checked>
								<span class="charsheet__source-multiselect-check">✓</span>
								<span class="charsheet__source-multiselect-label">${Parser.sourceJsonToAbv(s)}</span>
								<span class="charsheet__source-multiselect-full">${Parser.sourceJsonToFull(s)}</span>
							</label>
						`).join("")}
					</div>
				</div>
			</div>
		`).appendTo($filterContainer);

		// Source dropdown behavior
		const $sourceBtn = $sourceDropdown.find(".charsheet__source-multiselect-btn");
		const $sourceDropdownMenu = $sourceDropdown.find(".charsheet__source-multiselect-dropdown");
		const $sourceText = $sourceDropdown.find(".charsheet__source-multiselect-text");

		$sourceBtn.on("click", (e) => {
			e.stopPropagation();
			positionDropdown($sourceDropdownMenu, $sourceBtn);
			$sourceDropdownMenu.toggleClass("open");
			$categoryDropdownMenu.removeClass("open");
		});

		$(document).on("click.featSourceFilter", () => {
			$categoryDropdownMenu.removeClass("open");
			$sourceDropdownMenu.removeClass("open");
		});
		$sourceDropdownMenu.on("click", (e) => e.stopPropagation());

		const updateSourceText = () => {
			const checked = $sourceDropdown.find("input:checked");
			if (checked.length === 0) {
				$sourceText.text("No Sources");
				selectedSources = new Set(["__NONE__"]);
			} else if (checked.length === uniqueSources.length) {
				$sourceText.text("All Sources");
				selectedSources = new Set();
			} else if (checked.length <= 2) {
				$sourceText.text(checked.map((_, el) => Parser.sourceJsonToAbv($(el).val())).get().join(", "));
				selectedSources = new Set(checked.map((_, el) => $(el).val()).get());
			} else {
				$sourceText.text(`${checked.length} Sources`);
				selectedSources = new Set(checked.map((_, el) => $(el).val()).get());
			}
			renderList();
		};

		$sourceDropdown.find("input[type=checkbox]").on("change", updateSourceText);
		$sourceDropdown.find("[data-action=all]").on("click", () => {
			$sourceDropdown.find("input").prop("checked", true);
			updateSourceText();
		});
		$sourceDropdown.find("[data-action=none]").on("click", () => {
			$sourceDropdown.find("input").prop("checked", false);
			updateSourceText();
		});
		$sourceDropdown.find("[data-action=official]").on("click", () => {
			const official = ["PHB", "XGE", "TCE", "FTD", "XPHB"];
			$sourceDropdown.find("input").each((_, el) => {
				$(el).prop("checked", official.includes($(el).val()));
			});
			updateSourceText();
		});

		// Quick filter: Prerequisites
		const $quickFilters = $(`<div class="charsheet__modal-quick-filters"></div>`).appendTo($modalInner);
		let filterNoPrereq = false;
		const $noPrereqBtn = $(`<button class="charsheet__modal-filter-btn">🆓 No Prerequisites</button>`).appendTo($quickFilters);

		// Results count
		const $resultsCount = $(`<div class="charsheet__modal-results-count"></div>`).appendTo($modalInner);

		// Feat list
		const $list = $(`<div class="charsheet__modal-list"></div>`).appendTo($modalInner);

		const renderList = () => {
			$list.empty();
			const searchTerm = $search.val().toLowerCase();

			const filtered = sourceFilteredFeats.filter(feat => {
				if (searchTerm && !feat.name.toLowerCase().includes(searchTerm)) return false;
				// Category filter
				if (selectedCategories.has("__NONE__")) return false;
				const featCategory = feat.category || "General";
				if (selectedCategories.size > 0 && !selectedCategories.has(featCategory)) return false;
				// Source filter
				if (selectedSources.has("__NONE__")) return false;
				if (selectedSources.size > 0 && !selectedSources.has(feat.source)) return false;
				// No prereq filter
				if (filterNoPrereq && feat.prerequisite?.length) return false;
				return true;
			});

			const knownCount = filtered.filter(f => knownFeatNames.includes(f.name.toLowerCase())).length;
			$resultsCount.html(`<span>${filtered.length} feat${filtered.length !== 1 ? "s" : ""} found</span>${knownCount > 0 ? `<span class="ml-2" style="color: var(--cs-success);">(${knownCount} already known)</span>` : ""}`);

			if (!filtered.length) {
				$list.html(`
					<div class="charsheet__modal-empty">
						<div class="charsheet__modal-empty-icon">🎖️</div>
						<div class="charsheet__modal-empty-text">No feats match your filters.<br>Try adjusting your search or filters.</div>
					</div>
				`);
				return;
			}

			// Group by category
			const grouped = {};
			filtered.forEach(feat => {
				const category = feat.category || "General";
				if (!grouped[category]) grouped[category] = [];
				grouped[category].push(feat);
			});

			Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0])).forEach(([category, categoryFeats]) => {
				const $section = $(`<div class="charsheet__modal-section"></div>`).appendTo($list);
				$(`<div class="charsheet__modal-section-title">📂 ${category} <span style="opacity: 0.6;">(${categoryFeats.length})</span></div>`).appendTo($section);

				categoryFeats.forEach(feat => {
					const isKnown = knownFeatNames.includes(feat.name.toLowerCase());
					const prereqStr = feat.prerequisite ? this._formatPrerequisite(feat.prerequisite) : "";

					const $item = $(`
						<div class="charsheet__modal-list-item ${isKnown ? "ve-muted" : ""}">
							<div class="charsheet__modal-list-item-icon">🎖️</div>
							<div class="charsheet__modal-list-item-content">
								<div class="charsheet__modal-list-item-title">${feat.name}</div>
								<div class="charsheet__modal-list-item-subtitle">${prereqStr ? `Prereq: ${prereqStr} • ` : ""}${Parser.sourceJsonToAbv(feat.source)}</div>
							</div>
							${isKnown
		? `<span class="charsheet__modal-list-item-badge charsheet__modal-list-item-badge--known">✓ Known</span>`
		: `<button class="ve-btn ve-btn-primary ve-btn-xs feat-picker-add">+ Add</button>`
}
						</div>
					`);

					if (!isKnown) {
						$item.find(".feat-picker-add").on("click", async (e) => {
							e.stopPropagation();
							await this._addFeat(feat);
							knownFeatNames.push(feat.name.toLowerCase());
							$item.addClass("ve-muted");
							$item.find(".feat-picker-add").replaceWith(`<span class="charsheet__modal-list-item-badge charsheet__modal-list-item-badge--known">✓ Known</span>`);
							JqueryUtil.doToast({type: "success", content: `Added ${feat.name}`});
						});

						$item.on("click", (e) => {
							if (!$(e.target).is("button")) {
								this._showFeatInfo(feat);
							}
						});
					}

					$section.append($item);
				});
			});
		};

		// Toggle quick filter button
		$noPrereqBtn.on("click", () => {
			filterNoPrereq = !filterNoPrereq;
			$noPrereqBtn.toggleClass("active", filterNoPrereq);
			renderList();
		});

		$search.on("input", () => renderList());
		renderList();

		// Close button
		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			<button class="ve-btn ve-btn-default">Close</button>
		</div>`.appendTo($modalInner).find("button").on("click", () => {
				$(document).off("click.featSourceFilter");
				doClose(false);
			});
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

	async _addFeat (feat) {
		const newFeat = {
			name: feat.name,
			source: feat.source,
			description: feat.entries ? Renderer.get().render({type: "entries", entries: feat.entries}) : "",
			additionalSpells: feat.additionalSpells, // Preserve for spell processing
		};

		// Apply ability score increases
		if (feat.ability) {
			feat.ability.forEach(abiSet => {
				const max = abiSet.max || 20;
				Object.entries(abiSet).forEach(([abi, bonus]) => {
					if (abi === "max") return; // Skip the max property itself
					if (Parser.ABIL_ABVS.includes(abi) && typeof bonus === "number") {
						const current = this._state.getAbilityBase(abi);
						this._state.setAbilityBase(abi, Math.min(max, current + bonus));
					}
				});
			});
		}

		this._state.addFeat(newFeat);
		this.render();
		this._page.saveCharacter();

		// Check for pending spell choices and trigger the picker
		if (this._state.hasPendingSpellChoices()) {
			// Give UI time to update before showing modal
			await MiscUtil.pDelay(100);
			if (this._page._spells) {
				await this._page._spells.processPendingSpellChoices();
				this.render(); // Re-render after spell selection
			}
		}
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
			f.featureType === "Species"
			|| f.featureType === "Subrace"
			|| f.featureType === "Race",
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

		// Render calculated class statistics (Sneak Attack, Ki DC, etc.) at the top
		this._renderCalculatedStats($container);

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
						// Determine the actual classSource for hover links
						// Priority: 1. feature.classSource (if valid), 2. feature.source if it's a class source, 3. storedClass.source, 4. fallback
						const storedClass = this._state.getClasses().find(c => c.name?.toLowerCase() === feature.className?.toLowerCase());

						// Check if feature.source looks like a class source (official sources like PHB, XPHB)
						// This handles existing characters where classSource wasn't stored correctly
						const officialClassSources = [Parser.SRC_PHB, Parser.SRC_XPHB, "PHB", "XPHB", "TCE", "XGE"];
						const isOfficialSource = (src) => officialClassSources.includes(src?.toUpperCase?.() || src);

						let actualClassSource = feature.classSource;
						// If classSource is not set or is a homebrew source but feature.source is official, use feature.source
						if (!actualClassSource || (!isOfficialSource(actualClassSource) && isOfficialSource(feature.source))) {
							actualClassSource = feature.source;
						}
						// Final fallback to stored class or XPHB
						if (!actualClassSource) {
							actualClassSource = storedClass?.source || Parser.SRC_XPHB;
						}

						const hashInput = {
							name: feature.name,
							className: feature.className,
							classSource: actualClassSource,
							level: feature.level || 1,
							source: feature.source,
						};
						if (feature.subclassName) {
							hashInput.subclassShortName = feature.subclassShortName || feature.subclassName;
							hashInput.subclassSource = feature.subclassSource || storedClass?.subclass?.source || feature.source;
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
			"charge", "aggressive", "natural weapon", "unarmed strike",
			"breath weapon", "fey ancestry", "relentless endurance",
		];

		// Patterns that indicate activatable abilities (action economy)
		const activatablePatterns = [
			/\bas an action\b/i,
			/\buse your action\b/i,
			/\btake the .* action\b/i,
			/\bas a bonus action\b/i,
			/\buse a bonus action\b/i,
			/\bas a reaction\b/i,
			/\buse your reaction\b/i,
			/\bwhen you .* you can\b/i,
			/\bonce per .* rest\b/i,
			/\bonce on each of your turns\b/i,
			/\byou can use this .* a number of times\b/i,
		];

		const isImportantFeature = (feature) => {
			// Features with limited uses are important
			if (feature.uses && feature.uses.max > 0) return true;
			// Explicitly marked important
			if (feature.important) return true;
			// Key features by name OR description
			const nameLower = feature.name?.toLowerCase() || "";
			const descLower = feature.description?.toLowerCase() || "";

			// Check keyword matches
			if (importantKeywords.some(keyword =>
				nameLower.includes(keyword) || descLower.includes(keyword),
			)) return true;

			// Check activatable patterns (features that require actions/reactions)
			if (activatablePatterns.some(pattern => pattern.test(descLower))) return true;

			return false;
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
	 * Render calculated class statistics (Sneak Attack dice, Ki Save DC, etc.)
	 */
	_renderCalculatedStats ($container) {
		const calculations = this._state.getFeatureCalculations();
		if (!calculations || Object.keys(calculations).length === 0) return;

		const stats = [];

		// Format each calculation for display
		if (calculations.sneakAttack) {
			stats.push({
				label: "Sneak Attack",
				value: calculations.sneakAttack.dice,
				title: `Average damage: ${calculations.sneakAttack.avgDamage}`,
			});
		}

		if (calculations.kiSaveDc) {
			stats.push({
				label: "Ki Save DC",
				value: calculations.kiSaveDc,
				title: "8 + Proficiency + Wisdom modifier",
			});
		}

		if (calculations.focusSaveDc) {
			stats.push({
				label: "Focus Save DC",
				value: calculations.focusSaveDc,
				title: "8 + Proficiency + Dexterity or Wisdom modifier (highest)",
			});
		}

		if (calculations.martialArtsDie) {
			stats.push({
				label: "Martial Arts",
				value: calculations.martialArtsDie,
				title: "Unarmed strike damage die",
			});
		}

		if (calculations.rageDamage) {
			stats.push({
				label: "Rage Damage",
				value: `+${calculations.rageDamage}`,
				title: "Bonus damage while raging",
			});
		}

		if (calculations.brutalCritical) {
			stats.push({
				label: "Brutal Critical",
				value: `+${calculations.brutalCritical}d`,
				title: "Extra weapon dice on critical hits",
			});
		}

		if (calculations.auraRange) {
			stats.push({
				label: "Aura Range",
				value: `${calculations.auraRange} ft`,
				title: "Range of paladin auras",
			});
		}

		if (calculations.superiorityDie) {
			stats.push({
				label: "Superiority Die",
				value: calculations.superiorityDie,
				title: "Battle Master maneuver die",
			});
		}

		if (calculations.maneuverSaveDc) {
			stats.push({
				label: "Maneuver DC",
				value: calculations.maneuverSaveDc,
				title: "8 + Proficiency + Strength or Dexterity modifier (your choice)",
			});
		}

		if (calculations.bardicInspirationDie) {
			stats.push({
				label: "Bardic Inspiration",
				value: calculations.bardicInspirationDie,
				title: "Bardic Inspiration die",
			});
		}

		if (calculations.eldritchBlastBeams) {
			stats.push({
				label: "Eldritch Blast",
				value: `${calculations.eldritchBlastBeams} beam${calculations.eldritchBlastBeams > 1 ? "s" : ""}`,
				title: "Number of Eldritch Blast beams",
			});
		}

		if (calculations.channelDivinityDc) {
			stats.push({
				label: "Channel Divinity DC",
				value: calculations.channelDivinityDc,
				title: "8 + Proficiency + Wisdom or Charisma modifier",
			});
		}

		if (calculations.wildShapeDc) {
			stats.push({
				label: "Wild Shape DC",
				value: calculations.wildShapeDc,
				title: "8 + Proficiency + Wisdom modifier",
			});
		}

		if (calculations.favoredFoeDamage) {
			stats.push({
				label: "Favored Foe",
				value: calculations.favoredFoeDamage,
				title: "Extra damage against marked creature",
			});
		}

		if (calculations.combatMethodDc) {
			stats.push({
				label: "Combat Method DC",
				value: calculations.combatMethodDc,
				title: "8 + Proficiency + Strength or Dexterity modifier",
			});
		}

		// Only render if we have stats to show
		if (stats.length === 0) return;

		const $statsContainer = $(`<div class="charsheet__calculated-stats mb-2"></div>`);
		$statsContainer.append(`<div class="ve-small ve-muted mb-1"><strong>Class Statistics</strong></div>`);

		const $statsGrid = $(`<div class="charsheet__stats-grid"></div>`);
		stats.forEach(stat => {
			$statsGrid.append(`
				<div class="charsheet__stat-item" title="${stat.title}">
					<span class="charsheet__calc-stat-label">${stat.label}:</span>
					<span class="charsheet__calc-stat-value">${stat.value}</span>
				</div>
			`);
		});

		$statsContainer.append($statsGrid);
		$container.append($statsContainer);
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
					// Determine the actual classSource for hover links
					// Priority: 1. feature.classSource (if valid), 2. feature.source if it's a class source, 3. storedClass.source, 4. fallback
					const storedClass = this._state.getClasses().find(c => c.name?.toLowerCase() === feature.className?.toLowerCase());

					// Check if feature.source looks like a class source (official sources like PHB, XPHB)
					// This handles existing characters where classSource wasn't stored correctly
					const officialClassSources = [Parser.SRC_PHB, Parser.SRC_XPHB, "PHB", "XPHB", "TCE", "XGE"];
					const isOfficialSource = (src) => officialClassSources.includes(src?.toUpperCase?.() || src);

					let actualClassSource = feature.classSource;
					// If classSource is not set or is a homebrew source but feature.source is official, use feature.source
					if (!actualClassSource || (!isOfficialSource(actualClassSource) && isOfficialSource(feature.source))) {
						actualClassSource = feature.source || Parser.SRC_XPHB;
					}
					// Final fallback to stored class or XPHB
					if (!actualClassSource) {
						actualClassSource = storedClass?.source || Parser.SRC_XPHB;
					}

					const hashInput = {
						name: feature.name,
						className: feature.className,
						classSource: actualClassSource,
						level: feature.level || 1,
						source: feature.source || Parser.SRC_XPHB,
					};
					if (feature.subclassName || feature.isSubclassFeature) {
						hashInput.subclassShortName = feature.subclassShortName || feature.subclassName;
						hashInput.subclassSource = feature.subclassSource || storedClass?.subclass?.source || feature.source || Parser.SRC_XPHB;
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

		// Check if character uses the combat methods system (has traditions or methods)
		const usesCombatSystem = this._state.usesCombatSystem?.() || false;
		console.log("[CharSheet Features] _renderResources: usesCombatSystem=", usesCombatSystem);

		if (usesCombatSystem) {
			// Ensure exertion is initialized (use public method)
			if (typeof this._state.ensureExertionInitialized === "function") {
				this._state.ensureExertionInitialized();
			}

			const exertionMax = this._state.getExertionMax() || 0;
			const exertionCurrent = this._state.getExertionCurrent() ?? exertionMax;

			console.log("[CharSheet Features] Exertion display: max=", exertionMax, "current=", exertionCurrent);

			if (exertionMax > 0) {
				const $exertion = $(`
					<div class="charsheet__resource-row" data-resource-id="exertion">
						<span class="charsheet__resource-name">Exertion</span>
						<span class="charsheet__resource-recharge ve-muted ve-small ml-2">(Short)</span>
						<div class="charsheet__resource-uses ml-auto">
							<button class="ve-btn ve-btn-xs ve-btn-danger mr-2 charsheet__exertion-use-btn" ${exertionCurrent <= 0 ? "disabled" : ""}>Use</button>
							<span class="charsheet__resource-current">${exertionCurrent}</span>
							<span class="charsheet__resource-max">/ ${exertionMax}</span>
							<button class="ve-btn ve-btn-xs ve-btn-success ml-2 charsheet__exertion-restore-btn" ${exertionCurrent >= exertionMax ? "disabled" : ""}>+</button>
						</div>
					</div>
				`);

				// Use button - decrease exertion by 1
				$exertion.find(".charsheet__exertion-use-btn").on("click", () => {
					const current = this._state.getExertionCurrent() || 0;
					if (current > 0) {
						this._state.setExertionCurrent(current - 1);
						this._renderResources();
						if (this._page?._combat) {
							this._page._combat._updateExertionDisplay();
						}
					}
				});

				// Restore button - increase exertion by 1
				$exertion.find(".charsheet__exertion-restore-btn").on("click", () => {
					const current = this._state.getExertionCurrent() || 0;
					const max = this._state.getExertionMax() || 0;
					if (current < max) {
						this._state.setExertionCurrent(current + 1);
						this._renderResources();
						if (this._page?._combat) {
							this._page._combat._updateExertionDisplay();
						}
					}
				});

				$container.append($exertion);
			}
		}

		if (!resources.length && !usesCombatSystem) {
			$container.append(`<p class="ve-muted text-center">No class resources</p>`);
			return;
		}

		resources.forEach(resource => {
			const $row = $(`
				<div class="charsheet__resource-row" data-resource-id="${resource.id}">
					<span class="charsheet__resource-name">${resource.name}</span>
					<span class="charsheet__resource-recharge ve-muted ve-small ml-2">(${resource.recharge === "short" ? "Short" : "Long"})</span>
					<div class="charsheet__resource-uses ml-auto">
						<button class="ve-btn ve-btn-xs ve-btn-danger mr-2 charsheet__resource-use-btn" ${resource.current <= 0 ? "disabled" : ""}>Use</button>
						<span class="charsheet__resource-current">${resource.current}</span>
						<span class="charsheet__resource-max">/ ${resource.max}</span>
						<button class="ve-btn ve-btn-xs ve-btn-success ml-2 charsheet__resource-restore-btn" ${resource.current >= resource.max ? "disabled" : ""}>+</button>
					</div>
				</div>
			`);

			// Use button - decrease current by 1
			$row.find(".charsheet__resource-use-btn").on("click", () => {
				if (resource.current > 0) {
					this._state.setResourceCurrent(resource.id, resource.current - 1);
					this._renderResources();
				}
			});

			// Restore button - increase current by 1
			$row.find(".charsheet__resource-restore-btn").on("click", () => {
				if (resource.current < resource.max) {
					this._state.setResourceCurrent(resource.id, resource.current + 1);
					this._renderResources();
				}
			});

			$container.append($row);
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
