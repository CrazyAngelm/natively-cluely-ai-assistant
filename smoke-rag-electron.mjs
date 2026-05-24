import { _electron as electron } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.dirname(fileURLToPath(import.meta.url));
const app = await electron.launch({ cwd: repo, args: ['.'], env: { ...process.env, NODE_ENV: 'development' } });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');
await page.waitForFunction(() => !!globalThis.window?.electronAPI, null, { timeout: 30000 });

const out = await page.evaluate(async () => {
  const events = [];
  const unsubChunk = window.electronAPI.onRAGStreamChunk((data) => events.push({ type: 'chunk', chunk: data.chunk?.slice?.(0, 80) }));
  const unsubComplete = window.electronAPI.onRAGStreamComplete((data) => events.push({ type: 'complete', data }));
  const unsubError = window.electronAPI.onRAGStreamError((data) => events.push({ type: 'error', data }));
  const result = await window.electronAPI.ragQueryGlobal('Что обсуждалось на встрече?');
  await new Promise((resolve) => setTimeout(resolve, 1500));
  unsubChunk?.();
  unsubComplete?.();
  unsubError?.();
  return { result, events };
});

console.log(JSON.stringify(out, null, 2));
await app.close();
