import PidfLoCompat from '../compatibility/pidf-lo';

export const VCARD_XML_NAMESPACE = 'urn:ietf:params:xml:ns:vcard-4.0';

enum KeyId {
  FULL_NAME = 'fn',
  FIRST_NAME = 'surname',
  LAST_NAME = 'given',
  NAME_PREFIX = 'prefix',
  NAME_SUFFIX = 'suffix',
  BIRTHDAY = 'bday',
  GENDER = 'gender',
  ADDRESS_STREET = 'street',
  ADDRESS_LOCALITY = 'locality',
  ADDRESS_REGION = 'region',
  ADDRESS_CODE = 'code',
  ADDRESS_COUNTRY = 'country',
  TELEPHONE = 'tel',
  EMAIL = 'email',
  NOTE = 'note',
}

interface KeyValue {
  key: KeyId,
  value: any,
}

export enum Gender {
  MALE = 'M',
  FEMALE = 'F',
  OTHER = 'O',
  NOT_APPLICABLE = 'N',
  UNKNOWN = 'U'
}

export class VCard {
  private _items: KeyValue[] = [];

  private _push = (key: KeyId, value: any): VCard => {
    this._items.push({
      key,
      value,
    });
    return this;
  }

  combine = (other: VCard) => {
    this._items = [
      ...this._items,
      ...other._items,
    ];
  }

  // this is the generic implementation that can also be used from outside
  // TODO: somehow process items that were added without an already existing KeyId
  // at the moment, they are not put into the XML structure
  add = (key: KeyId, value: any) => this._push(key, value);
  get = (key: KeyId) => this._items.find(x => x.key === key)?.value;

  // add functions

  /**
   * The VCard's `fn` object
   * 
   * @returns VCard for chaining function calls
   */
  addFullName = (value: string) => this.add(KeyId.FULL_NAME, value);
  /**
   * The VCard's `surname` object
   * 
   * @returns VCard for chaining function calls
   */
  addFirstname = (value: string) => this.add(KeyId.FIRST_NAME, value);
  /**
   * The VCard's `given` object
   * 
   * @returns VCard for chaining function calls
   */
  addLastname = (value: string) => this.add(KeyId.LAST_NAME, value);
  /**
   * The VCard's `prefix` object
   * 
   * @returns VCard for chaining function calls
   */
  addNamePrefix = (value: string) => this.add(KeyId.NAME_PREFIX, value);
  /**
   * The VCard's `suffix` object
   * 
   * @returns VCard for chaining function calls
   */
  addNameSuffix = (value: string) => this.add(KeyId.NAME_SUFFIX, value);
  /**
   * The VCard's `bday` object
   * 
   * @returns VCard for chaining function calls
   */
  addBirthday = (value: Date) => this.add(KeyId.BIRTHDAY, value);
  /**
   * The VCard's `gender` object
   * 
   * @returns VCard for chaining function calls
   */
  addGender = (value: Gender) => this.add(KeyId.GENDER, value);
  /**
   * The VCard's `tel` object
   * 
   * @returns VCard for chaining function calls
   */
  addTelephone = (value: string) => this.add(KeyId.TELEPHONE, value);
  /**
   * The VCard's `email` object
   * 
   * @returns VCard for chaining function calls
   */
  addEmail = (value: string) => this.add(KeyId.EMAIL, value);

  /**
   * The VCard's `adr` `street` object
   * e.g. the street address
   * 
   * @returns VCard for chaining function calls
   */
  addStreet = (value: string) => this.add(KeyId.ADDRESS_STREET, value);
  /**
   * The VCard's `adr` `locality` object
   * e.g. city
   * 
   * @returns VCard for chaining function calls
   */
  addLocality = (value: string) => this.add(KeyId.ADDRESS_LOCALITY, value);
  /**
   * The VCard's `adr` `region` object
   * e.g. state or province
   * 
   * @returns VCard for chaining function calls
   */
  addRegion = (value: string) => this.add(KeyId.ADDRESS_REGION, value);
  /**
   * The VCard's `adr` `code` object
   * e.g. the postal code
   * 
   * @returns VCard for chaining function calls
   */
  addCode = (value: string) => this.add(KeyId.ADDRESS_CODE, value);
  /**
   * The VCard's `adr` `country` object
   * e.g. the country name
   * 
   * @returns VCard for chaining function calls
   */
  addCountry = (value: string) => this.add(KeyId.ADDRESS_COUNTRY, value);

