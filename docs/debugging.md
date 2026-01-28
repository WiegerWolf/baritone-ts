# Debugging

Baritone-TS provides tools for debugging pathfinding issues, visualizing paths, and troubleshooting common problems.

## Path Debugger

### Basic Setup

```typescript
import { PathDebugger } from 'baritone-ts';

// Create debugger
const debug = new PathDebugger(bot);

// Enable visualization
debug.enable();

// Configure what to show
debug.showPath = true;          // Show current path
debug.showGoal = true;          // Show goal position
debug.showExplored = false;     // Show explored nodes (expensive)
debug.showMovements = true;     // Show movement execution
```

### Path Visualization

```typescript
// Visualize path with particles
debug.visualizePath(path, {
  color: 'green',              // Particle color
  particleType: 'dust',        // Minecraft particle type
  duration: 5000               // How long to show (ms)
});

// Highlight specific positions
debug.highlightPosition(position, {
  color: 'red',
  radius: 1
});

// Draw line between points
debug.drawLine(start, end, {
  color: 'blue'
});
```

### Movement Debugging

```typescript
// Log movement execution
debug.onMovementStart((movement) => {
  console.log(`Starting: ${movement.constructor.name}`);
  console.log(`  From: ${movement.from}`);
  console.log(`  To: ${movement.to}`);
  console.log(`  Cost: ${movement.cost}`);
});

debug.onMovementEnd((movement, status) => {
  console.log(`Finished: ${movement.constructor.name} - ${status}`);
});

// Log movement failures
debug.onMovementFail((movement, reason) => {
  console.log(`FAILED: ${movement.constructor.name}`);
  console.log(`  Reason: ${reason}`);
  console.log(`  Position: ${bot.entity.position}`);
});
```

### A* Debugging

```typescript
// Log A* search progress
debug.onSearchProgress((stats) => {
  console.log(`Nodes: ${stats.nodesExplored}`);
  console.log(`Open set: ${stats.openSetSize}`);
  console.log(`Best cost: ${stats.bestCost}`);
  console.log(`Coefficient: ${stats.currentCoefficient}`);
});

// Log search completion
debug.onSearchComplete((result) => {
  console.log(`Search complete: ${result.status}`);
  console.log(`  Time: ${result.computationTime}ms`);
  console.log(`  Nodes: ${result.nodesExplored}`);
  console.log(`  Path length: ${result.path?.length || 0}`);
});

// Visualize explored nodes (SLOW - use sparingly)
debug.visualizeExplored = true;
```

## Logging

### Enable Verbose Logging

```typescript
import { setLogLevel } from 'baritone-ts';

// Log levels: 'error' | 'warn' | 'info' | 'debug' | 'trace'
setLogLevel('debug');

// Or configure per-module
setLogLevel({
  pathfinding: 'debug',
  movement: 'info',
  process: 'warn',
  task: 'debug'
});
```

### Log Events

```typescript
// Listen to all pathfinder events
bot.pathfinder.on('log', (level, module, message) => {
  console.log(`[${level}] [${module}] ${message}`);
});

// Or use built-in logger
import { logger } from 'baritone-ts';

logger.debug('pathfinding', 'Starting search');
logger.info('movement', `Executing ${movement.name}`);
logger.warn('process', 'Process interrupted');
logger.error('task', `Task failed: ${error.message}`);
```

## Common Issues

### Path Not Found

**Symptoms:** `path_failed` event, no movement

**Debugging:**
```typescript
bot.on('path_update', (result) => {
  if (result.status === 'noPath') {
    console.log('No path found');
    console.log(`  Nodes explored: ${result.nodesExplored}`);
    console.log(`  Time: ${result.computationTime}ms`);

    // Check why
    const goal = bot.pathfinder.getGoal();
    if (goal) {
      const start = bot.entity.position;
      console.log(`  Start: ${start}`);
      console.log(`  Goal satisfied at start: ${goal.isEnd(start.x, start.y, start.z)}`);
      console.log(`  Heuristic: ${goal.heuristic(start.x, start.y, start.z)}`);
    }
  }
});
```

**Common causes:**
1. Goal is unreachable (blocked by unbreakable blocks)
2. Start position is stuck (in block, in water)
3. Settings prevent reaching (canDig: false, but need to dig)
4. Timeout too short for distance

**Solutions:**
```typescript
// Increase search time
pathfinder(bot, { maxSearchTime: 30000 });

// Enable more movement options
pathfinder(bot, { canDig: true, allowParkour: true });

// Check if goal is reachable
const testGoal = new GoalBlock(x, y, z);
const block = bot.blockAt(new Vec3(x, y, z));
console.log(`Goal block: ${block?.name}`);
```

### Bot Gets Stuck

**Symptoms:** Bot stops moving, repeats same path

**Debugging:**
```typescript
// Log position changes
let lastPos = bot.entity.position.clone();
setInterval(() => {
  const moved = bot.entity.position.distanceTo(lastPos);
  if (moved < 0.1 && bot.pathfinder.isMoving()) {
    console.log('Bot appears stuck!');
    console.log(`  Position: ${bot.entity.position}`);
    console.log(`  Current movement: ${bot.pathfinder.getCurrentMovement()?.constructor.name}`);
  }
  lastPos = bot.entity.position.clone();
}, 1000);
```

