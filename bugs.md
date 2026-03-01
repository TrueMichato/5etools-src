Open bugs:

[x] Sorcerer doesn't give choice of starting items, but it should. It seems there is some confusion on what type of the data to access.
  - FIXED: Implemented full equipment type picker for `equipmentType` items in the builder. Added `_getItemsForEquipmentType()` with match functions for all 12 equipment types (simple/martial melee/ranged weapons, arcane/holy/druidic focuses, etc.), `_renderEquipmentTypePickers()` for dropdown UI, and `_addEquipmentItems()` resolution logic. Equipment type pickers now render for both radio-choice and fixed-row equipment, with XPHB-preferred deduplication.
  [] new bug that stems from it - the items that pop up in the dropdown are also magical items and variants of base items, which is not the desired outcome. 
[] Backgrounds that give proficiency in musical instrument do not let you choose which one, and don't add it to the character sheet. This should be fixed by allowing the user to select the instrument and adding it to the proficiencies.
  - Fix Attempt that still didn't work, layers still don't get prompted to choose actual items: Added `anyMusicalInstrument` handling in `_renderBackgroundToolProficiencies` mirroring the existing `anyArtisansTool` pattern. Renders dropdown with `Renderer.generic.FEATURE__TOOLS_MUSICAL_INSTRUMENTS`, stores selection with `isMusicalInstrument: true` flag, and excludes from fixed tool proficiency apply.
[] Tasha race options are allowing ability score increase change, but not skill proficiency and language change. 
[] when clicking multiclass in the quickbuild, the modal appears behind the quickbuild modal, making it impossible to select the class you want to multiclass into. This is a z-index issue that should be fixed by increasing the z-index of the multiclass modal.
[] When choosing TGTT sorcerer, you get a subclass choice both at 3rd level and at 6th level, but only the 3rd level one should be there.
[] When adding ASI in both level up and quick build, the racial bonus is not applied to the ability scores displayed. Also, the ability text intersects with the ability numbers, which is a UI bug. 

Unverified bugs:

[] Some subclasses have features that aren't fully implemented in calculations (e.g. Alchemist's Experimental Elixir count, Alchemical Savant bonus, Restorative Reagents uses). These should be added to `getFeatureCalculations()` and tested.

[] Some tests use weak patterns that don't verify the actual calculations (e.g. checking for presence of text instead of verifying calculated values). These should be converted to stronger patterns that directly check the calculated values in `calculations`.