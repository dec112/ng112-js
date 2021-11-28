import { nextUniqueId, nextUniqueRandomId } from "./message";

describe('Message capabilities', () => {
  it('should provide a unique sequence', () => {
    expect(nextUniqueId()).toBe(0);
    expect(nextUniqueId()).toBe(1);
    expect(nextUniqueId()).toBe(2);
  });

  it('should provide a unique sequence containing randomization', () => {
    const uniqueId = nextUniqueRandomId();
    expect(uniqueId.length).toBeGreaterThan(20);
    expect(uniqueId.substr(-1)).toBe('3');
  });
})