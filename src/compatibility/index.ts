import {
  XMLCompat as PidfXMLCompat,
  CompatImpl,

  getNodeImpl as _getNodeImpl,
  getWebImpl as _getWebImpl,
} from 'pidf-lo';

import {
  XMLCompat as VCardXMLCompat,
} from 'vcard-xml';

// process.envType is set by our js-bundler rollup
// this way we can produce two separate bundles
// one for node.js, one for use in browsers
export const isBrowser = process.envType === 'browser';

export namespace XMLCompat {
  export const initialize = (impl: CompatImpl) => {
    PidfXMLCompat.initialize(impl);
    VCardXMLCompat.initialize(impl);
  }

  export const getNodeImpl = _getNodeImpl;
  export const getWebImpl = _getWebImpl;
}