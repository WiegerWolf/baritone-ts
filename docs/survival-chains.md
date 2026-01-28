# Survival Chains

Survival chains are emergency behaviors that automatically activate when the bot is in danger. They handle food, fall protection, mob defense, and other survival needs.

## Overview

Baritone-TS includes 6 survival chains:

| Chain | Priority | Purpose |
|-------|----------|---------|
| **FoodChain** | 55 | Eat when hungry |
| **MLGBucketChain** | 100 | Water bucket for fall protection |
| **MobDefenseChain** | 100 | Flee or fight when threatened |
| **WorldSurvivalChain** | 100 | Escape lava/fire/suffocation |
| **DeathMenuChain** | 1000 | Handle respawn after death |
| **PlayerInteractionFixChain** | 50 | Fix stuck player interactions |

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

Automatically eats food when hunger is low. Uses a scoring algorithm to select the best food, optimizing for saturation and minimizing waste.

**Priority:** 55 (higher than user tasks, lower than danger)

```typescript
import { FoodChain } from 'baritone-ts';

const foodChain = new FoodChain(bot, {
  // When to eat
  eatWhenHunger: 14,           // Eat when hunger drops below this (0-20)

  // Food selection
  eatRottenFlesh: false,       // Allow eating rotten flesh
  rottenFleshPenalty: 5,       // Scoring penalty for rotten flesh

  // Scoring algorithm
  saturationMultiplier: 1.0,   // Weight for saturation in scoring
  wastePenalty: 0.5,           // Penalty for wasting food points

  // Timing
  eatCooldown: 1,              // Minimum seconds between eat attempts
});

// Check state
if (foodChain.needsToEat()) {
  console.log('Need to eat');
}

if (foodChain.urgentlyNeedsFood()) {
  console.log('Urgently need food!');
}

// Get food info
const availableFoods = foodChain.getAvailableFoods();
const bestFood = foodChain.selectBestFood();
const totalValue = foodChain.getTotalFoodValue();

// Debug info
console.log(foodChain.getDebugInfo());
```

### Food Scoring

The scoring algorithm considers:
1. Saturation value (weighted by saturationMultiplier)
2. Wasted hunger/saturation points (penalized)
3. Risky foods (rotten flesh, spider eye penalized)
4. Efficient eating bonus (when nearly full)
5. Low health bonus for high saturation

### Known Foods

Foods tracked with hunger and saturation values:
- **Best:** Golden carrot (14.4 sat), cooked beef (12.8), cooked porkchop (12.8)
- **Good:** Bread (6.0), baked potato (6.0), cooked salmon (9.6)
- **Emergency:** Rotten flesh (0.8 sat, hunger effect risk)

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

## WorldSurvivalChain

Escapes from environmental hazards like lava, fire, and suffocation.

**Priority:** 100 (danger level)

```typescript
import { WorldSurvivalChain, HazardType } from 'baritone-ts';

const survival = new WorldSurvivalChain(bot, {
  // Hazards to detect
  detectLava: true,
  detectFire: true,
  detectSuffocation: true,
  detectDrowning: true,

  // Response options
  useWaterBucket: true,    // Place water to escape lava
  breakBlocksToEscape: true, // Break blocks if suffocating

  // Escape settings
  escapeRadius: 10,        // How far to search for escape
  checkInterval: 100,      // Check frequency (ms)
});

// Hazard types
enum HazardType {
  LAVA,
  FIRE,
  SUFFOCATION,
  DROWNING,
  VOID
}

// Check current hazards
const hazards = survival.getActiveHazards();
for (const hazard of hazards) {
  console.log(`Hazard: ${HazardType[hazard]}`);
}
```

## DeathMenuChain

Handles respawning after player death.

**Priority:** 1000 (highest, always respawns)

```typescript
import { DeathMenuChain, DeathState } from 'baritone-ts';

const deathChain = new DeathMenuChain(bot, {
  // Auto-respawn behavior
  autoRespawn: true,           // Automatically respawn
  respawnDelay: 1000,          // Delay before respawn (ms)
  useSpawnPoint: true,         // Use bed spawn if available
});

// Death states
enum DeathState {
  ALIVE,
  DYING,
  DEAD,
  RESPAWNING,
  RESPAWNED
}

// Events
deathChain.on('death', () => {
  console.log('Player died');
});

deathChain.on('respawn', () => {
  console.log('Player respawned');
});
```

## PlayerInteractionFixChain

Fixes stuck player interactions (e.g., stuck in GUI, holding item).

**Priority:** 50 (low, only when stuck)

```typescript
import { PlayerInteractionFixChain } from 'baritone-ts';

const fixChain = new PlayerInteractionFixChain(bot, {
  // Detection settings
  stuckThreshold: 5000,       // Consider stuck after N ms
  checkInventory: true,       // Check for stuck inventory
  checkMovement: true,        // Check for stuck movement

  // Fix actions
  closeWindows: true,         // Close open windows
  releaseItems: true,         // Release held items
  cancelDigging: true,        // Cancel stuck digging
});
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
