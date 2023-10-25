import { getHeaderString, getPidfLo, getRandomString, Header, parseNameAddrHeaderValue } from '../../utils';
import type { PidfLo, SimpleLocation } from 'pidf-lo';
import { QueueItem } from '../queue-item';
import { EmergencyMessageType } from '../../constants/message-types/emergency';
import { Mapper, Namespace } from '../../namespaces/interfaces';
import { Store, AgentMode } from '../store';
import { Message, Origin, MessageState, MessageError, Binary } from '../message';
import { CALL_INFO, REPLY_TO, ROUTE, CONTENT_TYPE } from '../../constants/headers';
import { TEXT_PLAIN } from '../../constants/content-types';
import { MultipartPart } from '../multipart';
import { ConversationConfiguration, EndpointType, ListenerNotifier } from '../interfaces';
import { clearInterval, setInterval, Timeout } from '../../utils';
import { VCard } from 'vcard-xml';
import { CustomSipHeader } from '../custom-sip-header';
import { Logger } from '../logger';
import { NewMessageEvent, SipAdapter } from '../../adapters';
import { NewMessageRequest } from '../../adapters/sip-adapter';
import { ConversationStateMachine, createConversationState, EventObject, Transition } from './state';

export enum ConversationState {
  UNKNOWN = 'unknown',
  STARTED = 'started',
  INTERRUPTED = 'interrupted',
  STOPPED = 'stopped',
  ERROR = 'error',
}

export interface SendMessageObject {
  /**
   * Text message to be sent
   */
  text?: string,
  /**
   * HTML message to be sent
   */
  html?: string,
  /**
   * A location to be sent with the message
   */
  location?: PidfLo | SimpleLocation,
  /**
   * A VCard to be sent with the message
   */
  vcard?: VCard,
  /**
   * URIs to send along with the message (e.g. for deep linking something)
   */
  uris?: string[],
  /**
   * @experimental
   * 
   * Please be aware this interface is experimental and might change even within a major version!
   * 
   * A list of binaries (files)
   */
  binaries?: Binary[],
  /**
   * Additional (custom) Multipart MIME parts to add to the message
   */
  extraParts?: MultipartPart[],
  /**
   * Additional SIP headers to be sent with the message
   */
  extraHeaders?: Header[],
  /**
   * Message type (bitmask) according to ETSI TS 103 698\
   * Defaults to `EmergencyMessageType.IN_CHAT`\
   * See {@link EmergencyMessageType} for more information
   */
  type?: number,
  /**
   * Custom message id\
   * *Be careful!* This message id has to be unique across the whole conversation for all outgoing messages\
   * This does not apply for all incoming messages. They can have _another_ set of unique message ids.
   */
  messageId?: number,
  /**
   * A free to use property for internal identification and matching of messages
   */
  tag?: any,
}

export interface StateObject {
  value: ConversationState,
  origin: Origin,
}

export class Conversation {
  private _logger: Logger;
  /**
   * A unique conversation id\
   * according to spec, 30 characters is the longest allowed string
   */
  public readonly id: string;

  /**
   * The display name that's used for outgoing message
   * This property is public intentionally, as PSAPs should have the possibility
   * for setting this property, even if the conversation is already running
   * 
   * However, don't change displayName during an ongoing conversation
   * as this can lead to unexpected behaviour!
   * Use one and only one displayName throughout a conversation!
   */
  public displayName?: string;

  private _heartbeatInterval?: Timeout;

  private _queue: QueueItem[];
  private _messageListeners: Set<(message: Message) => void> = new Set();
  private _stateListeners: Set<(state: StateObject) => void> = new Set();

  // TODO: Find a better solution for this lastSentXXX stuff
  private _lastSentLocation?: PidfLo = undefined;
  private _lastSentVCard?: VCard = undefined;
  private _lastSentDID?: string = undefined;

  // TODO: This mechanism (not sending 2 start messages) should be enforced
  // by our state machine and not by a separate variable!
  private _hasSentStartMessage: boolean = false;
  public get hasSentStartMessage() { return this._hasSentStartMessage }

  private _state: ConversationStateMachine;
  public get hasBeenStarted(): boolean { return this._state.state.context.hasBeenStarted; }
  public get state(): StateObject {
    const { state } = this._state;

    return {
      origin: state.context.origin,
      value: state.value,
    }
  }

  /**
   * Last used message id \
   * Important for restoring conversations
   */
  public get messageId() { return this._messageId }
  private _messageId: number;

