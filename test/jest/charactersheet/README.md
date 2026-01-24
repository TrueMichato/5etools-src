# Character Sheet Test Suite

A comprehensive testing suite for the 5etools Character Sheet functionality. This suite ensures robustness and correctness of all character sheet features including state management, combat calculations, spellcasting, inventory, leveling, and rest mechanics.

## Quick Start

```bash
# Run all tests
npm run test:unit

# Run only character sheet tests
npm run test:unit -- --testPathPattern=charactersheet

# Run specific test file
npm run test:unit -- CharacterSheetState.test.js

# Run with coverage
npm run test:unit -- --coverage --collectCoverageFrom="js/charactersheet/**/*.js"

# Run in watch mode
npm run test:unit -- --watch
```

## Test Structure

```
test/jest/charactersheet/
├── CharacterSheetState.test.js      # Core state management
├── CharacterSheetParsers.test.js    # Parser utilities
├── CharacterSheetCombat.test.js     # Combat mechanics
├── CharacterSheetSpells.test.js     # Spellcasting system
├── CharacterSheetInventory.test.js  # Inventory management
├── CharacterSheetLevelUp.test.js    # Level progression
├── CharacterSheetRest.test.js       # Rest mechanics
├── CharacterSheetIntegration.test.js # End-to-end flows
└── README.md                        # This file
```

## Test Coverage Overview

### CharacterSheetState.test.js (~400 lines)
Core state management for character data.

| Category | Tests |
|----------|-------|
| Initialization | Default values, empty state |
| Basic Info | Name, race, background, alignment |
| Classes & Levels | Add/remove classes, level tracking |
| Proficiency Bonus | Level-based calculation |
| Ability Scores | Base values, modifiers, bonuses |
| Hit Points | Current, max, temp HP |
| Hit Dice | Tracking, spending, recovery |
| Death Saves | Success/failure tracking |
| Inspiration | Toggle state |
| Senses | Darkvision, special senses |
| Passive Scores | Perception, investigation, insight |
| Skills | Proficiency, expertise, bonuses |
| Saving Throws | Proficiency, bonuses |
| Speed | Base, modified speeds |
| Armor Class | Calculation, armor types |
| Serialization | Save/load state |

### CharacterSheetParsers.test.js (~200 lines)
Parser utilities for feature text parsing.

| Parser | Functionality |
|--------|---------------|
| FeatureUsesParser | Parse uses per rest from text |
| NaturalWeaponParser | Parse natural weapon stats |
| SpellGrantParser | Parse granted spells from features |
| FeatureModifierParser | Parse stat modifications |

### CharacterSheetCombat.test.js (~450 lines)
Combat mechanics and calculations.

| Category | Tests |
|----------|-------|
| Attack Bonus | STR/DEX weapons, proficiency |
| Damage Calculations | Modifiers, bonus damage |
| Initiative | DEX modifier, bonuses |
| Death Saves | Success, failure, stabilization |
| AC in Combat | Cover, conditions, spells |
| Conditions | Tracking, effects |
| Exhaustion | Levels, penalties |
| Concentration | Saves, breaking |
| Resistances | Damage types, immunities |
| Temporary HP | Stacking, consumption |
| Attacks | Multiple attacks, opportunity |
| Multiclass Combat | Combined features |

### CharacterSheetSpells.test.js (~400 lines)
Spellcasting system tests.

| Category | Tests |
|----------|-------|
| Spell Slots | Current, max, spending |
| Slot Progression | By class level |
| Pact Magic | Warlock mechanics |
| Spell Save DC | Class-based calculation |
| Spell Attack Bonus | Modifier + proficiency |
| Known Spells | Adding, removing, tracking |
| Cantrips | Known cantrips, scaling |
| Concentration | Single spell limit |
| Innate Spellcasting | Racial, item-based |
| Multiclass Spellcasting | Slot calculation |
| Ritual Casting | Ritual-only spells |
| Spell Preparation | Prepared casters |

### CharacterSheetInventory.test.js (~400 lines)
Inventory and equipment management.

| Category | Tests |
|----------|-------|
| Basic Operations | Add, remove, update items |
| Equipment | Equip, unequip, slots |
| Attunement | Limits, tracking |
| Encumbrance | Weight, carrying capacity |
| Armor and AC | Calculation, prerequisites |
| Currency | Tracking, conversion |
| Item Charges | Usage, recharge |
| Item Bonuses | Stat bonuses, effects |
| Filtering | By type, property |

### CharacterSheetLevelUp.test.js (~400 lines)
Level progression mechanics.

| Category | Tests |
|----------|-------|
| Basic Level Up | Class level increase |
| HP on Level Up | HP gain, CON modifier |
| Ability Score Improvements | ASI levels, application |
| Feat Selection | Feat instead of ASI |
| Class Features | Feature acquisition |
| Subclass Selection | Subclass levels, features |
| Multiclassing | Prerequisites, benefits |
| Multiclass Spell Slots | Combined caster level |
| Proficiency Grants | Class proficiencies |
| Extra Attack | Attack scaling |

### CharacterSheetRest.test.js (~450 lines)
Rest and recovery mechanics.

