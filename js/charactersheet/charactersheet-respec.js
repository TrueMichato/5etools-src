/**
 * CharacterSheetRespec - Handles level history display and choice editing
 * Allows players to view and modify choices made during level-up
 */
class CharacterSheetRespec {
	constructor ({page, state}) {
		this._page = page;
		this._state = state;

		this._$timeline = null;
		this._$legacyBadge = null;
		this._$container = null;
	}

	/**
	 * Initialize the respec module and bind to DOM elements
	 */
	init () {
		this._$container = $("#charsheet-level-history");
		this._$timeline = $("#charsheet-level-timeline");
		this._$legacyBadge = $("#charsheet-legacy-badge");

		if (!this._$container.length) {
			console.warn("[Respec] Level history container not found");
			return;
		}

		// Initial render
		this.render();
	}

	/**
	 * Render the level history timeline
	 */
	render () {
		if (!this._$timeline?.length) return;

		const totalLevel = this._state.getTotalLevel();

		// No levels yet - tab visibility handles showing/hiding
		if (totalLevel === 0) {
			this._$timeline.empty();
			this._$timeline.append(`<p class="charsheet__respec-empty">No levels yet. Complete character creation in the Builder tab.</p>`);
			return;
		}

		// Show legacy badge if applicable
		const isLegacy = this._state.isLegacyCharacter();
		this._$legacyBadge.toggleClass("ve-hidden", !isLegacy);

		// Build timeline entries
		const levelHistory = this._state.getLevelHistory();
		const historyByLevel = new Map(levelHistory.map(h => [h.level, h]));

		this._$timeline.empty();

		for (let level = 1; level <= totalLevel; level++) {
			const history = historyByLevel.get(level);
			const $entry = this._renderLevelEntry(level, history, level === totalLevel);
			this._$timeline.append($entry);
		}
	}

