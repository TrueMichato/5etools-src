/**
 * Character Sheet Spell Picker
 * Reusable spell selection UI used by both LevelUp and QuickBuild modules.
 * Single source of truth for all spell-picking UIs (known spells, cantrips, wizard spellbook).
 */
class CharacterSheetSpellPicker {
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
			<div class="charsheet__levelup-section">
				<h5 class="charsheet__levelup-section-title">
					<span class="glyphicon glyphicon-fire"></span> Spells Known
				</h5>
				<p class="ve-small">Choose ${parts.join(" and ")} for your ${className}:</p>
				<div class="charsheet__levelup-known-spell-selections"></div>
				<div class="ve-small ve-muted mt-1">
					${spellCount > 0 ? `Spells: <span class="spell-count">0</span>/${spellCount}` : ""}
					${cantripCount > 0 ? `${spellCount > 0 ? " · " : ""}Cantrips: <span class="cantrip-count">0</span>/${cantripCount}` : ""}
				</div>
			</div>
		`);

		const $container = $section.find(".charsheet__levelup-known-spell-selections");
		const selectedSpells = [...preSelectedSpells];
		const selectedCantrips = [...preSelectedCantrips];

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
			$section.find(".spell-count").text(selectedSpells.length);
			$section.find(".cantrip-count").text(selectedCantrips.length);
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

		// Initialize counters if pre-selections exist
		if (selectedSpells.length || selectedCantrips.length) {
			$section.find(".spell-count").text(selectedSpells.length);
			$section.find(".cantrip-count").text(selectedCantrips.length);
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
			<div class="charsheet__levelup-section">
				<h5 class="charsheet__levelup-section-title">
					<span class="glyphicon glyphicon-book"></span> Spellbook
				</h5>
				<p class="ve-small">Choose ${spellCount} wizard spells (up to level ${maxSpellLevel}) to add to your spellbook:</p>
				<div class="charsheet__levelup-spellbook-selections"></div>
				<div class="ve-small ve-muted mt-1">Selected: <span class="spell-count">0</span>/${spellCount}</div>
			</div>
		`);

		const $container = $section.find(".charsheet__levelup-spellbook-selections");
		const selectedSpells = [...preSelectedSpells];

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

					$section.find(".spell-count").text(selectedSpells.length);
					onSelect([...selectedSpells]);
					renderSpellList();
				},
			});
		};

		$search.on("input", renderSpellList);
		$levelFilter.on("change", renderSpellList);
		$schoolFilter.on("change", renderSpellList);
		$ritualFilter.find("input").on("change", renderSpellList);
		$concFilter.find("input").on("change", renderSpellList);

		if (selectedSpells.length) {
			$section.find(".spell-count").text(selectedSpells.length);
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
