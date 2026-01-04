/**
 * Character Sheet State Management
 * Manages all character data and provides computed values
 */
class CharacterSheetState {
	constructor () {
		this._data = this._getDefaultState();
	}

	_getDefaultState () {
		return {
			id: null,
			name: "",
			race: null,
			subrace: null,
			classes: [], // [{name, source, level, subclass}]
			background: null,

			// Ability scores (base values before racial bonuses)
			abilities: {
				str: 10,
				dex: 10,
				con: 10,
				int: 10,
				wis: 10,
				cha: 10,
			},

			// Ability score bonuses from race, feats, etc.
			abilityBonuses: {
				str: 0,
				dex: 0,
				con: 0,
				int: 0,
				wis: 0,
				cha: 0,
			},

			// HP
			hp: {
				current: 0,
				max: 0,
				temp: 0,
			},

			// Hit dice - keyed by die type
			hitDice: {}, // e.g., {d8: {current: 5, max: 5}, d10: {current: 2, max: 2}}

			// Death saves
			deathSaves: {
				successes: 0,
				failures: 0,
			},

			// Inspiration
			inspiration: false,

			// Proficiencies
			saveProficiencies: [], // ["str", "con"]
			skillProficiencies: {}, // {athletics: 1, stealth: 2} (1 = prof, 2 = expertise)
			armorProficiencies: [],
			weaponProficiencies: [],
			toolProficiencies: [],
			languages: [],

			// AC calculation
			ac: {
				base: 10,
				armor: null,
				shield: false,
				bonuses: [],
				itemBonus: 0, // Bonus from non-armor/shield magic items
			},

			// Item bonuses from equipped/attuned magic items
			itemBonuses: {
				ac: 0,
				savingThrow: 0,
				spellAttack: 0,
				spellSaveDc: 0,
				abilityCheck: 0,
			},

			// Speed
			speed: {
				walk: 30,
				fly: null,
				swim: null,
				climb: null,
				burrow: null,
			},

			// Spellcasting
			spellcasting: {
				ability: null, // "int", "wis", "cha"
				spellSlots: {}, // {1: {current: 4, max: 4}, 2: {current: 3, max: 3}}
				pactSlots: {current: 0, max: 0, level: 0},
				spellsKnown: [], // [{name, source, prepared: bool}]
				cantripsKnown: [],
			},

			// Inventory
			inventory: [], // [{item, quantity, equipped, attuned}]
			currency: {cp: 0, sp: 0, ep: 0, gp: 0, pp: 0},

			// Features and traits
			features: [], // [{name, source, description, uses: {current, max, recharge}}]
			feats: [], // [{name, source}]

			// Attacks (weapons + custom)
			attacks: [], // [{name, attackBonus, damage, damageType, range, properties}]

			// Conditions
			conditions: [],

			// Resources (class features, racial abilities, etc.)
			resources: [], // [{id, name, current, max, recharge: "short"|"long"|"dawn"}]

			// Notes
			notes: {
				personality: "",
				ideals: "",
				bonds: "",
				flaws: "",
				backstory: "",
				notes: "",
			},

			// Appearance
			appearance: {
				age: "",
				height: "",
				weight: "",
				eyes: "",
				skin: "",
				hair: "",
			},

			// Defenses
			resistances: [],
			immunities: [],
			vulnerabilities: [],
			conditionImmunities: [],

			// Custom modifiers
			customModifiers: {
				ac: 0,
				initiative: 0,
				speed: 0,
				savingThrows: {},
				skills: {},
				attackBonus: 0,
				damageBonus: 0,
				spellDc: 0,
				spellAttack: 0,
			},
		};
	}

	// #region Core State Management
	reset () {
		this._data = this._getDefaultState();
	}

	toJson () {
		return MiscUtil.copyFast(this._data);
	}

	// Alias for compatibility with export module
	toJSON () { return this.toJson(); }

	loadFromJson (json) {
		this._data = {
			...this._getDefaultState(),
			...MiscUtil.copyFast(json),
		};

		// Ensure nested objects exist
		this._data.abilities = {...this._getDefaultState().abilities, ...this._data.abilities};
		this._data.abilityBonuses = {...this._getDefaultState().abilityBonuses, ...this._data.abilityBonuses};
		this._data.hp = {...this._getDefaultState().hp, ...this._data.hp};
		this._data.deathSaves = {...this._getDefaultState().deathSaves, ...this._data.deathSaves};
		this._data.speed = {...this._getDefaultState().speed, ...this._data.speed};
		this._data.spellcasting = {...this._getDefaultState().spellcasting, ...this._data.spellcasting};
		this._data.currency = {...this._getDefaultState().currency, ...this._data.currency};
		this._data.notes = {...this._getDefaultState().notes, ...this._data.notes};
		this._data.appearance = {...this._getDefaultState().appearance, ...this._data.appearance};
		this._data.ac = {...this._getDefaultState().ac, ...this._data.ac};
		this._data.customModifiers = {...this._getDefaultState().customModifiers, ...this._data.customModifiers};

		// Migrate features: infer featureType for old saves that don't have it
		this._migrateFeatures();
	}

	_migrateFeatures () {
		if (!this._data.features?.length) return;

		const classNames = (this._data.classes || []).map(c => c.name?.toLowerCase()).filter(Boolean);
		const raceName = this._data.race?.name?.toLowerCase();
		const backgroundName = this._data.background?.name?.toLowerCase();

		this._data.features = this._data.features.map(f => {
			// Already has a featureType, skip
			if (f.featureType) return f;

			// Has className - it's a class feature
			if (f.className) {
				return {...f, featureType: "Class"};
			}

			// Source contains a class name
			if (f.source && classNames.some(cn => f.source.toLowerCase().includes(cn))) {
				return {...f, featureType: "Class"};
			}

			// Source mentions race
			if (f.source && raceName && f.source.toLowerCase().includes(raceName)) {
				return {...f, featureType: "Race"};
			}

			// Source mentions background
			if (f.source && backgroundName && f.source.toLowerCase().includes(backgroundName)) {
				return {...f, featureType: "Background"};
			}

			return f;
		});
	}

