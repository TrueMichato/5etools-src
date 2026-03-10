/**
 * Character Sheet Spell Picker
 * Reusable spell selection UI used by both LevelUp and QuickBuild modules.
 * Single source of truth for all spell-picking UIs (known spells, cantrips, wizard spellbook).
 */
class CharacterSheetSpellPicker {
	// ==========================================
	// Progress Header & Summary Panel Helpers
	// ==========================================

	/**
	 * Create a sticky progress header showing spell/cantrip counts with color coding.
	 * @private
	 */
	static _renderProgressHeader ({spellCount, cantripCount, selectedSpells, selectedCantrips, isWizard = false}) {
		const $header = $(`<div class="charsheet__spell-picker-header"></div>`);

		const $spellCounter = spellCount > 0 ? $(`
			<div class="charsheet__spell-picker-counter">
				<span class="charsheet__spell-picker-counter-icon">${isWizard ? "📖" : "📜"}</span>
				<span class="charsheet__spell-picker-counter-label">${isWizard ? "Spellbook" : "Spells"}:</span>
				<span class="charsheet__spell-picker-counter-value spell-counter-value">
					<span class="spell-count-current">${selectedSpells?.length || 0}</span>/<span class="spell-count-max">${spellCount}</span>
				</span>
			</div>
		`) : null;

		const $cantripCounter = cantripCount > 0 ? $(`
			<div class="charsheet__spell-picker-counter">
				<span class="charsheet__spell-picker-counter-icon">⭐</span>
				<span class="charsheet__spell-picker-counter-label">Cantrips:</span>
				<span class="charsheet__spell-picker-counter-value cantrip-counter-value">
					<span class="cantrip-count-current">${selectedCantrips?.length || 0}</span>/<span class="cantrip-count-max">${cantripCount}</span>
				</span>
			</div>
		`) : null;

		if ($spellCounter) $header.append($spellCounter);
		if ($cantripCounter) $header.append($cantripCounter);

		return $header;
	}

	/**
	 * Update progress header color states based on current counts.
	 * @private
	 */
	static _updateProgressHeader ({$header, spellCount, cantripCount, selectedSpells, selectedCantrips}) {
		// Update spell counter
		if (spellCount > 0) {
			const $spellValue = $header.find(".spell-counter-value");
			$header.find(".spell-count-current").text(selectedSpells.length);
			$spellValue.removeClass("charsheet__spell-picker-counter-value--complete charsheet__spell-picker-counter-value--over");
			if (selectedSpells.length === spellCount) {
				$spellValue.addClass("charsheet__spell-picker-counter-value--complete");
			} else if (selectedSpells.length > spellCount) {
				$spellValue.addClass("charsheet__spell-picker-counter-value--over");
			}
		}

		// Update cantrip counter
		if (cantripCount > 0) {
			const $cantripValue = $header.find(".cantrip-counter-value");
			$header.find(".cantrip-count-current").text(selectedCantrips.length);
			$cantripValue.removeClass("charsheet__spell-picker-counter-value--complete charsheet__spell-picker-counter-value--over");
			if (selectedCantrips.length === cantripCount) {
				$cantripValue.addClass("charsheet__spell-picker-counter-value--complete");
			} else if (selectedCantrips.length > cantripCount) {
				$cantripValue.addClass("charsheet__spell-picker-counter-value--over");
			}
		}
	}

	/**
	 * Create a collapsible summary panel showing selected spells as dismissible chips.
	 * @private
	 */
	static _renderSummaryPanel ({selectedSpells, selectedCantrips, spellCount, cantripCount, onRemove}) {
		const hasCantrips = cantripCount > 0;
		const hasSpells = spellCount > 0;
		const totalSelected = (selectedSpells?.length || 0) + (selectedCantrips?.length || 0);

		const $panel = $(`
			<div class="charsheet__spell-picker-summary">
				<div class="charsheet__spell-picker-summary-header">
					<span class="charsheet__spell-picker-summary-toggle">
						<span class="charsheet__spell-picker-summary-chevron">▶</span>
						<span class="charsheet__spell-picker-summary-title">Selected Spells</span>
						<span class="charsheet__spell-picker-summary-badge">${totalSelected}</span>
					</span>
				</div>
				<div class="charsheet__spell-picker-summary-body" style="display: none;">
					<div class="charsheet__spell-picker-chips"></div>
				</div>
			</div>
		`);

		const $toggle = $panel.find(".charsheet__spell-picker-summary-toggle");
		const $body = $panel.find(".charsheet__spell-picker-summary-body");
		const $chevron = $panel.find(".charsheet__spell-picker-summary-chevron");

		$toggle.on("click", () => {
			const isExpanded = $body.is(":visible");
			$body.slideToggle(150);
			$chevron.toggleClass("charsheet__spell-picker-summary-chevron--expanded", !isExpanded);
		});

		return $panel;
	}

