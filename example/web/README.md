# ng112-js-web

This is an example application using the ng112-js library.

NOTICE: Please note that you will have to build `ng112-js` before running the example.

## Run locally

```shell
npm install
npm start
```
Webpack will start a webserver at http://localhost:8082

## Run with docker

```bash
# build docker image
# just in case you don't want to use the image that is publicly available
npm install
npm run docker
```


```bash
# run image with config provided in directory ./public/config
docker run \
--rm \
--name "ng112-js-web" \
--volume "${PWD}/public/config:/usr/share/nginx/html/config" \
-p "3333:80" ghcr.io/dec112/ng112-js-web
```

Please adjust the volume directory accordingly. \
The webserver will run on port `3333`. 

## Usage

1. Click "Register" button. The client will connect to the SIP proxy and try to register. After successful registration, the "Start" button will be enabled.
2. Click "Start" button. This will start the emergency call.
3. Send and receive messages via the message pane at the very bottom of the application.

**Note**: Only geo data can be edited during a call.

**Note**: Changes in connection data and usage data are only reflected after re-registering the client.

## Configuration

(Pre-)configuration can be done through specifying config files in directory `public/config`. \
An example can be found inside the directory. \
Please note the example is not functional, as you'll need a SIP proxy that is up and running under the specified endpoint!

The example configuration `example.config.json` will be loaded by visiting `http://localhost:8082?config=example` in your browser (URL will depend on your local setup and might be different).

```jsonc
{
  // endpoint where client will connect to
  "endpoint": "ws://example.com:8080",
  // domain part for user's SIP URI
  "domain": "example.com",
  // user part for user's SIP URI
  "user": "bob",
  // password for digest authentication
  "password": "mysupersecretpassword",

  // Optional: from URI that should be used by client
  "from": "sip:bob@example.com:5071;transport=tls",

  // Optional: lat/lng for PIDF-LO
  "latitude": 43.6121235527826,
  "longitude": 7.04820156097412,

  // Optioanl: URI that will be called by client
  "call": "sip:112@example.com",
  // Optional: indicate it's a test call
  // -> currently only supported for DEC112 environments
  "isTest": true,
  // Optional: indicate the client is still "active"
  "isActive": true,

  // Optional: VCard information
  // all property names existing in vcard-xml enum `KeyId` can be used
  // this includes most standard VCard properties
  "vcard": {
    "fn": "Alice Smith",
    "tel": "004366412345678",
    "email": "alice.smith@example.com"
  }
}
```