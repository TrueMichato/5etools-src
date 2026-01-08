# Bugs Tracking
This file is used to track known bugs in the 5etools character sheet code.

## Feature Requests

### General
- [x] need way to roll things with advantage/disadvantage from the sheet (fixed: Shift+click for advantage, Ctrl/Cmd+click for disadvantage)
- [x] need to support rolling skills with different ability scores (fixed: right-click on skill to choose alternate ability)
- [x] need to support adding custom skills to sheet (fixed: "Add Custom Skill" button in skills section)
- [x] need to support adding features, languages, proficiencies, etc manually to sheet (fixed: pencil icon on Proficiencies section, + button on Custom Features section in Features tab)
- [] need to support adding custom modifiers to rolls, skills, abilities, hit, damage etc (circumstance, item, etc)
- [] need to support toggling proficiency/expertise/half proficiency on skills manually
- [] need to improve UI greatly, currently very basic and not user friendly
- [] need to support mobile devices better (bigger buttons, less clicks, altternative ways to do things that require hover or shift/ctrl keys)


## Known Bugs

### Character Builder
- [x] races with subraces don't show subrace selection in the builder, and subcraces appear as different races
- [x] some backgrounds don't show tool proficiencies selection in the builder, or tool proficiencies that are broken

### Features
- [x] some classes (bard) add their features twice for some reason (fixed: added deduplication in addFeature)
- [x] Jack of all trades feature does not add half proficiency to all skills correctly (fixed: added hasJackOfAllTrades() check in getSkillMod and getInitiative)

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

### Character Builder
- [x] Selecting items not working correctly and not needed since items can be added later in inventory.
- [x] 2024 classes don't have starting equipment options displayed at the choice, e.g efa articificer gives them to you but does not show them in the builder
- [x] Character age, height, and weight inputs should only accept numbers
- [x] Background tool proficiencies override existing proficiencies instead of adding to them

### Features
- [x] class features not being added correctly from the builder, e.g warlock's eldritch invocations
- [x] feature display should be drop down and link, currently class features are only links.
- [x] race features are all called the race name instead of their actual names, e.g darkvision is called "Dwarf" for dwarves

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