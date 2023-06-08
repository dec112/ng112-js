import { createAgent, endExample, startExample } from './util';

it('Shows how to resend a message', async () => {
  startExample();

  const agent = await createAgent();

  const conversation = agent.createConversation('sip:144@dec112.eu');

  // should be awaited!
  const firstStartMsg = conversation.start();
  firstStartMsg.promise.catch(() => {
    // here we can resend the message
    // should be awaited!
    // IMPORTANT: to not cause any id collisions this message is
    // a NEW object with a NEW message id!
    const secondStartMsg = firstStartMsg.resend();
  });

  endExample();
});