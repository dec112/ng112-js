// @ts-expect-error
import findRoot from 'find-root';
import path from 'path';
import fs from 'fs';
import { Multipart, MultipartPart } from '..';
import { CRLF } from './multipart';

const invalidDoc = fs.readFileSync(path.join(findRoot(), 'test', 'res', 'multipart', 'multipart-invalid.txt'), { encoding: 'utf-8' });

describe('Multipart parsing', () => {
  it('should parse strangely built multiparts', () => {
    // look, this boundary is quite weird
    const parsed = Multipart.parse(invalidDoc, 'Content-Type: multipart/mixed;boundary=----------UxCETVhBhhfxiD5G');

    expect(parsed.parts).toHaveLength(4);

    const expectedPars: MultipartPart[] = [
      {
        body: `Some text${CRLF}${CRLF}${CRLF}`,
        headers: [
          { key: 'Content-Type', value: 'text/plain;charset=UTF-8' }
        ]
      },
      {
        body: `--dangerous`,
        headers: [
          { key: 'Content-Type', value: 'text/plain' }
        ]
      },
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
  });
});