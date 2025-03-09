
/**
 * Simple utility for consistent logging throughout the application
 * @param message The message to log
 * @param source Optional source identifier
 */
export function log(message: string, source?: string): void {
  const timestamp = new Date().toLocaleTimeString();
  const sourcePrefix = source ? `[${source}] ` : '';
  console.log(`${timestamp} ${sourcePrefix}${message}`);
}
