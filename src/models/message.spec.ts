import { CONTENT_TYPE, Message, MessageState, Multipart, MultipartPart, Origin } from "..";
import { TEXT_HTML, TEXT_PLAIN } from "../constants/content-types";
import { nextUniqueId, nextUniqueRandomId } from "./message";

describe('Message utilities', () => {
  it('should provide a unique sequence', () => {
    expect(nextUniqueId()).toBe(0);
    expect(nextUniqueId()).toBe(1);
    expect(nextUniqueId()).toBe(2);
  });

  it('should provide a unique sequence containing randomization', () => {
    const uniqueId = nextUniqueRandomId();
    expect(uniqueId.length).toBeGreaterThan(20);
    expect(uniqueId.substring(uniqueId.length - 1)).toBe('3');
  });
});

const getMultipart = (contentType: string, body: string): MultipartPart => {
  return {
    headers: [
      { key: CONTENT_TYPE, value: contentType },
    ],
    body,
  };
}

const mp = new Multipart();
mp.addAll([
  getMultipart(TEXT_PLAIN, 'Plain 1\nPlain 2\n'),
  getMultipart(TEXT_HTML, '<b>HTML 1</b>'),
  getMultipart(TEXT_HTML, '<i>HTML 2</i>'),
  getMultipart(TEXT_PLAIN, 'Plain 3'),
])

describe('Message Class', () => {
  it('should handle convenience properties', () => {
    const m = new Message({
      // @ts-expect-error don't pass conversation here as it is not needed for unit tests
      conversation: undefined,
      origin: Origin.LOCAL,
      promise: Promise.resolve(),
      state: MessageState.PENDING,
      multipart: mp,
    });

    expect(m.text).toBe('Plain 1\nPlain 2\n\nPlain 3');
    expect(m.html).toBe('<b>HTML 1</b>\n<i>HTML 2</i>');
  });
});