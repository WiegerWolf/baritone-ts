# Survival Chains

Survival chains are emergency behaviors that automatically activate when the bot is in danger. They handle food, fall protection, mob defense, and other survival needs.

## Overview

Baritone-TS includes 7 survival chains:

| Chain | Purpose |
|-------|---------|
| **FoodChain** | Eat when hungry |
| **MLGBucketChain** | Water bucket for fall protection |
| **MobDefenseChain** | Flee or fight when threatened |
| **ArmorEquipChain** | Keep armor equipped |
| **HealthChain** | Use healing items when low health |
| **FireChain** | Escape from fire/lava |
| **WorldSurvivalChain** | Combined survival handling |

## Enabling Survival Chains

```typescript
import { pathfinder, WorldSurvivalChain } from 'baritone-ts';

pathfinder(bot);

// Enable all survival features
const survivalChain = new WorldSurvivalChain(bot, bot.pathfinder);
survivalChain.enable();

// Or enable individual chains
import { FoodChain, MLGBucketChain } from 'baritone-ts';

const foodChain = new FoodChain(bot);
foodChain.enable();

const mlgChain = new MLGBucketChain(bot);
mlgChain.enable();
```

## FoodChain

Automatically eats food when hunger is low.

```typescript
import { FoodChain } from 'baritone-ts';

const foodChain = new FoodChain(bot, {
  // When to eat
  minHunger: 6,           // Eat when hunger drops below this (0-20)
  minSaturation: 1,       // Or when saturation is low

  // What to eat
  preferredFoods: [
    'golden_apple',
    'cooked_beef',
    'cooked_porkchop',
    'bread'
  ],
  avoidFoods: [
    'rotten_flesh',
    'spider_eye',
    'poisonous_potato'
  ],

  // Behavior
  interruptTasks: true,   // Pause tasks while eating
  craftFood: false,       // Don't craft food automatically
});

foodChain.enable();

// Events
foodChain.on('eating', (food) => {
  console.log(`Eating ${food.name}`);
});

foodChain.on('low_food', () => {
  console.log('Running low on food!');
});
```

### Food Priority

By default, foods are prioritized:
1. Golden apples (emergency healing)
2. Cooked meats (high saturation)
3. Bread, carrots, potatoes
4. Raw foods (last resort)

## MLGBucketChain

Uses water bucket to survive long falls.

```typescript
import { MLGBucketChain } from 'baritone-ts';

const mlgChain = new MLGBucketChain(bot, {
  // When to activate
  minFallHeight: 4,       // Minimum fall to trigger (blocks)
  activationTime: 10,     // Ticks before landing to place water

  // Requirements
  requireWaterBucket: true,  // Must have water bucket

  // Behavior
  pickupWater: true,      // Pick up water after landing
  lookAtGround: true,     // Look down during fall
});

mlgChain.enable();

// Events
mlgChain.on('mlg_triggered', () => {
  console.log('Placing water bucket!');
});

mlgChain.on('mlg_success', () => {
  console.log('Survived fall!');
});

mlgChain.on('mlg_failed', () => {
  console.log('MLG failed!');
});
```

### How It Works

1. Detects when bot is falling
2. Calculates time until landing
3. Equips water bucket
4. Looks down at landing spot
5. Places water just before impact
6. Picks up water after landing

## MobDefenseChain

Handles hostile mob encounters.

```typescript
import { MobDefenseChain } from 'baritone-ts';

const defenseChain = new MobDefenseChain(bot, {
  // Threat detection
  threatRadius: 16,       // Range to detect threats
  threatTypes: [
    'zombie', 'skeleton', 'creeper', 'spider',
    'enderman', 'witch', 'pillager'
  ],

  // Response mode
  mode: 'flee',           // 'flee' | 'fight' | 'smart'

  // Flee settings
  fleeDistance: 30,       // How far to run
  fleePriority: 100,      // Interrupt other tasks

  // Fight settings
  fightWhenCornered: true,  // Fight if can't flee
  useShield: true,
  useBow: true,

  // Smart mode
  healthThreshold: 10,    // Fight if health above this
  armorThreshold: 10,     // Fight if armor points above this
});

defenseChain.enable();

// Events
defenseChain.on('threat_detected', (entity) => {
  console.log(`Detected threat: ${entity.name}`);
});

defenseChain.on('fleeing', () => {
  console.log('Running away!');
});

defenseChain.on('fighting', (entity) => {
  console.log(`Fighting ${entity.name}`);
});
```

### Defense Modes

**Flee**: Always run away from threats
```typescript
defenseChain.setMode('flee');
```

**Fight**: Always engage threats
```typescript
defenseChain.setMode('fight');
```

**Smart**: Decide based on health, armor, and situation
```typescript
defenseChain.setMode('smart');
// Will flee from creepers, fight single zombies, etc.
```

## ArmorEquipChain

Keeps best armor equipped.

