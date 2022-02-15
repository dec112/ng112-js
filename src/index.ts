import { getPackageInfo } from './utils/package-utils';
export const version = getPackageInfo().version;

export {
  Agent,
  AgentConfiguration,
  AgentState,
} from './models/agent';

export {
  Message,
  MessageState,
  Origin,
} from './models/message';

export {
  VCard,
  Gender,
} from './models/vcard';

export {
  EmergencyMessageType,
} from './constants/message-types/emergency';

export {
  Conversation,
  ConversationState,
  SendMessageObject,
  StateObject,
} from './models/conversation';

export {
  DEC112Specifics,
} from './namespaces';

export {
  MessageFailedEvent,
} from './models/interfaces';

export {
  Header,
} from './utils';

export {
  LogLevel,
} from './models/logger';

import PidfLoCompat from './compatibility/pidf-lo';

const {
  Circle,
  Device,
  LocationMethod,
  Person,
  PidfLo,
  Point,
  Tuple,
} = PidfLoCompat;

export {
  Circle,
  Device,
  LocationMethod,
  Person,
  PidfLo,
  Point,
  Tuple,
};

// this is only a typescript interface
// therefore we directly export it from the pidf-lo module
export {
  SimpleLocation,
} from 'pidf-lo';