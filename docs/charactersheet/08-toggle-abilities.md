# Toggle Abilities System

This document details the toggle abilities (active states) system that manages activatable features like Rage, Bladesong, and combat stances.

## Overview

Toggle abilities are features that can be activated and deactivated, providing temporary effects while active. The system handles:

- Standard D&D abilities (Rage, Wild Shape, Patient Defense)
- Wizard features (Bladesong)
- Combat stances (from various homebrew sources)
- Custom/homebrew toggle abilities
- Automatic detection and categorization

---

## Architecture

### ACTIVE_STATE_TYPES

The core definition of all supported toggle ability types lives in `CharacterSheetState`:

```javascript
static ACTIVE_STATE_TYPES = {
    rage: {
        id: "rage",
        name: "Rage",
        icon: "💢",
        description: "Advantage on Strength checks/saves, resistance to B/P/S damage, +rage damage bonus",
        effects: [
            {type: "advantage", target: "check:str"},
            {type: "advantage", target: "save:str"},
            {type: "resistance", target: "damage:bludgeoning"},
            {type: "resistance", target: "damage:piercing"},
            {type: "resistance", target: "damage:slashing"},
            {type: "rageDamage", target: "melee:str"},
        ],
        duration: "1 minute",
        endConditions: ["No attack or damage taken for 1 turn", "Knocked unconscious", "Ended as bonus action"],
        resourceName: "Rage",
        resourceCost: 1,
        detectPatterns: ["^rage$", "enter.*rage", "you can.*rage"],
        activationAction: "bonus",
    },
    // ... more state types
};
```

### State Type Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Display name |
| `icon` | string | Emoji icon |
| `description` | string | Brief description |
| `effects` | array | Mechanical effects while active |
| `duration` | string | How long it lasts |
| `endConditions` | array | Ways the state can end |
| `resourceName` | string | Resource consumed (e.g., "Rage", "Ki Points") |
| `resourceCost` | number | Cost per activation |
| `detectPatterns` | array | Regex patterns for auto-detection |
| `activationAction` | string | Action type: "bonus", "action", "free", "reaction" |
| `requiresClass` | string | Class requirement (optional) |
| `requiresClassLevel` | number | Minimum level (optional) |
| `isGeneric` | boolean | If true, effects parsed from feature |
| `useFeatureDescription` | boolean | Show feature description instead of generic |

---

## Effect Types

### Advantage/Disadvantage

```javascript
{type: "advantage", target: "check:str"}        // Advantage on STR checks
{type: "advantage", target: "save:dex"}         // Advantage on DEX saves
{type: "advantage", target: "attack:melee:str"} // Advantage on melee STR attacks
{type: "disadvantage", target: "attacksAgainst"} // Attackers have disadvantage
```

### Numeric Bonuses

```javascript
{type: "bonus", target: "ac", value: 2}           // +2 AC
{type: "bonus", target: "ac", abilityMod: "int"}  // +INT to AC
{type: "bonus", target: "speed:walk", value: 10}  // +10 walking speed
{type: "bonus", target: "damage:melee", value: 2} // +2 melee damage
```

### Resistances/Immunities

```javascript
{type: "resistance", target: "damage:bludgeoning"}
{type: "resistance", target: "damage:fire"}
{type: "immunity", target: "condition:frightened"}
```

### Special Effects

```javascript
{type: "rageDamage", target: "melee:str"}     // Uses calculated rage damage
{type: "sizeIncrease", value: 1}              // Count as one size larger
{type: "replaceStats", targets: ["str", "dex"]} // Wild Shape stat replacement
{type: "note", value: "Description text"}     // Informational note
```

---

## Supported Toggle Abilities

### Core D&D Abilities

#### Rage (Barbarian)
```javascript
rage: {
    effects: [
        {type: "advantage", target: "check:str"},
        {type: "advantage", target: "save:str"},
        {type: "resistance", target: "damage:bludgeoning"},
        {type: "resistance", target: "damage:piercing"},
        {type: "resistance", target: "damage:slashing"},
        {type: "rageDamage", target: "melee:str"},
    ],
    duration: "1 minute",
    resourceCost: 1,
    activationAction: "bonus",
}
```

