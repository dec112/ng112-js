import { Socket, WebSocketInterface } from 'jssip';
// @ts-expect-error
import NodeWebsocket from 'jssip-node-websocket';
import { isBrowser } from '../compatibility';

export const getSocketInterface = (endpoint: string): Socket => {
  if (isBrowser)
    return new WebSocketInterface(endpoint);
  else
    return new NodeWebsocket(endpoint);
}