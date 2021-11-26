import { getAgents } from '..';
import { Agent, Origin, MessageError, ConversationState, StateObject } from '../../dist/node';
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
      const expectedError: MessageError = {
        code: 404,
        origin: Origin.REMOTE,
      };

      expect(ex).toEqual(expectedError);
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
      
      expect(ex.code).toBeGreaterThanOrEqual(400);
      expect(ex.origin).toBe(Origin.REMOTE);
    }
    
    expect(positiveMock).not.toHaveBeenCalled();
    
    await agent.dispose();
  });
  
  it.each<Agent>(getAgents())('resumes a conversation that has run into an error', async (agent: Agent) => {
    const target = 'sip:default@service.dec112.home';
    await agent.initialize();
    
    const conversation = agent.createConversation(target);
    
    await conversation.start().promise;
    
    // this is a private property, therefore typescript complains
    // @ts-expect-error
    conversation._targetUri = 'sip:non-existent@service.dec112.home';
    const positiveMock = jest.fn();
    
    try {
      await conversation.sendMessage({
        text: 'some text',
      }).promise;
      positiveMock();
    } catch (_ex) {
      const ex = _ex as MessageError;
      const expectedError: MessageError = {
        code: 404,
        origin: Origin.REMOTE,
      };

      expect(ex).toEqual(expectedError);
    }
    
    expect(positiveMock).not.toHaveBeenCalled();

    const errorState: StateObject = {
      origin: Origin.REMOTE,
      value: ConversationState.ERROR,
    };
    expect(conversation.state).toEqual(errorState);

    // this is a private property, therefore typescript complains
    // @ts-expect-error
    conversation._targetUri = target;

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

    const stopState: StateObject = {
      origin: Origin.LOCAL,
      value: ConversationState.STOPPED,
    };
    expect(conversation.state).toEqual(stopState);
  });
});