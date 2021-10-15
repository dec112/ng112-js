#!/bin/bash

echo "Removing folder temp"
rm -r temp/dist

echo "Creating folder temp"
mkdir temp

# fetch ng112-js files locally
# docker does not resolve symlinks
# and as ng112-js is symlinked to ng112-js-psap
# ng112-js can not be copied to the image otherwise
# than fetching it locally beforehand
echo "Copy build files from ng112-js"
cp -r ../../dist temp/dist
echo "Copy npm files from ng112-js"
cp ../../package.json temp/package.json
cp ../../package-lock.json temp/package-lock.json


# install only production dependencies
echo "Install ng112-js dependencies"
(cd temp && npm i --only=prod)

echo "Building local sources"
npm run build

echo "Building docker image"
docker build -t dec112/ng112-js-psap .