/**
 * Custom Abilities UI Module for Character Sheet
 * Unified system for custom features, homebrew abilities, house rules, boons, curses, etc.
 * Uses the same effect system as custom modifiers for consistency.
 */
class CharacterSheetCustomAbilities {
	constructor (sheet) {
		this._sheet = sheet;
		this._boundAddHandler = null;
	}

	/**
	 * Initialize event handlers
	 */
	init () {
		const addBtn = document.getElementById("charsheet-add-custom-ability");
		if (addBtn && !this._boundAddHandler) {
			this._boundAddHandler = () => this._showAbilityModal(null);
			addBtn.addEventListener("click", this._boundAddHandler);
		}
	}

	/**
	 * Get preset icon options for the icon picker
	 */
	_getIconOptions () {
		return [
			// Combat & Defense
			"⚔️", "🗡️", "🛡️", "🏹", "🔪", "⚡", "💥", "🎯",
			// Magic & Spells
			"✨", "🔮", "💫", "🌟", "⭐", "🌙", "☀️", "🔥",
			// Nature & Elements
			"🌊", "💨", "🌿", "🍃", "❄️", "⛈️", "🌪️", "🌋",
			// Status & Effects
			"❤️", "💀", "👁️", "👊", "💪", "🦾", "🧠", "👻",
			// Items & Objects
			"💎", "🔑", "📜", "📖", "🗝️", "💰", "🎲", "🃏",
			// Creatures & Characters
			"🐉", "🦅", "🐺", "🦇", "🕷️", "🧙", "👤", "🧝",
			// Misc & Symbolic
			"🌀", "♾️", "⚙️", "🔧", "🛠️", "✝️", "☯️", "🔱",
		];
	}

	/**
	 * Render the custom abilities list
	 */
	render () {
		this.init(); // Ensure handlers are bound

		const container = document.querySelector("#features-custom-abilities");
		if (!container) return;

		const state = this._sheet.getState();
		const abilities = state.getCustomAbilities();

		container.innerHTML = "";

		if (!abilities.length) {
			container.innerHTML = `
				<div class="custom-abilities__empty">
					<p class="ve-muted ve-text-center py-2">No custom abilities. Click <strong>+ Add</strong> above to create homebrew features, house rules, boons, or other custom effects.</p>
				</div>
			`;
			return;
		}

		// Group abilities by category
		const categories = CharacterSheetState.CUSTOM_ABILITY_CATEGORIES;
		const grouped = {};

		for (const ability of abilities) {
			if (!grouped[ability.category]) grouped[ability.category] = [];
			grouped[ability.category].push(ability);
		}

		// Render abilities by category
		for (const [categoryId, categoryAbilities] of Object.entries(grouped)) {
			if (!categoryAbilities.length) continue;
			const category = categories[categoryId] || {name: categoryId, icon: "❓", color: "#666"};
			const section = this._buildCategorySection(category, categoryAbilities);
			container.appendChild(section);
		}
	}

	/**
	 * Build a category section containing abilities
	 */
	_buildCategorySection (category, abilities) {
		const section = document.createElement("div");
		section.className = "custom-abilities__category";

		const header = document.createElement("div");
		header.className = "custom-abilities__category-header";
		header.style.borderLeftColor = category.color;
		header.innerHTML = `
			<span class="custom-abilities__category-icon">${category.icon}</span>
			<span class="custom-abilities__category-name">${category.name}</span>
			<span class="custom-abilities__category-count">(${abilities.length})</span>
		`;
		section.appendChild(header);

		const list = document.createElement("div");
		list.className = "custom-abilities__list";

		for (const ability of abilities) {
			list.appendChild(this._buildAbilityCard(ability, category));
		}

		section.appendChild(list);
		return section;
	}

