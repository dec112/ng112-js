import { AgentState } from '../../src/models/agent';
import { createAgent, endExample } from './util';

it('Shows the usage of agent events', async () => {
  const agent = await createAgent();

  agent.addStateListener((state) => {
    switch (state) {
      case AgentState.CONNECTED:
      case AgentState.CONNECTING:
      case AgentState.DISCONNECTED:
      case AgentState.REGISTERED:
      case AgentState.REGISTRATION_FAILED:
      case AgentState.UNREGISTERED:
        break;
    }
  });

  endExample();
});