import {
  XMLCompat as PidfXMLCompat,
  CompatImpl,

  getNodeImpl as _getNodeImpl,
  getWebImpl as _getWebImpl,
} from 'pidf-lo';

import {
  XMLCompat as VCardXMLCompat,
} from 'vcard-xml';

export namespace XMLCompat {
  export const initialize = (impl: CompatImpl) => {
    PidfXMLCompat.initialize(impl);
    VCardXMLCompat.initialize(impl);
  }

  export const getNodeImpl = _getNodeImpl;
  export const getWebImpl = _getWebImpl;
}