# CharacterSheetLevelUp → ClassUtils/SpellPicker Refactor Map

## Summary

File: `js/charactersheet/charactersheet-levelup.js` (5581 lines)
Target utilities:
- `CharacterSheetClassUtils` → `js/charactersheet/charactersheet-class-utils.js`
- `CharacterSheetSpellPicker` → `js/charactersheet/charactersheet-spell-picker.js`

---

## CATEGORY 1: Feature Data Extraction (L19–L175)

### 1.1 `_findFeatureOptions`
- **Lines:** 19–128
- **Replacement:** `CharacterSheetClassUtils.findFeatureOptions(feature, characterLevel, classFeatures)`
  - Note: the static version takes `classFeatures` as 3rd arg instead of calling `this._page.getClassFeatures()` internally
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 103 | `this._findFeatureOptions(referencedFeature, characterLevel)` | `CharacterSheetClassUtils.findFeatureOptions(referencedFeature, characterLevel, this._page.getClassFeatures())` |
  | 157 | `this._findFeatureOptions(feature, level)` | `CharacterSheetClassUtils.findFeatureOptions(feature, level, this._page.getClassFeatures())` |

### 1.2 `_getClassFeatureByRef`
- **Lines:** 131–149
- **Replacement:** `CharacterSheetClassUtils.getClassFeatureByRef(classFeatures, featureName, className, source, level)`
  - Note: static version takes `classFeatures` array as 1st arg
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 100 | `this._getClassFeatureByRef(refFeatureName, refClassName, refSource, refLevel)` | `CharacterSheetClassUtils.getClassFeatureByRef(this._page.getClassFeatures(), refFeatureName, refClassName, refSource, refLevel)` |

### 1.3 `_getFeatureOptionsForLevel`
- **Lines:** 153–175
- **Replacement:** `CharacterSheetClassUtils.getFeatureOptionsForLevel(features, level, classFeatures)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 498 | `this._getFeatureOptionsForLevel(currentFeatures, newLevel)` | `CharacterSheetClassUtils.getFeatureOptionsForLevel(currentFeatures, newLevel, this._page.getClassFeatures())` |
  | 736 | `this._getFeatureOptionsForLevel(currentFeatures, newLevel)` | `CharacterSheetClassUtils.getFeatureOptionsForLevel(currentFeatures, newLevel, this._page.getClassFeatures())` |
  | 5248 | `this._getFeatureOptionsForLevel(features, 1)` | `CharacterSheetClassUtils.getFeatureOptionsForLevel(features, 1, this._page.getClassFeatures())` |

---

## CATEGORY 2: Expertise Helpers (L177–L292)

### 2.1 `_getExpertiseGrantsForLevel`
- **Lines:** 177–192
- **Replacement:** `CharacterSheetClassUtils.getExpertiseGrantsForLevel(features)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 487 | `this._getExpertiseGrantsForLevel(currentFeatures)` | `CharacterSheetClassUtils.getExpertiseGrantsForLevel(currentFeatures)` |
  | 737 | `this._getExpertiseGrantsForLevel(currentFeatures)` | `CharacterSheetClassUtils.getExpertiseGrantsForLevel(currentFeatures)` |

### 2.2 `_findExpertiseInFeature`
- **Lines:** 198–208
- **Replacement:** `CharacterSheetClassUtils.findExpertiseInFeature(feature)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 181 | `this._findExpertiseInFeature(feature)` | `CharacterSheetClassUtils.findExpertiseInFeature(feature)` |

### 2.3 `_findExpertiseInEntries`
- **Lines:** 215–233
- **Replacement:** `CharacterSheetClassUtils.findExpertiseInEntries(entries)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 207 | `this._findExpertiseInEntries(feature.entries)` | `CharacterSheetClassUtils.findExpertiseInEntries(feature.entries)` |
  | 228 | `this._findExpertiseInEntries(entry.entries)` | `CharacterSheetClassUtils.findExpertiseInEntries(entry.entries)` |

