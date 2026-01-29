# Examples

Practical code examples for common use cases.

## Basic Navigation

### Go to Coordinates

```typescript
import { createBot } from 'mineflayer';
import { pathfinder, GoalBlock } from 'baritone-ts';

const bot = createBot({
  host: 'localhost',
  port: 25565,
  username: 'NavigationBot'
});

bot.once('spawn', () => {
  pathfinder(bot);

  // Navigate to specific coordinates
  bot.pathfinder.setGoal(new GoalBlock(100, 64, 100));
});

bot.on('goal_reached', () => {
  console.log('Arrived at destination!');
});
```

### Go to Player

```typescript
import { pathfinder, GoalFollow } from 'baritone-ts';

bot.once('spawn', () => {
  pathfinder(bot);
});

bot.on('chat', (username, message) => {
  if (message === 'come here') {
    const player = bot.players[username]?.entity;
    if (player) {
      bot.pathfinder.setGoal(new GoalFollow(player, 2), true);
      bot.chat(`Coming to you, ${username}!`);
    }
  }

  if (message === 'stop') {
    bot.pathfinder.stop();
    bot.chat('Stopped');
  }
});
```

### Navigate with Obstacles

```typescript
import { pathfinder, GoalBlock } from 'baritone-ts';

bot.once('spawn', () => {
  // Enable block breaking and placing for obstacles
  pathfinder(bot, {
    canDig: true,
    canPlace: true,
    scaffoldingBlocks: ['cobblestone', 'dirt'],
    allowParkour: true,
    maxFallHeight: 3
  });
});

async function goTo(x: number, y: number, z: number) {
  try {
    await bot.pathfinder.goto(new GoalBlock(x, y, z));
    console.log(`Arrived at ${x}, ${y}, ${z}`);
  } catch (error) {
    console.log(`Could not reach ${x}, ${y}, ${z}:`, error.message);
  }
}
```

## Mining Bot

### Basic Ore Miner

```typescript
import { createBot } from 'mineflayer';
import { pathfinder, MineProcess } from 'baritone-ts';

const bot = createBot({
  host: 'localhost',
  username: 'MinerBot'
});

bot.once('spawn', () => {
  pathfinder(bot, {
    canDig: true
  });

  const miner = new MineProcess(bot, bot.pathfinder, {
    blockNames: ['diamond_ore', 'deepslate_diamond_ore'],
    searchRadius: 64,
    collectDrops: true
  });

  bot.pathfinder.processManager.register('mine', miner);

  miner.on('block_mined', (block) => {
    console.log(`Mined ${block.name}!`);
  });

  miner.on('complete', () => {
    console.log('No more ores found');
  });
});

// Start mining on command
bot.on('chat', (username, message) => {
  if (message === 'mine') {
    bot.pathfinder.processManager.activate('mine');
    bot.chat('Starting to mine diamonds!');
  }

  if (message === 'stop') {
    bot.pathfinder.processManager.deactivate('mine');
    bot.chat('Stopped mining');
  }
});
```

### Multi-Ore Miner with Inventory Management

