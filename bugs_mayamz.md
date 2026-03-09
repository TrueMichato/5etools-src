# Bugs Tracking
This file is used to track known bugs in the 5etools character sheet code.

### Lunaria (Ranger 6/Druid 3) test
- [X] In the active features modal in the overview tab, the "+X more class/species features" is not interactable, should be openable on click to show the full list of features.
- [] Spells known I believe are problematic in multiclass? says I have only 4.
  - [X] "Your class does not require spell selection at level 1". False. Seems to be based on 2014 ranger, but TGTT ranger has spell selection at level 1.
  - [] Spell lists of TGTT classes is not quite there yet I believe.
- [X] Combat stances don't add skill bonuses when activated.
- [X] In managing combat methods - add works. Remove doesn't.
- [X] In managing combat methods  - remove works in managing combat, but not in the build section. In quickbuild the problem is avoidable.
- [X] Custom background - option for which musical instrument. One of the tools is "Musical instrument". This works for regular backgrounds but not for custom ones. 
- [X] Plantmender feat doesn't add the required cantrips etc.

### Rogue test
- [X] In the top top part - "+" deletes the current build and doesn't change the rolling options, duplicate saves adds a new character to the rolling options. In general several players have reported saving issues, which is a major problem. I have not been able to reproduce this, but I have seen the "+" button delete the current build and reset the rolling options to the default ones. This is a major issue that needs to be fixed as soon as possible.
  - Fixed: Added beforeunload/pagehide handlers to save on page exit, save-before-switch on dropdown change, save-before-new on "+" click, save-before-duplicate.
- [X] Build order needs to change - Background should be before class, since background can give proficiency in skills that the class can then choose to double down on with expertise.
  - Fixed: Reordered builder steps to Species → Background → Class → Abilities. Expertise selection now includes background and racial skills.
- [x] In add item, details are on click and not by hover. Which is inconvenient for browsing. **FIXED:** Item names in Add Item modal now use hover-enabled links via `CharacterSheetPage.getHoverLink()`. Hover shows full item details; click still works as a11y fallback.
- [X] The specialties "Extra skill training" and "Extra expertise training" don't really let you choose a skill.
- [x] Boon of skill doesn't work correctly in quick build or level up. **FIXED:** Fixed expertise dropdown to include fixed skill proficiencies from feat data (e.g., Boon of Skill's 18 skills). Also fixed `getSkillProficiencies()` usage to properly convert object to array keys.
  - [x] It also doesn't let you choose a new expertise. Only the +1 ability. **FIXED:** Expertise dropdown now includes all proficient skills including fixed ones from the feat.
  - [x] Also it doesn't seem to give you proficiency in all skills. **VERIFIED:** Skills were always being applied correctly via `applyFeatBonuses()` — the issue was that users couldn't verify due to blocked expertise selection.
- [x] Quick build of specialties doesn't mark what you've chosen as known like from previous levels, but vanishes the chosen option. **FIXED:** Changed from silently hiding options to marking them with "✓ Level X" badge (warning color). Options chosen at other levels now show disabled with opacity and level indicator instead of vanishing.
- [X] Reliable talent Adds 10 to ABLMOD, but it should set the minimum roll to 10. 
- [x] feats that add ability score increases don't take into account previous increases from race, other feats, or ASIs, especially in the same quickbuild instance but not only. **FIXED:** Changed feat ability display from `getAbilityBase()` (raw 10) to use `runningScores` which includes racial bonuses + pending ASI choices from earlier levels in the same QuickBuild session.

#### Belly Dancer
- [] "The Belly Dancer" as opposed to "Gambler", "Assassin" etc. Data bug, ignore.
- [x] Doesn't grant expertise in performance. **FIXED:** Enhanced `parseExpertiseEntries()` in ClassUtils to detect fixed skill expertise (e.g., "expertise in the Performance skill"). QuickBuild and LevelUp now auto-apply these fixed expertises without requiring user selection.
- [x] Dancing state **FIXED:** Added `dancing` to `ACTIVE_STATE_TYPES` with AC bonus (CHA mod) and Athletics advantage effects. Added detection patterns for "Dance of the Country". Snake Charmer modifier now checks `isStateActive("dancing")` to enable/disable dynamically.
  - [x] Using "Dance of the country" ability in combat tab doesn't activate the state or the modifier. **FIXED** 
  - [x] Activation of the state in states does not change the "Snake charmer" modifier. **FIXED**
  - [x] I always get advantage on athletics, even when I turn off both state and modifier. **FIXED**
  - [x] "Snake charmer" modifier doesn't ignore advantage in sneak attacks. **FIXED** (advantage properly gated to dancing state)
- [x] Tantalizing shivers doesn't show as a bonus action even when all states/modifiers are on. **FIXED:** Added "tantalizing shivers" to `combatKeywords` array in combat tab filter. Feature now appears in combat actions section.

#### Gambler
- [] Mastery for cards dice? Coins has ricochet. Data, ignore for now.
- [] Spellcasting is not functional. I don't even get cantrips. Needs extensive implementations since its so unique in mechanics - need to implement the number of prepared spells being 2d4 after long rest, the spellcasting bonus being rolled, etc. 
- [] "Gambler's folly" is a state, but needs to be a constant effect (similar to wild magic), that takes into account the way the ability works. 
  - [x] Negative initiative modifier because of gambler's folly, which shouldn't happen. It has nothing to do with this. FIXED: FeatureModifierParser now strips table content before parsing - the "-2 initiative" was from Gambling Table d100 outcomes, not a permanent effect. 
- [x] No gambler weapons as weapons. Need to inject them as custom weapons with the correct properties and scaling. FIXED: Added GAMBLER_WEAPONS constant and _injectGamblerWeapons() method. Gambler's Coins (1d4 piercing), Dice (1d6 bludgeoning), and Cards (1d8 slashing) are auto-injected to inventory when Gambler reaches L3. All have Finesse/Thrown, Cards also Light. Deduplication by _isGamblerWeapon marker. 


### Nice to have - Ignore for now.
- [] Specialties don't show which ones you already have. 
- [] Why do I have a channel divinity DC? It's from Druid.

### Done
- [X] Are we not with Tasha's concept of choosing the Race ASI? Maybe I have forgotten.
- [X] Custom background (sadly Lunaria is a custom)
- [X] In specialties choices in builder it's not quite clear which box is for which feature. Spacing a bit off.
- [X] In Abilitied in builder - the placeholder 10 are returned to the score list.
- [X] rangers give favoured enemy even on rangers without it like TGTT - maybe because they're optional features?
- [X] Stances are still with a white background for some reason.
- [X] Combat methods does not support Refresh and Replace.
- [X] Might want to enable filtering spells by class lists. - **Amazing implementation may I add**
- [X] advantage/disadvantage hotkeys doesn't work in the abilities tab.
- [X] Can the sheet be moved or shared to another comupter? Only through import/export?
- [X] Customizeable background color
- [X] Level 3 does not provide both ASI and feat.
- [X] Language chooser does not give the homebrew languages.
- [X] Ranger still lets you choose 2 expertise (now with two languages)
- [X] Add feats manually (for IP for example).
