/**
 * Character Sheet Spells Manager
 * Handles spell slots, known spells, prepared spells, and casting
 */
class CharacterSheetSpells {
	constructor (page) {
		this._page = page;
		this._state = page.getState();
		this._allSpells = [];
		this._filteredSpells = [];
		this._spellFilter = "";
		this._spellLevelFilter = "all";

		this._init();
	}

	_init () {
		this._initEventListeners();
	}

	setSpells (spells) {
		this._allSpells = spells;
		this._filteredSpells = spells;
	}

	// ========================================================================
	// Thelemar Spell Rarity/Legality System
	// ========================================================================
	// Override map: Set homebrew sources to a specific rarity
	// Format: { "SourceAbbrev": "uncommon" }
	// Available rarities: common, uncommon, rare, very-rare, legendary
	static HOMEBREW_RARITY_OVERRIDES = {
		// Example: "MyHomebrew": "rare",
		// Add your homebrew sources here with their desired rarity
	};

	/**
	 * Apply Thelemar rarity/legality tags to spells if the setting is enabled
	 * - Official sources: Legal + Common (unless spell has explicit tags)
	 * - Homebrew sources: Legal + Uncommon (unless spell has explicit tags)
	 * - Explicit spell tags always take precedence
	 * @param {Array} spells - Array of spell objects
	 * @returns {Array} Spells with rarity/legality applied
	 */
	_applyThelemarSpellRarity (spells) {
		// Check if the setting is enabled (defaults to true if not explicitly set to false)
		const settings = this._state.getSettings() || {};
		if (settings.thelemar_spellRarity === false) {
			return spells;
		}

		return spells.map(spell => {
			// Check if spell already has rarity or legality tags
			const existingSubschools = spell.subschools || [];
			const hasRarity = existingSubschools.some(s => s.includes("rarity:"));
			const hasLegality = existingSubschools.some(s => s.includes("legality:"));

			// If spell already has both tags, don't modify
			if (hasRarity && hasLegality) {
				return spell;
			}

			// Determine if source is official or homebrew
			const isOfficial = this._isOfficialSource(spell.source);
			const newSubschools = [...existingSubschools];

			// Apply legality if not already present
			if (!hasLegality) {
				newSubschools.push("legality:legal");
			}

			// Apply rarity if not already present
			if (!hasRarity) {
				if (isOfficial) {
					newSubschools.push("rarity:common");
				} else {
					// Check for homebrew-specific rarity override
					const overrideRarity = CharacterSheetSpells.HOMEBREW_RARITY_OVERRIDES[spell.source];
					if (overrideRarity) {
						newSubschools.push(`rarity:${overrideRarity}`);
					} else {
						newSubschools.push("rarity:uncommon");
					}
				}
			}

			// Return modified spell (don't mutate original)
			return {
				...spell,
				subschools: newSubschools,
			};
		});
	}

	/**
	 * Determine if a source is official (WotC published content)
	 * @param {string} source - Source abbreviation
	 * @returns {boolean} True if official source
	 */
	_isOfficialSource (source) {
		// Use SourceUtil if available
		if (typeof SourceUtil !== "undefined") {
			const filterGroup = SourceUtil.getFilterGroup(source);
			// Standard and Partnered are considered official
			return filterGroup === SourceUtil.FILTER_GROUP_STANDARD
				|| filterGroup === SourceUtil.FILTER_GROUP_PARTNERED;
		}

		// Fallback: check against known official sources
		const officialPrefixes = ["PHB", "XGE", "TCE", "FTD", "XPHB", "MM", "DMG", "SCAG", "VGM", "MTF", "GGR", "AI", "EGW", "MOT", "TCE", "FTD", "SCC", "WBtW", "SJA", "DSotDQ", "BGG", "PAitM", "BMT", "MPMoM", "VEoR", "PHB2024", "DMG2024", "MM2024"];
		return officialPrefixes.some(prefix => source === prefix || source.startsWith(prefix + "-"));
	}

	_initEventListeners () {
		// Spell slot pip clicks
		$(document).on("click", ".charsheet__slot-pip", (e) => {
			const $pip = $(e.currentTarget);
			const level = parseInt($pip.closest("[data-spell-level]").data("spell-level"));
			this._toggleSlot(level, $pip);
		});

		// Add spell button
		$(document).on("click", "#charsheet-btn-add-spell, #charsheet-add-spell", () => this._showSpellPicker());

		// Spell filter
		$(document).on("input", "#charsheet-spell-search", (e) => {
			this._spellFilter = e.target.value.toLowerCase();
			this._renderSpellList();
		});

		// Level filter
		$(document).on("change", "#charsheet-spell-level-filter", (e) => {
			this._spellLevelFilter = e.target.value;
			this._renderSpellList();
		});

		// Cast spell button
		$(document).on("click", ".charsheet__spell-cast", (e) => {
			const $btn = $(e.currentTarget);
			const spellId = $btn.closest(".charsheet__spell-item").data("spell-id");
			this._castSpell(spellId);
		});

		// Remove spell button
		$(document).on("click", ".charsheet__spell-remove", (e) => {
			const $btn = $(e.currentTarget);
			const spellId = $btn.closest(".charsheet__spell-item").data("spell-id");
			this._removeSpell(spellId);
		});

		// Toggle prepared
		$(document).on("click", ".charsheet__spell-prepared", (e) => {
			const $btn = $(e.currentTarget);
			const spellId = $btn.closest(".charsheet__spell-item").data("spell-id");
			this._togglePrepared(spellId);
		});

		// Spell info button
		$(document).on("click", ".charsheet__spell-info", (e) => {
			const $btn = $(e.currentTarget);
			const spellId = $btn.closest(".charsheet__spell-item").data("spell-id");
			this._showSpellInfo(spellId);
		});
	}

	_toggleSlot (level, $pip) {
		const isUsed = $pip.hasClass("used");
		const $container = $pip.closest("[data-spell-level]");
		const $pips = $container.find(".charsheet__slot-pip");

		if (isUsed) {
			// Restore a slot (rightmost used pip)
			const usedPips = $pips.filter(".used");
			if (usedPips.length > 0) {
				$(usedPips[usedPips.length - 1]).removeClass("used");
				const newCurrent = this._state.getSpellSlotsCurrent(level) + 1;
				this._state.setSpellSlots(level, this._state.getSpellSlotsMax(level), newCurrent);
			}
		} else {
			// Use a slot (leftmost available pip)
			const availablePips = $pips.not(".used");
			if (availablePips.length > 0) {
				$(availablePips[0]).addClass("used");
				const newCurrent = this._state.getSpellSlotsCurrent(level) - 1;
				this._state.setSpellSlots(level, this._state.getSpellSlotsMax(level), newCurrent);
			}
		}

		this._page.saveCharacter();
	}

	async _showSpellPicker () {
		const classes = this._state.getClasses();
		if (!classes.length) {
			JqueryUtil.doToast({type: "warning", content: "Add a class to your character first."});
			return;
		}

		// Get class spell list, filtered by allowed sources
		const characterClass = classes[0];
		const className = characterClass.name;
		const classSource = characterClass.source;
		const filteredSpells = this._page.filterByAllowedSources(this._allSpells);

		// Check if we should include core spell lists for homebrew classes
		const settings = this._state.getSettings?.() || {};
		const includeCoreSpells = settings.includeCoreSpellsForHomebrew !== false; // Default true

		// Determine if this is a non-standard source (homebrew/third-party)
		const isNonStandardSource = classSource && !["PHB", "XPHB", "TCE", "XGE"].includes(classSource);

		const classSpells = filteredSpells.filter(spell => {
			// Use Renderer.spell.getCombinedClasses to get properly merged class data
			const fromClassList = Renderer.spell.getCombinedClasses(spell, "fromClassList");
			if (!fromClassList?.length) return false;

			// Check if spell is on this class's list
			const matchesExact = fromClassList.some(c => c.name.toLowerCase() === className.toLowerCase());
			if (matchesExact) return true;

			// For homebrew/third-party classes: also include spells from the equivalent core class
			// if the setting is enabled
			if (includeCoreSpells && isNonStandardSource) {
				// Check if any PHB/XPHB class with the same name has this spell
				const matchesCore = fromClassList.some(c =>
					c.name.toLowerCase() === className.toLowerCase()
					&& ["PHB", "XPHB"].includes(c.source),
				);
				if (matchesCore) return true;
			}

			return false;
		});

		// Filter by level
		const characterLevel = this._state.getTotalLevel();
		const maxSpellLevel = this._getMaxSpellLevel(classes[0], characterLevel);

		const availableSpells = classSpells
			.filter(spell => spell.level <= maxSpellLevel)
			.sort((a, b) => {
				if (a.level !== b.level) return a.level - b.level;
				return a.name.localeCompare(b.name);
			});

		// Show modal using UiUtil
		await this._pShowSpellPickerModal(availableSpells);
	}

	_getMaxSpellLevel (classInfo, characterLevel) {
		// Full casters
		const fullCasters = ["Bard", "Cleric", "Druid", "Sorcerer", "Wizard"];
		// Half casters
		const halfCasters = ["Paladin", "Ranger", "Artificer"];
		// Third casters
		const thirdCasters = ["Eldritch Knight", "Arcane Trickster"];

		const className = classInfo.name;
		const subclassName = classInfo.subclass?.name;

		// Warlock has special progression - pact magic up to 5th, plus Mystic Arcanum
		if (className === "Warlock") {
			// Mystic Arcanum grants access to higher level spells
			if (characterLevel >= 17) return 9;
			if (characterLevel >= 15) return 8;
			if (characterLevel >= 13) return 7;
			if (characterLevel >= 11) return 6;
			// Pact Magic maxes at 5th level spells at level 9
			if (characterLevel >= 9) return 5;
			if (characterLevel >= 7) return 4;
			if (characterLevel >= 5) return 3;
			if (characterLevel >= 3) return 2;
			if (characterLevel >= 1) return 1;
			return 0;
		}

		let casterLevel = characterLevel;

		if (fullCasters.includes(className)) {
			// Full caster: use full level
		} else if (halfCasters.includes(className)) {
			casterLevel = Math.floor(characterLevel / 2);
		} else if (thirdCasters.includes(subclassName)) {
			casterLevel = Math.floor(characterLevel / 3);
		} else {
			return 0; // Non-caster
		}

		// Convert caster level to max spell level
		if (casterLevel >= 17) return 9;
		if (casterLevel >= 15) return 8;
		if (casterLevel >= 13) return 7;
		if (casterLevel >= 11) return 6;
		if (casterLevel >= 9) return 5;
		if (casterLevel >= 7) return 4;
		if (casterLevel >= 5) return 3;
		if (casterLevel >= 3) return 2;
		if (casterLevel >= 1) return 1;
		return 0;
	}

