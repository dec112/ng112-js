import { createAgent, endExample, startExample } from './util';

it('Shows how to send heartbeats manually', async () => {
  startExample();
  
  const agent = await createAgent();
  const conversation = agent.createConversation('sip:144@dec112.eu');

  // should be awaited!
  conversation.start();

  // should be awaited!
  conversation.sendHeartbeat();

  endExample();
});