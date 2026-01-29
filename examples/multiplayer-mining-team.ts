/**
 * Multiplayer coordination example for baritone-ts
 *
 * Demonstrates: Two bots coordinating — leader finds ores, helper navigates to them
 */
import { createBot } from 'mineflayer';
import { pathfinder, MineProcess, GoalGetToBlock } from '../src';

// --- Leader bot: mines and shares coordinates ---

const leader = createBot({ host: 'localhost', username: 'MineLeader' });

leader.once('spawn', () => {
  pathfinder(leader);

  const miner = new MineProcess(leader, (leader as any).pathfinder, {
    blockNames: ['diamond_ore'],
    searchRadius: 32,
  });

  // Poll for current target and share with helper
  setInterval(() => {
    const target = miner.getCurrentTarget();
    if (target) {
      leader.chat(
        `/msg MineHelper found ${target.position.x} ${target.position.y} ${target.position.z}`,
      );
    }
  }, 5000);
});

// --- Helper bot: navigates to ore locations ---

const helper = createBot({ host: 'localhost', username: 'MineHelper' });

helper.once('spawn', () => {
  pathfinder(helper);
});

helper.on('whisper', (username, message) => {
  if (username === 'MineLeader' && message.startsWith('found')) {
    const [, x, y, z] = message.split(' ').map(Number);
    (helper as any).pathfinder.setGoal(new GoalGetToBlock(x, y, z));
  }
});
