export type Timeout = number | NodeJS.Timeout;

const getGlobal = () => {
  if (typeof self !== 'undefined') return self;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  throw new Error('unable to locate global object');
};

export const setInterval = (timeout: number, callback: () => unknown): Timeout => {
  return getGlobal().setInterval(callback, timeout);
}

export const clearInterval = (interval: Timeout): void => {
  // @ts-expect-error
  getGlobal().clearInterval(interval);
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