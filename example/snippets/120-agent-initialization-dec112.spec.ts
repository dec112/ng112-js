import { Agent, DEC112Specifics } from 'ng112-js';
import { JsSipAdapter } from 'ng112-js-sip-adapter-jssip';
import { endExample, startExample } from './util';

it('Shows how to initialize an agent for a DEC112 environment', async () => {
  startExample();
  
  new Agent({
    sipAdapterFactory: JsSipAdapter.factory,
    domain: 'dec112.eu',
    endpoint: 'ws://dec112.at',
    password: 'password',
    user: 'user',
    userAgent: 'ng112-js-example-snippet/1.0.0',
    // DEC112 environments require a verified telephone number, due to legal requirements.
    displayName: '004366412345678',
    namespaceSpecifics: new DEC112Specifics({
      // registration id (registration API version 2)
      registrationId: 'registrationId',
      // user device language (ISO639-1 two letter language code; optional)
      language: 'en',
      // client version (e.g. version of application, where ng112-js is used in; optional)
      clientVersion: '1.0.4',
    }),
  });

  endExample();
});