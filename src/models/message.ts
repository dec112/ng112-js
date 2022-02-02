import { PidfLo } from 'pidf-lo';
import { getRandomString, Header } from '../utils';
import { Conversation } from './conversation';
import { CRLF } from './multipart';
import { VCard } from './vcard';
import { NewMessageEvent } from '../adapters';
import { Multipart } from '..';
import { CALL_SUB, PIDF_LO, TEXT_HTML, TEXT_PLAIN, TEXT_URI_LIST } from '../constants/content-types';
import { ULazyValue } from './lazy-value';
import { isValidUri } from '../utils/uri-utils';

export enum Origin {
  /**
   * Remote
   */
  REMOTE = 'remote',
  /**
   * Local
   */
  LOCAL = 'local',
  /**
   * System generated (by JsSIP)
   */
  SYSTEM = 'system',
}

export enum MessageState {
  PENDING = 'pending',
  SUCCESS = 'success',
  ERROR = 'error',
}

export interface Binary {
  // TODO: this should also include the file's name
  mimeType: string,
  value: ArrayBuffer,
}

export interface MessageConfig {
  /**
   * If message is outgoing (LOCAL): An incremental, unique id (parseable as number)\
   * If message is incoming (REMOTE): A unique id\
   * This is because according to the standard both unique numbers or strings are allowed\
   * However, this library ALWAYS uses numbers for outgoing messages
   */
  id: number | string,
  /**
   * Where the message was sent from (LOCAL or REMOTE)
   */
  origin: Origin,
  /**
   * The ETSI TS 103 698 message type
   */
  type: number,
  /**
   * The message's state
   */
  state: MessageState,
  /**
   * Promise that's resolved if the message was received by the other communicating party
   */
  promise: Promise<void>,
  /**
   * The corresponding conversation
   */
  conversation: Conversation,

  /**
   * Date and time when the message was sent/received
   */
  dateTime?: Date,
  /**
   * A multipart object containing all the elements from the SIP body
   */
  multipart?: Multipart;
  /**
   * Raw SIP event
   */
  event?: NewMessageEvent,
  /**
   * A decentralized identifier \
   * For example, this identifier may resolve to credential about personal data
   */
  did?: string,
  /**
   * Additional SIP headers to be sent with the message
   */
  extraHeaders?: Header[];
  /**
   * The caller's vcard at time of sending the message
   */
  location?: PidfLo;
  /**
   * A free to use property for internal identification and matching of messages
   * This is helpful, if you want to use ng112-js as a PSAP and want to tag incoming messages
   */
  tag?: any;
  /**
   * Chat message text
   */
  text?: string;
  /**
   * Chat message html
   */
  html?: string;
  /**
   * A list of URIs
   */
  uris?: string[];
  /**
   * The caller's vcard at time of sending the message
   */
  vcard?: VCard;
  /**
   * A list of binaries (files)
   */
  binaries?: Binary[];
}

export class Message {
  // TODO: Message should have function to resend it (with new message id)
  // "retry" or something

  /**
   * If message is outgoing (LOCAL): An incremental, unique id (parseable as number)\
   * If message is incoming (REMOTE): A unique id\
   * This is because according to the standard both unique numbers or strings are allowed\
   * However, this library ALWAYS uses numbers for outgoing messages
   */
  id: number | string;
  /**
   * An internally generated id that is unique among all messages within ng112-js, even across multiple conversations
   */
  uniqueId: number;
  /**
   * Where the message was sent from (LOCAL or REMOTE)
   */
  origin: Origin;
  /**
   * The ETSI TS 103 698 message type
   */
  type: number;
  /**
   * The message's state
   */
  state: MessageState;
  /**
   * Promise that's resolved if the message was received by the other communicating party
   */
  promise: Promise<void>;
  /**
   * Date and time when the message was sent/received
   */
  dateTime: Date;
  /**
   * The corresponding conversation
   */
  conversation: Conversation;

  /**
   * Additional SIP headers to be sent with the message
   */
  extraHeaders?: Header[];
  /**
   * A free to use property for internal identification and matching of messages
   * This is helpful, if you want to use ng112-js as a PSAP and want to tag incoming messages
   */
  tag?: any;
  /**
   * Raw SIP event
   */
  event?: NewMessageEvent;
  /**
   * A decentralized identifier \
   * For example, this identifier may resolve to credential about personal data
   */
  did?: string;

  private _multipart: Multipart;

  private _text: ULazyValue<string>;
  private _html: ULazyValue<string>;
  private _location: ULazyValue<PidfLo>;
  private _vcard: ULazyValue<VCard>;
  private _uris: ULazyValue<string[]>;
  private _binaries: ULazyValue<Binary[]>;

