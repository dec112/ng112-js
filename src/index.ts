import { getPackageInfo } from './utils/package-utils';
export const version = getPackageInfo().version;

export {
  Agent,
  AgentConfiguration,
  AgentState,
  DebugConfig,
} from './models/agent';

export {
  Binary,
  Message,
  MessageError,
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
  AgentMode,
} from './models/store';

export {
  DEC112Specifics,
} from './namespaces';

export {
  Logger,
  LogLevel,
} from './models/logger';

export {
  Circle,
  Device,
  LocationMethod,
  Person,
  PidfLo,
  Point,
  SimpleLocation,
  Tuple,
} from 'pidf-lo/dist/node';

export {
  Multipart,
  MultipartPart,
} from './models/multipart';