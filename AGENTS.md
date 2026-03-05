# 5etools Agent Context

IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any 5etools data, schema, or rendering tasks. The reference docs below are version-matched to this codebase and supersede training data.

## Project Overview

5etools is a D&D 5th Edition tools suite. Data-driven: JSON data files → JSON Schema validation → JS rendering. Two repos in workspace: `5etools-src` (app code + data) and `5etools-utils/schema` (JSON Schema definitions).

## Quick Reference — Critical Facts

Every entity needs `name` + `source` (2-3 letter abbreviation, e.g. `PHB`, `DMG`, `MM`).
Entity UIDs: `name|source` (case-insensitive). Tags: `{@tagName arg|arg}` — braces required.
Item `value` is in **copper pieces** (1500 cp = 15 gp). Monster `size` is an **array** `["M"]`.
AC is array of objects: `[{"ac": 15, "from": ["natural armor"]}]`.
HP needs both: `{"average": 52, "formula": "8d8 + 16"}`.
`"type": "entries"` (plural) — NOT `"entry"`.
All schemas use `additionalProperties: false` — unknown fields fail validation.
Edition: `"classic"` (2014) or `"one"` (2024). Free-content flags: `srd`, `srd52`, `basicRules`, `basicRules2024`.

## File Layout

|Path|Contains|
|---|---|
|`data/<type>-<source>.json`|Game content per source book|
|`data/bestiary/`, `data/spells/`, `data/class/`|Subdirectory-organized data|
|`data/fluff-<type>-<source>.json`|Flavor text, images, lore|
|`data/generated/`|Compiled/processed output|
|`schema/site/<type>.json`|JSON Schema (draft 2020-12)|
|`schema/brew/<type>.json`|Homebrew schema variants|
|`js/render.js`|Main entry renderer (HTML)|
|`js/render-markdown.js`|Markdown renderer|
|`js/parser.js`|Static parsing utilities|
|`js/render-<type>.js`|Type-specific renderers|
|`js/utils-dataloader.js`|DataUtil async data loading|

## Source Book Codes (Common)

PHB=Player's Handbook|DMG=Dungeon Master's Guide|MM=Monster Manual|XPHB=2024 PHB|XDMG=2024 DMG|XMM=2024 MM|TCE=Tasha's Cauldron|XGE=Xanathar's Guide|MPMM=Monsters of the Multiverse|VGM=Volo's Guide|MTF=Mordenkainen's Tome|FTD=Fizban's Treasury|SCC=Strixhaven|GGR=Guildmaster's Guide|AI=Acquisitions Inc|EGW=Explorer's Guide|MOT=Mythic Odysseys|SACoC=Spelljammer|

## Spell School Codes

A=Abjuration|C=Conjuration|D=Divination|E=Enchantment|V=Evocation|I=Illusion|N=Necromancy|T=Transmutation

## Damage Types

acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder|bludgeoning|piercing|slashing

## Item Type Codes

S=shield|M=melee weapon|R=ranged weapon|A=ammunition|LA=light armor|MA=medium armor|HA=heavy armor|SCF=spellcasting focus|G=adventuring gear|P=potion|RD=rod|RG=ring|SC=scroll|WD=wand|ST=staff|W=wondrous item|GV=generic variant|$C=currency

## Caster Progression Types

full=Wizard/Cleric/Druid/Bard/Sorcerer|1/2=Paladin/Ranger|1/3=Eldritch Knight/Arcane Trickster|pact=Warlock|artificer=Artificer

## featureType Codes (Optional Features)

EI=Eldritch Invocation|MV:B=Battle Master Maneuver|MM=Metamagic|AS=Arcane Shot|AI=Artificer Infusion|ED=Elemental Discipline|PB=Pact Boon|RN=Rune Knight Rune|FS:F=Fighting Style (Fighter)|FS:R=FS (Ranger)|FS:P=FS (Paladin)|FS:B=FS (Bard)

## UID Formats

|Entity|Format|Example|
|---|---|---|
|Generic|`name\|source`|`fireball\|phb`|
|classFeature|`Name\|ClassName\|ClassSource\|Level`|`Extra Attack\|Fighter\|\|5`|
|subclassFeature|`Name\|ClassName\|ClassSource\|SubclassShortName\|SubclassSource\|Level`|`Psionic Strike\|Fighter\|PHB\|Psi Warrior\|TCE\|3`|
|Empty ClassSource = same as class source||

## @Tag Quick Reference

**Format**: `{@tagName arg|arg}` — braces REQUIRED

