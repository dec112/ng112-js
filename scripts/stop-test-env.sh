# shut down docker environment
echo "docker-compose down"
(cd test/env && docker-compose down)