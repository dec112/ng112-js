import type { PidfLo } from 'pidf-lo';
import { Conversation } from './conversation';
import { CustomSipHeader } from './custom-sip-header';
import { VCard } from './vcard';

export interface CustomSipHeaders {
  /**
   * Custom "From" SIP header
   * Fetched only when setting up agent
   */
  from?: CustomSipHeader,
  /**
   * Custom "Reply-To" SIP header
   * Fetched for every outgoing message
   */
  replyTo?: CustomSipHeader,
}
export class Store {
  public readonly conversations: Conversation[] = [];

  private _lastKnownLocation?: PidfLo;
  private _heartbeatInterval: number = 15000; // TS 103 698, 6.2.5: at least every 20 seconds
  private _vcard?: VCard;

  constructor(
    public readonly originSipUri: string,
    public readonly customSipHeaders?: CustomSipHeaders,
  ) { }

  updateVCard = (vcard?: VCard) => this._vcard = vcard;
  updateLocation = (location?: PidfLo) => {
    this._lastKnownLocation = location
  }

  getVCard = () => this._vcard;
  getLocation = () => this._lastKnownLocation;

  getHeartbeatInterval = () => this._heartbeatInterval;

  /**
   * Sets the update interval for heartbeat messages that are sent automatically
   * 
   * @param interval New interval to be used (in milliseconds)\
   * Values between (including) `1000` and `20000` are allowed only (due to ETSI spcification requirements)!
   */
  setHeartbeatInterval = (interval: number) => {
    if (interval < 1000)
      throw new Error('Intervals lower than 1000 milliseconds are not allowed.');

    if (interval > 20000)
      throw new Error('TS 103 698 does not allow intervals greater than 20000 milliseconds.');

    this._heartbeatInterval = interval;
  }
}