import { Multipart } from '../..';
import { hasBits, nthBit } from '../../utils';
import { TEXT_HTML, TEXT_PLAIN } from '../content-types';
import { EmergencyMessageType } from './emergency';

interface MessageTypeModifiers {
  hasLocation?: boolean,
  hasTextMessage?: boolean,
  hasVCard?: boolean,
}

const UNKNOWN = 0;
const START = nthBit(1);
const STOP = nthBit(1) | nthBit(2);
const IN_CHAT = nthBit(2);

export const fromEmergencyMessageType = (
  emergencyMessageType: number,
  modifiers?: MessageTypeModifiers,
): number => {
  const mt = emergencyMessageType;
  let res: number = 0;

  if (
    hasBits(mt, EmergencyMessageType.IN_CHAT) ||
    hasBits(mt, EmergencyMessageType.HEARTBEAT)
  )
    res = IN_CHAT;
  else if (hasBits(mt, EmergencyMessageType.STOP))
    res = STOP;
  else if (hasBits(mt, EmergencyMessageType.START))
    res = START;
  else if (hasBits(mt, EmergencyMessageType.UNKNOWN))
    res = UNKNOWN;
  else
    // TRANSFER
    // REDIRECT
    throw new Error('not implemented');

  if (modifiers) {
    const {
      hasVCard,
      hasLocation,
      hasTextMessage,
    } = modifiers;

    if (hasLocation)
      res |= nthBit(3);

    if (hasVCard)
      res |= nthBit(4);

    if (hasTextMessage)
      res |= nthBit(5);
  }

  return res;
}

export const toEmergencyMessageType = (dec112MessageType: number, multipart?: Multipart) => {
  let res = 0;

  if (hasBits(dec112MessageType, STOP))
    res = EmergencyMessageType.STOP;
  else if (hasBits(dec112MessageType, START))
    res = EmergencyMessageType.START;
  else if (hasBits(dec112MessageType, IN_CHAT)) {
    // check if multipart contains some text elements
    // if so it's an IN_CHAT message
    // otherwise it's heartbeat
    if (multipart?.getPartsByContentTypes([TEXT_HTML, TEXT_PLAIN]))
      res = EmergencyMessageType.IN_CHAT;
    else
      res = EmergencyMessageType.HEARTBEAT;
  }
  else
    res = EmergencyMessageType.UNKNOWN;

  return res;
}