import { getRandomString, Header, } from '../utils';
import { PidfLo, XMLCompat } from 'pidf-lo/dist/node';
import { PIDF_LO, TEXT_PLAIN, CALL_SUB, TEXT_URI_LIST, MULTIPART_MIXED } from '../constants/content-types';
import { CALL_INFO, CONTENT_ID, CONTENT_TYPE, GEOLOCATION, GEOLOCATION_ROUTING, HISTORY_INFO, REPLY_TO } from '../constants/headers';
import { ConversationEndpointType } from '../models/conversation';
import { CRLF, Multipart, MultipartPart } from '../models/multipart';
import { VCard, VCARD_XML_NAMESPACE } from '../models/vcard';
import { MessageParts, MessagePartsParams, NamespacedConversation } from './interfaces'
import { NewMessageEvent } from '../adapters';
import { Message, MessageState, nextUniqueId } from '../models/message';
import { EmergencyMessageType } from '../constants/message-types/emergency';
import { OmitStrict } from '../utils/ts-utils';
import { Logger } from '../models/logger';

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

export class EmergencyMapper implements NamespacedConversation {
  constructor(
    private _logger: Logger,
  ) { }

  getName = () => 'ETSI';
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
    endpointType: ConversationEndpointType,
    replyToSipUri: string,
    text?: string,
    uris?: string[],
    extraParts?: MultipartPart[],
    location?: PidfLo,
    vcard?: VCard,
  ): MessageParts => {

    let headers: Header[] = [
      // enables tracing back the origin and routing history of the call
      // according to ETSI TS 103 698 -> 6.1.2.6
      { key: HISTORY_INFO, value: `<${targetUri}>;index=1` }
    ];
    const multipart = new Multipart();

    if (extraParts) {
      multipart.addAll(extraParts);
    }

    if (endpointType === ConversationEndpointType.PSAP) {
      headers.push({ key: REPLY_TO, value: replyToSipUri })
    }

    if (uris) {
      multipart.add({
        headers: [{ key: CONTENT_TYPE, value: TEXT_URI_LIST }],
        body: uris.join(CRLF),
      })
    }

    if (location) {
      const locationContentId = `${getRandomString(12)}@dec112.app`;

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

  private parseMultipartParts = (multipart: Multipart): Partial<Message> => {
    // TODO: Find a way to parse binaries
    // or decide that this will be covered by "extraParts"

    const message: Partial<Message> = {};

    const textParts = multipart.popPartsByContentType(TEXT_PLAIN);
    if (textParts.length > 0) {
      // we just concatenate all plain parts with line breaks
      // this might not be the best solution, but it's for sure the easiest one ;-)
      message.text = textParts.map(x => x.body).join('\n');
    }

    const locationParts = multipart.popPartsByContentType(PIDF_LO);
    if (locationParts.length > 0) {
      for (const locPart of locationParts) {
        const loc = this.tryParsePidfLo(locPart.body);

        if (loc && message.location) {
          // if there are multiple pidfLo parts present, we just combine it to one object
          message.location.locationTypes = [
            ...message.location.locationTypes,
            ...loc?.locationTypes,
          ]
        }
        else if (loc)
          message.location = loc;
      }
    }

    const vcardParts = multipart.popPartsByContentType(CALL_SUB);
    if (vcardParts.length > 0) {
      const vcard = VCard.fromXML(vcardParts[0].body);

      if (message.vcard)
        vcard.combine(message.vcard);

      message.vcard = vcard;
    }

    const uriParts = multipart.popPartsByContentType(TEXT_URI_LIST);
    if (uriParts.length > 0) {
      message.uris = uriParts.map(u => u.body).reduce((prev, curr) => {
        const allUris = curr.split(CRLF);
        // uris with a leading # are commented and should be ignored
        return prev.concat(allUris.filter(x => x.indexOf('#') !== 0))
      }, [] as string[]);
    }

    // This always has to be the last call!
    // We take care of all leftover parts!
    message.extraParts = multipart.parts.length > 0 ? multipart.parts : undefined;

    return message;
  }

  protected parseCommonMessageFromEvent = (evt: NewMessageEvent): OmitStrict<Message, 'conversation'> => {
    const req = evt.request;
    const { body, origin } = req;
    let message: Partial<Message> = {};

    const contentType = req.getHeader(CONTENT_TYPE);
    if (contentType && contentType.indexOf(MULTIPART_MIXED) !== -1 && body) {
      message = {
        ...message,
        // Attention: parseMultipartParts is not a pure function!
        // it alters the multipart object!
        ...this.parseMultipartParts(Multipart.parse(body, contentType)),
      }
    }
    else if (body)
      message.text = body;

    const callInfoHeaders = req.getHeaders(CALL_INFO);

    let type = this.getMessageTypeFromHeaders(callInfoHeaders, message.text);
    if (!type) {
      this._logger.warn('Could not find message type. Will treat it as IN_CHAT message.');
      type = EmergencyMessageType.IN_CHAT;
    }

    const uniqueId = nextUniqueId();
    let id = this.getMessageIdFromHeaders(callInfoHeaders);
    if (!id) {
      this._logger.warn('Could not find message id. Will use our internally created unique id instead.');
      id = uniqueId.toString();
    }

    return {
      ...message,
      id,
      uniqueId,
      origin,
      dateTime: new Date(),
      type,
      state: MessageState.SUCCESS,
      promise: Promise.resolve(),
      sipStackMessage: req.sipStackMessage,
      did: this.getDIDFromHeaders(callInfoHeaders),
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

    const headers = parts.headers = [
      ...parts.headers,
      { key: CALL_INFO, value: getCallIdHeaderValue(conversationId, 'dec112.at') },
      { key: CALL_INFO, value: getMessageIdHeaderValue(id.toString(), 'service.dec112.at') },
      { key: CALL_INFO, value: getMessageTypeHeaderValue(type.toString(), 'service.dec112.at') },
    ];

    if (did)
      headers.push({
        key: CALL_INFO,
        value: getDIDHeaderValue(did),
      });

    // TODO: Implement sending binaries

    if (
      endpointType === ConversationEndpointType.CLIENT &&
      isTest
    ) {
      // TODO: if target is a URN, append ".test" here
      // reference ETSI TS 103 698, 6.1.2.10 "Test Call"
    }

    return parts;
  }

  parseMessageFromEvent = (evt: NewMessageEvent): OmitStrict<Message, 'conversation'> => this.parseCommonMessageFromEvent(evt);

  tryParsePidfLo = (value: string): PidfLo | undefined => PidfLo.fromXML(value);
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