#### Bladesong (Bladesinger Wizard)
```javascript
bladesong: {
    effects: [
        {type: "bonus", target: "ac", abilityMod: "int"},
        {type: "bonus", target: "speed:walk", value: 10},
        {type: "advantage", target: "skill:acrobatics"},
        {type: "bonus", target: "concentration", abilityMod: "int"},
    ],
    duration: "1 minute",
    resourceCost: 1, // Uses per proficiency bonus
    activationAction: "bonus",
}
```

#### Wild Shape (Druid)
```javascript
wildShape: {
    effects: [
        {type: "replaceStats", targets: ["str", "dex", "con"]},
        {type: "replaceHp", target: "tempHp"},
        {type: "replaceAc", target: "naturalArmor"},
    ],
    duration: "Hours based on druid level",
}
```

#### Reckless Attack (Barbarian)
```javascript
recklessAttack: {
    effects: [
        {type: "advantage", target: "attack:melee:str"},
        {type: "advantage", target: "attacksAgainst"},
    ],
    duration: "This turn",
    requiresClass: "barbarian",
    requiresClassLevel: 2,
}
```

#### Patient Defense (Monk)
```javascript
patientDefense: {
    effects: [
        {type: "disadvantage", target: "attacksAgainst"},
        {type: "advantage", target: "save:dex"},
    ],
    duration: "Until start of next turn",
    resourceName: "Ki Points",
    resourceCost: 1,
    activationAction: "bonus",
}
```

### Combat Stances (TGTT/Homebrew)

#### Heavy Stance (Adamant Mountain)
```javascript
heavyStance: {
    effects: [
        {type: "bonus", target: "check:str:athletics", useProficiency: true},
        {type: "bonus", target: "save:resist-movement", useProficiency: true},
        {type: "note", value: "Ignore first 10 ft of difficult terrain each turn"},
    ],
    resourceName: "Exertion",
    resourceCost: 1,
    activationAction: "bonus",
}
```

#### Stand Tall Stance
```javascript
standTallStance: {
    effects: [
        {type: "sizeIncrease", value: 1},
        {type: "note", value: "Creatures smaller than you have disadvantage on saves vs your combat methods"},
    ],
    resourceName: "Exertion",
    resourceCost: 1,
}
```

#### Iron Punisher
```javascript
ironPunisher: {
    effects: [
        {type: "advantage", target: "attack:melee"},
        {type: "advantage", target: "attacksAgainst"},
    ],
    activationAction: "free",
}
```

---

## Detection System

### How Detection Works

When features are loaded, the system analyzes them for toggle capability:

```javascript
static detectActivatableFeature(feature) {
    const name = feature.name?.toLowerCase() || "";
    const text = this._getFeatureText(feature);
    
    // Check each state type's detect patterns
    for (const [stateTypeId, stateType] of Object.entries(this.ACTIVE_STATE_TYPES)) {
        if (!stateType.detectPatterns?.length) continue;
        
        for (const pattern of stateType.detectPatterns) {
            const regex = new RegExp(pattern, "i");
            if (regex.test(name) || regex.test(text)) {
                return {stateTypeId, stateType, matchedPattern: pattern};
            }
        }
    }
    
    // Fallback: analyze text for toggle-like patterns
    return this.analyzeToggleability(text);
}
```

### Toggle Analysis

For features without explicit patterns, the system analyzes the text:

```javascript
static analyzeToggleability(text) {
    const plainText = text.replace(/<[^>]*>/g, " ").toLowerCase();
    
    // Activation phrases
    const activationPatterns = [
        /as a bonus action.*you can/i,
        /you can use.*bonus action to/i,
        /when you.*enter/i,
        /while (this|the) (effect|stance|state) is active/i,
    ];
    
    // Duration phrases
    const durationPatterns = [
        /lasts? (for )?(\d+) (minute|hour|round)/i,
        /until (the (start|end) of your (next )?turn|you (end|dismiss) it)/i,
        /for the duration/i,
    ];
    
    // Check for matches
    const hasActivation = activationPatterns.some(p => p.test(plainText));
    const hasDuration = durationPatterns.some(p => p.test(plainText));
    
    if (hasActivation || hasDuration) {
        return {
            isToggle: true,
            activationType: this._detectActivationType(plainText),
            duration: this._extractDuration(plainText),
        };
    }
    
    return {isToggle: false};
}
```