**Common causes:**
1. Collision with entity
2. Block changed during movement
3. Movement execution bug
4. Inventory full (can't pick up drops)

**Solutions:**
```typescript
// Force path recalculation
bot.pathfinder.recalculatePath();

// Stop and restart
bot.pathfinder.stop();
setTimeout(() => {
  bot.pathfinder.setGoal(goal);
}, 1000);

// Enable stuck detection
pathfinder(bot, { stuckDetection: true, stuckTimeout: 5000 });
```

### Movement Failures

**Symptoms:** Movements fail, path keeps recalculating

**Debugging:**
```typescript
bot.on('path_update', (result) => {
  if (result.status === 'movementFailed') {
    console.log('Movement failed');
    console.log(`  Movement: ${result.failedMovement?.constructor.name}`);
    console.log(`  Reason: ${result.failureReason}`);
  }
});

// Detailed movement logging
debug.onMovementTick((movement, state) => {
  console.log(`${movement.constructor.name} tick: ${state}`);
});
```

**Common causes:**
1. Block was broken/placed during movement
2. Mob pushed bot
3. Timing issue with jumps
4. Server lag

**Solutions:**
```typescript
// Add movement retry
pathfinder(bot, { movementRetries: 3 });

// Slower movement execution
pathfinder(bot, { tickDelay: 2 });

// More conservative settings
pathfinder(bot, {
  allowParkour: false,
  maxFallHeight: 2
});
```

### Performance Issues

**Symptoms:** Lag, slow pathfinding, high CPU

**Debugging:**
```typescript
// Time path computation
console.time('pathfind');
await bot.pathfinder.goto(goal);
console.timeEnd('pathfind');

// Monitor node exploration
debug.onSearchProgress((stats) => {
  if (stats.nodesExplored > 50000) {
    console.warn('High node count:', stats.nodesExplored);
  }
});
```

**Common causes:**
1. Long distance path
2. Complex terrain
3. Too many movement options enabled
4. Trackers scanning too frequently

**Solutions:**
```typescript
// Limit search
pathfinder(bot, {
  maxTotalNodes: 50000,
  maxSearchTime: 5000,
  allowPartialPaths: true
});

// Reduce movement complexity
pathfinder(bot, {
  canDig: false,
  allowParkour: false
});

// Increase tracker intervals
trackers.blocks.setUpdateInterval(100);
```

## Diagnostic Commands

### In-Game Commands

```typescript
// Add debug commands
bot.on('chat', (username, message) => {
  if (!message.startsWith('!')) return;

  const cmd = message.slice(1);

  switch (cmd) {
    case 'status':
      bot.chat(`Moving: ${bot.pathfinder.isMoving()}`);
      bot.chat(`Goal: ${bot.pathfinder.getGoal()?.constructor.name || 'none'}`);
      break;

    case 'path':
      const path = bot.pathfinder.getCurrentPath();
      bot.chat(`Path: ${path?.length || 0} movements`);
      break;

    case 'position':
      const pos = bot.entity.position;
      bot.chat(`Position: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`);
      break;

    case 'stop':
      bot.pathfinder.stop();
      bot.chat('Stopped');
      break;

    case 'debug':
      debug.enable();
      bot.chat('Debug enabled');
      break;
  }
});
```

### Dump State

```typescript
function dumpPathfinderState() {
  const pf = bot.pathfinder;

  console.log('=== Pathfinder State ===');
  console.log(`Moving: ${pf.isMoving()}`);
  console.log(`Digging: ${pf.isDigging()}`);
  console.log(`Placing: ${pf.isPlacing()}`);

  const goal = pf.getGoal();
  console.log(`Goal: ${goal?.constructor.name || 'none'}`);

  const path = pf.getCurrentPath();
  console.log(`Path: ${path?.length || 0} movements`);

  const movement = pf.getCurrentMovement();
  console.log(`Current movement: ${movement?.constructor.name || 'none'}`);

  console.log('\n=== Settings ===');
  const settings = pf.ctx.settings;
  console.log(`canDig: ${settings.canDig}`);
  console.log(`canPlace: ${settings.canPlace}`);
  console.log(`allowParkour: ${settings.allowParkour}`);
  console.log(`maxFallHeight: ${settings.maxFallHeight}`);

  console.log('\n=== Position ===');
  const pos = bot.entity.position;
  console.log(`Position: ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`);
  console.log(`On ground: ${bot.entity.onGround}`);
  console.log(`In water: ${bot.entity.isInWater}`);
}

// Call on demand
bot.on('chat', (username, message) => {
  if (message === '!dump') {
    dumpPathfinderState();
  }
});
```

## Testing

### Unit Testing Paths

```typescript
import { computePathSync, GoalBlock, CalculationContext } from 'baritone-ts';

describe('Pathfinding', () => {
  it('should find simple path', () => {
    const ctx = createTestContext();
    const start = new Vec3(0, 64, 0);
    const goal = new GoalBlock(10, 64, 0);

    const result = computePathSync(start, goal, ctx);

    expect(result.status).toBe('success');
    expect(result.path.length).toBeGreaterThan(0);
  });

  it('should handle blocked paths', () => {
    const ctx = createTestContext();
    // Add wall
    ctx.setBlock(5, 64, 0, 'bedrock');
    ctx.setBlock(5, 65, 0, 'bedrock');

    const start = new Vec3(0, 64, 0);
    const goal = new GoalBlock(10, 64, 0);

    const result = computePathSync(start, goal, ctx, { canDig: false });

    // Should path around
    expect(result.status).toBe('success');
    expect(result.path.some(m => m.to.z !== 0)).toBe(true);
  });
});
```

### Integration Testing

```typescript
describe('Bot Navigation', () => {
  let bot;

  beforeEach(async () => {
    bot = await createTestBot();
    pathfinder(bot);
  });

  it('should navigate to goal', async () => {
    const goal = new GoalBlock(100, 64, 100);

    await bot.pathfinder.goto(goal);

    const distance = bot.entity.position.distanceTo(new Vec3(100, 64, 100));
    expect(distance).toBeLessThan(1);
  });
});
```
