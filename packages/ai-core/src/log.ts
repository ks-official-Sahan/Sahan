// A minimal logger seam. Pass your own (pino, console, the app's logger) as
// `logger` where an API accepts one; the default writes one JSON line to
// stderr, so provider failures are never silent.

export interface AiLogger {
  warn(message: string, meta?: Record<string, unknown>): void;
}

export const consoleAiLogger: AiLogger = {
  warn(message, meta) {
    console.warn(JSON.stringify({ level: "warn", message, ...meta }));
  },
};