```typescript
import { createBot } from 'mineflayer';
import { pathfinder, MineProcess, GoalGetToBlock } from 'baritone-ts';

const bot = createBot({ host: 'localhost', username: 'SmartMiner' });

let chestLocation: Vec3 | null = null;
const INVENTORY_THRESHOLD = 30; // slots

bot.once('spawn', () => {
  pathfinder(bot, { canDig: true });

  const miner = new MineProcess(bot, bot.pathfinder, {
    blockNames: [
      'diamond_ore', 'deepslate_diamond_ore',
      'iron_ore', 'deepslate_iron_ore',
      'gold_ore', 'deepslate_gold_ore',
      'coal_ore', 'deepslate_coal_ore'
    ],
    searchRadius: 48,
    collectDrops: true
  });

  bot.pathfinder.processManager.register('mine', miner);

  // Check inventory after each block mined
  miner.on('block_mined', async () => {
    const usedSlots = bot.inventory.slots.filter(s => s !== null).length;

    if (usedSlots >= INVENTORY_THRESHOLD && chestLocation) {
      console.log('Inventory nearly full, depositing...');
      bot.pathfinder.processManager.deactivate('mine');
      await depositItems();
      bot.pathfinder.processManager.activate('mine');
    }
  });
});

async function depositItems() {
  if (!chestLocation) return;

  await bot.pathfinder.goto(new GoalGetToBlock(
    chestLocation.x, chestLocation.y, chestLocation.z
  ));

  const chest = await bot.openContainer(bot.blockAt(chestLocation));

  for (const item of bot.inventory.items()) {
    if (['diamond', 'iron_ingot', 'gold_ingot', 'coal'].includes(item.name)) {
      await chest.deposit(item.type, null, item.count);
    }
  }

  chest.close();
}

bot.on('chat', (username, message) => {
  if (message === 'set chest') {
    const player = bot.players[username]?.entity;
    if (player) {
      // Find chest near player
      const chest = bot.findBlock({
        matching: bot.registry.blocksByName.chest.id,
        maxDistance: 5,
        point: player.position
      });
      if (chest) {
        chestLocation = chest.position;
        bot.chat(`Chest set at ${chestLocation}`);
      }
    }
  }

  if (message === 'mine') {
    bot.pathfinder.processManager.activate('mine');
  }
});
```

## Following Bot

### Basic Follow

```typescript
import { createBot } from 'mineflayer';
import { pathfinder, FollowProcess } from 'baritone-ts';

const bot = createBot({ host: 'localhost', username: 'FollowerBot' });

bot.once('spawn', () => {
  pathfinder(bot);
});

bot.on('chat', (username, message) => {
  if (message === 'follow me') {
    const player = bot.players[username]?.entity;
    if (!player) {
      bot.chat("I can't see you!");
      return;
    }

    const follower = new FollowProcess(bot, bot.pathfinder, {
      target: player,
      minDistance: 2,
      maxDistance: 4,
      sprint: true
    });

    bot.pathfinder.processManager.register('follow', follower);
    bot.pathfinder.processManager.activate('follow');
    bot.chat(`Following ${username}!`);
  }

  if (message === 'stay') {
    bot.pathfinder.processManager.deactivate('follow');
    bot.chat('Staying here');
  }
});
```

### Guard Bot (Follow + Combat)

```typescript
import { createBot } from 'mineflayer';
import { pathfinder, FollowProcess, CombatProcess } from 'baritone-ts';

const bot = createBot({ host: 'localhost', username: 'GuardBot' });

bot.once('spawn', () => {
  pathfinder(bot);

  // Combat has higher priority
  const combat = new CombatProcess(bot, bot.pathfinder, {
    mode: 'attack',
    targetTypes: ['zombie', 'skeleton', 'spider', 'creeper'],
    attackRange: 3.5,
    useShield: true
  });

  bot.pathfinder.processManager.register('combat', combat, { priority: 100 });
  bot.pathfinder.processManager.activate('combat');

  combat.on('target_killed', (entity) => {
    bot.chat(`Killed ${entity.name}!`);
  });
});

bot.on('chat', (username, message) => {
  if (message === 'guard me') {
    const player = bot.players[username]?.entity;
    if (!player) return;

    const follower = new FollowProcess(bot, bot.pathfinder, {
      target: player,
      minDistance: 2,
      maxDistance: 5
    });

    bot.pathfinder.processManager.register('follow', follower, { priority: 50 });
    bot.pathfinder.processManager.activate('follow');
    bot.chat(`Guarding ${username}. Stay close!`);
  }
});
```

## Farming Bot

### Automatic Farmer

