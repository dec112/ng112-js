import { Message } from "./message";

export type CustomSipHeader = string | ((message?: Message) => string);

const resolve = (sipHeader: CustomSipHeader, message?: Message) => typeof sipHeader === 'string' ?
  sipHeader :
  sipHeader(message);

export const CustomSipHeader = {
  resolve,
};