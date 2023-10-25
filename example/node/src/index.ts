import {
  Agent,
  Circle,
  Conversation,
  ConversationState,
  EmergencyMessageType,
  Message,
  Origin,
  Point,
  StateObject,
  version,
} from 'ng112-js';
import { setTimeout } from 'timers';
import { Config } from './config';
import { log } from './log';
import readline from 'readline';
import { JsSipAdapter } from 'ng112-js-sip-adapter-jssip';

log(`ng112-js-psap starting (ng112-js ${version})`);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

(async () => {
  let agent: Agent | undefined = undefined;

  const shutDownGracefully = async () => {
    if (agent) {
      log(`Disposing agent...`);
      try {
        await agent.dispose();
      } catch {
        log('Could not dispose agent');
      }
    }

    process.exit(0);
  };

  process.on('SIGINT', shutDownGracefully);
  process.on('SIGTERM', shutDownGracefully);

  Config.initialize();

  const endpoint = Config.get('endpoint');
  const domain = Config.get('domain');
  const user = Config.get('user');
  const password = Config.get('password');
  const from = Config.get('from');
  const replyTo = Config.get('replyTo');
  const isDebug = Config.get<boolean>('isDebug');

  if (
    !(
      endpoint !== undefined &&
      domain !== undefined &&
      user !== undefined &&
      password !== undefined
    )
  ) {
    log(`Can not start due to missing configuration properties.`);
    process.exit(-1);
  }

  agent = new Agent({
    sipAdapterFactory: JsSipAdapter.factory,
    endpoint,
    domain,
    user,
    password,
    debug: {
      default: isDebug,
      sipAdapter: isDebug,
    },
    customSipHeaders: {
      from,
      replyTo,
    },
    userAgent: 'ng112-js-example-psap',
  });

  let currentConversation: Conversation | undefined = undefined;

  try {
    log(`Connecting to ${endpoint}...`);
    await agent.initialize();
    log(`Connected`);
  } catch {
    log('Could not initialize agent. Exiting');
    process.exit(-1);
  }

  const replies = Config.get<string[]>('replies') ?? [];
  const conversationTimeoutDuration =
    Config.get<number>('conversationTimeout') ?? 60000;

  log('Listening for incoming conversations');

  const askForMessage = () => {
    rl.question('', (msg) => {
      if (currentConversation)
        currentConversation.sendMessage({ text: msg });

      askForMessage();
    });
  }
  askForMessage();

  agent.addConversationListener((conversation: Conversation) => {
    const getLog = (message: string) => `${conversation.id}: ${message}`;

    let conversationTimeout: NodeJS.Timeout | undefined;
    const resetTimeout = () => {
      if (conversationTimeout) clearTimeout(conversationTimeout);

      return (conversationTimeout = setTimeout(async () => {
        log(getLog('Stopping due to timeout'));
        try {
          await conversation.stop().promise;
        } catch {
          log(`${conversation.id}: Could not stop conversation`);
        }
      }, conversationTimeoutDuration));
    };
    resetTimeout();

    conversation.addStateListener((state: StateObject) => {
      if (state.value === ConversationState.STOPPED) {
        if (conversationTimeout) clearTimeout(conversationTimeout);

        currentConversation = undefined;
        log(getLog('End conversation'));
      }
    });

    log(getLog(`New conversation | Target: ${conversation.requestedUri} | ${conversation.mapper.getNamespace()}`));

    conversation.addMessageListener(async (message: Message) => {
      currentConversation = conversation;

      resetTimeout();

      if (message.origin === Origin.LOCAL) {
        log(getLog(`Out: ${message.text}`));
        return;
      }

      if (EmergencyMessageType.isHeartbeat(message.type)) {
        log(getLog('Heartbeat'));
        return;
      }

      log(getLog(` In: ${message.text}`));

      if (message.location) {
        const loc = message.location;

        for (const locType of loc.locationTypes) {
          for (const loc of locType.locations) {
            let locationName: string | undefined;
            let locationString: string | undefined;

            if (loc instanceof Circle) {
              locationName = 'Circle';
              locationString = `${loc.latitude}/${loc.longitude}|r=${loc.radius}|m=${loc.method}`;
            }
            else if (loc instanceof Point) {
              locationName = 'Point';
              locationString = `${loc.latitude}/${loc.longitude}|m=${loc.method}`;
            }

            if (locationName && locationString) {
              log(getLog(`     ${locType.getName()}|${locationName} -> ${locationString}`))
            }
          }
        }
      }

      if (message.vcard) {
        const { vcard } = message;
        log(getLog(`     ${vcard.fullName} ${vcard.birthday?.toDateString()} ${vcard.gender}`));
        log(getLog(`     ${vcard.telephone} ${vcard.email}`));
      }

      if (conversation.state.value === ConversationState.STOPPED) {
        return;
      }

      const remoteMessages = conversation.messages.filter(
        m => m.origin === Origin.REMOTE
      );

      // by default we just echo back what we got.
      let replyText = message.text;

      // but if there are still reply messages to send, we send one of these
      if (remoteMessages.length <= replies.length) {
        replyText = replies[remoteMessages.length - 1];
      }

      try {
        await conversation.sendMessage({
          text: replyText,
        }).promise;
      } catch {
        log(getLog('Could not reply to message'));
      }
    });
  });
})();
