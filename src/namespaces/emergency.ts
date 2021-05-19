import { IncomingMessage } from 'jssip/lib/SIPMessage';
import { getRandomString, Header, } from '../utils';
import type { PidfLo } from 'pidf-lo';
import PidfLoCompat from '../compatibility/pidf-lo';
import { PIDF_LO, TEXT_PLAIN, CALL_SUB, TEXT_URI_LIST } from '../constants/content-types';
import { CALL_INFO, CONTENT_ID, CONTENT_TYPE, GEOLOCATION, GEOLOCATION_ROUTING, HISTORY_INFO, REPLY_TO } from '../constants/headers';
import { ConversationEndpointType } from '../models/conversation';
import { CRLF, Multipart, MultipartPart } from '../models/multipart';
import { VCard, VCARD_XML_NAMESPACE } from '../models/vcard';
import { MessageParts, MessagePartsParams, NamespacedConversation } from './interfaces'

export const getRegEx = (templateFunction: (value: string, domain: string) => string) => {
  let regexString = templateFunction('([^:]+)', '[\\w\\d\\.-]+');

  // we are quite generous when it comes to spaces
  // so if there is a header incoming with more than one space, we still accept it
  regexString = regexString.replace(/\s+/g, '\\s*');

  return new RegExp(regexString);
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

const getAnyHeaderValue = (value: string, domain: string) => getCallInfoHeader(['.+'], value, domain, '.+');

export class EmergencyMapper implements NamespacedConversation {
  static createCommonParts = (
    targetUri: string,
    endpointType: ConversationEndpointType,
    replyToSipUri: string,
    text?: string,
    uris?: string[],
    extraParts?: MultipartPart[],
    location?: PidfLo,
    vcard?: VCard,
  ): MessageParts => {

    let extraHeaders: Header[] = [
      // enables tracing back the origin and routing history of the call
      // according to ETSI TS 103 698 -> 6.1.2.6
      { key: HISTORY_INFO, value: `<${targetUri}>;index=1` }
    ];
    const multi = new Multipart();

    if (extraParts) {
      multi.addAll(extraParts);
    }

    if (endpointType === ConversationEndpointType.PSAP) {
      extraHeaders.push({ key: REPLY_TO, value: replyToSipUri })
    }

    if (uris) {
      multi.add({
        headers: [{ key: CONTENT_TYPE, value: TEXT_URI_LIST }],
        body: uris.join(CRLF),
      })
    }

    if (location) {
      const locationContentId = `${getRandomString(12)}@dec112.app`;

      extraHeaders = extraHeaders.concat([
        { key: GEOLOCATION_ROUTING, value: 'yes' },
        { key: GEOLOCATION, value: `<cid:${locationContentId}>` },
      ]);

      multi.add({
        headers: [
          { key: CONTENT_TYPE, value: PIDF_LO },
          { key: CONTENT_ID, value: `<${locationContentId}>` },
        ],
        body: PidfLoCompat.XMLCompat.toXMLString(location.toXML()),
      });
    }

    if (vcard) {
      const doc = PidfLoCompat.XMLCompat.createDocument();

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

        multi.add({
          headers: [
            { key: CONTENT_TYPE, value: CALL_SUB },
          ],
          body: PidfLoCompat.XMLCompat.toXMLString(doc),
        });
      }
    }

    if (text) {
      multi.add({
        headers: [{ key: CONTENT_TYPE, value: TEXT_PLAIN }],
        body: text,
      });
    }

    // TODO: what if, at this point, no parts have been added? So basically an empty multipart object
    // what should we do? Sending an empty object seems strange, but maybe it's perfectly fine
    // That's something that should be investigated

    const multiObj = multi.create();

    return {
      headers: [
        ...extraHeaders,
        ...multiObj.headers,
      ],
      contentType: multiObj.contentType,
      body: multiObj.body,
    };
  }

  getName = () => 'ETSI';
  // ETSI TS 103 698 does not allow a conversation to be started by client only
  // also PSAP has to respond with a "START" message to finally start the conversation
  isStartConversationByClientAllowed = (): boolean => false;

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
  }: MessagePartsParams): MessageParts => {
    const common = EmergencyMapper.createCommonParts(
      targetUri,
      endpointType,
      replyToSipUri,
      text,
      uris,
      extraParts,
      location,
      vcard,
    );

    const extraHeaders = [
      { key: CALL_INFO, value: getCallIdHeaderValue(conversationId, 'dec112.at') },
      { key: CALL_INFO, value: getMessageIdHeaderValue(id.toString(), 'service.dec112.at') },
      { key: CALL_INFO, value: getMessageTypeHeaderValue(type.toString(), 'service.dec112.at') },
      ...common.headers,
    ];

    if (
      endpointType === ConversationEndpointType.CLIENT &&
      isTest
    ) {
      // TODO: if target is a URN, append ".test" here
      // reference ETSI TS 103 698, 6.1.2.10 "Test Call"
    }

    return {
      headers: extraHeaders,
      contentType: common.contentType,
      body: common.body,
    };
  }

  // static, because it's also used by DEC112Mapper
  static tryParsePidfLo = (value: string): PidfLo | undefined => PidfLoCompat.PidfLo.fromXML(value);
  tryParsePidfLo = (value: string): PidfLo | undefined => EmergencyMapper.tryParsePidfLo(value);

  isCompatible = (headers: string[]): boolean =>
    // checks if at least one element satisfies ETSI call info headers
    headers.some(h => getRegEx(getAnyHeaderValue).test(h));

  getCallIdFromHeaders = (headers: string[]): string | undefined => regexHeaders(headers, getRegEx(getCallIdHeaderValue));
  getMessageIdFromHeaders = (headers: string[]): string | undefined => regexHeaders(headers, getRegEx(getMessageIdHeaderValue));
  // @ts-ignore
  getIsTestFromHeaders = (message: IncomingMessage): boolean => false; // TODO: reference ETSI TS 103 698, 6.1.2.10 "Test Call"
  getMessageTypeFromHeaders = (headers: string[]): number | undefined => {
    const msgType = regexHeaders(headers, getRegEx(getMessageTypeHeaderValue));

    if (msgType)
      return parseInt(msgType);

    return;
  }
}