| Category | Tests |
|----------|-------|
| Short Rest HP | Hit die spending |
| Short Rest Resources | Feature recovery |
| Ki Points | Monk recovery |
| Long Rest Recovery | Full HP, hit dice |
| Long Rest Spell Slots | Full restoration |
| Long Rest Features | Long rest abilities |
| Conditions | Exhaustion reduction |
| Temp HP | Persistence through rest |
| Interrupted Rest | Partial rest rules |
| Class-Specific | Arcane Recovery, Song of Rest |
| Rest Requirements | Time tracking |
| Multiclass Hit Dice | Multiple die types |
| Magic Items | Dawn/dusk recharge |

### CharacterSheetIntegration.test.js (~500 lines)
End-to-end character workflows.

| Scenario | Tests |
|----------|-------|
| Character Creation | Complete level 1 builds |
| Level Progression | 1-5 progression flow |
| Multiclass Scenarios | Various combinations |
| Combat Simulation | Damage, healing, death |
| Rest Cycle | Short/long rest flow |
| Save/Load | Serialization round-trip |
| Edge Cases | Extremes, errors |
| Spell Preparation | Prepared caster workflow |
| Equipment Management | Weapon swapping, attunement |

## Writing New Tests

### Test File Structure

```javascript
/**
 * Description of what this test file covers
 */

import "../../../js/charactersheet/charactersheet-state.js";

const CharacterSheetState = globalThis.CharacterSheetState;

describe("Feature Name", () => {
    let state;

    beforeEach(() => {
        state = new CharacterSheetState();
        // Common setup
    });

    describe("Sub-feature", () => {
        it("should do something specific", () => {
            // Arrange
            state.setSomeValue(123);
            
            // Act
            const result = state.getSomeValue();
            
            // Assert
            expect(result).toBe(123);
        });

        it("should handle edge case", () => {
            // Test edge cases
        });
    });
});
```

### Test Naming Conventions

- Use descriptive `describe` blocks for feature groups
- Use `it("should...")` format for individual tests
- Test both positive and negative cases
- Include edge case tests

### Common Assertions

```javascript
// Value equality
expect(value).toBe(expected);
expect(value).toEqual(expected); // Deep equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeDefined();
expect(value).toBeNull();

// Numbers
expect(value).toBeGreaterThan(5);
expect(value).toBeLessThanOrEqual(10);

// Collections
expect(array).toHaveLength(3);
expect(array).toContain(item);
expect(object).toHaveProperty("key");

// Negative assertions
expect(value).not.toBe(something);
```

## D&D 5e Rules Reference

These tests verify implementation of official D&D 5e rules:

### Proficiency Bonus by Level
| Total Level | Proficiency Bonus |
|-------------|-------------------|
| 1-4 | +2 |
| 5-8 | +3 |
| 9-12 | +4 |
| 13-16 | +5 |
| 17-20 | +6 |

### Ability Modifiers
| Score | Modifier |
|-------|----------|
| 1 | -5 |
| 2-3 | -4 |
| 4-5 | -3 |
| 6-7 | -2 |
| 8-9 | -1 |
| 10-11 | +0 |
| 12-13 | +1 |
| 14-15 | +2 |
| 16-17 | +3 |
| 18-19 | +4 |
| 20+ | +5+ |

### ASI Levels by Class
| Class | ASI Levels |
|-------|------------|
| Fighter | 4, 6, 8, 12, 14, 16, 19 |
| Rogue | 4, 8, 10, 12, 16, 19 |
| Others | 4, 8, 12, 16, 19 |

### Subclass Selection Levels
| Class | Level |
|-------|-------|
| Cleric, Sorcerer, Warlock | 1 |
| Wizard | 2 |
| All Others | 3 |

### Multiclass Caster Level Calculation
| Caster Type | Contribution |
|-------------|--------------|
| Full (Bard, Cleric, Druid, Sorcerer, Wizard) | Full level |
| Half (Paladin, Ranger) | Level / 2 (round down) |
| Third (Arcane Trickster, Eldritch Knight) | Level / 3 (round down) |
| Pact Magic (Warlock) | Separate slots |

## Maintenance

### Updating Tests
When adding new character sheet features:
1. Add unit tests in the appropriate test file
2. Add integration tests if the feature interacts with others
3. Update this README with new coverage

### Running Tests Before Commits
```bash
# Full test run
npm run test:unit

# Quick check during development
npm run test:unit -- --watch --testPathPattern=charactersheet
```

## Troubleshooting

### Common Issues

**Module not found errors:**
- Ensure the import path is correct
- Check that `charactersheet-state.js` exports to `globalThis`

**Test timeouts:**
- Complex calculations may need longer timeouts
- Add `jest.setTimeout(10000)` for slow tests

**Snapshot failures:**
- Review changes and update snapshots if intentional
- Run `npm run test:unit -- -u` to update snapshots

## Contributing

When contributing new tests:
1. Follow the existing test structure
2. Include both happy path and edge case tests
3. Document any D&D rules being tested
4. Keep tests independent (no shared state between tests)
5. Use meaningful test descriptions