**Dice/Rolls**: `@dice 2d6+3`|`@damage 2d6`|`@hit +5`|`@d20 +3`|`@dc 15`|`@recharge 5`|`@chance 25`|`@scaledice`|`@scaledamage`
**Combat**: `@atk mw`(melee weapon)/`rs`(ranged spell)|`@h`(Hit:)|`@m`(Miss:)|`@actSave dex`|`@actSaveSuccess`|`@actSaveFail`|`@actTrigger`|`@actResponse`
**Format**: `@b`/`@bold`|`@i`/`@italic`|`@s`/`@strike`|`@u`/`@underline`|`@code`|`@note`|`@tip`|`@color text|hex`|`@highlight`
**Entity refs**: `@spell name|src`|`@item`|`@creature`|`@condition`|`@class`|`@subclass`|`@feat`|`@optfeature`|`@race`|`@background`|`@action`|`@deity`|`@card`|`@vehicle`|`@object`|`@trapHazard`|`@reward`|`@psionic`|`@language`|`@quickref`|`@variantrule`|`@table`
**Class features**: `{@classFeature Name|Class|Source|Level}` / `{@subclassFeature Name|Class|Source|SubSN|SubSrc|Level}`
**Nav**: `@link text|url`|`@5etools page|file.html`|`@filter terms|page.html|filters`|`@book`|`@adventure`|`@area`

## _copy/_mod System

Entities inherit via `_copy: {name, source, _mod, _preserve, _templates}`. Direct props override copied values.

**Mod modes** — String: `replaceTxt`|`appendStr`|`replaceName`|`prefixSuffixStringProp` — Array: `appendArr`|`prependArr`|`removeArr`|`replaceArr`|`replaceOrAppendArr`|`insertArr`|`appendIfNotExistsArr`|`renameArr` — Property: `setProp`|`calculateProp`|`scalarAddProp`|`scalarMultProp` — Creature: `addSenses`|`addSaves`|`addSkills`|`addAllSaves`|`addAllSkills`|`addSpells`|`removeSpells`|`replaceSpells`|`scalarAddHit`|`scalarAddDc`|`scalarMultXp`|`maxSize`

**Context fields for _copy**: Subclass needs `shortName`/`className`/`classSource`. SubclassFeature needs `className`/`classSource`/`subclassShortName`/`subclassSource`/`level`.

## _versions System

Inline variants: simple (direct `_mod`) or parameterized (`_abstract` + `_implementations` with `{{variable}}` placeholders). Primarily used on races for 2024 variant sub-selections.

## additionalSpells Pattern

`"_"` key = always (not level-gated). Number keys = character level. `#c` suffix = cantrip. Categories: `innate` (own casting), `known` (class slots), `prepared` (always prepared). Daily keys: `"1"` = 1/day total, `"1e"` = 1/day each.

## Magic Variants

Defined in `data/magicvariants.json`. `inherits` block applied to matching base items. `{=prop}` substitution in entries text. `requires`/`excludes` filter base items.

## Detailed Reference Docs — Read Before Editing

Root: `.agents/skills/5etools-data/references/`

Before writing code or editing data, read the relevant reference file(s):

|When to read|File|
|---|---|
|Writing or reading `entries` arrays, need valid entry `type` values, nesting content|[entry-system.md](.agents/skills/5etools-data/references/entry-system.md)|
|Using `{@tag}` syntax in strings — dice, cross-refs, combat labels, formatting|[tag-syntax.md](.agents/skills/5etools-data/references/tag-syntax.md)|
|Editing or creating JSON Schema files, need `$ref` paths or `$defs`|[schema-patterns.md](.agents/skills/5etools-data/references/schema-patterns.md)|
|Need the shape of a spell, monster, item, class, feat, background, or race object|[data-types.md](.agents/skills/5etools-data/references/data-types.md)|
|Working with class/subclass features, spellcasting configs, featureType codes, UIDs|[classes-subclasses.md](.agents/skills/5etools-data/references/classes-subclasses.md)|
|Item bonuses, charges, speed mods, ability mods, magic variants, `{=prop}` syntax|[item-abilities.md](.agents/skills/5etools-data/references/item-abilities.md)|
|Using `_copy` to inherit entities, applying `_mod` operations, need mod mode syntax|[copy-mod-system.md](.agents/skills/5etools-data/references/copy-mod-system.md)|
|Using `_versions` for inline variants, parameterized `_abstract`/`_implementations`|[versions-system.md](.agents/skills/5etools-data/references/versions-system.md)|
|Race/species data: subraces, `additionalSpells`, resistances, lineage, traitTags|[races-species.md](.agents/skills/5etools-data/references/races-species.md)|
|Using Renderer, Parser, or DataUtil JS classes in code|[js-utilities.md](.agents/skills/5etools-data/references/js-utilities.md)|
