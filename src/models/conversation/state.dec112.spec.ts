import { Conversation, ConversationState, StateObject } from ".";
import { Agent } from "../agent";
import { ConversationStateMachine, createConversationState, Transition } from "./state";
import { Origin } from "../message";
import { DEC112Specifics, EmergencyMessageType } from "../..";

let conversation: Conversation;
let state: ConversationStateMachine;

beforeEach(() => {
  const agent = new Agent({
    // just mocking the sip adapter here
    // @ts-expect-error
    sipAdapterFactory: () => { },
    endpoint: 'ws://example.com',
    domain: 'example.com',
    user: 'user',
    password: 'pass',
    namespaceSpecifics: new DEC112Specifics({}),
  });

  conversation = agent.createConversation('');
  state = createConversationState(conversation);
  state.start();
});

const expectState = (expected: StateObject): void => {
  expect(state.state.value).toBe(expected.value);
  expect(state.state.context.origin).toBe(expected.origin);
}

describe('Conversation state machine - DEC112 specifics', () => {
  it.each<number>([
    EmergencyMessageType.START,
    EmergencyMessageType.IN_CHAT,
  ])('correctly transitions from UNKNOWN to STARTED for %s', (value: number) => {
    state.send({
      type: Transition.START,
      origin: Origin.REMOTE,
      messageType: value,
    });

    expectState({
      origin: Origin.REMOTE,
      value: ConversationState.STARTED,
    });
    expect(state.state.context.hasBeenStarted).toBe(true);
  });
});