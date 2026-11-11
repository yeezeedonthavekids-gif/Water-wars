// Firebase Admin initialisation for the Netlify function (and the local dev API server).
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import type { ClientConfig } from '../src/shared/types';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

const env = (k: string) => (process.env[k] ?? '').trim();
export const isEmulator = () => !!env('FIREBASE_DATABASE_EMULATOR_HOST');

function parseServiceAccount(): ServiceAccount | null {
  const raw = env('FIREBASE_SERVICE_ACCOUNT');
  if (raw) {
    try {
      const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      const sa = JSON.parse(text);
      if (sa.project_id && sa.client_email && sa.private_key) return sa;
    } catch {
      /* fall through to split variables */
    }
  }
  const project_id = env('FIREBASE_PROJECT_ID');
  const client_email = env('FIREBASE_CLIENT_EMAIL');
  const private_key = env('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');
  if (project_id && client_email && private_key) return { project_id, client_email, private_key };
  return null;
}

function projectId(sa: ServiceAccount | null) {
  return sa?.project_id || env('FIREBASE_PROJECT_ID') || env('GCLOUD_PROJECT') || 'demo-water-wars';
}

export function databaseURL(sa: ServiceAccount | null) {
  return env('FIREBASE_DATABASE_URL') || `https://${projectId(sa)}-default-rtdb.firebaseio.com`;
}

export function missingConfig(): string[] {
  if (isEmulator()) return [];
  const missing: string[] = [];
  if (!parseServiceAccount()) missing.push('FIREBASE_SERVICE_ACCOUNT');
  if (!env('FIREBASE_WEB_API_KEY')) missing.push('FIREBASE_WEB_API_KEY');
  if (!env('FIREBASE_DATABASE_URL')) missing.push('FIREBASE_DATABASE_URL');
  return missing;
}

export function clientConfig(): ClientConfig {
  const missing = missingConfig();
  if (missing.length) return { configured: false, missing };
  const sa = parseServiceAccount();
  const pid = projectId(sa);
  const cfg: ClientConfig = {
    configured: true,
    firebase: {
      apiKey: env('FIREBASE_WEB_API_KEY') || 'demo-api-key',
      authDomain: `${pid}.firebaseapp.com`,
      databaseURL: databaseURL(sa),
      projectId: pid,
    },
  };
  if (isEmulator()) {
    const [host, port] = env('FIREBASE_DATABASE_EMULATOR_HOST').split(':');
    cfg.emulator = {
      auth: `http://${env('FIREBASE_AUTH_EMULATOR_HOST') || '127.0.0.1:9099'}`,
      dbHost: env('WW_PUBLIC_EMULATOR_HOST') || host,
      dbPort: Number(port),
    };
    if (env('WW_PUBLIC_EMULATOR_HOST')) cfg.emulator.auth = `http://${env('WW_PUBLIC_EMULATOR_HOST')}:9099`;
  }
  return cfg;
}

let app: App | undefined;
export function admin() {
  if (!app) {
    app = getApps()[0];
    if (!app) {
      const sa = parseServiceAccount();
      app = isEmulator() || !sa
        ? initializeApp({ projectId: projectId(sa), databaseURL: databaseURL(sa) })
        : initializeApp({
            credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }),
            databaseURL: databaseURL(sa),
            projectId: sa.project_id,
          });
    }
  }
  return { db: getDatabase(app), auth: getAuth(app) };
}
