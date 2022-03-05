import { MessageError, MessageState } from 'ng112-js/dist/node';
import { createAgent, endExample } from './util';

it('Shows how to send messages', async () => {
  const agent = await createAgent();

  const conversation = agent.createConversation('sip:144@dec112.eu', {
    // specify, if conversation should be marked as test call
    isTest: false,
    // specify, if conversation should be marked as "silent" emergency call
    isSilent: false,
  });

  // should be awaited!
  conversation.start();

  const msg = conversation.sendMessage({
    text: 'Hello world!',
  });

  msg.promise
    .then(() => console.log('Message sent successfully!'))
    .catch((err: MessageError) => console.error(`An error happened. SIP Error Code: ${err.statusCode}`))

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

  endExample();
});