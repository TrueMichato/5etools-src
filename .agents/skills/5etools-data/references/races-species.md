# Races & Species Reference

## File Location

- `data/races.json` — main race data (most races)
- `data/fluff-races.json` — flavor text and images
- Schema: `schema/site/races.json`

---

## Race Object Shape

```jsonc
{
  "name": "Elf",
  "source": "PHB",
  "page": 21,
  "edition": "classic",

  // Physical
  "size": ["M"],                           // Array: T/S/M/L/H/G
  "speed": 30,                             // integer or object (see below)
  "darkvision": 60,                        // integer (feet)
  "creatureTypes": ["humanoid"],           // defaults to humanoid if omitted

  // Resistances & Immunities
  "resist": ["necrotic", "radiant"],       // damage types
  "immune": ["disease"],                   // damage immunities
  "conditionImmune": ["charmed"],          // condition immunities
  // Each can also be a choice:
  // "resist": [{"choose": {"from": ["acid", "cold", "fire"], "count": 1}}]

  // Ability Scores
  "ability": [{"dex": 2}],                // array of ability objects
  // or with choice:
  // "ability": [{"choose": {"from": ["str","dex","con","int","wis","cha"], "count": 2, "amount": 1}}]

  // Proficiencies
  "skillProficiencies": [
    {"perception": true},
    {"choose": {"from": ["arcana", "history", "nature"], "count": 1}}
  ],
  "toolProficiencies": [
    {"anyMusicalInstrument": 1}
  ],
  "languageProficiencies": [
    {"common": true, "elvish": true},
    {"anyStandard": 1}                     // choose 1 standard language
  ],
  "weaponProficiencies": [
    {"longsword|phb": true, "shortbow|phb": true}
  ],
  "armorProficiencies": [
    {"light": true}
  ],

  // Spells Granted
  "additionalSpells": [/* see section below */],

  // Descriptive
  "entries": [/* entry objects describing racial traits */],
  "traitTags": ["Darkvision", "Trance", "Skill Proficiency"],
  "heightAndWeight": {
    "baseHeight": 54,
    "heightMod": "2d10",
    "baseWeight": 110,
    "weightMod": "2d4"
  },
  "age": {"mature": 20, "max": 750},
  "soundClip": {"type": "internal", "path": "races/elf.mp3"},

  // Legacy/edition
  "lineage": "VRGR",                      // marks lineage-system races (2024+)
  "reprintedAs": ["Elf|XPHB"],

  // Subraces (classic pattern)
  "subraces": [/* subrace objects */],

  // Versions (modern pattern — see versions-system.md)
  "_versions": [/* version objects */],

  "hasFluff": true,
  "hasFluffImages": true
}
```

---

## Speed Variants

```jsonc
// Simple integer (walk speed)
"speed": 30

// Object with multiple movement modes
"speed": {
  "walk": 30,
  "fly": 60,                   // fly speed in feet
  "swim": 30,                  // swim speed
  "climb": 30,                 // climb speed
  "burrow": 15                 // burrow speed
}

// Conditional speed  
"speed": {
  "walk": 30,
  "fly": {"number": 30, "condition": "while not wearing heavy armor"}
}
```

---

## Subraces (Classic 2014 Pattern)

```jsonc
{
  "name": "High Elf",
  "source": "PHB",
  "page": 23,
  "ability": [{"int": 1}],                // stacks with base race
  "weaponProficiencies": [
    {"longsword|phb": true, "shortsword|phb": true, "shortbow|phb": true, "longbow|phb": true}
  ],
  "additionalSpells": [
    {
      "ability": "int",
      "known": {"_": [{"choose": "level=0|class=Wizard"}]}
    }
  ],
  "entries": [/* subrace trait entries */],
  "hasFluff": true
}
```

Subraces inherit from their parent race. Properties defined on the subrace add to or override the base.

---

## additionalSpells

Grants spells to the race. Three main categories: `innate`, `known`, and `prepared`.

### Structure

