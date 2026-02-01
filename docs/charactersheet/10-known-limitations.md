# Known Limitations & Shortcomings

This document honestly assesses the current limitations and areas for improvement in the character sheet system.

## Overview

While the character sheet has extensive functionality and test coverage, several areas need additional work. This document catalogs these gaps to help contributors prioritize improvements.

---

## Implementation Gaps

### Subclass Feature Calculations

Many subclasses have boolean flags (`hasFeature`) but lack the mechanical calculations needed for full functionality.

#### Artificer Subclasses

| Subclass | Missing Calculations |
|----------|---------------------|
| **Alchemist** | Experimental elixir count, alchemical savant bonus |
| **Armorer** | Armor model features, Thunder Gauntlets/Lightning Launcher damage |
| **Artillerist** | Cannon damage progression, cannon HP calculation |
| **Battle Smith** | Steel Defender HP, arcane jolt damage |

#### Druid Circles

| Circle | Missing Calculations |
|--------|---------------------|
| **Moon** | Combat Wild Shape CR limits, Primal Strike |
| **Land** | Natural Recovery slot values |
| **Dreams** | Balm of the Summer Court healing dice |
| **Spores** | Halo of Spores damage, Symbiotic Entity temp HP |
| **Stars** | Starry Form effects, Cosmic Omen uses |
| **Wildfire** | Wildfire Spirit HP, Fiery Teleportation damage |

#### Other Classes with Partial Subclass Support

| Class | Issue |
|-------|-------|
| **Cleric** | Most domains need mechanical calculations (healing bonuses, uses per rest) |
| **Ranger** | Beast Master companion stats not fully implemented |
| **Fighter** | Eldritch Knight bonded weapon features incomplete |
| **Paladin** | Oath features need specific mechanical values |

### Anti-Pattern in Tests

Some tests use weak verification patterns that don't actually test mechanical correctness:

```javascript
// PROBLEMATIC: This always passes regardless of implementation
it("should have feature at level 3", () => {
    state.addClass({name: "Artificer", level: 3, subclass: {name: "Alchemist"}});
    expect(state.getTotalLevel()).toBe(3);  // Tests nothing!
});

// CORRECT: Tests actual mechanical calculation
it("should produce 2 elixirs at level 6", () => {
    state.addClass({name: "Artificer", level: 6, subclass: {name: "Alchemist"}});
    const calc = state.getFeatureCalculations();
    expect(calc.experimentalElixirCount).toBe(2);
});
```

---

## Missing Features

### Core Functionality

| Feature | Status | Notes |
|---------|--------|-------|
| **Multiclass spell slots UI** | Partial | Calculation exists, UI incomplete |
| **Ritual spell book** | Missing | Wizard ritual-only spells not tracked separately |
| **Optional class features** | Partial | Not all TCE optional features supported |
| **Custom lineages** | Missing | Tasha's custom lineage not fully supported |
| **Sidekick classes** | Missing | Warrior/Expert/Spellcaster sidekick classes |

### Combat Features

| Feature | Status | Notes |
|---------|--------|-------|
| **Cover bonuses** | Missing | No tracking for half/three-quarters cover |
| **Flanking** | Missing | Optional rule not implemented |
| **Multi-target attacks** | Partial | No UI for AoE damage distribution |
| **Reaction tracking** | Missing | No per-round reaction usage tracking |

### Resource Management

| Feature | Status | Notes |
|---------|--------|-------|
| **Dawn/dusk recharge** | Partial | Items recharge, but timing not tracked |
| **Per-encounter resources** | Missing | No concept of encounter-based recovery |
| **Lair/Legendary actions** | Missing | Not applicable to PCs, but could be useful |

---

## 2024 PHB (XPHB) Coverage Gaps

The 2024 revision introduced significant changes. Current coverage:

### Implemented

- ✅ Weapon Mastery properties
- ✅ Updated class features (most)
- ✅ New subclasses
- ✅ Updated spell slot progression
- ✅ Revised ability score improvements

### Partially Implemented

- ⚠️ Species (formerly races) - structure supported, not all species complete
- ⚠️ Background updates - 2024 backgrounds need work
- ⚠️ Updated feats - some 2024 feats missing

### Not Implemented

- ❌ Crafting rules
- ❌ Updated tool proficiencies
- ❌ Revised conditions (exhaustion changes)
- ❌ Bastions (new subsystem)

---

## Technical Debt

### Code Organization

| Issue | Impact | Suggested Fix |
|-------|--------|---------------|
| **16,000+ line state file** | Hard to navigate | Split into focused modules |
| **Inconsistent naming** | Confusing | Establish naming conventions |
| **Magic numbers** | Fragile | Extract to constants |
| **Limited JSDoc** | Learning curve | Add comprehensive documentation |

### Performance

| Issue | Impact | Suggested Fix |
|-------|--------|---------------|
| **`getFeatureCalculations()` not cached** | Redundant computation | Add memoization |
| **Full re-render on changes** | UI lag | Implement selective updates |
| **Large state serialization** | Slow save/load | Consider IndexedDB for large saves |

### Testing

| Issue | Impact | Suggested Fix |
|-------|--------|---------------|
| **Weak test patterns** | False confidence | Audit and strengthen tests |
| **Missing edge cases** | Undiscovered bugs | Add boundary tests |
| **Limited integration tests** | Integration bugs | Add more E2E tests |

---

## Browser/Environment Limitations

### Local Storage

- **5MB limit**: Large character collections may hit storage limits
- **No cross-device sync**: Characters are browser-specific
- **Data loss risk**: Clearing browser data loses characters

### Offline Support

- **Partial**: Core functionality works offline
- **Data loading**: Requires cached 5etools data files
- **No PWA**: Not installable as progressive web app

### Mobile Experience

- **Responsive**: Basic mobile support exists
- **Touch optimization**: Could be improved
- **Screen space**: Complex features cramped on small screens

---

## Data Accuracy

### Official Content

Most official content is accurate, but edge cases exist:

- Some errata not applied
- Print vs. D&D Beyond differences
- Conflicting interpretations of rules

### Homebrew

Homebrew content quality varies:

- Schema validation doesn't catch all issues
- Feature parsing may fail on unusual text
- Some homebrew sources incompatible

---

## Improvement Priorities

### High Priority

1. **Complete subclass calculations** - Add missing mechanical values
2. **Fix weak test patterns** - Convert `getTotalLevel()` tests
3. **XPHB 2024 completion** - Full support for revised rules

### Medium Priority

4. **Code modularization** - Break up large files
5. **Performance optimization** - Cache computations
6. **Mobile improvements** - Better touch experience

### Low Priority

7. **PWA support** - Offline installation
8. **Cloud sync** - Cross-device characters
9. **Advanced combat** - Cover, flanking, etc.

---

## How to Contribute

See [Contributing Guide](./12-contributing-guide.md) for:
- How to identify issues to work on
- Implementation patterns to follow
- Test requirements for new features
- Code review process

### Quick Wins for New Contributors

1. Add missing subclass calculations (follow existing patterns)
2. Convert weak tests to use `getFeatureCalculations()`
3. Add missing XPHB feature flags
4. Improve JSDoc comments

---

*Previous: [Testing Strategy](./09-testing-strategy.md) | Next: [Future Roadmap](./11-future-roadmap.md)*
