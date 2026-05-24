import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(repo, '.env');
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

const groqKey = env.GROQ_API_KEY;
if (!groqKey) throw new Error('GROQ_API_KEY missing in .env');

const researcherConfigPath = path.join(process.env.USERPROFILE || '', '.claude', 'skills', 'researcher', 'config.json');
const researcherConfig = fs.existsSync(researcherConfigPath)
  ? JSON.parse(fs.readFileSync(researcherConfigPath, 'utf8'))
  : {};
const tavilyKey = env.TAVILY_API_KEY || researcherConfig.tavily_keys?.[0] || '';

const app = await electron.launch({
  cwd: repo,
  args: ['.'],
  env: {
    ...process.env,
    ...env,
    NODE_ENV: 'development',
  },
});

const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');
await page.waitForFunction(() => !!globalThis.window?.electronAPI, null, { timeout: 30000 });

const result = await page.evaluate(async ({ groqKey, tavilyKey }) => {
  const api = globalThis.window.electronAPI;
  const provider = {
    id: 'omniroute-codex-gpt-54-mini-responses',
    name: 'OmniRoute GPT 5.4 mini',
    responsePath: 'output_text',
    multimodal: true,
    localOnly: true,
    curlCommand: `curl http://localhost:20128/v1/responses -H "Content-Type: application/json" -d '{"model":"codex/gpt-5.4-mini","input":[{"type":"message","role":"user","content":[{"type":"input_text","text":"{{TEXT}}"}]}],"max_output_tokens":1400,"stream":false}'`,
  };

  const out = {};
  out.saveProvider = await api.saveCustomProvider(provider);
  out.setDefault = await api.setDefaultModel(provider.id);
  out.setModel = await api.setModel(provider.id);
  out.setGroqKey = await api.setGroqSttApiKey(groqKey);
  out.setGroqModel = await api.setGroqSttModel('whisper-large-v3-turbo');
  out.setSttProvider = await api.setSttProvider('groq');
  if (tavilyKey) out.setTavilyKey = await api.setTavilyApiKey(tavilyKey);
  out.setScopes = await api.setProviderDataScopes({ transcript: true, screenshots: true, reference_files: true, profile_history: true, embeddings: true, post_call_summary: true });
  out.setScreenMode = await api.setScreenUnderstandingMode('vision_first');
  out.setVisionFirst = await api.setTechnicalInterviewVisionFirst(true);
  out.creds = await api.getStoredCredentials();
  out.defaultModel = await api.getDefaultModel();
  out.providers = await api.getCustomProviders();
  return out;
}, { groqKey, tavilyKey });

console.log(JSON.stringify({
  saveProvider: result.saveProvider,
  setDefault: result.setDefault,
  setModel: result.setModel,
  setGroqKey: result.setGroqKey,
  setGroqModel: result.setGroqModel,
  setSttProvider: result.setSttProvider,
  setTavilyKey: result.setTavilyKey || null,
  setScopes: result.setScopes,
  setScreenMode: result.setScreenMode,
  setVisionFirst: result.setVisionFirst,
  defaultModel: result.defaultModel,
  sttProvider: result.creds?.sttProvider,
  hasSttGroqKey: result.creds?.hasSttGroqKey,
  groqSttModel: result.creds?.groqSttModel,
  hasTavilyKey: result.creds?.hasTavilyKey,
  providers: (result.providers || []).map((p) => ({ id: p.id, name: p.name, multimodal: p.multimodal, localOnly: p.localOnly })),
}, null, 2));

await app.close();
