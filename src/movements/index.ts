/**
 * Movement exports
 */
export {
  Movement,
  MovementState,
  MovementTraverse,
  MovementAscend,
  MovementDescend,
  MovementDiagonal,
  MovementPillar,
  MovementParkour
} from './Movement';

export { MovementFall, dynamicFallCost } from './MovementFall';
export { MovementHelper, getMovementHelper } from './MovementHelper';

// Swimming movements
export {
  MovementSwimHorizontal,
  MovementSwimUp,
  MovementSwimDown,
  MovementWaterExit,
  MovementWaterEntry
} from './MovementSwim';

// Door/gate movements
export {
  MovementThroughDoor,
  MovementThroughFenceGate,
  MovementThroughTrapdoor,
  isDoor,
  isFenceGate,
  isTrapdoor,
  isOpenable,
  requiresRedstone
} from './MovementDoor';

// Ladder/vine climbing movements
export {
  MovementClimbUp,
  MovementClimbDown,
  MovementMountLadder,
  MovementDismountLadder,
  isClimbable,
  isLadder,
  isVine
} from './MovementClimb';

// Elytra flight controller and utilities
export {
  ElytraController,
  ElytraState,
  hasElytraEquipped,
  hasFireworkRockets,
  isSafeLandingSpot,
  findLandingSpot,
  calculateFlightCost,
  getHeightAboveGround,
  planElytraPath,
  isElytraViable,
  ELYTRA_TAKEOFF_COST,
  ELYTRA_GLIDE_COST_PER_BLOCK,
  ELYTRA_BOOST_COST,
  ELYTRA_LAND_COST,
  type ElytraPathSegment
} from './MovementElytra';

// Boat travel controller and utilities
export {
  BoatController,
  BoatState,
  isInBoat,
  findNearbyBoat,
  hasBoatItem,
  isWaterSurface,
  findWaterSurface,
  hasWaterPath,
  planBoatPath,
  isBoatViable,
  BOAT_BOARD_COST,
  BOAT_TRAVEL_COST_PER_BLOCK,
  BOAT_DISEMBARK_COST,
  BOAT_PLACE_COST,
  type BoatPathSegment
} from './MovementBoat';
