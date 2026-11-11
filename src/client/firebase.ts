// Lazy Firebase client. Config is fetched at runtime from /api/config so the only place
// to configure the deployment is Netlify's environment variables.
import type { ClientConfig } from '../shared/types';
import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Database } from 'firebase/database';

let configPromise: Promise<ClientConfig> | null = null;
export function loadConfig(): Promise<ClientConfig> {
  configPromise ??= fetch('/api/config', { cache: 'no-store' })
    .then(async (r) => {
      if (!r.ok) throw new Error(`Config request failed (${r.status})`);
      return (await r.json()) as ClientConfig;
    })
    .catch((e) => {
      configPromise = null;
      throw e;
    });
  return configPromise;
}

interface Fb {
  app: FirebaseApp;
  auth: Auth;
  db: Database;
  authMod: typeof import('firebase/auth');
  dbMod: typeof import('firebase/database');
}

let fbPromise: Promise<Fb> | null = null;
export function firebase(): Promise<Fb> {
  fbPromise ??= (async () => {
    const cfg = await loadConfig();
    if (!cfg.configured || !cfg.firebase) throw new Error('NOT_CONFIGURED');
    const [{ initializeApp }, authMod, dbMod] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/database'),
    ]);
    const app = initializeApp(cfg.firebase);
    const auth = authMod.getAuth(app);
    const db = dbMod.getDatabase(app);
    if (cfg.emulator) {
      authMod.connectAuthEmulator(auth, cfg.emulator.auth, { disableWarnings: true });
      dbMod.connectDatabaseEmulator(db, cfg.emulator.dbHost === '127.0.0.1' ? location.hostname : cfg.emulator.dbHost, cfg.emulator.dbPort);
    }
    return { app, auth, db, authMod, dbMod };
  })().catch((e) => {
    fbPromise = null;
    throw e;
  });
  return fbPromise;
}

let userPromise: Promise<User> | null = null;
/** Anonymous sign-in; the same browser keeps the same identity across reloads (so players can reconnect). */
export function ensureUser(): Promise<User> {
  userPromise ??= (async () => {
    const { auth, authMod } = await firebase();
    await auth.authStateReady();
    if (auth.currentUser) return auth.currentUser;
    const cred = await authMod.signInAnonymously(auth);
    return cred.user;
  })().catch((e) => {
    userPromise = null;
    throw e;
  });
  return userPromise;
}
