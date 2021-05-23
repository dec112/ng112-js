const modify = require('rollup-plugin-modify');
const envType = process.env.ENV_TYPE;

const crossPlatformPackages = [
  'pidf-lo'
];

const getCrossPlatformModifies = () => crossPlatformPackages.map(package => {
  return modify({
    find: new RegExp(`["']${package}/.+["']\\s*;?\\s*$`, 'gm'),
    replace: `'${package}/dist/${envType}';`,
  })
})

module.exports = {
  rollup(config) {
    // ensures node version and browser version are in two distinct folders
    config.output.file = config.output.file.replace('/dist/', `/dist/${envType || 'all'}/`);

    // removes the esm prefix -> that just makes importing the module more difficult
    config.output.file = config.output.file.replace('.esm', '');

    if (envType)
      config.plugins.push(
        modify({
          find: 'process.envType',
          replace: `'${envType}'`,
        }),
        ...getCrossPlatformModifies(),
      );
    return config;
  },
};