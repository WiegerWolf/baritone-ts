/**
 * DeathMenuChain - Death Screen and Reconnection Handler
 * Based on AltoClef's DeathMenuChain.java
 *
 * Handles automatic respawning when the player dies and
 * optional auto-reconnection when disconnected from servers.
 *
 * This chain runs at DEATH priority (highest) when active
 * to ensure the player respawns quickly.
 *
 * Key behaviors:
 * - Waits a brief period before respawning (to see death message)
 * - Tracks death count for statistics
 * - Can execute commands on death (configurable)
 * - Handles reconnection to multiplayer servers
 */

import type { Bot } from 'mineflayer';
import { TaskChain, ChainPriority } from '../tasks/TaskChain';
import { Task } from '../tasks/Task';
import { TimerGame } from '../utils/timers/TimerGame';
import { TimerReal } from '../utils/timers/TimerReal';

/**
 * Configuration for death handling
 */
export interface DeathMenuConfig {
  /** Enable auto-respawn on death (default: true) */
  autoRespawn: boolean;
  /** Delay before respawning in seconds (default: 2) */
  respawnDelay: number;
  /** Enable auto-reconnect on disconnect (default: false) */
  autoReconnect: boolean;
  /** Delay before reconnecting in seconds (default: 5) */
  reconnectDelay: number;
  /** Maximum reconnection attempts (default: 3) */
  maxReconnectAttempts: number;
  /** Command to execute on death (optional) */
  onDeathCommand?: string;
  /** Callback when player dies */
  onDeath?: (deathMessage: string, deathCount: number) => void;
  /** Callback when reconnecting */
  onReconnect?: (attempt: number) => void;
  /** Cancel current task on death if not auto-respawning (default: true) */
  cancelTaskOnDeath: boolean;
}

const DEFAULT_CONFIG: DeathMenuConfig = {
  autoRespawn: true,
  respawnDelay: 2,
  autoReconnect: false,
  reconnectDelay: 5,
  maxReconnectAttempts: 3,
  cancelTaskOnDeath: true,
};

/**
 * State for death/disconnect handling
 */
enum DeathState {
  ALIVE,
  DEAD_WAITING,
  RESPAWNING,
  DISCONNECTED,
  RECONNECTING,
}

/**
 * Task that handles the respawn process
 */
class RespawnTask extends Task {
  readonly displayName = 'Respawn';
  private respawned: boolean = false;

  onStart(): void {
    this.respawned = false;
  }

  onTick(): Task | null {
    // In mineflayer, respawning is typically automatic
    // but we can check if the player is alive
    if (this.bot.health > 0) {
      this.respawned = true;
    }
    return null;
  }

  isFinished(): boolean {
    return this.respawned;
  }
}

/**
 * DeathMenuChain - Handles death and reconnection
 */
export class DeathMenuChain extends TaskChain {
  readonly displayName = 'DeathMenuChain';

  private config: DeathMenuConfig;
  private state: DeathState = DeathState.ALIVE;
  private deathCount: number = 0;
  private lastDeathMessage: string = '';
  private reconnectAttempts: number = 0;

  // Timers
  private respawnWaitTimer: TimerGame;
  private reconnectTimer: TimerReal;
  private deathRetryTimer: TimerReal;

  // Server info for reconnection
  private lastServerHost?: string;
  private lastServerPort?: number;

  // Event listeners
  private boundOnDeath: () => void;
  private boundOnSpawn: () => void;
  private boundOnEnd: (reason: string) => void;
  private boundOnError: (error: Error) => void;

