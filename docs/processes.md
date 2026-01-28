# Processes

Processes are high-level automation behaviors that control the pathfinder. They handle the "what to do" while the pathfinder handles the "how to get there."

## Overview

Baritone-TS includes 7 process types:

| Process | Purpose |
|---------|---------|
| **MineProcess** | Find and mine specific blocks |
| **FollowProcess** | Follow an entity |
| **FarmProcess** | Harvest and replant crops |
| **CombatProcess** | Fight or flee from enemies |
| **BuildProcess** | Build structures |
| **GatherProcess** | Collect dropped items |
| **ExploreProcess** | Explore unknown areas |

## Process Manager

All processes are managed through the ProcessManager:

```typescript
// Get process manager
const pm = bot.pathfinder.processManager;

// Register a process
pm.register('mine', new MineProcess(bot, bot.pathfinder, options));

// Activate a process
pm.activate('mine');

// Deactivate a process
pm.deactivate('mine');

// Check active process
const active = pm.getActive(); // Returns process name or null

// Check if specific process is active
const isMining = pm.isActive('mine');
```

Only one process can be active at a time.

## MineProcess

Finds and mines specific blocks.

```typescript
import { MineProcess } from 'baritone-ts';

const mineProcess = new MineProcess(bot, bot.pathfinder, {
  // Blocks to mine
  blockNames: ['diamond_ore', 'deepslate_diamond_ore'],

  // Search options
  searchRadius: 64,       // How far to search
  maxYLevel: 256,         // Maximum Y to search
  minYLevel: -64,         // Minimum Y to search

  // Limits
  maxBlocks: 10,          // Stop after mining N blocks
  maxTime: 300000,        // Timeout in ms (5 minutes)

  // Behavior
  collectDrops: true,     // Pick up mined items
  preferSilkTouch: false, // Use silk touch if available
});

bot.pathfinder.processManager.register('mine', mineProcess);
bot.pathfinder.processManager.activate('mine');
```

### MineProcess Events

```typescript
mineProcess.on('block_found', (block) => {
  console.log(`Found ${block.name} at ${block.position}`);
});

mineProcess.on('block_mined', (block) => {
  console.log(`Mined ${block.name}`);
});

mineProcess.on('complete', (stats) => {
  console.log(`Mined ${stats.blocksMined} blocks`);
});
```

### Mine Specific Positions

```typescript
// Mine blocks at specific locations
mineProcess.mineAt([
  { x: 100, y: 64, z: 100 },
  { x: 101, y: 64, z: 100 },
  { x: 102, y: 64, z: 100 }
]);
```

## FollowProcess

Follows a moving entity.

```typescript
import { FollowProcess } from 'baritone-ts';

const followProcess = new FollowProcess(bot, bot.pathfinder, {
  // Target (player name or entity)
  target: 'PlayerName',
  // OR
  // target: bot.players['PlayerName'].entity,

  // Distance
  minDistance: 2,         // Don't get closer than this
  maxDistance: 5,         // Recalculate if further than this

  // Behavior
  sprint: true,           // Sprint to catch up
  stopOnReach: false,     // Keep following vs stop when close
});

bot.pathfinder.processManager.register('follow', followProcess);
bot.pathfinder.processManager.activate('follow');
```

### Dynamic Target Updates

```typescript
// Change target while following
followProcess.setTarget('OtherPlayer');
followProcess.setTarget(someEntity);
```

## FarmProcess

Harvests and replants crops.

```typescript
import { FarmProcess } from 'baritone-ts';

const farmProcess = new FarmProcess(bot, bot.pathfinder, {
  // Crops to farm
  cropTypes: ['wheat', 'carrots', 'potatoes', 'beetroots'],

  // Area
  searchRadius: 32,       // Search radius for crops
  farmArea: {             // Optional: limit to specific area
    min: { x: 0, y: 64, z: 0 },
    max: { x: 100, y: 64, z: 100 }
  },

  // Behavior
  replant: true,          // Replant after harvesting
  harvestOnlyMature: true, // Only harvest full-grown crops
  collectDrops: true,     // Pick up harvested items
});

bot.pathfinder.processManager.register('farm', farmProcess);
bot.pathfinder.processManager.activate('farm');
```

