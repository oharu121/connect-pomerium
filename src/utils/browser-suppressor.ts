import os from 'node:os';

/**
 * Returns a cross-platform command that does nothing (no-op).
 * Used with Pomerium CLI's --browser-cmd flag to suppress browser launch.
 *
 * @returns A command string that executes successfully but does nothing
 *
 * @example
 * // On Windows
 * getBrowserSuppressCommand(); // Returns 'cmd /c exit'
 *
 * @example
 * // On Unix (macOS, Linux)
 * getBrowserSuppressCommand(); // Returns 'true'
 */
export function getBrowserSuppressCommand(): string {
  if (os.platform() === 'win32') {
    // Windows: 'cmd /c exit' exits immediately without doing anything
    return 'cmd /c exit';
  } else {
    // Unix (macOS, Linux): 'true' is a built-in command that always succeeds
    return 'true';
  }
}
