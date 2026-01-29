# Tasks

Tasks are hierarchical units of work for complex automation. They form a tree structure where composite tasks delegate to subtasks, enabling sophisticated bot behaviors.

## Overview

Baritone-TS includes a comprehensive task system organized into:

- **Base Classes**: `Task`, `WrapperTask`, `GroundedTask`
- **Task Chains**: Priority-based execution system (`TaskChain`, `SingleTaskChain`, `UserTaskChain`)
- **Task Runner**: Central orchestrator (`TaskRunner`)
- **Resource Tasks**: Generic resource acquisition (`ResourceTask`, `CollectItemTask`, `GatherItemTask`, `MineAndCollectTask`)
- **Concrete Tasks**: 150+ low-level task implementations
- **Composite Tasks**: 44 high-level workflows combining multiple tasks

## Directory Structure

```
src/tasks/
├── TaskRunner.ts           # Central task orchestrator
├── TaskCatalogue.ts        # Task factory registry
├── interfaces.ts           # ITask, ITaskChain, ITaskCanForce, etc.
├── base/                   # Core task classes
│   ├── Task.ts             # Abstract base class
│   ├── WrapperTask.ts      # Decorator pattern
│   └── GroundedTask.ts     # Ground-safety enforcement
├── chain/                  # Task chain system
│   ├── TaskChain.ts        # Base chain
│   ├── SingleTaskChain.ts  # Single-task chain (for survival)
│   ├── UserTaskChain.ts    # User-initiated chain
│   └── ChainPriority.ts    # Priority constants
├── resource/               # Resource acquisition
│   ├── ResourceTask.ts     # Base resource task
│   ├── CollectItemTask.ts  # Collect from any source
│   ├── GatherItemTask.ts   # Gather from world
│   ├── MineAndCollectTask.ts
│   ├── ItemSourceBlocks.ts # Block-to-item mappings
│   └── ResourceTaskConfig.ts
├── concrete/               # 150+ atomic tasks
│   ├── GoToTask.ts, MineBlockTask.ts, CraftTask.ts, ...
│   └── index.ts            # Barrel exports
└── composite/              # 44 high-level workflows
    ├── FarmTask.ts, CombatTask.ts, BuildTask.ts, ...
    └── index.ts            # Barrel exports
```

## Task System Architecture

### Task Base Class

All tasks extend the abstract `Task` class:

```typescript
import { Task } from 'baritone-ts';

abstract class Task {
  readonly displayName: string;
  protected bot: Bot;

  // Lifecycle methods
  onStart(): void;              // Called when task begins
  onTick(): Task | null;        // Called each tick, returns subtask or null
  onStop(): void;               // Called when task ends

  // State methods
  isFinished(): boolean;        // Check if task is complete
  isEqual(other: Task | null): boolean;  // Equality for task switching
}
```

### Task Lifecycle

1. `onStart()` - Initialize task state
2. `onTick()` - Execute each tick, can return subtask for delegation
3. `onStop()` - Cleanup when task ends or is interrupted

### Specialized Task Types

#### WrapperTask

Decorates an existing task with additional behavior:

```typescript
import { WrapperTask, Task } from 'baritone-ts';

class MyWrapper extends WrapperTask {
  constructor(bot: Bot, inner: Task) {
    super(bot, inner);
  }

  onTick(): Task | null {
    // Add behavior before/after inner task
    return this.inner;
  }
}
```

#### GroundedTask

Tasks that require the player to be on the ground for safety:

```typescript
import { GroundedTask } from 'baritone-ts';

class SafeTask extends GroundedTask {
  // Won't execute mid-air
  // Prevents interruption by other tasks while mid-air
}
```

## Task Chain System

Task chains compete for execution based on priority. Only the highest priority active chain runs each tick.

### Chain Priorities

```typescript
const ChainPriority = {
  INACTIVE: 0,      // Not running
  USER_TASK: 50,    // User-initiated tasks
  FOOD: 55,         // Automatic eating (higher than user)
  DANGER: 100,      // Combat/survival (highest normal)
  DEATH: 1000,      // Respawn handling
};
```

### Built-in Chains

