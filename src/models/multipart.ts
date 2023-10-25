import { MULTIPART_MIXED } from '../constants/content-types';
import { CONTENT_TYPE, MIME_VERSION } from '../constants/headers';
import { getHeaderString, getRandomString, Header, parseHeader } from '../utils';

export interface MultipartPart {
  headers: Header[],
  body: string,
}

interface MultipartObject {
  headers: Header[],
  contentType: string,
  body: string,
}

export const CRLF = '\r\n';

// remove empty entries at beginning and end
const split = (value: string, separator: string | RegExp) => {
  const splits = value.split(separator);

  if (!splits[0])
    splits.splice(0, 1);
  if (!splits[splits.length - 1])
    splits.splice(splits.length - 1, 1);

  return splits;
}

export class Multipart {
  public get parts() { return this._parts }
  private _parts: MultipartPart[] = [];

  add = (part: MultipartPart) => {
    this._parts.push(part);
  }

  addAll = (parts: MultipartPart[]) => {
    this._parts = this._parts.concat(parts);
  }

  create = (): MultipartObject => {
    const boundary = getRandomString(12);

    const headers: Header[] = [
      { key: MIME_VERSION, value: '1.0' }
    ];

    const res: string[] = [];

    for (const part of this._parts) {
      res.push(`--${boundary}`);

      if (part.headers.length > 0) {
        for (const header of part.headers) {
          res.push(getHeaderString(header));
        }
      }
      else
        // if there are no headers, we must include another CRLF
        // as we join all parts in the end, it is sufficient to just push an empty string to the array
        // https://www.w3.org/Protocols/rfc1341/7_2_Multipart.html
        res.push('');

      res.push(`${CRLF}${part.body}`);
    }

    // only if there are other parts available, we'll include a closing delimiter
    // otherwise, DEC112 border will not accept the message
    if (res.length > 0)
      res.push(`--${boundary}--`);

    return {
      // TODO: property headers is currently unused
      // decide to either remove or use it :-)
      headers,
      contentType: `${MULTIPART_MIXED}; boundary=${boundary}`,
      // https://tools.ietf.org/html/rfc5322#section-2.1.1
      // TODO: Don't exceed line length of 998 characters (without CRLF)
      body: res.join(CRLF),
    };
  }

  getPartsByContentTypes = (contentTypes: string[]): MultipartPart[] => {
    return this._parts.filter(x => {
      const ct = x.headers.find(h => h.key === CONTENT_TYPE)

      if (ct)
        // don't use equality here
        // content types can also contain charsets or other things we might not want to consider
        return contentTypes.find(type => ct.value.indexOf(type) !== -1) !== undefined;
      else
        return false;
    });
  }

  removeByContentType = (contentType: string): void => {
    this._parts = this._parts.filter(p =>
      p.headers.findIndex(x =>
        x.key === CONTENT_TYPE &&
        x.value === contentType
      ) === -1
    );
  }

  static parse = (input: string, multipartHeader: string): Multipart => {
    const multipartRegex = new RegExp(`${MULTIPART_MIXED};\\s*boundary=[-]*([^-]+)`).exec(multipartHeader);

    if (!multipartRegex || multipartRegex.length < 2)
      throw new Error('Multipart header malformed.');

    const multi = new Multipart();
    const boundary = multipartRegex[1];

    // ^ -> boundary must be at the beginning of the line
    // m -> multiline -> ensures ^ matches every new line
    const parts = split(input, new RegExp(`^-+${boundary}-*\w*$`, 'm'));

    for (const part of parts) {
      const lines = split(part, CRLF);

      const headers: Header[] = [];
      let body: string = '';
      let isHeaderSection = true;
      for (let i = 0, size = lines.length; i < size; i++) {
        const line = lines[i];

        // https://tools.ietf.org/html/rfc5322#section-2.2.3
        // TODO: Header can also span multiple lines

        // header section is divided by an empty line from body section
        if (isHeaderSection && !line) {
          isHeaderSection = false;
          continue;
        }

        if (isHeaderSection) {
          const header = parseHeader(line);

          // is header?
          if (header) {
            headers.push(header);
          }
        }
        else {
          body = lines.slice(i).join(CRLF);
          break;
        }
      }

      // only consider multiparts with some body in it
      if (body !== '')
        multi.add({
          body,
          headers,
        });
    }

    return multi;
  }
}