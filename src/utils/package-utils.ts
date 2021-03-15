const PKG = require('../../package.json');

interface PackageInfo {
  name: string,
  version: string,
  license: string,
}

export const getPackageInfo = (): PackageInfo => PKG;