# Verdant popup menus

Replace the below-world satchel, recipes, journal and lab with one native modal
field kit, opened from an always-visible four-slot hotbar or I/C/L/O shortcuts.
The game fills the viewport on desktop and phone. Menus pause simulation and
clear held inputs; native dialog handles focus trapping and Escape. Closing
restores canvas focus and preserves manual pause. Crafting a placeable kit
closes the menu and returns to ground placement; its cancel control stays in
view. Keep current save/content versions and all existing crafting/story logic.

A side drawer would consume the already limited phone play area. Separate
windows would duplicate focus/pause handling. A single dialog with four tabs
provides the requested game-style flow and native keyboard accessibility.
Menu content can scroll inside its bounded popup on small screens; the page
itself stays fixed. Item slots use the existing visual palette and square relief
borders. No dependencies or generated-world changes.

QA: no page overflow at desktop, phone and short landscape sizes; hotbar and
I/C/L/O; Escape and close; keyboard tab switching/focus trapping; movement and
air/energy pause while open; preserve manual pause; crafting/placement/cancel;
save and lab controls; no unintended actions after menu close.
