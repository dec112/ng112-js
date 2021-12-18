import { PidfLo } from "pidf-lo";
import { CONTENT_TYPE, Message, Multipart, VCard } from "..";
import { CALL_SUB, MULTIPART_MIXED, PIDF_LO, TEXT_PLAIN, TEXT_URI_LIST } from "../constants/content-types";
import { CRLF } from "../models/multipart";

const tryParsePidfLo = (value: string): PidfLo | undefined => PidfLo.fromXML(value);
const parseMultipartParts = (multipart: Multipart): Partial<Message> => {
  // TODO: Find a way to parse binaries
  // or decide that this will be covered by "extraParts"

  const message: Partial<Message> = {};

  const textParts = multipart.popPartsByContentType(TEXT_PLAIN);
  if (textParts.length > 0) {
    // we just concatenate all plain parts with line breaks
    // this might not be the best solution, but it's for sure the easiest one ;-)
    message.text = textParts.map(x => x.body).join('\n');
  }

  const locationParts = multipart.popPartsByContentType(PIDF_LO);
  if (locationParts.length > 0) {
    for (const locPart of locationParts) {
      const loc = tryParsePidfLo(locPart.body);

      if (loc && message.location) {
        // if there are multiple pidfLo parts present, we just combine it to one object
        message.location.locationTypes = [
          ...message.location.locationTypes,
          ...loc?.locationTypes,
        ]
      }
      else if (loc)
        message.location = loc;
    }
  }

  const vcardParts = multipart.popPartsByContentType(CALL_SUB);
  if (vcardParts.length > 0) {
    const vcard = VCard.fromXML(vcardParts[0].body);

    if (message.vcard)
      vcard.combine(message.vcard);

    message.vcard = vcard;
  }

  const uriParts = multipart.popPartsByContentType(TEXT_URI_LIST);
  if (uriParts.length > 0) {
    message.uris = uriParts.map(u => u.body).reduce((prev, curr) => {
      const allUris = curr.split(CRLF);
      // uris with a leading # are commented and should be ignored
      return prev.concat(allUris.filter(x => x.indexOf('#') !== 0))
    }, [] as string[]);
  }

  // This always has to be the last call!
  // We take care of all leftover parts!
  message.extraParts = multipart.parts.length > 0 ? multipart.parts : undefined;

  return message;
}

export const parseMessage = (message: Partial<Message>, body?: string, contentType: string = TEXT_PLAIN): Partial<Message> => {
  if (body) {
    let multipart: Multipart;

    // no multipart header?
    if (contentType.indexOf(MULTIPART_MIXED) === -1) {
      // if content type is not multipart we create a multipart object
      // it just simplifies the whole workflow of parsing the message body
      multipart = new Multipart();
      multipart.add({
        headers: [{ key: CONTENT_TYPE, value: contentType }],
        body,
      });
    }
    else {
      multipart = Multipart.parse(body, contentType);
    }

    message = {
      ...message,
      // Attention: parseMultipartParts is not a pure function!
      // it alters the multipart object!
      ...parseMultipartParts(multipart),
    }
  }

  return message;
}
