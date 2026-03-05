Open bugs:
[] Cunning action and sneak attack working, but need UX overhaul to be more useable by players,
[] Specialties like Observer that add a +3 to passive skill don't add to the passive skill. Also, specialies that give proficiency or expertise choices don;t give that
[] Races seem to sometimes add +1/+1 ASI when it is clearly wrong, needs to validatwe what is happening there.
[] Languages have XPHB as their source even when not, this messes with hover.
Uncaught (in promise) Error: Failed to load renderable content for: page="languages.html" source="XPHB" hash="aquan_xphb" preloadId="null" customHashId="undefined" isFluff="undefined"
    at Renderer.hover._pHandleLinkMouseOver_doVerifyToRender (render.js:15533:9)
    at Renderer.hover.pHandleLinkMouseOver (render.js:15448:9)
_pHandleLinkMouseOver_doVerifyToRender @ render.js:15533
pHandleLinkMouseOver @ render.js:15448
await in pHandleLinkMouseOver
onmouseover @ VM5996 charactersheet.html:1Understand this error

Unverified bugs:

[] Some subclasses have features that aren't fully implemented in calculations (e.g. Alchemist's Experimental Elixir count, Alchemical Savant bonus, Restorative Reagents uses). These should be added to `getFeatureCalculations()` and tested.

[] Some tests use weak patterns that don't verify the actual calculations (e.g. checking for presence of text instead of verifying calculated values). These should be converted to stronger patterns that directly check the calculated values in `calculations`.