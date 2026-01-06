import {SITE_STYLE__CLASSIC} from "../consts.js";
import {CharacterSheetState} from "./charactersheet-state.js";
import {CharacterSheetBuilder} from "./charactersheet-builder.js";
import {CharacterSheetCombat} from "./charactersheet-combat.js";
import {CharacterSheetSpells} from "./charactersheet-spells.js";
import {CharacterSheetInventory} from "./charactersheet-inventory.js";
import {CharacterSheetFeatures} from "./charactersheet-features.js";
import {CharacterSheetRest} from "./charactersheet-rest.js";
import {CharacterSheetExport} from "./charactersheet-export.js";
import {CharacterSheetLevelUp} from "./charactersheet-levelup.js";

/**
 * Character Sheet - Main Controller
 * Orchestrates all character sheet functionality
 */
class CharacterSheetPage {
	constructor () {
		this._state = new CharacterSheetState();
		this._builder = null;
		this._combat = null;
		this._spells = null;
		this._inventory = null;
		this._features = null;
		this._rest = null;
		this._export = null;
		this._levelUp = null;

		this._$selCharacter = null;
		this._currentCharacterId = null;

		// Data caches
		this._races = [];
		this._classes = [];
		this._subclasses = [];
		this._classFeatures = [];
		this._subclassFeatures = [];
		this._backgrounds = [];
		this._spellsData = [];
		this._itemsData = [];
		this._featsData = [];
		this._optionalFeaturesData = [];
	}

	async pInit () {
		console.log("CharacterSheetPage.pInit: Loading data...");
		await this._pLoadData();
		console.log("CharacterSheetPage.pInit: Data loaded, initializing UI...");
		this._initUi();
		console.log("CharacterSheetPage.pInit: UI initialized, binding events...");
		this._initEventListeners();
		console.log("CharacterSheetPage.pInit: Events bound, loading characters...");
		await this._pLoadCharacters();
		console.log("CharacterSheetPage.pInit: Characters loaded, initializing modules...");

		// Initialize sub-modules with error handling
		try {
			this._builder = new CharacterSheetBuilder(this);
			console.log("CharacterSheetPage.pInit: Builder module initialized");
		} catch (e) { console.error("Failed to init builder:", e); }

		try {
			this._combat = new CharacterSheetCombat(this);
			console.log("CharacterSheetPage.pInit: Combat module initialized");
		} catch (e) { console.error("Failed to init combat:", e); }

		try {
			this._spells = new CharacterSheetSpells(this);
			console.log("CharacterSheetPage.pInit: Spells module initialized");
		} catch (e) { console.error("Failed to init spells:", e); }

		try {
			this._inventory = new CharacterSheetInventory(this);
			console.log("CharacterSheetPage.pInit: Inventory module initialized");
		} catch (e) { console.error("Failed to init inventory:", e); }

		try {
			this._features = new CharacterSheetFeatures(this);
			console.log("CharacterSheetPage.pInit: Features module initialized");
		} catch (e) { console.error("Failed to init features:", e); }

		try {
			this._rest = new CharacterSheetRest(this);
			console.log("CharacterSheetPage.pInit: Rest module initialized");
		} catch (e) { console.error("Failed to init rest:", e); }

		try {
			this._export = new CharacterSheetExport(this);
			console.log("CharacterSheetPage.pInit: Export module initialized");
		} catch (e) { console.error("Failed to init export:", e); }

		try {
			this._levelUp = new CharacterSheetLevelUp(this);
			console.log("CharacterSheetPage.pInit: LevelUp module initialized");
		} catch (e) { console.error("Failed to init levelUp:", e); }

		// Pass loaded data to modules
		if (this._inventory) this._inventory.setItems(this._itemsData);
		if (this._combat) this._combat.setItems(this._itemsData);
		if (this._features) this._features.setFeats(this._featsData);
		if (this._spells) this._spells.setSpells(this._spellsData);

		console.log("CharacterSheetPage.pInit: All modules initialized");

		// Check for character in URL
		const urlParams = new URLSearchParams(window.location.search);
		const charId = urlParams.get("id");
		if (charId) {
			await this._pLoadCharacter(charId);
		}
	}

	async _pLoadData () {
		// Load all necessary data in parallel
		// Note: Using loadRawJSON for classes to get classFeature and subclassFeature arrays
		const [races, classes, backgrounds, spells, items, feats, optFeatures] = await Promise.all([
			DataUtil.race.loadJSON(),
			DataUtil.class.loadRawJSON(),
			DataUtil.loadJSON("data/backgrounds.json"),
			DataUtil.spell.pLoadAll(),
			Renderer.item.pBuildList(),
			DataUtil.loadJSON("data/feats.json"),
			DataUtil.loadJSON("data/optionalfeatures.json"),
		]);

		this._races = races.race || [];
		this._classes = classes.class || [];
		this._subclasses = classes.subclass || [];
		this._classFeatures = classes.classFeature || [];
		this._subclassFeatures = classes.subclassFeature || [];
		this._backgrounds = backgrounds.background || [];
		this._spellsData = spells;
		// Filter out item groups which are not actual items
		this._itemsData = (items || []).filter(it => !it._isItemGroup);
		this._featsData = feats.feat || [];
		this._optionalFeaturesData = optFeatures.optionalfeature || [];

		// Attach subclasses to their parent classes for easier access
		this._classes.forEach(cls => {
			cls.subclasses = this._subclasses.filter(sc => {
				// Match by class name
				if (sc.className !== cls.name) return false;
				
				// Match by class source - be flexible with source matching
				const scClassSource = sc.classSource || Parser.SRC_PHB;
				// Allow XPHB subclasses to match with PHB classes and vice versa
				const sourceMatches = scClassSource === cls.source ||
					(scClassSource === Parser.SRC_PHB && cls.source === Parser.SRC_XPHB) ||
					(scClassSource === Parser.SRC_XPHB && cls.source === Parser.SRC_PHB);
				
				return sourceMatches;
			});
		});
	}

	_initUi () {
		this._$selCharacter = $("#charsheet-sel-character");
		this._renderAbilities();
		this._renderSavingThrows();
		this._renderSkills();
		this._initTabs();
	}

	/**
	 * Initialize manual tab switching since Bootstrap JS is not loaded
	 */
	_initTabs () {
		const $tabs = $('#charsheet-tabs');
		const $tabContent = $('.tab-content');

		console.log("_initTabs: Found", $tabs.length, "tab containers and", $tabs.find('a[data-toggle="tab"]').length, "tab links");

		$tabs.find('a[data-toggle="tab"]').on("click", (e) => {
			e.preventDefault();
			const $link = $(e.currentTarget);
			const targetId = $link.attr("href");

			console.log("Tab clicked:", targetId);

			// Update tab nav
			$tabs.find("li").removeClass("active");
			$link.parent("li").addClass("active");

			// Update tab content
			$tabContent.find(".tab-pane").removeClass("active in");
			$(targetId).addClass("active in");
		});
	}

	/**
	 * Switch to a specific tab programmatically
	 * @param {string} tabId - The tab ID (e.g., "#charsheet-tab-builder")
	 */
	switchToTab (tabId) {
		const $tabs = $('#charsheet-tabs');
		const $tabContent = $('.tab-content');
		const $link = $tabs.find(`a[href="${tabId}"]`);

		if (!$link.length) return;

		// Update tab nav
		$tabs.find("li").removeClass("active");
		$link.parent("li").addClass("active");

		// Update tab content
		$tabContent.find(".tab-pane").removeClass("active in");
		$(tabId).addClass("active in");
	}

