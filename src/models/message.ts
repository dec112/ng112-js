import type { PidfLo } from 'pidf-lo';
import { SipResponseOptions } from '../adapters/sip-adapter';
import { Conversation } from './conversation';
import { MultipartPart } from './multipart';
import { VCard } from './vcard';

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
   * The corresponding raw message from the SIP stack `JsSIP`\
   * For outgoing messages this will only be resolved after property `promise` is resolved
   */
  sipStackMessage?: any,
  /**
   * Accepts the message
   */
  accept?: (options?: SipResponseOptions) => Promise<void>
  /**
   * Rejects the message
   */
  reject?: (options?: SipResponseOptions) => Promise<void>
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

export const nextUniqueId = (() => {
  let _uniqueSequence = 0;
  return () => _uniqueSequence++;
})();
