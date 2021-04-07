// @ts-expect-error
import findRoot from 'find-root';
import path from 'path';
import fs from 'fs';
import { VCard } from './vcard';

const res = path.join(findRoot(), 'test', 'res', 'vcard');

const getValidVCardObject = () => {
  const xmlVcard = fs.readFileSync(path.join(res, 'valid-vcard.xml'), { encoding: 'utf-8' });
  return VCard.fromXML(xmlVcard);
}

const getValidVCardSmallString = () => {
  return fs.readFileSync(path.join(res, 'valid-vcard_small.xml'), { encoding: 'utf-8' });
}

describe('VCard functionality', () => {
  it('should parse known VCard entries', () => {
    const vcard = getValidVCardObject();

    expect(vcard.firstname).toBe('Alice');
    expect(vcard.street).toBe('Example Street 3');
    expect(vcard.note).toBe('{"some":"additional","data":"to","be":"sent"}');
  });

  it('should parse unknown VCard entries', () => {
    const vcard = getValidVCardObject();

    expect(vcard.get('additionalItem')).toBe('Lorem Ipsum');
  });

  it('should write known VCard entries', () => {
    const vcard = new VCard();

    vcard.addFullName('Alice Smith');
    vcard.addStreet('Example Street 3');

    const vcardXmlString = vcard.toXMLString('asdf');

    // TODO: should be extended by more tests
    expect(vcardXmlString).toMatch(/<asdf:fn>.*<asdf:text>Alice Smith<\/asdf:text>.*<\/asdf:fn>/s);
    expect(vcardXmlString).toMatch(/<asdf:adr>.*<asdf:street>Example Street 3<\/asdf:street>.*<\/asdf:adr>/s);
  });

  it('should write unknown VCard entries', () => {
    const vcard = new VCard();

    vcard.add('test-item', 'Lorem Ipsum');

    const vcardXmlString = vcard.toXMLString('asdf');

    expect(vcardXmlString).toMatch(/<asdf:test-item>.*<asdf:text>Lorem Ipsum<\/asdf:text>.+<\/asdf:test-item>/s);
  });

  it('throws an error for invalid data', () => {
    expect(() => new VCard().toXMLString()).toThrowError();
  });

  it('does not write unnecessary stuff', () => {
    const vcard = new VCard();

    vcard.addFullName('Alice Smith');
    vcard.addStreet('Example Street 3');

    expect(vcard.toXMLString()).toBe(getValidVCardSmallString());
  });
});