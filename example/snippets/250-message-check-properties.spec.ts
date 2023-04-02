import { Origin, EmergencyMessageType, MessageState } from 'ng112-js';
import { createAgent, endExample, startExample } from './util';

it('Shows how to check for different message properties', async () => {
  startExample();
  
  const agent = await createAgent();

  const conversation = agent.createConversation('sip:144@dec112.eu');

  conversation.addMessageListener((msg) => {
    if (EmergencyMessageType.isHeartbeat(msg.type))
      console.log('This is a heartbeat message.');

    if (msg.origin === Origin.LOCAL)
      console.log('This message was sent by the client.');

    if (msg.origin === Origin.REMOTE)
      console.log('This message was sent by the other communicating party.'); // e.g. on a mobile phone it was sent by the PSAP

    if (msg.origin === Origin.SYSTEM)
      console.log('This is a message that was generated by the SIP stack.');

    if (msg.state === MessageState.PENDING)
      console.log('This message is outgoing and is still sending.');

    if (msg.state === MessageState.SUCCESS)
      console.log('This message was successfully forwarded by the SIP stack');

    if (msg.state === MessageState.ERROR)
      console.log('There were problems forwarding this message.');
  });

  endExample();
});