import { ConversationEndpointType } from '../models/conversation';
import { Message } from '../models/message';
import { NewMessageEvent } from '../adapters';
import { Multipart } from '../models/multipart';
import { Header } from '../utils';
import { OmitStrict } from '../utils/ts-utils';

export interface NamespaceSpecifics { }

export interface MessageParts {
  headers: Header[],
  multipart: Multipart,
}

export type MessagePartsParams = OmitStrict<Message,
  'origin' |
  'state' |
  'promise' |
  'dateTime' |
  'conversation' |
  'uniqueId'
> & {
  targetUri: string,
  conversationId: string,
  endpointType: ConversationEndpointType,
  isTest: boolean,
  replyToSipUri: string,
}

export interface NamespacedConversation {
  createMessageParts(params: MessagePartsParams): MessageParts;
  parseMessageFromEvent(evt: NewMessageEvent): OmitStrict<Message, 'conversation'>;

  getName(): string;
  isStartConversationByClientAllowed(): boolean;
  isCompatible(headers: string[]): boolean;

  getCallIdFromHeaders(headers: string[]): string | undefined;
  getIsTestFromEvent(evt: NewMessageEvent): boolean;
}