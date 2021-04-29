import { nextUniqueId } from "./message";

describe('Message capabilities', () => {
  it ('Should provide a unique sequence', () => {
    expect(nextUniqueId()).toBe(0);
    expect(nextUniqueId()).toBe(1);
    expect(nextUniqueId()).toBe(2);
  });
})