### Farm Events

```typescript
farmProcess.on('crop_harvested', (block) => {
  console.log(`Harvested ${block.name}`);
});

farmProcess.on('crop_planted', (position) => {
  console.log(`Planted at ${position}`);
});
```

## CombatProcess

Handles combat with mobs or players.

```typescript
import { CombatProcess } from 'baritone-ts';

const combatProcess = new CombatProcess(bot, bot.pathfinder, {
  // Combat mode
  mode: 'attack',         // 'attack' | 'flee' | 'kite' | 'defend'

  // Targeting
  targetTypes: ['zombie', 'skeleton', 'creeper'],
  targetPlayers: false,   // Target players
  priorityTarget: null,   // Specific entity to focus

  // Range
  attackRange: 3.5,       // Melee range
  fleeRange: 20,          // Distance to flee to
  engageRange: 16,        // Range to start combat

  // Behavior
  useShield: true,        // Block with shield
  useBow: true,           // Use ranged weapons
  useFood: true,          // Eat when low health
  criticalHits: true,     // Time jumps for crits
});

bot.pathfinder.processManager.register('combat', combatProcess);
bot.pathfinder.processManager.activate('combat');
```

### Combat Modes

```typescript
// Attack: Pursue and fight enemies
combatProcess.setMode('attack');

// Flee: Run away from enemies
combatProcess.setMode('flee');

// Kite: Attack while maintaining distance
combatProcess.setMode('kite');

// Defend: Stay in position, fight approaching enemies
combatProcess.setMode('defend');
```

### Combat Events

```typescript
combatProcess.on('target_acquired', (entity) => {
  console.log(`Targeting ${entity.name}`);
});

combatProcess.on('target_killed', (entity) => {
  console.log(`Killed ${entity.name}`);
});

combatProcess.on('flee_started', () => {
  console.log('Fleeing!');
});
```

## BuildProcess

Builds structures from blueprints.

```typescript
import { BuildProcess } from 'baritone-ts';

const buildProcess = new BuildProcess(bot, bot.pathfinder, {
  // Build instructions (array of {position, blockName})
  instructions: [
    { position: { x: 0, y: 64, z: 0 }, blockName: 'stone' },
    { position: { x: 1, y: 64, z: 0 }, blockName: 'stone' },
    // ...
  ],

  // Or use helper to create shapes
  // instructions: BuildProcess.createBox(0, 64, 0, 5, 3, 5, 'stone'),

  // Behavior
  clearArea: true,        // Remove existing blocks first
  collectMaterials: true, // Gather needed materials
  respectProtection: true, // Don't build in protected areas
});

bot.pathfinder.processManager.register('build', buildProcess);
bot.pathfinder.processManager.activate('build');
```

### Build Helpers

```typescript
// Create a filled box
const box = BuildProcess.createBox(
  startX, startY, startZ,
  width, height, depth,
  'stone'
);

// Create hollow box (walls only)
const walls = BuildProcess.createHollowBox(
  startX, startY, startZ,
  width, height, depth,
  'cobblestone'
);

// Create floor
const floor = BuildProcess.createFloor(
  startX, startY, startZ,
  width, depth,
  'oak_planks'
);

// Create walls
const walls = BuildProcess.createWalls(
  startX, startY, startZ,
  width, height, depth,
  'stone_bricks'
);
```

### Loading Schematics

```typescript
// Load from .schematic or .nbt file
const instructions = await BuildProcess.loadSchematic('house.schematic');
const buildProcess = new BuildProcess(bot, bot.pathfinder, {
  instructions,
  origin: { x: 100, y: 64, z: 100 }
});
```