```typescript
import { createBot } from 'mineflayer';
import { pathfinder, FarmProcess } from 'baritone-ts';

const bot = createBot({ host: 'localhost', username: 'FarmerBot' });

bot.once('spawn', () => {
  pathfinder(bot);

  const farmer = new FarmProcess(bot, bot.pathfinder, {
    cropTypes: ['wheat', 'carrots', 'potatoes'],
    searchRadius: 32,
    replant: true,
    harvestOnlyMature: true,
    collectDrops: true
  });

  bot.pathfinder.processManager.register('farm', farmer);

  farmer.on('crop_harvested', (block) => {
    console.log(`Harvested ${block.name}`);
  });

  farmer.on('crop_planted', (pos, type) => {
    console.log(`Planted ${type}`);
  });
});

bot.on('chat', (username, message) => {
  if (message === 'farm') {
    bot.pathfinder.processManager.activate('farm');
    bot.chat('Starting farming!');
  }

  if (message === 'stop') {
    bot.pathfinder.processManager.deactivate('farm');
    bot.chat('Stopped farming');
  }
});
```

## Task-Based Automation

### Gather Resources Task

```typescript
import { createBot } from 'mineflayer';
import { pathfinder, TaskRunner, TaskChain, GatherWoodTask, MineOresTask, CraftItemTask } from 'baritone-ts';

const bot = createBot({ host: 'localhost', username: 'TaskBot' });

bot.once('spawn', () => {
  pathfinder(bot, { canDig: true, canPlace: true });

  const runner = new TaskRunner(bot, bot.pathfinder);

  // Tick the runner
  bot.on('physicsTick', () => {
    runner.tick();
  });

  // Store runner for commands
  (bot as any).taskRunner = runner;
});

bot.on('chat', (username, message) => {
  const runner = (bot as any).taskRunner as TaskRunner;

  if (message === 'get wood') {
    runner.setTask(new GatherWoodTask(bot, {
      woodType: 'any',
      quantity: 32
    }));
    bot.chat('Getting wood!');
  }

  if (message === 'get iron') {
    // Chain: get wood -> make pick -> mine iron
    runner.setTask(new TaskChain(bot, [
      new GatherWoodTask(bot, { woodType: 'any', quantity: 8 }),
      new CraftItemTask(bot, { itemName: 'crafting_table', quantity: 1 }),
      new CraftItemTask(bot, { itemName: 'wooden_pickaxe', quantity: 1 }),
      new MineOresTask(bot, { targetOres: ['stone'], quantity: 3 }),
      new CraftItemTask(bot, { itemName: 'stone_pickaxe', quantity: 1 }),
      new MineOresTask(bot, { targetOres: ['iron_ore'], quantity: 10 })
    ]));
    bot.chat('Starting iron gathering expedition!');
  }

  if (message === 'status') {
    if (runner.isComplete()) {
      bot.chat('No active task');
    } else {
      bot.chat(`Working on: ${runner.getCurrentTask()?.name || 'unknown'}`);
    }
  }
});
```

## Survival Bot

### Full Survival Automation

```typescript
import { createBot } from 'mineflayer';
import { pathfinder, WorldSurvivalChain, TaskRunner, MineOresTask } from 'baritone-ts';

const bot = createBot({ host: 'localhost', username: 'SurvivalBot' });

bot.once('spawn', () => {
  pathfinder(bot, {
    canDig: true,
    canPlace: true,
    allowParkour: true,
    allowWaterBucket: true
  });

  // Enable survival features
  const survival = new WorldSurvivalChain(bot, bot.pathfinder, {
    food: true,
    mlg: true,
    mobDefense: true,
    armor: true,
    health: true,
    fire: true,
    defenseOptions: { mode: 'smart' }
  });
  survival.enable();

  // Set up task runner
  const runner = new TaskRunner(bot, bot.pathfinder);
  survival.setTaskRunner(runner);

  // Log survival actions
  survival.on('action', (action, chain) => {
    console.log(`[Survival] ${chain}: ${action}`);
  });

  survival.on('fleeing', (threat) => {
    bot.chat(`Running from ${threat.name}!`);
  });

  // Tick runner
  bot.on('physicsTick', () => {
    runner.tick();
  });

  (bot as any).runner = runner;
});

bot.on('chat', (username, message) => {
  const runner = (bot as any).runner as TaskRunner;

  if (message === 'mine diamonds') {
    runner.setTask(new MineOresTask(bot, {
      targetOres: ['diamond_ore', 'deepslate_diamond_ore'],
      quantity: 10
    }));
    bot.chat('Mining diamonds with survival protection!');
  }
});
```

