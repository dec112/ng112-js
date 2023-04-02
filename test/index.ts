import { Agent, SipAdapter } from '../dist/node';
import { JsSipAdapter } from 'ng112-js-sip-adapter-jssip';
// import { SipJsAdapter } from 'ng112-js-sip-adapter-sipjs';

export * from '../dist/node';

export const getAgents = () => {
  const adapters: ((config: any) => SipAdapter)[] = [
    JsSipAdapter.factory,
    // TODO: currently not possible to also test with sip.js as sip.js requires ESM modules
    // SipJsAdapter.factory,
  ];

  return adapters.map(adapter => new Agent({
    sipAdapterFactory: adapter,
    endpoint: 'ws://127.0.0.1:8088',
    domain: 'service.dec112.home',
    user: 'user',
    password: '',
    displayName: 'Alice Smith',
    userAgent: 'ng112-test-script/1.0.0',
    debug: {
      // default: true,
      // sipAdapter: true,
    }
  }));
}