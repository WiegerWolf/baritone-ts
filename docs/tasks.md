# Tasks

Tasks are hierarchical units of work for complex automation. They form a tree structure where composite tasks delegate to subtasks, enabling sophisticated bot behaviors.

## Overview

Baritone-TS includes 100+ tasks organized into:

- **Composite Tasks** (46): High-level workflows that orchestrate subtasks
- **Concrete Tasks** (57): Specific implementations that do actual work

## Task vs Process

| Aspect | Task | Process |
|--------|------|---------|
| Structure | Tree of subtasks | Single unit |
| Completion | Has end condition | May run forever |
| Resources | Manages prerequisites | Uses what's available |
| Complexity | Complex workflows | Single behaviors |

**Use Tasks** for: Complex multi-step operations, resource gathering chains, building projects

**Use Processes** for: Continuous behaviors, simple automation, real-time responses

## Task Runner

Tasks are executed through the TaskRunner:

```typescript
import { TaskRunner, MineOresTask } from 'baritone-ts';

// Create task runner
const runner = new TaskRunner(bot, bot.pathfinder);

// Set the active task
runner.setTask(new MineOresTask(bot, {
  targetOres: ['diamond_ore', 'iron_ore'],
  quantity: 10
}));

// Tick the runner (call every game tick)
bot.on('physicsTick', () => {
  runner.tick();
});

// Check if task is complete
if (runner.isComplete()) {
  console.log('Task finished!');
}
```

## Core Task Types

### Resource Tasks

#### CollectItemTask

Collect a specific item, handling all prerequisites.

```typescript
import { CollectItemTask } from 'baritone-ts';

const task = new CollectItemTask(bot, {
  itemName: 'diamond',
  quantity: 5,
  // Will mine diamond ore, smelt if needed, etc.
});
```

#### MineOresTask

Mine ore blocks and collect drops.

```typescript
import { MineOresTask } from 'baritone-ts';

const task = new MineOresTask(bot, {
  targetOres: ['diamond_ore', 'deepslate_diamond_ore'],
  quantity: 10,
  returnToStart: true
});
```

#### GatherWoodTask

Collect wood from trees.

```typescript
import { GatherWoodTask } from 'baritone-ts';

const task = new GatherWoodTask(bot, {
  woodType: 'oak',    // 'oak', 'spruce', 'birch', etc. or 'any'
  quantity: 64
});
```

### Crafting Tasks

#### CraftItemTask

Craft an item, gathering materials if needed.

```typescript
import { CraftItemTask } from 'baritone-ts';

const task = new CraftItemTask(bot, {
  itemName: 'diamond_pickaxe',
  quantity: 1,
  gatherMaterials: true  // Will mine diamonds and sticks if needed
});
```

#### SmeltItemTask

Smelt items in a furnace.

```typescript
import { SmeltItemTask } from 'baritone-ts';

const task = new SmeltItemTask(bot, {
  inputItem: 'iron_ore',
  outputItem: 'iron_ingot',
  quantity: 32,
  fuel: 'coal'  // Will gather fuel if needed
});
```

### Movement Tasks

#### GoToPositionTask

Navigate to a position.

```typescript
import { GoToPositionTask } from 'baritone-ts';

const task = new GoToPositionTask(bot, {
  position: { x: 100, y: 64, z: 100 },
  tolerance: 2  // Get within 2 blocks
});
```

#### FollowEntityTask

Follow an entity until a condition is met.

```typescript
import { FollowEntityTask } from 'baritone-ts';

const task = new FollowEntityTask(bot, {
  entity: targetPlayer,
  distance: 3,
  duration: 60000  // Follow for 1 minute
});
```

#### FleeFromTask

Run away from danger.

```typescript
import { FleeFromTask } from 'baritone-ts';

const task = new FleeFromTask(bot, {
  position: dangerPosition,
  distance: 30
});
```

### Combat Tasks

#### KillEntityTask

Kill a specific entity.

```typescript
import { KillEntityTask } from 'baritone-ts';

const task = new KillEntityTask(bot, {
  entity: targetMob,
  useRanged: true,
  useShield: true
});
```

#### KillMobsTask

Hunt and kill mobs of specific types.

```typescript
import { KillMobsTask } from 'baritone-ts';

const task = new KillMobsTask(bot, {
  mobTypes: ['zombie', 'skeleton'],
  quantity: 10,
  searchRadius: 32
});
```

