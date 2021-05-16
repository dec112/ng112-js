import { CALL_INFO } from '../constants/headers';
import { DEC112Mapper, DEC112Specifics } from '../namespaces/dec112';
import { EmergencyMapper } from '../namespaces/emergency';
import { NamespacedConversation, NamespaceSpecifics } from '../namespaces/interfaces';
import { Conversation, ConversationState, StateObject } from './conversation';
import { ConversationConfiguration } from './interfaces';
import { CustomSipHeaders, Store, AgentMode } from './store';
import { VCard } from './vcard';
import type { PidfLo, SimpleLocation } from 'pidf-lo';
import PidfLoCompat from '../compatibility/pidf-lo';
import { CustomSipHeader } from './custom-sip-header';
import { Logger, LogLevel } from './logger';
import { NewMessageEvent, SipAgent, SupportedAgent } from './sip-agent';
import { timedoutPromise } from '../utils';

export interface AgentConfiguration {
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
   * If `debug` is set to `true`, verbose log messages will be printed to the console \
   * If `debug` is set to a callback, this callback will be called for each debug statement
   */
  debug?: number | ((level: number, ...values: any[]) => unknown),
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
   * A preferred SIP library can be specified here, if more than one SIP library is installed
   */
  preferredSipAgent?: SupportedAgent,
}

export enum AgentState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  REGISTERED = 'registered',
  UNREGISTERED = 'unregistered',
  REGISTRATION_FAILED = 'registrationFailed',
}

/**
 * Main instance for establishing connection with an ETSI/DEC112 infrastructure
 */
export class Agent {
  private _agent: SipAgent;
  private _stateListeners: ((state: AgentState) => void)[] = [];

  private _mapper: {
    default: NamespacedConversation,
    etsi: EmergencyMapper,
    dec112: DEC112Mapper,
  };

  private _store: Store;
  private _logger: Logger;

  private _conversationListeners: ((conversation: Conversation) => void)[] = [];

  /**
   * Creates a new instance of an agent for communication with an ETSI/DEC112 infrastructure
   */
  constructor(config: AgentConfiguration) {
    const {
      domain,
      user,
      debug = LogLevel.NONE,
      namespaceSpecifics,
      customSipHeaders,
    } = config;

    const originSipUri = customSipHeaders?.from ?
      CustomSipHeader.resolve(customSipHeaders.from) :
      `sip:${user ? `${user}@` : ''}${domain}`;

    const debugFunction = typeof debug === 'function' ? debug : undefined;
    // TypeScript does not get that this is already type safe
    // It says we should do the typecheck another time, but this is not necessary
    // @ts-expect-error
    this._logger = new Logger(debugFunction ? LogLevel.ALL : debug, debugFunction);

    this._store = new Store(
      originSipUri,
      this._logger,
      customSipHeaders,
    );

    this._agent = new SipAgent({
      ...config,
      originSipUri,
      logger: this._logger,
    });

    const hasDEC112Specifics = namespaceSpecifics instanceof DEC112Specifics;

    const dec112 = new DEC112Mapper(hasDEC112Specifics ? namespaceSpecifics : undefined);
    const etsi = new EmergencyMapper();

    this._mapper = {
      default: hasDEC112Specifics ? dec112 : etsi,
      etsi,
      dec112,
    }
  }

  private _handleMessageEvent = (evt: NewMessageEvent) => {
    const callInfoHeaders = evt.getHeaders(CALL_INFO);
    let mapper: NamespacedConversation;

    if (this._mapper.dec112.isCompatible(callInfoHeaders))
      mapper = this._mapper.dec112;
    else if (this._mapper.etsi.isCompatible(callInfoHeaders))
      mapper = this._mapper.etsi;
    else {
      this._logger.warn('Incoming message is not compatible to DEC112 or ETSI standards and will therefore not be processed.');
      return;
    }

    const conversationId = mapper.getCallIdFromHeaders(evt.getHeaders(CALL_INFO));

    if (conversationId) {
      let conversation = this.conversations.find(x => x.id == conversationId);

      if (!conversation)
        conversation = this.createConversation(evt, undefined, mapper);

      conversation.handleMessageEvent(evt);
    }
    else
      this._logger.warn('Can not process message due to missing call id.');
  }

  /**
   * Initializes the agent's internals sends a `REGISTER` to the ESRP
   * This has to be called before any other interaction with the library
   * If registration fails, promise will be rejected
   */
  initialize = async (): Promise<Agent> => {
    const newState = this._notifyStateListeners;

    const del = this._agent.delegate;

    del.onConnect(() => newState(AgentState.CONNECTED));
    del.onConnecting(() => newState(AgentState.CONNECTING));
    del.onDisconnect(() => newState(AgentState.DISCONNECTED));
    del.onRegister(() => newState(AgentState.REGISTERED));
    del.onUnregister(() => newState(AgentState.UNREGISTERED));
    del.onRegistrationFail(() => newState(AgentState.REGISTRATION_FAILED));

    del.onNewMessage(this._handleMessageEvent);

    await this._agent.start();
    await this._agent.register();

    return this;
  }

  /**
   * Unregisteres from the ESRP and disposes the SIP agent. \
   * Closes open calls, if there are any. \
   * This function has to be called before exiting the application.
   * 
   * @param gracePeriod Timeout for all actions done before disposing the agent in milliseconds. \
   * If there are still open calls, this grace period applies to each call closure. \
   * Grace period also applies to unregistering and disconnecting the agent.
   */
  dispose = async (gracePeriod: number = 2000): Promise<void> => {
    const openConversations = this.conversations.filter(x => x.state.value !== ConversationState.STOPPED);

    if (openConversations.length > 0)
      this._logger.log(`Closing ${openConversations.length} open call(s) on agent dispose.`)

    for (const c of openConversations) {
      try {
        await timedoutPromise(c.stop().promise, gracePeriod);
      } catch {
        this._logger.error(`Could not close conversation ${c.id}. Timeout after ${gracePeriod}ms.`);
      }
    }

    const unregisterPromise = this._agent.unregister();
    const disconnectPromise = this._agent.stop();

    try {
      unregisterPromise.then(() => this._logger.log('Unregistered.'));
      disconnectPromise.then(() => this._logger.log('Disconnected.'));

      await timedoutPromise(Promise.all([
        unregisterPromise,
        disconnectPromise,
      ]), gracePeriod);
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
    mapper?: NamespacedConversation,
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
    mapper?: NamespacedConversation,
  ): Conversation;
  createConversation(
    value: any,
    configuration?: ConversationConfiguration,
    mapper: NamespacedConversation = this._mapper.default,
  ) {
    let conversation: Conversation | undefined = undefined;

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
      conversation = Conversation.fromIncomingSipMessage(
        this._agent,
        this._store,
        mapper,
        value as NewMessageEvent,
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
        callback(conversation);
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
    let pidflo: PidfLo | undefined = undefined;

    if (location) {
      if (!(location instanceof PidfLoCompat.PidfLo)) {
        pidflo = PidfLoCompat.PidfLo.fromSimpleLocation(location, this._store.originSipUri);
      }
      else
        pidflo = location;
    }

    this._store.updateLocation(pidflo);
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
   */
  addConversationListener = (callback: (conversation: Conversation) => void): void => {
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

  /**
   * All conversations that have not been stopped already
   */
  public get conversations() { return this._store.conversations }

  // newCall = async (targetSipUri: string): Promise<Call> => {
  //   const call = new Call(this._agent, targetSipUri);
  //   return call.initialize();
  // }
}