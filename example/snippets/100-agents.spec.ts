import { Agent, JsSipAdapter, SipJsAdapter } from "../../src";
import { endExample } from './util';

it('Shows the creation of ng112-js instance with different SIP stacks', async () => {
  // using JsSIP
  new Agent({
    sipAdapterFactory: JsSipAdapter.factory,
    domain: 'dec112.eu',
    endpoint: 'ws://dec112.at',
    password: 'password',
    user: 'user',
  });

  // using SIP.js
  new Agent({
    sipAdapterFactory: SipJsAdapter.factory,
    domain: 'dec112.eu',
    endpoint: 'ws://dec112.at',
    password: 'password',
    user: 'user',
  });

  endExample();
});