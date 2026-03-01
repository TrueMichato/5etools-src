# Bugs Tracking
This file is used to track known bugs in the 5etools character sheet code.

## Feature Requests

### General
- [x] need way to roll things with advantage/disadvantage from the sheet (fixed: Shift+click for advantage, Ctrl/Cmd+click for disadvantage)
- [x] need to support rolling skills with different ability scores (fixed: right-click on skill to choose alternate ability)
- [x] need to support adding custom skills to sheet (fixed: "Add Custom Skill" button in skills section)
- [x] need to support adding features, languages, proficiencies, etc manually to sheet (fixed: pencil icon on Proficiencies section, + button on Custom Features section in Features tab)
- [x] need to support adding custom modifiers to rolls, skills, abilities, hit, damage etc (fixed: "Modifiers" button in header opens modal to add/edit/toggle named modifiers for AC, initiative, attacks, damage, saves, skills, etc)
- [x] need to support toggling proficiency/expertise/half proficiency on skills manually (fixed: click on the proficiency dot next to any skill to cycle through none → proficient → expertise → none)
- [x] need to support Thelemar exhaustion rules (-1 to all rolls and DCs per level, max 10 before death) (fixed: added "Thelemar Rules" option in exhaustion dropdown)
- [x] need to support various features giving modifiers to rolls, damage, AC, stats, skills etc (e.g magic items, class features, racial features, etc) (fixed: FeatureModifierParser auto-detects modifiers from feature descriptions including: AC, saving throws, attack/damage rolls, spell DC/attack, initiative, skills, ability checks, ability scores, speed (all types), senses (darkvision/blindsight/etc), HP, carry capacity, proficiency bonus. Supports both +X and -X, "increases/decreases by X" phrasings. Conditional modifiers (while raging, against undead, etc) are added as toggleable named modifiers)
- [x] need to support custom background creation in builder (fixed: Added "Create Custom Background" button in the background step. Opens a form to enter: background name, 2 skill proficiencies (checkbox selection), tool/language proficiencies (2 total via dropdowns), equipment description, and feature name. Validates that exactly 2 skills are selected. Creates a proper background object with skillProficiencies, toolProficiencies, and languageProficiencies arrays. Custom background appears at top of the background list and can be selected like any other background.)
- [x] need to supoprt Tasha's ASI rules for races in builder (fixed: Added "Use Tasha's Custom Origin Rules" checkbox in the Racial Bonuses section of the Abilities step. When enabled, players can reassign their racial ability score bonuses to any abilities they choose. The feature tracks custom ASI selections separately and validates that all bonuses are assigned before proceeding. Only shown for pre-2024 races that have ability score bonuses.)
- [x] need to support custom AC formulas from features (like natural armor, unarmored defense, etc) (fixed: FeatureModifierParser already detects AC formula patterns like "your AC equals 13 + your Dexterity modifier", natural armor, and unarmored defense. AC formulas are stored and getAc() calculates the best option between standard AC, armor, and custom formulas. Supports noDex for flat AC like Tortle, and secondAbility for Barbarian/Monk style formulas.)
- [x] need to support Thelemar carry weight rules (50 + 25 × STR modifier, minimum 50) (fixed: Added "Thelemar Carry Weight" toggle in Settings modal under "Thelemar Homebrew Rules" section. When enabled, getCarryingCapacity() uses the formula 50 + 25 * STR mod instead of STR * 15. Still applies flat bonuses and multipliers from features.)
- [x] need to support Thelemar linguistics skill bonus (+1 per known language except Common) (fixed: Added "Thelemar Linguistics" toggle in Settings modal under "Thelemar Homebrew Rules" section. When enabled, the Linguistics skill gets +1 for each language the character knows that isn't Common. Bonus is calculated in _getSkillFeatureBonus() and reflected in skill rolls.)
- [x] need to add more friendly UI for understanding the sheet functions (e.g tooltips, help buttons, rolling with adv/disadv, changing skill abilities or proficiency, etc)
- [x] need to improve UI greatly, currently very basic and not user friendly
  **FIXED**: Major UI overhaul completed with modern design system:
  
  **New CSS Architecture:**
  - Created `charactersheet-modern.css` with comprehensive design tokens (CSS custom properties)
  - Modern color palette with primary indigo (#6366f1), semantic colors (success/warning/danger/info), and accent colors (gold/emerald/ruby/sapphire/amethyst)
  - Google Fonts integration: Cinzel for display text, Inter for body text
  - Consistent spacing scale, border radius values, and shadow depths
  
  **Visual Improvements:**
  - Modern card-based section design with hover effects and subtle shadows
  - Enhanced ability score boxes with gradient accents and animations
  - Improved skills/saves list with hover animations and color-coded proficiency indicators
  - Redesigned combat stats with prominent displays and hover effects
  - Modern tab navigation with icons (emoji) and better visual feedback
  - Enhanced header bar with gradient buttons and modern styling
  - Improved Builder wizard with progress indicator line and step animations
  
  **Component Enhancements:**
  - Attacks: Modern cards with left accent stripe and hover effects
  - Resources: Gold-themed pips with glow effects
  - Conditions: Pill-shaped badges with warning colors
  - Inventory: Item rarity colors with glow effects, artifact animation
  - Features: Accordion-style display with modern styling
  - Spell slots: Purple/amethyst themed to match magic aesthetic
  
  **Animations Added:**
  - Dice roll popup with bounce animation
  - Critical hit celebration effect (gold glow + scale)
  - Fumble shake effect (red color + shake)
  - Damage/heal flash effects
  - Concentration pulse animation
  - Magic item glow animation
  - Level up celebration
  - Loading shimmer effect
  
  **Accessibility:**
  - Proper focus-visible styles with outline and glow
  - Screen reader only class (.sr-only)
  - Reduced motion preference support
  - Custom scrollbars for better UX
  
- [] need to allow for some color customization (e.g dark mode, custom background colors, etc)
- [] need to support mobile devices better (bigger buttons, less clicks, altternative ways to do things that require hover or shift/ctrl keys)


## Known Bugs

### Character Builder
- [x] some races with subraces don't show subrace selection in the builder (fixed: races now processed through Renderer.race.mergeSubraces() to get _baseName/_baseSource properties for proper subrace grouping, and 2024 races with _versions are now expanded and grouped properly)
- [x] races that give spells (like high elf, tiefling, etc) not adding spells automatically and not giving choice UI. (fixed: _applyRacialSpells() processes additionalSpells at char creation, _updateRacialSpells() adds spells at each level-up. Handles both known spells and innate spells with uses/recharge. Supports subrace-specific spell blocks. Spell choices not yet implemented)
- [x] races that give proficiencies (like half-orc, etc) not adding proficiencies automatically and not giving choice UI. (fixed: Added _renderRacialProficiencyChoices() UI for skill/tool choices with checkboxes. Fixed proficiencies already worked, now choose options also work. Validates required choices before advancing step.)
- [x] hover links for @subclassFeature tags showing "Failed to load references" error (fixed: Added _pPreCacheClassFeatures() to pre-cache classFeature and subclassFeature in DataLoader during page init, so hover links work properly)
- [x] Some race abilities (Charge, Aggressive, etc) not added correctly or not working as intended. (fixed: Enhanced isImportantFeature() to check both name AND description for keywords. Added race-relevant keywords: "charge", "aggressive", "natural weapon", "unarmed strike", "breath weapon", "fey ancestry", "relentless endurance". Fixed NaturalWeaponParser regex to handle plural "natural melee weapons" for Hooves-type abilities. Added activatable patterns to detect features that use action economy.)
- [x] In Abilities in builder - the placeholder 10 are returned to the score list. (fixed: Changed initial _abilityScores from {str: 10, ...} to {str: null, ...} to match standard array mode. Added validation to only return valid standard array scores [15, 14, 13, 12, 10, 8] to the pool, preventing invalid scores from being added.)


### Features
- [x] many features that are useable (specialties and combat methods (from thelemar), invocations, metamagic, maneuvers, homebrew, etc) not selectable during level up or character creation, not given choice UI, or not added correctly. (fixed: Added _validateOptionalFeatureSelections() and _validateFeatureOptionSelections() validation in step 2 (class) to enforce selection of required optional features like invocations, metamagic, combat methods before advancing. Also validates feature options like Specialties. Level-up already had validation in place.)
- [x] combat method feature (the meta feature that gives a class access to combat methods) looked at as resource (the resource is exertion) (fixed: Added _isResourceSystemFeature() check in addFeature() to skip use detection for meta-features that describe resource systems like Combat Methods, Ki, Sorcery Points, etc. These features mention "short rest" or "long rest" but that's for the resource pool, not the feature itself.)
<!-- - [] SOme features that give additional combat traditions or methods (thelemar homebrew) not adding them correctly or not giving choice UI. -->
- [x] some race features added as resources (like elf lineage) instead of just being applied (fixed: Enhanced _isResourceSystemFeature() to detect spell-granting racial features like "Elven Lineage", "Infernal Legacy", "Wind Caller", etc. These features describe spell uses, not their own uses. Actual usable abilities like "Healing Hands" or "Celestial Revelation" are correctly still tracked as resources.)
- [x] Specialties don't give their benefits many times (thelemar homebrew) (fixed: Enhanced _findFeatureOptions() in both charactersheet-builder.js and charactersheet-levelup.js to detect {@classFeature} references in feature text. Higher-level Specialty features (5th, 9th, 13th, 17th level) reference the level 1 feature via text like "gain another specialty from the {@classFeature Specialties|Fighter|TGTT|1}". Now these references are followed and the options from the referenced feature are used.)
- [x] Many specialty benefits (thelemar homebrew) not applied and don't affect rolls or stats, not reflected in overview. (fixed: Comprehensive enhancement of FeatureModifierParser with 35+ pattern types. Patterns apply to ALL feature types, not just specialties. Added detection for:
  - Speed bonuses: swimming/climbing speed equal to walking speed, speed increases by X feet
  - Senses: darkvision/tremorsense/blindsight/truesight with range, see normally in magical darkness (Devil's Sight)
  - Proficiencies: all tools (including healer's kit), improvised weapons, combined "martial weapons and heavy armor" patterns
  - Advantage: on saving throws (prone, heat/cold, drowning, charmed/frightened/poisoned), on ability/skill checks with conditions
  - Skill bonuses: equal to proficiency bonus, add dice (d10/d8/etc), add ability modifier, add martial arts die, expertise die
  - Movement: difficult terrain immunity (general and terrain-specific), jump distance increase/doubled, climbing without ability check
  - Travel: pace bonuses, forced march hours, no fast pace penalty
  - Resources: extra exertion/focus/ki points, gain resource on initiative
  - Ability swaps: use DEX instead of STR for Athletics, etc.
  - Other: carrying capacity doubled, exhaustion immunity, extra cantrips known, advantage on initiative, tracking bonuses
  Total specialty coverage improved from 46% to 63% (118/187 specialties). Remaining 37% are mostly active abilities (tracked as usable features) or roleplay/utility features without stat impacts.)

### Overview 
- [x] states that require activation and then stay active (like rage, concentration, stance, etc) not tracked or managed, and their effects not applied to rolls or stats.
  **FIXED**: Implemented Active States system for tracking toggled states like Rage, Concentration, Wild Shape, Dodge, etc.
  
  **Data Structures** (charactersheet-state.js):
  - Added `activeStates: []` array to track active state instances
  - Added `concentrating: null` field to track current concentration
  - Added static `ACTIVE_STATE_TYPES` defining state templates:
    - Rage: advantage on STR checks/saves, resistance to B/P/S damage, +rage damage on melee STR attacks
    - Concentration: tracks spell being concentrated on
    - Wild Shape: placeholder for beast form transformation
    - Defensive Stance: +2 AC, disadvantage on attacks
    - Dodge: disadvantage on attacks against, advantage on DEX saves
    - Prone: attack disadvantages and advantages against

  **Management Methods**:
  - `getActiveStates()`, `getActiveState(id)`, `isStateActive(typeId)`
  - `addActiveState(typeId, options)`, `activateState(typeId, options)`, `deactivateState(typeId)`
  - `toggleActiveState(stateId)`, `removeActiveState(stateId)`
  - `getActiveStateEffects()` - returns all effects from active states
  - `hasAdvantageFromStates(rollType)`, `hasDisadvantageFromStates(rollType)`
  - `getBonusFromStates(target)`, `hasResistanceFromStates(damageType)`
  - `getRageDamageBonus(isMelee, abilityUsed)` - rage damage on melee STR attacks
  - `getConcentration()`, `setConcentration(spellName, level)`, `breakConcentration()`, `isConcentrating()`
  - `clearStatesOnRest(restType)` - clears states on short/long rest

  **Integration with Rolls** (charactersheet.js):
  - `_rollAbilityCheck()` - applies advantage from states (e.g., Rage on STR checks)
  - `_rollSavingThrow()` - applies advantage from states (e.g., Rage on STR saves, Dodge on DEX saves)
  - `_rollAttack()` - applies advantage/disadvantage, adds rage damage bonus to melee STR attacks
  - `getAc()` - adds bonus from states (e.g., Defensive Stance +2 AC)

  **UI**:
  - Added "Active States" section in charactersheet.html after Resources
  - `_renderActiveStates()` displays active states with toggle/remove buttons
  - Quick activation buttons for Rage and Dodge
  - Rage button automatically spends Rage resource when activating
  - States clear automatically on rest

  **Condition Effects Integration**:
  - Added static `CONDITION_EFFECTS` defining all standard 5e conditions with their mechanical effects:
    - Blinded: disadvantage on attacks, advantage against, auto-fail sight checks
    - Charmed: roleplay notes
    - Deafened: auto-fail hearing checks
    - Frightened: disadvantage on attacks and checks (while source visible)
    - Grappled: speed set to 0
    - Incapacitated: no actions/reactions
    - Invisible: advantage on attacks, disadvantage against
    - Paralyzed: incapacitated, auto-fail STR/DEX saves, advantage against, crits
    - Petrified: incapacitated, resistance to all damage, immune to poison
    - Poisoned: disadvantage on attacks and ability checks
    - Prone: disadvantage on attacks, melee against has advantage, ranged has disadvantage
    - Restrained: speed 0, disadvantage on attacks/DEX saves, advantage against
    - Stunned: incapacitated, auto-fail STR/DEX saves, advantage against
    - Unconscious: incapacitated, auto-fail saves, advantage against, crits
    - Slowed (2024): speed halved, -2 AC/DEX saves
  - Added `registerCustomCondition()` for homebrew conditions
  - When conditions are added, they automatically create active state entries
  - Conditions now show icons and tooltips with effect descriptions
  - `hasAdvantageFromStates()` and `hasDisadvantageFromStates()` now handle generic "check" and "save" targets
  - Added `hasAutoFailFromConditions()`, `isIncapacitated()`, `getSpeedMultiplierFromConditions()`

  **Homebrew Condition Parsing**:
  - Added `parseConditionFromEntries()` static method that parses condition text to extract mechanical effects
  - Added `registerHomebrewConditions()` static method to register an array of homebrew conditions
  - Added `_flattenEntriesToText()` to convert nested 5etools entry structures to plain text
  - Added `_getConditionIcon()` to auto-assign appropriate icons based on condition names
  - Updated `_mergeBrewData()` in charactersheet.js to automatically parse and register homebrew conditions
  - Supports extracting these effect types from condition text:
    - Speed modifications: "Speed 0", "speed is 0", "halved speed", "spend 1 extra foot"
    - Attack advantage/disadvantage: "advantage on attack rolls", "your attack rolls have disadvantage"
    - Attacks against: "attack rolls against you have advantage/disadvantage"
    - Saving throw disadvantage: for all saves or specific abilities (DEX/STR/CON/INT/WIS/CHA)
    - Auto-fail saves: "automatically fail Strength Saving Throw"
    - Ability check failures: "automatically fails any ability check that requires sight"
    - Incapacitated detection: "can't take actions or reactions"
    - Resistance: "resistance to all damage"
    - Notes: movement restrictions, concentration broken, limited activity, speechless
  - TGTT homebrew conditions now auto-register with effects: Dazed, Choked, Slowed, Hidden, Undetected, modified Grappled/Restrained/Petrified/Stunned

### Combat
- [x] unarmed strikes not added automatically as attacks, specially for monks (fixed: Added ensureUnarmedStrike() method that automatically adds Unarmed Strike attack for all characters. For non-monks, deals 1+STR bludgeoning. For monks, uses Martial Arts die progression (1d6→1d8→1d10→1d12) and can use DEX (finesse). Called when: class is added/removed, character is loaded, level-up is applied. Combat UI shows "Monk" badge for monk unarmed strikes.)
- [x] resources and active features not displayed in combat UI (fixed: Added Combat Resources section showing combat-relevant resources like Rage, Ki, Sorcery Points with clickable pips. Added Active States section with quick buttons for Rage, Dodge, Concentration. States sync with overview tab.)
- [x] Condition resistances and immunities not displayed in combat UI (fixed: Added renderCombatDefenses() method that displays resistances, immunities, vulnerabilities, and condition immunities in the Defenses section. Shows base defenses and those from active states (like Rage B/P/S resistance) with different badge colors. Updates when states change.)
- [x] need to add more combat effects from features and conditions (like advantage/disadvantage, resistances, bonuses, etc) (fixed: Added "Active Combat Effects" section with renderCombatEffects() method. Displays YOUR advantage/disadvantage vs ENEMY advantage/disadvantage against you separately. Shows bonuses to AC/attack/damage, and other effects like speed changes or incapacitation. "attacksAgainst" effects now correctly shown as "Enemies Have Advantage/Disadvantage On" instead of being confused with your own rolls.)
- [x] Conditions not displayed in combat tab and not affecting combat rolls (fixed: Added renderCombatConditions() method showing active conditions with icons and remove buttons. Added "Add Condition" button to combat tab. Fixed _rollAttack() to check hasAdvantageFromStates() and hasDisadvantageFromStates() with proper attack type formatting (attack:melee:str). Conditions now sync between overview and combat tabs.)
- [x] race abilities like aggressive, charge, etc not added to combat UI automatically (fixed: Added "Combat Abilities" section on the LEFT side with other active abilities (attacks, spells, methods). renderCombatActions() displays race/class/feat abilities that have explicit action economy (bonus action, action, reaction) AND limited uses or combat keywords. Strict filtering excludes non-combat features like suggested characteristics, proficiencies, darkvision. Shows action type icons (⚔️/⚡/🔄), uses tracking, and tooltips with descriptions.)

### Spells
- [x] features giving spells or spell choice (like warlock invocations, fey-touched feat, etc) not adding spells automatically and not giving choice UI. Needs to solve for all features that give spells in a general way. (fixed: Enhanced SpellGrantParser.parseAdditionalSpells() to handle all nested structures: known._, prepared._.rest/daily, innate._.daily.1e, etc. Added pendingSpellChoices storage to state with methods: addPendingSpellChoice(), getPendingSpellChoices(), fulfillSpellChoice(). Created showFilteredSpellPicker() in spells module that parses filter strings like "level=1|school=E;D" and shows filtered spell picker modal. Updated _processFeatureSpells() to add pending choices instead of logging. _addFeat() in features.js and level-up now trigger processPendingSpellChoices() after adding feats. Fixed spells like Misty Step are auto-added, while choice spells show picker.)
- [x] need to add spell-casting UI that would check constraints before casting (like from conditions) (fixed: Added _checkCastingConstraints() method to charactersheet-spells.js that checks for conditions preventing spellcasting. Incapacitating conditions (Incapacitated, Paralyzed, Petrified, Stunned, Unconscious) completely prevent casting. Silenced condition prevents spells with verbal components. Added "Silenced" to CONDITION_EFFECTS with icon and effects. Both _castSpell() and _castInnateSpell() now check constraints before casting and show warning messages.)
- [x] need spells that require concentration to set concentration active state when cast from overview or combat tab, and not be castable if already concentrating on another spell. (fixed: Updated _castSpell() in charactersheet-spells.js to check if spell requires concentration. If already concentrating, prompts user to break concentration before casting. When concentration spell is cast, calls setConcentration() to set the active state. Also updates combat tab and overview UI after casting. Combat tab's _castCombatSpell() now awaits the async method and refreshes states/effects.)

### Classes
- [x] monks give both ki points and focus points (fixed: Changed from adding both resources to using a placeholder that resolves to either "Ki Points" (2014 PHB) or "Focus Points" (2024 XPHB) based on class source. Also added check to treat them as interchangeable when looking for existing resources, preventing duplicates.)
- [x] monk's unarmored movement bonus not applied to speed (fixed: Added getUnarmoredMovementBonus() method that calculates the monk's speed bonus based on level (+10 at 2, +15 at 6, +20 at 10, +25 at 14, +30 at 18). Checks if wearing armor or shield (bonus only applies when unarmored). Integrated into getSpeed() and getWalkSpeed() calculations.)
- [x] rangers give favoured enemy even on rangers without it like TGTT (fixed: Added hasFavoredFoe() method that checks if the character actually has a "Favored Foe" or "Favored Enemy" feature. The Ranger calculation in getClassCalculations() now only includes favoredFoeDamage if hasFavoredFoe() returns true. Homebrew rangers like TGTT that don't have this feature won't show it.)
- [x] Deft Explorer not giving expertise choice.

### Multiclassing
- [x] spell slots not calculated correctly with multiclassing (fixed: Updated calculateSpellSlots() in charactersheet-state.js to use casterProgression property from class/subclass data instead of hardcoded class name lists. Added casterProgression and spellcastingAbility to class data when adding classes in builder and level-up. Supports all progression types: "full" (Bard, Cleric, etc.), "1/2" (Paladin, Ranger), "1/3" (Eldritch Knight, Arcane Trickster), "artificer" (rounds up), and "pact" (Warlock separate slots). Includes fallback mappings for older saved characters without stored progression.)
- [x] choosing a class in multiclassing is not visually clear which class is being chosen (fixed: Redesigned multiclass selection modal in showMulticlass(). Now uses charsheet__levelup-option styling with radio buttons, hit die display, and class descriptions. Added selection confirmation display showing chosen class name. Confirm button dynamically updates to show "Add [ClassName] (Level 1)" when class is selected. Empty state message shown when filter matches nothing.)
- [x] level 1 choices for multiclassing not given (like fighting style for fighter, invocations for warlock, etc) (fixed: Added _showMulticlassChoices() method that checks for optionalfeatureProgression and feature options at level 1. If choices exist (like Fighter's Fighting Style), shows a second modal with _renderOptionalFeaturesSelection() and _renderFeatureOptionsSelection(). Validates all required selections before allowing confirmation. Added _applyMulticlass() helper that handles adding the class, features, selected optional features, and feature options all together.)

### General
- [x] rolls go from 0 to number of sides instead of 1 to number of sides (e.g d20 roll can be 0) (fixed: Changed from RollerUtil.roll(N) which returns 0 to N-1, to RollerUtil.randomise(N) which returns 1 to N. Fixed in: rollDice(), _rollD20(), _onDeathSave(), hit die rolls, and level-up HP rolls.)
- [x] Activated abilities not applying their effects to rolls or stats (fixed: Added getBonusFromStates() calls to attack rolls and damage rolls in combat module. Added getSaveBonusFromStates() method for saving throw bonuses from active states. Updated getSaveMod() to include state bonuses. Updated getBonusFromStates() to handle abilityMod effects like Bladesong's +INT to AC. Active state effects like combat stances, Bladesong bonuses, etc. now properly apply to attacks, damage, saves, and AC.)


### UI
 - [x] in specialties choices in builder it's not quite clear which box is for which feature. Spacing a bit off.


## Old Bugs

### Items
- [x] armors are not affecting the actual AC of the character
- [x] Magic weapons/armors have issues - attack rolls not calculated correctly, bonuses not applied
- [x] General magical item bonuses (to attack rolls, damage rolls, AC, saving throws, ability checks, spell attack rolls, spell save DCs, etc) are not applied
- [x] Items with charges (like wands) do not track charges or allow expending them
- [x] Items that require attunement do not enforce attunement limits (3 items max, class limited attunements, etc)
- [x] Items that require attunement do not apply their effects when attuned
- [x] Equipped and attuned items not displayed on the right side in the inventory (there is place for display but nothing shows up)
- [x] Weapon properties and masteries are not displayed
- [x] Items with no rarity shouldn't display "none" as rarity, they should just not display rarity.
- [x] Equip and Attune buttons are not intuitive, maybe better icons or add text next to them

### Spells
- [x] add spells button isn't working
- [x] spell save DC isn't calculated and spellcasting ability isn't displayed
- [x] number of spell slots isn't calculated and isn't displayed
- [x] Warlocks with Pact Magic don't have their spell slots calculated/displayed correctly
- [x] Warlock can't pick leveled spells
- [x] Amount of spells known isn't calculated/displayed/enforced
- [x] Amount of prepared spells isn't calculated/displayed/enforced
- [x] Warlocks can't cast spells with slots, says no spell slots available
- [x] warlock spell slots not recharging on short rest or long rest

### Combat
- [x] can't delete or edit attacks once created
- [x] weapon attacks don't have relevant properties, msteries, and weapon abilities (magical weapon stuff) displayed
- [x] Spells are not integrated into combat (no spell attacks, spell save DCs, spell effects, etc)
- [x] natural weapons features (like claws, bite, etc) not added to attacks automatically


### Character Builder
- [x] Selecting items not working correctly and not needed since items can be added later in inventory.
- [x] 2024 classes don't have starting equipment options displayed at the choice, e.g efa articificer gives them to you but does not show them in the builder
- [x] Character age, height, and weight inputs should only accept numbers
- [x] Background tool proficiencies override existing proficiencies instead of adding to them
- [x] races with subraces don't show subrace selection in the builder, and subcraces appear as different races
- [x] some backgrounds don't show tool proficiencies selection in the builder, or tool proficiencies that are broken
- [x] When assigning ability scores, the system allows going over the maximum allowed points with race bonuses applied afterwards (fixed: capped manual entry base score to 18, the max before racial bonuses)
- [x] when assigning ability scores, using standard array does not remove the placeholders for unassigned scores, creating some confusion (fixed: summary now shows "—" for unassigned scores with message, and validation requires all scores to be assigned)


### Features
- [x] class features not being added correctly from the builder, e.g warlock's eldritch invocations
- [x] feature display should be drop down and link, currently class features are only links.
- [x] race features are all called the race name instead of their actual names, e.g darkvision is called "Dwarf" for dwarves
- [x] some classes (bard) add their features twice for some reason (fixed: added deduplication in addFeature)
- [x] Jack of all trades feature does not add half proficiency to all skills correctly (fixed: added hasJackOfAllTrades() check in getSkillMod and getInitiative)
- [x] classes with expertise feature don't get to choose their expertise skills during builder (fixed: added expertise selection UI for Rogue at level 1, shows after skill selection)
- [x] weapon masteries choices not given during builder for classes that get them (fixed: added weapon mastery selection UI for Fighter, Paladin, Ranger, Rogue with proper count from class tables)
- [x] specialties and combat methods (treaveler's guide to thelemar) not selectable during builder or level up for classes that get them (bard, rogue, etc). SHould be a general fix for similar features that require choice, weather they are OptionalFeature type or classFeature/subclassFeature type.
- [x] exertion pool (thelemar homebrew) not recovered on long rest or short rest and doesn't appear in resources section (fixed: exertion now appears in tracked resources section with clickable pips, recovers on short/long rest)
- [x] combat traditions and methods not selectable during level up (fixed: if no traditions set, level-up now allows selecting traditions before methods; methods filtered by known traditions and max degree)


### Overview
- [x] attacks and spells should also appear at the overview page for quick access (enhanced with Combat stats, spell stats, range, properties)
- [x] Active features aren't displayed correctly, and should include only important features and not all of them (fixed: now shows important features grouped by type with proper names)
- [x] Jump distance isn't displayed (added Long Jump and High Jump based on Strength)
- [x] Senses aren't Displayed (added Senses section showing Darkvision, etc.)
- [x] Passive stats that aren't perception are not calculated or displayed (added Passive Investigation and Passive Insight)
- [x] proficiency or expertise in skills not displayed in a clear way (improved visual indicators with half/prof/expert legend)
- [x] exhaustion level not displayed or tracked (added dedicated exhaustion tracker with +/- controls and effect display)
- [x] exhaustion affects dice rolls (2024 rules: -2 per level to all d20 tests, 2014 rules also supported)
- [x] exhaustion affects speed (2024: -5 ft per level, 2014: halved at level 2, 0 at level 5)
- [x] exhaustion removed on long rest (1 level per long rest)
- [x] support for both 2024 and 2014 exhaustion rules (toggle in exhaustion section)
- [x] active features not correct or clear, display only some random features and race features have only race name (fixed in Active Features section)
- [x] spell slots not displayed in overview (added compact spell slot display with "Spell Slots:" label)
- [x] spell casting time not shown in overview (added casting time to quick spells)
- [x] weapons/spells in overview not hoverable (added hover links for items and spells)
- [x] carry weight only in inventory (added Carry and Push/Drag/Lift to overview)
- [x] resources section doesn't update when features that add resources are added/removed (e.g adding/removing a feature that gives a resource doesn't update the resources display until page refresh)
- [x] resources don't have a use button and don't recover on rests
- [x] not all resources from features are added to resources section automatically (some features that give resources are not detected and added)
- [x] sneak attack die, save DCs for non spell related features (combat methods, monk ki features, etc) not calculated/displayed



### Level Up
- [x] when a choice feature (like metamagic, invocations, maneuvers) comes up during level up, there is no way to select the options (added selection UI with validation)
- [x] when reaching an ASI level, the feature ASI is added to the sheet regardless of the choice that was made (ASI choices now recorded as a feature showing which stats were increased)
- [x] optional features not hoverable (fixed featureType to "Optional Feature" for proper hover linking)
- [x] optional features not grouped together (now grouped by type with headers like "Eldritch Invocations", "Metamagic Options")
- [x] progression of optional features not calculated correctly (now counts existing features of that type)
- [x] duplicate features like "Metamagic" appearing multiple times (now filters out features already on character)
- [x] subclass and subclass features no longer appear in feature tab after being selected (fixed duplicate filter to only apply to non-subclass features)
- [x] when choosing features on level up features already known should be disabled in the selection list unless they can be taken multiple times (now shows "Known" badge and disabled, with "Repeatable" badge for re-selectable options)

### General
 - [x] skills, conditions and many other things are hard coded instead of being retrieved from the site, which would prevent homebrew from affecting the sheet
 - [x] no ability to filter the sources used in the sheet (e.g only use PHB and TCoE)



[X] Dual MInd ability of Kalashtar and Nyuidj becomes a simple +1 to the save in the modifiers instead of advantage, and doesn't seem to be applied
[X] Modifier options does not seem to include all the new functionalities from the custom abilities
[X] Stances from combat methods don't seem to apply correctly and have an active modifier before they are activated. Wary stance for example adds proficiency bonus +3 to roll, instead of proficiency bonus, and +3 to passive. 
[X] Text is way too small and multiple players complained, this is an accesebility issue that should be fixed as soon as possible.
[X] Combat Methods are not bunched together under the same tradition
[X] Ranger Primal Focus supports activation (though using it from abilities and not ctive states does nothing), but not switching between states.
[X] Wizard subclasses from TGTT don't seem to be added upon choice, might extend to other wixard classes as well, but haven't been tested yet.
[X] Children of the empire can't choose cantrip like they are supposed to in the builder.

[x] Some races (Tortle for example) have traits that aren't implemented in calculations (e.g. Shell Defense). These should be added to `getFeatureCalculations()` and tested.
  - FIXED: Added ~30 official race trait registrations to `FeatureEffectRegistry._registerRaceFeatures()` covering Tortle (Natural Armor AC=17, Shell Defense +4 AC toggle, Claws), Lizardfolk (Natural Armor AC=13+DEX, Bite), Half-Orc (Relentless Endurance, Savage Attacks extra crit die), Goblin (Fury of the Small damage=proficiency, Nimble Escape), Bugbear (Surprise Attack +2d6, Long-Limbed +5 reach), Dragonborn (official Breath Weapon DC/damage scaling for PHB and XPHB editions), Warforged (Integrated Protection +1 AC), Autognome/Thri-kreen (AC=13+DEX), Loxodon (AC=12+CON), Tabaxi (Claws), Shifter, and more. Added scaling calculations in `getFeatureCalculations()` for Tortle, Lizardfolk, Goblin, Bugbear, and official Dragonborn Breath Weapon (both PHB 2d6 and XPHB 1d10 progressions).
[x] Some races (Tortle for example) get a +1 +1 as their racial ASI, but it should be at min +2 +1. 
  - FIXED: TGTT Tortle correctly inherits +2/+1 from TTP copy. The actual offender was the Nyuidj race whose `choose` block used `{count: 2, amount: 1}` (two +1s). Changed to `{weighted: {from: [...], weights: [2, 1]}}` for proper +2/+1.
  [x] classes that have starting amount of spells don't have a time to choose the spells during character creation, and so when doing a quickbuild it appears as if they have less spells to choose then they should. This should be fixed by adding a step in the character creation process to choose the starting spells for classes that have them, but if quickubild is detected, the step should be skipped and the amount of spells needed should be added to the amount of spells the quickbuild will say that needs to be chosen. 
  - FIXED: Added Step 6 "Spells" to the builder between Equipment and Details (bumped to 7 steps). `_getKnownCasterInfoForBuilder()` detects known-spell casters (Sorcerer, Bard, Warlock 2014) at level 1 via `getKnownSpellsAtLevel`. `_renderSpellsStep()` shows full spell picker with class filtering and Divine Soul support. Non-spellcasters see an informational skip message. Validation enforces spell/cantrip counts. Apply adds spells to state.
[x] Divine soul sorcerer doesn't have the option to choose cleric spells as sorcerer spells, and so they don't get the correct amount of spells to choose from. This should be fixed by adding an option for divine soul sorcerers to choose cleric spells as sorcerer spells, and adjusting the amount of spells they need to choose accordingly.
  - FIXED: Added `additionalClassNames` parameter to `CharacterSheetSpellPicker.renderKnownSpellPicker()`. When subclass is "Divine Soul", passes `["Cleric"]` as additional class names. The spell filter now checks both the primary class list and additional lists. Applied in all three call sites: levelup.js, quickbuild.js, and builder.js.
[x] Warlock needs to choose horror invocations even when not using the horror subclass. This should be fixed by only giving the option to choose horror invocations when the horror subclass is selected.
  - FIXED: Added `prereq.pact` filtering in both `_renderStandardOptionalFeatures` (builder) and `_renderStandardOptionalFeaturesLevelUp` (levelup). Invocations requiring e.g. "Pact of Transformation" now only appear when the character has that pact.
[x] Magical cunning feature has a broken link.
  - FIXED: Added official source fallback lookup in charactersheet-features.js. When a feature's stored source is homebrew but it matches an official feature, the hover link now resolves to the correct official source.
[x] When leveling up a warlock regularly, there is a bug that doesn't allow me to choose new invocations because the modal is bunched up and not showing the invocations.
  - FIXED: Changed invocation modal `max-height` from `250px` to `60vh` in charactersheet-levelup.js.
[x] eldritch blast beams don't scale correctly, should be by general level and not class specific level.
  - FIXED: Changed beam calculation in charactersheet-state.js to use `this.getTotalLevel()` instead of `cls.level`. Added 6 regression tests in CharacterSheetBugFixes.test.js.
[x] When multiclassing sorcerer/warlock it doesn't give option for warlock spells to choose, only sorcerer. 
  - FIXED: Added prepared-caster detection (`isPreparedCaster`) alongside known-caster detection in both levelup.js and quickbuild.js. XPHB Warlock (which has `preparedSpellsProgression` instead of `spellsKnownProgression`) now gets its own spell picker section (8c) using the same `renderKnownSpellPicker` UI. Calculated gains are stored as `prepared: true` spells. Added full prepared-caster support in quickbuild including aggregation, rendering, validation, and apply steps.
[x] XPHB Warlock builder shows duplicate invocation counters. The `optionalfeatureProgression` and `classFeatures` "Eldritch Invocation Options" both render counters — first shows 1/1 after selection but second stays 0/1, causing validation failure.
  - FIXED: Added `_isOptionGroupCoveredByOptFeatProgression()` helper that detects when a classFeature option group's entries are all `type: "optionalfeature"` AND their featureTypes overlap with `optionalfeatureProgression`. Used it to filter duplicate groups in both `_renderClassFeatureOptions` and `_getFeatureOptionsAtLevel`.