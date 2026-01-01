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

		this._init();
	}

	_init () {
		this._initEventListeners();
	}

	setItems (items) {
		this._allItems = items;
	}

	_initEventListeners () {
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

		// Currency inputs
		["cp", "sp", "ep", "gp", "pp"].forEach(currency => {
			$(document).on("change", `#charsheet-currency-${currency}`, (e) => {
				const value = parseInt(e.target.value) || 0;
				this._state.setCurrency(currency, value);
				this._page.saveCharacter();
			});
		});

		// Filter inputs
		$(document).on("input", "#charsheet-item-search", (e) => {
			this._itemFilter = e.target.value.toLowerCase();
			this._renderItemList();
		});

		$(document).on("change", "#charsheet-item-type-filter", (e) => {
			this._itemTypeFilter = e.target.value;
			this._renderItemList();
		});
	}

	async _showItemPicker () {
		await this._pShowItemPickerModal();
	}

	async _pShowItemPickerModal () {
		const items = this._allItems;

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "Add Item",
			isMinHeight0: true,
		});

		// Search and filter controls
		const $search = $(`<input type="text" class="form-control form-control--minimal mr-2" placeholder="Search items...">`);
		const $typeSelect = $(`
			<select class="form-control form-control--minimal" style="width: auto;">
				<option value="all">All Types</option>
				<option value="weapon">Weapons</option>
				<option value="armor">Armor</option>
				<option value="potion">Potions</option>
				<option value="wondrous">Wondrous Items</option>
				<option value="gear">Adventuring Gear</option>
				<option value="tool">Tools</option>
			</select>
		`);

		$$`<div class="ve-flex mb-3">${$search}${$typeSelect}</div>`.appendTo($modalInner);
		const $list = $(`<div class="item-picker-list" style="max-height: 400px; overflow-y: auto;"></div>`).appendTo($modalInner);

		const renderList = (filter = "", typeFilter = "all") => {
			$list.empty();

			const filtered = items.filter(item => {
				if (filter && !item.name.toLowerCase().includes(filter)) return false;
				if (typeFilter !== "all") {
					const itemType = this._getItemType(item);
					if (itemType !== typeFilter) return false;
				}
				return true;
			}).slice(0, 100); // Limit for performance

			if (!filtered.length) {
				$list.append(`<p class="ve-muted text-center">No items found</p>`);
				return;
			}

			filtered.forEach(item => {
				const typeTag = this._getItemTypeTag(item);
				// Don't display "none", "unknown", "unknown (magic)", or "varies" as rarity - these are internal markers
				const rarity = item.rarity && !["none", "unknown", "unknown (magic)", "varies"].includes(item.rarity.toLowerCase()) 
					? item.rarity.toTitleCase() 
					: "";

				const $item = $(`
					<div class="ve-flex-v-center p-2 clickable" style="border-bottom: 1px solid var(--rgb-border-grey);">
						<div class="ve-flex-col" style="flex: 1;">
							<span class="bold">${item.name}</span>
							<span class="ve-small ve-muted">
								${typeTag ? `<span class="badge badge-secondary">${typeTag}</span>` : ""}
								${rarity ? `<span class="badge badge-info">${rarity}</span>` : ""}
								${Parser.sourceJsonToAbv(item.source)}
							</span>
						</div>
						<button class="ve-btn ve-btn-primary ve-btn-xs item-picker-add">Add</button>
					</div>
				`);

				$item.find(".item-picker-add").on("click", () => {
					this._addItem(item);
					JqueryUtil.doToast({type: "success", content: `Added ${item.name}`});
				});

				$list.append($item);
			});
		};

		$search.on("input", () => renderList($search.val().toLowerCase(), $typeSelect.val()));
		$typeSelect.on("change", () => renderList($search.val().toLowerCase(), $typeSelect.val()));

		renderList();

		// Custom item section
		const $customName = $(`<input type="text" class="form-control form-control--minimal mr-2" placeholder="Item name" style="width: 200px;">`);
		$$`<div class="ve-flex-v-center mt-3 pt-3" style="border-top: 1px solid var(--rgb-border-grey);">
			<label class="mr-2">Custom Item:</label>
			${$customName}
			<button class="ve-btn ve-btn-primary">Add Custom</button>
		</div>`.appendTo($modalInner).find("button").on("click", () => {
			const name = $customName.val().trim();
			if (name) {
				this._addCustomItem(name);
				$customName.val("");
				JqueryUtil.doToast({type: "success", content: `Added ${name}`});
			}
		});

		// Close button
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

	_addCustomItem (name) {
		const newItem = {
			name,
			source: "Custom",
			quantity: 1,
			equipped: false,
			attuned: false,
			weight: 0,
			value: 0,
			type: "gear",
			requiresAttunement: false,
		};

		this._state.addItem(newItem);
		this._renderItemList();
		this._page.saveCharacter();
	}

	async _showAddCustomItem () {
		const name = await InputUiUtil.pGetUserString({title: "Add Custom Item", default: ""});
		if (!name || !name.trim()) return;

		this._addCustomItem(name.trim());
		JqueryUtil.doToast({type: "success", content: `Added ${name.trim()}`});
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
		this._updateArmorClass();
		this._page.saveCharacter();
	}

	_toggleAttuned (itemId) {
		const items = this._state.getItems();
		const item = items.find(i => i.id === itemId);
		if (!item || !item.requiresAttunement) return;

		// Check attunement limit (usually 3)
		const currentAttuned = this._state.getAttunedCount();
		if (!item.attuned && currentAttuned >= 3) {
			JqueryUtil.doToast({type: "warning", content: "Cannot attune to more than 3 items!"});
			return;
		}

		this._state.setItemAttuned(itemId, !item.attuned);
		this._renderItemList();
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
				html += `<p><strong>Properties:</strong> ${item.property.map(p => Parser.itemPropertyToFull(p)).join(", ")}</p>`;
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

		// Calculate carrying capacity
		const strScore = this._state.getAbilityTotal("str");
		const carryingCapacity = strScore * 15;
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
		const equippedShield = items.find(i => (i.shield || i.name?.toLowerCase().includes("shield")) && i.equipped);

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

		// Sort: equipped first, then by name
		filtered.sort((a, b) => {
			if (a.equipped !== b.equipped) return b.equipped - a.equipped;
			return a.name.localeCompare(b.name);
		});

		if (!filtered.length) {
			$container.append(`<p class="ve-muted text-center">No items</p>`);
			return;
		}

		filtered.forEach(item => {
			const $item = this._renderItemRow(item);
			$container.append($item);
		});
	}

	_renderItemRow (item) {
		const typeTag = this._getItemTypeTagFromStoredType(item.type);
		// Items that can be equipped: weapons, armor, gear, wondrous items, 
		// items requiring attunement, and items with any bonus properties
		const hasBonus = item.bonusAc || item.bonusSavingThrow || item.bonusSpellAttack || 
			item.bonusSpellSaveDc || item.bonusAbilityCheck || item.bonusWeapon;
		const canEquip = item.weapon || item.armor || item.shield || item.type === "gear" || 
			item.type === "wondrous" || item.requiresAttunement || hasBonus;
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

		return $(`
			<div class="charsheet__item ${item.equipped ? "equipped" : ""}" data-item-id="${item.id}">
				<div class="charsheet__item-main">
					<span class="charsheet__item-name">
						${item.attuned ? '<span class="glyphicon glyphicon-star text-warning mr-1"></span>' : ""}
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
					${hasCharges ? `<span class="ve-small charsheet__item-charges" title="${rechargeTooltip}">Charges: <strong>${item.chargesCurrent ?? item.charges}</strong>/${item.charges}</span>` : ""}
				</div>
				<div class="charsheet__item-actions">
					<button class="ve-btn ve-btn-xs ve-btn-default charsheet__item-qty-decrease" title="Decrease quantity">−</button>
					<span class="charsheet__item-qty">${item.quantity}</span>
					<button class="ve-btn ve-btn-xs ve-btn-default charsheet__item-qty-increase" title="Increase quantity">+</button>
					${hasCharges ? `
						<button class="ve-btn ve-btn-xs ve-btn-default charsheet__item-use-charge" title="Use 1 charge" ${(item.chargesCurrent ?? item.charges) <= 0 ? "disabled" : ""}>
							<span class="glyphicon glyphicon-flash"></span> Use
						</button>
						<button class="ve-btn ve-btn-xs ve-btn-default charsheet__item-restore-charge" title="Restore 1 charge" ${(item.chargesCurrent ?? item.charges) >= item.charges ? "disabled" : ""}>
							<span class="glyphicon glyphicon-plus"></span>
						</button>
					` : ""}
					${canEquip ? `
						<button class="ve-btn ve-btn-xs ${item.equipped ? "ve-btn-success" : "ve-btn-default"} charsheet__item-equip" title="${item.equipped ? "Unequip" : "Equip"}">
							<span class="glyphicon glyphicon-hand-right"></span> ${item.equipped ? "Equipped" : "Equip"}
						</button>
					` : ""}
					${canAttune ? `
						<button class="ve-btn ve-btn-xs ${item.attuned ? "ve-btn-warning" : "ve-btn-default"} charsheet__item-attune" title="${item.attuned ? "End attunement" : "Attune"}">
							<span class="glyphicon glyphicon-star"></span> ${item.attuned ? "Attuned" : "Attune"}
						</button>
					` : ""}
					<button class="ve-btn ve-btn-xs ve-btn-default charsheet__item-info" title="Item details">
						<span class="glyphicon glyphicon-info-sign"></span>
					</button>
					<button class="ve-btn ve-btn-xs ve-btn-danger charsheet__item-remove" title="Remove item">
						<span class="glyphicon glyphicon-trash"></span>
					</button>
				</div>
			</div>
		`);
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
			$(`#charsheet-currency-${c}`).val(currency[c] || 0);
		});

		// Calculate total value in GP
		const totalGP =
			(currency.cp || 0) / 100 +
			(currency.sp || 0) / 10 +
			(currency.ep || 0) / 2 +
			(currency.gp || 0) +
			(currency.pp || 0) * 10;

		$("#charsheet-currency-total").text(`${totalGP.toFixed(2)} GP`);
	}

	render () {
		this._renderItemList();
		this._renderCurrency();
		this._updateEncumbrance();
		// Sync armor state from equipped items (important on character load)
		this._syncArmorState();
	}

	/**
	 * Sync armor/shield state from equipped items without triggering re-render
	 * Called on initial render to ensure state is in sync with equipped items
	 */
	_syncArmorState () {
		const items = this._state.getItems();
		const equippedArmor = items.find(i => i.armor && i.equipped);
		const equippedShield = items.find(i => (i.shield || i.name?.toLowerCase().includes("shield")) && i.equipped);

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
	// #endregion
}

globalThis.CharacterSheetInventory = CharacterSheetInventory;

export {CharacterSheetInventory};
