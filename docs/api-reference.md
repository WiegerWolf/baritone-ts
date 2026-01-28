# API Reference

Complete API documentation for Baritone-TS.

## Main Entry Point

### pathfinder(bot, options?)

Initializes the pathfinder plugin on a Mineflayer bot.

```typescript
function pathfinder(bot: Bot, options?: ContextOptions): void
```

**Parameters:**
- `bot` - Mineflayer bot instance
- `options` - Optional configuration (see [Configuration](./configuration.md))

**Usage:**
```typescript
import { pathfinder } from 'baritone-ts';

pathfinder(bot, {
  canDig: true,
  allowParkour: true
});
```

After calling, the pathfinder is available at `bot.pathfinder`.

## Pathfinder API

### bot.pathfinder

The main pathfinder interface.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `ctx` | `CalculationContext` | Calculation context with settings |
| `processManager` | `ProcessManager` | Process management |
| `trackers` | `TrackerManager` | Tracker management |

#### Methods

##### setGoal(goal, dynamic?)

Set the pathfinding goal.

```typescript
setGoal(goal: Goal | null, dynamic?: boolean): void
```

- `goal` - Goal to pathfind to, or null to clear
- `dynamic` - If true, recalculates as goal moves (default: false)

##### getGoal()

Get the current goal.

```typescript
getGoal(): Goal | null
```

##### goto(goal)

Navigate to goal (async).

```typescript
goto(goal: Goal): Promise<void>
```

Resolves when goal is reached, rejects on failure.

##### stop()

Stop pathfinding immediately.

```typescript
stop(): void
```

##### isMoving()

Check if currently pathfinding.

```typescript
isMoving(): boolean
```

##### isDigging()

Check if currently breaking a block.

```typescript
isDigging(): boolean
```

##### isPlacing()

Check if currently placing a block.

```typescript
isPlacing(): boolean
```

##### getPathTo(goal)

Calculate a path to goal without executing.

```typescript
getPathTo(goal: Goal): PathResult
```

##### getPathFromTo(start, goal)

Calculate path between two positions.

```typescript
getPathFromTo(start: Vec3, goal: Goal): PathResult
```

##### setPath(path)

Set and execute a pre-computed path.

```typescript
setPath(path: Movement[]): void
```

##### getCurrentPath()

Get the currently executing path.

```typescript
getCurrentPath(): Movement[] | null
```

##### getCurrentMovement()

Get the current movement being executed.

```typescript
getCurrentMovement(): Movement | null
```

##### recalculatePath()

Force recalculation of current path.

```typescript
recalculatePath(): void
```

## Goals

### GoalBlock

Navigate to exact block position.

```typescript
class GoalBlock implements Goal {
  constructor(x: number, y: number, z: number)
}
```

### GoalXZ

Navigate to X/Z coordinates (any Y).

```typescript
class GoalXZ implements Goal {
  constructor(x: number, z: number)
}
```

### GoalYLevel

Navigate to specific Y level.

```typescript
class GoalYLevel implements Goal {
  constructor(y: number)
}
```

### GoalNear

Get within radius of position.

```typescript
class GoalNear implements Goal {
  constructor(x: number, y: number, z: number, range: number)
}
```

### GoalGetToBlock

Stand adjacent to block (for interaction).

```typescript
class GoalGetToBlock implements Goal {
  constructor(x: number, y: number, z: number)
}
```

### GoalFollow

Follow a moving entity.

```typescript
class GoalFollow implements Goal {
  constructor(entity: Entity, distance: number)
}
```

### GoalRunAway

Flee from positions.

```typescript
class GoalRunAway implements Goal {
  constructor(positions: Vec3[], distance: number)
}
```

### GoalComposite

Combine multiple goals (any satisfies).

```typescript
class GoalComposite implements Goal {
  constructor(goals: Goal[])
}
```

### GoalInverted

Invert a goal (stay away).

```typescript
class GoalInverted implements Goal {
  constructor(goal: Goal)
}
```

### GoalAABB

Get inside bounding box.

```typescript
class GoalAABB implements Goal {
  constructor(min: Vec3, max: Vec3)
}
```

## Async Pathfinding

