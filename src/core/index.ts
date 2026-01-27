/**
 * Core module exports
 */
export * from './ActionCosts';
export { CalculationContextImpl, type ContextOptions } from './CalculationContext';
export {
  BlockBreakHelper,
  BlockPlaceHelper,
  WaterBucketHelper,
  findReferenceBlock,
  canReachBlock,
  calculateLookRotation,
  calculateFaceVector
} from './BlockInteraction';
