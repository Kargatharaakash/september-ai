export class TimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class HTTPError extends Error {
  status: number;
  statusText: string;
  body?: any;
  constructor(status: number, statusText: string, body?: any) {
    super(`HTTP Error ${status}: ${statusText}`);
    this.name = 'HTTPError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

type FetchOptions = {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  retryOn?: (status: number) => boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchWithRetries(
  input: RequestInfo,
  init: RequestInit = {},
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 15_000,
    retries = 2,
    retryDelayMs = 500,
    retryOn = (status: number) => status >= 500 || status === 429,
    headers = {},
    signal,
  } = options;

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    attempt++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const mergedSignal = signal
      ? mergeAbortSignals(signal, controller.signal)
      : controller.signal;

    try {
      const res = await fetch(input, {
        ...init,
        headers: { ...(init.headers || {}), ...headers },
        signal: mergedSignal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        // Retry on server errors or explicit retryable statuses
        if (retryOn(res.status) && attempt <= retries) {
          const backoff = retryDelayMs * Math.pow(2, attempt - 1);
          await sleep(backoff);
          continue;
        }

        let body: any;
        try {
          body = await res.clone().json();
        } catch {
          try {
            body = await res.clone().text();
          } catch {
            body = undefined;
          }
        }

        throw new HTTPError(res.status, res.statusText, body);
      }

      return res;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err && err.name === 'AbortError') {
        lastError = new TimeoutError(`Request aborted after ${timeoutMs}ms`);
      } else {
        lastError = err;
      }

      // If last attempt, throw
      if (attempt > retries) {
        throw lastError;
      }

      // Otherwise backoff and retry
      const backoff = retryDelayMs * Math.pow(2, attempt - 1);
      await sleep(backoff);
    }
  }

  throw lastError ?? new Error('Unknown fetch error');
}

// Helper to combine AbortSignals
function mergeAbortSignals(signalA: AbortSignal, signalB: AbortSignal) {
  if (signalA.aborted) return signalA;
  if (signalB.aborted) return signalB;

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signalA.addEventListener('abort', onAbort);
  signalB.addEventListener('abort', onAbort);
  return controller.signal;
}