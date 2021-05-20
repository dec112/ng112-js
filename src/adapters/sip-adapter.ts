import { AgentConfiguration } from "../models/agent";
import { Origin } from "../models/message";
import { getPackageInfo } from "../utils/package-utils";
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
}

export type SipAdapterConfig = OmitStrict<AgentConfiguration, 'debug' | 'namespaceSpecifics' | 'customSipHeaders'> & {
  /**
   * SIP URI of endpoint
   */
  originSipUri: string;
  /**
   * Loging instance to integrate with ng112-js logging
   */
  logger: Logger;
};

export interface NewMessageEvent {
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
   * The raw message received by the SIP stack
   */
  sipStackMessage: any;
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
}

export const getUserAgentString = (sipLibName: string, sipLibVersion: string) => {
  const packageInfo = getPackageInfo();
  return `${packageInfo.name} ${packageInfo.version}, ${sipLibName}, ${sipLibVersion}`;
}