import { Message, MessageFailed } from './message';

export interface QueueItem {
  message: Message;
  resolve: () => void,
  reject: (reason: MessageFailed) => void,
}