| Chain | Priority | Purpose |
|-------|----------|---------|
| `UserTaskChain` | 50 | User-initiated tasks |
| `FoodChain` | 55 | Automatic eating when hungry |
| `MobDefenseChain` | 100 | Combat when hostiles nearby |
| `WorldSurvivalChain` | 100 | Escape lava/fire |
| `MLGBucketChain` | 100 | Fall protection |
| `DeathMenuChain` | 1000 | Respawn handling |

### UserTaskChain

For user-initiated tasks:

```typescript
import { UserTaskChain, GoToTask } from 'baritone-ts';

const userChain = new UserTaskChain(bot);
userChain.setUserTask(new GoToTask(bot, targetPos));
```

### SingleTaskChain

Base for survival chains that produce tasks dynamically:

```typescript
import { SingleTaskChain, Task, ChainPriority } from 'baritone-ts';

class MyChain extends SingleTaskChain {
  readonly displayName = 'MyChain';

  getPriority(): number {
    return this.shouldActivate() ? ChainPriority.DANGER : ChainPriority.INACTIVE;
  }

  isActive(): boolean {
    return this.shouldActivate();
  }

  protected getTaskForTick(): Task | null {
    // Return the task to run this tick
    return this.shouldActivate() ? new MyTask(this.bot) : null;
  }
}
```

## Task Runner

The `TaskRunner` orchestrates multiple task chains:

```typescript
import { TaskRunner, createTaskRunner } from 'baritone-ts';

// Create task runner
const runner = createTaskRunner(bot);

// Or manually
const runner = new TaskRunner(bot);

// Register chains (built-in chains auto-registered)
runner.registerChain(new FoodChain(bot));
runner.registerChain(new UserTaskChain(bot));

// Attach to physics tick
runner.attachToBot();

// Or manually tick
bot.on('physicsTick', () => runner.tick());
```

### TaskRunner Events

```typescript
runner.on('chain_changed', (oldChain, newChain) => {
  console.log(`Chain changed: ${oldChain} -> ${newChain}`);
});

runner.on('task_started', (task) => {
  console.log(`Started: ${task.displayName}`);
});

runner.on('task_finished', (task) => {
  console.log(`Finished: ${task.displayName}`);
});

runner.on('tick', () => {
  // Called every tick
});
```

## Concrete Tasks

Low-level tasks in `src/tasks/concrete/`:

### Navigation Tasks

```typescript
import {
  GoToTask,
  GoToBlockTask,
  GetToBlockTask,
  GoToNearTask,
  GoToXZTask,
  FollowEntityTask
} from 'baritone-ts';

// Go to exact position
new GoToTask(bot, { x: 100, y: 64, z: 100 });

// Go to specific block
new GoToBlockTask(bot, 100, 64, 100);

// Get adjacent to block (for interaction)
new GetToBlockTask(bot, 100, 64, 100);

// Get within range
new GoToNearTask(bot, { x: 100, y: 64, z: 100 }, 5);

// Go to X,Z coordinates
new GoToXZTask(bot, 100, 100);

// Follow an entity
new FollowEntityTask(bot, entity, 3);
```

### Mining Tasks

```typescript
import { MineBlockTask, MineBlockTypeTask } from 'baritone-ts';

// Mine specific block at position
new MineBlockTask(bot, { x: 100, y: 64, z: 100 });

// Mine all blocks of a type
new MineBlockTypeTask(bot, 'diamond_ore');
```

### Placement Tasks

```typescript
import { PlaceBlockTask, PlaceAgainstTask } from 'baritone-ts';

// Place block at position
new PlaceBlockTask(bot, { x: 100, y: 64, z: 100 }, 'cobblestone');

// Place against another block
new PlaceAgainstTask(bot, targetPos, againstPos, 'cobblestone');
```

### Crafting Tasks

```typescript
import { CraftTask, EnsureItemTask } from 'baritone-ts';

// Craft item
new CraftTask(bot, 'diamond_pickaxe', 1);

// Ensure item exists (craft if missing)
new EnsureItemTask(bot, 'crafting_table', 1);
```

### Smelting Tasks

```typescript
import { SmeltTask, isFuel, getFuelBurnTime } from 'baritone-ts';

// Smelt items
new SmeltTask(bot, 'iron_ore', 'iron_ingot', 16);

// Check if item is fuel
if (isFuel('coal')) {
  const burnTime = getFuelBurnTime('coal');
}
```