	/**
	 * Render a single level entry in the timeline
	 * @param {number} level - Character level
	 * @param {object|null} history - History entry or null for legacy
	 * @param {boolean} isCurrent - Whether this is the current level
	 * @returns {jQuery} The entry element
	 */
	_renderLevelEntry (level, history, isCurrent) {
		const isLegacy = !history;
		const classes = this._state.getClasses();

		// Determine which class this level was in
		let levelClass = null;
		if (history?.class) {
			levelClass = history.class;
		} else {
			// For legacy, infer from current class levels
			// This is approximate - we just show the first class
			levelClass = classes[0] ? {name: classes[0].name, source: classes[0].source} : null;
		}

		const entryClasses = [
			"charsheet__level-entry",
			isLegacy ? "charsheet__level-entry--legacy" : "",
			isCurrent ? "charsheet__level-entry--current" : "",
		].filter(Boolean).join(" ");

		const $entry = $(`<div class="${entryClasses}" data-level="${level}"></div>`);

		const $card = $(`<div class="charsheet__level-entry-card"></div>`);

		// Header with class name and edit button
		const $header = $(`<div class="charsheet__level-entry-header"></div>`);

		const className = levelClass?.name || "Unknown";
		const $classInfo = $(`
			<div class="charsheet__level-entry-class">
				<span class="charsheet__level-entry-class-name">${className}</span>
				<span class="charsheet__level-entry-class-level">Level ${level}</span>
			</div>
		`);

		// Edit button - disabled for legacy entries
		const $editBtn = $(`
			<button class="charsheet__level-entry-edit" title="${isLegacy ? "Cannot edit legacy level - level history not recorded" : "Edit choices for this level"}">
				<span class="glyphicon glyphicon-pencil"></span>
			</button>
		`);

		if (isLegacy) {
			$editBtn.prop("disabled", true);
		} else {
			$editBtn.on("click", () => this._onEditLevel(level, history));
		}

		$header.append($classInfo).append($editBtn);
		$card.append($header);

		// Choices summary
		const $choices = $(`<div class="charsheet__level-entry-choices"></div>`);

		if (history?.choices && Object.keys(history.choices).length > 0) {
			// ASI choice
			if (history.choices.asi) {
				const asiText = Object.entries(history.choices.asi)
					.map(([abl, val]) => `${Parser.attAbvToFull(abl)} +${val}`)
					.join(", ");
				$choices.append(`
					<span class="charsheet__level-choice charsheet__level-choice--asi">
						<span class="charsheet__level-choice-icon">📈</span>
						${asiText}
					</span>
				`);
			}

			// Feat choice
			if (history.choices.feat) {
				$choices.append(`
					<span class="charsheet__level-choice charsheet__level-choice--feat">
						<span class="charsheet__level-choice-icon">⭐</span>
						${history.choices.feat.name}
					</span>
				`);
			}

			// Subclass choice
			if (history.choices.subclass) {
				$choices.append(`
					<span class="charsheet__level-choice charsheet__level-choice--subclass">
						<span class="charsheet__level-choice-icon">🎭</span>
						${history.choices.subclass.name}
					</span>
				`);
			}

			// Skills chosen
			if (history.choices.skills?.length > 0) {
				const skillText = history.choices.skills.slice(0, 3).join(", ");
				const more = history.choices.skills.length > 3 ? ` +${history.choices.skills.length - 3} more` : "";
				$choices.append(`
					<span class="charsheet__level-choice charsheet__level-choice--skill">
						<span class="charsheet__level-choice-icon">🎯</span>
						${skillText}${more}
					</span>
				`);
			}

			// Feature choices
			if (history.choices.featureChoices?.length > 0) {
				history.choices.featureChoices.forEach(fc => {
					$choices.append(`
						<span class="charsheet__level-choice charsheet__level-choice--feature">
							<span class="charsheet__level-choice-icon">✦</span>
							${fc.choice}
						</span>
					`);
				});
			}

			// Optional features (invocations, metamagic, etc.)
			if (history.choices.optionalFeatures?.length > 0) {
				history.choices.optionalFeatures.forEach(of => {
					$choices.append(`
						<span class="charsheet__level-choice charsheet__level-choice--feature">
							<span class="charsheet__level-choice-icon">✧</span>
							${of.name}
						</span>
					`);
				});
			}

			// Expertise choices
			if (history.choices.expertise?.length > 0) {
				const expertiseText = history.choices.expertise.map(e => e.toTitleCase()).slice(0, 3).join(", ");
				const more = history.choices.expertise.length > 3 ? ` +${history.choices.expertise.length - 3} more` : "";
				$choices.append(`
					<span class="charsheet__level-choice charsheet__level-choice--expertise">
						<span class="charsheet__level-choice-icon">🔥</span>
						Expertise: ${expertiseText}${more}
					</span>
				`);
			}

			// Language choices
			if (history.choices.languages?.length > 0) {
				const langText = history.choices.languages.map(l => l.language).join(", ");
				$choices.append(`
					<span class="charsheet__level-choice charsheet__level-choice--language">
						<span class="charsheet__level-choice-icon">🗣️</span>
						${langText}
					</span>
				`);
			}

			// Scholar skill (knowledge domain, sage, etc.)
			if (history.choices.scholarSkill) {
				$choices.append(`
					<span class="charsheet__level-choice charsheet__level-choice--scholar">
						<span class="charsheet__level-choice-icon">📚</span>
						Scholar: ${history.choices.scholarSkill.toTitleCase()}
					</span>
				`);
			}

			// Spellbook spells (wizard)
			if (history.choices.spellbookSpells?.length > 0) {
				const spellText = history.choices.spellbookSpells.map(s => s.name).slice(0, 2).join(", ");
				const more = history.choices.spellbookSpells.length > 2 ? ` +${history.choices.spellbookSpells.length - 2} more` : "";
				$choices.append(`
					<span class="charsheet__level-choice charsheet__level-choice--spells">
						<span class="charsheet__level-choice-icon">📜</span>
						Spellbook: ${spellText}${more}
					</span>
				`);
			}
		} else if (isLegacy) {
			$choices.append(`<span class="charsheet__level-entry-empty">No history recorded (legacy character)</span>`);
		} else {
			$choices.append(`<span class="charsheet__level-entry-empty">No choices at this level</span>`);
		}

		$card.append($choices);
		$entry.append($card);

		return $entry;
	}