	/**
	 * Update the summary panel with current selections.
	 * @private
	 */
	static _updateSummaryPanel ({$panel, selectedSpells, selectedCantrips, spellCount, cantripCount, onRemove}) {
		const $chips = $panel.find(".charsheet__spell-picker-chips");
		const $badge = $panel.find(".charsheet__spell-picker-summary-badge");
		const totalSelected = (selectedSpells?.length || 0) + (selectedCantrips?.length || 0);

		$badge.text(totalSelected);
		$chips.empty();

		if (totalSelected === 0) {
			$chips.append(`<span class="charsheet__spell-picker-chips-empty">No spells selected yet</span>`);
			return;
		}

		// Render cantrip chips
		if (selectedCantrips?.length > 0) {
			const $cantripGroup = $(`<div class="charsheet__spell-picker-chip-group"></div>`);
			$cantripGroup.append(`<span class="charsheet__spell-picker-chip-group-label">Cantrips:</span>`);
			const $cantripChips = $(`<div class="charsheet__spell-picker-chip-list"></div>`);

			selectedCantrips.forEach(spell => {
				const $chip = $(`
					<span class="charsheet__spell-picker-chip charsheet__spell-picker-chip--cantrip">
						<span class="charsheet__spell-picker-chip-name">${spell.name}</span>
						<button class="charsheet__spell-picker-chip-remove" title="Remove ${spell.name}">×</button>
					</span>
				`);
				$chip.find(".charsheet__spell-picker-chip-remove").on("click", (e) => {
					e.stopPropagation();
					onRemove(spell, true);
				});
				$cantripChips.append($chip);
			});

			$cantripGroup.append($cantripChips);
			$chips.append($cantripGroup);
		}

		// Render spell chips grouped by level
		if (selectedSpells?.length > 0) {
			const byLevel = {};
			selectedSpells.forEach(spell => {
				if (!byLevel[spell.level]) byLevel[spell.level] = [];
				byLevel[spell.level].push(spell);
			});

			Object.keys(byLevel).sort((a, b) => Number(a) - Number(b)).forEach(level => {
				const $group = $(`<div class="charsheet__spell-picker-chip-group"></div>`);
				$group.append(`<span class="charsheet__spell-picker-chip-group-label">Level ${level}:</span>`);
				const $chipList = $(`<div class="charsheet__spell-picker-chip-list"></div>`);

				byLevel[level].forEach(spell => {
					const $chip = $(`
						<span class="charsheet__spell-picker-chip">
							<span class="charsheet__spell-picker-chip-name">${spell.name}</span>
							<button class="charsheet__spell-picker-chip-remove" title="Remove ${spell.name}">×</button>
						</span>
					`);
					$chip.find(".charsheet__spell-picker-chip-remove").on("click", (e) => {
						e.stopPropagation();
						onRemove(spell, false);
					});
					$chipList.append($chip);
				});

				$group.append($chipList);
				$chips.append($group);
			});
		}
	}

	// ==========================================
	// Public Render Methods
	// ==========================================

