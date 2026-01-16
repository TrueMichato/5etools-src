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
		this._skillsData = [];
		this._conditionsData = [];
		this._languagesData = [];
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
		// Also pre-cache class/subclass features in DataLoader so hover links work properly
		const [races, classes, backgrounds, spells, items, feats, optFeatures, skills, conditionsData, languagesData, prereleaseData, brewData] = await Promise.all([
			DataUtil.race.loadJSON(),
			DataUtil.class.loadRawJSON(),
			DataUtil.loadJSON("data/backgrounds.json"),
			DataUtil.spell.pLoadAll(),
			Renderer.item.pBuildList(),
			DataUtil.loadJSON("data/feats.json"),
			DataUtil.loadJSON("data/optionalfeatures.json"),
			DataUtil.loadJSON("data/skills.json"),
			DataUtil.loadJSON("data/conditionsdiseases.json"),
			DataUtil.loadJSON("data/languages.json"),
			// Load homebrew/prerelease data
			PrereleaseUtil.pGetBrewProcessed(),
			BrewUtil2.pGetBrewProcessed(),
		]);

		// Base site data
		// Merge subraces into races to get _baseName, _baseSource properties for subrace grouping
		// Also expand _versions for 2024 races that use version system instead of subraces
		this._races = this._processRaceData(races.race || []);
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
		this._skillsData = skills.skill || [];
		this._conditionsData = conditionsData.condition || [];
		this._languagesData = languagesData.language || [];

		// Pre-cache class/subclass features in DataLoader so hover links work properly
		// This runs in parallel with the data processing below
		this._pPreCacheClassFeatures();

		// Merge prerelease/homebrew data
		this._mergeBrewData(prereleaseData);
		this._mergeBrewData(brewData);

		console.log("[CharSheet] Data loaded - Races:", this._races.length, "Classes:", this._classes.length, 
			"Spells:", this._spellsData.length, "Items:", this._itemsData.length,
			"Homebrew sources loaded:", this._getBrewSourceCount(prereleaseData, brewData));

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

	/**
	 * Pre-cache class and subclass features in DataLoader
	 * This ensures hover links for @classFeature and @subclassFeature work properly
	 * Runs in parallel and doesn't block page initialization
	 */
	async _pPreCacheClassFeatures () {
		try {
			await Promise.all([
				DataLoader.pCacheAndGetAllSite("classFeature"),
				DataLoader.pCacheAndGetAllSite("subclassFeature"),
				DataLoader.pCacheAndGetAllPrerelease("classFeature"),
				DataLoader.pCacheAndGetAllPrerelease("subclassFeature"),
				DataLoader.pCacheAndGetAllBrew("classFeature"),
				DataLoader.pCacheAndGetAllBrew("subclassFeature"),
			]);
		} catch (e) {
			// Non-critical - just means some hover links may not work
			console.warn("[CharSheet] Failed to pre-cache class features for hovers:", e);
		}
	}

	/**
	 * Process race data by merging subraces and expanding _versions
	 * For 2024 races (XPHB), races may use _versions instead of subraces
	 * @param {Array} rawRaces - Raw race array from data file
	 * @returns {Array} Processed race array with _baseName/_baseSource set appropriately
	 */
	_processRaceData (rawRaces) {
		const out = [];
		
		for (const race of rawRaces) {
			// First, check if this race has _versions that need expansion
			const hasVersions = race._versions?.length > 0;
			let expandedVersions = [];
			
			if (hasVersions) {
				try {
					// Expand versions using DataUtil - this creates full entity copies with modifications
					expandedVersions = DataUtil.generic.getVersions(
						{...race, __prop: "race"},
						{isExternalApplicationIdentityOnly: false}
					);
					
					// Set _baseName/_baseSource on versions so they group with the base race
					for (const version of expandedVersions) {
						version._baseName = race.name;
						version._baseSource = race.source;
						version.__prop = "race";
					}
				} catch (e) {
					console.warn("[CharSheet] Failed to expand race versions for:", race.name, e);
				}
			}
			
			// Merge subraces using the standard method
			// This handles traditional subraces and sets _baseName/_baseSource
			// Only add base race entries if there are subraces OR versions
			const hasSubraces = race.subraces?.length > 0;
			const mergedSubraces = Renderer.race.mergeSubraces([race], {isAddBaseRaces: hasSubraces || expandedVersions.length > 0});
			out.push(...mergedSubraces);
			
			// Add expanded versions
			if (expandedVersions.length) {
				out.push(...expandedVersions);
			}
		}
		
		return out;
	}

	/**
	 * Merge homebrew/prerelease data into the main data arrays
	 * @param {Object} brewData - The processed brew data object
	 */
	_mergeBrewData (brewData) {
		if (!brewData) return;

		// Races - process with same logic as site races (mergeSubraces + expand _versions)
		if (brewData.race?.length) {
			const processedBrewRaces = this._processRaceData(MiscUtil.copyFast(brewData.race));
			this._races = [...this._races, ...processedBrewRaces];
		}

		// Classes
		if (brewData.class?.length) {
			this._classes = [...this._classes, ...MiscUtil.copyFast(brewData.class)];
		}

		// Subclasses
		if (brewData.subclass?.length) {
			this._subclasses = [...this._subclasses, ...MiscUtil.copyFast(brewData.subclass)];
		}

		// Class features
		if (brewData.classFeature?.length) {
			this._classFeatures = [...this._classFeatures, ...MiscUtil.copyFast(brewData.classFeature)];
		}

		// Subclass features
		if (brewData.subclassFeature?.length) {
			this._subclassFeatures = [...this._subclassFeatures, ...MiscUtil.copyFast(brewData.subclassFeature)];
		}

		// Backgrounds
		if (brewData.background?.length) {
			this._backgrounds = [...this._backgrounds, ...MiscUtil.copyFast(brewData.background)];
		}

		// Spells
		if (brewData.spell?.length) {
			this._spellsData = [...this._spellsData, ...MiscUtil.copyFast(brewData.spell)];
		}

		// Items - need to handle differently as items can be complex
		if (brewData.item?.length) {
			const brewItems = MiscUtil.copyFast(brewData.item).filter(it => !it._isItemGroup);
			this._itemsData = [...this._itemsData, ...brewItems];
		}

		// Feats
		if (brewData.feat?.length) {
			this._featsData = [...this._featsData, ...MiscUtil.copyFast(brewData.feat)];
		}

		// Optional features (invocations, metamagic, etc.)
		if (brewData.optionalfeature?.length) {
			this._optionalFeaturesData = [...this._optionalFeaturesData, ...MiscUtil.copyFast(brewData.optionalfeature)];
		}

		// Skills (rare but possible)
		if (brewData.skill?.length) {
			this._skillsData = [...this._skillsData, ...MiscUtil.copyFast(brewData.skill)];
		}

		// Conditions/diseases
		if (brewData.condition?.length) {
			const brewConditions = MiscUtil.copyFast(brewData.condition);
			this._conditionsData = [...this._conditionsData, ...brewConditions];
			// Register homebrew conditions with their effects
			CharacterSheetState.registerHomebrewConditions(brewConditions);
		}
	}

	/**
	 * Count unique homebrew sources for logging
	 */
	_getBrewSourceCount (prereleaseData, brewData) {
		const sources = new Set();
		[prereleaseData, brewData].forEach(data => {
			if (data?._meta?.sources) {
				data._meta.sources.forEach(src => sources.add(src.json));
			}
		});
		return sources.size;
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
		$("#charsheet-btn-modifiers").on("click", () => this._showCustomModifiersModal());
		$("#charsheet-btn-settings").on("click", () => this._showSettingsModal());
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
		$("#charsheet-box-initiative").on("click", (e) => this._rollInitiative(e));
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

		// Edit proficiencies
		$("#charsheet-edit-proficiencies").on("click", () => this._showEditProficienciesModal());

		// Edit weapon masteries
		$("#charsheet-edit-masteries").on("click", () => this._showEditWeaponMasteriesModal());

		// Add custom feature
		$("#charsheet-add-custom-feature").on("click", () => this._showAddCustomFeatureModal());
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
		this._renderActiveStates();
		this._renderAttacks();
		this._renderQuickSpells();
		this._renderAbilitiesDetailed();
		this._renderCustomFeatures();
		this._renderModifierIndicators();

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
				<div class="charsheet__ability" data-ability="${abl}" title="Click to roll ${Parser.attAbvToFull(abl)} (Shift=Adv, Ctrl=Dis)">
					<div class="charsheet__ability-name">${abl.toUpperCase()}</div>
					<div class="charsheet__ability-score" id="charsheet-ability-${abl}-score">10</div>
					<div class="charsheet__ability-mod" id="charsheet-ability-${abl}-mod">+0</div>
				</div>
			`);

			$ability.on("click", (e) => this._rollAbilityCheck(abl, e));
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
				<div class="charsheet__save-row" data-save="${abl}" title="Click to roll ${Parser.attAbvToFull(abl)} save (Shift=Adv, Ctrl=Dis)">
					<span class="charsheet__prof-indicator ${isProficient ? "charsheet__prof-indicator--proficient" : ""}"></span>
					<span class="charsheet__save-name">${Parser.attAbvToFull(abl)}</span>
					<span class="charsheet__save-mod">${modStr}</span>
				</div>
			`);

			$row.on("click", (e) => this._rollSavingThrow(abl, e));
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

		// Get skills from loaded data (dynamic, supports homebrew)
		const skills = this.getSkillsList();

		// Check for Jack of All Trades (half proficiency for non-proficient skills)
		const hasJackOfAllTrades = this._state.hasJackOfAllTrades();

		skills.forEach(skill => {
			const skillKey = skill.name.toLowerCase().replace(/\s+/g, "");
			const profLevel = this._state.getSkillProficiency(skillKey);
			const mod = this._state.getSkillMod(skillKey);
			const modStr = mod >= 0 ? `+${mod}` : mod;

			let profClass = "";
			let profTitle = "Not proficient - Click to toggle proficiency";
			if (profLevel === 2) {
				profClass = "charsheet__prof-indicator--expertise";
				profTitle = "Expertise (2x proficiency bonus) - Click to toggle";
			} else if (profLevel === 1) {
				profClass = "charsheet__prof-indicator--proficient";
				profTitle = "Proficient - Click to toggle";
			} else if (hasJackOfAllTrades) {
				profClass = "charsheet__prof-indicator--half";
				profTitle = "Half proficiency (Jack of All Trades) - Click to toggle";
			}

			const customClass = skill.isCustom ? " charsheet__skill-row--custom" : "";
			const $row = $(`
				<div class="charsheet__skill-row${customClass}" data-skill="${skillKey}" data-default-ability="${skill.ability}" title="Click to roll ${skill.name} (Shift=Adv, Ctrl=Dis, Right-click for alternate ability)">
					<span class="charsheet__prof-indicator charsheet__prof-indicator--clickable ${profClass}" title="${profTitle}" data-skill="${skillKey}"></span>
					<span class="charsheet__skill-name">${skill.name}${skill.isCustom ? " ✦" : ""}</span>
					<span class="charsheet__skill-ability">(${skill.ability.toUpperCase()})</span>
					<span class="charsheet__skill-mod">${modStr}</span>
					${skill.isCustom ? `<span class="charsheet__skill-delete" title="Remove custom skill">×</span>` : ""}
				</div>
			`);

			// Proficiency toggle click handler
			$row.find(".charsheet__prof-indicator").on("click", (e) => {
				e.stopPropagation();
				this._cycleSkillProficiency(skillKey);
			});

			$row.on("click", (e) => {
				// Don't roll if clicking delete button or prof indicator
				if ($(e.target).hasClass("charsheet__skill-delete")) return;
				if ($(e.target).hasClass("charsheet__prof-indicator")) return;
				this._rollSkillCheck(skillKey, skill.name, e);
			});
			$row.on("contextmenu", (e) => this._showSkillAbilityMenu(e, skillKey, skill.name, skill.ability));

			if (skill.isCustom) {
				$row.find(".charsheet__skill-delete").on("click", (e) => {
					e.stopPropagation();
					this._state.removeCustomSkill(skill.name);
					this._renderSkills();
					this._saveCurrentCharacter();
				});
			}

			$container.append($row);
		});

		// Add "Add Custom Skill" button
		const $addBtn = $(`
			<div class="charsheet__skill-add" title="Add a custom skill">
				<span class="charsheet__skill-add-icon">+</span>
				<span class="charsheet__skill-add-text">Add Custom Skill</span>
			</div>
		`);
		$addBtn.on("click", () => this._showAddCustomSkillModal());
		$container.append($addBtn);
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
		const maxExhaustion = this._state.getMaxExhaustion();
		let speedDisplay = this._state.getSpeed();
		
		if (exhaustion > 0 && exhaustion < maxExhaustion) {
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
			// Thelemar rules: no speed penalty
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

		// Weapon Masteries
		this._renderWeaponMasteries();
	}

	/**
	 * Extract mastery name from item's mastery property
	 * Handles both string format ("Sap|XPHB") and object format ({uid: "Sap|XPHB", note: "..."})
	 */
	_getMasteryName (masteryEntry) {
		if (!masteryEntry) return "";
		if (typeof masteryEntry === "string") {
			return masteryEntry.split("|")[0];
		}
		if (typeof masteryEntry === "object" && masteryEntry.uid) {
			return masteryEntry.uid.split("|")[0];
		}
		return "";
	}

	/**
	 * Render weapon masteries display in combat section
	 */
	_renderWeaponMasteries () {
		const masteries = this._state.getWeaponMasteries();
		const $group = $("#charsheet-masteries-group");
		const $container = $("#charsheet-combat-masteries");

		// Check if character has Weapon Mastery feature
		const maxMasteries = this._getMaxWeaponMasteries();
		const hasWeaponMasteryFeature = maxMasteries > 0;

		if (!hasWeaponMasteryFeature) {
			// Hide if character doesn't have the Weapon Mastery feature
			$group.hide();
			return;
		}

		// Show the section since character has the feature
		$group.show();
		$container.empty();

		if (masteries?.length) {
			// Render each mastery as a badge with the mastery property
			masteries.forEach(m => {
				const [weaponName, source] = m.split("|");
				// Find the BASE weapon to get its mastery property
				const weapon = this._itemsData?.find(i => 
					i._isBaseItem &&
					i.name.toLowerCase() === weaponName.toLowerCase() && 
					(!source || i.source === source)
				);
				const masteryProp = this._getMasteryName(weapon?.mastery?.[0]);
				
				const $badge = $(`
					<span class="charsheet__mastery-badge" title="${masteryProp ? `Mastery: ${masteryProp}` : weaponName}">
						<strong>${weaponName}</strong>
						${masteryProp ? `<span class="charsheet__mastery-prop">${masteryProp}</span>` : ""}
					</span>
				`);
				$container.append($badge);
			});
			
			// Show count
			$container.append(`<span class="ve-muted ve-small ml-2">(${masteries.length}/${maxMasteries})</span>`);
		} else {
			// No masteries selected yet
			$container.html(`<span class="ve-muted">None selected - click ✎ to choose weapons</span>`);
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

	/**
	 * Render visual indicators for active modifiers
	 * Updates the button badge and adds visual cues to affected stats
	 */
	_renderModifierIndicators () {
		const modifiers = this._state.getNamedModifiers();
		const activeModifiers = modifiers.filter(m => m.enabled);
		const activeCount = activeModifiers.length;

		// Update button badge
		const $btn = $("#charsheet-btn-modifiers");
		$btn.find(".charsheet__modifier-badge").remove();
		
		if (activeCount > 0) {
			$btn.append(`<span class="charsheet__modifier-badge">${activeCount}</span>`);
			$btn.addClass("charsheet__btn--has-modifiers");
		} else {
			$btn.removeClass("charsheet__btn--has-modifiers");
		}

		// Add/remove indicator classes on affected stat displays
		const acMod = this._state.getCustomModifier("ac");
		const initMod = this._state.getCustomModifier("initiative");
		const speedMod = this._state.getCustomModifier("speed");
		const attackMod = this._state.getCustomModifier("attack");
		const damageMod = this._state.getCustomModifier("damage");

		// AC indicator
		const $acBox = $("#charsheet-box-ac");
		$acBox.removeClass("charsheet__combat-stat--modified-positive charsheet__combat-stat--modified-negative");
		if (acMod !== 0) {
			$acBox.addClass(acMod > 0 ? "charsheet__combat-stat--modified-positive" : "charsheet__combat-stat--modified-negative");
		}
		$acBox.attr("title", acMod !== 0 ? `AC modified by ${acMod >= 0 ? "+" : ""}${acMod}` : "Armor Class");

		// Initiative indicator
		const $initBox = $("#charsheet-box-initiative");
		$initBox.removeClass("charsheet__combat-stat--modified-positive charsheet__combat-stat--modified-negative");
		if (initMod !== 0) {
			$initBox.addClass(initMod > 0 ? "charsheet__combat-stat--modified-positive" : "charsheet__combat-stat--modified-negative");
		}
		$initBox.attr("title", initMod !== 0 ? `Initiative modified by ${initMod >= 0 ? "+" : ""}${initMod}` : "Click to roll Initiative (Shift=Adv, Ctrl=Dis)");

		// Speed indicator
		const $speedBox = $("#charsheet-box-speed");
		if ($speedBox.length) {
			$speedBox.removeClass("charsheet__combat-stat--modified-positive charsheet__combat-stat--modified-negative");
			if (speedMod !== 0) {
				$speedBox.addClass(speedMod > 0 ? "charsheet__combat-stat--modified-positive" : "charsheet__combat-stat--modified-negative");
			}
			$speedBox.attr("title", speedMod !== 0 ? `Speed modified by ${speedMod >= 0 ? "+" : ""}${speedMod} ft.` : "Speed");
		}

		// Also update save rows if they have modifiers
		Parser.ABIL_ABVS.forEach(abl => {
			const saveMod = this._state.getCustomModifier(`save:${abl}`);
			const $row = $(`.charsheet__save-row[data-save="${abl}"]`);
			$row.removeClass("charsheet__save-row--modified-positive charsheet__save-row--modified-negative");
			if (saveMod !== 0) {
				$row.addClass(saveMod > 0 ? "charsheet__save-row--modified-positive" : "charsheet__save-row--modified-negative");
			}
		});

		// Update skill rows if they have modifiers
		const skills = this.getSkillsList();
		skills.forEach(skill => {
			const skillKey = skill.name.toLowerCase().replace(/\s+/g, "");
			const skillMod = this._state.getSkillCustomMod(skillKey);
			const $row = $(`.charsheet__skill-row[data-skill="${skillKey}"]`);
			$row.removeClass("charsheet__skill-row--modified-positive charsheet__skill-row--modified-negative");
			if (skillMod !== 0) {
				$row.addClass(skillMod > 0 ? "charsheet__skill-row--modified-positive" : "charsheet__skill-row--modified-negative");
			}
		});
	}

	_renderConditions () {
		const $container = $("#charsheet-conditions");
		$container.empty();

		const conditions = this._state.getConditions();
		conditions.forEach(condition => {
			// Get condition effects for tooltip
			const condDef = CharacterSheetState.getConditionEffects(condition);
			const icon = condDef?.icon || "❓";
			const description = condDef?.description || "Unknown condition";
			
			// Build effect list for tooltip
			let effectsHtml = "";
			if (condDef?.effects?.length) {
				const effectList = condDef.effects.map(e => {
					if (e.type === "advantage") return `• Advantage on ${e.target}`;
					if (e.type === "disadvantage") return `• Disadvantage on ${e.target}`;
					if (e.type === "autoFail") return `• Auto-fail ${e.target}`;
					if (e.type === "setSpeed") return `• Speed set to ${e.value}`;
					if (e.type === "resistance") return `• Resistance to ${e.target}`;
					if (e.type === "bonus") return `• ${e.value >= 0 ? "+" : ""}${e.value} to ${e.target}`;
					if (e.type === "note") return `• ${e.value}`;
					return null;
				}).filter(Boolean);
				if (effectList.length) {
					effectsHtml = `<div class="mt-1 ve-small">${effectList.join("<br>")}</div>`;
				}
			}
			
			// Use instance method for proper homebrew source lookup
			const conditionLink = this.getConditionLink(condition);
			const $badge = $(`
				<span class="charsheet__condition-badge" title="${description}">
					<span class="charsheet__condition-icon">${icon}</span>
					${conditionLink}
					<span class="charsheet__condition-remove glyphicon glyphicon-remove"></span>
				</span>
			`);

			// Add tooltip with effects
			if (effectsHtml) {
				$badge.attr("data-tippy-content", `<strong>${condDef?.name || condition}</strong>: ${description}${effectsHtml}`);
			}

			$badge.find(".charsheet__condition-remove").on("click", () => {
				this._state.removeCondition(condition);
				this._saveCurrentCharacter();
				this._renderConditions();
				this._renderActiveStates(); // Also update active states since conditions create states
				this._renderCharacter(); // Re-render to apply effects
				// Sync combat tab
				this._combat?.renderCombatConditions?.();
				this._combat?.renderCombatEffects?.();
				this._combat?.renderCombatDefenses?.();
			});

			$container.append($badge);
		});
	}

	_renderExhaustion () {
		const exhaustion = this._state.getExhaustion();
		const rules = this._state.getExhaustionRules();
		const maxExhaustion = this._state.getMaxExhaustion();
		const $number = $("#charsheet-exhaustion-display .charsheet__exhaustion-number");
		const $label = $("#charsheet-exhaustion-display .charsheet__exhaustion-label");
		const $effect = $("#charsheet-exhaustion-effect");
		const $rulesToggle = $("#charsheet-exhaustion-rules");

		$number.text(exhaustion);
		$label.text(`/ ${maxExhaustion}`);

		// Update color based on level (normalize to 0-6 range for CSS classes)
		$number.removeClass("exhaustion-0 exhaustion-1 exhaustion-2 exhaustion-3 exhaustion-4 exhaustion-5 exhaustion-6 exhaustion-max");
		if (exhaustion >= maxExhaustion) {
			$number.addClass("exhaustion-max");
		} else if (rules === "thelemar") {
			// For Thelemar, map 0-10 to color classes
			const colorLevel = Math.min(6, Math.floor(exhaustion * 6 / 10));
			$number.addClass(`exhaustion-${colorLevel}`);
		} else {
			$number.addClass(`exhaustion-${exhaustion}`);
		}

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

		// Thelemar rules: -1 per level to all rolls and DCs, death at 10
		let effectText;
		if (rules === "thelemar") {
			if (exhaustion === 0) {
				effectText = "No exhaustion";
			} else if (exhaustion >= 10) {
				effectText = "Death";
			} else {
				effectText = `-${exhaustion} to all rolls and DCs`;
			}
		} else {
			const effects = rules === "2024" ? effects2024 : effects2014;
			effectText = effects[exhaustion] || effects[effects.length - 1];
		}
		$effect.html(effectText);

		// Render rules toggle if container exists
		if ($rulesToggle.length && !$rulesToggle.data("initialized")) {
			$rulesToggle.data("initialized", true);
			$rulesToggle.html(`
				<select id="charsheet-exhaustion-rules-select" class="ve-form-control ve-form-control--sm">
					<option value="2024" ${rules === "2024" ? "selected" : ""}>2024 Rules</option>
					<option value="2014" ${rules === "2014" ? "selected" : ""}>2014 Rules</option>
					<option value="thelemar" ${rules === "thelemar" ? "selected" : ""}>Thelemar Rules</option>
				</select>
			`);
			$rulesToggle.find("select").on("change", (e) => {
				this._state.setExhaustionRules(e.target.value);
				this._saveCurrentCharacter();
				this._renderExhaustion();
				this._renderCombatStats(); // Re-render to update speed
				// Re-render spells to update DC
				if (this._spellsModule) {
					this._spellsModule.render();
				}
			});
		} else if ($rulesToggle.length) {
			$rulesToggle.find("select").val(rules);
		}
	}

	_addExhaustion () {
		const current = this._state.getExhaustion();
		const max = this._state.getMaxExhaustion();
		if (current >= max) {
			JqueryUtil.doToast({type: "warning", content: `Maximum exhaustion (${max}) reached!`});
			return;
		}
		this._state.addExhaustion();
		this._saveCurrentCharacter();
		this._renderExhaustion();
		this._renderCombatStats();
		// Re-render spells to update DC (Thelemar rules)
		if (this._spellsModule && this._state.getExhaustionRules() === "thelemar") {
			this._spellsModule.render();
		}
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
		this._renderCombatStats();
		// Re-render spells to update DC (Thelemar rules)
		if (this._spellsModule && this._state.getExhaustionRules() === "thelemar") {
			this._spellsModule.render();
		}
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

		// Get skills from loaded data (dynamic, supports homebrew)
		const skills = this.getSkillsList();

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
		const usesCombatSystem = this._state.usesCombatSystem?.() || false;

		// Show exertion if character uses combat methods system
		if (usesCombatSystem) {
			// Ensure exertion is initialized
			if (typeof this._state.ensureExertionInitialized === "function") {
				this._state.ensureExertionInitialized();
			}
			
			const exertionMax = this._state.getExertionMax() || 0;
			const exertionCurrent = this._state.getExertionCurrent() ?? exertionMax;
			
			if (exertionMax > 0) {
				const $row = $(`
					<div class="charsheet__resource-row" data-resource-id="exertion">
						<span class="charsheet__resource-name">Exertion</span>
						<span class="charsheet__resource-recharge ve-muted ve-small ml-2">(Short)</span>
						<div class="charsheet__resource-uses ml-auto">
							<button class="ve-btn ve-btn-xs ve-btn-danger mr-2 charsheet__exertion-use-btn" ${exertionCurrent <= 0 ? "disabled" : ""}>Use</button>
							<span class="charsheet__resource-current">${exertionCurrent}</span>
							<span class="charsheet__resource-max">/ ${exertionMax}</span>
							<button class="ve-btn ve-btn-xs ve-btn-success ml-2 charsheet__exertion-restore-btn" ${exertionCurrent >= exertionMax ? "disabled" : ""}>+</button>
						</div>
					</div>
				`);

				$row.find(".charsheet__exertion-use-btn").on("click", () => {
					const current = this._state.getExertionCurrent() || 0;
					if (current > 0) {
						this._state.setExertionCurrent(current - 1);
						this._saveCurrentCharacter();
						this._renderResources();
						this._renderActiveStates(); // Refresh active states to update Activate button states
						if (this._features) this._features._renderResources();
						if (this._combat) this._combat._updateExertionDisplay();
					}
				});

				$row.find(".charsheet__exertion-restore-btn").on("click", () => {
					const current = this._state.getExertionCurrent() || 0;
					if (current < exertionMax) {
						this._state.setExertionCurrent(current + 1);
						this._saveCurrentCharacter();
						this._renderResources();
						this._renderActiveStates(); // Refresh active states to update Activate button states
						if (this._features) this._features._renderResources();
						if (this._combat) this._combat._updateExertionDisplay();
					}
				});

				$container.append($row);
			}
		}

		if (!resources.length && !usesCombatSystem) {
			$container.html(`<div class="ve-muted ve-text-center py-2">No limited-use features</div>`);
			return;
		}

		resources.forEach(resource => {
			const $row = $(`
				<div class="charsheet__resource-row" data-resource-id="${resource.id}">
					<span class="charsheet__resource-name">${resource.name}</span>
					<span class="charsheet__resource-recharge ve-muted ve-small ml-2">(${resource.recharge === "short" ? "Short" : "Long"})</span>
					<div class="charsheet__resource-uses ml-auto">
						<button class="ve-btn ve-btn-xs ve-btn-danger mr-2 charsheet__resource-use-btn" ${resource.current <= 0 ? "disabled" : ""}>Use</button>
						<span class="charsheet__resource-current">${resource.current}</span>
						<span class="charsheet__resource-max">/ ${resource.max}</span>
						<button class="ve-btn ve-btn-xs ve-btn-success ml-2 charsheet__resource-restore-btn" ${resource.current >= resource.max ? "disabled" : ""}>+</button>
					</div>
				</div>
			`);

			$row.find(".charsheet__resource-use-btn").on("click", () => {
				if (resource.current > 0) {
					this._state.setResourceCurrent(resource.id, resource.current - 1);
					this._saveCurrentCharacter();
					this._renderResources();
					this._renderActiveStates(); // Refresh active states to update Activate button states
					if (this._features) this._features._renderResources();
				}
			});

			$row.find(".charsheet__resource-restore-btn").on("click", () => {
				if (resource.current < resource.max) {
					this._state.setResourceCurrent(resource.id, resource.current + 1);
					this._saveCurrentCharacter();
					this._renderResources();
					this._renderActiveStates(); // Refresh active states to update Activate button states
					if (this._features) this._features._renderResources();
				}
			});

			$container.append($row);
		});
	}

	_renderActiveStates () {
		const $container = $("#charsheet-active-states");
		$container.empty();

		const activeStates = this._state.getActiveStates();
		const activatableFeatures = this._state.getActivatableFeatures();
		const concentration = this._state.getConcentration();
		
		// Filter out condition-derived states (they're shown in the Conditions section)
		const nonConditionStates = activeStates.filter(s => !s.isCondition);
		
		// Get currently active state type IDs
		const activeStateTypeIds = new Set(nonConditionStates.filter(s => s.active).map(s => s.stateTypeId));

		// === Section 1: Currently Active States ===
		const hasActiveStates = nonConditionStates.some(s => s.active) || concentration;
		
		if (hasActiveStates) {
			const $activeSection = $(`<div class="charsheet__active-states-section mb-3">
				<div class="charsheet__section-subtitle ve-flex-v-center mb-1">
					<span class="ve-small ve-bold text-success">● Currently Active</span>
				</div>
			</div>`);
			
			// Render active states
			nonConditionStates.filter(s => s.active).forEach(state => {
				const stateType = CharacterSheetState.ACTIVE_STATE_TYPES[state.stateTypeId];
				const $row = this._renderActiveStateRow(state, stateType, true);
				$activeSection.append($row);
			});
			
			// Show concentration if active
			if (concentration) {
				const $concRow = $(`
					<div class="charsheet__state-row charsheet__state--active">
						<span class="charsheet__state-icon">🔮</span>
						<span class="charsheet__state-name">Concentrating: ${concentration.spellName || "Unknown"}</span>
						<div class="charsheet__state-controls ml-auto">
							<button class="ve-btn ve-btn-xs ve-btn-warning charsheet__end-concentration-btn">End</button>
						</div>
					</div>
				`);
				$concRow.find(".charsheet__end-concentration-btn").on("click", () => {
					this._state.breakConcentration();
					this._saveCurrentCharacter();
					this._renderActiveStates();
				});
				$activeSection.append($concRow);
			}
			
			$container.append($activeSection);
		}

		// === Section 2: Available Activatable Features ===
		// Show features that can be activated but aren't currently active
		const availableFeatures = activatableFeatures.filter(af => !af.isActive);
		
		if (availableFeatures.length > 0 || !hasActiveStates) {
			const $availableSection = $(`<div class="charsheet__activatable-section">
				<div class="charsheet__section-subtitle ve-flex-v-center mb-1">
					<span class="ve-small ve-muted">Available to Activate</span>
				</div>
			</div>`);
			
			if (availableFeatures.length === 0) {
				$availableSection.append(`<div class="ve-muted ve-small ve-text-center py-1">No activatable features</div>`);
			} else {
				availableFeatures.forEach(({feature, activationInfo, resource, stateTypeId}) => {
					const stateType = activationInfo.stateType || CharacterSheetState.ACTIVE_STATE_TYPES[stateTypeId];
					const icon = stateType?.icon || "⚡";
					// Use resource cost from description detection, or resource object, or default
					const resourceCost = resource?.cost || activationInfo.exertionCost || stateType?.resourceCost || 1;
					const hasResourceAvailable = !resource || resource.current >= resourceCost;
					
					// Get activation action type
					const activationAction = activationInfo.activationAction || stateType?.activationAction;
					const actionLabel = this._getActionLabel(activationAction);
					
					// Create hoverable feature name link
					const featureNameHtml = this._getFeatureHoverLink(feature);
					
					const $row = $(`
						<div class="charsheet__activatable-row ve-flex-v-center py-1 px-2 mb-1 rounded" 
							style="background: var(--rgb-bg-alt, #f8f9fa);">
							<span class="charsheet__state-icon mr-2">${icon}</span>
							<div class="ve-flex-col flex-grow-1" style="min-width: 0;">
								<span class="charsheet__state-name">${featureNameHtml}</span>
							</div>
							<div class="charsheet__state-controls ml-auto ve-flex-v-center">
								${actionLabel ? `<span class="ve-small ve-muted mr-1">${actionLabel}</span>` : ""}
								<button class="ve-btn ve-btn-xs ve-btn-success charsheet__activate-btn" 
									${!hasResourceAvailable ? 'disabled title="No uses remaining"' : ''}>
									Activate${resourceCost > 0 && resource ? ` (${resourceCost})` : ""}
								</button>
							</div>
						</div>
					`);
					
					$row.find(".charsheet__activate-btn").on("click", () => {
						this._activateFeatureState(feature, stateTypeId, stateType, resource, resourceCost);
					});
					
					$availableSection.append($row);
				});
			}
			
			$container.append($availableSection);
		}

		// === Section 3: Inactive/Ended States (can be removed) ===
		const endedStates = nonConditionStates.filter(s => !s.active);
		if (endedStates.length > 0) {
			const $endedSection = $(`<div class="charsheet__ended-states-section mt-2">
				<div class="charsheet__section-subtitle ve-flex-v-center mb-1">
					<span class="ve-small ve-muted">Ended (click to remove)</span>
				</div>
			</div>`);
			
			endedStates.forEach(state => {
				const stateType = CharacterSheetState.ACTIVE_STATE_TYPES[state.stateTypeId];
				const $row = $(`
					<div class="charsheet__state-row charsheet__state--inactive ve-small py-1">
						<span class="charsheet__state-icon">${state.icon || stateType?.icon || "⚡"}</span>
						<span class="charsheet__state-name ve-muted">${state.name}</span>
						<div class="charsheet__state-controls ml-auto">
							<button class="ve-btn ve-btn-xs ve-btn-default charsheet__reactivate-btn mr-1" title="Reactivate">↻</button>
							<button class="ve-btn ve-btn-xs ve-btn-danger charsheet__remove-btn" title="Remove">×</button>
						</div>
					</div>
				`);
				
				$row.find(".charsheet__reactivate-btn").on("click", () => {
					this._state.activateState(state.stateTypeId);
					this._saveCurrentCharacter();
					this._renderActiveStates();
					this._renderCharacter();
				});
				
				$row.find(".charsheet__remove-btn").on("click", () => {
					this._state.removeActiveState(state.id);
					this._saveCurrentCharacter();
					this._renderActiveStates();
				});
				
				$endedSection.append($row);
			});
			
			$container.append($endedSection);
		}

		// === Section 4: Quick Actions (Dodge, etc.) ===
		// Check if character has Reckless Attack (barbarian level 2+)
		const barbarianClass = this._state._data.classes?.find(c => c.name?.toLowerCase() === "barbarian");
		const hasRecklessAttack = barbarianClass && barbarianClass.level >= 2;
		
		const $quickActions = $(`<div class="charsheet__quick-actions mt-2 pt-2 border-top">
			<span class="ve-small ve-muted mr-2">Quick:</span>
			<button class="ve-btn ve-btn-xs ${activeStateTypeIds.has("dodge") ? "ve-btn-warning" : "ve-btn-default"} mr-1 charsheet__toggle-dodge-btn">
				💨 ${activeStateTypeIds.has("dodge") ? "End Dodge" : "Dodge"}
			</button>
			${hasRecklessAttack ? `<button class="ve-btn ve-btn-xs ${activeStateTypeIds.has("recklessAttack") ? "ve-btn-warning" : "ve-btn-default"} mr-1 charsheet__toggle-reckless-btn">
				⚡ ${activeStateTypeIds.has("recklessAttack") ? "End Reckless" : "Reckless"}
			</button>` : ""}
		</div>`);
		
		$quickActions.find(".charsheet__toggle-dodge-btn").on("click", () => {
			if (this._state.isStateTypeActive("dodge")) {
				this._state.deactivateState("dodge");
			} else {
				this._state.activateState("dodge");
			}
			this._saveCurrentCharacter();
			this._renderActiveStates();
			this._renderCharacter();
		});
		
		if (hasRecklessAttack) {
			$quickActions.find(".charsheet__toggle-reckless-btn").on("click", () => {
				if (this._state.isStateTypeActive("recklessAttack")) {
					this._state.deactivateState("recklessAttack");
				} else {
					this._state.activateState("recklessAttack");
				}
				this._saveCurrentCharacter();
				this._renderActiveStates();
				this._renderCharacter();
			});
		}
		
		$container.append($quickActions);
		
		// Sync combat tab's active states, defenses, and effects display
		this._combat?.renderCombatStates?.();
		this._combat?.renderCombatDefenses?.();
		this._combat?.renderCombatEffects?.();
	}

	/**
	 * Get a short label for an activation action type
	 */
	_getActionLabel (actionType) {
		switch (actionType) {
			case "bonus": return "🎯 Bonus";
			case "action": return "⚔️ Action";
			case "reaction": return "↩️ Reaction";
			case "free": return "✨ Free";
			default: return "";
		}
	}

	/**
	 * Create a hover link for an activatable feature
	 * @param {object} feature - The feature object
	 * @returns {string} HTML string with hover attributes
	 */
	_getFeatureHoverLink (feature) {
		try {
			// Class features - link to class feature page
			if (feature.featureType === "Class" && feature.className) {
				const storedClass = this._state.getClasses().find(c => c.name?.toLowerCase() === feature.className?.toLowerCase());
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
				return this.getHoverLink(UrlUtil.PG_CLASS_SUBCLASS_FEATURES, feature.name, feature.source || Parser.SRC_XPHB, hash);
			}
			// Optional features (invocations, combat methods, etc.)
			if (feature.featureType === "Optional Feature" || feature.optionalfeatureType) {
				return this.getHoverLink(UrlUtil.PG_OPT_FEATURES, feature.name, feature.source || Parser.SRC_XPHB);
			}
			// Species/Race features
			if (feature.featureType === "Species" || feature.featureType === "Race") {
				const race = this._state.getRace();
				if (race) {
					const hash = UrlUtil.encodeForHash([race.name, race.source || Parser.SRC_XPHB].join(HASH_LIST_SEP));
					const hoverAttrs = Renderer.hover.getHoverElementAttributes({page: UrlUtil.PG_RACES, source: race.source || Parser.SRC_XPHB, hash});
					return `<a href="${UrlUtil.PG_RACES}#${hash}" ${hoverAttrs}>${feature.name}</a>`;
				}
			}
			// Background features
			if (feature.featureType === "Background") {
				const background = this._state.getBackground();
				if (background) {
					const hash = UrlUtil.encodeForHash([background.name, background.source || Parser.SRC_XPHB].join(HASH_LIST_SEP));
					const hoverAttrs = Renderer.hover.getHoverElementAttributes({page: UrlUtil.PG_BACKGROUNDS, source: background.source || Parser.SRC_XPHB, hash});
					return `<a href="${UrlUtil.PG_BACKGROUNDS}#${hash}" ${hoverAttrs}>${feature.name}</a>`;
				}
			}
		} catch (e) {
			console.warn("[CharSheet] Error creating feature hover link:", e);
		}
		// Fallback: plain name
		return feature.name;
	}

	/**
	 * Strip HTML tags and 5etools formatting from text for clean display
	 */
	_stripHtmlTags (text) {
		if (!text) return "";
		return text
			// Remove 5etools {@tag content} formatting
			.replace(/\{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/g, "$1")
			// Remove HTML tags
			.replace(/<[^>]*>/g, "")
			// Decode HTML entities
			.replace(/&quot;/g, '"')
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&#39;/g, "'")
			// Clean up extra whitespace
			.replace(/\s+/g, " ")
			.trim();
	}

	/**
	 * Render a single active state row
	 */
	_renderActiveStateRow (state, stateType, isActive) {
		const activeClass = isActive ? "charsheet__state--active" : "charsheet__state--inactive";
		const icon = state.icon || stateType?.icon || "⚡";
		
		// Try to create hoverable name by finding the source feature
		let nameHtml = state.name;
		if (state.sourceFeatureId) {
			const feature = this._state.getFeatures().find(f => f.id === state.sourceFeatureId);
			if (feature) {
				nameHtml = this._getFeatureHoverLink(feature);
			}
		}
		
		const $row = $(`
			<div class="charsheet__state-row ${activeClass} ve-flex-v-center py-2 px-2 mb-1 rounded" 
				style="background: ${isActive ? "rgba(40, 167, 69, 0.1)" : "transparent"}; border: 1px solid ${isActive ? "var(--bs-success, #28a745)" : "transparent"};">
				<span class="charsheet__state-icon mr-2" style="font-size: 1.2em;">${icon}</span>
				<span class="charsheet__state-name ve-bold">${nameHtml}</span>
				<div class="charsheet__state-controls ml-auto">
					<button class="ve-btn ve-btn-xs ve-btn-warning charsheet__end-state-btn">End</button>
				</div>
			</div>
		`);

		$row.find(".charsheet__end-state-btn").on("click", () => {
			this._state.deactivateState(state.stateTypeId);
			this._saveCurrentCharacter();
			this._renderActiveStates();
			this._renderCharacter();
		});

		return $row;
	}

	/**
	 * Activate a feature's state, deducting resource cost if applicable
	 */
	_activateFeatureState (feature, stateTypeId, stateType, resource, resourceCost) {
		// Use passed cost, or fall back to state type default
		const cost = resourceCost || stateType?.resourceCost || 1;
		
		// Deduct resource cost if applicable
		if (resource && resource.current >= cost) {
			// Special handling for Exertion (tracked separately)
			if (resource.isExertion) {
				this._state.setExertionCurrent(resource.current - cost);
			} else {
				this._state.setResourceCurrent(resource.id, resource.current - cost);
			}
		}
		
		// Determine if we need to parse effects from description
		// Parse effects for: custom states, generic state types (like combatStance), or state types with empty effects
		const shouldParseEffects = stateTypeId === "custom" || 
			!CharacterSheetState.ACTIVE_STATE_TYPES[stateTypeId] ||
			stateType?.isGeneric || 
			(stateType?.effects && stateType.effects.length === 0);
		
		const parsedEffects = shouldParseEffects 
			? CharacterSheetState.parseEffectsFromDescription(feature.description)
			: null;
		
		// Activate the state
		if (stateTypeId === "custom" || !CharacterSheetState.ACTIVE_STATE_TYPES[stateTypeId]) {
			// Custom activatable - create a generic state
			this._state.addActiveState("custom", {
				name: feature.name,
				icon: "⚡",
				sourceFeatureId: feature.id,
				description: feature.description,
				customEffects: parsedEffects?.length > 0 ? parsedEffects : null,
			});
		} else {
			// For known state types, pass feature info but only use parsed effects for generic types
			const customData = {
				sourceFeatureId: feature.id,
				resourceId: resource?.id,
				name: feature.name,
				description: feature.description,
				// Only use parsed effects for generic state types (like combatStance)
				// Non-generic types (like recklessAttack, rage) use their predefined effects
				customEffects: shouldParseEffects && parsedEffects?.length > 0 ? parsedEffects : null,
			};
			this._state.activateState(stateTypeId, customData);
		}
		
		this._saveCurrentCharacter();
		this._renderResources();
		this._renderActiveStates();
		this._renderCharacter();
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
			const dcPenalty = this._getExhaustionDcPenalty();
			const saveDC = 8 + spellMod + profBonus - dcPenalty;
			const attackBonus = spellMod + profBonus;
			const dcPenaltyText = dcPenalty > 0 ? ` <span class="ve-muted ve-small">(−${dcPenalty} exhaustion)</span>` : "";
			$container.append(`
				<div class="charsheet__spell-stats ve-flex ve-flex-wrap mb-2">
					<span class="ve-small mr-3"><strong>Save DC:</strong> ${saveDC}${dcPenaltyText}</span>
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

		const roll = RollerUtil.randomise(dieSize);
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
		const roll = RollerUtil.randomise(20);
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
		// Get conditions from loaded data (dynamic, supports homebrew)
		const conditions = this.getConditionsList();

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
		this._renderActiveStates();
		this._renderCharacter();
		// Sync combat tab
		this._combat?.renderCombatConditions?.();
		this._combat?.renderCombatEffects?.();
		this._combat?.renderCombatDefenses?.();
	}
	// #endregion

	// #region Dice Rolling
	/**
	 * Get exhaustion penalty for d20 rolls
	 * 2024 rules: -2 per exhaustion level to d20 Tests (ability checks, attack rolls, saving throws)
	 * Thelemar rules: -1 per exhaustion level to all rolls and DCs
	 * 2014 rules: Handled separately (disadvantage, etc.)
	 * @returns {number} Penalty to subtract from d20 tests
	 */
	_getExhaustionPenalty () {
		const exhaustion = this._state.getExhaustion();
		const rules = this._state.getSettings().exhaustionRules || "2024";
		if (rules === "2024") {
			return exhaustion * 2; // -2 per level in 2024 rules
		}
		if (rules === "thelemar") {
			return exhaustion; // -1 per level in Thelemar rules
		}
		// 2014 rules don't have a flat penalty to rolls
		return 0;
	}

	/**
	 * Get exhaustion penalty for DCs (spell save DC, etc.)
	 * Only applies in Thelemar rules (-1 per level)
	 * @returns {number} Penalty to subtract from DCs
	 */
	_getExhaustionDcPenalty () {
		const exhaustion = this._state.getExhaustion();
		const rules = this._state.getSettings().exhaustionRules || "2024";
		if (rules === "thelemar") {
			return exhaustion; // -1 per level in Thelemar rules
		}
		return 0;
	}

	/**
	 * Roll a d20 with advantage/disadvantage support
	 * @param {Object} opts - Roll options
	 * @param {Event} [opts.event] - The triggering event (to detect modifier keys)
	 * @param {"advantage"|"disadvantage"|"normal"} [opts.mode] - Force a specific mode
	 * @returns {{roll: number, roll1: number, roll2: number, mode: string}} Roll result
	 */
	_rollD20 ({event, mode} = {}) {
		// Determine roll mode from event modifier keys if not explicitly set
		if (!mode && event) {
			if (event.shiftKey) mode = "advantage";
			else if (event.ctrlKey || event.metaKey) mode = "disadvantage";
		}
		mode = mode || "normal";

		const roll1 = RollerUtil.randomise(20);
		const roll2 = RollerUtil.randomise(20);

		let roll;
		if (mode === "advantage") {
			roll = Math.max(roll1, roll2);
		} else if (mode === "disadvantage") {
			roll = Math.min(roll1, roll2);
		} else {
			roll = roll1;
		}

		return {roll, roll1, roll2, mode};
	}

	/**
	 * Format a d20 roll breakdown string
	 * @param {Object} rollResult - Result from _rollD20
	 * @param {number} modifier - The modifier to add
	 * @param {string} [extraStr] - Extra text to append (e.g., exhaustion)
	 * @returns {string} Formatted breakdown
	 */
	_formatD20Breakdown (rollResult, modifier, extraStr = "") {
		const modStr = modifier >= 0 ? `+ ${modifier}` : `- ${Math.abs(modifier)}`;
		
		if (rollResult.mode === "advantage") {
			return `2d20kh (${rollResult.roll1}, ${rollResult.roll2}) → ${rollResult.roll} ${modStr}${extraStr}`;
		} else if (rollResult.mode === "disadvantage") {
			return `2d20kl (${rollResult.roll1}, ${rollResult.roll2}) → ${rollResult.roll} ${modStr}${extraStr}`;
		}
		return `1d20 (${rollResult.roll}) ${modStr}${extraStr}`;
	}

	/**
	 * Get the mode label for display
	 */
	_getModeLabel (mode) {
		if (mode === "advantage") return " (Advantage)";
		if (mode === "disadvantage") return " (Disadvantage)";
		return "";
	}

	/**
	 * Get label for active state effects on a roll
	 * @param {boolean} hasAdvantage - Whether advantage applies from states
	 * @param {boolean} hasDisadvantage - Whether disadvantage applies from states
	 * @returns {string} Label like " [Rage]" or ""
	 */
	_getActiveStateEffectLabel (hasAdvantage, hasDisadvantage) {
		if (hasAdvantage && hasDisadvantage) {
			return " [States: Adv+Disadv cancel]";
		}
		// We could list specific state names here in the future
		return "";
	}

	_rollAbilityCheck (ability, event) {
		const mod = this._state.getAbilityMod(ability);
		const exhaustionPenalty = this._getExhaustionPenalty();
		
		// Check for advantage/disadvantage from active states (e.g., Rage gives advantage on STR checks)
		let mode;
		const hasAdvantage = this._state.hasAdvantageFromStates(`check:${ability}`);
		const hasDisadvantage = this._state.hasDisadvantageFromStates(`check:${ability}`);
		if (hasAdvantage && !hasDisadvantage) mode = "advantage";
		else if (hasDisadvantage && !hasAdvantage) mode = "disadvantage";
		
		const rollResult = this._rollD20({event, mode});
		const total = rollResult.roll + mod - exhaustionPenalty;

		const exhaustionStr = exhaustionPenalty > 0 ? ` - ${exhaustionPenalty} (exhaustion)` : "";
		const stateEffectStr = (hasAdvantage || hasDisadvantage) ? this._getActiveStateEffectLabel(hasAdvantage, hasDisadvantage) : "";
		this._showDiceResult(
			`${Parser.attAbvToFull(ability)} Check${this._getModeLabel(rollResult.mode)}${stateEffectStr}`,
			total,
			this._formatD20Breakdown(rollResult, mod, exhaustionStr),
		);
	}

	_rollSavingThrow (ability, event) {
		const mod = this._state.getSaveMod(ability);
		const exhaustionPenalty = this._getExhaustionPenalty();
		
		// Check for advantage/disadvantage from active states (e.g., Rage gives advantage on STR saves)
		let mode;
		const hasAdvantage = this._state.hasAdvantageFromStates(`save:${ability}`);
		const hasDisadvantage = this._state.hasDisadvantageFromStates(`save:${ability}`);
		if (hasAdvantage && !hasDisadvantage) mode = "advantage";
		else if (hasDisadvantage && !hasAdvantage) mode = "disadvantage";
		// If both, they cancel out - use normal (event can still override)
		
		const rollResult = this._rollD20({event, mode});
		const total = rollResult.roll + mod - exhaustionPenalty;

		const exhaustionStr = exhaustionPenalty > 0 ? ` - ${exhaustionPenalty} (exhaustion)` : "";
		const stateEffectStr = (hasAdvantage || hasDisadvantage) ? this._getActiveStateEffectLabel(hasAdvantage, hasDisadvantage) : "";
		this._showDiceResult(
			`${Parser.attAbvToFull(ability)} Save${this._getModeLabel(rollResult.mode)}${stateEffectStr}`,
			total,
			this._formatD20Breakdown(rollResult, mod, exhaustionStr),
		);
	}

	_rollSkillCheck (skillKey, skillName, event, overrideAbility = null) {
		const mod = overrideAbility
			? this._state.getSkillModWithAbility(skillKey, overrideAbility)
			: this._state.getSkillMod(skillKey);
		const exhaustionPenalty = this._getExhaustionPenalty();
		const rollResult = this._rollD20({event});
		const total = rollResult.roll + mod - exhaustionPenalty;

		const abilityLabel = overrideAbility ? ` (${overrideAbility.toUpperCase()})` : "";
		const exhaustionStr = exhaustionPenalty > 0 ? ` - ${exhaustionPenalty} (exhaustion)` : "";
		this._showDiceResult(
			`${skillName}${abilityLabel} Check${this._getModeLabel(rollResult.mode)}`,
			total,
			this._formatD20Breakdown(rollResult, mod, exhaustionStr),
		);
	}

	/**
	 * Cycle skill proficiency: none → proficient → expertise → none
	 * @param {string} skillKey - The skill key (e.g., "stealth", "athletics")
	 */
	_cycleSkillProficiency (skillKey) {
		const currentLevel = this._state.getSkillProficiency(skillKey);
		let newLevel;
		let message;

		if (currentLevel === 0) {
			newLevel = 1;
			message = "Proficient";
		} else if (currentLevel === 1) {
			newLevel = 2;
			message = "Expertise";
		} else {
			newLevel = 0;
			message = "Not proficient";
		}

		this._state.setSkillProficiency(skillKey, newLevel);
		this._saveCurrentCharacter();
		this._renderSkills();

		// Show feedback toast
		const skillName = this.getSkillsList().find(s => s.name.toLowerCase().replace(/\s+/g, "") === skillKey)?.name || skillKey;
		JqueryUtil.doToast({type: "info", content: `${skillName}: ${message}`});
	}

	_showSkillAbilityMenu (event, skillKey, skillName, defaultAbility) {
		event.preventDefault();
		event.stopPropagation();

		// Remove any existing menu
		$(".charsheet__ability-menu").remove();

		const abilities = ["str", "dex", "con", "int", "wis", "cha"];
		const abilityNames = {
			str: "Strength",
			dex: "Dexterity",
			con: "Constitution",
			int: "Intelligence",
			wis: "Wisdom",
			cha: "Charisma",
		};

		const $menu = $(`<div class="charsheet__ability-menu"></div>`);

		abilities.forEach(ability => {
			const isDefault = ability === defaultAbility;
			const mod = this._state.getSkillModWithAbility(skillKey, ability);
			const modStr = mod >= 0 ? `+${mod}` : mod.toString();
			const $option = $(`
				<div class="charsheet__ability-menu-option ${isDefault ? "charsheet__ability-menu-option--default" : ""}" 
					 title="${isDefault ? "Default ability" : ""}">
					<span class="charsheet__ability-menu-name">${abilityNames[ability]}</span>
					<span class="charsheet__ability-menu-mod">${modStr}</span>
				</div>
			`);
			$option.on("click", (e) => {
				$menu.remove();
				this._rollSkillCheck(skillKey, skillName, e, ability);
			});
			$menu.append($option);
		});

		// Position menu near cursor
		$menu.css({
			position: "fixed",
			left: event.clientX + "px",
			top: event.clientY + "px",
			zIndex: 10000,
		});

		$("body").append($menu);

		// Close menu when clicking elsewhere
		const closeMenu = (e) => {
			if (!$(e.target).closest(".charsheet__ability-menu").length) {
				$menu.remove();
				$(document).off("click", closeMenu);
			}
		};
		setTimeout(() => $(document).on("click", closeMenu), 10);
	}

	_rollInitiative (event) {
		const mod = this._state.getInitiative();
		const exhaustionPenalty = this._getExhaustionPenalty();
		const rollResult = this._rollD20({event});
		const total = rollResult.roll + mod - exhaustionPenalty;

		const exhaustionStr = exhaustionPenalty > 0 ? ` - ${exhaustionPenalty} (exhaustion)` : "";
		this._showDiceResult(
			`Initiative${this._getModeLabel(rollResult.mode)}`,
			total,
			this._formatD20Breakdown(rollResult, mod, exhaustionStr),
		);
	}

	_rollAttack (attack, event) {
		const exhaustionPenalty = this._getExhaustionPenalty();
		
		// Determine attack type for advantage/disadvantage matching
		// Build specific attack type like "attack:melee:str" for proper matching with effects
		const isMelee = attack.isMelee || attack.type === "melee" || attack.range === "melee" || 
			(attack.range && !attack.range.includes("/"));
		const abilityUsed = attack.abilityMod || attack.ability || (isMelee ? "str" : "dex");
		const attackType = `attack:${isMelee ? "melee" : "ranged"}:${abilityUsed}`;
		
		// Check for advantage/disadvantage from active states using specific attack type
		let mode;
		const hasAdvantage = this._state.hasAdvantageFromStates(attackType);
		const hasDisadvantage = this._state.hasDisadvantageFromStates(attackType);
		if (hasAdvantage && !hasDisadvantage) mode = "advantage";
		else if (hasDisadvantage && !hasAdvantage) mode = "disadvantage";
		
		const rollResult = this._rollD20({event, mode});
		const attackTotal = rollResult.roll + attack.attackBonus - exhaustionPenalty;

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

		// Parse and roll damage
		let damageRoll = attack.damage;
		
		// Check for rage damage bonus on melee STR attacks (using isMelee/abilityUsed computed above)
		const rageDamage = this._state.getRageDamageBonus(isMelee, abilityUsed);
		
		// Add any bonus damage from active states
		const stateBonusDamage = this._state.getBonusFromStates("damage");
		const totalBonusDamage = rageDamage + stateBonusDamage;
		
		let damageStr = attack.damage;
		if (totalBonusDamage > 0) {
			damageStr = `${attack.damage} + ${totalBonusDamage}`;
		}
		
		const damageResult = Renderer.dice.parseRandomise2(attack.damage);
		const totalDamage = damageResult + totalBonusDamage;

		const exhaustionStr = exhaustionPenalty > 0 ? ` - ${exhaustionPenalty} (exhaustion)` : "";
		const stateEffectStr = (hasAdvantage || hasDisadvantage) ? this._getActiveStateEffectLabel(hasAdvantage, hasDisadvantage) : "";
		const rageDamageStr = rageDamage > 0 ? ` + ${rageDamage} (rage)` : "";
		const stateDamageStr = stateBonusDamage > 0 ? ` + ${stateBonusDamage} (states)` : "";
		
		this._showDiceResult(
			`${attack.name}${this._getModeLabel(rollResult.mode)}${stateEffectStr}`,
			attackTotal,
			`Attack: ${this._formatD20Breakdown(rollResult, attack.attackBonus, exhaustionStr)}
			 Damage: ${attack.damage} = ${damageResult}${rageDamageStr}${stateDamageStr}${totalBonusDamage > 0 ? ` → ${totalDamage}` : ""}`,
			resultClass,
			resultNote,
		);
	}

	// Public methods for sub-modules
	rollDice (num, sides) {
		let total = 0;
		for (let i = 0; i < num; i++) {
			total += RollerUtil.randomise(sides);
		}
		return total;
	}

	/**
	 * Roll a d20 with advantage/disadvantage support (public method for sub-modules)
	 * @param {Object} opts - Roll options
	 * @param {Event} [opts.event] - The triggering event (to detect modifier keys)
	 * @param {"advantage"|"disadvantage"|"normal"} [opts.mode] - Force a specific mode
	 * @returns {{roll: number, roll1: number, roll2: number, mode: string}} Roll result
	 */
	rollD20 (opts) {
		return this._rollD20(opts);
	}

	/**
	 * Format a d20 roll breakdown string (public method for sub-modules)
	 */
	formatD20Breakdown (rollResult, modifier, extraStr = "") {
		return this._formatD20Breakdown(rollResult, modifier, extraStr);
	}

	/**
	 * Get mode label (public method for sub-modules)
	 */
	getModeLabel (mode) {
		return this._getModeLabel(mode);
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
	 * Create a condition hover link (instance method)
	 * @param {string} condition - Condition name
	 * @returns {string} HTML string for the link
	 */
	getConditionLink (condition) {
		const conditionClean = condition.trim().toLowerCase();
		
		// Look up the condition in loaded data to get the correct source
		const conditionData = this._conditionsData?.find(c => 
			c.name.toLowerCase() === conditionClean
		);
		
		// Use found source, or fall back to XPHB for standard conditions
		const source = conditionData?.source || Parser.SRC_XPHB;
		const hash = UrlUtil.encodeForHash([condition.trim(), source].join(HASH_LIST_SEP));
		
		return this.getHoverLink(
			UrlUtil.PG_CONDITIONS_DISEASES,
			condition.trim(),
			source,
			hash,
		);
	}

	/**
	 * Create a condition hover link (static fallback - uses XPHB)
	 * @param {string} condition - Condition name
	 * @returns {string} HTML string for the link
	 * @deprecated Use instance method instead for proper homebrew support
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
	// #endregion

	// #region Settings Modal
	async _showSettingsModal () {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "Sheet Settings",
			isMinHeight0: true,
			isWidth100: true,
			cbClose: () => {
				this._saveCurrentCharacter();
			},
		});

		// Get all available sources
		const allSources = this._getAvailableSources();
		const currentAllowed = this._state.getAllowedSources();

		// Check if there's any homebrew
		const hasHomebrew = allSources.some(src => BrewUtil2.hasSourceJson(src.json) || PrereleaseUtil.hasSourceJson(src.json));

		// Build source selection UI
		const $sourceFilter = $(`<div class="charsheet__settings-sources"></div>`);

		// Quick select buttons
		const $quickButtons = $$`<div class="mb-2 ve-flex-wrap">
			<button class="ve-btn ve-btn-xs ve-btn-default mr-1 mb-1" id="settings-source-all">All</button>
			<button class="ve-btn ve-btn-xs ve-btn-default mr-1 mb-1" id="settings-source-none">None</button>
			<button class="ve-btn ve-btn-xs ve-btn-default mr-1 mb-1" id="settings-source-core">Core Only</button>
			<button class="ve-btn ve-btn-xs ve-btn-default mr-1 mb-1" id="settings-source-2024">2024 Rules</button>
			<button class="ve-btn ve-btn-xs ve-btn-default mr-1 mb-1" id="settings-source-official">Official Only</button>
			${hasHomebrew ? `<button class="ve-btn ve-btn-xs ve-btn-default mr-1 mb-1" id="settings-source-homebrew">Homebrew Only</button>` : ""}
		</div>`;

		// Group sources by category
		const sourceGroups = this._groupSourcesByCategory(allSources);

		// Create checkboxes for each source
		Object.entries(sourceGroups).forEach(([group, sources]) => {
			const $group = $(`<div class="charsheet__settings-source-group mb-2">
				<div class="charsheet__settings-source-group-header ve-bold mb-1">${group}</div>
			</div>`);

			sources.forEach(src => {
				const isChecked = !currentAllowed || currentAllowed.includes(src.json);
				const $checkbox = $(`
					<label class="charsheet__settings-source-item mr-2 mb-1">
						<input type="checkbox" value="${src.json}" ${isChecked ? "checked" : ""} class="source-checkbox">
						<span title="${src.full}">${src.abbr}</span>
					</label>
				`);
				$group.append($checkbox);
			});

			$sourceFilter.append($group);
		});

		// Exhaustion rules toggle
		const currentExhaustionRules = this._state.getExhaustionRules();
		const $exhaustionToggle = $$`<div class="mt-3">
			<label class="ve-flex-v-center">
				<span class="mr-2 ve-bold">Exhaustion Rules:</span>
				<select class="form-control form-control--minimal input-sm" id="settings-exhaustion-rules" style="width: auto;">
					<option value="2024" ${currentExhaustionRules === "2024" ? "selected" : ""}>2024 Rules (Stacking -2 to d20 tests)</option>
					<option value="2014" ${currentExhaustionRules === "2014" ? "selected" : ""}>2014 Rules (Tiered effects)</option>
					<option value="thelemar" ${currentExhaustionRules === "thelemar" ? "selected" : ""}>Thelemar Rules (-1 to rolls/DCs, max 10)</option>
				</select>
			</label>
		</div>`;

		// Build modal content
		$$`<div>
			<h5>Source Filter</h5>
			<p class="ve-muted ve-small">Select which sources to use when adding races, classes, spells, items, etc. Uncheck sources to exclude them from selection lists.</p>
			${$quickButtons}
			<div class="charsheet__settings-sources-container" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); padding: 0.5rem; border-radius: 4px;">
				${$sourceFilter}
			</div>
			<hr>
			<h5>Game Rules</h5>
			${$exhaustionToggle}
		</div>`.appendTo($modalInner);

		// Quick select handlers
		$modalInner.find("#settings-source-all").on("click", () => {
			$modalInner.find(".source-checkbox").prop("checked", true);
			this._updateAllowedSources($modalInner);
		});

		$modalInner.find("#settings-source-none").on("click", () => {
			$modalInner.find(".source-checkbox").prop("checked", false);
			this._updateAllowedSources($modalInner);
		});

		$modalInner.find("#settings-source-core").on("click", () => {
			$modalInner.find(".source-checkbox").prop("checked", false);
			const coreSources = [Parser.SRC_PHB, Parser.SRC_DMG, Parser.SRC_MM, Parser.SRC_XPHB, Parser.SRC_XDMG, Parser.SRC_XMM];
			coreSources.forEach(src => {
				$modalInner.find(`.source-checkbox[value="${src}"]`).prop("checked", true);
			});
			this._updateAllowedSources($modalInner);
		});

		$modalInner.find("#settings-source-2024").on("click", () => {
			$modalInner.find(".source-checkbox").prop("checked", false);
			const sources2024 = [Parser.SRC_XPHB, Parser.SRC_XDMG, Parser.SRC_XMM];
			sources2024.forEach(src => {
				$modalInner.find(`.source-checkbox[value="${src}"]`).prop("checked", true);
			});
			this._updateAllowedSources($modalInner);
		});

		$modalInner.find("#settings-source-official").on("click", () => {
			$modalInner.find(".source-checkbox").each((i, el) => {
				const src = $(el).val();
				const isOfficial = !SourceUtil.isNonstandardSource(src) && !BrewUtil2.hasSourceJson(src) && !PrereleaseUtil.hasSourceJson(src);
				$(el).prop("checked", isOfficial);
			});
			this._updateAllowedSources($modalInner);
		});

		// Homebrew only button handler
		$modalInner.find("#settings-source-homebrew").on("click", () => {
			$modalInner.find(".source-checkbox").each((i, el) => {
				const src = $(el).val();
				const isHomebrew = BrewUtil2.hasSourceJson(src) || PrereleaseUtil.hasSourceJson(src);
				$(el).prop("checked", isHomebrew);
			});
			this._updateAllowedSources($modalInner);
		});

		// Source checkbox change handler
		$modalInner.find(".source-checkbox").on("change", () => {
			this._updateAllowedSources($modalInner);
		});

		// Exhaustion rules handler
		$modalInner.find("#settings-exhaustion-rules").on("change", (e) => {
			this._state.setExhaustionRules(e.target.value);
			this._renderExhaustion();
			this._renderCombatStats();
			// Re-render spells tab if it exists to update spell save DC
			if (this._spellsModule) {
				this._spellsModule.render();
			}
		});
	}

	_getAvailableSources () {
		// Collect sources from all loaded data
		const sourceSet = new Set();

		// Add sources from loaded races
		this._races?.forEach(r => sourceSet.add(r.source));
		// Add sources from loaded classes
		this._classes?.forEach(c => sourceSet.add(c.source));
		// Add sources from loaded backgrounds
		this._backgrounds?.forEach(b => sourceSet.add(b.source));
		// Add sources from loaded spells
		this._spellsData?.forEach(s => sourceSet.add(s.source));
		// Add sources from loaded items
		this._itemsData?.forEach(i => sourceSet.add(i.source));
		// Add sources from loaded feats
		this._featsData?.forEach(f => sourceSet.add(f.source));
		// Add sources from optional features
		this._optionalFeaturesData?.forEach(of => sourceSet.add(of.source));

		// Also add all standard sources from Parser
		Object.keys(Parser.SOURCE_JSON_TO_FULL).forEach(src => sourceSet.add(src));

		// Convert to array with display info
		return Array.from(sourceSet)
			.filter(src => src) // Remove nulls/undefined
			.map(src => ({
				json: src,
				abbr: Parser.sourceJsonToAbv(src),
				full: Parser.sourceJsonToFull(src),
			}))
			.sort((a, b) => a.full.localeCompare(b.full));
	}

	_groupSourcesByCategory (sources) {
		const groups = {
			"Core Rulebooks": [],
			"Supplements": [],
			"Adventures": [],
			"Other Official": [],
			"Prerelease": [],
			"Homebrew": [],
		};

		sources.forEach(src => {
			if (BrewUtil2.hasSourceJson(src.json)) {
				groups["Homebrew"].push(src);
			} else if (PrereleaseUtil.hasSourceJson(src.json)) {
				groups["Prerelease"].push(src);
			} else if (SourceUtil.isNonstandardSource(src.json)) {
				groups["Other Official"].push(src);
			} else if ([Parser.SRC_PHB, Parser.SRC_DMG, Parser.SRC_MM, Parser.SRC_XPHB, Parser.SRC_XDMG, Parser.SRC_XMM].includes(src.json)) {
				groups["Core Rulebooks"].push(src);
			} else if (src.full?.includes(":") || src.abbr?.length > 5) {
				// Adventure names usually have colons or longer abbreviations
				groups["Adventures"].push(src);
			} else {
				groups["Supplements"].push(src);
			}
		});

		// Remove empty groups
		Object.keys(groups).forEach(key => {
			if (!groups[key].length) delete groups[key];
		});

		return groups;
	}

	_updateAllowedSources ($modalInner) {
		const checkedSources = [];
		$modalInner.find(".source-checkbox:checked").each((i, el) => {
			checkedSources.push($(el).val());
		});

		// If all are checked, set to null (all allowed)
		const allSources = $modalInner.find(".source-checkbox").length;
		if (checkedSources.length === allSources || checkedSources.length === 0) {
			this._state.setAllowedSources(null);
		} else {
			this._state.setAllowedSources(checkedSources);
		}
	}

	/**
	 * Filter an array of entities by allowed sources
	 * @param {Array} entities - Array of entities with `source` property
	 * @returns {Array} Filtered array
	 */
	filterByAllowedSources (entities) {
		const allowed = this._state.getAllowedSources();
		if (!allowed) return entities; // null = all allowed
		return entities.filter(e => allowed.includes(e.source));
	}
	// #endregion

	// #region Custom Modifiers Modal
	/**
	 * Show the custom modifiers management modal
	 */
	async _showCustomModifiersModal () {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "Custom Modifiers",
			isMinHeight0: true,
			isWidth100: true,
			cbClose: () => {
				this._saveCurrentCharacter();
				this._renderCharacter();
			},
		});

		// Get modifier type options
		const modifierTypes = [
			{value: "ac", label: "Armor Class (AC)"},
			{value: "initiative", label: "Initiative"},
			{value: "speed", label: "Speed (ft.)"},
			{value: "attack", label: "Attack Rolls"},
			{value: "damage", label: "Damage Rolls"},
			{value: "spellDc", label: "Spell Save DC"},
			{value: "spellAttack", label: "Spell Attack"},
			{value: "save:all", label: "All Saving Throws"},
			{value: "check:all", label: "All Ability Checks"},
			{value: "skill:all", label: "All Skill Checks"},
		];

		// Add individual saving throws
		Parser.ABIL_ABVS.forEach(abl => {
			modifierTypes.push({value: `save:${abl}`, label: `${Parser.attAbvToFull(abl)} Save`});
		});

		// Add individual ability checks
		Parser.ABIL_ABVS.forEach(abl => {
			modifierTypes.push({value: `check:${abl}`, label: `${Parser.attAbvToFull(abl)} Checks`});
		});

		// Add individual skills
		const skills = this.getSkillsList();
		skills.forEach(skill => {
			const skillKey = skill.name.toLowerCase().replace(/\s+/g, "");
			modifierTypes.push({value: `skill:${skillKey}`, label: `${skill.name} (${skill.ability.toUpperCase()})`});
		});

		// Render the modifiers list
		const renderModifiersList = () => {
			const modifiers = this._state.getNamedModifiers();
			const $list = $modalInner.find("#charsheet-modifiers-list");
			$list.empty();

			if (!modifiers.length) {
				$list.append(`<div class="ve-muted ve-text-center py-3">No custom modifiers. Add one below!</div>`);
				return;
			}

			modifiers.forEach(mod => {
				const typeLabel = modifierTypes.find(t => t.value === mod.type)?.label || mod.type;
				const valueStr = mod.value >= 0 ? `+${mod.value}` : mod.value;
				
				const $row = $$`<div class="charsheet__modifier-row ${mod.enabled ? "" : "charsheet__modifier-row--disabled"}">
					<div class="charsheet__modifier-toggle">
						<input type="checkbox" ${mod.enabled ? "checked" : ""} title="Enable/disable this modifier">
					</div>
					<div class="charsheet__modifier-info">
						<div class="charsheet__modifier-name">${mod.name}</div>
						<div class="charsheet__modifier-type ve-small ve-muted">${typeLabel}</div>
						${mod.note ? `<div class="charsheet__modifier-note ve-small ve-muted">${mod.note}</div>` : ""}
					</div>
					<div class="charsheet__modifier-value ${mod.value >= 0 ? "charsheet__modifier-value--positive" : "charsheet__modifier-value--negative"}">${valueStr}</div>
					<div class="charsheet__modifier-actions">
						<button class="ve-btn ve-btn-xs ve-btn-default charsheet__modifier-edit" title="Edit"><span class="glyphicon glyphicon-pencil"></span></button>
						<button class="ve-btn ve-btn-xs ve-btn-danger charsheet__modifier-delete" title="Remove"><span class="glyphicon glyphicon-trash"></span></button>
					</div>
				</div>`;

				// Toggle handler
				$row.find("input[type='checkbox']").on("change", () => {
					this._state.toggleNamedModifier(mod.id);
					renderModifiersList();
				});

				// Edit handler
				$row.find(".charsheet__modifier-edit").on("click", () => {
					showEditForm(mod);
				});

				// Delete handler
				$row.find(".charsheet__modifier-delete").on("click", () => {
					if (confirm(`Remove "${mod.name}" modifier?`)) {
						this._state.removeNamedModifier(mod.id);
						renderModifiersList();
					}
				});

				$list.append($row);
			});
		};

		// Show edit/add form
		const showEditForm = (existingMod = null) => {
			const $form = $modalInner.find("#charsheet-modifier-form");
			$form.show();

			const $nameInput = $form.find("#mod-name");
			const $typeSelect = $form.find("#mod-type");
			const $valueInput = $form.find("#mod-value");
			const $noteInput = $form.find("#mod-note");

			if (existingMod) {
				$nameInput.val(existingMod.name);
				$typeSelect.val(existingMod.type);
				$valueInput.val(existingMod.value);
				$noteInput.val(existingMod.note || "");
				$form.data("editing-id", existingMod.id);
				$form.find(".charsheet__modifier-form-title").text("Edit Modifier");
			} else {
				$nameInput.val("");
				$typeSelect.val("ac");
				$valueInput.val(1);
				$noteInput.val("");
				$form.removeData("editing-id");
				$form.find(".charsheet__modifier-form-title").text("Add Modifier");
			}

			$nameInput.focus();
		};

		// Build type select options
		const $typeOptions = modifierTypes.map(t => `<option value="${t.value}">${t.label}</option>`).join("");

		// Build modal content
		$$`<div class="charsheet__modifiers-modal">
			<p class="ve-muted ve-small mb-3">
				Add custom modifiers to adjust your rolls. These can represent temporary effects (Bless, Guidance, Cover), 
				magic items, or other situational bonuses. Toggle modifiers on/off as needed.
			</p>
			
			<div class="charsheet__modifiers-list" id="charsheet-modifiers-list">
				<!-- Populated by renderModifiersList -->
			</div>

			<div class="charsheet__modifier-form" id="charsheet-modifier-form" style="display: none;">
				<h5 class="charsheet__modifier-form-title">Add Modifier</h5>
				<div class="ve-flex mb-2">
					<div class="ve-flex-col mr-2" style="flex: 2;">
						<label class="ve-small ve-muted">Name</label>
						<input type="text" class="form-control form-control--minimal" id="mod-name" placeholder="e.g., Bless, Shield of Faith, Cover">
					</div>
					<div class="ve-flex-col mr-2" style="flex: 2;">
						<label class="ve-small ve-muted">Type</label>
						<select class="form-control form-control--minimal" id="mod-type">
							${$typeOptions}
						</select>
					</div>
					<div class="ve-flex-col" style="flex: 1;">
						<label class="ve-small ve-muted">Value</label>
						<input type="number" class="form-control form-control--minimal" id="mod-value" value="1">
					</div>
				</div>
				<div class="mb-2">
					<label class="ve-small ve-muted">Note (optional)</label>
					<input type="text" class="form-control form-control--minimal" id="mod-note" placeholder="e.g., Lasts 1 minute, Concentration">
				</div>
				<div class="ve-flex">
					<button class="ve-btn ve-btn-primary ve-btn-sm mr-2" id="mod-save">Save</button>
					<button class="ve-btn ve-btn-default ve-btn-sm" id="mod-cancel">Cancel</button>
				</div>
			</div>

			<div class="mt-3">
				<button class="ve-btn ve-btn-primary ve-btn-sm" id="charsheet-btn-add-modifier">
					<span class="glyphicon glyphicon-plus"></span> Add Modifier
				</button>
			</div>
			
			<hr class="my-3">
			
			<div class="charsheet__modifiers-summary">
				<h5>Current Totals</h5>
				<div class="ve-flex ve-flex-wrap" id="charsheet-modifiers-summary">
					<!-- Populated by renderSummary -->
				</div>
			</div>
		</div>`.appendTo($modalInner);

		// Render summary of active modifiers
		const renderSummary = () => {
			const $summary = $modalInner.find("#charsheet-modifiers-summary");
			$summary.empty();

			const summaryItems = [
				{type: "ac", label: "AC"},
				{type: "initiative", label: "Initiative"},
				{type: "speed", label: "Speed"},
				{type: "attack", label: "Attack"},
				{type: "damage", label: "Damage"},
				{type: "spellDc", label: "Spell DC"},
				{type: "spellAttack", label: "Spell Attack"},
			];

			summaryItems.forEach(item => {
				const value = this._state.getCustomModifier(item.type);
				if (value !== 0) {
					const valueStr = value >= 0 ? `+${value}` : value;
					$summary.append(`
						<div class="charsheet__modifier-summary-item mr-3 mb-1">
							<span class="ve-muted ve-small">${item.label}:</span>
							<span class="ve-bold ${value >= 0 ? "text-success" : "text-danger"}">${valueStr}</span>
						</div>
					`);
				}
			});

			// Show any save bonuses
			Parser.ABIL_ABVS.forEach(abl => {
				const value = this._state.getCustomModifier(`save:${abl}`);
				if (value !== 0) {
					const valueStr = value >= 0 ? `+${value}` : value;
					$summary.append(`
						<div class="charsheet__modifier-summary-item mr-3 mb-1">
							<span class="ve-muted ve-small">${Parser.attAbvToFull(abl)} Save:</span>
							<span class="ve-bold ${value >= 0 ? "text-success" : "text-danger"}">${valueStr}</span>
						</div>
					`);
				}
			});

			if (!$summary.children().length) {
				$summary.append(`<div class="ve-muted">No active modifiers</div>`);
			}
		};

		// Add modifier button
		$modalInner.find("#charsheet-btn-add-modifier").on("click", () => showEditForm());

		// Save modifier
		$modalInner.find("#mod-save").on("click", () => {
			const $form = $modalInner.find("#charsheet-modifier-form");
			const name = $form.find("#mod-name").val().trim();
			const type = $form.find("#mod-type").val();
			const value = parseInt($form.find("#mod-value").val()) || 0;
			const note = $form.find("#mod-note").val().trim();

			if (!name) {
				JqueryUtil.doToast({type: "warning", content: "Please enter a name for the modifier."});
				return;
			}

			const editingId = $form.data("editing-id");
			if (editingId) {
				this._state.updateNamedModifier(editingId, {name, type, value, note});
			} else {
				this._state.addNamedModifier({name, type, value, note, enabled: true});
			}

			$form.hide();
			renderModifiersList();
			renderSummary();
		});

		// Cancel form
		$modalInner.find("#mod-cancel").on("click", () => {
			$modalInner.find("#charsheet-modifier-form").hide();
		});

		// Initial render
		renderModifiersList();
		renderSummary();
	}
	// #endregion

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
	getSkillsData () { return this._skillsData; }
	getConditionsData () { return this._conditionsData; }
	getState () { return this._state; }

	/**
	 * Get unique skills list, preferring 2024 (XPHB) versions, including custom skills
	 * @returns {Array} Array of {name, ability, isCustom} objects
	 */
	getSkillsList () {
		// Create map of skills, preferring XPHB sources
		const skillsMap = new Map();
		this._skillsData.forEach(skill => {
			const existing = skillsMap.get(skill.name);
			// Prefer XPHB (2024) version
			if (!existing || skill.source === Parser.SRC_XPHB) {
				skillsMap.set(skill.name, {
					name: skill.name,
					ability: skill.ability,
					source: skill.source,
					isCustom: false,
				});
			}
		});

		// Add custom skills from state
		const customSkills = this._state.getCustomSkills();
		customSkills.forEach(skill => {
			// Only add if not overriding a standard skill
			if (!skillsMap.has(skill.name)) {
				skillsMap.set(skill.name, {
					name: skill.name,
					ability: skill.ability,
					source: "Custom",
					isCustom: true,
				});
			}
		});

		// Sort alphabetically
		return Array.from(skillsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Get unique conditions list, preferring 2024 (XPHB) versions
	 * @returns {Array} Array of condition names
	 */
	getConditionsList () {
		// Create map of conditions, preferring XPHB sources
		const conditionsMap = new Map();
		this._conditionsData.forEach(cond => {
			const existing = conditionsMap.get(cond.name);
			// Prefer XPHB (2024) version
			if (!existing || cond.source === Parser.SRC_XPHB) {
				conditionsMap.set(cond.name, cond.name);
			}
		});
		// Sort alphabetically
		return Array.from(conditionsMap.values()).sort();
	}

	async saveCharacter () {
		await this._saveCurrentCharacter();
	}

	renderCharacter () {
		this._renderCharacter();
	}

	/**
	 * Show modal for adding a custom skill
	 */
	async _showAddCustomSkillModal () {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "Add Custom Skill",
			isMinHeight0: true,
		});

		const abilityOptions = [
			{value: "str", label: "Strength"},
			{value: "dex", label: "Dexterity"},
			{value: "con", label: "Constitution"},
			{value: "int", label: "Intelligence"},
			{value: "wis", label: "Wisdom"},
			{value: "cha", label: "Charisma"},
		];

		const $form = $$`<div class="ve-flex-col">
			<div class="ve-flex-v-center mb-2">
				<label class="mr-2 w-100p">Skill Name:</label>
				<input type="text" class="form-control" id="custom-skill-name" placeholder="e.g. Brewing, Sailing">
			</div>
			<div class="ve-flex-v-center mb-3">
				<label class="mr-2 w-100p">Ability:</label>
				<select class="form-control" id="custom-skill-ability">
					${abilityOptions.map(a => `<option value="${a.value}">${a.label}</option>`).join("")}
				</select>
			</div>
			<div class="ve-flex-h-right">
				<button class="ve-btn ve-btn-default mr-2" id="custom-skill-cancel">Cancel</button>
				<button class="ve-btn ve-btn-primary" id="custom-skill-add">Add Skill</button>
			</div>
		</div>`.appendTo($modalInner);

		const $name = $form.find("#custom-skill-name");
		const $ability = $form.find("#custom-skill-ability");
		const $addBtn = $form.find("#custom-skill-add");
		const $cancelBtn = $form.find("#custom-skill-cancel");

		$cancelBtn.on("click", () => doClose());

		$addBtn.on("click", () => {
			const name = $name.val().trim();
			const ability = $ability.val();

			if (!name) {
				JqueryUtil.doToast({type: "warning", content: "Please enter a skill name."});
				return;
			}

			// Check if skill already exists
			const skillKey = name.toLowerCase().replace(/\s+/g, "");
			const existingSkills = this.getSkillsList();
			if (existingSkills.some(s => s.name.toLowerCase().replace(/\s+/g, "") === skillKey)) {
				JqueryUtil.doToast({type: "warning", content: `A skill named "${name}" already exists.`});
				return;
			}

			// Add the custom skill
			this._state.addCustomSkill(name, ability);
			this._renderSkills();
			this._saveCurrentCharacter();

			JqueryUtil.doToast({type: "success", content: `Added custom skill: ${name}`});
			doClose();
		});

		// Allow Enter key to submit
		$name.on("keypress", (e) => {
			if (e.which === 13) $addBtn.click();
		});

		// Focus the name input
		$name.focus();
	}

	/**
	 * Get available suggestions for each proficiency type
	 */
	_getProficiencySuggestions () {
		// Armor types
		const armorSuggestions = ["Light Armor", "Medium Armor", "Heavy Armor", "Shields"];

		// Weapons - from items data, filter by weapon types
		const weaponTypes = new Set();
		this._itemsData.forEach(item => {
			if (item.weapon || item.type === "M" || item.type === "R") {
				weaponTypes.add(item.name);
			}
		});
		// Add category proficiencies
		const weaponSuggestions = ["Simple Weapons", "Martial Weapons", ...Array.from(weaponTypes).sort()];

		// Tools - from items data, filter by tool types (AT, GS, INS, T)
		const toolTypes = new Set();
		this._itemsData.forEach(item => {
			const type = item.type?.split("|")[0]; // Strip source from type
			if (["AT", "GS", "INS", "T"].includes(type)) {
				toolTypes.add(item.name);
			}
		});
		const toolSuggestions = Array.from(toolTypes).sort();

		// Languages - from languages data, deduplicated by name (prefer XPHB)
		const langMap = new Map();
		this._languagesData.forEach(lang => {
			const existing = langMap.get(lang.name);
			if (!existing || lang.source === Parser.SRC_XPHB) {
				langMap.set(lang.name, lang.name);
			}
		});
		const languageSuggestions = Array.from(langMap.values()).sort();

		return {
			armor: armorSuggestions,
			weapons: weaponSuggestions,
			tools: toolSuggestions,
			languages: languageSuggestions,
		};
	}

	/**
	 * Show modal for editing proficiencies and languages
	 */
	async _showEditProficienciesModal () {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "Edit Proficiencies & Languages",
			isMinHeight0: true,
			isWidth100: true,
			cbClose: () => {
				this._renderProficiencies();
				this._saveCurrentCharacter();
			},
		});

		const suggestions = this._getProficiencySuggestions();

		const profTypes = [
			{key: "armor", label: "Armor Proficiencies", getter: "getArmorProficiencies", adder: "addArmorProficiency", remover: "removeArmorProficiency", suggestions: suggestions.armor},
			{key: "weapons", label: "Weapon Proficiencies", getter: "getWeaponProficiencies", adder: "addWeaponProficiency", remover: "removeWeaponProficiency", suggestions: suggestions.weapons},
			{key: "tools", label: "Tool Proficiencies", getter: "getToolProficiencies", adder: "addToolProficiency", remover: "removeToolProficiency", suggestions: suggestions.tools},
			{key: "languages", label: "Languages", getter: "getLanguages", adder: "addLanguage", remover: "removeLanguage", suggestions: suggestions.languages},
		];

		const renderSection = (profType) => {
			const $section = $(`
				<div class="charsheet__edit-prof-section mb-3">
					<label class="ve-bold mb-1">${profType.label}</label>
					<div class="charsheet__edit-prof-list mb-2" id="edit-prof-${profType.key}"></div>
					<div class="ve-flex-v-center" style="position: relative;">
						<input type="text" class="form-control form-control--minimal mr-2" id="edit-prof-${profType.key}-input" placeholder="Type to search or enter custom...">
						<button class="ve-btn ve-btn-primary ve-btn-xs" id="edit-prof-${profType.key}-add">Add</button>
					</div>
					<div class="charsheet__autocomplete-dropdown" id="edit-prof-${profType.key}-dropdown" style="display: none;"></div>
				</div>
			`);

			const $list = $section.find(`#edit-prof-${profType.key}`);
			const $input = $section.find(`#edit-prof-${profType.key}-input`);
			const $addBtn = $section.find(`#edit-prof-${profType.key}-add`);
			const $dropdown = $section.find(`#edit-prof-${profType.key}-dropdown`);

			const renderList = () => {
				const currentItems = this._state[profType.getter]();
				$list.empty();
				if (!currentItems.length) {
					$list.append(`<span class="ve-muted">None</span>`);
					return;
				}
				currentItems.forEach(item => {
					const displayName = typeof item === "string" ? item : item.full || item.name || item;
					const $badge = $(`
						<span class="charsheet__edit-prof-badge">
							${displayName}
							<span class="charsheet__edit-prof-remove glyphicon glyphicon-remove" title="Remove"></span>
						</span>
					`);
					$badge.find(".charsheet__edit-prof-remove").on("click", () => {
						this._state[profType.remover](item);
						renderList();
					});
					$list.append($badge);
				});
			};
			renderList();

			const renderDropdown = (filter = "") => {
				const currentItems = this._state[profType.getter]().map(i => (typeof i === "string" ? i : i.name || i).toLowerCase());
				const filtered = profType.suggestions.filter(s => {
					if (currentItems.includes(s.toLowerCase())) return false;
					if (filter && !s.toLowerCase().includes(filter.toLowerCase())) return false;
					return true;
				}).slice(0, 10); // Limit to 10 suggestions

				$dropdown.empty();
				if (!filtered.length) {
					$dropdown.hide();
					return;
				}

				filtered.forEach(suggestion => {
					const $item = $(`<div class="charsheet__autocomplete-item">${suggestion}</div>`);
					$item.on("click", () => {
						this._state[profType.adder](suggestion);
						$input.val("");
						$dropdown.hide();
						renderList();
					});
					$dropdown.append($item);
				});
				$dropdown.show();
			};

			const addItem = () => {
				const value = $input.val().trim();
				if (!value) return;
				this._state[profType.adder](value);
				$input.val("");
				$dropdown.hide();
				renderList();
			};

			$input.on("input", () => renderDropdown($input.val()));
			$input.on("focus", () => renderDropdown($input.val()));
			$input.on("blur", () => setTimeout(() => $dropdown.hide(), 200)); // Delay to allow click
			$input.on("keypress", (e) => {
				if (e.which === 13) addItem();
			});
			$addBtn.on("click", addItem);

			return $section;
		};

		profTypes.forEach(pt => {
			$modalInner.append(renderSection(pt));
		});

		$$`<div class="ve-flex-h-right mt-3">
			<button class="ve-btn ve-btn-primary">Done</button>
		</div>`.appendTo($modalInner).find("button").on("click", () => doClose());
	}

	/**
	 * Show modal for editing weapon masteries
	 * Allows changing which weapons the character has mastery with
	 */
	async _showEditWeaponMasteriesModal () {
		const currentMasteries = this._state.getWeaponMasteries();
		
		// Determine max masteries from class features
		const maxMasteries = this._getMaxWeaponMasteries();
		
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "Edit Weapon Masteries",
			isMinHeight0: true,
			isWidth100: true,
			cbClose: () => {
				this._renderWeaponMasteries();
				this._saveCurrentCharacter();
			},
		});

		$modalInner.append(`
			<p class="ve-muted mb-2">Choose up to ${maxMasteries} weapons to master. You can change these after a Long Rest.</p>
			<div class="ve-small ve-muted mb-2">Selected: <span id="mastery-count">${currentMasteries.length}</span>/${maxMasteries}</div>
		`);

		// Get only BASE weapons with mastery properties (not magic variants)
		const weaponsWithMastery = (this._itemsData || []).filter(item => {
			// Must be a base item, not a magic variant
			if (!item._isBaseItem) return false;
			// Must be a weapon
			if (!item.weaponCategory && !["M", "R", "S"].includes(item.type)) return false;
			// Must have mastery property
			return item.mastery?.length > 0;
		});

		// Group by type
		const simpleWeapons = weaponsWithMastery.filter(w => 
			w.weaponCategory === "simple" || w.type === "S"
		).sort((a, b) => a.name.localeCompare(b.name));
		
		const martialWeapons = weaponsWithMastery.filter(w => 
			w.weaponCategory === "martial" || w.type === "M"
		).sort((a, b) => a.name.localeCompare(b.name));

		const selectedMasteries = [...currentMasteries];

		const renderWeaponGroup = (weapons, groupName) => {
			if (!weapons.length) return;

			const $group = $(`<div class="mb-3"><strong>${groupName}:</strong></div>`);
			const $checkboxes = $(`<div class="charsheet__mastery-checkboxes" style="display: flex; flex-wrap: wrap; gap: 8px;"></div>`);

			weapons.forEach(weapon => {
				const masteryName = this._getMasteryName(weapon.mastery?.[0]);
				const weaponKey = `${weapon.name}|${weapon.source}`;
				const isSelected = selectedMasteries.includes(weaponKey);
				
				const $label = $(`
					<label class="charsheet__mastery-checkbox" style="display: flex; align-items: center; cursor: pointer; padding: 4px 8px; border: 1px solid var(--rgb-border-grey); border-radius: 4px; ${isSelected ? "background: var(--rgb-bg-highlight);" : ""}">
						<input type="checkbox" value="${weaponKey}" ${isSelected ? "checked" : ""} style="margin-right: 6px;">
						<span>${weapon.name}</span>
						${masteryName ? `<span class="ve-small text-muted ml-1">(${masteryName})</span>` : ""}
					</label>
				`);

				$label.find("input").on("change", (e) => {
					if (e.target.checked) {
						if (selectedMasteries.length < maxMasteries) {
							selectedMasteries.push(weaponKey);
							$label.css("background", "var(--rgb-bg-highlight)");
						} else {
							e.target.checked = false;
							JqueryUtil.doToast({type: "warning", content: `You can only choose ${maxMasteries} weapon masteries.`});
						}
					} else {
						const idx = selectedMasteries.indexOf(weaponKey);
						if (idx > -1) selectedMasteries.splice(idx, 1);
						$label.css("background", "");
					}
					$("#mastery-count").text(selectedMasteries.length);
				});

				$checkboxes.append($label);
			});

			$group.append($checkboxes);
			$modalInner.append($group);
		};

		renderWeaponGroup(simpleWeapons, "Simple Weapons");
		renderWeaponGroup(martialWeapons, "Martial Weapons");

		// Save button
		$$`<div class="ve-flex-h-right mt-3">
			<button class="ve-btn ve-btn-primary">Save</button>
		</div>`.appendTo($modalInner).find("button").on("click", () => {
			this._state.setWeaponMasteries(selectedMasteries);
			doClose();
		});
	}

	/**
	 * Get the maximum number of weapon masteries for this character
	 * Based on class and level
	 * Returns 0 if the character doesn't have the Weapon Mastery feature
	 */
	_getMaxWeaponMasteries () {
		const classes = this._state.getClasses();
		if (!classes?.length) return 0; // No class = no weapon mastery

		// Check each class for weapon mastery progression
		let maxMasteries = 0;
		
		for (const cls of classes) {
			const classData = this._classes?.find(c => c.name === cls.name && c.source === cls.source);
			if (!classData) continue;

			// Check classTableGroups for Weapon Mastery column
			if (classData.classTableGroups) {
				for (const tableGroup of classData.classTableGroups) {
					const masteryColIndex = tableGroup.colLabels?.findIndex(
						col => col === "Weapon Mastery" || (typeof col === "string" && col.toLowerCase().includes("mastery"))
					);
					
					if (masteryColIndex === -1) continue;

					// Get value at current level (rows are 0-indexed)
					const level = cls.level || 1;
					const row = tableGroup.rows?.[level - 1];
					if (!row) continue;

					const value = row[masteryColIndex];
					const count = typeof value === "number" ? value : parseInt(value) || 0;
					if (count > maxMasteries) maxMasteries = count;
				}
			}

			// If no table found, check for Weapon Mastery feature (defaults to 2)
			if (maxMasteries === 0) {
				const hasWeaponMastery = this._classFeatures?.some(f => 
					f.name === "Weapon Mastery" && 
					f.className === cls.name && 
					f.level <= (cls.level || 1)
				);
				if (hasWeaponMastery) maxMasteries = 2;
			}
		}

		return maxMasteries; // 0 if no Weapon Mastery feature found
	}

	/**
	 * Get available feature suggestions from game data
	 */
	_getFeatureSuggestions () {
		const features = [];

		// Add class features (deduplicated by name)
		const classFeatureNames = new Set();
		this._classFeatures.forEach(f => {
			if (!classFeatureNames.has(f.name)) {
				classFeatureNames.add(f.name);
				features.push({
					name: f.name,
					source: f.source,
					description: f.entries ? Renderer.get().render({entries: f.entries}) : null,
					featureType: `Class (${f.className})`,
				});
			}
		});

		// Add optional features (invocations, fighting styles, etc.)
		this._optionalFeaturesData.forEach(f => {
			features.push({
				name: f.name,
				source: f.source,
				description: f.entries ? Renderer.get().render({entries: f.entries}) : null,
				featureType: f.featureType?.join(", ") || "Optional Feature",
			});
		});

		// Add racial traits from race data
		this._races.forEach(race => {
			if (race.entries) {
				race.entries.forEach(entry => {
					if (entry.name && entry.entries) {
						features.push({
							name: entry.name,
							source: race.source,
							description: Renderer.get().render({entries: entry.entries}),
							featureType: `Race (${race.name})`,
						});
					}
				});
			}
		});

		// Sort by name and deduplicate
		const seen = new Set();
		return features.filter(f => {
			const key = f.name.toLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		}).sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Show modal for adding a custom feature
	 */
	async _showAddCustomFeatureModal () {
		const {$modalInner, doClose} = await UiUtil.pGetShowModal({
			title: "Add Feature",
			isMinHeight0: true,
			isWidth100: true,
		});

		const featureSuggestions = this._getFeatureSuggestions();

		const $form = $$`<div class="ve-flex-col">
			<div class="mb-2" style="position: relative;">
				<label class="mb-1">Search existing features or enter custom name:</label>
				<input type="text" class="form-control" id="custom-feature-name" placeholder="Type to search features...">
				<div class="charsheet__autocomplete-dropdown" id="custom-feature-dropdown" style="display: none; max-height: 200px;"></div>
			</div>
			<div class="ve-flex-v-center mb-2">
				<label class="mr-2 w-100p">Source:</label>
				<input type="text" class="form-control" id="custom-feature-source" placeholder="e.g. Race, Feat, Item" value="Custom">
			</div>
			<div class="mb-2">
				<label class="mb-1">Description (optional):</label>
				<textarea class="form-control" id="custom-feature-desc" rows="4" placeholder="Enter feature description..."></textarea>
			</div>
			<div class="ve-flex-h-right">
				<button class="ve-btn ve-btn-default mr-2" id="custom-feature-cancel">Cancel</button>
				<button class="ve-btn ve-btn-primary" id="custom-feature-add">Add Feature</button>
			</div>
		</div>`.appendTo($modalInner);

		const $name = $form.find("#custom-feature-name");
		const $source = $form.find("#custom-feature-source");
		const $desc = $form.find("#custom-feature-desc");
		const $dropdown = $form.find("#custom-feature-dropdown");
		const $addBtn = $form.find("#custom-feature-add");
		const $cancelBtn = $form.find("#custom-feature-cancel");

		const renderDropdown = (filter = "") => {
			const filtered = featureSuggestions.filter(f => {
				if (!filter) return false; // Don't show all when empty
				return f.name.toLowerCase().includes(filter.toLowerCase());
			}).slice(0, 15);

			$dropdown.empty();
			if (!filtered.length) {
				$dropdown.hide();
				return;
			}

			filtered.forEach(feature => {
				const $item = $(`
					<div class="charsheet__autocomplete-item">
						<span class="charsheet__autocomplete-item-name">${feature.name}</span>
						<span class="charsheet__autocomplete-item-type ve-muted">${feature.featureType}</span>
					</div>
				`);
				$item.on("click", () => {
					$name.val(feature.name);
					$source.val(feature.featureType);
					if (feature.description) $desc.val(feature.description.replace(/<[^>]*>/g, "")); // Strip HTML
					$dropdown.hide();
				});
				$dropdown.append($item);
			});
			$dropdown.show();
		};

		$name.on("input", () => renderDropdown($name.val()));
		$name.on("focus", () => renderDropdown($name.val()));
		$name.on("blur", () => setTimeout(() => $dropdown.hide(), 200));

		$cancelBtn.on("click", () => doClose());

		$addBtn.on("click", () => {
			const name = $name.val().trim();
			const source = $source.val().trim() || "Custom";
			const description = $desc.val().trim();

			if (!name) {
				JqueryUtil.doToast({type: "warning", content: "Please enter a feature name."});
				return;
			}

			// Add the custom feature
			this._state.addFeature({
				name,
				source,
				description: description || null,
				featureType: "Custom",
				isCustom: true,
			});

			// Re-render features
			if (this._features) this._features.render();
			this._renderCustomFeatures();
			this._saveCurrentCharacter();

			JqueryUtil.doToast({type: "success", content: `Added feature: ${name}`});
			doClose();
		});

		// Allow Enter in name to submit
		$name.on("keypress", (e) => {
			if (e.which === 13) $addBtn.click();
		});

		$name.focus();
	}

	/**
	 * Render custom features section
	 */
	_renderCustomFeatures () {
		const $container = $("#charsheet-custom-features");
		$container.empty();

		const features = this._state.getFeatures().filter(f => f.isCustom || f.featureType === "Custom");

		if (!features.length) {
			$container.append(`<div class="ve-muted ve-text-center py-2">No custom features added</div>`);
			return;
		}

		features.forEach(feature => {
			const $feature = $(`
				<div class="charsheet__feature" data-feature-id="${feature.id}">
					<div class="charsheet__feature-header">
						<span class="charsheet__feature-toggle glyphicon glyphicon-chevron-down"></span>
						<span class="charsheet__feature-name">${feature.name}</span>
						<span class="charsheet__feature-source ve-muted">(${feature.source})</span>
						<div class="charsheet__feature-actions">
							<span class="charsheet__feature-remove glyphicon glyphicon-trash" title="Remove feature"></span>
						</div>
					</div>
					<div class="charsheet__feature-body" style="display: none;">
						${feature.description ? `<div class="charsheet__feature-desc">${Renderer.get().render(feature.description)}</div>` : `<div class="ve-muted">No description</div>`}
					</div>
				</div>
			`);

			$feature.find(".charsheet__feature-toggle, .charsheet__feature-header").on("click", (e) => {
				if ($(e.target).closest(".charsheet__feature-actions").length) return;
				const $body = $feature.find(".charsheet__feature-body");
				const $toggle = $feature.find(".charsheet__feature-toggle");
				$body.slideToggle(200);
				$toggle.toggleClass("glyphicon-chevron-down glyphicon-chevron-up");
			});

			$feature.find(".charsheet__feature-remove").on("click", () => {
				this._state.removeFeature(feature.id);
				this._renderCustomFeatures();
				this._saveCurrentCharacter();
			});

			$container.append($feature);
		});
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
