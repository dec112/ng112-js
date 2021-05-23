import {  MessageState } from 'ng112-js/dist/node';
import { createAgent, endExample } from './util';

it('Shows how to send heartbeats manually', async () => {
  const agent = await createAgent();

  const conversation = agent.createConversation('sip:144@dec112.eu');

  try {
    // should be awaited!
    conversation.start();
    
    // should be awaited!
    const msg = conversation.sendMessage({
      text: 'Hello world!',
    });

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