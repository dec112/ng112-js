import { EmergencyMessageType } from '../constants/message-types/emergency';
import { ConversationEndpointType } from '../models/conversation';
import { Logger, LogLevel } from '../models/logger';
import { EmergencyMapper } from './emergency';

const logger = new Logger(LogLevel.NONE);

describe('Checking call info headers', () => {
  const mapper = new EmergencyMapper(logger);

  const validCallId = '12345qwertz';
  const validCallIdHeaders = [
    `Call Info: <urn:emergency:uid:callid:${validCallId}:dec112.at>; purpose=EmergencyCallData.CallId`,
    `Call Info: <urn:emergency:uid:callid:${validCallId}:some.very.long.domain>; purpose=EmergencyCallData.CallId`,
    `Call Info: <urn:emergency:uid:callid:${validCallId}:some.very.long.domain.with.lots.of.spaces>;            purpose=EmergencyCallData.CallId`,
    `Call Info: <urn:emergency:uid:callid:${validCallId}:without.space>;purpose=EmergencyCallData.CallId`,
    `Invalid: <urn:emergency:uid:callid:${validCallId}:dec112.at>; purpose=EmergencyCallData.CallId`,
  ];

  it.each(validCallIdHeaders)('should handle call info header %s', (header) => {
    expect(mapper.getCallIdFromHeaders([header])).toBe(validCallId);
  });

  const invalidCallId = '12345+*?~#"asdf';
  it('should gracefully accept invalid call id', () => {
    expect(mapper.getCallIdFromHeaders([`Call Info: <urn:emergency:uid:callid:${invalidCallId}:dec112.at>; purpose=EmergencyCallData.CallId`]))
      .toBe(invalidCallId);
  });

  const invalidCallIdHeaders = [
    'something',
    `Call Info: <urn:emergency:uid:${validCallId}:dec112.at>; purpose=EmergencyCallData.CallId`,
    `Call Info: <urn:emergency:uid:callid:${validCallId}:typo.com>; prurpose=EmergencyCallData.CallId`,
  ];

  it.each(invalidCallIdHeaders)('should handle invalid call info header %s', (header) => {
    expect(mapper.getCallIdFromHeaders([header])).toBe(undefined);
  });

  const validDID = 'did:example:123456789abcdefghi';
  const validDIDHeaders = [
    `Call-Info: <${validDID}>;purpose=EmergencyCallData.DID`,
  ]
  it.each(validDIDHeaders)('should be able to handle DID %s', (header) => {
    expect(mapper.getDIDFromHeaders([header])).toBe(validDID)
  });
});

describe('Messaging functionality', () => {
  const mapper = new EmergencyMapper(logger);

  it('creates an empty message correctly', () => {
    const parts = mapper.createMessageParts({
      targetUri: 'sip:some.emergency@call.at',
      conversationId: '1234',
      endpointType: ConversationEndpointType.CLIENT,
      isTest: false,
      id: 1,
      type: EmergencyMessageType.HEARTBEAT,
      replyToSipUri: 'sip:test@domain.com',
    });

    const body = parts.multipart.create().body;

    // no output, not even multipart closing delimiter
    // just an empty string
    expect(body).toBe('');
  });
});