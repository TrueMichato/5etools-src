/**
 * Character Sheet Inventory Manager
 * Handles items, equipment, currency, and encumbrance
 */
class CharacterSheetInventory {
	constructor (page) {
		this._page = page;
		this._state = page.getState();
		this._allItems = [];
		this._itemFilter = "";
		this._itemTypeFilter = "all";
		this._starredFilter = false;
		this._currentPage = 0;
		this._itemsPerPage = 50; // Increased since we now group by category
		this._sortBy = "name"; // name, weight, rarity, value
		this._sortAsc = true;
		this._collapsedCategories = new Set(); // Track collapsed category sections

		this._init();
	}

	_init () {
		this._initEventListeners();
	}

	setItems (items) {
		this._allItems = items;
	}

	_initEventListeners () {
		// Inventory view toggle buttons
		$(document).on("click", "#charsheet-btn-view-list", () => {
			$(".charsheet__inventory-list").removeClass("charsheet__inventory-list--compact");
			$("#charsheet-btn-view-list").addClass("active");
			$("#charsheet-btn-view-compact").removeClass("active");
		});

		$(document).on("click", "#charsheet-btn-view-compact", () => {
			$(".charsheet__inventory-list").addClass("charsheet__inventory-list--compact");
			$("#charsheet-btn-view-compact").addClass("active");
			$("#charsheet-btn-view-list").removeClass("active");
		});

		// Add item button - support both ID variants
		$(document).on("click", "#charsheet-add-item, #charsheet-btn-add-item", () => this._showItemPicker());

		// Add custom item button
		$(document).on("click", "#charsheet-btn-add-custom-item", () => this._showAddCustomItem());

		// Item quantity buttons
		$(document).on("click", ".charsheet__item-qty-decrease", (e) => {
			const itemId = $(e.currentTarget).closest(".charsheet__item").data("item-id");
			this._changeQuantity(itemId, -1);
		});

		$(document).on("click", ".charsheet__item-qty-increase", (e) => {
			const itemId = $(e.currentTarget).closest(".charsheet__item").data("item-id");
			this._changeQuantity(itemId, 1);
		});

		// Equip item
		$(document).on("click", ".charsheet__item-equip", (e) => {
			const itemId = $(e.currentTarget).closest(".charsheet__item").data("item-id");
			this._toggleEquipped(itemId);
		});

		// Attune item
		$(document).on("click", ".charsheet__item-attune", (e) => {
			const itemId = $(e.currentTarget).closest(".charsheet__item").data("item-id");
			this._toggleAttuned(itemId);
		});

		// Remove item
		$(document).on("click", ".charsheet__item-remove", (e) => {
			const itemId = $(e.currentTarget).closest(".charsheet__item").data("item-id");
			this._removeItem(itemId);
		});

		// Item info
		$(document).on("click", ".charsheet__item-info", (e) => {
			const itemId = $(e.currentTarget).closest(".charsheet__item").data("item-id");
			this._showItemInfo(itemId);
		});

		// Charge buttons - use and restore
		$(document).on("click", ".charsheet__item-use-charge", (e) => {
			const itemId = $(e.currentTarget).closest(".charsheet__item").data("item-id");
			this._useCharge(itemId);
		});

		$(document).on("click", ".charsheet__item-restore-charge", (e) => {
			const itemId = $(e.currentTarget).closest(".charsheet__item").data("item-id");
			this._restoreCharge(itemId);
		});

		// Star/favorite button
		$(document).on("click", ".charsheet__item-star", (e) => {
			e.stopPropagation();
			const itemId = $(e.currentTarget).closest(".charsheet__item").data("item-id");
			this._toggleStarred(itemId);
		});

		// Category header collapse toggle
		$(document).on("click", ".charsheet__category-header", (e) => {
			const $header = $(e.currentTarget);
			const category = $header.data("category");
			this._toggleCategoryCollapse(category);
		});

		// Currency inputs
		["cp", "sp", "ep", "gp", "pp"].forEach(currency => {
			$(document).on("change", `#charsheet-currency-${currency}`, (e) => {
				const value = parseInt(e.target.value) || 0;
				this._state.setCurrency(currency, value);
				this._page.saveCharacter();
			});
		});

		// Filter inputs
		$(document).on("input", "#charsheet-item-search, #charsheet-ipt-inventory-search", (e) => {
			this._itemFilter = e.target.value.toLowerCase();
			this._currentPage = 0; // Reset to first page when filtering
			this._renderItemList();
		});

		$(document).on("change", "#charsheet-item-type-filter", (e) => {
			this._itemTypeFilter = e.target.value;
			this._currentPage = 0; // Reset to first page when filtering
			this._renderItemList();
		});

		// Starred filter toggle
		$(document).on("click", "#charsheet-btn-starred-filter", (e) => {
			this._starredFilter = !this._starredFilter;
			$(e.currentTarget).toggleClass("active", this._starredFilter);
			this._currentPage = 0;
			this._renderItemList();
		});

		// Sort controls
		$(document).on("change", "#charsheet-inventory-sort", (e) => {
			this._sortBy = e.target.value;
			this._renderItemList();
		});

		$(document).on("click", "#charsheet-btn-sort-direction", (e) => {
			this._sortAsc = !this._sortAsc;
			const $btn = $(e.currentTarget);
			$btn.find(".glyphicon").toggleClass("glyphicon-sort-by-attributes", this._sortAsc)
				.toggleClass("glyphicon-sort-by-attributes-alt", !this._sortAsc);
			$btn.attr("title", this._sortAsc ? "Sort ascending" : "Sort descending");
			this._renderItemList();
		});
	}

	/**
	 * Toggle starred status for an item
	 * @param {string} itemId - The item ID
	 */
	_toggleStarred (itemId) {
		const newStatus = this._state.toggleItemStarred(itemId);
		this._renderItemList();
		this._page?.saveCharacter?.();

		JqueryUtil.doToast({
			type: newStatus ? "info" : "default",
			content: newStatus ? "Item starred!" : "Star removed",
		});
	}

	/**
	 * Toggle category collapse state
	 * @param {string} category - Category name
	 */
	_toggleCategoryCollapse (category) {
		if (this._collapsedCategories.has(category)) {
			this._collapsedCategories.delete(category);
		} else {
			this._collapsedCategories.add(category);
		}
		this._renderItemList();
	}

	async _showItemPicker () {
		await this._pShowItemPickerModal();
	}

