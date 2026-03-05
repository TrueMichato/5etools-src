# JS Utilities Reference

Key JavaScript classes for parsing, rendering, and loading 5etools data.

## Renderer (js/render.js)

The main class for converting entry trees into HTML.

### Core API

```javascript
const renderer = new Renderer();

// Render entries to HTML string
const html = renderer.render(entryOrArray);

// Recursive render with explicit stack
const textStack = [""];
renderer.recursiveRender(entry, textStack, meta, options);
const result = textStack.join("");

// Render inline (no wrapping tags)
renderer.recursiveRender(entry, textStack, {prefix: "", suffix: ""});
```

### Configuration

```javascript
// Lazy image loading
renderer.setLazyImages(true);

// Track heading depth for ToC generation  
const depthTracker = [];
renderer.setDepthTracker(depthTracker);
// After rendering, depthTracker contains [{depth, name, source, ...}]

// Plugin system for customizing render output
renderer.addPlugin("entries_namePrefix", myPluginFn);
renderer.removePlugin("entries_namePrefix", myPluginFn);
```

### Static Utilities

```javascript
// Convert entry to flat text (strip HTML)
Renderer.stripTags(taggedString);  // "{@bold hello}" → "hello"

// Get dice as text
Renderer.getEntryDice(diceEntry);

// Hover/tooltip integration
Renderer.hover.pCacheAndGet(page, source, hash, opts);
```

## RendererMarkdown (js/render-markdown.js)

Extends Renderer for markdown output:

```javascript
const md = new RendererMarkdown();
const markdown = md.render(entries);
```

## Parser (js/parser.js)

Static utility class for D&D-specific parsing.

### Source Lookups

```javascript
Parser.sourceJsonToFull("PHB");       // "Player's Handbook"
Parser.sourceJsonToAbv("PHB");        // "PHB"
Parser.sourceJsonToColor("PHB");      // hex color string
```

### Ability Scores

```javascript
Parser.attAbvToFull("str");           // "Strength"
Parser.attFullToAbv("Strength");      // "str"
Parser.getAbilityModNumber(16);       // 3 (raw number)
Parser.getAbilityModifier(16);        // "+3" (formatted string)
```

### Challenge Rating & XP

```javascript
Parser.crToXp("5");                   // "1,800"
Parser.crToXpNumber("5");             // 1800
Parser.crToPb("8");                   // 3 (proficiency bonus)
Parser.levelToPb(5);                  // 3
```

### Size, Alignment, AC

```javascript
Parser.sizeAbvToFull("M");            // "Medium"
Parser.alignmentAbvToFull("LG");      // "Lawful Good"
Parser.acToFull(acArray, {renderer});  // Formatted AC string
```

### Number Formatting

```javascript
Parser.numberToText(3);               // "three"
Parser.numberToText(3, {isOrdinalForm: true});  // "third"
Parser.textToNumber("three");         // 3
Parser.numberToVulgar(0.5);           // "½"
Parser.vulgarToNumber("½");           // 0.5
```

### Skill/Ability Mapping

```javascript
Parser.skillToAbilityAbv("Perception");    // "wis"
Parser.skillToAbilityAbv("Athletics");     // "str"
```

### Encounter Math

```javascript
Parser.numMonstersToXpMult(4, 4);     // XP multiplier for 4 monsters, 4 players
```

## DataUtil (js/utils-dataloader.js)

Async data loading for each entity type.

### Loading Data

```javascript
// Load spells
const data = await DataUtil.spell.loadJSON();
// data.spell = [{...}, {...}, ...]

// Load raw JSON (no processing)
const raw = await DataUtil.loadRawJSON("data/spells/spells-phb.json");

// Load homebrew
const brew = await DataUtil.spell.loadBrew();

// Load prerelease (UA)
const ua = await DataUtil.spell.loadPrerelease();
```

### UID Operations

```javascript
// Parse UID string
DataUtil.generic.unpackUid("fireball|phb");
// → {name: "Fireball", source: "PHB"}

// Build UID
DataUtil.generic.packUid({name: "Fireball", source: "PHB"});
// → "fireball|phb"
```

## Type-Specific Renderers

Each data type has a specialized renderer in `js/render-<type>.js`:

| File | Class | Primary Method |
|------|-------|---------------|
| `render-bestiary.js` | `RenderBestiary` | `$getRenderedCreature(mon)` |
| `render-spells.js` | `RenderSpells` | `$getRenderedString(sp)` |
| `render-items.js` | `RenderItems` | `$getRenderedString(item)` |
| `render-classes.js` | `RenderClasses` | Various class/subclass renderers |
| `render-feats.js` | `RenderFeats` | `$getRenderedString(feat)` |

These produce the full HTML stat blocks displayed on the site.
