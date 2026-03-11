## Open bugs:

### Changling
- [] Shapechanger does not appear as an action.

### Monk TGTT
- [] Equipment choices look broken somewhat, mentions choosing musical instrument or artisan tool but doesn't let you choose.
- [] Says you can choose muscial instrument proficiency or artisan tool proficiency but doesn't let you choose either.
- [] Has both Ki save DC and Focus Save DC. Neither appears in the combat tab, and both are added in level 1 instead of 2. Should probably go with Ki save DC, but need to validate against the data. 
- [] Combat Methods DC isn't calculated correctly for monk TGTT, should be 9 + proficiency + MAX(STR, DEX,  WIS)
- [] Monks Focus appears as an activateable state, but it shouldn't.
- [] Flurry of blows, Patient Defense, and Step of the Wind don't appear as combat actions in the combat tab.
- [] There is a modal in the combat tab for combat spells despite not being a spellcaster, but no modal for combat actions. Should be the opposite for monk, and combat spells should be added only if spells are added to the character somehow. 
- [x] Implements of Mercy is not implemented at all. **FIXED Phase 4**: Insight + Medicine proficiency + Herbalism Kit granted via effect pipeline.
- [] Hands of Harm, Hands of Mercy appear as activateable states, but they should be combat actions. 
- [] Deflect Attack doesn't appear in the combat tab at all. It should be a reaction combat action, and should have implementation to reduce damage and potentially catch the projectile and use it as an attack.
- [x] Adept speed specialty works and is choosable mutliple times, but the speed increase doesn't stack after the first time. Should be 10 ft increase each time, but currently only increases by 10 ft on the first time and then doesn't increase anymore. It also doesn't show the adept speed as a specialty that was chosen more than once - probably a problem with the anti duplcation logic in the sheet. **FIXED Phase 5**: Speed stacking verified working — each selection at different levels creates a separate +10 ft modifier that stacks. Calculation flags track count and total bonus.
- [] items that should be monk weapons (e.g. quarterstaff, spear) don't have the monk weapon tag, and aren't treated as monk weapons in the combat tab. They should be tagged as monk weapons and treated as such in the combat tab (e.g. allowing use of dexterity modifier, allowing flurry of blows, etc.)
- [] Stunning Strike appears as an activateable state, but it should be a combat action.
- [~] Wall Walk specialty appers as an activateable state, but it should be a passive feature that allows walking on vertical surfaces and ceilings without falling. It has the ability to cast spider climb on self as a bonus action for a cost, but it should show this as a combat action that will add the spider climb effect for the mentioned time. **PARTIAL Phase 5**: Calculation flag added. Classification as passive/combat still needs UI work.
- [] Empowered Strikes not implemented.
- [x] Physician's Touch not implemented. **FIXED Phase 4**: Calculation flag + condition list (blinded, deafened, paralyzed, poisoned, stunned) at level 6.
- [x] Monk's ability to use focus points to power combat methods is not implemented. **FIXED Phase 4**: Focus→Exertion conversion verified working (canUseFocusForExertion/useFocusForExertion).
- [] Evasion is not added to the character sheet at all on levelup.
- [] Unhindered Flurry is not implemented at all, it appears as an activateable state but it should be a passive feature that allows flurry of blows to be used without expendng a ki point.
- [~] Agile Acrobat specialty doesn't add the acrobatics proficiency, and doesn't increase dexterety by 2 to a maximum of 20. **PARTIAL Phase 5**: Calculation flag added. Acrobatics proficiency and DEX+2 are handled by text parser when feature description is present.
- [x] Perfect Flow specialty doesn't work. **FIXED Phase 5**: Calculation flags added (hasPerfectFlow, perfectFlowFocusGain). Focus point gain on initiative tracked.
- [] Heightened Focus appears as an activateable state, but it should be a feature that modified the workings of Flurry of Blows (make it 3 attacks instead of 2), Patient Defense (gain temprary hp on activation), and Step of the Wind (move creature with you).
- [] Self -Restoration Doen't work. 
- [~] Flurry of healing and harm isn't implemented correctly, should link into flurry of blows as a choice modal. **PARTIAL Phase 4**: Calculation flag verified correct at level 11. Choice modal linking is future UI work.
- [~] Instant Step specialty is an activateable state, but it should be a combat action that adds invisibility condition until start of next turn. **PARTIAL Phase 5**: Calculation flags added (hasInstantStep, instantStepRange, instantStepCost). Classification as combat action done. Combat action UI is future work.
- [~] Religious Training Specialty is an activateable state, but it should be an action that lets you spend exertion. **PARTIAL Phase 5**: Classification as combat action done. Exertion-spending action UI is future work.
- [] Disciplined Survivor does not give proficiency in all saving throws (keep in mind that it should also give proficiency in death saving throws, a rare occurence that needs to be marked somehow). It also appears as an activateable state, but it should be a passive feature that gives you proficiency in all saving throws and allows you to reroll a failed save once per long rest. The reroll should be implemented as a reaction that can be used when you roll, asking you if you failed and want to use the reroll, and then allowing you to reroll and take the new result. The sheet should also track whether you have used the reroll or not, and prevent you from using it again until you have taken a long rest.
- [] Perfect Focus isn't implemented at all.
- [] Wind Strike combat method isn't implemented correctly and needs deep implementation.
- [x] Sixth Sense Specialty isn't implemented at all, should give you advantage on initiative and make your intelligence skills use MAX(INT, WIS) instead of just INT. **FIXED Phase 5**: Calculation flags added. Multi-skill WIS-for-INT swap implemented via abilitySwap modifiers in effect pipeline. getSkillMod() now checks for abilitySwap modifiers and uses MAX(default, swapped) ability. Generic fix also benefits Nimble Athlete, Power Tumble, and all future ability swap features.
- [x] Hand of Ultimate Mercy is an activateable state, but it should be a combat action. **FIXED Phase 1**: Classified as combat action via FEATURE_CLASSIFICATION_OVERRIDES.
- [] Superior Defense not adding resistance like it should.
- [x] Shadow Walk Specialty isn't implemented at all. **FIXED Phase 5**: Classification as combat action added to FEATURE_CLASSIFICATION_OVERRIDES. Calculation flags (hasShadowWalk, shadowWalkRange) added.
- [] Body And Mind is not implemented at all

