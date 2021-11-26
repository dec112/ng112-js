import { Agent } from '../dist/node';

export * from '../dist/node';

export const getAgents = () => {
  // this looks weird, but as it is a backport from ng112-js@2.0.0
  // we just keep the structure of having more agents
  // even if in version 1.0.0 there will always be only one agent.
  return [
    new Agent({
      endpoint: 'ws://127.0.0.1:8088',
      domain: 'service.dec112.home',
      user: 'user',
      password: '',
      displayName: 'Alice Smith',
    })
  ];
}