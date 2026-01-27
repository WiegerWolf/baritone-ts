/**
 * Basic usage example for baritone-ts pathfinder
 */
import { createBot } from 'mineflayer';
import { pathfinder, GoalBlock, GoalNear, GoalFollow, GoalRunAway } from '../src';
import { BlockPos } from '../src/types';

// Create bot
const bot = createBot({
  host: 'localhost',
  port: 25565,
  username: 'PathfinderBot'
});

// Inject pathfinder plugin
bot.once('spawn', () => {
  pathfinder(bot, {
    allowSprint: true,
    allowParkour: true,
    canDig: true,
    canPlace: true
  });

  console.log('Pathfinder loaded!');
});

// Example 1: Go to specific coordinates
bot.on('chat', (username, message) => {
  if (username === bot.username) return;

  const args = message.split(' ');
  const command = args[0];

  switch (command) {
    case 'goto': {
      // Usage: goto <x> <y> <z>
      const x = parseInt(args[1]);
      const y = parseInt(args[2]);
      const z = parseInt(args[3]);

      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        bot.chat('Usage: goto <x> <y> <z>');
        return;
      }

      const goal = new GoalBlock(x, y, z);
      (bot as any).pathfinder.setGoal(goal);
      bot.chat(`Going to ${x}, ${y}, ${z}`);
      break;
    }

    case 'follow': {
      // Usage: follow <playerName>
      const playerName = args[1];
      const player = bot.players[playerName]?.entity;

      if (!player) {
        bot.chat(`Player ${playerName} not found`);
        return;
      }

      const goal = new GoalFollow(player, 2);
      (bot as any).pathfinder.setGoal(goal, true); // dynamic goal
      bot.chat(`Following ${playerName}`);
      break;
    }

    case 'near': {
      // Usage: near <x> <y> <z> <radius>
      const x = parseInt(args[1]);
      const y = parseInt(args[2]);
      const z = parseInt(args[3]);
      const radius = parseInt(args[4]) || 3;

      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        bot.chat('Usage: near <x> <y> <z> [radius]');
        return;
      }

      const goal = new GoalNear(x, y, z, radius);
      (bot as any).pathfinder.setGoal(goal);
      bot.chat(`Going near ${x}, ${y}, ${z} (radius: ${radius})`);
      break;
    }

    case 'runaway': {
      // Usage: runaway
      // Run away from the speaker
      const speaker = bot.players[username]?.entity;
      if (!speaker) {
        bot.chat('Cannot find you!');
        return;
      }

      const dangerPos = new BlockPos(
        Math.floor(speaker.position.x),
        Math.floor(speaker.position.y),
        Math.floor(speaker.position.z)
      );

      const goal = new GoalRunAway([dangerPos], 16);
      (bot as any).pathfinder.setGoal(goal);
      bot.chat('Running away!');
      break;
    }

    case 'stop': {
      (bot as any).pathfinder.stop();
      bot.chat('Stopped pathfinding');
      break;
    }

    case 'status': {
      const pf = (bot as any).pathfinder;
      const moving = pf.isMoving();
      const goal = pf.getGoal();

      if (goal) {
        bot.chat(`Status: ${moving ? 'Moving' : 'Idle'} with goal set`);
      } else {
        bot.chat('Status: No goal set');
      }
      break;
    }
  }
});

// Event handlers
bot.on('goal_reached' as any, (goal: any) => {
  console.log('Goal reached!');
  bot.chat('Arrived at destination!');
});

bot.on('path_reset' as any, (reason: string) => {
  console.log(`Path reset: ${reason}`);
});

bot.on('path_update' as any, (result: any) => {
  console.log(`Path update: ${result.status}, ${result.path.length} nodes, ${result.time.toFixed(1)}ms`);
});

bot.on('error', console.error);
