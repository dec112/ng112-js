import { MultipartPart } from 'ng112-js';
import { createAgent, endExample, startExample } from './util';

it('Shows how to send custom mime parts', async () => {
  startExample();
  
  const agent = await createAgent();

  const conversation = agent.createConversation('sip:144@dec112.eu');

  // should be awaited!
  conversation.start()
  
  const extraPart: MultipartPart = {
    headers: [
      {
        key: 'Content-Type',
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