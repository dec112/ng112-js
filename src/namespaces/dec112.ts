import { CALL_INFO, CONTENT_TRANSFER_ENCODING, CONTENT_TYPE } from '../constants/headers';
import { X_DEC112_TEST, X_DEC112_TEST_VALUE_TRUE } from '../constants/headers/dec112';
import { fromEmergencyMessageType, toEmergencyMessageType } from '../constants/message-types/dec112';
import { ConversationEndpointType } from '../models/conversation';
import { EmergencyMapper, getRegEx, regexHeaders } from './emergency';
import { MessageParts, MessagePartsParams, Namespace, NamespaceSpecifics } from './interfaces';
import { NewMessageEvent } from '../adapters';
import { Base64 } from '../utils/base64';
import { OmitStrict } from '../utils/ts-utils';
import { Message } from '../models/message';
import { Logger } from '../models/logger';

const UID = 'uid';

const getCallInfoHeader = (uri: string[], value: string, domain: string, type: string) =>
  `<urn:dec112:${uri.join(':')}:${value}:${domain}>; purpose=dec112-${type}`;

const getCallIdHeaderValue = (callId: string, domain: string) => getCallInfoHeader(['uid', 'callid'], callId, domain, 'CallId');
const getMessageIdHeaderValue = (messageId: string, domain: string) => getCallInfoHeader(['uid', 'msgid'], messageId, domain, 'MsgId');
const getMessageTypeHeaderValue = (messageType: string, domain: string) => getCallInfoHeader(['uid', 'msgtype'], messageType, domain, 'MsgType');

const getAnyHeaderValue = (value: string, domain: string) => getCallInfoHeader(['.+'], value, domain, '.+');

export interface DEC112Config {
  /**
   * @deprecated
   * 
   * Registration identifier of registration API version 1
   */
  deviceId?: string;
  /**
   * Registration identifier of registration API version 2
   */
  registrationId?: string;
  /**
   * User device language (ISO639-1 two letter language code)
   */
  langauge?: string;
  /**
   * Client version as SEMVER version code (version of application, where ng112-js is used in; e.g. `1.0.4`)
   */
  clientVersion?: string;
}

export class DEC112Specifics implements NamespaceSpecifics {
  constructor(
    public config: DEC112Config
  ) { }

  getDomain = () => 'service.dec112.at';
}

export class DEC112Mapper extends EmergencyMapper {
  private _dec112Specifics: DEC112Specifics;

  constructor(
    _logger: Logger,
    specifics?: DEC112Specifics,
  ) {
    super(_logger);

    this._dec112Specifics = this._specifics = specifics ?? new DEC112Specifics({});
  }

  getNamespace = () => Namespace.DEC112;
  // DEC112 does not have a specific message type for starting the conversation
  // ETSI standard specifies a dedicated START message
  supportsPsapStartMessage = (): boolean => false;

  isCompatible = (headers: string[]): boolean =>
    // checks if at least one element satisfies DEC112 call info headers
    headers.some(h => getRegEx(getAnyHeaderValue).test(h));

  getCallIdFromHeaders = (headers: string[]): string | undefined => regexHeaders(headers, getRegEx(getCallIdHeaderValue));
  getIsTestFromEvent = (evt: NewMessageEvent): boolean => evt.request.getHeader(X_DEC112_TEST) === X_DEC112_TEST_VALUE_TRUE;

  createMessageParts = ({
    targetUri,
    conversationId,
    isTest,
    id,
    type,
    endpointType,
    text,
    uris,
    binaries,
    extraParts,
    replyToSipUri,
    location,
    vcard,
  }: MessagePartsParams): MessageParts => {
    const common = this.createCommonParts(
      targetUri,
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

    const domain = this._dec112Specifics.getDomain();
    const headers = common.headers = [
      ...common.headers,
      { key: CALL_INFO, value: getCallIdHeaderValue(conversationId, domain) },
      { key: CALL_INFO, value: getMessageIdHeaderValue(id.toString(), domain) },
      { key: CALL_INFO, value: getMessageTypeHeaderValue(dec112MessageType.toString(), domain) },
    ];

    if (endpointType === ConversationEndpointType.CLIENT) {
      const spec = this._dec112Specifics.config;

      if (spec.deviceId)
        headers.push({ key: CALL_INFO, value: getCallInfoHeader([UID, 'deviceid'], spec.deviceId, domain, 'DeviceId') });

      if (spec.registrationId)
        headers.push({ key: CALL_INFO, value: getCallInfoHeader([UID, 'regid'], spec.registrationId, domain, 'RegId') });

      if (spec.clientVersion)
        headers.push({ key: CALL_INFO, value: getCallInfoHeader([UID, 'clientversion'], spec.clientVersion, domain, 'ClientVer') });

      if (spec.langauge)
        headers.push({ key: CALL_INFO, value: getCallInfoHeader([UID, 'language'], spec.langauge, domain, 'Lang') });
    }

    if (isTest)
      headers.push({
        key: X_DEC112_TEST,
        value: X_DEC112_TEST_VALUE_TRUE,
      });

    if (binaries) {
      for (const bin of binaries) {
        const body = Base64.encode(String.fromCharCode.apply(null, new Uint8Array(bin.value) as unknown as number[]));

        common.multipart.add({
          headers: [
            { key: CONTENT_TYPE, value: bin.mimeType },
            // this is the only one that's currently supported
            { key: CONTENT_TRANSFER_ENCODING, value: 'base64' },
          ],
          body,
        });
      }
    }

    return common;
  }

  parseMessageFromEvent = (evt: NewMessageEvent): OmitStrict<Message, 'conversation'> => this.parseCommonMessageFromEvent(evt);

  // DEC112 overrides
  getMessageIdFromHeaders = (headers: string[]): string | undefined => regexHeaders(headers, getRegEx(getMessageIdHeaderValue));
  getMessageTypeFromHeaders = (headers: string[], messageText?: string): number | undefined => {
    const msgType = regexHeaders(headers, getRegEx(getMessageTypeHeaderValue));

    if (msgType)
      return toEmergencyMessageType(parseInt(msgType), messageText);

    return;
  }
}