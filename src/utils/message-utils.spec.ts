import { parseMessage } from ".";
import { PIDF_LO } from "../constants/content-types";

describe('Message utils', () => {
  it('handles plain text', () => {
    const message = parseMessage({}, 'Hello');

    expect(message.text).toBe('Hello');
  });

  it('does not handle arbitrary content types as plain text', () => {
    const message = parseMessage({}, '<xml></xml>', PIDF_LO);

    expect(message.text).toBeUndefined();
  });
});