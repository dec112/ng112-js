echo 'Clearing dist folder...'
rm -r dist

echo 'Copying static files...'
cp -R public dist
echo 'Removing all config files...'
rm dist/config/*

echo 'Bundling javascript...'
./node_modules/.bin/webpack-cli