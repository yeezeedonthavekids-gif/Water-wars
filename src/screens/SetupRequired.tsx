import { Logo } from '../components/ui';

export function SetupRequired({ missing, error }: { missing?: string[]; error?: string }) {
  return (
    <main className="screen setup">
      <Logo size="sm" />
      <div className="panel setup-panel">
        <h1>{error ? 'Game server unreachable' : 'Almost ready to play!'}</h1>
        {error ? (
          <p>
            {error} If you are running locally, start the API with <code>npm run dev</code>. On Netlify, check the
            function logs.
          </p>
        ) : (
          <>
            <p>
              The multiplayer backend has not been configured for this deployment yet. Add these environment variables in
              Netlify (<b>Site configuration → Environment variables</b>) and redeploy:
            </p>
            <ul className="setup-list">
              {missing?.map((m) => (
                <li key={m}>
                  <code>{m}</code>
                </li>
              ))}
            </ul>
            <p className="muted">Step-by-step instructions are in the project README (Firebase setup takes about 5 minutes).</p>
          </>
        )}
        <button className="btn btn-secondary" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    </main>
  );
}
