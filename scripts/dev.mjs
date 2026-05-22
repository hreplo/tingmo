import { spawn } from 'child_process';
import { createServer } from 'net';

const VITE_PORT = 5173;

function waitForPort(port, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryConnect = () => {
      const socket = createServer();
      socket.on('error', () => {
        // Port is in use = Vite is ready
        socket.close();
        resolve();
      });
      socket.listen(port, '127.0.0.1', () => {
        // Port is free = Vite not ready yet
        socket.close();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for port ${port}`));
        } else {
          setTimeout(tryConnect, 300);
        }
      });
    };
    tryConnect();
  });
}

console.log('[dev] Starting Vite...');
const vite = spawn('npx', ['vite', '--port', String(VITE_PORT)], {
  stdio: 'inherit',
  shell: true,
});

vite.on('error', (err) => {
  console.error('[dev] Failed to start Vite:', err.message);
  process.exit(1);
});

try {
  console.log('[dev] Waiting for Vite on port', VITE_PORT, '...');
  await waitForPort(VITE_PORT);
  console.log('[dev] Vite ready, starting Electron...');

  // Build main process
  const build = spawn('npm', ['run', 'build:main'], { stdio: 'inherit', shell: true });
  await new Promise((resolve, reject) => {
    build.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`build:main exited with code ${code}`));
    });
  });

  // Start Electron
  const electron = spawn('npx', ['electron', '.'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: 'development' },
  });

  electron.on('close', () => {
    console.log('[dev] Electron closed, stopping...');
    vite.kill();
    process.exit(0);
  });
} catch (err) {
  console.error('[dev]', err.message);
  vite.kill();
  process.exit(1);
}
