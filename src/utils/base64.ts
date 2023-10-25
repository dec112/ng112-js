const encode = (value: string) => {
  if (globalThis.Buffer)
    return Buffer.from(value).toString('base64');
  else
    return btoa(value);
}

export const Base64 = {
  encode,
}