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

		// Roll attack
		$(document).on("click", ".charsheet__attack-roll", (e) => {
			const attackId = $(e.currentTarget).closest(".charsheet__attack-item").data("attack-id");
			this._rollAttack(attackId);
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

		// Initiative roll
		$(document).on("click", "#charsheet-roll-initiative", () => this._rollInitiative());

		// Death save buttons
		$(document).on("click", "#charsheet-death-save-success", () => this._rollDeathSave(true));
		$(document).on("click", "#charsheet-death-save-failure", () => this._rollDeathSave(false));
		$(document).on("click", "#charsheet-death-save-reset", () => this._resetDeathSaves());
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
		const attacks = this._state.getAttacks();
		const attack = attacks.find(a => a.id === attackId);
		if (!attack) return;

		await this._pShowAttackModal(attack);
	}

	_removeAttack (attackId) {
		this._state.removeAttack(attackId);
		this.renderAttacks();
		this._page.saveCharacter();
	}

	_rollAttack (attackId) {
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

		// Roll d20
		const roll = this._page.rollDice(1, 20);
		const total = roll + totalBonus;

		// Check for crit/fumble
		let resultClass = "";
		let resultNote = "";
		if (roll === 20) {
			resultClass = "text-success";
			resultNote = " (Critical Hit!)";
		} else if (roll === 1) {
			resultClass = "text-danger";
			resultNote = " (Critical Miss!)";
		}

		// Show result
		this._page.showDiceResult({
			title: `${attack.name} Attack`,
			roll,
			modifier: totalBonus,
			total,
			resultClass,
			resultNote,
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

	_rollInitiative () {
		const dexMod = this._state.getAbilityMod("dex");
		const roll = this._page.rollDice(1, 20);
		const total = roll + dexMod;

		this._page.showDiceResult({
			title: "Initiative",
			roll,
			modifier: dexMod,
			total,
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
				const isRanged = weapon.properties?.some(p => p === "A" || p === "T");
				const hasFinesse = weapon.properties?.some(p => p === "F");
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
					isAutoGenerated: true,
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

		return $(`
			<div class="charsheet__attack-item" data-attack-id="${attack.id}">
				<div class="charsheet__attack-info">
					<span class="charsheet__attack-name">${attack.name}</span>
					<span class="charsheet__attack-details">
						${attack.range ? `<span class="ve-muted">${attack.range}</span>` : ""}
						<span class="badge badge-primary">+${totalAttackBonus}</span>
						<span class="badge badge-danger">${attack.damage}+${totalDamageBonus} ${attack.damageType}</span>
					</span>
				</div>
				<div class="charsheet__attack-actions">
					<button class="ve-btn ve-btn-sm ve-btn-primary charsheet__attack-roll" title="Roll Attack">
						<span class="glyphicon glyphicon-screenshot"></span> Attack
					</button>
					<button class="ve-btn ve-btn-sm ve-btn-danger charsheet__attack-damage" title="Roll Damage">
						<span class="glyphicon glyphicon-fire"></span> Damage
					</button>
					<button class="ve-btn ve-btn-sm ve-btn-default charsheet__attack-edit" title="Edit">
						<span class="glyphicon glyphicon-pencil"></span>
					</button>
					<button class="ve-btn ve-btn-sm ve-btn-default charsheet__attack-remove" title="Remove">
						<span class="glyphicon glyphicon-trash"></span>
					</button>
				</div>
			</div>
		`);
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

	render () {
		this.renderAttacks();
		this.renderDeathSaves();

		// Render combat stats
		const initiative = this._state.getAbilityMod("dex");
		$("#charsheet-initiative").text(`+${initiative}`);
	}
	// #endregion
}

globalThis.CharacterSheetCombat = CharacterSheetCombat;

export {CharacterSheetCombat};