### 2.4 `_entryGrantsExpertise`
- **Lines:** 241–248
- **Replacement:** `CharacterSheetClassUtils.entryGrantsExpertise(entries)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 223 | `this._entryGrantsExpertise(entry.entries \|\| [])` | `CharacterSheetClassUtils.entryGrantsExpertise(entry.entries \|\| [])` |

### 2.5 `_parseExpertiseEntries`
- **Lines:** 253–292
- **Replacement:** `CharacterSheetClassUtils.parseExpertiseEntries(entries)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 203 | `this._parseExpertiseEntries(feature.entries)` | `CharacterSheetClassUtils.parseExpertiseEntries(feature.entries)` |
  | 220 | `this._parseExpertiseEntries(entry.entries \|\| [])` | `CharacterSheetClassUtils.parseExpertiseEntries(entry.entries \|\| [])` |
  | 224 | `this._parseExpertiseEntries(entry.entries \|\| [])` | `CharacterSheetClassUtils.parseExpertiseEntries(entry.entries \|\| [])` |

---

## CATEGORY 3: Language Helpers (L294–L377)

### 3.1 `_getLanguageGrantsForLevel`
- **Lines:** 294–309
- **Replacement:** `CharacterSheetClassUtils.getLanguageGrantsForLevel(features)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 489 | `this._getLanguageGrantsForLevel(currentFeatures)` | `CharacterSheetClassUtils.getLanguageGrantsForLevel(currentFeatures)` |
  | 738 | `this._getLanguageGrantsForLevel(currentFeatures)` | `CharacterSheetClassUtils.getLanguageGrantsForLevel(currentFeatures)` |

### 3.2 `_findLanguageGrantsInFeature`
- **Lines:** 315–318
- **Replacement:** `CharacterSheetClassUtils.findLanguageGrantsInFeature(feature)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 298 | `this._findLanguageGrantsInFeature(feature)` | `CharacterSheetClassUtils.findLanguageGrantsInFeature(feature)` |

### 3.3 `_findLanguageGrantsInEntries`
- **Lines:** 326–377
- **Replacement:** `CharacterSheetClassUtils.findLanguageGrantsInEntries(entries, featureName)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 317 | `this._findLanguageGrantsInEntries(feature.entries, feature.name)` | `CharacterSheetClassUtils.findLanguageGrantsInEntries(feature.entries, feature.name)` |
  | 370 | `this._findLanguageGrantsInEntries(entry.entries, featureName)` | `CharacterSheetClassUtils.findLanguageGrantsInEntries(entry.entries, featureName)` |

---

## CATEGORY 4: Level Feature Analysis (L1668–L1995)

### 4.1 `_getLevelFeatures`
- **Lines:** 1668–1842
- **Replacement:** `CharacterSheetClassUtils.getLevelFeatures(classData, level, subclass, classFeatures)`
  - Note: static version takes `classFeatures` as 4th arg instead of calling `this._page.getClassFeatures()`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 448 | `this._getLevelFeatures(classData, newLevel, fullSubclassData)` | `CharacterSheetClassUtils.getLevelFeatures(classData, newLevel, fullSubclassData, this._page.getClassFeatures())` |
  | 733 | `this._getLevelFeatures(classData, newLevel, subclass)` | `CharacterSheetClassUtils.getLevelFeatures(classData, newLevel, subclass, this._page.getClassFeatures())` |
  | 3975 | `this._getLevelFeatures(classData, newLevel, selectedSubclass)` | `CharacterSheetClassUtils.getLevelFeatures(classData, newLevel, selectedSubclass, this._page.getClassFeatures())` |
  | 5242 | `this._getLevelFeatures(selectedClass, 1)` | `CharacterSheetClassUtils.getLevelFeatures(selectedClass, 1, null, this._page.getClassFeatures())` |

### 4.2 `_levelGrantsAsi`
- **Lines:** 1844–1859
- **Replacement:** `CharacterSheetClassUtils.levelGrantsAsi(classData, level)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 451 | `this._levelGrantsAsi(classData, newLevel)` | `CharacterSheetClassUtils.levelGrantsAsi(classData, newLevel)` |

