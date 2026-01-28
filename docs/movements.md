# Movements

Movements are the individual steps that make up a path. Each movement takes the bot from one position to another with associated cost and execution logic.

## Movement Types

Baritone-TS includes 20+ movement types covering all Minecraft locomotion:

### Ground Movement

| Type | Description | Cost (ticks) |
|------|-------------|--------------|
| **MovementTraverse** | Walk horizontally to adjacent block | 4.633 (walk) / 3.564 (sprint) |
| **MovementDiagonal** | Walk diagonally | 6.55 (walk) / 5.04 (sprint) |
| **MovementAscend** | Jump up 1 block | ~7.1 |
| **MovementDescend** | Drop down 1-3 blocks | ~5-10 |
| **MovementPillar** | Place block and jump up | ~15 |

### Parkour

| Type | Description | Max Distance |
|------|-------------|--------------|
| **MovementParkour** | Long jump across gaps | 1-4 blocks |
| **MovementParkourAscend** | Jump up and forward | 1 block up, 1-2 forward |

### Water

| Type | Description |
|------|-------------|
| **MovementSwimHorizontal** | Swim horizontally |
| **MovementSwimUp** | Swim upward |
| **MovementSwimDown** | Swim downward |
| **MovementWaterEntry** | Enter water from land |
| **MovementWaterExit** | Exit water to land |

### Climbing

| Type | Description |
|------|-------------|
| **MovementClimbUp** | Climb up ladder/vine |
| **MovementClimbDown** | Descend ladder/vine |
| **MovementMountLadder** | Step onto climbable block |
| **MovementDismountLadder** | Step off climbable block |

### Doors

| Type | Description |
|------|-------------|
| **MovementThroughDoor** | Pass through door |
| **MovementThroughFenceGate** | Pass through fence gate |
| **MovementThroughTrapdoor** | Pass through trapdoor |

### Special

| Type | Description |
|------|-------------|
| **MovementFall** | Long fall with water bucket |
| **MovementElytra** | Elytra flight (via ElytraController) |
| **MovementBoat** | Boat travel (via BoatController) |

## Cost Model

Baritone-TS uses a **tick-based cost model** that reflects actual game time.

### Base Movement Costs

```typescript
const COSTS = {
  // Walking (blocks per second: 4.317)
  WALK_ONE_BLOCK: 4.633,     // 1/4.317 * 20 ticks

  // Sprinting (blocks per second: 5.612)
  SPRINT_ONE_BLOCK: 3.564,   // 1/5.612 * 20 ticks

  // Sneaking (blocks per second: 1.3)
  SNEAK_ONE_BLOCK: 15.385,   // 1/1.3 * 20 ticks

  // Swimming (blocks per second: 2.2)
  SWIM_ONE_BLOCK: 9.091,     // 1/2.2 * 20 ticks

  // Ladder climbing (blocks per second: 2.35)
  LADDER_UP_ONE_BLOCK: 5.0,  // Approximate
  LADDER_DOWN_ONE_BLOCK: 1.43,

  // Jumping
  JUMP: 2.5,                 // Additional cost for jump

  // Falling (accelerating)
  // 1 block: 5 ticks
  // 2 blocks: 7 ticks
  // 3 blocks: 9 ticks
  // etc.
};
```

### Block Breaking Costs

Breaking costs depend on tool and block hardness:

```typescript
// Approximate ticks to break with optimal tool
const BREAK_COSTS = {
  dirt: 10,          // Diamond shovel
  stone: 15,         // Diamond pickaxe
  wood: 10,          // Diamond axe
  obsidian: 200,     // Diamond pickaxe
};
```

### Block Placing Costs

```typescript
const PLACE_BLOCK: 4; // ~4 ticks to place a block
```

### Sprint Penalties

Sprinting isn't always optimal due to:
- Hunger consumption
- Need to stop for jumps
- Collision with obstacles

```typescript
// Settings to control sprint behavior
pathfinder(bot, {
  allowSprint: true,
  jumpPenalty: 2.0  // Extra cost for jumps (affects sprint decisions)
});
```

## Movement Selection

During A* search, Baritone-TS evaluates possible movements:

1. **Generate candidates** - All possible movements from current position
2. **Check preconditions** - Can the movement be performed?
3. **Calculate cost** - Factor in walking, breaking, placing, risks
4. **Apply penalties** - Backtracking, mob proximity, etc.

```typescript
// Movement factory builds all valid movements
const movements = movementFactory.generateMovements(position);

// Each movement reports its cost
const cost = movement.calculateCost(ctx);

// A* picks lowest total cost path
```

## Movement Execution

Each movement runs as a state machine:

