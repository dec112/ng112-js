import { StateObject } from "./conversation";
import { MessageFailedEvent as jssipMessageFailedEvent } from "jssip/lib/Message";

export interface ConversationConfiguration {
  /**
   * Defines the conversation as a test call\
   * PSAPs *MUST* consider this hint and act accordingly
   */
  isTest?: boolean,
  /**
   * A unique conversation id\
   * according to spec, 30 characters is the longest allowed string
   */
  id?: string,
  /**
   * Initial state of this conversation
   * Can be used to restore a conversation from storage, if client or PSAP was suspended
   */
  state?: StateObject,
  /**
   * Specifies the first message id that should be used in this conversation
   * Can be used to restore a conversation from storage, if client or PSAP was suspended
   * to continue with the last + 1 message id that was sent
   */
  messageId?: number,
}

export type MessageFailedEvent = jssipMessageFailedEvent;