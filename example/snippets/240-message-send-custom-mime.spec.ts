import { CONTENT_TYPE } from '../../src/constants/headers';
import { MultipartPart } from '../../src/models/multipart';
import { createAgent, endExample } from './util';

it('Shows how to send custom mime parts', async () => {
  const agent = await createAgent();

  const conversation = agent.createConversation('sip:144@dec112.eu');

  // should be awaited!
  conversation.start()
  
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
  
  // should be awaited!
  conversation.sendMessage({
    extraParts: [extraPart],
  });
  
  endExample();
});