### 4.3 `_levelGrantsSubclass`
- **Lines:** 1861–1894
- **Replacement:** `CharacterSheetClassUtils.levelGrantsSubclass(classData, level)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 454 | `this._levelGrantsSubclass(classData, newLevel)` | `CharacterSheetClassUtils.levelGrantsSubclass(classData, newLevel)` |

### 4.4 `_getOptionalFeatureGains`
- **Lines:** 1896–1959
- **Replacement:** **NOT YET IN ClassUtils** — needs to be extracted/added
  - Accesses `this._state.getFeatures()` internally, so static version should take `state` or `existingFeatures` param
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 497 | `this._getOptionalFeatureGains(classData, classEntry.level, newLevel)` | `CharacterSheetClassUtils.getOptionalFeatureGains(classData, classEntry.level, newLevel, this._state)` |
  | 5245 | `this._getOptionalFeatureGains(selectedClass, 0, 1)` | `CharacterSheetClassUtils.getOptionalFeatureGains(selectedClass, 0, 1, this._state)` |

### 4.5 `_filterOptFeaturesByEdition`
- **Lines:** 1961–1991
- **Replacement:** `CharacterSheetClassUtils.filterOptFeaturesByEdition(optFeatures, classSource)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 1993 | `this._filterOptFeaturesByEdition(allOptFeaturesRaw, classData.source)` | `CharacterSheetClassUtils.filterOptFeaturesByEdition(allOptFeaturesRaw, classData.source)` |

---

## CATEGORY 5: Combat Tradition Helpers (L2388–L2627)

### 5.1 `_getKnownCombatTraditions`
- **Lines:** 2388–2413
- **Replacement:** `CharacterSheetClassUtils.getKnownCombatTraditions(existingOptFeatures, state)`
  - Note: static version takes `state` as 2nd arg for `getCombatTraditions()`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 2030 | `this._getKnownCombatTraditions(existingOptFeatures)` | `CharacterSheetClassUtils.getKnownCombatTraditions(existingOptFeatures, this._state)` |

### 5.2 `_getMaxMethodDegree`
- **Lines:** 2416–2441
- **Replacement:** `CharacterSheetClassUtils.getMaxMethodDegree(cls, level)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 2033 | `this._getMaxMethodDegree(classData, newLevel)` | `CharacterSheetClassUtils.getMaxMethodDegree(classData, newLevel)` |

### 5.3 `_getTraditionName`
- **Lines:** 2443–2468
- **Replacement:** `CharacterSheetClassUtils.getTraditionName(tradCode)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 2143 | `this._getTraditionName(t)` | `CharacterSheetClassUtils.getTraditionName(t)` |
  | 2168 | `this._getTraditionName(tradCode)` | `CharacterSheetClassUtils.getTraditionName(tradCode)` |
  | 2484 | `this._getTraditionName(tradCode)` | `CharacterSheetClassUtils.getTraditionName(tradCode)` |
  | 2590 | `this._getTraditionName(tradCode)` | `CharacterSheetClassUtils.getTraditionName(tradCode)` |