  constructor(bot: Bot, config: Partial<DeathMenuConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.respawnWaitTimer = new TimerGame(bot, this.config.respawnDelay);
    this.reconnectTimer = new TimerReal(this.config.reconnectDelay);
    this.deathRetryTimer = new TimerReal(8); // Retry after 8 seconds if stuck

    // Bind event handlers
    this.boundOnDeath = this.onPlayerDeath.bind(this);
    this.boundOnSpawn = this.onPlayerSpawn.bind(this);
    this.boundOnEnd = this.onDisconnect.bind(this);
    this.boundOnError = this.onConnectionError.bind(this);

    // Register event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.bot.on('death', this.boundOnDeath);
    this.bot.on('spawn', this.boundOnSpawn);
    this.bot.on('end', this.boundOnEnd);
    this.bot.on('error', this.boundOnError);
  }

  /**
   * Clean up event listeners when done
   */
  dispose(): void {
    this.bot.removeListener('death', this.boundOnDeath);
    this.bot.removeListener('spawn', this.boundOnSpawn);
    this.bot.removeListener('end', this.boundOnEnd);
    this.bot.removeListener('error', this.boundOnError);
  }

  private onPlayerDeath(): void {
    if (this.state !== DeathState.ALIVE) return;

    this.state = DeathState.DEAD_WAITING;
    this.deathCount++;
    this.lastDeathMessage = 'Player died'; // mineflayer doesn't provide death message easily

    // Reset timer to wait before respawning
    this.respawnWaitTimer.reset();
    this.deathRetryTimer.reset();

    // Call death callback if configured
    if (this.config.onDeath) {
      this.config.onDeath(this.lastDeathMessage, this.deathCount);
    }
  }

  private onPlayerSpawn(): void {
    // Player has respawned
    if (this.state === DeathState.RESPAWNING || this.state === DeathState.DEAD_WAITING) {
      this.state = DeathState.ALIVE;
    }

    // Successful reconnection
    if (this.state === DeathState.RECONNECTING) {
      this.state = DeathState.ALIVE;
      this.reconnectAttempts = 0;
    }
  }

  private onDisconnect(reason: string): void {
    if (!this.config.autoReconnect) {
      return;
    }

    // Store server info for reconnection
    // Note: mineflayer stores connection info differently
    this.state = DeathState.DISCONNECTED;
    this.reconnectTimer.reset();
  }

