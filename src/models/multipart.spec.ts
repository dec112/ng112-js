// @ts-expect-error
import findRoot from 'find-root';
import path from 'path';
import fs from 'fs';
import { Multipart, MultipartPart } from '..';
import { CRLF } from './multipart';
import { TEXT_PLAIN } from '../constants/content-types';


describe('Multipart parsing', () => {
  it('should parse strangely built multiparts', () => {
    const invalidDoc = fs.readFileSync(path.join(findRoot(), 'test', 'res', 'multipart', 'multipart-invalid.txt'), { encoding: 'utf-8' });
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

    // test, whether popPartsByContentType considers charset that's specified
    // it should not!
    expect(parsed.popPartsByContentType(TEXT_PLAIN)).toEqual([
      textPart1,
      textPart2,
    ]);
  });

  it('should not parse complete garbage', () => {
    const invalidDoc = fs.readFileSync(path.join(findRoot(), 'test', 'res', 'multipart', 'multipart-garbage.txt'), { encoding: 'utf-8' });
    // look, this boundary is quite weird
    const parsed = Multipart.parse(invalidDoc, 'Content-Type: multipart/mixed;boundary=UxCETVhBhhfxiD5G');

    expect(parsed.parts).toHaveLength(1);
    
    const textParts = parsed.popPartsByContentType(TEXT_PLAIN);
    expect(textParts).toHaveLength(0);
  });
});