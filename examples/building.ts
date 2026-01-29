/**
 * Building example for baritone-ts
 *
 * Demonstrates: BuildProcess for constructing structures with material collection
 */
import { createBot } from 'mineflayer';
import { pathfinder, BuildProcess } from '../src';

const bot = createBot({ host: 'localhost', username: 'BuilderBot' });

bot.once('spawn', () => {
  pathfinder(bot, {
    canDig: true,
    canPlace: true,
    scaffoldingBlocks: ['dirt', 'cobblestone'],
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
      ...BuildProcess.createFloor(pos.x, pos.y + 4, pos.z, 5, 5, 'oak_planks'),
    ];

    const builder = new BuildProcess(bot, (bot as any).pathfinder, {
      instructions,
      collectMaterials: true,
    });

    (bot as any).pathfinder.processManager.register('build', builder);
    (bot as any).pathfinder.processManager.activate('build');

    builder.on('progress', (placed: number, total: number) => {
      if (placed % 10 === 0) {
        bot.chat(`Building: ${placed}/${total}`);
      }
    });

    builder.on('complete', () => {
      bot.chat('House complete!');
    });
  }
});
