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

	_castSpell (spellId) {
		const spells = this._state.getSpells();
		const spell = spells.find(s => s.id === spellId);
		if (!spell) return;

		// Cantrips don't use slots
		if (spell.level === 0) {
			this._showCastResult(spell);
			return;
		}

		// Check pact slots first (they recharge on short rest, so use them preferentially)
		const pactSlots = this._state.getPactSlots();
		if (pactSlots && pactSlots.current > 0 && spell.level <= pactSlots.level) {
			this._state.setPactSlotsCurrent(pactSlots.current - 1);
			this._showCastResult(spell, pactSlots.level, true);
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
				this.renderSlots();
				this._page._renderQuickSpells(); // Update overview spell slots
				this._page.saveCharacter();
				return;
			}
			slotLevel++;
		}

		JqueryUtil.doToast({type: "warning", content: "No spell slots available!"});
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

			// Check if spell attack
			if (spellData.entries?.some(e => typeof e === "string" && e.toLowerCase().includes("spell attack"))) {
				const attackBonus = spellcastingMod + profBonus;
				const roll = this._page.rollDice(1, 20);
				attackInfo = `<br>Spell Attack: ${roll} + ${attackBonus} = <strong>${roll + attackBonus}</strong>`;
			}

			// Check for save DC
			if (spellData.savingThrow) {
				const saveDC = 8 + spellcastingMod + profBonus;
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

		if (!filtered.length) {
			$container.append(`<p class="ve-muted text-center">No spells</p>`);
		}
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
		
		const attackBonus = mod + prof + spellAttackBonus;
		const saveDC = 8 + mod + prof + spellDcBonus;
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
}

globalThis.CharacterSheetSpells = CharacterSheetSpells;

export {CharacterSheetSpells};
