export {
    ELYTRA_TAKEOFF_COST,
    ELYTRA_GLIDE_COST_PER_BLOCK,
    ELYTRA_BOOST_COST,
    ELYTRA_LAND_COST,
    GLIDE_PITCH_OPTIMAL,
    DIVE_PITCH_MAX,
    CLIMB_PITCH_MAX,
    MIN_HEIGHT_FOR_FLIGHT,
    ROCKET_BOOST_DURATION,
    ElytraState,
    hasElytraEquipped,
    hasFireworkRockets,
    getHeightAboveGround
} from './ElytraConstants';

export type { ElytraPathSegment, ElytraPathSegmentType } from './ElytraUtils';
export {
    isSafeLandingSpot,
    findLandingSpot,
    calculateFlightCost,
    planElytraPath,
    isElytraViable
} from './ElytraUtils';

export { ElytraController } from './ElytraController';
