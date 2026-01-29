/**
 * Survival automation example for baritone-ts
 *
 * Demonstrates: TaskRunner with survival chains (food, mob defense, MLG, world survival)
 */
import { createBot } from 'mineflayer';
import {
  pathfinder,
  createTaskRunner,
  MineOresTask,
  FoodChain,
  MobDefenseChain,
  MLGBucketChain,
  WorldSurvivalChain,
} from '../src';

const bot = createBot({ host: 'localhost', username: 'SurvivalBot' });

bot.once('spawn', () => {
  pathfinder(bot, {
    canDig: true,
    canPlace: true,
    allowParkour: true,
    allowWaterBucket: true,
  });

  // Create runner and register survival chains
  const runner = createTaskRunner(bot);
  runner.registerChain(new WorldSurvivalChain(bot));
  runner.registerChain(new MobDefenseChain(bot, { mode: 'smart' }));
  runner.registerChain(new MLGBucketChain(bot));
  runner.registerChain(new FoodChain(bot));

  // Log chain switches
  runner.on('chain_changed', (newChain, oldChain) => {
    if (newChain) {
      console.log(
        `[Survival] ${oldChain?.displayName ?? 'none'} → ${newChain.displayName}`,
      );
    }
  });

  runner.start();
  (bot as any).runner = runner;
});

bot.on('chat', (username, message) => {
  const runner = (bot as any).runner;

  if (message === 'mine diamonds') {
    runner.setUserTask(
      new MineOresTask(bot, {
        targetOres: ['diamond_ore', 'deepslate_diamond_ore'],
        quantity: 10,
      }),
    );
    bot.chat('Mining diamonds with survival protection!');
  }
});
