import { Agent } from '../../src/models/agent';
import { DEC112Specifics } from '../../test';
import { endExample } from './util';

it('Shows how to initialize an agent for a DEC112 environment', async () => {
  new Agent({
    domain: 'dec112.eu',
    endpoint: 'ws://dec112.at',
    password: 'password',
    user: 'user',
    // DEC112 environments require a verified telephone number, due to legal requirements.
    displayName: '004366412345678',
    namespaceSpecifics: new DEC112Specifics(
      // device id (registration API version 1; deprecated)
      undefined,
      // registration id (registration API version 2)
      'registrationId',
      // user device language (ISO639-1 two letter language code; optional)
      'en',
      // client version (e.g. version of application, where ng112-js is used in; optional)
      '1.0.4',
    ),
  });

  endExample();
});