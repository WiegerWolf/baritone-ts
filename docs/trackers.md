# Trackers

Trackers maintain cached information about the game world, enabling efficient queries without repeated scanning. They use a lazy-update pattern to minimize expensive computations.

## Overview

Baritone-TS includes these tracker types:

| Tracker | Purpose |
|---------|---------|
| **Tracker** | Base class with dirty-flag pattern |
| **AsyncTracker** | For multi-tick update operations |
| **BlockTracker** | Find and track specific block types |
| **EntityTracker** | Track entities, projectiles, threats |
| **ItemStorageTracker** | Track container and inventory contents |
| **MiscBlockTracker** | Track special blocks (doors, water, portals) |
| **SimpleChunkTracker** | Track chunk load state |
| **TrackerManager** | Coordinate all trackers, handle dimension changes |

## Tracker Manager

The TrackerManager coordinates updates across all trackers and handles dimension changes:

```typescript
import { TrackerManager, createTrackerManager } from 'baritone-ts';

// Create tracker manager
const trackers = createTrackerManager(bot);

// Or using constructor
const trackers = new TrackerManager(bot);

// Register custom trackers
trackers.register(myCustomTracker);

// Tick all trackers (marks them dirty, ticks async trackers)
trackers.tick();

// Reset all trackers (on dimension change)
trackers.resetAll();

// Start/stop dimension change detection
trackers.start();
trackers.stop();

// Get all registered trackers
const allTrackers = trackers.getTrackers();

// Debug info
console.log(trackers.getDebugInfo());
```

### Lazy Updates

Trackers use **lazy updates** with dirty flags - they only recalculate when accessed:

```typescript
// Each tick, all trackers are marked dirty
trackers.tick();  // Marks all dirty

// First access triggers update
const ores = tracker.findBlocks('diamond_ore');

// Subsequent accesses in same tick use cached data
const moreOres = tracker.findBlocks('diamond_ore'); // Uses cache

// Next tick, all trackers marked dirty again
// First access triggers new update
```

### Async Trackers

Some trackers spread work across multiple ticks:

```typescript
// AsyncTracker updates incrementally
if (asyncTracker.isUpdateInProgress()) {
  const progress = asyncTracker.getUpdateProgress(); // 0.0 - 1.0
  console.log(`Update ${Math.floor(progress * 100)}% complete`);
}
```

## BlockTracker

Finds and tracks blocks by type.

### Basic Usage

```typescript
import { BlockTracker } from 'baritone-ts';

const blockTracker = bot.pathfinder.trackers.blocks;

// Find blocks by name
const diamonds = blockTracker.findBlocks('diamond_ore');
console.log(`Found ${diamonds.length} diamond ore blocks`);

// Find multiple block types
const ores = blockTracker.findBlocks([
  'diamond_ore',
  'deepslate_diamond_ore',
  'iron_ore',
  'deepslate_iron_ore'
]);

// Find nearest
const nearest = blockTracker.findNearest('diamond_ore');
if (nearest) {
  console.log(`Nearest diamond at ${nearest.x}, ${nearest.y}, ${nearest.z}`);
}
```

### Search Options

```typescript
const blocks = blockTracker.findBlocks('diamond_ore', {
  // Search area
  maxDistance: 64,         // Search radius
  maxCount: 100,           // Max results

  // Y level limits
  minY: -64,
  maxY: 16,

  // Custom filter
  filter: (block) => {
    // Only exposed blocks (air adjacent)
    return block.adjacentToAir;
  },

  // Sorting
  sort: 'nearest',         // 'nearest' | 'furthest' | 'none'
});
```

### Block Scanning

```typescript
// Scan a specific area
const area = blockTracker.scanArea(
  { x: 0, y: 0, z: 0 },      // Min corner
  { x: 100, y: 100, z: 100 }, // Max corner
  ['chest', 'barrel']         // Block types
);

// Continuous scanning
blockTracker.startContinuousScan({
  blockTypes: ['diamond_ore'],
  radius: 32,
  interval: 5000  // Rescan every 5 seconds
});

blockTracker.on('block_found', (block) => {
  console.log(`Found ${block.name} at ${block.position}`);
});

// Stop scanning
blockTracker.stopContinuousScan();
```

### Block Events

```typescript
// Block placed
blockTracker.on('block_placed', (block) => {
  console.log(`Block placed: ${block.name}`);
});

// Block broken
blockTracker.on('block_broken', (position, oldBlock) => {
  console.log(`Block broken: ${oldBlock.name}`);
});

// Block update
blockTracker.on('block_update', (position, oldBlock, newBlock) => {
  console.log(`Block changed: ${oldBlock.name} -> ${newBlock.name}`);
});
```