	// Alias for compatibility with export module
	fromJSON (json) { return this.loadFromJson(json); }

	// Get all characters - returns array with just this character
	// Note: Multiple character support is handled at the page level via StorageUtil
	getAllCharacters () {
		if (this._data.id) {
			return [this.toJson()];
		}
		return [];
	}

	setId (id) { this._data.id = id; }
	getId () { return this._data.id; }
	// #endregion

	// #region Basic Info
	setName (name) { this._data.name = name; }
	getName () { return this._data.name; }

	setRace (race, subrace = null) {
		this._data.race = race;
		this._data.subrace = subrace;
	}

	getRace () { return this._data.race; }
	getSubrace () { return this._data.subrace; }

	getRaceName () {
		if (!this._data.race) return null;
		const subrace = this._data.subrace?.name ? ` (${this._data.subrace.name})` : "";
		return `${this._data.race.name}${subrace}`;
	}

	setBackground (background) { this._data.background = background; }
	getBackground () { return this._data.background; }
	getBackgroundName () { return this._data.background?.name || null; }

	addClass (classData) {
		const existing = this._data.classes.find(c => c.name === classData.name && c.source === classData.source);
		if (existing) {
			existing.level = classData.level;
			existing.subclass = classData.subclass;
		} else {
			this._data.classes.push({...classData});
		}
		this._recalculateMaxHp();
		this._recalculateHitDice();
	}

	removeClass (className, source) {
		this._data.classes = this._data.classes.filter(c => !(c.name === className && c.source === source));
		this._recalculateMaxHp();
		this._recalculateHitDice();
	}

	getClasses () { return this._data.classes; }

	getClassSummary () {
		if (!this._data.classes.length) return null;
		return this._data.classes
			.map(c => `${c.name} ${c.level}${c.subclass ? ` (${c.subclass.name})` : ""}`)
			.join(" / ");
	}

	getTotalLevel () {
		return this._data.classes.reduce((sum, c) => sum + (c.level || 0), 0) || 1;
	}

	getProficiencyBonus () {
		const level = this.getTotalLevel();
		return Math.floor((level - 1) / 4) + 2;
	}
	// #endregion

	// #region Ability Scores
	setAbilityBase (ability, score) {
		this._data.abilities[ability] = score;
	}

	setAbilityBonus (ability, bonus) {
		this._data.abilityBonuses[ability] = bonus;
	}

	getAbilityScore (ability) {
		return (this._data.abilities[ability] || 10) + (this._data.abilityBonuses[ability] || 0);
	}

	// Alias for compatibility
	getAbilityTotal (ability) {
		return this.getAbilityScore(ability);
	}

	getAbilityMod (ability) {
		return Math.floor((this.getAbilityScore(ability) - 10) / 2);
	}

	getAbilityBase (ability) {
		return this._data.abilities[ability] || 10;
	}

	getAbilityBonus (ability) {
		return this._data.abilityBonuses[ability] || 0;
	}
	// #endregion

	// #region HP
	setCurrentHp (hp) {
		this._data.hp.current = Math.max(0, Math.min(hp, this.getMaxHp()));
	}

	getCurrentHp () { return this._data.hp.current; }

	setMaxHp (hp) { this._data.hp.max = hp; }

	getMaxHp () {
		if (this._data.hp.max > 0) return this._data.hp.max;
		return this._calculateMaxHp();
	}

	_calculateMaxHp () {
		// Calculate based on class hit dice + CON modifier
		let hp = 0;
		const conMod = this.getAbilityMod("con");

		this._data.classes.forEach((cls, idx) => {
			const hitDie = this._getClassHitDie(cls.name);
			for (let i = 0; i < cls.level; i++) {
				if (idx === 0 && i === 0) {
					// First level of first class: max hit die
					hp += hitDie + conMod;
				} else {
					// Subsequent levels: average (rounded up)
					hp += Math.ceil(hitDie / 2) + 1 + conMod;
				}
			}
		});

		return Math.max(1, hp);
	}

	_recalculateMaxHp () {
		const calculated = this._calculateMaxHp();
		if (this._data.hp.max === 0 || this._data.hp.max === calculated) {
			this._data.hp.max = calculated;
		}
		// If current HP exceeds max, cap it
		if (this._data.hp.current > this._data.hp.max) {
			this._data.hp.current = this._data.hp.max;
		}
	}

	setTempHp (hp) { this._data.hp.temp = Math.max(0, hp); }
	getTempHp () { return this._data.hp.temp; }

	// Unified HP methods for rest.js compatibility
	heal (amount) {
		const maxHp = this.getMaxHp();
		this._data.hp.current = Math.min(maxHp, this._data.hp.current + amount);
	}

	getHp () {
		return {
			current: this._data.hp.current,
			max: this.getMaxHp(),
			temp: this._data.hp.temp,
		};
	}

	setHp (current, max, temp) {
		this._data.hp.current = Math.max(0, current);
		if (max !== undefined) this._data.hp.max = max;
		if (temp !== undefined) this._data.hp.temp = Math.max(0, temp);
	}
	// #endregion

	// #region Hit Dice
	_getClassHitDie (className) {
		const hitDice = {
			"Barbarian": 12,
			"Fighter": 10,
			"Paladin": 10,
			"Ranger": 10,
			"Bard": 8,
			"Cleric": 8,
			"Druid": 8,
			"Monk": 8,
			"Rogue": 8,
			"Warlock": 8,
			"Sorcerer": 6,
			"Wizard": 6,
			"Artificer": 8,
			"Blood Hunter": 10,
		};
		return hitDice[className] || 8;
	}

	_recalculateHitDice () {
		const hitDice = {};
		this._data.classes.forEach(cls => {
			const dieType = `d${this._getClassHitDie(cls.name)}`;
			if (!hitDice[dieType]) {
				hitDice[dieType] = {current: 0, max: 0};
			}
			hitDice[dieType].max += cls.level;
			hitDice[dieType].current = Math.min(
				hitDice[dieType].current + cls.level,
				hitDice[dieType].max,
			);
		});
		this._data.hitDice = hitDice;
	}

