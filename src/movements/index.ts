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
