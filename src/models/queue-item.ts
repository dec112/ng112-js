import { Message, MessageError } from './message';

export interface QueueItem {
  message: Message;
  resolve: () => void,
  reject: (reason: MessageError) => void,
}