  /**
   * Type of endpoint
   */
  public get endpointType() { return this._endpointType }
  private _endpointType: EndpointType;

  /**
   * All messages that were sent or received
   */
  public get messages() { return this._messages }
  private _messages: Message[] = [];

  /**
   * This is the uri that was requested by the other communicating party
   * e.g. if ng112-js is used as PSAP, this would be the SIP address that was requested by the mobile device
   * This address can potentially differ from what ng112-js is using to register at the SIP proxy\
   * \
   * Keep in mind that this property is only set after the first remote message was processed!
   */
  public get requestedUri() { return this._requestedUri }
  private _requestedUri?: string;

  /**
   * The final destination within the ESinet, derived from SIP Route header
   * This property is most useful for PSAPs, as it represents the final routing decision made by ECRF, PRF ...
   */
  public get routeUri() { return this._routeUri }
  private _routeUri?: string;

  /**
   * This is the other communicating party's display name (if sent) \
   * \
   * Keep in mind that this property is only set after the first remote message was processed!
   */
  public get remoteDisplayName() { return this._remoteDisplayName }
  private _remoteDisplayName?: string;

  /**
   * Date and time of the first sent/received message
   */
  public get created() { return this._created }
  private _created?: Date;

  /**
   * Defines, whether the call should be marked as test call
   * Currently only supported in DEC112 environments
   */
  public readonly isTest: boolean;
  /**
   * Defines, whether the call should be marked as "silent" emergency call
   * Currently only supported in DEC112 environments
   */
  public readonly isSilent: boolean;

  public constructor(
    private _agent: SipAdapter,
    private _store: Store,

    /**
     * This is the target device we are communicating with -> the other communicating party
     * e.g. if ng112-js is used as PSAP, this would be the SIP address of a mobile device
     */
    public targetUri: string,

    /**
     * The mapper for this environment for compatibility
     */
    public readonly mapper: Mapper,

    /**
     * Configuration object for additional conversation configuration
     */
    config?: ConversationConfiguration,
  ) {
    this._messageId = config?.messageId ?? 1;
    this.displayName = config?.displayName;
    this._logger = this._store.logger;
    this._queue = [];

    this.id = config?.id ?? getRandomString(30);

    this.isTest = config?.isTest ?? false;
    this.isSilent = config?.isSilent ?? false;

    this._endpointType = config?.endpointType ?? EndpointType.CLIENT;

    this._state = createConversationState(this, config?.state);
    this._state.subscribe((state) => {
      // we are not interested, if the same state is set
      if (!state.changed)
        return;

      if (state.value === ConversationState.STARTED)
        this._store.addHeartbeatIntervalListener(this._onUpdateHeartbeatInterval);
      else
        this._store.removeHeartbeatIntervalListener(this._onUpdateHeartbeatInterval);

      this._manageHeartbeat();
    });
    this._state.start();

    // manageHeartbeat is necessary here as someone could have already set the conversation's
    // state to `STARTED` which means also heartbeat has to be started
    this._manageHeartbeat();
  }

  private _updateMessagePropsIfIsClient = (message: Message) => {
    // only clients can send location and vcard
    // update the message with latest information
    if (this._endpointType === EndpointType.CLIENT) {

      // message location takes precedence over location that's inside the store
      const currentLocation = message.location ?? this._store.getLocation();
      if (currentLocation) {
        if (
          !this._lastSentLocation ||
          !this._lastSentLocation.equals(currentLocation)
        )
          this._lastSentLocation = message.location = currentLocation;
      }

      // TODO: obviously we have very similar handling of VCard and DIDs here
      // Find a way to abstract this to not have duplicate code
      // message vcard takes precedence over location that's inside the store
      const currentVCard = message.vcard ?? this._store.getVCard();
      if (currentVCard) {
        if (!this._lastSentVCard || !this._lastSentVCard.equals(currentVCard))
          this._lastSentVCard = message.vcard = currentVCard;
      }

      const currentDID = this._store.getDID();
      if (currentDID) {
        if (!this._lastSentDID || this._lastSentDID !== currentDID)
          this._lastSentDID = message.did = currentDID;
      }

      // According to ETSI TS 103 698 6.2.5, we may add the INACTIVE bit if app is running in the background
      if (EmergencyMessageType.isHeartbeat(message.type) && this._store.getMode() === AgentMode.INACTIVE)
        // adds INACTIVE bit
        message.type |= EmergencyMessageType.INACTIVE;
      else
        // in all other cases we must remove this particular bit
        // clears INACTIVE bit
        message.type &= ~EmergencyMessageType.INACTIVE;
    }
    else
      message.location = message.vcard = undefined;
  }

