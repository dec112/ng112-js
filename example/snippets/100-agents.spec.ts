import { Agent, LogLevel } from "ng112-js";
import { JsSipAdapter } from "ng112-js-sip-adapter-jssip";
import { endExample, startExample } from './util';

it('Shows the creation of ng112-js instance with different SIP stacks', async () => {
  startExample();

  // using JsSIP
  new Agent({
    sipAdapterFactory: JsSipAdapter.factory,
    domain: 'dec112.eu',
    endpoint: 'ws://dec112.at',
    password: 'password',
    user: 'user',
    userAgent: 'ng112-js-example-snippet/1.0.0',
    // specify handlers for debug output
    debug: {
      // if you specify a LogLevel, logs will be printed to console
      // default emits logs that are created by ng112-js
      default: LogLevel.ALL,
      // you can also specify a callback for custom handling of logs
      // this allows you to forward logs to a custom log handler
      // sipAdapter emits logs that are created by the sip adapter
      // this is mostly SIP traces
      sipAdapter: (level: number, ...values: any[]) => {
        // level is a bitmask
        if ((level & LogLevel.WARN) !== 0)
          console.warn(...values);
      }
    }
  });

  endExample();
});