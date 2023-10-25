export interface NameAddrHeader {
  /**
   * Display name
   */
  displayName?: string,
  /**
   * The raw URI, without display name
   */
  uri: string,
}
export interface Header {
  key: string,
  value: string,
}

export function getHeaderString(header: Header): string;
export function getHeaderString(key: string, value: string): string;
export function getHeaderString(value1: Header | string, value2?: string): string {
  let key: string;
  let value: string;

  if (typeof value1 === 'string' && value2) {
    key = value1;
    value = value2;
  }
  else if (typeof value1 === 'object') {
    key = value1.key;
    value = value1.value;
  }
  else
    throw new Error('Not implemented');

  return `${key}: ${value}`;
}

export const parseHeader = (header: string): Header | undefined => {
  const parsed = /^([\w\d-]+)\s*:\s*(.*)$/.exec(header);

  if (!parsed || parsed.length < 3)
    return;

  return {
    key: parsed[1],
    value: parsed[2],
  };
}

export const parseNameAddrHeaderValue = (value: string): NameAddrHeader | undefined => {
  const parsed = /([^<]*)<([\w\d:@\.;=\-\/#]+)>/.exec(value);

  if (!parsed || parsed.length === 1)
    return;

  if (parsed.length === 3 )
    return {
      displayName: parsed[1].trim() ? parsed[1].trim() : undefined,
      uri: parsed[2],
    };

  return {
    uri: parsed[1],
  };
}