  private _sendSipMessage = async ({
    message,
    resolve,
    reject,
  }: QueueItem): Promise<void> => {
    this._updateMessagePropsIfIsClient(message);

    let replyToSipUri = this._store.originSipUri;
    if (this._store.customSipHeaders?.replyTo)
      replyToSipUri = CustomSipHeader.resolve(this._store.customSipHeaders.replyTo);

    // right before sending the message we update the timestamp to be more accurate
    message.dateTime = new Date();

    try {
      const { headers, multipart } = this.mapper.createSipParts({
        message,
        targetUri: this.targetUri,
        isTest: this.isTest,
        isSilent: this.isSilent,
        replyToSipUri,
        endpointType: this._endpointType,
      });

      let extraHeaders = headers;
      if (message.extraHeaders)
        extraHeaders = extraHeaders.concat(message.extraHeaders);

      let contentType: string;
      let body: string;

      if (
        // if multipart only contains one item
        // just use this item for setting the content type and body
        // no need to send the whole multipart object
        multipart.parts.length === 1 &&
        // yeah, this is not ideal
        // however, not sticking to multipart types can lead to problems in DEC112 environments
        // as not every PSAP will support handling mime types different than multiparts
        // therefore, as a safety precaution, we always send multipart mime bodies
        // however if we are in a DEC112 environment as a PSAP it is even preferred to not have multiparts
        // as not all clients may support multiparts for receiving text messages. Tricky, tricky :-)
        false === (this.mapper.getNamespace() === Namespace.DEC112 && this.endpointType === EndpointType.CLIENT)
      ) {
        const part = multipart.parts[0];
        contentType = part.headers.find(x => x.key === CONTENT_TYPE)?.value ?? TEXT_PLAIN;
        body = part.body;
        // otherwise we send the whole object
      } else {
        const multiObj = multipart.create();
        contentType = multiObj.contentType;
        body = multiObj.body;
      }

      await this._agent.message(this.targetUri, body, {
        contentType,
        extraHeaders: extraHeaders.map(h => getHeaderString(h)),
        displayName: this.displayName,
      });

      resolve();
    } catch (e) {
      const ex: MessageError = e as MessageError ?? {
        origin: Origin.SYSTEM,
        reason: 'Unknown error',
      };

      // TODO: What do we do when we get a 404?
      // The ESRP could connect us to another PSAP -> how can we transfer the whole communication to the new PSAP?
      // this is currently not described in the standards documents
      // maybe we should re-run the call with the initially requested URI
      // so that the ESRP can direct us to a new PSAP

      // TODO: What do we do when the error already happens at the first message?
      // TODO: What if we don't have network connection?

      // TODO: Setup local Kamailio for testing
      if (ex.origin === Origin.REMOTE)
        this._setState({
          type: Transition.ERROR,
          origin: ex.origin,
        })();

      this._logger.error('Could not send SIP message.', message, ex);

      reject(ex);
    }
  }

  // returns a function that triggers notification of listeners
  // important for deferred notification of listeners
  private _addNewMessage = (message: Message): ListenerNotifier => {
    this._messages.push(message);

    return () => {
      for (const listener of this._messageListeners) {
        listener(message);
      }
    };
  }

  private _notifyQueue = async () => {
    if (this.state.value === ConversationState.STOPPED) {
      // if conversation has been stopped there is no way of reincarnating it
      // stopped means stopped
      // therefore we reject all queued messages here
      // as there is no way for them to leave the SDK anymore
      for (const item of this._queue) {
        item.reject({
          origin: Origin.SYSTEM,
          reason: 'Can not send message in stopped conversation',
        });
      }

      this._queue = [];

      // stop execution here
      return;
    }

    // TODO: this state handling is currently NOT correct!
    // define at which states message can be sent
    // this might differ between PSAP and CLIENT
    // also consider conversation state while PSAP is handing over to another PSAP
    let queue: QueueItem[];

    if (this.hasBeenStarted) {
      queue = [...this._queue];
    } else {
      queue = [...this._queue.filter(x => (
        // START messages can always be sent
        x.message.type === EmergencyMessageType.START) ||
        // additionally, a PSAP can send STOP messages for non-started conversation
        // as it may reject incoming conversations due to various reasons
        // TODO: add regression test to avoid any errors here
        (this.endpointType === EndpointType.PSAP && x.message.type === EmergencyMessageType.STOP)
      )];
    }

    // take first item out of queue and send it
    while (queue.length > 0) {
      const toSend = queue.splice(0, 1)[0];
      this._queue.splice(this._queue.indexOf(toSend), 1);

      this._sendSipMessage(toSend);
    }
  }

