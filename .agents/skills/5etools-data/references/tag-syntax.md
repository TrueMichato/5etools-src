# @Tag Syntax Reference

5etools uses `{@tag args}` syntax within entry strings for cross-references, dice, formatting, and game mechanics. Tags are always wrapped in curly braces. Arguments are pipe-delimited.

## Syntax

```
{@tagName requiredArg|optionalArg|optionalArg2}
```

Braces `{}` are **required**. Omitting them is a common bug.

## Text Formatting

| Tag | Usage | Output |
|-----|-------|--------|
| `@b` / `@bold` | `{@b bold text}` | **bold text** |
| `@i` / `@italic` | `{@i italic text}` | *italic text* |
| `@s` / `@strike` | `{@s struck text}` | ~~struck text~~ |
| `@u` / `@underline` | `{@u underlined}` | underlined |
| `@sup` | `{@sup superscript}` | superscript |
| `@sub` | `{@sub subscript}` | subscript |
| `@code` | `{@code code text}` | `code text` |
| `@kbd` | `{@kbd Ctrl+C}` | keyboard key |
| `@color` | `{@color text\|ff0000}` | colored text |
| `@highlight` | `{@highlight text\|ffff00}` | highlighted text |
| `@note` | `{@note sidebar text}` | note |
| `@tip` | `{@tip helpful tip}` | tip |
| `@help` | `{@help text\|tooltip text}` | text with tooltip |
| `@s2` / `@strikeDouble` | `{@s2 text}` | double strikethrough |
| `@u2` / `@underlineDouble` | `{@u2 text}` | double underline |
| `@style` | `{@style text\|css-class}` | apply CSS classes |
| `@font` | `{@font fontName\|text}` | change font |
| `@unit` | `{@unit 30\|feet}` | unit display |

## Dice & Rolls

| Tag | Usage | Description |
|-----|-------|-------------|
| `@dice` | `{@dice 2d6+3}` | Rollable dice expression |
| `@dice` | `{@dice 2d6+3\|display text}` | Dice with custom label |
| `@damage` | `{@damage 2d6+3}` | Damage roll (styled) |
| `@autodice` | `{@autodice 2d6}` | Auto-rolling dice |
| `@hit` | `{@hit +5}` | Attack bonus: "+5" |
| `@d20` | `{@d20 +3}` | d20 roll with modifier |
| `@initiative` | `{@initiative +2}` | Initiative modifier |
| `@chance` | `{@chance 25}` | 25 percent chance |
| `@chance` | `{@chance 25\|on a 25 or lower}` | Chance with label |
| `@coinflip` | `{@coinflip}` | Coin flip |
| `@recharge` | `{@recharge 5}` | Recharge 5-6 |
| `@recharge` | `{@recharge}` | Recharge 6 |
| `@scaledice` | `{@scaledice 1d10\|cantrip,5,2d10,11,3d10,17,4d10}` | Level-scaling dice |
| `@scaledamage` | `{@scaledamage 8d6\|3-9\|1d6}` | Spell damage scaling |

## Game Mechanics

| Tag | Usage | Description |
|-----|-------|-------------|
| `@dc` | `{@dc 15}` | Difficulty Class |
| `@dcYourSpellSave` | `{@dcYourSpellSave WIS}` | "your spell save DC" |
| `@hitYourSpellAttack` | `{@hitYourSpellAttack}` | "your spell attack modifier" |
| `@ability` | `{@ability str 15}` | Ability check (DC 15 Strength) |
| `@savingThrow` | `{@savingThrow dex +5}` | Saving throw |
| `@skillCheck` | `{@skillCheck perception +7}` | Skill check |

## Combat Labels

| Tag | Usage | Output |
|-----|-------|--------|
| `@atk` | `{@atk mw}` | "Melee Weapon Attack:" |
| `@atk` | `{@atk rs}` | "Ranged Spell Attack:" |
| `@atkr` | `{@atkr mw}` | Attack (response variant) |
| `@h` | `{@h}` | "Hit:" |
| `@m` | `{@m}` | "Miss:" |
| `@hom` | `{@hom}` | "Hit or Miss:" |
| `@actSave` | `{@actSave dex}` | "Dexterity Saving Throw:" |
| `@actSaveSuccess` | `{@actSaveSuccess}` | "Success:" |
| `@actSaveFail` | `{@actSaveFail}` | "Failure:" |
| `@actSaveFailBy` | `{@actSaveFailBy 5}` | "Failure by 5 or More:" |
| `@actSaveSuccessOrFail` | `{@actSaveSuccessOrFail}` | "Success or Failure:" |
| `@actTrigger` | `{@actTrigger}` | "Trigger:" |
| `@actResponse` | `{@actResponse}` | "Response:" |

