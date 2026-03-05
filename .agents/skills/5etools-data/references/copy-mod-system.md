# _copy / _mod System Reference

The `_copy` system lets entities inherit from other entities and apply modifications. Resolved during data loading via `DataUtil.pDoMetaMerge()`.

## Basic Structure

```jsonc
{
  "name": "Four-Armed Troll",
  "source": "HotDQ",
  "page": 65,
  "_copy": {
    "name": "Troll",              // source entity name
    "source": "MM",               // source entity source

    "_mod": { ... },              // modifications to apply
    "_preserve": { ... },         // properties to keep even if empty
    "_templates": [ ... ]         // trait templates to merge (monsters only)
  }
}
```

Properties set directly on the entity (outside `_copy`) override the copied values. The `_copy` fields are resolved first, then direct fields overwrite.

## Context Fields

Some entity types need extra fields in `_copy` to locate the source entity:

| Entity Type | Extra Fields |
|-------------|-------------|
| Subclass | `shortName`, `className`, `classSource` |
| Subclass Feature | `className`, `classSource`, `subclassShortName`, `subclassSource`, `level` |
| Deity | `pantheon` |
| Race Feature | `raceName`, `raceSource` |

## _preserve

Controls which properties survive even when empty/absent on the child entity:

```jsonc
"_preserve": {
  "*": true,           // preserve ALL properties
  "page": true,        // keep page number
  "srd": true,         // keep SRD flag
  "reprintedAs": true  // keep reprint forward-references
}
```

## _templates (Monsters Only)

Merge predefined trait templates:

```jsonc
"_templates": [
  {"name": "Reduced Threat", "source": "TYP"}
]
```

---

## _mod Operations

The `_mod` object maps property names to modification operations. Each property can have a single operation object or an array of operations.

```jsonc
"_mod": {
  "action": { "mode": "replaceArr", "replace": "Multiattack", "items": {...} },
  "trait": [
    { "mode": "removeArr", "names": ["Amphibious"] },
    { "mode": "appendArr", "items": {"name": "New Trait", "entries": ["..."]} }
  ],
  "unusedProp": "remove"          // string shorthand: delete the property
}
```

### String & Text Modes

#### replaceTxt
Replace text via regex in entry strings:
```jsonc
{
  "mode": "replaceTxt",
  "replace": "poison",            // regex pattern
  "with": "necrotic",             // replacement
  "flags": "i",                   // regex flags (optional)
  "props": [null, "entries", "headerEntries"]  // limit to specific properties
}
```

#### appendStr
Append text to a string property:
```jsonc
{"mode": "appendStr", "str": " (Enhanced)", "joiner": " "}
```

#### replaceName
Replace entity name via regex:
```jsonc
{"mode": "replaceName", "replace": "Dire", "with": "Greater"}
```

#### prefixSuffixStringProp
Add prefix/suffix to a string property (supports dotted paths):
```jsonc
{"mode": "prefixSuffixStringProp", "prop": "name", "prefix": "+1 ", "suffix": " (Enhanced)"}
```

### Array Modes

#### prependArr
Add items to **start** of array:
```jsonc
{"mode": "prependArr", "items": {"name": "New Trait", "entries": ["..."]}}
```

#### appendArr
Add items to **end** of array:
```jsonc
{"mode": "appendArr", "items": [{"name": "Trait1"}, {"name": "Trait2"}]}
```
`items` can be a single object or an array.

#### appendIfNotExistsArr
Append only if not already present:
```jsonc
{"mode": "appendIfNotExistsArr", "items": {"name": "Darkvision", "entries": ["..."]}}
```

#### insertArr
Insert at specific index:
```jsonc
{"mode": "insertArr", "index": 2, "items": {"name": "New Trait", "entries": ["..."]}}
```

#### replaceArr
Replace items by name, index, or regex:
```jsonc
// By name
{"mode": "replaceArr", "replace": "Multiattack", "items": {"name": "Multiattack", "entries": ["..."]}}

// By index
{"mode": "replaceArr", "replace": {"index": 0}, "items": {"name": "Replacement"}}

// By regex
{"mode": "replaceArr", "replace": {"regex": "^Multi", "flags": "i"}, "items": {...}}
```

#### replaceOrAppendArr
Replace if found, append if not:
```jsonc
{"mode": "replaceOrAppendArr", "replace": "Multiattack", "items": {...}}
```

#### removeArr
Remove items by name or exact match:
```jsonc
// By name
{"mode": "removeArr", "names": ["Amphibious", "Web Sense"]}

// By exact string
{"mode": "removeArr", "items": ["exact string"], "force": true}
```

