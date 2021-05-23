import WS from 'jest-websocket-mock';
import { Agent } from '../dist/node';
import { JsSipAdapter } from 'ng112-js-sip-adapter-jssip/dist/node';
import path from 'path';
import fs from 'fs';
import { cacheValues, fillValues } from './utils/sip';

export * from '../dist/node';

export const getAgent = () => new Agent({
  // TODO: ensure that all tests are also run with sip.js
  sipAdapterFactory: JsSipAdapter.factory,
  endpoint: 'ws://localhost:1234',
  domain: 'dec112.at',
  user: 'user',
  password: 'password',
  displayName: 'Alice',
  // debug: true,
});

let _server: WS;

const initialize = () => {
  _server = new WS("ws://localhost:1234");
}

const send = (filename: string) => {
  const pathParts: string[] = [
    __dirname,
    'res',
    ...filename.split('/'),
  ]

  let msg = fs.readFileSync(`${path.join(...pathParts)}.txt`, { encoding: 'utf-8' });
  msg = fillValues(msg);

  _server.send(msg);
}

const clean = () => WS.clean();

const nextMessage = async () => {
  let msg = (await _server.nextMessage) as string;
  cacheValues(msg);
  return msg;
}

export const server = {
  send,
  clean,
  initialize,
  is: () => _server,
  expect: {
    message: nextMessage,
  },
};