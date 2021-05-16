import { EmergencyMessageType } from '../../src';
import { createAgent, endExample } from './util';

it('Shows how to send heartbeats manually', async () => {
  const agent = await createAgent();
  const conversation = agent.createConversation('sip:144@dec112.eu');

  // should be awaited!
  conversation.start();
  
  // should be awaited!
  conversation.sendMessage({
    type: EmergencyMessageType.HEARTBEAT,
  });

  endExample();
});