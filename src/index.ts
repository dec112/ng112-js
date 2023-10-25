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
  KeyId,
  Gender,
  VCard,
} from 'vcard-xml';

export {
  EmergencyMessageType,
} from './constants/message-types/emergency';

export * from './constants/headers'

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
  EndpointType,
} from './models/interfaces';

export {
  DEC112Specifics,
  EmergencySpecifics,
  Mapper,
  Namespace,
  NamespaceSpecifics,
} from './namespaces';

export {
  Logger,
  LogLevel,
} from './models/logger';

export {
  Civic,
  CivicAddress,
  Circle,
  Device,
  LocationMethod,
  Person,
  PidfLo,
  Point,
  SimpleLocation,
  Tuple,
} from 'pidf-lo';

export {
  Multipart,
  MultipartPart,
} from './models/multipart';

export * from './adapters';
export * as Utils from './utils';

export {
  XMLCompat,
} from './compatibility';