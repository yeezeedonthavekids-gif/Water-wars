// One command local dev: Firebase emulators + game API + Vite.
import { spawn } from 'node:child_process';

const procs = [
  ['emulators', 'npx', ['--yes', 'firebase-tools', 'emulators:start', '--only', 'auth,database', '--project', 'demo-water-wars']],
  ['api', 'npx', ['tsx', 'watch', 'scripts/dev-api.ts']],
  ['web', 'npx', ['vite']],
];
const children = procs.map(([name, cmd, args]) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const out = (d) => process.stdout.write(d.toString().split('\n').filter(Boolean).map((l) => `[${name}] ${l}\n`).join(''));
  p.stdout.on('data', out);
  p.stderr.on('data', out);
  p.on('exit', (c) => console.log(`[${name}] exited with ${c}`));
  return p;
});
const stop = () => { children.forEach((c) => c.kill('SIGINT')); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
