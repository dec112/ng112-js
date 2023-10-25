import packageJson from '../__package.json';

interface PackageInfo {
  name: string,
  version: string,
  license: string,
}

export const getPackageInfo = (): PackageInfo => ({
  name: packageJson.name,
  version: packageJson.version,
  license: packageJson.license,
});