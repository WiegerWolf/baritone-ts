# Configuration

Baritone-TS offers extensive configuration options organized into categories for pathfinding, combat, food, safety, mining, storage, and miscellaneous settings.

## Settings Structure

Settings are organized into the `BotSettings` interface:

```typescript
import { BotSettings, DEFAULT_SETTINGS, mergeSettings } from 'baritone-ts';

const customSettings = mergeSettings(DEFAULT_SETTINGS, {
  pathfinding: { avoidLava: true },
  combat: { attackHostiles: true },
  food: { eatWhenHunger: 14 },
});
```

## Pathfinding Settings

Control how the bot navigates through the world.

```typescript
interface PathfindingSettings {
  avoidLava: boolean;        // Avoid lava (default: true)
  avoidFire: boolean;        // Avoid fire (default: true)
  avoidCacti: boolean;       // Avoid cacti (default: true)
  allowSwimming: boolean;    // Allow swimming (default: true)
  allowBreaking: boolean;    // Allow breaking blocks (default: true)
  allowPlacing: boolean;     // Allow placing blocks (default: true)
  pathingRange: number;      // Maximum pathfinding range (default: 128)
  avoidBlocks: string[];     // Block names to avoid stepping on
}
```

**Default avoid blocks:**
- `sweet_berry_bush`
- `magma_block`
- `campfire`
- `soul_campfire`

### Example

```typescript
const settings: PathfindingSettings = {
  avoidLava: true,
  avoidFire: true,
  avoidCacti: true,
  allowSwimming: true,
  allowBreaking: true,
  allowPlacing: true,
  pathingRange: 128,
  avoidBlocks: ['sweet_berry_bush', 'magma_block'],
};
```

## Combat Settings

Control combat behavior and threat response.

```typescript
interface CombatSettings {
  attackHostiles: boolean;      // Attack hostile mobs (default: true)
  fleeCreepers: boolean;        // Flee from creepers (default: true)
  combatRange: number;          // Engagement range (default: 5)
  minHealthToFight: number;     // Min health to engage (default: 6)
  useShield: boolean;           // Use shield (default: true)
  kiteWhileAttacking: boolean;  // Strafe while attacking (default: true)
  neverAttack: string[];        // Entity types to never attack
  alwaysFlee: string[];         // Entity types to always flee
}
```

**Default never-attack entities:**
- `iron_golem`
- `snow_golem`
- `villager`
- `wandering_trader`

**Default always-flee entities:**
- `warden`

### Example

```typescript
const settings: CombatSettings = {
  attackHostiles: true,
  fleeCreepers: true,
  combatRange: 5,
  minHealthToFight: 6,
  useShield: true,
  kiteWhileAttacking: true,
  neverAttack: ['iron_golem', 'villager'],
  alwaysFlee: ['warden'],
};
```

## Food Settings

Control automatic eating behavior.

```typescript
interface FoodSettings {
  eatWhenHunger: number;        // Hunger threshold (default: 14)
  eatRottenFlesh: boolean;      // Allow rotten flesh (default: false)
  eatSpiderEyes: boolean;       // Allow spider eyes (default: false)
  eatPufferfish: boolean;       // Allow pufferfish (default: false)
  prioritizeSaturation: boolean; // Prefer high saturation (default: true)
  neverEat: string[];           // Foods to never eat
}
```

**Default never-eat foods:**
- `chorus_fruit` (teleportation effect)

### Example

```typescript
const settings: FoodSettings = {
  eatWhenHunger: 14,
  eatRottenFlesh: false,
  eatSpiderEyes: false,
  eatPufferfish: false,
  prioritizeSaturation: true,
  neverEat: ['chorus_fruit'],
};
```

## Safety Settings

Control survival-related safety features.

```typescript
interface SafetySettings {
  mlgBucket: boolean;           // MLG water bucket (default: true)
  autoRespawn: boolean;         // Auto respawn on death (default: true)
  breakWhenSuffocating: boolean; // Break blocks when stuck (default: true)
  dangerHealthThreshold: number; // Health for danger mode (default: 10)
  pauseWhenDanger: boolean;     // Pause tasks when danger (default: false)
}
```

### Example

```typescript
const settings: SafetySettings = {
  mlgBucket: true,
  autoRespawn: true,
  breakWhenSuffocating: true,
  dangerHealthThreshold: 10,
  pauseWhenDanger: false,
};
```

## Mining Settings

Control mining behavior and preferences.

```typescript
interface MiningSettings {
  maxMineDepth: number;             // Deepest Y level (default: -60)
  minMineDepth: number;             // Highest Y level (default: 320)
  useFortuneWhenAvailable: boolean; // Prefer fortune (default: true)
  useSilkTouchFor: string[];        // Blocks for silk touch
  neverMine: string[];              // Blocks to never mine
}
```

**Default silk touch blocks:**
- `glass`
- `glowstone`
- `ice`
- `packed_ice`
- `blue_ice`

