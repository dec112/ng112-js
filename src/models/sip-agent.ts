import type * as jssip from "jssip";
import type * as sipjs from "sip.js";
import { getSocketInterface } from "../jssip/socket-interface";
import { AgentConfiguration } from "./agent";
import { Origin } from "./message";
import { transformSipJsMessage } from '../sipjs/utils';
import { OutgoingRequestMessage } from "sip.js/lib/core";
import { getPackageInfo } from "../utils/package-utils";
import { Logger } from "./logger";
import { OmitStrict } from "../utils/ts-utils";

export enum SupportedAgent {
  jssip = 'JsSIP',
  sipjs = 'sip.js',
}

interface AgentOptions {
  jssip?: jssip.UA,
  sipjs?: sipjs.UserAgent,
}

interface BranchOptions<T> {
  jssip?: (jssip: jssip.UA) => T,
  sipjs?: (sipjs: sipjs.UserAgent) => T,
}

interface SendMessageOptions {
  contentType?: string;
  extraHeaders?: string[];
}

type SipAgentConfig = OmitStrict<AgentConfiguration, 'debug' | 'namespaceSpecifics' | 'customSipHeaders'> & {
  originSipUri: string;
  logger: Logger,
};

export interface NewMessageEvent {
  hasHeader: (name: string) => boolean,
  getHeader: (name: string) => string | undefined,
  getHeaders: (name: string) => string[],
  from: SipUri,
  to: SipUri,
  origin: Origin,
  body: string | undefined,
  sipStackMessage:
  JsSIP.UserAgentNewMessageEvent |
  sipjs.Core.OutgoingRequestMessage |
  sipjs.Core.IncomingRequestMessage
}

export interface SipUri {
  displayName: string,
  uri: {
    toString(): string,
  }
}

// FIXME: Currently we have problems with jest testing also sip.js
// somehow it does not like how sip.js exports their defaults
// especially when it comes to the version number that is exported by sip.js
// We shall look into this as it prevents us from automated testing with sip.js
// That's why we currently do not import it via ES modules but via CommonJs import
// this allows us to circumvent this error
const requireSipJs = () => require('sip.js') as typeof sipjs;
const requireJsSip = () => require('jssip') as typeof jssip;

const newSipJsTransaction = (target: string, callback: (sipJs: typeof sipjs, uri: sipjs.URI) => Promise<void>): Promise<void> => {
  const sipjs = requireSipJs();

  const uri = sipjs.UserAgent.makeURI(target);
  if (!uri)
    return new Promise((_, reject) => reject());

  return callback(sipjs, uri);
}

export let currentAgent: SupportedAgent = (() => {
  try {
    requireJsSip();
    return SupportedAgent.jssip;
  } catch { }

  try {
    requireSipJs();
    return SupportedAgent.sipjs;
  } catch { }

  throw new Error('ng112-js depends on either JsSIP or sip.js. Please ensure there is one of these libraries in your dependencies.');
})();

export class SipAgent {
  private _sipjsDelegateObj: sipjs.UserAgentDelegate = {};
  private _sipJsNewMessageListener: ((message: NewMessageEvent) => unknown)[] = [];

  private _agents: AgentOptions = {
    jssip: undefined,
    sipjs: undefined,
  };

