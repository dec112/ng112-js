import { CALL_INFO } from '../constants/headers';
import { DEC112Mapper, DEC112Specifics } from '../namespaces/dec112';
import { EmergencyMapper } from '../namespaces/emergency';
import { Namespace, Mapper, NamespaceSpecifics } from '../namespaces/interfaces';
import { Conversation, ConversationState, StateObject } from './conversation';
import { ConversationConfiguration, DequeueRegistration, DequeueRegistrationRequest, DequeueRegistrationResponse, QueueState, QueueStateNotification, Subscriber } from './interfaces';
import { CustomSipHeaders, Store, AgentMode } from './store';
import { VCard } from './vcard';
import { PidfLo, SimpleLocation } from 'pidf-lo/dist/node';
import { CustomSipHeader } from './custom-sip-header';
import { Logger } from './logger';
import { NewMessageEvent, SipAdapter, SipAdapterConfig } from '../adapters';
import { getPackageInfo, getPidfLo, timedoutPromise } from '../utils';
import { SipResponseOptions } from '../adapters/sip-adapter';
import { BAD_REQUEST, NOT_FOUND, OK } from '../constants/status-codes';
import { HttpAdapter } from './http-adapter';
import { SendMessageObject } from '..';
import { MessageErrorReason } from './message';

// TODO: We need a callback that is called for every change in a conversation
// if recovery-related data has changed
// maybe we can even provide a small object with all data 
// that is needed for restoring a converstion

export type DisposeObject = {
  /**
   * Timeout for all actions done before disposing the agent in milliseconds. \
   * If there are still open calls, this grace period applies to each call closure. \
   * Grace period also applies to unregistering and disconnecting the agent.
   */
  gracePeriod?: number,
  /**
   * Message options for the last message that's sent for conversations that are still open
   */
  sendMessageObject?: SendMessageObject,
}

export interface DebugConfig {
  /**
   * Defines debug handling for log messages that are created within ng112-js.
   * 
   * If set to `true`, verbose log messages will be printed to the console \
   * If set to a `LogLevel` bitmask, specified log messages will be printed to the console \
   * If set to a callback, this callback will be called for each debug statement
   */
  default?: boolean | number | ((level: number, ...values: any[]) => unknown),
  /**
   * Defines debug handling for log messages that are created by the SIP adapter. \
   * Note that some SIP adapters may not or only partially support logging or a custom callback function!
   * 
   * If set to `true`, verbose log messages will be printed to the console \
   * If set to a `LogLevel` bitmask, specified log messages will be printed to the console \
   * If set to a callback, this callback will be called for each debug statement
   */
  sipAdapter?: boolean | number | ((level: number, ...values: any[]) => unknown),
}

export interface AgentConfiguration {
  /**
   * A factory that delivers an abstraction of a SIP library that will be used for sending messages
   */
  sipAdapterFactory: (config: SipAdapterConfig) => SipAdapter,
  /**
   * The websocket endpoint of the SIP proxy the agent should connect to
   */
  endpoint: string,
  /**
   * The domain used as realm in SIP
   */
  domain: string,
  /**
   * The user's identity for connecting to the SIP proxy
   */
  user: string,
  /**
   * The user's password for connecting to the SIP proxy
   */
  password: string,
  /**
   * The user's well known identity. \
   * Providing a display name is HIGHLY RECOMMENDED! \
   * Examples:
   *   * the user's name (Alice)
   *   * the user's telephone number (+43664123456789)
   *   * an arbitrary identification of the user (Anonymous)
   */
  displayName?: string,
  /**
   * Defines debug handling. \
   * If `debug` is `undefined`, logging will be disabled.
   */
  debug?: DebugConfig,
  /**
   * Configuration object for cross compatibility between ETSI and DEC112 environments.\
   * Currently, only {@link DEC112Specifics | DEC112Specifics} is supported.\
   * ETSI environments don't need a special configuration object
   */
  namespaceSpecifics?: NamespaceSpecifics,
  /**
   * Object for customizing SIP headers
   */
  customSipHeaders?: CustomSipHeaders,
  /**
   * User agent string that will be appended to ng112-js' default user agent string
   * 
   * @example your-application/1.2.3 some-framework/2.5.3
   */
  userAgent?: string
}

