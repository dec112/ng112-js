import { isValidUri } from ".";

describe('URI utils', () => {
  const validURIs = [
    'http://www.ics.uci.edu/pub/ietf/uri/#Related',
    'https://www.example.com/foo/?bar=baz&inga=42&quux',
    'ws://test.com?asdf=xxx',
    'ws://test.com?asdf=',
    'exp://a.deep.link:80/to/somewhere'
  ];

  it.each(validURIs)('should detect %s as correct URI', (uri) => {
    expect(isValidUri(uri)).toBe(true);
  });

  const invalidURIs = [
    'asdf',
    '.:x',
    '//a',
    'http://../',
    ':// should fail',
    'http://foo.bar?q=Spaces should be encoded',
  ];

  it.each(invalidURIs)('should detect %s as incorrect uri', (uri) => {
    expect(isValidUri(uri)).toBe(false);
  });
});