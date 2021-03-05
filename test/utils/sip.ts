interface SipDialogueCacheItem {
  placeholder: string;
  currentValue?: string;
  getRegex: () => RegExp;
}

const cacheItems: SipDialogueCacheItem[] = [
  { placeholder: '{{VIA}}', getRegex: () => /(Via:.+)/, },
  { placeholder: '{{FROM_TAG}}', getRegex: () => /From:.+;(tag=.+)/, },
  { placeholder: '{{CALL_ID}', getRegex: () => /(Call-ID:.+)/, },
  { placeholder: '{{CONTACT_SIP}}', getRegex: () => /Contact: <(sip:.+;transport=ws)>/, },
  { placeholder: '{{SIP_INSTANCE}}', getRegex: () => /(\+sip.instance.+>");/, },
  { placeholder: '{{CSEQ}}', getRegex: () => /(CSeq:.+)/, },
  { placeholder: '{{MESSAGE_ID}}', getRegex: () => /Call-Info: <urn:emergency:uid:callid:(.+):.+>/, },
]

export const cacheValues = (value: string) => {
  for (const item of cacheItems) {
    const match = item.getRegex().exec(value);

    if (match && match.length > 0)
      item.currentValue = match[1];
  }
}

export const fillValues = (value: string) => {
  for (const item of cacheItems) {
    if (item.currentValue)
      value = value.replace(item.placeholder, item.currentValue);
  }

  return value;
}