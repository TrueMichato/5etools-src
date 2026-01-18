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
		const className = classes[0].name;
		const filteredSpells = this._page.filterByAllowedSources(this._allSpells);
		const classSpells = filteredSpells.filter(spell => {
			if (!spell.classes?.fromClassList) return false;
			return spell.classes.fromClassList.some(c => c.name.toLowerCase() === className.toLowerCase());
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
		const knownSpellIds = this._state.getSpells().map(s => `${s.name}|${s.source}`);

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "✨ Add Spell",
			isMinHeight0: true,
			isWidth100: true,
		});

		// All available schools
		const schools = [...new Set(spells.map(s => s.school).filter(Boolean))].sort();

		// Unique sources from spells
		const uniqueSources = [...new Set(spells.map(s => s.source))].sort((a, b) => {
			const priority = ["PHB", "XGE", "TCE", "FTD", "XPHB"];
			const aIdx = priority.indexOf(a);
			const bIdx = priority.indexOf(b);
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

		// Build enhanced filter UI
		const $filterContainer = $(`<div class="charsheet__modal-filter"></div>`).appendTo($modalInner);
		
		// Search input with icon
		const $searchWrapper = $(`<div class="charsheet__modal-search"></div>`).appendTo($filterContainer);
		const $search = $(`<input type="text" class="form-control" placeholder="🔍 Search spells by name...">`).appendTo($searchWrapper);
		
		// Level filter
		const $levelSelect = $(`
			<select class="form-control" style="width: auto; min-width: 130px;">
				<option value="all">📊 All Levels</option>
				<option value="0">⭐ Cantrips</option>
				${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => `<option value="${l}">Level ${l}</option>`).join("")}
			</select>
		`).appendTo($filterContainer);

		// School filter
		const $schoolSelect = $(`
			<select class="form-control" style="width: auto; min-width: 150px;">
				<option value="all">🎓 All Schools</option>
				${schools.map(s => `<option value="${s}">${this._getSchoolEmoji(s)} ${Parser.spSchoolAbvToFull(s)}</option>`).join("")}
			</select>
		`).appendTo($filterContainer);

		// Multi-select source filter
		let selectedSources = new Set(); // Empty = all sources
		const $sourceDropdown = $(`
			<div class="charsheet__source-multiselect">
				<button class="charsheet__source-multiselect-btn">
					<span class="charsheet__source-multiselect-icon">📚</span>
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
		`).appendTo($filterContainer);

		// Source dropdown toggle behavior
		const $sourceBtn = $sourceDropdown.find(".charsheet__source-multiselect-btn");
		const $sourceDropdownMenu = $sourceDropdown.find(".charsheet__source-multiselect-dropdown");
		const $sourceText = $sourceDropdown.find(".charsheet__source-multiselect-text");
		
		$sourceBtn.on("click", (e) => {
			e.stopPropagation();
			$sourceDropdownMenu.toggleClass("open");
		});

		// Close dropdown when clicking outside
		$(document).on("click.spellSourceFilter", () => $sourceDropdownMenu.removeClass("open"));
		$sourceDropdownMenu.on("click", (e) => e.stopPropagation());

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

		const $ritualBtn = $(`<button class="charsheet__modal-filter-btn">🔮 Ritual</button>`).appendTo($quickFilters);
		const $concBtn = $(`<button class="charsheet__modal-filter-btn">⏳ Concentration</button>`).appendTo($quickFilters);
		const $verbalBtn = $(`<button class="charsheet__modal-filter-btn">🗣️ Verbal</button>`).appendTo($quickFilters);
		const $somaticBtn = $(`<button class="charsheet__modal-filter-btn">✋ Somatic</button>`).appendTo($quickFilters);
		const $materialBtn = $(`<button class="charsheet__modal-filter-btn">💎 Material</button>`).appendTo($quickFilters);

		// Results count
		const $resultsCount = $(`<div class="charsheet__modal-results-count"></div>`).appendTo($modalInner);

		// Spell list
		const $list = $(`<div class="charsheet__modal-list"></div>`).appendTo($modalInner);

		const renderList = () => {
			$list.empty();

			const searchTerm = $search.val().toLowerCase();
			const levelFilter = $levelSelect.val();
			const schoolFilter = $schoolSelect.val();

			const filtered = spells.filter(spell => {
				if (searchTerm && !spell.name.toLowerCase().includes(searchTerm)) return false;
				if (levelFilter !== "all" && spell.level !== parseInt(levelFilter)) return false;
				if (schoolFilter !== "all" && spell.school !== schoolFilter) return false;
				// Multi-select source filter
				if (selectedSources.has("__NONE__")) return false; // No sources selected
				if (selectedSources.size > 0 && !selectedSources.has(spell.source)) return false;
				if (filterRitual && !spell.ritual) return false;
				if (filterConcentration && !spell.concentration) return false;
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

					const $item = $(`
						<div class="charsheet__modal-list-item ${isKnown ? "ve-muted" : ""}">
							<div class="charsheet__modal-list-item-icon">${this._getSchoolEmoji(spell.school)}</div>
							<div class="charsheet__modal-list-item-content">
								<div class="charsheet__modal-list-item-title">${spell.name}${tagsStr}</div>
								<div class="charsheet__modal-list-item-subtitle">${school} • ${componentStr || "No components"} • ${Parser.sourceJsonToAbv(spell.source)}</div>
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
						});

						// Click row to show info
						$item.on("click", () => this._showSpellInfoFromData(spell));
					}

					$section.append($item);
				});
			});
		};

		// Toggle quick filter buttons
		const toggleBtn = ($btn, prop) => {
			if (prop === "ritual") filterRitual = !filterRitual;
			if (prop === "concentration") filterConcentration = !filterConcentration;
			if (prop === "verbal") filterVerbal = !filterVerbal;
			if (prop === "somatic") filterSomatic = !filterSomatic;
			if (prop === "material") filterMaterial = !filterMaterial;
			$btn.toggleClass("active");
			renderList();
		};

		$ritualBtn.on("click", () => toggleBtn($ritualBtn, "ritual"));
		$concBtn.on("click", () => toggleBtn($concBtn, "concentration"));
		$verbalBtn.on("click", () => toggleBtn($verbalBtn, "verbal"));
		$somaticBtn.on("click", () => toggleBtn($somaticBtn, "somatic"));
		$materialBtn.on("click", () => toggleBtn($materialBtn, "material"));

		$search.on("input", renderList);
		$levelSelect.on("change", renderList);
		$schoolSelect.on("change", renderList);
		// Source filter is handled by checkbox change events above

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

	_addSpell (spell) {
		console.log("[CharSheet Spells] Adding spell:", spell.name, spell.level);
		
		this._state.addSpell({
			name: spell.name,
			source: spell.source,
			level: spell.level,
			school: spell.school,
			prepared: spell.level === 0, // Cantrips are always prepared
			ritual: spell.ritual || false,
			concentration: spell.concentration || false,
			castingTime: this._getCastingTime(spell),
			range: this._getRange(spell),
			components: this._getComponents(spell),
			duration: this._getDuration(spell),
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
		const upcast = slotLevel && slotLevel > spell.level ? ` (at level ${slotLevel})` : "";
		const slotType = isPactSlot ? " [Pact Slot]" : "";

		// Check for spell attack or save DC
		const spellData = this._allSpells.find(s => s.name === spell.name && s.source === spell.source);
		let attackInfo = "";
		let damageInfo = "";

		if (spellData) {
			const spellcastingMod = this._state.getAbilityMod(this._state.getSpellcastingAbility() || "int");
			const profBonus = this._state.getProficiencyBonus();
			const exhaustionDcPenalty = this._state._getExhaustionDcPenalty?.() || 0;

			// Check if spell attack
			if (spellData.entries?.some(e => typeof e === "string" && e.toLowerCase().includes("spell attack"))) {
				const attackBonus = spellcastingMod + profBonus;
				const roll = this._page.rollDice(1, 20);
				attackInfo = `<br>Spell Attack: ${roll} + ${attackBonus} = <strong>${roll + attackBonus}</strong>`;
			}

			// Check for save DC
			if (spellData.savingThrow) {
				const saveDC = 8 + spellcastingMod + profBonus - exhaustionDcPenalty;
				attackInfo += `<br>Save DC: <strong>${saveDC}</strong> (${spellData.savingThrow.join("/")} save)`;
			}

			// Roll damage if spell has damage
			damageInfo = this._rollSpellDamage(spellData, slotLevel, spell.level);

			// Roll healing if spell heals
			if (!damageInfo) {
				damageInfo = this._rollSpellHealing(spellData, slotLevel, spell.level);
			}
		}

		JqueryUtil.doToast({
			type: "success",
			content: $(`<div>Cast ${spell.name}${upcast}${slotType}${attackInfo}${damageInfo}</div>`),
		});
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
			const used = max - current;

			// Build pips HTML with inline styles for debugging
			let pipsHtml = "";
			for (let i = 0; i < max; i++) {
				const isUsed = i < used;
				pipsHtml += `<span class="charsheet__spell-slot-pip ${isUsed ? "charsheet__spell-slot-pip--used" : ""}" style="display: inline-block; width: 18px; height: 18px; border: 2px solid #337ab7; border-radius: 50%; margin: 2px; ${isUsed ? "background: #337ab7;" : "background: transparent;"}"></span>`;
			}

			const $row = $(`
				<div class="charsheet__spell-slot-level" data-spell-level="${level}">
					<div class="charsheet__spell-slot-level-label">Level ${level}</div>
					<div class="charsheet__spell-slot-pips" style="display: flex; gap: 4px; margin-top: 4px;">
						${pipsHtml}
					</div>
				</div>
			`);

			console.log("[CharSheet Spells] renderSlots: Level", level, "max:", max, "current:", current, "used:", used, "pipsHtml length:", pipsHtml.length);

			$container.append($row);
		}

		// Render Warlock Pact Slots
		const pactSlots = this._state.getPactSlots();
		if (pactSlots && pactSlots.max > 0) {
			slotsRendered++;
			const pactUsed = pactSlots.max - pactSlots.current;

			let pactPipsHtml = "";
			for (let i = 0; i < pactSlots.max; i++) {
				const isUsed = i < pactUsed;
				pactPipsHtml += `<span class="charsheet__spell-slot-pip charsheet__spell-slot-pip--pact ${isUsed ? "charsheet__spell-slot-pip--used" : ""}" data-pact-slot="true" style="display: inline-block; width: 18px; height: 18px; border: 2px solid #9b59b6; border-radius: 50%; margin: 2px; ${isUsed ? "background: #9b59b6;" : "background: transparent;"}"></span>`;
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

		const spells = this._state.getSpells();
		console.log("[CharSheet Spells] _renderSpellList: spells count", spells.length, spells);

		// Apply filters
		let filtered = spells;
		if (this._spellFilter) {
			filtered = filtered.filter(s => s.name.toLowerCase().includes(this._spellFilter));
		}
		if (this._spellLevelFilter !== "all") {
			filtered = filtered.filter(s => s.level === parseInt(this._spellLevelFilter));
		}

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

		filtered.forEach(spell => {
			if (grouped[spell.level]) {
				grouped[spell.level].spells.push(spell);
			}
		});

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

		const innateSpells = this._state.getInnateSpells();
		if (!filtered.length && !innateSpells.length) {
			$container.append(`<p class="ve-muted text-center">No spells</p>`);
		}
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
			usageInfo = '<span class="badge badge-success">At Will</span>';
		} else if (spell.uses) {
			const usedPips = spell.uses.max - spell.uses.current;
			const pipsHtml = Array.from({length: spell.uses.max}, (_, i) => 
				`<span class="charsheet__innate-pip ${i < usedPips ? "used" : ""}" data-spell-id="${spellId}"></span>`,
			).join("");
			usageInfo = `<span class="charsheet__innate-uses">${pipsHtml}</span>`;
		} else {
			usageInfo = '<span class="badge badge-secondary">1/day</span>';
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

		return $(`
			<div class="charsheet__spell-item ${isPrepared ? "prepared" : ""}" data-spell-id="${spellId}">
				<div class="charsheet__spell-item-main">
					<div class="charsheet__spell-item-header">
						<span class="charsheet__spell-item-name">${spellLink}</span>
						<span class="charsheet__spell-item-meta">
							${schoolFull ? `<span class="badge badge-secondary">${schoolFull}</span>` : ""}
							${spell.concentration ? `<span class="badge badge-info" title="Concentration">C</span>` : ""}
							${spell.ritual ? `<span class="badge badge-success" title="Ritual">R</span>` : ""}
						</span>
					</div>
					${detailsLine ? `<div class="charsheet__spell-item-details ve-muted ve-small">${detailsLine}</div>` : ""}
				</div>
				<div class="charsheet__spell-item-actions">
					${!isCantrip ? `
						<button class="ve-btn ve-btn-xs ${isPrepared ? "ve-btn-primary" : "ve-btn-default"} charsheet__spell-prepared" title="Toggle Prepared">
							<span class="glyphicon glyphicon-book mr-1"></span>${isPrepared ? "Prepared" : "Prepare"}
						</button>
					` : ""}
					<button class="ve-btn ve-btn-xs ve-btn-success charsheet__spell-cast" title="Cast Spell">
						<span class="glyphicon glyphicon-flash mr-1"></span>Cast
					</button>
					<button class="ve-btn ve-btn-xs ve-btn-default charsheet__spell-info" title="Spell Info">
						<span class="glyphicon glyphicon-info-sign mr-1"></span>Info
					</button>
					<button class="ve-btn ve-btn-xs ve-btn-danger charsheet__spell-remove" title="Remove Spell">
						<span class="glyphicon glyphicon-trash mr-1"></span>Remove
					</button>
				</div>
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

		// Display spells known or prepared count
		const spellcastingInfo = this._state.getSpellcastingInfo();
		const $knownContainer = $("#charsheet-spells-known-container");
		const $preparedContainer = $("#charsheet-spells-prepared-container");

		// Hide both by default
		$knownContainer.hide();
		$preparedContainer.hide();

		if (spellcastingInfo) {
			const spells = this._state.getSpells();
			const leveledSpells = spells.filter(s => s.level > 0);
			const cantrips = spells.filter(s => s.level === 0);
			const preparedSpells = leveledSpells.filter(s => s.prepared);

			if (spellcastingInfo.type === "known") {
				// Spells known caster (Bard, Sorcerer, Warlock, Ranger)
				$knownContainer.show();
				const currentKnown = leveledSpells.length;
				const maxKnown = spellcastingInfo.max;
				const knownColor = currentKnown > maxKnown ? "color: #c9302c;" : "";
				$("#charsheet-spells-known").html(`<span style="${knownColor}">${currentKnown}/${maxKnown}</span>`);
			} else if (spellcastingInfo.type === "prepared") {
				// Prepared caster (Cleric, Druid, Paladin, Wizard)
				$preparedContainer.show();
				const currentPrepared = preparedSpells.length;
				const maxPrepared = spellcastingInfo.max;
				const preparedColor = currentPrepared > maxPrepared ? "color: #c9302c;" : "";
				$("#charsheet-spells-prepared").html(`<span style="${preparedColor}">${currentPrepared}/${maxPrepared}</span>`);
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
