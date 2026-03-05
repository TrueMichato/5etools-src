# Entry System Reference

The entry system is 5etools' recursive content model. Every description, ability, trait, and text block is an array of **entries** — strings or typed objects that nest arbitrarily.

## Primitive Entries

A string or integer is a valid entry:
```json
["This is a paragraph.", "This is another paragraph."]
```

## Typed Entry Objects

Objects with a `"type"` field. All support optional `source`, `page`, `id`, `data`.

### Container Types

| Type | Description | Key Fields |
|------|-------------|------------|
| `entries` | Named section with nested entries | `name`, `entries[]` |
| `section` | Top-level section (same as entries, higher semantic level) | `name`, `entries[]` |
| `inline` | Inline entries (no line break) | `entries[]` |
| `inlineBlock` | Block-level inline | `entries[]` |
| `options` | Multiple-choice selection | `entries[]`, `count` |
| `wrapper` | Wraps entries with extra data | `entries[]`, `data` |

### List & Table Types

| Type | Description | Key Fields |
|------|-------------|------------|
| `list` | Bullet/numbered list | `items[]`, `style`, `columns` |
| `table` | Data table | `caption`, `colLabels[]`, `colStyles[]`, `rows[][]` |
| `tableGroup` | Groups related tables | `tables[]` |
| `row` | Table row (when not using array shorthand) | `row[]` |
| `cell` | Table cell | `entry`, `roll` (for rollable cells) |
| `cellHeader` | Header cell | `entry` |

### Text & Quote Types

| Type | Description | Key Fields |
|------|-------------|------------|
| `quote` | Blockquote with attribution | `entries[]`, `by`, `from` |
| `inset` | Sidebar/inset box | `name`, `entries[]` |
| `insetReadaloud` | Read-aloud text box | `name`, `entries[]` |
| `variant` | Rule variant | `name`, `entries[]` |
| `variantInner` | Inner variant block | `name`, `entries[]` |
| `variantSub` | Sub-variant | `name`, `entries[]` |

### Item Types (for lists)

| Type | Description | Key Fields |
|------|-------------|------------|
| `item` | Named list item | `name`, `entry` or `entries[]` |
| `itemSub` | Sub-item | `name`, `entry` |
| `itemSpell` | Spell list item | `name`, `entry` |

### Game Mechanic Types

| Type | Description | Key Fields |
|------|-------------|------------|
| `abilityDc` | Ability DC formula block | `name`, `attributes[]` |
| `abilityAttackMod` | Attack modifier formula block | `name`, `attributes[]` |
| `abilityGeneric` | Generic ability formula | `name`, `text`, `attributes[]` |
| `bonus` | Bonus value | `value` |
| `bonusSpeed` | Speed bonus | `value` |
| `dice` | Dice expression | `toRoll[]` (each: `{number, faces, modifier}`) |
| `spellcasting` | Creature/class spell list | `name`, `headerEntries[]`, `will[]`, `daily`, `spells` |
| `optfeature` | Optional feature | `name`, `entries[]`, `prerequisite` |

### Reference Types

| Type | Description | Key Fields |
|------|-------------|------------|
| `refClassFeature` | Reference to class feature | `classFeature` (UID string) |
| `refSubclassFeature` | Reference to subclass feature | `subclassFeature` (UID string) |
| `refOptionalfeature` | Reference to optional feature | `optionalfeature` (UID string) |
| `refFeat` | Reference to feat | `feat` (UID string) |

### Media Types

| Type | Description | Key Fields |
|------|-------------|------------|
| `image` | Image | `href`, `title`, `width`, `height` |
| `gallery` | Image gallery | `images[]` |
| `statblock` | Embedded stat block | `tag`, `name`, `source` |
| `statblockInline` | Inline stat block | `dataType`, `data` |

### Layout Types

| Type | Description |
|------|-------------|
| `hr` | Horizontal rule (no fields) |
| `flowchart` | Flowchart container |
| `flowBlock` | Flowchart node |
| `actions` | Actions block |
| `attack` | Attack block |
| `ingredient` | Recipe ingredient |

## Nesting Example

```json
{
  "type": "entries",
  "name": "Rage",
  "entries": [
    "In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action.",
    {
      "type": "list",
      "items": [
        "You have advantage on Strength checks and Strength saving throws.",
        "When you make a melee weapon attack using Strength, you gain a {@damage 1d4} bonus to the damage roll.",
        "You have resistance to bludgeoning, piercing, and slashing damage."
      ]
    },
    {
      "type": "table",
      "caption": "Rages per Level",
      "colLabels": ["Level", "Rages"],
      "rows": [
        ["1st", "2"],
        ["3rd", "3"],
        ["6th", "4"]
      ]
    }
  ]
}
```

## Spellcasting Entry Structure

```json
{
  "type": "spellcasting",
  "name": "Spellcasting",
  "headerEntries": ["The archmage is an 18th-level spellcaster..."],
  "will": ["{@spell fire bolt}", "{@spell mage hand}"],
  "daily": {
    "3e": ["{@spell counterspell}", "{@spell fly}"],
    "1e": ["{@spell time stop}"]
  },
  "spells": {
    "0": { "spells": ["{@spell fire bolt}", "{@spell light}"] },
    "1": { "slots": 4, "spells": ["{@spell magic missile}", "{@spell shield}"] },
    "9": { "slots": 1, "spells": ["{@spell wish}"] }
  }
}
```

The `daily` keys use format `<count>` or `<count>e` (e = "each"). The `spells` keys are slot levels 0-9.
