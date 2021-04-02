import { IncomingMessage } from 'jssip/lib/SIPMessage';
import type { PidfLo } from 'pidf-lo';
import { ConversationEndpointType } from '../models/conversation';
import { Message } from '../models/message';
import { Header } from '../utils';
import { OmitStrict } from '../utils/ts-utils';

export interface NamespaceSpecifics { }

export interface MessageParts {
  headers: Header[],
  contentType: string,
  body: string,
}

export type MessagePartsParams = OmitStrict<Message,
  'origin' |
  'state' |
  'promise' |
  'dateTime' |
  'conversation'
> & {
  conversationId: string,
  endpointType: ConversationEndpointType,
  isTest: boolean,
  replyToSipUri: string,
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