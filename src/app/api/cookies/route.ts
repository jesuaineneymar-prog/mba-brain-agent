import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ENV_PATH = join(process.cwd(), '.env');

function readEnv(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {};
  const content = readFileSync(ENV_PATH, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  }
  return env;
}

function writeEnv(env: Record<string, string>) {
  const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`);
  writeFileSync(ENV_PATH, lines.join('\n'), 'utf-8');
}

const COOKIE_KEYS = [
  { key: 'IG_SESSIONID', label: 'Instagram Session ID' },
  { key: 'IG_CSRFTOKEN', label: 'Instagram CSRF Token' },
  { key: 'META_ACCESS_TOKEN', label: 'Meta Access Token' },
  { key: 'LI_AT', label: 'LinkedIn li_at Cookie' },
  { key: 'TT_SESSIONID', label: 'TikTok Session ID' },
  { key: 'TT_CSRF_TOKEN', label: 'TikTok CSRF Token' },
  { key: 'APIFY_API_KEY', label: 'Apify API Key' },
];

export async function GET() {
  try {
    const env = readEnv();
    const cookies = COOKIE_KEYS.map(k => ({ key: k.key, label: k.label, value: env[k.key] ? '***' + env[k.key].slice(-4) : '', hasValue: !!env[k.key] }));
    return NextResponse.json({ cookies });
  } catch (error) {
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { updates } = await request.json();
    const env = readEnv();
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'string' && value.length > 0) {
        env[key] = value;
      }
    }
    writeEnv(env);
    await fetch('http://localhost:3000/api/restart-env', { method: 'POST' }).catch(() => {});
    return NextResponse.json({ success: true, updated: Object.keys(updates) });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao guardar' }, { status: 500 });
  }
}