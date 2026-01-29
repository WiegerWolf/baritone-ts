# Examples

Runnable examples live in the [`examples/`](../examples/) folder. Each file is a self-contained bot you can run with `bun run examples/<file>.ts`.

| Example | File | What it demonstrates |
|---------|------|----------------------|
| [Basic Navigation](#basic-navigation) | [`basic.ts`](../examples/basic.ts) | Chat commands: goto, follow, near, runaway, stop |
| [Navigation](#navigation) | [`navigation.ts`](../examples/navigation.ts) | GoalBlock, GoalFollow, async goto, obstacle navigation |
| [Mining](#mining) | [`mining.ts`](../examples/mining.ts) | MineProcess, multi-ore mining, inventory management with chest deposits |
| [Follow & Guard](#follow--guard) | [`follow-and-guard.ts`](../examples/follow-and-guard.ts) | FollowProcess, CombatProcess, priority-based process management |
| [Farming](#farming) | [`farming.ts`](../examples/farming.ts) | FarmProcess with crop harvesting and replanting |
| [Task Automation](#task-automation) | [`task-automation.ts`](../examples/task-automation.ts) | TaskRunner, UserTaskChain, chaining tasks for resource gathering |
| [Survival](#survival) | [`survival.ts`](../examples/survival.ts) | TaskRunner with survival chains (food, mob defense, MLG, world survival) |
| [Elytra Travel](#elytra-travel) | [`elytra-travel.ts`](../examples/elytra-travel.ts) | ElytraController for long-distance flight with fireworks |
| [Building](#building) | [`building.ts`](../examples/building.ts) | BuildProcess for constructing structures |
| [Multiplayer](#multiplayer-mining-team) | [`multiplayer-mining-team.ts`](../examples/multiplayer-mining-team.ts) | Two-bot coordination: leader finds ores, helper navigates to them |
| [Beat the Game](#beat-the-game) | [`beat-the-game.ts`](../examples/beat-the-game.ts) | Full speedrun from spawn to Ender Dragon kill |
| [Benchmark](#benchmark) | [`benchmark-example.ts`](../examples/benchmark-example.ts) | Performance profiling utilities |

---

## Basic Navigation

**[`examples/basic.ts`](../examples/basic.ts)** — Chat-driven bot with commands for goto, follow, near, runaway, and stop. Good starting point for understanding the pathfinder plugin.

## Navigation

**[`examples/navigation.ts`](../examples/navigation.ts)** — Shows three navigation patterns:
- **Go to coordinates** with `GoalBlock`
- **Follow a player** with `GoalFollow` (dynamic goal)
- **Async goto** with error handling for obstacle navigation

## Mining

**[`examples/mining.ts`](../examples/mining.ts)** — Two mining bots:
- **Basic ore miner** — `MineProcess` for diamond mining with chat start/stop
- **Smart miner** — Multi-ore mining with automatic chest deposits when inventory fills up

## Follow & Guard

**[`examples/follow-and-guard.ts`](../examples/follow-and-guard.ts)** — Two patterns:
- **Basic follow** — `FollowProcess` that tracks a player
- **Guard bot** — `CombatProcess` (priority 100) + `FollowProcess` (priority 50) so combat interrupts following when mobs appear

## Farming

**[`examples/farming.ts`](../examples/farming.ts)** — `FarmProcess` that harvests mature wheat/carrots/potatoes, replants, and collects drops.

## Task Automation

**[`examples/task-automation.ts`](../examples/task-automation.ts)** — Uses the `TaskRunner` and `UserTaskChain` to run hierarchical tasks. Shows wood gathering and resource chain orchestration via chat commands.

## Survival

**[`examples/survival.ts`](../examples/survival.ts)** — `TaskRunner` with survival chains registered:
- **WorldSurvivalChain** — escape lava, fire, drowning
- **MobDefenseChain** — fight or flee hostile mobs
- **MLGBucketChain** — water bucket clutch on falls
- **FoodChain** — auto-eat when hungry

Higher-priority chains automatically interrupt lower-priority tasks like diamond mining.

## Elytra Travel

**[`examples/elytra-travel.ts`](../examples/elytra-travel.ts)** — `ElytraController` with firework rockets for long-distance flight. Chat command: `fly to <x> <z>`.

## Building

**[`examples/building.ts`](../examples/building.ts)** — `BuildProcess` that constructs a simple house (floor, walls, roof) from a blueprint with automatic material collection.

## Multiplayer Mining Team

**[`examples/multiplayer-mining-team.ts`](../examples/multiplayer-mining-team.ts)** — Two bots coordinating: the leader mines and whispers ore coordinates, the helper navigates to those positions.

## Beat the Game

**[`examples/beat-the-game.ts`](../examples/beat-the-game.ts)** — A bot that beats Minecraft from start to finish. Uses `BeatMinecraftTask` to orchestrate the entire run while survival chains keep it alive.

### State Machine

The `BeatMinecraftTask` progresses through these phases:

| Phase | State | What happens |
|-------|-------|-------------|
| 1 | `GETTING_FOOD` | Collect 180-220 hunger units of food |
| 2 | `GETTING_GEAR` | Craft tools, obtain iron/diamond gear |
| 3 | `GETTING_BEDS` | Craft 7-10 beds for the dragon fight |
| 4 | `GOING_TO_NETHER` | Build or find a nether portal, enter the Nether |
| 5 | `GETTING_BLAZE_RODS` | Locate a fortress, kill blazes for 7 rods |
| 6 | `GETTING_ENDER_PEARLS` | Hunt endermen or barter with piglins for 14 pearls |
| 7 | `LEAVING_NETHER` | Return to the Overworld |
| 8 | `LOCATING_STRONGHOLD` | Throw Eyes of Ender to triangulate the stronghold |
| 9 | `OPENING_PORTAL` | Place eyes in the end portal frame |
| 10 | `SETTING_SPAWN` | Place a bed near the portal and set spawn |
| 11 | `ENTERING_END` | Jump into the end portal |
| 12 | `FIGHTING_DRAGON` | Kill the Ender Dragon (melee + bed explosions) |
| 13 | `FINISHED` | Dragon defeated |

### Survival Chains

Throughout the run, these chains automatically interrupt the main task when needed:

| Chain | Priority | Trigger |
|-------|----------|---------|
| DeathMenuChain | 1000 | Bot dies — auto-respawn |
| WorldSurvivalChain | 100 | In lava, fire, drowning, or suffocating |
| MobDefenseChain | 100 | Hostile mob within range |
| MLGBucketChain | 100 | Falling from dangerous height |
| FoodChain | 55 | Hunger below threshold |

### Chat Commands

The example responds to these in-game messages:

- `status` — Print current state, health, food, and dimension
- `debug` — Print full TaskRunner debug info to console
- `stop` — Cancel the run
- `resume` — Restart from the beginning
- `speedrun` — Switch to aggressive settings (barter pearls, skip sleep, fewer beds)

### Configuration

Pass options to `BeatMinecraftTask` to customize behavior:

```typescript
new BeatMinecraftTask(bot, {
  barterPearlsInsteadOfEndermanHunt: true,  // Piglins instead of endermen
  sleepThroughNight: false,                  // Skip sleep for speed
  searchRuinedPortals: true,                 // Loot ruined portals
  searchDesertTemples: true,                 // Loot desert temples
  targetEyes: 14,                            // Eyes of Ender to collect
  minimumEyes: 12,                           // Min before stronghold search
  requiredBeds: 7,                           // Beds for dragon fight
  minFoodUnits: 180,                         // Minimum food buffer
  foodUnits: 220,                            // Target food to collect
  placeSpawnNearEndPortal: true,             // Set spawn before entering End
});
```

Or use the convenience functions:

```typescript
// Default balanced settings
const task = beatMinecraft(bot);

// Aggressive speedrun settings (barter, no sleep, fewer beds)
const task = speedrunMinecraft(bot);
```

## Benchmark

**[`examples/benchmark-example.ts`](../examples/benchmark-example.ts)** — Performance profiling utilities for measuring pathfinding speed.
