# Basic Concepts

Understanding the architecture of Baritone-TS will help you use it effectively.

## Overview

Baritone-TS is built around several key concepts:

```
┌─────────────────────────────────────────────────────────────────┐
│                          Your Bot                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Processes  │  │    Tasks     │  │    Raw Pathfinding   │   │
│  │  (Mining,    │  │  (Complex    │  │    (Goals, A*)       │   │
│  │   Following) │  │   Workflows) │  │                      │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │               │
│         └─────────────────┼──────────────────────┘               │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                      Pathfinder                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │  A* Search  │  Path Executor  │  Movement Factory    │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           │                                      │
│  ┌────────────────────────▼───────────────────────────────────┐  │
│  │                 Calculation Context                         │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌───────────────────────┐ │  │
│  │  │ Block Data  │ │  Settings   │ │  Precomputed Data     │ │  │
│  │  └─────────────┘ └─────────────┘ └───────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Goals

A **Goal** defines where the bot should go. Goals are the fundamental target for pathfinding.

```typescript
interface Goal {
  // Check if a position satisfies the goal
  isInGoal(x: number, y: number, z: number): boolean;

  // Estimate cost to reach goal (heuristic for A*)
  heuristic(x: number, y: number, z: number): number;
}
```

Goals can be:
- **Static** - Fixed position (GoalBlock, GoalXZ)
- **Dynamic** - Moving target (GoalFollow)
- **Conditional** - Based on game state

See [Goals](./goals.md) for all goal types.

## Movements

A **Movement** is a single action that moves the bot from one position to another.

Each movement has:
- **Cost** - Time in game ticks (lower is better)
- **Preconditions** - What blocks/state is needed
- **Execution** - State machine to perform the move

```typescript
// Movement types
MovementTraverse    // Walk horizontally
MovementAscend      // Jump up 1 block
MovementDescend     // Drop down
MovementParkour     // Long jump (1-4 blocks)
MovementSwimUp      // Swim upward
// ... 20+ total movement types
```

See [Movements](./movements.md) for details.

## The A* Algorithm

Baritone-TS uses **A\*** (A-star) pathfinding with several optimizations:

1. **Tick-based costs** - Costs reflect actual game ticks
2. **7 coefficients** - Multiple heuristic weights for graceful degradation
3. **Lazy evaluation** - Nodes computed on-demand
4. **Movement skipping** - Skip already-completed movements

```typescript
// A* finds the lowest-cost path
// f(n) = g(n) + h(n)
// g(n) = actual cost from start
// h(n) = estimated cost to goal (heuristic)
```

## The Path Executor

Once A* finds a path, the **Path Executor** runs it:

1. Takes the path (list of movements)
2. Executes each movement's state machine
3. Handles interruptions (mobs, block changes)
4. Recalculates when needed

## Processes

**Processes** are high-level automation behaviors that control the pathfinder:

- **MineProcess** - Find and mine specific blocks
- **FollowProcess** - Follow an entity
- **FarmProcess** - Harvest and replant crops
- **CombatProcess** - Fight or flee from enemies
- **BuildProcess** - Build structures
- **GatherProcess** - Collect dropped items
- **ExploreProcess** - Explore unknown areas

Only one process can be active at a time. They handle the "what to do" while the pathfinder handles the "how to get there."

See [Processes](./processes.md) for details.

## Tasks

**Tasks** are hierarchical units of work for complex automation:

```
Task (composite)
├── Child Task 1
│   ├── Sub-task A
│   └── Sub-task B
└── Child Task 2
    └── Sub-task C
```

Tasks differ from processes:
- Tasks form a **tree** of subtasks
- Tasks have **completion criteria**
- Tasks handle **resource acquisition**

Example tasks:
- `MineOresTask` - Mine ores with tool management
- `CollectItemTask` - Get a specific item
- `CraftItemTask` - Craft an item with prerequisites

See [Tasks](./tasks.md) for details.

## Trackers

**Trackers** maintain cached information about the world:

- **BlockTracker** - Scan for specific block types
- **EntityTracker** - Track entities, projectiles, threats
- **ItemStorageTracker** - Track container contents

Trackers use lazy updates - they only recalculate when accessed.

See [Trackers](./trackers.md) for details.

## Calculation Context

The **CalculationContext** provides block data and settings to pathfinding:

```typescript
const ctx = bot.pathfinder.ctx;

// Check block properties
ctx.getBlock(x, y, z);
ctx.isPassable(x, y, z);
ctx.isClimbable(x, y, z);

// Access settings
ctx.settings.canDig;
ctx.settings.maxFallHeight;
```

## Events

Baritone-TS emits events on the bot object:

```typescript
bot.on('goal_reached', (goal) => {});
bot.on('path_update', (result) => {});
bot.on('path_reset', (reason) => {});
bot.on('path_stop', () => {});
```

See [Events](./events.md) for all events.

## Cost Model

All costs are measured in **game ticks** (1 tick = 50ms):

| Action | Ticks |
|--------|-------|
| Walk 1 block | 4.633 |
| Sprint 1 block | 3.564 |
| Jump | 2.5 |
| Break stone (diamond pick) | ~15 |
| Place block | ~4 |

This tick-accurate model ensures optimal paths based on real travel time.

## Summary

1. **Goals** define where to go
2. **A\*** finds the path
3. **Movements** are individual steps
4. **Path Executor** runs the path
5. **Processes** automate high-level behaviors
6. **Tasks** handle complex workflows
7. **Trackers** cache world state

Start with goals for basic navigation, use processes for automation, and tasks for complex bot behaviors.