```typescript
import { ArmorEquipChain } from 'baritone-ts';

const armorChain = new ArmorEquipChain(bot, {
  // Priority (higher = better)
  armorPriority: [
    'netherite',
    'diamond',
    'iron',
    'chainmail',
    'gold',
    'leather'
  ],

  // When to equip
  autoEquip: true,        // Equip when inventory changes
  checkInterval: 1000,    // Check every N ms

  // What to prioritize
  preferEnchanted: true,  // Prefer enchanted armor
  preferUnbreaking: true, // Prefer durability
  preferProtection: true, // Prefer protection enchants
});

armorChain.enable();
```

## HealthChain

Uses healing items when health is low.

```typescript
import { HealthChain } from 'baritone-ts';

const healthChain = new HealthChain(bot, {
  // When to heal
  criticalHealth: 6,      // Use any healing below this
  lowHealth: 10,          // Use non-critical healing

  // Healing items (in priority order)
  healingItems: [
    'enchanted_golden_apple',  // Critical only
    'golden_apple',
    'potion',                   // Any healing potion
    'cooked_beef'               // Food as last resort
  ],

  // Behavior
  useTotems: true,        // Equip totem in off-hand
  drinkMilk: true,        // Use milk to clear bad effects
});

healthChain.enable();

// Events
healthChain.on('low_health', (health) => {
  console.log(`Health low: ${health}`);
});

healthChain.on('healing', (item) => {
  console.log(`Using ${item.name}`);
});
```

## FireChain

Escapes from fire and lava.

```typescript
import { FireChain } from 'baritone-ts';

const fireChain = new FireChain(bot, {
  // Detection
  detectFire: true,
  detectLava: true,
  detectMagma: true,

  // Response
  fleeDistance: 10,       // How far to run
  useWater: true,         // Place water to extinguish

  // Priority
  priority: 200,          // Very high priority
});

fireChain.enable();
```

## WorldSurvivalChain

Combined chain that includes all survival behaviors.

```typescript
import { WorldSurvivalChain } from 'baritone-ts';

const survival = new WorldSurvivalChain(bot, bot.pathfinder, {
  // Enable/disable individual features
  food: true,
  mlg: true,
  mobDefense: true,
  armor: true,
  health: true,
  fire: true,

  // Food settings
  foodOptions: {
    minHunger: 6,
    preferredFoods: ['cooked_beef', 'bread']
  },

  // Defense settings
  defenseOptions: {
    mode: 'smart',
    threatRadius: 16
  },

  // MLG settings
  mlgOptions: {
    minFallHeight: 4
  },

  // Health settings
  healthOptions: {
    criticalHealth: 6
  }
});

survival.enable();

// Disable specific feature
survival.disableFeature('mobDefense');

// Re-enable
survival.enableFeature('mobDefense');
```

## Chain Priority

When multiple chains want to act, priority determines which one wins:

```typescript
// Default priorities (higher = more important)
const PRIORITIES = {
  fire: 200,        // Highest - escape fire immediately
  mlg: 150,         // Fall protection
  health: 100,      // Healing
  mobDefense: 90,   // Mob avoidance
  food: 50,         // Eating
  armor: 10         // Lowest - can wait
};
```

## Integration with Tasks

Survival chains can interrupt tasks:

```typescript
const runner = new TaskRunner(bot, bot.pathfinder);
const survival = new WorldSurvivalChain(bot, bot.pathfinder);

// Survival interrupts tasks when needed
survival.setTaskRunner(runner);

runner.setTask(new MineOresTask(bot, { targetOres: ['diamond_ore'] }));

// If health gets low, survival chain pauses mining,
// heals, then resumes mining
```

## Custom Survival Chains

Create custom survival behaviors:

```typescript
import { SurvivalChain, ChainPriority } from 'baritone-ts';

class MyChain extends SurvivalChain {
  priority = ChainPriority.MEDIUM;

  shouldActivate(): boolean {
    // Check if this chain should trigger
    return this.bot.health < 10 && this.hasItem('golden_apple');
  }

  tick(): ChainStatus {
    // Execute survival behavior
    if (this.isEating) {
      return ChainStatus.ACTIVE;
    }

    this.eatGoldenApple();
    return ChainStatus.ACTIVE;
  }

  onDeactivate(): void {
    // Cleanup when chain finishes
  }
}
```

## Events

All chains emit events:

```typescript
chain.on('activated', () => {
  console.log('Chain activated');
});

chain.on('deactivated', () => {
  console.log('Chain deactivated');
});

chain.on('action', (action) => {
  console.log(`Performing: ${action}`);
});
```

## Example: Full Survival Bot

```typescript
import { createBot } from 'mineflayer';
import { pathfinder, WorldSurvivalChain, TaskRunner, MineOresTask } from 'baritone-ts';

const bot = createBot({ host: 'localhost', username: 'SurvivalBot' });

bot.once('spawn', () => {
  pathfinder(bot);

  // Enable all survival features
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

  // Start mining - survival will protect the bot
  runner.setTask(new MineOresTask(bot, {
    targetOres: ['diamond_ore', 'iron_ore'],
    quantity: 20
  }));

  bot.on('physicsTick', () => {
    runner.tick();
  });

  // Log survival actions
  survival.on('action', (action, chain) => {
    console.log(`[Survival] ${chain.name}: ${action}`);
  });
});
```
