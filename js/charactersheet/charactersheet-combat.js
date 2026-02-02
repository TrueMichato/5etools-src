/**
 * Character Sheet Combat Manager
 * Handles attacks, weapons, and combat-related actions
 */
class CharacterSheetCombat {
	constructor (page) {
		this._page = page;
		this._state = page.getState();
		this._allItems = [];
		this._cachedAttacks = [];

		this._init();
	}

	_init () {
		this._initEventListeners();
	}

	setItems (items) {
		this._allItems = items.filter(i => i.weapon);
	}

	_initEventListeners () {
		// Add attack button - support both ID variants
		$(document).on("click", "#charsheet-add-attack, #charsheet-btn-add-attack", () => this._showAttackCreator());

		// Roll attack (Shift=Advantage, Ctrl=Disadvantage)
		$(document).on("click", ".charsheet__attack-roll", (e) => {
			const attackId = $(e.currentTarget).closest(".charsheet__attack-item").data("attack-id");
			this._rollAttack(attackId, e);
		});

		// Roll damage
		$(document).on("click", ".charsheet__attack-damage", (e) => {
			const attackId = $(e.currentTarget).closest(".charsheet__attack-item").data("attack-id");
			this._rollDamage(attackId);
		});

		// Edit attack
		$(document).on("click", ".charsheet__attack-edit", (e) => {
			const attackId = $(e.currentTarget).closest(".charsheet__attack-item").data("attack-id");
			this._editAttack(attackId);
		});

		// Remove attack
		$(document).on("click", ".charsheet__attack-remove", (e) => {
			const attackId = $(e.currentTarget).closest(".charsheet__attack-item").data("attack-id");
			this._removeAttack(attackId);
		});

		// Initiative roll (Shift=Advantage, Ctrl=Disadvantage)
		$(document).on("click", "#charsheet-roll-initiative", (e) => this._rollInitiative(e));

		// Death save buttons
		$(document).on("click", "#charsheet-death-save-success", () => this._rollDeathSave(true));
		$(document).on("click", "#charsheet-death-save-failure", () => this._rollDeathSave(false));
		$(document).on("click", "#charsheet-death-save-reset", () => this._resetDeathSaves());

		// Combat spell casting
		$(document).on("click", ".charsheet__combat-spell-cast", (e) => {
			const spellId = $(e.currentTarget).data("spell-id");
			this._castCombatSpell(spellId);
		});

		// Combat Methods: use method (spend exertion)
		$(document).on("click", ".charsheet__method-use", (e) => {
			const methodId = $(e.currentTarget).data("method-id");
			this._useMethod(methodId);
		});

		// Exertion controls
		$(document).on("click", "#charsheet-exertion-add", () => this._modifyExertion(1));
		$(document).on("click", "#charsheet-exertion-remove", () => this._modifyExertion(-1));

		// Combat Methods: add/manage methods
		$(document).on("click", "#charsheet-btn-add-method", () => this._showMethodPicker());

		// Add condition button in combat tab
		$(document).on("click", "#charsheet-combat-add-condition", () => this._onAddCondition());
	}

	/**
	 * Add a condition from the combat tab
	 */
	async _onAddCondition () {
		// Delegate to main page's add condition method
		await this._page._onAddCondition?.();
		// Sync the combat tab
		this.renderCombatConditions();
		this.renderCombatEffects();
		this.renderCombatDefenses();
	}

	async _castCombatSpell (spellId) {
		// Delegate to the spells module if available
		if (this._page._spells) {
			await this._page._spells._castSpell(spellId);
			this.renderCombatSpells(); // Refresh to update slot display
			this.renderCombatStates(); // Refresh to show concentration
			this.renderCombatEffects(); // Refresh effects
		} else {
			JqueryUtil.doToast({type: "warning", content: "Spells module not available."});
		}
	}

	async _showAttackCreator () {
		await this._pShowAttackModal();
	}

