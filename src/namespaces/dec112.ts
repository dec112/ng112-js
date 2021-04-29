import { CALL_INFO } from '../constants/headers';
import { X_DEC112_TEST, X_DEC112_TEST_VALUE_TRUE } from '../constants/headers/dec112';
import { fromEmergencyMessageType, toEmergencyMessageType } from '../constants/message-types/dec112';
import { ConversationEndpointType } from '../models/conversation';
import { Header } from '../utils';
import type { PidfLo } from 'pidf-lo'
import { EmergencyMapper, getRegEx, regexHeaders } from './emergency';
import { MessageParts, MessagePartsParams, NamespacedConversation, NamespaceSpecifics } from './interfaces';
import { NewMessageEvent } from '../models/sip-agent';

const dec112Domain = 'service.dec112.at';
const getCallInfoHeader = (uri: string[], value: string, domain: string, type: string) =>
  `<urn:dec112:${uri.join(':')}:${value}:${domain}>; purpose=dec112-${type}`;

const getCallIdHeaderValue = (callId: string, domain: string) => getCallInfoHeader(['uid', 'callid'], callId, domain, 'CallId');
const getMessageIdHeaderValue = (messageId: string, domain: string) => getCallInfoHeader(['uid', 'msgid'], messageId, domain, 'MsgId');
const getMessageTypeHeaderValue = (messageType: string, domain: string) => getCallInfoHeader(['uid', 'msgtype'], messageType, domain, 'MsgType');

const getAnyHeaderValue = (value: string, domain: string) => getCallInfoHeader(['.+'], value, domain, '.+');

export class DEC112Specifics implements NamespaceSpecifics {
  constructor(
    /**
     * @deprecated
     * 
     * Registration identifier of registration API version 1
     */
    public deviceId?: string,
    /**
     * Registration identifier of registration API version 2
     */
    public registrationId?: string,
    /**
     * User device language (ISO639-1 two letter language code)
     */
    public langauge?: string,
    /**
     * Client version as SEMVER version code (version of application, where ng112-js is used in; e.g. `1.0.4`)
     */
    public clientVersion?: string,
  ) { }
  // TODO: support did
}

export class DEC112Mapper implements NamespacedConversation {
  constructor(
    public specifics?: DEC112Specifics
  ) { }

  getName = () => 'DEC112';
  // DEC112 allows starting a conversation by the client
  // ETSI standard only allows PSAP to finally start the conversation
  isStartConversationByClientAllowed = (): boolean => true;

  createMessageParts = ({
    conversationId,
    isTest,
    id,
    type,
    endpointType,
    text,
    uris,
    extraParts,
    replyToSipUri,
    location,
    vcard,
  }: MessagePartsParams): MessageParts => {
    const common = EmergencyMapper.createCommonParts(
      endpointType,
      replyToSipUri,
      text,
      uris,
      extraParts,
      location,
      vcard,
    );

    const dec112MessageType = fromEmergencyMessageType(type, {
      hasVCard: !!vcard,
      hasLocation: !!location,
      hasTextMessage: !!text,
    });

    const extraHeaders: Header[] = [
      ...common.headers,
      { key: CALL_INFO, value: getCallIdHeaderValue(conversationId, dec112Domain) },
      { key: CALL_INFO, value: getMessageIdHeaderValue(id.toString(), dec112Domain) },
      { key: CALL_INFO, value: getMessageTypeHeaderValue(dec112MessageType.toString(), dec112Domain) },
    ];

    if (endpointType === ConversationEndpointType.CLIENT) {
      const spec = this.specifics;

      if (spec?.deviceId)
        extraHeaders.push({ key: CALL_INFO, value: getCallInfoHeader(['uid', 'deviceid'], spec.deviceId, dec112Domain, 'DeviceId') });

      if (spec?.registrationId)
        extraHeaders.push({ key: CALL_INFO, value: getCallInfoHeader(['uid', 'regid'], spec.registrationId, dec112Domain, 'RegId') });

      if (spec?.clientVersion)
        extraHeaders.push({ key: CALL_INFO, value: getCallInfoHeader(['uid', 'clientversion'], spec.clientVersion, dec112Domain, 'ClientVer') });

      if (spec?.langauge)
        extraHeaders.push({ key: CALL_INFO, value: getCallInfoHeader(['uid', 'language'], spec.langauge, dec112Domain, 'Lang') });
    }

    if (isTest)
      extraHeaders.push({
        key: X_DEC112_TEST,
        value: X_DEC112_TEST_VALUE_TRUE,
      });

    return {
      headers: extraHeaders,
      contentType: common.contentType,
      body: common.body,
    };
  }

  tryParsePidfLo = (value: string): PidfLo | undefined => EmergencyMapper.tryParsePidfLo(value);

  isCompatible = (headers: string[]): boolean =>
    // checks if at least one element satisfies DEC112 call info headers
    headers.some(h => getRegEx(getAnyHeaderValue).test(h));


  getCallIdFromHeaders = (headers: string[]): string | undefined => regexHeaders(headers, getRegEx(getCallIdHeaderValue));
  getMessageIdFromHeaders = (headers: string[]): string | undefined => regexHeaders(headers, getRegEx(getMessageIdHeaderValue));
  getDIDFromHeaders = (headers: string[]): string | undefined => EmergencyMapper.getDIDFromHeaders(headers);
  getIsTestFromHeaders = (message: NewMessageEvent): boolean => message.getHeader(X_DEC112_TEST) === X_DEC112_TEST_VALUE_TRUE;
  getMessageTypeFromHeaders = (headers: string[], messageText?: string): number | undefined => {
    const msgType = regexHeaders(headers, getRegEx(getMessageTypeHeaderValue));

    if (msgType)
      return toEmergencyMessageType(parseInt(msgType), messageText);

    return;
  }
}