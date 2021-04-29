import { IncomingMessage } from 'jssip/lib/SIPMessage';
import { getHeaderString, getRandomString } from '../utils';
import type { PidfLo } from 'pidf-lo';
import { QueueItem } from './queue-item';
import { EmergencyMessageType } from '../constants/message-types/emergency';
import { NamespacedConversation } from '../namespaces/interfaces';
import { Store } from './store';
import { Message, Origin, MessageState, MessageFailed, nextUniqueId } from './message';
import { CALL_INFO, CONTENT_TYPE, REPLY_TO } from '../constants/headers';
import { CALL_SUB, MULTIPART_MIXED, PIDF_LO, TEXT_PLAIN, TEXT_URI_LIST } from '../constants/content-types';
import { Multipart, MultipartPart, CRLF } from './multipart';
import { ConversationConfiguration } from './interfaces';
import { clearInterval, setInterval, Timeout } from '../utils';
import { VCard } from './vcard';
import { CustomSipHeader } from './custom-sip-header';
import { AgentMode } from './agent';
import { Logger } from './logger';
import { NewMessageEvent, SipAgent } from './sip-agent';

export enum ConversationEndpointType {
  CLIENT,
  PSAP,
}

export enum ConversationState {
  UNKNOWN,
  STARTED,
  INTERRUPTED,
  STOPPED,
  ERROR,
}

export interface SendMessageObject {
  /**
   * Text message to be sent
   */
  text?: string,
  /**
   * URIs to send along with the message (e.g. for deep linking something)
   */
  uris?: string[],
  /**
   * Additional (custom) Multipart MIME parts to add to the message
   */
  extraParts?: MultipartPart[],
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
  private _endpointType = ConversationEndpointType.CLIENT;

  private _queue: QueueItem[];
  private _messageListeners: ((message: Message) => void)[] = [];
  private _stateListeners: ((state: StateObject) => void)[] = [];

  // TODO: Find a better solution for this lastSentXXX stuff
  private _lastSentLocation?: PidfLo = undefined;
  private _lastSentVCard?: VCard = undefined;
  private _lastSentDID?: string = undefined;

  private _hasBeenStarted: boolean = false;

  /**
   * All messages that were sent or received
   */
  public get messages() { return this._messages }
  private _messages: Message[] = [];

  /**
   * Current conversation's state
   */
  public get state() { return this._state }
  private _state: StateObject;

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
    private _agent: SipAgent,
    private _store: Store,

    private _targetUri: string,

    /**
     * The mapper for this environment for compatibility
     */
    public readonly mapper: NamespacedConversation,

