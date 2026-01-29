/**
 * Farming example for baritone-ts
 *
 * Demonstrates: FarmProcess with crop harvesting, replanting, and chat commands
 */
import { createBot } from 'mineflayer';
import { pathfinder, FarmProcess } from '../src';

const bot = createBot({ host: 'localhost', username: 'FarmerBot' });

bot.once('spawn', () => {
  pathfinder(bot);

  const farmer = new FarmProcess(bot, (bot as any).pathfinder, {
    cropTypes: ['wheat', 'carrots', 'potatoes'],
    searchRadius: 32,
    replant: true,
    minGrowthStage: 7,
  });

  (bot as any).pathfinder.processManager.register('farm', farmer);

  // Poll progress
  setInterval(() => {
    console.log(`Harvested: ${farmer.getCropsHarvested()}, Planted: ${farmer.getCropsPlanted()}`);
  }, 10000);
});

bot.on('chat', (username, message) => {
  if (message === 'farm') {
    (bot as any).pathfinder.processManager.activate('farm');
    bot.chat('Starting farming!');
  }

  if (message === 'stop') {
    (bot as any).pathfinder.processManager.deactivate('farm');
    bot.chat('Stopped farming');
  }
});
