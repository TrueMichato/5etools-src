# Item Abilities & Effects Reference

## Item Bonus Fields

These fields represent mechanical bonuses granted by magic items:

```jsonc
{
  // Attack & Damage
  "bonusWeapon": "+1",                     // +N to attack AND damage rolls
  "bonusWeaponAttack": "+1",               // +N to attack rolls only
  "bonusWeaponDamage": "+1",               // +N to damage rolls only
  "bonusWeaponCritDamage": "+1",           // +N extra damage on crits

  // Spellcasting
  "bonusSpellAttack": "+1",                // +N to spell attack rolls
  "bonusSpellDamage": "+1",                // +N to spell damage rolls
  "bonusSpellSaveDc": "+1",               // +N to spell save DC

  // Defense & Saves
  "bonusAc": "+1",                         // +N to Armor Class
  "bonusSavingThrow": "+1",               // +N to all saving throws
  "bonusSavingThrowConcentration": "+1",   // +N to concentration saves

  // General
  "bonusAbilityCheck": "+1",               // +N to all ability checks
  "bonusProficiencyBonus": "+1"            // +N to proficiency bonus
}
```

## Item Ability Score Modifications

```jsonc
"ability": {
  // Set scores to fixed values
  "static": {"str": 19, "dex": 18},

  // Direct ability score increases
  "str": 2, "dex": 1,

  // Choose from options
  "choose": [{
    "from": ["str", "dex", "con", "int", "wis", "cha"],
    "count": 1,
    "amount": 2
  }]
}
```

## Speed Modifications

```jsonc
"modifySpeed": {
  "static": {"walk": 60},              // set speed to exact value
  "bonus": {"walk": 10, "fly": 10},    // add to speed
  "multiply": {"walk": 2},             // multiply speed
  "equal": {"fly": "walk"}             // set one speed equal to another
}
```

## Spellcasting Focus

```jsonc
"focus": ["Druid", "Ranger"]            // classes that can use this as a focus
// or
"focus": true                            // universal arcane focus
```

## Attached Spells

Items that grant spells:

```jsonc
"attachedSpells": ["fireball|phb", "shield|phb"]  // simple array of spell UIDs
```

## Charges

```jsonc
"charges": 7,                            // integer: number of charges
"recharge": "dawn",                      // when charges restore: "dawn", "dusk", "midnight"
"rechargeAmount": "{@dice 1d6 + 1}"      // how many charges restore
```

## Real Item Examples

### Weapon with Bonuses (+2 Moon Sickle)

```jsonc
{
  "name": "+2 Moon Sickle",
  "source": "TCE",
  "page": 133,
  "baseItem": "sickle|PHB",
  "type": "M",
  "rarity": "rare",
  "reqAttune": "by a druid or ranger",
  "reqAttuneTags": [{"class": "druid"}, {"class": "ranger"}],
  "weaponCategory": "simple",
  "property": ["L"],
  "dmg1": "1d4",
  "dmgType": "S",
  "bonusWeapon": "+2",
  "bonusSpellAttack": "+2",
  "bonusSpellSaveDc": "+2",
  "focus": ["Druid", "Ranger"],
  "entries": [
    "This silver-bladed sickle glimmers softly with moonlight. While holding this magic weapon, you gain a +2 bonus to attack and damage rolls made with it, and you gain a +2 bonus to spell attack rolls and the saving throw DCs of your druid and ranger spells.",
    "When you cast a spell that restores hit points, you can roll a {@dice d4} and add the number rolled to the amount of hit points restored, provided you are holding the sickle."
  ]
}
```

### Armor with AC Bonus

```jsonc
{
  "name": "+1 Shield",
  "source": "DMG",
  "type": "S",
  "rarity": "uncommon",
  "bonusAc": "+1",
  "entries": [
    "While holding this shield, you have a +1 bonus to AC. This bonus is in addition to the shield's normal bonus to AC."
  ]
}
```

### Item with Charges

```jsonc
{
  "name": "Staff of Fire",
  "source": "DMG",
  "type": "ST",
  "rarity": "very rare",
  "reqAttune": "by a druid, sorcerer, warlock, or wizard",
  "charges": 10,
  "recharge": "dawn",
  "rechargeAmount": "{@dice 1d6 + 4}",
  "focus": ["Druid", "Sorcerer", "Warlock", "Wizard"],
  "attachedSpells": ["burning hands|phb", "fireball|phb", "wall of fire|phb"],
  "entries": [
    "You have resistance to fire damage while you hold this staff.",
    "The staff has 10 charges. While holding it, you can use an action to expend 1 or more charges to cast one of the following spells from it, using your spell save DC: {@spell burning hands|phb} (1 charge), {@spell fireball|phb} (3 charges), or {@spell wall of fire|phb} (4 charges)."
  ]
}
```

### Item with Ability Score Set

```jsonc
{
  "name": "Belt of Hill Giant Strength",
  "source": "DMG",
  "rarity": "rare",
  "reqAttune": true,
  "ability": {"static": {"str": 21}},
  "entries": [
    "While wearing this belt, your Strength score changes to 21. If your Strength is already 21 or higher, the belt has no effect on you."
  ]
}
```

### Item with Speed Modification

