import { XMLCompat } from 'pidf-lo/dist/node';

export const VCARD_XML_NAMESPACE = 'urn:ietf:params:xml:ns:vcard-4.0';
const vcardRootNodeName = 'vcard';

export enum KeyId {
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
  key: KeyId | string,
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
  public get items() { return this._items; }
  private _items: KeyValue[] = [];

  private _push = (key: KeyId | string, value: any): VCard => {
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

  /**
   * A generic function for adding additional VCard elements
   * 
   * @param key The VCard's value identifier
   * @param value The value itself
   * @returns VCard for chaining function calls
   */
  add = (key: KeyId | string, value: any): VCard => this._push(key, value);

  /**
   * A generic function for retrieving a VCard element's value
   * 
   * @param key The VCard value's key
   * @returns The VCard element's value, or undefined, if not found
   */
  get = (key: KeyId | string): any | undefined => this._items.find(x => x.key === key)?.value;

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
    const doc = XMLCompat.createDocument();
    // we clone the array because we remove all items that have already been processed by `writeXmlElement`
    // This helps us finding unknown items so we can process them separately
    const clonedItems = Array.from(this._items);

    const rootNode = createPrefixedElement(doc, vcardRootNodeName, namespacePrefix);

    for (const node of vcardNodes) {
      const el = writeXmlElement(node, doc, clonedItems, namespacePrefix);

      if (el)
        rootNode.appendChild(el);
    }

    // here we take care of all unknown items that were added via the general `add` function
    // the xml structure we assume for them is `<unknown-item><text>%content%</text></unknown-item>
    for (const item of clonedItems) {
      const parent = createPrefixedElement(doc, item.key, namespacePrefix);
      const child = createPrefixedElement(doc, 'text', namespacePrefix);
      child.textContent = item.value;

      parent.appendChild(child);
      rootNode.appendChild(parent);
    }

    if (rootNode.childNodes.length === 0)
      throw new Error('Could not create VCard root node. Did you provide any data?');

    doc.appendChild(rootNode);
    return doc;
  }

  toXMLString = (namespacePrefix?: string): string => {
    return XMLCompat.toXMLString(this.toXML(namespacePrefix));
  }

  static fromXML = (xml: string): VCard => {
    const doc = XMLCompat.getDocumentFromString(xml);
    const docElement = doc.documentElement;
    const vcard = new VCard();

    const namespacePrefixResult = new RegExp(`xmlns:(\\w+)="${VCARD_XML_NAMESPACE.replace('.', '\\.')}"`).exec(xml);
    let namespacePrefix: string | undefined = undefined;
    if (namespacePrefixResult && namespacePrefixResult.length > 1)
      namespacePrefix = namespacePrefixResult[1];

    // if docElement is already our desired vcard root node, we just take it
    // if not, we have to search for it in descendants of docElement
    const vcardRootNode = docElement.nodeName === getNodeName(vcardRootNodeName, namespacePrefix) ?
      docElement :
      getPrefixedElements(
        docElement,
        vcardRootNodeName,
        namespacePrefix
      )[0];

    if (vcardRootNode) {
      for (const node of vcardNodes) {
        parseXmlElement(node, vcardRootNode, vcard, namespacePrefix);
      }
    }

    // now we parse VCard items that are unknown
    for (const element of getPrefixedElements(
      docElement,
      'text',
      namespacePrefix
    )) {
      const parent = element.parentNode;

      if (!parent)
        continue;

      // TypeScript does not have "localName" in its types even though it is specified in DOM level2
      // https://github.com/xmldom/xmldom#dom-level2-method-and-attribute
      // @ts-expect-error
      vcard.add(parent.localName, element.textContent);
      parent.parentNode?.removeChild(parent);
    }

    return vcard;
  }

  equals = (vCard: VCard): boolean => {
    try {
      return XMLCompat.toXMLString(this.toXML()) === XMLCompat.toXMLString(vCard.toXML());
    } catch {
      return false;
    }
  }
}

