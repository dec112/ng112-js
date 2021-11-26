# linking to itself is necessary for valid tests
echo "Linking ng112-js"
npm link ng112-js

# build SDK
echo "Running ng112-js build"
npm run build

# Build test PSAP
echo "Building ng112-js-psap docker image"
(cd example/node && npm run docker)

# Spin up environment
echo "docker-compose up"
(cd test/env && docker-compose up -d)

# wait some time for the docker environment to spin up
echo "Waiting 15 seconds for docker containers to run..."
sleep 5
echo "Waiting 10 seconds for docker containers to run..."
sleep 5
echo "Waiting 5 seconds for docker containers to run..."
sleep 5

# start tests
echo "Running tests"
npm run test:tsdx

# shut down docker environment
echo "docker-compose down"
(cd test/env && docker-compose down)