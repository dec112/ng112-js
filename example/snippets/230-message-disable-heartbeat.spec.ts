import { createAgent, endExample, startExample } from './util';

it('Shows how to disable heartbeats and re-enable them with their default interval', async () => {
  startExample();

  const agent = await createAgent();

  // disable
  agent.setHeartbeatInterval(0);
  // re-set them to their default interval
  agent.setHeartbeatInterval();

  endExample();
});