	/**
	 * Render a known-spell + cantrip selection picker.
	 *
	 * @param {Object} opts
	 * @param {string} opts.className - Class name (e.g. "Sorcerer")
	 * @param {string} opts.classSource - Class source (e.g. "XPHB")
	 * @param {number} opts.spellCount - Number of leveled spells to pick
	 * @param {number} opts.cantripCount - Number of cantrips to pick
	 * @param {number} opts.maxSpellLevel - Max spell level available
	 * @param {Array} opts.allSpells - All spells from the page (pre-source-filtered)
	 * @param {Set<string>} opts.knownSpellIds - Set of "name|source" strings already known
	 * @param {Function} opts.onSelect - Callback(spells[], cantrips[]) on selection change
	 * @param {Function} [opts.getHoverLink] - Optional hover link builder (page, name, source) => html
	 * @param {Array} [opts.preSelectedSpells] - Pre-selected leveled spells
	 * @param {Array} [opts.preSelectedCantrips] - Pre-selected cantrips
	 * @param {Array} [opts.additionalClassNames] - Additional class names whose spell lists to include (e.g. ["Cleric"] for Divine Soul)
	 * @returns {jQuery} The section element
	 */
	static renderKnownSpellPicker (opts) {
		const {
			className,
			classSource,
			spellCount,
			cantripCount,
			maxSpellLevel,
			allSpells,
			knownSpellIds = new Set(),
			onSelect,
			getHoverLink,
			preSelectedSpells = [],
			preSelectedCantrips = [],
			additionalClassNames = [],
		} = opts;

		const totalCount = spellCount + cantripCount;
		const parts = [];
		if (spellCount > 0) parts.push(`${spellCount} spell${spellCount !== 1 ? "s" : ""} (up to level ${maxSpellLevel})`);
		if (cantripCount > 0) parts.push(`${cantripCount} cantrip${cantripCount !== 1 ? "s" : ""}`);

		const $section = $(`
			<div class="charsheet__levelup-section charsheet__spell-picker-container">
				<h5 class="charsheet__levelup-section-title">
					<span class="glyphicon glyphicon-fire"></span> Spells Known
				</h5>
				<p class="ve-small">Choose ${parts.join(" and ")} for your ${className}:</p>
				<div class="charsheet__spell-picker-progress-area"></div>
				<div class="charsheet__levelup-known-spell-selections"></div>
			</div>
		`);

		const $progressArea = $section.find(".charsheet__spell-picker-progress-area");
		const $container = $section.find(".charsheet__levelup-known-spell-selections");
		const selectedSpells = [...preSelectedSpells];
		const selectedCantrips = [...preSelectedCantrips];

		// Render progress header
		const $progressHeader = CharacterSheetSpellPicker._renderProgressHeader({
			spellCount,
			cantripCount,
			selectedSpells,
			selectedCantrips,
		});
		$progressArea.append($progressHeader);

		// Handler for removing spells from summary panel
		const handleRemove = (spell, isCantrip) => {
			const targetArr = isCantrip ? selectedCantrips : selectedSpells;
			const spellId = `${spell.name}|${spell.source}`;
			const idx = targetArr.findIndex(s => `${s.name}|${s.source}` === spellId);
			if (idx >= 0) {
				targetArr.splice(idx, 1);
				fireCallback();
				renderSpellList();
			}
		};

		// Render summary panel
		const $summaryPanel = CharacterSheetSpellPicker._renderSummaryPanel({
			selectedSpells,
			selectedCantrips,
			spellCount,
			cantripCount,
			onRemove: handleRemove,
		});
		$progressArea.append($summaryPanel);

		// Filter to class spells using Renderer API with fallback
		const classSpells = allSpells.filter(spell => {
			if (cantripCount > 0 && spellCount > 0) {
				if (spell.level > maxSpellLevel) return false;
			} else if (cantripCount > 0) {
				if (spell.level !== 0) return false;
			} else {
				if (spell.level < 1 || spell.level > maxSpellLevel) return false;
			}
			if (CharacterSheetClassUtils.spellIsForClass(spell, className)) return true;
			// Check additional class spell lists (e.g. Cleric for Divine Soul)
			if (additionalClassNames.some(cls => CharacterSheetClassUtils.spellIsForClass(spell, cls))) return true;
			return false;
		}).sort((a, b) => {
			if (a.level !== b.level) return a.level - b.level;
			return a.name.localeCompare(b.name);
		});

		// Collect unique schools for filters
		const schools = [...new Set(classSpells.map(s => s.school).filter(Boolean))].sort();

		// Build filter row
		const $filterRow = $(`<div class="ve-flex-wrap gap-2 mb-2" style="align-items: center;"></div>`);
		$container.append($filterRow);

		const $search = $(`<input type="text" class="form-control form-control-sm" placeholder="🔍 Search..." style="flex: 1; min-width: 150px;">`);
		$filterRow.append($search);

		const levelOptions = [];
		if (cantripCount > 0) levelOptions.push({value: "0", label: "Cantrips"});
		for (let i = 1; i <= maxSpellLevel; i++) levelOptions.push({value: i.toString(), label: `Level ${i}`});
		const $levelFilter = $(`
			<select class="form-control form-control-sm" style="width: auto; min-width: 100px;">
				<option value="">All Levels</option>
				${levelOptions.map(l => `<option value="${l.value}">${l.label}</option>`).join("")}
			</select>
		`);
		$filterRow.append($levelFilter);

		const $schoolFilter = $(`
			<select class="form-control form-control-sm" style="width: auto; min-width: 120px;">
				<option value="">All Schools</option>
				${schools.map(s => `<option value="${s}">${CharacterSheetClassUtils.getSchoolEmoji(s)} ${Parser.spSchoolAbvToFull(s)}</option>`).join("")}
			</select>
		`);
		$filterRow.append($schoolFilter);

		const $ritualFilter = $(`<label class="ve-flex-v-center ve-small" style="cursor: pointer; white-space: nowrap;"><input type="checkbox" class="mr-1"> 🔮 Ritual</label>`);
		const $concFilter = $(`<label class="ve-flex-v-center ve-small" style="cursor: pointer; white-space: nowrap;"><input type="checkbox" class="mr-1"> ⏳ Conc.</label>`);
		$filterRow.append($ritualFilter, $concFilter);

		const $spellList = $(`<div class="charsheet__modal-list" style="max-height: 350px; overflow-y: auto;"></div>`);
		$container.append($spellList);

		const fireCallback = () => {
			// Update progress header
			CharacterSheetSpellPicker._updateProgressHeader({
				$header: $progressHeader,
				spellCount,
				cantripCount,
				selectedSpells,
				selectedCantrips,
			});
			// Update summary panel
			CharacterSheetSpellPicker._updateSummaryPanel({
				$panel: $summaryPanel,
				selectedSpells,
				selectedCantrips,
				spellCount,
				cantripCount,
				onRemove: handleRemove,
			});
			onSelect([...selectedSpells], [...selectedCantrips]);
		};

		const renderSpellList = () => {
			$spellList.empty();

			const searchText = $search.val()?.toLowerCase() || "";
			const levelVal = $levelFilter.val();
			const schoolVal = $schoolFilter.val();
			const onlyRitual = $ritualFilter.find("input").prop("checked");
			const onlyConc = $concFilter.find("input").prop("checked");

			const filtered = classSpells.filter(spell => {
				if (searchText && !spell.name.toLowerCase().includes(searchText)) return false;
				if (levelVal !== "" && levelVal !== undefined && spell.level !== parseInt(levelVal)) return false;
				if (schoolVal && spell.school !== schoolVal) return false;
				if (onlyRitual && !CharacterSheetClassUtils.spellIsRitual(spell)) return false;
				if (onlyConc && !CharacterSheetClassUtils.spellIsConcentration(spell)) return false;
				return true;
			});

			if (!filtered.length) {
				$spellList.append(`<p class="ve-muted text-center py-2">No spells match your filters</p>`);
				return;
			}

			CharacterSheetSpellPicker._renderGroupedSpellList({
				$container: $spellList,
				spells: filtered,
				knownSpellIds,
				selectedSpells,
				selectedCantrips,
				spellCount,
				cantripCount,
				getHoverLink,
				onToggle: (spell) => {
					const isCantrip = spell.level === 0;
					const targetArr = isCantrip ? selectedCantrips : selectedSpells;
					const maxCount = isCantrip ? cantripCount : spellCount;
					const typeLabel = isCantrip ? "cantrips" : "spells";
					const spellId = `${spell.name}|${spell.source}`;
					const idx = targetArr.findIndex(s => `${s.name}|${s.source}` === spellId);

					if (idx >= 0) {
						targetArr.splice(idx, 1);
					} else if (targetArr.length < maxCount) {
						targetArr.push(spell);
					} else {
						JqueryUtil.doToast({type: "warning", content: `You can only select ${maxCount} ${typeLabel}.`});
						return;
					}

					fireCallback();
					renderSpellList();
				},
			});
		};

		$search.on("input", renderSpellList);
		$levelFilter.on("change", renderSpellList);
		$schoolFilter.on("change", renderSpellList);
		$ritualFilter.find("input").on("change", renderSpellList);
		$concFilter.find("input").on("change", renderSpellList);

		// Initialize header and summary if pre-selections exist
		if (selectedSpells.length || selectedCantrips.length) {
			CharacterSheetSpellPicker._updateProgressHeader({
				$header: $progressHeader,
				spellCount,
				cantripCount,
				selectedSpells,
				selectedCantrips,
			});
			CharacterSheetSpellPicker._updateSummaryPanel({
				$panel: $summaryPanel,
				selectedSpells,
				selectedCantrips,
				spellCount,
				cantripCount,
				onRemove: handleRemove,
			});
		}

		renderSpellList();

		return $section;
	}

