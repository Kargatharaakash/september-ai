// Minimal structured logger. Use LOG_LEVEL env (debug|info|warn|error|silent)
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const DEFAULT_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const CURRENT_LEVEL = LEVELS[DEFAULT_LEVEL] ?? LEVELS.info;

function shouldLog(level: LogLevel) {
  return LEVELS[level] >= CURRENT_LEVEL && CURRENT_LEVEL !== LEVELS.silent;
}

export function debug(...args: any[]) {
  if (shouldLog('debug')) console.debug('[debug]', ...args);
}
export function info(...args: any[]) {
  if (shouldLog('info')) console.info('[info]', ...args);
}
export function warn(...args: any[]) {
  if (shouldLog('warn')) console.warn('[warn]', ...args);
}
export function error(...args: any[]) {
  if (shouldLog('error')) console.error('[error]', ...args);
}