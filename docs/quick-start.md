# Quick Start Guide

Get Baritone-TS up and running in minutes.

## Prerequisites

- Node.js 16 or later
- A Minecraft server (Java Edition 1.16-1.20)
- Basic familiarity with [Mineflayer](https://github.com/PrismarineJS/mineflayer)

## Installation

```bash
npm install mineflayer baritone-ts
```

## Your First Bot

Create a file called `bot.ts`:

```typescript
import { createBot } from 'mineflayer';
import { pathfinder, GoalBlock } from 'baritone-ts';

const bot = createBot({
  host: 'localhost',
  port: 25565,
  username: 'PathfindingBot'
});

bot.once('spawn', () => {
  // Initialize the pathfinder plugin
  pathfinder(bot);

  console.log('Bot spawned! Ready to pathfind.');
});

// Handle chat commands
bot.on('chat', (username, message) => {
  if (username === bot.username) return;

  // Parse "goto x y z" commands
  const match = message.match(/^goto (-?\d+) (-?\d+) (-?\d+)$/);
  if (match) {
    const [, x, y, z] = match.map(Number);
    console.log(`Navigating to ${x}, ${y}, ${z}`);

    bot.pathfinder.setGoal(new GoalBlock(x, y, z));
  }

  if (message === 'stop') {
    bot.pathfinder.stop();
    console.log('Stopped pathfinding');
  }
});

// Listen for pathfinding events
bot.on('goal_reached', () => {
  console.log('Arrived at destination!');
});

bot.on('path_update', (result) => {
  console.log(`Path status: ${result.status}`);
});

bot.on('path_reset', (reason) => {
  console.log(`Path reset: ${reason}`);
});
```

Run your bot:

```bash
npx ts-node bot.ts
```

Then in Minecraft chat, type: `goto 100 64 100`

## Understanding Goals

Goals define where the bot should go. Here are the most common types:

```typescript
import {
  GoalBlock,
  GoalNear,
  GoalXZ,
  GoalFollow,
  GoalRunAway
} from 'baritone-ts';

// Go to exact coordinates
const exactGoal = new GoalBlock(100, 64, 100);

// Get within 5 blocks of a position
const nearGoal = new GoalNear(100, 64, 100, 5);

// Go to X/Z coordinates (any Y level)
const xzGoal = new GoalXZ(100, 100);

// Follow an entity
const player = bot.players['PlayerName']?.entity;
if (player) {
  const followGoal = new GoalFollow(player, 3); // Stay 3 blocks away
}

// Run away from danger
const dangerPos = { x: 100, y: 64, z: 100 };
const fleeGoal = new GoalRunAway([dangerPos], 20); // Get 20 blocks away
```

## Enabling Block Breaking/Placing

By default, the bot can break and place blocks to reach its destination:

```typescript
pathfinder(bot, {
  canDig: true,           // Allow breaking blocks
  canPlace: true,         // Allow placing blocks
  scaffoldingBlocks: ['cobblestone', 'dirt'], // Blocks to use for bridging
  maxFallHeight: 3,       // Maximum safe fall distance
  allowParkour: true      // Enable parkour jumps
});
```

## Using Processes for Automation

Processes are high-level automation behaviors:

```typescript
import { MineProcess, FollowProcess } from 'baritone-ts';

// Mine diamonds
const miner = new MineProcess(bot, bot.pathfinder, {
  blockNames: ['diamond_ore', 'deepslate_diamond_ore'],
  searchRadius: 64
});

bot.pathfinder.processManager.register('mine', miner);
bot.pathfinder.processManager.activate('mine');

// To stop
bot.pathfinder.processManager.deactivate('mine');
```

## Async Navigation

For promise-based navigation:

```typescript
async function goToLocation() {
  const goal = new GoalBlock(100, 64, 100);

  try {
    await bot.pathfinder.goto(goal);
    console.log('Arrived!');
  } catch (error) {
    console.log('Could not reach destination:', error.message);
  }
}
```

## Next Steps

- [Goals](./goals.md) - Learn about all goal types
- [Configuration](./configuration.md) - Customize pathfinding behavior
- [Processes](./processes.md) - Automate mining, following, farming
- [Tasks](./tasks.md) - Build complex automation workflows
