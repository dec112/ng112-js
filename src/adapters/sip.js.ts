import { DelegateObject, SipAdapter, SipAdapterConfig, SendMessageOptions, getUserAgentString, NewMessageEvent } from './sip-adapter';
import { Origin } from '../models/message';
import { Messager, Publisher, Registerer, Subscriber, SubscriberOptions, URI, UserAgent, UserAgentDelegate, version } from 'sip.js';
import { IncomingRequestMessage, OutgoingRequestMessage } from 'sip.js/lib/core';

const newSipJsTransaction = (target: string, callback: (uri: URI) => Promise<void>): Promise<void> => {
  const uri = UserAgent.makeURI(target);
  if (!uri)
    return new Promise((_, reject) => reject());

  return callback(uri);
}

export const transformSipJsMessage = (request: OutgoingRequestMessage | IncomingRequestMessage, origin: Origin): NewMessageEvent => {
  let body: string | undefined;

  if (typeof request.body === 'object')
    body = request.body.body;
  else
    body = request.body;

  return {
    hasHeader: (name) => request.hasHeader(name),
    getHeader: (name) => request.getHeader(name),
    getHeaders: (name) => request.getHeaders(name),
    from: request.from,
    to: request.to,
    origin,
    body,
    sipStackMessage: request,
  }
}

export class SipJsAdapter implements SipAdapter {
  static factory = (config: SipAdapterConfig) => new SipJsAdapter(config);

  public delegate: DelegateObject;

  private _agent: UserAgent;
  private _newMessageListener: ((message: NewMessageEvent) => unknown)[] = [];

  constructor({
    endpoint,
    user,
    password,
    displayName,
    originSipUri,
    logger,
  }: SipAdapterConfig) {
    // TODO: check all inputs here
    // otherwise they might cause exceptions and we think the module is not available

    this._agent = new UserAgent({
      uri: UserAgent.makeURI(originSipUri),
      transportOptions: {
        server: endpoint,
      },
      authorizationUsername: user,
      authorizationPassword: password,
      displayName,
      userAgentString: getUserAgentString('sip.js', version),
      logBuiltinEnabled: false,
      logConnector: (level, category, label, content) => {
        switch (level) {
          case 'error':
            logger.error(content, label, category);
            break;
          case 'warn':
            logger.warn(content, label, category);
            break;
          default:
            logger.log(content, label, category);
        }
      }
    });

    const uaDel: UserAgentDelegate = this._agent.delegate = {};

    this.delegate = {
      onConnect: (callback) => uaDel.onConnect = callback,
      onConnecting: () => undefined,
      onDisconnect: (callback) => uaDel.onDisconnect = callback,
      onRegister: (callback) => uaDel.onRegister = callback,
      // TODO: check if this is correct
      onUnregister: (callback) => uaDel.onRegister = callback,
      onRegistrationFail: () => undefined,
      onNewMessage: (callback) => {
        // sip.js only handles incoming message with this callback
        this._newMessageListener.push(callback);
        uaDel.onMessage = ({ request }) => {
          callback(transformSipJsMessage(request, Origin.REMOTE))
        };
      },
    };
  }
  async register(): Promise<void> {
    await new Registerer(this._agent).register();
  }
  async unregister(): Promise<void> {
    await new Registerer(this._agent).unregister();
  }
  async start(): Promise<void> {
    await this._agent.start();
  }
  async stop(): Promise<void> {
    await this._agent.stop();
  }
  message(target: string, body: string, options?: SendMessageOptions): Promise<void> {
    return newSipJsTransaction(target, async (uri) => {
      try {
        const msg = new Messager(
          this._agent,
          uri,
          body,
          options?.contentType,
          options,
        );

        msg.message();

        // sip.js' message handler only handles incoming messages
        // that's why we manually inform our listeners here
        for (const listener of this._newMessageListener) {
          // @ts-expect-error
          const outgoing: OutgoingRequestMessage = msg.request;
          listener(transformSipJsMessage(outgoing, Origin.LOCAL));
        }
      } catch (ex) {
        // TODO: Check types!
        throw ex;
      }
    })
  }
  subscribe(
    target: string,
    eventType: string,
    onNotify?: (notification: NewMessageEvent) => void,
    subscribe: boolean = true,
  ): Promise<void> {
    return newSipJsTransaction(target, (uri) => {
      const subscriberOptions: SubscriberOptions | undefined = onNotify ? {
        delegate: {
          onNotify: (n) => {
            if (onNotify) {
              const msg = transformSipJsMessage(n.request, Origin.REMOTE);
              onNotify(msg);
            }
          },
        }
      } : undefined;

      return new Subscriber(this._agent, uri, eventType, subscriberOptions)[subscribe ? 'subscribe' : 'unsubscribe']();
    });
  }
  unsubscribe(target: string, eventType: string): Promise<void> {
    return this.subscribe(target, eventType, undefined, false);
  }
  notify(target: string, eventType: string, content: string): Promise<void> {
    return newSipJsTransaction(target, (uri) =>
      new Publisher(this._agent, uri, eventType).publish(content)
    );
  }
}