  // Heartbeat is only allowed for clients. PSAPs must not send hearbeat messages
  // Also, if `heartbeatInterval` is set to `0` it means heartbeat is disabled
  private _isHeartbeatAllowed = () =>
    this.state.value === ConversationState.STARTED &&
    this._endpointType === EndpointType.CLIENT &&
    this._store.getHeartbeatInterval() > 0;

  private _startHeartbeat = () => {
    if (this._heartbeatInterval || !this._isHeartbeatAllowed())
      return;

    const intervalMs = this._store.getHeartbeatInterval();

    this._logger.log(`Starting heartbeat with interval of ${intervalMs} ms.`);
    this._heartbeatInterval = setInterval(
      intervalMs,
      () => {
        const msg = this.sendMessage({
          type: EmergencyMessageType.HEARTBEAT,
        });
        this._logger.log(`Sending heartbeat message.`, msg);
      },
    );
  }

  private _stopHeartbeat = () => {
    if (!this._heartbeatInterval)
      return;

    this._logger.log(`Stopping heartbeat.`);
    clearInterval(this._heartbeatInterval);
    this._heartbeatInterval = undefined;
  }

  private _manageHeartbeat = () => {
    // this will ensure heartbeat is updated with latest settings
    // e.g. if heartbeat interval was changed...
    this._stopHeartbeat();

    if (this._isHeartbeatAllowed())
      this._startHeartbeat();
  }

  private _onUpdateHeartbeatInterval = () => {
    this._manageHeartbeat();
  }

  // TODO: setState should be available publicly, as an app should also be able to set the conversation's state
  // e.g. if conversation is in ERROR state and app wants to resume operation
  /**
   * This may look a bit odd but when closing the call it is necessary to set the conversation's call
   * without notifying listeners immediately
   * 
   * Therefore a function is returned that can be invoked by the caller when suitable
   * 
   * @returns function to notify all listeners
   */
  private _setState = (eventObject: EventObject): () => void => {
    const prev = this.state;
    this._state.send(eventObject);
    const curr = this.state;

    if (prev.value === curr.value)
      // do not notify listeners if value has not changed
      return () => undefined;
    else
      return () => {
        const state = this.state;
        // Creating a copy of stateListeners as listeners might unsubscribe during execution
        // ...and altering a set while iterating it is not nice :-)
        for (const listener of new Set(this._stateListeners)) {
          listener(state);
        }
      };
  }

  /**
   * Starts the conversation
   * 
   * This is basically a convenience function on top of `sendMessage` \
   * It automatically sets the correct message type "START"
   */
  start = (sendMessageObj?: SendMessageObject): Message => {
    sendMessageObj = {
      type: EmergencyMessageType.START,
      ...sendMessageObj,
    }

    return this.sendMessage(sendMessageObj);
  }

  /**
   * Ends the conversation
   * 
   * This is basically a convenience function on top of `sendMessage` \
   * It automatically sets the correct message type "STOP"
   */
  stop = (sendMessageObj?: SendMessageObject): Message => {
    sendMessageObj = {
      type: EmergencyMessageType.STOP,
      ...sendMessageObj,
    }

    return this.sendMessage(sendMessageObj);
  }

  /**
   * Sends a heartbeat message
   * 
   * This is basically a convenience function on top of `sendMessage` \
   * It automatically sets the correct message type "HEARTBEAT"
   */
  sendHeartbeat = (sendMessageObj?: SendMessageObject): Message => {
    sendMessageObj = {
      type: EmergencyMessageType.HEARTBEAT,
      ...sendMessageObj,
    }

    return this.sendMessage(sendMessageObj);
  }

  createLocalMessage = (
    sendMessageObj: SendMessageObject & Required<Pick<SendMessageObject, 'type'>>,
  ): Message => {
    const {
      messageId,
      type,
      binaries,
      extraHeaders,
      extraParts,
      location,
      tag,
      text,
      html,
      uris,
      vcard,
    } = sendMessageObj;

    const message = new Message({
      conversation: this,
      // if no message id is specified, use the internal sequence
      id: messageId ?? this._messageId++,
      type,
      origin: Origin.LOCAL,
      state: MessageState.PENDING,
      // this is just to satisfy typescript
      // promise will be set right below
      promise: new Promise(() => { }),
      location: getPidfLo(this._store.originSipUri, location),

      extraHeaders,
      tag,
      text,
      html,
      uris,
      vcard,
      binaries,
    });

    if (extraParts)
      message.multipart.addAll(extraParts);

    return message;
  }