	async _pShowItemPickerModal () {
		// Filter items by allowed sources
		const items = this._page.filterByAllowedSources(this._allItems);

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "🎒 Add Item",
			isMinHeight0: true,
			isWidth100: true,
		});

		// Intro text
		$modalInner.append(`
			<p class="ve-small ve-muted mb-3">
				Browse and add items to your inventory. Click an item to view details, or click <strong>+ Add</strong> to add it directly.
			</p>
		`);

		// Build enhanced filter UI
		const $filterContainer = $(`<div class="charsheet__modal-filter"></div>`).appendTo($modalInner);

		// Search input with icon
		const $searchWrapper = $(`<div class="charsheet__modal-search"></div>`).appendTo($filterContainer);
		const $search = $(`<input type="text" class="form-control" placeholder="🔍 Search items by name...">`).appendTo($searchWrapper);

		// Type filter - Multi-select dropdown
		const itemTypes = [
			{value: "weapon", label: "Weapons", emoji: "⚔️"},
			{value: "armor", label: "Armor", emoji: "🛡️"},
			{value: "potion", label: "Potions", emoji: "🧪"},
			{value: "scroll", label: "Scrolls", emoji: "📜"},
			{value: "wand", label: "Wands", emoji: "🪄"},
			{value: "staff", label: "Staves", emoji: "🏑"},
			{value: "ring", label: "Rings", emoji: "💍"},
			{value: "wondrous", label: "Wondrous", emoji: "✨"},
			{value: "gear", label: "Gear", emoji: "🎒"},
			{value: "tool", label: "Tools", emoji: "🔧"},
		];
		let selectedTypes = new Set(); // Empty = all types

		const $typeDropdown = $(`
			<div class="charsheet__source-multiselect">
				<button class="charsheet__source-multiselect-btn">
					<span class="charsheet__source-multiselect-icon">📦</span>
					<span class="charsheet__source-multiselect-text">All Types</span>
					<span class="charsheet__source-multiselect-arrow">▼</span>
				</button>
				<div class="charsheet__source-multiselect-dropdown">
					<div class="charsheet__source-multiselect-actions">
						<button class="charsheet__source-action-btn" data-action="all">Select All</button>
						<button class="charsheet__source-action-btn" data-action="none">Clear All</button>
					</div>
					<div class="charsheet__source-multiselect-list">
						${itemTypes.map(t => `
							<label class="charsheet__source-multiselect-item">
								<input type="checkbox" value="${t.value}" checked>
								<span class="charsheet__source-multiselect-check">✓</span>
								<span class="charsheet__source-multiselect-label">${t.emoji} ${t.label}</span>
							</label>
						`).join("")}
					</div>
				</div>
			</div>
		`).appendTo($filterContainer);

		// Type dropdown behavior
		const $typeBtn = $typeDropdown.find(".charsheet__source-multiselect-btn");
		const $typeDropdownMenu = $typeDropdown.find(".charsheet__source-multiselect-dropdown");
		const $typeText = $typeDropdown.find(".charsheet__source-multiselect-text");

		$typeBtn.on("click", (e) => {
			e.stopPropagation();
			$typeDropdownMenu.toggleClass("open");
			// Close other dropdowns
			$rarityDropdownMenu.removeClass("open");
			$sourceDropdownMenu.removeClass("open");
		});

		const updateTypeText = () => {
			const checked = $typeDropdown.find("input:checked");
			if (checked.length === 0) {
				$typeText.text("No Types");
				selectedTypes = new Set(["__NONE__"]);
			} else if (checked.length === itemTypes.length) {
				$typeText.text("All Types");
				selectedTypes = new Set();
			} else if (checked.length <= 2) {
				const labels = checked.map((_, el) => itemTypes.find(t => t.value === $(el).val())?.label || $(el).val()).get();
				$typeText.text(labels.join(", "));
				selectedTypes = new Set(checked.map((_, el) => $(el).val()).get());
			} else {
				$typeText.text(`${checked.length} Types`);
				selectedTypes = new Set(checked.map((_, el) => $(el).val()).get());
			}
			renderList();
		};

		$typeDropdown.find("input[type=checkbox]").on("change", updateTypeText);
		$typeDropdown.find("[data-action=all]").on("click", () => {
			$typeDropdown.find("input").prop("checked", true);
			updateTypeText();
		});
		$typeDropdown.find("[data-action=none]").on("click", () => {
			$typeDropdown.find("input").prop("checked", false);
			updateTypeText();
		});

		// Rarity filter - Multi-select dropdown
		const rarities = [
			{value: "common", label: "Common", emoji: "⚪"},
			{value: "uncommon", label: "Uncommon", emoji: "🟢"},
			{value: "rare", label: "Rare", emoji: "🔵"},
			{value: "very rare", label: "Very Rare", emoji: "🟣"},
			{value: "legendary", label: "Legendary", emoji: "🟠"},
			{value: "artifact", label: "Artifact", emoji: "🔴"},
		];
		let selectedRarities = new Set(); // Empty = all rarities

		const $rarityDropdown = $(`
			<div class="charsheet__source-multiselect">
				<button class="charsheet__source-multiselect-btn">
					<span class="charsheet__source-multiselect-icon">🌟</span>
					<span class="charsheet__source-multiselect-text">All Rarities</span>
					<span class="charsheet__source-multiselect-arrow">▼</span>
				</button>
				<div class="charsheet__source-multiselect-dropdown">
					<div class="charsheet__source-multiselect-actions">
						<button class="charsheet__source-action-btn" data-action="all">Select All</button>
						<button class="charsheet__source-action-btn" data-action="none">Clear All</button>
					</div>
					<div class="charsheet__source-multiselect-list">
						${rarities.map(r => `
							<label class="charsheet__source-multiselect-item">
								<input type="checkbox" value="${r.value}" checked>
								<span class="charsheet__source-multiselect-check">✓</span>
								<span class="charsheet__source-multiselect-label">${r.emoji} ${r.label}</span>
							</label>
						`).join("")}
					</div>
				</div>
			</div>
		`).appendTo($filterContainer);

		// Rarity dropdown behavior
		const $rarityBtn = $rarityDropdown.find(".charsheet__source-multiselect-btn");
		const $rarityDropdownMenu = $rarityDropdown.find(".charsheet__source-multiselect-dropdown");
		const $rarityText = $rarityDropdown.find(".charsheet__source-multiselect-text");

		$rarityBtn.on("click", (e) => {
			e.stopPropagation();
			$rarityDropdownMenu.toggleClass("open");
			// Close other dropdowns
			$typeDropdownMenu.removeClass("open");
			$sourceDropdownMenu.removeClass("open");
		});

		const updateRarityText = () => {
			const checked = $rarityDropdown.find("input:checked");
			if (checked.length === 0) {
				$rarityText.text("No Rarities");
				selectedRarities = new Set(["__NONE__"]);
			} else if (checked.length === rarities.length) {
				$rarityText.text("All Rarities");
				selectedRarities = new Set();
			} else if (checked.length <= 2) {
				const labels = checked.map((_, el) => rarities.find(r => r.value === $(el).val())?.label || $(el).val()).get();
				$rarityText.text(labels.join(", "));
				selectedRarities = new Set(checked.map((_, el) => $(el).val()).get());
			} else {
				$rarityText.text(`${checked.length} Rarities`);
				selectedRarities = new Set(checked.map((_, el) => $(el).val()).get());
			}
			renderList();
		};

		$rarityDropdown.find("input[type=checkbox]").on("change", updateRarityText);
		$rarityDropdown.find("[data-action=all]").on("click", () => {
			$rarityDropdown.find("input").prop("checked", true);
			updateRarityText();
		});
		$rarityDropdown.find("[data-action=none]").on("click", () => {
			$rarityDropdown.find("input").prop("checked", false);
			updateRarityText();
		});

		// Source filter - collect unique sources from items with multi-select
		const uniqueSources = [...new Set(items.map(i => i.source))].sort((a, b) => {
			// Sort PHB/DMG/etc first, then alphabetically
			const priority = ["PHB", "DMG", "MM", "XGE", "TCE", "FTD", "XPHB", "XDMG"];
			const aIdx = priority.indexOf(a);
			const bIdx = priority.indexOf(b);
			if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
			if (aIdx !== -1) return -1;
			if (bIdx !== -1) return 1;
			return a.localeCompare(b);
		});

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
			// Close other dropdowns
			$typeDropdownMenu.removeClass("open");
			$rarityDropdownMenu.removeClass("open");
		});

		// Close all dropdowns when clicking outside
		$(document).on("click.itemFilter", () => {
			$sourceDropdownMenu.removeClass("open");
			$typeDropdownMenu.removeClass("open");
			$rarityDropdownMenu.removeClass("open");
		});
		$sourceDropdownMenu.on("click", (e) => e.stopPropagation());
		$typeDropdownMenu.on("click", (e) => e.stopPropagation());
		$rarityDropdownMenu.on("click", (e) => e.stopPropagation());

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
			const official = ["PHB", "DMG", "MM", "XGE", "TCE", "FTD", "XPHB", "XDMG", "VGM", "MTF", "SCAG", "AI", "EGW", "MOT", "IDRotF"];
			$sourceDropdown.find("input").each((_, el) => {
				$(el).prop("checked", official.includes($(el).val()));
			});
			updateSourceText();
		});

		// Quick filter buttons row
		const $quickFilters = $(`<div class="charsheet__modal-quick-filters"></div>`).appendTo($modalInner);

		let filterAttunement = false;
		let filterMagic = false;
		let filterMundane = false;
		let filterConsumable = false;

		const $attuneBtn = $(`<button class="charsheet__modal-filter-btn">🔗 Requires Attunement</button>`).appendTo($quickFilters);
		const $magicBtn = $(`<button class="charsheet__modal-filter-btn">✨ Magical</button>`).appendTo($quickFilters);
		const $mundaneBtn = $(`<button class="charsheet__modal-filter-btn">📦 Mundane</button>`).appendTo($quickFilters);
		const $consumeBtn = $(`<button class="charsheet__modal-filter-btn">🧪 Consumables</button>`).appendTo($quickFilters);

		// Results count
		const $resultsCount = $(`<div class="charsheet__modal-results-count"></div>`).appendTo($modalInner);

		// Item list
		const $list = $(`<div class="charsheet__modal-list"></div>`).appendTo($modalInner);

		const renderList = () => {
			$list.empty();

			const searchTerm = $search.val().toLowerCase();

			const filterItem = (item) => {
				if (searchTerm && !item.name.toLowerCase().includes(searchTerm)) return false;
				// Multi-select type filter
				if (selectedTypes.has("__NONE__")) return false;
				if (selectedTypes.size > 0) {
					const itemType = this._getItemType(item);
					if (!selectedTypes.has(itemType)) return false;
				}
				// Multi-select rarity filter
				if (selectedRarities.has("__NONE__")) return false;
				if (selectedRarities.size > 0) {
					const itemRarity = (item.rarity || "").toLowerCase();
					if (!selectedRarities.has(itemRarity)) return false;
				}
				// Multi-select source filter
				if (selectedSources.has("__NONE__")) return false; // No sources selected
				if (selectedSources.size > 0 && !selectedSources.has(item.source)) return false;
				if (filterAttunement && !item.reqAttune) return false;
				if (filterMagic && !this._isMagicItem(item)) return false;
				if (filterMundane && this._isMagicItem(item)) return false;
				if (filterConsumable && !this._isConsumable(item)) return false;
				return true;
			};

			const filtered = items.filter(filterItem).slice(0, 150); // Limit for performance
			const totalMatches = items.filter(filterItem).length;

			$resultsCount.html(`<span>${filtered.length}${totalMatches > 150 ? ` of ${totalMatches}` : ""} item${filtered.length !== 1 ? "s" : ""} found</span>${totalMatches > 150 ? `<span class="ml-2" style="opacity: 0.7;">(showing first 150)</span>` : ""}`);

			if (!filtered.length) {
				$list.html(`
					<div class="charsheet__modal-empty">
						<div class="charsheet__modal-empty-icon">🎒</div>
						<div class="charsheet__modal-empty-text">No items match your filters.<br>Try adjusting your search or filters.</div>
					</div>
				`);
				return;
			}

			// Group by type
			const grouped = {};
			filtered.forEach(item => {
				const type = this._getItemTypeTag(item) || "Other";
				if (!grouped[type]) grouped[type] = [];
				grouped[type].push(item);
			});

			const typeOrder = ["Weapon", "Armor", "Shield", "Potion", "Scroll", "Wand", "Staff", "Ring", "Wondrous", "Tool", "Other"];
			const typeEmojis = {
				"Weapon": "⚔️",
				"Armor": "🛡️",
				"Shield": "🛡️",
				"Potion": "🧪",
				"Scroll": "📜",
				"Wand": "🪄",
				"Staff": "🏑",
				"Ring": "💍",
				"Wondrous": "✨",
				"Tool": "🔧",
				"Other": "📦",
			};
			Object.entries(grouped).sort((a, b) => {
				const aIdx = typeOrder.indexOf(a[0]);
				const bIdx = typeOrder.indexOf(b[0]);
				return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
			}).forEach(([type, typeItems]) => {
				const $section = $(`<div class="charsheet__modal-section"></div>`).appendTo($list);
				$(`<div class="charsheet__modal-section-title">${typeEmojis[type] || "📦"} ${type} <span style="opacity: 0.6;">(${typeItems.length})</span></div>`).appendTo($section);

				typeItems.forEach(item => {
					const rarity = item.rarity && !["none", "unknown", "unknown (magic)", "varies"].includes(item.rarity.toLowerCase())
						? item.rarity.toTitleCase()
						: "";
					const isMagic = this._isMagicItem(item);

					// Build tags string
					const tagParts = [];
					if (item.reqAttune) tagParts.push("🔗");
					if (isMagic) tagParts.push("✨");
					const tagsStr = tagParts.length ? ` ${tagParts.join(" ")}` : "";

					// Get rarity color
					const rarityColors = {
						"common": "#9ca3af",
						"uncommon": "#22c55e",
						"rare": "#3b82f6",
						"very rare": "#a855f7",
						"legendary": "#f97316",
						"artifact": "#ef4444",
					};
					const rarityColor = rarityColors[(item.rarity || "").toLowerCase()] || "";

					const $item = $(`
						<div class="charsheet__modal-list-item">
							<div class="charsheet__modal-list-item-icon">${this._getItemTypeEmoji(item)}</div>
							<div class="charsheet__modal-list-item-content">
								<div class="charsheet__modal-list-item-title">${item.name}${tagsStr}</div>
								<div class="charsheet__modal-list-item-subtitle">
									${rarity ? `<span style="color: ${rarityColor}; font-weight: 500;">${rarity}</span> • ` : ""}${item.value ? `${this._formatValue(item.value)} • ` : ""}${Parser.sourceJsonToAbv(item.source)}
								</div>
							</div>
							<button class="ve-btn ve-btn-primary ve-btn-xs item-picker-add">+ Add</button>
						</div>
					`);

					$item.find(".item-picker-add").on("click", (e) => {
						e.stopPropagation();
						this._addItem(item);
						JqueryUtil.doToast({type: "success", content: `Added ${item.name} to your inventory!`});
					});

					// Click row to show info
					$item.on("click", () => this._showItemInfoFromData(item));

					$section.append($item);
				});
			});
		};

		// Toggle quick filter buttons
		const toggleBtn = ($btn, prop) => {
			if (prop === "attunement") filterAttunement = !filterAttunement;
			if (prop === "magic") {
				filterMagic = !filterMagic;
				// If turning on magic filter, turn off mundane filter (mutually exclusive)
				if (filterMagic && filterMundane) {
					filterMundane = false;
					$mundaneBtn.removeClass("active");
				}
			}
			if (prop === "mundane") {
				filterMundane = !filterMundane;
				// If turning on mundane filter, turn off magic filter (mutually exclusive)
				if (filterMundane && filterMagic) {
					filterMagic = false;
					$magicBtn.removeClass("active");
				}
			}
			if (prop === "consumable") filterConsumable = !filterConsumable;
			$btn.toggleClass("active");
			renderList();
		};

		$attuneBtn.on("click", () => toggleBtn($attuneBtn, "attunement"));
		$magicBtn.on("click", () => toggleBtn($magicBtn, "magic"));
		$mundaneBtn.on("click", () => toggleBtn($mundaneBtn, "mundane"));
		$consumeBtn.on("click", () => toggleBtn($consumeBtn, "consumable"));

		$search.on("input", renderList);
		// Type, rarity, and source filters are handled by checkbox change events above

		// Initial render
		renderList();

		// Focus search on open
		setTimeout(() => $search.focus(), 100);

		// Custom item section
		const $customSection = $(`<div class="charsheet__modal-custom-section"></div>`).appendTo($modalInner);
		$(`<div class="charsheet__modal-section-title" style="margin-bottom: 0.75rem;">✏️ Create Custom Item</div>`).appendTo($customSection);
		$(`<p class="ve-small ve-muted mb-2">Can't find what you're looking for? Add a custom item:</p>`).appendTo($customSection);

		const $customInputs = $(`<div class="charsheet__modal-custom-inputs"></div>`).appendTo($customSection);
		const $customName = $(`<input type="text" class="form-control" placeholder="Item name..." style="flex: 1;">`).appendTo($customInputs);
		const $customQty = $(`<input type="number" class="form-control" placeholder="Qty" style="width: 70px;" value="1" min="1">`).appendTo($customInputs);
		const $customWeight = $(`<input type="number" class="form-control" placeholder="Weight" style="width: 90px;" step="0.1" min="0">`).appendTo($customInputs);
		const $customAddBtn = $(`<button class="ve-btn ve-btn-primary">+ Add Custom</button>`).appendTo($customInputs);

		$customAddBtn.on("click", () => {
			const name = $customName.val().trim();
			if (name) {
				const qty = parseInt($customQty.val()) || 1;
				const weight = parseFloat($customWeight.val()) || 0;
				this._addCustomItem(name, qty, weight);
				$customName.val("");
				$customQty.val("1");
				$customWeight.val("");
				JqueryUtil.doToast({type: "success", content: `Added custom item: ${name}`});
			}
		});

		// Enter to add custom item
		$customName.on("keydown", (e) => {
			if (e.key === "Enter") $customAddBtn.click();
		});

		// Close button
		$$`<div class="charsheet__modal-footer">
			<button class="ve-btn ve-btn-default">Close</button>
		</div>`.appendTo($modalInner).find("button").on("click", () => doClose(false));
	}

	_isMagicItem (item) {
		if (item.rarity && !["none", "unknown"].includes(item.rarity.toLowerCase())) return true;
		if (item.wondrous) return true;
		if (item.reqAttune) return true;
		if (item.bonusWeapon || item.bonusAc || item.bonusSpellAttack) return true;
		return false;
	}

	_isConsumable (item) {
		const type = item.type?.toLowerCase();
		if (type === "p") return true; // Potion
		if (type === "sc") return true; // Scroll
		if (item.poison) return true;
		if (item.name?.toLowerCase().includes("potion")) return true;
		if (item.name?.toLowerCase().includes("scroll")) return true;
		return false;
	}

	_getItemTypeEmoji (item) {
		const type = this._getItemType(item);
		const emojis = {
			"weapon": "⚔️",
			"armor": "🛡️",
			"potion": "🧪",
			"scroll": "📜",
			"wand": "🪄",
			"staff": "🏑",
			"ring": "💍",
			"wondrous": "✨",
			"gear": "🎒",
			"tool": "🔧",
		};
		return emojis[type] || "📦";
	}

	_formatValue (value) {
		if (!value) return "";
		// Value is in copper pieces
		const gp = Math.floor(value / 100);
		const sp = Math.floor((value % 100) / 10);
		const cp = value % 10;

		if (gp > 0) return `${gp} gp`;
		if (sp > 0) return `${sp} sp`;
		return `${cp} cp`;
	}

	async _showItemInfoFromData (item) {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: item.name,
			isMinHeight0: true,
		});

		const typeTag = this._getItemTypeTag(item);
		const rarity = item.rarity && !["none", "unknown", "unknown (magic)", "varies"].includes(item.rarity.toLowerCase())
			? item.rarity.toTitleCase()
			: "";

		const $content = $(`
			<div class="charsheet__item-info-modal">
				<div class="ve-flex gap-2 mb-2 ve-flex-wrap">
					${typeTag ? `<span class="charsheet__modal-list-item-badge">${typeTag}</span>` : ""}
					${rarity ? `<span class="charsheet__modal-list-item-badge">${rarity}</span>` : ""}
					${item.reqAttune ? `<span class="charsheet__modal-list-item-badge">🔗 Attunement</span>` : ""}
				</div>
				<div class="ve-small mb-3">
					${item.value ? `<div><strong>Value:</strong> ${this._formatValue(item.value)}</div>` : ""}
					${item.weight ? `<div><strong>Weight:</strong> ${item.weight} lb.</div>` : ""}
					${item.ac ? `<div><strong>AC:</strong> ${item.ac}${item.dexterityMax ? ` (max Dex ${item.dexterityMax > 0 ? `+${item.dexterityMax}` : item.dexterityMax})` : ""}</div>` : ""}
					${item.dmg1 ? `<div><strong>Damage:</strong> ${item.dmg1} ${item.dmgType ? Parser.dmgTypeToFull(item.dmgType) : ""}</div>` : ""}
					${item.property?.length ? `<div><strong>Properties:</strong> ${item.property.map(p => this._formatProperty(p)).join(", ")}</div>` : ""}
				</div>
				${item.entries?.length ? `
					<hr>
					<div class="rd__b">${Renderer.get().render({entries: item.entries})}</div>
				` : ""}
			</div>
		`).appendTo($modalInner);

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			<button class="ve-btn ve-btn-default">Close</button>
		</div>`.appendTo($modalInner).find("button").on("click", () => doClose(false));
	}

	_getItemType (item) {
		const typeBase = item.type?.split("|")[0];
		if (item.weapon) return "weapon";
		// Check both armor flag and armor type codes
		if (item.armor || ["LA", "MA", "HA"].includes(typeBase)) return "armor";
		if (typeBase === "S") return "armor"; // Shield
		if (item.type === "P") return "potion";
		if (item.type === "SC") return "scroll";
		if (item.type === "WD") return "wand";
		if (item.type === "ST") return "staff";
		if (item.type === "RG") return "ring";
		if (item.wondrous) return "wondrous";
		if (item.type === "AT" || item.type === "T") return "tool";
		if (item.type === "G" || item.type === "SCF") return "gear";
		return "gear";
	}

	_getItemTypeTag (item) {
		const typeBase = item.type?.split("|")[0];
		if (item.weapon) return "Weapon";
		if (item.armor || ["LA", "MA", "HA"].includes(typeBase)) return "Armor";
		if (typeBase === "S") return "Shield";
		if (item.type === "P") return "Potion";
		if (item.type === "SC") return "Scroll";
		if (item.type === "WD") return "Wand";
		if (item.type === "ST") return "Staff";
		if (item.type === "RG") return "Ring";
		if (item.wondrous) return "Wondrous";
		if (item.type === "AT" || item.type === "T") return "Tool";
		return "";
	}

	/**
	 * Parse a bonus string like "+1", "+2", "+3" into a number
	 * @param {string|number} bonus - The bonus value (e.g., "+1", "2", or a number)
	 * @returns {number} The parsed bonus as a number
	 */
	_parseBonus (bonus) {
		if (bonus == null) return 0;
		if (typeof bonus === "number") return bonus;
		const parsed = parseInt(bonus.toString().replace(/\s/g, ""), 10);
		return isNaN(parsed) ? 0 : parsed;
	}

	_addItem (item) {
		// Check if item is armor by type (LA, MA, HA) or armor flag
		const itemTypeBase = item.type?.split("|")[0];
		const isArmor = item.armor || ["LA", "MA", "HA"].includes(itemTypeBase);

		// Determine armor type for AC calculation
		let armorType = null;
		if (isArmor) {
			if (itemTypeBase === "HA") {
				armorType = "heavy";
			} else if (itemTypeBase === "MA") {
				armorType = "medium";
			} else if (itemTypeBase === "LA") {
				armorType = "light";
			}
		}

		// Check if item is a shield (type "S" or "S|source")
		const isShield = itemTypeBase === "S";

		// Parse charges - can be string or integer
		const maxCharges = item.charges ? (typeof item.charges === "string" ? parseInt(item.charges) : item.charges) : null;

		const newItem = {
			name: item.name,
			source: item.source,
			quantity: 1,
			equipped: false,
			attuned: false,
			weight: item.weight || 0,
			value: item.value || 0,
			type: this._getItemType(item),
			requiresAttunement: item.reqAttune || false,
			// Weapon properties
			weapon: item.weapon || false,
			weaponCategory: item.weaponCategory,
			damage: item.dmg1 ? `${item.dmg1} ${Parser.dmgTypeToFull(item.dmgType)}` : null,
			properties: item.property || [],
			mastery: item.mastery || [],
			range: item.range ? `${item.range}` : null,
			bonusWeapon: this._parseBonus(item.bonusWeapon),
			bonusWeaponAttack: this._parseBonus(item.bonusWeaponAttack),
			bonusWeaponDamage: this._parseBonus(item.bonusWeaponDamage),
			// Armor properties
			armor: isArmor,
			armorType: armorType,
			ac: item.ac || null,
			shield: isShield,
			bonusAc: this._parseBonus(item.bonusAc),
			// Spell bonuses
			bonusSpellAttack: this._parseBonus(item.bonusSpellAttack),
			bonusSpellSaveDc: this._parseBonus(item.bonusSpellSaveDc),
			// Save bonuses
			bonusSavingThrow: this._parseBonus(item.bonusSavingThrow),
			bonusSavingThrowStr: this._parseBonus(item.bonusSavingThrow_str),
			bonusSavingThrowDex: this._parseBonus(item.bonusSavingThrow_dex),
			bonusSavingThrowCon: this._parseBonus(item.bonusSavingThrow_con),
			bonusSavingThrowInt: this._parseBonus(item.bonusSavingThrow_int),
			bonusSavingThrowWis: this._parseBonus(item.bonusSavingThrow_wis),
			bonusSavingThrowCha: this._parseBonus(item.bonusSavingThrow_cha),
			// Ability bonuses
			bonusAbilityCheck: this._parseBonus(item.bonusAbilityCheck),
			// Charges
			charges: maxCharges,
			chargesCurrent: maxCharges, // Start fully charged
			recharge: item.recharge || null, // "dawn", "restShort", "restLong", etc.
			rechargeAmount: item.rechargeAmount || null, // e.g., "{@dice 1d6 + 1}" or a number
			// Magic item properties
			rarity: item.rarity,
		};

		this._state.addItem(newItem);
		this._renderItemList();
		this._updateEncumbrance();
		this._page.saveCharacter();
	}

	_addCustomItem (name, quantity = 1, weight = 0, options = {}) {
		const newItem = {
			name,
			source: "Custom",
			quantity,
			equipped: false,
			attuned: false,
			weight,
			value: options.value || 0,
			type: options.type || "gear",
			requiresAttunement: options.requiresAttunement || false,
			// Weapon stats
			weaponCategory: options.weaponCategory,
			dmg1: options.dmg1,
			dmgType: options.dmgType,
			property: options.property,
			range: options.range,
			// Armor stats
			armor: options.armor,
			ac: options.ac,
			strength: options.strength,
			stealth: options.stealth,
			// Magic properties
			rarity: options.rarity,
			bonusAc: options.bonusAc,
			bonusWeapon: options.bonusWeapon,
			// Charges
			charges: options.charges,
			chargesCurrent: options.charges,
			// Misc
			entries: options.entries ? [options.entries] : undefined,
		};

		this._state.addItem(newItem);
		this._renderItemList();
		this._page.saveCharacter();
	}

	async _showAddCustomItem () {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "✨ Create Custom Item",
			isMinHeight0: true,
			isWidth100: true,
		});

		// Item types
		const itemTypes = [
			{value: "gear", label: "Gear/Equipment", icon: "🎒"},
			{value: "weapon", label: "Weapon", icon: "⚔️"},
			{value: "armor", label: "Armor", icon: "🛡️"},
			{value: "shield", label: "Shield", icon: "🔰"},
			{value: "wondrous", label: "Wondrous Item", icon: "✨"},
			{value: "potion", label: "Potion", icon: "🧪"},
			{value: "scroll", label: "Scroll", icon: "📜"},
			{value: "ring", label: "Ring", icon: "💍"},
			{value: "wand", label: "Wand/Rod/Staff", icon: "🪄"},
		];

		// Damage types
		const damageTypes = ["bludgeoning", "piercing", "slashing", "acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"];

		// Weapon properties
		const weaponProperties = [
			{value: "A", label: "Ammunition"},
			{value: "F", label: "Finesse"},
			{value: "H", label: "Heavy"},
			{value: "L", label: "Light"},
			{value: "LD", label: "Loading"},
			{value: "R", label: "Range"},
			{value: "RN", label: "Reach"},
			{value: "S", label: "Special"},
			{value: "T", label: "Thrown"},
			{value: "2H", label: "Two-Handed"},
			{value: "V", label: "Versatile"},
		];

		// Rarities
		const rarities = ["common", "uncommon", "rare", "very rare", "legendary", "artifact"];

		// State
		let selectedType = "gear";

		// Build form
		const $form = $(`<div class="charsheet__custom-item-form"></div>`);

		// Basic Info Section
		$form.append(`
			<div class="charsheet__modal-info-banner charsheet__modal-info-banner--info">
				<div class="charsheet__modal-info-banner-icon">✨</div>
				<div class="charsheet__modal-info-banner-content">
					<strong>Create Custom Item</strong>
					<div class="ve-small">Fill in the details for your custom item. Required fields are marked with *</div>
				</div>
			</div>
		`);

		// Item Type Selection
		const $typeGrid = $(`<div class="charsheet__custom-item-types"></div>`);
		itemTypes.forEach(type => {
			const $btn = $(`
				<button type="button" class="charsheet__custom-item-type-btn ${type.value === selectedType ? "selected" : ""}" data-type="${type.value}">
					<span class="charsheet__custom-item-type-icon">${type.icon}</span>
					<span class="charsheet__custom-item-type-label">${type.label}</span>
				</button>
			`);
			$btn.on("click", () => {
				$typeGrid.find(".charsheet__custom-item-type-btn").removeClass("selected");
				$btn.addClass("selected");
				selectedType = type.value;
				updateFieldVisibility();
			});
			$typeGrid.append($btn);
		});

		$form.append(`<div class="charsheet__custom-item-section">
			<div class="charsheet__custom-item-section-title">📦 Item Type</div>
			${$typeGrid.prop("outerHTML")}
		</div>`);

		// Rebind events after appending
		$form.find(".charsheet__custom-item-type-btn").on("click", function () {
			$form.find(".charsheet__custom-item-type-btn").removeClass("selected");
			$(this).addClass("selected");
			selectedType = $(this).data("type");
			updateFieldVisibility();
		});

		// Basic Fields Section
		const $basicFields = $(`
			<div class="charsheet__custom-item-section">
				<div class="charsheet__custom-item-section-title">📝 Basic Information</div>
				<div class="charsheet__custom-item-fields">
					<div class="charsheet__custom-item-field charsheet__custom-item-field--full">
						<label>Name *</label>
						<input type="text" id="custom-item-name" class="form-control" placeholder="e.g., Flaming Longsword">
					</div>
					<div class="charsheet__custom-item-field">
						<label>Quantity</label>
						<input type="number" id="custom-item-qty" class="form-control" value="1" min="1">
					</div>
					<div class="charsheet__custom-item-field">
						<label>Weight (lbs)</label>
						<input type="number" id="custom-item-weight" class="form-control" value="0" min="0" step="0.1">
					</div>
					<div class="charsheet__custom-item-field">
						<label>Value (gp)</label>
						<input type="number" id="custom-item-value" class="form-control" value="0" min="0">
					</div>
					<div class="charsheet__custom-item-field">
						<label>Rarity</label>
						<select id="custom-item-rarity" class="form-control">
							<option value="">None</option>
							${rarities.map(r => `<option value="${r}">${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join("")}
						</select>
					</div>
					<div class="charsheet__custom-item-field charsheet__custom-item-field--checkbox">
						<label>
							<input type="checkbox" id="custom-item-attunement">
							Requires Attunement
						</label>
					</div>
				</div>
			</div>
		`);
		$form.append($basicFields);

		// Weapon Fields Section
		const $weaponFields = $(`
			<div class="charsheet__custom-item-section charsheet__custom-item-section--weapon" style="display: none;">
				<div class="charsheet__custom-item-section-title">⚔️ Weapon Statistics</div>
				<div class="charsheet__custom-item-fields">
					<div class="charsheet__custom-item-field">
						<label>Weapon Type</label>
						<select id="custom-item-weapon-cat" class="form-control">
							<option value="simple melee">Simple Melee</option>
							<option value="simple ranged">Simple Ranged</option>
							<option value="martial melee">Martial Melee</option>
							<option value="martial ranged">Martial Ranged</option>
						</select>
					</div>
					<div class="charsheet__custom-item-field">
						<label>Damage</label>
						<input type="text" id="custom-item-damage" class="form-control" placeholder="e.g., 1d8">
					</div>
					<div class="charsheet__custom-item-field">
						<label>Damage Type</label>
						<select id="custom-item-dmg-type" class="form-control">
							${damageTypes.map(d => `<option value="${d}">${d.charAt(0).toUpperCase() + d.slice(1)}</option>`).join("")}
						</select>
					</div>
					<div class="charsheet__custom-item-field">
						<label>Range (if ranged)</label>
						<input type="text" id="custom-item-range" class="form-control" placeholder="e.g., 80/320">
					</div>
					<div class="charsheet__custom-item-field">
						<label>Magic Bonus</label>
						<select id="custom-item-weapon-bonus" class="form-control">
							<option value="0">None</option>
							<option value="1">+1</option>
							<option value="2">+2</option>
							<option value="3">+3</option>
						</select>
					</div>
					<div class="charsheet__custom-item-field charsheet__custom-item-field--full">
						<label>Properties</label>
						<div class="charsheet__custom-item-props">
							${weaponProperties.map(p => `
								<label class="charsheet__custom-item-prop-check">
									<input type="checkbox" value="${p.value}" class="weapon-prop-check">
									${p.label}
								</label>
							`).join("")}
						</div>
					</div>
				</div>
			</div>
		`);
		$form.append($weaponFields);

		// Armor Fields Section
		const $armorFields = $(`
			<div class="charsheet__custom-item-section charsheet__custom-item-section--armor" style="display: none;">
				<div class="charsheet__custom-item-section-title">🛡️ Armor Statistics</div>
				<div class="charsheet__custom-item-fields">
					<div class="charsheet__custom-item-field">
						<label>Armor Type</label>
						<select id="custom-item-armor-type" class="form-control">
							<option value="light">Light Armor</option>
							<option value="medium">Medium Armor</option>
							<option value="heavy">Heavy Armor</option>
						</select>
					</div>
					<div class="charsheet__custom-item-field">
						<label>Base AC</label>
						<input type="number" id="custom-item-ac" class="form-control" value="10" min="0">
					</div>
					<div class="charsheet__custom-item-field">
						<label>Magic Bonus</label>
						<select id="custom-item-armor-bonus" class="form-control">
							<option value="0">None</option>
							<option value="1">+1</option>
							<option value="2">+2</option>
							<option value="3">+3</option>
						</select>
					</div>
					<div class="charsheet__custom-item-field">
						<label>STR Requirement</label>
						<input type="number" id="custom-item-str-req" class="form-control" value="0" min="0">
					</div>
					<div class="charsheet__custom-item-field charsheet__custom-item-field--checkbox">
						<label>
							<input type="checkbox" id="custom-item-stealth-dis">
							Stealth Disadvantage
						</label>
					</div>
				</div>
			</div>
		`);
		$form.append($armorFields);

		// Shield Fields Section
		const $shieldFields = $(`
			<div class="charsheet__custom-item-section charsheet__custom-item-section--shield" style="display: none;">
				<div class="charsheet__custom-item-section-title">🔰 Shield Statistics</div>
				<div class="charsheet__custom-item-fields">
					<div class="charsheet__custom-item-field">
						<label>AC Bonus</label>
						<input type="number" id="custom-item-shield-ac" class="form-control" value="2" min="0">
					</div>
					<div class="charsheet__custom-item-field">
						<label>Magic Bonus</label>
						<select id="custom-item-shield-bonus" class="form-control">
							<option value="0">None</option>
							<option value="1">+1</option>
							<option value="2">+2</option>
							<option value="3">+3</option>
						</select>
					</div>
				</div>
			</div>
		`);
		$form.append($shieldFields);

		// Magic Item Fields Section (charges, etc.)
		const $magicFields = $(`
			<div class="charsheet__custom-item-section charsheet__custom-item-section--magic" style="display: none;">
				<div class="charsheet__custom-item-section-title">✨ Magic Properties</div>
				<div class="charsheet__custom-item-fields">
					<div class="charsheet__custom-item-field">
						<label>Charges (0 = no charges)</label>
						<input type="number" id="custom-item-charges" class="form-control" value="0" min="0">
					</div>
				</div>
			</div>
		`);
		$form.append($magicFields);

		// Description Section
		const $descSection = $(`
			<div class="charsheet__custom-item-section">
				<div class="charsheet__custom-item-section-title">📖 Description (Optional)</div>
				<div class="charsheet__custom-item-fields">
					<div class="charsheet__custom-item-field charsheet__custom-item-field--full">
						<textarea id="custom-item-desc" class="form-control" rows="3" placeholder="Describe any special properties, abilities, or lore..."></textarea>
					</div>
				</div>
			</div>
		`);
		$form.append($descSection);

		$modalInner.append($form);

		// Field visibility logic
		const updateFieldVisibility = () => {
			$form.find(".charsheet__custom-item-section--weapon").toggle(selectedType === "weapon");
			$form.find(".charsheet__custom-item-section--armor").toggle(selectedType === "armor");
			$form.find(".charsheet__custom-item-section--shield").toggle(selectedType === "shield");
			$form.find(".charsheet__custom-item-section--magic").toggle(["wondrous", "wand", "ring", "potion", "scroll"].includes(selectedType));
		};
		updateFieldVisibility();

		// Footer buttons
		const $btnCancel = $(`<button class="ve-btn ve-btn-default">Cancel</button>`)
			.on("click", () => doClose(false));
		const $btnCreate = $(`<button class="ve-btn ve-btn-primary">✨ Create Item</button>`)
			.on("click", () => {
				const name = $form.find("#custom-item-name").val()?.trim();
				if (!name) {
					JqueryUtil.doToast({type: "warning", content: "Please enter an item name!"});
					return;
				}

				const options = {
					type: selectedType,
					value: parseInt($form.find("#custom-item-value").val()) || 0,
					rarity: $form.find("#custom-item-rarity").val() || undefined,
					requiresAttunement: $form.find("#custom-item-attunement").is(":checked"),
					entries: $form.find("#custom-item-desc").val()?.trim() || undefined,
				};

				// Weapon stats
				if (selectedType === "weapon") {
					options.weaponCategory = $form.find("#custom-item-weapon-cat").val();
					options.dmg1 = $form.find("#custom-item-damage").val() || "1d6";
					options.dmgType = $form.find("#custom-item-dmg-type").val();
					const range = $form.find("#custom-item-range").val()?.trim();
					if (range) options.range = range;
					const bonus = parseInt($form.find("#custom-item-weapon-bonus").val());
					if (bonus > 0) options.bonusWeapon = `+${bonus}`;
					// Gather properties
					const props = [];
					$form.find(".weapon-prop-check:checked").each(function () {
						props.push($(this).val());
					});
					if (props.length) options.property = props;
				}

				// Armor stats
				if (selectedType === "armor") {
					options.armor = true;
					options.ac = parseInt($form.find("#custom-item-ac").val()) || 10;
					const bonus = parseInt($form.find("#custom-item-armor-bonus").val());
					if (bonus > 0) options.bonusAc = `+${bonus}`;
					const strReq = parseInt($form.find("#custom-item-str-req").val());
					if (strReq > 0) options.strength = strReq;
					if ($form.find("#custom-item-stealth-dis").is(":checked")) options.stealth = true;
				}

				// Shield stats
				if (selectedType === "shield") {
					options.armor = true;
					options.ac = parseInt($form.find("#custom-item-shield-ac").val()) || 2;
					const bonus = parseInt($form.find("#custom-item-shield-bonus").val());
					if (bonus > 0) options.bonusAc = `+${bonus}`;
				}

				// Magic item charges
				if (["wondrous", "wand", "ring", "potion", "scroll"].includes(selectedType)) {
					const charges = parseInt($form.find("#custom-item-charges").val());
					if (charges > 0) options.charges = charges;
				}

				const quantity = parseInt($form.find("#custom-item-qty").val()) || 1;
				const weight = parseFloat($form.find("#custom-item-weight").val()) || 0;

				this._addCustomItem(name, quantity, weight, options);
				JqueryUtil.doToast({type: "success", content: `Created ${name}!`});
				doClose(true);
			});

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3 gap-2">
			${$btnCancel}
			${$btnCreate}
		</div>`.appendTo($modalInner);
	}

	_changeQuantity (itemId, delta) {
		const items = this._state.getItems();
		const item = items.find(i => i.id === itemId);
		if (!item) return;

		const newQuantity = Math.max(0, item.quantity + delta);

		if (newQuantity <= 0) {
			this._removeItem(itemId);
		} else {
			this._state.setItemQuantity(itemId, newQuantity);
			this._renderItemList();
			this._updateEncumbrance();
			this._page.saveCharacter();
		}
	}

	_toggleEquipped (itemId) {
		const items = this._state.getItems();
		const item = items.find(i => i.id === itemId);
		if (!item) return;

		const newEquipped = !item.equipped;

		// If equipping armor, unequip other armor
		if (newEquipped && item.armor) {
			items.forEach(other => {
				if (other.id !== itemId && other.armor && other.equipped) {
					this._state.setItemEquipped(other.id, false);
				}
			});
		}

		this._state.setItemEquipped(itemId, newEquipped);
		this._renderItemList();
		this._renderEquippedItems();
		this._updateArmorClass();
		this._page.saveCharacter();
	}

	_toggleAttuned (itemId) {
		const items = this._state.getItems();
		const item = items.find(i => i.id === itemId);
		if (!item || !item.requiresAttunement) return;

		// Check attunement limit (base 3, can be higher for Artificers)
		const currentAttuned = this._state.getAttunedCount();
		const maxAttuned = this._state.getMaxAttunement();
		if (!item.attuned && currentAttuned >= maxAttuned) {
			JqueryUtil.doToast({type: "warning", content: `Cannot attune to more than ${maxAttuned} items!`});
			return;
		}

		this._state.setItemAttuned(itemId, !item.attuned);
		this._renderItemList();
		this._renderAttunedItems();
		// Update AC and item bonuses - attunement state affects which bonuses are applied
		this._updateArmorClass();
		this._page.saveCharacter();
	}

	_useCharge (itemId) {
		const items = this._state.getItems();
		const item = items.find(i => i.id === itemId);
		if (!item || !item.charges) return;

		if (item.chargesCurrent <= 0) {
			JqueryUtil.doToast({type: "warning", content: `${item.name} has no charges remaining!`});
			return;
		}

		this._state.setItemCharges(itemId, item.chargesCurrent - 1);
		this._renderItemList();
		this._page.saveCharacter();

		JqueryUtil.doToast({type: "info", content: `Used 1 charge from ${item.name}. ${item.chargesCurrent - 1}/${item.charges} remaining.`});
	}

	_restoreCharge (itemId) {
		const items = this._state.getItems();
		const item = items.find(i => i.id === itemId);
		if (!item || !item.charges) return;

		if (item.chargesCurrent >= item.charges) {
			JqueryUtil.doToast({type: "warning", content: `${item.name} is already at full charges!`});
			return;
		}

		this._state.setItemCharges(itemId, item.chargesCurrent + 1);
		this._renderItemList();
		this._page.saveCharacter();
	}

	_removeItem (itemId) {
		this._state.removeItem(itemId);
		this._renderItemList();
		this._updateEncumbrance();
		this._updateArmorClass();
		this._page.saveCharacter();
	}

	async _showItemInfo (itemId) {
		const items = this._state.getItems();
		const item = items.find(i => i.id === itemId);
		if (!item) return;

		// Try to find full item data
		const itemData = this._allItems.find(i => i.name === item.name && i.source === item.source);

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: item.name,
			isMinHeight0: true,
		});

		$modalInner.append(`<div>${itemData ? this._renderItemDetails(itemData) : this._renderBasicItemDetails(item)}</div>`);

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			<button class="ve-btn ve-btn-default">Close</button>
		</div>`.appendTo($modalInner).find("button").on("click", () => doClose(false));
	}

	_renderItemDetails (item) {
		let html = "";

		// Type and rarity - filter out special rarity values
		const typeStr = this._getItemTypeTag(item);
		const displayRarity = item.rarity && !["none", "unknown", "unknown (magic)", "varies"].includes(item.rarity.toLowerCase());
		if (typeStr || displayRarity) {
			html += `<p class="ve-muted">${typeStr}${displayRarity ? `, ${item.rarity.toTitleCase()}` : ""}</p>`;
		}

		// Weapon stats
		if (item.weapon) {
			html += `<p><strong>Damage:</strong> ${item.dmg1 || "—"} ${item.dmgType ? Parser.dmgTypeToFull(item.dmgType) : ""}</p>`;
			if (item.property?.length) {
				html += `<p><strong>Properties:</strong> ${item.property.map(p => this._formatProperty(p)).join(", ")}</p>`;
			}
			if (item.mastery?.length) {
				html += `<p><strong>Mastery:</strong> ${item.mastery.map(m => this._formatMastery(m)).join(", ")}</p>`;
			}
			if (item.range) {
				html += `<p><strong>Range:</strong> ${item.range}</p>`;
			}
		}

		// Armor stats
		if (item.armor) {
			html += `<p><strong>AC:</strong> ${item.ac}</p>`;
			if (item.strength) {
				html += `<p><strong>Strength Required:</strong> ${item.strength}</p>`;
			}
			if (item.stealth) {
				html += `<p><strong>Stealth:</strong> Disadvantage</p>`;
			}
		}

		// Weight and value
		if (item.weight) {
			html += `<p><strong>Weight:</strong> ${item.weight} lb.</p>`;
		}
		if (item.value) {
			html += `<p><strong>Value:</strong> ${Parser.itemValueToFull(item)}</p>`;
		}

		// Attunement
		if (item.reqAttune) {
			const attStr = item.reqAttune === true ? "Yes" : item.reqAttune;
			html += `<p><strong>Requires Attunement:</strong> ${attStr}</p>`;
		}

		// Description
		if (item.entries) {
			html += `<hr>${Renderer.get().render({type: "entries", entries: item.entries})}`;
		}

		return html;
	}

	_renderBasicItemDetails (item) {
		let html = `<p class="ve-muted">${item.type || "Item"}</p>`;

		if (item.weight) {
			html += `<p><strong>Weight:</strong> ${item.weight} lb.</p>`;
		}

		if (item.damage) {
			html += `<p><strong>Damage:</strong> ${item.damage}</p>`;
		}

		if (item.ac) {
			html += `<p><strong>AC:</strong> ${item.ac}</p>`;
		}

		return html;
	}

	_updateEncumbrance () {
		const items = this._state.getItems();
		const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0);

		// Calculate carrying capacity using state method (respects Thelemar homebrew rules)
		const carryingCapacity = this._state.getCarryingCapacity();

		// For encumbrance thresholds, use standard STR-based calculation
		const strScore = this._state.getAbilityTotal("str");
		const encumberedThreshold = strScore * 5;
		const heavilyEncumberedThreshold = strScore * 10;

		// Update UI - support both ID variants
		$("#charsheet-total-weight, #charsheet-carrying-current").text(totalWeight.toFixed(1));
		$("#charsheet-carrying-capacity, #charsheet-carrying-max").text(carryingCapacity);

		// Update carrying bar
		const fillPercent = Math.min((totalWeight / carryingCapacity) * 100, 100);
		$("#charsheet-carrying-fill").css("width", `${fillPercent}%`);

		// Update bar color based on encumbrance
		const $fill = $("#charsheet-carrying-fill");
		$fill.removeClass("encumbered heavily-encumbered over-capacity");
		if (totalWeight > carryingCapacity) {
			$fill.addClass("over-capacity");
		} else if (totalWeight > heavilyEncumberedThreshold) {
			$fill.addClass("heavily-encumbered");
		} else if (totalWeight > encumberedThreshold) {
			$fill.addClass("encumbered");
		}

		// Update encumbrance status
		const $encumbranceStatus = $("#charsheet-encumbrance-status");
		$encumbranceStatus.removeClass("text-success text-warning text-danger");

		if (totalWeight > carryingCapacity) {
			$encumbranceStatus.addClass("text-danger").text("Over Capacity!");
		} else if (totalWeight > heavilyEncumberedThreshold) {
			$encumbranceStatus.addClass("text-danger").text("Heavily Encumbered");
		} else if (totalWeight > encumberedThreshold) {
			$encumbranceStatus.addClass("text-warning").text("Encumbered");
		} else {
			$encumbranceStatus.addClass("text-success").text("Normal");
		}
	}

	_updateArmorClass () {
		// Recalculate AC based on equipped armor and update state
		const items = this._state.getItems();
		const equippedArmor = items.find(i => i.armor && i.equipped);
		// Check for shield by flag first, then fall back to name check for older saves
		// Exclude items like "Ring of Mind Shielding" by checking it's not a ring type
		const equippedShield = items.find(i => {
			if (!i.equipped) return false;
			if (i.shield) return true;
			// Fallback name check - but exclude ring/wondrous items that happen to have "shield" in name
			if (i.name?.toLowerCase().includes("shield")) {
				const nameLower = i.name.toLowerCase();
				// Exclude "Ring of X Shielding" patterns and similar non-shield items
				if (nameLower.startsWith("ring of") || i.type === "ring" || i.type === "wondrous") {
					return false;
				}
				return true;
			}
			return false;
		});

		if (equippedArmor) {
			// Use stored armor type first, then look up from data
			let armorType = equippedArmor.armorType || "light";

			// If no stored type, look up full armor data
			if (!equippedArmor.armorType) {
				const armorData = this._allItems.find(i => i.name === equippedArmor.name && i.source === equippedArmor.source);
				if (armorData) {
					const itemType = armorData.type?.split("|")[0]; // Handle "MA|XPHB" format
					if (itemType === "HA") {
						armorType = "heavy";
					} else if (itemType === "MA") {
						armorType = "medium";
					} else if (itemType === "LA") {
						armorType = "light";
					}
				}
			}

			// Get AC value - include magic bonus if present
			const baseAC = equippedArmor.ac || 10;
			const magicBonus = equippedArmor.bonusAc || 0;
			const armorAC = baseAC + magicBonus;

			// Update state with armor info
			this._state.setArmor({
				ac: armorAC,
				type: armorType,
				name: equippedArmor.name,
				magicBonus: magicBonus,
			});
		} else {
			// No armor equipped
			this._state.setArmor(null);
		}

		// Update shield state - also track magic shield bonus
		const shieldBonus = equippedShield?.bonusAc || 0;
		this._state.setShield(equippedShield ? {equipped: true, bonus: shieldBonus} : false);

		// Calculate AC bonuses from other equipped/attuned items (like Cloak of Protection, Ring of Protection)
		const otherAcBonus = this._calculateItemBonuses("bonusAc", items, [equippedArmor, equippedShield]);
		this._state.setItemAcBonus(otherAcBonus);

		// Calculate other bonuses from equipped items
		this._updateItemBonuses(items);

		// Re-render to show updated AC
		this._page.renderCharacter();
	}

	/**
	 * Calculate total bonus of a specific type from equipped/attuned items
	 * @param {string} bonusType - The bonus type to calculate (e.g., "bonusAc", "bonusSavingThrow")
	 * @param {Array} items - All inventory items
	 * @param {Array} excludeItems - Items to exclude (already counted elsewhere)
	 * @returns {number} Total bonus
	 */
	_calculateItemBonuses (bonusType, items, excludeItems = []) {
		const excludeIds = excludeItems.filter(Boolean).map(i => i.id);
		return items
			.filter(item => {
				if (excludeIds.includes(item.id)) return false;
				// Item must be equipped
				if (!item.equipped) return false;
				// If item requires attunement, it must be attuned
				if (item.requiresAttunement && !item.attuned) return false;
				return item[bonusType];
			})
			.reduce((sum, item) => sum + (item[bonusType] || 0), 0);
	}

	/**
	 * Update state with all item bonuses from equipped/attuned items
	 */
	_updateItemBonuses (items) {
		// Calculate various bonuses
		const bonuses = {
			ac: this._calculateItemBonuses("bonusAc", items, []),
			savingThrow: this._calculateItemBonuses("bonusSavingThrow", items, []),
			spellAttack: this._calculateItemBonuses("bonusSpellAttack", items, []),
			spellSaveDc: this._calculateItemBonuses("bonusSpellSaveDc", items, []),
			abilityCheck: this._calculateItemBonuses("bonusAbilityCheck", items, []),
		};

		// Store bonuses in state for use by other modules
		this._state.setItemBonuses(bonuses);
	}

	// #region Rendering

	/**
	 * Get display category for an item
	 * @param {object} item - The item
	 * @returns {string} Category name
	 */
	_getItemCategory (item) {
		if (item.weapon) return "Weapons";
		const typeBase = item.type?.split("|")[0];
		if (item.armor || ["LA", "MA", "HA"].includes(typeBase)) return "Armor";
		if (typeBase === "S" || item.shield) return "Armor";
		if (item.type === "P") return "Consumables";
		if (item.type === "SC") return "Consumables";
		if (item.type === "WD") return "Wondrous Items";
		if (item.type === "ST") return "Wondrous Items";
		if (item.type === "RG") return "Wondrous Items";
		if (item.wondrous) return "Wondrous Items";
		if (item.type === "AT" || item.type === "T") return "Tools";
		if (item.type === "G" || item.type === "SCF") return "Adventuring Gear";
		return "Other";
	}

	/**
	 * Get icon for a category
	 * @param {string} category - Category name
	 * @returns {string} Emoji icon
	 */
	_getCategoryIcon (category) {
		const icons = {
			"Starred": "⭐",
			"Weapons": "⚔️",
			"Armor": "🛡️",
			"Consumables": "🧪",
			"Wondrous Items": "✨",
			"Tools": "🔧",
			"Adventuring Gear": "🎒",
			"Other": "📦",
		};
		return icons[category] || "📦";
	}

	/**
	 * Sort items based on current sort settings
	 * @param {Array} items - Items to sort
	 * @returns {Array} Sorted items
	 */
	_sortItems (items) {
		const sortFns = {
			name: (a, b) => a.name.localeCompare(b.name),
			weight: (a, b) => ((a.weight || 0) * a.quantity) - ((b.weight || 0) * b.quantity),
			rarity: (a, b) => {
				const rarityOrder = {none: 0, common: 1, uncommon: 2, rare: 3, "very rare": 4, legendary: 5, artifact: 6};
				const ra = rarityOrder[(a.rarity || "none").toLowerCase()] || 0;
				const rb = rarityOrder[(b.rarity || "none").toLowerCase()] || 0;
				return ra - rb;
			},
			value: (a, b) => ((a.value || 0) * a.quantity) - ((b.value || 0) * b.quantity),
		};

		const sorted = [...items];
		const sortFn = sortFns[this._sortBy] || sortFns.name;

		sorted.sort((a, b) => {
			// Always keep starred items at top within their groups
			if (a.starred !== b.starred) return b.starred - a.starred;
			// Then equipped items
			if (a.equipped !== b.equipped) return b.equipped - a.equipped;
			// Then apply chosen sort
			const result = sortFn(a, b);
			return this._sortAsc ? result : -result;
		});

		return sorted;
	}

	_renderItemList () {
		const $container = $("#charsheet-inventory-list");
		if (!$container.length) return;

		$container.empty();

		const items = this._state.getItems();

		// Apply filters
		let filtered = items;
		if (this._itemFilter) {
			filtered = filtered.filter(i => i.name.toLowerCase().includes(this._itemFilter));
		}
		if (this._itemTypeFilter !== "all") {
			filtered = filtered.filter(i => i.type === this._itemTypeFilter);
		}
		if (this._starredFilter) {
			filtered = filtered.filter(i => i.starred);
		}

		if (!filtered.length) {
			$container.append(`<div class="charsheet__inventory-empty">
				<span class="ve-muted">${this._starredFilter ? "No starred items" : "No items in inventory"}</span>
			</div>`);
			return;
		}

		// Group items by category
		const categoryOrder = ["Starred", "Weapons", "Armor", "Consumables", "Wondrous Items", "Tools", "Adventuring Gear", "Other"];
		const categories = {};

		// Separate starred items for the Starred category (if not filtering by starred)
		if (!this._starredFilter) {
			const starredItems = filtered.filter(i => i.starred);
			if (starredItems.length > 0) {
				categories["Starred"] = this._sortItems(starredItems);
			}
		}

		// Group remaining items by category
		filtered.forEach(item => {
			const category = this._getItemCategory(item);
			if (!categories[category]) categories[category] = [];
			// Don't add to category if already in Starred section (unless filtering by starred)
			if (this._starredFilter || !item.starred || category === "Starred") {
				// Only add non-starred items to regular categories when we have a Starred section
				if (!this._starredFilter && categories["Starred"] && item.starred) return;
				categories[category].push(item);
			}
		});

		// Sort items within each category
		Object.keys(categories).forEach(cat => {
			if (cat !== "Starred") { // Starred already sorted
				categories[cat] = this._sortItems(categories[cat]);
			}
		});

		// Render toolbar
		this._renderInventoryToolbar($container);

		// Render each category
		categoryOrder.forEach(category => {
			if (!categories[category] || !categories[category].length) return;

			const items = categories[category];
			const isCollapsed = this._collapsedCategories.has(category);
			const icon = this._getCategoryIcon(category);

			const $categorySection = $(`
				<div class="charsheet__inventory-category ${isCollapsed ? "collapsed" : ""}" data-category="${category}">
					<div class="charsheet__category-header" data-category="${category}">
						<span class="charsheet__category-collapse-icon">
							<span class="glyphicon ${isCollapsed ? "glyphicon-chevron-right" : "glyphicon-chevron-down"}"></span>
						</span>
						<span class="charsheet__category-icon">${icon}</span>
						<span class="charsheet__category-title">${category}</span>
						<span class="charsheet__category-count">${items.length}</span>
					</div>
					<div class="charsheet__category-items ${isCollapsed ? "hidden" : ""}"></div>
				</div>
			`);

			const $itemsContainer = $categorySection.find(".charsheet__category-items");
			items.forEach(item => {
				const $item = this._renderItemRow(item);
				$itemsContainer.append($item);
			});

			$container.append($categorySection);
		});
	}

	/**
	 * Render the inventory toolbar with filters and sort controls
	 * @param {jQuery} $container - The container to prepend to
	 */
	_renderInventoryToolbar ($container) {
		// Check if toolbar already exists in parent
		const $existingToolbar = $container.siblings(".charsheet__inventory-toolbar");
		if ($existingToolbar.length) {
			// Update the active state of starred filter
			$existingToolbar.find("#charsheet-btn-starred-filter").toggleClass("active", this._starredFilter);
			// Update sort dropdown
			$existingToolbar.find("#charsheet-inventory-sort").val(this._sortBy);
			return;
		}

		const $toolbar = $(`
			<div class="charsheet__inventory-toolbar">
				<div class="charsheet__inventory-toolbar-left">
					<button type="button" class="ve-btn ve-btn-xs ${this._starredFilter ? "ve-btn-warning" : "ve-btn-default"} charsheet__btn-starred-filter" id="charsheet-btn-starred-filter" title="Show only starred items">
						<span class="glyphicon glyphicon-star"></span> Starred
					</button>
				</div>
				<div class="charsheet__inventory-toolbar-right">
					<select class="form-control form-control--minimal charsheet__inventory-sort-select" id="charsheet-inventory-sort" title="Sort by">
						<option value="name" ${this._sortBy === "name" ? "selected" : ""}>Name</option>
						<option value="weight" ${this._sortBy === "weight" ? "selected" : ""}>Weight</option>
						<option value="rarity" ${this._sortBy === "rarity" ? "selected" : ""}>Rarity</option>
						<option value="value" ${this._sortBy === "value" ? "selected" : ""}>Value</option>
					</select>
					<button type="button" class="ve-btn ve-btn-xs ve-btn-default" id="charsheet-btn-sort-direction" title="${this._sortAsc ? "Sort ascending" : "Sort descending"}">
						<span class="glyphicon ${this._sortAsc ? "glyphicon-sort-by-attributes" : "glyphicon-sort-by-attributes-alt"}"></span>
					</button>
				</div>
			</div>
		`);

		$container.before($toolbar);
	}

	_renderPagination ($container, totalItems, totalPages) {
		// Remove existing pagination
		$container.siblings(".charsheet__inventory-pagination").remove();

		// Only show pagination if there's more than one page
		if (totalPages <= 1) return;

		const startIdx = this._currentPage * this._itemsPerPage + 1;
		const endIdx = Math.min((this._currentPage + 1) * this._itemsPerPage, totalItems);

		const $pagination = $(`
			<div class="charsheet__inventory-pagination">
				<button class="ve-btn ve-btn-xs ve-btn-default charsheet__pagination-prev" ${this._currentPage === 0 ? "disabled" : ""}>
					<span class="glyphicon glyphicon-chevron-left"></span> Prev
				</button>
				<span class="charsheet__inventory-pagination-info">
					${startIdx}-${endIdx} of ${totalItems}
				</span>
				<button class="ve-btn ve-btn-xs ve-btn-default charsheet__pagination-next" ${this._currentPage >= totalPages - 1 ? "disabled" : ""}>
					Next <span class="glyphicon glyphicon-chevron-right"></span>
				</button>
			</div>
		`);

		$pagination.find(".charsheet__pagination-prev").on("click", () => {
			if (this._currentPage > 0) {
				this._currentPage--;
				this._renderItemList();
			}
		});

		$pagination.find(".charsheet__pagination-next").on("click", () => {
			if (this._currentPage < totalPages - 1) {
				this._currentPage++;
				this._renderItemList();
			}
		});

		$container.after($pagination);
	}

	_renderItemRow (item) {
		const typeTag = this._getItemTypeTagFromStoredType(item.type);
		// Items that can be equipped: weapons, armor, gear, wondrous items,
		// items requiring attunement, and items with any bonus properties
		const hasBonus = item.bonusAc || item.bonusSavingThrow || item.bonusSpellAttack
			|| item.bonusSpellSaveDc || item.bonusAbilityCheck || item.bonusWeapon;
		const canEquip = item.weapon || item.armor || item.shield || item.type === "gear"
			|| item.type === "wondrous" || item.requiresAttunement || hasBonus;
		const canAttune = item.requiresAttunement;
		const hasCharges = item.charges && item.charges > 0;

		// Render item name with a 5etools hover link if it has a source
		let itemNameHtml = item.name;
		if (item.source && item.source !== "Custom" && this._page?.getHoverLink) {
			try {
				itemNameHtml = this._page.getHoverLink(
					UrlUtil.PG_ITEMS,
					item.name,
					item.source,
				);
			} catch (e) {
				// Fall back to plain name if rendering fails
				itemNameHtml = item.name;
			}
		}

		// Get recharge description for tooltip
		const rechargeDescriptions = {
			dawn: "Recharges at dawn",
			dusk: "Recharges at dusk",
			midnight: "Recharges at midnight",
			restShort: "Recharges on short rest",
			restLong: "Recharges on long rest",
			round: "Recharges each round",
			special: "Special recharge",
		};
		const rechargeTooltip = item.recharge ? rechargeDescriptions[item.recharge] || `Recharges: ${item.recharge}` : "";

		// Format properties and mastery for display (check both 'properties' and 'property' for backwards compatibility)
		const itemProperties = item.properties || item.property || [];
		const propertiesStr = itemProperties.length
			? itemProperties.map(p => this._formatProperty(p)).join(", ")
			: "";
		const masteryStr = item.mastery?.length
			? item.mastery.map(m => this._formatMastery(m)).join(", ")
			: "";

		return $(`
			<div class="charsheet__item ${item.equipped ? "equipped" : ""} ${item.starred ? "starred" : ""}" data-item-id="${item.id}">
				<div class="charsheet__item-star-wrapper">
					<button type="button" class="charsheet__item-star ${item.starred ? "active" : ""}" title="${item.starred ? "Remove star" : "Star item"}">
						<span class="glyphicon glyphicon-star"></span>
					</button>
				</div>
				<div class="charsheet__item-content">
					<div class="charsheet__item-main">
						<span class="charsheet__item-name">
							${item.attuned ? "<span class=\"charsheet__item-attuned-badge\" title=\"Attuned\">◈</span>" : ""}
							${itemNameHtml}
							${item.quantity > 1 ? `<span class="ve-muted">(×${item.quantity})</span>` : ""}
						</span>
						<span class="charsheet__item-meta">
							${typeTag ? `<span class="badge badge-secondary ve-small">${typeTag}</span>` : ""}
							${item.rarity && !["none", "unknown", "unknown (magic)", "varies"].includes(item.rarity.toLowerCase()) ? `<span class="badge badge-info ve-small">${item.rarity.toTitleCase()}</span>` : ""}
							${item.weight ? `<span class="ve-muted ve-small">${(item.weight * item.quantity).toFixed(1)} lb.</span>` : ""}
						</span>
					</div>
					<div class="charsheet__item-details">
						${item.damage ? `<span class="ve-small">Dmg: ${item.damage}</span>` : ""}
						${item.ac ? `<span class="ve-small">AC: ${item.ac}</span>` : ""}
						${propertiesStr ? `<span class="ve-small ve-muted" title="Properties">${propertiesStr}</span>` : ""}
						${masteryStr ? `<span class="ve-small text-info" title="Mastery">⚔ ${masteryStr}</span>` : ""}
						${hasCharges ? `<span class="ve-small charsheet__item-charges" title="${rechargeTooltip}">Charges: <strong>${item.chargesCurrent ?? item.charges}</strong>/${item.charges}</span>` : ""}
					</div>
					<div class="charsheet__item-actions">
						<button type="button" class="ve-btn ve-btn-xs ve-btn-default charsheet__item-qty-decrease" title="Decrease quantity">−</button>
						<span class="charsheet__item-qty">${item.quantity}</span>
						<button type="button" class="ve-btn ve-btn-xs ve-btn-default charsheet__item-qty-increase" title="Increase quantity">+</button>
						${hasCharges ? `
							<button type="button" class="ve-btn ve-btn-xs ve-btn-default charsheet__item-use-charge" title="Use 1 charge" ${(item.chargesCurrent ?? item.charges) <= 0 ? "disabled" : ""}>
								<span class="glyphicon glyphicon-flash"></span> Use
							</button>
							<button type="button" class="ve-btn ve-btn-xs ve-btn-default charsheet__item-restore-charge" title="Restore 1 charge" ${(item.chargesCurrent ?? item.charges) >= item.charges ? "disabled" : ""}>
								<span class="glyphicon glyphicon-plus"></span>
							</button>
						` : ""}
						${canEquip ? `
							<button type="button" class="ve-btn ve-btn-xs ${item.equipped ? "ve-btn-success" : "ve-btn-default"} charsheet__item-equip" title="${item.equipped ? "Unequip" : "Equip"}">
								<span class="glyphicon glyphicon-hand-right"></span> ${item.equipped ? "Equipped" : "Equip"}
							</button>
						` : ""}
						${canAttune ? `
							<button type="button" class="ve-btn ve-btn-xs ${item.attuned ? "ve-btn-warning" : "ve-btn-default"} charsheet__item-attune" title="${item.attuned ? "End attunement" : "Attune"}">
								<span class="glyphicon glyphicon-star-empty"></span> ${item.attuned ? "Attuned" : "Attune"}
							</button>
						` : ""}
						<button type="button" class="ve-btn ve-btn-xs ve-btn-default charsheet__item-info" title="Item details">
							<span class="glyphicon glyphicon-info-sign"></span>
						</button>
						<button type="button" class="ve-btn ve-btn-xs ve-btn-danger charsheet__item-remove" title="Remove item">
							<span class="glyphicon glyphicon-trash"></span>
						</button>
					</div>
				</div>
			</div>
		`);
	}

	/**
	 * Format a weapon property code to display name
	 * @param {string} prop - Property code like "F" or "2H|XPHB"
	 * @returns {string} Formatted property name
	 */
	_formatProperty (prop) {
		// Use Parser if available, otherwise do basic formatting
		if (typeof Parser !== "undefined" && Parser.itemPropertyToFull) {
			try {
				return Parser.itemPropertyToFull(prop);
			} catch (e) {
				// Fall back to basic formatting
			}
		}

		// Basic property code mapping
		const propMap = {
			"A": "Ammunition",
			"AF": "Ammunition (Firearm)",
			"F": "Finesse",
			"H": "Heavy",
			"L": "Light",
			"LD": "Loading",
			"R": "Reach",
			"RLD": "Reload",
			"S": "Special",
			"T": "Thrown",
			"2H": "Two-Handed",
			"V": "Versatile",
		};

		// Extract property code (before |)
		const code = prop.split("|")[0].toUpperCase();
		return propMap[code] || prop;
	}

	/**
	 * Format a weapon mastery code to display name
	 * @param {string} mastery - Mastery code like "Sap|XPHB"
	 * @returns {string} Formatted mastery name
	 */
	_formatMastery (mastery) {
		// Extract mastery name (before |source)
		const name = mastery.split("|")[0];
		return name.toTitleCase();
	}

	_getItemTypeTagFromStoredType (type) {
		const tags = {
			weapon: "Weapon",
			armor: "Armor",
			potion: "Potion",
			wondrous: "Wondrous",
			tool: "Tool",
			gear: "Gear",
		};
		return tags[type] || "";
	}

	_renderCurrency () {
		const currency = this._state.getCurrency();
		["cp", "sp", "ep", "gp", "pp"].forEach(c => {
			// Update inventory tab currency inputs
			$(`#charsheet-inv-ipt-${c}`).val(currency[c] || 0);
		});

		// Calculate total value in GP
		const totalGP =
			(currency.cp || 0) / 100
			+ (currency.sp || 0) / 10
			+ (currency.ep || 0) / 2
			+ (currency.gp || 0)
			+ (currency.pp || 0) * 10;

		const $total = $("#charsheet-inv-currency-total");
		if (totalGP > 0) {
			$total.text(`≈ ${totalGP.toFixed(1)} GP`).show();
		} else {
			$total.hide();
		}
	}

	/**
	 * Initialize currency input handlers for inventory tab
	 */
	_initCurrencyInputs () {
		["cp", "sp", "ep", "gp", "pp"].forEach(currency => {
			$(`#charsheet-inv-ipt-${currency}`).off("change").on("change", (e) => {
				const value = parseInt(e.target.value) || 0;
				this._state.setCurrency(currency, value);
				this._renderCurrency();
				// Also update overview currency display
				this._page?._renderCurrency?.();
				this._page?.saveCharacter?.();
			});
		});
	}

	render () {
		this._renderItemList();
		this._renderCurrency();
		this._initCurrencyInputs();
		this._updateEncumbrance();
		this._renderEquippedItems();
		this._renderAttunedItems();
		// Sync armor state from equipped items (important on character load)
		this._syncArmorState();
	}

	/**
	 * Render equipped items in the sidebar
	 */
	_renderEquippedItems () {
		const $container = $("#charsheet-equipped-list");
		if (!$container.length) return;

		$container.empty();

		const items = this._state.getItems();
		const equippedItems = items.filter(i => i.equipped);

		if (!equippedItems.length) {
			$container.append(`<div class="ve-muted ve-text-center py-2">No items equipped</div>`);
			return;
		}

		equippedItems.forEach(item => {
			const $item = this._renderEquipmentSummaryRow(item, "equipped");
			$container.append($item);
		});
	}

	/**
	 * Render attuned items in the sidebar
	 */
	_renderAttunedItems () {
		const $container = $("#charsheet-attuned-list");
		if (!$container.length) return;

		$container.empty();

		const items = this._state.getItems();
		const attunedItems = items.filter(i => i.attuned);
		const currentAttuned = attunedItems.length;
		const maxAttuned = this._state.getMaxAttunement();

		if (!attunedItems.length) {
			$container.append(`<div class="ve-muted ve-text-center py-2">No attuned items (${currentAttuned}/${maxAttuned})</div>`);
			return;
		}

		// Show attunement count header
		$container.append(`<div class="ve-small ve-muted mb-1">Attunement Slots: ${currentAttuned}/${maxAttuned}</div>`);

		attunedItems.forEach(item => {
			const $item = this._renderEquipmentSummaryRow(item, "attuned");
			$container.append($item);
		});
	}

	/**
	 * Render a compact summary row for equipped/attuned item display
	 */
	_renderEquipmentSummaryRow (item, type) {
		// Get item name with hover link if available
		let itemNameHtml = item.name;
		if (item.source && item.source !== "Custom" && this._page?.getHoverLink) {
			try {
				itemNameHtml = this._page.getHoverLink(
					UrlUtil.PG_ITEMS,
					item.name,
					item.source,
				);
			} catch (e) {
				// Fall back to plain text
			}
		}

		// Build bonus info
		const bonusParts = [];
		if (item.bonusAc) bonusParts.push(`AC +${item.bonusAc}`);
		if (item.bonusWeapon || item.bonusWeaponAttack) bonusParts.push(`Atk +${item.bonusWeapon || item.bonusWeaponAttack}`);
		if (item.bonusSavingThrow) bonusParts.push(`Saves +${item.bonusSavingThrow}`);
		if (item.bonusSpellAttack) bonusParts.push(`Spell Atk +${item.bonusSpellAttack}`);
		if (item.bonusSpellSaveDc) bonusParts.push(`Spell DC +${item.bonusSpellSaveDc}`);
		const bonusStr = bonusParts.length ? `<span class="ve-small ve-muted">(${bonusParts.join(", ")})</span>` : "";

		// Format properties and mastery (check both fields for backwards compatibility)
		const itemProperties = item.properties || item.property || [];
		const propertiesStr = itemProperties.length
			? itemProperties.map(p => this._formatProperty(p)).join(", ")
			: "";
		const masteryStr = item.mastery?.length
			? item.mastery.map(m => this._formatMastery(m)).join(", ")
			: "";

		// Build row with item type icon
		const typeIcon = item.weapon ? "⚔️" : item.armor ? "🛡️" : item.shield ? "🛡️" : "✨";

		// Build details line for weapons
		let detailsHtml = "";
		if (item.weapon && (item.damage || propertiesStr || masteryStr)) {
			const detailParts = [];
			if (item.damage) detailParts.push(item.damage);
			if (propertiesStr) detailParts.push(propertiesStr);
			if (masteryStr) detailParts.push(`<span class="text-info">⚔ ${masteryStr}</span>`);
			detailsHtml = `<div class="ve-small ve-muted">${detailParts.join(" | ")}</div>`;
		}

		return $(`
			<div class="charsheet__equipment-summary-item" data-item-id="${item.id}">
				<div class="charsheet__equipment-summary-main">
					<span class="charsheet__equipment-icon">${typeIcon}</span>
					<span class="charsheet__equipment-name">${itemNameHtml}</span>
					${bonusStr}
				</div>
				${detailsHtml}
			</div>
		`);
	}

	/**
	 * Sync armor/shield state from equipped items without triggering re-render
	 * Called on initial render to ensure state is in sync with equipped items
	 */
	_syncArmorState () {
		const items = this._state.getItems();
		const equippedArmor = items.find(i => i.armor && i.equipped);
		// Check for shield by flag first, then fall back to name check for older saves
		// Exclude items like "Ring of Mind Shielding" by checking it's not a ring type
		const equippedShield = items.find(i => {
			if (!i.equipped) return false;
			if (i.shield) return true;
			// Fallback name check - but exclude ring/wondrous items that happen to have "shield" in name
			if (i.name?.toLowerCase().includes("shield")) {
				const nameLower = i.name.toLowerCase();
				// Exclude "Ring of X Shielding" patterns and similar non-shield items
				if (nameLower.startsWith("ring of") || i.type === "ring" || i.type === "wondrous") {
					return false;
				}
				return true;
			}
			return false;
		});

		if (equippedArmor) {
			let armorType = equippedArmor.armorType || "light";

			// If no stored type, try to determine from item data
			if (!equippedArmor.armorType) {
				const armorData = this._allItems.find(i => i.name === equippedArmor.name && i.source === equippedArmor.source);
				if (armorData) {
					const itemType = armorData.type?.split("|")[0];
					if (itemType === "HA") armorType = "heavy";
					else if (itemType === "MA") armorType = "medium";
					else if (itemType === "LA") armorType = "light";
				}
			}

			// Include magic armor bonus
			const baseAC = equippedArmor.ac || 10;
			const magicBonus = equippedArmor.bonusAc || 0;

			this._state.setArmor({
				ac: baseAC + magicBonus,
				type: armorType,
				name: equippedArmor.name,
				magicBonus: magicBonus,
			});
		} else {
			this._state.setArmor(null);
		}

		// Include magic shield bonus
		const shieldBonus = equippedShield?.bonusAc || 0;
		this._state.setShield(equippedShield ? {equipped: true, bonus: shieldBonus} : false);

		// Calculate AC bonuses from other equipped/attuned items
		const otherAcBonus = this._calculateItemBonuses("bonusAc", items, [equippedArmor, equippedShield]);
		this._state.setItemAcBonus(otherAcBonus);

		// Calculate other bonuses from equipped items
		this._updateItemBonuses(items);
	}

	/**
	 * Edit an item by its ID - scrolls to the item and opens its info modal
	 * @param {string} itemId - The ID of the item to edit
	 * @returns {boolean} True if the item was found and handled
	 */
	async editItemById (itemId) {
		const items = this._state.getItems();
		const item = items.find(i => i.id === itemId);
		if (!item) return false;

		// Scroll to and highlight the item in the inventory list
		const $item = $(`.charsheet__item[data-item-id="${itemId}"]`);
		if ($item.length) {
			// Scroll the item into view
			$item[0].scrollIntoView({behavior: "smooth", block: "center"});
			// Highlight the item briefly
			$item.addClass("charsheet__item--highlighted");
			setTimeout(() => $item.removeClass("charsheet__item--highlighted"), 2000);
		}

		// Open the item info modal
		await this._showItemInfo(itemId);
		return true;
	}
	// #endregion
}

globalThis.CharacterSheetInventory = CharacterSheetInventory;

export {CharacterSheetInventory};
