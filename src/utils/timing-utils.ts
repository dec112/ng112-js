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

/**
 * This function ensures that resolving a promise does not take longer than the specified timeout
 * 
 * @param promise A promise
 * @param timeout The timeout after which the execution will be ended
 */
export const timedoutPromise = <T>(promise: Promise<T>, timeout: number): Promise<T> => {
  return new Promise<T>(async (resolve, reject) => {
    const t = setTimeout(() => reject(), timeout);
    try {
      resolve(await promise);
    } catch (e) {
      reject(e);
    } finally {
      clearTimeout(t);
    }
  });
}