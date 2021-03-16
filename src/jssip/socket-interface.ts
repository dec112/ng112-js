import { Socket, WebSocketInterface } from 'jssip';
import { isBrowser } from '../compatibility';

export const getSocketInterface = (endpoint: string): Socket => {
  // there are no types for NodeWebsocket
  let NodeWebsocket: any = undefined;

  // if we are on node, we try to import jssip-node-websocket, which is a peer-dependency
  if (!isBrowser) {
    try {
      NodeWebsocket = require('jssip-node-websocket');
    }
    catch { /* module could not be found */ }
  }

  if (NodeWebsocket)
    return new NodeWebsocket(endpoint);
  else
    // if we could not load jssip-node-websocket, we'll proceed with the standard websocket interface
    return new WebSocketInterface(endpoint);
}