  private onConnectionError(error: Error): void {
    // Handle connection errors during reconnection
    if (this.state === DeathState.RECONNECTING) {
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
        this.state = DeathState.ALIVE; // Give up
      } else {
        this.state = DeathState.DISCONNECTED;
        this.reconnectTimer.reset();
      }
    }
  }

  getPriority(): number {
    // Always runs in background with lowest priority
    // The actual priority handling is done through state
    if (this.state === DeathState.DEAD_WAITING || this.state === DeathState.RESPAWNING) {
      return ChainPriority.DEATH;
    }
    return ChainPriority.INACTIVE;
  }

  isActive(): boolean {
    return this.state !== DeathState.ALIVE;
  }

  onTick(): void {
    switch (this.state) {
      case DeathState.ALIVE:
        // Nothing to do
        break;

      case DeathState.DEAD_WAITING:
        this.handleDeadWaiting();
        break;

      case DeathState.RESPAWNING:
        this.handleRespawning();
        break;

      case DeathState.DISCONNECTED:
        this.handleDisconnected();
        break;

      case DeathState.RECONNECTING:
        // Waiting for connection to establish
        break;
    }

    // Run main task if any
    super.onTick();
  }

  private handleDeadWaiting(): void {
    // Check if auto-respawn is disabled
    if (!this.config.autoRespawn) {
      if (this.config.cancelTaskOnDeath) {
        // Signal that task should be cancelled
        // The TaskRunner should handle this
      }
      return;
    }

    // Wait for respawn delay
    if (!this.respawnWaitTimer.elapsed()) {
      return;
    }

    // Execute death command if configured
    if (this.config.onDeathCommand) {
      this.executeDeathCommand();
    }

    // Attempt respawn
    this.state = DeathState.RESPAWNING;
    this.triggerRespawn();
  }

  private handleRespawning(): void {
    // Check if we're alive again
    if (this.bot.health > 0) {
      this.state = DeathState.ALIVE;
      return;
    }

    // Retry respawn if stuck
    if (this.deathRetryTimer.elapsed()) {
      this.triggerRespawn();
      this.deathRetryTimer.reset();
    }
  }

  private handleDisconnected(): void {
    if (!this.reconnectTimer.elapsed()) {
      return;
    }

    // Attempt reconnection
    this.state = DeathState.RECONNECTING;
    this.reconnectAttempts++;

    if (this.config.onReconnect) {
      this.config.onReconnect(this.reconnectAttempts);
    }

    this.attemptReconnect();
  }

  private triggerRespawn(): void {
    // In mineflayer, we need to send the respawn packet
    // The respawn method may vary by mineflayer version
    try {
      // mineflayer-specific respawn handling
      // The 'respawn' event is automatic in most cases
      // but we can try clicking the respawn button by sending the right packet

      // For newer versions of mineflayer with client respawn support:
      const client = (this.bot as any)._client;
      if (client && typeof client.write === 'function') {
        client.write('client_command', { action: 0 }); // 0 = perform respawn
      }
    } catch (err) {
      // Respawn failed, will retry
    }
  }

  private attemptReconnect(): void {
    // Reconnection in mineflayer typically requires creating a new bot
    // This is usually handled at the application level, not here
    // We emit an event that the application can handle

    this.bot.emit('reconnect_requested' as any, {
      host: this.lastServerHost,
      port: this.lastServerPort,
      attempt: this.reconnectAttempts,
    });
  }

  private executeDeathCommand(): void {
    if (!this.config.onDeathCommand) return;

    try {
      const command = this.config.onDeathCommand
        .replace('{deathmessage}', this.lastDeathMessage)
        .replace('{deathcount}', this.deathCount.toString());

      if (command.startsWith('/')) {
        this.bot.chat(command);
      } else {
        this.bot.chat(command);
      }
    } catch (err) {
      // Command execution failed
    }
  }

  // ---- Public API ----

  /**
   * Get the current death count
   */
  getDeathCount(): number {
    return this.deathCount;
  }

  /**
   * Reset death count
   */
  resetDeathCount(): void {
    this.deathCount = 0;
  }

  /**
   * Get the last death message
   */
  getLastDeathMessage(): string {
    return this.lastDeathMessage;
  }

  /**
   * Get current state
   */
  getCurrentState(): DeathState {
    return this.state;
  }

  /**
   * Check if player is dead
   */
  isDead(): boolean {
    return this.state === DeathState.DEAD_WAITING || this.state === DeathState.RESPAWNING;
  }

  /**
   * Check if currently reconnecting
   */
  isReconnecting(): boolean {
    return this.state === DeathState.RECONNECTING || this.state === DeathState.DISCONNECTED;
  }

  /**
   * Get reconnect attempt count
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<DeathMenuConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.respawnDelay !== undefined) {
      this.respawnWaitTimer.setInterval(config.respawnDelay);
    }
    if (config.reconnectDelay !== undefined) {
      this.reconnectTimer.setInterval(config.reconnectDelay);
    }
  }

  /**
   * Manually trigger respawn (useful if auto-respawn is disabled)
   */
  manualRespawn(): void {
    if (this.state === DeathState.DEAD_WAITING) {
      this.state = DeathState.RESPAWNING;
      this.triggerRespawn();
    }
  }

  /**
   * Force reconnection attempt
   */
  forceReconnect(): void {
    if (this.state === DeathState.DISCONNECTED) {
      this.reconnectTimer.forceElapsed();
    }
  }

  /**
   * Get debug info
   */
  getDebugInfo(): string {
    return [
      `DeathMenuChain`,
      `  State: ${DeathState[this.state]}`,
      `  Deaths: ${this.deathCount}`,
      `  Reconnect attempts: ${this.reconnectAttempts}`,
      `  Last death: ${this.lastDeathMessage || 'none'}`,
      `  Health: ${this.bot.health}`,
    ].join('\n');
  }
}

// Export the state enum for external use
export { DeathState };