```jsonc
"additionalSpells": [
  {
    "ability": "cha",                      // spellcasting ability for these spells
    // or choice:
    // "ability": {"choose": ["int", "wis", "cha"]},

    // Innate spells (no spell slots, use own casting rules)
    "innate": {
      "_": {                               // "_" = always (no level requirement)
        "will": ["light#c"],               // at-will cantrips (#c required for cantrip)
        "daily": {
          "1": ["{@spell faerie fire|phb}"],   // 1/day
          "1e": ["{@spell shield}"],           // 1/day each
          "2": ["{@spell misty step}"]         // 2/day
        },
        "rest": {
          "1": ["{@spell detect magic}"]       // 1/rest
        }
      },
      "3": {                               // gained at character level 3
        "daily": {"1": ["{@spell darkness}"]}
      },
      "5": {                               // gained at character level 5  
        "daily": {"1": ["{@spell daylight}"]}
      }
    },

    // Known spells (learned, use class spell slots)
    "known": {
      "_": [
        "light#c",                         // always-known cantrip
        {"choose": "level=0|class=Wizard"} // choose from wizard cantrips
      ],
      "3": ["detect magic"],               // learned at level 3
      "5": ["darkness"]                    // learned at level 5
    },

    // Prepared spells (always prepared, don't count against limit)
    "prepared": {
      "_": ["cure wounds", "lesser restoration"]
    }
  }
]
```

### Key Patterns

- **`_` key** = always available (not level-gated)
- **Number keys** (`"3"`, `"5"`, etc.) = gained at that character level
- **`#c` suffix** on spell names = cantrip marker
- **`daily` sub-keys**: `"1"` = once/day total, `"1e"` = once/day **each**, `"2"` = twice/day
- **`will`** = at-will (unlimited uses)
- **`rest`** = recharges on rest
- **`{choose: "level=N|class=ClassName"}`** = player picks from a filtered spell list

---

## resist / immune / conditionImmune

Three equivalent patterns:

```jsonc
// Fixed list
"resist": ["necrotic", "radiant"]

// Player choice
"resist": [{"choose": {"from": ["acid", "cold", "fire", "lightning", "poison"], "count": 1}}]

// Mixed (some fixed, some chosen)
"resist": ["radiant", {"choose": {"from": ["cold", "fire"]}}]
```

Valid damage types: `acid`, `bludgeoning`, `cold`, `fire`, `force`, `lightning`, `necrotic`, `piercing`, `poison`, `psychic`, `radiant`, `slashing`, `thunder`.

Valid conditions: `blinded`, `charmed`, `deafened`, `exhaustion`, `frightened`, `grappled`, `incapacitated`, `invisible`, `paralyzed`, `petrified`, `poisoned`, `prone`, `restrained`, `stunned`, `unconscious`.

---

## traitTags

String tags describing race capabilities:

| Tag | Meaning |
|-----|---------|
| `Amphibious` | Can breathe air and water |
| `Armor Proficiency` | Grants armor proficiency |
| `Damage Resistance` | Has damage resistance |
| `Darkvision` | Has darkvision |
| `Dragonmark` | Dragonmark race |
| `Improved Resting` | Modified rest mechanics (e.g., Trance) |
| `Magic Resistance` | Advantage on saves vs. magic |
| `Monstrous Race` | Monstrous creature type |
| `Natural Armor` | Has natural AC calculation |
| `Natural Weapon` | Has natural weapons |
| `NPC Race` | Designed for NPCs, not PCs |
| `Powerful Build` | Counts as one size larger for carry/push/lift |
| `Skill Proficiency` | Grants skill proficiency |
| `Spellcasting` | Grants spellcasting ability |
| `Telepathy` | Has telepathy |
| `Tool Proficiency` | Grants tool proficiency |
| `Uncommon Race` | Less common/available race |
| `Weapon Proficiency` | Grants weapon proficiency |

---

## Lineage System (2024+)

Races with `"lineage": "VRGR"` (or similar source tag) use the lineage system instead of subraces. These let players choose ability scores, proficiencies, and other traits freely:

```jsonc
{
  "name": "Custom Lineage",
  "source": "TCE",
  "lineage": "VRGR",
  "size": ["S", "M"],                     // player chooses
  "speed": 30,
  "skillProficiencies": [
    {"choose": {"from": ["any"], "count": 1}}
  ],
  "entries": [/* trait descriptions */],
  "_versions": [
    {
      "name": "Custom Lineage; Darkvision",
      "source": "TCE",
      "darkvision": 60,
      "_mod": {/* override feat entry */}
    },
    {
      "name": "Custom Lineage; Skill Proficiency",
      "source": "TCE",
      "skillProficiencies": [{"any": 1}],
      "_mod": {/* override feat entry */}
    }
  ]
}
```

The `_versions` system is the primary mechanism for modern race variants. See [Versions System](./versions-system.md) for details.
