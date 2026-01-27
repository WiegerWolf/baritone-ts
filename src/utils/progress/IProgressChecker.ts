/**
 * IProgressChecker - Progress Checking Interface
 * Based on AltoClef's IProgressChecker.java
 *
 * Progress checkers detect when a task has stalled (no progress being made).
 * This is essential for stuck detection and recovery.
 */

/**
 * Generic interface for progress checking
 */
export interface IProgressChecker<T> {
  /**
   * Update the current progress value
   * @param progress The current progress measurement
   */
  setProgress(progress: T): void;

  /**
   * Check if the progress checker has detected a failure (stall)
   */
  failed(): boolean;

  /**
   * Reset the progress checker
   */
  reset(): void;
}

/**
 * Create a progress checker that wraps another and allows multiple retries
 */
export function withRetry<T>(
  checker: IProgressChecker<T>,
  maxRetries: number
): IProgressChecker<T> {
  let retryCount = 0;

  return {
    setProgress(progress: T): void {
      checker.setProgress(progress);
    },

    failed(): boolean {
      if (checker.failed()) {
        retryCount++;
        if (retryCount >= maxRetries) {
          return true;
        }
        checker.reset();
      }
      return false;
    },

    reset(): void {
      retryCount = 0;
      checker.reset();
    },
  };
}
