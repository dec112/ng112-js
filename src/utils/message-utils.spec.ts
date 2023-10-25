import { parseMessage } from ".";
import { PIDF_LO, TEXT_PLAIN } from "../constants/content-types";

describe('Message utils', () => {
  it('handles plain text', () => {
    const { multipart } = parseMessage({}, 'Hello');
    const text = multipart?.getPartsByContentTypes([TEXT_PLAIN])[0].body;

    expect(text).toBe('Hello');
  });

  it('does not handle arbitrary content types as plain text', () => {
    const {multipart} = parseMessage({}, '<xml></xml>', PIDF_LO);

    expect(multipart).not.toBeUndefined();
    expect(multipart?.getPartsByContentTypes([TEXT_PLAIN]).length).toBe(0);
  });
});