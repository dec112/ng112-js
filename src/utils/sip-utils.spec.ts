import { parseNameAddrHeaderValue } from ".";

describe('SIP utils', () => {
  it('should parse name address headers', () => {
    expect(parseNameAddrHeaderValue('<sip:default@some.psap.com;transport=tcp;lr>\r\n')).toEqual({
      displayName: undefined,
      uri: 'sip:default@some.psap.com;transport=tcp;lr'
    });

    expect(parseNameAddrHeaderValue(' <sip:with-some-special-chars.com/api/v1>')).toEqual({
      displayName: undefined,
      uri: 'sip:with-some-special-chars.com/api/v1'
    });

    expect(parseNameAddrHeaderValue('DEC112 Team-Display-Name <sip:default@something;transport=tls>\r\n')).toEqual({
      displayName: 'DEC112 Team-Display-Name',
      uri: 'sip:default@something;transport=tls'
    });

    expect(parseNameAddrHeaderValue('DEC112 Team-Display-Name <invalid')).toEqual(undefined);

    // Call-Info header value
    expect(parseNameAddrHeaderValue('<urn:dec112:uid:msgid:1:service.dec112.at>; purpose=dec112-MsgId\r\n')).toEqual({
      displayName: undefined,
      uri: 'urn:dec112:uid:msgid:1:service.dec112.at',
    });
  });

  it('should parse normal SIP URIs headers', () => {
    expect(parseNameAddrHeaderValue(' sip:default@something;transport=tls ')).toEqual({
      displayName: undefined,
      uri: 'sip:default@something;transport=tls',
    });
  });
});