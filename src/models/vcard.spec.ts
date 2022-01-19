// @ts-expect-error
import findRoot from 'find-root';
import path from 'path';
import fs from 'fs';
import { Gender, VCard } from './vcard';

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

    expect(vcard.fullName).toBe('Alice Smith MSc.');
    expect(vcard.firstname).toBe('Alice');
    expect(vcard.lastname).toBe('Smith');
    expect(vcard.gender).toBe(Gender.FEMALE);
    expect(vcard.genderIdentity).toBe('girl');
    expect(vcard.street).toBe('Example Street 3');
    expect(vcard.code).toBe('4786');
    expect(vcard.locality).toBe('Humble Village');
    expect(vcard.country).toBe('Austria');
    expect(vcard.telephone).toBe('+4366412345678');
    expect(vcard.email).toBe('alice.smith@dec112.at');
    expect(vcard.birthday).toEqual(new Date(Date.UTC(1990, 5, 11)));
    expect(vcard.note).toBe('{"some":"additional","data":"to","be":"sent"}');
  });

  it('should parse unknown VCard entries', () => {
    const vcard = getValidVCardObject();

    expect(vcard.get('additionalItem')).toBe('Lorem Ipsum');
  });

  it('should write known VCard entries', () => {
    const vcard = new VCard()
      .addFullName('Alice Smith')
      .addFirstname('Alice')
      .addLastname('Smith')
      .addNamePrefix('Dr.')
      .addNameSuffix('MSc.')
      .addBirthday(new Date(Date.UTC(1990, 2, 3)))
      .addGender(Gender.OTHER)
      // TODO: We should also include some tests for invalid VCard data
      // e.g. specifying a gender identity does not make sense (and is not compliant to standards)
      // if genderSex is not specified
      .addGenderIdentity('inter')
      .addTelephone('+436641234567')
      .addEmail('info@dec112.at')
      .addStreet('Example Street 3')
      .addCode('1234')
      .addLocality('Brunnenthal')
      .addRegion('Upper Austria')
      .addCountry('Austria')
      .addNote(JSON.stringify({ a: 'plain', js: 'object' }));

    const vcardXmlString = vcard.toXMLString('asdf');

    expect(vcardXmlString).toMatch(/<asdf:fn>.*<asdf:text>Alice Smith<\/asdf:text>.*<\/asdf:fn>/s);
    expect(vcardXmlString).toMatch(/<asdf:n>.*<asdf:surname>Alice<\/asdf:surname>.*<\/asdf:n>/s);
    expect(vcardXmlString).toMatch(/<asdf:n>.*<asdf:given>Smith<\/asdf:given>.*<\/asdf:n>/s);
    expect(vcardXmlString).toMatch(/<asdf:n>.*<asdf:prefix>Dr\.<\/asdf:prefix>.*<\/asdf:n>/s);
    expect(vcardXmlString).toMatch(/<asdf:n>.*<asdf:suffix>MSc\.<\/asdf:suffix>.*<\/asdf:n>/s);
    expect(vcardXmlString).toMatch(/<asdf:bday>1990-03-03T00:00:00.000Z<\/asdf:bday>/s);
    expect(vcardXmlString).toMatch(/<asdf:gender>.*<asdf:sex>O<\/asdf:sex>.*<\/asdf:gender>/s);
    expect(vcardXmlString).toMatch(/<asdf:gender>.*<asdf:identity>inter<\/asdf:identity>.*<\/asdf:gender>/s);
    expect(vcardXmlString).toMatch(/<asdf:tel>.*<asdf:text>\+436641234567<\/asdf:text>.*<\/asdf:tel>/s);
    expect(vcardXmlString).toMatch(/<asdf:email>.*<asdf:text>info@dec112.at<\/asdf:text>.*<\/asdf:email>/s);
    expect(vcardXmlString).toMatch(/<asdf:adr>.*<asdf:street>Example Street 3<\/asdf:street>.*<\/asdf:adr>/s);
    expect(vcardXmlString).toMatch(/<asdf:adr>.*<asdf:code>1234<\/asdf:code>.*<\/asdf:adr>/s);
    expect(vcardXmlString).toMatch(/<asdf:adr>.*<asdf:locality>Brunnenthal<\/asdf:locality>.*<\/asdf:adr>/s);
    expect(vcardXmlString).toMatch(/<asdf:adr>.*<asdf:region>Upper Austria<\/asdf:region>.*<\/asdf:adr>/s);
    expect(vcardXmlString).toMatch(/<asdf:adr>.*<asdf:country>Austria<\/asdf:country>.*<\/asdf:adr>/s);
    expect(vcardXmlString).toMatch(/<asdf:note>.*<asdf:text>{\"a\":\"plain\",\"js\":\"object\"}<\/asdf:text>.*<\/asdf:note>/s);
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