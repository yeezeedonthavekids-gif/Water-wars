// Netlify Function: the authoritative Water Wars game server.
// Mounted at /api/* (config below), so it is served from the same origin as the app.
import { handleApi } from '../../server/handler';

export default async (req: Request) => handleApi(req);

export const config = {
  path: ['/api', '/api/*'],
};
