# Installation

## Requirements

- **Node.js** 16.0.0 or later
- **npm** or **yarn** package manager
- **Minecraft server** Java Edition 1.16 - 1.20

## Package Installation

### npm

```bash
npm install baritone-ts
```

### yarn

```bash
yarn add baritone-ts
```

### pnpm

```bash
pnpm add baritone-ts
```

## Peer Dependencies

Baritone-TS requires Mineflayer as a peer dependency:

```bash
npm install mineflayer
```

The following packages are included automatically:
- `prismarine-block` - Block data handling
- `prismarine-world` - World state management
- `vec3` - Vector math operations

## TypeScript Setup

Baritone-TS is written in TypeScript and includes full type definitions.

For TypeScript projects:

```bash
npm install typescript ts-node @types/node
```

Your `tsconfig.json` should include:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true
  }
}
```

## JavaScript Usage

Baritone-TS works with plain JavaScript as well:

```javascript
const { createBot } = require('mineflayer');
const { pathfinder, GoalBlock } = require('baritone-ts');

const bot = createBot({
  host: 'localhost',
  username: 'Bot'
});

bot.once('spawn', () => {
  pathfinder(bot);
  bot.pathfinder.setGoal(new GoalBlock(100, 64, 100));
});
```

## ESM Imports

For ES modules:

```typescript
import { createBot } from 'mineflayer';
import { pathfinder, GoalBlock } from 'baritone-ts';
```

## Verifying Installation

Create a test file:

```typescript
import { pathfinder, GoalBlock, AStar } from 'baritone-ts';

console.log('Baritone-TS imported successfully');
console.log('GoalBlock:', typeof GoalBlock);
console.log('AStar:', typeof AStar);
```

Run it:

```bash
npx ts-node test.ts
```

You should see:
```
Baritone-TS imported successfully
GoalBlock: function
AStar: function
```

## Troubleshooting

### Module Resolution Errors

If you get module resolution errors, ensure:
1. Your `package.json` has `"type": "module"` for ESM
2. Your `tsconfig.json` uses `"moduleResolution": "NodeNext"`

### Mineflayer Version Issues

Baritone-TS requires Mineflayer 4.0.0 or later. Check your version:

```bash
npm list mineflayer
```

### TypeScript Compilation Errors

If you see type errors, ensure you're using TypeScript 5.0 or later:

```bash
npx tsc --version
```

## Next Steps

- [Quick Start Guide](./quick-start.md) - Create your first bot
- [Basic Concepts](./concepts.md) - Understand the architecture