### computePathAsync

Compute path asynchronously.

```typescript
async function computePathAsync(
  startX: number,
  startY: number,
  startZ: number,
  goal: Goal,
  ctx: CalculationContext,
  options?: AsyncPathOptions
): Promise<PathResult>
```

**Options:**
```typescript
interface AsyncPathOptions {
  timeout?: number;                    // Max time in ms
  onProgress?: (progress: Progress) => void;
  signal?: AbortSignal;                // Cancellation
  allowPartial?: boolean;              // Return partial paths
  minPartialLength?: number;           // Min partial path length
  nodesPerYield?: number;              // Async yield interval
}
```

**Result:**
```typescript
interface PathResult {
  status: 'success' | 'partial' | 'failed' | 'timeout' | 'cancelled';
  path: Movement[];
  nodesExplored: number;
  computationTime: number;
  pathLength: number;
  pathCost: number;
  distanceToGoal: number;
  error?: Error;
}
```

## Processes

### ProcessManager

#### register(name, process, options?)

Register a process.

```typescript
register(name: string, process: BaseProcess, options?: ProcessOptions): void
```

#### activate(name)

Activate a registered process.

```typescript
activate(name: string): void
```

#### deactivate(name)

Deactivate a process.

```typescript
deactivate(name: string): void
```

#### getActive()

Get currently active process name.

```typescript
getActive(): string | null
```

#### isActive(name)

Check if process is active.

```typescript
isActive(name: string): boolean
```

### MineProcess

```typescript
new MineProcess(bot, pathfinder, {
  blockNames: string[];
  searchRadius?: number;
  maxBlocks?: number;
  maxTime?: number;
  collectDrops?: boolean;
  preferSilkTouch?: boolean;
})
```

### FollowProcess

```typescript
new FollowProcess(bot, pathfinder, {
  target: string | Entity;
  minDistance?: number;
  maxDistance?: number;
  sprint?: boolean;
  stopOnReach?: boolean;
})
```

### FarmProcess

```typescript
new FarmProcess(bot, pathfinder, {
  cropTypes: string[];
  searchRadius?: number;
  farmArea?: { min: Vec3, max: Vec3 };
  replant?: boolean;
  harvestOnlyMature?: boolean;
  collectDrops?: boolean;
})
```

### CombatProcess

```typescript
new CombatProcess(bot, pathfinder, {
  mode: 'attack' | 'flee' | 'kite' | 'defend';
  targetTypes?: string[];
  targetPlayers?: boolean;
  attackRange?: number;
  fleeRange?: number;
  useShield?: boolean;
  useBow?: boolean;
})
```

### BuildProcess

```typescript
new BuildProcess(bot, pathfinder, {
  instructions: BuildInstruction[];
  clearArea?: boolean;
  collectMaterials?: boolean;
})
```

### GatherProcess

```typescript
new GatherProcess(bot, pathfinder, {
  itemNames?: string[];
  collectAll?: boolean;
  searchRadius?: number;
})
```

### ExploreProcess

```typescript
new ExploreProcess(bot, pathfinder, {
  mode: 'spiral' | 'random' | 'direction';
  searchRadius?: number;
  direction?: { x: number, z: number };
})
```

## Tasks

### TaskRunner

#### setTask(task, options?)

Set the active task.

```typescript
setTask(task: Task, options?: TaskOptions): void
```

#### tick()

Execute one tick of the task.

```typescript
tick(): void
```

#### isComplete()

Check if task is complete.

```typescript
isComplete(): boolean
```

#### getStatus()

Get current task status.

```typescript
getStatus(): TaskStatus
```

#### cancel()

Cancel the current task.

```typescript
cancel(): void
```

### Common Tasks

See [Tasks](./tasks.md) for detailed documentation on all task types.

## Trackers

### BlockTracker

#### findBlocks(blockTypes, options?)

Find blocks by type.

```typescript
findBlocks(
  blockTypes: string | string[],
  options?: {
    maxDistance?: number;
    maxCount?: number;
    minY?: number;
    maxY?: number;
    filter?: (block: Block) => boolean;
    sort?: 'nearest' | 'furthest' | 'none';
  }
): Vec3[]
```

