import { ConversationEndpointType, StateObject } from "./conversation";

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
   * Specifies the endpoint type for this conversation
   */
  endpointType?: ConversationEndpointType,
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
  DequeueRegistrationQueueUri: string;
  /**
   * SIP URI of dequeuer (where to send 
   */
  DequeueRegistrationDequeuer: string;
  /**
   * Requested time in seconds this registration will expire 
   */
  DequeueRegistrationExpirationTime: number;
  /**
   * Integer from 1 - 5 indicating queuing preference. 5 indicating highest preference
   */
  DequeueRegistrationDequeuePreference?: number;
}

export interface DequeueRegistrationResponse {
  /**
   * Time in seconds this registration will expire
   */
  DequeueRegistrationExpirationTime: number;
  /**
   * Status Code
   */
  DequeueRegistrationStatusCode: number;
}

export type QueueState = 'active' | 'inactive' | 'disabled';

export interface QueueStateNotification {
  /**
   * SIP URI of queue 
   */
  QueueStateEventUri: string;
  /**
   * Integer indicating current number of calls on the queue 
   */
  QueueStateEventQueueLength: number;
  /**
   * Integer indicating maximum length of queue 
   */
  QueueStateEventMaxLength: number;
  /**
   * Enumeration of current queue state (e.g. Active/Inactive/Disabled) 
   */
  QueueStateValuesCode: QueueState;
}

export interface Subscriber {
  sipUri: string,
}