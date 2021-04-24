import { ConversationState, Origin } from '../../src';
import { createAgent, endExample } from './util';

it('Shows how to reconnect to an already existing conversation', async () => {
  const agent = await createAgent();

  // This is useful, if e.g. a mobile app was force quit by the user and 
  // the user wants to continue the conversation after re-opening the application.
  const conversation = agent.createConversation('sip:144@dec112.eu', {
    // an already existing conversation id
    id: 'conversation id',
    // the last known state object for this particular conversation
    state: {
      origin: Origin.REMOTE,
      value: ConversationState.STARTED,
    },
  });

  // should be awaited!
  conversation.sendMessage({
    text: 'I am back again!',
  });

  endExample();
});