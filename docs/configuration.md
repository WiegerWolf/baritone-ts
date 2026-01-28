# Configuration

Baritone-TS offers extensive configuration options to customize pathfinding behavior.

## Basic Configuration

Pass options when initializing the pathfinder:

```typescript
import { pathfinder } from 'baritone-ts';

pathfinder(bot, {
  // Your options here
});
```

## All Options

### Movement Options

```typescript
pathfinder(bot, {
  // Sprinting
  allowSprint: true,        // Enable sprinting (default: true)

  // Parkour
  allowParkour: true,       // Enable parkour jumps (default: true)
  allowParkourPlace: false, // Place blocks mid-parkour (default: false)

  // Swimming
  allowSwim: true,          // Enable swimming paths (default: true)

  // Sneaking
  allowSneak: true,         // Enable sneaking at edges (default: true)
});
```

### Block Interaction

```typescript
pathfinder(bot, {
  // Breaking blocks
  canDig: true,                      // Allow breaking blocks (default: true)
  allowBreakOnlyLookingAt: true,     // Only break blocks bot is looking at
  preferSilkTouch: false,            // Prefer silk touch tools

  // Placing blocks
  canPlace: true,                    // Allow placing blocks (default: true)
  scaffoldingBlocks: [               // Blocks to use for building
    'cobblestone',
    'dirt',
    'netherrack',
    'cobbled_deepslate'
  ],
});
```

### Safety Options

```typescript
pathfinder(bot, {
  // Fall damage
  maxFallHeight: 3,          // Max fall without water bucket (default: 3)
  allowWaterBucket: true,    // Use water bucket for long falls (default: true)

  // Hazards
  avoidLava: true,           // Avoid lava (default: true)
  avoidFire: true,           // Avoid fire (default: true)

  // Entity avoidance
  avoidMobs: false,          // Path around hostile mobs
  mobAvoidanceRadius: 5,     // Radius to avoid mobs
});
```

### Cost Tuning

```typescript
pathfinder(bot, {
  // Movement costs
  jumpPenalty: 2.0,          // Extra cost for jumps (default: 2.0)
  walkSpeed: 4.317,          // Walking blocks/second
  sprintSpeed: 5.612,        // Sprinting blocks/second

  // Tool efficiency
  toolEfficiencyMultiplier: 1.0,  // Scale breaking costs
});
```

### Pathfinding Limits

```typescript
pathfinder(bot, {
  // Search limits
  maxSearchTime: 10000,      // Max search time in ms (default: 10000)
  maxNodesPerTick: 1000,     // A* nodes per tick (default: 1000)
  maxTotalNodes: 100000,     // Max nodes before giving up

  // Path limits
  maxPathLength: 500,        // Max movements in a path
  minPathLength: 5,          // Min movements before accepting partial
});
```

### Chunk Loading

```typescript
pathfinder(bot, {
  // Wait for chunks
  waitForChunks: true,       // Wait for chunks to load (default: true)
  chunkLoadTimeout: 5000,    // Max wait for chunks (ms)
});
```

## Modifying Settings at Runtime

Access and modify settings after initialization:

```typescript
// Get current settings
const settings = bot.pathfinder.ctx.settings;

// Modify settings
settings.canDig = false;
settings.maxFallHeight = 5;
settings.allowParkour = false;

// Settings take effect on next path calculation
```

## Settings Manager

For organized settings management:

```typescript
import { SettingsManager } from 'baritone-ts';

const manager = new SettingsManager(bot.pathfinder.ctx);

// Save current settings as a preset
manager.savePreset('mining');

// Load a preset
manager.loadPreset('mining');

// Reset to defaults
manager.reset();
```

### Built-in Presets

```typescript
// Conservative - safe, slow
manager.loadPreset('conservative');
// canDig: false, allowParkour: false, maxFallHeight: 2

// Aggressive - fast, risky
manager.loadPreset('aggressive');
// allowParkour: true, maxFallHeight: 5, allowWaterBucket: true

// Stealth - minimize visibility
manager.loadPreset('stealth');
// avoidMobs: true, allowSprint: false
```

## Scenario-Based Configuration

### Mining Configuration

```typescript
pathfinder(bot, {
  canDig: true,
  canPlace: true,
  scaffoldingBlocks: ['cobblestone', 'cobbled_deepslate'],
  maxFallHeight: 3,
  allowWaterBucket: true
});
```

### Following Configuration

```typescript
pathfinder(bot, {
  canDig: false,        // Don't destroy terrain
  canPlace: false,      // Don't modify world
  allowParkour: true,   // Keep up with player
  allowSprint: true
});
```

### Building Configuration

```typescript
pathfinder(bot, {
  canDig: true,
  canPlace: true,
  scaffoldingBlocks: ['scaffolding', 'dirt'],
  allowParkour: false,  // Precise positioning
  maxFallHeight: 3
});
```

### Combat Configuration

```typescript
pathfinder(bot, {
  canDig: false,
  canPlace: false,
  allowSprint: true,
  allowParkour: true,
  avoidMobs: false      // Need to approach enemies
});
```

### Exploration Configuration

```typescript
pathfinder(bot, {
  canDig: false,        // Don't modify world
  canPlace: false,
  allowParkour: true,
  maxSearchTime: 30000, // Longer searches for distant goals
});
```

## Performance Tuning

### Faster Pathfinding

Reduce computation time:

```typescript
pathfinder(bot, {
  canDig: false,           // Reduces branching
  canPlace: false,
  allowParkour: false,     // Parkour is expensive to evaluate
  maxFallHeight: 2,        // Fewer fall calculations
  maxNodesPerTick: 2000,   // More nodes per tick
});
```

### Lower Memory Usage

Reduce memory footprint:

```typescript
pathfinder(bot, {
  maxTotalNodes: 50000,    // Cap node count
  maxPathLength: 200,      // Shorter paths
});
```

### Better Path Quality

Get better paths at cost of speed:

```typescript
pathfinder(bot, {
  maxSearchTime: 20000,    // More search time
  maxTotalNodes: 200000,   // More nodes
  jumpPenalty: 3.0,        // Prefer flat paths
});
```

## Debug Configuration

```typescript
pathfinder(bot, {
  debug: true,              // Enable debug output
  visualize: true,          // Show path visualization
  logMovements: true,       // Log movement decisions
});
```

## Configuration Examples

### Safe Navigation Bot

```typescript
pathfinder(bot, {
  // Very conservative settings
  canDig: false,
  canPlace: false,
  allowParkour: false,
  maxFallHeight: 2,
  avoidMobs: true,
  mobAvoidanceRadius: 8,
  avoidLava: true,
  avoidFire: true
});
```

### Speed Running Bot

```typescript
pathfinder(bot, {
  // Maximum speed
  allowSprint: true,
  allowParkour: true,
  allowParkourPlace: true,
  maxFallHeight: 5,
  allowWaterBucket: true,
  canDig: true,
  canPlace: true
});
```

### Stealth Bot

```typescript
pathfinder(bot, {
  // Stay hidden
  allowSprint: false,
  avoidMobs: true,
  mobAvoidanceRadius: 20,
  canDig: false,        // Don't make noise
  canPlace: false
});
```