	_initEventListeners () {
		// Character selection
		this._$selCharacter.on("change", () => this._onCharacterSelect());

		// Header buttons
		$("#charsheet-btn-new").on("click", () => this._onNewCharacter());
		$("#charsheet-btn-duplicate").on("click", () => this._onDuplicateCharacter());
		$("#charsheet-btn-delete").on("click", () => this._onDeleteCharacter());
		// Import/Export/Print handled by CharacterSheetExport module
		$("#charsheet-btn-levelup").on("click", () => this._levelUp?.showLevelUp());
		$("#charsheet-btn-multiclass").on("click", () => this._levelUp?.showMulticlass());

		// Character name
		$("#charsheet-ipt-name").on("change", (e) => {
			this._state.setName(e.target.value);
			this._saveCurrentCharacter();
			this._updateCharacterDropdown();
		});

		// HP controls
		$("#charsheet-ipt-hp-current").on("change", (e) => {
			this._state.setCurrentHp(parseInt(e.target.value) || 0);
			this._saveCurrentCharacter();
		});

		$("#charsheet-ipt-hp-temp").on("change", (e) => {
			this._state.setTempHp(parseInt(e.target.value) || 0);
			this._saveCurrentCharacter();
		});

		$("#charsheet-btn-heal").on("click", () => this._onHeal());
		$("#charsheet-btn-damage").on("click", () => this._onDamage());

		// Combat
		$("#charsheet-box-initiative").on("click", () => this._rollInitiative());
		$("#charsheet-btn-use-hitdie").on("click", () => this._onUseHitDie());
		$("#charsheet-btn-deathsave").on("click", () => this._onDeathSave());

		// Rest - handled by CharacterSheetRest module

		// Inspiration
		$("#charsheet-box-inspiration").on("click", () => this._toggleInspiration());

		// Conditions
		$("#charsheet-btn-add-condition").on("click", () => this._onAddCondition());

		// Exhaustion
		$("#charsheet-btn-exhaustion-add").on("click", () => this._addExhaustion());
		$("#charsheet-btn-exhaustion-remove").on("click", () => this._removeExhaustion());

		// Currency
		["cp", "sp", "ep", "gp", "pp"].forEach(currency => {
			$(`#charsheet-ipt-${currency}`).on("change", (e) => {
				this._state.setCurrency(currency, parseInt(e.target.value) || 0);
				this._saveCurrentCharacter();
			});
		});

		// Notes
		["personality", "ideals", "bonds", "flaws", "backstory", "notes"].forEach(field => {
			$(`#charsheet-txt-${field}`).on("change", (e) => {
				this._state.setNote(field, e.target.value);
				this._saveCurrentCharacter();
			});
		});

		// Appearance
		["age", "height", "weight", "eyes", "skin", "hair"].forEach(field => {
			$(`#charsheet-ipt-${field}`).on("change", (e) => {
				this._state.setAppearance(field, e.target.value);
				this._saveCurrentCharacter();
			});
		});

		// Death saves
		$("#charsheet-deathsaves-success, #charsheet-deathsaves-failure").on("change", "input", () => {
			this._updateDeathSaves();
			this._saveCurrentCharacter();
		});
	}

	// #region Character Management
	async _pLoadCharacters () {
		const characters = await StorageUtil.pGet("charsheet-characters") || [];
		this._updateCharacterDropdown(characters);
	}

	_updateCharacterDropdown (characters) {
		if (!characters) {
			characters = this._state.getAllCharacters();
		}

		this._$selCharacter.empty();
		this._$selCharacter.append(`<option value="">-- New Character --</option>`);

		characters.forEach(char => {
			const name = char.name || "Unnamed Character";
			const classInfo = char.classes?.[0] ? `${char.classes[0].name} ${char.classes[0].level}` : "";
			const label = classInfo ? `${name} (${classInfo})` : name;
			this._$selCharacter.append(`<option value="${char.id}">${label}</option>`);
		});

		if (this._currentCharacterId) {
			this._$selCharacter.val(this._currentCharacterId);
		}
	}

	async _onCharacterSelect () {
		const charId = this._$selCharacter.val();
		if (charId) {
			await this._pLoadCharacter(charId);
		} else {
			this._createNewCharacter();
		}
	}

	async _pLoadCharacter (charId) {
		const characters = await StorageUtil.pGet("charsheet-characters") || [];
		const character = characters.find(c => c.id === charId);

		if (character) {
			this._currentCharacterId = charId;
			this._state.loadFromJson(character);
			this._renderCharacter();

			// Update URL
			const url = new URL(window.location);
			url.searchParams.set("id", charId);
			window.history.replaceState({}, "", url);
		}
	}

	_createNewCharacter () {
		this._currentCharacterId = CryptUtil.uid();
		this._state.reset();
		this._state.setId(this._currentCharacterId);
		this._renderCharacter();
	}

	async _onNewCharacter () {
		this._createNewCharacter();
		this._$selCharacter.val("");

		// Switch to builder tab
		this.switchToTab("#charsheet-tab-builder");
	}

	async _onDuplicateCharacter () {
		if (!this._currentCharacterId) return;

		const newId = CryptUtil.uid();
		const charData = this._state.toJson();
		charData.id = newId;
		charData.name = `${charData.name || "Character"} (Copy)`;

		this._currentCharacterId = newId;
		this._state.loadFromJson(charData);
		await this._saveCurrentCharacter();
		await this._pLoadCharacters();
		this._$selCharacter.val(newId);
	}

	/**
	 * Add a new character from another state object (for import)
	 * @param {CharacterSheetState} state - The state object to add as a new character
	 */
	async addCharacter (state) {
		const newId = CryptUtil.uid();
		const charData = state.toJson();
		charData.id = newId;

		let characters = await StorageUtil.pGet("charsheet-characters") || [];
		characters.push(charData);
		await StorageUtil.pSet("charsheet-characters", characters);

		// Load the new character
		this._currentCharacterId = newId;
		this._state.loadFromJson(charData);
		await this._pLoadCharacters();
		this._$selCharacter.val(newId);
	}

	async _onDeleteCharacter () {
		if (!this._currentCharacterId) return;

		const confirm = await InputUiUtil.pGetUserBoolean({
			title: "Delete Character",
			htmlDescription: "Are you sure you want to delete this character? This cannot be undone.",
			textYes: "Delete",
			textNo: "Cancel",
		});

		if (!confirm) return;

		let characters = await StorageUtil.pGet("charsheet-characters") || [];
		characters = characters.filter(c => c.id !== this._currentCharacterId);
		await StorageUtil.pSet("charsheet-characters", characters);

		this._createNewCharacter();
		await this._pLoadCharacters();
		this._$selCharacter.val("");
	}

	async _saveCurrentCharacter () {
		if (!this._currentCharacterId) return;

		let characters = await StorageUtil.pGet("charsheet-characters") || [];
		const charData = this._state.toJson();
		charData.id = this._currentCharacterId;

		const existingIndex = characters.findIndex(c => c.id === this._currentCharacterId);
		if (existingIndex >= 0) {
			characters[existingIndex] = charData;
		} else {
			characters.push(charData);
		}

		await StorageUtil.pSet("charsheet-characters", characters);
	}

	async _onImportCharacter () {
		const {jsons, errors} = await InputUiUtil.pGetUserUploadJson({expectedFileTypes: ["character"]});
		
		if (errors?.length) {
			JqueryUtil.doToast({type: "danger", content: `Error importing file: ${errors.join(", ")}`});
			return;
		}
		
		const json = jsons?.[0];
		if (!json) return;

		// Validate basic structure
		if (!json.name && !json.classes && !json.race) {
			JqueryUtil.doToast({type: "danger", content: "Invalid character file format."});
			return;
		}

		// Assign new ID
		json.id = CryptUtil.uid();
		this._currentCharacterId = json.id;
		this._state.loadFromJson(json);
		await this._saveCurrentCharacter();
		await this._pLoadCharacters();
		this._$selCharacter.val(json.id);
		this._renderCharacter();

		JqueryUtil.doToast({type: "success", content: `Imported character: ${json.name || "Unnamed"}`});
	}

	_onExportCharacter () {
		if (!this._currentCharacterId) {
			JqueryUtil.doToast({type: "warning", content: "No character to export."});
			return;
		}

		const charData = this._state.toJson();
		const filename = `${(charData.name || "character").toLowerCase().replace(/\s+/g, "-")}.json`;
		DataUtil.userDownload(filename, charData, {fileType: "character"});
	}
	// #endregion

	// #region Rendering
	_renderCharacter () {
		this._renderBasicInfo();
		this._renderAbilityScores();
		this._renderSavingThrows();
		this._renderSkills();
		this._renderHp();
		this._renderCombatStats();
		this._renderHitDice();
		this._renderDeathSaves();
		this._renderInspiration();
		this._renderProficiencies();
		this._renderCurrency();
		this._renderNotes();
		this._renderAppearance();
		this._renderConditions();
		this._renderExhaustion();
		this._renderResources();
		this._renderAttacks();
		this._renderQuickSpells();
		this._renderAbilitiesDetailed();

		// Sub-modules
		if (this._spells) this._spells.render();
		if (this._inventory) this._inventory.render();
		if (this._features) this._features.render();
		if (this._combat) this._combat.render();
	}