```jsonc
{
  "name": "Boots of Speed",
  "source": "DMG",
  "rarity": "rare",
  "reqAttune": true,
  "modifySpeed": {"multiply": {"walk": 2}},
  "entries": [
    "While you wear these boots, you can use a bonus action and click the boots' heels together. If you do, the boots double your walking speed..."
  ]
}
```

---

## Magic Variants System

Generic magic variants (+1/+2/+3 weapons/armor) are defined in `data/magicvariants.json` using an `inherits` pattern:

```jsonc
{
  "name": "Weapon, +1",
  "source": "DMG",
  "type": "GV",                  // GV = Generic Variant
  "requires": [
    {"weapon": true}             // applies to any weapon
  ],
  "excludes": {"name": "..."},   // optional exclusions
  "inherits": {
    "source": "DMG",
    "page": 213,
    "rarity": "uncommon",
    "bonusWeapon": "+1",
    "namePrefix": "+1 ",
    "nameRemove": "",
    "entries": ["You have a {=bonusWeapon} bonus to attack and damage rolls made with this magic weapon."],
    "lootTables": ["Magic Item Table F"]
  }
}
```

The `inherits` block is applied to each matching base weapon. `namePrefix`/`nameSuffix` modify the base item name.

### `{=prop}` Substitution in inherits

Entry text in `inherits` supports `{=propertyName}` substitution — replaced with the variant's own property value at build time. Example: `{=bonusWeapon}` becomes `"+1"`.

### inherits Properties

| Field | Purpose |
|-------|---------|
| `namePrefix` / `nameSuffix` | Added to base item name |
| `nameRemove` | Text removed from base item name |
| `source`, `page` | Publication metadata |
| `rarity`, `tier` | Item classification |
| `bonusWeapon`, `bonusAc`, etc. | Mechanical bonuses |
| `entries` | Description (supports `{=prop}` substitution) |
| `lootTables` | Treasure table references |
| `srd`, `srd52`, `basicRules2024` | Free content flags |
| `reprintedAs` | Cross-edition references |

### Multi-Edition Variants

Magic variants can have separate entries per edition:
```jsonc
[
  {"name": "+1 Ammunition", "edition": "classic", "type": "GV|DMG", "inherits": {/* DMG version */}},
  {"name": "+1 Ammunition", "type": "GV|XDMG", "inherits": {/* XDMG 2024 version */}}
]
```

### requires / excludes Filters

```jsonc
"requires": [
  {"weapon": true},                     // any weapon
  {"armor": true},                      // any armor
  {"type": "M"},                        // specific item type
  {"type": "S"},                        // shields
  {"type": "LA|MA|HA"},                 // light/medium/heavy armor
  {"property": "A"},                    // items with specific property
  {"name": "Longsword", "source": "PHB"} // specific item
],
"excludes": {
  "name": "Net",                        // exclude specific items
  "property": "S"                       // exclude by property
}
```

---

## Optional Features (Invocations, Maneuvers, Fighting Styles, etc.)

File: `data/optionalfeatures.json`

```jsonc
{
  "name": "Agonizing Blast",
  "source": "PHB",
  "page": 110,
  "srd": true,
  "featureType": ["EI"],                 // Eldritch Invocation
  "prerequisite": [
    {"spell": ["eldritch blast#c"]}      // requires knowing the spell
  ],
  "entries": [
    "When you cast {@spell eldritch blast}, add your Charisma modifier to the damage it deals on a hit."
  ]
}
```

### featureType Codes

| Code | Type | Class |
|------|------|-------|
| `EI` | Eldritch Invocation | Warlock |
| `MV:B` | Maneuver (Battle Master) | Fighter |
| `MM` | Metamagic | Sorcerer |
| `AS` | Arcane Shot | Fighter |
| `AI` | Artificer Infusion | Artificer |
| `ED` | Elemental Discipline | Monk |
| `PB` | Pact Boon | Warlock |
| `RN` | Rune | Fighter (Rune Knight) |
| `FS:F` | Fighting Style | Fighter |
| `FS:R` | Fighting Style | Ranger |
| `FS:P` | Fighting Style | Paladin |
| `FS:B` | Fighting Style | Bard |
| `FS:D` | Fighting Style | Druid |

### Prerequisite Types

```jsonc
"prerequisite": [
  {"level": 5},                          // character level
  {"level": {"level": 5, "class": {"name": "Warlock"}}},  // class level
  {"spell": ["hex#c", "eldritch blast#c"]},  // known spells
  {"pact": "Chain"},                     // pact boon
  {"patron": "The Fiend"},               // warlock patron
  {"feature": ["Pact of the Blade"]},    // class features
  {"item": ["shield|phb"]},              // equipped items
  {"race": [{"name": "Elf"}]}            // race
]
```

### Maneuver with Resource Consumption

```jsonc
{
  "name": "Ambush",
  "source": "TCE",
  "featureType": ["MV:B"],
  "consumes": {"name": "Superiority Die"},
  "entries": [
    "When you make a Dexterity ({@skill Stealth}) check or an initiative roll, you can expend one superiority die..."
  ]
}
```

### Fighting Style

```jsonc
{
  "name": "Archery",
  "source": "PHB",
  "page": 72,
  "featureType": ["FS:F", "FS:R"],       // available to Fighter and Ranger
  "entries": [
    "You gain a +2 bonus to attack rolls you make with ranged weapons."
  ]
}
```
