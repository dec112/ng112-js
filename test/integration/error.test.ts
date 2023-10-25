import { getAgents } from '..';
import { Agent, Origin, MessageError, ConversationState, StateObject } from '../..';
import { initializeTests } from './utils';

initializeTests();

describe('ng112-js errors', () => {
  it.each<Agent>(getAgents())('handles 404 Not Found errors correctly', async (agent: Agent) => {
    const target = 'sip:non-existent@service.dec112.home';
    await agent.initialize();

    const conversation = agent.createConversation(target);
    const positiveMock = jest.fn();

    try {
      await conversation.start().promise;
      positiveMock();
    } catch (_ex) {
      const ex = _ex as MessageError;

      expect(ex.statusCode).toBe(404);
      expect(ex.origin).toBe(Origin.REMOTE);
      expect(ex.reason).toBe('Not Found');
    }

    expect(positiveMock).not.toHaveBeenCalled();

    await agent.dispose();
  });

  it.each<Agent>(getAgents())('handles errors with invalid domains correctly', async (agent: Agent) => {
    const target = 'sip:default@domain.is.invalid';
    await agent.initialize();

    const conversation = agent.createConversation(target);
    const positiveMock = jest.fn();

    try {
      await conversation.start().promise;
      positiveMock();
    } catch (_ex) {
      const ex = _ex as MessageError;

      expect(ex.statusCode).toBeGreaterThanOrEqual(400);
      expect(ex.origin).toBe(Origin.REMOTE);
      expect(ex.reason).toContain('Unresolvable destination');
    }

    expect(positiveMock).not.toHaveBeenCalled();

    await agent.dispose();
  });

  it.each<Agent>(getAgents())('resumes a conversation that has run into an error', async (agent: Agent) => {
    const target = 'sip:default@service.dec112.home';
    await agent.initialize();

    const conversation = agent.createConversation(target);

    await conversation.start().promise;

    conversation.targetUri = 'sip:non-existent@service.dec112.home';
    const positiveMock = jest.fn();

    try {
      await conversation.sendMessage({
        text: 'some text',
      }).promise;
      positiveMock();
    } catch (_ex) {
      const ex = _ex as MessageError;

      expect(ex.statusCode).toBe(404);
      expect(ex.origin).toBe(Origin.REMOTE);
      expect(ex.reason).toBe('Not Found');
    }

    expect(positiveMock).not.toHaveBeenCalled();

    const errorState: StateObject = {
      origin: Origin.REMOTE,
      value: ConversationState.ERROR,
    };
    expect(conversation.state).toEqual(errorState);

    conversation.targetUri = target;

    // now we should be able to resume the conversation again
    await conversation.sendMessage({
      text: 'some text',
    }).promise;

    const okState: StateObject = {
      origin: Origin.LOCAL,
      value: ConversationState.STARTED,
    };
    expect(conversation.state).toEqual(okState);

    await agent.dispose();

    // should not automatically stop conversation
    // if not explicitly specified in `dispose`
    expect(conversation.state).toEqual(okState);
  });

  it.each<Agent>(getAgents())('throws an error if start message is sent twice', async (agent: Agent) => {
    const target = 'sip:default@service.dec112.home';
    await agent.initialize();

    const conversation = agent.createConversation(target);

    await conversation.start().promise;
    await expect(async () => {
      await conversation.start().promise;
    }).rejects;
  });

  it.each<Agent>(getAgents())('lets you restart a message if it has failed in the first place', async (agent: Agent) => {
    const target = 'sip:non-existent@service.dec112.home';
    await agent.initialize();

    const conversation = agent.createConversation(target);
    const positiveMock = jest.fn();

    let startMessage = conversation.start();

    try {
      await startMessage.promise;
      positiveMock();
    } catch (_ex) {
      const ex = _ex as MessageError;

      expect(ex.statusCode).toBe(404);
      expect(ex.origin).toBe(Origin.REMOTE);
      expect(ex.reason).toBe('Not Found');
    }

    expect(positiveMock).not.toHaveBeenCalled();
    const errorState: StateObject = {
      origin: Origin.REMOTE,
      value: ConversationState.ERROR,
    };
    expect(conversation.state).toEqual(errorState);

    conversation.targetUri = 'sip:default@service.dec112.home';

    // now we should be able to start the conversation again
    await startMessage.resend().promise;

    const okState: StateObject = {
      origin: Origin.REMOTE,
      value: ConversationState.STARTED,
    };
    expect(conversation.state).toEqual(okState);

    await agent.dispose();
  });
});