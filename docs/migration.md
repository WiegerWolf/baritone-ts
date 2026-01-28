# Migration Guide

Guide for migrating from mineflayer-pathfinder to Baritone-TS.

## Overview

Baritone-TS is a more feature-rich pathfinding solution than mineflayer-pathfinder. While the basic concepts are similar, there are significant differences in API and capabilities.

## Key Differences

| Feature | mineflayer-pathfinder | Baritone-TS |
|---------|----------------------|-------------|
| Cost model | Integer-based | Tick-based (accurate to game ticks) |
| A* variants | Single coefficient | 7 coefficient variants |
| Movement types | ~9 types | 20+ types |
| High-level automation | None | Processes (7 types) |
| Task system | None | 100+ hierarchical tasks |
| Survival features | None | Survival chains |
| Elytra/Boat | None | Full support |
| Chunk caching | None | 2-bit encoded caching |

## API Migration

### Initialization

**mineflayer-pathfinder:**
```typescript
import { pathfinder, Movements } from 'mineflayer-pathfinder';

bot.loadPlugin(pathfinder);
const mcData = require('minecraft-data')(bot.version);
const movements = new Movements(bot, mcData);
bot.pathfinder.setMovements(movements);
```

**Baritone-TS:**
```typescript
import { pathfinder } from 'baritone-ts';

// Single function call handles everything
pathfinder(bot, {
  // Options are passed directly
  canDig: true,
  allowParkour: true
});
```

### Setting Goals

**mineflayer-pathfinder:**
```typescript
import { goals } from 'mineflayer-pathfinder';

bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
bot.pathfinder.setGoal(new goals.GoalNear(x, y, z, range));
bot.pathfinder.setGoal(new goals.GoalFollow(entity, range), true);
```

**Baritone-TS:**
```typescript
import { GoalBlock, GoalNear, GoalFollow } from 'baritone-ts';

bot.pathfinder.setGoal(new GoalBlock(x, y, z));
bot.pathfinder.setGoal(new GoalNear(x, y, z, range));
bot.pathfinder.setGoal(new GoalFollow(entity, range), true);
```

The goal classes have the same signatures - just update your imports.

### Configuring Movements

**mineflayer-pathfinder:**
```typescript
const movements = new Movements(bot, mcData);
movements.canDig = true;
movements.scaffoldingBlocks.push(bot.registry.itemsByName.cobblestone.id);
movements.allowParkour = true;
movements.allowSprinting = true;
bot.pathfinder.setMovements(movements);
```

**Baritone-TS:**
```typescript
// At initialization
pathfinder(bot, {
  canDig: true,
  scaffoldingBlocks: ['cobblestone'],
  allowParkour: true,
  allowSprint: true
});

// Or modify at runtime
bot.pathfinder.ctx.settings.canDig = false;
bot.pathfinder.ctx.settings.allowParkour = false;
```

### Async Navigation

**mineflayer-pathfinder:**
```typescript
// Using events
bot.pathfinder.setGoal(goal);
bot.once('goal_reached', () => {
  console.log('Arrived');
});

// Or with promise wrapper
function goto(goal) {
  return new Promise((resolve, reject) => {
    bot.pathfinder.setGoal(goal);
    bot.once('goal_reached', resolve);
    bot.once('path_reset', reject);
  });
}
```

**Baritone-TS:**
```typescript
// Built-in async support
try {
  await bot.pathfinder.goto(goal);
  console.log('Arrived');
} catch (error) {
  console.log('Failed:', error.message);
}

// Events still work too
bot.on('goal_reached', (goal) => {
  console.log('Arrived');
});
```

### Stopping Pathfinding

**mineflayer-pathfinder:**
```typescript
bot.pathfinder.setGoal(null);
```

**Baritone-TS:**
```typescript
bot.pathfinder.stop();
// Or
bot.pathfinder.setGoal(null);
```

### Checking State

**mineflayer-pathfinder:**
```typescript
if (bot.pathfinder.isMoving()) { ... }
```

**Baritone-TS:**
```typescript
if (bot.pathfinder.isMoving()) { ... }
if (bot.pathfinder.isDigging()) { ... }
if (bot.pathfinder.isPlacing()) { ... }
```

## Goal Migration

| mineflayer-pathfinder | Baritone-TS | Notes |
|----------------------|-------------|-------|
| `goals.GoalBlock` | `GoalBlock` | Same API |
| `goals.GoalNear` | `GoalNear` | Same API |
| `goals.GoalXZ` | `GoalXZ` | Same API |
| `goals.GoalY` | `GoalYLevel` | Renamed |
| `goals.GoalGetToBlock` | `GoalGetToBlock` | Same API |
| `goals.GoalFollow` | `GoalFollow` | Same API |
| `goals.GoalCompositeAny` | `GoalComposite` | Renamed |
| `goals.GoalCompositeAll` | Use custom goal | See below |
| `goals.GoalInvert` | `GoalInverted` | Renamed |
| N/A | `GoalRunAway` | New |
| N/A | `GoalAABB` | New |

