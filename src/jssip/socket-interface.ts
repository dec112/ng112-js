import { Socket, WebSocketInterface } from 'jssip';
// import NodeWebsocket from 'jssip-node-websocket';
// import { isBrowser } from '../compatibility';

export const getSocketInterface = (endpoint: string): Socket => {
  // this is some leftover of the first implementation
  // newer node versions already support the browser's websocket APIs
  // but who knows, maybe we want to make the SDK compatible with older node versions
  // the we just have to re-enable this implementation and run an `npm install jssip-node-websocket`

  // if (isBrowser) {
    return new WebSocketInterface(endpoint);
  // }
  // else
  //   return new NodeWebsocket(endpoint);
}