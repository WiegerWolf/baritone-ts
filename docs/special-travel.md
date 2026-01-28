# Special Travel

Baritone-TS includes controllers for Elytra flight and boat travel, enabling long-distance navigation.

## Elytra Flight

### ElytraController

The ElytraController handles automated elytra flight.

```typescript
import { ElytraController, hasElytraEquipped } from 'baritone-ts';
import { Vec3 } from 'vec3';

// Check if elytra is equipped
if (!hasElytraEquipped(bot)) {
  console.log('Need to equip elytra first');
  return;
}

// Create controller
const elytra = new ElytraController(bot, bot.pathfinder.ctx);

// Start flight to destination
const destination = new Vec3(1000, 100, 1000);

if (elytra.startFlight(destination)) {
  console.log('Taking off!');

  // Tick the controller each game tick
  const interval = setInterval(() => {
    if (elytra.tick()) {
      clearInterval(interval);
      console.log('Flight complete!');
    }
  }, 50);
}
```

### Flight Options

```typescript
const elytra = new ElytraController(bot, ctx, {
  // Launch method
  launchMethod: 'firework',  // 'firework' | 'tower' | 'jump'

  // Flight parameters
  cruiseAltitude: 100,       // Target altitude
  minAltitude: 60,           // Don't go below this
  maxAltitude: 200,          // Don't go above this

  // Speed control
  useFireworks: true,        // Use fireworks for boost
  fireworkInterval: 3000,    // ms between fireworks
  maxSpeed: 2.5,             // blocks per tick

  // Landing
  landingDistance: 50,       // Start landing this far from goal
  landingAltitude: 70,       // Target altitude for landing

  // Safety
  avoidCollision: true,      // Avoid terrain
  emergencyLand: true,       // Land if elytra low durability
});
```

### Launch Methods

#### Firework Launch

```typescript
const elytra = new ElytraController(bot, ctx, {
  launchMethod: 'firework'
});

// Requires fireworks in inventory
// Uses firework to launch from ground
```

#### Tower Launch

```typescript
const elytra = new ElytraController(bot, ctx, {
  launchMethod: 'tower',
  towerHeight: 50  // Build tower this high
});

// Builds a tower, jumps off, and glides
// Slower but doesn't require fireworks
```

#### Jump Launch

```typescript
const elytra = new ElytraController(bot, ctx, {
  launchMethod: 'jump'
});

// Requires high starting position
// Jumps off edge and activates elytra
```

### Flight Events

```typescript
elytra.on('takeoff', () => {
  console.log('Took off!');
});

elytra.on('cruising', (altitude) => {
  console.log(`Cruising at ${altitude} blocks`);
});

elytra.on('landing', () => {
  console.log('Starting landing approach');
});

elytra.on('landed', () => {
  console.log('Landed safely');
});

elytra.on('firework_used', () => {
  console.log('Used firework boost');
});

elytra.on('emergency', (reason) => {
  console.log(`Emergency: ${reason}`);
});
```

### Flight Path Planning

```typescript
import { ElytraPathPlanner } from 'baritone-ts';

const planner = new ElytraPathPlanner(bot, ctx);

// Plan a flight path avoiding obstacles
const flightPath = await planner.planPath(
  bot.entity.position,
  destination,
  {
    minAltitude: 60,
    maxAltitude: 200,
    avoidWater: true,
    avoidMountains: true
  }
);

// Execute the planned path
elytra.setPath(flightPath);
elytra.startFlight();
```

### Altitude Control

```typescript
// Manual altitude adjustment
elytra.setTargetAltitude(150);

// Dive to lower altitude
elytra.dive(50);

// Climb to higher altitude
elytra.climb(200);

// Get current altitude
const alt = elytra.getCurrentAltitude();
```

## Boat Travel

### BoatController

The BoatController handles automated boat travel.

```typescript
import { BoatController, hasBoatItem, isInBoat } from 'baritone-ts';
import { Vec3 } from 'vec3';

// Check for boat
if (!isInBoat(bot) && !hasBoatItem(bot)) {
  console.log('Need a boat');
  return;
}

// Create controller
const boat = new BoatController(bot, bot.pathfinder.ctx);

// Start boat travel
const destination = new Vec3(500, 63, 500);

if (boat.startTravel(destination)) {
  console.log('Setting sail!');

  const interval = setInterval(() => {
    if (boat.tick()) {
      clearInterval(interval);
      console.log('Arrived!');
    }
  }, 50);
}
```

### Boat Options

```typescript
const boat = new BoatController(bot, ctx, {
  // Boat handling
  placeBoat: true,           // Place boat if not in one
  exitOnArrival: true,       // Exit boat when arrived

  // Navigation
  followShoreline: false,    // Stay near shore
  maxDistanceFromShore: 100, // For open water travel

  // Speed
  sprint: true,              // Use sprint key for speed

  // Obstacles
  avoidIce: true,            // Avoid ice (slower)
  breakLilyPads: true,       // Break lily pads in path
  avoidShallows: true,       // Avoid running aground

  // Path finding
  useWaterPaths: true,       // Use water-specific pathfinding
  maxPathLength: 500,        // Max path distance
});
```

### Boat Events

