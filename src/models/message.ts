import type { PidfLo } from 'pidf-lo';
import { getPidfLo, getRandomString, Header, isValidUri } from '../utils';
import { Conversation } from './conversation';
import { MultipartPart } from './multipart';
import { VCard } from './vcard';
import { NewMessageEvent } from '../adapters';
import { SendMessageObject } from '..';

export enum Origin {
  /**
   * Remote
   */
  REMOTE = 'remote',
  /**
   * Local
   */
  LOCAL = 'local',
  /**
   * System generated (by JsSIP)
   */
  SYSTEM = 'system',
}

export enum MessageState {
  PENDING = 'pending',
  SUCCESS = 'success',
  ERROR = 'error',
}

export interface Binary {
  // TODO: this should also include the file's name
  mimeType: string,
  value: ArrayBuffer,
}

// TODO: Create a separate class for messages so we can also have getters and setters
export interface Message {
  /**
   * If message is outgoing (LOCAL): An incremental, unique id (parseable as number)\
   * If message is incoming (REMOTE): A unique id\
   * This is because according to the standard both unique numbers or strings are allowed\
   * However, this library ALWAYS uses numbers for outgoing messages
   */
  id: number | string,
  /**
   * An internally generated id that is unique among all messages within ng112-js, even across multiple conversations
   */
  uniqueId: number,
  /**
   * Where the message was sent from (LOCAL or REMOTE)
   */
  origin: Origin,
  /**
   * The ETSI TS 103 698 message type
   */
  type: number,
  /**
   * The message's state
   */
  state: MessageState,
  /**
   * Promise that's resolved if the message was received by the other communicating party
   */
  promise: Promise<void>,
  /**
   * Date and time when the message was sent/received
   */
  dateTime: Date,
  /**
   * The corresponding conversation
   */
  conversation: Conversation,
  /**
   * Chat message text
   */
  text?: string,
  /**
   * The caller's location at time of sending the message
   */
  location?: PidfLo,
  /**
   * The caller's vcard at time of sending the message
   */
  vcard?: VCard,
  /**
   * A decentralized identifier \
   * For example, this identifier may resolve to credential about personal data
   */
  did?: string,
  /**
   * A list of URIs
   */
  uris?: string[],
  /**
   * A list of binaries (files)
   */
  binaries?: Binary[],
  /**
   * Additional (custom) Multipart MIME parts to add to the message
   */
  extraParts?: MultipartPart[],
  /**
   * Additional SIP headers to be sent with the message
   */
  extraHeaders?: Header[],
  /**
   * A free to use property for internal identification and matching of messages
   * This is helpful, if you want to use ng112-js as a PSAP and want to tag incoming messages
   */
  tag?: any,
  /**
   * Raw SIP event
   */
  event?: NewMessageEvent,
}

export interface MessageError {
  /**
   * Origin, who produced this error
   */
  origin: Origin,
  /**
   * SIP error code
   * @example 404 Not Found
   */
  code: number,
}

/**
 * Generates a unique id that's unique across all ng112-js processes
 */
export const nextUniqueId = (() => {
  let _uniqueSequence = 0;
  return () => _uniqueSequence++;
})();

/**
 * Generates a unique id that's unique across all ng112-js processes
 * and includes a 20 character random part in addition
 */
export const nextUniqueRandomId = () => `${getRandomString(20)}_${nextUniqueId()}`;

export const createLocalMessage = (
  conversation: Conversation,
  messageId: string | number,
  /**
   * Emergency message type
   */
  type: number,
  originSipUri: string,
  {
    text,
    location,
    vcard,
    uris,
    binaries,
    extraParts,
    extraHeaders,
    tag,
  }: SendMessageObject,
): Message => {
  // check properties
  if (uris) {
    // check if all uris are valid
    for (const uri of uris) {
      if (!isValidUri(uri))
        throw new Error(`${uri} is not a well formed URI!`);
    }
  }

  return {
    id: messageId,
    uniqueId: nextUniqueId(),
    origin: Origin.LOCAL,
    conversation,
    dateTime: new Date(),
    type,
    state: MessageState.PENDING,
    text,
    location: getPidfLo(originSipUri, location),
    vcard,
    uris,
    binaries,
    extraParts,
    extraHeaders,
    tag,
    // This is just a dummy value to satisfy TypeScript
    promise: new Promise(() => { }),
  };
}