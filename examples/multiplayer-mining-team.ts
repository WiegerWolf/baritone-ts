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

  miner.on('block_found', (block: any) => {
    leader.chat(
      `/msg MineHelper found ${block.position.x} ${block.position.y} ${block.position.z}`,
    );
  });
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
