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
	}

	_castCombatSpell (spellId) {
		// Delegate to the spells module if available
		if (this._page._spells) {
			this._page._spells._castSpell(spellId);
			this.renderCombatSpells(); // Refresh to update slot display
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
			title: `${isEdit ? "Edit" : "Add"} Attack`,
			isMinHeight0: true,
		});

		// Build form
		const $name = $(`<input type="text" class="form-control" value="${attack.name}" placeholder="Weapon or attack name">`);
		const $type = $(`
			<select class="form-control">
				<option value="melee" ${attack.isMelee ? "selected" : ""}>Melee</option>
				<option value="ranged" ${!attack.isMelee ? "selected" : ""}>Ranged</option>
			</select>
		`);
		const $ability = $(`
			<select class="form-control">
				${Parser.ABIL_ABVS.map(a => `<option value="${a}" ${attack.abilityMod === a ? "selected" : ""}>${Parser.attAbvToFull(a)}</option>`).join("")}
			</select>
		`);
		const $bonus = $(`<input type="number" class="form-control" value="${attack.attackBonus}">`);
		const $range = $(`<input type="text" class="form-control" value="${attack.range || ""}" placeholder="e.g., 5 ft. or 30/120 ft.">`);
		const $damage = $(`<input type="text" class="form-control" value="${attack.damage}" placeholder="e.g., 1d8">`);
		const $damageType = $(`
			<select class="form-control">
				${["bludgeoning", "piercing", "slashing", "fire", "cold", "lightning", "thunder", "poison", "acid", "necrotic", "radiant", "force", "psychic"].map(t =>
					`<option value="${t}" ${attack.damageType === t ? "selected" : ""}>${t.toTitleCase()}</option>`
				).join("")}
			</select>
		`);
		const $damageBonus = $(`<input type="number" class="form-control" value="${attack.damageBonus}">`);
		const $properties = $(`<input type="text" class="form-control" value="${(attack.properties || []).join(", ")}" placeholder="e.g., versatile, finesse">`);

		// Quick add from inventory weapons (already owned by character)
		const inventoryItems = this._state.getItems();
		const inventoryWeapons = inventoryItems.filter(i => i.weapon);
		
		const $inventorySelect = $(`<select class="form-control"><option value="">-- Select from inventory --</option></select>`);
		inventoryWeapons.forEach(weapon => {
			const bonusInfo = [];
			const totalAttackBonus = (weapon.bonusWeapon || 0) + (weapon.bonusWeaponAttack || 0);
			const totalDamageBonus = (weapon.bonusWeapon || 0) + (weapon.bonusWeaponDamage || 0);
			if (totalAttackBonus > 0 || totalDamageBonus > 0) {
				bonusInfo.push(`+${Math.max(totalAttackBonus, totalDamageBonus)}`);
			}
			const label = bonusInfo.length ? `${weapon.name} (${bonusInfo.join(", ")})` : weapon.name;
			$inventorySelect.append(`<option value="inv:${weapon.name}">${label}</option>`);
		});

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
					// Parse damage string like "1d8 slashing"
					const dmgMatch = weapon.damage.match(/(\d+d\d+)/);
					if (dmgMatch) $damage.val(dmgMatch[1]);
					const typeMatch = weapon.damage.match(/\d+d\d+\s*(\w+)/);
					if (typeMatch) $damageType.val(typeMatch[1].toLowerCase());
				}
				if (weapon.range) $range.val(weapon.range);
				if (weapon.properties) $properties.val(weapon.properties.map(p => typeof p === "string" ? p : Parser.itemPropertyToFull(p)).join(", "));

				// Apply magic weapon bonuses - use all three bonus types
				const attackBonus = (weapon.bonusWeapon || 0) + (weapon.bonusWeaponAttack || 0);
				const damageBonus = (weapon.bonusWeapon || 0) + (weapon.bonusWeaponDamage || 0);
				$bonus.val(attackBonus);
				$damageBonus.val(damageBonus);
			}
		});

		// Quick add from weapon catalog
		const $weaponSelect = $(`<select class="form-control"><option value="">-- Select from catalog --</option></select>`);
		this._allItems
			.filter(i => i.weapon)
			.sort((a, b) => a.name.localeCompare(b.name))
			.forEach(weapon => {
				const bonusInfo = [];
				const totalBonus = this._parseBonus(weapon.bonusWeapon) + this._parseBonus(weapon.bonusWeaponAttack);
				if (totalBonus > 0) bonusInfo.push(`+${totalBonus}`);
				const label = bonusInfo.length ? `${weapon.name} (${bonusInfo.join(", ")})` : weapon.name;
				$weaponSelect.append(`<option value="${weapon.name}|${weapon.source}">${label}</option>`);
			});

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

				// Apply magic weapon bonuses - use all three bonus types
				const attackBonus = this._parseBonus(weapon.bonusWeapon) + this._parseBonus(weapon.bonusWeaponAttack);
				const damageBonus = this._parseBonus(weapon.bonusWeapon) + this._parseBonus(weapon.bonusWeaponDamage);
				$bonus.val(attackBonus);
				$damageBonus.val(damageBonus);
			}
		});

		$$`<div class="form-group"><label>Name</label>${$name}</div>`.appendTo($modalInner);
		$$`<div class="ve-flex mb-3">
			<div class="form-group mr-2" style="flex: 1;"><label>Attack Type</label>${$type}</div>
			<div class="form-group" style="flex: 1;"><label>Ability</label>${$ability}</div>
		</div>`.appendTo($modalInner);
		$$`<div class="ve-flex mb-3">
			<div class="form-group mr-2" style="flex: 1;"><label>Attack Bonus</label>${$bonus}</div>
			<div class="form-group" style="flex: 1;"><label>Range</label>${$range}</div>
		</div>`.appendTo($modalInner);
		$$`<div class="ve-flex mb-3">
			<div class="form-group mr-2" style="flex: 1;"><label>Damage</label>${$damage}</div>
			<div class="form-group mr-2" style="flex: 1;"><label>Damage Type</label>${$damageType}</div>
			<div class="form-group" style="flex: 1;"><label>Damage Bonus</label>${$damageBonus}</div>
		</div>`.appendTo($modalInner);
		$$`<div class="form-group"><label>Properties</label>${$properties}</div>`.appendTo($modalInner);
		
		// Show inventory weapons section if character has any
		if (inventoryWeapons.length) {
			$$`<hr><h5>Quick Add from Inventory</h5>
			<p class="ve-muted small">Weapons in your inventory (bonuses already applied)</p>
			${$inventorySelect}`.appendTo($modalInner);
		}
		
		$$`<hr><h5>Quick Add from Weapon Catalog</h5>
		<p class="ve-muted small">All weapons (magic weapons include bonuses)</p>
		${$weaponSelect}`.appendTo($modalInner);

		// Buttons
		const $btnSave = $(`<button class="ve-btn ve-btn-primary">${isEdit ? "Save" : "Add"}</button>`);
		$btnSave.on("click", () => {
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

		$$`<div class="ve-flex-v-center ve-flex-h-right mt-3">
			<button class="ve-btn ve-btn-default mr-2">Cancel</button>
			${$btnSave}
		</div>`.appendTo($modalInner).find("button.ve-btn-default").on("click", () => doClose(false));
	}


	async _editAttack (attackId) {
		// Check if it's an auto-generated attack
		if (attackId?.startsWith?.("auto_")) {
			JqueryUtil.doToast({type: "warning", content: "Weapon attacks are auto-generated from equipped weapons. Edit the item in Inventory instead."});
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

	_removeAttack (attackId) {
		// Check if it's an auto-generated attack
		if (attackId?.startsWith?.("auto_")) {
			JqueryUtil.doToast({type: "warning", content: "Weapon attacks are auto-generated from equipped weapons. Unequip the weapon in Inventory to remove."});
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

		// Calculate total attack bonus
		const abilityMod = this._state.getAbilityMod(attack.abilityMod || "str");
		const profBonus = this._state.getProficiencyBonus();
		const totalBonus = abilityMod + profBonus + (attack.attackBonus || 0);

		// Roll d20 with advantage/disadvantage support
		const rollResult = this._page.rollD20({event});
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

		// Show result
		const modeLabel = this._page.getModeLabel(rollResult.mode);
		this._page.showDiceResult({
			title: `${attack.name} Attack${modeLabel}`,
			roll: rollResult.roll,
			modifier: totalBonus,
			total,
			resultClass,
			resultNote,
			subtitle: this._page.formatD20Breakdown(rollResult, totalBonus),
		});
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
		const totalBonus = abilityMod + (attack.damageBonus || 0);

		const total = damageRoll.total + totalBonus;

		// Show result
		this._page.showDiceResult({
			title: `${attack.name} Damage`,
			roll: damageRoll.total,
			modifier: totalBonus,
			total,
			subtitle: `${attack.damage}${isCrit ? " (crit)" : ""} + ${totalBonus} ${attack.damageType}`,
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
				// Auto-generate attack from weapon
				const isRanged = weapon.properties?.some(p => p === "A" || p === "T" || p.startsWith("A|") || p.startsWith("T|"));
				const hasFinesse = weapon.properties?.some(p => p === "F" || p.startsWith("F|"));
				const abilityMod = isRanged ? "dex" : (hasFinesse ? "dex" : "str");

				// Calculate magic bonuses - use all three bonus types
				const attackBonus = (weapon.bonusWeapon || 0) + (weapon.bonusWeaponAttack || 0);
				const damageBonus = (weapon.bonusWeapon || 0) + (weapon.bonusWeaponDamage || 0);

				const autoAttack = {
					id: `auto_${weapon.id}`,
					name: weapon.name,
					isMelee: !isRanged,
					abilityMod,
					attackBonus: attackBonus,
					range: weapon.range || (isRanged ? "80/320 ft." : "5 ft."),
					damage: weapon.damage || "1d6",
					damageType: weapon.damageType || "slashing",
					damageBonus: damageBonus,
					properties: weapon.properties || [],
					mastery: weapon.mastery || [],
					isAutoGenerated: true,
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
		const abilityMod = this._state.getAbilityMod(attack.abilityMod || "str");
		const profBonus = this._state.getProficiencyBonus();
		const totalAttackBonus = abilityMod + profBonus + (attack.attackBonus || 0);
		const totalDamageBonus = abilityMod + (attack.damageBonus || 0);
		const isAutoGenerated = attack.isAutoGenerated || attack.id?.startsWith?.("auto_");

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

		return $(`
			<div class="charsheet__attack-item" data-attack-id="${attack.id}">
				<div class="charsheet__attack-info">
					<span class="charsheet__attack-name">${nameHtml}${isAutoGenerated ? ' <span class="badge badge-secondary">Auto</span>' : ""}</span>
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
					${!isAutoGenerated ? `
						<button class="ve-btn ve-btn-sm ve-btn-default charsheet__attack-edit" title="Edit">
							<span class="glyphicon glyphicon-pencil"></span>
						</button>
						<button class="ve-btn ve-btn-sm ve-btn-default charsheet__attack-remove" title="Remove">
							<span class="glyphicon glyphicon-trash"></span>
						</button>
					` : ""}
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
		this.renderAttacks();
		this.renderDeathSaves();
		this.renderCombatSpells();
		this.renderCombatMethods();

		// Render combat stats
		const initiative = this._state.getAbilityMod("dex");
		$("#charsheet-initiative").text(`+${initiative}`);
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
			return f.optionalFeatureTypes?.some(ft => /^CTM:\d[A-Z]{2}$/.test(ft));
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

		this._state.setExertionCurrent(currentExertion - cost);
		this._updateExertionDisplay();

		// Also update resources section
		if (this._page?._features) {
			this._page._features._renderResources();
		}

		// Find method name for feedback
		const methodName = methodId.split("-").slice(0, -1).join(" ").replace(/\b\w/g, c => c.toUpperCase());
		JqueryUtil.doToast({type: "success", content: `Used ${methodName}! (−${cost} exertion)`});

		// Flash the button to indicate use
		$btn.addClass("ve-btn-success");
		setTimeout(() => $btn.removeClass("ve-btn-success"), 200);
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
		const $resourcePips = $('[data-resource-id="exertion"] .charsheet__resource-pip--exertion');
		if ($resourcePips.length) {
			const used = max - current;
			$resourcePips.each((i, pip) => {
				$(pip).toggleClass("used", i < used);
			});
		}
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
