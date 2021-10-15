FROM node:16 as builder

WORKDIR /app

COPY ["package.json", "package-lock.json*", "./"]
# we must include node_modules as installing will fail
# ng112-js is directly linked from the parent directories
# therefore the installation process would fail here
# This is not optimal, but at least for now the only
# reasonable way to get those node_modules into the image
COPY ./node_modules ./node_modules

# Removing the ng112-js folder as this essentially only is a symlink
# that will otherwise be broken within the image
RUN rm ./node_modules/ng112-js
# Copying the locally built ng112-js files into the image
# to make up with the missing files
COPY ./temp ./node_modules/ng112-js

COPY ./dist ./dist

####################################

FROM node:16

WORKDIR /app
COPY --from=builder /app /app

ENV NODE_ENV=production
ENTRYPOINT ["node", "dist/index.js"]