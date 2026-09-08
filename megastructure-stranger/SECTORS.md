# Procedural districts

One weighted specialization roll per entire floor: residential 28%, industrial 26%, slums 16%, market
9%, robotics 7%, elite 4%, medical 3%, hydroponics 3%, archive 2%, utilities 2%.
These are frequencies across floors, not a quota within each floor. All sectors
share the floor's specialization but retain varied local layouts.

Districts use different palettes, floor grids, lighting, signage and furnishing:
apartments, production equipment, improvised scrap structures, market stalls,
robot docks, spacious suites, medical beds, grow racks, archive shelves and pipes.
Furniture is solid geometry shared by collision, vision and AI navigation.
Cosmetic markings and light pools are drawn below fog of war.

Each floor keeps its boss airlock and a connected service corridor with varying
height and wide connecting vestibules. Shell-connected bulkheads near each
sector entrance and exit interrupt top/bottom perimeter alleys and require
crossing the patrol corridor through 132-unit openings. Cameras in equipped
sectors face the exit checkpoint; cover and patrol timing still allow stealth.
Security density follows district type:
slums have light patrols; robotics and elite areas add drones and turrets. Spawns
are placed within the clear corridor rather than inside furniture.

A run chooses 10–12 sectors once. Floor body length grows by 1.2 each floor;
district modules fill the increasing space. A recorded floor seed reproduces
the sector identities and geometry (not guard timing or the entire run).
Unvisited district names are concealed in the route readout.

Verification: `node --test sectors.test.cjs security-ai.test.cjs equipment.test.cjs hideout.test.cjs`.
Tests cover weighted sampling, deterministic layouts, 200 layout connectivity
checks, integrated spawns, boss gates and five-floor length progression.
Browser visual playtesting remains unverified due to the local-file access policy.
