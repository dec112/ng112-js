import {
  Conversation,
  Message,
  Origin,

  XMLCompat,
} from '../..';

export const initializeTests = () => {
  jest.setTimeout(60000);

  XMLCompat.initialize(XMLCompat.getNodeImpl());
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
