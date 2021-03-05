import { ConversationState } from "./conversation";

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
  state?: ConversationState,
}

export type MessageFailedEvent = JsSIP.MessageFailedEvent;