  /**
   * The VCard's `note` object
   * e.g. any arbitrary additional information
   * Can also be a JSON or XML encoded string for passing structured data
   * 
   * @returns VCard for chaining function calls
   */
  addNote = (value: string) => this.add(KeyId.NOTE, value);

  // get functions
  get fullName(): string | undefined { return this.get(KeyId.FULL_NAME); }
  get firstname(): string | undefined { return this.get(KeyId.FIRST_NAME); }
  get lastname(): string | undefined { return this.get(KeyId.LAST_NAME); }
  get namePrefix(): string | undefined { return this.get(KeyId.NAME_PREFIX); }
  get nameSuffix(): string | undefined { return this.get(KeyId.NAME_SUFFIX); }
  get birthday(): Date | undefined { return this.get(KeyId.BIRTHDAY); }
  get gender(): Gender | undefined { return this.get(KeyId.GENDER); }
  get telephone(): string | undefined { return this.get(KeyId.TELEPHONE); }
  get email(): string | undefined { return this.get(KeyId.EMAIL); }

  get street(): string | undefined { return this.get(KeyId.ADDRESS_STREET); }
  get locality(): string | undefined { return this.get(KeyId.ADDRESS_LOCALITY); }
  get region(): string | undefined { return this.get(KeyId.ADDRESS_REGION); }
  get code(): string | undefined { return this.get(KeyId.ADDRESS_CODE); }
  get country(): string | undefined { return this.get(KeyId.ADDRESS_COUNTRY); }

  get note(): string | undefined { return this.get(KeyId.NOTE); }

  toXML = (namespacePrefix?: string): XMLDocument => {
    const doc = PidfLoCompat.XMLCompat.createDocument();
    const rootNode = writeXmlElement(xmlVCard, doc, this, namespacePrefix);

    if (!rootNode)
      throw new Error('Could not create VCard root node. Did you provide any data?');

    doc.appendChild(rootNode);
    return doc;
  }

  static fromXML = (xml: string): VCard => {
    const doc = PidfLoCompat.XMLCompat.getDocumentFromString(xml);
    const vcard = new VCard();

    const namespacePrefixResult = new RegExp(`xmlns:(\\w+)="${VCARD_XML_NAMESPACE.replace('.', '\\.')}"`).exec(xml);
    let namespacePrefix: string | undefined = undefined;
    if (namespacePrefixResult && namespacePrefixResult.length > 1)
      namespacePrefix = namespacePrefixResult[1];

    parseXmlElement(xmlVCard, doc.documentElement, vcard, namespacePrefix);

    return vcard;
  }

  equals = (vCard: VCard): boolean => {
    try {
      return PidfLoCompat.XMLCompat.toXMLString(this.toXML()) === PidfLoCompat.XMLCompat.toXMLString(vCard.toXML());
    } catch {
      return false;
    }
  }
}

const stringParser = (value: string | undefined): string | undefined => value;
const stringWriter = (value: string) => value;

const writeXmlElement = (
  node: XMLNode,
  doc: Document,
  vcard: VCard,
  namespace?: string,
): Element | undefined => {
  const el = doc.createElement(`${namespace ? `${namespace}:` : ''}${node.nodeName}`);

  if (node.writer) {
    const value = vcard.get(node.keyId ?? (node.nodeName as KeyId));

    if (value !== undefined) {
      el.textContent = node.writer(value);

      return el;
    }
  }

  if (node.leafs) {
    for (const leaf of node.leafs) {
      const node = writeXmlElement(leaf, doc, vcard, namespace);
      if (node)
        el.appendChild(node);
    }

    // use childNodes instead of children as childNodes is the DOM level2 compatible implementation
    if (el.childNodes.length > 0)
      return el;
  }

  return undefined;
}

