import { OutgoingEvent } from 'jssip/lib/RTCSession';
import { IncomingMessageEvent, OutgoingMessageEvent } from 'jssip/lib/UA';
import type { PidfLo } from 'pidf-lo';
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
  promise: Promise<OutgoingEvent | void>,
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
   * A list of URIs
   */
  uris?: string[],
  /**
   * Additional (custom) Multipart MIME parts to add to the message
   */
  extraParts?: MultipartPart[],
  /**
   * The corresponding raw message from the SIP stack `JsSIP`\
   * For outgoing messages this will only be resolved after property `promise` is resolved
   */
  jssipMessage?: IncomingMessageEvent | OutgoingMessageEvent
}

export const nextUniqueId = (() => {
  let _uniqueSequence = 0;
  return () => _uniqueSequence++;
})();