export enum AgentState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  REGISTERED = 'registered',
  UNREGISTERED = 'unregistered',
  REGISTRATION_FAILED = 'registrationFailed',
}

const rejectIfDefined = async (evt: NewMessageEvent, options?: SipResponseOptions) => {
  if (evt.reject)
    await evt.reject(options);
}

/**
 * Main instance for establishing connection with an ETSI/DEC112 infrastructure
 */
export class Agent {
  private _agent: SipAdapter;
  private _stateListeners: ((state: AgentState) => void)[] = [];

  /**
   * Returns the agent's current state
   */
  public get state() { return this._state; }
  // Agent is disconnected by default
  private _state = AgentState.DISCONNECTED;

  private readonly _mapper: {
    default: Mapper,
    etsi: EmergencyMapper,
    dec112: DEC112Mapper,
  };

  private _store: Store;
  private _logger: Logger;

  private _conversationListeners: ((conversation: Conversation, event?: NewMessageEvent) => void)[] = [];

  /**
   * Creates a new instance of an agent for communication with an ETSI/DEC112 infrastructure
   */
  constructor(config: AgentConfiguration) {
    const {
      domain,
      user,
      namespaceSpecifics,
      customSipHeaders,
      debug,
      userAgent,
    } = config;

    const originSipUri = customSipHeaders?.from ?
      CustomSipHeader.resolve(customSipHeaders.from) :
      `sip:${user ? `${user}@` : ''}${domain}`;

    this._logger = Logger.getFromConfig(debug?.default);

    this._store = new Store(
      originSipUri,
      this._logger,
      customSipHeaders,
    );

    const packageInfo = getPackageInfo();
    let _userAgent = `${packageInfo.name}/${packageInfo.version}`;
    if (userAgent)
      _userAgent += ` ${userAgent}`;

    this._agent = config.sipAdapterFactory({
      ...config,
      originSipUri,
      logger: Logger.getFromConfig(debug?.sipAdapter),
      userAgent: _userAgent,
    });

    const hasDEC112Specifics = namespaceSpecifics instanceof DEC112Specifics;

    // we have to use a type hint here, as typescript does not realize that `namepspaceSpecifics` is already type-safe
    const dec112 = new DEC112Mapper(this._logger, hasDEC112Specifics ? namespaceSpecifics as DEC112Specifics : undefined);
    const etsi = new EmergencyMapper(this._logger, namespaceSpecifics);

    this._mapper = {
      default: hasDEC112Specifics ? dec112 : etsi,
      etsi,
      dec112,
    }
  }

  private _handleMessageEvent = (evt: NewMessageEvent) => {
    const req = evt.request;

    const callInfoHeaders = req.getHeaders(CALL_INFO);
    let mapper: Mapper;

    if (this._mapper.dec112.isCompatible(callInfoHeaders))
      mapper = this._mapper.dec112;
    else if (this._mapper.etsi.isCompatible(callInfoHeaders))
      mapper = this._mapper.etsi;
    else {
      this._logger.warn('Incoming message is not compatible to DEC112 or ETSI standards and will therefore be rejected.');
      rejectIfDefined(evt, {
        reasonPhrase: `${MessageErrorReason.BAD_REQUEST}: Message incompatible`,
        statusCode: BAD_REQUEST,
      });

      return;
    }

    const conversationId = mapper.getCallIdFromHeaders(req.getHeaders(CALL_INFO));

    if (conversationId) {
      let conversation = this.conversations.find(x => x.id == conversationId);

      // we only want to start new conversations if there are active listeners.
      // otherwise it does not make sense.
      // e.g. this should prevent a mobile device from receiving incoming conversations.
      if (!conversation && this._conversationListeners.length > 0)
        conversation = this.createConversation(evt, undefined, mapper);

      if (conversation)
        conversation.handleMessageEvent(evt);
      else {
        this._logger.warn('Rejected incoming message. No corresponding conversation found and no active conversation listeners listening. Is something wrong with the setup?', evt);
        rejectIfDefined(evt, {
          reasonPhrase: `${MessageErrorReason.NOT_FOUND}: Conversation not found`,
          statusCode: NOT_FOUND,
        });
      }
    }
    else {
      this._logger.warn('Can not process message due to missing conversation id.');
      rejectIfDefined(evt, {
        reasonPhrase: `${MessageErrorReason.BAD_REQUEST}: CallId not present`,
        statusCode: BAD_REQUEST,
      });
    }
  }

