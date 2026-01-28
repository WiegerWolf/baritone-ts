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

enum MovementStatus {
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

## Action Costs

Tick-based movement cost constants:

```typescript
// Movement costs (ticks per block)
const WALK_ONE_BLOCK_COST = 4.633;      // Walking
const SPRINT_ONE_BLOCK_COST = 3.564;    // Sprinting
const SPRINT_MULTIPLIER = 1.3;          // Sprint speed multiplier
const SNEAK_ONE_BLOCK_COST = 15.385;    // Sneaking
const WALK_ONE_IN_WATER_COST = 20.0;    // Walking in water
const WALK_ONE_OVER_SOUL_SAND_COST = 6.0; // Soul sand penalty

// Vertical movement
const LADDER_UP_ONE_COST = 6.667;       // Climbing up ladder
const LADDER_DOWN_ONE_COST = 3.333;     // Descending ladder
const SWIM_UP_ONE_COST = 10.0;          // Swimming up
const SWIM_DOWN_ONE_COST = 5.0;         // Swimming down

// Jumping and falling
const JUMP_ONE_BLOCK_COST = 2.5;        // Jump cost
const WALK_OFF_BLOCK_COST = 1.8;        // Walking off edge
const CENTER_AFTER_FALL_COST = 2.0;     // Centering after fall
const FALL_N_BLOCKS_COST: number[];     // Pre-calculated fall costs (0-256)

// Block interaction
const PLACE_ONE_BLOCK_COST = 4.0;       // Placing a block
const BACKPLACE_ADDITIONAL_PENALTY = 1.0; // Backplace penalty

// Utility functions
function getFallCost(blocks: number): number;
function getBreakCost(block: Block, tool: Item): number;
function getTerrainCost(block: Block): number;
```

## Control System

### InputControls

Low-level input state management:

```typescript
import { InputControls, Input, createInputControls } from 'baritone-ts';

const controls = createInputControls(bot);

// Input enum
enum Input {
  FORWARD, BACK, LEFT, RIGHT,
  JUMP, SNEAK, SPRINT
}

// Set input state
controls.set(Input.FORWARD, true);
controls.set(Input.SPRINT, true);

// Clear all inputs
controls.clear();

// Get current state
const isForward = controls.get(Input.FORWARD);
```

### KillAura

Combat automation system:

```typescript
import { KillAura, KillAuraStrategy, createKillAura } from 'baritone-ts';

const aura = createKillAura(bot, {
  strategy: KillAuraStrategy.NEAREST,
  range: 4.0,
  attackCooldown: true,
  rotateToTarget: true,
  targetHostiles: true,
  targetPlayers: false,
});

// Strategies
enum KillAuraStrategy {
  NEAREST,      // Attack nearest entity
  LOWEST_HEALTH, // Attack weakest entity
  HIGHEST_THREAT // Attack most dangerous
}

// Enable/disable
aura.enable();
aura.disable();

// Manual tick (if not auto-attached)
aura.tick();
```

### PlayerExtraController

Extended player actions:

```typescript
import { PlayerExtraController, createPlayerExtraController } from 'baritone-ts';

const controller = createPlayerExtraController(bot);

// Shield blocking
controller.startBlocking();
controller.stopBlocking();

// Attack management
controller.attack(entity);
controller.attackWithCooldown(entity);
```

## Utility Helpers

### ItemHelper

Item classification and utilities:

```typescript
import {
  WoodType, DyeColor,
  isLog, isPlanks, isPickaxe, isAxe, isSword, isBed, isWool, isBoat,
  logToPlanks, planksToLog, getCookedFood,
  isRawFood, isFuel, getFuelAmount,
  getToolTier, getArmorTier, areShearsEffective,
  stripItemName, getWoodTypeFromItem, getColorFromItem
} from 'baritone-ts';

// Wood types
enum WoodType {
  Oak, Spruce, Birch, Jungle, Acacia, DarkOak, Mangrove, Cherry
}

// Dye colors (all 16)
enum DyeColor {
  White, Orange, Magenta, LightBlue, Yellow, Lime, Pink, Gray,
  LightGray, Cyan, Purple, Blue, Brown, Green, Red, Black
}

// Classification
isLog('oak_log');           // true
isPlanks('spruce_planks');  // true
isPickaxe('iron_pickaxe');  // true
isFuel('coal');             // true
getFuelAmount('coal');      // 1600 ticks

// Conversions
logToPlanks('oak_log');     // 'oak_planks'
getCookedFood('beef');      // 'cooked_beef'
getToolTier('diamond_pickaxe'); // 'diamond'
```

### EntityHelper

Entity classification and calculations:

```typescript
import {
  isHostileMob, isPassiveMob, isNeutralMob, isPlayer,
  isAngryAtPlayer, isGenerallyHostileToPlayer,
  isGrounded, isPlayerGrounded,
  DamageSource, damageBypassesArmor,
  calculateArmorReduction, calculateResultingPlayerDamage,
  getPlayerArmor, getPlayerProtectionLevel,
  getEntityDistance, getNearestEntity, getEntitiesInRange
} from 'baritone-ts';

// Entity classification
isHostileMob(entity);    // zombie, skeleton, etc.
isPassiveMob(entity);    // cow, pig, sheep, etc.
isNeutralMob(entity);    // wolf, enderman, etc.

// Damage calculation
enum DamageSource {
  MELEE, PROJECTILE, FALL, FIRE, LAVA, DROWNING, MAGIC, EXPLOSION
}

const finalDamage = calculateResultingPlayerDamage(bot, 10, DamageSource.MELEE);
const armor = getPlayerArmor(bot);

// Entity queries
const nearest = getNearestEntity(bot, e => isHostileMob(e));
const inRange = getEntitiesInRange(bot, 16, isHostileMob);
```

### WorldHelper

World state queries:

```typescript
import {
  Dimension, getCurrentDimension,
  isSolid, isAir, isWater, isLava, isFallingBlock,
  isSourceBlock, isInteractableBlock, isChest,
  getGroundHeight, canSleep,
  getBlocksTouchingPlayer, scanRegion,
  getOverworldPosition, getNetherPosition, isOcean,
  distanceXZ, inRangeXZ
} from 'baritone-ts';

// Dimensions
enum Dimension {
  Overworld = 0,
  Nether = -1,
  End = 1
}

// Block checks
isSolid(block);           // true if solid
isWater(block);           // true if water
isLava(block);            // true if lava
isSourceBlock(block);     // true if source (not flowing)

// Position utilities
const dim = getCurrentDimension(bot);
const groundY = getGroundHeight(bot.world, x, z);
const netherPos = getNetherPosition(overworldPos); // /8 for X and Z
```

### MathHelper

Mathematical utilities:

```typescript
import {
  clamp, lerp, lerpVec3,
  distanceSquared, distanceSquaredXZ,
  normalizeAngle, angleDifference,
  toRadians, toDegrees,
  yawFromDirection, pitchFromDirection, directionFromAngles,
  projectVector, projectOntoPlane,
  calculateGenericHeuristic
} from 'baritone-ts';

// Clamping and interpolation
clamp(value, 0, 100);
lerp(a, b, 0.5);          // Midpoint
lerpVec3(vecA, vecB, t);  // Vector interpolation

// Angles
normalizeAngle(angle);     // Normalize to [-180, 180]
angleDifference(a, b);     // Shortest angle difference
yawFromDirection(vec);     // Get yaw from direction vector
```

### LookHelper

Rotation management:

```typescript
import { LookHelper, createLookHelper, calculateLookRotation } from 'baritone-ts';

const look = createLookHelper(bot);

// Look at target
look.lookAt(position);
look.lookAtEntity(entity);
look.lookAtBlock(blockPos);

// Check if looking
look.isLookingAt(position, tolerance);

// Calculate rotation
const { yaw, pitch } = calculateLookRotation(bot.entity.position, targetPos);
```

### ProjectileHelper

Projectile physics:

```typescript
import {
  ProjectileType, PROJECTILE_GRAVITY,
  predictProjectilePosition, willProjectileHit,
  calculateProjectileClosestApproach,
  calculateAnglesForSimpleProjectileMotion,
  getTimeToDistance
} from 'baritone-ts';

enum ProjectileType {
  Arrow, ThrowableEntity, Fireball, Fireworks
}

// Prediction
const futurePos = predictProjectilePosition(projectile, ticksAhead);
const willHit = willProjectileHit(projectile, targetAABB);
const closest = calculateProjectileClosestApproach(projectile, targetPos);

// Aiming
const angles = calculateAnglesForSimpleProjectileMotion(
  startPos, targetPos, velocity, ProjectileType.Arrow
);
```

## Crafting System

```typescript
import {
  CraftingRecipe, RecipeTarget, CraftingGridSize,
  COMMON_RECIPES, getRecipe, isCraftable, registerRecipe
} from 'baritone-ts';

// Grid sizes
enum CraftingGridSize {
  Inventory2x2,
  Workbench3x3
}

// Check if can craft
const canCraft = isCraftable(bot, 'diamond_pickaxe');

// Get recipe
const recipe = getRecipe('diamond_pickaxe');
// { result: 'diamond_pickaxe', ingredients: [...], gridSize: Workbench3x3 }

// Register custom recipe
registerRecipe(new CraftingRecipe({
  result: 'my_item',
  resultCount: 1,
  ingredients: [['diamond', 'diamond'], ['stick', null]],
  gridSize: CraftingGridSize.Workbench3x3
}));
```

## Enums Reference

### Core Enums

```typescript
// Movement
enum MovementStatus { PREPPING, WAITING, RUNNING, SUCCESS, UNREACHABLE, FAILED }
enum Passability { PASSABLE, DANGEROUS, IMPASSABLE }
enum PathingBlockType { AIR, WATER, AVOID, SOLID }

// Process system
enum ProcessPriority { Critical, High, Normal, Low, Lowest }
enum ProcessState { Idle, Running, Paused, Completed, Failed }

// Async pathfinding
enum AsyncPathState { IDLE, COMPUTING, COMPLETE, CANCELLED, ERROR }

// Task chains
enum ChainPriority { INACTIVE = 0, USER_TASK = 50, FOOD = 55, DANGER = 100, DEATH = 1000 }

// Events
enum HandlerPriority { LOWEST = 0, LOW = 25, NORMAL = 50, HIGH = 75, HIGHEST = 100, MONITOR = 150 }

// Elytra/Boat
enum ElytraState { IDLE, LAUNCHING, FLYING, LANDING, LANDED }
enum BoatState { IDLE, ENTERING, TRAVELING, EXITING, ARRIVED }

// Entity tracking
enum EntityCategory { Hostile, Neutral, Passive, Projectile, Player, Other }

// Mining
enum MiningRequirement { NONE, WOOD, STONE, IRON, DIAMOND, NETHERITE }

// Slots
enum SlotType { PLAYER, ARMOR, OFFHAND, HOTBAR, CONTAINER, CRAFTING }
enum ClickType { LEFT, RIGHT, SHIFT_LEFT, SHIFT_RIGHT, DROP, CTRL_DROP }
```

### Dimension & World

```typescript
enum Dimension { Overworld = 0, Nether = -1, End = 1 }
enum WoodType { Oak, Spruce, Birch, Jungle, Acacia, DarkOak, Mangrove, Cherry }
enum DyeColor { White, Orange, Magenta, LightBlue, Yellow, Lime, Pink, Gray, LightGray, Cyan, Purple, Blue, Brown, Green, Red, Black }
```

## Complete Exports List

For a complete list of all exports, see the [source index.ts](../src/index.ts).

Main export categories:
- **Goals**: 17 goal types
- **Movements**: 22+ movement classes
- **Tasks**: 300+ task implementations
- **Chains**: 6 survival chains
- **Processes**: 7 process types
- **Trackers**: 5 tracker types
- **Utilities**: 200+ helper functions
- **Events**: Type-safe event bus
- **Settings**: Comprehensive configuration