---

## Active State Management

### State Data Structure

```javascript
// In CharacterSheetState._data
activeStates: [
    {
        id: "rage-1234567890",       // Unique instance ID
        stateTypeId: "rage",          // Type from ACTIVE_STATE_TYPES
        featureName: "Rage",          // Source feature name
        activatedAt: 1234567890,      // Timestamp
        options: {                    // Type-specific options
            totemSpirit: "bear",      // For totem barbarians
        },
        customEffects: [],            // Additional effects from feature
    },
]
```

### Activating a State

```javascript
addActiveState(stateTypeId, options = {}) {
    const stateType = CharacterSheetState.ACTIVE_STATE_TYPES[stateTypeId];
    if (!stateType) {
        console.warn(`Unknown state type: ${stateTypeId}`);
        return null;
    }
    
    // Check if already active (for exclusive states)
    if (this.isStateTypeActive(stateTypeId)) {
        if (!stateType.allowMultiple) {
            console.warn(`State ${stateTypeId} is already active`);
            return null;
        }
    }
    
    // Consume resource if applicable
    if (stateType.resourceName && stateType.resourceCost) {
        const success = this._consumeResource(stateType.resourceName, stateType.resourceCost);
        if (!success) {
            JqueryUtil.doToast({
                type: "warning",
                content: `Not enough ${stateType.resourceName} to activate ${stateType.name}`,
            });
            return null;
        }
    }
    
    // Create state instance
    const newState = {
        id: `${stateTypeId}-${Date.now()}`,
        stateTypeId,
        featureName: options.featureName || stateType.name,
        activatedAt: Date.now(),
        options,
        customEffects: options.customEffects || [],
    };
    
    this._data.activeStates.push(newState);
    this._emit("stateActivated", newState);
    
    return newState;
}
```

### Deactivating States

```javascript
removeActiveState(stateId) {
    const index = this._data.activeStates.findIndex(s => s.id === stateId);
    if (index === -1) return false;
    
    const removed = this._data.activeStates.splice(index, 1)[0];
    this._emit("stateDeactivated", removed);
    
    return true;
}

deactivateStatesByType(stateTypeId) {
    const toRemove = this._data.activeStates.filter(s => s.stateTypeId === stateTypeId);
    toRemove.forEach(state => this.removeActiveState(state.id));
}
```

### Checking Active States

```javascript
isStateTypeActive(stateTypeId) {
    return this._data.activeStates.some(s => s.stateTypeId === stateTypeId);
}

getActiveStates() {
    return this._data.activeStates.map(state => ({
        ...state,
        stateType: CharacterSheetState.ACTIVE_STATE_TYPES[state.stateTypeId] ||
            CharacterSheetState.ACTIVE_STATE_TYPES.homebrewToggle,
    }));
}

getActiveStateEffects() {
    const effects = [];
    
    this._data.activeStates.forEach(state => {
        const stateType = CharacterSheetState.ACTIVE_STATE_TYPES[state.stateTypeId];
        if (!stateType) return;
        
        // Add base effects
        effects.push(...stateType.effects.map(e => ({
            ...e,
            source: state.featureName,
            stateId: state.id,
        })));
        
        // Add custom effects
        if (state.customEffects) {
            effects.push(...state.customEffects.map(e => ({
                ...e,
                source: state.featureName,
                stateId: state.id,
            })));
        }
    });
    
    return effects;
}
```

---

## Effect Application

### In AC Calculation

```javascript
getAc() {
    let ac = this._calculateBaseAc();
    
    // Apply active state effects
    const stateEffects = this.getActiveStateEffects();
    stateEffects.forEach(effect => {
        if (effect.type === "bonus" && effect.target === "ac") {
            if (effect.value) {
                ac += effect.value;
            } else if (effect.abilityMod) {
                ac += Math.max(1, this.getAbilityMod(effect.abilityMod));
            }
        }
    });
    
    return ac;
}
```

### In Attack Rolls

