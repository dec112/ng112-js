const proc = require('child_process');
const fs = require('fs');
const root = require('find-root')();
const path = require('path');

const moveFile = (from, to, filename) => {
  from = from.split('/');
  to = to.split('/');

  if (filename) {
    from.push(filename);
    to.push(filename);
  }

  fs.renameSync(
    path.join(root, ...from),
    path.join(root, ...to),
  )
}

// TODO: Yep, sue me because of this super-ugly build file
// quick and dirty, you know
// actually a double-build (node and browser) could be an interesting feature
// to add to the TSDX framework
// time...

console.log('Building browser version...')

// running browser build
// building automatically removes any existing 'dist' folder
proc.execSync('npm run build:browser');

// copying into temporary folder 
// so it doesn't get overwritten by next build step
moveFile('dist/browser', 'dist-browser');

console.log('Building node version...')

// running node build
// building automatically removes any existing 'dist' folder
proc.execSync('npm run build:node');
// tsdx always creates an entry file in 'dist'
// it distinguishes between development and production
// we just move it to the 'dist/node' folder where it belongs
moveFile('dist', 'dist/node', 'index.js');

// create temporary folder 'n' where we move our built node files
fs.mkdirSync(path.join(root, 'dist', 'n'));

console.log('Creating common types...')

// Ok, now it's going to be weird
// Let me explain...
// Each build (browser and node) contains its own typings
// but this does not make sense, as both typings are exactly the same
// that's why we are disposing one set of typings (node's typings)
// and only use the typings generated along with the browser build
// therefore a lot of weird copying and moving is done here...sorry...

// moving all node files into folder 'dist/n'
// reason: we want to get rid of all typings
moveFile('dist/node', 'dist/n', 'index.cjs.development.js');
moveFile('dist/node', 'dist/n', 'index.cjs.development.js.map');
moveFile('dist/node', 'dist/n', 'index.cjs.production.min.js');
moveFile('dist/node', 'dist/n', 'index.cjs.production.min.js.map');
moveFile('dist/node', 'dist/n', 'index.js');

// finally we delete the folder with all node-typings
fs.rmSync(path.join(root, 'dist', 'node'), { recursive: true });
// now we can move 'dist/n' to 'dist/node' again
moveFile('dist/n', 'dist/node');

// for our browser version, we create a new folder
fs.mkdirSync(path.join(root, 'dist', 'browser'));
// moving the important files into 'dist/browser' folder
moveFile('dist-browser', 'dist/browser', 'index.js');
moveFile('dist-browser', 'dist/browser', 'index.js.map');

// typings remain in the temporary folder
// therefore we move and rename it to 'dist/types'
moveFile('dist-browser', 'dist/types');

// now what's left is copying a template typings file into our subfolders
// that's responsible for linking to folder 'dist/types'
fs.copyFileSync(
  path.join(root, 'templates', 'index.d.ts'),
  path.join(root, 'dist', 'browser', 'index.d.ts'),
);
fs.copyFileSync(
  path.join(root, 'templates', 'index.d.ts'),
  path.join(root, 'dist', 'node', 'index.d.ts'),
);

console.log('Build finished!');