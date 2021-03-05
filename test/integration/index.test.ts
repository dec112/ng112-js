import { getAgent, server } from '..';
import { Agent, ConversationState, EmergencyMessageType, MessageOrigin } from '../../dist/node';

// jest.setTimeout(10000);

server.initialize();

const getAgentInitialized = async () => {
  const agent = getAgent();

  const init = agent.initialize();
  await server.expect.message();

  server.send('sip-register_valid');
  await init;

  return agent;
}

const disposeAgent = async (agent: Agent) => {
  const disposal = agent.dispose();
  await server.expect.message();
  server.send('sip-unregister_ok');

  await disposal;
}

describe('ng112-js', () => {
  it('succesfully registers at the proxy', async () => {
    const agent = await getAgentInitialized();

    expect(agent.conversations).toHaveLength(0);

    await disposeAgent(agent);
  });

  it('can have a dialogue', async () => {
    const target = 'sip:1234@dec112.at';
    const agent = await getAgentInitialized();

    const conversation = agent.createConversation(target);
    expect(agent.conversations).toHaveLength(1);
    expect(conversation.id).toHaveLength(30);
    expect(conversation.mapper.getName()).toBe('ETSI');
    expect(conversation.targetUri).toBe(target);

    const msg = conversation.start();
    expect(msg.conversation).toBe(conversation);
    expect(msg.id).toBe(1);
    expect(msg.origin).toBe(MessageOrigin.LOCAL);
    expect(msg.text).not.toBeUndefined();
    expect(msg.type).toBe(EmergencyMessageType.START);

    expect(conversation.state).toBe(ConversationState.UNKNOWN);

    const outgoingMessage = await server.expect.message();
    expect(outgoingMessage).toContain('From: "Alice"');

    const promise = new Promise<void>(resolve => {
      conversation.addMessageListener((message) => {
        expect(message.text).toBe('hello dec112!');
        expect(conversation.state).toBe(ConversationState.STARTED);

        resolve();
      });
    });

    server.send('sip-trying');
    server.send('sip-message_ok');
    server.send('sip-message_start_text-plain');

    await promise;

    await disposeAgent(agent);
  });
});