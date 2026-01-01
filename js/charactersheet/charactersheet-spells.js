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
		$(document).on("click", "#charsheet-add-spell", () => this._showSpellPicker());

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

		// Get class spell list
		const className = classes[0].name;
		const classSpells = this._allSpells.filter(spell => {
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
			title: "Add Spell",
			isMinHeight0: true,
		});

		// Search and filter controls
		const $search = $(`<input type="text" class="form-control form-control--minimal mr-2" placeholder="Search spells...">`);
		const $levelSelect = $(`
			<select class="form-control form-control--minimal" style="width: auto;">
				<option value="all">All Levels</option>
				<option value="0">Cantrips</option>
				${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => `<option value="${l}">Level ${l}</option>`).join("")}
			</select>
		`);

		const $controls = $$`<div class="ve-flex mb-3">${$search}${$levelSelect}</div>`.appendTo($modalInner);
		const $list = $(`<div class="spell-picker-list" style="max-height: 400px; overflow-y: auto;"></div>`).appendTo($modalInner);

		const renderList = (filter = "", levelFilter = "all") => {
			$list.empty();

			const filtered = spells.filter(spell => {
				if (filter && !spell.name.toLowerCase().includes(filter)) return false;
				if (levelFilter !== "all" && spell.level !== parseInt(levelFilter)) return false;
				return true;
			});

			if (!filtered.length) {
				$list.append(`<p class="ve-muted text-center">No spells found</p>`);
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
				$list.append(`<h5 class="mt-2">${level}</h5>`);

				levelSpells.forEach(spell => {
					const spellId = `${spell.name}|${spell.source}`;
					const isKnown = knownSpellIds.includes(spellId);
					const school = Parser.spSchoolAbvToFull(spell.school);

					const $item = $(`
						<div class="ve-flex-v-center p-2 clickable ${isKnown ? "ve-muted" : ""}" style="border-bottom: 1px solid var(--rgb-border-grey);">
							<div class="ve-flex-col" style="flex: 1;">
								<span class="bold">${spell.name}</span>
								<span class="ve-small ve-muted">${school}${spell.ritual ? " (ritual)" : ""} • ${Parser.sourceJsonToAbv(spell.source)}</span>
							</div>
							${isKnown
								? `<span class="ve-muted">Known</span>`
								: `<button class="ve-btn ve-btn-primary ve-btn-xs spell-picker-add">Add</button>`
							}
						</div>
					`);

					if (!isKnown) {
						$item.find(".spell-picker-add").on("click", () => {
							this._addSpell(spell);
							knownSpellIds.push(spellId);
							$item.addClass("ve-muted");
							$item.find(".spell-picker-add").replaceWith(`<span class="ve-muted">Known</span>`);
							JqueryUtil.doToast({type: "success", content: `Added ${spell.name}`});
						});
					}

					$list.append($item);
				});
			});
		};

		$search.on("input", () => renderList($search.val().toLowerCase(), $levelSelect.val()));
		$levelSelect.on("change", () => renderList($search.val().toLowerCase(), $levelSelect.val()));

		renderList();

		// Close button
		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			<button class="ve-btn ve-btn-default">Close</button>
		</div>`.appendTo($modalInner).find("button").on("click", () => doClose(false));
	}

	_addSpell (spell) {
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

		this._renderSpellList();
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

	_castSpell (spellId) {
		const spells = this._state.getSpells();
		const spell = spells.find(s => s.id === spellId);
		if (!spell) return;

		// Cantrips don't use slots
		if (spell.level === 0) {
			this._showCastResult(spell);
			return;
		}

		// Find available slot
		let slotLevel = spell.level;
		while (slotLevel <= 9) {
			const current = this._state.getSpellSlotsCurrent(slotLevel);
			if (current > 0) {
				this._state.setSpellSlots(slotLevel, this._state.getSpellSlotsMax(slotLevel), current - 1);
				this._showCastResult(spell, slotLevel);
				this.renderSlots();
				this._page.saveCharacter();
				return;
			}
			slotLevel++;
		}

		JqueryUtil.doToast({type: "warning", content: "No spell slots available!"});
	}

	_showCastResult (spell, slotLevel = null) {
		const upcast = slotLevel && slotLevel > spell.level ? ` (at level ${slotLevel})` : "";

		// Check for spell attack or save DC
		const spellData = this._allSpells.find(s => s.name === spell.name && s.source === spell.source);
		let attackInfo = "";

		if (spellData) {
			const spellcastingMod = this._state.getAbilityMod(this._state.getSpellcastingAbility() || "int");
			const profBonus = this._state.getProficiencyBonus();

			// Check if spell attack
			if (spellData.entries?.some(e => typeof e === "string" && e.toLowerCase().includes("spell attack"))) {
				const attackBonus = spellcastingMod + profBonus;
				const roll = this._page.rollDice(1, 20);
				attackInfo = `<br>Spell Attack: ${roll} + ${attackBonus} = <strong>${roll + attackBonus}</strong>`;
			}

			// Check for save DC
			if (spellData.savingThrow) {
				const saveDC = 8 + spellcastingMod + profBonus;
				attackInfo = `<br>Save DC: <strong>${saveDC}</strong> (${spellData.savingThrow.join("/")} save)`;
			}
		}

		JqueryUtil.doToast({
			type: "success",
			content: `Cast ${spell.name}${upcast}${attackInfo}`,
		});
	}

	_removeSpell (spellId) {
		this._state.removeSpell(spellId);
		this._renderSpellList();
		this._page.saveCharacter();
	}

	_togglePrepared (spellId) {
		const spells = this._state.getSpells();
		const spell = spells.find(s => s.id === spellId);
		if (!spell || spell.level === 0) return; // Can't unprepare cantrips

		// Use state method to persist the change
		this._state.setSpellPrepared(spellId, !spell.prepared);
		this._renderSpellList();
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
		if (!$container.length) return;

		$container.empty();

		for (let level = 1; level <= 9; level++) {
			const max = this._state.getSpellSlotsMax(level);
			if (max <= 0) continue;

			const current = this._state.getSpellSlotsCurrent(level);
			const used = max - current;

			const $row = $(`
				<div class="charsheet__spell-slot-row" data-spell-level="${level}">
					<span class="charsheet__spell-slot-level">Level ${level}</span>
					<div class="charsheet__slot-pips">
						${Array(max).fill(0).map((_, i) => `<span class="charsheet__slot-pip ${i < used ? "used" : ""}"></span>`).join("")}
					</div>
				</div>
			`);

			$container.append($row);
		}

		// Show if no slots
		if (!$container.children().length) {
			$container.append(`<p class="ve-muted">No spell slots available</p>`);
		}
	}

	_renderSpellList () {
		const $container = $("#charsheet-spell-list");
		if (!$container.length) return;

		$container.empty();

		const spells = this._state.getSpells();

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

		if (!filtered.length) {
			$container.append(`<p class="ve-muted text-center">No spells</p>`);
		}
	}

	_renderSpellItem (spell) {
		const schoolAbbr = spell.school ? Parser.spSchoolAbvToFull(spell.school).slice(0, 3) : "";
		const isPrepared = spell.prepared;
		const isCantrip = spell.level === 0;

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

		return $(`
			<div class="charsheet__spell-item ${isPrepared ? "prepared" : ""}" data-spell-id="${spell.id}">
				<div class="charsheet__spell-item-main">
					<span class="charsheet__spell-item-name">${spellLink}</span>
					<span class="charsheet__spell-item-meta">
						${schoolAbbr ? `<span class="badge badge-secondary">${schoolAbbr}</span>` : ""}
						${spell.concentration ? `<span class="badge badge-info">C</span>` : ""}
						${spell.ritual ? `<span class="badge badge-success">R</span>` : ""}
					</span>
				</div>
				<div class="charsheet__spell-item-actions">
					${!isCantrip ? `
						<button class="ve-btn ve-btn-xs ${isPrepared ? "ve-btn-primary" : "ve-btn-default"} charsheet__spell-prepared" title="Toggle Prepared">
							<span class="glyphicon glyphicon-book"></span>
						</button>
					` : ""}
					<button class="ve-btn ve-btn-xs ve-btn-success charsheet__spell-cast" title="Cast Spell">
						<span class="glyphicon glyphicon-flash"></span>
					</button>
					<button class="ve-btn ve-btn-xs ve-btn-default charsheet__spell-info" title="Spell Info">
						<span class="glyphicon glyphicon-info-sign"></span>
					</button>
					<button class="ve-btn ve-btn-xs ve-btn-danger charsheet__spell-remove" title="Remove Spell">
						<span class="glyphicon glyphicon-trash"></span>
					</button>
				</div>
			</div>
		`);
	}

	render () {
		this.renderSlots();
		this._renderSpellList();

		// Render spellcasting stats
		const ability = this._state.getSpellcastingAbility();
		if (ability) {
			const mod = this._state.getAbilityMod(ability);
			const prof = this._state.getProficiencyBonus();
			const attackBonus = mod + prof;
			const saveDC = 8 + mod + prof;

			$("#charsheet-spell-attack").text(`+${attackBonus}`);
			$("#charsheet-save-dc").text(saveDC);
		}
	}
	// #endregion
}

globalThis.CharacterSheetSpells = CharacterSheetSpells;

export {CharacterSheetSpells};
