# Bugs Tracking
This file is used to track known bugs in the 5etools character sheet code.

## Known Bugs

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
- [] Selecting items not working correctly and not needed since items can be added later in inventory.
- [x] 2024 classes don't have starting equipment options displayed at the choice, e.g efa articificer gives them to you but does not show them in the builder
- [x] Character age, height, and weight inputs should only accept numbers
- [x] Background tool proficiencies override existing proficiencies instead of adding to them

### Features
- [] class features not being added correctly from the builder, e.g warlock's eldritch invocations
- [] feature display should be drop down and link, currently class features are only links.
- [] race features are all called the race name instead of their actual names, e.g darkvision is called "Dwarf" for dwarves

### Overview
- [] attacks and spells should also appear at the overview page for quick access
- [] Active features aren't displayed correctly, and should include only important features and not all of them
- [] Jump distance isn't displayed
- [] Senses aren't Displayed
- [] Passive stats that aren't perception are not calculated or displayed (e.g passive investigation, passive insight, etc)
- [] proficiency or expertise in skills not displayed in a clear way
- [] exhaustion level not displayed or tracked, exhaustion is just a regular condition currently


### Level Up
- [] when a choice feature (like metamagic, invocations, maneuvers) comes up during level up, there is no way to select the options
- [] when reaching an ASI level, the feature ASI is added to the sheet regardless of the choice that was made. It makes sense as it is actually the level 4 feature, but it is confusing.

### General
 - [] skills, conditions and many other things are hard coded instead of being retrieved from the site, which would prevent homebrew from affecting the sheet
 - [] no ability to filter the sources used in the sheet (e.g only use PHB and TCoE)