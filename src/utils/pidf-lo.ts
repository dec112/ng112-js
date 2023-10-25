import { PidfLo, SimpleLocation } from "pidf-lo";

export const getPidfLo = (originSipUri: string, location?: PidfLo | SimpleLocation): PidfLo | undefined => {
  if (!location)
    return;


  if (!(location instanceof PidfLo)) {
    return PidfLo.fromSimpleLocation(location, originSipUri);
  }
  else
    return location;
}