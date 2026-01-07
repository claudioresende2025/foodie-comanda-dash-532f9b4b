#!/usr/bin/env node
const { exec } = require('child_process');
const chokidar = require('chokidar');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const BRANCH = process.env.AUTOSYNC_BRANCH || 'main';
const DEBOUNCE_MS = Number(process.env.AUTOSYNC_DEBOUNCE_MS) || 5000;

let timeout = null;
let running = false;

function run(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: repoRoot, env: process.env, ...opts }, (err, stdout, stderr) => {
      if (err) return reject({ err, stdout, stderr });
      resolve({ stdout, stderr });
    });
  });
}

async function sync() {
  if (running) return;
  running = true;
  try {
    // check for changes
    const { stdout: status } = await run('git status --porcelain');
    if (!status.trim()) {
      running = false;
      return;
    }

    console.log('[autosync] Changes detected, committing...');
    await run('git add -A');
    const message = `autosync: update ${new Date().toISOString()}`;
    try {
      await run(`git commit -m "${message}" --no-verify`);
    } catch (cErr) {
      // nothing to commit or commit failed
      console.log('[autosync] commit failed or nothing to commit', cErr.stdout || cErr.err || '');
    }

    console.log('[autosync] Pushing to remote...');
    try {
      await run(`git push origin ${BRANCH}`);
      console.log('[autosync] Push successful');
    } catch (pErr) {
      console.error('[autosync] Push failed:', pErr.stderr || pErr.err || pErr.stdout || pErr);
    }
  } catch (err) {
    console.error('[autosync] Error during sync:', err);
  } finally {
    running = false;
  }
}

function scheduleSync() {
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(sync, DEBOUNCE_MS);
}

console.log('[autosync] Starting watcher (ignores .git, node_modules, dist)...');
const watcher = chokidar.watch(['**/*'], {
  ignored: ['**/.git/**', '**/node_modules/**', '**/dist/**', '**/.venv/**', '**/.idea/**', '**/.vscode/**'],
  ignoreInitial: true,
  cwd: repoRoot,
  persistent: true,
});

watcher.on('all', (event, path) => {
  console.log(`[autosync] ${event}: ${path}`);
  scheduleSync();
});

process.on('SIGINT', () => {
  console.log('[autosync] Stopping...');
  watcher.close();
  process.exit(0);
});
