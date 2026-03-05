---
name: 5etools-data
description: "Work with 5etools D&D data structures and JSON schemas. Use when: editing data JSON files, writing or fixing schema definitions, parsing @tag syntax, creating entries, building monsters/spells/items/classes, understanding entry types, validating data against schemas, cross-referencing entities, working with the Renderer or Parser classes, homebrew data, data loading utilities, class features and subclass abilities, item bonuses and magic effects, _copy/_mod entity inheritance, optional features (invocations/maneuvers/fighting styles), spellcasting progression, magic variants, _versions system for race/species variants, additionalSpells patterns, race/species data."
argument-hint: "Describe what you're working on (e.g., 'add a new spell', 'fix monster schema')"
---

# 5etools Data Structures

## When to Use

- Editing or creating data JSON files (bestiary, spells, items, classes, etc.)
- Writing or modifying JSON Schema definitions
- Using `@tag` syntax in entry strings
- Building or fixing recursive `entries` arrays
- Understanding how entities cross-reference each other
- Working with the `Renderer` or `Parser` JS classes
- Validating data files against schemas
- Creating homebrew content

## Key Concepts

### File Layout

| Path | Contains |
|------|----------|
| `data/<type>-<source>.json` | Game content per source book |
| `data/fluff-<type>-<source>.json` | Flavor text, images, lore |
| `data/generated/` | Compiled/processed output |
| `schema/site/<type>.json` | JSON Schema (draft 2020-12) |
| `schema/brew/<type>.json` | Homebrew schema variants |
| `js/render.js` | Main entry renderer (HTML) |
| `js/render-markdown.js` | Markdown renderer |
| `js/parser.js` | Static parsing utilities |
| `js/render-<type>.js` | Type-specific renderers |
| `js/utils-dataloader.js` | `DataUtil` async data loading |

### Source Book References

Every entity carries `"source": "PHB"` (2-3 letter abbreviation) and `"page": 123`. Edition tracking uses `"edition": "classic"` (2014) or `"edition": "one"` (2024). Free-content flags: `srd`, `srd52`, `basicRules`, `basicRules2024`.

### Entity UIDs

Entities are referenced as `name|source` (e.g., `fireball|phb`, `longsword|dmg`). Case-insensitive. Used in `@tag` syntax and internal cross-references.

## Procedure

### 1. Identify What You're Working With

Determine the entity type and find the relevant files:
- **Data file**: `data/<type>-<source>.json` (or a subdirectory like `data/bestiary/`, `data/spells/`, `data/class/`)
- **Schema**: `schema/site/<type>.json` (or `schema/brew/` for homebrew)
- **Renderer**: `js/render-<type>.js`

### 2. Consult the Right Reference

Load the reference that matches your task:

| Task | Reference |
|------|-----------|
| Writing or reading `entries` arrays | [Entry System](./references/entry-system.md) |
| Using `@spell`, `@damage`, `@dc`, etc. in strings | [Tag Syntax](./references/tag-syntax.md) |
| Understanding/editing JSON Schema files | [Schema Patterns](./references/schema-patterns.md) |
| Working with specific entity types (monster, spell, item, class, feat) | [Data Types](./references/data-types.md) |
| Class/subclass features, spellcasting progression, optional features, UIDs | [Classes & Subclasses](./references/classes-subclasses.md) |
| Item bonuses, charges, speed mods, magic variants, optional features | [Item Abilities & Effects](./references/item-abilities.md) |
| Entity inheritance (`_copy`), modifications (`_mod`), all mod modes | [Copy/Mod System](./references/copy-mod-system.md) |
| `_versions` system, parameterized variants, `_abstract`/`_implementations` | [Versions System](./references/versions-system.md) |
| Race/species data, subraces, `additionalSpells`, lineage, traits | [Races & Species](./references/races-species.md) |
| Using Renderer or Parser JS classes | [JS Utilities](./references/js-utilities.md) |

### 3. Validate Changes

After editing data files:
- Ensure all required fields are present (`name`, `source`, `page`)
- Verify `entries` arrays contain valid entry types (strings, objects with `"type"`)
- Check `@tag` syntax: `{@tagName args}` — braces required, pipe-delimited args
- Run schema validation if available

### 4. Common Pitfalls

- **Missing braces on tags**: Write `{@spell fireball|phb}`, NOT `@spell fireball|phb`
- **Wrong entry type string**: `"type": "entry"` is invalid — use `"type": "entries"` (plural)
- **Copper pieces for value**: Item `"value"` is always in copper pieces (100 cp = 1 gp)
- **Size is an array**: Monster `"size"` is `["M"]`, not `"M"`
- **AC is an array of objects**: `"ac": [{"ac": 15, "from": ["natural armor"]}]`
- **HP formula**: `"hp": {"average": 52, "formula": "8d8 + 16"}` — both required
- **`additionalProperties: false`** in schemas — adding unknown fields will fail validation
- **classFeature UID format**: `Name|ClassName|ClassSource|Level` — empty ClassSource = same as class
- **subclassFeature UID format**: `Name|ClassName|ClassSource|SubclassShortName|SubclassSource|Level`
- **optionalfeatureProgression values are cumulative** — total known, not gained at that level
- **_copy needs context fields** for subclasses (`shortName`, `className`, `classSource`)
- **_mod modes on arrays need `items`** (object or array), `names` (for removeArr), or `replace` (for replaceArr)
- **`_versions` uses `{{variable}}` syntax** — double-brace placeholders replaced from `_variables` objects
- **Race `additionalSpells` uses `_` key** for "always" (not level-gated); spell UIDs use `#c` suffix for cantrips
- **`inherits` in magic variants uses `{=prop}` substitution** — e.g., `{=bonusWeapon}` resolves to the variant's bonus value