	getHitDice () {
		// Return hit dice as an array [{type, die, className, current, max}, ...]
		const types = Object.keys(this._data.hitDice);

		if (types.length === 0) {
			// Default to d8 for total level if no classes yet
			return [{type: "d8", die: 8, className: "Unknown", current: this.getTotalLevel(), max: this.getTotalLevel()}];
		}

		// Build hit dice with class names
		const result = [];
		types.forEach(type => {
			const dieSize = parseInt(type.replace("d", ""));
			// Find class(es) that use this die
			const classNames = this._data.classes
				.filter(cls => this._getClassHitDie(cls.name) === dieSize)
				.map(cls => cls.name);
			
			result.push({
				type,
				die: dieSize,
				className: classNames.join("/") || "Unknown",
				current: this._data.hitDice[type].current,
				max: this._data.hitDice[type].max,
			});
		});

		return result;
	}

	getHitDiceSummary () {
		// Return combined hit dice info as single object
		let total = {current: 0, max: 0, type: "d8"};
		const types = Object.keys(this._data.hitDice);

		if (types.length === 0) {
			return {current: this.getTotalLevel(), max: this.getTotalLevel(), type: "d8"};
		}

		types.forEach(type => {
			total.current += this._data.hitDice[type].current;
			total.max += this._data.hitDice[type].max;
		});

		// Primary type is the one with most dice
		total.type = types.reduce((a, b) =>
			(this._data.hitDice[a]?.max || 0) >= (this._data.hitDice[b]?.max || 0) ? a : b,
		);

		return total;
	}

	getHitDiceByType () {
		return {...this._data.hitDice};
	}

	useHitDie (dieType = null) {
		if (!dieType) {
			// Use the first available hit die
			const types = Object.keys(this._data.hitDice);
			for (const type of types) {
				if (this._data.hitDice[type].current > 0) {
					dieType = type;
					break;
				}
			}
		}

		if (dieType && this._data.hitDice[dieType]?.current > 0) {
			this._data.hitDice[dieType].current--;
			return true;
		}
		return false;
	}

	recoverHitDice (amount = null) {
		// Recover hit dice (usually half total level on long rest)
		const totalLevel = this.getTotalLevel();
		const toRecover = amount ?? Math.max(1, Math.floor(totalLevel / 2));

		let remaining = toRecover;
		for (const type of Object.keys(this._data.hitDice)) {
			const hd = this._data.hitDice[type];
			const canRecover = Math.min(remaining, hd.max - hd.current);
			hd.current += canRecover;
			remaining -= canRecover;
			if (remaining <= 0) break;
		}
	}

	setHitDice (hitDiceArray) {
		// Convert array format [{type, current, max}, ...] to object format {d8: {current, max}, ...}
		if (Array.isArray(hitDiceArray)) {
			this._data.hitDice = {};
			hitDiceArray.forEach(hd => {
				this._data.hitDice[hd.type] = {current: hd.current, max: hd.max};
			});
		} else {
			this._data.hitDice = {...hitDiceArray};
		}
	}
	// #endregion

	// #region Death Saves
	getDeathSaves () { return {...this._data.deathSaves}; }

	setDeathSaves (successesOrObj, failures) {
		// Support both (obj) and (successes, failures) signatures
		if (typeof successesOrObj === "object") {
			this._data.deathSaves.successes = Math.min(3, Math.max(0, successesOrObj.successes || 0));
			this._data.deathSaves.failures = Math.min(3, Math.max(0, successesOrObj.failures || 0));
		} else {
			this._data.deathSaves.successes = Math.min(3, Math.max(0, successesOrObj));
			this._data.deathSaves.failures = Math.min(3, Math.max(0, failures));
		}
	}

	resetDeathSaves () {
		this._data.deathSaves = {successes: 0, failures: 0};
	}
	// #endregion

	// #region Inspiration
	hasInspiration () { return this._data.inspiration; }
	setInspiration (value) { this._data.inspiration = value; }
	toggleInspiration () { this._data.inspiration = !this._data.inspiration; }
	// #endregion

	// #region Saving Throws
	addSaveProficiency (ability) {
		if (!this._data.saveProficiencies.includes(ability)) {
			this._data.saveProficiencies.push(ability);
		}
	}

	removeSaveProficiency (ability) {
		this._data.saveProficiencies = this._data.saveProficiencies.filter(a => a !== ability);
	}

	hasSaveProficiency (ability) {
		return this._data.saveProficiencies.includes(ability);
	}

	getSaveMod (ability) {
		const mod = this.getAbilityMod(ability);
		const prof = this.hasSaveProficiency(ability) ? this.getProficiencyBonus() : 0;
		const custom = this._data.customModifiers.savingThrows[ability] || 0;
		// Add item bonuses (general saving throw bonus from magic items)
		const itemBonus = this._data.itemBonuses?.savingThrow || 0;
		return mod + prof + custom + itemBonus;
	}
	// #endregion

	// #region Skills
	setSkillProficiency (skill, level) {
		// 0 = none, 1 = proficient, 2 = expertise
		if (level === 0) {
			delete this._data.skillProficiencies[skill];
		} else {
			this._data.skillProficiencies[skill] = level;
		}
	}

	// Alias for compatibility with levelup module
	addSkillProficiency (skill) { this.setSkillProficiency(skill, 1); }

	getSkillProficiency (skill) {
		return this._data.skillProficiencies[skill] || 0;
	}

	getSkillMod (skill) {
		const skillAbilities = {
			acrobatics: "dex",
			animalhandling: "wis",
			arcana: "int",
			athletics: "str",
			deception: "cha",
			history: "int",
			insight: "wis",
			intimidation: "cha",
			investigation: "int",
			medicine: "wis",
			nature: "int",
			perception: "wis",
			performance: "cha",
			persuasion: "cha",
			religion: "int",
			sleightofhand: "dex",
			stealth: "dex",
			survival: "wis",
		};

		const ability = skillAbilities[skill] || "str";
		const mod = this.getAbilityMod(ability);
		const profLevel = this.getSkillProficiency(skill);
		const profBonus = profLevel * this.getProficiencyBonus();
		const custom = this._data.customModifiers.skills[skill] || 0;
		// Add item bonuses (ability check bonus from magic items)
		const itemBonus = this._data.itemBonuses?.abilityCheck || 0;

		return mod + profBonus + custom + itemBonus;
	}
	// #endregion