### Building Tasks

#### PlaceBlockTask

Place a block at a position.

```typescript
import { PlaceBlockTask } from 'baritone-ts';

const task = new PlaceBlockTask(bot, {
  position: { x: 100, y: 64, z: 100 },
  blockName: 'stone',
  face: 'top'  // Which face to place against
});
```

#### BuildStructureTask

Build a structure from instructions.

```typescript
import { BuildStructureTask } from 'baritone-ts';

const task = new BuildStructureTask(bot, {
  instructions: [
    { position: { x: 0, y: 64, z: 0 }, blockName: 'stone' },
    { position: { x: 1, y: 64, z: 0 }, blockName: 'stone' },
    // ...
  ],
  gatherMaterials: true
});
```

### Container Tasks

#### DepositItemsTask

Deposit items into a container.

```typescript
import { DepositItemsTask } from 'baritone-ts';

const task = new DepositItemsTask(bot, {
  containerPosition: { x: 100, y: 64, z: 100 },
  items: ['diamond', 'iron_ingot', 'gold_ingot']
});
```

#### WithdrawItemsTask

Withdraw items from a container.

```typescript
import { WithdrawItemsTask } from 'baritone-ts';

const task = new WithdrawItemsTask(bot, {
  containerPosition: { x: 100, y: 64, z: 100 },
  itemName: 'diamond',
  quantity: 5
});
```

### Utility Tasks

#### EquipItemTask

Equip an item in a slot.

```typescript
import { EquipItemTask } from 'baritone-ts';

const task = new EquipItemTask(bot, {
  itemName: 'diamond_sword',
  destination: 'hand'  // 'hand', 'off-hand', 'head', 'torso', 'legs', 'feet'
});
```

#### EatFoodTask

Eat food to restore hunger.

```typescript
import { EatFoodTask } from 'baritone-ts';

const task = new EatFoodTask(bot, {
  minHunger: 6,  // Eat when hunger below this
  preferredFoods: ['cooked_beef', 'golden_apple']
});
```

#### SleepTask

Sleep in a bed.

```typescript
import { SleepTask } from 'baritone-ts';

const task = new SleepTask(bot, {
  bedPosition: { x: 100, y: 64, z: 100 },
  // OR find nearest bed
  findBed: true,
  searchRadius: 32
});
```

## Task Composition

Tasks can delegate to subtasks:

```typescript
import { Task, TaskStatus } from 'baritone-ts';

class MyCompositeTask extends Task {
  private subtask: Task | null = null;

  tick(): TaskStatus {
    // Delegate to subtask if set
    if (this.subtask) {
      const status = this.subtask.tick();
      if (status === TaskStatus.SUCCESS) {
        this.subtask = null;
        // Continue with next step
      } else {
        return status;  // Still working on subtask
      }
    }

    // Check if we need to collect items first
    if (!this.hasRequiredItems()) {
      this.subtask = new CollectItemTask(this.bot, {
        itemName: 'diamond_pickaxe',
        quantity: 1
      });
      return TaskStatus.IN_PROGRESS;
    }

    // Do main work...
    return TaskStatus.IN_PROGRESS;
  }
}
```

## Task Status

Tasks return a status each tick:

```typescript
enum TaskStatus {
  SUCCESS,      // Task completed successfully
  IN_PROGRESS,  // Task is still working
  FAILED,       // Task failed
  CANCELLED     // Task was cancelled
}
```

## Task Events

```typescript
runner.on('task_started', (task) => {
  console.log(`Started: ${task.name}`);
});

runner.on('task_completed', (task) => {
  console.log(`Completed: ${task.name}`);
});

runner.on('task_failed', (task, error) => {
  console.log(`Failed: ${task.name} - ${error.message}`);
});

runner.on('subtask_started', (task, subtask) => {
  console.log(`${task.name} started subtask: ${subtask.name}`);
});
```

## Creating Custom Tasks

Extend the Task base class:

