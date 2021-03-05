const {
  Agent,
  DEC112Specifics,
  LocationMethod,
} = require('ng112-js/dist/node');

console.log('------------ ng112-js node ------------');
console.log('|                                     |');
console.log('|   Type message and ENTER to send    |');
console.log('|       Type "exit" to end call       |');
console.log('|                                     |');
console.log('---------------------------------------');
console.log('\n\n');

const readline = require("readline");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const config = {
  endpoint: 'ws://dec112.at',
  domain: 'dec112.at',
  user: 'username',
  password: 'password',
  latitude: 48.1799778,
  longitude: 16.341437,
  radius: 10,
  call: 'sip:112@dec112.at',
};

(async () => {

  const agent = new Agent({
    endpoint: config.endpoint,
    domain: config.domain,
    user: config.user,
    password: config.password,
  });


  agent.updateLocation({
    latitude: config.latitude,
    longitude: config.longitude,
    radius: config.radius,
    method: LocationMethod.GPS,
  })

  try {
    await agent.initialize()

    const conversation = agent.createConversation(config.call);
    conversation.addMessageListener((msg) => {
      console.log(`${msg.origin} (${msg.type}): ${msg.text}\n`);
    });

    await conversation.start().promise;

    const exit = async () => {
      await conversation.stop().promise;
      await agent.dispose();

      process.exit(0);
    }

    const askForMessage = () => {
      rl.question('', (msg) => {
        if (msg === 'exit') {
          exit();
          return;
        }

        conversation.sendMessage({ text: msg });
        askForMessage();
      });
    }

    rl.on('close', () => exit());

    askForMessage();
  }
  catch (e) {
    console.log(e);
  }

})();