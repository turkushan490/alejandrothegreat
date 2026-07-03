import { EventEmitter } from 'node:events';

// Shared in-process bus: the bot and the web server run in the same
// Node process, so player state changes can be pushed to socket.io
// clients without any IPC/queueing layer.
export const botEvents = new EventEmitter();
botEvents.setMaxListeners(50);
