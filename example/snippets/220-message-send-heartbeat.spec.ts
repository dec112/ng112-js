import { EmergencyMessageType } from '../../src';
import { createAgent, endExample } from './util';

it('Shows how to send heartbeats manually', async () => {
  const agent = await createAgent();

  const conversation = agent.createConversation('sip:144@dec112.eu');

  try {
    await conversation.start().promise;
  } catch {
    /* In this example awaiting the promise will always lead to an error because there is no real backend available */
  }

  conversation.sendMessage({
    type: EmergencyMessageType.HEARTBEAT,
  });

  endExample();
});