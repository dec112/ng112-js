import { DEC112Specifics } from '.';
import { EndpointType, Message, MessageState, Origin } from '..';
import { EmergencyMessageType } from '../constants/message-types/emergency';
import { Logger, LogLevel } from '../models/logger';
import { Header } from '../utils';
import { DEC112Mapper } from './dec112';
import { MessagePartsParams } from './interfaces';

const logger = new Logger(LogLevel.NONE);

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
    const mapper = new DEC112Mapper(logger, new DEC112Specifics({
      clientVersion: '1.2.3',
      langauge: 'de',
      registrationId: '098-765-432-21',
      deviceId: '123-456-789',
    }));
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