## GatherProcess

Collects dropped items.

```typescript
import { GatherProcess } from 'baritone-ts';

const gatherProcess = new GatherProcess(bot, bot.pathfinder, {
  // Items to collect
  itemNames: ['diamond', 'iron_ingot', 'gold_ingot'],
  // OR collect all
  collectAll: true,

  // Area
  searchRadius: 32,

  // Behavior
  followDrops: true,      // Move to drops as they appear
  pickupDelay: 500,       // Wait after drop (despawn prevention)
});

bot.pathfinder.processManager.register('gather', gatherProcess);
bot.pathfinder.processManager.activate('gather');
```

## ExploreProcess

Explores unknown terrain.

```typescript
import { ExploreProcess } from 'baritone-ts';

const exploreProcess = new ExploreProcess(bot, bot.pathfinder, {
  // Exploration mode
  mode: 'spiral',         // 'spiral' | 'random' | 'direction'

  // Area
  searchRadius: 128,      // How far to explore
  chunkRadius: 8,         // Chunks to explore per iteration

  // Direction mode options
  direction: { x: 1, z: 0 }, // Explore in +X direction

  // Behavior
  avoidWater: false,      // Avoid water areas
  avoidCaves: false,      // Stay on surface
  markExplored: true,     // Track explored chunks
});

bot.pathfinder.processManager.register('explore', exploreProcess);
bot.pathfinder.processManager.activate('explore');
```

## Process Priorities

When multiple processes are registered, set priorities:

```typescript
pm.register('combat', combatProcess, { priority: 100 });  // Highest
pm.register('mine', mineProcess, { priority: 50 });
pm.register('follow', followProcess, { priority: 25 });

// Higher priority processes can interrupt lower ones
// Combat will interrupt mining if enemies appear
```

## Process Lifecycle

```typescript
process.on('start', () => console.log('Process started'));
process.on('pause', () => console.log('Process paused'));
process.on('resume', () => console.log('Process resumed'));
process.on('stop', () => console.log('Process stopped'));
process.on('complete', () => console.log('Process completed'));
process.on('error', (err) => console.log('Process error:', err));
```

## Creating Custom Processes

Extend BaseProcess:

```typescript
import { BaseProcess, ProcessTickResult } from 'baritone-ts';

class MyProcess extends BaseProcess {
  constructor(bot, pathfinder, options) {
    super(bot, pathfinder, options);
  }

  onTick(): ProcessTickResult {
    // Called each tick while active

    // Return what the pathfinder should do
    return {
      goal: new GoalBlock(100, 64, 100),
      // OR
      // idle: true,  // Do nothing this tick
      // OR
      // complete: true,  // Process is done
    };
  }

  onStart(): void {
    // Called when process is activated
  }

  onStop(): void {
    // Called when process is deactivated
  }
}
```

## Examples

### Auto-Miner

```typescript
bot.once('spawn', () => {
  pathfinder(bot);

  const miner = new MineProcess(bot, bot.pathfinder, {
    blockNames: ['coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore'],
    searchRadius: 64,
    collectDrops: true
  });

  bot.pathfinder.processManager.register('mine', miner);
  bot.pathfinder.processManager.activate('mine');

  miner.on('complete', () => {
    console.log('No more ores found!');
  });
});
```

### Guard Bot

```typescript
const combat = new CombatProcess(bot, bot.pathfinder, {
  mode: 'defend',
  targetTypes: ['zombie', 'skeleton', 'spider', 'creeper'],
  engageRange: 10
});

const follow = new FollowProcess(bot, bot.pathfinder, {
  target: 'PlayerToGuard',
  minDistance: 2,
  maxDistance: 4
});

// Combat has higher priority
pm.register('combat', combat, { priority: 100 });
pm.register('follow', follow, { priority: 50 });

// Normally follows, attacks threats when they appear
pm.activate('follow');
pm.activate('combat');
```