### GoalCompositeAll Alternative

```typescript
import { Goal } from 'baritone-ts';

class GoalAllOf implements Goal {
  constructor(private goals: Goal[]) {}

  isEnd(x: number, y: number, z: number): boolean {
    return this.goals.every(g => g.isEnd(x, y, z));
  }

  heuristic(x: number, y: number, z: number): number {
    return Math.max(...this.goals.map(g => g.heuristic(x, y, z)));
  }
}
```

## Events Migration

**mineflayer-pathfinder:**
```typescript
bot.on('goal_reached', (goal) => { });
bot.on('path_update', (result) => { });
bot.on('path_reset', (reason) => { });
```

**Baritone-TS:**
```typescript
// Same events, same signatures
bot.on('goal_reached', (goal) => { });
bot.on('path_update', (result) => { });
bot.on('path_reset', (reason) => { });
bot.on('path_stop', () => { });  // New event
```

## New Features

### Processes (High-Level Automation)

Baritone-TS includes processes that mineflayer-pathfinder doesn't have:

```typescript
import { MineProcess, FollowProcess, FarmProcess } from 'baritone-ts';

// Mine specific blocks
const miner = new MineProcess(bot, bot.pathfinder, {
  blockNames: ['diamond_ore'],
  searchRadius: 64
});
bot.pathfinder.processManager.register('mine', miner);
bot.pathfinder.processManager.activate('mine');

// Automated farming
const farmer = new FarmProcess(bot, bot.pathfinder, {
  cropTypes: ['wheat'],
  replant: true
});
```

### Tasks (Complex Workflows)

```typescript
import { TaskRunner, MineOresTask, CraftItemTask } from 'baritone-ts';

const runner = new TaskRunner(bot, bot.pathfinder);

// Complex task with prerequisites
runner.setTask(new CraftItemTask(bot, {
  itemName: 'diamond_pickaxe',
  quantity: 1,
  gatherMaterials: true  // Will mine diamonds and get sticks
}));
```

### Survival Chains

```typescript
import { WorldSurvivalChain } from 'baritone-ts';

const survival = new WorldSurvivalChain(bot, bot.pathfinder, {
  food: true,        // Auto eat
  mlg: true,         // Water bucket falls
  mobDefense: true,  // Flee/fight mobs
  armor: true        // Keep best armor equipped
});
survival.enable();
```

### Async Pathfinding

```typescript
import { computePathAsync } from 'baritone-ts';

const result = await computePathAsync(
  startX, startY, startZ,
  goal,
  bot.pathfinder.ctx,
  {
    timeout: 5000,
    onProgress: (p) => console.log(`${p.estimatedProgress * 100}%`),
    allowPartial: true
  }
);
```

### Special Travel

```typescript
import { ElytraController, BoatController } from 'baritone-ts';

// Elytra flight
const elytra = new ElytraController(bot, bot.pathfinder.ctx);
elytra.startFlight(destination);

// Boat travel
const boat = new BoatController(bot, bot.pathfinder.ctx);
boat.startTravel(destination);
```

### Trackers

```typescript
// Find blocks efficiently
const diamonds = bot.pathfinder.trackers.blocks.findBlocks('diamond_ore');

// Track threats
const threats = bot.pathfinder.trackers.entities.getThreats({ range: 16 });

// Track storage
const diamondLocations = bot.pathfinder.trackers.storage.findItem('diamond');
```

## Migration Checklist

1. **Update imports** - Change from `mineflayer-pathfinder` to `baritone-ts`
2. **Update initialization** - Use single `pathfinder(bot, options)` call
3. **Update goal imports** - Goals are direct exports, not under `goals` namespace
4. **Update settings** - Settings are passed to `pathfinder()` or accessed via `ctx.settings`
5. **Consider using async** - `bot.pathfinder.goto()` returns a promise
6. **Explore new features** - Processes, tasks, survival chains can simplify your code
7. **Update any custom movements** - Movement API has changed

## Common Issues

### "Cannot find module"

Make sure you've installed baritone-ts:
```bash
npm install baritone-ts
```

### "bot.pathfinder is undefined"

Make sure you call `pathfinder(bot)` after bot spawn:
```typescript
bot.once('spawn', () => {
  pathfinder(bot);
});
```

### "Goal class not found"

Goals are direct exports:
```typescript
// Wrong
import { goals } from 'baritone-ts';
new goals.GoalBlock(x, y, z);

// Correct
import { GoalBlock } from 'baritone-ts';
new GoalBlock(x, y, z);
```

### Settings not applying

Settings can be changed at runtime:
```typescript
// Access settings through context
bot.pathfinder.ctx.settings.canDig = false;
```

## Getting Help

- Check the [documentation](./README.md)
- Look at [examples](./examples.md)
- Review [API reference](./api-reference.md)
