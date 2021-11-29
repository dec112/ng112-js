import { getHeaderString, getRandomString, Header, parseNameAddrHeaderValue } from '../../utils';
import type { PidfLo, SimpleLocation } from 'pidf-lo';
import { QueueItem } from '../queue-item';
import { EmergencyMessageType } from '../../constants/message-types/emergency';
import { Mapper } from '../../namespaces/interfaces';
import { Store, AgentMode } from '../store';
import { Message, Origin, MessageState, MessageError, Binary, createLocalMessage } from '../message';
import { CALL_INFO, REPLY_TO, ROUTE } from '../../constants/headers';
import { MultipartPart } from '../multipart';
import { ConversationConfiguration } from '../interfaces';
import { clearInterval, setInterval, Timeout } from '../../utils';
import { VCard } from '../vcard';
import { CustomSipHeader } from '../custom-sip-header';
import { Logger } from '../logger';
import { NewMessageEvent, SipAdapter } from '../../adapters';
import { NewMessageRequest } from '../../adapters/sip-adapter';
import { ConversationStateMachine, createConversationState, EventObject, Transition } from './state';

export enum ConversationEndpointType {
  CLIENT,
  PSAP,
}

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

  private _messageId: number;
  private _heartbeatInterval?: Timeout;
  private _displayName?: string;

  private _queue: QueueItem[];
  private _messageListeners: Set<(message: Message) => void> = new Set();
  private _stateListeners: Set<(state: StateObject) => void> = new Set();

  // TODO: Find a better solution for this lastSentXXX stuff
  private _lastSentLocation?: PidfLo = undefined;
  private _lastSentVCard?: VCard = undefined;
  private _lastSentDID?: string = undefined;

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
   * Type of endpoint
   */
  public get endpointType() { return this._endpointType }
  private _endpointType: ConversationEndpointType;

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

  public readonly isTest: boolean;

  /**
   * This is the target device we are communicating with -> the other communicating party
   * e.g. if ng112-js is used as PSAP, this would be the SIP address of a mobile device
   */
  public get targetUri() { return this._targetUri }

  public constructor(
    private _agent: SipAdapter,
    private _store: Store,

    private _targetUri: string,

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
    this._displayName = config?.displayName;
    this._logger = this._store.logger;
    this._queue = [];

    this.id = config?.id ?? getRandomString(30);

    this.isTest = config?.isTest ?? false;
    this._endpointType = config?.endpointType ?? ConversationEndpointType.CLIENT;

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
    if (this._endpointType === ConversationEndpointType.CLIENT) {

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
      const { headers, multipart } = this.mapper.createMessageParts({
        ...message,
        targetUri: this._targetUri,
        conversationId: this.id,
        isTest: this.isTest,
        replyToSipUri,
        endpointType: this._endpointType,
      });

      let extraHeaders = headers;
      if (message.extraHeaders)
        extraHeaders = extraHeaders.concat(message.extraHeaders);

      const multiObj = multipart.create();
      await this._agent.message(this._targetUri, multiObj.body, {
        contentType: multiObj.contentType,
        extraHeaders: extraHeaders.map(h => getHeaderString(h)),
        displayName: this._displayName,
      });

      resolve();
    } catch (e) {
      const ex: MessageError = e as MessageError ?? {
        origin: Origin.SYSTEM,
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

  private _addNewMessage = (message: Message) => {
    this._messages.push(message);

    for (const listener of this._messageListeners) {
      listener(message);
    }
  }

  private _notifyQueue = async () => {
    // stopping messages can happen, if the PSAP is transferring to another PSAP
    // or if call is stopped entirely (captain obvious ;-))
    // if this is the case, we are only allowed to send START messages

    // TODO: this state handling is currently NOT correct!
    // define at which states message can be sent
    // this might differ between PSAP and CLIENT
    // also consider conversation state while PSAP is handing over to another PSAP
    let queue = this.hasBeenStarted && this.state.value !== ConversationState.STOPPED ?
      [...this._queue] :
      // START messages can always be sent
      [...this._queue.filter(x => x.message.type === EmergencyMessageType.START)];

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
    this._endpointType === ConversationEndpointType.CLIENT &&
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

  /**
   * Sends a text message
   */
  sendMessage = (sendMessageObj: SendMessageObject): Message => {
    let {
      type = EmergencyMessageType.IN_CHAT,
      messageId,
    } = sendMessageObj;

    // According to ETSI TS 103 698 PSAP have to respond with an initial "START" message
    // However, DEC112 does not specify this

    // TODO: somehow prevent not multiple START messages are sent
    // this is currently possible, e.g. if the PSAP takes very long to respond and a user fires another message

    // this is just a convenience function that API consumers don't have to explicitly START the conversation
    // e.g. if they just send an IN_CHAT message it is converted to a START message
    // only applies to PSAPs and only if they support the PSAP start message!
    // Clients still have to start the conversation explicitly with a message of type START
    if (
      !this.hasBeenStarted &&
      this._endpointType === ConversationEndpointType.PSAP &&
      EmergencyMessageType.isStarted(type)
    )
      type = EmergencyMessageType.START;

    const message = createLocalMessage(
      this,
      // if no message id is specified, use the internal sequence
      messageId ?? this._messageId++,
      type,
      this._store.originSipUri,
      sendMessageObj,
    );

    this._updateMessagePropsIfIsClient(message);

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
      .then(() => message.state = MessageState.SUCCESS)
      .catch(() => message.state = MessageState.ERROR);

    this._addNewMessage(message);
    this._notifyQueue();

    return message;
  }

  /**
   * This function is only used internally and should not be called from outside the library
   */
  handleMessageEvent = (evt: NewMessageEvent): void => {
    if (!this._created)
      this._created = new Date();

    const req = evt.request;
    const { origin } = req;

    const message = this.mapper.parseMessageFromEvent(evt);

    const { type: messageType } = message;

    let stateCallback: (() => void) | undefined = undefined;

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

    if (origin === Origin.REMOTE) {
      if (req.hasHeader(REPLY_TO))
        // this is type safe as we've already checked whether this header exists or not
        this._targetUri = req.getHeader(REPLY_TO) as string;

      this._setPropsFromIncomingMessage(req);

      this._notifyQueue();

      this._addNewMessage({
        ...message,
        conversation: this,
        event: evt,
      });
    }

    // this is called at the end of the function as we first want to notify listeners about the new message
    // only to inform them afterwards about the state change
    // however, listeners always have the possibility of retrieving the state from the conversation object at any time
    if (stateCallback)
      stateCallback();
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
  ) => {
    const request = event.request;

    const conversation = new Conversation(
      ua,
      store,
      request.from.uri.toString(),
      mapper,
      {
        id: mapper.getCallIdFromHeaders(request.getHeaders(CALL_INFO)),
        isTest: mapper.getIsTestFromEvent(event),
      },
    );

    conversation._setPropsFromIncomingMessage(event.request);
    conversation._endpointType = ConversationEndpointType.PSAP;

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