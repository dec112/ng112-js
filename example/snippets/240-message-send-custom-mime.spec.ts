import { CONTENT_TYPE } from '../../src/constants/headers';
import { MultipartPart } from '../../src/models/multipart';
import { createAgent, endExample } from './util';

it('Shows how to send custom mime parts', async () => {
  const agent = await createAgent();

  const conversation = agent.createConversation('sip:144@dec112.eu');

  try {
    await conversation.start().promise;
  } catch {
    /* In this example awaiting the promise will always lead to an error because there is no real backend available */
  }

  const extraPart: MultipartPart = {
    headers: [
      {
        key: CONTENT_TYPE,
        value: 'application/json',
      }
    ],
    body: JSON.stringify({
      a: 'plain',
      json: 'object',
    }),
  };

  conversation.sendMessage({
    extraParts: [extraPart],
  });

  endExample();
});