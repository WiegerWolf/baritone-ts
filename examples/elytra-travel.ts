/**
 * Elytra travel example for baritone-ts
 *
 * Demonstrates: ElytraController for long-distance flight with fireworks
 */
import { createBot } from 'mineflayer';
import { pathfinder, ElytraController, hasElytraEquipped } from '../src';
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

  const elytra = new ElytraController(bot, (bot as any).pathfinder.ctx, {
    useFireworks: true,
    cruiseAltitude: 100,
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