```javascript
_getAttackAdvantageStatus() {
    const stateEffects = this.getActiveStateEffects();
    
    let hasAdvantage = false;
    let hasDisadvantage = false;
    
    stateEffects.forEach(effect => {
        if (effect.type === "advantage" && effect.target?.startsWith("attack")) {
            hasAdvantage = true;
        }
        if (effect.type === "disadvantage" && effect.target?.startsWith("attack")) {
            hasDisadvantage = true;
        }
    });
    
    // Advantage and disadvantage cancel out
    if (hasAdvantage && hasDisadvantage) {
        return "normal";
    }
    return hasAdvantage ? "advantage" : hasDisadvantage ? "disadvantage" : "normal";
}
```

### In Damage Calculation

```javascript
_calculateMeleeDamageBonus() {
    let bonus = 0;
    
    // Check for rage damage
    if (this.isStateTypeActive("rage")) {
        const calc = this.getFeatureCalculations();
        bonus += calc.rageDamage || 0;
    }
    
    // Check other damage bonuses from active states
    const stateEffects = this.getActiveStateEffects();
    stateEffects.forEach(effect => {
        if (effect.type === "bonus" && effect.target === "damage:melee") {
            bonus += effect.value || 0;
        }
    });
    
    return bonus;
}
```

---

## UI Integration

### Toggle Controls

The UI renders toggle buttons for activatable features:

```javascript
_renderToggleControls() {
    const activatables = this._state.getActivatableFeatures();
    
    activatables.forEach(feature => {
        const isActive = this._state.isFeatureActive(feature.id);
        
        const $toggle = $(`
            <button class="charsheet__toggle ${isActive ? "active" : ""}" 
                    data-feature-id="${feature.id}"
                    data-state-type="${feature.stateTypeId}">
                <span class="charsheet__toggle-icon">${feature.icon}</span>
                <span class="charsheet__toggle-name">${feature.name}</span>
            </button>
        `);
        
        $toggle.click(() => this._onToggleClick(feature));
    });
}
```

### Active Effects Display

```javascript
_renderActiveEffects() {
    const $container = $("#charsheet-active-effects");
    $container.empty();
    
    const activeStates = this._state.getActiveStates();
    
    if (activeStates.length === 0) {
        $container.append(`<div class="charsheet__no-effects">No active effects</div>`);
        return;
    }
    
    activeStates.forEach(state => {
        const $effect = $(`
            <div class="charsheet__active-effect" data-state-id="${state.id}">
                <span class="charsheet__effect-icon">${state.stateType.icon}</span>
                <span class="charsheet__effect-name">${state.featureName}</span>
                <button class="charsheet__effect-remove" title="Deactivate">✕</button>
            </div>
        `);
        
        $effect.find(".charsheet__effect-remove").click(() => {
            this._state.removeActiveState(state.id);
            this._renderActiveEffects();
        });
        
        $container.append($effect);
    });
}
```

---

## Testing

The toggle abilities system has comprehensive test coverage:

### Test File Location
`test/jest/charactersheet/CharacterSheetToggleAbilities.test.js`

### Test Categories

1. **ACTIVE_STATE_TYPES validation** - Ensures all state types have required properties
2. **Detection tests** - Verifies correct identification of toggle abilities
3. **Activation/deactivation** - Tests state lifecycle management
4. **Effect application** - Verifies effects are correctly applied to calculations
5. **Resource consumption** - Tests that resources are properly consumed
6. **Class-specific tests** - Rage, Bladesong, Patient Defense, etc.

### Example Tests

```javascript
describe("Rage activation", () => {
    it("should activate rage and apply effects", () => {
        const state = createBarbarian(5);
        
        state.addActiveState("rage");
        
        expect(state.isStateTypeActive("rage")).toBe(true);
        
        const effects = state.getActiveStateEffects();
        expect(effects.some(e => e.type === "resistance" && e.target === "damage:bludgeoning")).toBe(true);
    });
    
    it("should consume a rage use", () => {
        const state = createBarbarian(5);
        const initialRages = state.getResourceCurrent("rage");
        
        state.addActiveState("rage");
        
        expect(state.getResourceCurrent("rage")).toBe(initialRages - 1);
    });
});
```

---

*Previous: [Spellcasting](./07-spellcasting.md) | Next: [Testing Strategy](./09-testing-strategy.md)*
