import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import { sessionSecret } from '../db.js';
import { apiRouter } from './routes/api.js';
import { authRouter } from './routes/auth.js';
import { setupRouter } from './routes/setup.js';
import { attachSocket } from './socket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', '..', 'public');

export function createWebServer() {
  const app = express();

  const sessionMiddleware = session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  });

  app.use(sessionMiddleware);
  app.use(express.json());
  app.use(express.static(publicDir));

  app.use('/auth', authRouter);
  app.use('/api/setup', setupRouter);
  app.use('/api', apiRouter);

  const httpServer = http.createServer(app);
  attachSocket(httpServer, sessionMiddleware);

  return httpServer;
}