### 5.4 `_getAvailableTraditions`
- **Lines:** 2470–2498
- **Replacement:** `CharacterSheetClassUtils.getAvailableTraditions(allOptFeatures)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 2581 | `this._getAvailableTraditions(allOptFeatures)` | `CharacterSheetClassUtils.getAvailableTraditions(allOptFeatures)` |

### 5.5 `_extractTraditionsFromClassFeature`
- **Lines:** 2501–2556
- **Replacement:** `CharacterSheetClassUtils.extractTraditionsFromClassFeature(className, level, classFeatures)`
  - Note: static version takes `classFeatures` instead of `this._page.getClassFeatures()`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 2573 | `this._extractTraditionsFromClassFeature(className)` | `CharacterSheetClassUtils.extractTraditionsFromClassFeature(className, 2, this._page.getClassFeatures())` |

### 5.6 `_getAvailableTraditionsForClass`
- **Lines:** 2559–2598
- **Replacement:** `CharacterSheetClassUtils.getAvailableTraditionsForClass(allOptFeatures, classAllowedTypes, className, classFeatures)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 2042 | `this._getAvailableTraditionsForClass(allOptFeatures, classAllowedTypes, classData?.name)` | `CharacterSheetClassUtils.getAvailableTraditionsForClass(allOptFeatures, classAllowedTypes, classData?.name, this._page.getClassFeatures())` |

### 5.7 `_getMethodDegree`
- **Lines:** 2600–2610
- **Replacement:** `CharacterSheetClassUtils.getMethodDegree(opt)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 2135 | `this._getMethodDegree(opt)` | `CharacterSheetClassUtils.getMethodDegree(opt)` |

### 5.8 `_getMethodTradition`
- **Lines:** 2612–2619
- **Replacement:** `CharacterSheetClassUtils.getMethodTradition(opt)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 2136 | `this._getMethodTradition(opt)` | `CharacterSheetClassUtils.getMethodTradition(opt)` |

### 5.9 `_getOrdinalSuffix`
- **Lines:** 2621–2625
- **Replacement:** `CharacterSheetClassUtils.getOrdinalSuffix(n)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 2143 | `this._getOrdinalSuffix(maxDegree)` | `CharacterSheetClassUtils.getOrdinalSuffix(maxDegree)` |
  | 2181 | `this._getOrdinalSuffix(method._degree)` | `CharacterSheetClassUtils.getOrdinalSuffix(method._degree)` |

---

## CATEGORY 6: Feature Data Lookup (L2630–L2668)

### 6.1 `_getClassFeatureData`
- **Lines:** 2630–2656
- **Replacement:** `CharacterSheetClassUtils.getClassFeatureData(classFeatures, featureName, className, source, level)`
  - Note: static version takes `classFeatures` as 1st arg
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 1711 | `this._getClassFeatureData(featureName, className, classSource, level)` | `CharacterSheetClassUtils.getClassFeatureData(this._page.getClassFeatures(), featureName, className, classSource, level)` |
  | 1730 | `this._getClassFeatureData(featureName, className, classSource, level)` | `CharacterSheetClassUtils.getClassFeatureData(this._page.getClassFeatures(), featureName, className, classSource, level)` |
  | 1747 | `this._getClassFeatureData(featureRef.name, classData.name, classSource, level)` | `CharacterSheetClassUtils.getClassFeatureData(this._page.getClassFeatures(), featureRef.name, classData.name, classSource, level)` |
  | 2664 | `this._getClassFeatureData(name, className, source, parsedLevel)` | `CharacterSheetClassUtils.getClassFeatureData(this._page.getClassFeatures(), name, className, source, parsedLevel)` |

### 6.2 `_getClassFeatureDataFromRef`
- **Lines:** 2659–2665
- **Replacement:** `CharacterSheetClassUtils.getClassFeatureDataFromRef(classFeatures, featureRef)`
- **Internal call sites:**
  None found — only called from within `_getClassFeatureData` (L2664), but that's an internal delegation.
  Not invoked directly elsewhere in the file.

---

## CATEGORY 7: Spell Pickers (L3284–L3897)

### 7.1 `_renderKnownSpellSelection`
- **Lines:** 3284–3549
- **Replacement:** `CharacterSheetSpellPicker.renderKnownSpellPicker(opts)`
  - Note: the static version takes an opts object with `page`, `state`, plus all the spell picker config
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 974 | `this._renderKnownSpellSelection({className, classSource, spellCount, cantripCount, maxSpellLevel, onSelect})` | `CharacterSheetSpellPicker.renderKnownSpellPicker({page: this._page, state: this._state, className, classSource, spellCount, cantripCount, maxSpellLevel, onSelect})` |

### 7.2 `_renderWizardSpellbookSelection`
- **Lines:** 3557–3821
- **Replacement:** `CharacterSheetSpellPicker.renderWizardSpellbookPicker(opts)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 958 | `this._renderWizardSpellbookSelection(wizardSpellCount, maxSpellLevel, (spells) => {...})` | `CharacterSheetSpellPicker.renderWizardSpellbookPicker({page: this._page, state: this._state, spellCount: wizardSpellCount, maxSpellLevel, onSelect: (spells) => {...}})` |

