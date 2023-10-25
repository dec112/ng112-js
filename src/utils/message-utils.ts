import { CONTENT_TYPE, Multipart } from "..";
import { MULTIPART_MIXED, TEXT_PLAIN } from "../constants/content-types";
import { MessageConfig } from "../models/message";

export const parseMessage = (message: Partial<MessageConfig>, body?: string, contentType: string = TEXT_PLAIN): Partial<MessageConfig> => {
  if (body) {
    // no multipart header?
    if (contentType.indexOf(MULTIPART_MIXED) === -1) {
      // if content type is not multipart we create a multipart object
      // it just simplifies the whole workflow of parsing the message body
      message.multipart = new Multipart();
      message.multipart.add({
        headers: [{ key: CONTENT_TYPE, value: contentType }],
        body,
      });
    }
    else {
      message.multipart = Multipart.parse(body, contentType);
    }
  }

  return message;
}
