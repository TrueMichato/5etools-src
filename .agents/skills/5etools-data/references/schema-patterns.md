# Schema Patterns Reference

5etools schemas use JSON Schema draft 2020-12 with strict conventions.

## File Locations

| Path | Purpose |
|------|---------|
| `schema/site/<type>.json` | Official content schemas |
| `schema/brew/<type>.json` | Homebrew schemas (similar structure, relaxed constraints) |
| `schema/site/entry.json` | Entry system definitions |
| `schema/site/util.json` | Shared utility definitions |
| `schema/site/util-*.json` | Specialized utilities (time, edition, foundry) |
| `schema/site/sources-5etools.json` | Master source book list |
| `schema/site/bestiary/` | Monster schemas (subdirectory) |
| `schema/site/spells/` | Spell schemas (subdirectory) |
| `schema/site/class/` | Class schemas (subdirectory) |

## Conventions

### $ref Usage

References pull shared definitions from other files:

```json
// Same file, local definition
{"$ref": "#/$defs/spellSchool"}

// sibling file
{"$ref": "util.json#/$defs/source"}

// parent directory  
{"$ref": "../util.json#/$defs/alignment"}

// entry system
{"$ref": "entry.json#/$defs/entryEntries"}
```

### Strict Validation

All object schemas use:
```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": { ... },
  "required": ["name", "source"]
}
```

Unknown properties fail validation. Do NOT add arbitrary fields.

### Common Required Fields

Nearly every entity requires:
- `"name"` — Display name (string)
- `"source"` — Source book abbreviation (string, e.g. `"PHB"`)

Common optional fields on most entities:
- `"page"` — Page number (integer)
- `"srd"` / `"srd52"` — SRD inclusion (boolean or string)
- `"basicRules"` / `"basicRules2024"` — Free content flag
- `"otherSources"` — Array of `{source, page}` for reprints
- `"reprintedAs"` — Array of `"Name|SOURCE"` for newer versions
- `"edition"` — `"classic"` or `"one"`
- `"hasFluff"` / `"hasFluffImages"` — Fluff availability flags

### $defs Organization

Schemas define reusable types in `$defs`:
```json
{
  "$id": "spells.json",
  "$defs": {
    "spellData": { ... },
    "spell": { ... }
  }
}
```

### Top-Level File Structure

Data schemas expect a root object with a typed array:
```json
{
  "type": "object",
  "properties": {
    "spell": {
      "type": "array",
      "items": { "$ref": "#/$defs/spell" }
    },
    "_meta": { "$ref": "util.json#/$defs/metaBlock" }
  }
}
```

## Key Definitions from util.json

### Source & Metadata
- `source` — Source book abbreviation pattern
- `page` — Integer or Roman numeral page
- `otherSources` — Reprint tracking
- `reprintedAs` — Forward reference for reprints
- `metaBlock` — File-level metadata with dependency declarations

### Ability Scores
- `abilityScoreAbbreviation` — enum: `str`, `dex`, `con`, `int`, `wis`, `cha`

### Creature Properties
- `creatureType` — humanoid, beast, construct, celestial, etc.
- `size` — T, S, M, L, H, G (always an array)
- `alignment` — Standard D&D alignment codes (L/N/C + G/N/E)

### Proficiency Definitions
- `languageProficiencies` — Language lists
- `toolProficiencies` — Tool lists
- `skillProficiencies` — Skill lists (18 standard skills)
- `weaponProficiencies` — Weapon proficiency lists

### Damage & Conditions
- `dataDamageType` — acid, cold, fire, force, lightning, necrotic, poison, psychic, radiant, thunder, bludgeoning, piercing, slashing
- `dataCondition` — blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious, exhaustion

### Tags
- `tagNameStats` — All cross-reference tag names (spell, item, creature, condition, background, race, feat, optfeature, etc.)

## Schema Editing Guidelines

1. **Always check existing $defs** before creating new ones
2. **Use $ref** for any type that appears more than once
3. **Keep `additionalProperties: false`** — relaxing this breaks validation
4. **Homebrew schemas** in `brew/` may have looser constraints (allow `_copy`, extra metadata)
5. **Test with the validator** after schema changes
6. **Entry arrays** always reference `entry.json` types: `{"$ref": "entry.json#/$defs/entry"}`
