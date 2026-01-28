# Goals

Goals define where the bot should pathfind to. They are the fundamental building block of navigation in Baritone-TS.

## Goal Interface

All goals implement this interface:

```typescript
interface Goal {
  // Returns true if the position satisfies the goal
  isInGoal(x: number, y: number, z: number): boolean;

  // Returns estimated cost (ticks) to reach goal from position
  heuristic(x: number, y: number, z: number): number;
}
```

## Built-in Goal Types

### GoalBlock

Navigate to an exact position.

```typescript
import { GoalBlock } from 'baritone-ts';

const goal = new GoalBlock(100, 64, 100);
bot.pathfinder.setGoal(goal);
```

**Use when:** You need to reach a specific block location.

### GoalXZ

Navigate to X/Z coordinates at any Y level.

```typescript
import { GoalXZ } from 'baritone-ts';

const goal = new GoalXZ(100, 100);
bot.pathfinder.setGoal(goal);
```

**Use when:** You want to reach a location but don't care about height (e.g., exploring to coordinates).

### GoalYLevel

Navigate to a specific Y level.

```typescript
import { GoalYLevel } from 'baritone-ts';

const goal = new GoalYLevel(11); // Diamond mining level
bot.pathfinder.setGoal(goal);
```

**Use when:** You want to reach a certain height (e.g., mining at specific levels).

### GoalNear

Get within a certain radius of a position.

```typescript
import { GoalNear } from 'baritone-ts';

// Get within 5 blocks of the target
const goal = new GoalNear(100, 64, 100, 5);
bot.pathfinder.setGoal(goal);
```

**Use when:** You don't need the exact position, just proximity.

### GoalGetToBlock

Stand adjacent to a block (for interaction).

```typescript
import { GoalGetToBlock } from 'baritone-ts';

// Get next to a chest to open it
const goal = new GoalGetToBlock(100, 64, 100);
bot.pathfinder.setGoal(goal);
```

**Use when:** You need to interact with a block (open chest, break block, etc.).

### GoalFollow

Follow a moving entity.

```typescript
import { GoalFollow } from 'baritone-ts';

const player = bot.players['PlayerName']?.entity;
if (player) {
  // Follow 3 blocks behind
  const goal = new GoalFollow(player, 3);
  bot.pathfinder.setGoal(goal, true); // true = dynamic goal
}
```

**Use when:** You need to track a moving target like a player or mob.

**Important:** Pass `true` as the second argument to `setGoal()` for dynamic goals.

### GoalRunAway

Flee from one or more positions.

```typescript
import { GoalRunAway } from 'baritone-ts';

// Run 20 blocks away from danger
const dangers = [
  { x: 100, y: 64, z: 100 },
  { x: 105, y: 64, z: 100 }
];
const goal = new GoalRunAway(dangers, 20);
bot.pathfinder.setGoal(goal);
```

**Use when:** Escaping from mobs, lava, or other dangers.

### GoalComposite

Combine multiple goals (satisfies any one).

```typescript
import { GoalComposite, GoalBlock } from 'baritone-ts';

// Go to any of these positions
const goals = [
  new GoalBlock(100, 64, 100),
  new GoalBlock(200, 64, 200),
  new GoalBlock(300, 64, 300)
];
const goal = new GoalComposite(goals);
bot.pathfinder.setGoal(goal);
```

**Use when:** Multiple destinations are acceptable.

### GoalInverted

Invert a goal (get away from it).

```typescript
import { GoalInverted, GoalBlock } from 'baritone-ts';

// Stay away from this position
const avoidGoal = new GoalInverted(new GoalBlock(100, 64, 100));
bot.pathfinder.setGoal(avoidGoal);
```

**Use when:** You want to avoid a specific area.

### GoalAABB

Get inside a bounding box.