    /**
     * Configuration object for additional conversation configuration
     */
    config?: ConversationConfiguration,
  ) {
    this._messageId = 1;
    this._queue = [];

    this.id = config?.id ?? getRandomString(30);
    this._state = config?.state ?? {
      value: ConversationState.UNKNOWN,
      origin: Origin.SYSTEM,
    };
    this.isTest = config?.isTest ?? false;

    this._logger = this._store.logger;

    // manageHeartbeat is necessary here as someone could have already set the conversation's
    // state to `STARTED` which means also heartbeat has to be started
    this._manageHeartbeat();
  }

  private _updateMessagePropsIfIsClient = (message: Message) => {
    // only clients can send location and vcard
    // update the message with latest information
    if (this._endpointType === ConversationEndpointType.CLIENT) {

      const currentLocation = this._store.getLocation();
      if (currentLocation) {
        if (
          !this._lastSentLocation ||
          !this._lastSentLocation.equals(currentLocation)
        )
          this._lastSentLocation = message.location = currentLocation;
      }

      // TODO: obviously we have very similar handling of VCard and DIDs here
      // Find a way to abstract this to not have duplicate code
      const currentVCard = this._store.getVCard();
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

  private _sendSipMessage = ({
    message,
    resolve,
    reject,
  }: QueueItem): void => {
    this._updateMessagePropsIfIsClient(message);

    let replyToSipUri = this._store.originSipUri;
    if (this._store.customSipHeaders?.replyTo)
      replyToSipUri = CustomSipHeader.resolve(this._store.customSipHeaders.replyTo);

    // right before sending the message we update the timestamp to be more accurate
    message.dateTime = new Date();

    try {
      const { body, headers, contentType } = this.mapper.createMessageParts({
        ...message,
        conversationId: this.id,
        isTest: this.isTest,
        replyToSipUri,
        endpointType: this._endpointType,
      });

      this._agent.message(this._targetUri, body, {
        contentType,
        extraHeaders: headers.map(h => getHeaderString(h)),
      })
        .then(() => resolve())
        .catch((ex: MessageFailed | undefined) => {
          if (ex?.origin === Origin.REMOTE)
            this._setState(ConversationState.ERROR, ex.origin)();
          else
            this._logger.error('Could not send SIP message.', message, ex);
        });

    } catch (e) {
      this._logger.error(e);
      reject({
        origin: Origin.SYSTEM,
      });
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
    let queue = this._state.value === ConversationState.STARTED ?
      [...this._queue] :
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
    this._state.value === ConversationState.STARTED &&
    this._endpointType === ConversationEndpointType.CLIENT &&
    this._store.getHeartbeatInterval() > 0;

  private _startHeartbeat = () => {
    if (this._heartbeatInterval || !this._isHeartbeatAllowed())
      return;

    this._heartbeatInterval = setInterval(
      this._store.getHeartbeatInterval(),
      () => this.sendMessage({
        type: EmergencyMessageType.HEARTBEAT,
      }),
    );
  }

  private _stopHeartbeat = () => {
    if (!this._heartbeatInterval)
      return;

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

  /**
   * This may look a bit odd but when closing the call it is necessary to set the conversation's call
   * without notifying listeners immediately
   * 
   * Therefore a function is returned that can be invoked by the caller when suitable
   * 
   * @returns function to notify all listeners
   */
  private _setState = (state: ConversationState, origin: Origin = Origin.SYSTEM): () => void => {
    if (
      state === this._state.value &&
      origin === this._state.origin
    )
      return () => undefined;

    this._state = {
      value: state,
      origin,
    }

    if (state === ConversationState.STARTED) {
      this._hasBeenStarted = true;
      this._store.addHeartbeatIntervalListener(this._onUpdateHeartbeatInterval);
    }
    else
      this._store.removeHeartbeatIntervalListener(this._onUpdateHeartbeatInterval);

    this._manageHeartbeat();

    return () => {
      for (const listener of this._stateListeners) {
        listener(this._state);
      }
    };
  }

  /**
   * Starts the conversation
   * 
   * This is basically a convenience function on top of `sendMessage` \
   * It automatically sets the correct message type "START" \
   * and defaults to text message "Start emergency call"
   */
  start = (sendMessageObj?: SendMessageObject): Message => {
    sendMessageObj = {
      text: 'Start emergency call',
      type: EmergencyMessageType.START,
      ...sendMessageObj,
    }

    return this.sendMessage(sendMessageObj);
  }

  /**
   * Ends the conversation
   * 
   * This is basically a convenience function on top of `sendMessage` \
   * It automatically sets the correct message type "STOP" \
   * and defaults to text message "Stop emergency call"
   */
  stop = (sendMessageObj?: SendMessageObject): Message => {
    sendMessageObj = {
      text: 'Stop emergency call',
      type: EmergencyMessageType.STOP,
      ...sendMessageObj,
    }

    return this.sendMessage(sendMessageObj);
  }

  /**
   * Sends a text message
   */
  sendMessage = ({
    text,
    uris,
    extraParts,
    type = EmergencyMessageType.IN_CHAT,
    messageId,
  }: SendMessageObject): Message => {

    // both a client and a server's first message has to be START message
    // except if one wants to STOP, TRANSFER, REDIRECT a conversation
    // or if the conversation is inactive
    // TODO: check if this is according to standard
    if (!this._hasBeenStarted && !EmergencyMessageType.isInterrupted(type)) {
      // According to ETSI TS 103 698 PSAP have to respond with an initial "START" message
      // However, DEC112 does not specify this

      // TODO: somehow prevent not multiple START messages are sent
      // this is currently possible, e.g. if the PSAP takes very long to respond and a user fires another message
      if (!this.mapper.isStartConversationByClientAllowed())
        type = EmergencyMessageType.START;
    }

    const message: Message = {
      // if no message id is specified, use the internal sequence
      id: messageId ?? this._messageId++,
      uniqueId: nextUniqueId(),
      origin: Origin.LOCAL,
      conversation: this,
      dateTime: new Date(),
      type,
      state: MessageState.PENDING,
      text,
      uris,
      extraParts,
      // This is just a dummy value to satisfy TypeScript
      promise: new Promise(() => { }),
    };

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
    // TODO: Reshape this method, it's ugly
    const now = new Date();
    if (!this._created)
      this._created = now;

    const { from, to, body, origin } = evt;

    const contentType = evt.getHeader(CONTENT_TYPE);
    let parsedText: string | undefined = undefined;
    let parsedLocation: PidfLo | undefined = undefined;
    let parsedVCard: VCard | undefined = undefined;
    let parsedUris: string[] | undefined = undefined;

    // TODO: I think all parsing should also be done by the mapper
    if (contentType && contentType.indexOf(MULTIPART_MIXED) !== -1 && body) {
      const multipart = Multipart.parse(body, contentType);
      const plainParts = multipart.getPartsByContentType(TEXT_PLAIN);

      if (plainParts.length > 0) {
        // we just concatenate all plain parts with line breaks
        // this might not be the best solution, but it's for sure the easiest one ;-)
        parsedText = plainParts.map(x => x.body).join('\n');
      }

      const locationParts = multipart.getPartsByContentType(PIDF_LO);
      if (locationParts.length > 0) {
        for (const locPart of locationParts) {
          const loc = this.mapper.tryParsePidfLo(locPart.body);

          if (parsedLocation && loc) {
            // if there are multiple pidfLo parts present, we just combine it to one object
            parsedLocation.locationTypes = [
              ...parsedLocation.locationTypes,
              ...loc?.locationTypes,
            ]
          }
          else if (loc)
            parsedLocation = loc;
        }
      }

      const vcardParts = multipart.getPartsByContentType(CALL_SUB);
      if (vcardParts.length > 0) {
        const vcard = VCard.fromXML(vcardParts[0].body);

        if (parsedVCard)
          vcard.combine(parsedVCard);

        parsedVCard = vcard;
      }

      const uriParts = multipart.getPartsByContentType(TEXT_URI_LIST);
      if (uriParts.length > 0) {
        parsedUris = uriParts.map(u => u.body).reduce((prev, curr) => {
          const allUris = curr.split(CRLF);
          // uris with a leading # are commented and should be ignored
          return prev.concat(allUris.filter(x => x.indexOf('#') !== 0))
        }, [] as string[]);
      }
    }
    else if (body)
      parsedText = body;

    const callInfoHeaders = evt.getHeaders(CALL_INFO);
    const emergencyMessageType = this.mapper.getMessageTypeFromHeaders(callInfoHeaders, parsedText);

    if (!emergencyMessageType) {
      this._logger.warn('Could not find message type in SIP MESSAGE. Can not handle this SIP MESSAGE.');
      return;
    }

    let stateCallback: (() => void) | undefined = undefined;
    // accoring to standard, if we are a client, we have to wait for the server-side sent "START" message
    // it's not safe to assume that a client can "START" a conversation on its own.
    // the conversation could be declined for example
    // therefore, we don't change the state for client-side fired START messages
    // does not apply for DEC112 environments
    if (!this._hasBeenStarted) {
      // TODO: wow, this if is ugly! Simplify this!
      if (
        // client conversation is only allowed to be started by PSAP
        (
          this._endpointType === ConversationEndpointType.CLIENT &&
          !this.mapper.isStartConversationByClientAllowed() &&
          emergencyMessageType === EmergencyMessageType.START &&
          origin === Origin.REMOTE
        ) ||
        // psap conversation is only allowed to be started by PSAP
        (
          this._endpointType === ConversationEndpointType.PSAP &&
          !this.mapper.isStartConversationByClientAllowed() &&
          emergencyMessageType === EmergencyMessageType.START &&
          origin === Origin.LOCAL
        ) ||
        // DEC112 environments
        (
          this.mapper.isStartConversationByClientAllowed() &&
          EmergencyMessageType.isStarted(emergencyMessageType)
        )
      )
        stateCallback = this._setState(ConversationState.STARTED, origin);
    }
    else {
      if (EmergencyMessageType.isStopped(emergencyMessageType))
        stateCallback = this._setState(ConversationState.STOPPED, origin);
      else if (EmergencyMessageType.isStarted(emergencyMessageType))
        stateCallback = this._setState(ConversationState.STARTED, origin);
      else
        stateCallback = this._setState(ConversationState.INTERRUPTED, origin);
    }

    if (origin === Origin.REMOTE) {
      if (evt.hasHeader(REPLY_TO))
        // this is type safe as we've already checked whether this header exists or not
        this._targetUri = evt.getHeader(REPLY_TO) as string;

      // TODO: check if this should only be set the first time the clients sends a message
      this._requestedUri = to.uri.toString();
      this._remoteDisplayName = from.displayName;

      this._notifyQueue();

      this._addNewMessage({
        id: this.mapper.getMessageIdFromHeaders(callInfoHeaders) as string,
        uniqueId: nextUniqueId(),
        origin,
        conversation: this,
        dateTime: now,
        type: emergencyMessageType,
        state: MessageState.SUCCESS,
        text: parsedText,
        uris: parsedUris,
        promise: Promise.resolve(),
        location: parsedLocation,
        vcard: parsedVCard,
        sipStackMessage: evt.sipStackMessage,
        did: this.mapper.getDIDFromHeaders(callInfoHeaders),
      });
    }

    // this is called at the end of the function as we first want to notify listeners about the new message
    // only to inform them afterwards about the state change
    // however, listeners always have the possibility of retrieving the state from the conversation object at any time
    if (stateCallback)
      stateCallback();
  }

  /**
   * Registers a new listener for new incoming or outgoing messages
   * 
   * @param callback Callback function that is called each time a new incoming or outgoing message is received/sent
   */
  addMessageListener = (callback: (message: Message) => unknown) => {
    this._messageListeners.push(callback);
  }

  /**
   * Registers a new listener for conversation state changes
   * 
   * @param callback Callback function that is called each time the conversation's state changes
   */
  addStateListener = (callback: (state: StateObject) => unknown) => {
    this._stateListeners.push(callback);
  }

  /**
   * Unregisters a previously registered conversation state listener
   * 
   * @param callback Callback function that is called each time the conversation's state changes
   */
  removeStateListener = (callback: (state: StateObject) => unknown) => {
    const index = this._stateListeners.indexOf(callback);
    if (index !== -1)
      this._stateListeners.splice(index, 1);
  }

  /**
   * Creates a conversation out of an already existing SIP message (e.g. ETSI START message)
   */
  static fromIncomingSipMessage = (
    ua: SipAgent,
    store: Store,
    mapper: NamespacedConversation,
    event: NewMessageEvent,
  ) => {
    const request = event;

    const conversation = new Conversation(
      ua,
      store,
      request.from.uri.toString(),
      mapper,
      {
        id: mapper.getCallIdFromHeaders(request.getHeaders(CALL_INFO)),
        isTest: mapper.getIsTestFromHeaders(request as unknown as IncomingMessage),
      },
    );

    conversation._endpointType = ConversationEndpointType.PSAP;

    return conversation;
  }
}