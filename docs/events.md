# Events

Baritone-TS uses an event system to communicate state changes and important occurrences.

## Bot Events

These events are emitted on the bot object.

### Path Events

#### goal_reached

Emitted when the bot reaches its goal.

```typescript
bot.on('goal_reached', (goal: Goal) => {
  console.log(`Reached goal: ${goal.constructor.name}`);
});
```

#### path_update

Emitted when path computation completes or status changes.

```typescript
bot.on('path_update', (result: PathResult) => {
  console.log(`Path status: ${result.status}`);
  console.log(`Path length: ${result.path?.length || 0}`);
  console.log(`Nodes explored: ${result.nodesExplored}`);
  console.log(`Computation time: ${result.computationTime}ms`);
});
```

**Result statuses:**
- `success` - Complete path found
- `partial` - Partial path found (goal not reached)
- `noPath` - No path exists
- `timeout` - Search timed out
- `movementFailed` - Movement execution failed

#### path_reset

Emitted when path is reset/recalculated.

```typescript
bot.on('path_reset', (reason: string) => {
  console.log(`Path reset: ${reason}`);
});
```

**Common reasons:**
- `blockChanged` - Block in path changed
- `goalChanged` - Goal was updated
- `positionMismatch` - Bot position doesn't match expected
- `manual` - Manually requested recalculation

#### path_stop

Emitted when pathfinding stops.

```typescript
bot.on('path_stop', () => {
  console.log('Pathfinding stopped');
});
```

### Movement Events

#### movement_started

Emitted when a movement begins execution.

```typescript
bot.on('movement_started', (movement: Movement) => {
  console.log(`Started: ${movement.constructor.name}`);
  console.log(`From: ${movement.from}`);
  console.log(`To: ${movement.to}`);
});
```

#### movement_completed

Emitted when a movement completes successfully.

```typescript
bot.on('movement_completed', (movement: Movement) => {
  console.log(`Completed: ${movement.constructor.name}`);
});
```

#### movement_failed

Emitted when a movement fails.

```typescript
bot.on('movement_failed', (movement: Movement, reason: string) => {
  console.log(`Failed: ${movement.constructor.name}`);
  console.log(`Reason: ${reason}`);
});
```

### Block Interaction Events

#### dig_started

Emitted when block breaking begins.

```typescript
bot.on('dig_started', (block: Block) => {
  console.log(`Breaking: ${block.name} at ${block.position}`);
});
```

#### dig_completed

Emitted when block breaking completes.

```typescript
bot.on('dig_completed', (block: Block) => {
  console.log(`Broke: ${block.name}`);
});
```

#### place_started

Emitted when block placing begins.

```typescript
bot.on('place_started', (position: Vec3, blockName: string) => {
  console.log(`Placing: ${blockName} at ${position}`);
});
```

#### place_completed

Emitted when block placing completes.

```typescript
bot.on('place_completed', (position: Vec3, blockName: string) => {
  console.log(`Placed: ${blockName} at ${position}`);
});
```

## Process Events

Processes emit events on the process instance.

### Lifecycle Events

```typescript
const mineProcess = new MineProcess(bot, bot.pathfinder, options);

mineProcess.on('start', () => {
  console.log('Mining process started');
});

mineProcess.on('pause', () => {
  console.log('Mining process paused');
});

mineProcess.on('resume', () => {
  console.log('Mining process resumed');
});

mineProcess.on('stop', () => {
  console.log('Mining process stopped');
});

mineProcess.on('complete', () => {
  console.log('Mining process completed');
});

mineProcess.on('error', (error: Error) => {
  console.log(`Mining process error: ${error.message}`);
});
```

### MineProcess Events

```typescript
mineProcess.on('block_found', (block: Block) => {
  console.log(`Found: ${block.name} at ${block.position}`);
});

mineProcess.on('block_mined', (block: Block) => {
  console.log(`Mined: ${block.name}`);
});

mineProcess.on('search_complete', () => {
  console.log('No more blocks found');
});
```

