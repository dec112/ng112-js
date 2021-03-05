export type Timeout = number | NodeJS.Timeout;

export const setInterval = (timeout: number, callback: () => unknown): Timeout => {
  if (typeof window !== 'undefined')
    return window.setInterval(callback, timeout);
  else
    return globalThis.setInterval(callback, timeout);
}

export const clearInterval = (interval: Timeout): void => {
  if (typeof interval === 'number')
    window.clearInterval(interval);
  else
    globalThis.clearInterval(interval);
}