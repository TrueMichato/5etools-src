# Data Types Reference

Key entity schemas and their shapes. All entities require `name` and `source`.

## Spell

```jsonc
{
  "name": "Fireball",
  "source": "PHB",
  "page": 241,
  "level": 3,                    // 0 = cantrip, 1-9 = spell level
  "school": "V",                 // A=Abjuration, C=Conjuration, D=Divination,
                                 // E=Enchantment, V=Evocation, I=Illusion,
                                 // N=Necromancy, T=Transmutation
  "time": [{"number": 1, "unit": "action"}],
  "range": {
    "type": "point",             // point, line, cone, cube, sphere, hemisphere, special, self
    "distance": {"type": "feet", "amount": 150}
  },
  "components": {
    "v": true,                   // verbal
    "s": true,                   // somatic
    "m": "a tiny ball of bat guano and sulfur"  // material (string or {text, cost, consume})
  },
  "duration": [{"type": "instant"}],  // instant, timed, permanent, special
  "entries": ["Each creature in a 20-foot-radius sphere..."],
  "entriesHigherLevel": [
    {
      "type": "entries",
      "name": "At Higher Levels",
      "entries": ["When you cast this spell using a spell slot of 4th level or higher..."]
    }
  ],
  "damageInflict": ["fire"],
  "savingThrow": ["dex"],
  "areaTags": ["S"],             // S=sphere, C=cone, L=line, Q=cube, etc.
  "classes": {
    "fromClassList": [{"name": "Sorcerer", "source": "PHB"}, {"name": "Wizard", "source": "PHB"}]
  }
}
```

## Monster / Creature

```jsonc
{
  "name": "Goblin",
  "source": "MM",
  "page": 166,
  "size": ["S"],                 // Array! T/S/M/L/H/G
  "type": "humanoid",            // or {type, tags[]} for subtypes
  "alignment": ["N", "E"],       // 2-element array
  "ac": [{"ac": 15, "from": ["{@item leather armor|phb}", "{@item shield|phb}"]}],
  "hp": {"average": 7, "formula": "2d6"},
  "speed": {"walk": 30},         // walk, fly, swim, climb, burrow; or {number, condition}
  "str": 8, "dex": 14, "con": 10, "int": 10, "wis": 8, "cha": 8,
  "skill": {"stealth": "+6"},
  "senses": ["darkvision 60 ft."],
  "passive": 9,
  "languages": ["Common", "Goblin"],
  "cr": "1/4",                   // string: "0"-"30", "1/8", "1/4", "1/2"
  "trait": [{"name": "Nimble Escape", "entries": ["The goblin can take the Disengage or Hide action as a bonus action..."]}],
  "action": [{"name": "Scimitar", "entries": ["{@atk mw} {@hit +4} to hit, reach 5 ft., one target. {@h}{@damage 1d6 + 2} slashing damage."]}],
  "reaction": [],
  "legendary": [],               // legendary actions
  "legendaryGroup": {"name": "GroupName", "source": "SRC"},
  "environment": ["forest", "hill"],
  "token": {"name": "Goblin", "source": "MM"},
  "damageTags": ["S"],           // S=slashing, P=piercing, B=bludgeoning, etc.
  "miscTags": ["MW"]             // MW=melee weapon, RW=ranged weapon, etc.
}
```

## Item / Magic Item

```jsonc
{
  "name": "Longsword",
  "source": "PHB",
  "page": 149,
  "type": "M",                   // S=shield, M=melee weapon, R=ranged weapon,
                                 // A=ammunition, LA=light armor, MA=medium armor,
                                 // HA=heavy armor, SCF=spellcasting focus, etc.
  "rarity": "none",              // none, common, uncommon, rare, very rare, legendary, artifact
  "weight": 3,
  "value": 1500,                 // COPPER PIECES (1500 cp = 15 gp)
  "weaponCategory": "martial",   // simple, martial
  "property": ["V"],             // V=versatile, F=finesse, H=heavy, L=light, T=thrown, etc.
  "dmg1": "1d8",                 // primary damage
  "dmgType": "S",                // S=slashing, P=piercing, B=bludgeoning
  "dmg2": "1d10",                // versatile damage (if applicable)
  "sword": true,                 // weapon group flag
  "entries": [],
  "reqAttune": true,             // true, or string describing requirement
  "reqAttuneTags": [{"class": "wizard"}],
  "bonusWeapon": "+1",           // for magic weapons
  "bonusAc": "+1",               // for magic armor/shields
  "bonusSpellAttack": "+1",
  "bonusSpellSaveDc": "+1"
}
```