	/**
	 * Render a wizard spellbook spell selection picker.
	 *
	 * @param {Object} opts
	 * @param {number} opts.spellCount - Number of spells to select
	 * @param {number} opts.maxSpellLevel - Maximum spell level the wizard can learn
	 * @param {Array} opts.allSpells - All spells from the page (pre-source-filtered)
	 * @param {Set<string>} opts.knownSpellIds - Set of "name|source" strings already in spellbook
	 * @param {Function} opts.onSelect - Callback(spells[]) on selection change
	 * @param {Function} [opts.getHoverLink] - Optional hover link builder
	 * @param {Array} [opts.preSelectedSpells] - Pre-selected spells
	 * @returns {jQuery} The section element
	 */
	static renderWizardSpellbookPicker (opts) {
		const {
			spellCount,
			maxSpellLevel,
			allSpells,
			knownSpellIds = new Set(),
			onSelect,
			getHoverLink,
			preSelectedSpells = [],
		} = opts;

		const $section = $(`
			<div class="charsheet__levelup-section charsheet__spell-picker-container">
				<h5 class="charsheet__levelup-section-title">
					<span class="glyphicon glyphicon-book"></span> Spellbook
				</h5>
				<p class="ve-small">Choose ${spellCount} wizard spells (up to level ${maxSpellLevel}) to add to your spellbook:</p>
				<div class="charsheet__spell-picker-progress-area"></div>
				<div class="charsheet__levelup-spellbook-selections"></div>
			</div>
		`);

		const $progressArea = $section.find(".charsheet__spell-picker-progress-area");
		const $container = $section.find(".charsheet__levelup-spellbook-selections");
		const selectedSpells = [...preSelectedSpells];

		// Render progress header (wizard version)
		const $progressHeader = CharacterSheetSpellPicker._renderProgressHeader({
			spellCount,
			cantripCount: 0,
			selectedSpells,
			selectedCantrips: [],
			isWizard: true,
		});
		$progressArea.append($progressHeader);

		// Handler for removing spells from summary panel
		const handleRemove = (spell) => {
			const spellId = `${spell.name}|${spell.source}`;
			const idx = selectedSpells.findIndex(s => `${s.name}|${s.source}` === spellId);
			if (idx >= 0) {
				selectedSpells.splice(idx, 1);
				fireCallback();
				renderSpellList();
			}
		};

		// Render summary panel
		const $summaryPanel = CharacterSheetSpellPicker._renderSummaryPanel({
			selectedSpells,
			selectedCantrips: [],
			spellCount,
			cantripCount: 0,
			onRemove: handleRemove,
		});
		$progressArea.append($summaryPanel);

		// Filter to wizard spells up to max level
		const wizardSpells = allSpells.filter(spell => {
			let isWizardSpell = false;
			try {
				const classList = Renderer.spell.getCombinedClasses(spell, "fromClassList");
				isWizardSpell = classList?.some(c => c.name === "Wizard");
			} catch (e) {
				isWizardSpell = spell.classes?.fromClassList?.some(c => c.name === "Wizard");
			}
			return isWizardSpell && spell.level >= 1 && spell.level <= maxSpellLevel;
		}).sort((a, b) => {
			if (a.level !== b.level) return a.level - b.level;
			return a.name.localeCompare(b.name);
		});

		// Collect unique schools for filters
		const schools = [...new Set(wizardSpells.map(s => s.school).filter(Boolean))].sort();

		// Build filter row
		const $filterRow = $(`<div class="ve-flex-wrap gap-2 mb-2" style="align-items: center;"></div>`);
		$container.append($filterRow);

		const $search = $(`<input type="text" class="form-control form-control-sm" placeholder="🔍 Search..." style="flex: 1; min-width: 150px;">`);
		$filterRow.append($search);

		const levelOptions = [];
		for (let i = 1; i <= maxSpellLevel; i++) levelOptions.push({value: i.toString(), label: `Level ${i}`});
		const $levelFilter = $(`
			<select class="form-control form-control-sm" style="width: auto; min-width: 100px;">
				<option value="">All Levels</option>
				${levelOptions.map(l => `<option value="${l.value}">${l.label}</option>`).join("")}
			</select>
		`);
		$filterRow.append($levelFilter);

		const $schoolFilter = $(`
			<select class="form-control form-control-sm" style="width: auto; min-width: 120px;">
				<option value="">All Schools</option>
				${schools.map(s => `<option value="${s}">${CharacterSheetClassUtils.getSchoolEmoji(s)} ${Parser.spSchoolAbvToFull(s)}</option>`).join("")}
			</select>
		`);
		$filterRow.append($schoolFilter);

		const $ritualFilter = $(`<label class="ve-flex-v-center ve-small" style="cursor: pointer; white-space: nowrap;"><input type="checkbox" class="mr-1"> 🔮 Ritual</label>`);
		const $concFilter = $(`<label class="ve-flex-v-center ve-small" style="cursor: pointer; white-space: nowrap;"><input type="checkbox" class="mr-1"> ⏳ Conc.</label>`);
		$filterRow.append($ritualFilter, $concFilter);

		const $spellList = $(`<div class="charsheet__modal-list" style="max-height: 350px; overflow-y: auto;"></div>`);
		$container.append($spellList);

		const fireCallback = () => {
			// Update progress header
			CharacterSheetSpellPicker._updateProgressHeader({
				$header: $progressHeader,
				spellCount,
				cantripCount: 0,
				selectedSpells,
				selectedCantrips: [],
			});
			// Update summary panel
			CharacterSheetSpellPicker._updateSummaryPanel({
				$panel: $summaryPanel,
				selectedSpells,
				selectedCantrips: [],
				spellCount,
				cantripCount: 0,
				onRemove: handleRemove,
			});
			onSelect([...selectedSpells]);
		};

		const renderSpellList = () => {
			$spellList.empty();

			const searchText = $search.val()?.toLowerCase() || "";
			const levelVal = $levelFilter.val();
			const schoolVal = $schoolFilter.val();
			const onlyRitual = $ritualFilter.find("input").prop("checked");
			const onlyConc = $concFilter.find("input").prop("checked");

			const filtered = wizardSpells.filter(spell => {
				if (searchText && !spell.name.toLowerCase().includes(searchText)) return false;
				if (levelVal && spell.level !== parseInt(levelVal)) return false;
				if (schoolVal && spell.school !== schoolVal) return false;
				if (onlyRitual && !CharacterSheetClassUtils.spellIsRitual(spell)) return false;
				if (onlyConc && !CharacterSheetClassUtils.spellIsConcentration(spell)) return false;
				return true;
			});

			if (!filtered.length) {
				$spellList.append(`<p class="ve-muted text-center py-2">No spells match your filters</p>`);
				return;
			}

			CharacterSheetSpellPicker._renderGroupedSpellList({
				$container: $spellList,
				spells: filtered,
				knownSpellIds,
				selectedSpells,
				selectedCantrips: null,
				spellCount,
				cantripCount: 0,
				getHoverLink,
				onToggle: (spell) => {
					const spellId = `${spell.name}|${spell.source}`;
					const idx = selectedSpells.findIndex(s => `${s.name}|${s.source}` === spellId);

					if (idx >= 0) {
						selectedSpells.splice(idx, 1);
					} else if (selectedSpells.length < spellCount) {
						selectedSpells.push(spell);
					} else {
						JqueryUtil.doToast({type: "warning", content: `You can only select ${spellCount} spells.`});
						return;
					}

					fireCallback();
					renderSpellList();
				},
			});
		};

		$search.on("input", renderSpellList);
		$levelFilter.on("change", renderSpellList);
		$schoolFilter.on("change", renderSpellList);
		$ritualFilter.find("input").on("change", renderSpellList);
		$concFilter.find("input").on("change", renderSpellList);

		// Initialize header and summary if pre-selections exist
		if (selectedSpells.length) {
			CharacterSheetSpellPicker._updateProgressHeader({
				$header: $progressHeader,
				spellCount,
				cantripCount: 0,
				selectedSpells,
				selectedCantrips: [],
			});
			CharacterSheetSpellPicker._updateSummaryPanel({
				$panel: $summaryPanel,
				selectedSpells,
				selectedCantrips: [],
				spellCount,
				cantripCount: 0,
				onRemove: handleRemove,
			});
		}

		renderSpellList();

		return $section;
	}