### 7.3 `_showSpellInfoModal`
- **Lines:** 3827–3896
- **Replacement:** `CharacterSheetSpellPicker.showSpellInfoModal(spell)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 3528 | `this._showSpellInfoModal(spell)` | `CharacterSheetSpellPicker.showSpellInfoModal(spell)` |
  | 3802 | `this._showSpellInfoModal(spell)` | `CharacterSheetSpellPicker.showSpellInfoModal(spell)` |

---

## CATEGORY 8: Spell Metadata Helpers — First Copy (L3898–L3950)

### 8.1 `_getSpellCastingTime` (first copy)
- **Lines:** 3898–3902
- **Replacement:** `CharacterSheetClassUtils.getSpellCastingTime(spell)`
- **Internal call sites (both copies serve these):**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 4246 | `this._getSpellCastingTime(spell)` | `CharacterSheetClassUtils.getSpellCastingTime(spell)` |
  | 4272 | `this._getSpellCastingTime(spell)` | `CharacterSheetClassUtils.getSpellCastingTime(spell)` |
  | 4291 | `this._getSpellCastingTime(spell)` | `CharacterSheetClassUtils.getSpellCastingTime(spell)` |
  | 4867 | `this._getSpellCastingTime(spellData)` | `CharacterSheetClassUtils.getSpellCastingTime(spellData)` |

### 8.2 `_getSpellRange` (first copy)
- **Lines:** 3904–3913
- **Replacement:** `CharacterSheetClassUtils.getSpellRange(spell)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 4247 | `this._getSpellRange(spell)` | `CharacterSheetClassUtils.getSpellRange(spell)` |
  | 4273 | `this._getSpellRange(spell)` | `CharacterSheetClassUtils.getSpellRange(spell)` |
  | 4292 | `this._getSpellRange(spell)` | `CharacterSheetClassUtils.getSpellRange(spell)` |
  | 4868 | `this._getSpellRange(spellData)` | `CharacterSheetClassUtils.getSpellRange(spellData)` |

### 8.3 `_getSpellComponents` (first copy)
- **Lines:** 3915–3925
- **Replacement:** `CharacterSheetClassUtils.getSpellComponents(spell)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 4248 | `this._getSpellComponents(spell)` | `CharacterSheetClassUtils.getSpellComponents(spell)` |
  | 4274 | `this._getSpellComponents(spell)` | `CharacterSheetClassUtils.getSpellComponents(spell)` |
  | 4293 | `this._getSpellComponents(spell)` | `CharacterSheetClassUtils.getSpellComponents(spell)` |
  | 4869 | `this._getSpellComponents(spellData)` | `CharacterSheetClassUtils.getSpellComponents(spellData)` |

### 8.4 `_getSpellDuration` (first copy)
- **Lines:** 3927–3936
- **Replacement:** `CharacterSheetClassUtils.getSpellDuration(spell)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 4249 | `this._getSpellDuration(spell)` | `CharacterSheetClassUtils.getSpellDuration(spell)` |
  | 4275 | `this._getSpellDuration(spell)` | `CharacterSheetClassUtils.getSpellDuration(spell)` |
  | 4294 | `this._getSpellDuration(spell)` | `CharacterSheetClassUtils.getSpellDuration(spell)` |
  | 4870 | `this._getSpellDuration(spellData)` | `CharacterSheetClassUtils.getSpellDuration(spellData)` |

