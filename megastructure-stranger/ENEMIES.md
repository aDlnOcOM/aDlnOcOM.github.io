# Additional security units

- Enforcer / Штурмовик спецохраны: 62 base HP, fast approach, melee-only attack
  with a 1.15-second cooldown. Uses common sight confirmation and navigation;
  cannot damage a target at range or through walls.
- Marksman / Стрелок спецохраны: 44 base HP, 500-unit optical range, prefers
  335-unit engagement distance, fires slower but faster-moving, stronger bolts.
- Burst turret / Отсекатель: stationary, 72 base HP. Fires one initial round
  followed by two or three rounds at 0.14-second intervals. Loses the remaining
  burst when visual contact breaks. Alternates with ordinary turrets in sectors
  whose security level includes turret deployment.
- Breaker / Таран шлюза: a distinct 1100-HP airlock boss on even-numbered floors;
  the Warden remains on odd floors. Telegraphs a locked direction for 0.85 seconds,
  charges for 0.55 seconds and recovers for 1.4 seconds. The dash obeys collision,
  can hit the player only once, and cannot track their position during windup.

All normal units retain the existing alarm, sound and last-contact logic.
Their colors and silhouettes differ: paired melee blades, extended marksman
barrel, double turret barrels and a square boss chassis with a dashed windup line.
Base values still scale with floor progression through the existing generator.

Regression tests: `node --test enemy-specialists.test.cjs`, plus the existing
suites. Covers timed/cancelled bursts, charge phases and fixed heading, melee
range, marksman spacing, stationary turrets and generated unit inclusion.
Visual browser playtesting remains unverified due to local-file access policy.