	// ==========================================
	// Spell Info Modal
	// ==========================================

	/**
	 * Show spell info in a modal.
	 * @param {Object} spell - Spell data object
	 */
	static async showSpellInfoModal (spell) {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: spell.name,
			isMinHeight0: true,
			zIndex: 10002, // Above Quick Build overlay (9999) and toasts (10001)
		});

		const levelSchool = spell.level === 0
			? `${Parser.spSchoolAbvToFull(spell.school)} cantrip`
			: `${Parser.spLevelToFull(spell.level)}-level ${Parser.spSchoolAbvToFull(spell.school).toLowerCase()}`;

		$modalInner.append(`<p class="ve-muted"><em>${levelSchool}</em></p>`);

		// Basic info lines
		const infoLines = [];
		if (spell.time?.length) {
			const time = spell.time[0];
			infoLines.push(`<strong>Casting Time:</strong> ${time.number} ${time.unit}`);
		}
		if (spell.range) {
			let rangeStr = "";
			const range = spell.range;
			if (range.type === "point") {
				if (range.distance?.type === "self") rangeStr = "Self";
				else if (range.distance?.type === "touch") rangeStr = "Touch";
				else rangeStr = `${range.distance?.amount || ""} ${range.distance?.type || ""}`.trim();
			} else {
				rangeStr = range.type || "";
			}
			infoLines.push(`<strong>Range:</strong> ${rangeStr}`);
		}
		if (spell.components) {
			infoLines.push(`<strong>Components:</strong> ${CharacterSheetClassUtils.getSpellComponents(spell)}`);
		}
		if (spell.duration?.length) {
			const dur = spell.duration[0];
			let durStr = "Instantaneous";
			if (dur.type === "timed") {
				durStr = dur.concentration
					? `Concentration, up to ${dur.duration.amount} ${dur.duration.type}`
					: `${dur.duration.amount} ${dur.duration.type}`;
			} else if (dur.type === "permanent") {
				durStr = "Until dispelled";
			}
			infoLines.push(`<strong>Duration:</strong> ${durStr}`);
		}

		$modalInner.append(`<div class="mb-2">${infoLines.join("<br>")}</div>`);

		// Spell description
		if (spell.entries) {
			$modalInner.append(`<div class="rd__b">${Renderer.get().render({type: "entries", entries: spell.entries})}</div>`);
		}

		// Higher level scaling
		if (spell.entriesHigherLevel) {
			$modalInner.append(`<div class="rd__b mt-2"><strong>At Higher Levels.</strong> ${Renderer.get().render({type: "entries", entries: spell.entriesHigherLevel})}</div>`);
		}

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			<button class="ve-btn ve-btn-default">Close</button>
		</div>`.appendTo($modalInner).find("button").on("click", () => doClose(false));
	}

	// ==========================================
	// Private Render Helpers
	// ==========================================

	/**
	 * Render a grouped-by-level spell list into a container.
	 * Shared rendering logic used by all pickers.
	 * @private
	 */
	static _renderGroupedSpellList ({$container, spells, knownSpellIds, selectedSpells, selectedCantrips, spellCount, cantripCount, getHoverLink, onToggle}) {
		// Group by level
		const byLevel = {};
		spells.forEach(spell => {
			if (!byLevel[spell.level]) byLevel[spell.level] = [];
			byLevel[spell.level].push(spell);
		});

		Object.keys(byLevel).sort((a, b) => Number(a) - Number(b)).forEach(level => {
			const levelNum = parseInt(level);
			const levelEmoji = levelNum === 0
				? "🔮"
				: (["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"][levelNum - 1] || "📜");
			const levelLabel = levelNum === 0 ? "Cantrips" : `Level ${level}`;

			const $levelSection = $(`<div class="charsheet__modal-section"></div>`).appendTo($container);
			$(`<div class="charsheet__modal-section-title">${levelEmoji} ${levelLabel} <span style="opacity: 0.6;">(${byLevel[level].length})</span></div>`).appendTo($levelSection);

			byLevel[level].forEach(spell => {
				const spellId = `${spell.name}|${spell.source}`;
				const isKnown = knownSpellIds.has(spellId);
				const isCantrip = spell.level === 0;
				const isSelected = isCantrip && selectedCantrips
					? selectedCantrips.some(s => `${s.name}|${s.source}` === spellId)
					: selectedSpells.some(s => `${s.name}|${s.source}` === spellId);

				const school = Parser.spSchoolAbvToFull?.(spell.school) || spell.school;
				const schoolEmoji = CharacterSheetClassUtils.getSchoolEmoji(spell.school);

				const componentStr = CharacterSheetClassUtils.getSpellComponents(spell) || "No components";
				const isConcentration = CharacterSheetClassUtils.spellIsConcentration(spell);
				const isRitual = CharacterSheetClassUtils.spellIsRitual(spell);

				const tagParts = [];
				if (isRitual) tagParts.push("🔮");
				if (isConcentration) tagParts.push("⏳");
				const tagsStr = tagParts.length ? ` ${tagParts.join(" ")}` : "";

				let subschoolStr = "";
				if (spell.subschools?.length) {
					const formatSubschool = (sub) => {
						const p = sub.split(":");
						return p.length === 2 ? p[1].toTitleCase() : sub.toTitleCase();
					};
					subschoolStr = ` • 🏷️ ${spell.subschools.map(formatSubschool).join(", ")}`;
				}

				const $item = $(`
					<div class="charsheet__modal-list-item ${isKnown ? "ve-muted" : ""} ${isSelected ? "charsheet__modal-list-item--selected" : ""}">
						<div class="charsheet__modal-list-item-icon">${schoolEmoji}</div>
						<div class="charsheet__modal-list-item-content">
							<div class="charsheet__modal-list-item-title"></div>
							<div class="charsheet__modal-list-item-subtitle">${school} • ${componentStr} • ${Parser.sourceJsonToAbv(spell.source)}${subschoolStr}</div>
						</div>
						${isKnown
							? `<span class="charsheet__modal-list-item-badge charsheet__modal-list-item-badge--known">✓ Known</span>`
							: isSelected
								? `<button class="ve-btn ve-btn-danger ve-btn-xs spell-toggle">✓ Selected</button>`
								: `<button class="ve-btn ve-btn-primary ve-btn-xs spell-toggle">+ Add</button>`
						}
					</div>
				`);

				// Add spell name with hover link
				const $title = $item.find(".charsheet__modal-list-item-title");
				try {
					if (getHoverLink) {
						const hoverLink = getHoverLink(UrlUtil.PG_SPELLS, spell.name, spell.source || Parser.SRC_XPHB);
						$title.html(`${hoverLink}${tagsStr}`);
					} else {
						$title.html(`${spell.name}${tagsStr}`);
					}
				} catch (e) {
					$title.html(`${spell.name}${tagsStr}`);
				}

				if (!isKnown) {
					$item.find(".spell-toggle").on("click", (e) => {
						e.stopPropagation();
						onToggle(spell);
					});

					// Click row to show info
					$item.on("click", (e) => {
						if (!$(e.target).is("button") && !$(e.target).closest("a").length) {
							CharacterSheetSpellPicker.showSpellInfoModal(spell);
						}
					});
				}

				$levelSection.append($item);
			});
		});
	}
}

// Export
export {CharacterSheetSpellPicker};
globalThis.CharacterSheetSpellPicker = CharacterSheetSpellPicker;