## Long Distance Travel

### Elytra Travel

```typescript
import { createBot } from 'mineflayer';
import { pathfinder, ElytraController, hasElytraEquipped } from 'baritone-ts';
import { Vec3 } from 'vec3';

const bot = createBot({ host: 'localhost', username: 'ElytraBot' });

bot.once('spawn', () => {
  pathfinder(bot);
});

bot.on('chat', async (username, message) => {
  const match = message.match(/^fly to (-?\d+) (-?\d+)$/);
  if (!match) return;

  if (!hasElytraEquipped(bot)) {
    bot.chat("I don't have an elytra equipped!");
    return;
  }

  const [, x, z] = match.map(Number);
  const destination = new Vec3(x, 100, z);

  bot.chat(`Flying to ${x}, ${z}...`);

  const elytra = new ElytraController(bot, bot.pathfinder.ctx, {
    useFireworks: true,
    cruiseAltitude: 100
  });

  if (elytra.startFlight(destination)) {
    const interval = setInterval(() => {
      if (elytra.tick()) {
        clearInterval(interval);
        bot.chat('Arrived!');
      }
    }, 50);
  } else {
    bot.chat("Couldn't take off!");
  }
});
```

## Building Bot

### Simple Structure Builder

```typescript
import { createBot } from 'mineflayer';
import { pathfinder, BuildProcess } from 'baritone-ts';

const bot = createBot({ host: 'localhost', username: 'BuilderBot' });

bot.once('spawn', () => {
  pathfinder(bot, {
    canDig: true,
    canPlace: true,
    scaffoldingBlocks: ['dirt', 'cobblestone']
  });
});

bot.on('chat', (username, message) => {
  if (message.startsWith('build house')) {
    const pos = bot.entity.position.floored();

    // Create simple house blueprint
    const instructions = [
      // Floor
      ...BuildProcess.createFloor(pos.x, pos.y, pos.z, 5, 5, 'oak_planks'),
      // Walls
      ...BuildProcess.createWalls(pos.x, pos.y + 1, pos.z, 5, 3, 5, 'oak_planks'),
      // Roof
      ...BuildProcess.createFloor(pos.x, pos.y + 4, pos.z, 5, 5, 'oak_planks')
    ];

    const builder = new BuildProcess(bot, bot.pathfinder, {
      instructions,
      collectMaterials: true
    });

    bot.pathfinder.processManager.register('build', builder);
    bot.pathfinder.processManager.activate('build');

    builder.on('progress', (placed, total) => {
      if (placed % 10 === 0) {
        bot.chat(`Building: ${placed}/${total}`);
      }
    });

    builder.on('complete', () => {
      bot.chat('House complete!');
    });
  }
});
```

## Multiplayer Coordination

### Two-Bot Mining Team

```typescript
// Leader bot
const leader = createBot({ host: 'localhost', username: 'MineLeader' });

leader.once('spawn', () => {
  pathfinder(leader);

  // Mine and share coordinates
  const miner = new MineProcess(leader, leader.pathfinder, {
    blockNames: ['diamond_ore'],
    searchRadius: 32
  });

  miner.on('block_found', (block) => {
    // Tell follower about ore
    leader.chat(`/msg MineHelper found ${block.position.x} ${block.position.y} ${block.position.z}`);
  });
});

// Helper bot
const helper = createBot({ host: 'localhost', username: 'MineHelper' });

helper.once('spawn', () => {
  pathfinder(helper);
});

helper.on('whisper', (username, message) => {
  if (username === 'MineLeader' && message.startsWith('found')) {
    const [, x, y, z] = message.split(' ').map(Number);
    helper.pathfinder.setGoal(new GoalGetToBlock(x, y, z));
  }
});
```

