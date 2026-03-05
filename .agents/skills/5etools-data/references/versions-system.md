# _versions System Reference

The `_versions` system generates multiple variants of a single entity (typically races/species). Each version inherits the base entity and applies modifications, similar to `_copy` but defined inline.

Resolved at data load time by `DataUtil`. For races, `Renderer.race.mergeSubraces()` expands versions into individually selectable entries.

## Simple Versions

Direct named variants with `_mod` overrides:

```jsonc
{
  "name": "Aasimar",
  "source": "MPMM",
  "page": 7,
  "resist": ["necrotic", "radiant"],
  "entries": [/* base traits */],

  "_versions": [
    {
      "name": "Aasimar; Necrotic Shroud",
      "source": "MPMM",
      "_mod": {
        "entries": {
          "mode": "replaceArr",
          "replace": "Celestial Revelation",
          "items": {
            "name": "Celestial Revelation (Necrotic Shroud)",
            "type": "entries",
            "entries": ["When you use your Celestial Revelation, necrotic energy..."]
          }
        }
      }
    },
    {
      "name": "Aasimar; Radiant Soul",
      "source": "MPMM",
      "_mod": {
        "entries": {
          "mode": "replaceArr",
          "replace": "Celestial Revelation",
          "items": {
            "name": "Celestial Revelation (Radiant Soul)",
            "type": "entries",
            "entries": ["Wings of light sprout from your back..."]
          }
        }
      }
    }
  ]
}
```

Each version object supports the same `_mod` and `_preserve` fields as `_copy`. Direct property overrides (like `"name"`, `"source"`) replace the base.

---

## Parameterized Versions (_abstract + _implementations)

For high-cardinality variants (e.g., 10 dragonborn colors), use template variables to avoid repetition:

```jsonc
{
  "name": "Dragonborn",
  "source": "XPHB",
  "size": ["M"],
  "speed": 30,
  "darkvision": 60,
  "entries": [/* base traits with generic descriptions */],

  "_versions": [
    {
      "_abstract": {
        "name": "Dragonborn ({{color}})",
        "source": "XPHB",
        "_mod": {
          "entries": [
            {
              "mode": "removeArr",
              "names": "Draconic Ancestry"
            },
            {
              "mode": "replaceArr",
              "replace": "Breath Weapon",
              "items": {
                "type": "entries",
                "name": "Breath Weapon",
                "entries": [
                  "Each creature in that area must make a Dexterity saving throw... takes {@damage 1d10} {{damageType}} damage."
                ]
              }
            },
            {
              "mode": "replaceArr",
              "replace": "Damage Resistance",
              "items": {
                "type": "entries",
                "name": "Damage Resistance",
                "entries": ["You have Resistance to {{damageType}} damage."]
              }
            }
          ]
        }
      },
      "_implementations": [
        {"_variables": {"color": "Black", "damageType": "Acid"}, "resist": ["acid"]},
        {"_variables": {"color": "Blue", "damageType": "Lightning"}, "resist": ["lightning"]},
        {"_variables": {"color": "Brass", "damageType": "Fire"}, "resist": ["fire"]},
        {"_variables": {"color": "Bronze", "damageType": "Lightning"}, "resist": ["lightning"]},
        {"_variables": {"color": "Copper", "damageType": "Acid"}, "resist": ["acid"]},
        {"_variables": {"color": "Gold", "damageType": "Fire"}, "resist": ["fire"]},
        {"_variables": {"color": "Green", "damageType": "Poison"}, "resist": ["poison"]},
        {"_variables": {"color": "Red", "damageType": "Fire"}, "resist": ["fire"]},
        {"_variables": {"color": "Silver", "damageType": "Cold"}, "resist": ["cold"]},
        {"_variables": {"color": "White", "damageType": "Cold"}, "resist": ["cold"]}
      ]
    }
  ]
}
```

### How It Works

1. The `_abstract` defines a **template** with `{{variable}}` placeholders in any string field
2. Each entry in `_implementations` provides `_variables` to fill the placeholders
3. Additional properties in each implementation (like `"resist"`) override the base directly
4. Result: one entity per implementation, each with variables substituted

### Variable Syntax

- Placeholders: `{{variableName}}` — double curly braces
- Can appear anywhere in strings: names, entries text, property values
- Each `_variables` object maps `variableName` → replacement string

---

## Version Object Fields

A version entry (simple or in `_abstract`) supports:

| Field | Description |
|-------|-------------|
| `name` | Override entity name |
| `source` | Override source |
| `_mod` | Same mod operations as `_copy._mod` |
| `_preserve` | Same preserve behavior as `_copy._preserve` |
| Any property | Direct override (e.g., `resist`, `speed`, `entries`) |

## Where _versions Are Used

| Entity Type | Example |
|-------------|---------|
| Races/Species | Dragonborn colors, Aasimar revelations, Custom Lineage options |
| Feats | Feats with multiple variants per edition |
| Items | Items with version-specific properties |

Most commonly used on **races** for variant sub-selections that replaced the older subrace system in 2024 rules.

---

## Versions vs Subraces vs _copy

| Pattern | Use Case |
|---------|----------|
| `_versions` | Inline variants of the same entity (same source/page) |
| `subraces` | Traditional subrace system (High Elf, Wood Elf under Elf) |
| `_copy` | Separate entity inheriting from another (different source or page) |

The `_versions` system is newer and used primarily in 2024 (XPHB/MPMM) race data, while `subraces` is the classic 2014 pattern.
