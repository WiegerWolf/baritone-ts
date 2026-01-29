/**
 * Movement exports
 */

// Core movement classes and types
export { Movement } from './Movement';
export { MovementState } from './MovementState';

// Basic movements
export { MovementTraverse } from './MovementTraverse';
export { MovementAscend } from './MovementAscend';
export { MovementDescend } from './MovementDescend';
export { MovementDiagonal } from './MovementDiagonal';
export { MovementPillar } from './MovementPillar';
export { MovementParkour } from './MovementParkour';
export { MovementParkourAscend } from './MovementParkourAscend';

export { MovementFall, dynamicFallCost } from './MovementFall';
export { MovementHelper, getMovementHelper } from './MovementHelper';

// Swimming movements
export {
  SWIM_UP_COST,
  SWIM_DOWN_COST,
  SWIM_HORIZONTAL_COST,
  MovementSwimHorizontal,
  MovementSwimUp,
  MovementSwimDown,
  MovementWaterExit,
  MovementWaterEntry
} from './swim';

// Door/gate movements
export {
  isDoor,
  isFenceGate,
  isTrapdoor,
  isOpenable,
  requiresRedstone,
  MovementThroughDoor,
  MovementThroughFenceGate,
  MovementThroughTrapdoor
} from './door';

// Ladder/vine climbing movements
export {
  isClimbable,
  isLadder,
  isVine,
  MovementClimbUp,
  MovementClimbDown,
  MovementMountLadder,
  MovementDismountLadder
} from './climb';

// Elytra flight controller and utilities
export {
  ELYTRA_TAKEOFF_COST,
  ELYTRA_GLIDE_COST_PER_BLOCK,
  ELYTRA_BOOST_COST,
  ELYTRA_LAND_COST,
  ElytraState,
  hasElytraEquipped,
  hasFireworkRockets,
  calculateFlightCost,
  planElytraPath,
  isElytraViable,
  ElytraController
} from './elytra';
export type { ElytraPathSegment } from './elytra';

// Boat travel controller and utilities
export {
  BOAT_BOARD_COST,
  BOAT_TRAVEL_COST_PER_BLOCK,
  BOAT_DISEMBARK_COST,
  BoatState,
  isInBoat,
  findNearbyBoat,
  hasBoatItem,
  isWaterSurface,
  findWaterSurface,
  hasWaterPath,
  planBoatPath,
  isBoatViable,
  BoatController
} from './boat';
export type { BoatPathSegment } from './boat';
