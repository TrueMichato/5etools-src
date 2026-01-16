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

		// Determine attack type for advantage/disadvantage matching
		const isMelee = attack.isMelee || attack.type === "melee" || attack.range === "melee" || 
			(attack.range && !attack.range.includes("/"));
		const abilityUsed = attack.abilityMod || (isMelee ? "str" : "dex");
		const attackType = `attack:${isMelee ? "melee" : "ranged"}:${abilityUsed}`;

		// Check for advantage/disadvantage from active states and conditions
		let stateMode;
		const hasAdvantage = this._state.hasAdvantageFromStates?.(attackType) || 
			this._state.hasAdvantageFromStates?.("attack");
		const hasDisadvantage = this._state.hasDisadvantageFromStates?.(attackType) || 
			this._state.hasDisadvantageFromStates?.("attack");
		if (hasAdvantage && !hasDisadvantage) stateMode = "advantage";
		else if (hasDisadvantage && !hasAdvantage) stateMode = "disadvantage";

		// Calculate total attack bonus
		const abilityMod = this._state.getAbilityMod(attack.abilityMod || "str");
		const profBonus = this._state.getProficiencyBonus();
		
		// Get attack modifiers from named modifiers (from features like Battle Tactics, magic items, etc.)
		const attackModifiers = this._state.getNamedModifiersByType("attack");
		const featureAttackBonus = attackModifiers.reduce((sum, mod) => sum + (mod.value || 0), 0);
		
		const totalBonus = abilityMod + profBonus + (attack.attackBonus || 0) + featureAttackBonus;

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
		
		// Check if attack uses strength and if rage is active (for rage damage)
		let rageBonus = 0;
		const isMeleeStrengthAttack = (attack.abilityMod === "str" || !attack.abilityMod) && 
			!attack.isRanged && !attack.isSpell;
		if (this._state.isStateTypeActive?.("rage")) {
			rageBonus = this._state.getRageDamageBonus?.(
				!attack.isRanged && !attack.isSpell, // isMelee
				attack.abilityMod || "str",
			) || 0;
		}
		
		const totalBonus = abilityMod + (attack.damageBonus || 0) + featureDamageBonus + rageBonus;

		const total = damageRoll.total + totalBonus;

		// Build subtitle with breakdown
		let subtitle = `${attack.damage}${isCrit ? " (crit)" : ""} + ${abilityMod} (${attack.abilityMod || "STR"})`;
		if (attack.damageBonus) subtitle += ` + ${attack.damageBonus} (weapon)`;
		if (featureDamageBonus) subtitle += ` + ${featureDamageBonus} (features)`;
		if (rageBonus) subtitle += ` + ${rageBonus} (rage)`;
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
				badgeHtml = ' <span class="badge badge-warning" title="Monk Unarmed Strike with Martial Arts">Monk</span>';
			}
			// No badge for regular unarmed strike - it's just normal
		} else if (isNaturalWeapon) {
			badgeHtml = ' <span class="badge badge-info" title="Natural Weapon from feature">Natural</span>';
		} else if (isAutoGenerated) {
			badgeHtml = ' <span class="badge badge-secondary">Auto</span>';
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
					${!isAutoGenerated && !isNaturalWeapon ? `
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
			
			return (hasActionEconomy && (hasLimitedUses || hasCombatKeyword)) || 
				   (hasCombatKeyword && hasLimitedUses);
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
		const typeBadge = feature.featureType ? 
			`<span class="badge badge-${this._getFeatureTypeBadgeClass(feature.featureType)} mr-1 ve-small">${feature.featureType}</span>` : "";
		
		// Build uses display if applicable
		let usesHtml = "";
		if (hasUses) {
			const rechargeIcon = feature.uses.recharge === "short" ? "☀️" : 
				(feature.uses.recharge === "long" ? "🌙" : "");
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
				let hoverPage = null;
				if (feature.optionalFeatureTypes?.length) {
					hoverPage = UrlUtil.PG_OPT_FEATURES;
				} else if (feature.featureType === "Class" && feature.className) {
					// Class features - try classFeature page
					hoverPage = "classFeature";
				}
				if (hoverPage) {
					nameHtml = this._page.getHoverLink(hoverPage, feature.name, feature.source);
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

		const conditions = this._state.getConditions?.() || [];

		if (!conditions.length) {
			$container.html(`<div class="ve-muted ve-text-center py-2">No active conditions</div>`);
			return;
		}

		$container.empty();

		for (const condition of conditions) {
			const conditionDef = CharacterSheetState.getConditionEffects(condition);
			
			const icon = conditionDef?.icon || "⚠️";
			const description = conditionDef?.description || condition;
			
			// Build tooltip with effects
			let tooltip = description;
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
					tooltip += "\n" + effectList.join("\n");
				}
			}
			
			const $condition = $(`
				<div class="charsheet__combat-condition badge badge-warning mr-1 mb-1" 
					title="${tooltip}" data-condition="${condition}">
					${icon} ${condition}
					<span class="charsheet__condition-remove ml-1" title="Remove condition">&times;</span>
				</div>
			`);

			$condition.find(".charsheet__condition-remove").on("click", (e) => {
				e.stopPropagation();
				this._state.removeCondition?.(condition);
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
					`<span class="badge badge-danger mr-1">${this._formatDamageType(v)}</span>`
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
			return name.includes("rage") ||
				name.includes("ki") ||
				name.includes("focus") ||
				name.includes("sorcery") ||
				name.includes("superiority") ||
				name.includes("exertion") ||
				name.includes("channel") ||
				name.includes("wild shape") ||
				name.includes("bardic") ||
				name.includes("action surge") ||
				name.includes("second wind") ||
				name.includes("smite") ||
				name.includes("lay on hands") ||
				name.includes("arcane recovery") ||
				name.includes("sneak attack") || // Not a resource but might be tracked
				r.recharge; // Any resource with recharge is likely combat-relevant
		});

		if (!combatResources.length) {
			$container.html(`<div class="ve-muted ve-text-center py-2">No combat resources</div>`);
			return;
		}

		$container.empty();
		for (const resource of combatResources) {
			const used = resource.max - resource.current;
			const $resource = $(`
				<div class="charsheet__combat-resource-item mb-2" data-resource-id="${resource.id}">
					<div class="charsheet__combat-resource-name ve-small font-weight-bold">${resource.name}</div>
					<div class="charsheet__combat-resource-pips">
						${Array.from({length: resource.max}, (_, i) => `
							<span class="charsheet__resource-pip ${i < used ? "used" : ""}" data-pip-index="${i}" title="Click to use/restore"></span>
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
					// Restore one use
					this._state.setResourceCurrent(resource.id, resource.current + 1);
				} else {
					// Use one
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
	 * Render active states in combat tab (quick access)
	 */
	renderCombatStates () {
		const $container = $("#charsheet-combat-states");
		if (!$container.length) return;

		const allStates = this._state.getActiveStates?.() || [];
		// Filter for only currently active, non-condition states
		const activeStates = allStates.filter(s => s.active && !s.isCondition);
		
		// Also check for concentration
		const concentration = this._state.getConcentration?.();
		
		if (!activeStates.length && !concentration) {
			$container.html(`<div class="ve-muted ve-text-center py-2">No active states</div>`);
		} else {
			$container.empty();
			
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
					this._page._renderCharacter?.(); // Re-render to remove effects
				});
				$container.append($conc);
			}
			
			for (const state of activeStates) {
				const stateType = CharacterSheetState.ACTIVE_STATE_TYPES?.[state.stateTypeId];
				const $state = $(`
					<div class="charsheet__combat-state-item badge ${this._getStateBadgeClass(state.stateTypeId)} mr-1 mb-1" data-state-id="${state.id}">
						${state.icon || stateType?.icon || "⚡"} ${state.name || stateType?.name || state.stateTypeId}
						<span class="charsheet__state-remove ml-1" title="End">&times;</span>
					</div>
				`);

				$state.find(".charsheet__state-remove").on("click", (e) => {
					e.stopPropagation();
					this._state.deactivateState(state.stateTypeId);
					this.renderCombatStates();
					this.renderCombatDefenses(); // Update defenses (resistances may change)
					this.renderCombatEffects(); // Update effects (advantage/disadvantage may change)
					this._page._renderActiveStates?.();
					this._page._saveCurrentCharacter?.();
					this._page._renderCharacter?.(); // Re-render to remove effects
				});

				$container.append($state);
			}
		}

		// Set up quick activation buttons
		this._initQuickStateButtons();
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

	_initQuickStateButtons () {
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
				const spellName = await InputUiUtil.pGetUserString({title: "Concentrating on which spell?"});
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

		this._updateQuickButtonStates();
	}

	_updateQuickButtonStates () {
		// Update button active states
		$("#charsheet-combat-rage").toggleClass("active", this._state.isStateTypeActive?.("rage") || false);
		$("#charsheet-combat-dodge").toggleClass("active", this._state.isStateTypeActive?.("dodge") || false);
		$("#charsheet-combat-concentrate").toggleClass("active", this._state.isConcentrating?.() || false);
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
			"you enter",
			"stance",
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