```typescript
import { GoalAABB } from 'baritone-ts';

// Navigate to anywhere within this box
const goal = new GoalAABB(
  { x: 100, y: 64, z: 100 },  // min corner
  { x: 110, y: 70, z: 110 }   // max corner
);
bot.pathfinder.setGoal(goal);
```

**Use when:** Any position within a region is acceptable.

## Using Goals

### Basic Usage

```typescript
// Set a goal
bot.pathfinder.setGoal(new GoalBlock(100, 64, 100));

// Get current goal
const currentGoal = bot.pathfinder.getGoal();

// Clear goal
bot.pathfinder.setGoal(null);

// Stop pathfinding
bot.pathfinder.stop();
```

### Dynamic Goals

For goals that change (like GoalFollow), pass `true` as the second argument:

```typescript
bot.pathfinder.setGoal(goal, true); // Dynamic - will recalculate as target moves
bot.pathfinder.setGoal(goal, false); // Static - position fixed at set time
```

### Async Navigation

Use `goto()` for promise-based navigation:

```typescript
try {
  await bot.pathfinder.goto(new GoalBlock(100, 64, 100));
  console.log('Arrived!');
} catch (error) {
  console.log('Could not reach goal:', error.message);
}
```

## Creating Custom Goals

Implement the Goal interface:

```typescript
import { Goal } from 'baritone-ts';

class GoalDiamond implements Goal {
  isInGoal(x: number, y: number, z: number): boolean {
    // Check if standing on diamond ore
    const block = bot.blockAt(new Vec3(x, y - 1, z));
    return block?.name === 'diamond_ore';
  }

  heuristic(x: number, y: number, z: number): number {
    // Estimate: prefer lower Y levels where diamonds spawn
    const optimalY = 11;
    return Math.abs(y - optimalY) * 4; // Rough tick estimate
  }
}
```

### Heuristic Guidelines

The heuristic should:
1. **Never overestimate** - Return cost <= actual cost (admissible)
2. **Use tick-based costs** - Match the movement cost model
3. **Be fast to compute** - Called frequently during A*

Typical tick costs for reference:
- Walk 1 block: ~4.6 ticks
- Sprint 1 block: ~3.6 ticks
- Fall 1 block: ~1 tick

## Goal Selection Guide

| Scenario | Best Goal |
|----------|-----------|
| Exact location | GoalBlock |
| Explore to X/Z | GoalXZ |
| Mining at Y level | GoalYLevel |
| Interact with block | GoalGetToBlock |
| Stay near location | GoalNear |
| Follow player/mob | GoalFollow |
| Escape danger | GoalRunAway |
| Multiple valid destinations | GoalComposite |
| Stay away from area | GoalInverted |
| Region destination | GoalAABB |

## Examples

### Mining at Diamond Level

```typescript
// Go to Y=11 for diamond mining
bot.pathfinder.setGoal(new GoalYLevel(11));
```

### Following a Player

```typescript
bot.on('chat', (username, message) => {
  if (message === 'follow me') {
    const player = bot.players[username]?.entity;
    if (player) {
      bot.pathfinder.setGoal(new GoalFollow(player, 2), true);
    }
  }
});
```

### Escaping Mobs

```typescript
import { GoalRunAway } from 'baritone-ts';

// Get positions of hostile mobs
const hostiles = Object.values(bot.entities)
  .filter(e => e.type === 'hostile')
  .map(e => ({ x: e.position.x, y: e.position.y, z: e.position.z }));

if (hostiles.length > 0) {
  bot.pathfinder.setGoal(new GoalRunAway(hostiles, 30));
}
```

### Going to Nearest of Multiple Chests

```typescript
import { GoalComposite, GoalGetToBlock } from 'baritone-ts';

const chestPositions = [
  { x: 100, y: 64, z: 100 },
  { x: 200, y: 64, z: 200 }
];

const goals = chestPositions.map(
  pos => new GoalGetToBlock(pos.x, pos.y, pos.z)
);

bot.pathfinder.setGoal(new GoalComposite(goals));
```