**Default never-mine blocks:**
- `spawner`
- `bedrock`
- `end_portal_frame`

### Example

```typescript
const settings: MiningSettings = {
  maxMineDepth: -60,
  minMineDepth: 320,
  useFortuneWhenAvailable: true,
  useSilkTouchFor: ['glass', 'glowstone'],
  neverMine: ['spawner', 'bedrock'],
};
```

## Storage Settings

Control inventory and container management.

```typescript
interface StorageSettings {
  storeExcessItems: boolean;   // Auto-deposit items (default: true)
  alwaysKeep: string[];        // Items to never deposit
  throwawayItems: string[];    // Items safe to discard
  maxStacksPerItem: number;    // Max inventory stacks (default: 3)
}
```

**Default always-keep items:**
- `diamond`, `emerald`, `netherite_ingot`
- `ender_pearl`, `blaze_rod`, `ender_eye`
- `totem_of_undying`, `elytra`, `trident`

**Default throwaway items:**
- Common blocks: `cobblestone`, `cobbled_deepslate`, `dirt`, `gravel`, `sand`
- Stone variants: `netherrack`, `andesite`, `diorite`, `granite`, `tuff`
- Junk items: `rotten_flesh`, `poisonous_potato`, `spider_eye`

### Example

```typescript
const settings: StorageSettings = {
  storeExcessItems: true,
  alwaysKeep: ['diamond', 'netherite_ingot'],
  throwawayItems: ['cobblestone', 'dirt'],
  maxStacksPerItem: 3,
};
```

## Misc Settings

Debugging and logging options.

```typescript
interface MiscSettings {
  debugMode: boolean;       // Debug output (default: false)
  logTaskChanges: boolean;  // Log task changes (default: true)
  logChainChanges: boolean; // Log chain changes (default: true)
  renderDebug: boolean;     // Debug visualization (default: false)
}
```

### Example

```typescript
const settings: MiscSettings = {
  debugMode: false,
  logTaskChanges: true,
  logChainChanges: true,
  renderDebug: false,
};
```

## Complete Settings Example

```typescript
import { BotSettings, DEFAULT_SETTINGS, mergeSettings } from 'baritone-ts';

const customSettings: Partial<BotSettings> = {
  pathfinding: {
    avoidLava: true,
    avoidFire: true,
    allowSwimming: true,
    allowBreaking: true,
    allowPlacing: true,
    pathingRange: 64,
  },
  combat: {
    attackHostiles: true,
    fleeCreepers: true,
    useShield: true,
    minHealthToFight: 8,
  },
  food: {
    eatWhenHunger: 12,
    eatRottenFlesh: false,
    prioritizeSaturation: true,
  },
  safety: {
    mlgBucket: true,
    autoRespawn: true,
    dangerHealthThreshold: 8,
  },
  mining: {
    maxMineDepth: -60,
    useFortuneWhenAvailable: true,
  },
  storage: {
    storeExcessItems: true,
    maxStacksPerItem: 5,
  },
  misc: {
    debugMode: false,
    logTaskChanges: true,
  },
};

const settings = mergeSettings(DEFAULT_SETTINGS, customSettings);
```

## Validation

Settings can be validated before use:

```typescript
import { validateSettings } from 'baritone-ts';

const errors = validateSettings(mySettings);
if (errors.length > 0) {
  console.error('Invalid settings:', errors);
}
```

Validated ranges:
- `pathfinding.pathingRange`: 1-256
- `combat.combatRange`: 1-10
- `combat.minHealthToFight`: 0-20
- `food.eatWhenHunger`: 0-20
- `safety.dangerHealthThreshold`: 0-20

## Scenario Presets

### Aggressive Mining

```typescript
const miningPreset: Partial<BotSettings> = {
  pathfinding: {
    allowBreaking: true,
    allowPlacing: true,
  },
  combat: {
    attackHostiles: true,
    minHealthToFight: 8,
  },
  safety: {
    mlgBucket: true,
  },
  mining: {
    useFortuneWhenAvailable: true,
    maxMineDepth: -60,
  },
};
```

### Safe Exploration

```typescript
const explorationPreset: Partial<BotSettings> = {
  pathfinding: {
    avoidLava: true,
    avoidFire: true,
    allowBreaking: false,
    allowPlacing: false,
  },
  combat: {
    attackHostiles: false,
    fleeCreepers: true,
  },
  safety: {
    pauseWhenDanger: true,
    dangerHealthThreshold: 12,
  },
};
```

### Speedrun

```typescript
const speedrunPreset: Partial<BotSettings> = {
  pathfinding: {
    allowBreaking: true,
    allowPlacing: true,
    pathingRange: 256,
  },
  combat: {
    attackHostiles: true,
    fleeCreepers: false,
    minHealthToFight: 4,
  },
  food: {
    eatWhenHunger: 18,
    eatRottenFlesh: true,
  },
  safety: {
    mlgBucket: true,
    pauseWhenDanger: false,
  },
};
```
