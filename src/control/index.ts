/**
 * Control Module - Input and Action Management
 * Based on AltoClef/BaritonePlus control system
 *
 * Provides:
 * - InputControls: Keyboard/mouse state management
 * - PlayerExtraController: Extended player actions
 * - KillAura: Combat automation
 */

export {
  InputControls,
  Input,
  createInputControls,
} from './InputControls';

export {
  PlayerExtraController,
  createPlayerExtraController,
  type BlockPosition,
  type BlockBreakingEventData,
} from './PlayerExtraController';

export {
  KillAura,
  KillAuraStrategy,
  createKillAura,
  type KillAuraConfig,
} from './KillAura';
