import { isBrowser } from "../compatibility"

const encode = (value: string) => {
  if (isBrowser)
    return btoa(value);
  else
    return Buffer.from(value).toString('base64');
}

export const Base64 = {
  encode,
}