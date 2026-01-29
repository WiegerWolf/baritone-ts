/**
 * StorageContainerTask - Storage Container Interaction Tasks (barrel)
 *
 * Re-exports from individual files for backward compatibility.
 */

// Shared types
export type { ContainerItemTarget } from './ContainerItemTarget';
export { containerItemTarget, itemMatchesTarget } from './ContainerItemTarget';

// Individual task classes
export { PickupFromContainerTask, pickupFromContainer } from './PickupFromContainerTask';
export { StoreInContainerTask, storeInContainer } from './StoreInContainerTask';
export { LootContainerTask, lootContainer } from './LootContainerTask';
