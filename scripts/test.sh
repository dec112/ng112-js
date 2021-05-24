cd test/env
docker-compose up -d
cd ../..

# linking to itself is necessary for valid tests
npm link ng112-js

npm run build

npm run test:tsdx

cd test/env
docker-compose down
cd ../..