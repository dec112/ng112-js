import { createMachine, interpret, assign } from '@xstate/fsm';
import { Conversation, ConversationEndpointType, ConversationState, StateObject } from '.';
import { Origin } from '../message';
import { EmergencyMessageType } from '../../constants/message-types/emergency';

interface ContextObject {
  hasBeenStarted: boolean;
  conversation: Conversation;
  origin: Origin;
}

export enum Transition {
  START = 'START',
  STOP = 'STOP',
  ERROR = 'ERROR',
  INTERRUPT = 'INTERRUPT',
}

export type EventObject = {
  type: Transition.START,
  origin: Origin,
  messageType: number,
} |
{
  type: Transition.STOP | Transition.ERROR | Transition.INTERRUPT,
  origin: Origin,
};

const contextAction = assign<ContextObject, EventObject>((context, event) => {
  context.origin = event.origin;

  return context;
});

const startCondition = (context: ContextObject, event: EventObject): boolean => {
  if (event.type !== Transition.START)
    return false;

  if (!context.hasBeenStarted) {
    const { conversation } = context;
    const { messageType, origin } = event;

    if (!messageType)
      throw new Error('messageType needs to be defined for START transition!');

    if (
      conversation.endpointType === ConversationEndpointType.CLIENT &&
      origin === Origin.REMOTE
    )

      if (
        conversation.mapper.supportsPsapStartMessage() &&
        messageType === EmergencyMessageType.START
      )
        return true;
      else if (
        !conversation.mapper.supportsPsapStartMessage() &&
        EmergencyMessageType.isStarted(messageType)
      )
        return true;
      else
        return false;

    else if (
      conversation.endpointType === ConversationEndpointType.PSAP &&
      messageType === EmergencyMessageType.START &&
      origin === Origin.LOCAL
    )
      return true;
    else
      return false;
  }

  return true;
}

export type ConversationStateMachine = ReturnType<typeof createConversationState>;
export const createConversationState = (
  conversation: Conversation,
  initialState?: StateObject,
) => {
  const defaultInitial = ConversationState.UNKNOWN;
  const initial = initialState?.value ?? defaultInitial;

  return interpret(createMachine<ContextObject, EventObject, {
    value: ConversationState,
    context: ContextObject,
  }>({
    id: 'conversation-state',
    initial,
    context: {
      hasBeenStarted: initial !== defaultInitial ? true : false,
      conversation,
      origin: initialState?.origin ?? Origin.SYSTEM,
    },
    states: {
      [ConversationState.UNKNOWN]: {
        on: {
          [Transition.START]: {
            target: ConversationState.STARTED,
            cond: startCondition,
            actions: contextAction,
          },
          [Transition.STOP]: {
            target: ConversationState.STOPPED,
            actions: contextAction,
          },
          [Transition.ERROR]: {
            target: ConversationState.ERROR,
            actions: contextAction,
          },
        }
      },
      [ConversationState.STARTED]: {
        entry: (context) => { context.hasBeenStarted = true; },
        on: {
          [Transition.STOP]: {
            target: ConversationState.STOPPED,
            actions: contextAction,
          },
          [Transition.ERROR]: {
            target: ConversationState.ERROR,
            actions: contextAction,
          },
          [Transition.INTERRUPT]: {
            target: ConversationState.INTERRUPTED,
            actions: contextAction,
          },
        }
      },
      [ConversationState.INTERRUPTED]: {
        on: {
          [Transition.START]: {
            target: ConversationState.STARTED,
            cond: startCondition,
            actions: contextAction,
          },
          [Transition.STOP]: {
            target: ConversationState.STOPPED,
            actions: contextAction,
          },
        }
      },
      [ConversationState.ERROR]: {
        on: {
          [Transition.START]: {
            target: ConversationState.STARTED,
            cond: startCondition,
            actions: contextAction,
          },
          [Transition.STOP]: {
            target: ConversationState.STOPPED,
            actions: contextAction,
          },
        }
      },
      [ConversationState.STOPPED]: {
      },
    }
  }));
}