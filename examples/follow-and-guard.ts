/**
 * Follow and guard examples for baritone-ts
 *
 * Demonstrates: FollowProcess, CombatProcess, priority-based process management
 */
import { createBot } from 'mineflayer';
import { pathfinder, FollowProcess, CombatProcess } from '../src';

// ============================================================================
// Basic Follow
// ============================================================================

const bot = createBot({ host: 'localhost', username: 'FollowerBot' });

bot.once('spawn', () => {
  pathfinder(bot);
});

bot.on('chat', (username, message) => {
  if (message === 'follow me') {
    const player = bot.players[username]?.entity;
    if (!player) {
      bot.chat("I can't see you!");
      return;
    }

    const follower = new FollowProcess(bot, (bot as any).pathfinder, {
      target: player,
      minDistance: 2,
      maxDistance: 4,
      allowSprint: true,
    });

    (bot as any).pathfinder.processManager.register('follow', follower);
    (bot as any).pathfinder.processManager.activate('follow');
    bot.chat(`Following ${username}!`);
  }

  if (message === 'stay') {
    (bot as any).pathfinder.processManager.deactivate('follow');
    bot.chat('Staying here');
  }
});

// ============================================================================
// Guard Bot (Follow + Combat)
// ============================================================================

function createGuardBot() {
  const guard = createBot({ host: 'localhost', username: 'GuardBot' });

  guard.once('spawn', () => {
    pathfinder(guard);

    // Combat has higher priority
    const combat = new CombatProcess(guard, (guard as any).pathfinder, {
      mode: 'attack',
      targetTypes: ['zombie', 'skeleton', 'spider', 'creeper'],
      attackRange: 3.5,
      useShield: true,
    });

    (guard as any).pathfinder.processManager.register('combat', combat, { priority: 100 });
    (guard as any).pathfinder.processManager.activate('combat');

    // Poll combat state
    setInterval(() => {
      const kills = combat.getKillCount();
      if (kills > 0) {
        guard.chat(`Kills: ${kills}`);
      }
    }, 5000);
  });

  guard.on('chat', (username, message) => {
    if (message === 'guard me') {
      const player = guard.players[username]?.entity;
      if (!player) return;

      const follower = new FollowProcess(guard, (guard as any).pathfinder, {
        target: player,
        minDistance: 2,
        maxDistance: 5,
      });

      (guard as any).pathfinder.processManager.register('follow', follower, { priority: 50 });
      (guard as any).pathfinder.processManager.activate('follow');
      guard.chat(`Guarding ${username}. Stay close!`);
    }
  });

  return guard;
}