	/**
	 * Handle edit button click for a level
	 * @param {number} level - The level to edit
	 * @param {object} history - The history entry
	 */
	async _onEditLevel (level, history) {
		if (!history) return;

		// Determine what can be edited at this level
		const editableChoices = this._getEditableChoices(level, history);

		if (editableChoices.length === 0) {
			JqueryUtil.doToast({type: "info", content: "No editable choices at this level."});
			return;
		}

		// Show edit modal
		await this._showEditModal(level, history, editableChoices);
	}

	/**
	 * Get list of editable choices for a level
	 * @param {number} level - The level
	 * @param {object} history - The history entry
	 * @returns {Array} Array of {type, label, current} objects
	 */
	_getEditableChoices (level, history) {
		const editable = [];

		// ASI is editable (separate from feat for Thelemar rule support)
		if (history.choices?.asi) {
			const asiDesc = Parser.ABIL_ABVS
				.filter(abl => history.choices.asi[abl])
				.map(abl => `${Parser.attAbvToFull(abl)} +${history.choices.asi[abl]}`)
				.join(", ") || "None";
			editable.push({
				type: "asi",
				label: "Ability Score Improvement",
				current: asiDesc,
			});
		}

		// Feat is editable (separate from ASI)
		if (history.choices?.feat) {
			editable.push({
				type: "feat",
				label: "Feat",
				current: history.choices.feat,
			});
		}

		// Feature choices are editable (fight styles, specialties, Warden, etc.)
		if (history.choices?.featureChoices && history.choices.featureChoices.length > 0) {
			history.choices.featureChoices.forEach((fc, idx) => {
				editable.push({
					type: "featureChoice",
					label: fc.featureName,
					current: fc.choice,
					index: idx,
				});
			});
		}

		// Subclass is editable (with cascade warning)
		if (history.choices?.subclass) {
			editable.push({
				type: "subclass",
				label: "Subclass",
				current: history.choices.subclass,
				hasCascade: true,
			});
		}

		// Note: Skills and other level 1 choices are typically not editable
		// as they would require extensive recalculation

		return editable;
	}

