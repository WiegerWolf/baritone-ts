/**
 * Beat the Game — full speedrun bot for baritone-ts
 *
 * Automatically beats Minecraft from start to finish:
 * 1. Gather food, tools, and beds
 * 2. Enter the Nether, collect blaze rods and ender pearls
 * 3. Return to Overworld, locate the stronghold
 * 4. Open the end portal, set spawn, enter the End
 * 5. Kill the Ender Dragon
 *
 * Survival chains run in the background to keep the bot alive throughout.
 *
 * State machine phases:
 *   GETTING_FOOD → GETTING_GEAR → GETTING_BEDS → GOING_TO_NETHER →
 *   GETTING_BLAZE_RODS → GETTING_ENDER_PEARLS → LEAVING_NETHER →
 *   LOCATING_STRONGHOLD → OPENING_PORTAL → SETTING_SPAWN →
 *   ENTERING_END → FIGHTING_DRAGON → FINISHED
 */
import { createBot } from 'mineflayer';
import {
  pathfinder,
  createTaskRunner,
  BeatMinecraftTask,
  speedrunMinecraft,
  BeatMinecraftState,
  FoodChain,
  MobDefenseChain,
  MLGBucketChain,
  WorldSurvivalChain,
  DeathMenuChain,
  type TaskRunner,
} from '../src';

const bot = createBot({
  host: process.env.MC_HOST ?? 'localhost',
  port: Number(process.env.MC_PORT ?? 25565),
  version: process.env.MC_VERSION ?? '1.21.6',
  auth: 'offline',
  username: process.env.MC_USER ?? 'SpeedrunBot',
});

let runner: TaskRunner;
let beatTask: BeatMinecraftTask;

bot.once('spawn', () => {
  // Initialize pathfinder with all movement capabilities
  pathfinder(bot, {
    canDig: true,
    canPlace: true,
    allowParkour: true,
    allowWaterBucket: true,
  });

  // Create task runner (automatically creates a UserTaskChain)
  runner = createTaskRunner(bot);

  // Register survival chains so the bot stays alive.
  // Higher priority chains interrupt lower ones automatically.
  runner.registerChain(new DeathMenuChain(bot));          // priority 1000 — auto-respawn
  runner.registerChain(new WorldSurvivalChain(bot));       // priority  100 — escape lava/fire/drowning
  runner.registerChain(new MobDefenseChain(bot));                     // priority 100 — fight/flee mobs
  runner.registerChain(new MLGBucketChain(bot));           // priority  100 — water bucket clutch
  runner.registerChain(new FoodChain(bot, { eatWhenHunger: 14 }));   // priority   55 — auto-eat

  // Log chain switches
  runner.on('chain_changed', (newChain, oldChain) => {
    if (newChain) {
      console.log(`[Chain] ${oldChain?.displayName ?? 'none'} → ${newChain.displayName}`);
    }
  });

  // Set the main objective: beat the game
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

// --- Lifecycle ---

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
