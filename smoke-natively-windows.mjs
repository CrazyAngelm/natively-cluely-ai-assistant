import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.dirname(fileURLToPath(import.meta.url));
const envText = fs.existsSync(path.join(repo, '.env')) ? fs.readFileSync(path.join(repo, '.env'), 'utf8') : '';
const env = Object.fromEntries(envText.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
const app = await electron.launch({ cwd: repo, args: ['.'], env: { ...process.env, ...env, NODE_ENV: 'development' } });
try {
  await app.firstWindow();
  await new Promise((r) => setTimeout(r, 5000));
  const windows = app.windows();
  const infos = [];
  for (const page of windows) {
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      const text = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
      infos.push({ url: page.url(), title: await page.title().catch(() => ''), text: text.slice(0, 800) });
    } catch (error) {
      infos.push({ error: error.message, url: page.url() });
    }
  }
  const cfgPage = windows.find((p) => p.url().includes('localhost:5180')) || windows[0];
  const config = await cfgPage.evaluate(async () => {
    const api = globalThis.window?.electronAPI;
    if (!api) return null;
    const creds = await api.getStoredCredentials();
    const defaultModel = await api.getDefaultModel();
    const providers = await api.getCustomProviders();
    const current = await api.getCurrentLlmConfig?.();
    return { defaultModel, creds: { sttProvider: creds?.sttProvider, hasSttGroqKey: creds?.hasSttGroqKey, groqSttModel: creds?.groqSttModel }, providers: (providers || []).map((p) => ({ id: p.id, name: p.name })), current };
  });
  console.log(JSON.stringify({ ok: true, windows: infos, config }, null, 2));
} finally {
  await app.close();
}
