---
name: charactersheet-development
description: "Develop, debug, test, and extend the 5etools Character Sheet system. Use when: editing any js/charactersheet/*.js module, writing or fixing character sheet tests, adding class/subclass features to getFeatureCalculations(), working with toggle abilities or active states, implementing combat mechanics (attacks/conditions/death saves/concentration), modifying the character builder or level-up wizard, working with spell slot calculations or spell management, inventory/equipment/attunement logic, NPC export, rest mechanics, working on XPHB 2024 feature parity, TGTT/Thelemar homebrew content, custom abilities, or any file under test/jest/charactersheet/. Also use for understanding how modules interact, resolving state management issues, fixing serialization/migration bugs, or reviewing the active refactoring efforts (LevelUp→ClassUtils extraction, state file modularization). If someone mentions 'character sheet', 'charsheet', 'feature calculations', 'toggle abilities', 'level up', 'quick build', 'active states', 'spell slots', 'combat tracker', 'rest mechanics', 'NPC exporter', or any D&D class/subclass feature implementation — this is the right skill."
---

# Character Sheet Development

## System Overview

The Character Sheet is a D&D 5e character management tool built within the 5etools ecosystem. It is **actively under development** — some subsystems are mature (class mechanics, combat), while others are in flux (LevelUp refactoring, XPHB 2024 parity, state file modularization). Understanding what's stable vs. WIP is critical before making changes.

### Key Facts

- **18 modules** in `js/charactersheet/`, orchestrated by `CharacterSheetPage`
- **Central state**: `CharacterSheetState` (~23,400 lines) in `charactersheet-state.js` is the single source of truth
- **65+ test files** in `test/jest/charactersheet/` with 4,175+ tests
- **Homebrew**: TGTT (Thelemar) content is deeply integrated (737 dedicated tests)
- **Editions**: Supports PHB 2014 ("classic") and XPHB 2024 ("one"), detected via source code
- Browser globals architecture — modules assign to `globalThis`, tests import via `import` then grab from `globalThis`

### Critical Data Model Fact

Ability scores are stored as **two separate fields**: `_data.abilities.str` (base score, default 10) and `_data.abilityBonuses.str` (racial/item bonuses). The total is `base + bonus`. Spell slots are keyed by level number (`_data.spellcasting.spellSlots[1].current`), not spell name.

## Before You Start

Read the reference that matches your task:

| Task | Reference |
|------|-----------|
| Understanding module roles, dependencies, data flow | [Architecture](./references/architecture.md) |
| Working with `getFeatureCalculations()`, adding class/subclass logic | [Feature Calculations](./references/feature-calculations.md) |
| Writing or fixing tests, test infrastructure, common pitfalls | [Testing Guide](./references/testing-guide.md) |
| Current WIP areas, known limitations, ongoing refactors | [Development Status](./references/development-status.md) |
| Active states, combat mechanics, NPC export, rest, spell/item data shapes | [Subsystem Details](./references/subsystem-details.md) |

Also consult the project's own docs (read before modifying): `docs/charactersheet/` — especially `10-known-limitations.md` and `11-future-roadmap.md`.

## Procedure

### 1. Identify the Layer

Character sheet work falls into one of these layers:

| Layer | Files | Examples |
|-------|-------|---------|
| **State / Model** | `charactersheet-state.js` | Adding feature calculations, fixing stat derivation, serialization |
| **Module / Controller** | `charactersheet-{combat,spells,inventory,...}.js` | UI behavior, event handling, render logic |
| **Utility** | `charactersheet-class-utils.js`, `charactersheet-spell-picker.js` | Shared helpers, data queries |
| **Orchestrator** | `charactersheet.js` | Data loading, module wiring, save/load |
| **Tests** | `test/jest/charactersheet/*.test.js` | Verification, regression |

### 2. Understand the State Model

All character data flows through `CharacterSheetState._data`. Key computed values:
- **Ability modifiers**: `getAbilityMod(ability)` — `Math.floor((score - 10) / 2)`
- **Proficiency bonus**: `getProficiencyBonus()` — based on total character level
- **AC**: Complex multi-source calculation (armor, unarmored, formula, shields, items, active states)
- **Feature calculations**: `getFeatureCalculations()` — the core method for all class/subclass mechanics