### FollowProcess Events

```typescript
followProcess.on('target_acquired', (entity: Entity) => {
  console.log(`Following: ${entity.name || entity.username}`);
});

followProcess.on('target_lost', () => {
  console.log('Lost sight of target');
});

followProcess.on('target_reached', () => {
  console.log('Reached target');
});
```

### CombatProcess Events

```typescript
combatProcess.on('target_acquired', (entity: Entity) => {
  console.log(`Targeting: ${entity.name}`);
});

combatProcess.on('target_killed', (entity: Entity) => {
  console.log(`Killed: ${entity.name}`);
});

combatProcess.on('flee_started', () => {
  console.log('Fleeing!');
});

combatProcess.on('flee_complete', () => {
  console.log('Escaped');
});

combatProcess.on('damage_taken', (amount: number, source: Entity | null) => {
  console.log(`Took ${amount} damage from ${source?.name || 'unknown'}`);
});
```

### FarmProcess Events

```typescript
farmProcess.on('crop_harvested', (block: Block) => {
  console.log(`Harvested: ${block.name}`);
});

farmProcess.on('crop_planted', (position: Vec3, cropType: string) => {
  console.log(`Planted: ${cropType} at ${position}`);
});

farmProcess.on('area_complete', () => {
  console.log('Farm area complete');
});
```

### BuildProcess Events

```typescript
buildProcess.on('block_placed', (position: Vec3, blockName: string) => {
  console.log(`Placed: ${blockName} at ${position}`);
});

buildProcess.on('block_broken', (position: Vec3) => {
  console.log(`Cleared: ${position}`);
});

buildProcess.on('progress', (placed: number, total: number) => {
  console.log(`Progress: ${placed}/${total} (${(placed/total*100).toFixed(1)}%)`);
});

buildProcess.on('material_needed', (blockName: string, count: number) => {
  console.log(`Need: ${count}x ${blockName}`);
});
```

## Task Events

Task runner emits events for task lifecycle.

```typescript
const runner = new TaskRunner(bot, bot.pathfinder);

runner.on('task_started', (task: Task) => {
  console.log(`Started task: ${task.name}`);
});

runner.on('task_completed', (task: Task) => {
  console.log(`Completed task: ${task.name}`);
});

runner.on('task_failed', (task: Task, error: Error) => {
  console.log(`Failed task: ${task.name} - ${error.message}`);
});

runner.on('task_cancelled', (task: Task) => {
  console.log(`Cancelled task: ${task.name}`);
});

runner.on('subtask_started', (parentTask: Task, subtask: Task) => {
  console.log(`${parentTask.name} started subtask: ${subtask.name}`);
});

runner.on('subtask_completed', (parentTask: Task, subtask: Task) => {
  console.log(`${parentTask.name} completed subtask: ${subtask.name}`);
});
```

## Tracker Events

### BlockTracker Events

```typescript
const blockTracker = bot.pathfinder.trackers.blocks;

blockTracker.on('block_found', (position: Vec3, blockName: string) => {
  console.log(`Found: ${blockName} at ${position}`);
});

blockTracker.on('block_placed', (position: Vec3, blockName: string) => {
  console.log(`Placed: ${blockName} at ${position}`);
});

blockTracker.on('block_broken', (position: Vec3, oldBlockName: string) => {
  console.log(`Broken: ${oldBlockName} at ${position}`);
});

blockTracker.on('scan_complete', (results: Vec3[], blockTypes: string[]) => {
  console.log(`Scan found ${results.length} blocks`);
});
```

### EntityTracker Events

