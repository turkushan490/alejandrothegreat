import { Client } from 'ssh2';
const conn = new Client();
conn.on('ready', () => {
  conn.exec(process.argv[2], (err, stream) => {
    if (err) { console.error(err.message); conn.end(); process.exit(1); }
    let out=''; stream.on('close', c => { process.stdout.write(out); conn.end(); process.exit(c||0); })
      .on('data', d => out+=d).stderr.on('data', d => out+=d);
  });
}).on('error', e => { console.error('CONN', e.message); process.exit(1); })
  .connect({ host:'192.168.0.6', port:22, username:'root', password:process.env.SSH_PW, readyTimeout:15000 });
