import { Store, defaultHeartbeatInterval } from "./store";

describe('Store', () => {
  it('should handle heartbeat settings correctly', () => {
    const store = new Store('');

    expect(store.getHeartbeatInterval()).toBe(defaultHeartbeatInterval);

    store.setHeartbeatInterval(5000);
    expect(store.getHeartbeatInterval()).toBe(5000);

    // test intervals that are out of range
    expect(() => store.setHeartbeatInterval(20001)).toThrow();
    expect(() => store.setHeartbeatInterval(-1)).toThrow();

    // if no parameter is provided we expect it to be reset to default value
    store.setHeartbeatInterval();
    expect(store.getHeartbeatInterval()).toBe(defaultHeartbeatInterval);
  });

  it('should be possible to subscribe for heartbeat interval changes', () => {
    const store = new Store('');
    const newInterval = 5000;

    store.addHeartbeatIntervalListener((interval) => {
      expect(interval).toBe(newInterval);
      expect(store.getHeartbeatInterval()).toBe(newInterval);
    });
  });

  it('should be possible to unsubscribe from heartbeat interval changes', () => {
    const store = new Store('');
    let newInterval = 5000;

    const callback = jest.fn(() => undefined);

    store.addHeartbeatIntervalListener(callback);
    store.setHeartbeatInterval(newInterval);
    expect(callback).toBeCalledTimes(1);

    newInterval = 2000;
    store.setHeartbeatInterval(newInterval);
    expect(callback).toBeCalledTimes(2);

    store.removeHeartbeatIntervalListener(callback);

    newInterval = 1000;
    store.setHeartbeatInterval(newInterval);
    expect(callback).toBeCalledTimes(2);
  });

  it('should not call heartbeat listener twice if same value is set again', () => {
    const store = new Store('');
    const newInterval = 5000;

    const callback = jest.fn(() => undefined);

    store.addHeartbeatIntervalListener(callback);
    store.setHeartbeatInterval(newInterval);
    expect(callback).toBeCalledTimes(1);

    store.setHeartbeatInterval(newInterval);
    expect(callback).toBeCalledTimes(1);
  });
})