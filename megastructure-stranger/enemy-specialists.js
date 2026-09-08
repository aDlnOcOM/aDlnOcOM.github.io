(() => {
  'use strict';
  function burst(enemy, delta, canSee, shoot) {
    if (!enemy.burstLeft) return;
    if (!canSee()) { enemy.burstLeft = 0; return; }
    enemy.burstDelay -= delta;
    if (enemy.burstDelay > 0) return;
    shoot(); enemy.burstLeft--; enemy.burstDelay = .14;
  }
  function breaker(enemy, delta, player, canSee, move, hit) {
    enemy.attackPhase ||= 'approach';
    enemy.phaseTime = Math.max(0, (enemy.phaseTime || 0) - delta);
    if (enemy.attackPhase === 'charge') {
      move(enemy, Math.cos(enemy.angle) * 510 * delta, Math.sin(enemy.angle) * 510 * delta);
      if (!enemy.chargeHit && Math.hypot(player.x - enemy.x, player.y - enemy.y) < enemy.radius + player.radius + 8 && canSee()) {
        hit(enemy.damage); enemy.chargeHit = true;
      }
      if (!enemy.phaseTime) { enemy.attackPhase = 'recover'; enemy.phaseTime = 1.4; }
    } else if (enemy.attackPhase === 'windup') {
      // The telegraphed heading is locked; evading the line beats the charge.
      if (!enemy.phaseTime) { enemy.attackPhase = 'charge'; enemy.phaseTime = .55; enemy.chargeHit = false; }
    } else if (enemy.attackPhase === 'recover') {
      if (!enemy.phaseTime) enemy.attackPhase = 'approach';
    } else if (canSee()) {
      enemy.angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      if (Math.hypot(player.x - enemy.x, player.y - enemy.y) < 460) {
        enemy.attackPhase = 'windup'; enemy.phaseTime = .85;
      } else move(enemy, Math.cos(enemy.angle) * enemy.speed * delta, Math.sin(enemy.angle) * enemy.speed * delta);
    }
  }
  window.EnemySpecialists = { burst, breaker };
})();
