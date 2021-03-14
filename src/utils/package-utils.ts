const PKG = require('../../package.json');
const PKG_LOCK = require('../../package-lock.json');

interface DependencyInfo {
  name: string,
  version: string,
}

export const getDependencyInfo = (name: string): DependencyInfo | undefined => {
  const dep = PKG_LOCK.dependencies[name] as (DependencyInfo | undefined);

  if (!dep)
    return undefined;

  dep.name = name; PKG_LOCK

  return dep;
}

interface PackageInfo {
  name: string,
  version: string,
  license: string,
}

export const getPackageInfo = (): PackageInfo => PKG;