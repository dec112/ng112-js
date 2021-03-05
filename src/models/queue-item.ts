import { MessageFailedEvent } from 'jssip/lib/Message';
import { OutgoingEvent } from 'jssip/lib/RTCSession';
import { Message } from './message';

export interface QueueItem {
  message: Message;
  resolve: (value: OutgoingEvent) => void,
  reject: (reason: MessageFailedEvent) => void,
}