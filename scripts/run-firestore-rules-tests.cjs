/* eslint-env node, es2020 */

const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const firebaseCli = path.join(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');

const env = {
  ...process.env,
  XDG_CONFIG_HOME: path.join(root, '.tmp-firebase-config'),
  FIREBASE_CONFIGSTORE_PATH: path.join(root, '.tmp-firebase-config', 'firebase-tools.json'),
  FIREBASE_EMULATORS_PATH: path.join(root, '.tmp-firebase-emulators'),
};

for (const key of Object.keys(env)) {
  if (/debug|key|token|secret|password|openai|openrouter|igcc/i.test(key)) {
    delete env[key];
  }
}

const result = spawnSync(
  process.execPath,
  [
    firebaseCli,
    '--config',
    'firebase.emulator.json',
    'emulators:exec',
    '--project',
    'demo-splitpro-rules',
    '--only',
    'firestore',
    'node scripts/firestore-rules.test.cjs',
  ],
  {
    cwd: root,
    env,
    encoding: 'utf8',
  },
);

const output = `${result.stdout || ''}${result.stderr || ''}`;

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

const scriptSucceeded = output.includes('Script exited successfully (code 0)');
const testFailed = output.includes('FAIL ');

if (scriptSucceeded && !testFailed) {
  process.exit(0);
}

process.exit(result.status ?? 1);