When modifying state: changes to `_data` happen through setter methods, derived values are recomputed via getter methods. There is no reactive/observer pattern — modules explicitly call `render()` after state changes.

### 3. Follow the Test Pattern

Tests use a specific setup that mocks browser globals. The critical import pattern:

```javascript
import "../../../js/charactersheet/charactersheet-state.js";
const CharacterSheetState = globalThis.CharacterSheetState;

describe("Feature Name", () => {
    let state;
    beforeEach(() => { state = new CharacterSheetState(); });

    it("should compute X at level Y", () => {
        state.addClass({name: "Fighter", source: "PHB", level: 5});
        const calc = state.getFeatureCalculations();
        expect(calc.hasExtraAttack).toBe(true);
    });
});
```

**Anti-pattern to avoid**:
```javascript
// BAD — tests nothing meaningful
expect(state.getTotalLevel()).toBe(3); // Always passes!
```

**Correct pattern**:
```javascript
// GOOD — tests actual calculated mechanic
const calc = state.getFeatureCalculations();
expect(calc.experimentalElixirCount).toBe(2);
```

### 4. Handle Module Dependencies

If your change in `charactersheet-state.js` calls methods from another module (e.g., `CharacterSheetClassUtils`), you must explicitly import it in tests or they'll throw `ReferenceError`. The browser bundles all scripts together, but Jest isolates modules.

```javascript
// In test file — import dependencies BEFORE the module under test
import "../../../js/charactersheet/charactersheet-class-utils.js";
import "../../../js/charactersheet/charactersheet-state.js";
```

### 5. Run Tests

```bash
# Specific suite
NODE_OPTIONS='--experimental-vm-modules' npx jest CharacterSheetBarbarian --no-coverage --forceExit

# Related suites after a change
NODE_OPTIONS='--experimental-vm-modules' npx jest CharacterSheetToggleAbilities CharacterSheetCombat CharacterSheetFeatureEffects --no-coverage --forceExit

# All character sheet tests
NODE_OPTIONS='--experimental-vm-modules' npx jest test/jest/charactersheet/ --no-coverage --forceExit
```

### 6. Check for Ripple Effects

Changes to these files can affect many other modules:
- `charactersheet-state.js` → literally everything
- `charactersheet-class-utils.js` → Builder, LevelUp, QuickBuild
- `setup.js` → all test files
- `getFeatureCalculations()` → class tests, toggle tests, combat tests, feature effect tests

When modifying these, run the full test suite to catch regressions.

## Common Tasks

### Adding a subclass feature calculation

1. Find the class's section in `getFeatureCalculations()` in `charactersheet-state.js`
2. Add the subclass switch case (match by `subclassName`)
3. Use naming conventions: `has{Feature}` (bool), `{feature}Damage` (dice/number), `{feature}Dc` (save DC), `{feature}Uses` (per rest), `{feature}Bonus` (numeric)
4. Write tests in the class-specific test file using `getFeatureCalculations()` assertions
5. Read [Feature Calculations reference](./references/feature-calculations.md) for detailed patterns

### Adding a toggle ability / active state