### Inventory Tasks

```typescript
import {
  EquipTask,
  PickupItemTask,
  DropItemTask,
  MoveItemTask,
  EquipmentSlot
} from 'baritone-ts';

// Equip item
new EquipTask(bot, 'diamond_sword', EquipmentSlot.HAND);

// Pickup dropped item
new PickupItemTask(bot, itemEntity);

// Drop items
new DropItemTask(bot, 'cobblestone', 64);

// Move item between slots
new MoveItemTask(bot, sourceSlot, destSlot);
```

### Interaction Tasks

```typescript
import {
  InteractBlockTask,
  InteractEntityTask,
  AttackEntityTask,
  UseItemTask
} from 'baritone-ts';

// Interact with block (open chest, press button)
new InteractBlockTask(bot, { x: 100, y: 64, z: 100 });

// Interact with entity
new InteractEntityTask(bot, entity);

// Attack entity
new AttackEntityTask(bot, entity);

// Use held item
new UseItemTask(bot);
```

## Composite Tasks

High-level tasks in `src/tasks/composite/`:

### Resource Gathering

```typescript
import {
  CollectWoodTask,
  GatherResourcesTask,
  gatherResources,
  MineOresTask,
  mineDiamonds,
  mineIron,
  mineCoal
} from 'baritone-ts';

// Collect wood
new CollectWoodTask(bot, { woodType: 'oak', quantity: 32 });

// Gather generic resources
new GatherResourcesTask(bot, config);
gatherResources(bot, 'iron_ore', 16);

// Mine specific ores
new MineOresTask(bot, { targetOres: ['diamond_ore'], quantity: 10 });
mineDiamonds(bot, 10);
mineIron(bot, 32);
mineCoal(bot, 64);
```

### Tools

```typescript
import { GetToolTask, ensureTool, ToolType } from 'baritone-ts';

// Get or craft a tool
new GetToolTask(bot, 'pickaxe', 'iron');
ensureTool(bot, ToolType.PICKAXE, 'diamond');
```

### Farming

```typescript
import {
  FarmTask,
  FarmMode,
  harvestCrops,
  harvestAndReplant,
  maintainFarm,
  harvestWheat
} from 'baritone-ts';

// Farm with specific mode
new FarmTask(bot, {
  mode: FarmMode.HARVEST_AND_REPLANT,
  crops: ['wheat', 'carrots', 'potatoes']
});

// Helper functions
harvestCrops(bot);
harvestAndReplant(bot);
maintainFarm(bot);
harvestWheat(bot);
```

### Exploration

```typescript
import {
  ExploreTask,
  ExplorePattern,
  exploreSpiral,
  exploreTowards,
  exploreRandom,
  exploreArea
} from 'baritone-ts';

// Explore with pattern
new ExploreTask(bot, { pattern: ExplorePattern.SPIRAL });

// Helper functions
exploreSpiral(bot, origin, radius);
exploreTowards(bot, direction);
exploreRandom(bot);
exploreArea(bot, minPos, maxPos);
```

### Building

```typescript
import {
  BuildShelterTask,
  ShelterType,
  buildDirtHut,
  buildWoodCabin,
  digUnderground,
  buildEmergencyShelter
} from 'baritone-ts';

// Build shelter
new BuildShelterTask(bot, { type: ShelterType.WOOD_CABIN });

// Helper functions
buildDirtHut(bot);
buildWoodCabin(bot);
digUnderground(bot);
buildEmergencyShelter(bot);
```

### Combat

```typescript
import {
  CombatTask,
  CombatStyle,
  fightMobs,
  fightEntity,
  hitAndRun,
  defensiveCombat
} from 'baritone-ts';

// Combat with style
new CombatTask(bot, {
  style: CombatStyle.AGGRESSIVE,
  target: entity
});

// Helper functions
fightMobs(bot, ['zombie', 'skeleton']);
fightEntity(bot, entity);
hitAndRun(bot, entity);
defensiveCombat(bot);
```

### Survival

