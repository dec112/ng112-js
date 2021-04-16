# ng112-js - Next Generation Emergency Services

This javascript library should help integrating browser and node environments with existing NG112 or DEC112 infrastructure and covers standards [ETSI TS 103 479](https://www.etsi.org/deliver/etsi_ts/103400_103499/103479/01.01.01_60/ts_103479v010101p.pdf) and [ETSI TS 103 698](https://www.etsi.org/deliver/etsi_ts/103600_103699/103698/01.01.01_60/ts_103698v010101p.pdf), as well as DEC112 specific additions for text based emergency messages/calls.

It handles SIP communication, message types, heartbeats, PIDF-LO, VCards, Multipart MIME and should finally provide a comprehensive implementation of the aformentioned ETSI standards.

Please keep in mind this is still in development and does not cover standards entirely!

SIP communication is powered by [JsSIP](https://jssip.net/) under the hood. \
Currently JsSIP version 3.5.11 is used. This is due to an incompatibility of JsSIP 3.7.3 with Expo.

License: GNU AGPL-3.0 \
Proprietary licenses are available on request. \
Maintainer: Gabriel Unterholzer (gabriel.unterholzer@dec112.at)

## Installation

```shell
npm install ng112-js
```

### Browser Environments

```javascript
import * from 'ng112-js/dist/browser';
```

### Node Environments

```javascript
import * from 'ng112-js/dist/node';
```

In addition, node environments will also need to install `jssip-node-websocket`, which is a peer dependency of `ng112-js`

```bash
npm install jssip-node-websocket
```

## Examples

Most complete examples can be found in both browser and node example projects in `./example/browser` and `./example/node`

### Use as a calling device (e.g. in a smartphone app)

```javascript
import { 
  Agent,
  LocationMethod,
  VCard,
} from 'ng112-js/dist/browser';

// define connection to SIP proxy (originating ESRP)
const agent = new Agent({
  endpoint: 'wss://example.com',
  domain: 'example.com',
  user: 'user1234',
  password: 'supersecretpassword',
  // ETSI TS 103 698: optional
  // DEC112: required. Must be set with a verified telephone number, due to legal requirements
  displayName: '004366412345678',
});

// set the agent's vcard
// this function can be called anytime and will be reflected by any conversation sent through this agent
agent.updateVCard(new VCard()
  .addFullName('Default Person')
  .addBirthday(new Date(1990, 1, 1))
  .addGender(Gender.OTHER)
  .addStreet('Example street 13')
  .addTelephone('0123456789')
  .addEmail('default.person@example.com')
);

// set the agent's location
// this function can be called anytime and will be reflected by any conversation sent through this agent
agent.updateLocation({
  latitude: 48.1799778,
  longitude: 16.341437,
  radius: 15,
  method: LocationMethod.GPS,
});

// initializes the agent (sends initial SIP REGISTER)
await agent.initialize();

// start a new emergency conversation ("call")
const conversation = agent.createConversation('sip:emergency@example.com');

// register a callback for *both* incoming and outgoing messages
conversation.addMessageListener((msg) => {
  // print message metadata
  console.log(`${msg.origin} (${msg.type}): ${msg.text}`);
});

// initiate the emergency conversation
// sends the initial START message to the ESRP
const startMsg = conversation.start();

// `await`ing the promise ensures the message was successfully forwarded by the SIP proxy
await startMsg.promise;

const chatMsg = conversation.sendMessage({
  text: 'My kitchen is burning!',
});
await chatMsg.promise;

// stop the emergency conversation
// sends the STOP message to the ESRP
const stopMsg = conversation.stop();
await stopMsg.promise;

// dispose the agent
await agent.dispose();

```

### Use as a PSAP (e.g. in a node application)

```javascript
import { 
  Agent,
  ConversationState,
} from 'ng112-js/dist/node';

// define connection to SIP proxy (terminating ESRP)
const agent = new Agent({
  endpoint: 'wss://example.com',
  domain: 'example.com',
  user: 'psap1',
  password: 'supersecretpassword',
});

// initializes the agent (sends initial SIP REGISTER)
await agent.initialize();

// listen for incoming conversations
agent.addConversationListener((conversation) => {
  const { created, id, requestedUri, targetUri } = conversation;

  // print some conversation metadata
  console.log(
    created,
    id,
    requestedUri,
    targetUri,
  );

  // print already sent messages
  conversation.messages.forEach(msg => console.log(msg.text));

  // register a callback for *both* incoming and outgoing messages
  conversation.addMessageListener((msg) => {
    // print message metadata
    console.log(`${msg.origin} (${msg.type}): ${msg.text}`);

    const {
      vcard,
      location,
    } = msg;

    // print some VCard information, if available
    if (vcard)
      console.log(
        vcard.firstname,
        vcard.lastname,
        vcard.birthday,
      );

    // print location information, if available
    if (location) {
      // `location` is of type PidfLo
      // for easier access there is a simplified location object
      // however this simple object might not contain all information transmitted through PidfLo
      const simpleLoc = location.simple;
      console.log(
        simpleLoc.latitude,
        simpleLoc.latitude,
        simpleLoc.radius,
        simpleLoc.method,
      )
    }
  });

  // listen for conversation state updates
  conversation.addStateListener((stateObj) => {
    switch(stateObj.value) {
      case ConversationState.STOPPED:
        console.log('The emergency call has ended!');
        break;
      case ConversationState.ERROR:
        console.log('An error has happened!');
        break;        
    }
  });

  // send a message to the caller
  // NOTICE: according to TS 103 698 the PSAP is obliged to send an initial message in response to the caller's START message!
  const startMsg = conversation.sendMessage('Emergency control center. How can we help you?');
  // `await`ing the promise ensures the message was successfully forwarded by the SIP proxy
  await startMsg.promise;

  // end the emergency call
  const stopMsg = conversation.stop('This conversation was ended by the control center.');
  await stopMsg.promise;
});

```

## Documentation

Documentation can be found at https://www.dec112.at/docs/ng112-js

Generate documentation by using the following command. It will be saved in folder `./docs`

```shell
npm install
npm run docs
```

## Local Build

```shell
npm install
npm run build
```

---

This project was bootstrapped with [TSDX](https://tsdx.io/)