#### renameArr
Rename items in array:
```jsonc
{"mode": "renameArr", "renames": [{"rename": "Old Name", "with": "New Name"}]}
```

### Property Modes

#### setProp
Set a property to a value (supports dotted paths):
```jsonc
{"mode": "setProp", "prop": "bonusWeapon", "value": "+2"}
{"mode": "setProp", "prop": "inherits.bonusAc", "value": "+1"}
```

#### calculateProp
Calculate using formula with variables:
```jsonc
{"mode": "calculateProp", "prop": "dc", "formula": "10 + <$prof_bonus$> + <$dex_mod$>"}
```
Variables: `<$level$>`, `<$prof_bonus$>`, `<$str_mod$>` through `<$cha_mod$>`.

#### scalarAddProp
Add a number to a numeric property:
```jsonc
{"mode": "scalarAddProp", "prop": "abilities.str", "scalar": 2}
```

#### scalarMultProp
Multiply a numeric property:
```jsonc
{"mode": "scalarMultProp", "prop": "hp", "scalar": 1.5, "floor": true}
```

### Creature-Specific Modes

These only apply to bestiary/monster data:

#### addSenses / addSaves / addSkills
```jsonc
{"mode": "addSenses", "senses": [{"type": "darkvision", "range": 120}]}
{"mode": "addSaves", "saves": {"str": 1, "dex": 2}}     // 1=proficient, 2=expert
{"mode": "addSkills", "skills": {"stealth": 2}}
{"mode": "addAllSaves", "saves": 1}
{"mode": "addAllSkills", "skills": 1}
```

#### Spell Modifications
```jsonc
// Add spells (supports daily, weekly, monthly, yearly frequencies)
{
  "mode": "addSpells",
  "spells": {"1": {"spells": ["{@spell magic missile}"]}},
  "will": ["{@spell mage hand}"],
  "daily": {"1e": ["{@spell shield}"]},
  "weekly": {"1": ["{@spell plane shift}"]},
  "monthly": {"1": ["{@spell wish}"]},
  "yearly": {"1": ["{@spell gate}"]}
}

// Remove spells (same frequency keys available)
{"mode": "removeSpells", "spells": {"3": ["{@spell fireball}"]}, "daily": {"1": ["{@spell shield}"]}}

// Replace spells
{
  "mode": "replaceSpells",
  "spells": {"3": [{"replace": "{@spell fireball}", "with": "{@spell lightning bolt}"}]}
}
```

#### Scaling Modes
```jsonc
{"mode": "scalarAddHit", "scalar": 2}     // +2 to all {@hit X} in text
{"mode": "scalarAddDc", "scalar": 2}      // +2 to all {@dc X} in text
{"mode": "scalarMultXp", "scalar": 1.5, "floor": true}
{"mode": "maxSize", "max": "L"}           // cap creature size
```

---

## Real-World Examples

### Monster Variant (bestiary)
```jsonc
{
  "name": "Four-Armed Troll",
  "source": "HotDQ",
  "page": 65,
  "_copy": {
    "name": "Troll",
    "source": "MM",
    "_mod": {
      "action": {
        "mode": "replaceArr",
        "replace": "Multiattack",
        "items": {
          "name": "Multiattack",
          "entries": ["The troll attacks five times, once with its bite and four times with its claws."]
        }
      }
    }
  }
}
```

### Item Derived from Base
```jsonc
{
  "name": "Alchemist's Doom",
  "source": "SCC",
  "page": 179,
  "_copy": {
    "name": "Alchemist's Fire (flask)",
    "source": "PHB"
  },
  "type": "G",
  "rarity": "unknown",
  "value": null,
  "entries": ["This sticky, adhesive fluid ignites when exposed to air..."]
}
```

### Subclass Reprint
```jsonc
{
  "name": "Battle Master",
  "shortName": "Battle Master",
  "source": "XPHB",
  "className": "Fighter",
  "classSource": "XPHB",
  "_copy": {
    "name": "Battle Master",
    "source": "PHB",
    "shortName": "Battle Master",
    "className": "Fighter",
    "classSource": "PHB",
    "_preserve": {"page": true, "srd": true, "reprintedAs": true}
  }
}
```

### Multiple Mods on One Property
```jsonc
"_mod": {
  "trait": [
    {"mode": "removeArr", "names": ["Amphibious"]},
    {"mode": "appendArr", "items": {"name": "Spider Climb", "entries": ["..."]}},
    {"mode": "replaceArr", "replace": "Keen Smell", "items": {"name": "Keen Senses", "entries": ["..."]}}
  ]
}
```