```typescript
const entityTracker = bot.pathfinder.trackers.entities;

entityTracker.on('entity_spawn', (entity: Entity) => {
  console.log(`Spawned: ${entity.name} at ${entity.position}`);
});

entityTracker.on('entity_despawn', (entity: Entity) => {
  console.log(`Despawned: ${entity.name}`);
});

entityTracker.on('threat_detected', (entity: Entity, distance: number) => {
  console.log(`Threat: ${entity.name} at ${distance.toFixed(1)} blocks`);
});

entityTracker.on('threat_cleared', () => {
  console.log('No more threats');
});

entityTracker.on('projectile_incoming', (projectile: Entity, timeToImpact: number) => {
  console.log(`Incoming ${projectile.name} in ${timeToImpact.toFixed(2)}s`);
});
```

### ItemStorageTracker Events

```typescript
const storage = bot.pathfinder.trackers.storage;

storage.on('container_discovered', (position: Vec3, type: string) => {
  console.log(`Found ${type} at ${position}`);
});

storage.on('contents_updated', (position: Vec3, items: Item[]) => {
  console.log(`Updated contents at ${position}: ${items.length} item types`);
});

storage.on('item_deposited', (position: Vec3, itemName: string, count: number) => {
  console.log(`Deposited ${count}x ${itemName}`);
});

storage.on('item_withdrawn', (position: Vec3, itemName: string, count: number) => {
  console.log(`Withdrew ${count}x ${itemName}`);
});
```

## Survival Chain Events

```typescript
const survival = new WorldSurvivalChain(bot, bot.pathfinder);

survival.on('chain_activated', (chainName: string) => {
  console.log(`Survival chain activated: ${chainName}`);
});

survival.on('chain_deactivated', (chainName: string) => {
  console.log(`Survival chain deactivated: ${chainName}`);
});

survival.on('action', (action: string, chainName: string) => {
  console.log(`[${chainName}] ${action}`);
});

// Specific chain events
survival.on('eating', (food: Item) => {
  console.log(`Eating: ${food.name}`);
});

survival.on('mlg_triggered', () => {
  console.log('MLG water bucket!');
});

survival.on('fleeing', (threat: Entity) => {
  console.log(`Fleeing from: ${threat.name}`);
});

survival.on('low_health', (health: number) => {
  console.log(`Health low: ${health}`);
});
```

## EventBus

Baritone-TS includes a central EventBus for cross-module communication with priority-based handler ordering.

```typescript
import { EventBus, HandlerPriority, createEventBus } from 'baritone-ts';

// Create a new event bus
const bus = createEventBus();

// Subscribe to events with priority
const handlerId = bus.subscribe('block_place', (data) => {
  console.log(`Block placed at ${data.pos}`);
}, HandlerPriority.NORMAL);

// Subscribe with high priority (runs first)
bus.subscribe('block_place', (data) => {
  console.log('High priority handler');
}, HandlerPriority.HIGH);

// One-time handler
bus.once('player_death', (data) => {
  console.log('Player died - this only fires once');
});

// Publish events
bus.publish('custom', { type: 'my_event', data: { foo: 'bar' } });

// Unsubscribe by handler ID
bus.unsubscribe(handlerId);

// Unsubscribe all handlers for an event
bus.unsubscribeAll('block_place');

// Check if event has handlers
if (bus.hasHandlers('entity_spawn')) {
  console.log('Entity spawn is being tracked');
}

// Get handler count
const count = bus.getHandlerCount('block_update');

// Clear all handlers
bus.clear();

// Debug info
console.log(bus.getDebugInfo());
```

### Handler Priorities

```typescript
const HandlerPriority = {
  LOWEST: 0,     // Runs last
  LOW: 25,
  NORMAL: 50,    // Default
  HIGH: 75,
  HIGHEST: 100,  // Runs first
  MONITOR: 150,  // For logging/debugging, runs after all others
};
```

### Event Types

All built-in event types:

