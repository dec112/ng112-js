import { AgentConfiguration } from "../models/agent";
import { Origin } from "../models/message";
import { Logger } from "../models/logger";
import { OmitStrict } from "../utils/ts-utils";

export interface SendMessageOptions {
  /**
   * Content type of SIP Message
   */
  contentType?: string;
  /**
   * Extra headers to be forwarded to the SIP stack
   */
  extraHeaders?: string[];
  /**
   * Display name for SIP From header that MUST take precedence over the agent's default display name
   */
  displayName?: string;
}

export type SipAdapterConfig = OmitStrict<AgentConfiguration, 'debug' | 'namespaceSpecifics' | 'customSipHeaders'> & {
  /**
   * SIP URI of endpoint
   */
  originSipUri: string;
  /**
   * Logging instance to integrate with ng112-js logging
   */
  logger: Logger;
  /**
   * The user agent the adapter MUST use
   * Also the sip adapter MUST specify an own user agent IN ADDITION to this user agent
   */
  userAgent: string;
};

export interface SipResponseOptions {
  /** 
   * Status code of the response. 
   */
  statusCode: number;
  /** 
   * Reason phrase of the response. 
   */
  reasonPhrase?: string;
  /** 
   * Extra headers to include in the message. 
   */
  extraHeaders?: string[];
  /** 
   * Body to include in the message. 
   */
  body?: string;
}

export interface NewMessageEvent {
  /**
   * The message will be accepted by the consumer
   * This function should be undefined, if message origin is LOCAL, as explicitly accepting a local message does not make sense
   */
  accept?: (options?: SipResponseOptions) => Promise<void>;
  /**
   * The message will be rejected by the consumer
   * This function should be undefined, if message origin is LOCAL, as explicitly rejecting a local message does not make sense
   */
  reject?: (options?: SipResponseOptions) => Promise<void>;
  /**
   * The request object
   */
  request: NewMessageRequest;
}

export interface NewMessageRequest {
  /**
   * Determine if SIP header exists
   */
  hasHeader: (name: string) => boolean;
  /**
   * Returns a specific SIP header, if available
   */
  getHeader: (name: string) => string | undefined;
  /**
   * Returns an array of specific SIP headers, if available. Empty array if not available.
   */
  getHeaders: (name: string) => string[];
  /**
   * SIP From header
   */
  from: SipUri;
  /**
   * SIP To header
   */
  to: SipUri;
  /**
   * Who issued the SIP Message
   */
  origin: Origin;
  /**
   * Body of the SIP Message
   */
  body: string | undefined;
  /**
   * The raw message object received by the SIP stack
   */
  sipStackObject: NonNullable<any>;
}

export interface SipUri {
  /**
   * Display name
   */
  displayName: string;
  /**
   * The raw URI, without display name
   */
  uri: {
    toString(): string,
  }
}

export interface SipAdapter {
  /**
   * A delegate object for handling different events of the underlying SIP stack
   */
  delegate: DelegateObject;

  /**
   * Sends a SIP Register to register the device at the SIP proxy
   */
  register(): Promise<void>;
  /**
   * Sends a SIP Register to unregister the device at the SIP proxy
   */
  unregister(): Promise<void>;

  /**
   * Initializes the SIP stack, establishes the network connection
   */
  start(): Promise<void>;
  /**
   * Disposes the SIP stack, disconnects from the network
   */
  stop(): Promise<void>;

  /**
   * Sends a SIP Message
   * 
   * @param target A raw SIP URI
   * @param body Body to be sent within SIP Message
   * @param options Additional options for sending the message
   */
  message(
    target: string,
    body: string,
    options?: SendMessageOptions
  ): Promise<void>;

  /**
   * TODO:
   * @param target 
   * @param eventType 
   * @param onNotify 
   */
  subscribe(
    target: string,
    eventType: string,
    onNotify: (notification: NewMessageEvent) => void,
  ): Promise<void>;

  /**
   * TODO:
   * @param target 
   * @param eventType 
   */
  unsubscribe(
    target: string,
    eventType: string,
  ): Promise<void>;

  /**
   * TODO:
   * @param target 
   * @param eventType 
   * @param content 
   */
  notify(
    target: string,
    eventType: string,
    content: string,
  ): Promise<void>;
}

export interface DelegateObject {
  /**
   * Called when the SIP stack has successfully connected to the SIP proxy
   */
  onConnect: (callback: () => void) => void,
  /**
   * Called when the SIP stack is starting to connect to the SIP proxy
   */
  onConnecting: (callback: () => void) => void,
  /**
   * Called when the SIP stack is disconnected from the SIP proxy
   */
  onDisconnect: (callback: () => void) => void,
  /**
   * Called after SIP Register was successfully executed
   */
  onRegister: (callback: () => void) => void,
  /**
   * Called after SIP Register was successfully executed for unregistering the SIP stack
   */
  onUnregister: (callback: () => void) => void,
  /**
   * Called if SIP Register failed
   */
  onRegistrationFail: (callback: () => void) => void,
  /**
   * Called for every new message: Incoming, outgoing or system generated messages
   */
  onNewMessage: (callback: (evt: NewMessageEvent) => void) => void,

  /**
   * @experimental
   * 
   * Please be aware this interface is experimental and might change even within a major version!
   * Therefore it's not mandatory to implement this interface.
   * 
   * Called for every incoming subscription
   */
  onSubscribe?: (callback: (from: string, event: string) => void) => void,
}