### Custom Block Queries

```typescript
// Find blocks matching custom criteria
const valuableBlocks = blockTracker.findBlocksWhere((block) => {
  // Check if block is valuable
  return [
    'diamond_block',
    'emerald_block',
    'gold_block',
    'ancient_debris'
  ].includes(block.name);
});

// Find exposed ores (for mining)
const exposedOres = blockTracker.findExposed([
  'diamond_ore',
  'iron_ore',
  'gold_ore'
]);
```

## EntityTracker

Tracks entities, projectiles, and threats with automatic categorization.

### Entity Categories

```typescript
import { EntityCategory } from 'baritone-ts';

enum EntityCategory {
  Hostile,     // Zombies, skeletons, creepers, etc.
  Neutral,     // Wolves, endermen, piglins, etc.
  Passive,     // Cows, pigs, sheep, villagers, etc.
  Projectile,  // Arrows, fireballs, ender pearls, etc.
  Player,      // Other players
  Other        // Misc entities
}
```

### Basic Usage

```typescript
import { EntityTracker, EntityCategory } from 'baritone-ts';

const entityTracker = bot.pathfinder.trackers.entities;

// Get all entities
const all = entityTracker.getAll();

// Get entities by category
const hostiles = entityTracker.getByCategory(EntityCategory.Hostile);
const players = entityTracker.getByCategory(EntityCategory.Player);

// Get entities by type name
const zombies = entityTracker.getByType('zombie');

// Get nearest
const nearestPlayer = entityTracker.getNearest('player');
const nearestHostile = entityTracker.getNearestHostile();

// Get entities within reach
const closeEntities = entityTracker.getEntitiesWithinReach();
```

### Threat Detection

```typescript
// Get all hostile mobs
const hostiles = entityTracker.getHostiles();

// Get threats within range
const threats = entityTracker.getThreats({
  range: 16,
  types: ['zombie', 'skeleton', 'creeper', 'spider']
});

// Check if position is dangerous
const isDangerous = entityTracker.isDangerous(position, {
  creeperRange: 5,
  skeletonRange: 16
});

// Get threat level (0-1)
const threatLevel = entityTracker.getThreatLevel();
if (threatLevel > 0.5) {
  console.log('High threat environment!');
}
```

### Projectile Tracking

```typescript
// Get all projectiles
const projectiles = entityTracker.getProjectiles();

// Get projectiles heading toward bot
const incoming = entityTracker.getIncomingProjectiles();

for (const projectile of incoming) {
  console.log(`Incoming ${projectile.name} from ${projectile.shooter?.name || 'unknown'}`);
  console.log(`  ETA: ${projectile.timeToImpact.toFixed(1)}s`);
  console.log(`  Impact: ${projectile.predictedImpact}`);
}

// Check if should dodge
if (entityTracker.shouldDodge()) {
  const dodgeDirection = entityTracker.getDodgeDirection();
  // Move in dodge direction
}
```

### Entity Events

```typescript
// Entity spawned
entityTracker.on('entity_spawn', (entity) => {
  console.log(`${entity.name} spawned at ${entity.position}`);
});

// Entity despawned
entityTracker.on('entity_despawn', (entity) => {
  console.log(`${entity.name} despawned`);
});

// Threat detected
entityTracker.on('threat_detected', (entity, distance) => {
  console.log(`Threat: ${entity.name} at ${distance.toFixed(1)} blocks`);
});

// Projectile incoming
entityTracker.on('projectile_incoming', (projectile) => {
  console.log(`Dodge! ${projectile.name} incoming`);
});
```

### Entity Filtering

```typescript
// Custom entity filter
const targetEntities = entityTracker.filter((entity) => {
  // Target hostile mobs with drops
  return entity.type === 'hostile' &&
         entity.mobType !== 'creeper' &&
         entity.health > 0;
});

// Get entities in area
const nearbyEntities = entityTracker.getInArea(
  { x: 0, y: 64, z: 0 },
  { x: 100, y: 128, z: 100 }
);
```

## ItemStorageTracker

Tracks container contents.

### Basic Usage

```typescript
import { ItemStorageTracker } from 'baritone-ts';

const storage = bot.pathfinder.trackers.storage;

// Get known containers
const containers = storage.getContainers();

// Find containers with specific item
const diamondContainers = storage.findContainersWithItem('diamond');

// Get container contents (if known)
const contents = storage.getContents(containerPosition);
if (contents) {
  console.log(`Container has ${contents.length} slot types`);
}
```

### Container Discovery

