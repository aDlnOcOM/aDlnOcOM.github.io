# Energy equipment and inventory

The equipment tab is a two-column panel: positioned equipment slots on the left,
inventory containers on the right: loaded magazine, quick-access magazine pouches,
four pockets and the office bag. Magazines occupy 1×2 cells; Mk I occupies 2×2.
Clicking an item opens its details and refill action. Equipment slots retain their upgrade-tree actions.
I or the sidebar inventory button opens a paused field panel; Escape closes it.
Field equipment is read-only; magazine refill buttons transfer energy from Mk I.

Default loadout: three low-voltage battery magazines (one loaded) and one Mk I
weapon battery with 150 energy. Standard magazines hold 32; extended upgrades
hold 44 / 52. Quick-feed variants retain 32 capacity and the existing faster reload.
One SMG shot consumes one energy regardless of its damage upgrades.

R starts the existing timed reload (keyboard repeats are ignored). Completion
clamps the timer to zero, preventing a stuck reload label; shots are blocked while
the timer is active. At completion it swaps to the reserve with
the most energy, preserving the old magazine; if no reserve is more charged,
R starts a separate timed refill from Mk I when there is no better reserve.
Transfer rate is 3.2 energy/second: empty magazines take 10 / 13.75 / 16.25 seconds
for 32 / 44 / 52 capacity. Partial refills scale with missing/available energy,
but every refill takes at least 10 seconds.
Energy transfers incrementally. Inventory shows remaining time and a cancel
button; closing it cancels refill but keeps energy already transferred. Charging
continues during the inventory pause, but not during death/start overlays.
Empty stocks cannot produce shots; firing is blocked while charging.
Energy persists across floors. Returning to Hideout provides full default supplies
for the next run; opening field inventory never replenishes them for free.
Run supplies are transient, like the existing run state; this change introduces
no save-format migration, item loot, drag-and-drop or consumable purchases.

Tests: `node --test power-inventory.test.cjs` plus the existing suites. Covers
types/capacities, one-energy shots, partial swaps, finite transfer, depletion,
real timed reload integration and floor/reset boundaries. Browser visual QA is
still unverified because local-file access is policy-blocked.
