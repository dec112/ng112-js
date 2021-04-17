import {  MessageState } from '../../src';
import { createAgent, endExample } from './util';

it('Shows how to send heartbeats manually', async () => {
  const agent = await createAgent();

  const conversation = agent.createConversation('sip:144@dec112.eu');

  try {
    await conversation.start().promise;

    // converstaion has been started successfully
    const msg = conversation.sendMessage({
      text: 'Hello world!',
    });

    await msg.promise;
    // message has been forwarded by the SIP proxy successfully if promise was resolved

    // message state can also be queried manually
    switch (msg.state) {
      // the message is has not yet been successfully delivered
      case MessageState.PENDING:
      // the message has been sent successfully
      case MessageState.SUCCESS:
      // there was an error while forwarding the message
      case MessageState.ERROR:
        break;
    }
  } catch (e) {
    // there was an error while forwarding the message, if promise was rejected
  }

  endExample();
});