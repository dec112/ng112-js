import { IncomingRequestMessage, OutgoingRequestMessage } from "sip.js/lib/core";
import { Origin } from "../models/message";
import { NewMessageEvent } from "../models/sip-agent";

export const transformSipJsMessage = (request: OutgoingRequestMessage | IncomingRequestMessage, origin: Origin): NewMessageEvent => {
  let body: string | undefined;

  if (typeof request.body === 'object')
    body = request.body.body;
  else
    body = request.body;
  
  return {
    hasHeader: (name) => request.hasHeader(name),
    getHeader: (name) => request.getHeader(name),
    getHeaders: (name) => request.getHeaders(name),
    from: request.from,
    to: request.to,
    // sip.js only handles incoming messages with this event
    origin,
    body,
    sipStackMessage: request,
  }
}