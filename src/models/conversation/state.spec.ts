import { Conversation, ConversationState, StateObject } from ".";
import { Agent } from "../agent";
import { ConversationStateMachine, createConversationState, Transition } from "./state";
import { Origin } from "../message";
import { EmergencyMessageType } from "../../constants/message-types/emergency";

const getConversation = () => {
  const agent = new Agent({
    // just mocking the sip adapter here
    // @ts-expect-error
    sipAdapterFactory: () => { },
    endpoint: 'ws://example.com',
    domain: 'example.com',
    user: 'user',
    password: 'pass',
  });

  return agent.createConversation('');
}

let conversation: Conversation;
let state: ConversationStateMachine;

const expectState = (expected: StateObject): void => {
  expect(state.state.value).toBe(expected.value);
  expect(state.state.context.origin).toBe(expected.origin);
}

describe('Conversation state machine', () => {
  beforeEach(() => {
    conversation = getConversation();
    state = createConversationState(conversation);
    state.start();
  });

  it('is correctly initialized', () => {
    expectState({
      origin: Origin.SYSTEM,
      value: ConversationState.UNKNOWN,
    });

    expect(state.state.context.hasBeenStarted).toBe(false);
  });

  it('throws an error if START is called without messageType', () => {
    expect(() => {
      state.send({
        origin: Origin.LOCAL,
        // @ts-expect-error
        type: Transition.START,
      })
    }).toThrow();
  });

  it('transitions from UNKNOWN to STARTED', () => {
    state.send({
      type: Transition.START,
      origin: Origin.REMOTE,
      messageType: EmergencyMessageType.START,
    });

    expectState({
      origin: Origin.REMOTE,
      value: ConversationState.STARTED,
    });
    expect(state.state.context.hasBeenStarted).toBe(true);
  });

  it.each<number>([
    EmergencyMessageType.IN_CHAT,
    EmergencyMessageType.INACTIVE,
    EmergencyMessageType.REDIRECT,
    EmergencyMessageType.TRANSFER,
    EmergencyMessageType.UNKNOWN,
    EmergencyMessageType.HEARTBEAT,
  ])('does not transition from UNKNOWN to STARTED for %s', (value: number) => {
    state.send({
      type: Transition.START,
      origin: Origin.REMOTE,
      messageType: value,
    });

    expectState({
      origin: Origin.SYSTEM,
      value: ConversationState.UNKNOWN,
    });
    expect(state.state.context.hasBeenStarted).toBe(false);
  });

  it('does not transition from UNKNOWN to STARTED from local', () => {
    state.send({
      type: Transition.START,
      origin: Origin.LOCAL,
      messageType: EmergencyMessageType.START,
    });

    expectState({
      origin: Origin.SYSTEM,
      value: ConversationState.UNKNOWN,
    });
    expect(state.state.context.hasBeenStarted).toBe(false);
  });

  it('transitions from UNKNOWN to STOPPED', () => {
    state.send({
      type: Transition.STOP,
      origin: Origin.REMOTE,
    });

    expectState({
      origin: Origin.REMOTE,
      value: ConversationState.STOPPED,
    });
    expect(state.state.context.hasBeenStarted).toBe(false);
  });

  it('keeps the flag hasBeenStarted after stopping', () => {
    state.send({
      type: Transition.START,
      origin: Origin.REMOTE,
      messageType: EmergencyMessageType.START,
    });

    state.send({
      type: Transition.STOP,
      origin: Origin.LOCAL,
    });

    expect(state.state.context.hasBeenStarted).toBe(true);
  });

  it('does not transition from STOPPED to STARTED', () => {
    state.send({
      type: Transition.START,
      origin: Origin.REMOTE,
      messageType: EmergencyMessageType.START,
    });

    state.send({
      type: Transition.STOP,
      origin: Origin.LOCAL,
    });

    state.send({
      type: Transition.START,
      origin: Origin.REMOTE,
      messageType: EmergencyMessageType.START,
    });

    expectState({
      origin: Origin.LOCAL,
      value: ConversationState.STOPPED,
    });
    expect(state.state.context.hasBeenStarted).toBe(true);
  });

  it('does not unnecessarily change origin if no real change has happened', () => {
    state.send({
      type: Transition.ERROR,
      origin: Origin.REMOTE,
    });

    state.send({
      type: Transition.ERROR,
      origin: Origin.LOCAL,
    });

    expectState({
      origin: Origin.REMOTE,
      value: ConversationState.ERROR,
    });
  });
});

describe('Conversation state machine - special cases', () => {
  it('sets initial state correctly 1', () => {
    conversation = getConversation();
    state = createConversationState(conversation, {
      origin: Origin.LOCAL,
      value: ConversationState.STARTED,
    });

    const fn = jest.fn((state) => {
      expect(state.context.hasBeenStarted).toBe(true);
      expectState({
        origin: Origin.LOCAL,
        value: ConversationState.STARTED,
      });
    });

    state.subscribe(fn);
    state.start();

    expect(fn).toBeCalled();
  });

  it('sets initial state correctly 2', () => {
    conversation = getConversation();
    state = createConversationState(conversation, {
      origin: Origin.LOCAL,
      value: ConversationState.UNKNOWN,
    });

    const fn = jest.fn((state) => {
      expect(state.context.hasBeenStarted).toBe(false);
      expectState({
        origin: Origin.LOCAL,
        value: ConversationState.UNKNOWN,
      });
    });

    state.subscribe(fn);
    state.start();

    expect(fn).toBeCalled();
  });

  it('sets initial state correctly 3', () => {
    conversation = getConversation();
    state = createConversationState(conversation, {
      origin: Origin.REMOTE,
      value: ConversationState.INTERRUPTED,
    });

    const fn = jest.fn((state) => {
      expect(state.context.hasBeenStarted).toBe(true);
      expectState({
        origin: Origin.REMOTE,
        value: ConversationState.INTERRUPTED,
      });
    });

    state.subscribe(fn);
    state.start();

    expect(fn).toBeCalled();
  });
});