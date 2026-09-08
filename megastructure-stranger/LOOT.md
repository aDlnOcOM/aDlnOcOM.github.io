# Loot containers

Each generated sector has two seeded containers, placed in reachable side rooms
or boundary alcoves. They do not occupy the central patrol passage. Crates are
solid and remain as empty containers after opening. The generator tests routes,
wall clearance and separation from the player's starting position.

E opens the nearest unopened container within 72 units, without interacting
through walls or gates. Opening makes a radius-160 sound and can attract guards.
Containers contain 5–13 salvage; supply crates also contain 18–42 units of one
projectile family. Contents are generated once, not rerolled on interaction.

Salvage joins the normal run haul and follows existing death/extraction recovery.
Compatible ammunition joins the active reserve; other families remain visible
in separate inventory boxes and cannot feed the current converter. Supply totals
can exceed one box's nominal capacity. Supplies persist between floors and follow
the existing run-only supply lifecycle; Hideout restores its default loadout.

Tests cover deterministic placement, reachability, clear corridors, spawn safety,
one-time collection and separated ammunition. Browser visual QA is still
unverified due to the local-file access policy.