  /**
   * Sends a text message
   */
  sendMessage(message: Message): Message;
  /**
   * Sends a text message
   */
  sendMessage(sendMessageObj: SendMessageObject): Message;
  sendMessage(messageParam: any): Message {
    let message: Message;

    if (messageParam instanceof Message)
      message = messageParam;
    else {
      let {
        type = EmergencyMessageType.IN_CHAT,
      } = messageParam;

      // According to ETSI TS 103 698 PSAP have to respond with an initial "START" message
      // However, DEC112 does not specify this


      // this is just a convenience function that API consumers don't have to explicitly START the conversation
      // e.g. if they just send an IN_CHAT message it is converted to a START message
      // only applies to PSAPs and only if they support the PSAP start message!
      // Clients still have to start the conversation explicitly with a message of type START
      if (
        !this.hasBeenStarted &&
        this._endpointType === EndpointType.PSAP &&
        EmergencyMessageType.isStarted(type)
      )
        // TODO: prevent sending of multiple START messages
        // this is currently possible on PSAP sides
        // maybe this can be prevented with another state in our state machine
        type = EmergencyMessageType.START;

      messageParam.type = type;
      message = this.createLocalMessage(messageParam);
    }

    this._updateMessagePropsIfIsClient(message);

    // this flag ensures that if start message sending goes wrong
    // it resets the "hasSentStartMessage" flag in order to again alow
    // sending if the start message
    // this is important such that "resend" can be used properly
    const isStartMessage = message.type === EmergencyMessageType.START;
    // do not allow sending of start message multiple times
    // TODO: this should be solved via a separate state in our state machine
    if (isStartMessage) {
      if (this.hasSentStartMessage)
        throw new Error('Start message must not be sent multiple times');
      else
        this._hasSentStartMessage = true;

      // check if SDK user has set vcard and location
      // and write log messages accordingly

      // it's not necessary to have a vcard, but it's better to have it
      if (!message.vcard)
        this._logger.log('Start message does not have a VCard');

      // location is indeed quite important that's why we log a warning here
      if (!message.location)
        this._logger.warn('Start message does not have a location');
    }

    const promise = new Promise<void>((resolve, reject) => {
      // this code is called before the outer function returns the message object
      // so it is perfectly safe :-)
      this._queue.push({
        message,
        resolve,
        reject,
      });
    });

    message.promise = promise;
    promise
      // don't use `catch` here!
      // this leads to problems in order of execution in case of errors
      // directly passing the error-handler to `then` works fine
      .then(
        // success
        () => { message.state = MessageState.SUCCESS },
        // error
        () => {
          message.state = MessageState.ERROR;

          if (isStartMessage)
            // important: reset the "hasSentStartMessage" flag
            // such that "resend" can be used properly
            this._hasSentStartMessage = false;
        },
      );


    const messageNotifier = this._addNewMessage(message);
    // notification listener must be executed explicitly
    // _addNewMessage does not inform listeners by default
    // this could be done by a direct invocation of the return value
    // however I think it's better to do it more explicitly with a separate variable
    messageNotifier();

    this._notifyQueue();

    return message;
  }

  /**
   * This function is only used internally and should not be called from outside the library
   * 
   * @returns A function which notifies all attached message listeners (can be used for deferred notifications)
   */
  handleMessageEvent = (evt: NewMessageEvent): ListenerNotifier => {
    if (!this._created)
      this._created = new Date();

    const req = evt.request;
    const { origin } = req;

    const message = this.mapper.parseMessageFromEvent(evt);

    const { type: messageType } = message;

    let stateCallback: ListenerNotifier | undefined = undefined;
    if (EmergencyMessageType.isStopped(messageType))
      stateCallback = this._setState({
        type: Transition.STOP,
        origin,
      });
    else if (EmergencyMessageType.isStarted(messageType))
      stateCallback = this._setState({
        type: Transition.START,
        origin,
        messageType,
      });
    else
      stateCallback = this._setState({
        type: Transition.INTERRUPT,
        origin,
      });

    let messageNotifier: ListenerNotifier | undefined = undefined
    if (origin === Origin.REMOTE) {
      if (req.hasHeader(REPLY_TO))
        // this is type safe as we've already checked whether this header exists or not
        this.targetUri = req.getHeader(REPLY_TO) as string;

      this._setPropsFromIncomingMessage(req);

      this._notifyQueue();

      messageNotifier = this._addNewMessage(new Message({
        ...message,
        conversation: this,
      }));
    }

    return () => {
      if (messageNotifier)
        messageNotifier();
      // this is called at the end of the function as we first want to notify listeners about the new message
      // only to inform them afterwards about the state change
      // however, listeners always have the possibility of retrieving the state from the conversation object at any time
      if (stateCallback)
        stateCallback();
    }
  }

