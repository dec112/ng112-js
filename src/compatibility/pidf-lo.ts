import { isBrowser } from ".";
import type pidflo from 'pidf-lo';

const mod: typeof pidflo =
  isBrowser ?
    require('pidf-lo/dist/browser') :
    require('pidf-lo/dist/node');

export default mod;