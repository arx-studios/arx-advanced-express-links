export class TimeoutError extends Error {}

// Rejects if `promise` hasn't settled within `ms`. The underlying work isn't
// cancelled: a slow Redis command still completes later, its result ignored.
export function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`${what} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
