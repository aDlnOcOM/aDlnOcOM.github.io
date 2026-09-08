# Perception tuning

Eyes, cameras and flashlight masks share angular falloff and solid ray geometry.
No radius-based wall bypass. The near-body awareness ring is only 22 units wide
and obeys walls; it is not long-range rear vision.

Normal eyesight: 120 degrees of clear detail, plus 50 degrees on each side at
reduced intensity (220 degrees total), with no gameplay distance cap. Peripheral
bots are silhouettes without health or status readouts. Darkness retains a
68-degree forward cone, only 78 units at reduced intensity. The flashlight adds
a separate 29-degree, 336-unit beam before equipment upgrades, plus a dim spill
extending 12.5 degrees beyond each beam edge at 85% range. Light edges fade.
Unknown space is opaque; remembered geometry remains dim, never a live enemy map.
The exploration grid now uses the same cell alignment as the memory renderer.

The rendered visibility mask uses obstacle-corner rays and angular/radial fading,
not screen-space blur that leaks around walls. Static sector lights are decorative
and do not bypass fog. Visible enemies and cameras fade near perception edges.

Guards acquire peripheral/distant targets more slowly. In emergency darkness,
mobile guards have 80% visual range unless the player's flashlight is on; turrets
and cameras retain optical range. A visible flashlight multiplies guard acquisition
by 1.65 and camera acquisition by 1.4, but does not grant sight through cover or
outside their cone. The flashlight can be toggled with F in normal lighting too.
Alarm activation preserves the player's chosen flashlight state.

Run all regression suites with `node --test *.test.cjs`.
Dedicated tests cover falloff, blind zones, near-wall occlusion, beam reach,
rendered ray endpoints and flashlight detection tradeoffs. Visual playtesting is
still required; browser access to the local game was policy-blocked.
