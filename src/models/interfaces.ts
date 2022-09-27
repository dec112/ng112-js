import { StateObject } from "./conversation";

export enum EndpointType {
  CLIENT = 'client',
  PSAP = 'psap',
}
export interface ConversationConfiguration {
  /**
   * Defines the conversation as a test call \
   * PSAPs *MUST* consider this hint and act accordingly \
   * Currently only supported in DEC112 environments
   */
  isTest?: boolean,
  /**
   * Defines the conversation as a silent emergency call \
   * Currently only supported in DEC112 environments
   */
  isSilent?: boolean,
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
   * Specifies the endpoint type for this conversation
   */
  endpointType?: EndpointType,
  /**
   * Specifies the first message id that should be used in this conversation
   * Can be used to restore a conversation from storage, if client or PSAP was suspended
   * to continue with the last + 1 message id that was sent
   */
  messageId?: number,
  /**
   * The user's well known identity. \
   * This property will override the agent's default display name. \
   * \
   * Examples:
   *   * the user's name (Alice)
   *   * the user's telephone number (+43664123456789)
   *   * an arbitrary identification of the user (Anonymous)
   */
  displayName?: string,
}

export interface DequeueRegistration {
  /**
   * HTTP Endpoint where to register at
   */
  endpoint: string;
  /**
   * SIP URI of queue to register on 
   */
  uri: string;
  /**
   * Requested time in seconds this registration will expire
   */
  expires: number;
  /**
   * Integer from 1 - 5 indicating queuing preference. 5 indicating highest preference
   */
  preference: number;
}

export interface DequeueRegistrationRequest {
  /**
   * SIP URI of queue to register on
   */
  queueUri: string;
  /**
   * SIP URI of dequeuer (where to send calls)
   */
  dequeuerUri: string;
  /**
   * Requested time in seconds this registration will expire 
   */
  expirationTime: number;
  /**
   * Integer from 1 - 5 indicating queuing preference. 5 indicating highest preference
   */
  dequeuePreference?: number;
}

export interface DequeueRegistrationResponse {
  /**
   * Time in seconds this registration will expire
   */
  expirationTime: number;
}

export type QueueState = 'active' | 'inactive' | 'disabled';

export interface QueueStateNotification {
  /**
   * SIP URI of queue 
   */
  queueUri: string;
  /**
   * Integer indicating current number of calls on the queue 
   */
  queueLength: number;
  /**
   * Integer indicating maximum length of queue 
   */
  queueMaxLength: number;
  /**
   * Enumeration of current queue state (e.g. Active/Inactive/Disabled) 
   */
  state: QueueState;
}

export interface Subscriber {
  sipUri: string,
}

/**
 * Inform listeners of a given service about a change
 */
export type ListenerNotifier = () => void;