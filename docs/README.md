# Baritone-TS Documentation

Welcome to the Baritone-TS documentation! This guide will help you get started with the library and explore its advanced features.

## Table of Contents

### Getting Started
- [Quick Start Guide](./quick-start.md) - Get up and running in 5 minutes
- [Installation](./installation.md) - Detailed installation instructions
- [Basic Concepts](./concepts.md) - Understanding the core architecture

### Core Features
- [Goals](./goals.md) - Pathfinding targets and destinations
- [Movements](./movements.md) - Movement types and cost model
- [Configuration](./configuration.md) - Settings and options

### Automation
- [Processes](./processes.md) - High-level automation (mining, following, farming)
- [Tasks](./tasks.md) - Hierarchical task system for complex workflows
- [Survival Chains](./survival-chains.md) - Emergency behaviors (food, fall protection)

### Advanced Topics
- [Async Pathfinding](./async-pathfinding.md) - Non-blocking path computation
- [Special Travel](./special-travel.md) - Elytra flight and boat navigation
- [Trackers](./trackers.md) - Block, entity, and storage tracking
- [Custom Extensions](./custom-extensions.md) - Creating custom goals, movements, and tasks
- [Debugging](./debugging.md) - Path visualization and troubleshooting

### Reference
- [API Reference](./api-reference.md) - Complete API documentation
- [Events](./events.md) - Event system reference
- [Examples](./examples.md) - Code examples and recipes

## Quick Links

**New to Baritone-TS?** Start with the [Quick Start Guide](./quick-start.md).

**Coming from mineflayer-pathfinder?** See [Migration Guide](./migration.md).

**Building automation bots?** Check out [Processes](./processes.md) and [Tasks](./tasks.md).

**Need advanced control?** Explore [Custom Extensions](./custom-extensions.md).

## About Baritone-TS

Baritone-TS is a TypeScript port of [Baritone](https://github.com/cabaletta/baritone), the famous Minecraft pathfinding mod. It brings enterprise-grade pathfinding and automation to the [Mineflayer](https://github.com/PrismarineJS/mineflayer) bot framework.

### Key Features

- **Tick-accurate pathfinding** with realistic movement costs
- **20+ movement types** covering all Minecraft locomotion
- **7-coefficient A\*** for graceful degradation under timeout
- **High-level processes** for mining, following, farming, combat, building
- **100+ hierarchical tasks** for complex automation workflows
- **Elytra and boat support** for long-distance travel
- **2-bit chunk caching** for memory-efficient block storage
