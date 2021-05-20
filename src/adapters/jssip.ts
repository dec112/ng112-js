import { DelegateObject, SipAdapter as SipAdapter, SipAdapterConfig, getUserAgentString } from './sip-adapter';
import jssip from 'jssip';
import { SendMessageOptions } from 'jssip/lib/Message';
import { Origin } from '../models/message';

import { Socket, WebSocketInterface } from 'jssip';
import { isBrowser } from '../compatibility';

const getSocketInterface = (endpoint: string): Socket => {
  // there are no types for NodeWebsocket
  let NodeWebsocket: any = undefined;

  // if we are on node, we try to import jssip-node-websocket, which is a peer-dependency
  if (!isBrowser) {
    try {
      NodeWebsocket = require('jssip-node-websocket');
    }
    catch { /* module could not be found */ }
  }

  if (NodeWebsocket)
    return new NodeWebsocket(endpoint);
  else
    // if we could not load jssip-node-websocket, we'll proceed with the standard websocket interface
    return new WebSocketInterface(endpoint);
}

export class JsSipAdapter implements SipAdapter {
  static factory = (config: SipAdapterConfig) => new JsSipAdapter(config);

  private _agent: jssip.UA;
  public delegate: DelegateObject

  constructor({
    endpoint,
    domain,
    user,
    password,
    displayName,
    originSipUri,
    logger,
  }: SipAdapterConfig) {
    // TODO: check all inputs here
    // otherwise they might cause exceptions and we think the module is not available

    // we can only activate jssip debugging if we log to the console (our fallback)
    // because jssip does not let us piping log messages somewhere else
    jssip.debug[logger.isActive() && logger.isFallback() ? 'enable' : 'disable']('JsSIP:*');

    this._agent = new jssip.UA({
      sockets: [
        getSocketInterface(endpoint),
      ],
      uri: originSipUri,
      authorization_user: user,
      password,
      realm: domain,
      display_name: displayName,
      register: true,
      user_agent: getUserAgentString('JsSIP', jssip.version),
    });

    this.delegate = {
      onConnect: (callback) => { this._agent.on('connected', callback); },
      onConnecting: (callback) => { this._agent.on('connecting', callback); },
      onDisconnect: (callback) => { this._agent.on('disconnected', callback); },
      onRegister: (callback) => { this._agent.on('registered', callback); },
      onUnregister: (callback) => { this._agent.on('unregistered', callback) },
      onRegistrationFail: (callback) => { this._agent.on('registrationFailed', callback) },
      onNewMessage: (callback) => {
        this._agent.on('newMessage', (_: any) => {
          const message: JsSIP.UserAgentNewMessageEvent = _;
          const { request } = message;

          callback({
            hasHeader: (name) => request.hasHeader(name),
            getHeader: (name) => request.getHeader(name),
            getHeaders: (name) => request.getHeaders(name),
            body: request.body,
            from: {
              displayName: request.from.display_name,
              get uri() { return request.from.uri },
            },
            to: {
              displayName: request.to.display_name,
              get uri() { return request.to.uri },
            },
            origin: message.originator as Origin,
            sipStackMessage: message,
          });
        })
      },
    }
  }
  register(): Promise<void> {
    // JsSIP handles registration automatically
    return Promise.resolve();
  }
  unregister(): Promise<void> {
    const promise = new Promise<void>(resolve => {
      this._agent.once('unregistered', () => resolve());
    });

    this._agent.unregister();

    return promise;
  }
  async start(): Promise<void> {
    const promise = Promise.all([
      new Promise<void>(resolve => this._agent.once('connected', resolve)),
      new Promise<void>(resolve => this._agent.once('registered', resolve)),
    ]);

    this._agent.start();

    await promise;
  }
  stop(): Promise<void> {
    const promise = new Promise<void>(resolve => {
      this._agent.once('disconnected', () => resolve());
    });

    this._agent.stop();

    return promise;
  }
  message(target: string, body: string, options?: SendMessageOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        // we can not just pass the plain string to `sendMessage` as this causes problems with encoded parameters
        // therfore we have to call URI.parse (which is a jssip function!) to ensure correct transmission
        this._agent.sendMessage(jssip.URI.parse(target), body, {
          ...options,
          eventHandlers: {
            // TODO: include return object here
            succeeded: () => resolve(),
            failed: (evt) => reject(evt),
          }
        });
      } catch {
        reject();
      }
    });
  }
  subscribe(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  unsubscribe(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  notify(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}