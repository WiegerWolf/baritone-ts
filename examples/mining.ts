/**
 * Mining examples for baritone-ts
 *
 * Demonstrates: MineProcess for ore mining, inventory management with chest deposits
 */
import { createBot } from 'mineflayer';
import { pathfinder, MineProcess, GoalGetToBlock } from '../src';
import { Vec3 } from 'vec3';

// ============================================================================
// Basic Ore Miner
// ============================================================================

const bot = createBot({
  host: 'localhost',
  username: 'MinerBot',
});

bot.once('spawn', () => {
  pathfinder(bot, {
    canDig: true,
  });

  const miner = new MineProcess(bot, (bot as any).pathfinder, {
    blockNames: ['diamond_ore', 'deepslate_diamond_ore'],
    searchRadius: 64,
    collectDrops: true,
  });

  (bot as any).pathfinder.processManager.register('mine', miner);

  miner.on('block_mined', (block: any) => {
    console.log(`Mined ${block.name}!`);
  });

  miner.on('complete', () => {
    console.log('No more ores found');
  });
});

// Start mining on command
bot.on('chat', (username, message) => {
  if (message === 'mine') {
    (bot as any).pathfinder.processManager.activate('mine');
    bot.chat('Starting to mine diamonds!');
  }

  if (message === 'stop') {
    (bot as any).pathfinder.processManager.deactivate('mine');
    bot.chat('Stopped mining');
  }
});

// ============================================================================
// Multi-Ore Miner with Inventory Management
// ============================================================================

function createSmartMiner() {
  const smartBot = createBot({ host: 'localhost', username: 'SmartMiner' });

  let chestLocation: Vec3 | null = null;
  const INVENTORY_THRESHOLD = 30; // slots

  smartBot.once('spawn', () => {
    pathfinder(smartBot, { canDig: true });

    const miner = new MineProcess(smartBot, (smartBot as any).pathfinder, {
      blockNames: [
        'diamond_ore', 'deepslate_diamond_ore',
        'iron_ore', 'deepslate_iron_ore',
        'gold_ore', 'deepslate_gold_ore',
        'coal_ore', 'deepslate_coal_ore',
      ],
      searchRadius: 48,
      collectDrops: true,
    });

    (smartBot as any).pathfinder.processManager.register('mine', miner);

    // Check inventory after each block mined
    miner.on('block_mined', async () => {
      const usedSlots = smartBot.inventory.slots.filter((s: any) => s !== null).length;

      if (usedSlots >= INVENTORY_THRESHOLD && chestLocation) {
        console.log('Inventory nearly full, depositing...');
        (smartBot as any).pathfinder.processManager.deactivate('mine');
        await depositItems();
        (smartBot as any).pathfinder.processManager.activate('mine');
      }
    });
  });

  async function depositItems() {
    if (!chestLocation) return;

    await (smartBot as any).pathfinder.goto(
      new GoalGetToBlock(chestLocation.x, chestLocation.y, chestLocation.z),
    );

    const chest = await (smartBot as any).openContainer(smartBot.blockAt(chestLocation));

    for (const item of smartBot.inventory.items()) {
      if (['diamond', 'iron_ingot', 'gold_ingot', 'coal'].includes(item.name)) {
        await chest.deposit(item.type, null, item.count);
      }
    }

    chest.close();
  }

  smartBot.on('chat', (username, message) => {
    if (message === 'set chest') {
      const player = smartBot.players[username]?.entity;
      if (player) {
        const chest = smartBot.findBlock({
          matching: (smartBot as any).registry.blocksByName.chest.id,
          maxDistance: 5,
          point: player.position,
        });
        if (chest) {
          chestLocation = chest.position;
          smartBot.chat(`Chest set at ${chestLocation}`);
        }
      }
    }

    if (message === 'mine') {
      (smartBot as any).pathfinder.processManager.activate('mine');
    }
  });

  return smartBot;
}
