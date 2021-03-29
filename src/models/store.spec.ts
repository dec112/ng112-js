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
})