const stringParser = (value: string | undefined): string | undefined => value;
const stringWriter = (value: string) => value;

const getNodeName = (tagName: string, namespace?: string) => `${namespace ? `${namespace}:` : ''}${tagName}`;
const createPrefixedElement = (document: Document, tagName: string, namespace?: string) => {
  return document.createElement(getNodeName(tagName, namespace));
}

const writeXmlElement = (
  node: XMLNode,
  doc: Document,
  vcardItems: KeyValue[],
  namespace?: string,
): Element | undefined => {
  const el = createPrefixedElement(doc, node.nodeName, namespace);

  if (!node.leafs) {
    const index = vcardItems.findIndex((x) => x.key === node.keyId || x.key === node.nodeName);

    if (index > -1) {
      const value = vcardItems[index].value;
      vcardItems.splice(index, 1);

      if (value !== undefined)
        el.textContent = (node.writer ?? stringWriter)(value);

      return el;
    }
  } else {
    for (const leaf of node.leafs) {
      const node = writeXmlElement(leaf, doc, vcardItems, namespace);
      if (node)
        el.appendChild(node);
    }

    // use childNodes instead of children as childNodes is the DOM level2 compatible implementation
    if (el.childNodes.length > 0)
      return el;
  }

  return undefined;
}

const getPrefixedElements = (
  parentElement: Element,
  tagName: string,
  namespacePrefix?: string,
  requireDirectChild: boolean = false
) => {
  const arr = Array.from(parentElement.getElementsByTagName(getNodeName(tagName, namespacePrefix)));

  // requireDirectChild requires children to be direct anchestors of the parent
  if (requireDirectChild)
    return arr.filter(x => x.parentNode === parentElement);
  else
    return arr;
}

const parseXmlElement = (
  node: XMLNode,
  parentElement: Element,
  vcard: VCard,
  namespacePrefix?: string,
) => {
  const foundElement = getPrefixedElements(
    parentElement,
    node.nodeName,
    namespacePrefix,
    true
  )[0];

  if (!foundElement)
    return;

  if (!node.leafs) {
    const rawString = foundElement.textContent;
    const keyId: KeyId = node.keyId ?? node.nodeName as KeyId;
    const value = (node.parser ?? stringParser)(rawString === null ? undefined : rawString);

    vcard.add(keyId, value);

    // we remove all processed items so only unprocessed remain left
    // all unprocessed (unknown) items are processed separately
    foundElement.parentNode?.removeChild(foundElement);
  } else {
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

// TODO: switch this implementation to something with XPath
const vcardNodes: XMLNode[] = [
  {
    nodeName: 'adr',
    leafs: [
      { nodeName: KeyId.ADDRESS_CODE, },
      { nodeName: KeyId.ADDRESS_COUNTRY, },
      { nodeName: KeyId.ADDRESS_LOCALITY, },
      { nodeName: KeyId.ADDRESS_REGION, },
      { nodeName: KeyId.ADDRESS_STREET, },
    ],
  },
  {
    nodeName: 'n',
    leafs: [
      { nodeName: KeyId.NAME_PREFIX, },
      { nodeName: KeyId.NAME_SUFFIX, },
      { nodeName: KeyId.LAST_NAME, },
      { nodeName: KeyId.FIRST_NAME, },
    ]
  },
  {
    nodeName: KeyId.FULL_NAME,
    leafs: [
      {
        nodeName: 'text',
        keyId: KeyId.FULL_NAME,
      }
    ]
  },
  {
    nodeName: KeyId.TELEPHONE,
    leafs: [
      {
        nodeName: 'text',
        keyId: KeyId.TELEPHONE,
      }
    ]
  },
  {
    nodeName: KeyId.EMAIL,
    leafs: [
      {
        nodeName: 'text',
        keyId: KeyId.EMAIL,
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
      },
    ],
  },
];