#### findNearest(blockTypes)

Find nearest block of type.

```typescript
findNearest(blockTypes: string | string[]): Vec3 | null
```

### EntityTracker

#### getAll()

Get all tracked entities.

```typescript
getAll(): Entity[]
```

#### getByType(type)

Get entities by type.

```typescript
getByType(type: string): Entity[]
```

#### getHostiles()

Get hostile mobs.

```typescript
getHostiles(): Entity[]
```

#### getThreats(options?)

Get threatening entities.

```typescript
getThreats(options?: {
  range?: number;
  types?: string[];
}): Entity[]
```

### ItemStorageTracker

#### getContainers()

Get known containers.

```typescript
getContainers(): ContainerInfo[]
```

#### findItem(itemName)

Find item in storage.

```typescript
findItem(itemName: string): ItemLocation[]
```

#### getContents(position)

Get container contents.

```typescript
getContents(position: Vec3): Item[] | null
```

## Events

### Bot Events

```typescript
// Path events
bot.on('goal_reached', (goal: Goal) => void)
bot.on('path_update', (result: PathResult) => void)
bot.on('path_reset', (reason: string) => void)
bot.on('path_stop', () => void)
```

### Process Events

```typescript
process.on('start', () => void)
process.on('pause', () => void)
process.on('resume', () => void)
process.on('stop', () => void)
process.on('complete', () => void)
process.on('error', (error: Error) => void)
```

### Task Events

```typescript
runner.on('task_started', (task: Task) => void)
runner.on('task_completed', (task: Task) => void)
runner.on('task_failed', (task: Task, error: Error) => void)
runner.on('subtask_started', (task: Task, subtask: Task) => void)
```

## Utility Functions

### Path Utilities

```typescript
// Smooth a path (remove redundant movements)
function smoothPath(path: Movement[], ctx: CalculationContext): Movement[]

// Simplify path (merge similar movements)
function simplifyPath(path: Movement[]): Movement[]

// Calculate total path cost
function calculatePathCost(path: Movement[]): number

// Calculate path distance
function calculatePathDistance(path: Movement[]): number

// Check if path contains position
function pathContains(path: Movement[], position: Vec3): boolean

// Merge multiple paths
function mergePaths(paths: Movement[][]): Movement[]
```

### Item Utilities

```typescript
// Check if bot has item
function hasItem(bot: Bot, itemName: string, count?: number): boolean

// Get item count in inventory
function getItemCount(bot: Bot, itemName: string): number

// Check if elytra equipped
function hasElytraEquipped(bot: Bot): boolean

// Check if has boat
function hasBoatItem(bot: Bot): boolean

// Check if in boat
function isInBoat(bot: Bot): boolean
```

### Position Utilities

```typescript
// Convert to Vec3
function toVec3(pos: { x: number, y: number, z: number }): Vec3

// Check if positions equal
function positionsEqual(a: Vec3, b: Vec3): boolean

// Get block position (floor coordinates)
function getBlockPos(pos: Vec3): Vec3
```

## Types

### Core Types

```typescript
interface BlockPos {
  x: number;
  y: number;
  z: number;
}

interface Goal {
  isEnd(x: number, y: number, z: number): boolean;
  heuristic(x: number, y: number, z: number): number;
}

enum MovementState {
  NOT_STARTED = 'NOT_STARTED',
  PREPPING = 'PREPPING',
  WAITING = 'WAITING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  UNREACHABLE = 'UNREACHABLE',
  FAILED = 'FAILED'
}

enum TaskStatus {
  SUCCESS = 'SUCCESS',
  IN_PROGRESS = 'IN_PROGRESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}
```

### Configuration Types

```typescript
interface ContextOptions {
  allowSprint?: boolean;
  allowParkour?: boolean;
  allowParkourPlace?: boolean;
  canDig?: boolean;
  canPlace?: boolean;
  scaffoldingBlocks?: string[];
  maxFallHeight?: number;
  allowWaterBucket?: boolean;
  jumpPenalty?: number;
  maxSearchTime?: number;
  maxTotalNodes?: number;
  // ... see Configuration docs
}
```
