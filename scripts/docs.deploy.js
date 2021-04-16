const proc = require('child_process');
const findRoot = require('find-root');
const path = require('path');

const packageJson = require(path.join(findRoot(), 'package.json'));
const version = packageJson.version;

// loads private publishing config from private/docs.config.json
const docsConfig = require(path.join(findRoot(), 'private', 'docs.config.json'));

const host = docsConfig.host;

const localDir = path.join(findRoot(), 'docs');
const saveDir = path.join(docsConfig.serverDir, version);

// building the documentation
proc.execSync('npm run docs');

try {
  // creating the directory where the new version will be placed in
  // it only creates the version-folder, we intentionally do not create all parent folders
  proc.execSync(`ssh ${host} 'mkdir ${saveDir}'`);
}
catch {
  console.info(`Version ${version} already exists. Overwriting existing files.`);
}

// whitespaces must be escaped in paths, otherwise linux considers following strings as the next parameter
proc.execSync(
  `rsync -va ${path.join(localDir, '*').replace(/\s/g, '\\ ')} ${host}:${saveDir}`,
  { stdio: 'inherit' }
);