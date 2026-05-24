import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.dirname(fileURLToPath(import.meta.url));
const app = await electron.launch({
  cwd: repo,
  args: ['.'],
  env: {
    ...process.env,
    NODE_ENV: 'development',
  },
});

const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');
await page.waitForFunction(() => !!globalThis.window?.electronAPI, null, { timeout: 30000 });

const warnings = [];
await page.evaluate(() => {
  globalThis.__smokeWarnings = [];
  window.electronAPI.onAudioCaptureFailed((payload) => globalThis.__smokeWarnings.push(payload));
  window.electronAPI.onSystemAudioPermissionDenied((message) => globalThis.__smokeWarnings.push({ channel: 'system', message }));
});

const started = await page.evaluate(() => window.electronAPI.startMeeting({ doNotPersist: true, source: 'smoke-audio-rag-windows' }));
await page.waitForTimeout(35000);
const state = await page.evaluate(async () => ({
  warnings: globalThis.__smokeWarnings || [],
  scopes: await window.electronAPI.getProviderDataScopes(),
  creds: await window.electronAPI.getStoredCredentials(),
  current: await window.electronAPI.getCurrentLlmConfig(),
}));
const ended = await page.evaluate(() => window.electronAPI.endMeeting());

const logPath = path.join(process.env.USERPROFILE || '', 'Documents', 'natively_debug.log');
const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
const recent = log.split(/\r?\n/).slice(-260).join('\n');
const interesting = recent
  .split(/\r?\n/)
  .filter((line) => /Rust module missing|Initialized \(lazy\)|Initialized wrapper|SystemAudioCapture\] Chunk|MicrophoneCapture\] Emitting chunk|LiveRAGIndexer|EmbeddingPipeline|OllamaManager|OllamaBootstrap|audio-capture-failed|No audio detected|Screen Recording/.test(line));

console.log(JSON.stringify({ started, ended, state, interesting }, null, 2));
await app.close();