	_renderBasicInfo () {
		$("#charsheet-ipt-name").val(this._state.getName());
		
		// Render race with hover link
		const race = this._state.getRace();
		if (race?.name) {
			try {
				const raceName = this._state.getRaceName();
				const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_RACES]({name: race.name, source: race.source});
				$("#charsheet-disp-race").html(CharacterSheetPage.getHoverLink(UrlUtil.PG_RACES, raceName, race.source, hash));
			} catch (e) {
				$("#charsheet-disp-race").text(this._state.getRaceName() || "—");
			}
		} else {
			$("#charsheet-disp-race").text("—");
		}
		
		// Render class with hover links
		const classes = this._state.getClasses();
		if (classes.length) {
			const classLinks = classes.map(c => {
				try {
					const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES]({name: c.name, source: c.source});
					return CharacterSheetPage.getHoverLink(UrlUtil.PG_CLASSES, `${c.name} ${c.level}`, c.source, hash);
				} catch (e) {
					return `${c.name} ${c.level}`;
				}
			});
			$("#charsheet-disp-class").html(classLinks.join(" / "));
		} else {
			$("#charsheet-disp-class").text("—");
		}
		
		$("#charsheet-disp-level").text(this._state.getTotalLevel());
		
		// Render background with hover link
		const background = this._state.getBackground();
		if (background?.name) {
			try {
				const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BACKGROUNDS]({name: background.name, source: background.source});
				$("#charsheet-disp-background").html(CharacterSheetPage.getHoverLink(UrlUtil.PG_BACKGROUNDS, background.name, background.source, hash));
			} catch (e) {
				$("#charsheet-disp-background").text(this._state.getBackgroundName() || "—");
			}
		} else {
			$("#charsheet-disp-background").text("—");
		}
		
		$("#charsheet-disp-proficiency").text(`+${this._state.getProficiencyBonus()}`);
	}

	_renderAbilities () {
		const $container = $("#charsheet-abilities");
		$container.empty();

		Parser.ABIL_ABVS.forEach(abl => {
			const $ability = $(`
				<div class="charsheet__ability" data-ability="${abl}" title="Click to roll ${Parser.attAbvToFull(abl)}">
					<div class="charsheet__ability-name">${abl.toUpperCase()}</div>
					<div class="charsheet__ability-score" id="charsheet-ability-${abl}-score">10</div>
					<div class="charsheet__ability-mod" id="charsheet-ability-${abl}-mod">+0</div>
				</div>
			`);

			$ability.on("click", () => this._rollAbilityCheck(abl));
			$container.append($ability);
		});
	}

	_renderAbilityScores () {
		Parser.ABIL_ABVS.forEach(abl => {
			const score = this._state.getAbilityScore(abl);
			const mod = this._state.getAbilityMod(abl);
			$(`#charsheet-ability-${abl}-score`).text(score);
			$(`#charsheet-ability-${abl}-mod`).text(mod >= 0 ? `+${mod}` : mod);
		});

		// Passive scores (10 + skill modifier)
		const passivePerception = 10 + this._state.getSkillMod("perception");
		const passiveInvestigation = 10 + this._state.getSkillMod("investigation");
		const passiveInsight = 10 + this._state.getSkillMod("insight");

		$("#charsheet-disp-passive-perception").text(passivePerception);
		$("#charsheet-disp-passive-investigation").text(passiveInvestigation);
		$("#charsheet-disp-passive-insight").text(passiveInsight);
	}

	_renderSavingThrows () {
		const $container = $("#charsheet-saves");
		$container.empty();

		Parser.ABIL_ABVS.forEach(abl => {
			const isProficient = this._state.hasSaveProficiency(abl);
			const mod = this._state.getSaveMod(abl);
			const modStr = mod >= 0 ? `+${mod}` : mod;

			const $row = $(`
				<div class="charsheet__save-row" data-save="${abl}" title="Click to roll ${Parser.attAbvToFull(abl)} saving throw">
					<span class="charsheet__prof-indicator ${isProficient ? "charsheet__prof-indicator--proficient" : ""}"></span>
					<span class="charsheet__save-name">${Parser.attAbvToFull(abl)}</span>
					<span class="charsheet__save-mod">${modStr}</span>
				</div>
			`);

			$row.on("click", () => this._rollSavingThrow(abl));
			$container.append($row);
		});
	}

	_renderSkills () {
		const $container = $("#charsheet-skills");
		$container.empty();

		// Add legend for proficiency indicators
		$container.append(`
			<div class="charsheet__skills-legend">
				<div class="charsheet__legend-item">
					<span class="charsheet__legend-dot charsheet__legend-dot--half"></span>
					<span>Half</span>
				</div>
				<div class="charsheet__legend-item">
					<span class="charsheet__legend-dot charsheet__legend-dot--proficient"></span>
					<span>Prof</span>
				</div>
				<div class="charsheet__legend-item">
					<span class="charsheet__legend-dot charsheet__legend-dot--expertise"></span>
					<span>Expert</span>
				</div>
			</div>
		`);

		const skills = [
			{name: "Acrobatics", ability: "dex"},
			{name: "Animal Handling", ability: "wis"},
			{name: "Arcana", ability: "int"},
			{name: "Athletics", ability: "str"},
			{name: "Deception", ability: "cha"},
			{name: "History", ability: "int"},
			{name: "Insight", ability: "wis"},
			{name: "Intimidation", ability: "cha"},
			{name: "Investigation", ability: "int"},
			{name: "Medicine", ability: "wis"},
			{name: "Nature", ability: "int"},
			{name: "Perception", ability: "wis"},
			{name: "Performance", ability: "cha"},
			{name: "Persuasion", ability: "cha"},
			{name: "Religion", ability: "int"},
			{name: "Sleight of Hand", ability: "dex"},
			{name: "Stealth", ability: "dex"},
			{name: "Survival", ability: "wis"},
		];

		// Check for Jack of All Trades (half proficiency for non-proficient skills)
		const hasJackOfAllTrades = this._state.getFeatures().some(f => 
			f.name?.toLowerCase().includes("jack of all trades")
		);

		skills.forEach(skill => {
			const skillKey = skill.name.toLowerCase().replace(/\s+/g, "");
			const profLevel = this._state.getSkillProficiency(skillKey);
			const mod = this._state.getSkillMod(skillKey);
			const modStr = mod >= 0 ? `+${mod}` : mod;

			let profClass = "";
			let profTitle = "Not proficient";
			if (profLevel === 2) {
				profClass = "charsheet__prof-indicator--expertise";
				profTitle = "Expertise (2x proficiency bonus)";
			} else if (profLevel === 1) {
				profClass = "charsheet__prof-indicator--proficient";
				profTitle = "Proficient";
			} else if (hasJackOfAllTrades) {
				profClass = "charsheet__prof-indicator--half";
				profTitle = "Half proficiency (Jack of All Trades)";
			}

			const $row = $(`
				<div class="charsheet__skill-row" data-skill="${skillKey}" title="Click to roll ${skill.name}">
					<span class="charsheet__prof-indicator ${profClass}" title="${profTitle}"></span>
					<span class="charsheet__skill-name">${skill.name}</span>
					<span class="charsheet__skill-ability">(${skill.ability.toUpperCase()})</span>
					<span class="charsheet__skill-mod">${modStr}</span>
				</div>
			`);

			$row.on("click", () => this._rollSkillCheck(skillKey, skill.name));
			$container.append($row);
		});
	}

	_renderHp () {
		$("#charsheet-ipt-hp-current").val(this._state.getCurrentHp());
		$("#charsheet-disp-hp-max").text(this._state.getMaxHp());
		$("#charsheet-ipt-hp-temp").val(this._state.getTempHp());
	}

	_renderCombatStats () {
		$("#charsheet-disp-ac").text(this._state.getAc());
		$("#charsheet-disp-initiative").text(this._formatMod(this._state.getInitiative()));

		// Calculate speed with exhaustion penalty
		const exhaustion = this._state.getExhaustion();
		const rules = this._state.getExhaustionRules();
		let speedDisplay = this._state.getSpeed();
		
		if (exhaustion > 0 && exhaustion < 6) {
			if (rules === "2024") {
				// 2024: -5 ft per level of exhaustion
				const speedPenalty = exhaustion * 5;
				const baseWalkSpeed = this._state.getWalkSpeed();
				const reducedSpeed = Math.max(0, baseWalkSpeed - speedPenalty);
				speedDisplay = speedDisplay.replace(/^\d+ ft\./, `${reducedSpeed} ft.`);
				if (speedPenalty > 0) {
					speedDisplay += ` (-${speedPenalty})`;
				}
			} else if (rules === "2014") {
				// 2014: Speed halved at level 2, reduced to 0 at level 5
				if (exhaustion >= 5) {
					speedDisplay = "0 ft.";
				} else if (exhaustion >= 2) {
					const baseWalkSpeed = this._state.getWalkSpeed();
					const halvedSpeed = Math.floor(baseWalkSpeed / 2);
					speedDisplay = speedDisplay.replace(/^\d+ ft\./, `${halvedSpeed} ft.`);
					speedDisplay += " (halved)";
				}
			}
		}
		
		$("#charsheet-disp-speed").text(speedDisplay);

		// Jump distances based on Strength score
		const strScore = this._state.getAbilityScore("str");
		const longJump = strScore; // Long jump = Strength score in feet (with 10ft running start)
		const highJump = 3 + this._state.getAbilityMod("str"); // High jump = 3 + Str mod in feet (with 10ft running start)

		$("#charsheet-disp-jump-long").text(`${longJump} ft.`);
		$("#charsheet-disp-jump-high").text(`${Math.max(0, highJump)} ft.`);

		// Carrying capacity
		const carryCapacity = strScore * 15;
		const pushDragLift = strScore * 30; // 2x carrying capacity
		const items = this._state.getItems();
		const currentWeight = items.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0);

		$("#charsheet-disp-weight").text(currentWeight.toFixed(1));
		$("#charsheet-disp-carry").text(carryCapacity);
		$("#charsheet-disp-push").text(pushDragLift);

		// Render senses
		this._renderSenses();
	}

	_renderSenses () {
		const $section = $("#charsheet-senses-section");
		const $container = $("#charsheet-senses");

		// Get senses from features (like Darkvision)
		const features = this._state.getFeatures();
		const race = this._state.getRace();

		const senses = [];

		// Check for Darkvision in race
		if (race?.darkvision) {
			senses.push({name: "Darkvision", range: `${race.darkvision} ft.`});
		}

		// Check for senses in features
		features.forEach(f => {
			const nameLower = f.name.toLowerCase();
			if (nameLower.includes("darkvision")) {
				// Extract range from description if possible
				const match = f.description?.match(/(\d+)\s*(?:feet|ft)/i);
				if (match && !senses.some(s => s.name === "Darkvision")) {
					senses.push({name: "Darkvision", range: `${match[1]} ft.`});
				}
			} else if (nameLower.includes("blindsight")) {
				const match = f.description?.match(/(\d+)\s*(?:feet|ft)/i);
				senses.push({name: "Blindsight", range: match ? `${match[1]} ft.` : ""});
			} else if (nameLower.includes("tremorsense")) {
				const match = f.description?.match(/(\d+)\s*(?:feet|ft)/i);
				senses.push({name: "Tremorsense", range: match ? `${match[1]} ft.` : ""});
			} else if (nameLower.includes("truesight")) {
				const match = f.description?.match(/(\d+)\s*(?:feet|ft)/i);
				senses.push({name: "Truesight", range: match ? `${match[1]} ft.` : ""});
			}
		});

		if (senses.length === 0) {
			$section.hide();
			return;
		}

		$section.show();
		$container.empty();

		senses.forEach(sense => {
			$container.append(`
				<div class="charsheet__sense-item">
					<span class="charsheet__sense-name">${sense.name}</span>
					<span class="charsheet__sense-range">${sense.range}</span>
				</div>
			`);
		});
	}

	_renderHitDice () {
		const hitDice = this._state.getHitDiceSummary();
		$("#charsheet-disp-hitdice-current").text(hitDice.current);
		$("#charsheet-disp-hitdice-max").text(hitDice.max);
		$("#charsheet-disp-hitdice-type").text(hitDice.type || "d8");
	}

	_renderDeathSaves () {
		const deathSaves = this._state.getDeathSaves();

		const $success = $("#charsheet-deathsaves-success input");
		const $failure = $("#charsheet-deathsaves-failure input");

		$success.each((i, el) => {
			el.checked = i < deathSaves.successes;
		});

		$failure.each((i, el) => {
			el.checked = i < deathSaves.failures;
		});
	}

	_updateDeathSaves () {
		const successes = $("#charsheet-deathsaves-success input:checked").length;
		const failures = $("#charsheet-deathsaves-failure input:checked").length;
		this._state.setDeathSaves(successes, failures);
	}

	_renderInspiration () {
		const hasInspiration = this._state.hasInspiration();
		const $icon = $("#charsheet-icon-inspiration");
		$icon.removeClass("glyphicon-star glyphicon-star-empty");
		$icon.addClass(hasInspiration ? "glyphicon-star" : "glyphicon-star-empty");
	}

	_renderProficiencies () {
		const profs = this._state.getProficiencies();
		const armor = profs.armor.map(a => typeof a === "string" ? a : a.full).join(", ");
		const weapons = profs.weapons.map(w => typeof w === "string" ? w : w.full).join(", ");
		const tools = profs.tools.map(t => typeof t === "string" ? t : t.full).join(", ");

		
		$("#charsheet-prof-armor").html(`${Renderer.get().render(armor)}` || "—");
		$("#charsheet-prof-weapons").html(`${Renderer.get().render(weapons)}` || "—");
		$("#charsheet-prof-tools").html(`${Renderer.get().render(tools)}` || "—");

		// Languages with hover links
		if (profs.languages?.length) {
			const langHtml = profs.languages.map(lang => {
				try {
					return this.getHoverLink(UrlUtil.PG_LANGUAGES, lang, Parser.SRC_XPHB);
				} catch (e) {
					return lang;
				}
			}).join(", ");
			$("#charsheet-prof-languages").html(langHtml);
		} else {
			$("#charsheet-prof-languages").text("—");
		}
	}

	_renderCurrency () {
		["cp", "sp", "ep", "gp", "pp"].forEach(currency => {
			$(`#charsheet-ipt-${currency}`).val(this._state.getCurrency(currency));
		});
	}

	_renderNotes () {
		["personality", "ideals", "bonds", "flaws", "backstory", "notes"].forEach(field => {
			$(`#charsheet-txt-${field}`).val(this._state.getNote(field));
		});
	}

	_renderAppearance () {
		["age", "height", "weight", "eyes", "skin", "hair"].forEach(field => {
			$(`#charsheet-ipt-${field}`).val(this._state.getAppearance(field));
		});
	}

	_renderConditions () {
		const $container = $("#charsheet-conditions");
		$container.empty();

		const conditions = this._state.getConditions();
		conditions.forEach(condition => {
			const conditionLink = CharacterSheetPage.getConditionLink(condition);
			const $badge = $(`
				<span class="charsheet__condition-badge">
					${conditionLink}
					<span class="charsheet__condition-remove glyphicon glyphicon-remove"></span>
				</span>
			`);

			$badge.find(".charsheet__condition-remove").on("click", () => {
				this._state.removeCondition(condition);
				this._saveCurrentCharacter();
				this._renderConditions();
			});

			$container.append($badge);
		});
	}

	_renderExhaustion () {
		const exhaustion = this._state.getExhaustion();
		const rules = this._state.getExhaustionRules();
		const $number = $("#charsheet-exhaustion-display .charsheet__exhaustion-number");
		const $effect = $("#charsheet-exhaustion-effect");
		const $rulesToggle = $("#charsheet-exhaustion-rules");

		$number.text(exhaustion);

		// Update color based on level
		$number.removeClass("exhaustion-0 exhaustion-1 exhaustion-2 exhaustion-3 exhaustion-4 exhaustion-5 exhaustion-6");
		$number.addClass(`exhaustion-${exhaustion}`);

		// 2024 rules: -2 per level to d20 Tests, -5 ft speed per level
		const effects2024 = [
			"No exhaustion",
			"-2 to d20 Tests, -5 ft. speed",
			"-4 to d20 Tests, -10 ft. speed",
			"-6 to d20 Tests, -15 ft. speed",
			"-8 to d20 Tests, -20 ft. speed",
			"-10 to d20 Tests, -25 ft. speed",
			"Death",
		];

		// 2014 rules: cumulative effects
		const effects2014 = [
			"No exhaustion",
			"Disadvantage on ability checks",
			"Speed halved",
			"Disadvantage on attack rolls and saves",
			"HP maximum halved",
			"Speed reduced to 0",
			"Death",
		];

		const effects = rules === "2024" ? effects2024 : effects2014;
		$effect.html(effects[exhaustion]);

		// Render rules toggle if container exists
		if ($rulesToggle.length && !$rulesToggle.data("initialized")) {
			$rulesToggle.data("initialized", true);
			$rulesToggle.html(`
				<select id="charsheet-exhaustion-rules-select" class="ve-form-control ve-form-control--sm">
					<option value="2024" ${rules === "2024" ? "selected" : ""}>2024 Rules</option>
					<option value="2014" ${rules === "2014" ? "selected" : ""}>2014 Rules</option>
				</select>
			`);
			$rulesToggle.find("select").on("change", (e) => {
				this._state.setExhaustionRules(e.target.value);
				this._saveCurrentCharacter();
				this._renderExhaustion();
				this._renderCombatStats(); // Re-render to update speed
			});
		} else if ($rulesToggle.length) {
			$rulesToggle.find("select").val(rules);
		}
	}

	_addExhaustion () {
		const current = this._state.getExhaustion();
		if (current >= 6) {
			JqueryUtil.doToast({type: "warning", content: "Maximum exhaustion (6) reached!"});
			return;
		}
		this._state.addExhaustion();
		this._saveCurrentCharacter();
		this._renderExhaustion();
	}

	_removeExhaustion () {
		const current = this._state.getExhaustion();
		if (current <= 0) {
			JqueryUtil.doToast({type: "info", content: "No exhaustion to remove."});
			return;
		}
		this._state.removeExhaustion();
		this._saveCurrentCharacter();
		this._renderExhaustion();
	}

	_renderAbilitiesDetailed () {
		const $container = $("#charsheet-abilities-detailed");
		if (!$container.length) return;

		$container.empty();

		// Header
		$container.append(`<h4>Ability Scores</h4>`);

		// Create detailed ability score display
		const $grid = $(`<div class="charsheet__abilities-grid"></div>`);

		Parser.ABIL_ABVS.forEach(abl => {
			const base = this._state.getAbilityBase(abl);
			const bonus = this._state.getAbilityBonus(abl);
			const total = this._state.getAbilityScore(abl);
			const mod = this._state.getAbilityMod(abl);
			const modStr = mod >= 0 ? `+${mod}` : `${mod}`;

			const $ability = $(`
				<div class="charsheet__ability-detailed">
					<div class="charsheet__ability-header">
						<span class="charsheet__ability-full-name">${Parser.attAbvToFull(abl)}</span>
						<span class="charsheet__ability-abbr">(${abl.toUpperCase()})</span>
					</div>
					<div class="charsheet__ability-scores">
						<div class="charsheet__ability-total">
							<span class="charsheet__ability-total-value">${total}</span>
							<span class="charsheet__ability-mod-value">${modStr}</span>
						</div>
						<div class="charsheet__ability-breakdown">
							<span class="ve-small ve-muted">Base: ${base}</span>
							${bonus !== 0 ? `<span class="ve-small ve-muted"> | Bonus: ${bonus >= 0 ? "+" : ""}${bonus}</span>` : ""}
						</div>
					</div>
					<div class="charsheet__ability-actions mt-2">
						<button class="ve-btn ve-btn-xs ve-btn-primary charsheet__roll-ability" data-ability="${abl}">
							<span class="glyphicon glyphicon-random"></span> Roll Check
						</button>
						<button class="ve-btn ve-btn-xs ve-btn-default charsheet__roll-save" data-ability="${abl}">
							<span class="glyphicon glyphicon-shield"></span> Save
						</button>
					</div>
				</div>
			`);

			$ability.find(".charsheet__roll-ability").on("click", () => this._rollAbilityCheck(abl));
			$ability.find(".charsheet__roll-save").on("click", () => this._rollSavingThrow(abl));

			$grid.append($ability);
		});

		$container.append($grid);

		// Saving throws summary
		const $savesSection = $(`
			<div class="charsheet__section mt-4">
				<h4>Saving Throw Proficiencies</h4>
				<div class="charsheet__saves-summary"></div>
			</div>
		`);

		const $savesSummary = $savesSection.find(".charsheet__saves-summary");
		Parser.ABIL_ABVS.forEach(abl => {
			const isProficient = this._state.hasSaveProficiency(abl);
			const mod = this._state.getSaveMod(abl);
			const modStr = mod >= 0 ? `+${mod}` : `${mod}`;

			$savesSummary.append(`
				<div class="charsheet__save-summary-item ${isProficient ? "proficient" : ""}">
					<span class="charsheet__save-prof-indicator ${isProficient ? "active" : ""}">●</span>
					<span class="charsheet__save-name">${Parser.attAbvToFull(abl)}</span>
					<span class="charsheet__save-mod">${modStr}</span>
				</div>
			`);
		});

		$container.append($savesSection);

		// Skills section
		const $skillsSection = $(`
			<div class="charsheet__section mt-4">
				<h4>Skills</h4>
				<div class="charsheet__skills-grid"></div>
			</div>
		`);

		const skills = [
			{name: "Acrobatics", ability: "dex"},
			{name: "Animal Handling", ability: "wis"},
			{name: "Arcana", ability: "int"},
			{name: "Athletics", ability: "str"},
			{name: "Deception", ability: "cha"},
			{name: "History", ability: "int"},
			{name: "Insight", ability: "wis"},
			{name: "Intimidation", ability: "cha"},
			{name: "Investigation", ability: "int"},
			{name: "Medicine", ability: "wis"},
			{name: "Nature", ability: "int"},
			{name: "Perception", ability: "wis"},
			{name: "Performance", ability: "cha"},
			{name: "Persuasion", ability: "cha"},
			{name: "Religion", ability: "int"},
			{name: "Sleight of Hand", ability: "dex"},
			{name: "Stealth", ability: "dex"},
			{name: "Survival", ability: "wis"},
		];

		const $skillsGrid = $skillsSection.find(".charsheet__skills-grid");
		skills.forEach(skill => {
			const skillKey = skill.name.toLowerCase().replace(/\s+/g, "");
			const profLevel = this._state.getSkillProficiency(skillKey);
			const mod = this._state.getSkillMod(skillKey);
			const modStr = mod >= 0 ? `+${mod}` : `${mod}`;

			let profIcon = "○";
			let profClass = "";
			if (profLevel === 2) {
				profIcon = "◉";
				profClass = "expertise";
			} else if (profLevel === 1) {
				profIcon = "●";
				profClass = "proficient";
			}

			const $skill = $(`
				<div class="charsheet__skill-item ${profClass}" title="Click to roll ${skill.name}">
					<span class="charsheet__skill-prof">${profIcon}</span>
					<span class="charsheet__skill-name">${skill.name}</span>
					<span class="charsheet__skill-ability">(${skill.ability.toUpperCase()})</span>
					<span class="charsheet__skill-mod">${modStr}</span>
				</div>
			`);

			$skill.on("click", () => this._rollSkillCheck(skillKey, skill.name));
			$skillsGrid.append($skill);
		});

		$container.append($skillsSection);
	}

	_renderResources () {
		const $container = $("#charsheet-resources");
		$container.empty();

		const resources = this._state.getResources();
		if (!resources.length) {
			$container.html(`<div class="ve-muted ve-text-center py-2">No limited-use features</div>`);
			return;
		}

		resources.forEach(resource => {
			const $row = $(`
				<div class="charsheet__resource-row">
					<span class="charsheet__resource-name">${resource.name}</span>
					<div class="charsheet__resource-uses">
						<input type="number" class="form-control form-control--minimal charsheet__resource-current" 
							value="${resource.current}" min="0" max="${resource.max}">
						<span class="charsheet__resource-max">/ ${resource.max}</span>
					</div>
				</div>
			`);

			$row.find("input").on("change", (e) => {
				this._state.setResourceCurrent(resource.id, parseInt(e.target.value) || 0);
				this._saveCurrentCharacter();
			});

			$container.append($row);
		});
	}

	_renderAttacks () {
		const $container = $("#charsheet-attacks");
		$container.empty();

		// Get configured attacks
		let attacks = [...this._state.getAttacks()];

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

				// Calculate magic bonuses
				const attackBonus = (weapon.bonusWeapon || 0) + (weapon.bonusWeaponAttack || 0);
				const damageBonus = (weapon.bonusWeapon || 0) + (weapon.bonusWeaponDamage || 0);

				const autoAttack = {
					id: `auto_${weapon.id}`,
					name: weapon.name,
					source: weapon.source, // For hoverable link
					isMelee: !isRanged,
					abilityMod,
					attackBonus: attackBonus,
					damage: weapon.damage || "1d6",
					damageType: weapon.damageType || "slashing",
					damageBonus: damageBonus,
					range: weapon.range || (isRanged ? "80/320 ft." : "5 ft."),
					properties: weapon.properties || [],
					mastery: weapon.mastery || [],
				};
				attacks.push(autoAttack);
			}
		});

		if (!attacks.length) {
			$container.html(`<div class="ve-muted ve-text-center py-2">No attacks. Equip weapons from Inventory.</div>`);
			return;
		}

		// Limit to 5 attacks for overview
		const displayAttacks = attacks.slice(0, 5);

		displayAttacks.forEach(attack => {
			const abilityMod = this._state.getAbilityMod(attack.abilityMod || "str");
			const profBonus = this._state.getProficiencyBonus();
			const totalAttackBonus = abilityMod + profBonus + (attack.attackBonus || 0);
			const totalDamageBonus = abilityMod + (attack.damageBonus || 0);
			const damageStr = totalDamageBonus >= 0 
				? `${attack.damage}+${totalDamageBonus}`
				: `${attack.damage}${totalDamageBonus}`;

			// Format range
			const rangeStr = attack.range || (attack.isMelee ? "5 ft." : "");

			// Format properties (abbreviated)
			const propAbbrs = [];
			if (attack.properties?.length) {
				attack.properties.forEach(p => {
					const abbr = typeof p === "string" ? p.split("|")[0] : p;
					if (abbr && abbr.length <= 2) propAbbrs.push(abbr);
				});
			}
			const propsStr = propAbbrs.length ? `[${propAbbrs.join(", ")}]` : "";

			// Create hoverable weapon name
			let attackNameHtml = attack.name;
			if (attack.source) {
				try {
					const hash = UrlUtil.encodeForHash([attack.name, attack.source].join(HASH_LIST_SEP));
					const hoverAttrs = Renderer.hover.getHoverElementAttributes({page: UrlUtil.PG_ITEMS, source: attack.source, hash: hash});
					attackNameHtml = `<a href="${UrlUtil.PG_ITEMS}#${hash}" ${hoverAttrs}>${attack.name}</a>`;
				} catch (e) {
					// Fall back to plain name
				}
			}

			const $row = $(`
				<div class="charsheet__attack-row">
					<div class="charsheet__attack-info">
						<span class="charsheet__attack-name">${attackNameHtml}</span>
						<span class="charsheet__attack-range ve-small ve-muted">${rangeStr} ${propsStr}</span>
					</div>
					<div class="charsheet__attack-stats">
						<span class="charsheet__attack-bonus" title="Attack Bonus">${this._formatMod(totalAttackBonus)}</span>
						<span class="charsheet__attack-damage" title="Damage">${damageStr} ${attack.damageType || ""}</span>
					</div>
					<button class="ve-btn ve-btn-primary ve-btn-xs charsheet__attack-btn" title="Roll Attack">
						<span class="glyphicon glyphicon-screenshot"></span> Roll
					</button>
				</div>
			`);

			$row.find("button").on("click", () => this._rollAttack(attack));
			$container.append($row);
		});

		if (attacks.length > 5) {
			$container.append(`<div class="ve-muted ve-small text-center">+${attacks.length - 5} more in Combat tab</div>`);
		}
	}

	_renderQuickSpells () {
		const $container = $("#charsheet-quick-spells");
		if (!$container.length) return;
		
		$container.empty();

		const spells = this._state.getSpells();
		if (!spells.length) {
			$container.html(`<div class="ve-muted ve-text-center py-2">No spells. Add from Spells tab.</div>`);
			return;
		}

		// Get cantrips and prepared/known spells
		const cantrips = spells.filter(s => s.level === 0);
		const preparedSpells = spells.filter(s => s.level > 0 && s.prepared);

		// Show cantrips first (max 3), then prepared spells (max 4)
		const displayCantrips = cantrips.slice(0, 3);
		const displayPrepared = preparedSpells.slice(0, 4);

		// Show spell stats and slots summary
		const spellcastingAbility = this._state.getSpellcastingAbility();
		if (spellcastingAbility) {
			const spellMod = this._state.getAbilityMod(spellcastingAbility);
			const profBonus = this._state.getProficiencyBonus();
			const saveDC = 8 + spellMod + profBonus;
			const attackBonus = spellMod + profBonus;
			$container.append(`
				<div class="charsheet__spell-stats ve-flex ve-flex-wrap mb-2">
					<span class="ve-small mr-3"><strong>Save DC:</strong> ${saveDC}</span>
					<span class="ve-small mr-3"><strong>Attack:</strong> ${this._formatMod(attackBonus)}</span>
					<span class="ve-small"><strong>Ability:</strong> ${spellcastingAbility.toUpperCase()}</span>
				</div>
			`);
		}

		// Show spell slots
		const $slotsRow = $(`<div class="charsheet__spell-slots-row mb-2"><span class="charsheet__spell-slots-label">Spell Slots:</span></div>`);
		let hasSlots = false;
		for (let level = 1; level <= 9; level++) {
			const max = this._state.getSpellSlotsMax(level);
			if (max > 0) {
				hasSlots = true;
				const current = this._state.getSpellSlotsCurrent(level);
				$slotsRow.append(`
					<div class="charsheet__spell-slot-box" title="Level ${level} spell slots">
						<span class="charsheet__spell-slot-level">${level}</span>
						<span class="charsheet__spell-slot-count ${current === 0 ? 've-muted' : ''}">${current}/${max}</span>
					</div>
				`);
			}
		}
		// Also show pact slots if any
		const pactSlots = this._state.getPactSlots();
		if (pactSlots?.max > 0) {
			hasSlots = true;
			$slotsRow.append(`
				<div class="charsheet__spell-slot-box charsheet__spell-slot-box--pact" title="Pact Magic slots (level ${pactSlots.level})">
					<span class="charsheet__spell-slot-level">P${pactSlots.level}</span>
					<span class="charsheet__spell-slot-count ${pactSlots.current === 0 ? 've-muted' : ''}">${pactSlots.current}/${pactSlots.max}</span>
				</div>
			`);
		}
		if (hasSlots) {
			$container.append($slotsRow);
		}

		// Helper to create hoverable spell name
		const getSpellLink = (spell) => {
			const source = spell.source || Parser.SRC_XPHB;
			const hash = UrlUtil.encodeForHash([spell.name, source].join(HASH_LIST_SEP));
			try {
				const hoverAttrs = Renderer.hover.getHoverElementAttributes({page: UrlUtil.PG_SPELLS, source: source, hash: hash});
				return `<a href="${UrlUtil.PG_SPELLS}#${hash}" ${hoverAttrs}>${spell.name}</a>`;
			} catch (e) {
				return spell.name;
			}
		};

		if (displayCantrips.length) {
			$container.append(`<div class="ve-small ve-muted mb-1"><strong>Cantrips</strong></div>`);
			displayCantrips.forEach(spell => {
				const castTime = spell.castingTime || "1 action";
				const $spell = $(`
					<div class="charsheet__quick-spell">
						<div class="charsheet__quick-spell-info">
							<span class="charsheet__quick-spell-name">${getSpellLink(spell)}</span>
							<span class="ve-small ve-muted">${castTime}</span>
						</div>
						<button class="ve-btn ve-btn-xs ve-btn-primary charsheet__quick-spell-btn" title="Cast ${spell.name}">
							<span class="glyphicon glyphicon-flash"></span> Cast
						</button>
					</div>
				`);
				$spell.find("button").on("click", () => {
					if (this._spells) this._spells._castSpell(spell.id);
				});
				$container.append($spell);
			});
		}

		if (displayPrepared.length) {
			$container.append(`<div class="ve-small ve-muted mb-1 mt-2"><strong>Prepared Spells</strong></div>`);
			displayPrepared.forEach(spell => {
				const levelText = spell.level === 1 ? "1st" : spell.level === 2 ? "2nd" : spell.level === 3 ? "3rd" : `${spell.level}th`;
				const castTime = spell.castingTime || "1 action";
				const $spell = $(`
					<div class="charsheet__quick-spell">
						<div class="charsheet__quick-spell-info">
							<span class="charsheet__quick-spell-name">${getSpellLink(spell)}</span>
							<span class="ve-small ve-muted">${levelText} · ${castTime}</span>
						</div>
						<button class="ve-btn ve-btn-xs ve-btn-primary charsheet__quick-spell-btn" title="Cast ${spell.name}">
							<span class="glyphicon glyphicon-flash"></span> Cast
						</button>
					</div>
				`);
				$spell.find("button").on("click", () => {
					if (this._spells) this._spells._castSpell(spell.id);
				});
				$container.append($spell);
			});
		}

		const totalCantrips = cantrips.length;
		const totalPrepared = preparedSpells.length;
		if (totalCantrips > 3 || totalPrepared > 4) {
			$container.append(`<div class="ve-muted ve-small text-center mt-2">More spells in Spells tab</div>`);
		}
	}
	// #endregion

	// #region Actions
	async _onHeal () {
		const amount = await InputUiUtil.pGetUserNumber({
			title: "Heal",
			default: 0,
			min: 0,
		});

		if (amount == null || amount <= 0) return;

		const currentHp = this._state.getCurrentHp();
		const maxHp = this._state.getMaxHp();
		const newHp = Math.min(currentHp + amount, maxHp);

		this._state.setCurrentHp(newHp);
		this._saveCurrentCharacter();
		this._renderHp();

		this._showDiceResult("Healing", amount, `Healed ${amount} HP`);
	}

	async _onDamage () {
		const amount = await InputUiUtil.pGetUserNumber({
			title: "Take Damage",
			default: 0,
			min: 0,
		});

		if (amount == null || amount <= 0) return;

		let remaining = amount;
		let tempHp = this._state.getTempHp();
		let currentHp = this._state.getCurrentHp();

		// Temp HP absorbs damage first
		if (tempHp > 0) {
			const tempAbsorbed = Math.min(tempHp, remaining);
			tempHp -= tempAbsorbed;
			remaining -= tempAbsorbed;
			this._state.setTempHp(tempHp);
		}

		// Apply remaining damage to HP
		if (remaining > 0) {
			currentHp = Math.max(0, currentHp - remaining);
			this._state.setCurrentHp(currentHp);
		}

		this._saveCurrentCharacter();
		this._renderHp();

		this._showDiceResult("Damage", amount, `Took ${amount} damage`);
	}

	async _onUseHitDie () {
		const hitDice = this._state.getHitDiceSummary();
		if (hitDice.current <= 0) {
			JqueryUtil.doToast({type: "warning", content: "No hit dice remaining!"});
			return;
		}

		const dieType = hitDice.type || "d8";
		const conMod = this._state.getAbilityMod("con");
		const dieSize = parseInt(dieType.substring(1));

		const roll = RollerUtil.roll(dieSize);
		const healing = Math.max(1, roll + conMod);

		// Apply healing
		const currentHp = this._state.getCurrentHp();
		const maxHp = this._state.getMaxHp();
		const newHp = Math.min(currentHp + healing, maxHp);

		this._state.setCurrentHp(newHp);
		this._state.useHitDie();
		this._saveCurrentCharacter();
		this._renderHp();
		this._renderHitDice();

		this._showDiceResult(
			"Hit Die",
			healing,
			`1${dieType} (${roll}) + ${conMod} CON`,
		);
	}

	async _onDeathSave () {
		const roll = RollerUtil.roll(20);
		let result = "";

		if (roll === 20) {
			// Nat 20 - regain 1 HP
			this._state.setCurrentHp(1);
			this._state.setDeathSaves(0, 0);
			result = "Natural 20! You regain 1 HP and are stable.";
		} else if (roll === 1) {
			// Nat 1 - two failures
			const deathSaves = this._state.getDeathSaves();
			const newFailures = Math.min(3, deathSaves.failures + 2);
			this._state.setDeathSaves(deathSaves.successes, newFailures);
			result = "Natural 1! Two death save failures.";
		} else if (roll >= 10) {
			// Success
			const deathSaves = this._state.getDeathSaves();
			const newSuccesses = Math.min(3, deathSaves.successes + 1);
			this._state.setDeathSaves(newSuccesses, deathSaves.failures);
			result = `Success (${roll})`;
			if (newSuccesses >= 3) result += " - You are stable!";
		} else {
			// Failure
			const deathSaves = this._state.getDeathSaves();
			const newFailures = Math.min(3, deathSaves.failures + 1);
			this._state.setDeathSaves(deathSaves.successes, newFailures);
			result = `Failure (${roll})`;
			if (newFailures >= 3) result += " - You have died.";
		}

		this._saveCurrentCharacter();
		this._renderHp();
		this._renderDeathSaves();

		this._showDiceResult("Death Save", roll, result);
	}

	async _onShortRest () {
		const confirm = await InputUiUtil.pGetUserBoolean({
			title: "Short Rest",
			htmlDescription: `
				<p>During a short rest, you can:</p>
				<ul>
					<li>Spend hit dice to recover HP</li>
					<li>Recover some class features</li>
				</ul>
				<p>Proceed with short rest?</p>
			`,
			textYes: "Rest",
			textNo: "Cancel",
		});

		if (!confirm) return;

		// Recover short rest resources
		this._state.onShortRest();
		this._saveCurrentCharacter();
		this._renderCharacter();

		JqueryUtil.doToast({type: "success", content: "Short rest completed!"});
	}

	async _onLongRest () {
		const exhaustionBefore = this._state.getExhaustion();
		const confirm = await InputUiUtil.pGetUserBoolean({
			title: "Long Rest",
			htmlDescription: `
				<p>During a long rest, you will:</p>
				<ul>
					<li>Recover all HP</li>
					<li>Recover half your hit dice (minimum 1)</li>
					<li>Recover all spell slots</li>
					<li>Recover all class features</li>
					${exhaustionBefore > 0 ? "<li>Reduce exhaustion by 1 level</li>" : ""}
				</ul>
				<p>Proceed with long rest?</p>
			`,
			textYes: "Rest",
			textNo: "Cancel",
		});

		if (!confirm) return;

		this._state.onLongRest();
		this._saveCurrentCharacter();
		this._renderCharacter();

		const exhaustionAfter = this._state.getExhaustion();
		let message = "Long rest completed! All resources recovered.";
		if (exhaustionBefore > exhaustionAfter) {
			message += ` Exhaustion reduced to ${exhaustionAfter}.`;
		}
		JqueryUtil.doToast({type: "success", content: message});
	}

	_toggleInspiration () {
		this._state.toggleInspiration();
		this._saveCurrentCharacter();
		this._renderInspiration();
	}

	async _onAddCondition () {
		const conditions = [
			"Blinded", "Charmed", "Deafened", "Exhaustion", "Frightened",
			"Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified",
			"Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
		];

		const currentConditions = this._state.getConditions();
		const availableConditions = conditions.filter(c => !currentConditions.includes(c));

		if (!availableConditions.length) {
			JqueryUtil.doToast({type: "warning", content: "All conditions already applied!"});
			return;
		}

		const selected = await InputUiUtil.pGetUserEnum({
			title: "Add Condition",
			values: availableConditions,
			fnDisplay: v => v,
			isResolveItem: true,
		});

		if (!selected) return;

		this._state.addCondition(selected);
		this._saveCurrentCharacter();
		this._renderConditions();
	}
	// #endregion

	// #region Dice Rolling
	/**
	 * Get exhaustion penalty for d20 rolls
	 * 2024 rules: -2 per exhaustion level to d20 Tests (ability checks, attack rolls, saving throws)
	 * 2014 rules: Handled separately (disadvantage, etc.)
	 * @returns {number} Penalty to subtract from d20 tests
	 */
	_getExhaustionPenalty () {
		const exhaustion = this._state.getExhaustion();
		const rules = this._state.getSettings().exhaustionRules || "2024";
		if (rules === "2024") {
			return exhaustion * 2; // -2 per level in 2024 rules
		}
		// 2014 rules don't have a flat penalty to rolls
		return 0;
	}

	_rollAbilityCheck (ability) {
		const mod = this._state.getAbilityMod(ability);
		const exhaustionPenalty = this._getExhaustionPenalty();
		const roll = RollerUtil.roll(20);
		const total = roll + mod - exhaustionPenalty;

		const exhaustionStr = exhaustionPenalty > 0 ? ` - ${exhaustionPenalty} (exhaustion)` : "";
		this._showDiceResult(
			`${Parser.attAbvToFull(ability)} Check`,
			total,
			`1d20 (${roll}) + ${mod}${exhaustionStr}`,
		);
	}

	_rollSavingThrow (ability) {
		const mod = this._state.getSaveMod(ability);
		const exhaustionPenalty = this._getExhaustionPenalty();
		const roll = RollerUtil.roll(20);
		const total = roll + mod - exhaustionPenalty;

		const exhaustionStr = exhaustionPenalty > 0 ? ` - ${exhaustionPenalty} (exhaustion)` : "";
		this._showDiceResult(
			`${Parser.attAbvToFull(ability)} Save`,
			total,
			`1d20 (${roll}) + ${mod}${exhaustionStr}`,
		);
	}

	_rollSkillCheck (skillKey, skillName) {
		const mod = this._state.getSkillMod(skillKey);
		const exhaustionPenalty = this._getExhaustionPenalty();
		const roll = RollerUtil.roll(20);
		const total = roll + mod - exhaustionPenalty;

		const exhaustionStr = exhaustionPenalty > 0 ? ` - ${exhaustionPenalty} (exhaustion)` : "";
		this._showDiceResult(
			`${skillName} Check`,
			total,
			`1d20 (${roll}) + ${mod}${exhaustionStr}`,
		);
	}

	_rollInitiative () {
		const mod = this._state.getInitiative();
		const exhaustionPenalty = this._getExhaustionPenalty();
		const roll = RollerUtil.roll(20);
		const total = roll + mod - exhaustionPenalty;

		const exhaustionStr = exhaustionPenalty > 0 ? ` - ${exhaustionPenalty} (exhaustion)` : "";
		this._showDiceResult(
			"Initiative",
			total,
			`1d20 (${roll}) + ${mod}${exhaustionStr}`,
		);
	}

	_rollAttack (attack) {
		const exhaustionPenalty = this._getExhaustionPenalty();
		const attackRoll = RollerUtil.roll(20);
		const attackTotal = attackRoll + attack.attackBonus - exhaustionPenalty;

		// Parse and roll damage
		const damageResult = Renderer.dice.parseRandomise2(attack.damage);

		const exhaustionStr = exhaustionPenalty > 0 ? ` - ${exhaustionPenalty} (exhaustion)` : "";
		this._showDiceResult(
			attack.name,
			attackTotal,
			`Attack: 1d20 (${attackRoll}) + ${attack.attackBonus}${exhaustionStr} = ${attackTotal}
			 Damage: ${attack.damage} = ${damageResult}`,
		);
	}

	// Public method for sub-modules
	rollDice (num, sides) {
		let total = 0;
		for (let i = 0; i < num; i++) {
			total += RollerUtil.roll(sides);
		}
		return total;
	}

	showDiceResult (opts) {
		if (typeof opts === "string") {
			// Legacy call: showDiceResult(title, total, breakdown)
			this._showDiceResult(...arguments);
		} else {
			// New object format
			const breakdown = opts.subtitle || `1d20 (${opts.roll}) ${opts.modifier >= 0 ? "+" : ""}${opts.modifier}`;
			this._showDiceResult(opts.title, opts.total, breakdown, opts.resultClass, opts.resultNote);
		}
	}

	_showDiceResult (title, total, breakdown, resultClass = "", resultNote = "") {
		// Remove existing result
		$(".charsheet__dice-result").remove();

		const totalClass = resultClass ? ` ${resultClass}` : "";
		const noteHtml = resultNote ? `<div class="charsheet__dice-result-note">${resultNote}</div>` : "";

		const $result = $(`
			<div class="charsheet__dice-result">
				<span class="charsheet__dice-result-close glyphicon glyphicon-remove"></span>
				<div class="charsheet__dice-result-header">${title}</div>
				<div class="charsheet__dice-result-total${totalClass}">${total}</div>
				<div class="charsheet__dice-result-breakdown">${breakdown}</div>
				${noteHtml}
			</div>
		`);

		$result.find(".charsheet__dice-result-close").on("click", () => $result.remove());
		$("body").append($result);

		// Auto-remove after 5 seconds
		setTimeout(() => $result.fadeOut(300, () => $result.remove()), 5000);
	}
	// #endregion

	// #region Utilities
	_formatMod (mod) {
		return mod >= 0 ? `+${mod}` : `${mod}`;
	}

	/**
	 * Create a 5etools hover link (instance method for sub-modules)
	 * @param {string} page - The page URL (e.g., "conditionsdiseases.html", "items.html")
	 * @param {string} name - Display name
	 * @param {string} source - Source book abbreviation
	 * @param {string} [hash] - Optional hash override
	 * @returns {string} HTML string for the link
	 */
	getHoverLink (page, name, source, hash = null) {
		return CharacterSheetPage.getHoverLink(page, name, source, hash);
	}

	/**
	 * Create a 5etools hover link (static method)
	 * @param {string} page - The page URL (e.g., "conditionsdiseases.html", "items.html")
	 * @param {string} name - Display name
	 * @param {string} source - Source book abbreviation
	 * @param {string} [hash] - Optional hash override
	 * @returns {string} HTML string for the link
	 */
	static getHoverLink (page, name, source, hash = null) {
		try {
			// Create hash manually - don't use autoEncodeHash which uses getCurrentPage()
			const finalHash = hash || UrlUtil.encodeForHash([name, source].join(HASH_LIST_SEP));
			const hoverAttrs = Renderer.hover.getHoverElementAttributes({page, source, hash: finalHash});
			const link = `<a href="${page}#${finalHash}" ${hoverAttrs}>${name}</a>`;
			return link;
		} catch (e) {
			console.error("[CharSheet] getHoverLink error:", e);
			return name; // Fallback to just the name
		}
	}

	/**
	 * Create a condition hover link
	 * @param {string} condition - Condition name
	 * @returns {string} HTML string for the link
	 */
	static getConditionLink (condition) {
		const conditionClean = condition.trim().toLowerCase();
		const hash = `${conditionClean}_xphb`;
		return CharacterSheetPage.getHoverLink(
			UrlUtil.PG_CONDITIONS_DISEASES,
			condition.trim(),
			Parser.SRC_XPHB,
			hash,
		);
	}

	// Data getters for sub-modules
	getRaces () { return this._races; }
	getClasses () { return this._classes; }
	getSubclasses () { return this._subclasses; }
	getClassFeatures () { return this._classFeatures; }
	getSubclassFeatures () { return this._subclassFeatures; }
	getBackgrounds () { return this._backgrounds; }
	getSpells () { return this._spellsData; }
	getItems () { return this._itemsData; }
	getFeats () { return this._featsData; }
	getOptionalFeatures () { return this._optionalFeaturesData; }
	getState () { return this._state; }

	async saveCharacter () {
		await this._saveCurrentCharacter();
	}

	renderCharacter () {
		this._renderCharacter();
	}
	// #endregion
}