```typescript
enum MovementState {
  NOT_STARTED,  // Initial state
  PREPPING,     // Setting up (equipping tools)
  WAITING,      // Waiting (chunk loading, block break)
  RUNNING,      // Actively moving
  SUCCESS,      // Completed successfully
  UNREACHABLE,  // Path became blocked
  FAILED        // Could not complete
}
```

### Execution Flow

1. **PREPPING** - Equip tools, look at target
2. **WAITING** - Wait for prerequisites (chunks, blocks)
3. **RUNNING** - Execute the movement
4. **SUCCESS/FAILED** - Completion

```typescript
// The path executor calls tick() each game tick
const status = movement.tick(ctx);

if (status === MovementStatus.SUCCESS) {
  // Move to next movement
}
```

## Configuration

Control which movements are allowed:

```typescript
pathfinder(bot, {
  // Basic movement
  allowSprint: true,      // Enable sprinting
  allowParkour: true,     // Enable parkour jumps
  allowParkourPlace: false, // Place blocks mid-parkour

  // Block interaction
  canDig: true,           // Allow breaking blocks
  canPlace: true,         // Allow placing blocks

  // Safety
  maxFallHeight: 3,       // Max fall without water bucket
  allowWaterBucket: true, // Use water bucket for falls

  // Costs
  jumpPenalty: 2.0,       // Extra cost for jumps
});
```

## Movement Details

### MovementTraverse

Standard horizontal movement to adjacent block.

```
[B][ ]     [ ][B]
[#][#]  →  [#][#]
```

- Checks if destination is walkable
- May need to break blocks
- May need to place floor block
- Handles sneaking at edges

### MovementAscend

Jump up to a block 1 higher.

```
   [ ]        [B]
[B][ ]     [ ][ ]
[#][#]  →  [#][#]
```

- Requires headroom at start
- Checks ceiling at destination
- May break blocks in the way

### MovementDescend

Drop down 1-3 blocks.

```
[B][ ]     [ ][ ]
[#][ ]  →  [#][B]
[#][#]     [#][#]
```

- Calculates fall damage
- Checks landing is safe
- May place water for long falls

### MovementParkour

Long jump across a gap (1-4 blocks).

```
[B]   [ ]     [ ]   [B]
[#]   [#]  →  [#]   [#]
```

- Sprint required for 3-4 block jumps
- Checks landing platform
- Calculates gap distance

### MovementPillar

Place blocks to go straight up.

```
   [B]        [ ]
[B][ ]     [#][B]
[#][ ]  →  [#][ ]
[#][#]     [#][#]
```

- Requires scaffolding blocks
- High cost (place + jump per block)
- Limited by inventory

### MovementClimbUp/Down

Use ladders or vines.

```
[L][ ]     [ ][ ]
[L][B]  →  [L][B]  (climb up)
[L][ ]     [L][ ]
```

- Efficient vertical movement
- No tools or blocks needed
- Must enter/exit climb properly

### MovementFall

Extended fall with water bucket MLG.

```
[B][ ]     [ ][ ]
[ ][ ]     [ ][ ]
[ ][ ]  →  [W][ ]
[#][#]     [#][B]
```

- Place water bucket before landing
- Pick up water after landing
- Requires water bucket and skill

## Custom Movements

Extend the base Movement class:

```typescript
import { Movement, MovementStatus, CalculationContext } from 'baritone-ts';

class MyCustomMovement extends Movement {
  constructor(from: BlockPos, to: BlockPos) {
    super(from, to);
  }

  calculateCost(ctx: CalculationContext): number {
    // Return cost in ticks
    return 10;
  }

  tick(ctx: CalculationContext): MovementStatus {
    // Execute movement logic
    // Return status
    return MovementStatus.SUCCESS;
  }
}
```

### Adding to Movement Factory

Custom movements can be registered with the movement factory:

```typescript
// Register custom movement generator
ctx.movementFactory.addGenerator((from, ctx) => {
  const movements: Movement[] = [];
  // Add your custom movements
  return movements;
});
```

## Performance Tips

1. **Limit breaking** - `canDig: false` dramatically speeds up pathfinding
2. **Limit parkour** - Parkour checks are expensive
3. **Set reasonable fall height** - Lower `maxFallHeight` reduces branching
4. **Use scaffolding wisely** - Pillar movements are costly

## Debugging Movements

Enable movement debugging:

```typescript
import { PathDebugger } from 'baritone-ts';

const debugger = new PathDebugger(bot);
debugger.showMovements = true;

// Visualize attempted movements
debugger.onMovement((movement, status) => {
  console.log(`${movement.constructor.name}: ${status}`);
});
```
