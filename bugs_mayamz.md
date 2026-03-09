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
- [] In the top top part - "+" deletes the current build and doesn't change the rolling options, duplicate saves adds a new character to the rolling options. In general several players have reported saving issues, which is a major problem. I have not been able to reproduce this, but I have seen the "+" button delete the current build and reset the rolling options to the default ones. This is a major issue that needs to be fixed as soon as possible.
- [] Build order needs to change - Background should be before class, since background can gve proficiency in skills that the class can then choose to double down on with expertise.
- [] In add item, details are on click and not by hover. Which is inconvenient for browsing.
- [] The specialties "Extra skill training" and "Extra expertise training" don't really let you choose a skill.
- [] Boon of skill doesn't work correctly in quick build.
  - [] It also doesn't let you choose a new expertise. Only the +1 ability.
  - [] Also it doesn't seem to give you proficiency in all skills.
- [] Quick build of specialties doesn't mark what you've chosen as known like from previous levels, but vanishes the chosen option.
- [] Reliable talent Adds 10 to ABLMOD, but it should set the minimum roll to 10. 

#### Belly Dancer
- [] "The Belly Dancer" as opposed to "Gambler", "Assassin" etc.
- [] Doesn't grant expertise in performance.
- [] Dancing state
  - [] Using "Dance of the country" ability in combat tab doesn't activate the state or the modifier.
  - [] Activation of the state in states does not change the "Snake charmer" modifier.
  - [] I always get advantage on athletics, even when I turn off both state and modifier.
  - [] "Snake charmer" modifier doesn't ignore advantage in sneak attacks.
- [] Tantalizing shivers doesn't show as a bonus action even when all states/modifiers are on.

#### Gambler
- [] Mastery for cards dice? Coins has ricochet.
- [] Spellcasting is not functional. I don't even get cantrips. Needs extensive implementations since its so unique in mechanics.
- [] "Gambler's folly" is a state. Not a mechanism
  - [] Negative initiative modifier because of gambler's folly.
- [] No gambler weapons as weapons.


### Nice to have
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
