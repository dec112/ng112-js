import type { PidfLo } from 'pidf-lo';
import { Conversation } from './conversation';
import { CustomSipHeader } from './custom-sip-header';
import { HttpAdapter } from './http-adapter';
import { Logger } from './logger';
import { VCard } from 'vcard-xml';

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

export enum AgentMode {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export const defaultHeartbeatInterval = 15000; // TS 103 698, 6.2.5: at least every 20 seconds

export class Store {
  public conversations: Conversation[] = [];

  private _lastKnownLocation?: PidfLo;
  private _heartbeatInterval: number = defaultHeartbeatInterval;
  private _vcard?: VCard;
  private _did?: string;
  private _mode: AgentMode = AgentMode.ACTIVE;

  private _httpAdapter?: HttpAdapter;

  private _heartbeatIntervalListeners: Set<(interval: number) => unknown> = new Set();

  constructor(
    public readonly originSipUri: string,
    public readonly logger: Logger,
    public readonly customSipHeaders?: CustomSipHeaders,
  ) { }

  updateVCard = (vcard?: VCard) => this._vcard = vcard;
  updateDID = (did?: string) => this._did = did;
  updateLocation = (location?: PidfLo) => {
    this._lastKnownLocation = location
  }

  getVCard = () => this._vcard;
  getDID = () => this._did;
  getLocation = () => this._lastKnownLocation;
  getMode = () => this._mode;
  getHttpAdapter = (): HttpAdapter => {
    if (!this._httpAdapter)
      throw new Error('HttpAdapter was not set but is required.');

    return this._httpAdapter;
  }

  getHeartbeatInterval = () => this._heartbeatInterval;

  /**
   * Sets the update interval for heartbeat messages that are sent automatically
   * 
   * @param interval New interval to be used (in milliseconds) \
   * Values between (including) `0` and `20000` are allowed only (due to ETSI spcification requirements)! \
   * If value `0` is specified, automatic heartbeats will be disabled. \
   * If no value is specified, a default interval of `15000` milliseconds will be applied.
   */
  setHeartbeatInterval = (interval: number = defaultHeartbeatInterval) => {
    if (interval > 20000 || interval < 0)
      this.logger.error('TS 103 698 does not allow intervals greater than 20000 or smaller than 0 milliseconds.');

    if (interval !== this._heartbeatInterval) {
      this._heartbeatInterval = interval;

      for (const listener of this._heartbeatIntervalListeners) {
        listener(interval);
      }
    }
  }

  setMode = (mode = AgentMode.ACTIVE) => this._mode = mode;

  setHttpAdapter = (adapter?: HttpAdapter) => this._httpAdapter = adapter;

  addHeartbeatIntervalListener = (callback: (interval: number) => unknown) => {
    this._heartbeatIntervalListeners.add(callback);
  }

  removeHeartbeatIntervalListener = (callback: (interval: number) => unknown) => {
    this._heartbeatIntervalListeners.delete(callback);
  }
}