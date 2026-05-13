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
  SPLITPRO_MOCK_OPENAI: 'true',
  OPENAI_API_KEY: 'emulator-mock-key',
  FUNCTIONS_EMULATOR: 'true',
  NODE_ENV: 'test',
};

for (const key of Object.keys(env)) {
  if (/debug|token|secret|password|igcc/i.test(key)) {
    delete env[key];
  }
}

env.SPLITPRO_MOCK_OPENAI = 'true';
env.OPENAI_API_KEY = 'emulator-mock-key';
env.FUNCTIONS_EMULATOR = 'true';
env.NODE_ENV = 'test';

const result = spawnSync(
  process.execPath,
  [
    firebaseCli,
    '--config',
    'firebase.phase4-emulator.json',
    'emulators:exec',
    '--project',
    'demo-splitpro-phase4-ai',
    '--only',
    'auth,firestore,functions',
    'node scripts/phase4-ai-emulator.test.cjs',
  ],
  {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 180000,
  },
);

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

const output = `${result.stdout || ''}${result.stderr || ''}`;
const scriptSucceeded = output.includes('Script exited successfully (code 0)');
const testFailed = output.includes('FAIL ');

if (scriptSucceeded && !testFailed) {
  process.exit(0);
}

process.exit(result.status ?? 1);
