import { UA, debug } from 'jssip';
import { getSocketInterface } from '../jssip/socket-interface';
import { CALL_INFO } from '../constants/headers';
import { DEC112Mapper, DEC112Specifics } from '../namespaces/dec112';
import { EmergencyMapper } from '../namespaces/emergency';
import { NamespacedConversation, NamespaceSpecifics } from '../namespaces/interfaces';
import { Conversation } from './conversation';
import { ConversationConfiguration } from './interfaces';
import { CustomSipHeaders, Store } from './store';
import { VCard } from './vcard';
import type { PidfLo, SimpleLocation } from 'pidf-lo';
import PidfLoCompat from '../compatibility/pidf-lo';
import { CustomSipHeader } from './custom-sip-header';

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
   * If `debugMode` is set to `true`, verbose log messages will be printed to the console
   */
  debugMode?: boolean,
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
}

/**
 * Main instance for establishing connection with an ETSI/DEC112 infrastructure
 */
export class Agent {
  private _agent: UA;

  private _mapper: {
    default: NamespacedConversation,
    etsi: EmergencyMapper,
    dec112: DEC112Mapper,
  };

  private _store: Store;

  private _conversationListeners: ((conversation: Conversation) => void)[] = [];

  /**
   * Creates a new instance of an agent for communication with an ETSI/DEC112 infrastructure
   */
  constructor({
    endpoint,
    domain,
    user,
    password,
    displayName,
    debugMode = false,
    namespaceSpecifics,
    customSipHeaders,
  }: AgentConfiguration) {
    const originSipUri = customSipHeaders?.from ?
      CustomSipHeader.resolve(customSipHeaders.from) :
      `sip:${user ? `${user}@` : ''}${domain}`;

    this._agent = new UA({
      sockets: [
        getSocketInterface(endpoint),
      ],
      uri: originSipUri,
      authorization_user: user,
      realm: domain,
      password,
      display_name: displayName,
      register: true,
    });

    this._store = new Store(
      originSipUri,
      customSipHeaders,
    );

    const hasDEC112Specifics = namespaceSpecifics instanceof DEC112Specifics;

    const dec112 = new DEC112Mapper(hasDEC112Specifics ? namespaceSpecifics : undefined);
    const etsi = new EmergencyMapper();

    this._mapper = {
      default: hasDEC112Specifics ? dec112 : etsi,
      etsi,
      dec112,
    }

    // enable or disable JsSIP debugging
    debug[debugMode ? 'enable' : 'disable']('JsSIP:*');
  }

  private _handleMessageEvent = (evt: JsSIP.UserAgentNewMessageEvent) => {
    const { request } = evt;

    const callInfoHeaders = request.getHeaders(CALL_INFO);
    let mapper: NamespacedConversation;

    if (this._mapper.dec112.isCompatible(callInfoHeaders))
      mapper = this._mapper.dec112;
    else if (this._mapper.etsi.isCompatible(callInfoHeaders))
      mapper = this._mapper.etsi;
    else {
      console.warn('Incoming message is not compatible to DEC112 or ETSI standards and will therefore not be processed.');
      return;
    }

    const conversationId = mapper.getCallIdFromHeaders(request.getHeaders(CALL_INFO));

    if (conversationId) {
      let conversation = this._store.conversations.find(x => x.id == conversationId);

      if (!conversation)
        conversation = this.createConversation(evt, undefined, mapper);

      conversation.handleMessageEvent(evt);
    }
    else
      console.warn('Can not process message due to missing call id.');
  }

  /**
   * Initializes the agent's internals sends a `REGISTER` to the ESRP
   * This has to be called before any other interaction with the library
   */
  initialize = (): Promise<Agent> => {
    const promise = new Promise<Agent>((resolve, reject) => {
      // TODO: issue an event when the stack is restarting/reconnecting
      // this._agent.on('connecting', () => console.log('ws connecting'));
      // this._agent.on('connected', () => console.log('ws connected'));
      // this._agent.on('disconnected', () => console.log('ws disconnected'));
      this._agent.on('registered', () => {
        resolve(this);
      });
      // this._agent.on('unregistered', () => console.log('unregistered'));
      this._agent.on('registrationFailed', (evt) => {
        reject(evt);
      });
      this._agent.on('newMessage', (evt: any) => this._handleMessageEvent(evt));
    });

    this._agent.start();

    return promise;
  }

  /**
   * Unregisteres from the ESRP and disposes the SIP agent
   * This has to be called before exiting the application
   */
  dispose = async (): Promise<void> => {
    // TODO: should also close open calls

    const promise = new Promise<void>(async resolve => {
      // we give a maximum of 1000 ms to unregister after which we just terminate the session
      const timeout = setTimeout(() => resolve(), 1000);

      const unregisterPromise = new Promise<void>(resolveUnregister => {
        this._agent.on('unregistered', () => resolveUnregister());
      });

      const disconnectPromise = new Promise<void>(resolveDisconnct => {
        this._agent.on('disconnected', () => resolveDisconnct());
      });

      await Promise.all([
        unregisterPromise,
        disconnectPromise,
      ]);

      clearTimeout(timeout);
    });

    this._agent.unregister();
    this._agent.stop();

    await promise;
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
   * @param event A JSSIP event for an incoming message 
   * @param mapper The mapper to use for this conversation
   */
  createConversation(
    event: JsSIP.UserAgentNewMessageEvent,
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
        value as JsSIP.UserAgentNewMessageEvent,
      );
    }

    if (conversation) {
      // TODO: fix memory leak -> where and when are those conversations removed from memory?
      this._store.conversations.push(conversation);

      for (const callback of this._conversationListeners) {
        callback(conversation);
      }

      return conversation;
    }
    else
      throw new Error('Argument 1 has to be either of type "JSSIP.IncomingRequest" or of type "string".');
  }

  /**
   * Updates the agent's location for subsequent messages
   * 
   * @param location New location object (may be `undefined`)
   */
  updateLocation = (location?: PidfLo | SimpleLocation): void => {
    let pidflo: PidfLo | undefined;

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
  setHearbeatInterval = (interval: number): void => {
    this._store.setHeartbeatInterval(interval);
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
   * All conversations
   */
  public get conversations() { return this._store.conversations }

  // newCall = async (targetSipUri: string): Promise<Call> => {
  //   const call = new Call(this._agent, targetSipUri);
  //   return call.initialize();
  // }
}