```typescript
interface EventTypes {
  // World events
  'block_place': { pos: Vec3; block: Block };
  'block_break': { pos: Vec3; oldBlock: Block };
  'block_update': { pos: Vec3; oldBlock: Block | null; newBlock: Block | null };

  // Chunk events
  'chunk_load': { x: number; z: number };
  'chunk_unload': { x: number; z: number };

  // Entity events
  'entity_spawn': { entity: Entity };
  'entity_despawn': { entity: Entity };
  'entity_move': { entity: Entity; oldPos: Vec3; newPos: Vec3 };
  'entity_damage': { entity: Entity; damage: number };

  // Player events
  'player_move': { pos: Vec3 };
  'player_health': { health: number; oldHealth: number };
  'player_food': { food: number; oldFood: number };
  'player_death': {};

  // Container events
  'container_open': { pos: Vec3 | null; windowId: number };
  'container_close': { windowId: number };
  'container_update': { windowId: number; slot: number; item: Item | null };

  // Task events
  'task_start': { taskName: string };
  'task_finish': { taskName: string; success: boolean };
  'chain_change': { oldChain: string | null; newChain: string };

  // Combat events
  'attack': { target: Entity };
  'hurt': { damage: number; attacker: Entity | null };

  // Custom events
  'custom': { type: string; data: any };
}
```

### Bot Event Bridge

Connect mineflayer events to the EventBus:

```typescript
import { createBotEventBridge, createEventBus } from 'baritone-ts';

const eventBus = createEventBus();
createBotEventBridge(bot, eventBus);

// Now mineflayer events are forwarded to the EventBus
eventBus.subscribe('entity_spawn', ({ entity }) => {
  console.log(`Entity spawned: ${entity.name}`);
});
```

## Creating Custom Events

### In Custom Processes

```typescript
import { BaseProcess, EventEmitter } from 'baritone-ts';

class MyProcess extends BaseProcess {
  onTick() {
    // Emit custom event
    this.emit('custom_action', { data: 'value' });

    return { idle: true };
  }
}

// Listen
const process = new MyProcess(bot, pathfinder, options);
process.on('custom_action', (data) => {
  console.log('Custom action:', data);
});
```

### In Custom Tasks

```typescript
import { Task, EventEmitter } from 'baritone-ts';

class MyTask extends Task {
  tick() {
    this.emit('progress', { completed: 5, total: 10 });
    return TaskStatus.IN_PROGRESS;
  }
}

const task = new MyTask(bot);
task.on('progress', ({ completed, total }) => {
  console.log(`Progress: ${completed}/${total}`);
});
```

## Event Patterns

### Waiting for Events

```typescript
// Wait for goal reached
function waitForGoal(): Promise<Goal> {
  return new Promise((resolve) => {
    bot.once('goal_reached', resolve);
  });
}

// Usage
bot.pathfinder.setGoal(new GoalBlock(100, 64, 100));
const goal = await waitForGoal();
console.log('Reached goal!');
```

### Event Timeouts

```typescript
function waitForGoalWithTimeout(timeout: number): Promise<Goal | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      bot.removeListener('goal_reached', handler);
      resolve(null);
    }, timeout);

    function handler(goal: Goal) {
      clearTimeout(timer);
      resolve(goal);
    }

    bot.once('goal_reached', handler);
  });
}

const goal = await waitForGoalWithTimeout(30000);
if (goal) {
  console.log('Reached goal!');
} else {
  console.log('Timed out');
}
```

### Aggregating Events

```typescript
// Count blocks mined
let blocksMined = 0;

mineProcess.on('block_mined', () => {
  blocksMined++;
  console.log(`Blocks mined: ${blocksMined}`);
});

// Track path statistics
const pathStats = {
  computed: 0,
  succeeded: 0,
  failed: 0,
  totalNodes: 0
};

bot.on('path_update', (result) => {
  pathStats.computed++;
  pathStats.totalNodes += result.nodesExplored;

  if (result.status === 'success') {
    pathStats.succeeded++;
  } else if (result.status === 'noPath') {
    pathStats.failed++;
  }
});
```