### 8.5 `_getSchoolEmoji`
- **Lines:** 3938–3950
- **Replacement:** `CharacterSheetClassUtils.getSchoolEmoji(school)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 3373 | `this._getSchoolEmoji(s)` | `CharacterSheetClassUtils.getSchoolEmoji(s)` |
  | 3634 | `this._getSchoolEmoji(s)` | `CharacterSheetClassUtils.getSchoolEmoji(s)` |

---

## CATEGORY 9: Hit Die Utility (L3952–3970)

### 9.1 `_getClassHitDie`
- **Lines:** 3952–3967
- **Replacement:** `CharacterSheetClassUtils.getClassHitDie(classData)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 1017 | `this._getClassHitDie(classData)` | `CharacterSheetClassUtils.getClassHitDie(classData)` |
  | 1638 | `this._getClassHitDie(classData)` | `CharacterSheetClassUtils.getClassHitDie(classData)` |
  | 4311 | `this._getClassHitDie(classData)` | `CharacterSheetClassUtils.getClassHitDie(classData)` |
  | 4565 | `this._getClassHitDie(classData)` | `CharacterSheetClassUtils.getClassHitDie(classData)` |

---

## CATEGORY 10: Spellcasting Ability & Slots (L4697–L4778)

### 10.1 `_getSpellcastingAbility`
- **Lines:** 4697–4711
- **Replacement:** `CharacterSheetClassUtils.getSpellcastingAbility(classData)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 4660 | `this._getSpellcastingAbility(classData)` | `CharacterSheetClassUtils.getSpellcastingAbility(classData)` |

### 10.2 `_getSpellSlotsForLevel`
- **Lines:** 4713–4778
- **Replacement:** `CharacterSheetClassUtils.getSpellSlotsForLevel(classData, level)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 4677 | `this._getSpellSlotsForLevel(classData, newLevel)` | `CharacterSheetClassUtils.getSpellSlotsForLevel(classData, newLevel)` |

---

## CATEGORY 11: State Mutators (L4516–L4695)

### 11.1 `_applyFeatBonuses`
- **Lines:** 4516–4562
- **Replacement:** `CharacterSheetClassUtils.applyFeatBonuses(state, feat)`
  - Note: static version takes `state` as 1st arg
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 4039 | `this._applyFeatBonuses(selectedFeat)` | `CharacterSheetClassUtils.applyFeatBonuses(this._state, selectedFeat)` |
  | 4046 | `this._applyFeatBonuses(selectedFeat)` | `CharacterSheetClassUtils.applyFeatBonuses(this._state, selectedFeat)` |

### 11.2 `_updateHitDice`
- **Lines:** 4564–4577
- **Replacement:** `CharacterSheetClassUtils.updateHitDice(state, classData)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 4377 | `this._updateHitDice(classData)` | `CharacterSheetClassUtils.updateHitDice(this._state, classData)` |
  | 5512 | `this._updateHitDice(selectedClass)` | `CharacterSheetClassUtils.updateHitDice(this._state, selectedClass)` |

### 11.3 `_updateClassResources`
- **Lines:** 4578–4656
- **Replacement:** `CharacterSheetClassUtils.updateClassResources(state, classEntry, newLevel, classData)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 4380 | `this._updateClassResources(classEntry, newLevel, classData)` | `CharacterSheetClassUtils.updateClassResources(this._state, classEntry, newLevel, classData)` |

