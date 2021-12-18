import { getRandomString, Header, parseMessage, } from '../utils';
import { PidfLo, XMLCompat } from 'pidf-lo/dist/node';
import { PIDF_LO, TEXT_PLAIN, CALL_SUB, TEXT_URI_LIST } from '../constants/content-types';
import { CALL_INFO, CONTENT_ID, CONTENT_TYPE, GEOLOCATION, GEOLOCATION_ROUTING, HISTORY_INFO, REPLY_TO } from '../constants/headers';
import { CRLF, Multipart, MultipartPart } from '../models/multipart';
import { VCard, VCARD_XML_NAMESPACE } from '../models/vcard';
import { MessageParts, MessagePartsParams, Namespace, Mapper } from './interfaces'
import { NewMessageEvent } from '../adapters';
import { Message, MessageState, nextUniqueId, nextUniqueRandomId } from '../models/message';
import { EmergencyMessageType } from '../constants/message-types/emergency';
import { OmitStrict } from '../utils/ts-utils';
import { Logger } from '../models/logger';
import { NamespaceSpecifics } from '.';
import { EndpointType } from '../models/interfaces';

// we are quite generous when it comes to spaces
// so if there is a header incoming with more than one space, we still accept it
const allowSpacesInRegexString = (regexString: string) => regexString.replace(/\s+/g, '\\s*');

export const getRegEx = (templateFunction: (value: string, domain: string) => string) => {
  let regexString = templateFunction('([^:]+)', '[\\w\\d\\.-]+');

  return new RegExp(allowSpacesInRegexString(regexString));
};

export const regexHeaders = (headers: string[], regex: RegExp): string | undefined => {
  for (const header of headers) {
    const matches = regex.exec(header);

    if (!matches || matches.length <= 1)
      continue;

    return matches[1];
  }

  return;
}

const getCallInfoHeader = (uri: string[], value: string, domain: string, type: string) =>
  `<urn:emergency:${uri.join(':')}:${value}:${domain}>; purpose=EmergencyCallData.${type}`;

const getCallIdHeaderValue = (callId: string, domain: string) => getCallInfoHeader(['uid', 'callid'], callId, domain, 'CallId');
const getMessageIdHeaderValue = (messageId: string, domain: string) => getCallInfoHeader(['service', 'uid', 'msgid'], messageId, domain, 'MsgId');
const getMessageTypeHeaderValue = (messageType: string, domain: string) => getCallInfoHeader(['service', 'uid', 'msgtype'], messageType, domain, 'MsgType');
const getDIDHeaderValue = (did: string) => `<${did}>; purpose=EmergencyCallData.DID`;

const getAnyHeaderValue = (value: string, domain: string) => getCallInfoHeader(['.+'], value, domain, '.+');

export interface EmergencyConfig {
  /**
   * Domain that's used for different headers (Call-Info, Geolocation)
   */
  domain: string;
}

export class EmergencySpecifics implements NamespaceSpecifics {
  constructor(
    public config: EmergencyConfig
  ) { }

  getDomain = () => this.config.domain;
}

export class EmergencyMapper implements Mapper {
  protected _specifics: NamespaceSpecifics;

  constructor(
    private _logger: Logger,
    specifics?: NamespaceSpecifics,
  ) {
    this._specifics = specifics ?? new EmergencySpecifics({
      domain: 'dec112.at',
    });
  }

  getNamespace = () => Namespace.ETSI;
  // ETSI TS 103 698 specifies that a conversation has to be started by PSAP only
  // PSAP has to respond with a "START" message to finally start the conversation
  supportsPsapStartMessage = (): boolean => true;

  isCompatible = (headers: string[]): boolean =>
    // checks if at least one element satisfies ETSI call info headers
    headers.some(h => getRegEx(getAnyHeaderValue).test(h));

  getCallIdFromHeaders = (headers: string[]): string | undefined => regexHeaders(headers, getRegEx(getCallIdHeaderValue));
  // @ts-expect-error
  getIsTestFromEvent = (evt: NewMessageEvent): boolean => false; // TODO: reference ETSI TS 103 698, 6.1.2.10 "Test Call"

