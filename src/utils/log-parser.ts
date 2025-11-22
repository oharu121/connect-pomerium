/**
 * Type definition for structured log entries from pomerium-cli
 * Based on zerolog JSON format introduced in pomerium-cli v0.29.0
 */
export interface PomeriumLogEntry {
  /**
   * Log level
   */
  level: 'info' | 'error' | 'warn' | 'debug';

  /**
   * Log message
   */
  message: string;

  /**
   * Component that generated the log (e.g., "tunnel", "pick-tcp-tunneler")
   */
  component?: string;

  /**
   * Address (e.g., "[::]:8443" when listener starts)
   */
  addr?: string;

  /**
   * Authentication URL when auth is required
   */
  'auth-url'?: string;

  /**
   * Error message (when level is "error")
   */
  error?: string;

  /**
   * Signal name (e.g., "interrupt" when Ctrl+C is pressed)
   */
  signal?: string;

  /**
   * Timestamp in RFC3339 format
   */
  time?: string;

  /**
   * Allow additional fields from zerolog
   */
  [key: string]: unknown;
}

/**
 * Parses a JSON log line from pomerium-cli into a structured log entry
 *
 * @param line - A single line of output from pomerium-cli
 * @returns Parsed log entry, or null if the line is not valid JSON
 *
 * @example
 * ```typescript
 * const line = '{"level":"info","message":"connected","time":"2025-11-23T00:43:55+09:00"}';
 * const log = parsePomeriumLog(line);
 * if (log && log.message === 'connected') {
 *   console.log('Connection established!');
 * }
 * ```
 */
export function parsePomeriumLog(line: string): PomeriumLogEntry | null {
  try {
    const parsed = JSON.parse(line);

    // Basic validation - must have level and message
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'level' in parsed &&
      'message' in parsed
    ) {
      return parsed as PomeriumLogEntry;
    }

    return null;
  } catch {
    // Not valid JSON
    return null;
  }
}

/**
 * Extracts authentication URL from plain text output
 * Used as fallback for the browser message which is not in JSON format
 *
 * @param line - A line of plain text output
 * @returns Extracted URL, or null if no URL found
 *
 * @example
 * ```typescript
 * const line = 'Your browser has been opened to visit:\n\nhttps://auth.example.com/...\n';
 * const url = extractAuthUrl(line);
 * console.log(url); // "https://auth.example.com/..."
 * ```
 */
export function extractAuthUrl(line: string): string | null {
  // Match HTTP(S) URLs in the text
  const match = line.match(/https?:\/\/[^\s\n]+/);
  return match ? match[0] : null;
}