## Class

```jsonc
{
  "name": "Fighter",
  "source": "PHB",
  "page": 70,
  "hd": {"number": 1, "faces": 10},   // hit die
  "proficiency": ["str", "con"],        // saving throw proficiencies
  "spellcastingAbility": "int",         // if spellcaster
  "casterProgression": "full",          // full, 1/2, 1/3, pact, artificer
  "preparedSpells": "<$level$> / 2 + <$int_mod$>",  // formula string
  "startingProficiencies": {
    "armor": ["light", "medium", "heavy", "{@item shield|phb}"],
    "weapons": ["simple", "martial"],
    "skills": [{"choose": {"from": ["acrobatics", "athletics", "history"], "count": 2}}]
  },
  "startingEquipment": {
    "default": ["(a) {@item chain mail|phb} or (b) {@item leather armor|phb}"],
    "goldAlternative": "{@dice 5d4 × 10|5d4 × 10} gp"
  },
  "classTableGroups": [{
    "colLabels": ["Proficiency Bonus", "Features"],
    "rows": [/* 20 rows, one per level */]
  }],
  "classFeatures": [
    "Fighting Style|Fighter|PHB|1",      // UID format: name|class|source|level
    "Second Wind|Fighter|PHB|1",
    "Action Surge|Fighter|PHB|2"
  ],
  "subclassTitle": "Martial Archetype"
}
```

## Feat

```jsonc
{
  "name": "Alert",
  "source": "PHB",
  "page": 165,
  "category": "G",              // G=general, FS=fighting style, D=dragonmark, etc.
  "prerequisite": [{"level": 4}],  // or ability score, race, class, etc.
  "ability": [{"choose": {"from": ["dex", "int"], "amount": 1}}],
  "entries": ["Always on the lookout for danger, you gain the following benefits:..."],
  "repeatable": false
}
```

## Background

```jsonc
{
  "name": "Acolyte",
  "source": "PHB",
  "page": 127,
  "skillProficiencies": [{"insight": true, "religion": true}],
  "languageProficiencies": [{"anyStandard": 2}],
  "startingEquipment": [{"a": [/* items */]}],
  "entries": [/* description entries */],
  "hasFluff": true
}
```

## Race

```jsonc
{
  "name": "Elf",
  "source": "PHB",
  "page": 21,
  "size": ["M"],
  "speed": 30,                    // or {walk: 30, fly: 30}
  "ability": [{"dex": 2}],
  "darkvision": 60,
  "traitTags": ["Darkvision", "Trance"],
  "languageProficiencies": [{"common": true, "elvish": true}],
  "entries": [/* racial traits */],
  "subraces": [/* subrace objects */]
}
```

## Data File Root Structure

All data files follow this pattern:
```jsonc
{
  // Array of entities (key matches entity type)
  "spell": [/* spell objects */],
  // OR
  "monster": [/* monster objects */],
  // OR  
  "item": [/* item objects */],
  
  // Optional metadata
  "_meta": {
    "sources": [{"json": "PHB", "full": "Player's Handbook", "abbreviation": "PHB"}],
    "dependencies": {"monster": ["MM"]},
    "internalCopies": ["monster"]
  }
}
```

## The _copy System

Entities can inherit from other entities:
```jsonc
{
  "name": "Adult Gold Dragon (Variant)",
  "source": "MM",
  "_copy": {
    "name": "Adult Gold Dragon",
    "source": "MM",
    "_mod": {
      "action": [{"mode": "appendArr", "items": {"name": "Change Shape", "entries": ["..."]}}],
      "trait": [{"mode": "removeArr", "names": "Amphibious"}]
    }
  }
}
```

Mod modes: `appendArr`, `prependArr`, `removeArr`, `replaceArr`, `insertArr`, `replaceTxt`, `scalarAdd`, `scalarMultProp`.
