import { Conversation, Message, Origin } from '../../dist/node';

export const initializeTests = () => {
  jest.setTimeout(60000);
}

export const createOneTimeListener = (conversation: Conversation): (callback: (message: Message) => void) => Promise<void> => {
  return (callback) => new Promise<void>(resolve => {
    const cb = (message: Message) => {
      conversation.removeMessageListener(cb);

      expect(message.origin === Origin.REMOTE);
      callback(message);

      resolve();
    }

    conversation.addMessageListener(cb);
  });
}