  constructor({
    endpoint,
    domain,
    user,
    password,
    displayName,
    originSipUri,
    preferredSipAgent,
    logger,
  }: SipAgentConfig) {
    // TODO: check all inputs here
    // otherwise they might cause exceptions and we think the module is not available

    const packageInfo = getPackageInfo();
    const getUserAgent = (sipLibName: string, sipLibVersion: string) =>
      `${packageInfo.name} ${packageInfo.version}, ${sipLibName}, ${sipLibVersion}`;

    if (preferredSipAgent)
      currentAgent = preferredSipAgent;

    if (currentAgent === SupportedAgent.jssip) {
      const jssip = requireJsSip();

      // we can only activate jssip debugging if we log to the console (our fallback)
      // because jssip does not let us piping log messages somewhere else
      jssip.debug[logger.isActive() && logger.isFallback() ? 'enable' : 'disable']('JsSIP:*');

      this._agents.jssip = new jssip.UA({
        sockets: [
          getSocketInterface(endpoint),
        ],
        uri: originSipUri,
        authorization_user: user,
        password,
        realm: domain,
        display_name: displayName,
        register: true,
        user_agent: getUserAgent(currentAgent, jssip.version),
      });
    }
    else if (currentAgent === SupportedAgent.sipjs) {
      const sipjs = requireSipJs();
      const sipjsUA = sipjs.UserAgent;

      const ua = this._agents.sipjs = new sipjsUA({
        uri: sipjsUA.makeURI(originSipUri),
        transportOptions: {
          server: endpoint,
        },
        authorizationUsername: user,
        authorizationPassword: password,
        displayName,
        userAgentString: getUserAgent(currentAgent, sipjs.version),
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

      ua.delegate = this._sipjsDelegateObj;
    }
  }


  private compat = <T>(functionName: string, obj: BranchOptions<T>): T => {
    switch (currentAgent) {
      case SupportedAgent.jssip:
        if (obj.jssip)
          return obj.jssip(this._agents.jssip as jssip.UA);
        break;
      case SupportedAgent.sipjs:
        if (obj.sipjs)
          return obj.sipjs(this._agents.sipjs as sipjs.UserAgent)
        break;
    }

    throw new Error(`Function ${functionName} is not implemented for ${currentAgent}.`);
  }

  register = () => this.compat<Promise<unknown>>('register', {
    // JsSIP handles registration automatically
    jssip: () => Promise.resolve(),
    sipjs: (ua) => new (requireSipJs().Registerer)(ua).register(),
  });

  unregister = () => this.compat<Promise<unknown>>('unregister', {
    jssip: async (ua) => {
      const promise = new Promise<void>(resolve => {
        ua.once('unregistered', () => resolve());
      });

      ua.unregister();

      await promise;
    },
    sipjs: (ua) => new (requireSipJs().Registerer)(ua).unregister(),
  });

  start = () => this.compat<Promise<unknown>>('start', {
    jssip: (ua) => {
      const promise = Promise.all([
        new Promise<void>(resolve => ua.once('connected', resolve)),
        new Promise<void>(resolve => ua.once('registered', resolve)),
      ]);

      ua.start();

      return promise;
    },
    sipjs: (ua) => ua.start(),
  });

  stop = () => this.compat<Promise<void>>('stop', {
    jssip: async (ua) => {
      const promise = new Promise<void>(resolve => {
        ua.once('disconnected', () => resolve());
      });

      ua.stop();

      await promise;
    },
    sipjs: (ua) => ua.stop(),
  });

  // TODO: Return type should be generic
  message = (target: string, body: string, options?: SendMessageOptions) => this.compat<Promise<void>>('message', {
    jssip: (ua) => new Promise<void>((resolve, reject) => {
      try {
        // we can not just pass the plain string to `sendMessage` as this causes problems with encoded parameters
        // therfore we have to call URI.parse (which is a jssip function!) to ensure correct transmission
        ua.sendMessage(requireJsSip().URI.parse(target), body, {
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
    }),
    sipjs: (ua) =>
      newSipJsTransaction(target, async (sipjs, uri) => {
        try {
          const msg = new sipjs.Messager(
            ua,
            uri,
            body,
            options?.contentType,
            options,
          );

          msg.message();

          // sip.js' message handler only handles incoming messages
          // that's why we manually inform our listeners here
          for (const listener of this._sipJsNewMessageListener) {
            // @ts-expect-error
            const outgoing: OutgoingRequestMessage = msg.request;
            listener(transformSipJsMessage(outgoing, Origin.LOCAL));
          }
        } catch (ex) {
          // TODO: Check types!
          throw ex;
        }
      })
  });

  subscribe = (
    target: string,
    eventType: string,
    onNotify?: (notification: sipjs.Notification) => unknown,
    subscribe: boolean = true,
  ) => this.compat<Promise<void>>('subscribe', {
    // Not implemented by JsSIP (2021-03-27)
    jssip: undefined,
    sipjs: (ua) =>
      newSipJsTransaction(target, (sipjs, uri) => {
        const subscriberOptions: sipjs.SubscriberOptions | undefined = onNotify ? {
          delegate: {
            onNotify,
          }
        } : undefined;

        return new sipjs.Subscriber(ua, uri, eventType, subscriberOptions)[subscribe ? 'subscribe' : 'unsubscribe']();
      })
  });

  unsubscribe = (target: string, eventType: string) => this.subscribe(target, eventType, undefined, false);

  notify = (target: string, eventType: string, content: string) => this.compat<Promise<void>>('notify', {
    // Not implemented by JsSIP (2021-03-27)
    jssip: undefined,
    sipjs: (ua) =>
      newSipJsTransaction(target, (sipjs, uri) =>
        new sipjs.Publisher(ua, uri, eventType).publish(content)
      )
  });

  delegate = {
    onConnect: (callback: () => unknown) => this.compat<void>('onConnect', {
      jssip: (ua) => ua.on('connected', callback),
      sipjs: () => this._sipjsDelegateObj.onConnect = callback,
    }),
    onConnecting: (callback: () => unknown) => this.compat<void>('onConnected', {
      jssip: (ua) => ua.on('connecting', callback),
      // Not implemented by sip.js (2021-04-24)
      // empty function provides a soft-fail without throwing an error
      sipjs: () => undefined,
    }),
    onDisconnect: (callback: () => unknown) => this.compat<void>('onDisconnect', {
      jssip: (ua) => ua.on('disconnected', callback),
      sipjs: () => this._sipjsDelegateObj.onDisconnect = callback,
    }),
    onRegister: (callback: () => unknown) => this.compat<void>('onRegister', {
      jssip: (ua) => ua.on('registered', callback),
      sipjs: () => this._sipjsDelegateObj.onRegister = callback,
    }),
    onUnregister: (callback: () => unknown) => this.compat<void>('onUnregister', {
      jssip: (ua) => ua.on('unregistered', callback),
      // TODO: check if this is correct
      sipjs: () => this._sipjsDelegateObj.onRegister = callback,
    }),
    onRegistrationFail: (callback: () => unknown) => this.compat<void>('onRegistrationFail', {
      jssip: (ua) => ua.on('registrationFailed', callback),
      // Not implemented by sip.js (2021-04-24)
      sipjs: () => undefined
    }),
    onNewMessage: (callback: (evt: NewMessageEvent) => unknown) => this.compat<void>('onNewMessage', {
      jssip: (ua) => ua.on('newMessage', (_: any) => {
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
      }),
      sipjs: () => {
        // sip.js only handles incoming message with this callback
        this._sipJsNewMessageListener.push(callback);
        this._sipjsDelegateObj.onMessage = ({ request }) => {
          callback(transformSipJsMessage(request, Origin.REMOTE))
        };
      }
    }),
  }
}