	async _pShowAttackModal (existingAttack = null) {
		const isEdit = !!existingAttack;
		const attack = existingAttack || {
			name: "",
			attackBonus: 0,
			damage: "1d6",
			damageType: "slashing",
			damageBonus: 0,
			range: "",
			properties: [],
			isMelee: true,
			abilityMod: "str",
		};

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: `${isEdit ? "⚔️ Edit" : "➕ Add"} Attack`,
			isMinHeight0: true,
			cbClose: () => {
				// Cleanup event listeners
				$(document).off("click.attackModalQuickSelect");
			},
		});

		// Add custom modal class
		$modalInner.addClass("charsheet__attack-modal");

		// Build enhanced form with sections
		const $content = $(`<div class="charsheet__attack-form"></div>`).appendTo($modalInner);

		// Main Info Section
		const $mainSection = $(`
			<div class="charsheet__attack-section">
				<div class="charsheet__attack-section-header">
					<span class="charsheet__attack-section-icon">📋</span>
					<span class="charsheet__attack-section-title">Basic Information</span>
				</div>
				<div class="charsheet__attack-field">
					<label class="charsheet__attack-label">Attack Name</label>
					<input type="text" class="charsheet__attack-input charsheet__attack-input--name" value="${attack.name}" placeholder="e.g., Longsword, Eldritch Blast">
				</div>
				<div class="charsheet__attack-field-row">
					<div class="charsheet__attack-field">
						<label class="charsheet__attack-label">Type</label>
						<select class="charsheet__attack-select">
							<option value="melee" ${attack.isMelee ? "selected" : ""}>⚔️ Melee</option>
							<option value="ranged" ${!attack.isMelee ? "selected" : ""}>🏹 Ranged</option>
						</select>
					</div>
					<div class="charsheet__attack-field">
						<label class="charsheet__attack-label">Ability</label>
						<select class="charsheet__attack-select charsheet__attack-select--ability">
							${Parser.ABIL_ABVS.map(a => `<option value="${a}" ${attack.abilityMod === a ? "selected" : ""}>${Parser.attAbvToFull(a)} (${a.toUpperCase()})</option>`).join("")}
						</select>
					</div>
					<div class="charsheet__attack-field">
						<label class="charsheet__attack-label">Range</label>
						<input type="text" class="charsheet__attack-input charsheet__attack-input--range" value="${attack.range || ""}" placeholder="5 ft. or 30/120 ft.">
					</div>
				</div>
			</div>
		`).appendTo($content);

		// Combat Stats Section
		const $combatSection = $(`
			<div class="charsheet__attack-section">
				<div class="charsheet__attack-section-header">
					<span class="charsheet__attack-section-icon">🎯</span>
					<span class="charsheet__attack-section-title">Combat Statistics</span>
				</div>
				<div class="charsheet__attack-field-row">
					<div class="charsheet__attack-field">
						<label class="charsheet__attack-label">Attack Bonus</label>
						<div class="charsheet__attack-number-input">
							<button class="charsheet__attack-number-btn charsheet__attack-number-btn--minus" data-field="bonus">−</button>
							<input type="number" class="charsheet__attack-input charsheet__attack-input--bonus" value="${attack.attackBonus}">
							<button class="charsheet__attack-number-btn charsheet__attack-number-btn--plus" data-field="bonus">+</button>
						</div>
					</div>
					<div class="charsheet__attack-field">
						<label class="charsheet__attack-label">Damage Dice</label>
						<input type="text" class="charsheet__attack-input charsheet__attack-input--damage" value="${attack.damage}" placeholder="1d8, 2d6, etc.">
					</div>
					<div class="charsheet__attack-field">
						<label class="charsheet__attack-label">Damage Type</label>
						<select class="charsheet__attack-select charsheet__attack-select--dmgtype">
							${["bludgeoning", "piercing", "slashing", "fire", "cold", "lightning", "thunder", "poison", "acid", "necrotic", "radiant", "force", "psychic"].map(t =>
		`<option value="${t}" ${attack.damageType === t ? "selected" : ""}>${this._getDamageTypeEmoji(t)} ${t.toTitleCase()}</option>`,
	).join("")}
						</select>
					</div>
					<div class="charsheet__attack-field">
						<label class="charsheet__attack-label">Damage Bonus</label>
						<div class="charsheet__attack-number-input">
							<button class="charsheet__attack-number-btn charsheet__attack-number-btn--minus" data-field="dmgbonus">−</button>
							<input type="number" class="charsheet__attack-input charsheet__attack-input--dmgbonus" value="${attack.damageBonus}">
							<button class="charsheet__attack-number-btn charsheet__attack-number-btn--plus" data-field="dmgbonus">+</button>
						</div>
					</div>
				</div>
			</div>
		`).appendTo($content);

		// Properties Section
		const $propsSection = $(`
			<div class="charsheet__attack-section">
				<div class="charsheet__attack-section-header">
					<span class="charsheet__attack-section-icon">✨</span>
					<span class="charsheet__attack-section-title">Properties</span>
				</div>
				<div class="charsheet__attack-field">
					<label class="charsheet__attack-label">Weapon Properties</label>
					<input type="text" class="charsheet__attack-input charsheet__attack-input--properties" value="${(attack.properties || []).join(", ")}" placeholder="e.g., versatile, finesse, light, two-handed">
					<div class="charsheet__attack-properties-hint">Common: finesse, light, heavy, reach, thrown, two-handed, versatile</div>
				</div>
			</div>
		`).appendTo($content);

		// Quick Add Section
		const inventoryItems = this._state.getItems();
		const inventoryWeapons = inventoryItems.filter(i => i.weapon);

		const $quickSection = $(`
			<div class="charsheet__attack-section charsheet__attack-section--quick">
				<div class="charsheet__attack-section-header">
					<span class="charsheet__attack-section-icon">⚡</span>
					<span class="charsheet__attack-section-title">Quick Select</span>
				</div>
				<div class="charsheet__attack-quick-grid">
					${inventoryWeapons.length ? `
						<div class="charsheet__attack-quick-group">
							<label class="charsheet__attack-label">🎒 From Inventory</label>
							<select class="charsheet__attack-select charsheet__attack-select--inventory">
								<option value="">— Select weapon —</option>
								${inventoryWeapons.map(weapon => {
		const bonus = (weapon.bonusWeapon || 0) + (weapon.bonusWeaponAttack || 0);
		const label = bonus > 0 ? `${weapon.name} (+${bonus})` : weapon.name;
		return `<option value="inv:${weapon.name}">${label}</option>`;
	}).join("")}
							</select>
						</div>
					` : ""}
					<div class="charsheet__attack-quick-group">
						<label class="charsheet__attack-label">📚 From Catalog</label>
						<select class="charsheet__attack-select charsheet__attack-select--catalog">
							<option value="">— Select from all weapons —</option>
							${this._allItems
		.filter(i => i.weapon)
		.sort((a, b) => a.name.localeCompare(b.name))
		.map(weapon => {
			const bonus = this._parseBonus(weapon.bonusWeapon) + this._parseBonus(weapon.bonusWeaponAttack);
			const label = bonus > 0 ? `${weapon.name} (+${bonus})` : weapon.name;
			return `<option value="${weapon.name}|${weapon.source}">${label}</option>`;
		}).join("")}
						</select>
					</div>
				</div>
			</div>
		`).appendTo($content);

		// Get form elements
		const $name = $content.find(".charsheet__attack-input--name");
		const $type = $content.find(".charsheet__attack-section:first-child .charsheet__attack-select:first");
		const $ability = $content.find(".charsheet__attack-select--ability");
		const $range = $content.find(".charsheet__attack-input--range");
		const $bonus = $content.find(".charsheet__attack-input--bonus");
		const $damage = $content.find(".charsheet__attack-input--damage");
		const $damageType = $content.find(".charsheet__attack-select--dmgtype");
		const $damageBonus = $content.find(".charsheet__attack-input--dmgbonus");
		const $properties = $content.find(".charsheet__attack-input--properties");
		const $inventorySelect = $content.find(".charsheet__attack-select--inventory");
		const $weaponSelect = $content.find(".charsheet__attack-select--catalog");

		// Number input +/- buttons
		$content.find(".charsheet__attack-number-btn").on("click", function () {
			const field = $(this).data("field");
			const $input = field === "bonus" ? $bonus : $damageBonus;
			const delta = $(this).hasClass("charsheet__attack-number-btn--plus") ? 1 : -1;
			$input.val(parseInt($input.val() || 0) + delta);
		});

		// Inventory weapon select handler
		if ($inventorySelect.length) {
			$inventorySelect.on("change", () => {
				if (!$inventorySelect.val()) return;
				const weaponName = $inventorySelect.val().replace("inv:", "");
				const weapon = inventoryWeapons.find(i => i.name === weaponName);
				if (weapon) {
					$name.val(weapon.name);
					const isRanged = weapon.properties?.some(p => p.includes("A") || p.toLowerCase().includes("ammunition")) || weapon.range;
					$type.val(isRanged ? "ranged" : "melee");
					const hasFinesse = weapon.properties?.some(p => p.includes("F") || p.toLowerCase().includes("finesse"));
					$ability.val(isRanged ? "dex" : (hasFinesse ? "dex" : "str"));
					if (weapon.damage) {
						const dmgMatch = weapon.damage.match(/(\d+d\d+)/);
						if (dmgMatch) $damage.val(dmgMatch[1]);
						const typeMatch = weapon.damage.match(/\d+d\d+\s*(\w+)/);
						if (typeMatch) $damageType.val(typeMatch[1].toLowerCase());
					}
					if (weapon.range) $range.val(weapon.range);
					if (weapon.properties) $properties.val(weapon.properties.map(p => typeof p === "string" ? p : Parser.itemPropertyToFull(p)).join(", "));
					const attackBonusVal = (weapon.bonusWeapon || 0) + (weapon.bonusWeaponAttack || 0);
					const damageBonusVal = (weapon.bonusWeapon || 0) + (weapon.bonusWeaponDamage || 0);
					$bonus.val(attackBonusVal);
					$damageBonus.val(damageBonusVal);
					$weaponSelect.val("");
				}
			});
		}

		// Catalog weapon select handler
		$weaponSelect.on("change", () => {
			if (!$weaponSelect.val()) return;
			const [name, source] = $weaponSelect.val().split("|");
			const weapon = this._allItems.find(i => i.name === name && i.source === source);
			if (weapon) {
				$name.val(weapon.name);
				const isRanged = weapon.property?.includes("A") || weapon.range;
				$type.val(isRanged ? "ranged" : "melee");
				const hasFinesse = weapon.property?.includes("F");
				$ability.val(isRanged ? "dex" : (hasFinesse ? "dex" : "str"));
				if (weapon.dmg1) $damage.val(weapon.dmg1);
				if (weapon.dmgType) $damageType.val(Parser.dmgTypeToFull(weapon.dmgType).toLowerCase());
				if (weapon.range) $range.val(weapon.range);
				if (weapon.property) $properties.val(weapon.property.map(p => Parser.itemPropertyToFull(p)).join(", "));
				const attackBonusVal = this._parseBonus(weapon.bonusWeapon) + this._parseBonus(weapon.bonusWeaponAttack);
				const damageBonusVal = this._parseBonus(weapon.bonusWeapon) + this._parseBonus(weapon.bonusWeaponDamage);
				$bonus.val(attackBonusVal);
				$damageBonus.val(damageBonusVal);
				if ($inventorySelect.length) $inventorySelect.val("");
			}
		});

		// Footer buttons
		const $footer = $(`
			<div class="charsheet__attack-footer">
				<button class="charsheet__attack-btn charsheet__attack-btn--cancel">Cancel</button>
				<button class="charsheet__attack-btn charsheet__attack-btn--save">${isEdit ? "💾 Save Changes" : "➕ Add Attack"}</button>
			</div>
		`).appendTo($content);

		$footer.find(".charsheet__attack-btn--cancel").on("click", () => doClose(false));
		$footer.find(".charsheet__attack-btn--save").on("click", () => {
			const newAttack = {
				id: existingAttack?.id || CryptUtil.uid(),
				name: $name.val().trim(),
				isMelee: $type.val() === "melee",
				abilityMod: $ability.val(),
				attackBonus: parseInt($bonus.val()) || 0,
				range: $range.val().trim(),
				damage: $damage.val().trim(),
				damageType: $damageType.val(),
				damageBonus: parseInt($damageBonus.val()) || 0,
				properties: $properties.val().split(",").map(p => p.trim()).filter(Boolean),
			};

			if (!newAttack.name) {
				JqueryUtil.doToast({type: "warning", content: "Please enter an attack name."});
				return;
			}

			if (isEdit) {
				this._state.updateAttack(newAttack);
			} else {
				this._state.addAttack(newAttack);
			}

			doClose(true);
			this.renderAttacks();
			this._page.saveCharacter();
		});

		// Focus name field
		setTimeout(() => $name.focus(), 100);
	}

	_getDamageTypeEmoji (type) {
		const emojis = {
			bludgeoning: "🔨",
			piercing: "🗡️",
			slashing: "⚔️",
			fire: "🔥",
			cold: "❄️",
			lightning: "⚡",
			thunder: "💥",
			poison: "☠️",
			acid: "🧪",
			necrotic: "💀",
			radiant: "✨",
			force: "💫",
			psychic: "🧠",
		};
		return emojis[type] || "⚔️";
	}

	async _editAttack (attackId) {
		// Check if it's an auto-generated attack from equipped weapon
		if (attackId?.startsWith?.("auto_")) {
			// Extract the weapon ID from the attack ID (format: auto_weaponId)
			const weaponId = attackId.substring(5); // Remove "auto_" prefix
			const weapon = this._state.getInventory().find(item => item.id === weaponId);

			if (!weapon) {
				JqueryUtil.doToast({type: "warning", content: "Weapon not found in inventory."});
				return;
			}

			// Open the full attack edit modal for the weapon (same as unarmed strike)
			await this._pShowWeaponAttackModal(weapon);
			return;
		}

		const attacks = this._state.getAttacks();
		const attack = attacks.find(a => a.id === attackId);
		if (!attack) {
			console.warn("[Combat] Attack not found:", attackId);
			return;
		}

		await this._pShowAttackModal(attack);
	}

	/**
	 * Show a full attack edit modal for a weapon - same fields as unarmed strike / manual attacks
	 * Changes are stored as overrides on the weapon item in inventory
	 */
	async _pShowWeaponAttackModal (weapon) {
		// Build the current attack stats from weapon data + any existing overrides
		const isRanged = weapon.property?.some(p => p.includes?.("A") || String(p).toLowerCase().includes("ammunition")) || weapon.range;
		const hasFinesse = weapon.property?.some(p => p.includes?.("F") || String(p).toLowerCase().includes("finesse"));

		// Get weapon's base stats with overrides
		const overrides = weapon.attackOverrides || {};
		const magicBonus = (weapon.bonusWeapon || 0) + (weapon.bonusWeaponAttack || 0);
		const magicDmgBonus = (weapon.bonusWeapon || 0) + (weapon.bonusWeaponDamage || 0);

		const attack = {
			name: overrides.name ?? weapon.name,
			attackBonus: overrides.attackBonus ?? (weapon.customAttackBonus || 0),
			damage: overrides.damage ?? weapon.dmg1 ?? "1d6",
			damageType: overrides.damageType ?? (weapon.dmgType ? Parser.dmgTypeToFull(weapon.dmgType).toLowerCase() : "slashing"),
			damageBonus: overrides.damageBonus ?? (weapon.customDamageBonus || 0),
			range: overrides.range ?? (weapon.range || ""),
			properties: overrides.properties ?? (weapon.property?.map(p => this._formatProperty(p)) || []),
			isMelee: overrides.isMelee ?? !isRanged,
			abilityMod: overrides.abilityMod ?? (isRanged ? "dex" : (hasFinesse ? "dex" : "str")),
		};

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: `⚔️ Edit ${weapon.name}`,
			isMinHeight0: true,
			cbClose: () => {
				$(document).off("click.attackModalQuickSelect");
			},
		});

		$modalInner.addClass("charsheet__attack-modal");

		const $content = $(`<div class="charsheet__attack-form"></div>`).appendTo($modalInner);

		// Info about magic item bonuses
		if (magicBonus > 0 || magicDmgBonus > 0) {
			$content.append($(`
				<div class="ve-small ve-muted mb-2 p-2 rounded" style="background: var(--cs-bg-surface, #1e293b);">
					<strong>Magic Item Bonuses (auto-applied):</strong> 
					${magicBonus > 0 ? `+${magicBonus} to hit` : ""}
					${magicBonus > 0 && magicDmgBonus > 0 ? ", " : ""}
					${magicDmgBonus > 0 ? `+${magicDmgBonus} damage` : ""}
				</div>
			`));
		}

		// Main Info Section
		const $mainSection = $(`
			<div class="charsheet__attack-section">
				<div class="charsheet__attack-section-header">
					<span class="charsheet__attack-section-icon">📋</span>
					<span class="charsheet__attack-section-title">Basic Information</span>
				</div>
				<div class="charsheet__attack-field">
					<label class="charsheet__attack-label">Attack Name</label>
					<input type="text" class="charsheet__attack-input charsheet__attack-input--name" value="${attack.name}" placeholder="e.g., Longsword">
				</div>
				<div class="charsheet__attack-field-row">
					<div class="charsheet__attack-field">
						<label class="charsheet__attack-label">Type</label>
						<select class="charsheet__attack-select charsheet__attack-select--type">
							<option value="melee" ${attack.isMelee ? "selected" : ""}>⚔️ Melee</option>
							<option value="ranged" ${!attack.isMelee ? "selected" : ""}>🏹 Ranged</option>
						</select>
					</div>
					<div class="charsheet__attack-field">
						<label class="charsheet__attack-label">Ability</label>
						<select class="charsheet__attack-select charsheet__attack-select--ability">
							${Parser.ABIL_ABVS.map(a => `<option value="${a}" ${attack.abilityMod === a ? "selected" : ""}>${Parser.attAbvToFull(a)} (${a.toUpperCase()})</option>`).join("")}
						</select>
					</div>
					<div class="charsheet__attack-field">
						<label class="charsheet__attack-label">Range</label>
						<input type="text" class="charsheet__attack-input charsheet__attack-input--range" value="${attack.range || ""}" placeholder="5 ft. or 30/120 ft.">
					</div>
				</div>
			</div>
		`).appendTo($content);

		// Combat Stats Section
		const $combatSection = $(`
			<div class="charsheet__attack-section">
				<div class="charsheet__attack-section-header">
					<span class="charsheet__attack-section-icon">🎯</span>
					<span class="charsheet__attack-section-title">Combat Statistics</span>
				</div>
				<div class="charsheet__attack-field-row">
					<div class="charsheet__attack-field">
						<label class="charsheet__attack-label">Attack Bonus</label>
						<div class="charsheet__attack-number-input">
							<button class="charsheet__attack-number-btn charsheet__attack-number-btn--minus" data-field="bonus">−</button>
							<input type="number" class="charsheet__attack-input charsheet__attack-input--bonus" value="${attack.attackBonus}">
							<button class="charsheet__attack-number-btn charsheet__attack-number-btn--plus" data-field="bonus">+</button>
						</div>
						<div class="ve-small ve-muted">Custom bonus (${magicBonus > 0 ? `+${magicBonus} magic added auto` : "no magic bonus"})</div>
					</div>
					<div class="charsheet__attack-field">
						<label class="charsheet__attack-label">Damage Dice</label>
						<input type="text" class="charsheet__attack-input charsheet__attack-input--damage" value="${attack.damage}" placeholder="1d8, 2d6, etc.">
					</div>
					<div class="charsheet__attack-field">
						<label class="charsheet__attack-label">Damage Type</label>
						<select class="charsheet__attack-select charsheet__attack-select--dmgtype">
							${["bludgeoning", "piercing", "slashing", "fire", "cold", "lightning", "thunder", "poison", "acid", "necrotic", "radiant", "force", "psychic"].map(t =>
		`<option value="${t}" ${attack.damageType === t ? "selected" : ""}>${this._getDamageTypeEmoji(t)} ${t.toTitleCase()}</option>`,
	).join("")}
						</select>
					</div>
					<div class="charsheet__attack-field">
						<label class="charsheet__attack-label">Damage Bonus</label>
						<div class="charsheet__attack-number-input">
							<button class="charsheet__attack-number-btn charsheet__attack-number-btn--minus" data-field="dmgbonus">−</button>
							<input type="number" class="charsheet__attack-input charsheet__attack-input--dmgbonus" value="${attack.damageBonus}">
							<button class="charsheet__attack-number-btn charsheet__attack-number-btn--plus" data-field="dmgbonus">+</button>
						</div>
						<div class="ve-small ve-muted">Custom bonus (${magicDmgBonus > 0 ? `+${magicDmgBonus} magic added auto` : "no magic bonus"})</div>
					</div>
				</div>
			</div>
		`).appendTo($content);

		// Properties Section
		const $propsSection = $(`
			<div class="charsheet__attack-section">
				<div class="charsheet__attack-section-header">
					<span class="charsheet__attack-section-icon">✨</span>
					<span class="charsheet__attack-section-title">Properties</span>
				</div>
				<div class="charsheet__attack-field">
					<label class="charsheet__attack-label">Weapon Properties</label>
					<input type="text" class="charsheet__attack-input charsheet__attack-input--properties" value="${(attack.properties || []).join(", ")}" placeholder="e.g., versatile, finesse, light, two-handed">
					<div class="charsheet__attack-properties-hint">Common: finesse, light, heavy, reach, thrown, two-handed, versatile</div>
				</div>
			</div>
		`).appendTo($content);

		// Get form elements
		const $name = $content.find(".charsheet__attack-input--name");
		const $type = $content.find(".charsheet__attack-select--type");
		const $ability = $content.find(".charsheet__attack-select--ability");
		const $range = $content.find(".charsheet__attack-input--range");
		const $bonus = $content.find(".charsheet__attack-input--bonus");
		const $damage = $content.find(".charsheet__attack-input--damage");
		const $damageType = $content.find(".charsheet__attack-select--dmgtype");
		const $damageBonus = $content.find(".charsheet__attack-input--dmgbonus");
		const $properties = $content.find(".charsheet__attack-input--properties");

		// Number input +/- buttons
		$content.find(".charsheet__attack-number-btn").on("click", function () {
			const field = $(this).data("field");
			const $input = field === "bonus" ? $bonus : $damageBonus;
			const delta = $(this).hasClass("charsheet__attack-number-btn--plus") ? 1 : -1;
			$input.val(parseInt($input.val() || 0) + delta);
		});

		// Footer buttons
		const $footer = $(`
			<div class="charsheet__attack-footer">
				<button class="charsheet__attack-btn charsheet__attack-btn--reset" title="Reset to weapon defaults">🔄 Reset</button>
				<button class="charsheet__attack-btn charsheet__attack-btn--cancel">Cancel</button>
				<button class="charsheet__attack-btn charsheet__attack-btn--save">💾 Save Changes</button>
			</div>
		`).appendTo($content);

		// Reset button - clear all overrides
		$footer.find(".charsheet__attack-btn--reset").on("click", () => {
			delete weapon.attackOverrides;
			delete weapon.customAttackBonus;
			delete weapon.customDamageBonus;
			this.renderAttacks();
			this._page._inventory?.render?.();
			this._page._saveCurrentCharacter?.();
			JqueryUtil.doToast({type: "success", content: `Reset ${weapon.name} to default stats.`});
			doClose(true);
		});

		$footer.find(".charsheet__attack-btn--cancel").on("click", () => doClose(false));
		$footer.find(".charsheet__attack-btn--save").on("click", () => {
			// Save overrides to the weapon item
			weapon.attackOverrides = {
				name: $name.val().trim(),
				isMelee: $type.val() === "melee",
				abilityMod: $ability.val(),
				range: $range.val().trim(),
				damage: $damage.val().trim(),
				damageType: $damageType.val(),
				properties: $properties.val().split(",").map(p => p.trim()).filter(Boolean),
			};
			// Also update legacy custom bonus fields for backward compatibility
			weapon.customAttackBonus = parseInt($bonus.val()) || 0;
			weapon.customDamageBonus = parseInt($damageBonus.val()) || 0;

			this.renderAttacks();
			this._page._inventory?.render?.();
			this._page._saveCurrentCharacter?.();

			JqueryUtil.doToast({type: "success", content: `Updated ${weapon.name}.`});
			doClose(true);
		});

		// Focus name field
		setTimeout(() => $name.focus(), 100);
	}

	/**
	 * Show a modal to edit weapon bonuses (attack bonus, damage bonus)
	 * This is for equipped weapons - we store custom bonuses on the inventory item
	 * @deprecated Use _pShowWeaponAttackModal instead for full editing
	 */
	async _pShowWeaponBonusModal (weapon) {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: `⚔️ Edit ${weapon.name} Bonuses`,
			isMinHeight0: true,
		});

		// Get current custom bonuses (these are player-added bonuses, separate from magic item bonuses)
		const customAttackBonus = weapon.customAttackBonus || 0;
		const customDamageBonus = weapon.customDamageBonus || 0;

		// Show the weapon's base stats and allow editing bonuses
		const magicBonus = (weapon.bonusWeapon || 0) + (weapon.bonusWeaponAttack || 0);
		const magicDmgBonus = (weapon.bonusWeapon || 0) + (weapon.bonusWeaponDamage || 0);

		const $content = $(`
			<div class="charsheet__weapon-bonus-modal">
				<div class="ve-small ve-muted mb-3">
					Edit custom bonuses for this weapon. Magic item bonuses (${magicBonus > 0 ? `+${magicBonus}` : "none"}) are applied automatically.
				</div>
				
				<div class="charsheet__attack-section">
					<div class="charsheet__attack-section-header">
						<span class="charsheet__attack-section-icon">📋</span>
						<span class="charsheet__attack-section-title">Weapon Info</span>
					</div>
					<div class="ve-flex gap-3 mb-2">
						<div><strong>Damage:</strong> ${weapon.dmg1 || "1d4"} ${weapon.dmgType || ""}</div>
						${weapon.property?.length ? `<div><strong>Properties:</strong> ${weapon.property.map(p => this._formatProperty(p)).join(", ")}</div>` : ""}
					</div>
				</div>

				<div class="charsheet__attack-section">
					<div class="charsheet__attack-section-header">
						<span class="charsheet__attack-section-icon">🎯</span>
						<span class="charsheet__attack-section-title">Custom Bonuses</span>
					</div>
					<div class="charsheet__attack-field-row">
						<div class="charsheet__attack-field">
							<label class="charsheet__attack-label">Attack Bonus</label>
							<div class="charsheet__attack-number-input">
								<button class="charsheet__attack-number-btn charsheet__attack-number-btn--minus" data-field="attack">−</button>
								<input type="number" class="charsheet__attack-input charsheet__weapon-bonus-attack" value="${customAttackBonus}">
								<button class="charsheet__attack-number-btn charsheet__attack-number-btn--plus" data-field="attack">+</button>
							</div>
							<div class="ve-small ve-muted">Added to attack rolls</div>
						</div>
						<div class="charsheet__attack-field">
							<label class="charsheet__attack-label">Damage Bonus</label>
							<div class="charsheet__attack-number-input">
								<button class="charsheet__attack-number-btn charsheet__attack-number-btn--minus" data-field="damage">−</button>
								<input type="number" class="charsheet__attack-input charsheet__weapon-bonus-damage" value="${customDamageBonus}">
								<button class="charsheet__attack-number-btn charsheet__attack-number-btn--plus" data-field="damage">+</button>
							</div>
							<div class="ve-small ve-muted">Added to damage rolls</div>
						</div>
					</div>
				</div>
			</div>
		`).appendTo($modalInner);

		// Number input buttons
		$content.find(".charsheet__attack-number-btn").on("click", (e) => {
			const $btn = $(e.currentTarget);
			const field = $btn.data("field");
			const isMinus = $btn.hasClass("charsheet__attack-number-btn--minus");
			const $input = field === "attack"
				? $content.find(".charsheet__weapon-bonus-attack")
				: $content.find(".charsheet__weapon-bonus-damage");
			const current = parseInt($input.val()) || 0;
			$input.val(current + (isMinus ? -1 : 1));
		});

		// Buttons
		const $buttons = $(`
			<div class="ve-flex-v-center ve-flex-h-right mt-3 gap-2">
				<button class="ve-btn ve-btn-default">Cancel</button>
				<button class="ve-btn ve-btn-primary">Save</button>
			</div>
		`).appendTo($modalInner);

		$buttons.find(".ve-btn-default").on("click", () => doClose(false));
		$buttons.find(".ve-btn-primary").on("click", () => {
			// Save the custom bonuses to the weapon in inventory
			weapon.customAttackBonus = parseInt($content.find(".charsheet__weapon-bonus-attack").val()) || 0;
			weapon.customDamageBonus = parseInt($content.find(".charsheet__weapon-bonus-damage").val()) || 0;

			// Re-render attacks and save
			this.renderAttacks();
			this._page._inventory?.render?.();
			this._page._saveCurrentCharacter?.();

			JqueryUtil.doToast({type: "success", content: `Updated bonuses for ${weapon.name}.`});
			doClose(true);
		});
	}

	_removeAttack (attackId) {
		// Check if it's an auto-generated attack from equipped weapon
		if (attackId?.startsWith?.("auto_")) {
			// Extract the weapon ID and unequip it
			const weaponId = attackId.substring(5);
			const weapon = this._state.getInventory().find(item => item.id === weaponId);
			if (weapon) {
				weapon.equipped = false;
				this._page._inventory?.renderInventory?.();
				this.renderAttacks();
				this._page._saveCurrentCharacter?.();
				JqueryUtil.doToast({type: "success", content: `Unequipped ${weapon.name}.`});
			}
			return;
		}

		this._state.removeAttack(attackId);
		this.renderAttacks();
		this._page.saveCharacter();
	}

	_rollAttack (attackId, event) {
		const attacks = this._state.getAttacks();
		let attack = attacks.find(a => a.id === attackId);
		if (!attack && this._cachedAttacks?.length) {
			attack = this._cachedAttacks.find(a => a.id === attackId);
		}
		if (!attack) return;

		// Determine attack type for advantage/disadvantage matching
		const isMelee = attack.isMelee || attack.type === "melee" || attack.range === "melee"
			|| (attack.range && !attack.range.includes("/"));
		const abilityUsed = attack.abilityMod || (isMelee ? "str" : "dex");
		const attackType = `attack:${isMelee ? "melee" : "ranged"}:${abilityUsed}`;

		// Check for advantage/disadvantage from active states and conditions
		let stateMode;
		const hasAdvantage = this._state.hasAdvantageFromStates?.(attackType)
			|| this._state.hasAdvantageFromStates?.("attack");
		const hasDisadvantage = this._state.hasDisadvantageFromStates?.(attackType)
			|| this._state.hasDisadvantageFromStates?.("attack");
		if (hasAdvantage && !hasDisadvantage) stateMode = "advantage";
		else if (hasDisadvantage && !hasAdvantage) stateMode = "disadvantage";

		// Calculate total attack bonus
		const abilityMod = this._state.getAbilityMod(attack.abilityMod || "str");
		const profBonus = this._state.getProficiencyBonus();

		// Get attack modifiers from named modifiers (from features like Battle Tactics, magic items, etc.)
		const attackModifiers = this._state.getNamedModifiersByType("attack");
		const featureAttackBonus = attackModifiers.reduce((sum, mod) => sum + (mod.value || 0), 0);

		// Get bonus from active states (activated abilities like combat stances)
		const stateAttackBonus = this._state.getBonusFromStates?.("attack") || 0;

		const totalBonus = abilityMod + profBonus + (attack.attackBonus || 0) + featureAttackBonus + stateAttackBonus;

		// Roll d20 with advantage/disadvantage support (state mode can be overridden by shift/ctrl keys)
		const rollResult = this._page.rollD20({event, mode: stateMode});
		const total = rollResult.roll + totalBonus;

		// Check for crit/fumble
		let resultClass = "";
		let resultNote = "";
		if (rollResult.roll === 20) {
			resultClass = "charsheet__dice-result-total--crit";
			resultNote = "Critical Hit!";
		} else if (rollResult.roll === 1) {
			resultClass = "charsheet__dice-result-total--fumble";
			resultNote = "Critical Miss!";
		}

		// Build state effect label for display
		const stateEffectLabel = this._getStateEffectLabel(hasAdvantage, hasDisadvantage);

		// Show result
		const modeLabel = this._page.getModeLabel(rollResult.mode);
		this._page.showDiceResult({
			title: `${attack.name} Attack${modeLabel}${stateEffectLabel}`,
			roll: rollResult.roll,
			modifier: totalBonus,
			total,
			resultClass,
			resultNote,
			subtitle: this._page.formatD20Breakdown(rollResult, totalBonus),
		});
	}

	/**
	 * Get label showing state effects on roll
	 */
	_getStateEffectLabel (hasAdvantage, hasDisadvantage) {
		if (hasAdvantage && hasDisadvantage) return " (adv+disadv cancel)";
		if (hasAdvantage) return " (from states)";
		if (hasDisadvantage) return " (from states)";
		return "";
	}

	_rollDamage (attackId, isCrit = false) {
		const attacks = this._state.getAttacks();
		let attack = attacks.find(a => a.id === attackId);
		if (!attack && this._cachedAttacks?.length) {
			attack = this._cachedAttacks.find(a => a.id === attackId);
		}
		if (!attack || !attack.damage) return;

		// Parse damage dice
		const damageRoll = this._parseDamage(attack.damage, isCrit);
		const abilityMod = this._state.getAbilityMod(attack.abilityMod || "str");

		// Get damage modifiers from named modifiers (from features, magic items, etc.)
		const damageModifiers = this._state.getNamedModifiersByType("damage");
		const featureDamageBonus = damageModifiers.reduce((sum, mod) => sum + (mod.value || 0), 0);

		// Get bonus from active states (activated abilities)
		const stateDamageBonus = this._state.getBonusFromStates?.("damage") || 0;

		// Check if attack uses strength and if rage is active (for rage damage)
		let rageBonus = 0;
		const isMeleeStrengthAttack = (attack.abilityMod === "str" || !attack.abilityMod)
			&& !attack.isRanged && !attack.isSpell;
		if (this._state.isStateTypeActive?.("rage")) {
			rageBonus = this._state.getRageDamageBonus?.(
				!attack.isRanged && !attack.isSpell, // isMelee
				attack.abilityMod || "str",
			) || 0;
		}

		const totalBonus = abilityMod + (attack.damageBonus || 0) + featureDamageBonus + rageBonus + stateDamageBonus;

		const total = damageRoll.total + totalBonus;

		// Build subtitle with breakdown
		let subtitle = `${attack.damage}${isCrit ? " (crit)" : ""} + ${abilityMod} (${attack.abilityMod || "STR"})`;
		if (attack.damageBonus) subtitle += ` + ${attack.damageBonus} (weapon)`;
		if (featureDamageBonus) subtitle += ` + ${featureDamageBonus} (features)`;
		if (rageBonus) subtitle += ` + ${rageBonus} (rage)`;
		if (stateDamageBonus) subtitle += ` + ${stateDamageBonus} (states)`;
		subtitle += ` ${attack.damageType}`;

		// Show result
		this._page.showDiceResult({
			title: `${attack.name} Damage`,
			roll: damageRoll.total,
			modifier: totalBonus,
			total,
			subtitle,
		});
	}

	_parseDamage (damageStr, isCrit = false) {
		// Parse dice notation like "1d8", "2d6+2", etc.
		const match = damageStr.match(/(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/);
		if (!match) {
			return {total: 0, rolls: []};
		}

		let numDice = parseInt(match[1]);
		const dieSize = parseInt(match[2]);
		const modifier = match[4] ? parseInt(match[4]) * (match[3] === "-" ? -1 : 1) : 0;

		// Double dice on crit
		if (isCrit) numDice *= 2;

		const rolls = [];
		let total = 0;

		for (let i = 0; i < numDice; i++) {
			const roll = this._page.rollDice(1, dieSize);
			rolls.push(roll);
			total += roll;
		}

		total += modifier;

		return {total, rolls, modifier};
	}

	/**
	 * Parse a bonus string like "+1", "+2", "+3" into a number
	 * @param {string|number} bonus - The bonus value (e.g., "+1", "2", or a number)
	 * @returns {number} The parsed bonus as a number
	 */
	_parseBonus (bonus) {
		if (bonus == null) return 0;
		if (typeof bonus === "number") return bonus;
		// Parse strings like "+1", "+2", "-1"
		const parsed = parseInt(bonus.toString().replace(/\s/g, ""), 10);
		return isNaN(parsed) ? 0 : parsed;
	}

	_rollInitiative (event) {
		const mod = this._state.getInitiative();
		const rollResult = this._page.rollD20({event});
		const total = rollResult.roll + mod;

		const modeLabel = this._page.getModeLabel(rollResult.mode);
		this._page.showDiceResult({
			title: `Initiative${modeLabel}`,
			roll: rollResult.roll,
			modifier: mod,
			total,
			subtitle: this._page.formatD20Breakdown(rollResult, mod),
		});

		// Update initiative display
		$("#charsheet-initiative-value").text(total);
	}

	_rollDeathSave (isManualSuccess = null) {
		const deathSaves = this._state.getDeathSaves();

		if (isManualSuccess !== null) {
			// Manual success/failure marking
			if (isManualSuccess) {
				deathSaves.successes = Math.min(3, deathSaves.successes + 1);
			} else {
				deathSaves.failures = Math.min(3, deathSaves.failures + 1);
			}
		} else {
			// Roll death save
			const roll = this._page.rollDice(1, 20);

			if (roll === 20) {
				// Natural 20: regain 1 HP
				this._state.heal(1);
				this._resetDeathSaves();
				JqueryUtil.doToast({type: "success", content: "Natural 20! You regain 1 HP and are stable!"});
				this._page.renderCharacter();
				return;
			} else if (roll === 1) {
				// Natural 1: 2 failures
				deathSaves.failures = Math.min(3, deathSaves.failures + 2);
				this._page.showDiceResult({
					title: "Death Save",
					roll,
					total: roll,
					resultClass: "text-danger",
					resultNote: " (2 Failures!)",
				});
			} else if (roll >= 10) {
				deathSaves.successes = Math.min(3, deathSaves.successes + 1);
				this._page.showDiceResult({
					title: "Death Save",
					roll,
					total: roll,
					resultClass: "text-success",
					resultNote: " (Success)",
				});
			} else {
				deathSaves.failures = Math.min(3, deathSaves.failures + 1);
				this._page.showDiceResult({
					title: "Death Save",
					roll,
					total: roll,
					resultClass: "text-danger",
					resultNote: " (Failure)",
				});
			}
		}

		this._state.setDeathSaves(deathSaves);

		// Check for stabilization or death
		if (deathSaves.successes >= 3) {
			JqueryUtil.doToast({type: "success", content: "You have stabilized!"});
			this._resetDeathSaves();
		} else if (deathSaves.failures >= 3) {
			JqueryUtil.doToast({type: "danger", content: "Your character has died."});
		}

		this.renderDeathSaves();
		this._page.saveCharacter();
	}

	_resetDeathSaves () {
		this._state.setDeathSaves({successes: 0, failures: 0});
		this.renderDeathSaves();
		this._page.saveCharacter();
	}

	// #region Rendering
	renderAttacks () {
		const $container = $("#charsheet-attacks-list, #charsheet-combat-attacks");
		if (!$container.length) return;

		$container.empty();

		// Get configured attacks
		let attacks = this._state.getAttacks();

		// Also add attacks from equipped weapons if not already configured
		const items = this._state.getItems();
		const equippedWeapons = items.filter(i => i.weapon && i.equipped);

		equippedWeapons.forEach(weapon => {
			// Check if we already have an attack for this weapon
			const existingAttack = attacks.find(a => a.name === weapon.name);
			if (!existingAttack) {
				// Get any user overrides for this weapon's attack
				const overrides = weapon.attackOverrides || {};

				// Auto-generate attack from weapon
				const isRanged = weapon.properties?.some(p => p === "A" || p === "T" || p.startsWith("A|") || p.startsWith("T|"));
				const hasFinesse = weapon.properties?.some(p => p === "F" || p.startsWith("F|"));
				const isMonkWeapon = this._state.isMonkWeapon?.(weapon);
				const defaultAbility = isRanged ? "dex" : ((hasFinesse || isMonkWeapon) ? (this._state.getAbilityMod("dex") >= this._state.getAbilityMod("str") ? "dex" : "str") : "str");

				// Calculate total bonuses including magic item bonuses and custom bonuses
				const magicAttackBonus = (weapon.bonusWeapon || 0) + (weapon.bonusWeaponAttack || 0);
				const magicDamageBonus = (weapon.bonusWeapon || 0) + (weapon.bonusWeaponDamage || 0);
				const customAttackBonus = weapon.customAttackBonus || 0;
				const customDamageBonus = weapon.customDamageBonus || 0;

				const autoAttack = {
					id: `auto_${weapon.id}`,
					// Use overrides if present, otherwise use weapon defaults
					name: overrides.name ?? weapon.name,
					isMelee: overrides.isMelee ?? !isRanged,
					abilityMod: overrides.abilityMod ?? defaultAbility,
					attackBonus: magicAttackBonus + customAttackBonus,
					range: overrides.range ?? (weapon.range || (isRanged ? "80/320 ft." : "5 ft.")),
					damage: overrides.damage ?? (weapon.damage || "1d6"),
					damageType: overrides.damageType ?? (weapon.damageType || "slashing"),
					damageBonus: magicDamageBonus + customDamageBonus,
					properties: overrides.properties ?? (weapon.properties || []),
					mastery: weapon.mastery || [],
					isAutoGenerated: true,
					isMonkWeapon: !!isMonkWeapon,
					sourceItem: weapon, // Keep reference for hover
				};
				attacks.push(autoAttack);
			}
		});

		this._cachedAttacks = [...attacks];

		if (!attacks.length) {
			$container.append(`
				<p class="ve-muted text-center">
					No attacks configured. Equip weapons from Inventory or add custom attacks.
					<br>
					<button class="ve-btn ve-btn-primary ve-btn-sm mt-2" id="charsheet-add-attack-empty">
						<span class="glyphicon glyphicon-plus"></span> Add Attack
					</button>
				</p>
			`);

			$("#charsheet-add-attack-empty").on("click", () => this._showAttackCreator());
			return;
		}

		attacks.forEach(attack => {
			const $item = this._renderAttackItem(attack);
			$container.append($item);
		});
	}

	_renderAttackItem (attack) {
		// Calculate ability modifier - handle special cases for natural weapons
		let abilityMod;
		const abilityKey = attack.abilityMod || "str";
		if (abilityKey === "finesse") {
			// Use higher of STR or DEX
			abilityMod = Math.max(this._state.getAbilityMod("str"), this._state.getAbilityMod("dex"));
		} else if (abilityKey === "spellcasting") {
			// Use highest mental stat as approximation for spellcasting ability
			abilityMod = Math.max(
				this._state.getAbilityMod("int"),
				this._state.getAbilityMod("wis"),
				this._state.getAbilityMod("cha"),
			);
		} else {
			abilityMod = this._state.getAbilityMod(abilityKey);
		}

		const profBonus = this._state.getProficiencyBonus();
		const totalAttackBonus = abilityMod + profBonus + (attack.attackBonus || 0);
		const totalDamageBonus = abilityMod + (attack.damageBonus || 0);
		const isAutoGenerated = attack.isAutoGenerated || attack.id?.startsWith?.("auto_");
		const isNaturalWeapon = attack.isNaturalWeapon;

		// Format properties using the same logic as inventory
		const propertyNames = (attack.properties || [])
			.map(p => this._formatProperty(p))
			.filter(Boolean);
		const propertiesHtml = propertyNames.length
			? `<span class="ve-small ve-muted">(${propertyNames.join(", ")})</span>`
			: "";

		// Format mastery
		const masteryNames = (attack.mastery || [])
			.map(m => this._formatMastery(m))
			.filter(Boolean);
		const masteryHtml = masteryNames.length
			? `<span class="ve-small text-info" title="Mastery">⚔ ${masteryNames.join(", ")}</span>`
			: "";

		// Create hoverable name for auto-generated attacks
		let nameHtml;
		if (isAutoGenerated && attack.sourceItem) {
			const item = attack.sourceItem;
			try {
				nameHtml = Renderer.get().render(`{@item ${item.name}|${item.source || "PHB"}}`);
			} catch (e) {
				nameHtml = attack.name;
			}
		} else {
			nameHtml = attack.name;
		}

		// Determine badge type
		let badgeHtml = "";
		if (attack.isUnarmedStrike) {
			if (attack.isMonkWeapon) {
				badgeHtml = " <span class=\"badge badge-warning\" title=\"Monk Unarmed Strike with Martial Arts\">Monk</span>";
			}
			// No badge for regular unarmed strike - it's just normal
		} else if (isNaturalWeapon) {
			badgeHtml = " <span class=\"badge badge-info\" title=\"Natural Weapon from feature\">Natural</span>";
		} else if (isAutoGenerated) {
			badgeHtml = " <span class=\"badge badge-secondary\">Auto</span>";
		}

		return $(`
			<div class="charsheet__attack-item" data-attack-id="${attack.id}">
				<div class="charsheet__attack-info">
					<span class="charsheet__attack-name">${nameHtml}${badgeHtml}</span>
					<span class="charsheet__attack-details">
						${attack.range ? `<span class="ve-muted">${attack.range}</span>` : ""}
						<span class="badge badge-primary">+${totalAttackBonus}</span>
						<span class="badge badge-danger">${attack.damage}${totalDamageBonus >= 0 ? "+" : ""}${totalDamageBonus} ${attack.damageType}</span>
						${propertiesHtml}
						${masteryHtml}
					</span>
				</div>
				<div class="charsheet__attack-actions">
					<button class="ve-btn ve-btn-sm ve-btn-primary charsheet__attack-roll" title="Roll Attack">
						<span class="glyphicon glyphicon-screenshot"></span> Attack
					</button>
					<button class="ve-btn ve-btn-sm ve-btn-danger charsheet__attack-damage" title="Roll Damage">
						<span class="glyphicon glyphicon-fire"></span> Damage
					</button>
					<button class="ve-btn ve-btn-sm ve-btn-default charsheet__attack-edit" title="${isAutoGenerated ? "Edit in Inventory" : "Edit"}">
						<span class="glyphicon glyphicon-pencil"></span>
					</button>
					<button class="ve-btn ve-btn-sm ve-btn-default charsheet__attack-remove" title="${isAutoGenerated ? "Unequip Weapon" : "Remove"}">
						<span class="glyphicon glyphicon-trash"></span>
					</button>
				</div>
			</div>
		`);
	}

	/**
	 * Format a weapon property code to display name
	 * @param {string} prop - Property code like "2H|XPHB" or just "2H"
	 * @returns {string} Formatted property name
	 */
	_formatProperty (prop) {
		// Try using Parser if available
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
		return propMap[code] || code;
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

	renderDeathSaves () {
		const deathSaves = this._state.getDeathSaves();

		// Render success pips
		$(".charsheet__death-save-success .charsheet__death-save-pip").each((i, el) => {
			$(el).toggleClass("filled", i < deathSaves.successes);
		});

		// Render failure pips
		$(".charsheet__death-save-failure .charsheet__death-save-pip").each((i, el) => {
			$(el).toggleClass("filled", i < deathSaves.failures);
		});
	}

	renderCombatSpells () {
		const $container = $("#charsheet-combat-spells");
		if (!$container.length) return;

		$container.empty();

		// Get spell attack and save DC
		const spellAttack = this._state.getSpellAttackBonus?.() || 0;
		const spellDC = this._state.getSpellSaveDc?.() || 10;

		$("#charsheet-combat-spell-attack").text(`+${spellAttack}`);
		$("#charsheet-combat-spell-dc").text(spellDC);

		// Get spells - cantrips and prepared attack spells
		const spells = this._state.getSpells();
		if (!spells.length) {
			$container.append(`<p class="ve-muted text-center">No spells. Add spells from the Spells tab.</p>`);
			return;
		}

		// Filter to combat-relevant spells: cantrips + prepared leveled spells
		const combatSpells = spells.filter(spell => {
			// Always show cantrips
			if (spell.level === 0) return true;
			// Show prepared leveled spells
			return spell.prepared;
		}).sort((a, b) => {
			// Sort by level, then name
			if (a.level !== b.level) return a.level - b.level;
			return a.name.localeCompare(b.name);
		});

		if (!combatSpells.length) {
			$container.append(`<p class="ve-muted text-center">No prepared combat spells. Prepare spells from the Spells tab.</p>`);
			return;
		}

		// Group by level
		const spellsByLevel = {};
		combatSpells.forEach(spell => {
			const level = spell.level === 0 ? "Cantrips" : `Level ${spell.level}`;
			if (!spellsByLevel[level]) spellsByLevel[level] = [];
			spellsByLevel[level].push(spell);
		});

		// Get spell slots for display
		const slots = this._state.getSpellSlots();
		const pactSlots = this._state.getPactSlots();

		// Render each group
		Object.entries(spellsByLevel).forEach(([level, levelSpells]) => {
			const $group = $(`<div class="charsheet__combat-spell-group mb-2"></div>`);

			// Build level header with slot info
			let slotInfo = "";
			if (level !== "Cantrips") {
				const levelNum = parseInt(level.replace("Level ", ""));
				const slotData = slots[levelNum];
				if (slotData && slotData.max > 0) {
					slotInfo = ` <span class="ve-muted">(${slotData.current}/${slotData.max} slots)</span>`;
				}
				// Also show pact slots if character has them and this is the pact slot level
				if (pactSlots && pactSlots.level === levelNum && pactSlots.max > 0) {
					slotInfo += ` <span class="ve-muted" style="color: #9b59b6">(${pactSlots.current}/${pactSlots.max} pact)</span>`;
				}
			}

			$group.append(`<div class="charsheet__combat-spell-level ve-small">${level}${slotInfo}</div>`);

			levelSpells.forEach(spell => {
				const $spell = this._renderCombatSpellItem(spell);
				$group.append($spell);
			});

			$container.append($group);
		});
	}

	_renderCombatSpellItem (spell) {
		const isCantrip = spell.level === 0;
		const spellId = spell.id || `${spell.name}|${spell.source}`;

		// Create hoverable spell name
		let spellLink;
		try {
			spellLink = Renderer.get().render(`{@spell ${spell.name}|${spell.source || "PHB"}}`);
		} catch (e) {
			spellLink = spell.name;
		}

		// Get school full name
		const schoolFull = spell.school ? Parser.spSchoolAbvToFull(spell.school) : "";

		// Use the stored string values from when spell was added
		const castingTime = spell.castingTime || "";
		const range = spell.range || "";
		const duration = spell.duration || "";
		const components = spell.components || "";

		// Build details string - casting time, range, duration, components
		const detailParts = [];
		if (castingTime) detailParts.push(castingTime);
		if (range) detailParts.push(range);
		if (duration) detailParts.push(duration);
		if (components) detailParts.push(components);
		const details = detailParts.join(" · ");

		return $(`
			<div class="charsheet__combat-spell-item" data-spell-id="${spellId}">
				<div class="charsheet__combat-spell-info">
					<div class="charsheet__combat-spell-header">
						<span class="charsheet__combat-spell-name">${spellLink}</span>
						${schoolFull ? `<span class="badge badge-secondary ve-small ml-1">${schoolFull}</span>` : ""}
						${spell.concentration ? `<span class="badge badge-info ve-small ml-1" title="Concentration">C</span>` : ""}
					</div>
					${details ? `<div class="charsheet__combat-spell-details ve-muted ve-small">${details}</div>` : ""}
				</div>
				<button class="ve-btn ve-btn-xs ve-btn-success charsheet__combat-spell-cast" data-spell-id="${spellId}" title="Cast Spell">
					<span class="glyphicon glyphicon-flash"></span> Cast
				</button>
			</div>
		`);
	}

	render () {
		// Always refresh state reference from page at start of render
		this._state = this._page.getState();

		this.renderAttacks();
		this.renderDeathSaves();
		this.renderCombatSpells();
		this.renderCombatMethods();
		this.renderCombatDefenses();
		this.renderCombatConditions();
		this.renderCombatEffects();
		this.renderCombatResources();
		this.renderCombatActions();
		this.renderCombatStates();

		// Render combat stats
		const initiative = this._state.getAbilityMod("dex");
		$("#charsheet-initiative").text(`+${initiative}`);
	}

	/**
	 * Render combat actions - race/class/feat abilities that use action economy
	 * (e.g., Aggressive, Charge, Ram, Breath Weapon, Relentless Endurance, etc.)
	 */
	renderCombatActions () {
		const $container = $("#charsheet-combat-actions");
		const $section = $("#charsheet-combat-actions-section");
		if (!$container.length) return;

		const features = this._state.getFeatures();

		// Filter for combat-relevant features that have action economy
		const combatActions = features.filter(f => {
			if (!f.description) return false;
			const desc = f.description.toLowerCase();
			const nameLower = f.name?.toLowerCase() || "";

			// Skip combat methods (they have their own section)
			if (f.optionalFeatureTypes?.some(ft => /^CTM:\d?[A-Z]{2}$/.test(ft))) return false;

			// Exclude non-combat features explicitly
			const excludePatterns = [
				"suggested characteristics",
				"personality trait",
				"ideal",
				"bond",
				"flaw",
				"equipment",
				"tool proficiency",
				"skill proficiency",
				"languages",
				"starting equipment",
				"proficiencies",
				"background feature",
				"feature:",
				"you gain proficiency",
				"you are proficient",
				"you have proficiency",
				"you can speak",
				"you can read",
				"darkvision",
				"creature type",
				"size",
				"speed",
				"ability score",
			];
			if (excludePatterns.some(pattern => nameLower.includes(pattern) || desc.includes(pattern) && !desc.includes("action"))) {
				// Only exclude if there's no action economy
				if (!/\b(bonus action|as an action|use your action|as a reaction)\b/i.test(desc)) {
					return false;
				}
			}

			// Must have actual action economy to be considered a combat action
			// More strict: require specific action phrasing, not just "you can use"
			const hasActionEconomy = /\b(as a bonus action|bonus action to|as an action|use your action|take the \w+ action|as a reaction|use your reaction)\b/i.test(desc);

			// Check for combat-specific keywords in NAME (not description, too broad)
			const combatKeywords = [
				"aggressive", "charge", "ram", "breath weapon", "relentless",
				"fury of the small", "savage attacks", "hellish rebuke", "healing hands",
				"celestial revelation", "infernal legacy", "fey step", "misty step",
				"stone's endurance", "lucky", "second wind", "action surge",
				"fighting spirit", "cunning action", "patient defense", "step of the wind",
				"flurry of blows", "stunning strike", "deflect missiles", "slow fall",
				"wild shape", "channel divinity", "divine smite", "lay on hands",
				"hex", "hexblade's curse",
				"rage", "reckless attack",
				"bardic inspiration",
				"metamagic",
				"arcane recovery",
			];

			const hasCombatKeyword = combatKeywords.some(kw => nameLower.includes(kw));

			// Include if:
			// 1. Has explicit action economy AND (has uses OR combat keyword in name), OR
			// 2. Has combat keyword in name AND has uses
			const hasLimitedUses = f.uses && f.uses.max > 0;

			return (hasActionEconomy && (hasLimitedUses || hasCombatKeyword))
				   || (hasCombatKeyword && hasLimitedUses);
		});

		// Sort: features with uses first, then by feature type, then by name
		combatActions.sort((a, b) => {
			const aHasUses = a.uses && a.uses.max > 0;
			const bHasUses = b.uses && b.uses.max > 0;
			if (aHasUses && !bHasUses) return -1;
			if (!aHasUses && bHasUses) return 1;

			const typeOrder = ["Species", "Subrace", "Class", "Background", "Other"];
			const aType = typeOrder.indexOf(a.featureType) !== -1 ? typeOrder.indexOf(a.featureType) : 999;
			const bType = typeOrder.indexOf(b.featureType) !== -1 ? typeOrder.indexOf(b.featureType) : 999;
			if (aType !== bType) return aType - bType;

			return (a.name || "").localeCompare(b.name || "");
		});

		// Hide section if no combat actions
		if (!combatActions.length) {
			$section.hide();
			return;
		}

		$section.show();
		$container.empty();

		for (const feature of combatActions) {
			const $action = this._createCombatActionElement(feature);
			$container.append($action);
		}
	}

	/**
	 * Create a combat action element for a feature
	 */
	_createCombatActionElement (feature) {
		const featureId = `${feature.name}-${feature.source || ""}`.replace(/\s+/g, "-").toLowerCase();
		const hasUses = feature.uses && feature.uses.max > 0;

		// Determine action type icon
		const desc = feature.description?.toLowerCase() || "";
		let actionIcon = "⚔️";
		let actionType = "Action";
		if (/bonus action/i.test(desc)) {
			actionIcon = "⚡";
			actionType = "Bonus Action";
		} else if (/reaction/i.test(desc)) {
			actionIcon = "🔄";
			actionType = "Reaction";
		} else if (/no action required|free/i.test(desc)) {
			actionIcon = "✨";
			actionType = "Free";
		}

		// Get feature type badge
		const typeBadge = feature.featureType
			? `<span class="badge badge-${this._getFeatureTypeBadgeClass(feature.featureType)} mr-1 ve-small">${feature.featureType}</span>` : "";

		// Build uses display if applicable
		let usesHtml = "";
		if (hasUses) {
			const rechargeIcon = feature.uses.recharge === "short" ? "☀️"
				: (feature.uses.recharge === "long" ? "🌙" : "");
			usesHtml = `
				<div class="charsheet__combat-action-uses">
					<span class="charsheet__combat-action-uses-label">${feature.uses.current}/${feature.uses.max}</span>
					<span class="charsheet__combat-action-uses-recharge" title="${feature.uses.recharge} rest">${rechargeIcon}</span>
				</div>
			`;
		}

		// Get hover link if possible - try multiple approaches
		let nameHtml = feature.name;
		let hasHoverLink = false;

		if (this._page?.getHoverLink && feature.source) {
			try {
				// Try to get hover link based on feature type
				if (feature.optionalFeatureTypes?.length) {
					nameHtml = this._page.getHoverLink(UrlUtil.PG_OPT_FEATURES, feature.name, feature.source);
					hasHoverLink = true;
				} else if (feature.featureType === "Class" && feature.className) {
					// Class features - use proper page and hash
					const storedClass = this._state.getClasses()?.find(c => c.name?.toLowerCase() === feature.className?.toLowerCase());
					const classSource = feature.classSource || feature.source || storedClass?.source || Parser.SRC_XPHB;

					const hashInput = {
						name: feature.name,
						className: feature.className,
						classSource: classSource,
						level: feature.level || 1,
						source: feature.source || Parser.SRC_XPHB,
					};
					if (feature.subclassName || feature.isSubclassFeature) {
						hashInput.subclassShortName = feature.subclassShortName || feature.subclassName;
						hashInput.subclassSource = feature.subclassSource || storedClass?.subclass?.source || feature.source || Parser.SRC_XPHB;
					}
					const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASS_SUBCLASS_FEATURES](hashInput);
					nameHtml = this._page.getHoverLink(UrlUtil.PG_CLASS_SUBCLASS_FEATURES, feature.name, feature.source, hash);
					hasHoverLink = true;
				}
			} catch {
				// Fallback to plain name
			}
		}

		// If no hover link, show description in a tooltip on click
		const tooltipDesc = this._cleanDescriptionForTooltip(feature.description);

		const $action = $(`
			<div class="charsheet__combat-action-item ${hasHoverLink ? "" : "charsheet__combat-action-clickable"}" 
				data-action-id="${featureId}" 
				${!hasHoverLink ? `title="${tooltipDesc}"` : ""}>
				<div class="charsheet__combat-action-header">
					<span class="charsheet__combat-action-icon" title="${actionType}">${actionIcon}</span>
					<span class="charsheet__combat-action-name">${nameHtml}</span>
					${typeBadge}
				</div>
				<div class="charsheet__combat-action-info">
					${usesHtml}
					${hasUses ? `<button class="ve-btn ve-btn-xs ve-btn-primary charsheet__combat-action-use" data-action-id="${featureId}" title="Use this ability">Use</button>` : ""}
				</div>
			</div>
		`);

		// Add click handler for use button
		if (hasUses) {
			$action.find(".charsheet__combat-action-use").on("click", () => {
				this._useCombatAction(feature);
			});
		}

		return $action;
	}

	/**
	 * Get badge class for feature type
	 */
	_getFeatureTypeBadgeClass (featureType) {
		switch (featureType) {
			case "Species":
			case "Subrace":
				return "info";
			case "Class":
				return "primary";
			case "Background":
				return "secondary";
			default:
				return "light";
		}
	}

	/**
	 * Use a combat action (spend a use if applicable)
	 */
	_useCombatAction (feature) {
		if (!feature.uses || feature.uses.current <= 0) {
			JqueryUtil.doToast({type: "warning", content: `No uses remaining for ${feature.name}!`});
			return;
		}

		// Spend a use
		feature.uses.current--;

		// Update state
		const features = this._state.getFeatures();
		const idx = features.findIndex(f => f.name === feature.name && f.source === feature.source);
		if (idx >= 0) {
			features[idx].uses = feature.uses;
		}

		// Re-render
		this.renderCombatActions();
		this.renderCombatResources();
		this._page._renderFeatures?.();
		this._page._saveCurrentCharacter?.();

		// Toast notification
		const remaining = feature.uses.current;
		JqueryUtil.doToast({
			type: "success",
			content: `Used ${feature.name}! (${remaining}/${feature.uses.max} remaining)`,
		});
	}

	/**
	 * Clean description text for tooltip display
	 */
	_cleanDescriptionForTooltip (description) {
		if (!description) return "";
		// Remove HTML tags and extra whitespace
		return description
			.replace(/<[^>]+>/g, "")
			.replace(/\s+/g, " ")
			.trim()
			.substring(0, 300) + (description.length > 300 ? "..." : "");
	}

	/**
	 * Render active conditions in combat tab
	 */
	renderCombatConditions () {
		const $container = $("#charsheet-combat-conditions");
		if (!$container.length) return;

		// Now returns {name, source} objects
		const conditions = this._state.getConditions?.() || [];

		if (!conditions.length) {
			$container.html(`<div class="ve-muted ve-text-center py-2">No active conditions</div>`);
			return;
		}

		$container.empty();

		for (const condObj of conditions) {
			const conditionName = condObj.name;
			const conditionSource = condObj.source;
			const conditionDef = CharacterSheetState.getConditionEffects(conditionName);

			const icon = conditionDef?.icon || "⚠️";
			const description = conditionDef?.description || conditionName;
			const sourceAbbr = Parser.sourceJsonToAbv(conditionSource);

			// Build tooltip with effects
			let tooltip = `${conditionName} (${sourceAbbr}): ${description}`;
			if (conditionDef?.effects?.length) {
				const effectList = conditionDef.effects.map(e => {
					if (e.type === "advantage") return `• Advantage on ${this._formatEffectTarget(e.target)}`;
					if (e.type === "disadvantage") return `• Disadvantage on ${this._formatEffectTarget(e.target)}`;
					if (e.type === "autoFail") return `• Auto-fail ${this._formatEffectTarget(e.target)}`;
					if (e.type === "setSpeed") return `• Speed set to ${e.value}`;
					if (e.type === "resistance") return `• Resistance to ${e.target}`;
					if (e.type === "bonus") return `• ${e.value >= 0 ? "+" : ""}${e.value} to ${this._formatEffectTarget(e.target)}`;
					if (e.type === "note") return `• ${e.value}`;
					return null;
				}).filter(Boolean);
				if (effectList.length) {
					tooltip += `\n${effectList.join("\n")}`;
				}
			}

			const $condition = $(`
				<div class="charsheet__combat-condition badge badge-warning mr-1 mb-1" 
					title="${tooltip}" data-condition-name="${conditionName}" data-condition-source="${conditionSource}">
					${icon} ${conditionName}
					<span class="charsheet__condition-source-badge">${sourceAbbr}</span>
					<span class="charsheet__condition-remove ml-1" title="Remove condition">&times;</span>
				</div>
			`);

			$condition.find(".charsheet__condition-remove").on("click", (e) => {
				e.stopPropagation();
				// Now passes {name, source} object
				this._state.removeCondition?.({name: conditionName, source: conditionSource});
				this.renderCombatConditions();
				this.renderCombatEffects();
				this.renderCombatDefenses();
				this._page._renderConditions?.();
				this._page._saveCurrentCharacter?.();
				this._page._renderCharacter?.();
			});

			$container.append($condition);
		}
	}

	/**
	 * Render defenses (resistances, immunities, vulnerabilities, condition immunities)
	 */
	renderCombatDefenses () {
		// Get base defenses from character state
		const resistances = this._state.getResistances?.() || [];
		const immunities = this._state.getImmunities?.() || [];
		const vulnerabilities = this._state.getVulnerabilities?.() || [];
		const conditionImmunities = this._state.getConditionImmunities?.() || [];

		// Also get defenses from active states (like Rage giving resistance to B/P/S)
		const activeStateEffects = this._state.getActiveStateEffects?.() || [];
		const stateResistances = activeStateEffects
			.filter(e => e.type === "resistance")
			.map(e => e.target);
		const stateImmunities = activeStateEffects
			.filter(e => e.type === "immunity")
			.map(e => e.target);
		const stateConditionImmunities = activeStateEffects
			.filter(e => e.type === "conditionImmunity")
			.map(e => e.target);

		// Merge and deduplicate
		const allResistances = [...new Set([...resistances, ...stateResistances])];
		const allImmunities = [...new Set([...immunities, ...stateImmunities])];
		const allVulnerabilities = [...new Set([...vulnerabilities])];
		const allConditionImmunities = [...new Set([...conditionImmunities, ...stateConditionImmunities])];

		// Render resistances
		const $resistances = $("#charsheet-resistances");
		if ($resistances.length) {
			if (allResistances.length) {
				$resistances.html(allResistances.map(r => {
					const isFromState = stateResistances.includes(r) && !resistances.includes(r);
					return `<span class="badge ${isFromState ? "badge-warning" : "badge-success"} mr-1" title="${isFromState ? "From active state" : "Base resistance"}">${this._formatDamageType(r)}</span>`;
				}).join(""));
			} else {
				$resistances.html(`<span class="ve-muted">—</span>`);
			}
		}

		// Render immunities (damage)
		const $immunities = $("#charsheet-immunities");
		if ($immunities.length) {
			if (allImmunities.length) {
				$immunities.html(allImmunities.map(i => {
					const isFromState = stateImmunities.includes(i) && !immunities.includes(i);
					return `<span class="badge ${isFromState ? "badge-warning" : "badge-primary"} mr-1" title="${isFromState ? "From active state" : "Base immunity"}">${this._formatDamageType(i)}</span>`;
				}).join(""));
			} else {
				$immunities.html(`<span class="ve-muted">—</span>`);
			}
		}

		// Render vulnerabilities
		const $vulnerabilities = $("#charsheet-vulnerabilities");
		if ($vulnerabilities.length) {
			if (allVulnerabilities.length) {
				$vulnerabilities.html(allVulnerabilities.map(v =>
					`<span class="badge badge-danger mr-1">${this._formatDamageType(v)}</span>`,
				).join(""));
			} else {
				$vulnerabilities.html(`<span class="ve-muted">—</span>`);
			}
		}

		// Add condition immunities section if not exists
		let $condImmunities = $("#charsheet-condition-immunities");
		if (!$condImmunities.length && allConditionImmunities.length) {
			// Add condition immunities row dynamically
			const $defenses = $("#charsheet-combat-defenses");
			if ($defenses.length) {
				$defenses.append(`
					<div class="charsheet__defense-row">
						<span class="charsheet__defense-label">Condition Immunities:</span>
						<span class="charsheet__defense-value" id="charsheet-condition-immunities">—</span>
					</div>
				`);
				$condImmunities = $("#charsheet-condition-immunities");
			}
		}

		if ($condImmunities.length) {
			if (allConditionImmunities.length) {
				$condImmunities.html(allConditionImmunities.map(c => {
					const isFromState = stateConditionImmunities.includes(c) && !conditionImmunities.includes(c);
					return `<span class="badge ${isFromState ? "badge-warning" : "badge-info"} mr-1" title="${isFromState ? "From active state" : "Base immunity"}">${c.charAt(0).toUpperCase() + c.slice(1)}</span>`;
				}).join(""));
			} else {
				$condImmunities.html(`<span class="ve-muted">—</span>`);
			}
		}
	}

	/**
	 * Format damage type for display
	 */
	_formatDamageType (type) {
		if (!type) return "Unknown";
		// Capitalize first letter, handle compound types like "bludgeoning, piercing, and slashing"
		return type.split(/,\s*/).map(t => t.trim().charAt(0).toUpperCase() + t.trim().slice(1)).join(", ");
	}

	/**
	 * Render active combat effects from states, conditions, and features
	 */
	renderCombatEffects () {
		const $container = $("#charsheet-combat-effects");
		if (!$container.length) return;

		const effects = [];

		// Get all active state effects
		const stateEffects = this._state.getActiveStateEffects?.() || [];

		// Get conditions
		const conditions = this._state.getConditions?.() || [];

		// Process advantage/disadvantage effects
		const advantageTypes = new Map(); // rollType -> [sources]
		const disadvantageTypes = new Map();
		const bonusEffects = []; // {target, value, source}
		const otherEffects = []; // misc effects like speed changes

		// Separate effects: "attacksAgainst" means attacks AGAINST you (enemies' rolls)
		// Regular advantage/disadvantage applies to YOUR rolls
		const enemyAdvantageAgainst = new Map(); // Enemies have advantage attacking you
		const enemyDisadvantageAgainst = new Map(); // Enemies have disadvantage attacking you

		for (const effect of stateEffects) {
			const source = effect.stateName || "Active State";

			switch (effect.type) {
				case "advantage":
					// Check if this is "attacks against" (enemy's advantage) vs your own advantage
					if (effect.target?.includes("Against")) {
						if (!enemyAdvantageAgainst.has(effect.target)) enemyAdvantageAgainst.set(effect.target, []);
						enemyAdvantageAgainst.get(effect.target).push(source);
					} else {
						if (!advantageTypes.has(effect.target)) advantageTypes.set(effect.target, []);
						advantageTypes.get(effect.target).push(source);
					}
					break;
				case "disadvantage":
					// Check if this is "attacks against" (enemy's disadvantage) vs your own disadvantage
					if (effect.target?.includes("Against")) {
						if (!enemyDisadvantageAgainst.has(effect.target)) enemyDisadvantageAgainst.set(effect.target, []);
						enemyDisadvantageAgainst.get(effect.target).push(source);
					} else {
						if (!disadvantageTypes.has(effect.target)) disadvantageTypes.set(effect.target, []);
						disadvantageTypes.get(effect.target).push(source);
					}
					break;
				case "bonus":
					if (effect.value) {
						bonusEffects.push({
							target: effect.target,
							value: effect.value,
							source: source,
						});
					}
					break;
				case "speed":
					if (effect.value !== undefined) {
						otherEffects.push({
							icon: "🏃",
							text: `Speed ${effect.value >= 0 ? "+" : ""}${effect.value} ft`,
							source: source,
							type: "speed",
						});
					}
					break;
				case "ac":
					if (effect.value) {
						bonusEffects.push({
							target: "AC",
							value: effect.value,
							source: source,
						});
					}
					break;
				case "attackRoll":
					if (effect.value) {
						bonusEffects.push({
							target: "Attack Rolls",
							value: effect.value,
							source: source,
						});
					}
					break;
				case "damageRoll":
					if (effect.value) {
						bonusEffects.push({
							target: "Damage",
							value: effect.value,
							source: source,
						});
					}
					break;
				case "autoFail":
					otherEffects.push({
						icon: "❌",
						text: `Auto-fail ${this._formatEffectTarget(effect.target)}`,
						source: source,
						type: "negative",
					});
					break;
				case "incapacitated":
					otherEffects.push({
						icon: "💫",
						text: "Incapacitated (can't take actions/reactions)",
						source: source,
						type: "negative",
					});
					break;
				case "speedZero":
					otherEffects.push({
						icon: "🚫",
						text: "Speed is 0",
						source: source,
						type: "negative",
					});
					break;
			}
		}

		// Build HTML
		$container.empty();

		// Advantage section
		if (advantageTypes.size > 0) {
			const $advSection = $(`<div class="charsheet__effect-group mb-2"></div>`);
			$advSection.append(`<div class="ve-small ve-bold text-success mb-1">⬆️ Advantage On:</div>`);
			for (const [target, sources] of advantageTypes) {
				$advSection.append(`
					<div class="charsheet__effect-item badge badge-success mr-1 mb-1" title="From: ${sources.join(", ")}">
						${this._formatEffectTarget(target)}
					</div>
				`);
			}
			$container.append($advSection);
		}

		// Disadvantage section
		if (disadvantageTypes.size > 0) {
			const $disadvSection = $(`<div class="charsheet__effect-group mb-2"></div>`);
			$disadvSection.append(`<div class="ve-small ve-bold text-danger mb-1">⬇️ Disadvantage On:</div>`);
			for (const [target, sources] of disadvantageTypes) {
				$disadvSection.append(`
					<div class="charsheet__effect-item badge badge-danger mr-1 mb-1" title="From: ${sources.join(", ")}">
						${this._formatEffectTarget(target)}
					</div>
				`);
			}
			$container.append($disadvSection);
		}

		// Bonus section
		if (bonusEffects.length > 0) {
			const $bonusSection = $(`<div class="charsheet__effect-group mb-2"></div>`);
			$bonusSection.append(`<div class="ve-small ve-bold text-primary mb-1">📊 Bonuses:</div>`);
			for (const bonus of bonusEffects) {
				const sign = bonus.value >= 0 ? "+" : "";
				$bonusSection.append(`
					<div class="charsheet__effect-item badge badge-primary mr-1 mb-1" title="From: ${bonus.source}">
						${bonus.target} ${sign}${bonus.value}
					</div>
				`);
			}
			$container.append($bonusSection);
		}

		// Other effects (negative effects, speed changes, etc.)
		if (otherEffects.length > 0) {
			const $otherSection = $(`<div class="charsheet__effect-group mb-2"></div>`);
			$otherSection.append(`<div class="ve-small ve-bold text-warning mb-1">⚠️ Other Effects:</div>`);
			for (const effect of otherEffects) {
				const badgeClass = effect.type === "negative" ? "badge-danger" : (effect.type === "speed" ? "badge-info" : "badge-secondary");
				$otherSection.append(`
					<div class="charsheet__effect-item badge ${badgeClass} mr-1 mb-1" title="From: ${effect.source}">
						${effect.icon} ${effect.text}
					</div>
				`);
			}
			$container.append($otherSection);
		}

		// Enemy advantage against you (defensive: they have advantage)
		if (enemyAdvantageAgainst.size > 0) {
			const $enemyAdvSection = $(`<div class="charsheet__effect-group mb-2"></div>`);
			$enemyAdvSection.append(`<div class="ve-small ve-bold text-danger mb-1">⚠️ Enemies Have Advantage On:</div>`);
			for (const [target, sources] of enemyAdvantageAgainst) {
				$enemyAdvSection.append(`
					<div class="charsheet__effect-item badge badge-danger mr-1 mb-1" title="From: ${sources.join(", ")}">
						${this._formatEffectTarget(target)}
					</div>
				`);
			}
			$container.append($enemyAdvSection);
		}

		// Enemy disadvantage against you (defensive: they have disadvantage)
		if (enemyDisadvantageAgainst.size > 0) {
			const $enemyDisadvSection = $(`<div class="charsheet__effect-group mb-2"></div>`);
			$enemyDisadvSection.append(`<div class="ve-small ve-bold text-success mb-1">🛡️ Enemies Have Disadvantage On:</div>`);
			for (const [target, sources] of enemyDisadvantageAgainst) {
				$enemyDisadvSection.append(`
					<div class="charsheet__effect-item badge badge-success mr-1 mb-1" title="From: ${sources.join(", ")}">
						${this._formatEffectTarget(target)}
					</div>
				`);
			}
			$container.append($enemyDisadvSection);
		}

		// If no effects, show placeholder
		if (advantageTypes.size === 0 && disadvantageTypes.size === 0 && bonusEffects.length === 0 && otherEffects.length === 0 && enemyAdvantageAgainst.size === 0 && enemyDisadvantageAgainst.size === 0) {
			$container.html(`<div class="ve-muted ve-text-center py-2">No active effects</div>`);
		}
	}

	/**
	 * Format effect target for display
	 */
	_formatEffectTarget (target) {
		if (!target) return "Unknown";

		const targetLabels = {
			"attack": "Attack Rolls",
			"attackRoll": "Attack Rolls",
			"attacks": "Attack Rolls",
			"attack:melee": "Melee Attacks",
			"attack:ranged": "Ranged Attacks",
			"save": "Saving Throws",
			"saves": "Saving Throws",
			"savingThrow": "Saving Throws",
			"check": "Ability Checks",
			"checks": "Ability Checks",
			"abilityCheck": "Ability Checks",
			"check:str": "STR Checks",
			"check:dex": "DEX Checks",
			"check:con": "CON Checks",
			"check:int": "INT Checks",
			"check:wis": "WIS Checks",
			"check:cha": "CHA Checks",
			"strCheck": "STR Checks",
			"dexCheck": "DEX Checks",
			"conCheck": "CON Checks",
			"intCheck": "INT Checks",
			"wisCheck": "WIS Checks",
			"chaCheck": "CHA Checks",
			"save:str": "STR Saves",
			"save:dex": "DEX Saves",
			"save:con": "CON Saves",
			"save:int": "INT Saves",
			"save:wis": "WIS Saves",
			"save:cha": "CHA Saves",
			"strSave": "STR Saves",
			"dexSave": "DEX Saves",
			"conSave": "CON Saves",
			"intSave": "INT Saves",
			"wisSave": "WIS Saves",
			"chaSave": "CHA Saves",
			"initiative": "Initiative",
			"concentration": "Concentration",
			"deathSave": "Death Saves",
			// "Attacks against" targets
			"attacksAgainst": "Attacks Against You",
			"meleeAttacksAgainst": "Melee Attacks Against You",
			"rangedAttacksAgainst": "Ranged Attacks Against You",
			// Check-specific targets
			"check:sight": "Checks Requiring Sight",
			"check:hearing": "Checks Requiring Hearing",
		};

		return targetLabels[target] || target.charAt(0).toUpperCase() + target.slice(1);
	}

	/**
	 * Render combat resources (quick access in combat tab)
	 * Shows limited-use features relevant to combat (rage, ki, spell slots, etc.)
	 */
	renderCombatResources () {
		const $container = $("#charsheet-combat-resources");
		if (!$container.length) return;

		const resources = this._state.getResources();
		if (!resources?.length) {
			$container.html(`<div class="ve-muted ve-text-center py-2">No combat resources</div>`);
			return;
		}

		// Filter to combat-relevant resources
		const combatResources = resources.filter(r => {
			const name = r.name.toLowerCase();
			// Include combat-relevant resources
			return name.includes("rage")
				|| name.includes("ki")
				|| name.includes("focus")
				|| name.includes("sorcery")
				|| name.includes("superiority")
				|| name.includes("exertion")
				|| name.includes("channel")
				|| name.includes("wild shape")
				|| name.includes("bardic")
				|| name.includes("action surge")
				|| name.includes("second wind")
				|| name.includes("smite")
				|| name.includes("lay on hands")
				|| name.includes("arcane recovery")
				|| name.includes("sneak attack") // Not a resource but might be tracked
				|| r.recharge; // Any resource with recharge is likely combat-relevant
		});

		if (!combatResources.length) {
			$container.html(`<div class="ve-muted ve-text-center py-2">No combat resources</div>`);
			return;
		}

		$container.empty();
		for (const resource of combatResources) {
			// Build pips - filled = available, empty = used
			const $resource = $(`
				<div class="charsheet__combat-resource-item mb-2" data-resource-id="${resource.id}">
					<div class="charsheet__combat-resource-name ve-small font-weight-bold">${resource.name}</div>
					<div class="charsheet__combat-resource-pips">
						${Array.from({length: resource.max}, (_, i) => `
							<span class="charsheet__resource-pip ${i < resource.current ? "" : "used"}" data-pip-index="${i}" title="Click to use/restore"></span>
						`).join("")}
					</div>
					<div class="ve-small ve-muted">${resource.current}/${resource.max}${resource.recharge ? ` (${resource.recharge})` : ""}</div>
				</div>
			`);

			// Click on pips to use/restore
			$resource.find(".charsheet__resource-pip").on("click", (e) => {
				const pipIndex = $(e.currentTarget).data("pip-index");
				const isUsed = $(e.currentTarget).hasClass("used");
				if (isUsed) {
					// Restore one use (pip was empty/used, now fill it)
					this._state.setResourceCurrent(resource.id, resource.current + 1);
				} else {
					// Use one (pip was filled/available, now empty it)
					this._state.setResourceCurrent(resource.id, resource.current - 1);
				}
				this.renderCombatResources();
				// Also update the main resources display
				this._page._renderResources?.();
				this._page._features?._renderResources?.();
			});

			$container.append($resource);
		}
	}

	/**
	 * Render active states in combat tab - includes both active states and available activatable features
	 */
	renderCombatStates () {
		const $container = $("#charsheet-combat-states");
		if (!$container.length) return;

		// Refresh state reference in case called independently (not via render())
		this._state = this._page.getState();

		$container.empty();

		const allStates = this._state?.getActiveStates?.() || [];
		// Filter for only currently active, non-condition states
		const activeStates = allStates.filter(s => s.active && !s.isCondition);

		// Also check for concentration
		const concentration = this._state.getConcentration?.();

		// Get activatable features (same as Overview tab)
		const activatableFeatures = this._state.getActivatableFeatures?.() || [];
		const availableFeatures = activatableFeatures.filter(af => !af.isActive);

		// === Section 1: Currently Active States ===
		const hasActiveStates = activeStates.length > 0 || concentration;

		if (hasActiveStates) {
			const $activeSection = $(`<div class="charsheet__combat-active-section mb-2">
				<div class="ve-small ve-bold text-success mb-1">● Currently Active</div>
			</div>`);

			// Render concentration first if active
			if (concentration) {
				const $conc = $(`
					<div class="charsheet__combat-state-item badge badge-info mr-1 mb-1">
						🔮 ${concentration.spellName || "Concentrating"}
						<span class="charsheet__state-remove ml-1" title="Break Concentration">&times;</span>
					</div>
				`);
				$conc.find(".charsheet__state-remove").on("click", (e) => {
					e.stopPropagation();
					this._state.breakConcentration?.();
					this.renderCombatStates();
					this._page._renderActiveStates?.();
					this._page._saveCurrentCharacter?.();
					this._page._renderCharacter?.();
				});
				$activeSection.append($conc);
			}

			for (const state of activeStates) {
				const stateType = CharacterSheetState.ACTIVE_STATE_TYPES?.[state.stateTypeId];
				const tooltipParts = [];
				if (stateType?.description) tooltipParts.push(stateType.description);
				if (stateType?.effects?.length) {
					const effectsStr = stateType.effects.map(e => e.type && e.target ? `${e.type} → ${e.target}` : e.type || "").filter(Boolean).join("; ");
					if (effectsStr) tooltipParts.push(`Effects: ${effectsStr}`);
				}
				const tooltip = tooltipParts.join("\n");

				// Try to create hoverable name from source feature
				let stateNameHtml = state.name || stateType?.name || state.stateTypeId;
				if (state.sourceFeatureId) {
					const feature = this._state.getFeatures?.().find(f => f.id === state.sourceFeatureId);
					if (feature) {
						stateNameHtml = this._page._getFeatureHoverLink?.(feature) || stateNameHtml;
					}
				}

				// Check if this state can be manually ended
				const isEndable = this._isStateEndable(state, stateType);

				const $state = $(`
					<div class="charsheet__combat-state-item badge ${this._getStateBadgeClass(state.stateTypeId)} mr-1 mb-1" data-state-id="${state.id}" title="${tooltip}">
						${state.icon || stateType?.icon || "⚡"} <span class="charsheet__state-name-link">${stateNameHtml}</span>
						${isEndable ? `<span class="charsheet__state-remove ml-1" title="End">&times;</span>` : ""}
					</div>
				`);

				if (isEndable) {
					$state.find(".charsheet__state-remove").on("click", (e) => {
						e.stopPropagation();
						this._state.deactivateState(state.stateTypeId);
						this.renderCombatStates();
						this.renderCombatDefenses();
						this.renderCombatEffects();
						this._page._renderActiveStates?.();
						this._page._saveCurrentCharacter?.();
						this._page._renderCharacter?.();
					});
				}

				$activeSection.append($state);
			}

			$container.append($activeSection);
		}

		// === Section 2: Available to Activate ===
		if (availableFeatures.length > 0) {
			const $availableSection = $(`<div class="charsheet__combat-available-section">
				<div class="ve-small ve-muted mb-1">Available to Activate</div>
			</div>`);

			availableFeatures.forEach(({feature, activationInfo, resource, stateTypeId}) => {
				const stateType = activationInfo.stateType || CharacterSheetState.ACTIVE_STATE_TYPES[stateTypeId];
				const icon = stateType?.icon || "⚡";
				const resourceCost = resource?.cost || activationInfo.exertionCost || stateType?.resourceCost || 1;
				const hasResourceAvailable = !resource || resource.current >= resourceCost;

				// Get activation action type
				const activationAction = activationInfo.activationAction || stateType?.activationAction;
				const actionLabel = this._getActionLabel(activationAction);

				// Create hoverable feature name link
				const featureNameHtml = this._page._getFeatureHoverLink?.(feature) || feature.name;

				// Build resource info string
				let resourceInfo = "";
				let resourceTooltip = "";
				if (resource) {
					const shortName = this._getShortResourceName(resource.name);
					resourceInfo = `${resource.current}/${resource.max} ${shortName}`;
					resourceTooltip = `Uses ${resourceCost} ${resource.name} (${resource.current}/${resource.max} remaining)`;
				} else if (activationInfo.exertionCost) {
					resourceInfo = `${resourceCost} Exertion`;
					resourceTooltip = `Costs ${resourceCost} Exertion`;
				}

				const $row = $(`
					<div class="charsheet__activatable-row ve-flex-v-center py-1 px-2 mb-1 rounded" 
						style="background: var(--cs-bg-surface, var(--rgb-bg-alt, #1e293b)); font-size: 0.85em;">
						<span class="mr-1">${icon}</span>
						<span class="flex-grow-1 text-truncate charsheet__state-name-link">${featureNameHtml}</span>
						<div class="ve-flex-v-center ml-auto">
							${actionLabel ? `<span class="ve-small ve-muted mr-1">${actionLabel}</span>` : ""}
							${resourceInfo ? `<span class="ve-small ve-muted mr-1" title="${resourceTooltip}">${resourceInfo}</span>` : ""}
							<button class="ve-btn ve-btn-xs ve-btn-success charsheet__activate-btn" 
								${!hasResourceAvailable ? `disabled title="Not enough ${resource?.name || "uses"} remaining"` : ""}>
								Activate
							</button>
						</div>
					</div>
				`);

				$row.find(".charsheet__activate-btn").on("click", () => {
					this._page._activateFeatureState?.(feature, stateTypeId, stateType, resource, resourceCost);
					// Sync both tabs
					this.renderCombatStates();
					this._page._renderActiveStates?.();
				});

				$availableSection.append($row);
			});

			$container.append($availableSection);
		}

		// Show message if nothing to display
		if (!hasActiveStates && availableFeatures.length === 0) {
			$container.html(`<div class="ve-muted ve-text-center py-2">No activatable features</div>`);
		}

		// Set up quick activation buttons
		this._initQuickStateButtons();
	}

	/**
	 * Get action label for activation type
	 */
	_getActionLabel (actionType) {
		switch (actionType) {
			case "bonus": return "🎯";
			case "action": return "⚔️";
			case "reaction": return "↩️";
			case "free": return "✨";
			default: return "";
		}
	}

	/**
	 * Get a shortened version of a resource name for compact display
	 */
	_getShortResourceName (name) {
		if (!name) return "";
		// Common shortenings
		const shortenings = {
			"Bardic Inspiration": "Insp",
			"Channel Divinity": "CD",
			"Wild Shape": "WS",
			"Ki Points": "Ki",
			"Sorcery Points": "SP",
			"Superiority Dice": "SD",
			"Lay on Hands": "LoH",
			"Rage": "Rage",
			"Bladesong": "BS",
		};

		// Check for exact or partial match
		for (const [full, short] of Object.entries(shortenings)) {
			if (name.toLowerCase().includes(full.toLowerCase())) return short;
		}

		// Default: take first word or abbreviate
		const words = name.split(/\s+/);
		if (words.length === 1) return name.length > 8 ? `${name.slice(0, 6)}…` : name;
		// Take initials for multi-word names
		return words.map(w => w[0]).join("").toUpperCase();
	}

	_getStateBadgeClass (typeId) {
		const classes = {
			"rage": "badge-danger",
			"concentration": "badge-info",
			"wildshape": "badge-success",
			"dodge": "badge-primary",
			"defensivestance": "badge-warning",
			"combatStance": "badge-warning",
			"prone": "badge-secondary",
		};
		return classes[typeId] || "badge-secondary";
	}

	/**
	 * Check if a state can be manually ended
	 * Some passive features (like Tough, Unarmored Defense) shouldn't be endable
	 */
	_isStateEndable (state, stateType) {
		// If stateType explicitly says not endable
		if (stateType?.isPassive || stateType?.notEndable) return false;

		// If it has a resource cost, it's definitely endable (activated abilities)
		if (stateType?.resourceCost || stateType?.resourceName) return true;

		// Check source feature to see if it's a passive ability
		if (state.sourceFeatureId) {
			const feature = this._state.getFeatures?.().find(f => f.id === state.sourceFeatureId);
			if (feature) {
				const name = feature.name?.toLowerCase() || "";

				// Passive abilities that shouldn't be endable (truly passive, always-on effects)
				const passivePatterns = [
					/^unarmored defense$/i,
					/^tough$/i,
					/^durable$/i,
					/^observant$/i,
					/^alert$/i,
				];

				if (passivePatterns.some(p => p.test(name))) return false;
			}
		}

		return true;
	}

	_initQuickStateButtons () {
		// Only show Rage button if rage resource exists in parsed data
		const hasRageResource = this._state.getResources?.()?.some(r => r.name.toLowerCase().includes("rage"));
		$("#charsheet-combat-rage").toggle(!!hasRageResource);

		// Show Concentration button if character has spellcasting
		// getSpellSlots returns an object keyed by level, not an array
		const spellSlots = this._state.getSpellSlots?.() || {};
		const hasSpellSlots = Object.values(spellSlots).some(slot => slot?.max > 0);
		const hasSpellcasting = hasSpellSlots || this._state.getSpells?.()?.length > 0;
		$("#charsheet-combat-concentrate").toggle(!!hasSpellcasting);

		// Add hover attributes to Dodge button for action hover tooltip
		try {
			const dodgeHash = UrlUtil.encodeForHash(["Dodge", Parser.SRC_XPHB].join(HASH_LIST_SEP));
			const hoverAttrs = Renderer.hover.getHoverElementAttributes({
				page: UrlUtil.PG_ACTIONS,
				source: Parser.SRC_XPHB,
				hash: dodgeHash,
			});
			// Parse the attributes string and apply them to the button
			const $dodgeBtn = $("#charsheet-combat-dodge");
			const tempEl = document.createElement("div");
			tempEl.innerHTML = `<span ${hoverAttrs}></span>`;
			const span = tempEl.firstChild;
			for (const attr of span.attributes) {
				$dodgeBtn.attr(attr.name, attr.value);
			}
		} catch (e) {
			console.warn("[Combat] Error adding Dodge hover attrs:", e);
		}

		// Rage button
		$("#charsheet-combat-rage").off("click").on("click", () => {
			if (this._state.isStateTypeActive?.("rage")) {
				this._state.deactivateState("rage");
			} else {
				// Check if character has rage resource
				const rageResource = this._state.getResources?.()?.find(r => r.name.toLowerCase().includes("rage"));
				if (rageResource && rageResource.current <= 0) {
					JqueryUtil.doToast({type: "warning", content: "No rage uses remaining!"});
					return;
				}
				this._state.activateState("rage");
				// Spend rage use
				if (rageResource) {
					this._state.setResourceCurrent(rageResource.id, rageResource.current - 1);
					this.renderCombatResources();
				}
			}
			this.renderCombatStates();
			this.renderCombatDefenses(); // Rage gives resistances
			this.renderCombatEffects(); // Rage gives advantage on STR checks/saves
			this._page._renderActiveStates?.();
			this._page._saveCurrentCharacter?.();
			this._page._renderCharacter?.(); // Re-render to apply/remove effects
			this._updateQuickButtonStates();
		});

		// Dodge button
		$("#charsheet-combat-dodge").off("click").on("click", () => {
			if (this._state.isStateTypeActive?.("dodge")) {
				this._state.deactivateState("dodge");
			} else {
				this._state.activateState("dodge");
			}
			this.renderCombatStates();
			this.renderCombatEffects(); // Dodge gives advantage on DEX saves
			this._page._renderActiveStates?.();
			this._page._saveCurrentCharacter?.();
			this._page._renderCharacter?.(); // Re-render to apply/remove effects
			this._updateQuickButtonStates();
		});

		// Concentration button (show modal to enter spell name)
		$("#charsheet-combat-concentrate").off("click").on("click", async () => {
			if (this._state.isConcentrating?.()) {
				const confirmed = await InputUiUtil.pGetUserBoolean({
					title: "Break Concentration?",
					textYes: "Yes, break",
					textNo: "Cancel",
					htmlDescription: `Currently concentrating on: <strong>${this._state.getConcentration?.()?.spellName || "Unknown"}</strong>`,
				});
				if (confirmed) {
					this._state.breakConcentration();
					this.renderCombatStates();
					this._page._renderActiveStates?.();
					this._page._saveCurrentCharacter?.();
					this._page._renderCharacter?.(); // Re-render to remove effects
				}
			} else {
				// Get character's known spells with concentration
				const allSpells = this._state.getSpells() || [];
				console.log("[Combat] All spells for concentration check:", allSpells.map(s => ({name: s.name, concentration: s.concentration, level: s.level})));
				const concentrationSpells = allSpells.filter(spell => {
					// Check the stored concentration boolean property
					// (duration array format won't work for stored spells as duration is stored as string)
					return spell.concentration === true;
				});
				console.log("[Combat] Concentration spells found:", concentrationSpells.length, concentrationSpells.map(s => s.name));

				let spellName;
				if (concentrationSpells.length > 0) {
					// Build choice values - spell names plus a custom option
					const values = concentrationSpells.map(s => s.name);
					values.push("__OTHER__");

					const result = await InputUiUtil.pGetUserEnum({
						title: "Select Concentration Spell",
						values: values,
						fnDisplay: (val) => {
							if (val === "__OTHER__") return "-- Enter other spell --";
							const spell = concentrationSpells.find(s => s.name === val);
							return spell ? `${spell.name} (Level ${spell.level || 0})` : val;
						},
						isResolveItem: true,
						isAllowNull: true,
					});

					if (result === "__OTHER__") {
						spellName = await InputUiUtil.pGetUserString({title: "Enter spell name"});
					} else {
						spellName = result;
					}
				} else {
					// No concentration spells found, fallback to text input
					spellName = await InputUiUtil.pGetUserString({title: "Concentrating on which spell?"});
				}

				if (spellName) {
					this._state.setConcentration(spellName);
					this.renderCombatStates();
					this._page._renderActiveStates?.();
					this._page._saveCurrentCharacter?.();
					this._page._renderCharacter?.(); // Re-render to apply effects
				}
			}
			this._updateQuickButtonStates();
		});

		// Concentration Save button - roll CON save to maintain concentration
		$("#charsheet-combat-conc-save").off("click").on("click", async () => {
			if (!this._state.isConcentrating?.()) {
				JqueryUtil.doToast({type: "warning", content: "You are not currently concentrating on a spell."});
				return;
			}

			// Ask for damage amount to calculate DC
			const damageStr = await InputUiUtil.pGetUserString({
				title: "Concentration Save",
				default: "0",
				htmlDescription: `
					<p>Enter the damage you took to calculate the DC.</p>
					<p class="ve-muted ve-small">DC = max(10, damage ÷ 2)</p>
				`,
			});

			if (damageStr === null) return;

			const damage = parseInt(damageStr) || 0;
			const dc = Math.max(10, Math.floor(damage / 2));

			// Roll CON save
			const conMod = this._state.getAbilityMod?.("con") || 0;
			const profBonus = this._state.getProficiencyBonus?.() || 0;

			// Check if character has proficiency in CON saves
			const saves = this._state.getSavingThrowProficiencies?.() || [];
			const hasConProf = saves.includes("con") || saves.includes("constitution");

			// Check for War Caster feat (advantage on concentration saves)
			const features = this._state.getFeatures?.() || [];
			const hasWarCaster = features.some(f =>
				f.name?.toLowerCase().includes("war caster")
				|| f.name?.toLowerCase().includes("warcaster"),
			);

			const totalBonus = conMod + (hasConProf ? profBonus : 0);

			// Roll the d20
			const roll1 = this._page.rollDice(1, 20);
			const roll2 = hasWarCaster ? this._page.rollDice(1, 20) : null;
			const roll = hasWarCaster ? Math.max(roll1, roll2) : roll1;
			const total = roll + totalBonus;
			const success = total >= dc;

			// Build result message
			let rollStr = `d20(${roll})`;
			if (hasWarCaster) {
				rollStr = `d20(${roll1}, ${roll2}) = ${roll} (War Caster advantage)`;
			}

			const bonusStr = totalBonus >= 0 ? `+${totalBonus}` : `${totalBonus}`;
			const resultEmoji = success ? "✅" : "❌";
			const resultText = success ? "SUCCESS - Concentration maintained!" : "FAILED - Concentration broken!";

			JqueryUtil.doToast({
				type: success ? "success" : "danger",
				content: `${resultEmoji} Concentration Save vs DC ${dc}: ${rollStr} ${bonusStr} = ${total}. ${resultText}`,
			});

			// If failed, break concentration
			if (!success) {
				this._state.breakConcentration?.();
				this.renderCombatStates();
				this._page._renderActiveStates?.();
				this._page._saveCurrentCharacter?.();
				this._page._renderCharacter?.();
				this._updateQuickButtonStates();
			}
		});

		this._updateQuickButtonStates();
	}

	_updateQuickButtonStates () {
		// Update button active states - toggle both active class and button color
		const rageActive = this._state.isStateTypeActive?.("rage") || false;
		const $rageBtn = $("#charsheet-combat-rage");
		$rageBtn.toggleClass("active", rageActive);
		$rageBtn.toggleClass("ve-btn-warning", rageActive).toggleClass("ve-btn-danger", !rageActive);
		$rageBtn.text(rageActive ? "End Rage" : "Rage");

		const dodgeActive = this._state.isStateTypeActive?.("dodge") || false;
		const $dodgeBtn = $("#charsheet-combat-dodge");
		$dodgeBtn.toggleClass("active", dodgeActive);
		$dodgeBtn.toggleClass("ve-btn-warning", dodgeActive).toggleClass("ve-btn-primary", !dodgeActive);
		$dodgeBtn.text(dodgeActive ? "End Dodge" : "Dodge");

		const concentrating = this._state.isConcentrating?.() || false;
		const $concBtn = $("#charsheet-combat-concentrate");
		$concBtn.toggleClass("active", concentrating);
		$concBtn.toggleClass("ve-btn-info", concentrating).toggleClass("ve-btn-warning", !concentrating);
		if (concentrating) {
			const spellName = this._state.getConcentration?.()?.spellName;
			$concBtn.text(spellName ? `🔮 ${spellName}` : "Concentrating");
		} else {
			$concBtn.text("Concentrate");
		}

		// Show/hide concentration save button based on whether concentrating
		const $concSaveBtn = $("#charsheet-combat-conc-save");
		$concSaveBtn.toggle(concentrating);
	}

	/**
	 * Render Combat Methods section (Thelemar homebrew)
	 */
	renderCombatMethods () {
		// Get combat method features from character
		const features = this._state.getFeatures();
		const combatMethods = features.filter(f => {
			if (f.featureType !== "Optional Feature") return false;
			// Check if it's a combat method (has CTM:X featureType)
			// Format: CTM:XYY where X is optional degree (1-5), YY is tradition code
			return f.optionalFeatureTypes?.some(ft => /^CTM:\d?[A-Z]{2}$/.test(ft));
		});

		// Main page section
		const $section = $("#charsheet-combat-methods-section");
		const $container = $("#charsheet-combat-methods");
		const $dcDisplay = $("#charsheet-method-dc");
		const $exertionDisplay = $("#charsheet-exertion-pool");

		// Combat Tab section
		const $tabSection = $("#charsheet-combat-methods-tab-section");
		const $tabContainer = $("#charsheet-combat-methods-tab");
		const $tabDcDisplay = $("#charsheet-method-dc-tab");

		// Hide sections if no combat methods
		if (combatMethods.length === 0) {
			$section.hide();
			$tabSection.hide();
			return;
		}

		$section.show();
		$tabSection.show();
		$container.empty();
		$tabContainer.empty();

		// Calculate Method DC: 8 + prof + STR or DEX mod (whichever is higher or chosen)
		const profBonus = this._state.getProficiencyBonus();
		const strMod = this._state.getAbilityMod("str");
		const dexMod = this._state.getAbilityMod("dex");
		const methodDC = 8 + profBonus + Math.max(strMod, dexMod);
		$dcDisplay.text(methodDC);
		$tabDcDisplay.text(methodDC);

		// Calculate Exertion Pool: 2 × proficiency bonus
		const exertionMax = profBonus * 2;
		$exertionDisplay.text(exertionMax);

		// Initialize exertion in state if not set
		if (this._state.getExertionMax() !== exertionMax) {
			this._state.setExertionMax(exertionMax);
		}
		if (this._state.getExertionCurrent() === null || this._state.getExertionCurrent() === undefined) {
			this._state.setExertionCurrent(exertionMax);
		}

		// Update exertion display
		this._updateExertionDisplay();

		// Group methods by tradition
		const methodsByTradition = new Map();
		for (const method of combatMethods) {
			const tradCode = this._getMethodTradition(method);
			if (!methodsByTradition.has(tradCode)) {
				methodsByTradition.set(tradCode, []);
			}
			methodsByTradition.get(tradCode).push(method);
		}

		// Render methods grouped by tradition to both containers
		this._renderMethodsToContainer($container, methodsByTradition, {showUseButton: false});
		this._renderMethodsToContainer($tabContainer, methodsByTradition, {showUseButton: true});
	}

	_renderMethodsToContainer ($container, methodsByTradition, {showUseButton = false} = {}) {
		for (const [tradCode, methods] of methodsByTradition) {
			const tradName = this._getTraditionName(tradCode);
			const $tradGroup = $(`
				<div class="charsheet__methods-group mb-2">
					<div class="charsheet__methods-tradition-header ve-small ve-muted mb-1 ve-flex ve-flex-v-center">
						<span class="bold">${tradName}</span>
					</div>
				</div>
			`);

			methods.sort((a, b) => {
				const degreeA = this._getMethodDegree(a);
				const degreeB = this._getMethodDegree(b);
				return degreeA - degreeB || a.name.localeCompare(b.name);
			}).forEach(method => {
				const degree = this._getMethodDegree(method);
				const exertionCost = this._getMethodExertionCost(method);
				const methodId = `${method.name}-${method.source || ""}`.replace(/\s+/g, "-").toLowerCase();

				// Create hoverable link for method name (like spells/weapons)
				let methodNameHtml = method.name;
				if (this._page?.getHoverLink && method.source) {
					try {
						methodNameHtml = this._page.getHoverLink(
							UrlUtil.PG_OPT_FEATURES,
							method.name,
							method.source,
						);
					} catch (e) {
						methodNameHtml = method.name;
					}
				}

				const $method = $(`
					<div class="charsheet__method-item mb-1 p-1 ve-flex ve-flex-v-center ve-flex-h-space-between" style="border-left: 2px solid var(--rgb-link); padding-left: 0.5rem;">
						<div class="ve-flex ve-flex-v-center">
							<span class="charsheet__method-name" style="font-weight: bold;">${methodNameHtml}</span>
							<span class="ve-muted ve-small ml-2">(${degree}${this._getOrdinalSuffix(degree)})</span>
							${exertionCost > 0 ? `<span class="badge badge-secondary ml-2" title="Exertion cost">${exertionCost} EP</span>` : ""}
						</div>
						${showUseButton ? `<button class="ve-btn ve-btn-xs ve-btn-primary charsheet__method-use ml-2" data-method-id="${methodId}" data-cost="${exertionCost}" title="Use this method (costs ${exertionCost} exertion)">Use</button>` : ""}
					</div>
				`);

				// Store method data for later use
				$method.data("method", method);

				$tradGroup.append($method);
			});

			$container.append($tradGroup);
		}
	}

	_getMethodExertionCost (method) {
		// Try to extract exertion cost from method entries
		// Usually formatted like "Cost: X exertion" or mentions exertion in the text
		if (!method.entries) return 1; // Default cost

		const entriesStr = JSON.stringify(method.entries).toLowerCase();

		// Look for patterns like "costs X exertion" or "X exertion points"
		const costMatch = entriesStr.match(/costs?\s+(\d+)\s+exertion/i);
		if (costMatch) return parseInt(costMatch[1]);

		// Also check for degree-based default costs (1st=1, 2nd=2, etc.)
		const degree = this._getMethodDegree(method);
		return degree || 1;
	}

	_useMethod (methodId) {
		const $btn = $(`.charsheet__method-use[data-method-id="${methodId}"]`);
		const cost = parseInt($btn.data("cost")) || 1;
		const currentExertion = this._state.getExertionCurrent();

		if (currentExertion < cost) {
			JqueryUtil.doToast({type: "warning", content: `Not enough exertion! You have ${currentExertion}, but this method costs ${cost}.`});
			return;
		}

		// Get the method data from the parent element
		const method = $btn.closest(".charsheet__method-item").data("method");

		this._state.setExertionCurrent(currentExertion - cost);
		this._updateExertionDisplay();

		// Also update resources section
		if (this._page?._features) {
			this._page._features._renderResources();
		}

		// Activate this method as an active state (combat stance)
		if (method) {
			// Check if this is a stance (typically has duration) vs instant effect
			const isStance = this._isMethodStance(method);

			if (isStance) {
				// Parse effects from description
				const description = method.entries ? JSON.stringify(method.entries) : "";
				const parsedEffects = CharacterSheetState.parseEffectsFromDescription?.(description) || [];

				// Activate as a combat stance state
				this._state.activateState("combatStance", {
					name: method.name,
					icon: "⚔️",
					sourceFeatureId: method.id || methodId,
					description: description,
					customEffects: parsedEffects.length > 0 ? parsedEffects : null,
				});

				this.renderCombatStates();
				this.renderCombatEffects(); // Show stance effects
				this._page._renderActiveStates?.();
				this._page._saveCurrentCharacter?.();
				this._page._renderCharacter?.(); // Re-render character to apply effects

				JqueryUtil.doToast({type: "success", content: `Activated ${method.name}! (−${cost} exertion)`});
			} else {
				// Instant effect - just show feedback
				JqueryUtil.doToast({type: "success", content: `Used ${method.name}! (−${cost} exertion)`});
			}
		} else {
			// Fallback: find method name for feedback
			const methodName = methodId.split("-").slice(0, -1).join(" ").replace(/\b\w/g, c => c.toUpperCase());
			JqueryUtil.doToast({type: "success", content: `Used ${methodName}! (−${cost} exertion)`});
		}

		// Flash the button to indicate use
		$btn.addClass("ve-btn-success");
		setTimeout(() => $btn.removeClass("ve-btn-success"), 200);
	}

	/**
	 * Check if a combat method is a stance (has duration) vs instant effect
	 */
	_isMethodStance (method) {
		// Quick check: if "Stance" is in the name
		if (method.name?.toLowerCase().includes("stance")) return true;

		if (!method.entries) return false;
		const entriesStr = JSON.stringify(method.entries).toLowerCase();

		// Check for duration indicators
		const stanceIndicators = [
			"until the start of your next turn",
			"until the end of your next turn",
			"for 1 minute",
			"for the duration",
			"while this stance",
			"while in this stance",
			"this stance lasts",
			"you enter",
			"you maintain",
			"concentration",
		];

		return stanceIndicators.some(indicator => entriesStr.includes(indicator));
	}

	_modifyExertion (delta) {
		const current = this._state.getExertionCurrent() || 0;
		const max = this._state.getExertionMax() || 0;
		const newValue = Math.max(0, Math.min(max, current + delta));
		this._state.setExertionCurrent(newValue);
		this._updateExertionDisplay();
		// Also update resources section
		if (this._page?._features) {
			this._page._features._renderResources();
		}
	}

	_updateExertionDisplay () {
		const current = this._state.getExertionCurrent() || 0;
		const max = this._state.getExertionMax() || 0;

		$("#charsheet-exertion-current").text(current);
		$("#charsheet-exertion-max").text(max);

		// Color-code based on remaining exertion
		const $display = $("#charsheet-exertion-display-tab");
		$display.removeClass("text-success text-warning text-danger");
		if (current === 0) {
			$display.addClass("text-danger");
		} else if (current <= max / 2) {
			$display.addClass("text-warning");
		} else {
			$display.addClass("text-success");
		}

		// Update resource pips in the resources section
		// Filled = available, empty = used
		const $resourcePips = $("[data-resource-id=\"exertion\"] .charsheet__resource-pip--exertion");
		if ($resourcePips.length) {
			$resourcePips.each((i, pip) => {
				$(pip).toggleClass("used", i >= current); // Empty (used) if index >= current available
			});
		}
	}

	/**
	 * Show the Combat Methods picker modal
	 * Allows adding/removing combat methods from selected traditions
	 */
	async _showMethodPicker () {
		const allOptFeatures = this._page.getOptionalFeatures() || [];

		// Get all combat method optional features
		const allMethods = allOptFeatures.filter(opt =>
			opt.featureType?.some(ft => /^CTM:\d[A-Z]{2}$/.test(ft)),
		);

		if (allMethods.length === 0) {
			JqueryUtil.doToast({type: "warning", content: "No combat methods available. Load the Thelemar homebrew source."});
			return;
		}

		// Get character's selected traditions
		let selectedTraditions = this._getCharacterTraditions();

		// Get currently known methods
		const knownMethods = this._state.getFeatures().filter(f =>
			f.featureType === "Optional Feature"
			&& f.optionalFeatureTypes?.some(ft => /^CTM:\d[A-Z]{2}$/.test(ft)),
		);
		const knownMethodNames = new Set(knownMethods.map(m => `${m.name}|${m.source || ""}`));

		// Get max degree and max methods based on character level
		const maxDegree = this._getCharacterMaxDegree();
		const maxMethods = this._getCharacterMaxMethods();

		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "Combat Methods",
			isMinHeight0: true,
			isWidth100: true,
			isMaxWidth640p: true,
			zIndex: 1500, // Higher z-index to ensure hover popups work
		});

		// Add class for styling and make sure hovers appear above
		$modalInner.addClass("charsheet__method-picker");
		$modalInner.closest(".ui-modal__inner").css("z-index", "1500");

		// Create content container
		const $content = $(`<div class="ve-flex-col h-100"></div>`).appendTo($modalInner);

		// === HEADER: Stats summary ===
		const $header = $(`
			<div class="charsheet__method-picker-header">
				<div class="charsheet__method-picker-header-left">
					<span class="charsheet__method-picker-header-icon">⚔️</span>
					<div>
						<div class="charsheet__method-picker-header-title">Combat Methods</div>
						<div class="charsheet__method-picker-header-stat" style="display: flex; align-items: center; gap: 0.6rem; margin-top: 0.15rem;">
							<span>Max Degree: <span class="charsheet__method-picker-header-stat-value">${maxDegree > 0 ? maxDegree + this._getOrdinalSuffix(maxDegree) : "—"}</span></span>
							<span style="opacity: 0.4;">•</span>
							<span>Traditions: <span class="charsheet__method-picker-header-stat-value" id="method-picker-trad-count">${selectedTraditions.length}</span></span>
						</div>
					</div>
				</div>
				<div class="charsheet__method-picker-header-right">
					<div class="charsheet__method-picker-header-known-row">
						<span class="charsheet__method-picker-header-stat">Known:</span>
						<span class="charsheet__method-picker-header-known" id="method-picker-known-count">${knownMethodNames.size}</span>
						<span class="charsheet__method-picker-header-stat">/ ${maxMethods > 0 ? maxMethods : "∞"}</span>
					</div>
				</div>
			</div>
		`).appendTo($content);

		// === TRADITIONS SECTION ===
		const $tradSection = $(`
			<div class="charsheet__method-picker-trads-section">
				<div class="charsheet__method-picker-trads-header">
					<span class="charsheet__method-picker-trads-title">Your Traditions</span>
					<button class="ve-btn ve-btn-xs ve-btn-default" id="method-picker-toggle-trads" title="Edit traditions">
						<span class="glyphicon glyphicon-pencil"></span> Edit
					</button>
				</div>
				<div id="method-picker-trads-display" class="charsheet__method-picker-trads-display"></div>
				<div id="method-picker-trads-edit" style="display: none;"></div>
			</div>
		`).appendTo($content);

		// Render tradition display (compact pills)
		const $tradsDisplay = $tradSection.find("#method-picker-trads-display");
		const $tradsEdit = $tradSection.find("#method-picker-trads-edit");
		const $toggleBtn = $tradSection.find("#method-picker-toggle-trads");
		let editMode = false;

		const tradIcons = this._getTraditionIcons();

		const renderTradsDisplay = () => {
			$tradsDisplay.empty();
			if (selectedTraditions.length === 0) {
				$tradsDisplay.append(`<span class="charsheet__method-picker-header-stat" style="font-style: italic;">No traditions selected. Click Edit to choose.</span>`);
			} else {
				for (const code of selectedTraditions) {
					$tradsDisplay.append(`
						<span class="charsheet__method-picker-trad-pill">
							<span class="charsheet__method-picker-trad-icon">${tradIcons[code] || "⚔️"}</span>
							${this._getTraditionName(code)}
						</span>
					`);
				}
			}
		};
		renderTradsDisplay();

		// Toggle edit mode
		$toggleBtn.on("click", () => {
			editMode = !editMode;
			$tradsDisplay.toggle(!editMode);
			$tradsEdit.toggle(editMode);
			$toggleBtn.html(editMode
				? "<span class=\"glyphicon glyphicon-ok\"></span> Done"
				: "<span class=\"glyphicon glyphicon-pencil\"></span> Edit",
			);
			if (!editMode) {
				renderTradsDisplay();
				$("#method-picker-trad-count").text(selectedTraditions.length);
				this._renderMethodList($methodList, allMethods, selectedTraditions, maxDegree, knownMethodNames, filterTrad, filterDegree, filterStatus, searchQuery);
			}
		});

		// Render tradition editor
		this._renderTraditionSelection($tradsEdit, selectedTraditions, () => {
			selectedTraditions = this._getSelectedTraditionsFromUI($tradsEdit);
		});

		// === FILTERS SECTION ===
		let filterTrad = "all";
		let filterDegree = "all";
		let filterStatus = "all";
		let searchQuery = "";

		const $filterSection = $(`
			<div class="charsheet__method-picker-filters">
				<div class="charsheet__method-picker-search">
					<input type="text" class="form-control form-control-sm" id="method-picker-search" placeholder="🔍 Search methods...">
				</div>
				<select class="form-control form-control-sm charsheet__method-picker-filter-select" id="method-picker-trad-filter" style="min-width: 130px;">
					<option value="all">All Traditions</option>
				</select>
				<select class="form-control form-control-sm charsheet__method-picker-filter-select" id="method-picker-degree" style="min-width: 100px;">
					<option value="all">All Degrees</option>
					${[1, 2, 3, 4, 5].filter(d => d <= maxDegree).map(d =>
		`<option value="${d}">${d}${this._getOrdinalSuffix(d)} Degree</option>`,
	).join("")}
				</select>
				<select class="form-control form-control-sm charsheet__method-picker-filter-select" id="method-picker-filter" style="min-width: 90px;">
					<option value="all">All</option>
					<option value="known">Known</option>
					<option value="available">Available</option>
				</select>
			</div>
		`).appendTo($content);

		// Populate tradition filter dropdown
		const $tradFilter = $filterSection.find("#method-picker-trad-filter");
		const updateTradFilterOptions = () => {
			$tradFilter.find("option:not(:first)").remove();
			for (const code of selectedTraditions) {
				$tradFilter.append(`<option value="${code}">${tradIcons[code] || "⚔️"} ${this._getTraditionName(code)}</option>`);
			}
		};
		updateTradFilterOptions();

		// === METHOD LIST ===
		const $methodList = $(`
			<div class="charsheet__method-picker-list"></div>
		`).appendTo($content);

		// Initial render
		this._renderMethodList($methodList, allMethods, selectedTraditions, maxDegree, knownMethodNames, filterTrad, filterDegree, filterStatus, searchQuery);

		// Filter event listeners
		$filterSection.find("#method-picker-search").on("input", function () {
			searchQuery = $(this).val().toLowerCase();
			this._renderMethodList($methodList, allMethods, selectedTraditions, maxDegree, knownMethodNames, filterTrad, filterDegree, filterStatus, searchQuery);
		}.bind(this));

		$filterSection.find("#method-picker-trad-filter").on("change", function () {
			filterTrad = $(this).val();
			this._renderMethodList($methodList, allMethods, selectedTraditions, maxDegree, knownMethodNames, filterTrad, filterDegree, filterStatus, searchQuery);
		}.bind(this));

		$filterSection.find("#method-picker-degree").on("change", function () {
			filterDegree = $(this).val();
			this._renderMethodList($methodList, allMethods, selectedTraditions, maxDegree, knownMethodNames, filterTrad, filterDegree, filterStatus, searchQuery);
		}.bind(this));

		$filterSection.find("#method-picker-filter").on("change", function () {
			filterStatus = $(this).val();
			this._renderMethodList($methodList, allMethods, selectedTraditions, maxDegree, knownMethodNames, filterTrad, filterDegree, filterStatus, searchQuery);
		}.bind(this));

		// === FOOTER ===
		const $footer = $(`
			<div class="charsheet__method-picker-footer">
				<span class="charsheet__method-picker-footer-hint">💡 Hover method names for details</span>
				<button class="charsheet__method-picker-footer-btn">Done</button>
			</div>
		`).appendTo($content);

		$footer.find("button").on("click", async () => {
			this._saveSelectedTraditions(selectedTraditions);
			await this._page.saveCharacter();
			this._page.renderCharacter();
			doClose(true);
		});
	}

	/**
	 * Get tradition icons mapping
	 */
	_getTraditionIcons () {
		return {
			"AM": "🏔️",
			"AK": "✨",
			"BU": "🐺",
			"BZ": "💨",
			"CJ": "🎭",
			"EB": "🌑",
			"GH": "💖",
			"MG": "🪞",
			"MS": "🌫️",
			"RC": "🌊",
			"RE": "🗡️",
			"SK": "🩸",
			"SS": "🐎",
			"TI": "⚔️",
			"TC": "🦷",
			"UW": "☯️",
			"UH": "🦅",
		};
	}

	/**
	 * Calculate max methods character can know
	 */
	_getCharacterMaxMethods () {
		// Look for a class with Combat Methods progression
		const classes = this._state.getClasses();
		let maxMethods = 0;

		for (const cls of classes) {
			const classData = this._page.getClasses?.().find(c => c.name === cls.name && c.source === cls.source);
			if (!classData?.optionalfeatureProgression) continue;

			const cmProg = classData.optionalfeatureProgression.find(prog =>
				prog.featureType?.some(ft => ft.startsWith("CTM:")),
			);
			if (!cmProg?.progression) continue;

			// Get methods at current level
			const level = cls.level || 1;
			const levelKey = String(level);
			if (cmProg.progression[levelKey]) {
				maxMethods += cmProg.progression[levelKey];
			} else {
				// Find the highest level <= current level
				const levels = Object.keys(cmProg.progression).map(Number).filter(l => l <= level).sort((a, b) => b - a);
				if (levels.length > 0) {
					maxMethods += cmProg.progression[String(levels[0])];
				}
			}
		}

		return maxMethods;
	}

	/**
	 * Render tradition selection with card-style UI
	 */
	_renderTraditionSelection ($container, selectedTraditions, onChange) {
		$container.empty();
		$container.css({"display": "flex", "flex-wrap": "wrap", "gap": "0.4rem", "padding": "0.5rem", "background": "var(--rgb-bg-alt)", "border-radius": "4px"});

		const allTraditions = [
			{code: "AM", name: "Adamant Mountain"},
			{code: "AK", name: "Arcane Knight"},
			{code: "BU", name: "Beast Unity"},
			{code: "BZ", name: "Biting Zephyr"},
			{code: "CJ", name: "Comedic Jabs"},
			{code: "EB", name: "Eldritch Blackguard"},
			{code: "GH", name: "Gallant Heart"},
			{code: "MG", name: "Mirror's Glint"},
			{code: "MS", name: "Mist and Shade"},
			{code: "RC", name: "Rapid Current"},
			{code: "RE", name: "Razor's Edge"},
			{code: "SK", name: "Sanguine Knot"},
			{code: "SS", name: "Spirited Steed"},
			{code: "TI", name: "Tempered Iron"},
			{code: "TC", name: "Tooth and Claw"},
			{code: "UW", name: "Unending Wheel"},
			{code: "UH", name: "Unerring Hawk"},
		];

		const tradIcons = this._getTraditionIcons();

		for (const trad of allTraditions) {
			const isSelected = selectedTraditions.includes(trad.code);
			const $chip = $(`
				<label class="ve-flex ve-flex-v-center" style="
					cursor: pointer;
					padding: 0.25rem 0.5rem;
					border: 1px solid ${isSelected ? "var(--rgb-link)" : "var(--rgb-border-grey)"};
					border-radius: 4px;
					background: ${isSelected ? "rgba(51,122,183,0.15)" : "transparent"};
					font-size: 0.85rem;
					transition: all 0.15s;
				" data-trad="${trad.code}">
					<input type="checkbox" class="mr-1" style="margin: 0;" ${isSelected ? "checked" : ""}>
					<span>${tradIcons[trad.code] || "⚔️"}</span>
					<span class="ml-1">${trad.name}</span>
				</label>
			`);

			$chip.find("input").on("change", function () {
				const code = $chip.data("trad");
				const checked = $(this).is(":checked");

				if (checked && !selectedTraditions.includes(code)) {
					selectedTraditions.push(code);
				} else if (!checked) {
					const idx = selectedTraditions.indexOf(code);
					if (idx >= 0) selectedTraditions.splice(idx, 1);
				}

				$chip.css({
					"border-color": checked ? "var(--rgb-link)" : "var(--rgb-border-grey)",
					"background": checked ? "rgba(51,122,183,0.15)" : "transparent",
				});
				onChange();
			});

			$container.append($chip);
		}
	}

	/**
	 * Get selected traditions from the UI checkboxes
	 */
	_getSelectedTraditionsFromUI ($container) {
		const selected = [];
		$container.find("input:checked").each(function () {
			selected.push($(this).closest("label").data("trad"));
		});
		return selected;
	}

	/**
	 * Render the method list with filtering and hoverable names
	 */
	_renderMethodList ($container, allMethods, selectedTraditions, maxDegree, knownMethodNames, filterTrad = "all", filterDegree = "all", filterStatus = "all", searchQuery = "") {
		$container.empty();

		// Filter methods
		let filteredMethods = allMethods.filter(method => {
			const tradCode = this._getMethodTraditionFromOptFeature(method);
			const key = `${method.name}|${method.source || ""}`;
			const isKnown = knownMethodNames.has(key);

			// Known methods should always appear (so they can be removed),
			// even if their tradition is no longer selected
			if (!isKnown && !selectedTraditions.includes(tradCode)) return false;

			// Tradition filter (if specific tradition selected in dropdown)
			if (filterTrad !== "all" && tradCode !== filterTrad) return false;

			// Must be within max degree (but known methods are exempt)
			const degree = this._getMethodDegreeFromOptFeature(method);
			if (!isKnown && degree > maxDegree) return false;

			// Search filter
			if (searchQuery && !method.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

			// Degree filter
			if (filterDegree !== "all" && degree !== parseInt(filterDegree)) return false;

			// Status filter
			if (filterStatus === "known" && !isKnown) return false;
			if (filterStatus === "available" && isKnown) return false;

			return true;
		});

		if (selectedTraditions.length === 0) {
			$container.append(`
				<div class="charsheet__method-picker-empty">
					<div class="charsheet__method-picker-empty-icon">📜</div>
					<p class="charsheet__method-picker-empty-text">Select at least one tradition to see available methods.</p>
				</div>
			`);
			return;
		}

		if (filteredMethods.length === 0) {
			$container.append(`
				<div class="charsheet__method-picker-empty">
					<div class="charsheet__method-picker-empty-icon">🔍</div>
					<p class="charsheet__method-picker-empty-text">No methods match the current filters.</p>
				</div>
			`);
			return;
		}

		// Group by tradition and degree
		const methodsByTrad = new Map();
		for (const method of filteredMethods) {
			const tradCode = this._getMethodTraditionFromOptFeature(method);
			if (!methodsByTrad.has(tradCode)) {
				methodsByTrad.set(tradCode, []);
			}
			methodsByTrad.get(tradCode).push(method);
		}

		// Tradition icons mapping
		const tradIcons = {
			"AM": "🏔️",
			"AK": "✨",
			"BU": "🐺",
			"BZ": "💨",
			"CJ": "🎭",
			"EB": "🌑",
			"GH": "💖",
			"MG": "🪞",
			"MS": "🌫️",
			"RC": "🌊",
			"RE": "🗡️",
			"SK": "🩸",
			"SS": "🐎",
			"TI": "⚔️",
			"TC": "🦷",
			"UW": "☯️",
			"UH": "🦅",
		};

		// Get all tradition codes that have methods to show (selected + those with known methods)
		const traditionsToRender = new Set(selectedTraditions);
		for (const [tradCode] of methodsByTrad) {
			traditionsToRender.add(tradCode);
		}

		// Render grouped methods - selected traditions first, then others
		const sortedTraditions = [...traditionsToRender].sort((a, b) => {
			const aSelected = selectedTraditions.includes(a);
			const bSelected = selectedTraditions.includes(b);
			if (aSelected !== bSelected) return aSelected ? -1 : 1;
			return this._getTraditionName(a).localeCompare(this._getTraditionName(b));
		});

		for (const tradCode of sortedTraditions) {
			const methods = methodsByTrad.get(tradCode) || [];
			if (methods.length === 0) continue;

			const isSelectedTradition = selectedTraditions.includes(tradCode);
			const $tradGroup = $(`
				<div class="charsheet__method-picker-trad-group ${!isSelectedTradition ? "charsheet__method-picker-trad-group--unselected" : ""}">
					<div class="charsheet__method-picker-trad-group-header">
						<span class="charsheet__method-picker-trad-group-icon">${tradIcons[tradCode] || "⚔️"}</span>
						<span class="charsheet__method-picker-trad-group-name">${this._getTraditionName(tradCode)}${!isSelectedTradition ? " (not selected)" : ""}</span>
						<span class="charsheet__method-picker-trad-group-count">${methods.length}</span>
					</div>
				</div>
			`);

			// Sort by degree then name
			methods.sort((a, b) => {
				const degA = this._getMethodDegreeFromOptFeature(a);
				const degB = this._getMethodDegreeFromOptFeature(b);
				return degA - degB || a.name.localeCompare(b.name);
			});

			for (const method of methods) {
				const key = `${method.name}|${method.source || ""}`;
				const isKnown = knownMethodNames.has(key);
				const degree = this._getMethodDegreeFromOptFeature(method);
				const cost = this._getMethodExertionCostFromOptFeature(method);
				const activation = this._getMethodActivationTime(method);
				const isStance = this._isMethodStance(method);

				// Create hoverable method name link
				let methodNameHtml = `<span class="bold">${method.name}</span>`;
				try {
					if (this._page?.getHoverLink && method.source) {
						methodNameHtml = this._page.getHoverLink(UrlUtil.PG_OPT_FEATURES, method.name, method.source);
					}
				} catch (e) {
					// Fall back to plain text
				}

				// Activation badge class
				const activationBadgeClass = {
					"A": "charsheet__method-badge--action",
					"BA": "charsheet__method-badge--bonus",
					"R": "charsheet__method-badge--reaction",
				};
				const actClass = activation ? activationBadgeClass[activation] : null;
				const activationLabels = {"A": "Action", "BA": "Bonus", "R": "React"};

				const $method = $(`
					<div class="charsheet__method-picker-item ${isKnown ? "charsheet__method-picker-item--known" : ""}">
						<div class="charsheet__method-picker-item-content">
							${isKnown ? "<span class=\"glyphicon glyphicon-ok charsheet__method-picker-item-known-icon\"></span>" : ""}
							<span class="charsheet__method-picker-item-name">${methodNameHtml}</span>
							<span class="charsheet__method-badge charsheet__method-badge--degree">${degree}${this._getOrdinalSuffix(degree)}</span>
							${actClass ? `<span class="charsheet__method-badge ${actClass}">${activationLabels[activation]}</span>` : ""}
							${cost > 0 ? `<span class="charsheet__method-badge charsheet__method-badge--ep">${cost} EP</span>` : ""}
							${isStance ? `<span class="charsheet__method-badge charsheet__method-badge--stance">Stance</span>` : ""}
						</div>
						<div class="charsheet__method-picker-item-actions">
							${isKnown
		? `<button class="charsheet__method-picker-btn charsheet__method-picker-btn--remove charsheet__method-remove" data-method-key="${key}">
									<span class="glyphicon glyphicon-minus"></span>
								</button>`
		: `<button class="charsheet__method-picker-btn charsheet__method-picker-btn--add charsheet__method-add" data-method-key="${key}">
									<span class="glyphicon glyphicon-plus"></span>
								</button>`
}
						</div>
					</div>
				`);

				// Store method data
				$method.data("method", method);

				// Event handlers
				$method.find(".charsheet__method-add").on("click", (e) => {
					e.stopPropagation();
					this._addCombatMethod(method);
					knownMethodNames.add(key);
					this._renderMethodList($container, allMethods, selectedTraditions, maxDegree, knownMethodNames, filterTrad, filterDegree, filterStatus, searchQuery);
					// Update known count badge
					$("#method-picker-known-count").text(knownMethodNames.size);
				});

				$method.find(".charsheet__method-remove").on("click", (e) => {
					e.stopPropagation();
					this._removeCombatMethod(method);
					knownMethodNames.delete(key);
					this._renderMethodList($container, allMethods, selectedTraditions, maxDegree, knownMethodNames, filterTrad, filterDegree, filterStatus, searchQuery);
					// Update known count badge
					$("#method-picker-known-count").text(knownMethodNames.size);
				});

				$tradGroup.append($method);
			}

			$container.append($tradGroup);
		}
	}

	/**
	 * Get character's selected combat traditions
	 */
	_getCharacterTraditions () {
		// Look for traditions in character data or features
		const settings = this._state.getSettings?.() || {};
		if (settings.combatTraditions?.length) {
			return settings.combatTraditions;
		}

		// Infer from known combat methods
		const knownMethods = this._state.getFeatures().filter(f =>
			f.featureType === "Optional Feature"
			&& f.optionalFeatureTypes?.some(ft => /^CTM:\d[A-Z]{2}$/.test(ft)),
		);

		const traditions = new Set();
		for (const method of knownMethods) {
			for (const ft of (method.optionalFeatureTypes || [])) {
				const match = ft.match(/^CTM:\d([A-Z]{2})$/);
				if (match) traditions.add(match[1]);
			}
		}

		return Array.from(traditions);
	}

	/**
	 * Save selected traditions to character settings
	 */
	_saveSelectedTraditions (traditions) {
		const settings = this._state.getSettings?.() || {};
		settings.combatTraditions = traditions;
		this._state.setSettings?.(settings);
	}

	/**
	 * Get max method degree based on character class level
	 */
	_getCharacterMaxDegree () {
		// Look for a class with Combat Methods progression
		const classes = this._state.getClasses();
		let maxDegree = 0;

		for (const cls of classes) {
			// Check if this class uses combat methods
			const classData = this._page.getClasses?.().find(c => c.name === cls.name && c.source === cls.source);
			if (!classData?.optionalfeatureProgression) continue;

			const cmProg = classData.optionalfeatureProgression.find(prog =>
				prog.featureType?.some(ft => ft.startsWith("CTM:")),
			);
			if (!cmProg) continue;

			// Get max degree at current level
			// Degrees are typically: 1st at 1-4, 2nd at 5-8, 3rd at 9-12, 4th at 13-16, 5th at 17+
			const level = cls.level || 1;
			let degree = 1;
			if (level >= 17) degree = 5;
			else if (level >= 13) degree = 4;
			else if (level >= 9) degree = 3;
			else if (level >= 5) degree = 2;

			maxDegree = Math.max(maxDegree, degree);
		}

		return maxDegree || 1; // Default to at least 1st degree
	}

	/**
	 * Add a combat method to the character
	 */
	_addCombatMethod (method) {
		const featureData = {
			name: method.name,
			source: method.source,
			featureType: "Optional Feature",
			optionalFeatureTypes: method.featureType,
			description: method.entries ? Renderer.get().render({entries: method.entries}) : "",
			entries: method.entries,
		};
		this._state.addFeature(featureData);
		JqueryUtil.doToast({type: "success", content: `Learned ${method.name}!`});
	}

	/**
	 * Remove a combat method from the character
	 */
	_removeCombatMethod (method) {
		this._state.removeFeature(method.name, method.source);
		JqueryUtil.doToast({type: "info", content: `Removed ${method.name}.`});
	}

	/**
	 * Get method tradition code from optional feature
	 */
	_getMethodTraditionFromOptFeature (method) {
		if (!method.featureType) return "Unknown";
		for (const ft of method.featureType) {
			const match = ft.match(/^CTM:\d([A-Z]{2})$/);
			if (match) return match[1];
		}
		return "Unknown";
	}

	/**
	 * Get method degree from optional feature
	 */
	_getMethodDegreeFromOptFeature (method) {
		if (!method.featureType) return 0;
		for (const ft of method.featureType) {
			const match = ft.match(/^CTM:(\d)[A-Z]{2}$/);
			if (match) return parseInt(match[1]);
		}
		return 0;
	}

	/**
	 * Get method exertion cost from optional feature
	 */
	_getMethodExertionCostFromOptFeature (method) {
		// First check consumes.amount
		if (method.consumes?.amount) return method.consumes.amount;

		if (!method.entries) return 0;
		const entriesStr = JSON.stringify(method.entries);

		// Parse from entries like "{@b Action (2 Exertion Points)}"
		const costMatch = entriesStr.match(/\((\d+)\s+exertion\s+points?\)/i);
		if (costMatch) return parseInt(costMatch[1]);

		return 0;
	}

	/**
	 * Get method activation time from entries
	 */
	_getMethodActivationTime (method) {
		if (!method.entries) return null;
		const entriesStr = JSON.stringify(method.entries);

		// Look for patterns like "{@b Action", "{@b Bonus Action", "{@b Reaction"
		if (entriesStr.includes("{@b Reaction")) return "R";
		if (entriesStr.includes("{@b Bonus Action")) return "BA";
		if (entriesStr.includes("{@b Action")) return "A";

		return null;
	}

	_getMethodDegree (feature) {
		if (!feature.optionalFeatureTypes) return 0;
		for (const ft of feature.optionalFeatureTypes) {
			const match = ft.match(/^CTM:(\d)[A-Z]{2}$/);
			if (match) return parseInt(match[1]);
		}
		return 0;
	}

	_getMethodTradition (feature) {
		if (!feature.optionalFeatureTypes) return "Unknown";
		for (const ft of feature.optionalFeatureTypes) {
			const match = ft.match(/^CTM:\d([A-Z]{2})$/);
			if (match) return match[1];
		}
		return "Unknown";
	}

	_getTraditionName (tradCode) {
		const names = {
			"AM": "Adamant Mountain",
			"AK": "Arcane Knight",
			"BU": "Beast Unity",
			"BZ": "Biting Zephyr",
			"CJ": "Comedic Jabs",
			"EB": "Eldritch Blackguard",
			"GH": "Gallant Heart",
			"MG": "Mirror's Glint",
			"MS": "Mist and Shade",
			"RC": "Rapid Current",
			"RE": "Razor's Edge",
			"SK": "Sanguine Knot",
			"SS": "Spirited Steed",
			"TI": "Tempered Iron",
			"TC": "Tooth and Claw",
			"UW": "Unending Wheel",
			"UH": "Unerring Hawk",
		};
		return names[tradCode] || tradCode;
	}

	_getOrdinalSuffix (n) {
		const s = ["th", "st", "nd", "rd"];
		const v = n % 100;
		return s[(v - 20) % 10] || s[v] || s[0];
	}
	// #endregion
}

globalThis.CharacterSheetCombat = CharacterSheetCombat;

export {CharacterSheetCombat};
