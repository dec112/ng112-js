# Spin up environment
# At this stage the PSAP has not yet been built
# However, kamailio needs some time to spin up
# therefore it's good to already spin it up
echo "docker-compose up"
(cd test/env && docker-compose up -d kamailio)

# linking to itself is necessary for valid tests
echo "Linking ng112-js"
# enable linking
npm link
# link to itself
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
echo "Waiting 5 seconds for docker containers to run..."
sleep 5