	async _pShowSpellPickerModal (spells) {
		// Apply Thelemar spell rarity/legality if enabled
		spells = this._applyThelemarSpellRarity(spells);

		const knownSpellIds = this._state.getSpells().map(s => `${s.name}|${s.source}`);

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "✨ Add Spell",
			isMinHeight0: true,
			isWidth100: true,
		});

		// Spell tracking status bar - shows cantrips and spells known/prepared
		const $statusBar = $(`<div class="charsheet__modal-status-bar" style="display: flex; flex-wrap: wrap; gap: 12px; padding: 8px 12px; background: rgba(var(--rgb-bg-text), 0.05); border-radius: 6px; margin-bottom: 12px; font-size: 0.85em;"></div>`).appendTo($modalInner);

		const updateStatusBar = () => {
			const info = this._state.getSpellcastingInfo();
			if (!info) {
				$statusBar.hide();
				return;
			}

			$statusBar.empty();

			// Cantrips
			if (info.cantripsKnown) {
				const allCantrips = this._state.getCantripsKnown();
				const count = allCantrips.filter(c => !c.sourceFeature).length;
				const limit = info.cantripsKnown;
				const colorClass = count > limit ? "text-danger" : (count === limit ? "text-success" : "");
				const icon = count > limit ? `<span class="glyphicon glyphicon-alert mr-1"></span>` : "⭐ ";

				$statusBar.append(`
					<div style="display: flex; align-items: center; gap: 6px;">
						<span style="color: #2dd4bf;">${icon}Cantrips:</span>
						<span class="bold ${colorClass}">${count}/${limit}</span>
					</div>
				`);
			}

			// Leveled spells
			const spells = this._state.getSpells();
			const leveledSpells = spells.filter(s => s.level > 0);
			const preparedSpells = leveledSpells.filter(s => s.prepared || s.alwaysPrepared);
			// Count spells that aren't from features (manual selections)
			const manualLeveledSpells = leveledSpells.filter(s => !s.sourceFeature);

			// For multiclass with per-class breakdown, show each class separately
			if (info.isMulticlass && info.byClass?.length > 1) {
				this._renderMulticlassStatusBar($statusBar, info, manualLeveledSpells, preparedSpells);
			} else if (info.type === "known") {
				const currentKnown = manualLeveledSpells.length;
				const maxKnown = info.spellsKnownMax || info.max;
				const colorClass = currentKnown > maxKnown ? "text-danger" : (currentKnown === maxKnown ? "text-success" : "");
				const icon = currentKnown > maxKnown ? `<span class="glyphicon glyphicon-alert mr-1"></span>` : "📖 ";

				$statusBar.append(`
					<div style="display: flex; align-items: center; gap: 6px;">
						<span style="color: #60a5fa;">${icon}Spells Known:</span>
						<span class="bold ${colorClass}">${currentKnown}/${maxKnown}</span>
						<span class="ve-muted ve-small" title="Known spells are permanent choices. You can swap one spell when you level up.">(permanent)</span>
					</div>
				`);
			} else if (info.type === "prepared") {
				const currentPrepared = preparedSpells.length;
				const maxPrepared = info.preparedMax || info.max;
				const colorClass = currentPrepared > maxPrepared ? "text-danger" : (currentPrepared === maxPrepared ? "text-success" : "");
				const icon = currentPrepared > maxPrepared ? `<span class="glyphicon glyphicon-alert mr-1"></span>` : (info.is2024 ? "✨ " : "📚 ");
				const editionLabel = info.is2024 ? "2024" : "2014";

				$statusBar.append(`
					<div style="display: flex; align-items: center; gap: 6px;">
						<span style="color: ${info.is2024 ? "#fbbf24" : "#a78bfa"};">${icon}Prepared:</span>
						<span class="bold ${colorClass}">${currentPrepared}/${maxPrepared}</span>
						<span class="ve-muted ve-small" title="Prepared spells can be changed after a long rest.">(${editionLabel} rules)</span>
					</div>
				`);
			}

			$statusBar.show();
		};
		updateStatusBar();

		// All available schools
		const schools = [...new Set(spells.map(s => s.school).filter(Boolean))].sort();

		// Get priority sources for sorting
		const prioritySources = this._state.getPrioritySources() || [];

		// Unique sources from spells - priority sources first, then official, then alphabetical
		const uniqueSources = [...new Set(spells.map(s => s.source))].sort((a, b) => {
			// Priority sources come first
			const aIsPriority = prioritySources.includes(a);
			const bIsPriority = prioritySources.includes(b);
			if (aIsPriority && !bIsPriority) return -1;
			if (!aIsPriority && bIsPriority) return 1;
			if (aIsPriority && bIsPriority) {
				// Both priority, sort by their order in the priority array
				return prioritySources.indexOf(a) - prioritySources.indexOf(b);
			}

			// Then official sources
			const officialPriority = ["PHB", "XGE", "TCE", "FTD", "XPHB"];
			const aIdx = officialPriority.indexOf(a);
			const bIdx = officialPriority.indexOf(b);
			if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
			if (aIdx !== -1) return -1;
			if (bIdx !== -1) return 1;
			return a.localeCompare(b);
		});

		// Intro text
		$modalInner.append(`
			<p class="ve-small ve-muted mb-3">
				Browse and add spells to your character. Click a spell to view details, or click <strong>+ Add</strong> to add it directly.
			</p>
		`);

		// Build enhanced filter UI - single row with source pushed to right
		const $filterRow = $(`<div class="charsheet__modal-filter-row"></div>`).appendTo($modalInner);

		// Helper function to position dropdown towards center of modal
		const positionDropdown = ($dropdown, $btn) => {
			const btnRect = $btn[0].getBoundingClientRect();
			const modalRect = $modalInner[0].getBoundingClientRect();
			const btnCenterX = btnRect.left + btnRect.width / 2;
			const modalCenterX = modalRect.left + modalRect.width / 2;

			// If button is to the left of center, open dropdown to the right
			// If button is to the right of center, open dropdown to the left
			if (btnCenterX < modalCenterX) {
				$dropdown.addClass("open-right").removeClass("open-left");
			} else {
				$dropdown.removeClass("open-right").addClass("open-left");
			}
		};

		// Search input with icon
		const $searchWrapper = $(`<div class="charsheet__modal-search"></div>`).appendTo($filterRow);
		const $search = $(`<input type="text" class="form-control" placeholder="🔍 Search spells by name...">`).appendTo($searchWrapper);

		// Get all unique classes and subclasses from spells for the filters
		// Use Renderer.spell.getCombinedClasses to get properly merged class/subclass data
		const allSpellClasses = new Set(); // Class names only
		const allSpellSubclasses = new Map(); // Map of "ClassName: SubclassName" -> Set of sources
		spells.forEach(spell => {
			// Get combined class list (includes _tmpClasses populated by Renderer.spell)
			const fromClassList = Renderer.spell.getCombinedClasses(spell, "fromClassList");
			if (fromClassList?.length) {
				fromClassList.forEach(c => {
					allSpellClasses.add(c.name);
				});
			}
			// Get combined subclass list (includes _tmpClasses populated by Renderer.spell)
			const fromSubclass = Renderer.spell.getCombinedClasses(spell, "fromSubclass");
			if (fromSubclass?.length) {
				fromSubclass.forEach(sc => {
					const key = `${sc.class.name}: ${sc.subclass.name}`;
					if (!allSpellSubclasses.has(key)) {
						allSpellSubclasses.set(key, new Set());
					}
					allSpellSubclasses.get(key).add(sc.subclass.source);
				});
			}
		});

		// Get character's classes and subclasses for default filtering
		const characterClasses = this._state.getClasses();
		const characterClassNames = characterClasses.map(c => c.name);
		const characterSubclassNames = characterClasses
			.filter(c => c.subclass)
			.map(c => `${c.name}: ${c.subclass}`);

		// Sort class names - character classes first, then alphabetically
		const sortedClassNames = [...allSpellClasses].sort((a, b) => {
			const aIsChar = characterClassNames.includes(a);
			const bIsChar = characterClassNames.includes(b);
			if (aIsChar && !bIsChar) return -1;
			if (!aIsChar && bIsChar) return 1;
			return a.localeCompare(b);
		});

		// Show ALL subclasses that have spell lists, but highlight player's class's subclasses
		// Sort: player's subclass first, then player's class's other subclasses, then rest alphabetically
		const sortedSubclassNames = [...allSpellSubclasses.keys()].sort((a, b) => {
			const [aClass] = a.split(": ");
			const [bClass] = b.split(": ");
			const aIsCharSubclass = characterSubclassNames.includes(a);
			const bIsCharSubclass = characterSubclassNames.includes(b);
			const aIsCharClass = characterClassNames.includes(aClass);
			const bIsCharClass = characterClassNames.includes(bClass);

			// Player's actual subclass first
			if (aIsCharSubclass && !bIsCharSubclass) return -1;
			if (!aIsCharSubclass && bIsCharSubclass) return 1;
			// Then player's class's other subclasses
			if (aIsCharClass && !bIsCharClass) return -1;
			if (!aIsCharClass && bIsCharClass) return 1;
			// Then alphabetically by class, then subclass
			if (aClass !== bClass) return aClass.localeCompare(bClass);
			const [, aSub] = a.split(": ");
			const [, bSub] = b.split(": ");
			return aSub.localeCompare(bSub);
		});

		// ===== CLASS FILTER =====
		let selectedClasses = new Set(characterClassNames.length > 0 ? characterClassNames : []); // Default to character's classes
		const $classDropdown = $(`
			<div class="charsheet__source-multiselect charsheet__class-multiselect">
				<button class="charsheet__source-multiselect-btn">
					<span class="charsheet__source-multiselect-icon">⚔️</span>
					<span class="charsheet__source-multiselect-text">${characterClassNames.length > 0 ? characterClassNames.join(", ") : "All Classes"}</span>
					<span class="charsheet__source-multiselect-arrow">▼</span>
				</button>
				<div class="charsheet__source-multiselect-dropdown charsheet__class-dropdown">
					<div class="charsheet__source-multiselect-actions">
						<button class="charsheet__source-action-btn" data-action="all">All Classes</button>
						<button class="charsheet__source-action-btn" data-action="myclass">My Classes</button>
						<button class="charsheet__source-action-btn" data-action="none">Clear</button>
					</div>
					<div class="charsheet__source-multiselect-list">
						${sortedClassNames.map(className => {
		const isCharClass = characterClassNames.includes(className);
		const defaultChecked = isCharClass || characterClassNames.length === 0;
		return `
								<label class="charsheet__source-multiselect-item${isCharClass ? " charsheet__source-multiselect-item--highlight" : ""}">
									<input type="checkbox" value="${className}"${defaultChecked ? " checked" : ""}>
									<span class="charsheet__source-multiselect-check">✓</span>
									<span class="charsheet__source-multiselect-label">${className}${isCharClass ? " ★" : ""}</span>
								</label>
							`;
	}).join("")}
					</div>
				</div>
			</div>
		`).appendTo($filterRow);

		// Class dropdown behavior
		const $classBtn = $classDropdown.find(".charsheet__source-multiselect-btn");
		const $classDropdownMenu = $classDropdown.find(".charsheet__source-multiselect-dropdown");
		const $classText = $classDropdown.find(".charsheet__source-multiselect-text");

		$classBtn.on("click", (e) => {
			e.stopPropagation();
			positionDropdown($classDropdownMenu, $classBtn);
			$classDropdownMenu.toggleClass("open");
			// Close other dropdowns
			$levelDropdownMenu?.removeClass("open");
			$schoolDropdownMenu?.removeClass("open");
			$sourceDropdownMenu?.removeClass("open");
			$subschoolDropdownMenu?.removeClass("open");
			$subclassDropdownMenu?.removeClass("open");
		});

		const updateClassText = () => {
			const checked = $classDropdown.find("input:checked");
			if (checked.length === 0) {
				$classText.text("No Classes");
				selectedClasses = new Set(["__NONE__"]);
			} else if (checked.length === sortedClassNames.length) {
				$classText.text("All Classes");
				selectedClasses = new Set(); // Empty = all
			} else if (checked.length <= 2) {
				$classText.text(checked.map((_, el) => $(el).val()).get().join(", "));
				selectedClasses = new Set(checked.map((_, el) => $(el).val()).get());
			} else {
				$classText.text(`${checked.length} Classes`);
				selectedClasses = new Set(checked.map((_, el) => $(el).val()).get());
			}
			renderList();
		};

		$classDropdown.find("input[type=checkbox]").on("change", updateClassText);
		$classDropdown.find("[data-action=all]").on("click", () => {
			$classDropdown.find("input").prop("checked", true);
			updateClassText();
		});
		$classDropdown.find("[data-action=myclass]").on("click", () => {
			$classDropdown.find("input").each((_, el) => {
				const val = $(el).val();
				const isCharClass = characterClassNames.includes(val);
				$(el).prop("checked", isCharClass);
			});
			updateClassText();
		});
		$classDropdown.find("[data-action=none]").on("click", () => {
			$classDropdown.find("input").prop("checked", false);
			updateClassText();
		});

		$classDropdownMenu.on("click", (e) => e.stopPropagation());

		// ===== SUBCLASS FILTER (SEPARATE) =====
		// Calculate which subclasses will be checked by default (same logic as the HTML)
		const defaultCheckedSubclasses = sortedSubclassNames.filter(subclassName => {
			const isCharSubclass = characterSubclassNames.includes(subclassName);
			const [className] = subclassName.split(": ");
			const isCharClass = characterClassNames.includes(className);
			return isCharSubclass || (characterSubclassNames.length === 0 && isCharClass);
		});
		// If all would be checked, use empty set (= all). Otherwise use the specific ones.
		let selectedSubclasses = defaultCheckedSubclasses.length === sortedSubclassNames.length
			? new Set()
			: new Set(defaultCheckedSubclasses.length > 0 ? defaultCheckedSubclasses : ["__NONE__"]);
		const $subclassDropdown = sortedSubclassNames.length > 0 ? $(`
			<div class="charsheet__source-multiselect charsheet__subclass-multiselect">
				<button class="charsheet__source-multiselect-btn">
					<span class="charsheet__source-multiselect-icon">📚</span>
					<span class="charsheet__source-multiselect-text">${
	defaultCheckedSubclasses.length === sortedSubclassNames.length
		? "All Expanded Lists"
		: defaultCheckedSubclasses.length === 0
			? "No Expanded Lists"
			: defaultCheckedSubclasses.length === 1
				? defaultCheckedSubclasses[0].split(": ")[1]
				: `${defaultCheckedSubclasses.length} Expanded Lists`
}</span>
					<span class="charsheet__source-multiselect-arrow">▼</span>
				</button>
				<div class="charsheet__source-multiselect-dropdown charsheet__subclass-dropdown">
					<div class="charsheet__source-multiselect-actions">
						<button class="charsheet__source-action-btn" data-action="all">All Expanded</button>
						<button class="charsheet__source-action-btn" data-action="mysubclass">My Subclass</button>
						<button class="charsheet__source-action-btn" data-action="none">None</button>
					</div>
					<div class="charsheet__source-multiselect-list" style="max-height: 300px;">
						<div class="charsheet__source-multiselect-hint">Subclasses that add extra spells:</div>
						${sortedSubclassNames.map(subclassName => {
		const isCharSubclass = characterSubclassNames.includes(subclassName);
		const [className, subName] = subclassName.split(": ");
		const isCharClass = characterClassNames.includes(className);
		// Default checked: player's actual subclass, or all if player has no subclass
		const defaultChecked = isCharSubclass || (characterSubclassNames.length === 0 && isCharClass);
		return `
								<label class="charsheet__source-multiselect-item${isCharSubclass ? " charsheet__source-multiselect-item--highlight" : isCharClass ? " charsheet__source-multiselect-item--related" : ""}">
									<input type="checkbox" value="${subclassName}"${defaultChecked ? " checked" : ""}>
									<span class="charsheet__source-multiselect-check">✓</span>
									<span class="charsheet__source-multiselect-label">
										<span class="ve-muted">${className}:</span> ${subName}${isCharSubclass ? " ★" : ""}
									</span>
								</label>
							`;
	}).join("")}
					</div>
				</div>
			</div>
		`).appendTo($filterRow) : null;

		// Subclass dropdown behavior
		let $subclassDropdownMenu = null;
		const $subclassText = $subclassDropdown?.find(".charsheet__source-multiselect-text");

		if ($subclassDropdown) {
			const $subclassBtn = $subclassDropdown.find(".charsheet__source-multiselect-btn");
			$subclassDropdownMenu = $subclassDropdown.find(".charsheet__source-multiselect-dropdown");

			$subclassBtn.on("click", (e) => {
				e.stopPropagation();
				positionDropdown($subclassDropdownMenu, $subclassBtn);
				$subclassDropdownMenu.toggleClass("open");
				// Close other dropdowns
				$classDropdownMenu.removeClass("open");
				$levelDropdownMenu?.removeClass("open");
				$schoolDropdownMenu?.removeClass("open");
				$sourceDropdownMenu?.removeClass("open");
				$subschoolDropdownMenu?.removeClass("open");
			});

			const updateSubclassText = () => {
				const checked = $subclassDropdown.find("input:checked");
				if (checked.length === 0) {
					$subclassText.text("No Expanded Lists");
					selectedSubclasses = new Set(["__NONE__"]);
				} else if (checked.length === sortedSubclassNames.length) {
					$subclassText.text("All Expanded Lists");
					selectedSubclasses = new Set(); // Empty = all
				} else if (checked.length === 1) {
					const val = checked.first().val();
					const [, subName] = val.split(": ");
					$subclassText.text(subName);
					selectedSubclasses = new Set(checked.map((_, el) => $(el).val()).get());
				} else {
					$subclassText.text(`${checked.length} Expanded Lists`);
					selectedSubclasses = new Set(checked.map((_, el) => $(el).val()).get());
				}
				renderList();
			};

			$subclassDropdown.find("input[type=checkbox]").on("change", updateSubclassText);
			$subclassDropdown.find("[data-action=all]").on("click", () => {
				$subclassDropdown.find("input").prop("checked", true);
				updateSubclassText();
			});
			$subclassDropdown.find("[data-action=mysubclass]").on("click", () => {
				$subclassDropdown.find("input").each((_, el) => {
					const val = $(el).val();
					const isCharSubclass = characterSubclassNames.includes(val);
					$(el).prop("checked", isCharSubclass);
				});
				updateSubclassText();
			});
			$subclassDropdown.find("[data-action=none]").on("click", () => {
				$subclassDropdown.find("input").prop("checked", false);
				updateSubclassText();
			});

			$subclassDropdownMenu.on("click", (e) => e.stopPropagation());
		}

		// Multi-select level filter
		let selectedLevels = new Set(); // Empty = all levels
		const levelOptions = [
			{value: "0", label: "⭐ Cantrips"},
			{value: "1", label: "1️⃣ Level 1"},
			{value: "2", label: "2️⃣ Level 2"},
			{value: "3", label: "3️⃣ Level 3"},
			{value: "4", label: "4️⃣ Level 4"},
			{value: "5", label: "5️⃣ Level 5"},
			{value: "6", label: "6️⃣ Level 6"},
			{value: "7", label: "7️⃣ Level 7"},
			{value: "8", label: "8️⃣ Level 8"},
			{value: "9", label: "9️⃣ Level 9"},
		];

		const $levelDropdown = $(`
			<div class="charsheet__source-multiselect charsheet__level-multiselect">
				<button class="charsheet__source-multiselect-btn">
					<span class="charsheet__source-multiselect-icon">📊</span>
					<span class="charsheet__source-multiselect-text">All Levels</span>
					<span class="charsheet__source-multiselect-arrow">▼</span>
				</button>
				<div class="charsheet__source-multiselect-dropdown charsheet__level-dropdown">
					<div class="charsheet__source-multiselect-actions">
						<button class="charsheet__source-action-btn" data-action="all">Select All</button>
						<button class="charsheet__source-action-btn" data-action="none">Clear All</button>
					</div>
					<div class="charsheet__source-multiselect-list">
						${levelOptions.map(l => `
							<label class="charsheet__source-multiselect-item">
								<input type="checkbox" value="${l.value}" checked>
								<span class="charsheet__source-multiselect-check">✓</span>
								<span class="charsheet__source-multiselect-label">${l.label}</span>
							</label>
						`).join("")}
					</div>
				</div>
			</div>
		`).appendTo($filterRow);

		// Level dropdown behavior
		const $levelBtn = $levelDropdown.find(".charsheet__source-multiselect-btn");
		const $levelDropdownMenu = $levelDropdown.find(".charsheet__source-multiselect-dropdown");
		const $levelText = $levelDropdown.find(".charsheet__source-multiselect-text");

		$levelBtn.on("click", (e) => {
			e.stopPropagation();
			positionDropdown($levelDropdownMenu, $levelBtn);
			$levelDropdownMenu.toggleClass("open");
			// Close other dropdowns
			$classDropdownMenu.removeClass("open");
			$schoolDropdownMenu.removeClass("open");
			$sourceDropdownMenu.removeClass("open");
		});

		const updateLevelText = () => {
			const checked = $levelDropdown.find("input:checked");
			if (checked.length === 0) {
				$levelText.text("No Levels");
				selectedLevels = new Set(["__NONE__"]);
			} else if (checked.length === levelOptions.length) {
				$levelText.text("All Levels");
				selectedLevels = new Set();
			} else if (checked.length === 1) {
				const val = checked.first().val();
				$levelText.text(val === "0" ? "Cantrips" : `Level ${val}`);
				selectedLevels = new Set(checked.map((_, el) => $(el).val()).get());
			} else {
				$levelText.text(`${checked.length} Levels`);
				selectedLevels = new Set(checked.map((_, el) => $(el).val()).get());
			}
			renderList();
		};

		$levelDropdown.find("input[type=checkbox]").on("change", updateLevelText);
		$levelDropdown.find("[data-action=all]").on("click", () => {
			$levelDropdown.find("input").prop("checked", true);
			updateLevelText();
		});
		$levelDropdown.find("[data-action=none]").on("click", () => {
			$levelDropdown.find("input").prop("checked", false);
			updateLevelText();
		});

		// Multi-select school filter
		let selectedSchools = new Set(); // Empty = all schools
		const $schoolDropdown = $(`
			<div class="charsheet__source-multiselect charsheet__school-multiselect">
				<button class="charsheet__source-multiselect-btn">
					<span class="charsheet__source-multiselect-icon">🎓</span>
					<span class="charsheet__source-multiselect-text">All Schools</span>
					<span class="charsheet__source-multiselect-arrow">▼</span>
				</button>
				<div class="charsheet__source-multiselect-dropdown charsheet__school-dropdown">
					<div class="charsheet__source-multiselect-actions">
						<button class="charsheet__source-action-btn" data-action="all">Select All</button>
						<button class="charsheet__source-action-btn" data-action="none">Clear All</button>
					</div>
					<div class="charsheet__source-multiselect-list">
						${schools.map(s => `
							<label class="charsheet__source-multiselect-item">
								<input type="checkbox" value="${s}" checked>
								<span class="charsheet__source-multiselect-check">✓</span>
								<span class="charsheet__source-multiselect-label">${this._getSchoolEmoji(s)} ${Parser.spSchoolAbvToFull(s)}</span>
							</label>
						`).join("")}
					</div>
				</div>
			</div>
		`).appendTo($filterRow);

		// School dropdown behavior
		const $schoolBtn = $schoolDropdown.find(".charsheet__source-multiselect-btn");
		const $schoolDropdownMenu = $schoolDropdown.find(".charsheet__source-multiselect-dropdown");
		const $schoolText = $schoolDropdown.find(".charsheet__source-multiselect-text");

		$schoolBtn.on("click", (e) => {
			e.stopPropagation();
			positionDropdown($schoolDropdownMenu, $schoolBtn);
			$schoolDropdownMenu.toggleClass("open");
			// Close other dropdowns
			$classDropdownMenu.removeClass("open");
			$levelDropdownMenu.removeClass("open");
			$sourceDropdownMenu.removeClass("open");
		});

		const updateSchoolText = () => {
			const checked = $schoolDropdown.find("input:checked");
			if (checked.length === 0) {
				$schoolText.text("No Schools");
				selectedSchools = new Set(["__NONE__"]);
			} else if (checked.length === schools.length) {
				$schoolText.text("All Schools");
				selectedSchools = new Set();
			} else if (checked.length === 1) {
				$schoolText.text(Parser.spSchoolAbvToFull(checked.first().val()));
				selectedSchools = new Set(checked.map((_, el) => $(el).val()).get());
			} else {
				$schoolText.text(`${checked.length} Schools`);
				selectedSchools = new Set(checked.map((_, el) => $(el).val()).get());
			}
			renderList();
		};

		$schoolDropdown.find("input[type=checkbox]").on("change", updateSchoolText);
		$schoolDropdown.find("[data-action=all]").on("click", () => {
			$schoolDropdown.find("input").prop("checked", true);
			updateSchoolText();
		});
		$schoolDropdown.find("[data-action=none]").on("click", () => {
			$schoolDropdown.find("input").prop("checked", false);
			updateSchoolText();
		});

		// Collect unique subschools from spells
		const allSubschools = [...new Set(spells.flatMap(s => s.subschools || []))].sort();

		// Multi-select subschool filter (only show if there are subschools)
		let selectedSubschools = new Set(); // Empty = all (no filter)
		let $subschoolDropdown = null;
		let $subschoolDropdownMenu = null;

		if (allSubschools.length > 0) {
			// Parse subschool into display name
			const formatSubschool = (sub) => {
				// Subschools are in format "category:value" like "rarity:common" or "legality:illegal-I"
				const parts = sub.split(":");
				if (parts.length === 2) {
					return `${parts[0].toTitleCase()}: ${parts[1].toTitleCase()}`;
				}
				return sub.toTitleCase();
			};

			$subschoolDropdown = $(`
				<div class="charsheet__source-multiselect charsheet__subschool-multiselect">
					<button class="charsheet__source-multiselect-btn">
						<span class="charsheet__source-multiselect-icon">🏷️</span>
						<span class="charsheet__source-multiselect-text">All Tags</span>
						<span class="charsheet__source-multiselect-arrow">▼</span>
					</button>
					<div class="charsheet__source-multiselect-dropdown charsheet__subschool-dropdown">
						<div class="charsheet__source-multiselect-actions">
							<button class="charsheet__source-action-btn" data-action="all">Select All</button>
							<button class="charsheet__source-action-btn" data-action="none">Clear All</button>
						</div>
						<div class="charsheet__source-multiselect-list">
							${allSubschools.map(sub => `
								<label class="charsheet__source-multiselect-item">
									<input type="checkbox" value="${sub}" checked>
									<span class="charsheet__source-multiselect-check">✓</span>
									<span class="charsheet__source-multiselect-label">${formatSubschool(sub)}</span>
								</label>
							`).join("")}
						</div>
					</div>
				</div>
			`).appendTo($filterRow);

			$subschoolDropdownMenu = $subschoolDropdown.find(".charsheet__source-multiselect-dropdown");
			const $subschoolBtn = $subschoolDropdown.find(".charsheet__source-multiselect-btn");
			const $subschoolText = $subschoolDropdown.find(".charsheet__source-multiselect-text");

			$subschoolBtn.on("click", (e) => {
				e.stopPropagation();
				positionDropdown($subschoolDropdownMenu, $subschoolBtn);
				$subschoolDropdownMenu.toggleClass("open");
				// Close other dropdowns
				$classDropdownMenu.removeClass("open");
				$levelDropdownMenu.removeClass("open");
				$schoolDropdownMenu.removeClass("open");
				$sourceDropdownMenu.removeClass("open");
			});

			const updateSubschoolText = () => {
				const checked = $subschoolDropdown.find("input:checked");
				if (checked.length === 0) {
					$subschoolText.text("No Tags");
					selectedSubschools = new Set(["__NONE__"]);
				} else if (checked.length === allSubschools.length) {
					$subschoolText.text("All Tags");
					selectedSubschools = new Set();
				} else if (checked.length === 1) {
					$subschoolText.text(formatSubschool(checked.first().val()));
					selectedSubschools = new Set(checked.map((_, el) => $(el).val()).get());
				} else {
					$subschoolText.text(`${checked.length} Tags`);
					selectedSubschools = new Set(checked.map((_, el) => $(el).val()).get());
				}
				renderList();
			};

			$subschoolDropdown.find("input[type=checkbox]").on("change", updateSubschoolText);
			$subschoolDropdown.find("[data-action=all]").on("click", () => {
				$subschoolDropdown.find("input").prop("checked", true);
				updateSubschoolText();
			});
			$subschoolDropdown.find("[data-action=none]").on("click", () => {
				$subschoolDropdown.find("input").prop("checked", false);
				updateSubschoolText();
			});

			$subschoolDropdownMenu.on("click", (e) => e.stopPropagation());
		}

		// Multi-select source filter (positioned on the right)
		let selectedSources = new Set(); // Empty = all sources
		const $sourceDropdown = $(`
			<div class="charsheet__source-multiselect charsheet__source-multiselect--right">
				<button class="charsheet__source-multiselect-btn">
					<span class="charsheet__source-multiselect-icon">📖</span>
					<span class="charsheet__source-multiselect-text">All Sources</span>
					<span class="charsheet__source-multiselect-arrow">▼</span>
				</button>
				<div class="charsheet__source-multiselect-dropdown">
					<div class="charsheet__source-multiselect-actions">
						<button class="charsheet__source-action-btn" data-action="all">Select All</button>
						<button class="charsheet__source-action-btn" data-action="none">Clear All</button>
						<button class="charsheet__source-action-btn" data-action="official">Official Only</button>
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
		`).appendTo($filterRow);

		// Source dropdown toggle behavior
		const $sourceBtn = $sourceDropdown.find(".charsheet__source-multiselect-btn");
		const $sourceDropdownMenu = $sourceDropdown.find(".charsheet__source-multiselect-dropdown");
		const $sourceText = $sourceDropdown.find(".charsheet__source-multiselect-text");

		$sourceBtn.on("click", (e) => {
			e.stopPropagation();
			positionDropdown($sourceDropdownMenu, $sourceBtn);
			$sourceDropdownMenu.toggleClass("open");
			// Close other dropdowns
			$classDropdownMenu.removeClass("open");
			$levelDropdownMenu.removeClass("open");
			$schoolDropdownMenu.removeClass("open");
			$subschoolDropdownMenu?.removeClass("open");
		});

		// Close all dropdowns when clicking outside
		$(document).on("click.spellSourceFilter", () => {
			$classDropdownMenu.removeClass("open");
			$sourceDropdownMenu.removeClass("open");
			$levelDropdownMenu.removeClass("open");
			$schoolDropdownMenu.removeClass("open");
			$subschoolDropdownMenu?.removeClass("open");
		});
		$sourceDropdownMenu.on("click", (e) => e.stopPropagation());
		$levelDropdownMenu.on("click", (e) => e.stopPropagation());
		$schoolDropdownMenu.on("click", (e) => e.stopPropagation());

		// Update source text based on selection
		const updateSourceText = () => {
			const checked = $sourceDropdown.find("input:checked");
			if (checked.length === 0) {
				$sourceText.text("No Sources");
				selectedSources = new Set(["__NONE__"]); // Special marker
			} else if (checked.length === uniqueSources.length) {
				$sourceText.text("All Sources");
				selectedSources = new Set(); // Empty = all
			} else if (checked.length <= 2) {
				$sourceText.text(checked.map((_, el) => Parser.sourceJsonToAbv($(el).val())).get().join(", "));
				selectedSources = new Set(checked.map((_, el) => $(el).val()).get());
			} else {
				$sourceText.text(`${checked.length} Sources`);
				selectedSources = new Set(checked.map((_, el) => $(el).val()).get());
			}
			renderList();
		};

		// Checkbox change handler
		$sourceDropdown.find("input[type=checkbox]").on("change", updateSourceText);

		// Action buttons
		$sourceDropdown.find("[data-action=all]").on("click", () => {
			$sourceDropdown.find("input").prop("checked", true);
			updateSourceText();
		});
		$sourceDropdown.find("[data-action=none]").on("click", () => {
			$sourceDropdown.find("input").prop("checked", false);
			updateSourceText();
		});
		$sourceDropdown.find("[data-action=official]").on("click", () => {
			const official = ["PHB", "XGE", "TCE", "FTD", "XPHB", "XDMG"];
			$sourceDropdown.find("input").each((_, el) => {
				$(el).prop("checked", official.includes($(el).val()));
			});
			updateSourceText();
		});

		// Quick filter buttons row
		const $quickFilters = $(`<div class="charsheet__modal-quick-filters"></div>`).appendTo($modalInner);

		let filterRitual = false;
		let filterConcentration = false;
		let filterVerbal = false;
		let filterSomatic = false;
		let filterMaterial = false;

		const $ritualBtn = $(`<span class="charsheet__modal-filter-btn" role="button" tabindex="0">🔮 Ritual</span>`).appendTo($quickFilters);
		const $concBtn = $(`<span class="charsheet__modal-filter-btn" role="button" tabindex="0">⏳ Concentration</span>`).appendTo($quickFilters);
		const $verbalBtn = $(`<span class="charsheet__modal-filter-btn" role="button" tabindex="0">🗣️ Verbal</span>`).appendTo($quickFilters);
		const $somaticBtn = $(`<span class="charsheet__modal-filter-btn" role="button" tabindex="0">✋ Somatic</span>`).appendTo($quickFilters);
		const $materialBtn = $(`<span class="charsheet__modal-filter-btn" role="button" tabindex="0">💎 Material</span>`).appendTo($quickFilters);

		// Set up click handlers immediately after creation
		$ritualBtn.on("click", function () {
			filterRitual = !filterRitual;
			$(this).toggleClass("active");
			renderList();
		});
		$concBtn.on("click", function () {
			filterConcentration = !filterConcentration;
			$(this).toggleClass("active");
			renderList();
		});
		$verbalBtn.on("click", function () {
			filterVerbal = !filterVerbal;
			$(this).toggleClass("active");
			renderList();
		});
		$somaticBtn.on("click", function () {
			filterSomatic = !filterSomatic;
			$(this).toggleClass("active");
			renderList();
		});
		$materialBtn.on("click", function () {
			filterMaterial = !filterMaterial;
			$(this).toggleClass("active");
			renderList();
		});

		// Results count
		const $resultsCount = $(`<div class="charsheet__modal-results-count"></div>`).appendTo($modalInner);

		// Spell list
		const $list = $(`<div class="charsheet__modal-list"></div>`).appendTo($modalInner);

		const renderList = () => {
			$list.empty();

			const searchTerm = $search.val().toLowerCase();

			const filtered = spells.filter(spell => {
				if (searchTerm && !spell.name.toLowerCase().includes(searchTerm)) return false;
				// Class filter (separate from subclass)
				if (selectedClasses.has("__NONE__") && selectedSubclasses.has("__NONE__")) return false;

				// Get spell's class and subclass sources using Renderer.spell.getCombinedClasses
				const fromClassList = Renderer.spell.getCombinedClasses(spell, "fromClassList");
				const fromSubclass = Renderer.spell.getCombinedClasses(spell, "fromSubclass");
				const spellClasses = fromClassList?.map(c => c.name) || [];
				const spellSubclasses = fromSubclass?.map(sc => `${sc.class.name}: ${sc.subclass.name}`) || [];

				// Check class filter (if classes are selected)
				const passesClassFilter = selectedClasses.size === 0 || spellClasses.some(c => selectedClasses.has(c));
				// Check subclass filter (if subclasses are selected)
				const passesSubclassFilter = selectedSubclasses.size === 0 || spellSubclasses.some(sc => selectedSubclasses.has(sc));

				// Spell passes if it matches EITHER the class filter OR the subclass filter (union)
				if (!passesClassFilter && !passesSubclassFilter) return false;

				// Multi-select level filter
				if (selectedLevels.has("__NONE__")) return false;
				if (selectedLevels.size > 0 && !selectedLevels.has(String(spell.level))) return false;
				// Multi-select school filter
				if (selectedSchools.has("__NONE__")) return false;
				if (selectedSchools.size > 0 && !selectedSchools.has(spell.school)) return false;
				// Multi-select subschool filter
				if (selectedSubschools.has("__NONE__")) return false;
				if (selectedSubschools.size > 0) {
					// Spell must have at least one of the selected subschools
					const spellSubschools = spell.subschools || [];
					if (spellSubschools.length === 0 || !spellSubschools.some(sub => selectedSubschools.has(sub))) return false;
				}
				// Multi-select source filter
				if (selectedSources.has("__NONE__")) return false; // No sources selected
				if (selectedSources.size > 0 && !selectedSources.has(spell.source)) return false;
				// Ritual is stored in spell.meta.ritual
				if (filterRitual && !spell.meta?.ritual) return false;
				// Concentration is stored in spell.duration[].concentration
				if (filterConcentration && !spell.duration?.some?.(d => d.concentration)) return false;
				if (filterVerbal && (!spell.components?.v)) return false;
				if (filterSomatic && (!spell.components?.s)) return false;
				if (filterMaterial && (!spell.components?.m)) return false;
				return true;
			});

			const knownCount = filtered.filter(s => knownSpellIds.includes(`${s.name}|${s.source}`)).length;
			$resultsCount.html(`<span>${filtered.length} spell${filtered.length !== 1 ? "s" : ""} found</span>${knownCount > 0 ? `<span class="ml-2" style="color: var(--cs-success);">(${knownCount} already known)</span>` : ""}`);

			if (!filtered.length) {
				$list.html(`
					<div class="charsheet__modal-empty">
						<div class="charsheet__modal-empty-icon">📖</div>
						<div class="charsheet__modal-empty-text">No spells match your filters.<br>Try adjusting your search or filters.</div>
					</div>
				`);
				return;
			}

			// Group by level
			const grouped = {};
			filtered.forEach(spell => {
				const level = spell.level === 0 ? "Cantrips" : `Level ${spell.level}`;
				if (!grouped[level]) grouped[level] = [];
				grouped[level].push(spell);
			});

			Object.entries(grouped).sort((a, b) => {
				if (a[0] === "Cantrips") return -1;
				if (b[0] === "Cantrips") return 1;
				return parseInt(a[0].split(" ")[1]) - parseInt(b[0].split(" ")[1]);
			}).forEach(([level, levelSpells]) => {
				const $section = $(`<div class="charsheet__modal-section"></div>`).appendTo($list);
				const levelEmoji = level === "Cantrips" ? "⭐" : ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"][parseInt(level.split(" ")[1]) - 1] || "📜";
				$(`<div class="charsheet__modal-section-title">${levelEmoji} ${level} <span style="opacity: 0.6;">(${levelSpells.length})</span></div>`).appendTo($section);

				levelSpells.forEach(spell => {
					const spellId = `${spell.name}|${spell.source}`;
					const isKnown = knownSpellIds.includes(spellId);
					const school = Parser.spSchoolAbvToFull(spell.school);

					// Build component string
					const components = [];
					if (spell.components?.v) components.push("V");
					if (spell.components?.s) components.push("S");
					if (spell.components?.m) components.push("M");
					const componentStr = components.join(", ");

					// Build tags string
					const tagParts = [];
					if (spell.ritual) tagParts.push("🔮");
					if (spell.concentration) tagParts.push("⏳");
					const tagsStr = tagParts.length ? ` ${tagParts.join(" ")}` : "";

					// Build subschool string
					let subschoolStr = "";
					if (spell.subschools && spell.subschools.length > 0) {
						const formatSubschool = (sub) => {
							const parts = sub.split(":");
							if (parts.length === 2) {
								return `${parts[1].toTitleCase()}`;
							}
							return sub.toTitleCase();
						};
						subschoolStr = ` • 🏷️ ${spell.subschools.map(formatSubschool).join(", ")}`;
					}

					const $item = $(`
						<div class="charsheet__modal-list-item ${isKnown ? "ve-muted" : ""}">
							<div class="charsheet__modal-list-item-icon">${this._getSchoolEmoji(spell.school)}</div>
							<div class="charsheet__modal-list-item-content">
								<div class="charsheet__modal-list-item-title">${spell.name}${tagsStr}</div>
								<div class="charsheet__modal-list-item-subtitle">${school} • ${componentStr || "No components"} • ${Parser.sourceJsonToAbv(spell.source)}${subschoolStr}</div>
							</div>
							${isKnown
		? `<span class="charsheet__modal-list-item-badge charsheet__modal-list-item-badge--known">✓ Known</span>`
		: `<button class="ve-btn ve-btn-primary ve-btn-xs spell-picker-add">+ Add</button>`
}
						</div>
					`);

					if (!isKnown) {
						$item.find(".spell-picker-add").on("click", (e) => {
							e.stopPropagation();
							this._addSpell(spell);
							knownSpellIds.push(spellId);
							$item.addClass("ve-muted");
							$item.find(".spell-picker-add").replaceWith(`<span class="charsheet__modal-list-item-badge charsheet__modal-list-item-badge--known">✓ Known</span>`);
							JqueryUtil.doToast({type: "success", content: `Added ${spell.name} to your spellbook!`});
							updateStatusBar();
						});

						// Click row to show info
						$item.on("click", () => this._showSpellInfoFromData(spell));
					}

					$section.append($item);
				});
			});
		};

		$search.on("input", renderList);
		// Level, school, and source filters are handled by checkbox change events above

		// Initial render
		renderList();

		// Focus search on open
		setTimeout(() => $search.focus(), 100);

		// Close button
		$$`<div class="charsheet__modal-footer">
			<button class="ve-btn ve-btn-default">Close</button>
		</div>`.appendTo($modalInner).find("button").on("click", () => doClose(false));
	}

	_getSchoolEmoji (school) {
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

	async _showSpellInfoFromData (spell) {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: spell.name,
			isMinHeight0: true,
		});

		const school = Parser.spSchoolAbvToFull(spell.school);
		const level = spell.level === 0 ? "Cantrip" : `Level ${spell.level}`;

		// Build component string
		const components = [];
		if (spell.components?.v) components.push("V");
		if (spell.components?.s) components.push("S");
		if (spell.components?.m) {
			const mStr = typeof spell.components.m === "string" ? spell.components.m : spell.components.m.text || "M";
			components.push(`M (${mStr})`);
		}

		const $content = $(`
			<div class="charsheet__spell-info-modal">
				<div class="ve-flex gap-2 mb-2">
					<span class="charsheet__modal-list-item-badge">${level}</span>
					<span class="charsheet__modal-list-item-badge">${school}</span>
					${spell.ritual ? `<span class="charsheet__modal-list-item-badge">🔮 Ritual</span>` : ""}
					${spell.concentration ? `<span class="charsheet__modal-list-item-badge">⏳ Concentration</span>` : ""}
				</div>
				<div class="ve-small mb-3">
					<div><strong>Casting Time:</strong> ${this._getCastingTime(spell)}</div>
					<div><strong>Range:</strong> ${this._getRange(spell)}</div>
					<div><strong>Components:</strong> ${components.join(", ")}</div>
					<div><strong>Duration:</strong> ${this._getDuration(spell)}</div>
				</div>
				<hr>
				<div class="rd__b">${Renderer.get().render({entries: spell.entries || []})}</div>
				${spell.entriesHigherLevel ? `
					<hr>
					<div class="rd__b"><strong>At Higher Levels.</strong> ${Renderer.get().render({entries: spell.entriesHigherLevel})}</div>
				` : ""}
			</div>
		`).appendTo($modalInner);

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			<button class="ve-btn ve-btn-default">Close</button>
		</div>`.appendTo($modalInner).find("button").on("click", () => doClose(false));
	}

	/**
	 * Check if adding a spell would exceed limits for known casters
	 * @returns {{canAdd: boolean, warning?: string}}
	 */
	_checkSpellLimits (spell) {
		const info = this._state.getSpellcastingInfo();
		if (!info) return {canAdd: true};

		const isCantrip = spell.level === 0;

		// Check cantrip limits
		if (isCantrip && info.cantripsKnown) {
			const allCantrips = this._state.getCantripsKnown();
			const currentCount = allCantrips.filter(c => !c.sourceFeature).length;
			if (currentCount >= info.cantripsKnown) {
				return {
					canAdd: true, // Still allow, but warn
					warning: `You already have ${currentCount}/${info.cantripsKnown} cantrips. Adding more exceeds your class limit.`,
				};
			}
		}

		// Check spells known limits for known casters
		if (!isCantrip && info.type === "known") {
			const spells = this._state.getSpells();
			const leveledSpells = spells.filter(s => s.level > 0 && !s.sourceFeature);
			const maxKnown = info.spellsKnownMax || info.max;
			if (leveledSpells.length >= maxKnown) {
				return {
					canAdd: true, // Still allow, but warn
					warning: `You already have ${leveledSpells.length}/${maxKnown} spells known. Adding more exceeds your class limit. Consider removing a spell first.`,
					isOverLimit: true,
				};
			}
		}

		// For multiclass with known casters, check combined limit
		if (!isCantrip && info.isMulticlass && info.byClass?.some(c => c.type === "known")) {
			const spells = this._state.getSpells();
			const leveledSpells = spells.filter(s => s.level > 0 && !s.sourceFeature);
			const knownClasses = info.byClass.filter(c => c.type === "known");
			const totalKnownMax = knownClasses.reduce((sum, c) => sum + (c.spellsKnownMax || c.max || 0), 0);
			if (leveledSpells.length >= totalKnownMax) {
				const classNames = knownClasses.map(c => c.className).join("/");
				return {
					canAdd: true,
					warning: `Your ${classNames} spells known limit (${totalKnownMax}) is reached. Adding more exceeds your limit.`,
					isOverLimit: true,
				};
			}
		}

		return {canAdd: true};
	}

	_addSpell (spell) {
		console.log("[CharSheet Spells] Adding spell:", spell.name, spell.level);

		// Check limits and warn if over
		const limitCheck = this._checkSpellLimits(spell);
		if (limitCheck.warning) {
			JqueryUtil.doToast({
				type: limitCheck.isOverLimit ? "warning" : "info",
				content: limitCheck.warning,
			});
		}

		// Detect concentration from duration array (raw spell data format)
		const isConcentration = spell.concentration || spell.duration?.some?.(d => d.concentration) || false;
		// Detect ritual from meta object (raw spell data format)
		const isRitual = spell.ritual || spell.meta?.ritual || false;

		this._state.addSpell({
			name: spell.name,
			source: spell.source,
			level: spell.level,
			school: spell.school,
			prepared: spell.level === 0, // Cantrips are always prepared
			ritual: isRitual,
			concentration: isConcentration,
			castingTime: this._getCastingTime(spell),
			range: this._getRange(spell),
			components: this._getComponents(spell),
			duration: this._getDuration(spell),
			subschools: spell.subschools || [], // Include rarity/legality tags
		});

		console.log("[CharSheet Spells] After add, total spells:", this._state.getSpells().length);

		this._renderSpellList();
		// Update combat spells tab (cantrips are auto-prepared)
		if (this._page._combat) {
			this._page._combat.renderCombatSpells();
		}
		this._page.saveCharacter();
	}

	_getCastingTime (spell) {
		if (!spell.time?.length) return "";
		const time = spell.time[0];
		return `${time.number} ${time.unit}`;
	}

	_getRange (spell) {
		if (!spell.range) return "";
		const range = spell.range;
		if (range.type === "point") {
			if (range.distance?.type === "self") return "Self";
			if (range.distance?.type === "touch") return "Touch";
			return `${range.distance?.amount || ""} ${range.distance?.type || ""}`.trim();
		}
		return range.type || "";
	}

	_getComponents (spell) {
		if (!spell.components) return "";
		const parts = [];
		if (spell.components.v) parts.push("V");
		if (spell.components.s) parts.push("S");
		if (spell.components.m) {
			const mat = typeof spell.components.m === "string" ? spell.components.m : spell.components.m.text;
			parts.push(`M (${mat})`);
		}
		return parts.join(", ");
	}

	_getDuration (spell) {
		if (!spell.duration?.length) return "";
		const dur = spell.duration[0];
		if (dur.type === "instant") return "Instantaneous";
		if (dur.type === "permanent") return "Permanent";
		if (dur.concentration) {
			return `Concentration, up to ${dur.duration?.amount || ""} ${dur.duration?.type || ""}`.trim();
		}
		return `${dur.duration?.amount || ""} ${dur.duration?.type || ""}`.trim();
	}

	async _castSpell (spellId) {
		const spells = this._state.getSpells();
		const spell = spells.find(s => s.id === spellId);
		if (!spell) return;

		// Get full spell data for component/constraint checks
		const spellData = this._allSpells.find(s => s.name === spell.name && s.source === spell.source);

		// Check for conditions that prevent spellcasting
		const castingConstraint = this._checkCastingConstraints(spell, spellData);
		if (castingConstraint) {
			JqueryUtil.doToast({type: "warning", content: castingConstraint});
			return;
		}

		// Check if spell requires concentration
		const requiresConcentration = spell.concentration || spellData?.duration?.some?.(d => d.concentration);

		// If concentrating on another spell, ask to break concentration first
		if (requiresConcentration && this._state.isConcentrating?.()) {
			const currentConc = this._state.getConcentration?.();
			const confirmed = await InputUiUtil.pGetUserBoolean({
				title: "Break Concentration?",
				htmlDescription: `You are currently concentrating on <strong>${currentConc?.spellName || "a spell"}</strong>. Casting <strong>${spell.name}</strong> will break that concentration.`,
				textYes: "Cast and break concentration",
				textNo: "Cancel",
			});
			if (!confirmed) return;
			this._state.breakConcentration?.();
		}

		// Cantrips don't use slots
		if (spell.level === 0) {
			this._showCastResult(spell);
			// Set concentration for concentration cantrips (rare but possible)
			if (requiresConcentration) {
				this._state.setConcentration?.(spell.name, 0);
				this._updateConcentrationUI();
			}
			return;
		}

		// Check pact slots first (they recharge on short rest, so use them preferentially)
		const pactSlots = this._state.getPactSlots();
		if (pactSlots && pactSlots.current > 0 && spell.level <= pactSlots.level) {
			this._state.setPactSlotsCurrent(pactSlots.current - 1);
			this._showCastResult(spell, pactSlots.level, true);
			// Set concentration if spell requires it
			if (requiresConcentration) {
				this._state.setConcentration?.(spell.name, pactSlots.level);
				this._updateConcentrationUI();
			}
			this.renderSlots();
			this._page._renderQuickSpells(); // Update overview spell slots
			this._page.saveCharacter();
			return;
		}

		// Find available regular slot
		let slotLevel = spell.level;
		while (slotLevel <= 9) {
			const current = this._state.getSpellSlotsCurrent(slotLevel);
			if (current > 0) {
				this._state.setSpellSlots(slotLevel, this._state.getSpellSlotsMax(slotLevel), current - 1);
				this._showCastResult(spell, slotLevel);
				// Set concentration if spell requires it
				if (requiresConcentration) {
					this._state.setConcentration?.(spell.name, slotLevel);
					this._updateConcentrationUI();
				}
				this.renderSlots();
				this._page._renderQuickSpells(); // Update overview spell slots
				this._page.saveCharacter();
				return;
			}
			slotLevel++;
		}

		JqueryUtil.doToast({type: "warning", content: "No spell slots available!"});
	}

	/**
	 * Update concentration UI in combat tab and overview
	 */
	_updateConcentrationUI () {
		// Update combat tab states
		this._page._combat?.renderCombatStates?.();
		this._page._combat?.renderCombatEffects?.();
		// Update overview active states
		this._page._renderActiveStates?.();
	}

	/**
	 * Check for conditions/effects that prevent spellcasting
	 * @param {object} spell - The spell being cast (from character's spell list)
	 * @param {object} spellData - Full spell data from the spells database
	 * @returns {string|null} Error message if casting is prevented, null if allowed
	 */
	_checkCastingConstraints (spell, spellData) {
		// Check for conditions that completely prevent actions (thus spellcasting)
		const incapacitatingConditions = ["Incapacitated", "Paralyzed", "Petrified", "Stunned", "Unconscious"];
		for (const condition of incapacitatingConditions) {
			if (this._state.hasCondition?.(condition)) {
				return `Cannot cast spells while ${condition.toLowerCase()}!`;
			}
		}

		// Get spell components
		const components = spellData?.components || spell.components || {};
		const hasVerbal = components.v;
		const hasSomatic = components.s;
		const hasMaterial = components.m;

		// Check if character is in a Silence effect (custom condition/active state)
		// Also check for conditions that prevent speaking
		if (hasVerbal) {
			if (this._state.hasCondition?.("Silenced")) {
				return `Cannot cast ${spell.name} - spell has verbal components and you are silenced!`;
			}
			// Some conditions prevent speech indirectly (already covered by incapacitated check above)
		}

		// Check for restrained affecting somatic components (doesn't actually prevent casting in RAW)
		// Restrained only affects movement and attack rolls, not spellcasting directly
		// But some DMs rule it affects somatic components - could add optional check here

		// Check if hands are full/occupied for somatic components (if we track this)
		// This would require tracking what the character is holding
		// For now, we skip this check as it requires more state tracking

		// Check for material component availability (if we track components)
		// This would require an inventory check for specific components
		// Spellcasting focus typically substitutes for non-consumed components
		// For now, we assume the character has access to required materials

		// Check for Wild Shape (can't cast most spells while transformed)
		// Would need to check if character has active Wild Shape state
		const activeStates = this._state.getActiveStates?.() || [];
		const wildShapeState = activeStates.find(s =>
			s.name?.toLowerCase().includes("wild shape") && s.active,
		);
		if (wildShapeState) {
			// Note: Some druids can cast spells in Wild Shape (e.g., Moon Druid at high levels)
			// For now, show a warning but allow casting - DM can rule
			// Could add a feature check for Beast Spells here
			const hasBeastSpells = this._state.getFeatures?.()?.some(f =>
				f.name?.toLowerCase().includes("beast spells"),
			);
			if (!hasBeastSpells) {
				// Allow but warn - user can decide
				console.log(`[CharSheet Spells] Warning: Casting ${spell.name} while in Wild Shape`);
			}
		}

		// All checks passed
		return null;
	}

	_showCastResult (spell, slotLevel = null, isPactSlot = false) {
		// Delegate to the enhanced spell effects handler
		this._handleSpellEffects(spell, slotLevel, isPactSlot);
	}

	/**
	 * Enhanced spell effects handler with target selection and effect application
	 */
	async _handleSpellEffects (spell, slotLevel = null, isPactSlot = false) {
		const upcast = slotLevel && slotLevel > spell.level ? ` (at level ${slotLevel})` : "";
		const slotType = isPactSlot ? " [Pact Slot]" : "";

		// Check for spell attack or save DC
		const spellData = this._allSpells.find(s => s.name === spell.name && s.source === spell.source);
		let attackInfo = "";
		let damageInfo = "";
		let effectsApplied = [];

		if (spellData) {
			const spellcastingMod = this._state.getAbilityMod(this._state.getSpellcastingAbility() || "int");
			const profBonus = this._state.getProficiencyBonus();
			const exhaustionDcPenalty = this._state._getExhaustionDcPenalty?.() || 0;

			// Check if spell attack
			if (spellData.entries?.some(e => typeof e === "string" && e.toLowerCase().includes("spell attack"))) {
				const attackBonus = spellcastingMod + profBonus;
				// Spell attacks are attacks, so use isAttack: true (no Thelemar crit bonus)
				const rollResult = this._page.rollD20({isAttack: true});
				const roll = rollResult.roll;
				attackInfo = `<br>Spell Attack: ${roll} + ${attackBonus} = <strong>${roll + attackBonus}</strong>`;
			}

			// Check for save DC
			if (spellData.savingThrow) {
				const saveDC = 8 + spellcastingMod + profBonus - exhaustionDcPenalty;
				attackInfo += `<br>Save DC: <strong>${saveDC}</strong> (${spellData.savingThrow.join("/")} save)`;
			}

			// Parse spell effects to determine what the spell does
			const effects = CharacterSheetState.parseSpellEffects(spellData);
			const targetInfo = CharacterSheetState.getValidTargets(spellData);

			// Determine if we should ask for a target
			const needsTargetSelection = !targetInfo.selfOnly && (
				effects.healing
				|| effects.buffs?.length > 0
				|| effects.tempHp
				|| effects.conditions?.length > 0
			);

			// Handle target selection for beneficial effects
			if (needsTargetSelection) {
				const targetChoice = await this._promptSpellTarget(spell, spellData, effects, targetInfo);

				if (targetChoice === "self") {
					effectsApplied = await this._applySpellEffectsToSelf(spell, spellData, effects, slotLevel);
				} else if (targetChoice === "other") {
					// For others, just show the roll results - we can't track their HP
					damageInfo = this._rollSpellHealing(spellData, slotLevel, spell.level)
						|| this._rollSpellDamage(spellData, slotLevel, spell.level);
				}
				// If cancelled, still show the basic cast info
			} else if (targetInfo.selfOnly) {
				// Self-only spells automatically target self
				effectsApplied = await this._applySpellEffectsToSelf(spell, spellData, effects, slotLevel);
			} else {
				// Damage or other effects targeting enemies
				damageInfo = this._rollSpellDamage(spellData, slotLevel, spell.level);

				// Roll healing if spell heals but targets others by default (like Mass Cure Wounds)
				if (!damageInfo) {
					damageInfo = this._rollSpellHealing(spellData, slotLevel, spell.level);
				}
			}
		}

		// Build the toast message
		let toastContent = `Cast ${spell.name}${upcast}${slotType}${attackInfo}${damageInfo}`;

		if (effectsApplied.length > 0) {
			toastContent += `<br><span class="text-success">✓ Applied: ${effectsApplied.join(", ")}</span>`;
		}

		JqueryUtil.doToast({
			type: "success",
			content: $(`<div>${toastContent}</div>`),
		});

		// Update UI to show new active states
		if (effectsApplied.length > 0) {
			this._page._renderActiveStates?.();
			this._page._combat?.renderCombatStates?.();
			this._page._renderHp?.();
		}
	}

	/**
	 * Prompt user to select a target for the spell
	 */
	async _promptSpellTarget (spell, spellData, effects, targetInfo) {
		const effectDescriptions = [];

		if (effects.healing) {
			const healDice = effects.healing.dice || "healing";
			effectDescriptions.push(`Heal (${healDice}${effects.healing.addModifier ? " + modifier" : ""})`);
		}
		if (effects.tempHp) {
			effectDescriptions.push(`Gain ${effects.tempHp.amount} temporary HP`);
		}
		if (effects.buffs?.length > 0) {
			for (const buff of effects.buffs) {
				if (buff.target === "ac") {
					effectDescriptions.push(`+${buff.value} AC`);
				} else if (buff.type === "rollBonus") {
					effectDescriptions.push(`+${buff.dice} to attacks/saves`);
				}
			}
		}
		if (effects.conditions?.length > 0) {
			// For beneficial conditions (like from buff spells on self)
			effectDescriptions.push(`Apply: ${effects.conditions.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(", ")}`);
		}

		const effectsText = effectDescriptions.length > 0
			? `<div class="mt-2"><strong>Effects:</strong> ${effectDescriptions.join(", ")}</div>`
			: "";

		const durationText = effects.duration
			? `<div class="ve-muted ve-small">Duration: ${effects.duration.amount || "Until ended"} ${effects.duration.unit || ""}</div>`
			: "";

		const concentrationText = effects.concentration
			? `<div class="text-warning ve-small">⚠ Requires Concentration</div>`
			: "";

		return InputUiUtil.pGetUserEnum({
			title: `${spell.name} - Choose Target`,
			htmlDescription: `
				<div>Who is the target of this spell?</div>
				${effectsText}
				${durationText}
				${concentrationText}
			`,
			values: ["Self", "Another creature"],
			fnDisplay: v => v,
			isResolveItem: true,
		}).then(result => {
			if (result == null) return null;
			return result === "Self" ? "self" : "other";
		});
	}

	/**
	 * Apply spell effects to self and return list of applied effects
	 */
	async _applySpellEffectsToSelf (spell, spellData, effects, slotLevel) {
		const appliedEffects = [];
		const spellcastingMod = this._state.getAbilityMod(this._state.getSpellcastingAbility() || "int");

		// Apply healing
		if (effects.healing) {
			const healingResult = CharacterSheetState.calculateSpellHealing(spellData, slotLevel || spell.level, this._state);
			const healAmount = healingResult.total || 0;

			if (healAmount > 0) {
				const hp = this._state.getHp();
				const newHp = Math.min(hp.max, hp.current + healAmount);
				const actualHealing = newHp - hp.current;
				this._state.setHp(hp.max, newHp);
				appliedEffects.push(`Healed ${actualHealing} HP`);
			}
		}

		// Apply temporary HP
		if (effects.tempHp) {
			let tempHpAmount = effects.tempHp.amount;

			// Handle upcast scaling for temp HP
			if (slotLevel && spellData.level && slotLevel > spellData.level && spellData.entriesHigherLevel) {
				const text = JSON.stringify(spellData.entriesHigherLevel).toLowerCase();
				if (text.includes("temporary hit points")) {
					const scaleMatch = text.match(/increase(?:s)?\s*by\s*(\d+)/);
					if (scaleMatch) {
						tempHpAmount += parseInt(scaleMatch[1]) * (slotLevel - spellData.level);
					}
				}
			}

			this._state.setTempHp(tempHpAmount);
			appliedEffects.push(`+${tempHpAmount} temp HP`);
		}

		// Check if spell grants conditions - if so, apply the condition itself
		// The condition system already handles the mechanical effects
		const conditionsToApply = [];
		if (effects.conditions?.length > 0) {
			// Determine which conditions can be self-targeted (beneficial conditions)
			const hostileConditions = ["blinded", "charmed", "deafened", "frightened", "grappled",
				"paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"];

			for (const condition of effects.conditions) {
				const conditionLower = condition.toLowerCase();
				// Only apply non-hostile conditions to self
				// "invisible" is a beneficial condition when cast on self
				if (!hostileConditions.includes(conditionLower)) {
					const conditionName = condition.charAt(0).toUpperCase() + condition.slice(1);
					this._state.addCondition(conditionName);
					conditionsToApply.push(conditionName);
					appliedEffects.push(`${conditionName} condition applied`);
				}
			}
		}

		// For condition-granting spells, create an active state to track duration/concentration
		// but DON'T add customEffects (the condition itself provides the effects)
		if (conditionsToApply.length > 0 && (effects.duration || effects.concentration)) {
			this._state.addActiveState("custom", {
				name: spell.name,
				icon: effects.concentration ? "🔮" : "✨",
				description: `Grants: ${conditionsToApply.join(", ")}`,
				sourceFeatureId: `spell_${spell.name}_${Date.now()}`,
				customEffects: [], // Empty - condition provides the effects
				isSpellEffect: true,
				concentration: effects.concentration || false,
				duration: effects.duration,
				grantsConditions: conditionsToApply, // Track which conditions this spell grants
			});
		}
		// For buff spells that DON'T grant conditions, apply the parsed buff effects
		else if ((effects.buffs?.length > 0 || effects.duration) && conditionsToApply.length === 0) {
			const stateId = this._state.addActiveState("custom", {
				name: spell.name,
				icon: effects.concentration ? "🔮" : "✨",
				description: `Spell effect: ${spell.name}`,
				sourceFeatureId: `spell_${spell.name}_${Date.now()}`,
				customEffects: effects.buffs?.map(buff => ({
					type: "bonus",
					target: buff.target,
					value: buff.value,
					dice: buff.dice,
				})) || [],
				isSpellEffect: true,
				concentration: effects.concentration || false,
				duration: effects.duration,
			});

			// Build description of buffs
			const buffDescriptions = [];
			for (const buff of (effects.buffs || [])) {
				if (buff.target === "ac") {
					buffDescriptions.push(`+${buff.value} AC`);
				} else if (buff.type === "rollBonus") {
					buffDescriptions.push(`+${buff.dice} to rolls`);
				}
			}
			if (buffDescriptions.length > 0) {
				appliedEffects.push(buffDescriptions.join(", "));
			} else if (stateId) {
				appliedEffects.push(`${spell.name} active`);
			}
		}

		// Save character after applying effects
		this._page.saveCharacter();

		return appliedEffects;
	}

	_rollSpellDamage (spellData, slotLevel, baseLevel) {
		// Check for cantrip scaling
		if (spellData.scalingLevelDice) {
			return this._rollCantripDamage(spellData);
		}

		// Look for damage dice in spell entries
		const damageTypes = spellData.damageInflict || [];
		const entries = JSON.stringify(spellData.entries || []);

		// Find damage dice patterns like {@damage 8d6}
		const damageMatch = entries.match(/\{@damage\s+([^}]+)\}/);
		if (!damageMatch) return "";

		let baseDice = damageMatch[1];

		// Handle upcast damage
		if (slotLevel && slotLevel > baseLevel && spellData.entriesHigherLevel) {
			const higherStr = JSON.stringify(spellData.entriesHigherLevel);
			// Look for scaledamage pattern: {@scaledamage 8d6|3-9|1d6}
			const scaleMatch = higherStr.match(/\{@scaledamage\s+[^|]+\|[^|]+\|([^}]+)\}/);
			if (scaleMatch) {
				const extraDice = scaleMatch[1];
				const levelsAbove = slotLevel - baseLevel;
				// Parse the extra dice and multiply by levels above
				const diceMatch = extraDice.match(/(\d+)d(\d+)/);
				if (diceMatch) {
					const numDice = parseInt(diceMatch[1]) * levelsAbove;
					const diceSize = diceMatch[2];
					// Add extra dice to base
					const baseMatch = baseDice.match(/(\d+)d(\d+)/);
					if (baseMatch && baseMatch[2] === diceSize) {
						baseDice = `${parseInt(baseMatch[1]) + numDice}d${diceSize}`;
					}
				}
			}
		}

		// Roll the damage
		try {
			const total = Renderer.dice.parseRandomise2(baseDice);
			const damageType = damageTypes[0] || "damage";
			return `<br>Damage: <strong>${total}</strong> ${damageType} (${baseDice})`;
		} catch (e) {
			return "";
		}
	}

	_rollCantripDamage (spellData) {
		const characterLevel = this._state.getTotalLevel();
		const scaling = Array.isArray(spellData.scalingLevelDice)
			? spellData.scalingLevelDice[0]
			: spellData.scalingLevelDice;

		if (!scaling?.scaling) return "";

		// Find the appropriate dice for character level
		let dice = "1d8"; // fallback
		const levels = Object.keys(scaling.scaling).map(Number).sort((a, b) => a - b);
		for (const lvl of levels) {
			if (characterLevel >= lvl) {
				dice = scaling.scaling[lvl];
			}
		}

		try {
			const total = Renderer.dice.parseRandomise2(dice);
			const damageTypes = spellData.damageInflict || [];
			const damageType = damageTypes[0] || "damage";
			return `<br>Damage: <strong>${total}</strong> ${damageType} (${dice})`;
		} catch (e) {
			return "";
		}
	}

	_rollSpellHealing (spellData, slotLevel, baseLevel) {
		const entries = JSON.stringify(spellData.entries || []);
		const entriesLower = entries.toLowerCase();

		// Only match actual healing spells - look for "regain" or "restore" with "hit points"
		// This avoids false positives like Sleep which mentions "hit points" but isn't healing
		const isHealing = (entriesLower.includes("regain") && entriesLower.includes("hit point"))
			|| (entriesLower.includes("restore") && entriesLower.includes("hit point"))
			|| entriesLower.includes("healing")
			|| spellData.miscTags?.includes("HL"); // HL = Healing tag

		if (!isHealing) {
			return "";
		}

		// Find dice pattern
		const healMatch = entries.match(/\{@dice\s+([^}]+)\}/) || entries.match(/\{@damage\s+([^}]+)\}/);
		if (!healMatch) return "";

		let baseDice = healMatch[1];
		const spellcastingMod = this._state.getAbilityMod(this._state.getSpellcastingAbility() || "int");

		// Handle upcast healing
		if (slotLevel && slotLevel > baseLevel && spellData.entriesHigherLevel) {
			const higherStr = JSON.stringify(spellData.entriesHigherLevel);
			const scaleMatch = higherStr.match(/\{@scaledice\s+[^|]+\|[^|]+\|([^}|]+)/);
			if (scaleMatch) {
				const extraDice = scaleMatch[1];
				const levelsAbove = slotLevel - baseLevel;
				const diceMatch = extraDice.match(/(\d+)d(\d+)/);
				if (diceMatch) {
					const numDice = parseInt(diceMatch[1]) * levelsAbove;
					const diceSize = diceMatch[2];
					const baseMatch = baseDice.match(/(\d+)d(\d+)/);
					if (baseMatch && baseMatch[2] === diceSize) {
						baseDice = `${parseInt(baseMatch[1]) + numDice}d${diceSize}`;
					}
				}
			}
		}

		try {
			const diceTotal = Renderer.dice.parseRandomise2(baseDice);
			const total = diceTotal + spellcastingMod;
			return `<br>Healing: <strong>${total}</strong> HP (${baseDice} + ${spellcastingMod})`;
		} catch (e) {
			return "";
		}
	}

	_removeSpell (spellId) {
		this._state.removeSpell(spellId);
		this._renderSpellList();
		// Update combat spells tab
		if (this._page._combat) {
			this._page._combat.renderCombatSpells();
		}
		this._page.saveCharacter();
	}

	_togglePrepared (spellId) {
		const spells = this._state.getSpells();
		const spell = spells.find(s => s.id === spellId);
		if (!spell || spell.level === 0) return; // Can't unprepare cantrips

		// Use state method to persist the change
		this._state.setSpellPrepared(spellId, !spell.prepared);
		this._renderSpellList();
		this._renderSpellcastingStats(); // Update prepared count
		// Update combat spells tab
		if (this._page._combat) {
			this._page._combat.renderCombatSpells();
		}
		this._page.saveCharacter();
	}

	async _showSpellInfo (spellId) {
		const spells = this._state.getSpells();
		const spell = spells.find(s => s.id === spellId);
		if (!spell) return;

		const spellData = this._allSpells.find(s => s.name === spell.name && s.source === spell.source);
		if (!spellData) return;

		// Show spell details using UiUtil modal
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: spellData.name,
			isMinHeight0: true,
		});

		const content = Renderer.get().render({type: "entries", entries: spellData.entries || []});
		const higherLevel = spellData.entriesHigherLevel
			? `<p><strong>At Higher Levels.</strong> ${Renderer.get().render({type: "entries", entries: spellData.entriesHigherLevel})}</p>`
			: "";

		$modalInner.append(`<div class="rd__b">${content}${higherLevel}</div>`);

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			<button class="ve-btn ve-btn-default">Close</button>
		</div>`.appendTo($modalInner).find("button").on("click", () => doClose(false));
	}

	// #region Rendering
	renderSlots () {
		const $container = $("#charsheet-spell-slots");
		console.log("[CharSheet Spells] renderSlots: container found?", $container.length > 0);
		if (!$container.length) return;

		$container.empty();

		// Debug: Log all slot maxes
		const allSlots = {};
		for (let i = 1; i <= 9; i++) allSlots[i] = this._state.getSpellSlotsMax(i);
		console.log("[CharSheet Spells] renderSlots: slot maxes by level:", allSlots);

		let slotsRendered = 0;
		for (let level = 1; level <= 9; level++) {
			const max = this._state.getSpellSlotsMax(level);
			if (max <= 0) continue;

			slotsRendered++;
			const current = this._state.getSpellSlotsCurrent(level);

			// Build pips HTML - filled = available, empty = used
			// Show first 'current' pips as filled (available), rest as empty (used)
			let pipsHtml = "";
			for (let i = 0; i < max; i++) {
				const isAvailable = i < current; // First 'current' slots are available (filled)
				pipsHtml += `<span class="charsheet__spell-slot-pip ${isAvailable ? "" : "charsheet__spell-slot-pip--used"}" style="display: inline-block; width: 18px; height: 18px; border: 2px solid #337ab7; border-radius: 50%; margin: 2px; ${isAvailable ? "background: #337ab7;" : "background: transparent;"}"></span>`;
			}

			const $row = $(`
				<div class="charsheet__spell-slot-level" data-spell-level="${level}">
					<div class="charsheet__spell-slot-level-label">Level ${level}</div>
					<div class="charsheet__spell-slot-pips" style="display: flex; gap: 4px; margin-top: 4px;">
						${pipsHtml}
					</div>
				</div>
			`);

			console.log("[CharSheet Spells] renderSlots: Level", level, "max:", max, "current:", current, "pipsHtml length:", pipsHtml.length);

			$container.append($row);
		}

		// Render Warlock Pact Slots
		const pactSlots = this._state.getPactSlots();
		if (pactSlots && pactSlots.max > 0) {
			slotsRendered++;

			// Build pips - filled = available, empty = used
			let pactPipsHtml = "";
			for (let i = 0; i < pactSlots.max; i++) {
				const isAvailable = i < pactSlots.current;
				pactPipsHtml += `<span class="charsheet__spell-slot-pip charsheet__spell-slot-pip--pact ${isAvailable ? "" : "charsheet__spell-slot-pip--used"}" data-pact-slot="true" style="display: inline-block; width: 18px; height: 18px; border: 2px solid #9b59b6; border-radius: 50%; margin: 2px; ${isAvailable ? "background: #9b59b6;" : "background: transparent;"}"></span>`;
			}

			const $pactRow = $(`
				<div class="charsheet__spell-slot-level charsheet__spell-slot-level--pact" data-spell-level="pact" style="border-color: #9b59b6;">
					<div class="charsheet__spell-slot-level-label" style="color: #9b59b6;">Pact (Lvl ${pactSlots.level})</div>
					<div class="charsheet__spell-slot-pips" style="display: flex; gap: 4px; margin-top: 4px;">
						${pactPipsHtml}
					</div>
				</div>
			`);

			$container.append($pactRow);
		}

		console.log("[CharSheet Spells] renderSlots: rendered", slotsRendered, "levels of slots");

		// Show if no slots
		if (!$container.children().length) {
			$container.append(`<p class="ve-muted">No spell slots available</p>`);
		}
	}

	_renderSpellList () {
		const $container = $("#charsheet-spell-lists");
		console.log("[CharSheet Spells] _renderSpellList: container found?", $container.length > 0);
		if (!$container.length) return;

		$container.empty();

		// Render innate spells first (from features/feats)
		this._renderInnateSpells($container);

		let spells = this._state.getSpells();
		// Apply Thelemar rarity to stored spells (for backwards compatibility and display)
		spells = this._applyThelemarSpellRarity(spells);
		console.log("[CharSheet Spells] _renderSpellList: spells count", spells.length, spells);

		// Check if this character has a spellbook-style caster (Wizard)
		const classes = this._state.getClasses() || [];
		const hasSpellbook = classes.some(c => c.name === "Wizard");
		const spellcastingInfo = this._state.getSpellcastingInfo();

		// Apply filters
		let filtered = spells;
		if (this._spellFilter) {
			filtered = filtered.filter(s => s.name.toLowerCase().includes(this._spellFilter));
		}
		if (this._spellLevelFilter !== "all") {
			filtered = filtered.filter(s => s.level === parseInt(this._spellLevelFilter));
		}

		// For spellbook casters, separate prepared vs unprepared spells
		if (hasSpellbook && filtered.some(s => s.level > 0)) {
			this._renderSpellbookLayout($container, filtered, spellcastingInfo);
		} else {
			// Standard layout for known casters
			this._renderStandardSpellLayout($container, filtered, spellcastingInfo);
		}

		const innateSpells = this._state.getInnateSpells();
		if (!filtered.length && !innateSpells.length) {
			$container.append(`<p class="ve-muted text-center">No spells</p>`);
		}
	}

	/**
	 * Render standard spell layout - grouped by level
	 */
	_renderStandardSpellLayout ($container, spells, spellcastingInfo) {
		// Group by level
		const grouped = {
			0: {name: "Cantrips", spells: []},
			1: {name: "1st Level", spells: []},
			2: {name: "2nd Level", spells: []},
			3: {name: "3rd Level", spells: []},
			4: {name: "4th Level", spells: []},
			5: {name: "5th Level", spells: []},
			6: {name: "6th Level", spells: []},
			7: {name: "7th Level", spells: []},
			8: {name: "8th Level", spells: []},
			9: {name: "9th Level", spells: []},
		};

		spells.forEach(spell => {
			if (grouped[spell.level]) {
				grouped[spell.level].spells.push(spell);
			}
		});

		// Update Cantrips header with count
		if (spellcastingInfo && spellcastingInfo.cantripsKnown > 0) {
			const allCantrips = this._state.getCantripsKnown();
			const count = allCantrips.filter(c => !c.sourceFeature).length;
			const limit = spellcastingInfo.cantripsKnown;
			const colorClass = count > limit ? "text-danger" : (count === limit ? "text-success" : "");
			grouped[0].name = `Cantrips <span class="ve-small ve-muted">(${count}/${limit})</span>`;
			if (count > limit) {
				grouped[0].name = `Cantrips <span class="ve-small ${colorClass}" title="You have more cantrips than your class level allows">(${count}/${limit}) <span class="glyphicon glyphicon-alert"></span></span>`;
			}
		}

		// Render each group
		Object.entries(grouped).forEach(([level, group]) => {
			if (!group.spells.length) return;

			const $group = $(`
				<div class="charsheet__spell-group">
					<h5 class="charsheet__spell-group-header">${group.name}</h5>
					<div class="charsheet__spell-group-list"></div>
				</div>
			`);

			const $list = $group.find(".charsheet__spell-group-list");

			group.spells.sort((a, b) => a.name.localeCompare(b.name)).forEach(spell => {
				const $item = this._renderSpellItem(spell);
				$list.append($item);
			});

			$container.append($group);
		});
	}

	/**
	 * Render spellbook layout - separates prepared spells from unprepared (for Wizards)
	 */
	_renderSpellbookLayout ($container, spells, spellcastingInfo) {
		const cantrips = spells.filter(s => s.level === 0);
		const leveledSpells = spells.filter(s => s.level > 0);
		const preparedSpells = leveledSpells.filter(s => s.prepared || s.alwaysPrepared);
		const unpreparedSpells = leveledSpells.filter(s => !s.prepared && !s.alwaysPrepared);

		// Calculate prepared limits
		const currentPrepared = preparedSpells.length;
		const maxPrepared = spellcastingInfo?.preparedMax || spellcastingInfo?.max || 0;
		const preparedColorClass = currentPrepared > maxPrepared ? "text-danger" : (currentPrepared === maxPrepared ? "text-success" : "");

		// Render cantrips first (always "prepared")
		if (cantrips.length) {
			let cantripsHeader = "Cantrips";
			if (spellcastingInfo && spellcastingInfo.cantripsKnown > 0) {
				const allCantrips = this._state.getCantripsKnown();
				const count = allCantrips.filter(c => !c.sourceFeature).length;
				const limit = spellcastingInfo.cantripsKnown;
				const colorClass = count > limit ? "text-danger" : (count === limit ? "text-success" : "");
				cantripsHeader = `Cantrips <span class="ve-small ${colorClass}">(${count}/${limit})</span>`;
			}

			const $cantripsGroup = $(`
				<div class="charsheet__spell-group">
					<h5 class="charsheet__spell-group-header">${cantripsHeader}</h5>
					<div class="charsheet__spell-group-list"></div>
				</div>
			`);

			const $list = $cantripsGroup.find(".charsheet__spell-group-list");
			cantrips.sort((a, b) => a.name.localeCompare(b.name)).forEach(spell => {
				$list.append(this._renderSpellItem(spell));
			});
			$container.append($cantripsGroup);
		}

		// Render PREPARED spells section
		const $preparedSection = $(`
			<div class="charsheet__spell-section charsheet__spell-section--prepared">
				<h4 class="charsheet__spell-section-header">
					<span class="charsheet__spell-section-icon">📖</span>
					Prepared Spells
					<span class="ve-small ${preparedColorClass} ml-2">(${currentPrepared}/${maxPrepared})</span>
				</h4>
				<div class="charsheet__spell-section-content" id="charsheet-prepared-spells-content"></div>
			</div>
		`);

		const $preparedContent = $preparedSection.find("#charsheet-prepared-spells-content");

		if (preparedSpells.length) {
			// Group prepared spells by level
			const groupedPrepared = this._groupSpellsByLevel(preparedSpells);
			this._renderGroupedSpells($preparedContent, groupedPrepared);
		} else {
			$preparedContent.append(`<p class="ve-muted ve-text-center py-2">No spells prepared. Prepare spells from your spellbook below.</p>`);
		}

		$container.append($preparedSection);

		// Render SPELLBOOK section (unprepared spells)
		const totalInSpellbook = leveledSpells.length;
		const $spellbookSection = $(`
			<div class="charsheet__spell-section charsheet__spell-section--spellbook">
				<h4 class="charsheet__spell-section-header">
					<span class="charsheet__spell-section-icon">📚</span>
					Spellbook
					<span class="ve-small ve-muted ml-2">(${totalInSpellbook} spells total)</span>
				</h4>
				<div class="charsheet__spell-section-content" id="charsheet-spellbook-content"></div>
			</div>
		`);

		const $spellbookContent = $spellbookSection.find("#charsheet-spellbook-content");

		if (unpreparedSpells.length) {
			// Group unprepared spells by level
			const groupedUnprepared = this._groupSpellsByLevel(unpreparedSpells);
			this._renderGroupedSpells($spellbookContent, groupedUnprepared, true); // true = show prepare button
		} else if (preparedSpells.length) {
			$spellbookContent.append(`<p class="ve-muted ve-text-center py-2">All spellbook spells are currently prepared!</p>`);
		} else {
			$spellbookContent.append(`<p class="ve-muted ve-text-center py-2">No spells in spellbook. Add spells using the + button above.</p>`);
		}

		$container.append($spellbookSection);
	}

	/**
	 * Group spells by level into an object
	 */
	_groupSpellsByLevel (spells) {
		const grouped = {};
		spells.forEach(spell => {
			if (!grouped[spell.level]) {
				grouped[spell.level] = [];
			}
			grouped[spell.level].push(spell);
		});
		return grouped;
	}

	/**
	 * Render grouped spells into a container
	 */
	_renderGroupedSpells ($container, groupedSpells, showPrepareHint = false) {
		const levelNames = {
			1: "1st Level",
			2: "2nd Level",
			3: "3rd Level",
			4: "4th Level",
			5: "5th Level",
			6: "6th Level",
			7: "7th Level",
			8: "8th Level",
			9: "9th Level",
		};

		Object.entries(groupedSpells).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([level, spells]) => {
			const $group = $(`
				<div class="charsheet__spell-group charsheet__spell-group--compact">
					<h5 class="charsheet__spell-group-header charsheet__spell-group-header--small">${levelNames[level] || `Level ${level}`}</h5>
					<div class="charsheet__spell-group-list"></div>
				</div>
			`);

			const $list = $group.find(".charsheet__spell-group-list");
			spells.sort((a, b) => a.name.localeCompare(b.name)).forEach(spell => {
				const $item = this._renderSpellItem(spell, showPrepareHint);
				$list.append($item);
			});

			$container.append($group);
		});
	}

	/**
	 * Render innate spells section (from features/feats)
	 */
	_renderInnateSpells ($container) {
		const innateSpells = this._state.getInnateSpells();
		if (!innateSpells.length) return;

		// Apply filter
		let filtered = innateSpells;
		if (this._spellFilter) {
			filtered = filtered.filter(s => s.name.toLowerCase().includes(this._spellFilter));
		}

		if (!filtered.length) return;

		const $group = $(`
			<div class="charsheet__spell-group charsheet__spell-group--innate">
				<h5 class="charsheet__spell-group-header">
					<span class="glyphicon glyphicon-star text-warning mr-1"></span>
					Innate Spellcasting
				</h5>
				<div class="charsheet__spell-group-list"></div>
			</div>
		`);

		const $list = $group.find(".charsheet__spell-group-list");

		filtered.sort((a, b) => a.name.localeCompare(b.name)).forEach(spell => {
			const $item = this._renderInnateSpellItem(spell);
			$list.append($item);
		});

		$container.append($group);
	}

	/**
	 * Render a single innate spell item
	 */
	_renderInnateSpellItem (spell) {
		const spellId = spell.id;

		// Create hover link for spell name
		let spellLink = spell.name;
		try {
			if (this._page?.getHoverLink) {
				spellLink = this._page.getHoverLink(
					UrlUtil.PG_SPELLS,
					spell.name,
					spell.source || Parser.SRC_XPHB,
				);
			}
		} catch (e) {
			// Fall back to plain name
		}

		// Build usage info
		let usageInfo;
		if (spell.atWill) {
			usageInfo = "<span class=\"badge badge-success\">At Will</span>";
		} else if (spell.uses) {
			// Build pips: filled = available, empty (used class) = spent
			const pipsHtml = Array.from({length: spell.uses.max}, (_, i) =>
				`<span class="charsheet__innate-pip ${i < spell.uses.current ? "" : "used"}" data-spell-id="${spellId}"></span>`,
			).join("");
			usageInfo = `<span class="charsheet__innate-uses">${pipsHtml}</span>`;
		} else {
			usageInfo = "<span class=\"badge badge-secondary\">1/day</span>";
		}

		const sourceInfo = spell.sourceFeature
			? `<span class="ve-muted ve-small">(${spell.sourceFeature})</span>`
			: "";

		const $item = $(`
			<div class="charsheet__spell-item charsheet__spell-item--innate" data-innate-spell-id="${spellId}">
				<div class="charsheet__spell-item-main">
					<span class="charsheet__spell-item-name">${spellLink}</span>
					${sourceInfo}
				</div>
				<div class="charsheet__spell-item-actions">
					${usageInfo}
					${!spell.atWill ? `
						<button class="ve-btn ve-btn-sm ve-btn-primary charsheet__innate-cast" title="Cast">
							<span class="glyphicon glyphicon-flash"></span>
						</button>
					` : ""}
					<button class="ve-btn ve-btn-sm ve-btn-default charsheet__spell-info" title="Info">
						<span class="glyphicon glyphicon-info-sign"></span>
					</button>
				</div>
			</div>
		`);

		// Bind cast button
		$item.find(".charsheet__innate-cast").on("click", () => {
			this._castInnateSpell(spellId);
		});

		// Bind pip clicks to restore uses
		$item.find(".charsheet__innate-pip").on("click", (e) => {
			const $pip = $(e.currentTarget);
			if ($pip.hasClass("used")) {
				// Restore one use
				spell.uses.current = Math.min(spell.uses.current + 1, spell.uses.max);
				this._renderSpellList();
			}
		});

		return $item;
	}

	/**
	 * Cast an innate spell (use one charge)
	 */
	_castInnateSpell (spellId) {
		const spell = this._state.getInnateSpells().find(s => s.id === spellId);
		if (!spell) return;

		// Get full spell data for constraint checks
		const spellData = this._allSpells.find(s => s.name === spell.name && s.source === spell.source);

		// Check for conditions that prevent spellcasting
		const castingConstraint = this._checkCastingConstraints(spell, spellData);
		if (castingConstraint) {
			JqueryUtil.doToast({type: "warning", content: castingConstraint});
			return;
		}

		if (spell.atWill) {
			// At-will spells can always be cast
			JqueryUtil.doToast({type: "success", content: `Cast ${spell.name} (at will)`});
			return;
		}

		if (!spell.uses || spell.uses.current <= 0) {
			JqueryUtil.doToast({type: "warning", content: `No uses remaining for ${spell.name}`});
			return;
		}

		this._state.useInnateSpell(spellId);
		JqueryUtil.doToast({type: "success", content: `Cast ${spell.name} (${spell.uses.current}/${spell.uses.max} remaining)`});
		this._renderSpellList();
	}

	_renderSpellItem (spell) {
		const schoolFull = spell.school ? Parser.spSchoolAbvToFull(spell.school) : "";
		const isPrepared = spell.prepared;
		const isCantrip = spell.level === 0;
		const isAlwaysPrepared = spell.alwaysPrepared;
		const sourceFeature = spell.sourceFeature;
		// Ensure spell has a valid ID
		const spellId = spell.id || `${spell.name}|${spell.source}`;

		// Create hover link for spell name
		let spellLink = spell.name;
		try {
			if (this._page?.getHoverLink) {
				spellLink = this._page.getHoverLink(
					UrlUtil.PG_SPELLS,
					spell.name,
					spell.source || Parser.SRC_XPHB,
				);
			}
		} catch (e) {
			// Fall back to plain name
		}

		// Build spell details line
		const detailParts = [];
		if (spell.castingTime) detailParts.push(spell.castingTime);
		if (spell.range) detailParts.push(spell.range);
		if (spell.duration) detailParts.push(spell.duration);
		if (spell.components) detailParts.push(spell.components);
		const detailsLine = detailParts.join(" · ");

		// Build rarity/legality inline text from subschools (if stored)
		const rarityParts = (spell.subschools || [])
			.map(ss => {
				if (ss.includes("legality:")) {
					const legality = ss.replace("legality:", "");
					const color = legality === "legal" ? "var(--cs-success, #10b981)" : (legality === "restricted" ? "var(--cs-warning, #f59e0b)" : "var(--cs-danger, #ef4444)");
					return `<span class="charsheet__spell-rarity-tag" style="color: ${color}; font-weight: 600;" title="Thelemar legality">[${legality}]</span>`;
				}
				if (ss.includes("rarity:")) {
					const rarity = ss.replace("rarity:", "");
					const color = rarity === "common" ? "var(--cs-text-muted, #9ca3af)" : (rarity === "uncommon" ? "var(--cs-primary, #6366f1)" : (rarity === "rare" ? "var(--cs-accent, #8b5cf6)" : "var(--cs-warning, #f59e0b)"));
					return `<span class="charsheet__spell-rarity-tag" style="color: ${color}; font-weight: 600;" title="Thelemar rarity">[${rarity}]</span>`;
				}
				return null;
			})
			.filter(Boolean)
			.join(" ");

		// Combine details line with rarity tags
		const fullDetailsLine = rarityParts
			? (detailsLine ? `${detailsLine} · ${rarityParts}` : rarityParts)
			: detailsLine;

		// Determine preparation button state and text
		let prepButtonHtml = "";
		if (!isCantrip) {
			if (isAlwaysPrepared) {
				// Always prepared spells (from domain, subclass features, etc.) can't be unprepared
				const featureSource = sourceFeature || "class feature";
				prepButtonHtml = `
					<span class="ve-btn ve-btn-xs ve-btn-warning charsheet__spell-always-prepared" title="Always prepared from ${featureSource}">
						<span class="glyphicon glyphicon-star mr-1"></span>Always
					</span>
				`;
			} else {
				// Normal prepared toggle
				prepButtonHtml = `
					<button class="ve-btn ve-btn-xs ${isPrepared ? "ve-btn-primary" : "ve-btn-default"} charsheet__spell-prepared" title="Toggle Prepared">
						<span class="glyphicon glyphicon-book mr-1"></span>${isPrepared ? "Prepared" : "Prepare"}
					</button>
				`;
			}
		}

		// Build source badge if from a feature
		const sourceBadge = sourceFeature
			? `<span class="badge badge-warning charsheet__spell-source-badge" title="From: ${sourceFeature}">${this._truncateFeatureName(sourceFeature)}</span>`
			: "";

		return $(`
			<div class="charsheet__spell-item ${isPrepared || isAlwaysPrepared ? "prepared" : ""} ${isAlwaysPrepared ? "always-prepared" : ""}" data-spell-id="${spellId}">
				<div class="charsheet__spell-item-main">
					<div class="charsheet__spell-item-header">
						<span class="charsheet__spell-item-name">${spellLink}</span>
						<span class="charsheet__spell-item-meta">
							${schoolFull ? `<span class="badge badge-secondary">${schoolFull}</span>` : ""}
							${spell.concentration ? `<span class="badge badge-info" title="Concentration">C</span>` : ""}
							${spell.ritual ? `<span class="badge badge-success" title="Ritual">R</span>` : ""}
							${sourceBadge}
						</span>
					</div>
					${fullDetailsLine ? `<div class="charsheet__spell-item-details ve-muted ve-small">${fullDetailsLine}</div>` : ""}
				</div>
				<div class="charsheet__spell-item-actions">
					${prepButtonHtml}
					<button class="ve-btn ve-btn-xs ve-btn-success charsheet__spell-cast" title="Cast Spell">
						<span class="glyphicon glyphicon-flash mr-1"></span>Cast
					</button>
					<button class="ve-btn ve-btn-xs ve-btn-default charsheet__spell-info" title="Spell Info">
						<span class="glyphicon glyphicon-info-sign mr-1"></span>Info
					</button>
					${!isAlwaysPrepared ? `
						<button class="ve-btn ve-btn-xs ve-btn-danger charsheet__spell-remove" title="Remove Spell">
							<span class="glyphicon glyphicon-trash mr-1"></span>Remove
						</button>
					` : `
						<button class="ve-btn ve-btn-xs ve-btn-default charsheet__spell-remove" title="Cannot remove feature spells" disabled>
							<span class="glyphicon glyphicon-lock mr-1"></span>Locked
						</button>
					`}
				</div>
			</div>
		`);
	}

	/**
	 * Truncate a feature name for badge display
	 */
	_truncateFeatureName (name) {
		if (!name) return "";
		if (name.length <= 12) return name;
		return `${name.substring(0, 10)}…`;
	}

	/**
	 * Render multiclass status bar showing per-class spell tracking
	 */
	_renderMulticlassStatusBar ($statusBar, info, manualLeveledSpells, preparedSpells) {
		// Add a multiclass indicator
		$statusBar.append(`
			<div style="display: flex; align-items: center; gap: 6px; padding-right: 8px; border-right: 1px solid rgba(var(--rgb-bg-text), 0.2);">
				<span class="ve-muted ve-small">⚔️ Multiclass</span>
			</div>
		`);

		// Show each class's spell tracking separately
		for (const classInfo of info.byClass) {
			if (classInfo.type === "known") {
				// For known casters, they need to track their own spells known limit
				// In D&D, each class tracks its own spells known separately
				const maxKnown = classInfo.spellsKnownMax || classInfo.max;
				// Note: In a real implementation, we'd need to track which spells belong to which class
				// For now, show the limit per class
				const icon = "📖 ";
				$statusBar.append(`
					<div style="display: flex; align-items: center; gap: 4px;" title="${classInfo.className}: Spells known are permanent. Can swap 1 on level up.">
						<span style="color: #60a5fa;">${icon}${classInfo.className}:</span>
						<span class="ve-muted ve-small">max ${maxKnown} known</span>
					</div>
				`);
			} else if (classInfo.type === "prepared") {
				const maxPrepared = classInfo.preparedMax || classInfo.max;
				const icon = classInfo.is2024 ? "✨ " : "📚 ";
				const color = classInfo.is2024 ? "#fbbf24" : "#a78bfa";
				$statusBar.append(`
					<div style="display: flex; align-items: center; gap: 4px;" title="${classInfo.className}: Can prepare from full class spell list after long rest.">
						<span style="color: ${color};">${icon}${classInfo.className}:</span>
						<span class="ve-muted ve-small">max ${maxPrepared} prepared</span>
					</div>
				`);
			}
		}

		// Show totals
		const totalManual = manualLeveledSpells.length;
		const totalPrepared = preparedSpells.length;
		const totalMax = info.max;

		$statusBar.append(`
			<div style="display: flex; align-items: center; gap: 6px; padding-left: 8px; border-left: 1px solid rgba(var(--rgb-bg-text), 0.2);">
				<span class="ve-muted">Total:</span>
				<span class="bold">${totalManual} spells</span>
				<span class="ve-muted ve-small">(${totalPrepared} prepared)</span>
			</div>
		`);
	}

	render () {
		// Calculate spell slots based on class/level before rendering
		this._state.calculateSpellSlots();

		this.renderSlots();
		this._renderSpellList();
		this._renderSpellcastingStats();

		console.log("[CharSheet Spells] Rendered. Spells:", this._state.getSpells().length, "Slots:", this._state.getSpellSlotsMax(1));
	}

	_renderSpellcastingStats () {
		// Get spellcasting ability from class
		const classes = this._state.getClasses();
		if (!classes.length) {
			$("#charsheet-spell-ability").text("—");
			$("#charsheet-spell-dc").text("—");
			$("#charsheet-spell-attack").text("—");
			$("#charsheet-spell-tracking").hide();
			return;
		}

		// Get spellcasting ability - first spellcasting class
		const spellcastingAbilityMap = {
			"Bard": "cha",
			"Cleric": "wis",
			"Druid": "wis",
			"Paladin": "cha",
			"Ranger": "wis",
			"Sorcerer": "cha",
			"Warlock": "cha",
			"Wizard": "int",
			"Artificer": "int",
		};

		let ability = null;
		for (const cls of classes) {
			if (spellcastingAbilityMap[cls.name]) {
				ability = spellcastingAbilityMap[cls.name];
				break;
			}
		}

		if (!ability) {
			$("#charsheet-spell-ability").text("—");
			$("#charsheet-spell-dc").text("—");
			$("#charsheet-spell-attack").text("—");
			$("#charsheet-spell-tracking").hide();
			return;
		}

		const mod = this._state.getAbilityMod(ability);
		const prof = this._state.getProficiencyBonus();

		// Get item bonuses for spell attack and DC
		const itemBonuses = this._state.getItemBonuses?.() || {};
		const spellAttackBonus = itemBonuses.spellAttack || 0;
		const spellDcBonus = itemBonuses.spellSaveDc || 0;

		// Get exhaustion DC penalty (Thelemar rules only)
		const exhaustionDcPenalty = this._state._getExhaustionDcPenalty?.() || 0;

		const attackBonus = mod + prof + spellAttackBonus;
		const saveDC = 8 + mod + prof + spellDcBonus - exhaustionDcPenalty;
		const abilityFull = {
			"str": "Strength",
			"dex": "Dexterity",
			"con": "Constitution",
			"int": "Intelligence",
			"wis": "Wisdom",
			"cha": "Charisma",
		}[ability] || ability.toUpperCase();

		$("#charsheet-spell-ability").text(abilityFull);
		$("#charsheet-spell-dc").text(saveDC);
		$("#charsheet-spell-attack").text(`+${attackBonus}`);

		// Display spell tracking using the new enhanced UI
		this._renderSpellTrackingUI();
	}

	/**
	 * Render the spell tracking UI based on caster type (known vs prepared, 2014 vs 2024)
	 */
	_renderSpellTrackingUI () {
		const spellcastingInfo = this._state.getSpellcastingInfo();
		const $trackingContainer = $("#charsheet-spell-tracking");

		// Hide all tracking boxes by default
		$("#charsheet-known-caster-info").hide();
		$("#charsheet-prepared-caster-info-2014").hide();
		$("#charsheet-prepared-caster-info-2024").hide();
		$("#charsheet-cantrips-info").hide();

		if (!spellcastingInfo) {
			$trackingContainer.hide();
			return;
		}

		$trackingContainer.show();

		const spells = this._state.getSpells();
		const leveledSpells = spells.filter(s => s.level > 0);
		const allCantrips = this._state.getCantripsKnown();
		const preparedSpells = leveledSpells.filter(s => s.prepared || s.alwaysPrepared);
		// Manual spells = those not from features (count against limit)
		const manualLeveledSpells = leveledSpells.filter(s => !s.sourceFeature);

		// Cantrips count (excluding feature-granted ones)
		const cantripsChosen = allCantrips.filter(c => !c.sourceFeature).length;
		const cantripsMax = spellcastingInfo.cantripsKnown || 0;

		// Show cantrips info if the class has cantrips
		if (cantripsMax > 0) {
			const $cantripsInfo = $("#charsheet-cantrips-info").show();
			$("#charsheet-cantrips-current").text(cantripsChosen);
			$("#charsheet-cantrips-max").text(cantripsMax);

			// Handle over-limit state
			const $count = $cantripsInfo.find(".charsheet__spell-tracking-count");
			if (cantripsChosen > cantripsMax) {
				$count.addClass("charsheet__spell-tracking-count--over");
				$cantripsInfo.addClass("charsheet__spell-tracking-box--over");
			} else {
				$count.removeClass("charsheet__spell-tracking-count--over");
				$cantripsInfo.removeClass("charsheet__spell-tracking-box--over");
			}
		}

		// Determine which spell tracking box to show based on caster type
		if (spellcastingInfo.type === "known") {
			// Known caster (2014 Bard, Sorcerer, Warlock, Ranger, EK, AT)
			const $knownInfo = $("#charsheet-known-caster-info").show();
			// Only count manual spells (not from features) against the limit
			const currentKnown = manualLeveledSpells.length;
			const maxKnown = spellcastingInfo.spellsKnownMax || spellcastingInfo.max;

			$("#charsheet-spells-known-current").text(currentKnown);
			$("#charsheet-spells-known-max").text(maxKnown);

			// Handle over-limit state
			const $count = $knownInfo.find(".charsheet__spell-tracking-count");
			if (currentKnown > maxKnown) {
				$count.addClass("charsheet__spell-tracking-count--over");
				$knownInfo.addClass("charsheet__spell-tracking-box--over");
			} else {
				$count.removeClass("charsheet__spell-tracking-count--over");
				$knownInfo.removeClass("charsheet__spell-tracking-box--over");
			}
		} else if (spellcastingInfo.type === "prepared") {
			// Prepared caster - check if 2024 or 2014
			const is2024 = spellcastingInfo.is2024;
			const currentPrepared = preparedSpells.length;
			const maxPrepared = spellcastingInfo.preparedMax || spellcastingInfo.max;

			if (is2024) {
				const $preparedInfo = $("#charsheet-prepared-caster-info-2024").show();
				$("#charsheet-spells-prepared-current-2024").text(currentPrepared);
				$("#charsheet-spells-prepared-max-2024").text(maxPrepared);

				const $count = $preparedInfo.find(".charsheet__spell-tracking-count");
				if (currentPrepared > maxPrepared) {
					$count.addClass("charsheet__spell-tracking-count--over");
					$preparedInfo.addClass("charsheet__spell-tracking-box--over");
				} else {
					$count.removeClass("charsheet__spell-tracking-count--over");
					$preparedInfo.removeClass("charsheet__spell-tracking-box--over");
				}
			} else {
				const $preparedInfo = $("#charsheet-prepared-caster-info-2014").show();
				$("#charsheet-spells-prepared-current-2014").text(currentPrepared);
				$("#charsheet-spells-prepared-max-2014").text(maxPrepared);

				const $count = $preparedInfo.find(".charsheet__spell-tracking-count");
				if (currentPrepared > maxPrepared) {
					$count.addClass("charsheet__spell-tracking-count--over");
					$preparedInfo.addClass("charsheet__spell-tracking-box--over");
				} else {
					$count.removeClass("charsheet__spell-tracking-count--over");
					$preparedInfo.removeClass("charsheet__spell-tracking-box--over");
				}
			}
		} else if (spellcastingInfo.type === "mixed" && spellcastingInfo.isMulticlass) {
			// Multiclass with mixed caster types - show both relevant boxes
			// This is a complex case, show a simplified combined view
			const hasKnown = spellcastingInfo.byClass?.some(c => c.type === "known");
			const hasPrepared = spellcastingInfo.byClass?.some(c => c.type === "prepared");

			if (hasKnown) {
				const $knownInfo = $("#charsheet-known-caster-info").show();
				const knownClasses = spellcastingInfo.byClass.filter(c => c.type === "known");
				const totalKnownMax = knownClasses.reduce((sum, c) => sum + (c.spellsKnownMax || c.max || 0), 0);
				// For multiclass, only count manual spells against limit
				$("#charsheet-spells-known-current").text(manualLeveledSpells.length);
				$("#charsheet-spells-known-max").text(totalKnownMax);

				// Update hint for multiclass
				$knownInfo.find(".charsheet__spell-tracking-hint").text(
					`From: ${knownClasses.map(c => c.className).join(", ")}`,
				);
			}

			if (hasPrepared) {
				const $preparedInfo = $("#charsheet-prepared-caster-info-2014").show();
				const preparedClasses = spellcastingInfo.byClass.filter(c => c.type === "prepared");
				const totalPreparedMax = preparedClasses.reduce((sum, c) => sum + (c.preparedMax || c.max || 0), 0);
				$("#charsheet-spells-prepared-current-2014").text(preparedSpells.length);
				$("#charsheet-spells-prepared-max-2014").text(totalPreparedMax);

				// Update hint for multiclass
				$preparedInfo.find(".charsheet__spell-tracking-hint").text(
					`From: ${preparedClasses.map(c => c.className).join(", ")}`,
				);
			}
		}
	}
	// #endregion

	// #region Filtered Spell Picker (for feat/feature spell choices)
	/**
	 * Parse a spell filter string like "level=1|school=E;D" or "level=0|class=Sorcerer"
	 * @param {string} filterString - The filter string from additionalSpells choose property
	 * @returns {object} Parsed filter criteria
	 */
	_parseSpellFilter (filterString) {
		const criteria = {
			level: null,
			schools: [],
			classes: [],
		};

		if (!filterString) return criteria;

		const parts = filterString.split("|");
		parts.forEach(part => {
			const [key, value] = part.split("=");
			if (!key || !value) return;

			switch (key.toLowerCase()) {
				case "level":
					criteria.level = parseInt(value);
					break;
				case "school":
					// Schools are separated by ; and use abbreviations (E=Enchantment, D=Divination, etc.)
					criteria.schools = value.split(";").map(s => s.trim().toUpperCase());
					break;
				case "class":
					criteria.classes = value.split(";").map(c => c.trim().toLowerCase());
					break;
			}
		});

		return criteria;
	}

	/**
	 * Filter spells based on parsed criteria
	 */
	_filterSpellsByCriteria (spells, criteria) {
		return spells.filter(spell => {
			// Level filter
			if (criteria.level !== null && spell.level !== criteria.level) return false;

			// School filter (use abbreviations)
			if (criteria.schools.length > 0) {
				const spellSchool = spell.school?.toUpperCase() || "";
				if (!criteria.schools.includes(spellSchool)) return false;
			}

			// Class filter
			if (criteria.classes.length > 0) {
				const spellClasses = spell.classes?.fromClassList?.map(c => c.name.toLowerCase()) || [];
				const hasMatchingClass = criteria.classes.some(cls => spellClasses.includes(cls));
				if (!hasMatchingClass) return false;
			}

			return true;
		});
	}

	/**
	 * Get human-readable description of filter criteria
	 */
	_getFilterDescription (criteria) {
		const parts = [];

		if (criteria.level !== null) {
			parts.push(criteria.level === 0 ? "Cantrip" : `Level ${criteria.level}`);
		}

		if (criteria.schools.length > 0) {
			const schoolNames = criteria.schools.map(s => ({
				"A": "Abjuration",
				"C": "Conjuration",
				"D": "Divination",
				"E": "Enchantment",
				"V": "Evocation",
				"I": "Illusion",
				"N": "Necromancy",
				"T": "Transmutation",
			})[s] || s).join(" or ");
			parts.push(schoolNames);
		}

		if (criteria.classes.length > 0) {
			parts.push(`from ${criteria.classes.map(c => c.toTitleCase()).join(" or ")} spell list`);
		}

		return parts.join(" ") || "Any spell";
	}

	/**
	 * Show a spell picker modal filtered for a specific choice (e.g., from Fey Touched feat)
	 * @param {object} choice - The pending spell choice object from state
	 * @param {function} onSelect - Callback when spell is selected
	 */
	async showFilteredSpellPicker (choice, onSelect) {
		const criteria = this._parseSpellFilter(choice.filter);
		const filterDescription = this._getFilterDescription(criteria);

		// Get filtered spells
		const filteredSpells = this._page.filterByAllowedSources(this._allSpells);
		const matchingSpells = this._filterSpellsByCriteria(filteredSpells, criteria)
			.sort((a, b) => a.name.localeCompare(b.name));

		if (!matchingSpells.length) {
			JqueryUtil.doToast({type: "warning", content: `No spells found matching: ${filterDescription}`});
			return;
		}

		// Get spells already known to mark them
		const knownSpellIds = [
			...this._state.getSpells().map(s => `${s.name}|${s.source}`),
			...this._state.getInnateSpells().map(s => `${s.name}|${s.source}`),
		];

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: `Choose Spell: ${choice.featureName}`,
			isMinHeight0: true,
		});

		// Description
		$modalInner.append(`<p class="mb-2">Select a <strong>${filterDescription}</strong> spell:</p>`);

		// Search
		const $search = $(`<input type="text" class="form-control form-control--minimal mb-2" placeholder="Search spells...">`);
		$modalInner.append($search);

		// Spell list
		const $list = $(`<div class="spell-choice-list" style="max-height: 350px; overflow-y: auto;"></div>`).appendTo($modalInner);

		const renderList = (filter = "") => {
			$list.empty();

			const filtered = filter
				? matchingSpells.filter(s => s.name.toLowerCase().includes(filter))
				: matchingSpells;

			if (!filtered.length) {
				$list.append(`<p class="ve-muted text-center py-2">No spells found</p>`);
				return;
			}

			filtered.forEach(spell => {
				const spellId = `${spell.name}|${spell.source}`;
				const isKnown = knownSpellIds.includes(spellId);
				const school = Parser.spSchoolAbvToFull(spell.school);

				const $item = $(`
					<div class="ve-flex-v-center p-2 clickable spell-choice-item ${isKnown ? "ve-muted" : ""}" 
						 style="border-bottom: 1px solid var(--rgb-border-grey);">
						<div class="ve-flex-col" style="flex: 1;">
							<span class="bold">${spell.name}</span>
							<span class="ve-small ve-muted">${school}${spell.ritual ? " (ritual)" : ""} • ${Parser.sourceJsonToAbv(spell.source)}</span>
						</div>
						${isKnown
		? `<span class="ve-muted ve-small">Already known</span>`
		: `<button class="ve-btn ve-btn-primary ve-btn-xs spell-choice-select">Select</button>`
}
					</div>
				`);

				if (!isKnown) {
					$item.find(".spell-choice-select").on("click", () => {
						onSelect(spell);
						doClose(true);
						JqueryUtil.doToast({type: "success", content: `Selected ${spell.name} for ${choice.featureName}`});
					});

					// Show spell info on item click (not on button)
					$item.on("click", (e) => {
						if (!$(e.target).is("button")) {
							this._showSpellInfoModal(spell);
						}
					});
				}

				$list.append($item);
			});
		};

		$search.on("input", () => renderList($search.val().toLowerCase()));
		renderList();

		// Cancel button
		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			<button class="ve-btn ve-btn-default">Cancel</button>
		</div>`.appendTo($modalInner).find("button").on("click", () => doClose(false));
	}

	/**
	 * Show spell info in a modal
	 */
	async _showSpellInfoModal (spell) {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: spell.name,
			isMinHeight0: true,
		});

		const levelSchool = spell.level === 0
			? `${Parser.spSchoolAbvToFull(spell.school)} cantrip`
			: `${Parser.spLevelToFull(spell.level)}-level ${Parser.spSchoolAbvToFull(spell.school).toLowerCase()}`;

		$modalInner.append(`<p class="ve-muted"><em>${levelSchool}</em></p>`);

		// Basic info
		const infoLines = [];
		if (spell.time?.length) {
			const time = spell.time[0];
			infoLines.push(`<strong>Casting Time:</strong> ${time.number} ${time.unit}`);
		}
		if (spell.range) {
			const rangeStr = spell.range.distance?.type === "self" ? "Self"
				: spell.range.distance?.type === "touch" ? "Touch"
					: `${spell.range.distance?.amount || ""} ${spell.range.distance?.type || ""}`.trim();
			infoLines.push(`<strong>Range:</strong> ${rangeStr}`);
		}
		if (spell.components) {
			const parts = [];
			if (spell.components.v) parts.push("V");
			if (spell.components.s) parts.push("S");
			if (spell.components.m) {
				const mText = typeof spell.components.m === "string" ? spell.components.m : spell.components.m?.text || "";
				parts.push(mText ? `M (${mText})` : "M");
			}
			infoLines.push(`<strong>Components:</strong> ${parts.join(", ")}`);
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

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			<button class="ve-btn ve-btn-default">Close</button>
		</div>`.appendTo($modalInner).find("button").on("click", () => doClose(false));
	}

	/**
	 * Process all pending spell choices, showing the picker for each
	 */
	async processPendingSpellChoices () {
		const pendingChoices = this._state.getPendingSpellChoices();
		if (!pendingChoices.length) return;

		for (const choice of pendingChoices) {
			await this.showFilteredSpellPicker(choice, (spell) => {
				this._state.fulfillSpellChoice(choice.id, spell);
				this._renderSpellList();
				this._page.saveCharacter();
			});
		}
	}
	// #endregion
}

globalThis.CharacterSheetSpells = CharacterSheetSpells;

export {CharacterSheetSpells};
