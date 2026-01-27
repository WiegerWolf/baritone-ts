# Baritone-TS

A Baritone-quality pathfinding plugin for Mineflayer in TypeScript.

## Overview

Baritone-TS is a high-performance pathfinding implementation that brings the advanced techniques from [Baritone](https://github.com/cabaletta/baritone) (the famous Minecraft pathfinding mod) to the [Mineflayer](https://github.com/PrismarineJS/mineflayer) bot framework.

### Key Features

- **Tick-based cost model** - Accurate path selection using real game tick costs
- **Multi-coefficient A\*** - 7 coefficient variants for graceful degradation under timeout
- **20 movement types** - Comprehensive movement support including parkour, swimming, climbing
- **Process system** - High-level automation (mining, following, farming, combat)
- **Elytra & Boat support** - Long-distance travel controllers
- **2-bit chunk caching** - Memory-efficient block storage with disk persistence
- **Anti-detection** - Smooth rotation and human-like movement patterns

## Installation

```bash
npm install baritone-ts
```

## Quick Start

```typescript
import { createBot } from 'mineflayer';
import { pathfinder, GoalBlock } from 'baritone-ts';

const bot = createBot({
  host: 'localhost',
  port: 25565,
  username: 'Bot'
});

bot.once('spawn', () => {
  // Initialize pathfinder
  pathfinder(bot);

  // Navigate to coordinates
  const goal = new GoalBlock(100, 64, 100);
  bot.pathfinder.setGoal(goal);
});

bot.on('goal_reached', (goal) => {
  console.log('Arrived at destination!');
});
```

## Goals

Baritone-TS provides various goal types for different pathfinding scenarios:

```typescript
import {
  GoalBlock,      // Exact position
  GoalXZ,         // X/Z coordinates (any Y)
  GoalYLevel,     // Specific Y level
  GoalNear,       // Within radius of position
  GoalGetToBlock, // Adjacent to a block
  GoalFollow,     // Follow an entity
  GoalRunAway,    // Flee from dangers
  GoalComposite,  // Multiple goals (any)
  GoalInverted,   // Avoid a position
  GoalAABB        // Inside bounding box
} from 'baritone-ts';

// Examples
const exactPos = new GoalBlock(100, 64, 100);
const nearPos = new GoalNear(100, 64, 100, 5); // Within 5 blocks
const followPlayer = new GoalFollow(targetEntity, 3); // 3 blocks behind
const runAway = new GoalRunAway([{x: 100, y: 64, z: 100}], 20); // 20 blocks away
```

## Process System

High-level automation processes for common tasks:

### Mining

```typescript
import { MineProcess } from 'baritone-ts';

const mineProcess = new MineProcess(bot, bot.pathfinder, {
  blockNames: ['diamond_ore', 'deepslate_diamond_ore'],
  searchRadius: 64,
  maxBlocks: 10
});

// Register and activate
bot.pathfinder.processManager.register('mine', mineProcess);
bot.pathfinder.processManager.activate('mine');
```

### Following

```typescript
import { FollowProcess } from 'baritone-ts';

const followProcess = new FollowProcess(bot, bot.pathfinder, {
  target: 'PlayerName', // or entity reference
  minDistance: 3,
  maxDistance: 6
});
```

### Farming

```typescript
import { FarmProcess } from 'baritone-ts';

const farmProcess = new FarmProcess(bot, bot.pathfinder, {
  cropTypes: ['wheat', 'carrots', 'potatoes'],
  searchRadius: 32,
  replant: true
});
```

### Combat

```typescript
import { CombatProcess } from 'baritone-ts';

const combatProcess = new CombatProcess(bot, bot.pathfinder, {
  mode: 'attack', // 'attack' | 'flee' | 'kite' | 'defend'
  attackRange: 3.5,
  targetTypes: ['zombie', 'skeleton'],
  useShield: true
});
```

### Building

```typescript
import { BuildProcess } from 'baritone-ts';

const buildProcess = new BuildProcess(bot, bot.pathfinder, {
  instructions: BuildProcess.createBox(0, 64, 0, 5, 3, 5, 'stone')
});
```

## Special Travel

### Elytra Flight

```typescript
import { ElytraController, hasElytraEquipped } from 'baritone-ts';
import { Vec3 } from 'vec3';

if (hasElytraEquipped(bot)) {
  const elytra = new ElytraController(bot, bot.pathfinder.ctx);

  if (elytra.startFlight(new Vec3(1000, 100, 1000))) {
    const interval = setInterval(() => {
      if (elytra.tick()) {
        clearInterval(interval);
        console.log('Flight complete!');
      }
    }, 50);
  }
}
```

### Boat Travel

```typescript
import { BoatController, hasBoatItem } from 'baritone-ts';
import { Vec3 } from 'vec3';

const boat = new BoatController(bot, bot.pathfinder.ctx);

if (boat.startTravel(new Vec3(500, 63, 500))) {
  const interval = setInterval(() => {
    if (boat.tick()) {
      clearInterval(interval);
      console.log('Boat travel complete!');
    }
  }, 50);
}
```

## Async Pathfinding

For non-blocking path computation:

```typescript
import { computePathAsync, GoalBlock } from 'baritone-ts';

const goal = new GoalBlock(100, 64, 100);

const result = await computePathAsync(
  bot.entity.position.x,
  bot.entity.position.y,
  bot.entity.position.z,
  goal,
  bot.pathfinder.ctx,
  {
    onProgress: (progress) => {
      console.log(`Computing: ${(progress.estimatedProgress * 100).toFixed(1)}%`);
    },
    timeout: 5000
  }
);

if (result.status === 'success') {
  console.log(`Found path with ${result.path.length} nodes`);
}
```

## Configuration

```typescript
import { pathfinder } from 'baritone-ts';

pathfinder(bot, {
  // Movement options
  allowSprint: true,
  allowParkour: true,
  allowParkourPlace: false,

  // Digging options
  canDig: true,
  allowBreakOnlyLookingAt: true,

  // Placing options
  canPlace: true,
  scaffoldingBlocks: ['cobblestone', 'dirt', 'netherrack'],

  // Safety options
  maxFallHeight: 3,
  allowWaterBucket: true,

  // Performance
  jumpPenalty: 2.0
});
```

## Movement Types

| Movement | Description |
|----------|-------------|
| Traverse | Horizontal same-level walking |
| Ascend | Jump up 1 block |
| Descend | Drop down safely |
| Diagonal | Diagonal movement |
| Pillar | Tower up by placing blocks |
| Parkour | Long jumps (1-4 blocks) |
| ParkourAscend | Jump + climb combination |
| Fall | Extended falling with water bucket |
| SwimHorizontal | Horizontal swimming |
| SwimUp/Down | Vertical swimming |
| WaterExit/Entry | Water transitions |
| ThroughDoor | Door/gate/trapdoor passage |
| ClimbUp/Down | Ladder and vine climbing |
| MountLadder | Step onto climbable |
| DismountLadder | Step off climbable |

## Cost Model

Baritone-TS uses a tick-based cost model for accurate path selection:

| Action | Cost (ticks) |
|--------|--------------|
| Walk 1 block | 4.633 |
| Sprint 1 block | 3.564 |
| Sneak 1 block | 15.385 |
| Swim 1 block | 9.091 |
| Ladder up | 5.0 |
| Ladder down | 1.43 |
| Jump | 2.5 |

## Events

```typescript
bot.on('goal_reached', (goal) => {
  console.log('Reached goal');
});

bot.on('path_update', (result) => {
  console.log(`Path status: ${result.status}`);
});

bot.on('path_reset', (reason) => {
  console.log(`Path reset: ${reason}`);
});

bot.on('path_stop', () => {
  console.log('Pathfinding stopped');
});
```

## API Reference

### Pathfinder

- `setGoal(goal, dynamic?)` - Set the current goal
- `getGoal()` - Get current goal
- `getPathTo(goal)` - Calculate path to goal
- `getPathFromTo(start, goal)` - Calculate path between positions
- `goto(goal)` - Navigate to goal (async)
- `stop()` - Stop pathfinding
- `isMoving()` - Check if currently moving
- `isDigging()` - Check if currently digging
- `isPlacing()` - Check if currently placing

### Path Utilities

```typescript
import {
  smoothPath,
  simplifyPath,
  calculatePathCost,
  calculatePathDistance,
  pathContains,
  mergePaths
} from 'baritone-ts';
```

## Performance

Baritone-TS is optimized for performance:

- **O(1) block lookups** via precomputed data
- **O(log n) A\* operations** via binary heap
- **2-bit chunk caching** for 4x memory efficiency
- **Time checks every 64 nodes** to minimize overhead
- **Movement skipping** for faster execution

## Comparison with mineflayer-pathfinder

| Feature | baritone-ts | mineflayer-pathfinder |
|---------|-------------|----------------------|
| Cost model | Tick-based | Integer |
| A* variants | 7 coefficients | Single |
| Movements | 20 types | ~9 types |
| Chunk cache | 2-bit encoded | None |
| Processes | 7 automation types | None |
| Elytra/Boat | Full support | None |
| Path smoothing | Line-of-sight | None |

## License

GNU AFFERO GENERAL PUBLIC LICENSE

## Credits

- [Baritone](https://github.com/cabaletta/baritone) - Original Java implementation
- [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder) - Inspiration
- [Mineflayer](https://github.com/PrismarineJS/mineflayer) - Bot framework
