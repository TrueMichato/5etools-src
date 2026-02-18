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

		// Grants summary
		if (ability.grants) {
			const grantsSummary = this._formatGrantsSummary(ability.grants);
			if (grantsSummary) {
				const grantsDiv = document.createElement("div");
				grantsDiv.className = "custom-abilities__card-grants";
				grantsDiv.innerHTML = `<span class="custom-abilities__grants-badge">🎁</span> ${grantsSummary}`;
				card.appendChild(grantsDiv);
			}
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
	 * Format grants for display summary
	 */
	_formatGrantsSummary (grants) {
		if (!grants) return "";

		const parts = [];

		// Spells
		if (grants.spells?.length) {
			const spellNames = grants.spells.slice(0, 2).map(s => s.name);
			const spellStr = spellNames.join(", ") + (grants.spells.length > 2 ? ` +${grants.spells.length - 2}` : "");
			parts.push(`<span class="text-info">✨${spellStr}</span>`);
		}

		// Features
		if (grants.features?.length) {
			const featNames = grants.features.slice(0, 2).map(f => f.name);
			const featStr = featNames.join(", ") + (grants.features.length > 2 ? ` +${grants.features.length - 2}` : "");
			parts.push(`<span class="text-warning">⚔️${featStr}</span>`);
		}

		// Proficiencies
		const profs = grants.proficiencies;
		if (profs) {
			const profParts = [];
			if (profs.skills?.length) profParts.push(`${profs.skills.length} skill${profs.skills.length > 1 ? "s" : ""}`);
			if (profs.tools?.length) profParts.push(`${profs.tools.length} tool${profs.tools.length > 1 ? "s" : ""}`);
			if (profs.languages?.length) profParts.push(`${profs.languages.length} lang${profs.languages.length > 1 ? "s" : ""}`);
			if (profs.weapons?.length) profParts.push(`weapons`);
			if (profs.armor?.length) profParts.push(`armor`);
			if (profParts.length) {
				parts.push(`<span class="text-success">📚${profParts.join(", ")}</span>`);
			}
		}

		return parts.join(" · ");
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

						<!-- Grants -->
						<div class="custom-abilities__form-section">
							<label class="custom-abilities__form-section-title">Grants (Optional)</label>
							<p class="ve-muted ve-small mb-2">Grant spells, proficiencies, or optional features (invocations, metamagic, fighting styles, etc.)</p>
							
							<!-- Spells Grant -->
							<details class="custom-abilities__grants-section">
								<summary><span class="custom-abilities__grants-icon">✨</span> Spells <span class="custom-abilities__grants-count" id="grants-spell-count"></span></summary>
								<div class="custom-abilities__grants-content">
									<div class="custom-abilities__grants-filters">
										<input type="text" class="form-control custom-abilities__grants-search" placeholder="Search spells..." id="grants-spell-search">
										<select class="form-control custom-abilities__grants-filter" id="grants-spell-level-filter">
											<option value="">All Levels</option>
											<option value="0">Cantrips</option>
											<option value="1">1st Level</option>
											<option value="2">2nd Level</option>
											<option value="3">3rd Level</option>
											<option value="4">4th Level</option>
											<option value="5">5th Level</option>
											<option value="6">6th Level</option>
											<option value="7">7th Level</option>
											<option value="8">8th Level</option>
											<option value="9">9th Level</option>
										</select>
										<select class="form-control custom-abilities__grants-filter" id="grants-spell-school-filter">
											<option value="">All Schools</option>
											<option value="A">Abjuration</option>
											<option value="C">Conjuration</option>
											<option value="D">Divination</option>
											<option value="E">Enchantment</option>
											<option value="V">Evocation</option>
											<option value="I">Illusion</option>
											<option value="N">Necromancy</option>
											<option value="T">Transmutation</option>
										</select>
									</div>
									<div class="custom-abilities__grants-list" id="grants-spell-list">
										<!-- Populated dynamically -->
									</div>
									<div class="custom-abilities__grants-selected" id="grants-spell-selected">
										<!-- Selected spells with options -->
									</div>
								</div>
							</details>

							<!-- Proficiencies Grant -->
							<details class="custom-abilities__grants-section">
								<summary><span class="custom-abilities__grants-icon">📚</span> Proficiencies <span class="custom-abilities__grants-count" id="grants-prof-count"></span></summary>
								<div class="custom-abilities__grants-content">
									<!-- Skills -->
									<div class="custom-abilities__grants-prof-group">
										<label class="custom-abilities__grants-prof-label">Skills</label>
										<div class="custom-abilities__grants-prof-pills" id="grants-skills-list">
											<!-- Populated dynamically -->
										</div>
									</div>
									<!-- Tools -->
									<div class="custom-abilities__grants-prof-group">
										<label class="custom-abilities__grants-prof-label">Tools</label>
										<div class="custom-abilities__grants-prof-add">
											<input type="text" class="form-control" placeholder="Tool name..." id="grants-tools-input" list="grants-tools-datalist">
											<datalist id="grants-tools-datalist">
												<option value="Thieves' Tools">
												<option value="Alchemist's Supplies">
												<option value="Brewer's Supplies">
												<option value="Calligrapher's Supplies">
												<option value="Carpenter's Tools">
												<option value="Cartographer's Tools">
												<option value="Cobbler's Tools">
												<option value="Cook's Utensils">
												<option value="Glassblower's Tools">
												<option value="Herbalism Kit">
												<option value="Jeweler's Tools">
												<option value="Leatherworker's Tools">
												<option value="Mason's Tools">
												<option value="Navigator's Tools">
												<option value="Painter's Supplies">
												<option value="Poisoner's Kit">
												<option value="Potter's Tools">
												<option value="Smith's Tools">
												<option value="Tinker's Tools">
												<option value="Weaver's Tools">
												<option value="Woodcarver's Tools">
												<option value="Disguise Kit">
												<option value="Forgery Kit">
												<option value="Gaming Set">
												<option value="Musical Instrument">
											</datalist>
											<button type="button" class="btn btn-xs btn-primary" id="grants-tools-add">+ Add</button>
										</div>
										<div class="custom-abilities__grants-selected-pills" id="grants-tools-selected"></div>
									</div>
									<!-- Languages -->
									<div class="custom-abilities__grants-prof-group">
										<label class="custom-abilities__grants-prof-label">Languages</label>
										<div class="custom-abilities__grants-prof-add">
											<input type="text" class="form-control" placeholder="Language name..." id="grants-languages-input" list="grants-languages-datalist">
											<datalist id="grants-languages-datalist">
												<option value="Common">
												<option value="Dwarvish">
												<option value="Elvish">
												<option value="Giant">
												<option value="Gnomish">
												<option value="Goblin">
												<option value="Halfling">
												<option value="Orc">
												<option value="Abyssal">
												<option value="Celestial">
												<option value="Draconic">
												<option value="Deep Speech">
												<option value="Infernal">
												<option value="Primordial">
												<option value="Sylvan">
												<option value="Undercommon">
												<option value="Thieves' Cant">
												<option value="Druidic">
											</datalist>
											<button type="button" class="btn btn-xs btn-primary" id="grants-languages-add">+ Add</button>
										</div>
										<div class="custom-abilities__grants-selected-pills" id="grants-languages-selected"></div>
									</div>
									<!-- Weapons -->
									<div class="custom-abilities__grants-prof-group">
										<label class="custom-abilities__grants-prof-label">Weapons</label>
										<div class="custom-abilities__grants-prof-pills">
											<button type="button" class="custom-abilities__grants-pill" data-weapon="simple">Simple Weapons</button>
											<button type="button" class="custom-abilities__grants-pill" data-weapon="martial">Martial Weapons</button>
											<button type="button" class="custom-abilities__grants-pill" data-weapon="firearms">Firearms</button>
										</div>
										<div class="custom-abilities__grants-prof-add mt-1">
											<input type="text" class="form-control" placeholder="Specific weapon..." id="grants-weapons-input">
											<button type="button" class="btn btn-xs btn-primary" id="grants-weapons-add">+ Add</button>
										</div>
										<div class="custom-abilities__grants-selected-pills" id="grants-weapons-selected"></div>
									</div>
									<!-- Armor -->
									<div class="custom-abilities__grants-prof-group">
										<label class="custom-abilities__grants-prof-label">Armor</label>
										<div class="custom-abilities__grants-prof-pills">
											<button type="button" class="custom-abilities__grants-pill" data-armor="light">Light Armor</button>
											<button type="button" class="custom-abilities__grants-pill" data-armor="medium">Medium Armor</button>
											<button type="button" class="custom-abilities__grants-pill" data-armor="heavy">Heavy Armor</button>
											<button type="button" class="custom-abilities__grants-pill" data-armor="shields">Shields</button>
										</div>
									</div>
								</div>
							</details>

							<!-- Optional Features Grant -->
							<details class="custom-abilities__grants-section">
								<summary><span class="custom-abilities__grants-icon">⚔️</span> Features <span class="custom-abilities__grants-count" id="grants-feature-count"></span></summary>
								<div class="custom-abilities__grants-content">
									<div class="custom-abilities__grants-filters">
										<input type="text" class="form-control custom-abilities__grants-search" placeholder="Search features..." id="grants-feature-search">
										<select class="form-control custom-abilities__grants-filter" id="grants-feature-type-filter">
											<option value="">All Types</option>
											<!-- Populated dynamically with homebrew types -->
										</select>
										<select class="form-control custom-abilities__grants-filter" id="grants-feature-source-filter">
											<option value="">All Sources</option>
											<!-- Populated dynamically -->
										</select>
									</div>
									<div class="custom-abilities__grants-list" id="grants-feature-list">
										<!-- Populated dynamically -->
									</div>
									<div class="custom-abilities__grants-selected" id="grants-feature-selected">
										<!-- Selected features -->
									</div>
								</div>
							</details>
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
		let grants = existingAbility?.grants ? JSON.parse(JSON.stringify(existingAbility.grants)) : {
			spells: [],
			proficiencies: {skills: [], tools: [], weapons: [], armor: [], languages: []},
			features: [],
		};
		let currentMode = "simple";

		// Get data from sheet for pickers
		const allSpells = this._sheet.getSpells?.() || [];
		const allOptionalFeatures = this._sheet.getOptionalFeatures?.() || [];
		const skillsList = this._sheet.getSkillsList?.() || [];
		const languagesList = this._sheet.getLanguagesList?.() || [];
		const toolsList = this._sheet.getToolsList?.() || [];

		// Helper to render grants UI
		const renderGrantsUI = () => {
			this._renderGrantsSpells(modal, grants, allSpells);
			this._renderGrantsSkills(modal, grants, skillsList);
			this._renderGrantsTools(modal, grants, toolsList);
			this._renderGrantsLanguages(modal, grants, languagesList);
			this._renderGrantsWeapons(modal, grants);
			this._renderGrantsArmor(modal, grants);
			this._renderGrantsFeatures(modal, grants, allOptionalFeatures);
		};

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

			// Add grants if any are defined (grants object is maintained by UI handlers)
			const hasGrants = grants.spells.length > 0 ||
				grants.proficiencies.skills.length > 0 ||
				grants.proficiencies.tools.length > 0 ||
				grants.proficiencies.weapons.length > 0 ||
				grants.proficiencies.armor.length > 0 ||
				grants.proficiencies.languages.length > 0 ||
				grants.features.length > 0;

			if (hasGrants) {
				data.grants = {
					spells: grants.spells,
					proficiencies: {
						skills: grants.proficiencies.skills,
						tools: grants.proficiencies.tools,
						weapons: grants.proficiencies.weapons,
						armor: grants.proficiencies.armor,
						languages: grants.proficiencies.languages,
					},
					features: grants.features,
				};
			}

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

			// Restore grants
			if (data.grants) {
				grants = {
					spells: data.grants.spells || [],
					proficiencies: {
						skills: data.grants.proficiencies?.skills || [],
						tools: data.grants.proficiencies?.tools || [],
						weapons: data.grants.proficiencies?.weapons || [],
						armor: data.grants.proficiencies?.armor || [],
						languages: data.grants.proficiencies?.languages || [],
					},
					features: data.grants.features || [],
				};
				renderGrantsUI();
			}
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
		renderGrantsUI();

		// Update initial grant counts
		this._updateGrantCount(modal, "grants-spell-count", grants.spells.length);
		this._updateGrantCount(modal, "grants-feature-count", grants.features.length);
		this._updateProfCount(modal, grants);

		if (existingAbility) {
			modal.querySelector(".custom-abilities__json-editor").value = JSON.stringify(existingAbility, null, 2);
		}

		// Focus name input
		setTimeout(() => modal.querySelector("input[name='name']").focus(), 100);
	}

	// #region Grants Rendering Helpers

	/**
	 * Get hover link HTML for a spell
	 */
	_getSpellHoverLink (spell) {
		try {
			const source = spell.source || Parser.SRC_PHB;
			const hash = UrlUtil.encodeForHash([spell.name, source].join(HASH_LIST_SEP));
			const hoverAttrs = Renderer.hover.getHoverElementAttributes({page: UrlUtil.PG_SPELLS, source, hash});
			return `<a href="${UrlUtil.PG_SPELLS}#${hash}" ${hoverAttrs} class="custom-abilities__hover-link">${spell.name}</a>`;
		} catch (e) {
			return spell.name;
		}
	}

	/**
	 * Get hover link HTML for an optional feature
	 */
	_getOptFeatureHoverLink (feature) {
		try {
			const source = feature.source || Parser.SRC_PHB;
			const hash = UrlUtil.encodeForHash([feature.name, source].join(HASH_LIST_SEP));
			const hoverAttrs = Renderer.hover.getHoverElementAttributes({page: UrlUtil.PG_OPT_FEATURES, source, hash});
			return `<a href="${UrlUtil.PG_OPT_FEATURES}#${hash}" ${hoverAttrs} class="custom-abilities__hover-link">${feature.name}</a>`;
		} catch (e) {
			return feature.name;
		}
	}

	/**
	 * Update grant count badge
	 */
	_updateGrantCount (modal, elementId, count) {
		const countEl = modal.querySelector(`#${elementId}`);
		if (countEl) {
			countEl.textContent = count > 0 ? `(${count})` : "";
			countEl.classList.toggle("has-items", count > 0);
		}
	}

	/**
	 * Render spells grant section with improved UI
	 */
	_renderGrantsSpells (modal, grants, allSpells) {
		const searchInput = modal.querySelector("#grants-spell-search");
		const levelFilter = modal.querySelector("#grants-spell-level-filter");
		const schoolFilter = modal.querySelector("#grants-spell-school-filter");
		const listContainer = modal.querySelector("#grants-spell-list");
		const selectedContainer = modal.querySelector("#grants-spell-selected");

		const renderSpellList = () => {
			const searchTerm = searchInput?.value.toLowerCase() || "";
			const levelFilterVal = levelFilter?.value || "";
			const schoolFilterVal = schoolFilter?.value || "";

			let filteredSpells = allSpells.filter(s => {
				if (searchTerm && !s.name.toLowerCase().includes(searchTerm)) return false;
				if (levelFilterVal !== "" && String(s.level) !== levelFilterVal) return false;
				if (schoolFilterVal && s.school !== schoolFilterVal) return false;
				// Hide already selected spells
				if (grants.spells.some(gs => gs.name === s.name && gs.source === s.source)) return false;
				return true;
			}).slice(0, 30);

			if (!searchTerm && !levelFilterVal && !schoolFilterVal) {
				listContainer.innerHTML = `<div class="custom-abilities__grants-hint">Type to search or use filters above</div>`;
				return;
			}

			listContainer.innerHTML = filteredSpells.map(s => {
				const levelStr = s.level === 0 ? "Cantrip" : `${s.level}${Parser.getOrdinalForm(s.level)}`;
				const schoolStr = Parser.spSchoolAbvToFull(s.school) || "";
				return `
					<div class="custom-abilities__grants-item" data-name="${s.name}" data-source="${s.source}" data-level="${s.level}">
						<div class="custom-abilities__grants-item-info">
							${this._getSpellHoverLink(s)}
							<span class="custom-abilities__grants-item-meta">${levelStr} ${schoolStr}</span>
						</div>
						<button type="button" class="btn btn-xs btn-primary custom-abilities__grants-add-btn">Add</button>
					</div>
				`;
			}).join("") || `<div class="custom-abilities__grants-empty">No matching spells</div>`;

			// Bind add buttons
			listContainer.querySelectorAll(".custom-abilities__grants-add-btn").forEach(btn => {
				btn.addEventListener("click", (e) => {
					e.preventDefault();
					const item = btn.closest(".custom-abilities__grants-item");
					const name = item.dataset.name;
					const source = item.dataset.source;
					const level = parseInt(item.dataset.level);

					if (!grants.spells.some(s => s.name === name && s.source === source)) {
						grants.spells.push({name, source, level, atWill: level === 0, uses: level === 0 ? null : 1, recharge: "long"});
					}
					renderSpellList();
					renderSelectedSpells();
				});
			});
		};

		const renderSelectedSpells = () => {
			this._updateGrantCount(modal, "grants-spell-count", grants.spells.length);

			if (!grants.spells.length) {
				selectedContainer.innerHTML = `<div class="custom-abilities__grants-empty-selected">No spells selected</div>`;
				return;
			}

			selectedContainer.innerHTML = grants.spells.map(s => {
				const spellData = allSpells.find(sp => sp.name === s.name && sp.source === s.source) || s;
				const levelStr = s.level === 0 ? "Cantrip" : `${s.level}${Parser.getOrdinalForm(s.level)}`;
				const isAtWill = s.atWill || s.level === 0;

				return `
					<div class="custom-abilities__grants-selected-item" data-name="${s.name}" data-source="${s.source}">
						<div class="custom-abilities__grants-selected-info">
							${this._getSpellHoverLink(spellData)}
							<span class="custom-abilities__grants-item-meta">${levelStr}</span>
						</div>
						<div class="custom-abilities__grants-selected-options">
							${s.level > 0 ? `
								<label class="custom-abilities__grants-option">
									<input type="checkbox" class="spell-at-will" ${isAtWill ? "checked" : ""}>
									<span>At Will</span>
								</label>
								${!isAtWill ? `
									<label class="custom-abilities__grants-option">
										<span>Uses:</span>
										<input type="number" class="form-control spell-uses" value="${s.uses || 1}" min="1" max="10" style="width: 50px;">
									</label>
									<select class="form-control spell-recharge" style="width: 80px;">
										<option value="long" ${s.recharge !== "short" ? "selected" : ""}>Long</option>
										<option value="short" ${s.recharge === "short" ? "selected" : ""}>Short</option>
									</select>
								` : ""}
							` : `<span class="ve-muted ve-small">At Will</span>`}
						</div>
						<button type="button" class="btn btn-xs btn-danger custom-abilities__grants-remove-btn">&times;</button>
					</div>
				`;
			}).join("");

			// Bind handlers
			selectedContainer.querySelectorAll(".custom-abilities__grants-selected-item").forEach(item => {
				const name = item.dataset.name;
				const source = item.dataset.source;
				const spell = grants.spells.find(s => s.name === name && s.source === source);
				if (!spell) return;

				// At-will toggle
				const atWillCb = item.querySelector(".spell-at-will");
				if (atWillCb) {
					atWillCb.addEventListener("change", () => {
						spell.atWill = atWillCb.checked;
						renderSelectedSpells();
					});
				}

				// Uses input
				const usesInput = item.querySelector(".spell-uses");
				if (usesInput) {
					usesInput.addEventListener("change", () => {
						spell.uses = parseInt(usesInput.value) || 1;
					});
				}

				// Recharge select
				const rechargeSelect = item.querySelector(".spell-recharge");
				if (rechargeSelect) {
					rechargeSelect.addEventListener("change", () => {
						spell.recharge = rechargeSelect.value;
					});
				}

				// Remove button
				item.querySelector(".custom-abilities__grants-remove-btn")?.addEventListener("click", (e) => {
					e.preventDefault();
					grants.spells = grants.spells.filter(s => !(s.name === name && s.source === source));
					renderSpellList();
					renderSelectedSpells();
				});
			});
		};

		searchInput?.addEventListener("input", renderSpellList);
		levelFilter?.addEventListener("change", renderSpellList);
		schoolFilter?.addEventListener("change", renderSpellList);

		renderSpellList();
		renderSelectedSpells();
	}

	/**
	 * Helper to find a skill in the grants.proficiencies.skills array
	 * Handles both string and object formats
	 */
	_findGrantedSkill (skills, skillName) {
		return skills.findIndex(s => {
			if (typeof s === "string") return s === skillName;
			return s.name === skillName;
		});
	}

	/**
	 * Helper to get skill expertise status
	 */
	_getGrantedSkillExpertise (skills, skillName) {
		const skill = skills.find(s => {
			if (typeof s === "string") return s === skillName;
			return s.name === skillName;
		});
		if (!skill) return null;
		if (typeof skill === "string") return false;
		return skill.expertise || false;
	}

	/**
	 * Render skills grant section with pill-based selection and expertise toggle
	 */
	_renderGrantsSkills (modal, grants, skillsList) {
		const container = modal.querySelector("#grants-skills-list");
		if (!container) return;

		const render = () => {
			container.innerHTML = skillsList.map(skill => {
				const isSelected = this._findGrantedSkill(grants.proficiencies.skills, skill.name) >= 0;
				const hasExpertise = this._getGrantedSkillExpertise(grants.proficiencies.skills, skill.name);
				const stateClass = hasExpertise ? "expertise" : (isSelected ? "selected" : "");
				const stateLabel = hasExpertise ? " (E)" : "";
				return `
					<button type="button" class="custom-abilities__grants-pill ${stateClass}" data-skill="${skill.name}" title="Click to add, click again for expertise, click again to remove">
						${skill.name}${stateLabel}
					</button>
				`;
			}).join("");

			container.querySelectorAll(".custom-abilities__grants-pill").forEach(btn => {
				btn.addEventListener("click", () => {
					const skillName = btn.dataset.skill;
					const idx = this._findGrantedSkill(grants.proficiencies.skills, skillName);
					const hasExpertise = this._getGrantedSkillExpertise(grants.proficiencies.skills, skillName);

					if (idx < 0) {
						// Not selected -> add as proficient
						grants.proficiencies.skills.push({name: skillName, expertise: false});
					} else if (!hasExpertise) {
						// Proficient -> upgrade to expertise
						grants.proficiencies.skills[idx] = {name: skillName, expertise: true};
					} else {
						// Expertise -> remove
						grants.proficiencies.skills.splice(idx, 1);
					}
					render();
					this._updateProfCount(modal, grants);
				});
			});
		};

		render();
	}

	/**
	 * Update proficiency count badge
	 */
	_updateProfCount (modal, grants) {
		const count = grants.proficiencies.skills.length +
			grants.proficiencies.tools.length +
			grants.proficiencies.weapons.length +
			grants.proficiencies.armor.length +
			grants.proficiencies.languages.length;
		this._updateGrantCount(modal, "grants-prof-count", count);
	}

	/**
	 * Render proficiency input section with improved styling
	 */
	_renderProficiencyInputSection (modal, grants, type, inputId, addBtnId, selectedContainerId) {
		const input = modal.querySelector(`#${inputId}`);
		const addBtn = modal.querySelector(`#${addBtnId}`);
		const selectedContainer = modal.querySelector(`#${selectedContainerId}`);

		const renderSelected = () => {
			const items = grants.proficiencies[type] || [];
			selectedContainer.innerHTML = items.map(item => `
				<span class="custom-abilities__grants-selected-pill">
					${item}
					<button type="button" class="custom-abilities__grants-pill-remove" data-item="${item}">&times;</button>
				</span>
			`).join("");

			selectedContainer.querySelectorAll(".custom-abilities__grants-pill-remove").forEach(btn => {
				btn.addEventListener("click", (e) => {
					e.preventDefault();
					const itemToRemove = btn.dataset.item;
					grants.proficiencies[type] = grants.proficiencies[type].filter(i => i !== itemToRemove);
					renderSelected();
					this._updateProfCount(modal, grants);
				});
			});
		};

		const addItem = () => {
			const value = input?.value.trim();
			if (!value) return;
			if (!grants.proficiencies[type].includes(value)) {
				grants.proficiencies[type].push(value);
			}
			input.value = "";
			renderSelected();
			this._updateProfCount(modal, grants);
		};

		addBtn?.addEventListener("click", addItem);
		input?.addEventListener("keypress", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				addItem();
			}
		});

		renderSelected();
	}

	/**
	 * Render tools grant section with datalist suggestions
	 */
	_renderGrantsTools (modal, grants, toolsList) {
		// Populate datalist with tools
		const datalist = modal.querySelector("#grants-tools-datalist");
		if (datalist && toolsList.length) {
			datalist.innerHTML = toolsList.map(t => `<option value="${t.name}">`).join("");
		}
		
		this._renderProficiencyInputSection(modal, grants, "tools", "grants-tools-input", "grants-tools-add", "grants-tools-selected");
	}

	/**
	 * Render languages grant section with datalist suggestions
	 */
	_renderGrantsLanguages (modal, grants, languagesList) {
		// Populate datalist with languages (includes homebrew)
		const datalist = modal.querySelector("#grants-languages-datalist");
		if (datalist && languagesList.length) {
			datalist.innerHTML = languagesList.map(l => `<option value="${l.name}">`).join("");
		}
		
		this._renderProficiencyInputSection(modal, grants, "languages", "grants-languages-input", "grants-languages-add", "grants-languages-selected");
	}

	/**
	 * Render weapons grant section with pill toggles
	 */
	_renderGrantsWeapons (modal, grants) {
		// Category pills
		modal.querySelectorAll(".custom-abilities__grants-pill[data-weapon]").forEach(btn => {
			const weapon = btn.dataset.weapon;
			btn.classList.toggle("selected", grants.proficiencies.weapons.includes(weapon));

			btn.addEventListener("click", () => {
				const idx = grants.proficiencies.weapons.indexOf(weapon);
				if (idx >= 0) {
					grants.proficiencies.weapons.splice(idx, 1);
				} else {
					grants.proficiencies.weapons.push(weapon);
				}
				btn.classList.toggle("selected", grants.proficiencies.weapons.includes(weapon));
				this._updateProfCount(modal, grants);
			});
		});

		// Specific weapons input - filter out category grants for display
		const weaponCategories = ["simple", "martial", "firearms"];
		const specificWeaponsContainer = modal.querySelector("#grants-weapons-selected");
		const input = modal.querySelector("#grants-weapons-input");
		const addBtn = modal.querySelector("#grants-weapons-add");

		const renderSpecific = () => {
			const specificWeapons = grants.proficiencies.weapons.filter(w => !weaponCategories.includes(w.toLowerCase()));
			specificWeaponsContainer.innerHTML = specificWeapons.map(item => `
				<span class="custom-abilities__grants-selected-pill">
					${item}
					<button type="button" class="custom-abilities__grants-pill-remove" data-item="${item}">&times;</button>
				</span>
			`).join("");

			specificWeaponsContainer.querySelectorAll(".custom-abilities__grants-pill-remove").forEach(btn => {
				btn.addEventListener("click", (e) => {
					e.preventDefault();
					const itemToRemove = btn.dataset.item;
					grants.proficiencies.weapons = grants.proficiencies.weapons.filter(i => i !== itemToRemove);
					renderSpecific();
					this._updateProfCount(modal, grants);
				});
			});
		};

		const addSpecific = () => {
			const value = input?.value.trim();
			if (!value || weaponCategories.includes(value.toLowerCase())) return;
			if (!grants.proficiencies.weapons.includes(value)) {
				grants.proficiencies.weapons.push(value);
			}
			input.value = "";
			renderSpecific();
			this._updateProfCount(modal, grants);
		};

		addBtn?.addEventListener("click", addSpecific);
		input?.addEventListener("keypress", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				addSpecific();
			}
		});

		renderSpecific();
	}

	/**
	 * Render armor grant section with pill toggles
	 */
	_renderGrantsArmor (modal, grants) {
		modal.querySelectorAll(".custom-abilities__grants-pill[data-armor]").forEach(btn => {
			const armor = btn.dataset.armor;
			btn.classList.toggle("selected", grants.proficiencies.armor.includes(armor));

			btn.addEventListener("click", () => {
				const idx = grants.proficiencies.armor.indexOf(armor);
				if (idx >= 0) {
					grants.proficiencies.armor.splice(idx, 1);
				} else {
					grants.proficiencies.armor.push(armor);
				}
				btn.classList.toggle("selected", grants.proficiencies.armor.includes(armor));
				this._updateProfCount(modal, grants);
			});
		});
	}

	/**
	 * Render optional features grant section with improved UI
	 */
	_renderGrantsFeatures (modal, grants, allOptionalFeatures) {
		const typeFilter = modal.querySelector("#grants-feature-type-filter");
		const sourceFilter = modal.querySelector("#grants-feature-source-filter");
		const searchInput = modal.querySelector("#grants-feature-search");
		const listContainer = modal.querySelector("#grants-feature-list");
		const selectedContainer = modal.querySelector("#grants-feature-selected");

		// Build dynamic type options including homebrew
		const typeSet = new Set();
		const sourceSet = new Set();
		allOptionalFeatures.forEach(f => {
			f.featureType?.forEach(ft => typeSet.add(ft));
			if (f.source) sourceSet.add(f.source);
		});

		// Populate type filter with homebrew types
		if (typeFilter) {
			const standardTypes = {
				"EI": "Eldritch Invocation",
				"MM": "Metamagic",
				"FS:F": "Fighting Style (Fighter)",
				"FS:P": "Fighting Style (Paladin)",
				"FS:R": "Fighting Style (Ranger)",
				"FS:B": "Fighting Style (Bard)",
				"MV": "Maneuver",
				"MV:B": "Maneuver (Battle Master)",
				"AI": "Artificer Infusion",
				"ED": "Elemental Discipline",
				"PB": "Pact Boon",
				"AS": "Arcane Shot",
				"RN": "Rune Knight Rune",
				"OR": "Onomancy Resonant",
				"AF": "Alchemical Formula",
				"TT": "Traveler's Trick",
				"OTH": "Other",
			};

			let optionsHtml = '<option value="">All Types</option>';
			// Standard types first
			Object.entries(standardTypes).forEach(([code, name]) => {
				if (typeSet.has(code)) {
					optionsHtml += `<option value="${code}">${name}</option>`;
				}
			});
			// Homebrew types (not in standard list)
			typeSet.forEach(code => {
				if (!standardTypes[code]) {
					const fullName = Parser.optFeatureTypeToFull?.(code) || code;
					optionsHtml += `<option value="${code}">${fullName} (Homebrew)</option>`;
				}
			});
			typeFilter.innerHTML = optionsHtml;
		}

		// Populate source filter
		if (sourceFilter) {
			let sourceOptions = '<option value="">All Sources</option>';
			[...sourceSet].sort().forEach(src => {
				const srcFull = Parser.sourceJsonToFull?.(src) || src;
				sourceOptions += `<option value="${src}">${srcFull}</option>`;
			});
			sourceFilter.innerHTML = sourceOptions;
		}

		const renderFeatureList = () => {
			const typeFilterVal = typeFilter?.value || "";
			const sourceFilterVal = sourceFilter?.value || "";
			const searchTerm = searchInput?.value.toLowerCase() || "";

			let filteredFeatures = allOptionalFeatures.filter(f => {
				if (typeFilterVal && (!f.featureType || !f.featureType.includes(typeFilterVal))) return false;
				if (sourceFilterVal && f.source !== sourceFilterVal) return false;
				if (searchTerm && !f.name.toLowerCase().includes(searchTerm)) return false;
				// Hide already selected
				if (grants.features.some(gf => gf.name === f.name && gf.source === f.source)) return false;
				return true;
			}).slice(0, 30);

			if (!searchTerm && !typeFilterVal && !sourceFilterVal) {
				listContainer.innerHTML = `<div class="custom-abilities__grants-hint">Select a type or search to browse features</div>`;
				return;
			}

			listContainer.innerHTML = filteredFeatures.map(f => {
				const typeStr = f.featureType?.map(ft => Parser.optFeatureTypeToFull?.(ft) || ft).join(", ") || "";
				const srcStr = Parser.sourceJsonToAbv?.(f.source) || f.source || "";
				return `
					<div class="custom-abilities__grants-item" data-name="${f.name}" data-source="${f.source}">
						<div class="custom-abilities__grants-item-info">
							${this._getOptFeatureHoverLink(f)}
							<span class="custom-abilities__grants-item-meta">${typeStr}</span>
							<span class="custom-abilities__grants-item-source">[${srcStr}]</span>
						</div>
						<button type="button" class="btn btn-xs btn-primary custom-abilities__grants-add-btn">Add</button>
					</div>
				`;
			}).join("") || `<div class="custom-abilities__grants-empty">No matching features</div>`;

			// Bind add buttons
			listContainer.querySelectorAll(".custom-abilities__grants-add-btn").forEach(btn => {
				btn.addEventListener("click", (e) => {
					e.preventDefault();
					const item = btn.closest(".custom-abilities__grants-item");
					const name = item.dataset.name;
					const source = item.dataset.source;

					const fullFeature = allOptionalFeatures.find(f => f.name === name && f.source === source);
					if (!grants.features.some(f => f.name === name && f.source === source)) {
						grants.features.push({
							name,
							source,
							featureType: fullFeature?.featureType?.[0] || "",
							entries: fullFeature?.entries,
							description: fullFeature?.entries ? Renderer.get().render({entries: fullFeature.entries}) : "",
						});
					}
					renderFeatureList();
					renderSelectedFeatures();
				});
			});
		};

		const renderSelectedFeatures = () => {
			this._updateGrantCount(modal, "grants-feature-count", grants.features.length);

			if (!grants.features.length) {
				selectedContainer.innerHTML = `<div class="custom-abilities__grants-empty-selected">No features selected</div>`;
				return;
			}

			selectedContainer.innerHTML = grants.features.map(f => {
				const featureData = allOptionalFeatures.find(of => of.name === f.name && of.source === f.source) || f;
				const typeStr = featureData.featureType?.map(ft => Parser.optFeatureTypeToFull?.(ft) || ft).join(", ") || f.featureType || "";
				return `
					<div class="custom-abilities__grants-selected-item" data-name="${f.name}" data-source="${f.source}">
						<div class="custom-abilities__grants-selected-info">
							${this._getOptFeatureHoverLink(featureData)}
							<span class="custom-abilities__grants-item-meta">${typeStr}</span>
						</div>
						<button type="button" class="btn btn-xs btn-danger custom-abilities__grants-remove-btn">&times;</button>
					</div>
				`;
			}).join("");

			// Bind remove buttons
			selectedContainer.querySelectorAll(".custom-abilities__grants-remove-btn").forEach(btn => {
				btn.addEventListener("click", (e) => {
					e.preventDefault();
					const item = btn.closest(".custom-abilities__grants-selected-item");
					const name = item.dataset.name;
					const source = item.dataset.source;
					grants.features = grants.features.filter(f => !(f.name === name && f.source === source));
					renderFeatureList();
					renderSelectedFeatures();
				});
			});
		};

		typeFilter?.addEventListener("change", renderFeatureList);
		sourceFilter?.addEventListener("change", renderFeatureList);
		searchInput?.addEventListener("input", renderFeatureList);

		renderFeatureList();
		renderSelectedFeatures();
	}

	// #endregion
}

// Export for ES modules
export {CharacterSheetCustomAbilities};