  // TODO: find a better name
  // this sets fields from an incoming message
  private _setPropsFromIncomingMessage = (req: NewMessageRequest) => {
    const { to, from } = req;

    // This property is most useful for PSAPs
    // Usually, this property is set with the client's first message
    // It represents the initial "To" header that was set by the client
    if (!this._requestedUri)
      this._requestedUri = to.uri.toString();

    // This property is most useful for PSAPs
    // Usually, this property is set with the client's first message
    // Most probably, the client did not request for the final destination of the PSAP within the ESinet
    // Routing logic (ECRF, PRF) will define the final destination
    // This is what routedUri represents, the final destination
    if (!this._routeUri) {
      const routeHeader = req.getHeader(ROUTE);

      if (routeHeader)
        this._routeUri = parseNameAddrHeaderValue(routeHeader)?.uri;
    }

    this._remoteDisplayName = from.displayName;
  }

  /**
   * Registers a new listener for new incoming or outgoing messages
   * 
   * @param callback Callback function that is called each time a new incoming or outgoing message is received/sent
   */
  addMessageListener = (callback: (message: Message) => unknown) => {
    this._messageListeners.add(callback);
  }

  /**
   * Unregisters a previously registered message listener
   * 
   * @param callback Callback function that is called each time a new incoming or outgoing message is received/sent
   */
  removeMessageListener = (callback: (message: Message) => unknown) => {
    this._messageListeners.delete(callback);
  }

  /**
   * Registers a new listener for conversation state changes
   * 
   * @param callback Callback function that is called each time the conversation's state changes
   */
  addStateListener = (callback: (state: StateObject) => unknown) => {
    this._stateListeners.add(callback);
  }

  /**
   * Unregisters a previously registered conversation state listener
   * 
   * @param callback Callback function that is called each time the conversation's state changes
   */
  removeStateListener = (callback: (state: StateObject) => unknown) => {
    this._stateListeners.delete(callback);
  }

  /**
   * Creates a conversation out of an already existing SIP message (e.g. ETSI START message)
   */
  static fromIncomingSipMessage = (
    ua: SipAdapter,
    store: Store,
    mapper: Mapper,
    event: NewMessageEvent,
    endpointType: EndpointType = EndpointType.PSAP,
  ) => {
    const request = event.request;

    // if conversation is created from incoming SIP message AND
    // endpoint type is CLIENT AND
    // conversation already seems to be started
    // we already set its state to started.
    // This is used if PSAP transfers already running conversation
    // from one device to another (in case of fallbacks).
    // In this case it does not start the conversation anew
    // but rather continues sending messages.
    let state: StateObject | undefined = undefined;
    if (endpointType === EndpointType.CLIENT)
      try {
        const message = mapper.parseMessageFromEvent(event);
        if (EmergencyMessageType.isStarted(message.type))
          state = {
            origin: Origin.REMOTE,
            value: ConversationState.STARTED,
          };
      } catch { }

    const conversation = new Conversation(
      ua,
      store,
      request.from.uri.toString(),
      mapper,
      {
        id: mapper.getCallIdFromHeaders(request.getHeaders(CALL_INFO)),
        isTest: mapper.getIsTestFromEvent(event),
        isSilent: mapper.getIsSilentFromEvent(event),
        endpointType: endpointType,
        state,
      },
    );

    conversation._setPropsFromIncomingMessage(event.request);

    if (event.reject) {
      // if reject is possible, we monkey-patch it here
      // if SDK consumer rejects the initial message, we'll stop the conversation
      // rejecting the first message means the consumer can not process this call
      const sipReject = event.reject;
      event.reject = (options) => {
        conversation._setState({
          type: Transition.STOP,
          origin: Origin.LOCAL,
        });
        return sipReject(options);
      }
    }

    return conversation;
  }
}