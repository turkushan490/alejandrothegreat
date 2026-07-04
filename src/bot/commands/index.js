import { Collection } from 'discord.js';
import * as play from './play.js';
import * as pause from './pause.js';
import * as resume from './resume.js';
import * as skip from './skip.js';
import * as stop from './stop.js';
import * as queue from './queue.js';
import * as nowplaying from './nowplaying.js';
import * as volume from './volume.js';
import * as shuffle from './shuffle.js';
import * as remove from './remove.js';
import * as clear from './clear.js';
import * as loop from './loop.js';
import * as dj from './dj.js';

const modules = [play, pause, resume, skip, stop, queue, nowplaying, volume, shuffle, remove, clear, loop, dj];

export const commands = new Collection();
for (const mod of modules) {
  commands.set(mod.data.name, mod);
}
