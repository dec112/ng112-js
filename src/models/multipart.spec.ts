import findRoot from 'find-root';
import path from 'path';
import fs from 'fs';
import { Multipart, MultipartPart } from '..';
import { CRLF } from './multipart';
import { TEXT_PLAIN } from '../constants/content-types';


describe('Multipart parsing', () => {
  it('should parse strangely built multiparts', () => {
    const invalidDoc = fs.readFileSync(path.join(findRoot(__dirname), 'test', 'res', 'multipart', 'multipart-invalid.txt'), { encoding: 'utf-8' });
    // look, this boundary is quite weird
    const parsed = Multipart.parse(invalidDoc, 'Content-Type: multipart/mixed;boundary=----------UxCETVhBhhfxiD5G');

    expect(parsed.parts).toHaveLength(4);

    const textPart1 = {
      body: `Some text${CRLF}${CRLF}${CRLF}`,
      headers: [
        { key: 'Content-Type', value: 'text/plain;charset=UTF-8' }
      ]
    };

    const textPart2 = {
      body: `--dangerous`,
      headers: [
        { key: 'Content-Type', value: 'text/plain' }
      ]
    };

    const expectedPars: MultipartPart[] = [
      textPart1,
      textPart2,
      {
        body: '<invalidXML>',
        headers: [
          { key: 'Content-Type', value: 'application/pidf+xml' },
          { key: 'Content-ID', value: '<F7nDS11A7H9fK4Df@dec112.app>' },
        ]
      },
      {
        body: `<invalidVCard>`,
        headers: [
          { key: 'Content-Type', value: 'application/addCallSub+xml' }
        ]
      },
    ];

    for (const expected of expectedPars) {
      expect(parsed.parts).toContainEqual(expected);
    }

    // test, whether getPartsByContentTypes considers charset that's specified
    // it should not!
    expect(parsed.getPartsByContentTypes([TEXT_PLAIN])).toEqual([
      textPart1,
      textPart2,
    ]);
  });

  it('should not parse complete garbage', () => {
    const invalidDoc = fs.readFileSync(path.join(findRoot(__dirname), 'test', 'res', 'multipart', 'multipart-garbage.txt'), { encoding: 'utf-8' });
    const parsed = Multipart.parse(invalidDoc, 'Content-Type: multipart/mixed;boundary=UxCETVhBhhfxiD5G');

    expect(parsed.parts).toHaveLength(1);

    const textParts = parsed.getPartsByContentTypes([TEXT_PLAIN]);
    expect(textParts).toHaveLength(0);
  });

  it('should not split at boundaries that are not at the beginning of the line', () => {
    const validDoc = fs.readFileSync(path.join(findRoot(__dirname), 'test', 'res', 'multipart', 'valid-multipart_1.txt'), { encoding: 'utf-8' });
    const parsed = Multipart.parse(validDoc, 'Content-Type: multipart/mixed;boundary=bounds');

    expect(parsed.parts).toHaveLength(1);

    const text = parsed.getPartsByContentTypes([TEXT_PLAIN])[0].body;
    expect(text).toBe(`hello${CRLF} --bounds   ${CRLF}Content-Type: text/plain${CRLF}${CRLF}there`);
  });
});