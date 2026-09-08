# Security behaviour

- Global alarm latches until the next floor, switching emergency lighting on once.
  Alarm activation and repeated radio reports preserve the flashlight switch.
- Guards confirm a target after 0.4 seconds inside their viewing cone; cameras
  require 0.5 seconds at full visibility. Peripheral targets take longer; see
  PERCEPTION.md for light modifiers. Exposure fades outside sight. Walls and closed gates block
  the entire observation, including at point-blank range. No rear omniscience.
- Cameras report again every 0.8 seconds while contact remains visible. A report
  snapshots coordinates. Units within 1100 world units investigate; other units
  increase patrol activity without learning the live player position.
- Guards transition through patrol, suspicion, engagement, investigation, search
  and return. Shooting requires current vision and gun alignment. Losing sight
  stops targeted fire immediately. Radio contact alone cannot authorize shooting.
- Last contact expires after 12 seconds (6 for an unconfirmed sound). On arrival,
  a unit scans for 4 seconds, then returns. Movement uses cached corner-graph
  routes with body clearance, not straight-line pushing against walls.
- Turrets rotate and reacquire visually, but never walk. The boss retains its
  arena-wide observation and radial attack; aimed attacks require line of sight.
- Gunshot hearing radius is 700, reduced to 75% / 55% by suppressor upgrades.
  Actual player movement emits footsteps every 72 units with hearing radius 145;
  starting a reload emits a radius-105 sound. These noises cause investigation,
  not an immediate floor alarm. Heard positions are quantized to a free 64-unit
  grid location where possible. New sounds redirect sound investigations but do
  not replace a fresh confirmed sighting.
  Obstructed sound travels 35% as far. Only living bots hear sounds; cameras are
  visual observers. Melee sound causes investigation; a received gunshot or a
  unit damage report causes alarm. A damaged unit reports its own location,
  never the unseen attacker's coordinates.
- Visible cameras and guards display suspicion/contact indicators. Indicators
  are rendered only for entities already visible to the player.

Run `node --test security-ai.test.cjs equipment.test.cjs hideout.test.cjs`.
Tests use in-memory game state and no player saves. Coverage includes cone/range
checks, wall occlusion, confirmation, radio refresh during alarm, stale-contact
search, turret firing prerequisites, routing and hearing attenuation.

Manual playtest still required: move behind a patrol, peek out of cover, enter a
camera cone, break contact around a wall, observe responders searching the old
position, and compare silenced/unsilenced shots. Local-file browser automation
was policy-blocked; no visual playtest is claimed.