```typescript
// Scan for containers
storage.scanForContainers({
  radius: 32,
  types: ['chest', 'barrel', 'shulker_box']
});

// Register a known container
storage.registerContainer(position, 'chest');

// Forget a container
storage.forgetContainer(position);
```

### Item Queries

```typescript
// Find where an item is stored
const locations = storage.findItem('diamond');
for (const loc of locations) {
  console.log(`${loc.count} diamonds in ${loc.containerType} at ${loc.position}`);
}

// Get total count of an item
const totalDiamonds = storage.getTotalCount('diamond');
console.log(`Total diamonds in storage: ${totalDiamonds}`);

// Check if have item in storage
if (storage.hasItem('diamond', 5)) {
  console.log('Have at least 5 diamonds in storage');
}
```

### Container Interaction

```typescript
// Open and scan container
await storage.openAndScan(containerPosition);

// The contents are now cached
const contents = storage.getContents(containerPosition);

// Mark container as opened
storage.markOpened(containerPosition);

// Get last opened time
const lastOpened = storage.getLastOpened(containerPosition);
```

### Storage Events

```typescript
// Container discovered
storage.on('container_discovered', (position, type) => {
  console.log(`Found ${type} at ${position}`);
});

// Contents updated
storage.on('contents_updated', (position, contents) => {
  console.log(`Updated contents of container at ${position}`);
});

// Item deposited
storage.on('item_deposited', (position, item, count) => {
  console.log(`Deposited ${count}x ${item} into container`);
});

// Item withdrawn
storage.on('item_withdrawn', (position, item, count) => {
  console.log(`Withdrew ${count}x ${item} from container`);
});
```

## Custom Trackers

Create custom trackers by extending the Tracker base class:

```typescript
import { Tracker } from 'baritone-ts';

interface CropData {
  position: Vec3;
  cropType: string;
  growthStage: number;
  readyToHarvest: boolean;
}

class CropTracker extends Tracker<CropData[]> {
  private crops: CropData[] = [];

  protected shouldUpdate(): boolean {
    // Update every 100 ticks (5 seconds)
    return this.ticksSinceUpdate >= 100;
  }

  protected doUpdate(): CropData[] {
    this.crops = [];

    // Scan for crops
    const cropBlocks = this.ctx.blockTracker.findBlocks([
      'wheat', 'carrots', 'potatoes', 'beetroots'
    ]);

    for (const pos of cropBlocks) {
      const block = this.bot.blockAt(pos);
      if (block) {
        this.crops.push({
          position: pos,
          cropType: block.name,
          growthStage: block.metadata,
          readyToHarvest: block.metadata >= 7
        });
      }
    }

    return this.crops;
  }

  getCrops(): CropData[] {
    this.ensureUpdated();
    return this.crops;
  }

  getReadyCrops(): CropData[] {
    return this.getCrops().filter(c => c.readyToHarvest);
  }
}

// Register custom tracker
trackers.register('crops', new CropTracker(bot, ctx));

// Use it
const readyCrops = trackers.get('crops').getReadyCrops();
```

## Blacklisting System

Prevent repeatedly attempting failed actions with blacklisting:

```typescript
import { WorldLocateBlacklist, EntityLocateBlacklist } from 'baritone-ts';

// Block position blacklisting
const blockBlacklist = new WorldLocateBlacklist();

// Blacklist a position for 60 seconds
blockBlacklist.blacklist(blockPos, 60000);

// Check if blacklisted
if (blockBlacklist.isBlacklisted(blockPos)) {
  console.log('Position is blacklisted');
}

// Clear blacklist
blockBlacklist.clear();

// Entity blacklisting
const entityBlacklist = new EntityLocateBlacklist();

// Blacklist an entity
entityBlacklist.blacklist(entity, 30000);

// Check if entity is blacklisted
if (entityBlacklist.isBlacklisted(entity)) {
  console.log('Entity is blacklisted');
}
```

### Use Cases

- Prevent mining blocks that can't be reached
- Skip entities that escaped
- Avoid containers that are locked
- Skip failed crafting recipes

## Performance Tips

1. **Use appropriate scan radius** - Smaller radius = faster scans
2. **Limit result count** - Use `maxCount` to stop early
3. **Batch operations** - Access trackers once per tick
4. **Forget old data** - Call `forgetContainer()` for moved/broken containers

```typescript
// Good: Single access per tick
const ores = trackers.blocks.findBlocks('diamond_ore', { maxCount: 10 });
processOres(ores);

// Bad: Multiple accesses
for (let i = 0; i < 10; i++) {
  const ore = trackers.blocks.findNearest('diamond_ore');
  // ...
}
```