  constructor({
    id = getRandomString(30),
    origin,
    type,
    state,
    promise,
    conversation,

    dateTime = new Date(),
    multipart = new Multipart(),

    did,
    event,
    extraHeaders,
    location,
    tag,
    text,
    html,
    uris,
    vcard,
    binaries,
  }: MessageConfig) {
    this.uniqueId = nextUniqueId();

    this._text = new ULazyValue<string>(() => this._preparePlainText(TEXT_PLAIN));
    this._html = new ULazyValue<string>(() => this._preparePlainText(TEXT_HTML));

    this._location = new ULazyValue<PidfLo>(this._prepareLocation);
    this._vcard = new ULazyValue<VCard>(this._prepareVCard);
    this._uris = new ULazyValue<string[]>(this._prepareUris);

    // TODO: implement receiving binaries
    this._binaries = new ULazyValue<Binary[]>(() => undefined);

    this.id = id;
    this.origin = origin;
    this.type = type;
    this.state = state;
    this.promise = promise;
    this.conversation = conversation;

    this.dateTime = dateTime;
    this._multipart = multipart;

    this.event = event;
    this.did = did;

    this.extraHeaders = extraHeaders;
    this.location = location;
    this.tag = tag;
    this.text = text;
    this.html = html;
    this.uris = uris;
    this.vcard = vcard;
    this.binaries = binaries;
  }

  private _preparePlainText = (...contentTypes: string[]) => {
    const parts = this._getMultipartParts(...contentTypes);

    if (parts.length === 0)
      return undefined;

    // we just concatenate all plain parts with line breaks
    // this might not be the best solution, but it's for sure the easiest one ;-)
    return parts.map(x => x.body).join('\n')
  }

  private _prepareUris = (): string[] | undefined => {
    const uriParts = this._getMultipartParts(TEXT_URI_LIST);
    let uris: string[] | undefined;

    if (uriParts.length > 0) {
      uris = uriParts.map(u => u.body).reduce((prev, curr) => {
        const allUris = curr.split(CRLF);
        // uris with a leading # are commented and should be ignored
        return prev.concat(allUris.filter(x => x.indexOf('#') !== 0))
      }, [] as string[]);
    }

    return uris;
  }

  private _prepareVCard = (): VCard | undefined => {
    const vcardParts = this._getMultipartParts(CALL_SUB);
    let vcard: VCard | undefined = undefined;

    // TODO: who catches errors here
    for (const vcardPart of vcardParts) {
      const v = VCard.fromXML(vcardPart.body);

      if (!vcard)
        vcard = v;
      else
        vcard.combine(v);
    }

    return vcard;
  }

  private _prepareLocation = (): PidfLo | undefined => {
    let location: PidfLo | undefined = undefined;
    const locationParts = this._getMultipartParts(PIDF_LO);

    if (locationParts.length > 0) {
      for (const locPart of locationParts) {
        const loc = PidfLo.fromXML(locPart.body);

        if (loc && location) {
          // if there are multiple pidfLo parts present, we just combine it to one object
          location.locationTypes = [
            ...location.locationTypes,
            ...loc?.locationTypes,
          ]
        }
        else if (loc)
          location = loc;
      }
    }

    return location;
  }

  private _getMultipartParts = (...contentTypes: string[]) => {
    return this._multipart.getPartsByContentTypes(contentTypes);
  }

  /**
   * Chat message text
   */
  get text(): string | undefined {
    return this._text.get();
  }
  set text(value: string | undefined) {
    this._text.set(value);
  }

  /**
   * Chat message html
   */
  get html(): string | undefined {
    return this._html.get();
  }
  set html(value: string | undefined) {
    this._html.set(value);
  }

  /**
   * A list of URIs
   */
  get uris(): string[] | undefined {
    return this._uris.get();
  }
  set uris(value: string[] | undefined) {
    if (value) {
      // check if all uris are valid
      for (const uri of value) {
        if (!isValidUri(uri))
          throw new Error(`${uri} is not a well formed URI!`);
      }
    }

    this._uris.set(value);
  }

  /**
   * The caller's vcard at time of sending the message
   */
  get vcard(): VCard | undefined {
    return this._vcard.get();
  }
  set vcard(value: VCard | undefined) {
    this._vcard.set(value);
  }

  /**
   * The caller's vcard at time of sending the message
   */
  get location(): PidfLo | undefined {
    return this._location.get();
  }
  set location(value: PidfLo | undefined) {
    this._location.set(value);
  }

  /**
   * A list of binaries (files)
   */
  get binaries(): Binary[] | undefined {
    return this._binaries.get();
  }
  set binaries(value: Binary[] | undefined) {
    this._binaries.set(value);
  }

  /**
   * A multipart object containing all the elements from the SIP body
   */
  get multipart(): Multipart {
    return this._multipart;
  }
}

export interface MessageError {
  /**
   * Origin, who produced this error
   */
  origin: Origin,
  /**
   * Reason why error happened
   * 
   * If SIP "Reason Phrase" is not be available (e.g. in case of networking issues)
   * internally created reasons should be considered instead
   * 
   * @example "Unresolvable destination (478/SL)"
   */
  reason: string,
  /**
   * SIP error code, if available
   * @example 404 (Not Found)
   */
  statusCode?: number,
  /**
   * The raw sip stack object representing the error
   */
  sipStackObject?: any,
}

/**
 * Generates a unique id that's unique across all ng112-js processes
 */
export const nextUniqueId = (() => {
  let _uniqueSequence = 0;
  return () => _uniqueSequence++;
})();

/**
 * Generates a unique id that's unique across all ng112-js processes
 * and includes a 20 character random part in addition
 */
export const nextUniqueRandomId = () => `${getRandomString(20)}_${nextUniqueId()}`;

