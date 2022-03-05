import { Message, MessageConfig } from '../models/message';
import { NewMessageEvent } from '../adapters';
import { Multipart } from '../models/multipart';
import { Header } from '../utils';
import { OmitStrict } from '../utils/ts-utils';
import { EndpointType } from '../models/interfaces';

export interface NamespaceSpecifics {
  getDomain(): string;
}

export interface MessageParts {
  headers: Header[],
  multipart: Multipart,
}

export interface MessagePartsParams {
  message: Message,
  targetUri: string,
  endpointType: EndpointType,
  isTest: boolean,
  isSilent: boolean,
  replyToSipUri: string,
}

export enum Namespace {
  DEC112 = 'DEC112',
  ETSI = 'ETSI',
}

export interface Mapper {
  createSipParts(params: MessagePartsParams): MessageParts;
  parseMessageFromEvent(evt: NewMessageEvent): OmitStrict<MessageConfig, 'conversation'>;

  getNamespace(): Namespace;
  supportsPsapStartMessage(): boolean;
  isCompatible(headers: string[]): boolean;

  getCallIdFromHeaders(headers: string[]): string | undefined;
  getIsTestFromEvent(evt: NewMessageEvent): boolean;
  getIsSilentFromEvent(evt: NewMessageEvent): boolean;
}