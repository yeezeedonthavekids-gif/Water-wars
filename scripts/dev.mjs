// One command local dev: game API (same handler as the Netlify function) + Vite.
// Start Supabase first with `npx supabase start` (needs Docker) — see README.
import { spawn } from 'node:child_process';

const procs = [
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