	/**
	 * Show the edit modal for a level's choices
	 * @param {number} level - The level
	 * @param {object} history - The history entry
	 * @param {Array} editableChoices - Editable choices
	 */
	async _showEditModal (level, history, editableChoices) {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: `Edit Level ${level} Choices`,
			isMinHeight0: true,
			isWidth100: true,
			isUncappedWidth: true,
			cbClose: () => {},
		});

		const $content = $(`<div class="charsheet__respec-modal"></div>`);

		// Show current choices
		$content.append(`<h4>Current Choices</h4>`);

		const $choicesList = $(`<div class="charsheet__respec-choices-list"></div>`);
		editableChoices.forEach(choice => {
			const currentText = typeof choice.current === "object"
				? (choice.current.name || JSON.stringify(choice.current))
				: String(choice.current);

			const $choiceRow = $(`
				<div class="charsheet__respec-choice-row">
					<span class="charsheet__respec-choice-label">${choice.label}:</span>
					<span class="charsheet__respec-choice-current">${currentText}</span>
					${choice.hasCascade ? `<span class="charsheet__respec-choice-warning" title="Changing this will remove dependent features">⚠️</span>` : ""}
				</div>
			`);

			const $editBtn = $(`<button class="ve-btn ve-btn-xs ve-btn-default">Change</button>`);
			$editBtn.on("click", () => this._editChoice(level, history, choice, doClose));
			$choiceRow.append($editBtn);

			$choicesList.append($choiceRow);
		});
		$content.append($choicesList);

		// Close button
		const $closeBtn = $(`<button class="ve-btn ve-btn-primary mt-3">Close</button>`);
		$closeBtn.on("click", () => doClose());
		$content.append($closeBtn);

		$modalInner.append($content);
	}

	/**
	 * Edit a specific choice
	 * @param {number} level - The level
	 * @param {object} history - The history entry
	 * @param {object} choice - The choice to edit
	 * @param {Function} closeParentModal - Function to close parent modal
	 */
	async _editChoice (level, history, choice, closeParentModal) {
		switch (choice.type) {
			case "asi":
				await this._editAsi(level, history, closeParentModal);
				break;
			case "feat":
				await this._editFeat(level, history, closeParentModal);
				break;
			case "featureChoice":
				await this._editFeatureChoice(level, history, choice, closeParentModal);
				break;
			case "subclass":
				await this._editSubclass(level, history, closeParentModal);
				break;
			default:
				JqueryUtil.doToast({type: "warning", content: "Editing this choice type is not yet implemented."});
		}
	}

	/**
	 * Edit ASI choice
	 * @param {number} level - The level
	 * @param {object} history - The history entry
	 * @param {Function} closeParentModal - Function to close parent modal
	 */
	async _editAsi (level, history, closeParentModal) {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: `Change Level ${level} Ability Score Improvement`,
			isMinHeight0: true,
			isWidth100: true,
			isUncappedWidth: true,
			cbClose: () => {},
		});

		const $content = $(`<div class="charsheet__respec-asi-modal"></div>`);
		$content.append(`<h4>Allocate Points (2 points total)</h4>`);

		const asiState = {...(history.choices?.asi || {})};
		let pointsRemaining = 2 - Object.values(asiState).reduce((sum, v) => sum + v, 0);

		const $pointsDisplay = $(`<div class="charsheet__respec-points-remaining">Points Remaining: <strong>${pointsRemaining}</strong></div>`);
		$content.append($pointsDisplay);

		const $asiGrid = $(`<div class="charsheet__respec-asi-grid"></div>`);
		Parser.ABIL_ABVS.forEach(abl => {
			const currentBonus = asiState[abl] || 0;
			const baseScore = this._state.getAbilityBase(abl) - (history.choices?.asi?.[abl] || 0);
			const $row = $(`
				<div class="charsheet__respec-asi-row">
					<span class="charsheet__respec-asi-name">${Parser.attAbvToFull(abl)}</span>
					<span class="charsheet__respec-asi-base">${baseScore}</span>
					<div class="charsheet__respec-asi-controls">
						<button class="ve-btn ve-btn-xs ve-btn-default charsheet__respec-asi-minus" data-abl="${abl}">-</button>
						<span class="charsheet__respec-asi-bonus" data-abl="${abl}">${currentBonus > 0 ? `+${currentBonus}` : "0"}</span>
						<button class="ve-btn ve-btn-xs ve-btn-default charsheet__respec-asi-plus" data-abl="${abl}">+</button>
					</div>
					<span class="charsheet__respec-asi-total">${baseScore + currentBonus}</span>
				</div>
			`);
			$asiGrid.append($row);
		});
		$content.append($asiGrid);

		// Wire up ASI controls
		$content.on("click", ".charsheet__respec-asi-plus", (e) => {
			const abl = $(e.currentTarget).data("abl");
			const current = asiState[abl] || 0;
			const baseScore = this._state.getAbilityBase(abl) - (history.choices?.asi?.[abl] || 0);
			if (pointsRemaining > 0 && current < 2 && baseScore + current < 20) {
				asiState[abl] = current + 1;
				pointsRemaining--;
				this._updateAsiDisplay($content, asiState, pointsRemaining, $pointsDisplay, history);
			}
		});

		$content.on("click", ".charsheet__respec-asi-minus", (e) => {
			const abl = $(e.currentTarget).data("abl");
			const current = asiState[abl] || 0;
			if (current > 0) {
				asiState[abl] = current - 1;
				if (asiState[abl] === 0) delete asiState[abl];
				pointsRemaining++;
				this._updateAsiDisplay($content, asiState, pointsRemaining, $pointsDisplay, history);
			}
		});

		// Buttons
		const $btnRow = $(`<div class="charsheet__respec-btn-row mt-3"></div>`);
		const $cancelBtn = $(`<button class="ve-btn ve-btn-default">Cancel</button>`);
		$cancelBtn.on("click", () => doClose());

		const $applyBtn = $(`<button class="ve-btn ve-btn-primary">Apply Changes</button>`);
		$applyBtn.on("click", async () => {
			if (pointsRemaining !== 0) {
				JqueryUtil.doToast({type: "warning", content: "Please allocate all 2 points."});
				return;
			}
			await this._applyAsiChange(level, history, asiState);

			doClose();
			closeParentModal();
			this.render();
			this._page.renderCharacter();
			await this._page.saveCharacter();
			JqueryUtil.doToast({type: "success", content: `Updated level ${level} ASI.`});
		});

		$btnRow.append($cancelBtn).append($applyBtn);
		$content.append($btnRow);

		$modalInner.append($content);
	}

	/**
	 * Edit feat choice
	 * @param {number} level - The level
	 * @param {object} history - The history entry
	 * @param {Function} closeParentModal - Function to close parent modal
	 */
	async _editFeat (level, history, closeParentModal) {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: `Change Level ${level} Feat`,
			isMinHeight0: true,
			isWidth100: true,
			isUncappedWidth: true,
			cbClose: () => {},
		});

		const currentFeat = history.choices?.feat;
		const $content = $(`<div class="charsheet__respec-feat-modal"></div>`);

		$content.append(`<h4>Select New Feat</h4>`);
		$content.append(`<p class="text-muted mb-2">Current: <strong>${currentFeat?.name || "None"}</strong></p>`);

		// Feat filter
		const $searchRow = $(`<div class="charsheet__respec-search-row mb-2"></div>`);
		const $searchInput = $(`<input type="text" class="form-control" placeholder="Search feats...">`);
		$searchRow.append($searchInput);
		$content.append($searchRow);

		// Feat list container
		const $featList = $(`<div class="charsheet__respec-feat-list"></div>`);
		$content.append($featList);

		// Load feats
		const feats = this._page._levelUp?._feats || [];
		let selectedFeat = null;

		const renderFeats = (filter = "") => {
			$featList.empty();
			const filterLower = filter.toLowerCase();
			const filtered = feats.filter(f => {
				if (!f.name.toLowerCase().includes(filterLower)) return false;
				return true;
			}).slice(0, 50); // Limit for performance

			if (filtered.length === 0) {
				$featList.append(`<p class="text-muted">No feats found.</p>`);
				return;
			}

			filtered.forEach(feat => {
				const isCurrent = currentFeat && feat.name === currentFeat.name && feat.source === currentFeat.source;
				const isSelected = selectedFeat && feat.name === selectedFeat.name && feat.source === selectedFeat.source;
				const $item = $(`
					<div class="charsheet__respec-feat-item ${isCurrent ? "charsheet__respec-feat-current" : ""} ${isSelected ? "charsheet__respec-feat-selected" : ""}">
						<strong>${feat.name}</strong>
						<span class="text-muted">${Parser.sourceJsonToAbv(feat.source)}</span>
					</div>
				`);
				$item.on("click", () => {
					selectedFeat = feat;
					$featList.find(".charsheet__respec-feat-selected").removeClass("charsheet__respec-feat-selected");
					$item.addClass("charsheet__respec-feat-selected");
				});
				$featList.append($item);
			});
		};

		renderFeats();

		$searchInput.on("input", () => {
			renderFeats($searchInput.val());
		});

		// Buttons
		const $btnRow = $(`<div class="charsheet__respec-btn-row mt-3"></div>`);
		const $cancelBtn = $(`<button class="ve-btn ve-btn-default">Cancel</button>`);
		$cancelBtn.on("click", () => doClose());

		const $applyBtn = $(`<button class="ve-btn ve-btn-primary">Apply Changes</button>`);
		$applyBtn.on("click", async () => {
			if (!selectedFeat) {
				JqueryUtil.doToast({type: "warning", content: "Please select a feat."});
				return;
			}

			await this._applyFeatChange(level, history, selectedFeat);

			doClose();
			closeParentModal();
			this.render();
			this._page.renderCharacter();
			await this._page.saveCharacter();
			JqueryUtil.doToast({type: "success", content: `Changed feat to ${selectedFeat.name}.`});
		});

		$btnRow.append($cancelBtn).append($applyBtn);
		$content.append($btnRow);

		$modalInner.append($content);
	}

	/**
	 * Edit feature choice (fighting style, specialty, warden, etc.)
	 * @param {number} level - The level
	 * @param {object} history - The history entry
	 * @param {object} choice - The choice info
	 * @param {Function} closeParentModal - Function to close parent modal
	 */
	async _editFeatureChoice (level, history, choice, closeParentModal) {
		JqueryUtil.doToast({type: "info", content: `Editing ${choice.label} choices will be available in a future update.`});
	}

	/**
	 * Update ASI display after change
	 */
	_updateAsiDisplay ($section, asiState, pointsRemaining, $pointsDisplay, history) {
		$pointsDisplay.html(`Points Remaining: <strong>${pointsRemaining}</strong>`);
		$pointsDisplay.toggleClass("text-danger", pointsRemaining < 0);
		$pointsDisplay.toggleClass("text-success", pointsRemaining === 0);

		Parser.ABIL_ABVS.forEach(abl => {
			const bonus = asiState[abl] || 0;
			const baseScore = this._state.getAbilityBase(abl) - (history.choices?.asi?.[abl] || 0);
			$section.find(`.charsheet__respec-asi-bonus[data-abl="${abl}"]`).text(bonus > 0 ? `+${bonus}` : "0");
			$section.find(`.charsheet__respec-asi-row:has([data-abl="${abl}"]) .charsheet__respec-asi-total`).text(baseScore + bonus);
		});
	}

	/**
	 * Apply ASI change
	 * @param {number} level - The level
	 * @param {object} history - The history entry
	 * @param {object} newAsi - New ASI allocation
	 */
	async _applyAsiChange (level, history, newAsi) {
		const oldAsi = history.choices?.asi || {};

		// Revert old ASI bonuses
		Object.entries(oldAsi).forEach(([abl, bonus]) => {
			const current = this._state.getAbilityBase(abl);
			this._state.setAbilityBase(abl, current - bonus);
		});

		// Apply new ASI bonuses
		Object.entries(newAsi).forEach(([abl, bonus]) => {
			const current = this._state.getAbilityBase(abl);
			this._state.setAbilityBase(abl, Math.min(20, current + bonus));
		});

		// Update history - only update ASI, preserve feat (Thelemar rule support)
		this._state.updateLevelChoice(level, {
			asi: newAsi,
		});

		// Update the ASI tracking feature
		const features = this._state.getFeatures();
		const asiFeature = features.find(f => f.isAsiChoice && f.level === level);
		if (asiFeature) {
			const increases = Object.entries(newAsi)
				.map(([abl, val]) => `${Parser.attAbvToFull(abl)} +${val}`)
				.join(", ");
			asiFeature.description = `<p><strong>Ability Score Increases:</strong> ${increases}</p>`;
		}
	}

	/**
	 * Apply feat change
	 * @param {number} level - The level
	 * @param {object} history - The history entry
	 * @param {object} newFeat - The new feat
	 */
	async _applyFeatChange (level, history, newFeat) {
		const oldFeat = history.choices?.feat;

		// Remove old feat from features
		if (oldFeat) {
			let features = this._state.getFeatures();
			features = features.filter(f => !(f.name === oldFeat.name && f.source === oldFeat.source && f.level === level));
			this._state._character.features = features;

			// Remove old feat bonuses (simplified - full implementation would need to track all feat effects)
			// This needs expansion to handle all feat types properly
		}

		// Add new feat to features
		const feature = {
			name: newFeat.name,
			source: newFeat.source,
			description: Renderer.get().render({entries: newFeat.entries || []}),
			level: level,
			featureType: "Feat",
		};
		const features = this._state.getFeatures();
		features.push(feature);

		// Apply new feat bonuses (simplified)
		if (newFeat.ability) {
			// Handle ability score increases from feat
			newFeat.ability.forEach(abilityOption => {
				let applied = false;
				if (abilityOption.choose) {
					// Needs UI for choosing - skip for now
				} else {
					Parser.ABIL_ABVS.forEach(abl => {
						if (abilityOption[abl] && !applied) {
							const current = this._state.getAbilityBase(abl);
							this._state.setAbilityBase(abl, Math.min(20, current + abilityOption[abl]));
							applied = true;
						}
					});
				}
			});
		}

		// Update history - only update feat, preserve ASI (Thelemar rule support)
		this._state.updateLevelChoice(level, {
			feat: {
				name: newFeat.name,
				source: newFeat.source,
			},
		});

	/**
	 * Edit subclass choice (placeholder for future implementation)
	 */
	async _editSubclass (level, history, closeParentModal) {
		JqueryUtil.doToast({type: "info", content: "Subclass editing will be available in a future update. This requires careful handling of dependent features."});
	}
}

// Export for use in charactersheet.js
globalThis.CharacterSheetRespec = CharacterSheetRespec;
