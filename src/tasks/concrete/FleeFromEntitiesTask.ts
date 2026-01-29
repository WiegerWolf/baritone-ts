/**
 * FleeFromEntitiesTask - Barrel re-export for entity flee tasks
 *
 * Each class now lives in its own file. This file re-exports them
 * for backward compatibility.
 *
 * Note: The subclasses were renamed to avoid conflicts with the
 * standalone RunAwayFrom*Task implementations in EscapeTask:
 * - RunAwayFromHostilesTask → FleeFromHostilesTask
 * - RunAwayFromPlayersTask → FleeFromPlayersTask
 * - RunAwayFromCreepersTask → FleeFromCreepersTask
 * - DodgeProjectilesTask → FleeFromProjectilesTask
 */

export { RunAwayFromEntitiesTask, type EntitySupplier } from './RunAwayFromEntitiesTask';
export { FleeFromHostilesTask } from './FleeFromHostilesTask';
export { FleeFromPlayersTask } from './FleeFromPlayersTask';
export { FleeFromCreepersTask } from './FleeFromCreepersTask';
export { FleeFromProjectilesTask } from './FleeFromProjectilesTask';
