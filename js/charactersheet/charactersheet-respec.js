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

		// Show race/background grants at level 1
		if (level === 1) {
			const $grants = this._renderRaceBackgroundGrants();
			if ($grants) $card.append($grants);
		}

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

			// Combat traditions
			if (history.choices.combatTraditions?.length > 0) {
				const traditionsText = history.choices.combatTraditions.slice(0, 3).join(", ");
				const more = history.choices.combatTraditions.length > 3 ? ` +${history.choices.combatTraditions.length - 3} more` : "";
				$choices.append(`
					<span class="charsheet__level-choice charsheet__level-choice--feature">
						<span class="charsheet__level-choice-icon">⚔️</span>
						Traditions: ${traditionsText}${more}
					</span>
				`);
			}

			// Weapon masteries
			if (history.choices.weaponMasteries?.length > 0) {
				const masteryText = history.choices.weaponMasteries
					.map(m => m.split("|")[0])
					.slice(0, 2)
					.join(", ");
				const more = history.choices.weaponMasteries.length > 2 ? ` +${history.choices.weaponMasteries.length - 2} more` : "";
				$choices.append(`
					<span class="charsheet__level-choice charsheet__level-choice--feature">
						<span class="charsheet__level-choice-icon">🗡️</span>
						Masteries: ${masteryText}${more}
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
	 * Render a read-only summary of race and background grants for the level 1 card.
	 * @returns {jQuery|null} The grants element, or null if no race/background set
	 */
	_renderRaceBackgroundGrants () {
		const race = this._state.getRace();
		const background = this._state.getBackground();

		if (!race && !background) return null;

		const $grants = $(`<div class="charsheet__level-entry-grants mt-1 mb-1"></div>`);

		// Race grants
		if (race) {
			const raceName = this._state.getRaceName() || race.name;
			const $raceGrants = $(`<div class="charsheet__level-grants-section"></div>`);
			$raceGrants.append(`<div class="ve-small ve-bold">🧬 ${raceName}</div>`);

			const items = [];

			// Speed
			if (race.speed) {
				const speed = typeof race.speed === "number" ? race.speed : race.speed.walk;
				if (speed) items.push(`Speed ${speed} ft.`);
				if (typeof race.speed === "object") {
					["fly", "swim", "climb", "burrow"].forEach(t => {
						if (race.speed[t]) items.push(`${t.toTitleCase()} ${race.speed[t]} ft.`);
					});
				}
			}

			// Darkvision
			if (race.darkvision) items.push(`Darkvision ${race.darkvision} ft.`);

			// Size
			if (race.size?.length) {
				const sizeMap = {T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan"};
				items.push(race.size.map(s => sizeMap[s] || s).join("/"));
			}

			// Resistances
			if (race.resist?.length) {
				const resists = race.resist.filter(r => typeof r === "string");
				if (resists.length) items.push(`Resist: ${resists.join(", ")}`);
			}

			// Skill proficiencies
			if (race.skillProficiencies?.length) {
				const skills = [];
				race.skillProficiencies.forEach(sp => {
					Object.keys(sp).forEach(s => {
						if (s !== "any" && s !== "choose") skills.push(s.toTitleCase());
					});
				});
				if (skills.length) items.push(`Skills: ${skills.join(", ")}`);
			}

			// Language proficiencies
			if (race.languageProficiencies?.length) {
				const langs = [];
				race.languageProficiencies.forEach(lp => {
					Object.keys(lp).forEach(l => {
						if (l !== "anyStandard" && l !== "any") langs.push(l.toTitleCase());
					});
				});
				if (langs.length) items.push(`Languages: ${langs.join(", ")}`);
			}

			if (items.length) {
				$raceGrants.append(`<div class="ve-small ve-muted ml-2">${items.join(" · ")}</div>`);
			}

			$grants.append($raceGrants);
		}

		// Background grants
		if (background) {
			const $bgGrants = $(`<div class="charsheet__level-grants-section mt-1"></div>`);
			$bgGrants.append(`<div class="ve-small ve-bold">📜 ${background.name}</div>`);

			const items = [];

			// Skill proficiencies
			if (background.skillProficiencies?.length) {
				const skills = [];
				background.skillProficiencies.forEach(sp => {
					Object.keys(sp).forEach(s => {
						if (s !== "any" && s !== "choose") skills.push(s.toTitleCase());
					});
				});
				if (skills.length) items.push(`Skills: ${skills.join(", ")}`);
			}

			// Tool proficiencies
			if (background.toolProficiencies?.length) {
				const tools = [];
				background.toolProficiencies.forEach(tp => {
					Object.keys(tp).forEach(t => {
						if (t !== "any" && t !== "choose" && t !== "anyArtisansTool" && t !== "anyMusicalInstrument") tools.push(t.toTitleCase());
					});
				});
				if (tools.length) items.push(`Tools: ${tools.join(", ")}`);
			}

			// Language proficiencies
			if (background.languageProficiencies?.length) {
				const langs = [];
				background.languageProficiencies.forEach(lp => {
					Object.keys(lp).forEach(l => {
						if (l !== "anyStandard" && l !== "any") langs.push(l.toTitleCase());
					});
				});
				if (langs.length) items.push(`Languages: ${langs.join(", ")}`);
			}

			// Starting equipment
			if (background.startingEquipment?.length) {
				items.push("Starting Equipment");
			}

			if (items.length) {
				$bgGrants.append(`<div class="ve-small ve-muted ml-2">${items.join(" · ")}</div>`);
			}

			$grants.append($bgGrants);
		}

		return $grants;
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

		if (history.choices?.combatTraditions?.length > 0) {
			editable.push({
				type: "combatTraditions",
				label: "Combat Traditions",
				current: history.choices.combatTraditions.join(", "),
			});
		}

		if (history.choices?.weaponMasteries?.length > 0) {
			editable.push({
				type: "weaponMasteries",
				label: "Weapon Masteries",
				current: history.choices.weaponMasteries.map(m => m.split("|")[0]).join(", "),
			});
		}

		// Optional features (metamagic, invocations, etc.) are editable
		if (history.choices?.optionalFeatures?.length > 0) {
			// Group by feature type for a cleaner edit UI
			const byType = {};
			for (const of of history.choices.optionalFeatures) {
				const key = of.type || "other";
				(byType[key] = byType[key] || []).push(of);
			}
			for (const [typeKey, features] of Object.entries(byType)) {
				const label = CharacterSheetRespec._getOptionalFeatureTypeLabel(typeKey);
				editable.push({
					type: "optionalFeatures",
					label,
					current: features.map(f => f.name).join(", "),
					featureTypeKey: typeKey,
					count: features.length,
				});
			}
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
			case "combatTraditions":
				await this._editCombatTraditions(level, history, closeParentModal);
				break;
			case "weaponMasteries":
				await this._editWeaponMasteries(level, history, closeParentModal);
				break;
			case "optionalFeatures":
				await this._editOptionalFeatures(level, history, choice, closeParentModal);
				break;
			default:
				JqueryUtil.doToast({type: "warning", content: "Editing this choice type is not yet implemented."});
		}
	}

	async _editCombatTraditions (level, history, closeParentModal) {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: `Change Level ${level} Combat Traditions`,
			isMinHeight0: true,
			isWidth100: true,
			isUncappedWidth: true,
			cbClose: () => {},
		});

		const classData = this._page.getClasses()?.find(c => c.name === history.class?.name && c.source === history.class?.source);
		let allTraditions = CharacterSheetClassUtils.getAvailableTraditionsForClass(
			this._page.getOptionalFeatures() || [],
			[],
			classData?.name || history.class?.name,
			this._page.getClassFeatures() || [],
		);
		if (!allTraditions.length && history.choices?.combatTraditions?.length) {
			allTraditions = history.choices.combatTraditions.map(code => ({
				code,
				name: CharacterSheetClassUtils.getTraditionName(code),
			}));
		}

		const classFeatures = this._page.getClassFeatures() || [];
		const maxTraditions = CharacterSheetClassUtils.getCombatTraditionSelectionCount({
			classData,
			classFeatures,
			defaultCount: Math.max(1, history.choices?.combatTraditions?.length || 2),
		});
		const requiredTraditions = Math.min(maxTraditions, allTraditions.length || maxTraditions);

		let selectedTraditions = [...(history.choices?.combatTraditions || [])];

		$modalInner.append(`
			<p class="ve-muted mb-2">Choose up to ${requiredTraditions} traditions for this level history entry.</p>
			<div class="ve-small ve-muted mb-2">Selected: <span id="respec-tradition-count">${selectedTraditions.length}</span>/${requiredTraditions}</div>
		`);

		const $list = $(`<div style="display:flex; flex-wrap:wrap; gap:8px;"></div>`).appendTo($modalInner);
		allTraditions.forEach(trad => {
			const isSelected = selectedTraditions.includes(trad.code);
			const $label = $(`
				<label style="display:flex; align-items:center; cursor:pointer; padding:4px 8px; border:1px solid var(--rgb-border-grey); border-radius:4px; ${isSelected ? "background: var(--rgb-bg-highlight);" : ""}">
					<input type="checkbox" value="${trad.code}" ${isSelected ? "checked" : ""} style="margin-right:6px;">
					<span>${trad.name}</span>
					<span class="ve-small text-muted ml-1">(${trad.code})</span>
				</label>
			`);

			$label.find("input").on("change", (evt) => {
				if (evt.target.checked) {
					if (selectedTraditions.length < requiredTraditions) {
						selectedTraditions.push(trad.code);
						$label.css("background", "var(--rgb-bg-highlight)");
					} else {
						evt.target.checked = false;
						JqueryUtil.doToast({type: "warning", content: `You can only choose ${requiredTraditions} combat traditions.`});
					}
				} else {
					selectedTraditions = selectedTraditions.filter(t => t !== trad.code);
					$label.css("background", "");
				}
				$("#respec-tradition-count").text(selectedTraditions.length);
			});

			$list.append($label);
		});

		$$`<div class="ve-flex-h-right mt-3">
			<button class="ve-btn ve-btn-default mr-2">Cancel</button>
			<button class="ve-btn ve-btn-primary">Apply Changes</button>
		</div>`.appendTo($modalInner)
			.find("button")
			.eq(0)
			.on("click", () => doClose());

		$modalInner.find(".ve-btn-primary").on("click", async () => {
			if (selectedTraditions.length !== requiredTraditions) {
				JqueryUtil.doToast({type: "warning", content: `Please select exactly ${requiredTraditions} traditions.`});
				return;
			}

			const didUpdate = this._state.updateLevelChoice(level, {combatTraditions: [...selectedTraditions]});
			if (!didUpdate) {
				JqueryUtil.doToast({type: "danger", content: "Failed to update level history entry."});
				return;
			}
			this._page.replayHistoryMartialChoices();

			doClose();
			closeParentModal();
			this.render();
			this._page.renderCharacter();
			await this._page.saveCharacter();
			JqueryUtil.doToast({type: "success", content: `Updated level ${level} combat traditions.`});
		});
	}

	async _editWeaponMasteries (level, history, closeParentModal) {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: `Change Level ${level} Weapon Masteries`,
			isMinHeight0: true,
			isWidth100: true,
			isUncappedWidth: true,
			cbClose: () => {},
		});

		const globalMaxMasteries = Math.max(1, this._page.getMaxWeaponMasteries?.() || 1);
		const requiredMasteries = Math.max(
			1,
			history.choices?.weaponMasteries?.length || Math.min(globalMaxMasteries, this._state.getWeaponMasteries().length || 1),
		);
		let selectedMasteries = [...(history.choices?.weaponMasteries || [])];

		$modalInner.append(`
			<p class="ve-muted mb-2">Choose up to ${requiredMasteries} weapon masteries for this level history entry.</p>
			<div class="ve-small ve-muted mb-2">Selected: <span id="respec-mastery-count">${selectedMasteries.length}</span>/${requiredMasteries}</div>
		`);

		const weaponsWithMastery = (this._page.getItems() || []).filter(item => {
			if (!item._isBaseItem) return false;
			if (!item.weaponCategory && !["M", "R", "S"].includes(item.type)) return false;
			return item.mastery?.length > 0;
		});

		const simpleWeapons = weaponsWithMastery
			.filter(w => w.weaponCategory === "simple" || w.type === "S")
			.sort((a, b) => a.name.localeCompare(b.name));

		const martialWeapons = weaponsWithMastery
			.filter(w => w.weaponCategory === "martial" || w.type === "M")
			.sort((a, b) => a.name.localeCompare(b.name));

		const renderWeaponGroup = (weapons, groupName) => {
			if (!weapons.length) return;

			const $group = $(`<div class="mb-3"><strong>${groupName}:</strong></div>`);
			const $checkboxes = $(`<div style="display:flex; flex-wrap:wrap; gap:8px;"></div>`);

			weapons.forEach(weapon => {
				const weaponKey = `${weapon.name}|${weapon.source}`;
				const isSelected = selectedMasteries.includes(weaponKey);
				const $label = $(`
					<label style="display:flex; align-items:center; cursor:pointer; padding:4px 8px; border:1px solid var(--rgb-border-grey); border-radius:4px; ${isSelected ? "background: var(--rgb-bg-highlight);" : ""}">
						<input type="checkbox" value="${weaponKey}" ${isSelected ? "checked" : ""} style="margin-right:6px;">
						<span>${weapon.name}</span>
					</label>
				`);

				$label.find("input").on("change", (evt) => {
					if (evt.target.checked) {
						if (selectedMasteries.length < requiredMasteries) {
							selectedMasteries.push(weaponKey);
							$label.css("background", "var(--rgb-bg-highlight)");
						} else {
							evt.target.checked = false;
							JqueryUtil.doToast({type: "warning", content: `You can only choose ${requiredMasteries} weapon masteries.`});
						}
					} else {
						selectedMasteries = selectedMasteries.filter(m => m !== weaponKey);
						$label.css("background", "");
					}
					$("#respec-mastery-count").text(selectedMasteries.length);
				});

				$checkboxes.append($label);
			});

			$group.append($checkboxes);
			$modalInner.append($group);
		};

		renderWeaponGroup(simpleWeapons, "Simple Weapons");
		renderWeaponGroup(martialWeapons, "Martial Weapons");

		$$`<div class="ve-flex-h-right mt-3">
			<button class="ve-btn ve-btn-default mr-2">Cancel</button>
			<button class="ve-btn ve-btn-primary">Apply Changes</button>
		</div>`.appendTo($modalInner)
			.find("button")
			.eq(0)
			.on("click", () => doClose());

		$modalInner.find(".ve-btn-primary").on("click", async () => {
			if (selectedMasteries.length !== requiredMasteries) {
				JqueryUtil.doToast({type: "warning", content: `Please select exactly ${requiredMasteries} weapon masteries.`});
				return;
			}

			const didUpdate = this._state.updateLevelChoice(level, {weaponMasteries: [...selectedMasteries]});
			if (!didUpdate) {
				JqueryUtil.doToast({type: "danger", content: "Failed to update level history entry."});
				return;
			}
			this._page.replayHistoryMartialChoices();

			doClose();
			closeParentModal();
			this.render();
			this._page.renderCharacter();
			await this._page.saveCharacter();
			JqueryUtil.doToast({type: "success", content: `Updated level ${level} weapon masteries.`});
		});
	}

	/**
	 * Edit optional feature choices (metamagic, invocations, etc.)
	 * @param {number} level - The level
	 * @param {object} history - The history entry
	 * @param {object} choice - The editable choice descriptor with featureTypeKey and count
	 * @param {Function} closeParentModal - Function to close parent modal
	 */
	async _editOptionalFeatures (level, history, choice, closeParentModal) {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: `Change ${choice.label}`,
			isMinHeight0: true,
			isWidth100: true,
			isUncappedWidth: true,
			cbClose: () => {},
		});

		const featureTypeKey = choice.featureTypeKey;
		const requiredCount = choice.count;

		// Get all available optional features of this type
		const allOptFeaturesRaw = this._page.filterByAllowedSources(this._page.getOptionalFeatures() || []);
		const classData = this._page.getClasses()?.find(c =>
			c.name === history.class?.name && c.source === history.class?.source,
		);
		const allOptFeatures = CharacterSheetClassUtils.filterOptFeaturesByEdition(allOptFeaturesRaw, classData?.source || history.class?.source);

		// Filter to matching feature type
		const featureTypes = featureTypeKey.split("_");
		const matchingOptions = allOptFeatures.filter(opt => {
			return opt.featureType?.some(ft => featureTypes.some(progType => ft === progType || ft.startsWith(progType)));
		});

		// Current selections for this type
		const currentSelections = (history.choices.optionalFeatures || [])
			.filter(of => of.type === featureTypeKey);
		const currentNames = new Set(currentSelections.map(s => s.name));

		// Get all existing optional features from ALL levels (to filter already-known from other levels)
		const existingFeatures = this._state.getFeatures().filter(f => f.featureType === "Optional Feature");
		const existingFromOtherLevels = new Set();
		const allHistory = this._state.getLevelHistory();
		for (const entry of allHistory) {
			if (entry.level === level) continue;
			for (const of of (entry.choices?.optionalFeatures || [])) {
				if (of.type === featureTypeKey) existingFromOtherLevels.add(of.name);
			}
		}

		let selectedNames = new Set(currentNames);

		$modalInner.append(`
			<p class="ve-muted mb-2">Choose ${requiredCount} ${choice.label.toLowerCase()} for this level.</p>
			<div class="ve-small ve-muted mb-2">Selected: <span id="respec-optfeat-count">${selectedNames.size}</span>/${requiredCount}</div>
		`);

		const $list = $(`<div style="max-height: 60vh; overflow-y: auto; border: 1px solid var(--rgb-border-grey); border-radius: 4px; padding: 0.5rem;"></div>`);

		matchingOptions
			.sort((a, b) => a.name.localeCompare(b.name))
			.forEach(opt => {
				const isCurrentLevel = currentNames.has(opt.name);
				const isOtherLevel = existingFromOtherLevels.has(opt.name);
				const isSelected = selectedNames.has(opt.name);

				const $item = $(`
					<label style="display:flex; align-items:center; cursor:pointer; padding:6px 8px; border-bottom:1px solid var(--rgb-border-grey); ${isSelected ? "background: var(--rgb-bg-highlight);" : ""} ${isOtherLevel && !isCurrentLevel ? "opacity:0.5;" : ""}">
						<input type="checkbox" ${isSelected ? "checked" : ""} ${isOtherLevel && !isCurrentLevel ? "disabled" : ""} style="margin-right:8px;">
						<span>
							<strong>${opt.name}</strong>
							${opt.source ? `<span class="text-muted ve-small ml-1">[${Parser.sourceJsonToAbv(opt.source)}]</span>` : ""}
							${isOtherLevel && !isCurrentLevel ? `<span class="text-muted ve-small ml-1">(known from another level)</span>` : ""}
						</span>
					</label>
				`);

				$item.find("input").on("change", (evt) => {
					if (evt.target.checked) {
						if (selectedNames.size < requiredCount) {
							selectedNames.add(opt.name);
							$item.css("background", "var(--rgb-bg-highlight)");
						} else {
							evt.target.checked = false;
							JqueryUtil.doToast({type: "warning", content: `You can only choose ${requiredCount} ${choice.label.toLowerCase()}.`});
						}
					} else {
						selectedNames.delete(opt.name);
						$item.css("background", "");
					}
					$("#respec-optfeat-count").text(selectedNames.size);
				});

				$list.append($item);
			});

		$modalInner.append($list);

		$$`<div class="ve-flex-h-right mt-3">
			<button class="ve-btn ve-btn-default mr-2">Cancel</button>
			<button class="ve-btn ve-btn-primary">Apply Changes</button>
		</div>`.appendTo($modalInner)
			.find("button")
			.eq(0)
			.on("click", () => doClose());

		$modalInner.find(".ve-btn-primary").on("click", async () => {
			if (selectedNames.size !== requiredCount) {
				JqueryUtil.doToast({type: "warning", content: `Please select exactly ${requiredCount} ${choice.label.toLowerCase()}.`});
				return;
			}

			// Build new optional feature entries
			const newSelections = matchingOptions
				.filter(opt => selectedNames.has(opt.name))
				.map(opt => ({name: opt.name, source: opt.source, type: featureTypeKey}));

			// Remove old features from state for this type at this level
			for (const old of currentSelections) {
				const stateFeature = existingFeatures.find(f =>
					f.name === old.name && f.featureType === "Optional Feature"
					&& (f.optionalFeatureTypes || []).some(ft => featureTypes.includes(ft)),
				);
				if (stateFeature) this._state.removeFeature(stateFeature.id);
			}

			// Add new features to state
			for (const sel of newSelections) {
				const fullOpt = matchingOptions.find(opt => opt.name === sel.name && opt.source === sel.source);
				if (fullOpt) {
					this._state.addFeature(CharacterSheetClassUtils.buildFeatureStateObject(fullOpt, {
						className: history.class?.name,
						classSource: history.class?.source,
						level,
						featureType: "Optional Feature",
						optionalFeatureTypes: featureTypes,
					}));
				}
			}

			// Update history entry — replace optionalFeatures of this type, keep others
			const otherTypeFeatures = (history.choices.optionalFeatures || []).filter(of => of.type !== featureTypeKey);
			const updatedOptionalFeatures = [...otherTypeFeatures, ...newSelections];

			// Also update replayData snapshots for this type
			const newReplaySnapshots = newSelections.map(sel => {
				const fullOpt = matchingOptions.find(opt => opt.name === sel.name && opt.source === sel.source);
				return fullOpt
					? CharacterSheetClassUtils.buildHistoryFeatureSnapshot(fullOpt, {type: featureTypeKey})
					: sel;
			});
			const otherTypeReplay = (history.choices.replayData?.optionalFeatures || [])
				.filter(snap => {
					const snapType = snap.type || snap.optionalFeatureTypes?.join("_");
					return snapType !== featureTypeKey;
				});

			this._state.updateLevelChoice(level, {
				optionalFeatures: updatedOptionalFeatures,
				replayData: {
					...(history.choices.replayData || {}),
					optionalFeatures: [...otherTypeReplay, ...newReplaySnapshots],
				},
			});

			doClose();
			closeParentModal();
			this.render();
			this._page.renderCharacter();
			await this._page.saveCharacter();
			JqueryUtil.doToast({type: "success", content: `Updated ${choice.label}.`});
		});
	}

	/**
	 * Get a human-readable label for an optional feature type code.
	 * @param {string} typeKey - e.g. "MM", "EI", "PB"
	 * @returns {string} Human-readable label
	 */
	static _getOptionalFeatureTypeLabel (typeKey) {
		const typeNames = {
			"EI": "Eldritch Invocations",
			"MM": "Metamagic Options",
			"MV:B": "Battle Master Maneuvers",
			"AS": "Arcane Shot Options",
			"ED": "Elemental Disciplines",
			"PB": "Pact Boons",
			"AI": "Artificer Infusions",
			"RN": "Rune Knight Runes",
		};
		return typeNames[typeKey] || `Optional Features (${typeKey})`;
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
	 * @param {object} choice - The choice info (includes label, current, index)
	 * @param {Function} closeParentModal - Function to close parent modal
	 */
	async _editFeatureChoice (level, history, choice, closeParentModal) {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: `Change ${choice.label}`,
			isMinHeight0: true,
			isWidth100: true,
			isUncappedWidth: true,
			cbClose: () => {},
		});

		const currentChoice = history.choices.featureChoices[choice.index];
		const $content = $(`<div class="charsheet__respec-feature-modal"></div>`);

		$content.append(`<p class="text-muted mb-2">Current: <strong>${currentChoice.choice}</strong></p>`);

		// Get available options for this feature
		const parentFeatureName = currentChoice.featureName;
		const classFeatures = this._page.getClassFeatures();

		// Find the parent feature that defines the options
		const parentFeature = classFeatures.find(f =>
			f.name === parentFeatureName
			&& f.className === history.class.name,
		);

		if (!parentFeature) {
			$content.append(`<p class="text-danger">Could not find parent feature "${parentFeatureName}" to load options.</p>`);
			const $closeBtn = $(`<button class="ve-btn ve-btn-default mt-3">Close</button>`);
			$closeBtn.on("click", () => doClose());
			$content.append($closeBtn);
			$modalInner.append($content);
			return;
		}

		// Get options from the parent feature
		const levelUp = this._page._levelUp;
		const optionGroups = levelUp._findFeatureOptions(parentFeature, level);

		if (!optionGroups.length || !optionGroups[0].options?.length) {
			$content.append(`<p class="text-danger">No alternative options found for this feature.</p>`);
			const $closeBtn = $(`<button class="ve-btn ve-btn-default mt-3">Close</button>`);
			$closeBtn.on("click", () => doClose());
			$content.append($closeBtn);
			$modalInner.append($content);
			return;
		}

		// Get existing features to filter already-chosen options
		const existingFeatures = this._state.getFeatures();
		const existingFeatureNames = new Set(existingFeatures.map(f => f.name));

		// Filter to options not already chosen (except current)
		const availableOptions = optionGroups[0].options.filter(opt => {
			if (opt.name === currentChoice.choice) return true; // Always show current
			return !existingFeatureNames.has(opt.name);
		});

		$content.append(`<h5>Select New ${choice.label}</h5>`);

		// Option list
		const $optionList = $(`<div class="charsheet__respec-feat-list"></div>`);
		let selectedOption = null;

		availableOptions.forEach(opt => {
			const isCurrent = opt.name === currentChoice.choice;
			const $item = $(`
				<div class="charsheet__respec-feat-item ${isCurrent ? "charsheet__respec-feat-current" : ""}">
					<strong>${opt.name}</strong>
					${opt.source ? `<span class="text-muted">${Parser.sourceJsonToAbv(opt.source)}</span>` : ""}
				</div>
			`);

			$item.on("click", () => {
				selectedOption = opt;
				$optionList.find(".charsheet__respec-feat-selected").removeClass("charsheet__respec-feat-selected");
				$item.addClass("charsheet__respec-feat-selected");
			});

			$optionList.append($item);
		});

		$content.append($optionList);

		// Buttons
		const $btnRow = $(`<div class="charsheet__respec-btn-row mt-3"></div>`);
		const $cancelBtn = $(`<button class="ve-btn ve-btn-default">Cancel</button>`);
		$cancelBtn.on("click", () => doClose());

		const $applyBtn = $(`<button class="ve-btn ve-btn-primary">Apply Changes</button>`);
		$applyBtn.on("click", async () => {
			if (!selectedOption) {
				JqueryUtil.doToast({type: "warning", content: "Please select an option."});
				return;
			}

			if (selectedOption.name === currentChoice.choice) {
				JqueryUtil.doToast({type: "info", content: "No changes made."});
				doClose();
				return;
			}

			await this._applyFeatureChoiceChange(level, history, choice.index, currentChoice, selectedOption);

			doClose();
			closeParentModal();
			this.render();
			this._page.renderCharacter();
			await this._page.saveCharacter();
			JqueryUtil.doToast({type: "success", content: `Changed ${choice.label} to ${selectedOption.name}.`});
		});

		$btnRow.append($cancelBtn).append($applyBtn);
		$content.append($btnRow);

		$modalInner.append($content);
	}

	/**
	 * Apply feature choice change
	 * @param {number} level - The level
	 * @param {object} history - The history entry
	 * @param {number} choiceIndex - Index in featureChoices array
	 * @param {object} oldChoice - The old choice {featureName, choice, source}
	 * @param {object} newOption - The new option to apply
	 */
	async _applyFeatureChoiceChange (level, history, choiceIndex, oldChoice, newOption) {
		// Remove old feature using proper API
		const features = this._state.getFeatures();
		const oldFeature = features.find(f =>
			f.name === oldChoice.choice && f.parentFeature === oldChoice.featureName,
		);
		if (oldFeature) {
			this._state.removeFeature(oldFeature.id);
		}

		// Add new feature
		const classFeatures = this._page.getClassFeatures();
		let fullFeature = null;

		if (newOption.type === "classFeature" && newOption.ref) {
			const parts = newOption.ref.split("|");
			fullFeature = classFeatures.find(f =>
				f.name === parts[0]
				&& f.className === parts[1]
				&& f.source === parts[2],
			);
		}

		this._state.addFeature({
			name: newOption.name,
			source: newOption.source || fullFeature?.source || history.class.source,
			level: newOption.level || level,
			className: newOption.className || history.class.name,
			classSource: history.class.source,
			featureType: "Class",
			entries: fullFeature?.entries,
			description: fullFeature?.entries ? Renderer.get().render({entries: fullFeature.entries}) : "",
			isFeatureOption: true,
			parentFeature: oldChoice.featureName,
		});

		// Update history
		const updatedFeatureChoices = [...history.choices.featureChoices];
		updatedFeatureChoices[choiceIndex] = {
			featureName: oldChoice.featureName,
			choice: newOption.name,
			source: newOption.source,
		};

		this._state.updateLevelChoice(level, {
			featureChoices: updatedFeatureChoices,
		});
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
	}

	/**
	 * Edit subclass choice - shows cascade warning and handles feature removal
	 * @param {number} level - The level where subclass was chosen
	 * @param {object} history - The history entry
	 * @param {Function} closeParentModal - Function to close parent modal
	 */
	async _editSubclass (level, history, closeParentModal) {
		const currentSubclass = history.choices?.subclass;
		if (!currentSubclass) {
			JqueryUtil.doToast({type: "warning", content: "No subclass found at this level."});
			return;
		}

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: `Change ${history.class.name} Subclass`,
			isMinHeight0: true,
			isWidth100: true,
			isUncappedWidth: true,
			cbClose: () => {},
		});

		const $content = $(`<div class="charsheet__respec-subclass-modal"></div>`);

		// Show current subclass
		$content.append(`<p class="text-muted mb-2">Current Subclass: <strong>${currentSubclass.name}</strong></p>`);

		// Get available subclasses for this class
		const classes = this._page.getClasses();
		const classData = classes.find(c => c.name === history.class.name && c.source === history.class.source);

		if (!classData?.subclasses?.length) {
			$content.append(`<p class="text-danger">Could not find subclass options for ${history.class.name}.</p>`);
			const $closeBtn = $(`<button class="ve-btn ve-btn-default mt-3">Close</button>`);
			$closeBtn.on("click", () => doClose());
			$content.append($closeBtn);
			$modalInner.append($content);
			return;
		}

		// Filter subclasses by allowed sources
		let availableSubclasses = classData.subclasses;
		if (this._page.filterByAllowedSources) {
			availableSubclasses = this._page.filterByAllowedSources(availableSubclasses);
		}

		// Calculate what will be removed
		const featuresToRemove = this._getSubclassFeatures(currentSubclass);
		const willRemoveCount = featuresToRemove.length;

		// Show cascade warning
		if (willRemoveCount > 0) {
			const $warning = $(`
				<div class="charsheet__respec-cascade-warning">
					<h5><span class="text-warning">⚠️</span> Features to be removed (${willRemoveCount}):</h5>
					<ul class="charsheet__respec-cascade-list"></ul>
				</div>
			`);
			const $list = $warning.find(".charsheet__respec-cascade-list");
			featuresToRemove.slice(0, 10).forEach(f => {
				$list.append(`<li>${f.name} <span class="text-muted">(Level ${f.level})</span></li>`);
			});
			if (willRemoveCount > 10) {
				$list.append(`<li class="text-muted">...and ${willRemoveCount - 10} more</li>`);
			}
			$content.append($warning);
		}

		// Subclass selection
		$content.append(`<h5>Select New Subclass</h5>`);

		const $searchRow = $(`<div class="charsheet__respec-search-row mb-2"></div>`);
		const $searchInput = $(`<input type="text" class="form-control" placeholder="Search subclasses...">`);
		$searchRow.append($searchInput);
		$content.append($searchRow);

		const $subclassList = $(`<div class="charsheet__respec-feat-list"></div>`);
		let selectedSubclass = null;

		const renderSubclasses = (filter = "") => {
			$subclassList.empty();
			const filterLower = filter.toLowerCase();
			const filtered = availableSubclasses.filter(sc => {
				if (!sc.name.toLowerCase().includes(filterLower)) return false;
				return true;
			}).slice(0, 30);

			if (filtered.length === 0) {
				$subclassList.append(`<p class="text-muted">No subclasses found.</p>`);
				return;
			}

			filtered.forEach(subclass => {
				const isCurrent = subclass.name === currentSubclass.name && subclass.source === currentSubclass.source;
				const isSelected = selectedSubclass && subclass.name === selectedSubclass.name && subclass.source === selectedSubclass.source;
				const $item = $(`
					<div class="charsheet__respec-feat-item ${isCurrent ? "charsheet__respec-feat-current" : ""} ${isSelected ? "charsheet__respec-feat-selected" : ""}">
						<strong>${subclass.name}</strong>
						<span class="text-muted">${Parser.sourceJsonToAbv(subclass.source)}</span>
					</div>
				`);
				$item.on("click", () => {
					selectedSubclass = subclass;
					$subclassList.find(".charsheet__respec-feat-selected").removeClass("charsheet__respec-feat-selected");
					$item.addClass("charsheet__respec-feat-selected");
				});
				$subclassList.append($item);
			});
		};

		renderSubclasses();

		$searchInput.on("input", () => {
			renderSubclasses($searchInput.val());
		});

		$content.append($subclassList);

		// Buttons
		const $btnRow = $(`<div class="charsheet__respec-btn-row mt-3"></div>`);
		const $cancelBtn = $(`<button class="ve-btn ve-btn-default">Cancel</button>`);
		$cancelBtn.on("click", () => doClose());

		const $applyBtn = $(`<button class="ve-btn ve-btn-danger">Change Subclass</button>`);
		$applyBtn.on("click", async () => {
			if (!selectedSubclass) {
				JqueryUtil.doToast({type: "warning", content: "Please select a subclass."});
				return;
			}

			if (selectedSubclass.name === currentSubclass.name && selectedSubclass.source === currentSubclass.source) {
				JqueryUtil.doToast({type: "info", content: "No changes made."});
				doClose();
				return;
			}

			// Confirm cascade removal
			const confirmed = await InputUiUtil.pGetUserBoolean({
				title: "Confirm Subclass Change",
				htmlDescription: `<p>This will remove <strong>${willRemoveCount}</strong> features from your character and add all features from <strong>${selectedSubclass.name}</strong> up to your current level.</p><p>Are you sure?</p>`,
				textYes: "Change Subclass",
				textNo: "Cancel",
			});

			if (!confirmed) return;

			await this._applySubclassChange(level, history, currentSubclass, selectedSubclass);

			doClose();
			closeParentModal();
			this.render();
			this._page.renderCharacter();
			await this._page.saveCharacter();
			JqueryUtil.doToast({type: "success", content: `Changed subclass to ${selectedSubclass.name}.`});
		});

		$btnRow.append($cancelBtn).append($applyBtn);
		$content.append($btnRow);

		$modalInner.append($content);
	}

	/**
	 * Get all features that belong to a specific subclass
	 * @param {object} subclass - The subclass {name, shortName, source}
	 * @returns {Array} Array of features to remove
	 */
	_getSubclassFeatures (subclass) {
		const features = this._state.getFeatures();
		return features.filter(f => {
			// Check if feature is explicitly a subclass feature
			if (f.isSubclassFeature) {
				// Match by subclass name or short name
				if (f.subclassName === subclass.name || f.subclassShortName === subclass.shortName) {
					return true;
				}
			}
			// Check if feature has subclass source matching
			if (f.subclassSource === subclass.source && f.subclassShortName === subclass.shortName) {
				return true;
			}
			return false;
		});
	}

	/**
	 * Apply subclass change - removes old features and adds new ones
	 * @param {number} level - The level where subclass was chosen
	 * @param {object} history - The history entry
	 * @param {object} oldSubclass - The old subclass
	 * @param {object} newSubclass - The new subclass
	 */
	async _applySubclassChange (level, history, oldSubclass, newSubclass) {
		// Get current total level for this class
		const classes = this._state.getClasses();
		const classEntry = classes.find(c => c.name === history.class.name);
		const classLevel = classEntry?.level || 1;

		// Remove old subclass features using proper API
		const featuresToRemove = this._getSubclassFeatures(oldSubclass);
		featuresToRemove.forEach(f => {
			this._state.removeFeature(f.id);
		});

		// Update class entry with new subclass
		if (classEntry) {
			classEntry.subclass = {
				name: newSubclass.name,
				shortName: newSubclass.shortName,
				source: newSubclass.source,
			};
		}

		// Get new subclass features up to current level
		const subclassFeatures = this._page.getSubclassFeatures?.() || [];
		const newFeatures = subclassFeatures.filter(f => {
			if (f.subclassShortName !== newSubclass.shortName) return false;
			if (f.subclassSource !== newSubclass.source) return false;
			if (f.className !== history.class.name) return false;
			if (f.level > classLevel) return false;
			return true;
		});

		// Add new subclass features
		newFeatures.forEach(f => {
			this._state.addFeature({
				name: f.name,
				source: f.source,
				level: f.level,
				className: f.className,
				classSource: f.classSource,
				subclassName: newSubclass.name,
				subclassShortName: newSubclass.shortName,
				subclassSource: newSubclass.source,
				featureType: "Subclass",
				entries: f.entries,
				description: f.entries ? Renderer.get().render({entries: f.entries}) : "",
				isSubclassFeature: true,
			});
		});

		// Update all level history entries that had the old subclass
		const levelHistory = this._state.getLevelHistory();
		levelHistory.forEach(entry => {
			if (entry.choices?.subclass?.name === oldSubclass.name) {
				this._state.updateLevelChoice(entry.level, {
					subclass: {
						name: newSubclass.name,
						shortName: newSubclass.shortName,
						source: newSubclass.source,
					},
				});
			}
		});
	}
}

// Export for use in charactersheet.js
globalThis.CharacterSheetRespec = CharacterSheetRespec;