  /**
   * Initializes the agent's internals sends a `REGISTER` to the ESRP
   * This has to be called before any other interaction with the library
   * If registration fails, promise will be rejected
   */
  initialize = async (): Promise<Agent> => {
    const newState = (newState: AgentState) => {
      this._logger.log(newState);
      this._state = newState;
      this._notifyStateListeners(newState);
    }

    const del = this._agent.delegate;

    del.onConnect(() => newState(AgentState.CONNECTED));
    del.onConnecting(() => newState(AgentState.CONNECTING));
    del.onDisconnect(() => newState(AgentState.DISCONNECTED));
    del.onRegister(() => newState(AgentState.REGISTERED));
    del.onUnregister(() => newState(AgentState.UNREGISTERED));
    del.onRegistrationFail(() => newState(AgentState.REGISTRATION_FAILED));

    del.onNewMessage(this._handleMessageEvent);

    // @experimental
    if (del.onSubscribe)
      del.onSubscribe(this._handleSubscribeEvent);

    await this._agent.start();
    await this._agent.register();

    return this;
  }

  /**
   * Internal dispose function of the agent
   */
  private _dispose = async (): Promise<void> => {
    await this._agent.unregister();
    await this._agent.stop();
  }

  /**
   * Unregisteres from the ESRP and disposes the SIP agent. \
   * Closes open calls, if there are any. \
   * This function has to be called before exiting the application.
   */
  dispose = async (disposeObject?: DisposeObject): Promise<void> => {
    const {
      gracePeriod = 10000,
      sendMessageObject,
    } = disposeObject ?? {};

    const openConversations = this.conversations.filter(x =>
      x.state.value !== ConversationState.STOPPED &&
      x.state.value !== ConversationState.ERROR
    );

    if (openConversations.length > 0) {
      this._logger.log(`Closing ${openConversations.length} open call(s) on agent dispose.`)

      if (disposeObject)
        this._logger.log(`Using object for closing calls: ${JSON.stringify(sendMessageObject)}`);
    }

    for (const c of openConversations) {
      try {
        await timedoutPromise(c.stop(sendMessageObject).promise, gracePeriod);
      } catch {
        this._logger.error(`Could not close conversation ${c.id}. Timeout after ${gracePeriod}ms.`);
      }
    }

    try {
      await timedoutPromise(this._dispose(), gracePeriod);
    }
    catch {
      this._logger.error(`Could not dispose agent. Timeout after ${gracePeriod}ms.`);
    }
  }

