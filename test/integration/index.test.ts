import { getAgents } from '..';
import { Agent, ConversationState, Conversation, EmergencyMessageType, Message, Origin, Namespace } from '../../dist/node';

jest.setTimeout(60000);

const createOneTimeListener = (conversation: Conversation): (callback: (message: Message) => void) => Promise<void> => {
  return (callback) => new Promise<void>(resolve => {
    const cb = (message: Message) => {
      conversation.removeMessageListener(cb);

      expect(message.origin === Origin.REMOTE);
      callback(message);

      resolve();
    }

    conversation.addMessageListener(cb);
  });
}

describe('ng112-js', () => {
  it.each<Agent>(getAgents())('succesfully registers at the proxy', async (agent: Agent) => {
    await agent.initialize();

    expect(agent.conversations).toHaveLength(0);

    await agent.dispose();
  });

  it.each<Agent>(getAgents())('can have a dialogue', async (agent: Agent) => {
    const target = 'sip:default@service.dec112.home';
    await agent.initialize();

    const conversation = agent.createConversation(target);
    const once = createOneTimeListener(conversation);

    expect(agent.conversations).toHaveLength(1);
    expect(conversation.id).toHaveLength(30);
    expect(conversation.mapper.getNamespace()).toBe(Namespace.ETSI);
    expect(conversation.targetUri).toBe(target);
    expect(conversation.state.value).toBe(ConversationState.UNKNOWN);

    const msg = conversation.start();
    expect(msg.conversation).toBe(conversation);
    expect(msg.id).toBe(1);
    expect(msg.origin).toBe(Origin.LOCAL);
    expect(msg.text).toBeUndefined();
    expect(msg.type).toBe(EmergencyMessageType.START);

    expect(conversation.state.value).toBe(ConversationState.UNKNOWN);

    await once((msg) => {
      expect(msg.text).toContain('How can we help you?');
      expect(conversation.state.value).toBe(ConversationState.STARTED);
      expect(conversation.state.origin).toBe(Origin.REMOTE);
    });

    await conversation.sendMessage({
      text: 'Testing',
    });

    await once((msg: Message) => {
      expect(msg.text).toContain('Testing');
    })

    const endMsg = conversation.stop();
    expect(endMsg.text).toBeUndefined();

    await endMsg.promise;

    expect(conversation.state.value).toBe(ConversationState.STOPPED);
    expect(conversation.state.origin).toBe(Origin.LOCAL);

    await agent.dispose();
  });
});