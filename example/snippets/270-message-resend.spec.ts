import { createAgent, endExample, startExample } from './util';

it('Shows how to resend a message', async () => {
  startExample();
  
  const agent = await createAgent();

  const conversation = agent.createConversation('sip:144@dec112.eu');

  // should be awaited!
  const startMsg = conversation.start();
  startMsg.promise.catch(() => {
    const newStartMsg = startMsg.resend();

    newStartMsg.promise.then(() => console.log('this is how resend works'));
  });

  endExample();
});