```typescript
boat.on('entered_boat', () => {
  console.log('Entered boat');
});

boat.on('exited_boat', () => {
  console.log('Exited boat');
});

boat.on('obstacle', (type) => {
  console.log(`Obstacle: ${type}`);
});

boat.on('stuck', () => {
  console.log('Boat is stuck');
});

boat.on('arrived', () => {
  console.log('Reached destination');
});
```

### Water Path Planning

```typescript
import { WaterPathPlanner } from 'baritone-ts';

const planner = new WaterPathPlanner(bot, ctx);

// Find water path
const waterPath = await planner.findWaterPath(
  bot.entity.position,
  destination,
  {
    maxPortageDistance: 20,  // Max distance to walk between water
    preferRivers: true,      // Prefer rivers over oceans
    avoidOcean: false
  }
);

if (waterPath) {
  console.log(`Found water path with ${waterPath.segments.length} segments`);

  for (const segment of waterPath.segments) {
    if (segment.type === 'water') {
      console.log(`  Boat: ${segment.distance} blocks`);
    } else {
      console.log(`  Walk: ${segment.distance} blocks`);
    }
  }
}
```

### Manual Boat Control

```typescript
// Direction control
boat.turnLeft();
boat.turnRight();
boat.goStraight();

// Speed control
boat.accelerate();
boat.decelerate();
boat.stop();

// Get state
const speed = boat.getSpeed();
const heading = boat.getHeading();
const position = boat.getPosition();
```

## Ice Boat Travel

For faster travel on ice:

```typescript
import { IceBoatController } from 'baritone-ts';

const iceBoat = new IceBoatController(bot, ctx, {
  // Ice boat is much faster
  useBlueIce: true,          // Prefer blue ice (fastest)
  usePackedIce: true,        // Use packed ice
  useRegularIce: true,       // Use regular ice

  // Speed management
  maxSpeed: 70,              // Ice boats are FAST
  brakingDistance: 50,       // Start braking early

  // Path
  buildIcePath: false,       // Build ice path if needed
  icePathWidth: 3,           // Width of ice path
});

iceBoat.startTravel(destination);
```

## Combined Travel

Use multiple travel methods:

```typescript
import { TravelPlanner } from 'baritone-ts';

const planner = new TravelPlanner(bot, ctx);

// Plan optimal route using all methods
const route = await planner.planRoute(
  bot.entity.position,
  destination,
  {
    allowWalk: true,
    allowBoat: true,
    allowElytra: true,
    allowNether: true,  // Use nether for 8x travel

    // Preferences
    preferSpeed: true,  // Optimize for speed
    // OR
    // preferSafety: true,  // Optimize for safety
  }
);

console.log(`Best route: ${route.totalTime.toFixed(1)}s`);
for (const segment of route.segments) {
  console.log(`  ${segment.method}: ${segment.distance} blocks (${segment.time.toFixed(1)}s)`);
}

// Execute the route
await planner.executeRoute(route);
```

## Utility Functions

```typescript
import {
  hasElytraEquipped,
  getElytraDurability,
  hasBoatItem,
  isInBoat,
  isFlying,
  getBoatType,
  canFlyHere,
  isOverWater
} from 'baritone-ts';

// Elytra checks
if (hasElytraEquipped(bot)) {
  const durability = getElytraDurability(bot);
  console.log(`Elytra durability: ${durability}%`);
}

// Boat checks
if (hasBoatItem(bot)) {
  const type = getBoatType(bot);
  console.log(`Have ${type} boat`);
}

if (isInBoat(bot)) {
  console.log('Currently in boat');
}

// Flight checks
if (isFlying(bot)) {
  console.log('Currently flying');
}

if (canFlyHere(bot)) {
  console.log('Safe to fly here');
}

// Water checks
if (isOverWater(bot)) {
  console.log('Over water - safe to land');
}
```

## Example: Long Distance Travel

```typescript
import { createBot } from 'mineflayer';
import {
  pathfinder,
  ElytraController,
  BoatController,
  GoalXZ,
  hasElytraEquipped,
  isOverWater
} from 'baritone-ts';
import { Vec3 } from 'vec3';

const bot = createBot({ host: 'localhost', username: 'TravelBot' });

bot.once('spawn', () => {
  pathfinder(bot);
});

bot.on('chat', async (username, message) => {
  const match = message.match(/^travel (-?\d+) (-?\d+)$/);
  if (!match) return;

  const [, x, z] = match.map(Number);
  const destination = new Vec3(x, 100, z);
  const distance = bot.entity.position.distanceTo(destination);

  console.log(`Traveling ${distance.toFixed(0)} blocks...`);

  // Choose travel method
  if (distance > 500 && hasElytraEquipped(bot)) {
    // Use elytra for long distances
    const elytra = new ElytraController(bot, bot.pathfinder.ctx);

    if (elytra.startFlight(destination)) {
      const interval = setInterval(() => {
        if (elytra.tick()) {
          clearInterval(interval);
          bot.chat('Arrived by elytra!');
        }
      }, 50);
    }
  } else if (isOverWater(bot)) {
    // Use boat over water
    const boat = new BoatController(bot, bot.pathfinder.ctx);

    if (boat.startTravel(destination)) {
      const interval = setInterval(() => {
        if (boat.tick()) {
          clearInterval(interval);
          bot.chat('Arrived by boat!');
        }
      }, 50);
    }
  } else {
    // Walk for short distances
    bot.pathfinder.setGoal(new GoalXZ(x, z));
  }
});
```