### 11.4 `_updateSpellSlots`
- **Lines:** 4658–4695
- **Replacement:** `CharacterSheetClassUtils.updateSpellSlots(state, classEntry, newLevel, classData)`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 4383 | `this._updateSpellSlots(classEntry, newLevel, classData)` | `CharacterSheetClassUtils.updateSpellSlots(this._state, classEntry, newLevel, classData)` |

---

## CATEGORY 12: Racial Spells & Helpers (L4780–L4926)

### 12.1 `_updateRacialSpells`
- **Lines:** 4780–4836
- **Replacement:** `CharacterSheetClassUtils.updateRacialSpells(state, page)`
  - Note: the static version takes both `state` and `page`
- **Internal call sites:**
  | Line | Current Code | Replacement |
  |------|-------------|-------------|
  | 4386 | `this._updateRacialSpells()` | `CharacterSheetClassUtils.updateRacialSpells(this._state, this._page)` |

### 12.2 `_processRacialSpellList`
- **Lines:** 4842–4876
- **Replacement:** Part of `CharacterSheetClassUtils.updateRacialSpells` internally (encapsulated)
- **Internal call sites:**
  | Line | Current Code |
  |------|-------------|
  | 4806 | `this._processRacialSpellList(...)` |
  | 4845 | `this._processRacialSpellList(...)` (recursive) |

### 12.3 `_processRacialInnateSpells`
- **Lines:** 4879–4905
- **Replacement:** Part of `CharacterSheetClassUtils.updateRacialSpells` internally
- **Internal call sites:**
  | Line | Current Code |
  |------|-------------|
  | 4820, 4825, 4829, 4832 | `this._processRacialInnateSpells(...)` |

### 12.4 `_resolveSpellReference`
- **Lines:** 4908–4926
- **Replacement:** Part of `CharacterSheetClassUtils.updateRacialSpells` internally
- **Internal call sites:**
  | Line | Current Code |
  |------|-------------|
  | 4851, 4883 | `this._resolveSpellReference(...)` |

---

## CATEGORY 13: Duplicate Spell Metadata Helpers — Second Copy (L4929–L4970)

These are exact duplicates of Category 8 and should just be deleted.

### 13.1 `_getSpellCastingTime` (second copy)
- **Lines:** 4929–4933

### 13.2 `_getSpellRange` (second copy)
- **Lines:** 4935–4944

### 13.3 `_getSpellComponents` (second copy)
- **Lines:** 4946–4956

### 13.4 `_getSpellDuration` (second copy)
- **Lines:** 4958–4970

**No separate call sites** — JavaScript uses the last definition in the class body, so these shadow the first copy. Once both are removed, all call sites use `CharacterSheetClassUtils.getSpell*()`.

---

## METHODS NOT YET IN ClassUtils (need to be added first)

| Method | Lines | Notes |
|--------|-------|-------|
| `_getOptionalFeatureGains` | 1896–1959 | Uses `this._state.getFeatures()` — add as `static getOptionalFeatureGains(classData, currentLevel, newLevel, state)` |

---

## GRAND TOTAL

| Category | Methods to Remove | Call Sites to Update |
|----------|-------------------|---------------------|
| Feature Data Extraction | 3 | 6 |
| Expertise Helpers | 5 | 8 |
| Language Helpers | 3 | 4 |
| Level Feature Analysis | 5 | 10 |
| Combat Tradition Helpers | 9 | 13 |
| Feature Data Lookup | 2 | 5 |
| Spell Pickers | 3 | 5 |
| Spell Metadata (1st copy) | 5 | 18 |
| Hit Die Utility | 1 | 4 |
| Spellcasting Ability/Slots | 2 | 2 |
| State Mutators | 4 | 7 |
| Racial Spells & Helpers | 4 | ~8 |
| Duplicate Spell Metadata (2nd copy) | 4 (delete only) | 0 |
| **TOTAL** | **50 methods** | **~90 call site updates** |

Estimated line reduction: ~1,200+ lines removed from charactersheet-levelup.js