const parseXmlElement = (
  node: XMLNode,
  parentElement: Element,
  vcard: VCard,
  namespacePrefix?: string,
) => {
  const pref = namespacePrefix ? `${namespacePrefix}:` : '';
  const foundElement = parentElement.getElementsByTagName(`${pref}${node.nodeName}`)[0];

  if (!foundElement)
    return;

  if (node.parser) {
    const rawString = foundElement.textContent;
    const keyId: KeyId = node.keyId ?? node.nodeName as KeyId;
    const value = node.parser(rawString === null ? undefined : rawString);

    vcard.add(keyId, value);
  }

  if (node.leafs) {
    for (const leaf of node.leafs) {
      parseXmlElement(leaf, foundElement, vcard, namespacePrefix);
    }
  }
}

interface XMLNode {
  nodeName: string;
  keyId?: KeyId;
  parser?: (value: string | undefined) => any;
  writer?: (value: any) => string;
  leafs?: XMLNode[];
}

const xmlVCard: XMLNode = {
  nodeName: 'vcard',
  leafs: [
    {
      nodeName: 'adr',
      leafs: [
        {
          nodeName: KeyId.ADDRESS_CODE,
          parser: stringParser,
          writer: stringWriter,
        },
        {
          nodeName: KeyId.ADDRESS_COUNTRY,
          parser: stringParser,
          writer: stringWriter,
        },
        {
          nodeName: KeyId.ADDRESS_LOCALITY,
          parser: stringParser,
          writer: stringWriter,
        },
        {
          nodeName: KeyId.ADDRESS_REGION,
          parser: stringParser,
          writer: stringWriter,
        },
        {
          nodeName: KeyId.ADDRESS_STREET,
          parser: stringParser,
          writer: stringWriter,
        },
      ],
    },
    {
      nodeName: 'n',
      leafs: [
        {
          nodeName: KeyId.NAME_PREFIX,
          parser: stringParser,
          writer: stringWriter,
        },
        {
          nodeName: KeyId.NAME_SUFFIX,
          parser: stringParser,
          writer: stringWriter,
        },
        {
          nodeName: KeyId.LAST_NAME,
          parser: stringParser,
          writer: stringWriter,
        },
        {
          nodeName: KeyId.FIRST_NAME,
          parser: stringParser,
          writer: stringWriter,
        },
      ]
    },
    {
      nodeName: KeyId.FULL_NAME,
      leafs: [
        {
          nodeName: 'text',
          keyId: KeyId.FULL_NAME,
          parser: stringParser,
          writer: stringWriter,
        }
      ]
    },
    {
      nodeName: KeyId.TELEPHONE,
      leafs: [
        {
          nodeName: 'text',
          keyId: KeyId.TELEPHONE,
          parser: stringParser,
          writer: stringWriter,
        }
      ]
    },
    {
      nodeName: KeyId.EMAIL,
      leafs: [
        {
          nodeName: 'text',
          keyId: KeyId.EMAIL,
          parser: stringParser,
          writer: stringWriter,
        }
      ]
    },
    {
      nodeName: KeyId.GENDER,
      leafs: [
        {
          nodeName: 'sex',
          keyId: KeyId.GENDER,
          parser: (value) => value as Gender,
          writer: (value: Gender) => value,
        }
      ]
    },
    {
      nodeName: KeyId.BIRTHDAY,
      parser: (value) => value ? new Date(value) : value,
      writer: (value: Date) => value.toISOString(),
    },
    {
      nodeName: KeyId.NOTE,
      leafs: [
        {
          nodeName: 'text',
          keyId: KeyId.NOTE,
          parser: stringParser,
          writer: stringWriter,
        },
      ],
    },
  ]
}