# ng112-js - Next Generation Emergency Services

This javascript library should help integrating browser and node environments with existing NG112 or DEC112 infrastructure and covers standards [ETSI TS 103 479](https://www.etsi.org/deliver/etsi_ts/103400_103499/103479/01.01.01_60/ts_103479v010101p.pdf) and [ETSI TS 103 698](https://www.etsi.org/deliver/etsi_ts/103600_103699/103698/01.01.01_60/ts_103698v010101p.pdf), as well as DEC112 specific additions for text based emergency messages/calls.

It handles SIP communication, message types, heartbeats, PIDF-LO, VCards, Multipart MIME and should finally provide a comprehensive implementation of the aformentioned ETSI standards.

Please keep in mind this library is still in development and does not cover standards entirely!

SIP communication can be handeled by a SIP stack of your choice. \
By default, `ng112-js` comes with adapters for:
* [JsSIP](https://jssip.net/): https://github.com/dec112/ng112-js-sip-adapter-jssip
* [SIP.js](https://sipjs.com/): https://github.com/dec112/ng112-js-sip-adapter-sipjs

If you want to write your own adapter, take a look at one of the linked adapters to get an idea how they are implemented.

License: GNU AGPL-3.0 \
Proprietary licenses are available on request. \
Maintainer: Gabriel Unterholzer (gabriel.unterholzer@dec112.at)

Many thanks to [Netidee](https://www.netidee.at) who funded parts of this software project in call #17 (DEC4IoT)!

<img src="https://raw.githubusercontent.com/dec112/ng112-js/main/assets/netidee.jpeg" height="150" />

This project has received funding from the European Union’s Horizon 2020 research and innovation program through the [NGI TRUSTCHAIN program](https://trustchain.ngi.eu/) under cascade funding agreement No 101093274.

<img src="https://raw.githubusercontent.com/dec112/ng112-js/main/assets/ngi-trustchain.png" height="150" />


## Installation

```shell
npm install ng112-js
```

In addition, you will also have to install one of the available SIP adapters. \
Let's use the JsSIP adapter in this example:

```shell
npm install ng112-js-sip-adapter-jssip
```

### Special requirements for node.js

As node.js does not come with native support for xml manipulation, you will have to install package `@xmldom/xmldom` which is a peer-dependency of `pidf-lo`.

Please also note the install requirements of the respective SIP adapters (README.md) \
`ng112-js-sip-adapter-jssip` will need an additional package, if it is used in node.js environments!

## Examples

Most complete examples can be found in both web and node example projects in `./example/web` and `./example/node`.

Examples of specific use-cases can be found in `./example/snippets`.

### Use as a calling device (e.g. in a smartphone app)

```javascript
import { 
  Agent,
  DEC112Specifics,
  LocationMethod,
  Origin,
  XMLCompat,
  VCard,
} from 'ng112-js';
import { 
  SipJsAdapter, 
} from 'ng112-js-sip-adapter-sipjs';

// if xmldom interface is available (e.g. on web browsers)
XMLCompat.initialize(XMLCompat.getWebImpl());

// define connection to SIP proxy (originating ESRP)
const agent = new Agent({
  sipAdapterFactory: SipJsAdapter.factory,
  endpoint: 'wss://example.com',
  domain: 'example.com',
  user: 'user1234',
  password: 'supersecretpassword',
  // ETSI TS 103 698: optional
  // DEC112: required. Must be set with a verified telephone number, due to legal requirements
  displayName: '004366412345678',
  // DEC112: required. Used to specify additional properties for DEC112 environments
  // either device id or registration id is required
  // in ETSI TS 103 698 environments, `namespaceSpecifics` must not be specified
  namespaceSpecifics: new DEC112Specifics({
    // registration id (registration API version 2)
    registrationId: 'registrationId',
    // user device language (ISO639-1 two letter language code; optional)
    langauge: 'en',
    // client version (e.g. version of application, where ng112-js is used in; optional)
    clientVersion: '1.0.4',
  }),
  debug: {
    // If `debug` is set to `true`, verbose log messages will be printed to the console
    // If `debug` is set to a callback, this callback will be called for each debug statement
    // `default` spcifies behaviour for all debug messages that are generated by ng112-js directly
    default: true,
    // same possible values as for `default`
    // Specifies, if log messages by used sipAdapter should be logged
    sipAdapter: true,
  },
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
const conversation = agent.createConversation('sip:144@dec112.at');

// register a callback for *both* incoming and outgoing messages
conversation.addMessageListener((msg) => {
  // print message metadata
  console.log(`${msg.origin} (${msg.type}): ${msg.text}`);

  // For some SIP stacks you will need to explicitly `accept` or `reject` incoming messages
  if (msg.origin === Origin.REMOTE && msg.event && msg.event.accept)
    msg.event.accept();
});

// initiate the emergency conversation
// sends the initial START message to the ESRP
const startMsg = conversation.start({
  text: 'This is an emergency call initiated by ng112-js',
});

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
  Origin,
  ConversationState,
  XMLCompat,
} from 'ng112-js';
import { 
  JsSipAdapter, 
} from 'ng112-js-sip-adapter-jssip';

// if xmldom interface is NOT available (e.g. on node environments)
// also don't forget to install required peer dependency @xmldom/xmldom
XMLCompat.initialize(XMLCompat.getNodeImpl());

// define connection to SIP proxy (terminating ESRP)
const agent = new Agent({
  sipAdapterFactory: JsSipAdapter.factory,
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

    // For some SIP stacks you will need to explicitly `accept` or `reject` incoming messages
    if (msg.origin === Origin.REMOTE && msg.event && msg.event.accept)
      msg.event.accept();
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
  const startMsg = conversation.sendMessage({
    text: 'Emergency control center. How can we help you?',
  });
  // `await`ing the promise ensures the message was successfully forwarded by the SIP proxy
  await startMsg.promise;

  // end the emergency call
  const stopMsg = conversation.stop({
    text: 'This conversation was ended by the control center.',
  });
  await stopMsg.promise;
});

```

### More examples!

More examples can be found in the `snippets` subfolder located at `./example/snippets`.

This includes the following use-cases:
* Heartbeat configuration
* Sending custom multipart mime bodys (including CAP [Common Alerting Protocol])
* Resending messages
* Restarting conversations (e.g. after an application crash)

## Local Build

```shell
npm run build
```

## Testing

ng112-js testing relies on docker and docker-compose. Therefore you will need this programs to be installed to successfully run automated tests. \
There is an example docker-compose.yml in the test directory. You'll need a Kamailio docker image and a NG112 compatible PSAP image to successfully run the integration tests.

```shell
npm run test
```

## Documentation

Documentation can be found at https://www.dec112.at/docs/ng112-js

Generate documentation by using the following command. It will be saved in folder `./docs`

```shell
npm run docs
```

## Thank You!

Thanks to all Open Source contributors this project builds on. Special thanks to the team behind [JsSIP](https://github.com/versatica/JsSIP), which is the most important part of this project!