## Beat the Game Bot

A bot that beats Minecraft from start to finish: gather resources, enter the Nether, collect blaze rods and ender pearls, locate the stronghold, and kill the Ender Dragon.

### Minimal Setup

```typescript
import { createBot } from 'mineflayer';
import {
  pathfinder,
  createTaskRunner,
  BeatMinecraftTask,
  FoodChain,
  MobDefenseChain,
  MLGBucketChain,
  WorldSurvivalChain,
  DeathMenuChain,
  BeatMinecraftState,
} from 'baritone-ts';

const bot = createBot({
  host: 'localhost',
  port: 25565,
  username: 'SpeedrunBot',
});

bot.once('spawn', () => {
  // Initialize pathfinder with all movement capabilities
  pathfinder(bot, {
    canDig: true,
    canPlace: true,
    allowParkour: true,
    allowWaterBucket: true,
    maxFallHeight: 3,
    scaffoldingBlocks: ['cobblestone', 'dirt', 'netherrack'],
  });

  // Create task runner (automatically creates a UserTaskChain)
  const runner = createTaskRunner(bot);

  // Register survival chains so the bot stays alive
  runner.registerChain(new DeathMenuChain(bot));        // Auto-respawn (priority 1000)
  runner.registerChain(new WorldSurvivalChain(bot));     // Escape lava/fire (priority 100)
  runner.registerChain(new MobDefenseChain(bot));        // Fight/flee mobs (priority 100)
  runner.registerChain(new MLGBucketChain(bot));         // Water bucket clutch (priority 100)
  runner.registerChain(new FoodChain(bot));              // Auto-eat (priority 55)

  // Set the main objective: beat the game
  runner.setUserTask(new BeatMinecraftTask(bot));

  // Start ticking
  runner.start();

  console.log('Bot spawned — beating Minecraft!');
});
```

### Full Example with Logging and Chat Commands

