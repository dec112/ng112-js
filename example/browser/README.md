# ng112-js Example Browser

This is an example application using the ng112-js library.

NOTICE: Please note that you will have to build `ng112-js` before running the example.

## Run Locally

```shell
npm install
npm start
```

Webpack will start a webserver at http://localhost:8082

Configuration can be done through specifying config files in directory `public/config`. \
An example can be found there. \
Please note the example is not functional, as you'll need a SIP proxy that is up and running under the specified endpoint!

The example is loaded by visiting `http://localhost:8082?config=example` in your browser.