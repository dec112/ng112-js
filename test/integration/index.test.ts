import { getAgents } from '..';
import { Agent, ConversationState, EmergencyMessageType, Message, Origin, Namespace, StateObject, MessageError } from '../../dist/node';
import { createOneTimeListener, initializeTests } from './utils';

initializeTests();

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
      expect(msg).toBeInstanceOf(Message);
      expect(msg.text).toContain('How can we help you?');
      expect(conversation.state.value).toBe(ConversationState.STARTED);
      expect(conversation.state.origin).toBe(Origin.REMOTE);
    });

    const localMsg = conversation.sendMessage({
      text: 'Testing',
    });
    expect(localMsg).toBeInstanceOf(Message);

    await once((msg: Message) => {
      expect(msg.text).toContain('Testing');
    })

    const endMsg = conversation.stop();
    expect(endMsg.text).toBeUndefined();

    await endMsg.promise;

    expect(conversation.state.value).toBe(ConversationState.STOPPED);
    expect(conversation.state.origin).toBe(Origin.LOCAL);

    // messages that are sent after conversation close should be rejected immediately
    try {
      await conversation.sendMessage({
        text: 'test',
      }).promise;

      throw new Error('Message was not rejected although conversation has already been stopped');
    } catch (e) {
      expect(e).toEqual<MessageError>({
        origin: Origin.SYSTEM,
        reason: 'Can not send message in stopped conversation',
      });
    }

    await agent.dispose();
  });

  it.each<Agent>(getAgents())('does not notify listeners multiple times', async (agent: Agent) => {
    const target = 'sip:default@service.dec112.home';
    await agent.initialize();

    const conversation = agent.createConversation(target);

    const callback = jest.fn();

    // intentionally registering this listener multiple times
    // however the listener should only be called one time per message
    conversation.addMessageListener(callback);
    conversation.addMessageListener(callback);
    conversation.addMessageListener(callback);

    await conversation.start().promise;
    await conversation.sendHeartbeat().promise;
    await conversation.stop().promise;

    // START message local
    // START message remote
    // HEARTBEAT message local
    // STOP message local
    // = 4 messages
    expect(callback).toBeCalledTimes(4);

    await agent.dispose();
  });

  it.each<Agent>(getAgents())('does not cause problems if callback is removed if it has was never been attached', async (agent: Agent) => {
    const target = 'sip:default@service.dec112.home';
    await agent.initialize();

    const conversation = agent.createConversation(target);

    const callback = jest.fn();

    // never registered this listener before
    conversation.removeMessageListener(callback);

    await conversation.start().promise;
    await conversation.sendHeartbeat().promise;
    await conversation.stop().promise;

    await agent.dispose({
      stopOpenConversations: true,
    });

    // should automatically stop conversations
    const stopState: StateObject = {
      origin: Origin.LOCAL,
      value: ConversationState.STOPPED,
    };
    expect(conversation.state).toEqual(stopState);
  });
});