```typescript
import { Task, TaskStatus } from 'baritone-ts';

interface MyTaskOptions {
  targetItem: string;
  quantity: number;
}

class MyTask extends Task {
  private options: MyTaskOptions;
  private collected: number = 0;

  constructor(bot: Bot, options: MyTaskOptions) {
    super(bot);
    this.options = options;
  }

  get name(): string {
    return 'MyTask';
  }

  tick(): TaskStatus {
    // Check completion
    if (this.collected >= this.options.quantity) {
      return TaskStatus.SUCCESS;
    }

    // Do work
    // ...

    return TaskStatus.IN_PROGRESS;
  }

  reset(): void {
    this.collected = 0;
  }

  cancel(): void {
    // Cleanup
  }
}
```

## Task Chains

Chain tasks to run in sequence:

```typescript
import { TaskChain } from 'baritone-ts';

const chain = new TaskChain(bot, [
  new GatherWoodTask(bot, { woodType: 'oak', quantity: 16 }),
  new CraftItemTask(bot, { itemName: 'crafting_table', quantity: 1 }),
  new CraftItemTask(bot, { itemName: 'wooden_pickaxe', quantity: 1 }),
  new MineOresTask(bot, { targetOres: ['stone'], quantity: 8 }),
  new CraftItemTask(bot, { itemName: 'stone_pickaxe', quantity: 1 })
]);

runner.setTask(chain);
```

## Task Priorities

Tasks can have priorities for interruption:

```typescript
// High priority tasks can interrupt lower ones
runner.setTask(miningTask, { priority: 50 });

// Later, urgent task interrupts
runner.setTask(fleeTask, { priority: 100 });

// When flee completes, mining resumes
```

## Examples

### Full Diamond Gear Automation

```typescript
const runner = new TaskRunner(bot, bot.pathfinder);

const gearTask = new TaskChain(bot, [
  // Get wood for tools
  new GatherWoodTask(bot, { woodType: 'any', quantity: 16 }),

  // Craft basic tools
  new CraftItemTask(bot, { itemName: 'crafting_table', quantity: 1 }),
  new CraftItemTask(bot, { itemName: 'wooden_pickaxe', quantity: 1 }),

  // Upgrade to stone
  new MineOresTask(bot, { targetOres: ['stone'], quantity: 11 }),
  new CraftItemTask(bot, { itemName: 'stone_pickaxe', quantity: 1 }),
  new CraftItemTask(bot, { itemName: 'furnace', quantity: 1 }),

  // Get iron
  new MineOresTask(bot, { targetOres: ['iron_ore'], quantity: 31 }),
  new SmeltItemTask(bot, { inputItem: 'iron_ore', quantity: 31 }),
  new CraftItemTask(bot, { itemName: 'iron_pickaxe', quantity: 1 }),

  // Get diamonds
  new MineOresTask(bot, { targetOres: ['diamond_ore'], quantity: 24 }),

  // Craft diamond gear
  new CraftItemTask(bot, { itemName: 'diamond_pickaxe', quantity: 1 }),
  new CraftItemTask(bot, { itemName: 'diamond_sword', quantity: 1 }),
  new CraftItemTask(bot, { itemName: 'diamond_helmet', quantity: 1 }),
  new CraftItemTask(bot, { itemName: 'diamond_chestplate', quantity: 1 }),
  new CraftItemTask(bot, { itemName: 'diamond_leggings', quantity: 1 }),
  new CraftItemTask(bot, { itemName: 'diamond_boots', quantity: 1 })
]);

runner.setTask(gearTask);
```

### Base Builder Bot

```typescript
const baseTask = new TaskChain(bot, [
  // Clear area
  new ClearAreaTask(bot, {
    min: { x: 0, y: 64, z: 0 },
    max: { x: 10, y: 68, z: 10 }
  }),

  // Build floor
  new BuildStructureTask(bot, {
    instructions: BuildHelper.createFloor(0, 64, 0, 10, 10, 'stone_bricks'),
    gatherMaterials: true
  }),

  // Build walls
  new BuildStructureTask(bot, {
    instructions: BuildHelper.createWalls(0, 65, 0, 10, 4, 10, 'stone_bricks'),
    gatherMaterials: true
  }),

  // Add roof
  new BuildStructureTask(bot, {
    instructions: BuildHelper.createFloor(0, 69, 0, 10, 10, 'oak_planks'),
    gatherMaterials: true
  }),

  // Place door
  new PlaceBlockTask(bot, {
    position: { x: 5, y: 65, z: 0 },
    blockName: 'oak_door'
  })
]);

runner.setTask(baseTask);
```