```typescript
import { createBot } from 'mineflayer';
import {
  pathfinder,
  createTaskRunner,
  BeatMinecraftTask,
  beatMinecraft,
  speedrunMinecraft,
  BeatMinecraftState,
  FoodChain,
  MobDefenseChain,
  MLGBucketChain,
  WorldSurvivalChain,
  DeathMenuChain,
  type TaskRunner,
} from 'baritone-ts';

const bot = createBot({
  host: process.env.MC_HOST ?? 'localhost',
  port: Number(process.env.MC_PORT ?? 25565),
  username: process.env.MC_USER ?? 'SpeedrunBot',
});

let runner: TaskRunner;
let beatTask: BeatMinecraftTask;

bot.once('spawn', () => {
  pathfinder(bot, {
    canDig: true,
    canPlace: true,
    allowParkour: true,
    allowWaterBucket: true,
    maxFallHeight: 3,
    scaffoldingBlocks: ['cobblestone', 'dirt', 'netherrack'],
  });

  runner = createTaskRunner(bot);

  // Survival chains (highest priority interrupts lower)
  runner.registerChain(new DeathMenuChain(bot));
  runner.registerChain(new WorldSurvivalChain(bot));
  runner.registerChain(new MobDefenseChain(bot, { mode: 'smart' }));
  runner.registerChain(new MLGBucketChain(bot));
  runner.registerChain(new FoodChain(bot, { minHunger: 14 }));

  // Log chain switches
  runner.on('chain_changed', (newChain, oldChain) => {
    if (newChain) {
      console.log(`[Chain] ${oldChain?.displayName ?? 'none'} → ${newChain.displayName}`);
    }
  });

  // Start with the default beat-the-game config
  beatTask = new BeatMinecraftTask(bot);
  runner.setUserTask(beatTask);
  runner.start();

  console.log('Bot spawned — starting speedrun');
});

// --- Chat commands ---

bot.on('chat', (username, message) => {
  if (username === bot.username) return;

  switch (message) {
    case 'status': {
      const state = BeatMinecraftState[beatTask.getState()];
      const health = Math.round(bot.health);
      const food = bot.food;
      const dim = (bot as any).game?.dimension ?? 'overworld';
      bot.chat(`[${state}] HP:${health} Food:${food} Dim:${dim}`);
      break;
    }

    case 'debug':
      console.log(runner.getDebugInfo());
      break;

    case 'stop':
      runner.cancelUserTask();
      bot.chat('Speedrun cancelled');
      break;

    case 'resume':
      beatTask = new BeatMinecraftTask(bot);
      runner.setUserTask(beatTask);
      bot.chat('Resuming speedrun');
      break;

    case 'speedrun':
      // Aggressive settings: barter pearls, skip sleep, fewer beds
      beatTask = speedrunMinecraft(bot);
      runner.setUserTask(beatTask);
      bot.chat('Speedrun mode activated');
      break;
  }
});

// --- Lifecycle events ---

bot.on('death', () => {
  console.log('[Death] Bot died — DeathMenuChain will auto-respawn');
});

bot.on('end', (reason) => {
  console.log(`Disconnected: ${reason}`);
  runner?.stop();
});

bot.on('error', (err) => {
  console.error('Bot error:', err);
});
```

### Custom Configuration

```typescript
import { createBot } from 'mineflayer';
import {
  pathfinder,
  createTaskRunner,
  BeatMinecraftTask,
  FoodChain,
  MobDefenseChain,
  MLGBucketChain,
  WorldSurvivalChain,
  DeathMenuChain,
} from 'baritone-ts';

const bot = createBot({ host: 'localhost', username: 'CustomBot' });

bot.once('spawn', () => {
  pathfinder(bot, { canDig: true, canPlace: true, allowParkour: true, allowWaterBucket: true });

  const runner = createTaskRunner(bot);
  runner.registerChain(new DeathMenuChain(bot));
  runner.registerChain(new WorldSurvivalChain(bot));
  runner.registerChain(new MobDefenseChain(bot));
  runner.registerChain(new MLGBucketChain(bot));
  runner.registerChain(new FoodChain(bot));

  const task = new BeatMinecraftTask(bot, {
    // Barter with piglins for ender pearls instead of hunting endermen
    barterPearlsInsteadOfEndermanHunt: true,
    // Don't waste time sleeping
    sleepThroughNight: false,
    // Loot ruined portals and desert temples for bonus gear
    searchRuinedPortals: true,
    searchDesertTemples: true,
    // Collect extra eyes in case some break
    targetEyes: 14,
    minimumEyes: 12,
    // Beds for the dragon fight (bed explosions deal massive damage in the End)
    requiredBeds: 7,
    // Food buffer
    minFoodUnits: 180,
    foodUnits: 220,
    // Set spawn near end portal so death doesn't reset progress
    placeSpawnNearEndPortal: true,
  });

  runner.setUserTask(task);
  runner.start();
});
```

### How It Works

The `BeatMinecraftTask` runs a state machine through these phases:

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

Throughout the run, survival chains automatically interrupt when needed:
- **DeathMenuChain** (priority 1000) auto-respawns the bot on death
- **WorldSurvivalChain** (priority 100) escapes lava, fire, and drowning
- **MobDefenseChain** (priority 100) fights or flees hostile mobs
- **MLGBucketChain** (priority 100) water-bucket clutches dangerous falls
- **FoodChain** (priority 55) eats when hunger drops
