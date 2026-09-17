// Starts the dashboard with made up numbers. No keys, no login.
import { spawn } from 'node:child_process';
const next = process.platform === 'win32' ? 'npx.cmd' : 'npx';
console.log('\nDemo mode. Every number is made up. Open http://localhost:3000\n');
spawn(next, ['next', 'dev'], { stdio: 'inherit', env: { ...process.env, DEMO: '1', DASHBOARD_PASSWORD: '' }, shell: process.platform === 'win32' });