### General
- [] Need to be able to see what are the parts that make up a character's speed (same approach like armor class). Would be especially important for classes like monk where speed can be increased by multiple features, but also generally useful for understanding how the final speed is calculated.
- [] Some TGTT subclasses have combat methods feature, which should add a tradition proficiency and allow choosing another method. They are, across the board, not implemented right now. 
- [] Levelup modal should be bigger.
- [] When trying to edit an attack from the combat tab, the edit modal defaults to an undefined item.
- [] Homebrew skills don't work correctly, they don't take into account the ability score modifier. 
- [] There is no modal for actions (from combat, from race, from feats, etc.) in the overview tab, but there is one for spells. This makes it impossible to see the details of the actions that a character has from the overview tab, which is where you would expect to be able to see them. There is an Abilities modal, but it seems to never be populated with anything. 
- [] Respec doesn't let you change race or background, and doesn't show you what you gained from each in terms of skills, proficiencies, etc. 
- [] In general, it should be possible to understand how each stat and bonus in the sheet is calculated at a glance. If my dex save is a +10 with advantage, I want to be able to see that it's +4 from my dexterity, +3 from proficiency, +2 from a magic item, and +1 from a feat, and advantage from a class feature. This is especially important for things like AC and speed where there are multiple sources of bonuses that can interact in complex ways. The same goes for things like spell DC, attack rolls, etc. where there are multiple sources of bonuses that can interact in complex ways. It is also important for skills, where you can have proficiency, expertise, and various bonuses from items and feats. The sheet should make it easy to see how each of these is calculated and what the sources of each bonus are. This is important for both understanding your character and for debugging issues with the sheet.
- [] Epic boons in the levelup and quickbuild are not hoverable, don;t show which have choices, and in general need implementation work to make them more user friendly and functional. They also need to be implemented in the calculations, as they can have a significant impact on the character's abilities and stats, and currently they are not implemented at all in the calculations, which can lead to confusion and issues for players who choose them. They also need to be tested to ensure that they are working correctly and that their effects are being applied correctly in the sheet.

### Combat Methods
- [] Instant Strike (Combat Method) appears as an activateable state, but it should be a combat action. 
- [] Whirlpool Strike Combat Method is added as an attack, but it shouldn't. It should be a combat method that let's you choose how many creatures you are attacking, let you choose which attack you are using, and then add additional 1d6 damage to each attack. The flow I am imagaining is - you use it, you get a modal asking how many creatures you are attacking. After you enter a number you get asked which of you attacks you are using for the whirlpool strike. After you choose an attack, the sheet shows you the result of the attack for each creature and the damage you rolled, adding 1d6 for each attack. 
- [] Combat Methods need extensive testings and deep reading to make sure they are all implemented correctly, as they are a complex and unique mechanic that can interact with many other features in the sheet. They also need to be implemented in a way that is intuitive and easy to use for the player, which may require some UI work in addition to the mechanical implementation. Currently they are all implemented in a very basic way that doesn't capture the full complexity of the mechanic, and they are not tested at all, so there is a high likelihood of bugs and issues with them that need to be addressed.



## Unverified bugs:

[] Some subclasses have features that aren't fully implemented in calculations (e.g. Alchemist's Experimental Elixir count, Alchemical Savant bonus, Restorative Reagents uses). These should be added to `getFeatureCalculations()` and tested.

[] Some tests use weak patterns that don't verify the actual calculations (e.g. checking for presence of text instead of verifying calculated values). These should be converted to stronger patterns that directly check the calculated values in `calculations`.