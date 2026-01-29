export {
    BOAT_BOARD_COST,
    BOAT_TRAVEL_COST_PER_BLOCK,
    BOAT_DISEMBARK_COST,
    BOAT_PLACE_COST,
    BOAT_SPEED,
    BOAT_ROTATION_SPEED,
    BOAT_SEARCH_RADIUS,
    BoatState,
    isInBoat,
    findNearbyBoat,
    hasBoatItem
} from './BoatConstants';

export type { BoatPathSegment } from './BoatUtils';
export {
    isWaterSurface,
    findWaterSurface,
    hasWaterPath,
    planBoatPath,
    isBoatViable
} from './BoatUtils';

export { BoatController } from './BoatController';