1. Add entry to `ACTIVE_STATE_TYPES` in `charactersheet-state.js`
2. Define effects array with appropriate types (advantage, bonus, resistance, etc.)
3. Set `detectPatterns` for auto-detection from feature text
4. Handle mutual exclusivity if needed (Rage and Bladesong can't coexist)
5. Write tests in `CharacterSheetToggleAbilities.test.js`
6. Read [Toggle Abilities doc](../../docs/charactersheet/08-toggle-abilities.md) for effect types

### Fixing a combat calculation

1. Identify whether the bug is in state derivation (`charactersheet-state.js`) or UI/display (`charactersheet-combat.js`)
2. Check if active states affect the calculation (call `getBonusFromStates(type)`)
3. Check if items affect the calculation (item bonuses are stored separately as `itemBonuses.savingThrow`, `itemBonuses.spellAttack`, etc.)
4. Check if conditions/exhaustion apply penalties
5. Bonus aggregation order matters: named modifiers → active state bonuses → special bonuses (rage damage, sneak attack, crit dice)
6. Write a regression test before fixing

### Working with the NPC exporter

1. `CharacterSheetNpcExporter.convertStateToMonster(state, options)` converts character to 5etools monster JSON
2. **AC must be array of objects**: `[{ac: 15, from: ["armor"]}]`, not a flat number
3. Attack translation merges weapon magic bonuses: `bonusWeapon + bonusWeaponAttack` (to-hit), `bonusWeapon + bonusWeaponDamage` (damage)
4. CR estimation: baseline from level, ±adjustments from HP/AC defensively and attack bonus/damage offensively
5. Output must match 5etools homebrew schema format

### Working with the LevelUp/QuickBuild refactor

There is an active refactor extracting helpers from `charactersheet-levelup.js` into `charactersheet-class-utils.js`. See `LEVELUP_REFACTOR_MAP.md` at the project root for the full extraction plan. Key categories being moved:
- Feature data extraction (findFeatureOptions, getClassFeatureByRef)
- Expertise helpers
- Language grant helpers
- Level feature analysis
- Combat tradition helpers (TGTT)
- Spell selection helpers

When touching these areas: check if the method already exists in ClassUtils or is still in LevelUp, and use the ClassUtils version when available.

## Pitfalls

- **The state file is 23,400+ lines.** Use grep/search to find the right section. Key landmarks: `getFeatureCalculations()` (~line 9894+), `ACTIVE_STATE_TYPES` (~line 3386+), default state schema (~line 3397), parsers (~line 7).
- **Ability scores ≠ ability bonuses.** Base scores live in `_data.abilities`, racial/item bonuses in `_data.abilityBonuses`. These are summed at read time. Always use `getAbilityScore()` (returns base + bonus) and `getAbilityMod()`, never read `_data.abilities` directly for the "total".
- **Multiclass spell slot math is tricky.** Full casters count full levels, half casters half (rounded down), third casters third (rounded down), Artificer rounds up. The combined caster level determines slot table index. Warlock Pact Magic is tracked separately.
- **TGTT/Thelemar content is everywhere.** Don't remove or break Thelemar features (combat traditions, dreamwalker, custom subclasses). They're gated by settings flags.
- **Edition detection matters.** PHB features and XPHB features can differ for the same class. Check source: `source === "XPHB"` or `edition === "one"` for 2024. Blade Ward is concentration in XPHB but not PHB 2014 — save migration must match BOTH name AND source.
- **The `setup.js` mocks are minimal.** If you need Parser, Renderer, or DataUtil methods not already mocked, add them to `test/jest/charactersheet/setup.js`. But keep mocks minimal — don't pull in the full library.
- **Save/load migration.** If you add new state fields, handle backward compatibility in `loadFromJson()` for characters saved without those fields. Provide sensible defaults. Three migrations run automatically: `_migrateFeatures()`, `_migrateModifiers()`, `_migrateSpells()`.
- **Module init order matters.** Builder initializes first, Spells third (needs DataUtil), Features fifth (needs class data loaded). Each module is try/catch isolated — one failing doesn't break others.
- **No reactive UI.** There is no binding framework. All DOM updates are manual. After `state.setX()`, the module must call `this.render()` or `this._renderXxx()`. Forgetting to re-render is a common bug.
- **jQuery everywhere.** Event binding is `$(document).on("click", "#id", handler)`. HTML is generated as template literal strings wrapped in `$()`. CSS classes follow a BEM-like pattern: `.charsheet__element--modifier`.
- **Console logging convention.** All modules prefix: `[CharSheet State]`, `[LevelUp]`, `[Combat]`, etc. Use `console.warn()` for non-fatal, `console.error()` for module-breaking failures.
- **Respec editing is partially implemented.** ASI, feat, subclass, feature choices, combat traditions, and weapon masteries can be edited. Skills, expertise, and spells cannot — the respec UI has buttons disabled for those with comment: "would require extensive recalculation".
- **Steady Aim has a two-phase consumption pattern.** It grants both advantage + zero speed; after the attack, only the advantage effect is consumed (via `_consumeOnAttackStates()`), leaving zero speed until turn ends.