  protected createCommonParts = (
    targetUri: string,
    endpointType: EndpointType,
    replyToSipUri: string,
    text?: string,
    uris?: string[],
    extraParts?: MultipartPart[],
    location?: PidfLo,
    vcard?: VCard,
  ): MessageParts => {

    let headers: Header[] = [];

    // only add History-Info header if we have a real SIP-URI
    // we may not add it if it is a URN
    if (targetUri.indexOf('sip') === 0) {
      // enables tracing back the origin and routing history of the call
      // according to ETSI TS 103 698 -> 6.1.2.6
      headers.push({ key: HISTORY_INFO, value: `<${targetUri}>;index=1` })
    }

    const multipart = new Multipart();

    if (extraParts) {
      multipart.addAll(extraParts);
    }

    if (endpointType === EndpointType.PSAP) {
      headers.push({ key: REPLY_TO, value: replyToSipUri })
    }

    if (uris) {
      multipart.add({
        headers: [{ key: CONTENT_TYPE, value: TEXT_URI_LIST }],
        body: uris.join(CRLF),
      })
    }

    if (location) {
      const locationContentId = `${getRandomString(12)}@${this._specifics.getDomain()}`;

      headers = headers.concat([
        { key: GEOLOCATION_ROUTING, value: 'yes' },
        { key: GEOLOCATION, value: `<cid:${locationContentId}>` },
      ]);

      multipart.add({
        headers: [
          { key: CONTENT_TYPE, value: PIDF_LO },
          { key: CONTENT_ID, value: `<${locationContentId}>` },
        ],
        body: XMLCompat.toXMLString(location.toXML()),
      });
    }

    if (vcard) {
      const doc = XMLCompat.createDocument();

      const infoPrefix = 'sub';
      const vcardPrefix = 'xc';

      const root = doc.createElement(`${infoPrefix}:EmergencyCallData.SubscriberInfo`);
      root.setAttribute(`xmlns:${infoPrefix}`, 'urn:ietf:params:xml:ns:EmergencyCallData:SubscriberInfo');
      root.setAttribute(`xmlns:${vcardPrefix}`, VCARD_XML_NAMESPACE);

      const data = doc.createElement(`${infoPrefix}:SubscriberData`);
      const vcards = doc.createElement(`${vcardPrefix}:vcards`);

      const vcardNode = vcard.toXML(vcardPrefix).firstChild;

      if (vcardNode) {
        vcards.appendChild(vcardNode);
        data.appendChild(vcards);
        root.appendChild(data);
        doc.appendChild(root);

        multipart.add({
          headers: [
            { key: CONTENT_TYPE, value: CALL_SUB },
          ],
          body: XMLCompat.toXMLString(doc),
        });
      }
    }

    if (text) {
      multipart.add({
        headers: [{ key: CONTENT_TYPE, value: TEXT_PLAIN }],
        body: text,
      });
    }

    // TODO: what if, at this point, no parts have been added? So basically an empty multipart object
    // what should we do? Sending an empty object seems strange, but maybe it's perfectly fine
    // That's something that should be investigated

    return {
      headers,
      multipart,
    };
  }

  protected parseCommonMessageFromEvent = (evt: NewMessageEvent): OmitStrict<Message, 'conversation'> => {
    const req = evt.request;
    const { body, origin } = req;
    const contentType = req.getHeader(CONTENT_TYPE);
    let message: Partial<Message> = parseMessage({}, body, contentType);

    const callInfoHeaders = req.getHeaders(CALL_INFO);

    let type = this.getMessageTypeFromHeaders(callInfoHeaders, message.text);
    if (!type) {
      this._logger.warn('Could not find message type. Will treat it as IN_CHAT message.');
      type = EmergencyMessageType.IN_CHAT;
    }

    let id = this.getMessageIdFromHeaders(callInfoHeaders);
    if (!id) {
      this._logger.warn('Could not find message id. Will use our internally created unique id instead.');
      id = nextUniqueRandomId();
    }

    return {
      ...message,
      id,
      uniqueId: nextUniqueId(),
      origin,
      dateTime: new Date(),
      type,
      state: MessageState.SUCCESS,
      promise: Promise.resolve(),
      did: this.getDIDFromHeaders(callInfoHeaders),
      // attach raw SIP event to message
      event: evt,
    };
  }

  createMessageParts = ({
    targetUri,
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
    did,
  }: MessagePartsParams): MessageParts => {
    const parts = this.createCommonParts(
      targetUri,
      endpointType,
      replyToSipUri,
      text,
      uris,
      extraParts,
      location,
      vcard,
    );

    const domain = this._specifics.getDomain();
    const headers = parts.headers = [
      ...parts.headers,
      { key: CALL_INFO, value: getCallIdHeaderValue(conversationId, domain) },
      { key: CALL_INFO, value: getMessageIdHeaderValue(id.toString(), domain) },
      { key: CALL_INFO, value: getMessageTypeHeaderValue(type.toString(), domain) },
    ];

    if (did)
      headers.push({
        key: CALL_INFO,
        value: getDIDHeaderValue(did),
      });

    // TODO: Implement sending binaries

    if (
      endpointType === EndpointType.CLIENT &&
      isTest
    ) {
      // TODO: if target is a URN, append ".test" here
      // reference ETSI TS 103 698, 6.1.2.10 "Test Call"
    }

    return parts;
  }

  parseMessageFromEvent = (evt: NewMessageEvent): OmitStrict<Message, 'conversation'> => this.parseCommonMessageFromEvent(evt);

  getMessageIdFromHeaders = (headers: string[]): string | undefined => regexHeaders(headers, getRegEx(getMessageIdHeaderValue));
  getDIDFromHeaders = (headers: string[]): string | undefined => regexHeaders(headers, new RegExp(allowSpacesInRegexString(getDIDHeaderValue('(.*)'))));

  // we have to specify this additional (in this case unnecessary) parameter
  // as DEC112 mapper needs it
  // @ts-expect-error
  getMessageTypeFromHeaders = (headers: string[], messageText?: string): number | undefined => {
    const msgType = regexHeaders(headers, getRegEx(getMessageTypeHeaderValue));

    if (msgType)
      return parseInt(msgType);

    return;
  }
}