```typescript
import {
  SurviveTask,
  SurvivalPriority,
  survive,
  survivePassive,
  surviveAndProgress
} from 'baritone-ts';

// Survival mode
new SurviveTask(bot, { priority: SurvivalPriority.FOOD_FIRST });

// Helper functions
survive(bot);
survivePassive(bot);
surviveAndProgress(bot);
```

## Resource Task System

Generic resource collection system:

```typescript
import {
  ResourceTask,
  CollectItemTask,
  GatherItemTask,
  MineAndCollectTask,
  ITEM_SOURCE_BLOCKS,
  createSourceBlockMap
} from 'baritone-ts';

// Collect item from any source
new CollectItemTask(bot, 'diamond', 10);

// Gather from world
new GatherItemTask(bot, 'apple', 5);

// Mine and collect
new MineAndCollectTask(bot, 'iron_ore', 16);

// Get source blocks for item
const sources = ITEM_SOURCE_BLOCKS.get('diamond');
```

## Task Catalogue

Registry for task creation:

```typescript
import {
  TaskCatalogue,
  createTaskCatalogue,
  getAcquisitionChain,
  SMELTING_RECIPES,
  getSmeltingRecipe
} from 'baritone-ts';

// Create catalogue
const catalogue = createTaskCatalogue(bot);

// Get acquisition chain for item
const chain = getAcquisitionChain(bot, 'diamond_pickaxe');

// Get smelting recipe
const recipe = getSmeltingRecipe('iron_ingot');
// { input: 'iron_ore', output: 'iron_ingot', fuel: 'any' }
```

## Creating Custom Tasks

### Simple Task

```typescript
import { Task } from 'baritone-ts';

class MyTask extends Task {
  readonly displayName = 'MyTask';
  private done = false;

  onStart(): void {
    this.done = false;
  }

  onTick(): Task | null {
    // Do work
    if (/* condition */) {
      this.done = true;
    }
    return null;
  }

  onStop(): void {
    // Cleanup
  }

  isFinished(): boolean {
    return this.done;
  }

  isEqual(other: Task | null): boolean {
    return other instanceof MyTask;
  }
}
```

### Task with Subtasks

```typescript
import { Task } from 'baritone-ts';

class CompositeTask extends Task {
  readonly displayName = 'CompositeTask';
  private phase = 0;

  onTick(): Task | null {
    switch (this.phase) {
      case 0:
        // Phase 0: Gather materials
        this.phase = 1;
        return new GatherResourcesTask(this.bot, config);

      case 1:
        // Phase 1: Build structure
        this.phase = 2;
        return new BuildTask(this.bot, config);

      case 2:
        // Done
        return null;
    }
    return null;
  }

  isFinished(): boolean {
    return this.phase === 2;
  }
}
```

### Grounded Task

```typescript
import { GroundedTask } from 'baritone-ts';

class SafeOperationTask extends GroundedTask {
  readonly displayName = 'SafeOperation';

  // This task won't be interrupted while player is mid-air
  // Prevents dangerous interruptions during jumps/falls
}
```

## Task Interfaces

### ITaskCanForce

Tasks implementing this can prevent interruption:

```typescript
interface ITaskCanForce {
  shouldForce(): boolean;
}
```

### ITaskRequiresGrounded

Tasks that need the player grounded:

```typescript
interface ITaskRequiresGrounded {
  requiresGrounded(): boolean;
}
```

### ITaskOverridesGrounded

Tasks that can interrupt grounded tasks (e.g., MLG bucket):

```typescript
interface ITaskOverridesGrounded {
  overridesGrounded(): boolean;
}
```

## Examples

### Complete Automation Chain

```typescript
const runner = createTaskRunner(bot);

// Set user task
runner.getUserChain().setUserTask(
  new MineOresTask(bot, {
    targetOres: ['diamond_ore'],
    quantity: 10
  })
);

// Survival chains run automatically:
// - FoodChain eats when hungry
// - MobDefenseChain fights when attacked
// - MLGBucketChain protects from falls

runner.attachToBot();
```

### Custom Task Chain

```typescript
const runner = createTaskRunner(bot);

// Add custom high-priority chain
class EmergencyChain extends SingleTaskChain {
  readonly displayName = 'Emergency';

  getPriority(): number {
    return this.isEmergency() ? ChainPriority.DANGER : ChainPriority.INACTIVE;
  }

  isActive(): boolean {
    return this.isEmergency();
  }

  protected getTaskForTick(): Task | null {
    return this.isEmergency() ? new FleeTask(this.bot) : null;
  }

  private isEmergency(): boolean {
    return this.bot.health < 5;
  }
}

runner.registerChain(new EmergencyChain(bot));
```

