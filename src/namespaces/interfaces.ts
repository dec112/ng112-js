import { IncomingMessage } from 'jssip/lib/SIPMessage';
import type { PidfLo } from 'pidf-lo';
import { ConversationEndpointType } from '../models/conversation';
import { VCard } from '../models/vcard';
import { Header } from '../utils';

export interface NamespaceSpecifics { }

export interface MessageParts {
  headers: Header[],
  contentType: string,
  body: string,
}

export interface MessagePartsParams {
  conversationId: string,
  messageId: number,
  // bitmask of "EMERGENCY" namespace will be used here
  messageType: number,
  endpointType: ConversationEndpointType,
  isTest: boolean,
  text?: string,
  uris?: string[],
  // TODO: this parameter is only used in DEC112Mapper for creating legacy PidfLo and should be removed
  originSipUri: string,
  replyToSipUri: string,
  location?: PidfLo,
  vcard?: VCard,
}

export interface NamespacedConversation {
  createMessageParts(params: MessagePartsParams): MessageParts;

  tryParsePidfLo(value: string): PidfLo | undefined;

  getName(): string;
  isStartConversationByClientAllowed(): boolean;
  isCompatible(headers: string[]): boolean;

  getCallIdFromHeaders(headers: string[]): string | undefined;
  getMessageIdFromHeaders(headers: string[]): string | undefined;
  getMessageTypeFromHeaders(headers: string[], messageText?: string): number | undefined;
  getIsTestFromHeaders(sipMessage: IncomingMessage): boolean;
}