  // TODO: Also support URNs
  // Requires a change in JSSIP library to also accept URNs as a valid target
  /**
   * Creates a new configuration on top of the underlying agent
   * 
   * @param target The target SIP uri conversation should be established with\ 
   * Currently, URNs are **not** supported! This is due to a limitation within the JSSIP library.
   * @param configuration Additional configuration object
   * @param mapper The mapper to use for this conversation
   */
  createConversation(
    target: string,
    configuration?: ConversationConfiguration,
    mapper?: Mapper,
  ): Conversation;
  /**
   * Creates a new configuration on top of the underlying agent
   * 
   * @param event A new message event for an incoming message 
   * @param mapper The mapper to use for this conversation
   */
  createConversation(
    event: NewMessageEvent,
    configuration?: ConversationConfiguration,
    mapper?: Mapper,
  ): Conversation;
  createConversation(
    value: any,
    configuration?: ConversationConfiguration,
    mapper: Mapper = this._mapper.default,
  ): Conversation {
    let conversation: Conversation | undefined = undefined;
    let event: NewMessageEvent | undefined = undefined;

    if (typeof value === 'string') {
      conversation = new Conversation(
        this._agent,
        this._store,
        value as string,
        mapper,
        configuration,
      );
    }
    else if (typeof value === 'object') {
      event = value as NewMessageEvent;

      conversation = Conversation.fromIncomingSipMessage(
        this._agent,
        this._store,
        mapper,
        event,
      );
    }

    if (conversation) {
      this.conversations.push(conversation);

      const stopListener = (state: StateObject) => {
        if (!conversation || state.value !== ConversationState.STOPPED)
          return;

        conversation.removeStateListener(stopListener);
        const index = this.conversations.indexOf(conversation);

        if (index !== -1)
          this.conversations.splice(index, 1);
      }
      // this callback ensures that once a conversation is STOPPED, it is removed from our global conversations list.
      conversation.addStateListener(stopListener);

      for (const callback of this._conversationListeners) {
        callback(conversation, event);
      }

      return conversation;
    }
    else
      throw new Error('Argument 1 has to be either of type "NewMessageEvent" or of type "string".');
  }

  /**
   * Updates the agent's location for subsequent messages
   * 
   * @param location New location object (may be `undefined`)
   */
  updateLocation = (location?: PidfLo | SimpleLocation): void => {
    this._store.updateLocation(getPidfLo(this._store.originSipUri, location));
  }

  /**
   * Updates the agent's vcard for subsequent messages
   * 
   * @param vcard New vcard object (may be `undefined`)
   */
  updateVCard = (vcard?: VCard): void => { this._store.updateVCard(vcard); }

  /**
   * See {@link Store.setHeartbeatInterval} for implementation details
   */
  // tsdoc should be done via @inheritdoc, but obviously this is currently not working with typedoc
  setHeartbeatInterval = (interval?: number): void => {
    this._store.setHeartbeatInterval(interval);
  }

  /**
   * Set the agent's mode. This is particularly important if an app is going into background mode. \
   * According to ETSI TS 103 698 6.2.5, keep-alive messages may be sent with an inactive flag, if the app is in background.
   * @param mode The agent's mode
   */
  setMode = (mode?: AgentMode) => {
    this._store.setMode(mode);
  }

  /**
   * Adds a conversation listener. Callback will be notified about any new conversations.
   * 
   * @param callback Callback function that is called each time a new conversation is started.
   * @param event Message event that triggered the creation of this conversation. \
   * Property is only defined if conversation was started by a remote message (e.g. mostly in PSAP environments).
   */
  addConversationListener = (callback: (conversation: Conversation, event?: NewMessageEvent) => void): void => {
    this._conversationListeners.push(callback);
  }

  /**
   * Registers a new listener for agent state changes
   * 
   * @param callback Callback function that is called each time the agent's state changes
   */
  addStateListener = (callback: (state: AgentState) => unknown) => {
    this._stateListeners.push(callback);
  }

  private _notifyStateListeners = (state: AgentState): void => {
    for (const listener of this._stateListeners) {
      listener(state);
    }
  }

  getMapper = (namespace: Namespace): Mapper => {
    switch (namespace) {
      case Namespace.DEC112:
        return this._mapper.dec112;
      default:
        return this._mapper.etsi;
    }
  }

  /**
   * All conversations that have not been stopped already
   */
  public get conversations() { return this._store.conversations }
  /**
   * All conversations that have not been stopped already
   */
  public set conversations(value) { this._store.conversations = value }

  /////////////////////////////////////////////////////////////////////////////
  ///////////////////////////// DANGER ZONE BELOW /////////////////////////////
  /////////////////////////////////////////////////////////////////////////////