### Attack Type Codes

- `mw` = Melee Weapon
- `rw` = Ranged Weapon
- `ms` = Melee Spell
- `rs` = Ranged Spell
- `mw,rw` = Melee or Ranged Weapon

## Entity Cross-References

Format: `{@tag name|source}` or `{@tag name|source|display text}`

| Tag | Example |
|-----|---------|
| `@spell` | `{@spell fireball\|phb}` |
| `@item` | `{@item longsword\|phb}` |
| `@creature` | `{@creature goblin\|mm}` |
| `@condition` | `{@condition stunned}` |
| `@disease` | `{@disease sewer plague}` |
| `@status` | `{@status concentration}` |
| `@background` | `{@background acolyte\|phb}` |
| `@race` | `{@race elf\|phb}` |
| `@feat` | `{@feat alert\|phb}` |
| `@class` | `{@class wizard\|phb}` |
| `@subclass` | `{@subclass wizard\|evocation\|phb}` |
| `@optfeature` | `{@optfeature agonizing blast\|phb}` |
| `@deity` | `{@deity pelor\|\|Dawn War}` |
| `@card` | `{@card Ace of Swords\|Deck of Many Things}` |
| `@action` | `{@action Dash}` |
| `@skill` | `{@skill Perception}` |
| `@sense` | `{@sense darkvision}` |
| `@quickref` | `{@quickref Vision and Light}` |
| `@variantrule` | `{@variantrule Flanking\|DMG}` |
| `@table` | `{@table Wild Magic Surge\|PHB}` |
| `@vehicle` | `{@vehicle Apparatus of Kwalish\|DMG}` |
| `@object` | `{@object Ballista\|DMG}` |
| `@trapHazard` | `{@trapHazard Poison Needle Trap\|DMG}` |
| `@reward` | `{@reward Blessing of Health\|DMG}` |
| `@psionic` | `{@psionic Ego Whip\|UATheMysticClass}` |
| `@hazard` | `{@hazard Brown Mold\|DMG}` |
| `@language` | `{@language Common}` |
| `@charoption` | `{@charoption Supernatural Gift\|MOT}` |

### Class Feature References

```
{@classFeature Extra Attack|Fighter|PHB|5}
                ^name       ^class ^src ^level

{@subclassFeature Improved Critical|Fighter|PHB|Champion|PHB|3}
                  ^name             ^class ^src ^subclass ^src ^level
```

## Navigation & Links

| Tag | Usage | Description |
|-----|-------|-------------|
| `@link` | `{@link Display Text\|https://example.com}` | External hyperlink |
| `@5etools` | `{@5etools Spells\|spells.html}` | Internal page link |
| `@5etoolsImg` | `{@5etoolsImg img/path.png}` | Internal image URL |
| `@filter` | `{@filter spells\|spells.html\|level=3\|school=evocation}` | Filtered page link |
| `@book` | `{@book PHB\|PHB\|1\|Chapter 1}` | Book page reference |
| `@adventure` | `{@adventure LMoP\|LMoP\|1}` | Adventure reference |
| `@footnote` | `{@footnote text\|footnote content}` | Footnote |
| `@homebrew` | `{@homebrew new text\|old text}` | Homebrew replacement marker |
| `@loader` | `{@loader spell\|fireball\|phb}` | Async data loader |
| `@area` | `{@area A1}` | Map area reference |

## Comic/Narrative Tags

| Tag | Usage |
|-----|-------|
| `@comic` | `{@comic narration text}` |
| `@comicH1` | `{@comicH1 Big Header}` |
| `@comicH2` | `{@comicH2 Medium Header}` |
| `@comicNote` | `{@comicNote aside}` |