## Complete Task Catalogue

Baritone-TS includes 200+ task implementations organized into categories:

### Concrete Tasks (Low-Level)

| Category | Tasks |
|----------|-------|
| **Navigation** | `GoToTask`, `GoToBlockTask`, `GetToBlockTask`, `GoToNearTask`, `GoToXZTask`, `FollowEntityTask`, `GetToChunkTask`, `GetToYTask` |
| **Mining** | `MineBlockTask`, `MineBlockTypeTask`, `DestroyBlockTask`, `MineAndCollectTask` |
| **Placement** | `PlaceBlockTask`, `PlaceAgainstTask`, `PlaceBlockNearbyTask`, `ClearLiquidTask` |
| **Crafting** | `CraftTask`, `CraftInInventoryTask`, `CraftWithRecipeBookTask`, `CraftInTableTask`, `CraftWithMatchingMaterialsTask` |
| **Smelting** | `SmeltTask`, `SmeltInFurnaceBaseTask` |
| **Inventory** | `EquipTask`, `PickupItemTask`, `DropItemTask`, `MoveItemTask`, `MoveItemToSlotTask` |
| **Slots** | `ClickSlotTask`, `EnsureFreeCursorSlotTask`, `EnsureFreeInventorySlotTask`, `ThrowCursorTask`, `ReceiveCraftingOutputTask` |
| **Interaction** | `InteractBlockTask`, `InteractEntityTask`, `AttackEntityTask`, `UseItemTask`, `InteractWithBlockTask` |
| **Container** | `DoStuffInContainerTask`, `PickupFromContainerTask`, `StoreInContainerTask`, `LootContainerTask` |
| **Entity** | `AbstractDoToEntityTask`, `DoToClosestEntityTask`, `KillPlayerTask`, `GiveItemToPlayerTask` |
| **Escape** | `EscapeFromLavaTask`, `RunAwayFromCreepersTask`, `RunAwayFromHostilesTask`, `RunAwayFromPositionTask` |
| **Resource** | `ResourceTask`, `CollectItemTask`, `GatherItemTask`, `CollectFuelTask`, `CollectFoodTask` |
| **Armor** | `EquipArmorTask`, `EquipSpecificArmorTask` |
| **Portal** | `EnterNetherPortalTask`, `GoToDimensionTask`, `ConstructNetherPortalTask` |
| **Bed/Sleep** | `PlaceBedAndSetSpawnTask`, `SleepInBedTask` |
| **Liquid** | `CollectBucketLiquidTask`, `CollectWaterBucketTask`, `CollectLavaBucketTask` |
| **Dodge** | `DodgeProjectilesTask`, `StrafeAndDodgeTask` |
| **Trading** | `TradeWithPiglinsTask` |
| **MLG** | `MLGBucketTask`, `MLGBucketMonitorTask` |
| **Search** | `SearchChunksExploreTask`, `SearchChunkForBlockTask`, `SearchChunkByConditionTask` |
| **Dragon** | `KillEnderDragonTask`, `WaitForDragonAndPearlTask`, `KillEnderDragonWithBedsTask` |
| **Construction** | `PlaceSignTask`, `ClearRegionTask`, `CoverWithBlocksTask`, `ConstructIronGolemTask` |
| **Speedrun** | `BeatMinecraftTask`, `LocateStrongholdCoordinatesTask`, `GoToStrongholdPortalTask` |

### Composite Tasks (High-Level)

