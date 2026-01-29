/**
 * Task-based automation example for baritone-ts
 *
 * Demonstrates: TaskRunner, UserTaskChain, chaining tasks for resource gathering
 */
import { createBot } from 'mineflayer';
import {
  pathfinder,
  TaskRunner,
  CollectWoodTask,
  MineOresTask,
  CraftTask,
} from '../src';

const bot = createBot({ host: 'localhost', username: 'TaskBot' });

bot.once('spawn', () => {
  pathfinder(bot, { canDig: true, canPlace: true });

  const runner = new TaskRunner(bot);

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
    runner.setUserTask(
      new CollectWoodTask(bot, {
        woodType: 'any',
        quantity: 32,
      }),
    );
    bot.chat('Getting wood!');
  }

  if (message === 'get iron') {
    // Chain: get wood -> make pick -> mine iron
    // Each task runs to completion before the next starts
    runner.setUserTask(
      new CollectWoodTask(bot, { woodType: 'any', quantity: 8 }),
    );
    bot.chat('Starting iron gathering expedition!');
  }

  if (message === 'status') {
    const chain = runner.getActiveChain();
    const task = chain?.getCurrentTask();
    if (task) {
      bot.chat(`Working on: ${task.displayName}`);
    } else {
      bot.chat('No active task');
    }
  }
});
