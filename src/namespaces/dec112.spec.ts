import { DEC112Specifics } from '.';
import { EndpointType, Message, MessageState, Origin } from '..';
import { EmergencyMessageType } from '../constants/message-types/emergency';
import { Logger, LogLevel } from '../models/logger';
import { Header } from '../utils';
import { DEC112Mapper } from './dec112';
import { MessagePartsParams } from './interfaces';

const logger = new Logger(LogLevel.NONE);

const mapper = new DEC112Mapper(logger, new DEC112Specifics({
  clientVersion: '1.2.3',
  language: 'de',
  registrationId: '098-765-432-21',
  deviceId: '123-456-789',
}));

describe('Generating headers', () => {
  const defaultParams: MessagePartsParams = {
    endpointType: EndpointType.CLIENT,
    isTest: false,
    isSilent: false,
    replyToSipUri: 'sip:reply-to@dec112.at',
    targetUri: 'sip:target@dec112.at',

    message: new Message({
      id: 67,
      // @ts-expect-error fake conversation in order to avoid a lot of work :-)
      conversation: {
        id: 'cid-1',
      },
      origin: Origin.LOCAL,
      promise: Promise.resolve(),
      state: MessageState.PENDING,
      type: EmergencyMessageType.IN_CHAT,
    })
  };

  it('contains all necessary headers with defaults', () => {
    const mapper = new DEC112Mapper(logger);
    const parts = mapper.createSipParts(defaultParams);

    expect(parts.headers.length).toBe(4);

    expect(parts.headers).toContainEqual<Header>({ key: "History-Info", value: "<sip:target@dec112.at>;index=1" });
    expect(parts.headers).toContainEqual<Header>({ key: "Call-Info", value: "<urn:dec112:uid:callid:cid-1:service.dec112.at>; purpose=dec112-CallId" });
    expect(parts.headers).toContainEqual<Header>({ key: "Call-Info", value: "<urn:dec112:uid:msgid:67:service.dec112.at>; purpose=dec112-MsgId" });
    expect(parts.headers).toContainEqual<Header>({ key: "Call-Info", value: "<urn:dec112:uid:msgtype:2:service.dec112.at>; purpose=dec112-MsgType" });
  });

  it('can use custom values', () => {
    const parts = mapper.createSipParts({
      ...defaultParams,
      isTest: true,
      isSilent: true,
    });

    expect(parts.headers.length).toBe(10);

    expect(parts.headers).toContainEqual<Header>({ key: "History-Info", value: "<sip:target@dec112.at>;index=1" });
    expect(parts.headers).toContainEqual<Header>({ key: "Call-Info", value: "<urn:dec112:uid:callid:cid-1:service.dec112.at>; purpose=dec112-CallId" });
    expect(parts.headers).toContainEqual<Header>({ key: "Call-Info", value: "<urn:dec112:uid:msgid:67:service.dec112.at>; purpose=dec112-MsgId" });
    expect(parts.headers).toContainEqual<Header>({ key: "Call-Info", value: "<urn:dec112:uid:msgtype:2:service.dec112.at>; purpose=dec112-MsgType" });
    expect(parts.headers).toContainEqual<Header>({ key: "Call-Info", value: "<urn:dec112:uid:deviceid:123-456-789:service.dec112.at>; purpose=dec112-DeviceId" });
    expect(parts.headers).toContainEqual<Header>({ key: "Call-Info", value: "<urn:dec112:uid:regid:098-765-432-21:service.dec112.at>; purpose=dec112-RegId" });
    expect(parts.headers).toContainEqual<Header>({ key: "Call-Info", value: "<urn:dec112:uid:clientversion:1.2.3:service.dec112.at>; purpose=dec112-ClientVer" });
    expect(parts.headers).toContainEqual<Header>({ key: "Call-Info", value: "<urn:dec112:uid:language:de:service.dec112.at>; purpose=dec112-Lang" });
    expect(parts.headers).toContainEqual<Header>({ key: "X-Dec112-Silent", value: "True" });
    expect(parts.headers).toContainEqual<Header>({ key: "X-Dec112-Test", value: "True" });
  });
});

describe('Checking SIP headers', () => {
  it('correctly identifies DEC112 calls by their call id header', () => {
    const headers: string[] = [
      'Call-Info: <urn:dec112:uid:callid:HikuhzM8Md65cFdpRreTJIcXUCgNvc:service.dec112.at>; purpose=dec112-CallId',
      'Call-Info: <urn:dec112:uid:msgid:1:service.dec112.at>; purpose=dec112-MsgId',
      'Call-Info: <urn:dec112:uid:msgtype:13:service.dec112.at>; purpose=dec112-MsgType',
      'Call-Info: <urn:dec112:uid:regid:1234567890:service.dec112.at>; purpose=dec112-RegId',
    ]

    expect(mapper.isCompatible(headers)).toBe(true);
  })

  it('does not wrongly detect ETSI calls as DEC112 calls just because some DEC112 headers are present', () => {
    const headers: string[] = [
      'Call-Info: <urn:emergency:uid:callid:PwoTTnJlCh0tVsVVnTx4CXNenn23N0:dec112.at>; purpose=EmergencyCallData.CallId',
      'Call-Info: <urn:emergency:service:uid:msgid:1:dec112.at>; purpose=EmergencyCallData.MsgId',
      'Call-Info: <urn:emergency:service:uid:msgtype:257:dec112.at>; purpose=EmergencyCallData.MsgType',
      'Call-Info: <urn:dec112:endpoint:test:service.dec112.at>;purpose=dec112-ServiceId',
    ]

    expect(mapper.isCompatible(headers)).toBe(false);
  })
});