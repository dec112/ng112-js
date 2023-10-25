import { createAgent, endExample, startExample } from './util';
import fs from 'fs';
import path from 'path';
// @ts-ignore
import findRoot from 'find-root';

it('Shows how to send binaries', async () => {
  startExample();
  
  const agent = await createAgent();

  const conversation = agent.createConversation('sip:144@dec112.eu');

  // should be awaited!
  conversation.start();

  // we initialize this 
  let buffer: ArrayBuffer;
  try {
    buffer = fs.readFileSync(path.join(findRoot(__dirname), 'test', 'res', 'images', 'dec112.svg')).buffer;
  } catch {
    // oh no, we could not read the file
    throw new Error('We could not read the file.');
  }
  
  // should be awaited!
  conversation.sendMessage({
    binaries: [
      {
        mimeType: 'image/xml+svg',
        value: buffer,
      }
    ]
  });
  
  endExample();
});