	/**
	 * Build a card for a single ability
	 */
	_buildAbilityCard (ability, category) {
		const card = document.createElement("div");
		card.className = `custom-abilities__card ${ability.mode === "toggleable" && ability.isActive ? "custom-abilities__card--active" : ""}`;
		card.dataset.abilityId = ability.id;

		// Header row
		const header = document.createElement("div");
		header.className = "custom-abilities__card-header";
		header.innerHTML = `
			<span class="custom-abilities__card-icon" style="color: ${category.color}">${ability.icon || category.icon}</span>
			<span class="custom-abilities__card-name">${ability.name}</span>
			<span class="custom-abilities__mode-badge custom-abilities__mode-badge--${ability.mode}">
				${ability.mode === "passive" ? "Passive" : ability.mode === "toggleable" ? "Toggle" : "Limited"}
			</span>
		`;
		card.appendChild(header);

		// Description
		if (ability.description) {
			const desc = document.createElement("div");
			desc.className = "custom-abilities__card-description";
			// Render with 5etools renderer if available
			try {
				desc.innerHTML = Renderer.get().render(ability.description);
			} catch {
				desc.textContent = ability.description;
			}
			card.appendChild(desc);
		}

		// Effects summary
		if (ability.effects?.length) {
			const effects = document.createElement("div");
			effects.className = "custom-abilities__card-effects";
			const summaries = ability.effects.slice(0, 4).map(e => this._formatEffectSummary(e));
			effects.innerHTML = summaries.join(", ") + (ability.effects.length > 4 ? ` <span class="ve-muted">+${ability.effects.length - 4} more</span>` : "");
			card.appendChild(effects);
		}

		// Controls row
		const controls = document.createElement("div");
		controls.className = "custom-abilities__card-controls";

		// Left side: mode-specific controls
		const leftControls = document.createElement("div");
		leftControls.className = "custom-abilities__card-controls-left";

		if (ability.mode === "toggleable") {
			const toggleBtn = document.createElement("button");
			toggleBtn.className = `custom-abilities__toggle-btn ${ability.isActive ? "custom-abilities__toggle-btn--active" : ""}`;
			toggleBtn.innerHTML = ability.isActive ? "✓ Active" : "○ Inactive";
			toggleBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this._toggleAbility(ability.id);
			});
			leftControls.appendChild(toggleBtn);
		} else if (ability.mode === "limited" && ability.uses) {
			const usesDiv = document.createElement("div");
			usesDiv.className = "custom-abilities__uses";
			usesDiv.innerHTML = `
				<button class="custom-abilities__use-btn" ${ability.uses.current <= 0 ? "disabled" : ""}>Use</button>
				<span class="custom-abilities__use-counter">${ability.uses.current}/${ability.uses.max}</span>
				<span class="custom-abilities__recharge" title="${ability.uses.recharge === "short" ? "Recharges on Short Rest" : "Recharges on Long Rest"}">
					${ability.uses.recharge === "short" ? "⚡SR" : "🌙LR"}
				</span>
			`;
			usesDiv.querySelector(".custom-abilities__use-btn").addEventListener("click", (e) => {
				e.stopPropagation();
				this._useAbility(ability.id);
			});
			leftControls.appendChild(usesDiv);
		}

		controls.appendChild(leftControls);

		// Right side: edit/delete
		const rightControls = document.createElement("div");
		rightControls.className = "custom-abilities__card-controls-right";
		rightControls.innerHTML = `
			<button class="custom-abilities__action-btn custom-abilities__action-btn--edit" title="Edit">✏️</button>
			<button class="custom-abilities__action-btn custom-abilities__action-btn--delete" title="Delete">🗑️</button>
		`;
		rightControls.querySelector(".custom-abilities__action-btn--edit").addEventListener("click", (e) => {
			e.stopPropagation();
			this._showAbilityModal(ability.id);
		});
		rightControls.querySelector(".custom-abilities__action-btn--delete").addEventListener("click", (e) => {
			e.stopPropagation();
			this._confirmDelete(ability.id, ability.name);
		});
		controls.appendChild(rightControls);

		card.appendChild(controls);

		// Click card to expand/view
		card.addEventListener("click", () => this._showAbilityModal(ability.id));

		return card;
	}

	/**
	 * Format an effect for display
	 */
	_formatEffectSummary (effect) {
		const typeInfo = this._getEffectTypeInfo(effect.type);
		const label = typeInfo?.label || effect.type;

		const parts = [];
		if (effect.value != null && effect.value !== 0) {
			const val = effect.value >= 0 ? `+${effect.value}` : effect.value;
			parts.push(`<span class="${effect.value >= 0 ? "text-success" : "text-danger"}">${val}</span>`);
		}
		if (effect.advantage) parts.push(`<span class="text-success">Adv</span>`);
		if (effect.disadvantage) parts.push(`<span class="text-danger">Dis</span>`);
		if (effect.setMinimum != null) parts.push(`<span class="ve-muted">Min:${effect.setMinimum}</span>`);
		if (effect.bonusDie) parts.push(`<span class="text-info">+${effect.bonusDie}</span>`);

		return `${label}${parts.length ? " " + parts.join(" ") : ""}`;
	}

	/**
	 * Get effect type info from the modifier groups
	 */
	_getEffectTypeInfo (type) {
		for (const group of this._getModifierGroups()) {
			const opt = group.options.find(o => o.value === type);
			if (opt) return {label: opt.label, group: group.group};
		}
		return null;
	}

	/**
	 * Get modifier groups (same as modifiers modal)
	 */
	_getModifierGroups () {
		const skills = this._sheet.getSkillsList?.() || [];
		return [
			{
				group: "⭐ Global",
				options: [
					{value: "d20:all", label: "All d20 Rolls"},
				],
			},
			{
				group: "🛡️ Combat",
				options: [
					{value: "ac", label: "Armor Class (AC)"},
					{value: "initiative", label: "Initiative"},
					{value: "attack", label: "Attack Rolls (All)"},
					{value: "attack:melee", label: "Melee Attack Rolls"},
					{value: "attack:ranged", label: "Ranged Attack Rolls"},
					{value: "attack:weapon", label: "Weapon Attack Rolls"},
					{value: "attack:spell", label: "Spell Attack Rolls"},
					{value: "damage", label: "Damage Rolls (All)"},
					{value: "damage:melee", label: "Melee Damage"},
					{value: "damage:ranged", label: "Ranged Damage"},
					{value: "damage:weapon", label: "Weapon Damage"},
					{value: "damage:spell", label: "Spell Damage"},
				],
			},
			{
				group: "👟 Movement",
				options: [
					{value: "speed", label: "Speed (All)"},
					{value: "speed:walk", label: "Walking Speed"},
					{value: "speed:fly", label: "Flying Speed"},
					{value: "speed:swim", label: "Swimming Speed"},
					{value: "speed:climb", label: "Climbing Speed"},
					{value: "speed:burrow", label: "Burrowing Speed"},
				],
			},
			{
				group: "✨ Spellcasting",
				options: [
					{value: "spellDc", label: "Spell Save DC"},
					{value: "spellAttack", label: "Spell Attack Bonus"},
					{value: "concentration", label: "Concentration Saves"},
				],
			},
			{
				group: "💪 Saving Throws",
				options: [
					{value: "save:all", label: "All Saving Throws"},
					{value: "save:str", label: "Strength Save"},
					{value: "save:dex", label: "Dexterity Save"},
					{value: "save:con", label: "Constitution Save"},
					{value: "save:int", label: "Intelligence Save"},
					{value: "save:wis", label: "Wisdom Save"},
					{value: "save:cha", label: "Charisma Save"},
				],
			},
			{
				group: "🎲 Ability Checks",
				options: [
					{value: "check:all", label: "All Ability Checks"},
					{value: "check:str", label: "Strength Checks"},
					{value: "check:dex", label: "Dexterity Checks"},
					{value: "check:con", label: "Constitution Checks"},
					{value: "check:int", label: "Intelligence Checks"},
					{value: "check:wis", label: "Wisdom Checks"},
					{value: "check:cha", label: "Charisma Checks"},
				],
			},
			{
				group: "📚 Skills",
				options: [
					{value: "skill:all", label: "All Skill Checks"},
					...skills.map(skill => {
						const key = skill.name.toLowerCase().replace(/\s+/g, "");
						return {value: `skill:${key}`, label: `${skill.name} (${skill.ability?.toUpperCase() || "—"})`};
					}),
				],
			},
			{
				group: "👁️ Passive Scores",
				options: [
					{value: "passive:all", label: "All Passive Scores"},
					...skills.map(skill => {
						const key = skill.name.toLowerCase().replace(/\s+/g, "");
						return {value: `passive:${key}`, label: `Passive ${skill.name}`};
					}),
				],
			},
			{
				group: "❤️ Hit Points",
				options: [
					{value: "hp:max", label: "HP Maximum"},
					{value: "hp:temp", label: "Temp HP"},
				],
			},
			{
				group: "📊 Ability Scores",
				options: [
					{value: "ability:str", label: "Strength Score"},
					{value: "ability:dex", label: "Dexterity Score"},
					{value: "ability:con", label: "Constitution Score"},
					{value: "ability:int", label: "Intelligence Score"},
					{value: "ability:wis", label: "Wisdom Score"},
					{value: "ability:cha", label: "Charisma Score"},
				],
			},
			{
				group: "🌙 Senses",
				options: [
					{value: "sense:darkvision", label: "Darkvision"},
					{value: "sense:blindsight", label: "Blindsight"},
					{value: "sense:tremorsense", label: "Tremorsense"},
					{value: "sense:truesight", label: "Truesight"},
				],
			},
			{
				group: "🔥 Resistances",
				options: [
					{value: "resistance:fire", label: "Fire Resistance"},
					{value: "resistance:cold", label: "Cold Resistance"},
					{value: "resistance:lightning", label: "Lightning Resistance"},
					{value: "resistance:thunder", label: "Thunder Resistance"},
					{value: "resistance:acid", label: "Acid Resistance"},
					{value: "resistance:poison", label: "Poison Resistance"},
					{value: "resistance:necrotic", label: "Necrotic Resistance"},
					{value: "resistance:radiant", label: "Radiant Resistance"},
					{value: "resistance:psychic", label: "Psychic Resistance"},
					{value: "resistance:force", label: "Force Resistance"},
					{value: "resistance:bludgeoning", label: "Bludgeoning Resistance"},
					{value: "resistance:piercing", label: "Piercing Resistance"},
					{value: "resistance:slashing", label: "Slashing Resistance"},
				],
			},
			{
				group: "📈 Miscellaneous",
				options: [
					{value: "proficiencyBonus", label: "Proficiency Bonus"},
					{value: "carryCapacity", label: "Carry Capacity"},
					{value: "deathSave", label: "Death Saving Throws"},
				],
			},
		];
	}

	_toggleAbility (id) {
		const state = this._sheet.getState();
		state.toggleCustomAbility(id);
		this.render();
		this._sheet._updateAllCalculations?.();
		this._sheet._saveCurrentCharacter?.();
	}

	_useAbility (id) {
		const state = this._sheet.getState();
		if (state.useCustomAbility(id)) {
			this.render();
			this._sheet._updateAllCalculations?.();
			this._sheet._saveCurrentCharacter?.();
		}
	}

	_confirmDelete (id, name) {
		if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
		const state = this._sheet.getState();
		if (state.removeCustomAbility(id)) {
			this.render();
			this._sheet._updateAllCalculations?.();
			this._sheet._saveCurrentCharacter?.();
		}
	}

	/**
	 * Show the ability create/edit modal
	 */
	_showAbilityModal (abilityId) {
		const state = this._sheet.getState();
		const existingAbility = abilityId ? state.getCustomAbility(abilityId) : null;
		const isEditing = !!existingAbility;

		// Build optgroup HTML for effect types
		const typeOptionsHtml = this._getModifierGroups().map(group => {
			const opts = group.options.map(o => `<option value="${o.value}">${o.label}</option>`).join("");
			return `<optgroup label="${group.group}">${opts}</optgroup>`;
		}).join("");

		// Category options
		const categories = CharacterSheetState.CUSTOM_ABILITY_CATEGORIES;
		const categoryOptionsHtml = Object.entries(categories).map(([id, cat]) =>
			`<option value="${id}" ${existingAbility?.category === id ? "selected" : ""}>${cat.icon} ${cat.name}</option>`,
		).join("");

		// Create modal
		const modal = document.createElement("div");
		modal.className = "custom-abilities__modal modal-overlay";
		modal.innerHTML = `
			<div class="custom-abilities__modal-content modal-content">
				<div class="modal-header">
					<h4 class="modal-title">${isEditing ? "Edit" : "Create"} Custom Ability</h4>
					<button class="modal-close" title="Close">&times;</button>
				</div>
				<div class="custom-abilities__modal-body modal-body">
					<!-- Mode selector: Simple or Advanced -->
					<div class="custom-abilities__editor-mode-toggle">
						<button class="custom-abilities__editor-mode-btn custom-abilities__editor-mode-btn--active" data-mode="simple">
							🎯 Simple Mode
						</button>
						<button class="custom-abilities__editor-mode-btn" data-mode="advanced">
							⚙️ Advanced Mode
						</button>
					</div>

					<!-- Simple Mode -->
					<div class="custom-abilities__editor-simple" data-editor="simple">
						<!-- Basic Info -->
						<div class="custom-abilities__form-section">
							<div class="custom-abilities__form-row">
								<div class="custom-abilities__form-field" style="flex: 2;">
									<label>Name <span class="text-danger">*</span></label>
									<input type="text" class="form-control" name="name" placeholder="e.g., Blessing of the Sun God" value="${existingAbility?.name || ""}">
								</div>
								<div class="custom-abilities__form-field custom-abilities__icon-field">
									<label>Icon</label>
									<div class="custom-abilities__icon-picker">
										<button type="button" class="custom-abilities__icon-preview" title="Click to choose icon">
											${existingAbility?.icon || "⚡"}
										</button>
										<div class="custom-abilities__icon-dropdown">
											<div class="custom-abilities__icon-grid">
												${this._getIconOptions().map(icon => `<button type="button" class="custom-abilities__icon-option" data-icon="${icon}">${icon}</button>`).join("")}
											</div>
											<div class="custom-abilities__icon-custom">
												<input type="text" class="form-control" placeholder="Or paste emoji..." maxlength="2">
											</div>
										</div>
									</div>
									<input type="hidden" name="icon" value="${existingAbility?.icon || "⚡"}">
								</div>
								<div class="custom-abilities__form-field">
									<label>Category</label>
									<select class="form-control" name="category">${categoryOptionsHtml}</select>
								</div>
							</div>

							<div class="custom-abilities__form-field">
								<label>Description</label>
								<textarea class="form-control" name="description" rows="3" placeholder="What does this ability do? (Supports 5etools tags like {@dice 2d6})">${existingAbility?.description || ""}</textarea>
							</div>
						</div>

						<!-- Activation Mode -->
						<div class="custom-abilities__form-section">
							<label class="custom-abilities__form-section-title">Activation Mode</label>
							<div class="custom-abilities__mode-options">
								<label class="custom-abilities__mode-option">
									<input type="radio" name="mode" value="passive" ${(!existingAbility || existingAbility.mode === "passive") ? "checked" : ""}>
									<div class="custom-abilities__mode-option-content">
										<strong>Passive</strong>
										<span>Always active - effects apply permanently</span>
									</div>
								</label>
								<label class="custom-abilities__mode-option">
									<input type="radio" name="mode" value="toggleable" ${existingAbility?.mode === "toggleable" ? "checked" : ""}>
									<div class="custom-abilities__mode-option-content">
										<strong>Toggleable</strong>
										<span>Can be turned on/off (e.g., Rage, Bladesong)</span>
									</div>
								</label>
								<label class="custom-abilities__mode-option">
									<input type="radio" name="mode" value="limited" ${existingAbility?.mode === "limited" ? "checked" : ""}>
									<div class="custom-abilities__mode-option-content">
										<strong>Limited Uses</strong>
										<span>Has charges that recharge on rest</span>
									</div>
								</label>
							</div>
							<div class="custom-abilities__limited-options" style="display: ${existingAbility?.mode === "limited" ? "flex" : "none"};">
								<div class="custom-abilities__form-field">
									<label>Max Uses</label>
									<input type="number" class="form-control" name="maxUses" min="1" value="${existingAbility?.uses?.max || 1}">
								</div>
								<div class="custom-abilities__form-field">
									<label>Recharges On</label>
									<select class="form-control" name="recharge">
										<option value="long" ${existingAbility?.uses?.recharge !== "short" ? "selected" : ""}>🌙 Long Rest</option>
										<option value="short" ${existingAbility?.uses?.recharge === "short" ? "selected" : ""}>⚡ Short Rest</option>
									</select>
								</div>
							</div>
						</div>

						<!-- Effects -->
						<div class="custom-abilities__form-section">
							<div class="custom-abilities__effects-header">
								<label class="custom-abilities__form-section-title">Effects (Optional)</label>
								<button class="btn btn-sm btn-primary custom-abilities__add-effect-btn">+ Add Effect</button>
							</div>
							<p class="ve-muted ve-small mb-2">Add mechanical effects that this ability grants. Leave empty for flavor-only features.</p>
							<div class="custom-abilities__effects-list" id="ability-effects-list">
								<!-- Rendered dynamically -->
							</div>
						</div>
					</div>

					<!-- Advanced Mode (JSON) -->
					<div class="custom-abilities__editor-advanced" data-editor="advanced" style="display: none;">
						<div class="custom-abilities__advanced-intro">
							<p>Edit the ability definition directly as JSON. This gives full control over all properties.</p>
						</div>
						<textarea class="form-control custom-abilities__json-editor" rows="20" id="ability-json-editor"></textarea>
						<div class="custom-abilities__advanced-docs">
							<details>
								<summary><strong>📚 JSON Documentation</strong></summary>
								<div class="custom-abilities__docs-content">
									<h5>Required Fields</h5>
									<ul>
										<li><code>name</code>: String - The ability name</li>
									</ul>

									<h5>Optional Fields</h5>
									<ul>
										<li><code>description</code>: String - Description text (supports 5etools tags)</li>
										<li><code>icon</code>: String - Emoji icon (default: "⚡")</li>
										<li><code>category</code>: "homebrew" | "houserule" | "boon" | "curse" | "campaign" | "magicitem"</li>
										<li><code>mode</code>: "passive" | "toggleable" | "limited" (default: "passive")</li>
										<li><code>uses</code>: Object for limited mode - { max: number, recharge: "short" | "long" }</li>
										<li><code>effects</code>: Array of effect objects (see below)</li>
									</ul>

									<h5>Effect Object Properties</h5>
									<ul>
										<li><code>type</code>: Effect target (e.g., "ac", "attack", "save:dex", "skill:stealth")</li>
										<li><code>value</code>: Numeric bonus/penalty</li>
										<li><code>advantage</code>: true for advantage</li>
										<li><code>disadvantage</code>: true for disadvantage</li>
										<li><code>setMinimum</code>: Minimum roll value (like Reliable Talent)</li>
										<li><code>setMaximum</code>: Maximum roll value</li>
										<li><code>bonusDie</code>: Bonus dice string (e.g., "1d4")</li>
										<li><code>conditional</code>: Condition text (e.g., "against undead")</li>
									</ul>

									<h5>Effect Types</h5>
									<p class="ve-small ve-muted">ac, initiative, attack, attack:melee, attack:ranged, attack:spell, damage, damage:melee, damage:ranged, damage:spell, speed, speed:fly, speed:swim, speed:climb, spellDc, spellAttack, save:all, save:str/dex/con/int/wis/cha, check:all, check:str/dex/con/int/wis/cha, skill:all, skill:[skillname], passive:[skillname], hp:max, ability:str/dex/con/int/wis/cha, sense:darkvision/blindsight/tremorsense/truesight, resistance:[damage type], proficiencyBonus, carryCapacity, deathSave</p>

									<h5>Example</h5>
									<pre>{
  "name": "Blessing of Protection",
  "description": "Divine favor grants you protection.",
  "icon": "🛡️",
  "category": "boon",
  "mode": "passive",
  "effects": [
    { "type": "ac", "value": 1 },
    { "type": "save:all", "value": 1 }
  ]
}</pre>
								</div>
							</details>
						</div>
					</div>
				</div>
				<div class="modal-footer">
					<button class="btn btn-default custom-abilities__cancel-btn">Cancel</button>
					<button class="btn btn-primary custom-abilities__save-btn">${isEditing ? "Save Changes" : "Create Ability"}</button>
				</div>
			</div>
		`;

		document.body.appendChild(modal);

		// State
		let effects = existingAbility?.effects ? JSON.parse(JSON.stringify(existingAbility.effects)) : [];
		let currentMode = "simple";

		// Helper to render effects list
		const renderEffectsList = () => {
			const list = modal.querySelector("#ability-effects-list");
			list.innerHTML = "";

			if (!effects.length) {
				list.innerHTML = `<div class="ve-muted ve-text-center py-2">No effects added. This ability will be flavor-only.</div>`;
				return;
			}

			effects.forEach((effect, idx) => {
				const row = document.createElement("div");
				row.className = "custom-abilities__effect-row";
				row.innerHTML = `
					<div class="custom-abilities__effect-row-main">
						<select class="form-control custom-abilities__effect-type">${typeOptionsHtml}</select>
						<input type="number" class="form-control custom-abilities__effect-value" placeholder="±0" value="${effect.value || 0}" style="width: 70px;">
					</div>
					<div class="custom-abilities__effect-row-extra">
						<select class="form-control custom-abilities__effect-advdis" style="width: 120px;">
							<option value="">Normal</option>
							<option value="advantage" ${effect.advantage ? "selected" : ""}>Advantage</option>
							<option value="disadvantage" ${effect.disadvantage ? "selected" : ""}>Disadvantage</option>
						</select>
						<input type="number" class="form-control custom-abilities__effect-minimum" placeholder="Min" value="${effect.setMinimum ?? ""}" style="width: 65px;" title="Minimum roll (like Reliable Talent)">
						<input type="text" class="form-control custom-abilities__effect-bonusdie" placeholder="e.g. 1d4" value="${effect.bonusDie || ""}" style="width: 75px;" title="Bonus dice">
						<button class="btn btn-sm btn-danger custom-abilities__effect-remove" title="Remove">&times;</button>
					</div>
				`;

				// Set selected type
				row.querySelector(".custom-abilities__effect-type").value = effect.type || "ac";

				// Bind change handlers
				row.querySelector(".custom-abilities__effect-type").addEventListener("change", (e) => {
					effects[idx].type = e.target.value;
				});
				row.querySelector(".custom-abilities__effect-value").addEventListener("change", (e) => {
					effects[idx].value = parseInt(e.target.value) || 0;
				});
				row.querySelector(".custom-abilities__effect-advdis").addEventListener("change", (e) => {
					delete effects[idx].advantage;
					delete effects[idx].disadvantage;
					if (e.target.value === "advantage") effects[idx].advantage = true;
					if (e.target.value === "disadvantage") effects[idx].disadvantage = true;
				});
				row.querySelector(".custom-abilities__effect-minimum").addEventListener("change", (e) => {
					const val = parseInt(e.target.value);
					if (!isNaN(val)) effects[idx].setMinimum = val;
					else delete effects[idx].setMinimum;
				});
				row.querySelector(".custom-abilities__effect-bonusdie").addEventListener("change", (e) => {
					const val = e.target.value.trim();
					if (val) effects[idx].bonusDie = val;
					else delete effects[idx].bonusDie;
				});
				row.querySelector(".custom-abilities__effect-remove").addEventListener("click", () => {
					effects.splice(idx, 1);
					renderEffectsList();
				});

				list.appendChild(row);
			});
		};

		// Sync form to JSON
		const syncFormToJson = () => {
			const data = {
				name: modal.querySelector("input[name='name']").value,
				description: modal.querySelector("textarea[name='description']").value,
				icon: modal.querySelector("input[name='icon']").value || "⚡",
				category: modal.querySelector("select[name='category']").value,
				mode: modal.querySelector("input[name='mode']:checked")?.value || "passive",
				effects: effects,
			};

			if (data.mode === "limited") {
				data.uses = {
					max: parseInt(modal.querySelector("input[name='maxUses']").value) || 1,
					recharge: modal.querySelector("select[name='recharge']").value || "long",
				};
			}

			if (existingAbility) {
				data.id = existingAbility.id;
				data.isActive = existingAbility.isActive;
				if (existingAbility.uses) {
					data.uses = {...existingAbility.uses, ...data.uses};
				}
			}

			return data;
		};

		// Sync JSON to form
		const syncJsonToForm = (data) => {
			if (!data) return;
			modal.querySelector("input[name='name']").value = data.name || "";
			modal.querySelector("textarea[name='description']").value = data.description || "";
			modal.querySelector("input[name='icon']").value = data.icon || "⚡";
			modal.querySelector("select[name='category']").value = data.category || "homebrew";
			const modeRadio = modal.querySelector(`input[name='mode'][value='${data.mode || "passive"}']`);
			if (modeRadio) modeRadio.checked = true;
			updateLimitedVisibility();

			if (data.uses) {
				modal.querySelector("input[name='maxUses']").value = data.uses.max || 1;
				modal.querySelector("select[name='recharge']").value = data.uses.recharge || "long";
			}

			effects = data.effects || [];
			renderEffectsList();
		};

		// Update limited options visibility
		const updateLimitedVisibility = () => {
			const mode = modal.querySelector("input[name='mode']:checked")?.value;
			modal.querySelector(".custom-abilities__limited-options").style.display = mode === "limited" ? "flex" : "none";
		};

		// Event handlers
		modal.querySelectorAll("input[name='mode']").forEach(r => r.addEventListener("change", updateLimitedVisibility));

		// Icon picker
		const iconPreview = modal.querySelector(".custom-abilities__icon-preview");
		const iconDropdown = modal.querySelector(".custom-abilities__icon-dropdown");
		const iconHidden = modal.querySelector("input[name='icon']");
		const iconCustomInput = modal.querySelector(".custom-abilities__icon-custom input");

		const updateIcon = (newIcon) => {
			iconPreview.textContent = newIcon;
			iconHidden.value = newIcon;
			iconDropdown.classList.remove("custom-abilities__icon-dropdown--open");
		};

		iconPreview.addEventListener("click", (e) => {
			e.stopPropagation();
			iconDropdown.classList.toggle("custom-abilities__icon-dropdown--open");
		});

		modal.querySelectorAll(".custom-abilities__icon-option").forEach(btn => {
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				updateIcon(btn.dataset.icon);
			});
		});

		iconCustomInput.addEventListener("input", (e) => {
			if (e.target.value.trim()) {
				updateIcon(e.target.value.trim().slice(0, 2));
			}
		});

		// Close icon dropdown when clicking outside
		modal.addEventListener("click", (e) => {
			if (!e.target.closest(".custom-abilities__icon-picker")) {
				iconDropdown.classList.remove("custom-abilities__icon-dropdown--open");
			}
		});

		// Editor mode toggle
		modal.querySelectorAll(".custom-abilities__editor-mode-btn").forEach(btn => {
			btn.addEventListener("click", () => {
				const newMode = btn.dataset.mode;
				if (newMode === currentMode) return;

				// Sync data when switching modes
				if (currentMode === "simple" && newMode === "advanced") {
					const data = syncFormToJson();
					modal.querySelector(".custom-abilities__json-editor").value = JSON.stringify(data, null, 2);
				} else if (currentMode === "advanced" && newMode === "simple") {
					try {
						const data = JSON.parse(modal.querySelector(".custom-abilities__json-editor").value);
						syncJsonToForm(data);
					} catch (e) {
						alert("Invalid JSON. Please fix errors before switching to Simple mode.");
						return;
					}
				}

				currentMode = newMode;
				modal.querySelectorAll(".custom-abilities__editor-mode-btn").forEach(b => b.classList.remove("custom-abilities__editor-mode-btn--active"));
				btn.classList.add("custom-abilities__editor-mode-btn--active");
				modal.querySelector("[data-editor='simple']").style.display = newMode === "simple" ? "" : "none";
				modal.querySelector("[data-editor='advanced']").style.display = newMode === "advanced" ? "" : "none";
			});
		});

		// Add effect
		modal.querySelector(".custom-abilities__add-effect-btn").addEventListener("click", () => {
			effects.push({type: "ac", value: 0});
			renderEffectsList();
		});

		// Close handlers
		const closeModal = () => modal.remove();
		modal.querySelector(".modal-close").addEventListener("click", closeModal);
		modal.querySelector(".custom-abilities__cancel-btn").addEventListener("click", closeModal);
		modal.addEventListener("click", (e) => {
			if (e.target === modal) closeModal();
		});

		// Save handler
		modal.querySelector(".custom-abilities__save-btn").addEventListener("click", () => {
			let data;

			if (currentMode === "advanced") {
				try {
					data = JSON.parse(modal.querySelector(".custom-abilities__json-editor").value);
				} catch (e) {
					alert("Invalid JSON: " + e.message);
					return;
				}
			} else {
				data = syncFormToJson();
			}

			if (!data.name?.trim()) {
				alert("Please enter a name for the ability.");
				return;
			}

			if (isEditing) {
				state.updateCustomAbility(abilityId, data);
			} else {
				state.addCustomAbility(data);
			}

			closeModal();
			this.render();
			this._sheet._updateAllCalculations?.();
			this._sheet._saveCurrentCharacter?.();
		});

		// Initialize
		renderEffectsList();
		if (existingAbility) {
			modal.querySelector(".custom-abilities__json-editor").value = JSON.stringify(existingAbility, null, 2);
		}

		// Focus name input
		setTimeout(() => modal.querySelector("input[name='name']").focus(), 100);
	}
}

// Export for ES modules
export {CharacterSheetCustomAbilities};
