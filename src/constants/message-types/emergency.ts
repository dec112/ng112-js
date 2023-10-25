import { hasBits, nthBit } from '../../utils';

const versionBit = 9;

const setup = (bitmask: number) => nthBit(versionBit) | bitmask;

/**
 * These are the official message types defined in ETSI TS 103 698
 */
export abstract class EmergencyMessageType {
  static UNKNOWN = setup(0);
  static START = setup(nthBit(1));
  static IN_CHAT = setup(nthBit(1) | nthBit(2));
  static STOP = setup(nthBit(2));
  static HEARTBEAT = setup(nthBit(3));
  static TRANSFER = setup(nthBit(4));
  static REDIRECT = setup(nthBit(5));
  // static RESERVED1 = setup(nthBit(6));
  // static RESERVED2 = setup(nthBit(7))

  /**
   * ATTENTION! The INACTIVE bit is not initialized with version bit
   * This is due to that this bit is only used in conjunction with HEARTBEAT and MUST NOT be used alone!
   * This way, we can easily add and remove it to the HEARTBEAT bit
   */
  static INACTIVE = nthBit(8);

  /**
   * Returns true, if conversation is started or in chat
   * 
   * @param bitmask ETSI TS 103 698 message type bitmask
   */
  static isStarted = (bitmask: number) =>
    hasBits(bitmask, EmergencyMessageType.START) ||
    hasBits(bitmask, EmergencyMessageType.HEARTBEAT);

  /**
   * Returns true, if conversation is stopped
   * 
   * @param bitmask ETSI TS 103 698 message type bitmask
   */
  static isStopped = (bitmask: number) => hasBits(bitmask, EmergencyMessageType.STOP) && (!hasBits(bitmask, EmergencyMessageType.START));

  /**
   * Returns true, if conversation is in one of the following states \
   * * STOPPED
   * * UNKNOWN
   * * TRANSFER
   * * REDIRECT
   * 
   * @param bitmask ETSI TS 103 698 message type bitmask
   */
  static isInterrupted = (bitmask: number) =>
    EmergencyMessageType.isStopped(bitmask) ||
    // we don't use `hasBits` for UNKNOWN, as UNKNOWN is basically zero
    // `hasBits` would always return true here
    bitmask === EmergencyMessageType.UNKNOWN ||
    hasBits(bitmask, EmergencyMessageType.TRANSFER) ||
    hasBits(bitmask, EmergencyMessageType.REDIRECT);

  /**
   * Returns true, if message is of type HEARTBEAT
   * 
   * @param bitmask ETSI TS 103 698 message type bitmask
   */
  static isHeartbeat = (bitmask: number) => hasBits(bitmask, EmergencyMessageType.HEARTBEAT);
}