  /**
   * The following danger zone consists of implementations that are not yet ready for production
   * They are not part of any feature description or CHANGELOG
   * However they may be included within documentation, marked with @experimental
   * 
   * DO NOT USE THESE INTERFACES IN PRODUCTION
   * 
   * They are subject to change, even within a major version, so be careful!
   */

  /**
   * @experimental
   * 
   * Please be aware this interface is experimental and might change even within a major version!
   * 
   * Currently it's only used for dequeue registration.
   * As dequeue registration is not stable as a whole, the same is true for this interface.
   * 
   * Sets an HTTP adapter for the agent.
   * ng112-js does not have an internal library for issuing HTTP calls.
   * Therefore it's dependent on an external implementation
   * that can be set with this function call
   * 
   * @param adapter The adapter object to be used for HTTP calls
   */
  setHttpAdapter = (adapter?: HttpAdapter) => {
    // this console.warn is intentional, just as warning towards the user
    console.warn('You are using ng112-js HTTP adapter. This interface is not stable.\nDO NOT USE THIS IN PRODUCTION!');

    this._store.setHttpAdapter(adapter);
  }

  /**
   * @experimental
   */
  private _dequeueRegistrations: DequeueRegistration[] = [];
  /**
   * @experimental
   */
  private _subscribers: Subscriber[] = [];

  /**
   * @experimental
   */
  private _handleSubscribeEvent = (from: string, event: string) => {
    // currently we only feature one event
    // therefore we just ignore all other event subscriptions
    if (event !== 'emergency-QueueState')
      return;

    const subscriber = {
      sipUri: from,
    };
    this._subscribers.push(subscriber);
  }

  /**
   * @experimental
   */
  notifySubscribers = (uri: string, length: number, maxLength: number, state: QueueState) => {
    const notification: QueueStateNotification = {
      QueueStateEventUri: uri,
      QueueStateEventQueueLength: length,
      QueueStateEventMaxLength: maxLength,
      QueueStateValuesCode: state,
    };

    const stringified = JSON.stringify(notification);

    for (const subscriber of this._subscribers) {
      // TODO: provide constant
      this._agent.notify(subscriber.sipUri, 'emergency-QueueState', stringified);
    }
  }

  /**
   * @experimental
   */
  registerForQueue = async (registration: DequeueRegistration): Promise<DequeueRegistration> => {
    // this console.warn is intentional, just as warning towards the user
    console.warn('You are using ng112-js dequeue registration. This interface is not stable.\nDO NOT USE THIS IN PRODUCTION!');

    const req: DequeueRegistrationRequest = {
      DequeueRegistrationDequeuer: this._store.originSipUri,
      DequeueRegistrationQueueUri: registration.uri,
      DequeueRegistrationExpirationTime: registration.expires,
    };

    if (registration.preference)
      req.DequeueRegistrationDequeuePreference = registration.preference;

    const res: DequeueRegistrationResponse = await this._store.getHttpAdapter().post(registration.endpoint, req);

    if (res.DequeueRegistrationStatusCode === OK && res.DequeueRegistrationExpirationTime > 0) {
      registration.expires = res.DequeueRegistrationExpirationTime;

      // TODO: automatic renewal
      this._dequeueRegistrations.push(registration);
    }

    return registration;
  }

  /**
   * @experimental
   */
  unregisterFromQueue = async (uri: string): Promise<DequeueRegistration> => {
    const reg = this._dequeueRegistrations.find(x => x.uri === uri);

    if (!reg)
      throw new Error(`Not registered for queue ${uri}`);

    // 0 -> unregister
    reg.expires = 0;

    await this._store.getHttpAdapter().post(reg.endpoint, reg);

    // we check here again, as with asynchronous commands the array could have been altered in the meantime
    const index = this._dequeueRegistrations.indexOf(reg);
    if (index !== -1)
      this._dequeueRegistrations.splice(index, 1);

    return reg;
  }
}