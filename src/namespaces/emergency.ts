import { IncomingMessage } from 'jssip/lib/SIPMessage';
import { getRandomString, Header, } from '../utils';
import type { PidfLo } from 'pidf-lo';
import PidfLoCompat from '../compatibility/pidf-lo';
import { PIDF_LO, TEXT_PLAIN, CALL_SUB, TEXT_URI_LIST } from '../constants/content-types';
import { CALL_INFO, CONTENT_ID, CONTENT_TYPE, GEOLOCATION, GEOLOCATION_ROUTING, REPLY_TO } from '../constants/headers';
import { ConversationEndpointType } from '../models/conversation';
import { CRLF, Multipart } from '../models/multipart';
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
    endpointType: ConversationEndpointType,
    replyToSipUri: string,
    text?: string,
    uris?: string[],
    pidfLoXmlString?: string,
    vcard?: VCard,
    // TODO: TS 103 698 -> 6.1.2.11 -> support DIDs
  ): MessageParts => {

    let extraHeaders: Header[] = [];
    const multi = new Multipart();

    if (endpointType === ConversationEndpointType.PSAP) {
      extraHeaders.push({ key: REPLY_TO, value: replyToSipUri })
    }

    if (text) {
      multi.addPart({
        headers: [{ key: CONTENT_TYPE, value: TEXT_PLAIN }],
        body: text,
      });
    }

    if (uris) {
      multi.addPart({
        headers: [{ key: CONTENT_TYPE, value: TEXT_URI_LIST }],
        body: uris.join(CRLF),
      })
    }

    if (pidfLoXmlString) {
      const locationContentId = `${getRandomString(12)}@dec112.app`;

      extraHeaders = extraHeaders.concat([
        { key: GEOLOCATION_ROUTING, value: 'yes' },
        { key: GEOLOCATION, value: `<cid:${locationContentId}>` },
      ]);

      multi.addPart({
        headers: [
          { key: CONTENT_TYPE, value: PIDF_LO },
          { key: CONTENT_ID, value: `<${locationContentId}>` },
        ],
        body: pidfLoXmlString,
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

      const vcardNode = vcard.toXML(vcardPrefix);
      vcards.appendChild(vcardNode);
      data.appendChild(vcards);
      root.appendChild(data);
      doc.appendChild(root);

      multi.addPart({
        headers: [
          { key: CONTENT_TYPE, value: CALL_SUB },
        ],
        body: PidfLoCompat.XMLCompat.toXMLString(doc),
      });
    }

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
    conversationId,
    isTest,
    messageId,
    messageType,
    endpointType,
    text,
    uris,
    replyToSipUri,
    location,
    vcard,
  }: MessagePartsParams): MessageParts => {
    let pidfLoXmlString: string | undefined = undefined;

    if (location) {
      pidfLoXmlString = PidfLoCompat.XMLCompat.toXMLString(location.toXML());
    }

    const common = EmergencyMapper.createCommonParts(
      endpointType,
      replyToSipUri,
      text,
      uris,
      pidfLoXmlString,
      vcard,
    );

    const extraHeaders = [
      { key: CALL_INFO, value: getCallIdHeaderValue(conversationId, 'dec112.at') },
      { key: CALL_INFO, value: getMessageIdHeaderValue(messageId.toString(), 'service.dec112.at') },
      { key: CALL_INFO, value: getMessageTypeHeaderValue(messageType.toString(), 'service.dec112.at') },
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

  tryParsePidfLo = (value: string): PidfLo | undefined => PidfLoCompat.PidfLo.fromXML(value);

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