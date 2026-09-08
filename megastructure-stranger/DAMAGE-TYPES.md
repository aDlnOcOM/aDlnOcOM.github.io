# Projectile families

DamageTypes defines four independent damage channels: ballistic, energy,
elemental and mechanical. Every existing enemy has four susceptibility
multipliers. Values below 1 resist that type; above 1 are vulnerabilities.
There are no absolute immunities. Player armor still uses its existing absorption
formula; adding player resistance equipment is not part of this change.

Enemy attacks carry their own `damageType`, independent of enemy defense.
Default projectiles: watchers/drones/ordinary turrets use energy, marksmen and
burst turrets use ballistic, Warden projectiles use elemental. Melee defaults to
mechanical. Setting an enemy's damageType overrides its projectile family.

SMG remains energy without an ammo conversion. Incendiary converts to elemental,
armor-piercing to ballistic, and the new flechette branch to mechanical. Choices
remain mutually exclusive and old upgrade IDs are preserved. Each family gets
matching magazines and reserves: Mk I 150 energy, ballistic box 120 rounds,
elemental container 90 capsules, mechanical box 60 darts. Existing magazine-size
upgrades and timed loading apply; mismatched magazines cannot fire or refill.

Shots have separate colors and shapes (tracer, orb, flame, dart). Impacts differ
in color, particle count and shape; mechanical fragments scatter faster.
Elemental is a damage channel, not an unimplemented promise of burn/freeze DOT.

Tests cover all enemy profiles, real impact damage, particle tagging, weapon
conversion supplies, incompatible magazines and configurable enemy projectiles.
Browser visual QA remains unverified due to local-file access policy.