| Category | Tasks | Helper Functions |
|----------|-------|------------------|
| **Wood** | `CollectWoodTask` | - |
| **Tools** | `GetToolTask` | `ensureTool()` |
| **Resources** | `GatherResourcesTask` | `gatherResources()` |
| **Mining** | `MineOresTask` | `mineDiamonds()`, `mineIron()`, `mineCoal()`, `mineGold()` |
| **Farming** | `FarmTask` | `harvestCrops()`, `harvestAndReplant()`, `maintainFarm()` |
| **Exploration** | `ExploreTask` | `exploreSpiral()`, `exploreTowards()`, `exploreRandom()` |
| **Shelter** | `BuildShelterTask` | `buildDirtHut()`, `buildWoodCabin()`, `digUnderground()` |
| **Combat** | `CombatTask` | `fightMobs()`, `fightEntity()`, `hitAndRun()` |
| **Survival** | `SurviveTask` | `survive()`, `survivePassive()`, `surviveAndProgress()` |
| **Trading** | `TradingTask` | `tradeWithVillager()`, `buyItem()`, `sellItem()` |
| **Enchanting** | `EnchantTask` | `enchantItem()`, `enchantBestAvailable()` |
| **Brewing** | `BrewingTask` | `brewPotion()`, `brewHealingPotions()`, `brewStrengthPotions()` |
| **Building** | `BuildTask` | `buildCube()`, `buildPlatform()`, `buildWall()` |
| **Repair** | `RepairTask` | `repairWithAnvil()`, `repairWithGrindstone()` |
| **Storage** | `StorageTask` | `depositItems()`, `withdrawItems()`, `organizeStorage()` |
| **Portal** | `PortalTask` | `enterNether()`, `enterEnd()`, `buildAndEnterNether()` |
| **Fishing** | `FishingTask` | `goFishing()`, `fishUntilFull()` |
| **Sleep** | `SleepTask` | `sleepInBed()`, `sleepNow()` |
| **Boat** | `BoatTask` | `boatToPosition()`, `enterNearestBoat()` |
| **Parkour** | `ParkourTask` | `parkourTo()`, `sprintJumpTo()` |
| **Schematic** | `SchematicTask` | `buildSchematic()`, `buildCube()`, `buildHollowBox()` |
| **Hunting** | `HuntTask` | `huntAnimals()`, `huntForFood()`, `huntCows()` |
| **Defense** | `DefendAreaTask` | `defendArea()`, `defendCurrentPosition()` |
| **Following** | `FollowPlayerTask` | `followPlayer()`, `followPlayerClose()` |
| **Looting** | `LootChestTask` | `lootNearbyChests()`, `lootValuables()` |
| **Fleeing** | `FleeTask` | `flee()`, `fleeFromMobs()`, `emergencyFlee()` |
| **Smithing** | `SmithingTask` | `upgradeToNetherite()`, `upgradeTools()` |
| **Taming** | `TameAnimalTask` | `tameWolf()`, `tameCat()`, `tameHorse()` |
| **Riding** | `RideEntityTask` | `rideHorse()`, `ridePig()`, `rideStrider()` |
| **Cleanup** | `CleanupTask` | `clearDebris()`, `flattenArea()`, `collectDroppedItems()` |
| **Danger** | `EscapeDangerTask` | `escapeLava()`, `escapeFire()`, `escapeDrowning()` |
| **Bridging** | `BridgeTask` | `bridgeTo()`, `bridgeNorth()`, `bridgeWithRailings()` |
| **Scaffolding** | `ScaffoldTask` | `scaffoldUp()`, `scaffoldDown()`, `nerdPole()` |
| **Mine Layers** | `MineLayerTask` | `mineLayer()`, `stripMine()`, `branchMine()` |
| **Torches** | `TorchTask` | `placeTorches()`, `lightArea()`, `torchGrid()` |
| **Trees** | `PlantTreeTask` | `plantOakTrees()`, `plantWithBonemeal()` |
| **Composting** | `CompostTask` | `compost()`, `compostAll()`, `compostSeeds()` |
| **Effects** | `UseEffectTask` | `useHealing()`, `useStrength()`, `maintainEffect()` |

### Speedrun Tasks

For automated Minecraft speedruns:

```typescript
import { BeatMinecraftTask, beatMinecraft, speedrunMinecraft } from 'baritone-ts';

// Full automatic speedrun
const task = new BeatMinecraftTask(bot, {
  collectDiamonds: true,
  buildPortal: true,
  enterNether: true,
  collectBlazeRods: true,
  collectEnderPearls: true,
  locateStronghold: true,
  enterEnd: true,
  killDragon: true
});

// Or use helper functions
await beatMinecraft(bot);
await speedrunMinecraft(bot);
```
