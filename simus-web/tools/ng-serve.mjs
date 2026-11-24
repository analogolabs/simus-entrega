#!/usr/bin/env node
/**
 * `npm start`: `ng serve` con el puerto de la web tomado de `SIMUS_LOCAL_WEB_PORT` (4300 por omisión).
 *
 * Es un envoltorio y no una variable dentro de `package.json` porque `${VAR:-4300}` no existe en `cmd.exe`, y
 * este repositorio se desarrolla también en Windows. El proxy de `/api` lee `SIMUS_LOCAL_API_PORT` por su cuenta
 * (`proxy.conf.cjs`). Cualquier argumento extra se pasa a `ng serve` tal cual.
 */
import { spawn } from 'node:child_process';

const puerto = process.env.SIMUS_LOCAL_WEB_PORT || '4300';
const hijo = spawn('npx', ['ng', 'serve', '--host', '127.0.0.1', '--port', puerto, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
hijo.on('exit', (codigo) => process.exit(codigo ?? 0));
for (const senal of ['SIGINT', 'SIGTERM']) process.on(senal, () => hijo.kill(senal));
