import { Server } from 'socket.io';
import { botEvents } from '../bot/emitter.js';
import { getClient } from '../bot/manager.js';

export function attachSocket(httpServer, sessionMiddleware) {
  const io = new Server(httpServer);

  // Share the express-session cookie with socket.io so we know who's connecting.
  io.engine.use(sessionMiddleware);

  io.on('connection', (socket) => {
    const session = socket.request.session;
    if (!session?.user) {
      socket.disconnect(true);
      return;
    }

    socket.on('join', (guildId) => {
      const isMember = (session.guilds || []).some((g) => g.id === guildId);
      if (isMember && getClient()?.guilds.cache.has(guildId)) {
        socket.join(guildId);
      }
    });
  });

  botEvents.on('queueUpdate', (guildId, snapshot) => {
    io.to(guildId).emit('state', snapshot);
  });

  return io;
}
