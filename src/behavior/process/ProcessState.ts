/**
 * Process state
 */

export enum ProcessState {
    IDLE,      // Not doing anything
    ACTIVE,    // Currently running
    PAUSED,    // Temporarily paused
    COMPLETE,  // Finished successfully
    FAILED     // Failed to complete
}