	// #region AC
	getAc () {
		let ac = this._data.ac.base;
		const dexMod = this.getAbilityMod("dex");

		// Check for Unarmored Defense class features
		const hasUnarmoredDefense = this._hasUnarmoredDefense();

		// If wearing armor, use armor AC calculation
		if (this._data.ac.armor) {
			ac = this._data.ac.armor.ac || 10;
			// Add DEX modifier (limited by armor type)
			if (this._data.ac.armor.type === "light") {
				ac += dexMod;
			} else if (this._data.ac.armor.type === "medium") {
				ac += Math.min(2, dexMod);
			}
			// Heavy armor: no DEX bonus
		} else if (hasUnarmoredDefense) {
			// Unarmored Defense calculation based on class
			ac = this._calculateUnarmoredDefenseAc();
		} else {
			// Standard unarmored: 10 + DEX
			ac = 10 + dexMod;
		}

		// Shield (only add if not using Monk unarmored defense which doesn't work with shields)
		if (this._data.ac.shield) {
			const isMonkUnarmored = !this._data.ac.armor && this._hasMonkUnarmoredDefense();
			if (!isMonkUnarmored) {
				// Base shield bonus is 2, plus any magic bonus
				const baseShieldBonus = 2;
				const magicBonus = (typeof this._data.ac.shield === "object") ? (this._data.ac.shield.bonus || 0) : 0;
				ac += baseShieldBonus + magicBonus;
			}
		}

		// Bonuses from other equipped magic items (e.g., Cloak of Protection, Ring of Protection)
		// Note: Armor and shield bonuses are already included above, this is for OTHER items
		ac += this._data.ac.itemBonus || 0;

		// Custom bonuses
		ac += this._data.customModifiers.ac || 0;

		// Other bonuses
		this._data.ac.bonuses.forEach(bonus => {
			ac += bonus.value || 0;
		});

		return ac;
	}

	_hasUnarmoredDefense () {
		return this._hasBarbarianUnarmoredDefense() || this._hasMonkUnarmoredDefense();
	}

	_hasBarbarianUnarmoredDefense () {
		return this._data.classes.some(c => c.name === "Barbarian");
	}

	_hasMonkUnarmoredDefense () {
		return this._data.classes.some(c => c.name === "Monk");
	}

	_calculateUnarmoredDefenseAc () {
		const dexMod = this.getAbilityMod("dex");

		// Barbarian: 10 + DEX + CON
		if (this._hasBarbarianUnarmoredDefense()) {
			const conMod = this.getAbilityMod("con");
			return 10 + dexMod + conMod;
		}

		// Monk: 10 + DEX + WIS (no shield)
		if (this._hasMonkUnarmoredDefense()) {
			const wisMod = this.getAbilityMod("wis");
			return 10 + dexMod + wisMod;
		}

		return 10 + dexMod;
	}

	// Alias for compatibility with export module
	getArmorClass () { return this.getAc(); }

	setBaseAc (ac) { this._data.ac.base = ac; }
	setArmor (armor) { this._data.ac.armor = armor; }
	setShield (hasShield) { this._data.ac.shield = hasShield; }
	setItemAcBonus (bonus) { this._data.ac.itemBonus = bonus || 0; }
	getItemAcBonus () { return this._data.ac.itemBonus || 0; }

	// Item bonuses from equipped/attuned magic items
	setItemBonuses (bonuses) { this._data.itemBonuses = bonuses || {}; }
	getItemBonuses () { return this._data.itemBonuses || {}; }
	getItemBonus (type) { return this._data.itemBonuses?.[type] || 0; }
	// #endregion

	// #region Speed
	getSpeed () {
		const walk = (this._data.speed.walk || 30) + (this._data.customModifiers.speed || 0);
		const parts = [`${walk} ft.`];

		if (this._data.speed.fly) parts.push(`fly ${this._data.speed.fly} ft.`);
		if (this._data.speed.swim) parts.push(`swim ${this._data.speed.swim} ft.`);
		if (this._data.speed.climb) parts.push(`climb ${this._data.speed.climb} ft.`);
		if (this._data.speed.burrow) parts.push(`burrow ${this._data.speed.burrow} ft.`);

		return parts.join(", ");
	}

	setSpeed (type, value) {
		this._data.speed[type] = value;
	}

	getWalkSpeed () {
		return (this._data.speed.walk || 30) + (this._data.customModifiers.speed || 0);
	}
	// #endregion

	// #region Initiative
	getInitiative () {
		return this.getAbilityMod("dex") + (this._data.customModifiers.initiative || 0);
	}
	// #endregion

	// #region Proficiencies
	getProficiencies () {
		return {
			armor: [...this._data.armorProficiencies],
			weapons: [...this._data.weaponProficiencies],
			tools: [...this._data.toolProficiencies],
			languages: [...this._data.languages],
		};
	}

	getArmorProficiencies () { return [...this._data.armorProficiencies]; }
	getWeaponProficiencies () { return [...this._data.weaponProficiencies]; }
	getToolProficiencies () { return [...this._data.toolProficiencies]; }
	getLanguages () { return [...this._data.languages]; }
	getSaveProficiencies () { return [...this._data.saveProficiencies]; }

	addArmorProficiency (armor) {
		if (!this._data.armorProficiencies.includes(armor)) {
			this._data.armorProficiencies.push(armor);
		}
	}

	addWeaponProficiency (weapon) {
		if (!this._data.weaponProficiencies.includes(weapon)) {
			this._data.weaponProficiencies.push(weapon);
		}
	}

	addToolProficiency (tool) {
		if (!this._data.toolProficiencies.includes(tool)) {
			this._data.toolProficiencies.push(tool);
		}
	}

	addLanguage (language) {
		if (!this._data.languages.includes(language)) {
			this._data.languages.push(language);
		}
	}
	// #endregion

