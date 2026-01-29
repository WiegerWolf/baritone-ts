/**
 * BiomeSearchTask - Barrel re-export file
 *
 * This file re-exports from the individual task files for backwards compatibility.
 */

export {
  Biomes,
  SearchWithinBiomeTask,
  searchWithinBiome,
  getCurrentBiome,
  isInBiome,
} from './SearchWithinBiomeTask';
export type { BiomeKey } from './SearchWithinBiomeTask';

export {
  LocateDesertTempleTask,
  locateDesertTemple,
} from './LocateDesertTempleTask';
export type { LocateDesertTempleConfig } from './LocateDesertTempleTask';
