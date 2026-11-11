import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { loadConfig } from './client/firebase';
import { lastRoom, saveRoom } from './client/settings';
import { Spinner, ToastProvider } from './components/ui';
import { MenuScreen } from './screens/MenuScreen';
import { SetupRequired } from './screens/SetupRequired';
import type { ClientConfig } from './shared/types';

const RoomScreen = lazy(() => import('./screens/RoomScreen'));
const HowToPlay = lazy(() => import('./screens/HowToPlay'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));

export type Route =
  | { name: 'menu'; joinCode?: string }
  | { name: 'howto'; tab?: string }
  | { name: 'settings' }
  | { name: 'room'; code: string };

function routeFromLocation(): Route {
  const m = location.pathname.match(/^\/(room|join)\/([A-Za-z0-9]{5})\/?$/);
  if (m) {
    const code = m[2].toUpperCase();
    if (m[1] === 'room' && lastRoom() === code) return { name: 'room', code };
    return { name: 'menu', joinCode: code };
  }
  if (location.pathname.startsWith('/how-to-play')) return { name: 'howto' };
  return { name: 'menu' };
}

function pathFor(r: Route) {
  if (r.name === 'room') return `/room/${r.code}`;
  if (r.name === 'menu' && r.joinCode) return `/join/${r.joinCode}`;
  if (r.name === 'howto') return '/how-to-play';
  return '/';
}

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromLocation);
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [configError, setConfigError] = useState('');

  const navigate = useCallback((r: Route) => {
    setRoute(r);
    if (r.name === 'room') saveRoom(r.code);
    const path = pathFor(r);
    if (location.pathname !== path) history.pushState(null, '', path);
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(routeFromLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    loadConfig()
      .then(setConfig)
      .catch(() => setConfigError('Could not reach the game server.'));
  }, []);

  let content;
  if (configError) {
    content = <SetupRequired error={configError} />;
  } else if (!config) {
    content = <Spinner label="Filling the pool…" />;
  } else if (!config.configured) {
    content = <SetupRequired missing={config.missing} />;
  } else if (route.name === 'room') {
    content = <RoomScreen code={route.code} navigate={navigate} />;
  } else if (route.name === 'howto') {
    content = <HowToPlay navigate={navigate} initialTab={route.tab} />;
  } else if (route.name === 'settings') {
    content = <SettingsScreen navigate={navigate} />;
  } else {
    content = <MenuScreen navigate={navigate} joinCode={route.joinCode} />;
  }

  return (
    <ToastProvider>
      <div className="app-bg" aria-hidden="true">
        <div className="bubble b1" />
        <div className="bubble b2" />
        <div className="bubble b3" />
      </div>
      <Suspense fallback={<Spinner label="Loading…" />}>{content}</Suspense>
    </ToastProvider>
  );
}
