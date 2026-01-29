/**
 * Navigation examples for baritone-ts
 *
 * Demonstrates: GoalBlock, GoalFollow, obstacle navigation with async goto
 */
import { createBot } from 'mineflayer';
import { pathfinder, GoalBlock, GoalFollow } from '../src';

// --- Go to Coordinates ---

const bot = createBot({
  host: 'localhost',
  port: 25565,
  username: 'NavigationBot',
});

bot.once('spawn', () => {
  // Enable block breaking and placing for obstacles
  pathfinder(bot, {
    canDig: true,
    canPlace: true,
    scaffoldingBlocks: ['cobblestone', 'dirt'],
    allowParkour: true,
    maxFallHeight: 3,
  });

  // Navigate to specific coordinates
  (bot as any).pathfinder.setGoal(new GoalBlock(100, 64, 100));
});

bot.on('goal_reached' as any, () => {
  console.log('Arrived at destination!');
});

// --- Go to Player / Stop ---

bot.on('chat', (username, message) => {
  if (message === 'come here') {
    const player = bot.players[username]?.entity;
    if (player) {
      (bot as any).pathfinder.setGoal(new GoalFollow(player, 2), true);
      bot.chat(`Coming to you, ${username}!`);
    }
  }

  if (message === 'stop') {
    (bot as any).pathfinder.stop();
    bot.chat('Stopped');
  }
});

// --- Async goto with error handling ---

async function goTo(x: number, y: number, z: number) {
  try {
    await (bot as any).pathfinder.goto(new GoalBlock(x, y, z));
    console.log(`Arrived at ${x}, ${y}, ${z}`);
  } catch (error: any) {
    console.log(`Could not reach ${x}, ${y}, ${z}:`, error.message);
  }
}
