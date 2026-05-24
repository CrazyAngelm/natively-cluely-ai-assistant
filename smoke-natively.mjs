import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(repo, '.env');
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const env = Object.fromEntries(
  envText.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  })
);

const app = await electron.launch({
  cwd: repo,
  args: ['.'],
  env: { ...process.env, ...env, NODE_ENV: 'development' },
});

try {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
  await page.waitForFunction(() => !!globalThis.window?.electronAPI, null, { timeout: 30000 });
  await page.waitForTimeout(2000);
  const title = await page.title();
  const url = page.url();
  const visibleText = (await page.locator('body').innerText({ timeout: 10000 })).slice(0, 1000);
  const config = await page.evaluate(async () => {
    const api = globalThis.window.electronAPI;
    const creds = await api.getStoredCredentials();
    const defaultModel = await api.getDefaultModel();
    const providers = await api.getCustomProviders();
    const current = await api.getCurrentLlmConfig?.();
    return {
      defaultModel,
      creds: {
        sttProvider: creds?.sttProvider,
        hasSttGroqKey: creds?.hasSttGroqKey,
        groqSttModel: creds?.groqSttModel,
      },
      providers: (providers || []).map((p) => ({ id: p.id, name: p.name })),
      current,
    };
  });
  const screenshotPath = path.join(repo, 'natively-smoke.png');
  let screenshotOk = false;
  try {
    await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 10000 });
    screenshotOk = true;
  } catch (error) {
    console.error('screenshot failed:', error.message);
  }
  console.log(JSON.stringify({ ok: true, title, url, visibleText, config, screenshotPath: screenshotOk ? screenshotPath : null }, null, 2));
} finally {
  await app.close();
}
