import { Origin } from 'ng112-js';
import { createAgent, endExample, startExample } from './util';

// this is just a method stub for writing to the device storage
const persistObject = (name: string, obj: any) => {
  name;
  obj;
}

// this is just a method stub for reading from the device storage
const retreiveObject = (name: string): any => {
  name;
  return 'persisted object';
}

it('Shows how to reconnect to an already existing conversation', async () => {
  startExample();
  
  // the first section of this example should present a normal conversation
  // where important data is already persisted
  // this ensures the converation can be recovered later on

  // the second section shows what has to be done
  // to restore/recover a conversation e.g. after a app/device crash

  ///////////// SECTION 1 /////////////

  const agent1 = await createAgent();
  const conversation1 = agent1.createConversation('sip:144@dec112.eu');

  // save conversation id for conversation restore
  persistObject('conversation-id', conversation1.id);

  conversation1.addStateListener((state) => {
    // save the last known state of the conversation
    persistObject('state', state);
  });

  conversation1.addMessageListener((msg) => {
    // save the last sent message id from locally sent messages
    if (msg.origin === Origin.LOCAL)
      persistObject('message-id', conversation1.messageId);

    // very important!
    // as target URI will most probably change during the conversation
    // it is essential to also persist this information!
    // otherwise upon recovery the call will be routed again, maybe even to a different PSAP!
    //
    // as the target URI is set by the PSAP, we can only get this value after
    // the first message that was sent by the PSAP
    if (msg.origin === Origin.REMOTE)
      persistObject('target-uri', conversation1.targetUri);
  })

  conversation1.start({
    text: 'Starting this emergency call',
  });

  ////////////////////////////////////
  // ASSUME THE DEVICE CRASHES HERE //
  ////////////////////////////////////

  ///////////// SECTION 2 /////////////

  const agent2 = await createAgent();

  // This is useful, if e.g. a mobile app was force quit by the user and 
  // the user wants to continue the conversation after re-opening the application.
  const conversation2 = agent2.createConversation(retreiveObject('target-uri'), {
    // an already existing conversation id
    id: retreiveObject('converation-id'),
    // the last known state object for this particular conversation
    state: retreiveObject('state'),
    // last message id that was sent from the client
    // incremented by 1
    messageId: retreiveObject('message-id') + 1,
  });

  // Probably it's a good idea to directly send a message to the PSAP
  // that the user has resumed/recovered the emergency call
  conversation2.sendMessage({
    text: 'I am back again!',
  });

  endExample();
});