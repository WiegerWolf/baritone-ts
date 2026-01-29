/**
 * Building example for baritone-ts
 *
 * Demonstrates: BuildProcess for constructing structures with material collection
 */
import { createBot } from 'mineflayer';
import { pathfinder, BuildProcess } from '../src';
import { Vec3 } from 'vec3';

const bot = createBot({ host: 'localhost', username: 'BuilderBot' });

bot.once('spawn', () => {
  pathfinder(bot, {
    canDig: true,
    canPlace: true,
  });
});

bot.on('chat', (username, message) => {
  if (message.startsWith('build house')) {
    const pos = bot.entity.position.floored();

    const builder = new BuildProcess(bot, (bot as any).pathfinder, {
      bottomToTop: true,
      correctMisplaced: true,
    });

    // Create floor and walls using instance methods
    const corner1 = new Vec3(pos.x, pos.y, pos.z);
    const corner2 = new Vec3(pos.x + 5, pos.y, pos.z + 5);
    builder.createFloor(corner1, corner2, 'oak_planks');

    const wallStart = new Vec3(pos.x, pos.y + 1, pos.z);
    const wallEnd = new Vec3(pos.x + 5, pos.y + 1, pos.z);
    builder.createWall(wallStart, wallEnd, 3, 'oak_planks');

    // Roof
    const roofCorner1 = new Vec3(pos.x, pos.y + 4, pos.z);
    const roofCorner2 = new Vec3(pos.x + 5, pos.y + 4, pos.z + 5);
    builder.createFloor(roofCorner1, roofCorner2, 'oak_planks');

    (bot as any).pathfinder.processManager.register('build', builder);
    (bot as any).pathfinder.processManager.activate('build');

    // Poll progress instead of using events
    const interval = setInterval(() => {
      const progress = builder.getProgress();
      if (progress.placed % 10 === 0 && progress.placed > 0) {
        bot.chat(`Building: ${progress.placed}/${progress.total}`);
      }
      if (progress.remaining === 0) {
        clearInterval(interval);
        bot.chat('House complete!');
      }
    }, 1000);
  }
});