	// #region Spellcasting
	getSpellcasting () { return this._data.spellcasting; }
	getSpellcastingAbility () { return this._data.spellcasting.ability; }
	setSpellcastingAbility (ability) { this._data.spellcasting.ability = ability; }

	getSpellSaveDc () {
		const ability = this._data.spellcasting.ability;
		if (!ability) return null;
		// Add item bonuses (spell save DC bonus from magic items)
		const itemBonus = this._data.itemBonuses?.spellSaveDc || 0;
		return 8 + this.getProficiencyBonus() + this.getAbilityMod(ability) + (this._data.customModifiers.spellDc || 0) + itemBonus;
	}

	getSpellAttackBonus () {
		const ability = this._data.spellcasting.ability;
		if (!ability) return null;
		// Add item bonuses (spell attack bonus from magic items)
		const itemBonus = this._data.itemBonuses?.spellAttack || 0;
		return this.getProficiencyBonus() + this.getAbilityMod(ability) + (this._data.customModifiers.spellAttack || 0) + itemBonus;
	}

	/**
	 * Get spellcasting info for the character - whether they use spells known or prepared
	 * Reads progression directly from class data when available
	 * @returns {{type: string, max: number, cantripsKnown: number}} or null if no spellcasting
	 */
	getSpellcastingInfo () {
		const classes = this._data.classes || [];
		if (!classes.length) return null;

		const primaryClass = classes[0];
		const className = primaryClass.name;
		const level = primaryClass.level || 1;
		const levelIndex = Math.min(level, 20) - 1;
		const classData = primaryClass._classData; // Full class data if available

		// Try to get progression from class data first (supports 2024 and homebrew)
		if (classData) {
			const cantripsKnown = classData.cantripProgression?.[levelIndex] || 0;

			// 2024 rules use preparedSpellsProgression for all casters
			if (classData.preparedSpellsProgression) {
				return {
					type: "prepared",
					max: classData.preparedSpellsProgression[levelIndex] || 0,
					cantripsKnown,
				};
			}

			// 2014 rules use spellsKnownProgression for some casters
			if (classData.spellsKnownProgression) {
				return {
					type: "known",
					max: classData.spellsKnownProgression[levelIndex] || 0,
					cantripsKnown,
				};
			}

			// Check for prepared caster without explicit progression (2014 Cleric, Druid, etc.)
			if (classData.casterProgression && classData.spellcastingAbility) {
				// These use level + ability mod formula
				const ability = classData.spellcastingAbility;
				const abilityMod = this.getAbilityMod(ability);
				let preparedCount;

				if (classData.casterProgression === "1/2") {
					// Half casters: half level + mod
					preparedCount = Math.max(1, Math.floor(level / 2) + abilityMod);
				} else {
					// Full casters: level + mod
					preparedCount = Math.max(1, level + abilityMod);
				}

				return {
					type: "prepared",
					max: preparedCount,
					cantripsKnown,
				};
			}
		}

		// Fallback: hardcoded tables for when class data isn't available
		// Spells Known tables (2014 rules)
		const spellsKnownTables = {
			"Bard": [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
			"Sorcerer": [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
			"Warlock": [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
			"Ranger": [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
		};

		// Cantrips known
		const cantripsKnownTables = {
			"Bard": [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			"Cleric": [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
			"Druid": [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			"Sorcerer": [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
			"Warlock": [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			"Wizard": [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
		};

		// Prepared casters (2014 rules)
		const preparedCasters = ["Cleric", "Druid", "Paladin", "Wizard", "Artificer"];

		// Get cantrips known
		let cantripsKnown = cantripsKnownTables[className]?.[levelIndex] || 0;

		// Check if spells known class
		if (spellsKnownTables[className]) {
			return {
				type: "known",
				max: spellsKnownTables[className][levelIndex],
				cantripsKnown,
			};
		}

		// Check if prepared caster
		if (preparedCasters.includes(className)) {
			const abilityMap = {
				"Cleric": "wis",
				"Druid": "wis",
				"Paladin": "cha",
				"Wizard": "int",
				"Artificer": "int",
			};

			const ability = abilityMap[className];
			const abilityMod = this.getAbilityMod(ability);

			let preparedCount;
			if (className === "Paladin") {
				preparedCount = Math.max(1, Math.floor(level / 2) + abilityMod);
			} else if (className === "Artificer") {
				preparedCount = Math.max(1, Math.ceil(level / 2) + abilityMod);
			} else {
				preparedCount = Math.max(1, level + abilityMod);
			}

			return {
				type: "prepared",
				max: preparedCount,
				cantripsKnown,
			};
		}

		// Check for third-caster subclasses
		const subclassName = primaryClass.subclass?.name;
		if (subclassName === "Eldritch Knight" || subclassName === "Arcane Trickster") {
			const ekAtSpellsKnown = [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13];
			return {
				type: "known",
				max: ekAtSpellsKnown[levelIndex],
				cantripsKnown: level >= 3 ? (level >= 10 ? 3 : 2) : 0,
			};
		}

		return null;
	}

	getSpellSlots () { return MiscUtil.copyFast(this._data.spellcasting.spellSlots); }

	getSpellSlotsCurrent (level) {
		const slot = this._data.spellcasting.spellSlots[level];
		return slot ? slot.current : 0;
	}

	getSpellSlotsMax (level) {
		const slot = this._data.spellcasting.spellSlots[level];
		return slot ? slot.max : 0;
	}

	getPactSlots () {
		return this._data.spellcasting.pactSlots || {current: 0, max: 0, level: 0};
	}

	setPactSlotsCurrent (current) {
		if (this._data.spellcasting.pactSlots) {
			this._data.spellcasting.pactSlots.current = Math.max(0, Math.min(current, this._data.spellcasting.pactSlots.max));
		}
	}

	usePactSlot () {
		const pact = this._data.spellcasting.pactSlots;
		if (pact && pact.current > 0) {
			pact.current--;
			return true;
		}
		return false;
	}

	setSpellSlots (level, max, current = max) {
		this._data.spellcasting.spellSlots[level] = {current, max};
	}

	/**
	 * Calculate spell slots based on class(es) and level using standard 5e spell slot progression
	 * Handles full casters, half casters, third casters, and multiclassing
	 */
	calculateSpellSlots () {
		const classes = this._data.classes || [];
		if (!classes.length) return;

		// Full casters
		const fullCasters = ["Bard", "Cleric", "Druid", "Sorcerer", "Wizard"];
		// Half casters (round down)
		const halfCasters = ["Paladin", "Ranger", "Artificer"];
		// Warlock is special - has pact slots instead

		// Calculate total caster level (for multiclassing)
		let casterLevel = 0;
		let isWarlock = false;
		let warlockLevel = 0;

		for (const cls of classes) {
			const className = cls.name;
			const level = cls.level || 1;

			if (className === "Warlock") {
				isWarlock = true;
				warlockLevel = level;
			} else if (fullCasters.includes(className)) {
				casterLevel += level;
			} else if (halfCasters.includes(className)) {
				// Half casters need level 2 to start contributing
				casterLevel += Math.floor(level / 2);
			} else {
				// Check for third-caster subclasses (Eldritch Knight, Arcane Trickster)
				const subclassName = cls.subclass?.name;
				if (subclassName === "Eldritch Knight" || subclassName === "Arcane Trickster") {
					casterLevel += Math.floor(level / 3);
				}
			}
		}

		// Standard spell slot progression table (by caster level)
		const slotTable = {
			1:  [2, 0, 0, 0, 0, 0, 0, 0, 0],
			2:  [3, 0, 0, 0, 0, 0, 0, 0, 0],
			3:  [4, 2, 0, 0, 0, 0, 0, 0, 0],
			4:  [4, 3, 0, 0, 0, 0, 0, 0, 0],
			5:  [4, 3, 2, 0, 0, 0, 0, 0, 0],
			6:  [4, 3, 3, 0, 0, 0, 0, 0, 0],
			7:  [4, 3, 3, 1, 0, 0, 0, 0, 0],
			8:  [4, 3, 3, 2, 0, 0, 0, 0, 0],
			9:  [4, 3, 3, 3, 1, 0, 0, 0, 0],
			10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
			11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
			12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
			13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
			14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
			15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
			16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
			17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
			18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
			19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
			20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
		};

		// Set slots based on caster level
		if (casterLevel > 0) {
			const slots = slotTable[Math.min(casterLevel, 20)] || [0, 0, 0, 0, 0, 0, 0, 0, 0];
			for (let level = 1; level <= 9; level++) {
				const max = slots[level - 1];
				// Preserve current usage if already set with same max
				const existing = this._data.spellcasting.spellSlots[level];
				if (existing && existing.max === max) {
					// Keep current value
				} else {
					this._data.spellcasting.spellSlots[level] = {current: max, max: max};
				}
			}
		}

		// Handle Warlock pact slots separately (they use different progression)
		// Warlock pact slots are in addition to regular spell slots for multiclass
		if (isWarlock && warlockLevel > 0) {
			// Pact Magic slot progression table
			// [number of slots, slot level]
			const pactSlotTable = {
				1:  [1, 1],
				2:  [2, 1],
				3:  [2, 2],
				4:  [2, 2],
				5:  [2, 3],
				6:  [2, 3],
				7:  [2, 4],
				8:  [2, 4],
				9:  [2, 5],
				10: [2, 5],
				11: [3, 5],
				12: [3, 5],
				13: [3, 5],
				14: [3, 5],
				15: [3, 5],
				16: [3, 5],
				17: [4, 5],
				18: [4, 5],
				19: [4, 5],
				20: [4, 5],
			};

			const [pactSlots, pactLevel] = pactSlotTable[Math.min(warlockLevel, 20)] || [0, 0];
			const existing = this._data.spellcasting.pactSlots;
			
			if (existing && existing.max === pactSlots && existing.level === pactLevel) {
				// Keep current value
			} else {
				this._data.spellcasting.pactSlots = {
					current: pactSlots,
					max: pactSlots,
					level: pactLevel,
				};
			}
		} else {
			// Reset pact slots if not a warlock
			this._data.spellcasting.pactSlots = {current: 0, max: 0, level: 0};
		}
	}

	setSpellSlotCurrent (level, current) {
		if (this._data.spellcasting.spellSlots[level]) {
			this._data.spellcasting.spellSlots[level].current = Math.max(0, Math.min(current, this._data.spellcasting.spellSlots[level].max));
		}
	}

	useSpellSlot (level) {
		const slot = this._data.spellcasting.spellSlots[level];
		if (slot && slot.current > 0) {
			slot.current--;
			return true;
		}
		return false;
	}

	recoverSpellSlots () {
		for (const level of Object.keys(this._data.spellcasting.spellSlots)) {
			this._data.spellcasting.spellSlots[level].current = this._data.spellcasting.spellSlots[level].max;
		}
	}

	getSpells () {
		// Return spells with IDs for easier manipulation
		const spells = this._data.spellcasting.spellsKnown.map(s => ({
			...s,
			id: s.id || `${s.name}|${s.source}`,
		}));
		const cantrips = this._data.spellcasting.cantripsKnown.map(c => ({
			...c,
			id: c.id || `${c.name}|${c.source}`,
			level: 0,
			prepared: true, // Cantrips are always prepared
		}));
		return [...cantrips, ...spells];
	}
	getSpellsKnown () { return [...this._data.spellcasting.spellsKnown]; }
	getCantripsKnown () { return [...this._data.spellcasting.cantripsKnown]; }

	addSpell (spell, prepared = false) {
		// Check if it's a cantrip
		if (spell.level === 0) {
			this.addCantrip(spell);
			return;
		}

		const existing = this._data.spellcasting.spellsKnown.find(
			s => s.name === spell.name && s.source === spell.source,
		);
		if (!existing) {
			this._data.spellcasting.spellsKnown.push({
				id: CryptUtil.uid(),
				name: spell.name,
				source: spell.source,
				level: spell.level,
				school: spell.school,
				ritual: spell.ritual || false,
				concentration: spell.concentration || false,
				prepared: prepared !== undefined ? prepared : spell.prepared,
			});
		}
	}

	addCantrip (spell) {
		const existing = this._data.spellcasting.cantripsKnown.find(
			s => s.name === spell.name && s.source === spell.source,
		);
		if (!existing) {
			this._data.spellcasting.cantripsKnown.push({
				id: CryptUtil.uid(),
				name: spell.name,
				source: spell.source,
				school: spell.school,
			});
		}
	}

	removeSpell (spellIdOrName, source) {
		// Support both ID-based and name/source removal
		this._data.spellcasting.spellsKnown = this._data.spellcasting.spellsKnown.filter(s => {
			if (s.id === spellIdOrName) return false;
			if (s.name === spellIdOrName && s.source === source) return false;
			return true;
		});
		// Also check cantrips
		this._data.spellcasting.cantripsKnown = this._data.spellcasting.cantripsKnown.filter(s => {
			if (s.id === spellIdOrName) return false;
			if (s.name === spellIdOrName && s.source === source) return false;
			return true;
		});
	}

	setSpellPrepared (spellIdOrName, sourceOrPrepared, prepared) {
		// Support both (id, prepared) and (name, source, prepared) signatures
		let spell;
		if (prepared === undefined) {
			// Called as (id, prepared)
			spell = this._data.spellcasting.spellsKnown.find(s => s.id === spellIdOrName);
			prepared = sourceOrPrepared;
		} else {
			// Called as (name, source, prepared)
			spell = this._data.spellcasting.spellsKnown.find(
				s => s.name === spellIdOrName && s.source === sourceOrPrepared,
			);
		}
		if (spell) spell.prepared = prepared;
	}
	// #endregion

	// #region Inventory
	getInventory () { return [...this._data.inventory]; }

	/**
	 * Returns flattened items for display - merges item data with inventory metadata
	 */
	getItems () {
		return this._data.inventory.map(invItem => ({
			id: invItem.id,
			...invItem.item,
			quantity: invItem.quantity,
			equipped: invItem.equipped,
			attuned: invItem.attuned,
		}));
	}

	addItem (item, quantity = 1, equipped = false, attuned = false) {
		// Handle flat item structure (from inventory module)
		if (item.quantity !== undefined) {
			quantity = item.quantity;
			equipped = item.equipped || false;
			attuned = item.attuned || false;
		}

		const existing = this._data.inventory.find(
			i => i.item.name === item.name && i.item.source === item.source && !i.item._isCustom,
		);
		if (existing) {
			existing.quantity += quantity;
		} else {
			// Extract item properties, excluding wrapper properties
			const {quantity: _q, equipped: _e, attuned: _a, ...itemProps} = item;
			this._data.inventory.push({
				id: CryptUtil.uid(),
				item: {...itemProps},
				quantity,
				equipped,
				attuned,
			});
		}
	}

	removeItem (itemId) {
		this._data.inventory = this._data.inventory.filter(i => i.id !== itemId);
	}

	setItemQuantity (itemId, quantity) {
		const item = this._data.inventory.find(i => i.id === itemId);
		if (item) {
			if (quantity <= 0) {
				this.removeItem(itemId);
			} else {
				item.quantity = quantity;
			}
		}
	}

	setItemEquipped (itemId, equipped) {
		const item = this._data.inventory.find(i => i.id === itemId);
		if (item) item.equipped = equipped;
	}

	setItemAttuned (itemId, attuned) {
		const item = this._data.inventory.find(i => i.id === itemId);
		if (item) item.attuned = attuned;
	}

	setItemCharges (itemId, charges) {
		const item = this._data.inventory.find(i => i.id === itemId);
		if (item && item.item.charges) {
			item.item.chargesCurrent = Math.max(0, Math.min(charges, item.item.charges));
		}
	}

	getAttunedCount () {
		return this._data.inventory.filter(i => i.attuned).length;
	}

	/**
	 * Get maximum number of items a character can attune to.
	 * Base is 3, but Artificer gets more:
	 * - Level 10 (Magic Item Adept): 4 items
	 * - Level 14 (Magic Item Savant): 5 items
	 * - Level 18 (Soul of Artifice): 6 items
	 * @returns {number} Maximum attunement slots
	 */
	getMaxAttunement () {
		let max = 3; // Default max attunement

		// Check for Artificer class levels
		const artificerClass = this._data.classes?.find(c => c.name?.toLowerCase() === "artificer");
		if (artificerClass) {
			const level = artificerClass.level || 0;
			if (level >= 18) {
				max = 6; // Soul of Artifice
			} else if (level >= 14) {
				max = 5; // Magic Item Savant
			} else if (level >= 10) {
				max = 4; // Magic Item Adept
			}
		}

		return max;
	}

	getTotalWeight () {
		return this._data.inventory.reduce((sum, i) => {
			const weight = i.item.weight || 0;
			return sum + (weight * i.quantity);
		}, 0);
	}

	getCarryingCapacity () {
		return this.getAbilityScore("str") * 15;
	}
	// #endregion

	// #region Currency
	/**
	 * Get currency - if type is provided returns that amount, otherwise returns the whole object
	 */
	getCurrency (type) {
		if (type === undefined) return {...this._data.currency};
		return this._data.currency[type] || 0;
	}
	setCurrency (type, amount) { this._data.currency[type] = Math.max(0, amount); }

	getTotalGold () {
		return (
			this._data.currency.pp * 10 +
			this._data.currency.gp +
			this._data.currency.ep * 0.5 +
			this._data.currency.sp * 0.1 +
			this._data.currency.cp * 0.01
		);
	}
	// #endregion

	// #region Attacks
	getAttacks () { return [...this._data.attacks]; }

	addAttack (attack) {
		this._data.attacks.push({
			id: CryptUtil.uid(),
			...attack,
		});
	}

	updateAttack (attack) {
		const idx = this._data.attacks.findIndex(a => a.id === attack.id);
		if (idx >= 0) {
			this._data.attacks[idx] = {...attack};
		}
	}

	removeAttack (attackId) {
		this._data.attacks = this._data.attacks.filter(a => a.id !== attackId);
	}

	updateAttackFromWeapon (item) {
		// Calculate attack bonus and damage for a weapon
		const isFinesse = item.property?.includes("F");
		const isRanged = item.type === "R" || item.property?.includes("T");

		let abilityMod;
		if (isFinesse) {
			abilityMod = Math.max(this.getAbilityMod("str"), this.getAbilityMod("dex"));
		} else if (isRanged) {
			abilityMod = this.getAbilityMod("dex");
		} else {
			abilityMod = this.getAbilityMod("str");
		}

		const profBonus = this._isWeaponProficient(item) ? this.getProficiencyBonus() : 0;
		const attackBonus = abilityMod + profBonus + (this._data.customModifiers.attackBonus || 0);

		const damageDie = item.dmg1 || "1d4";
		const damageBonus = abilityMod + (this._data.customModifiers.damageBonus || 0);
		const damage = `${damageDie}${damageBonus >= 0 ? "+" : ""}${damageBonus}`;

		return {
			name: item.name,
			attackBonus,
			damage,
			damageType: item.dmgType || "bludgeoning",
			range: item.range || (isRanged ? "80/320 ft." : "5 ft."),
			properties: item.property || [],
		};
	}

	_isWeaponProficient (weapon) {
		// Check simple/martial proficiency
		if (weapon.weaponCategory === "simple" && this._data.weaponProficiencies.includes("simple")) {
			return true;
		}
		if (weapon.weaponCategory === "martial" && this._data.weaponProficiencies.includes("martial")) {
			return true;
		}
		// Check specific weapon proficiency
		return this._data.weaponProficiencies.some(
			p => p.toLowerCase() === weapon.name?.toLowerCase(),
		);
	}
	// #endregion

	// #region Conditions
	getConditions () { return [...this._data.conditions]; }

	addCondition (condition) {
		if (!this._data.conditions.includes(condition)) {
			this._data.conditions.push(condition);
		}
	}

	removeCondition (condition) {
		this._data.conditions = this._data.conditions.filter(c => c !== condition);
	}

	clearConditions () {
		this._data.conditions = [];
	}

	setConditions (conditions) {
		this._data.conditions = [...conditions];
	}
	// #endregion

	// #region Resources
	getResources () { return [...this._data.resources]; }

	addResource (resource) {
		this._data.resources.push({
			id: CryptUtil.uid(),
			current: resource.max,
			...resource,
		});
	}

	setResourceCurrent (resourceId, current) {
		const resource = this._data.resources.find(r => r.id === resourceId);
		if (resource) {
			resource.current = Math.max(0, Math.min(current, resource.max));
		}
	}

	recoverResources (rechargeType) {
		this._data.resources.forEach(r => {
			if (r.recharge === rechargeType || (rechargeType === "long" && r.recharge === "short")) {
				r.current = r.max;
			}
		});
	}
	// #endregion

	// #region Features
	getFeatures () {
		return this._data.features.map(f => ({
			...f,
			id: f.id || CryptUtil.uid(),
		}));
	}

	addFeature (feature) {
		this._data.features.push({
			id: CryptUtil.uid(),
			...feature,
		});
	}

	removeFeature (featureIdOrName, source) {
		// Support both ID-based and name/source removal
		this._data.features = this._data.features.filter(f => {
			if (f.id === featureIdOrName) return false;
			if (f.name === featureIdOrName && f.source === source) return false;
			return true;
		});
	}

	setFeatureUses (featureId, current) {
		const feature = this._data.features.find(f => f.id === featureId);
		if (feature?.uses) {
			feature.uses.current = current;
		}
	}

	getFeats () {
		return this._data.feats.map(f => ({
			...f,
			id: f.id || `${f.name}|${f.source}`,
		}));
	}

	addFeat (feat) {
		if (!this._data.feats.find(f => f.name === feat.name && f.source === feat.source)) {
			this._data.feats.push({
				id: CryptUtil.uid(),
				name: feat.name,
				source: feat.source,
				description: feat.description,
			});
		}
	}

	removeFeat (featIdOrName, source) {
		// Support both ID-based and name/source removal
		this._data.feats = this._data.feats.filter(f => {
			if (f.id === featIdOrName) return false;
			if (f.name === featIdOrName && f.source === source) return false;
			return true;
		});
	}
	// #endregion

	// #region Defenses
	getResistances () { return [...this._data.resistances]; }
	getImmunities () { return [...this._data.immunities]; }
	getVulnerabilities () { return [...this._data.vulnerabilities]; }

	addResistance (type) {
		if (!this._data.resistances.includes(type)) {
			this._data.resistances.push(type);
		}
	}

	addImmunity (type) {
		if (!this._data.immunities.includes(type)) {
			this._data.immunities.push(type);
		}
	}

	addVulnerability (type) {
		if (!this._data.vulnerabilities.includes(type)) {
			this._data.vulnerabilities.push(type);
		}
	}
	// #endregion

	// #region Notes
	getNote (field) { return this._data.notes[field] || ""; }
	setNote (field, value) { this._data.notes[field] = value; }
	// #endregion

	// #region Appearance
	getAppearance (field) { return this._data.appearance[field] || ""; }
	setAppearance (field, value) { this._data.appearance[field] = value; }
	// #endregion

	// #region Rest
	onShortRest () {
		// Recover short rest resources
		this.recoverResources("short");

		// Warlock pact slots
		if (this._data.spellcasting.pactSlots.max > 0) {
			this._data.spellcasting.pactSlots.current = this._data.spellcasting.pactSlots.max;
		}
	}

	onLongRest () {
		// Recover all HP
		this._data.hp.current = this.getMaxHp();

		// Reset death saves
		this.resetDeathSaves();

		// Recover hit dice (half, minimum 1)
		this.recoverHitDice();

		// Recover all spell slots
		this.recoverSpellSlots();

		// Recover all resources
		this.recoverResources("long");
		this.recoverResources("dawn");
	}
	// #endregion

	// #region Character List
	getAllCharacters () {
		// This should be loaded from storage externally
		return [];
	}
	// #endregion
}

// Make available globally and as module export
globalThis.CharacterSheetState = CharacterSheetState;

export {CharacterSheetState};