// Initialize on page load
window.addEventListener("load", async () => {
	console.log("CharacterSheetPage: Page load event fired");
	console.log("PrereleaseUtil available:", typeof PrereleaseUtil !== "undefined");
	console.log("BrewUtil2 available:", typeof BrewUtil2 !== "undefined");
	console.log("DataUtil available:", typeof DataUtil !== "undefined");
	console.log("$ available:", typeof $ !== "undefined");
	
	try {
		console.log("CharacterSheetPage: Starting initialization...");
		await Promise.all([
			PrereleaseUtil.pInit(),
			BrewUtil2.pInit(),
		]);
		console.log("CharacterSheetPage: Prerelease and Brew initialized");
		ExcludeUtil.pInitialise().then(null); // don't await, as this is only used for search

		const charSheet = new CharacterSheetPage();
		await charSheet.pInit();

		window.charSheet = charSheet; // For debugging
		console.log("Character sheet initialized successfully");

		// Show a success toast to confirm initialization worked
		JqueryUtil.doToast({type: "success", content: "Character sheet loaded successfully!"});

		window.dispatchEvent(new Event("toolsLoaded"));
	} catch (e) {
		console.error("Failed to initialize character sheet:", e);
		JqueryUtil.doToast({type: "danger", content: `Failed to initialize: ${e.message}`});
	}
});

// Export for other modules
export {CharacterSheetPage};

// Also expose on globalThis for non-module scripts
globalThis.CharacterSheetPage = CharacterSheetPage;
